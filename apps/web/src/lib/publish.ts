import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AdvertRecord, Amendment } from "@/lib/ai";
import { logAudit } from "@/lib/audit";
import { formatDate } from "@/lib/format";
import { notifySavers } from "@/lib/notify";
import { canActOnDepartment, toActor, type CurrentUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";

type Opp = typeof schema.opportunities.$inferSelect;

const VERSIONED_FIELDS = [
  "postTitle", "referenceNumber", "closingDate", "salary", "location", "province", "minimumRequirements",
  "documentsRequired", "formRequired", "applyRoute", "contact", "conditionalItems", "type", "status",
] as const;

function snapshot(o: Partial<Opp>) {
  const out: Record<string, unknown> = {};
  for (const f of VERSIONED_FIELDS) out[f] = o[f] ?? null;
  return out;
}

function changed(before: Record<string, unknown>, after: Record<string, unknown>) {
  return VERSIONED_FIELDS.filter((f) => JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null) && f !== "status");
}

export class PublishError extends Error {}

/** Approve a "new" extraction: publish a new opportunity (or a new version of its existing one). */
export async function approveNew(u: CurrentUser, extractionId: string, rec: AdvertRecord, note: string | null) {
  const [ext] = await db.select().from(schema.extractions).where(eq(schema.extractions.id, extractionId));
  if (!ext || ext.mode !== "new") throw new PublishError("Record not found.");
  if (!canActOnDepartment(u, ext.departmentId)) throw new PublishError("You can only approve records for your own department.");
  if (ext.status === "approved" || ext.status === "rejected") throw new PublishError("This record was already reviewed.");
  if (!rec.post_title?.trim()) throw new PublishError("A post title is required.");
  const [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.id, ext.sourceDocumentId));
  const [z83] = await db.select().from(schema.forms).where(eq(schema.forms.code, "Z83"));
  const [dept] = await db.select().from(schema.departments).where(eq(schema.departments.id, ext.departmentId!));

  const values = {
    type: rec.opportunity_type ?? "post",
    departmentId: ext.departmentId!,
    postTitle: rec.post_title.trim(),
    referenceNumber: rec.reference_number || null,
    closingDate: rec.closing_date || null,
    salary: rec.salary || null,
    location: rec.location || null,
    province: dept?.province ?? rec.province ?? null,
    minimumRequirements: rec.minimum_requirements ?? [],
    documentsRequired: rec.documents_required ?? [],
    formRequired: rec.form_required || null,
    formId: rec.form_required && /z\s*83/i.test(rec.form_required) ? z83?.id ?? null : null,
    applyRoute: rec.apply_route,
    contact: rec.contact,
    conditionalItems: rec.conditional_items ?? [],
    evidence: rec.evidence ?? {},
    isSample: doc?.isSample ?? true,
    sourceDocumentId: ext.sourceDocumentId,
    sourceText: ext.chunkText,
    sourceDate: doc?.documentDate ?? null,
    updatedAt: new Date(),
  };

  return db.transaction(async (tx) => {
    let opp: Opp;
    let version = 1;
    let changedFields: string[] = [];
    const existing = ext.targetOpportunityId
      ? (await tx.select().from(schema.opportunities).where(eq(schema.opportunities.id, ext.targetOpportunityId)))[0]
      : undefined;
    if (existing) {
      version = existing.currentVersion + 1;
      changedFields = changed(snapshot(existing), snapshot(values as Partial<Opp>));
      [opp] = await tx.update(schema.opportunities).set({ ...values, currentVersion: version }).where(eq(schema.opportunities.id, existing.id)).returning();
    } else {
      [opp] = await tx.insert(schema.opportunities).values(values).returning();
    }
    await tx.insert(schema.opportunityVersions).values({
      opportunityId: opp.id, version, record: snapshot(opp), changedFields, sourceDocumentId: ext.sourceDocumentId,
      extractionId: ext.id, note: note || `Published from ${doc?.title ?? "uploaded document"}${ext.chunkRef !== "all" ? ` (post ${ext.chunkRef})` : ""}`,
      approvedBy: u.id,
    });
    const edited = JSON.stringify(ext.record) !== JSON.stringify(rec);
    await tx.update(schema.extractions)
      .set({ status: "approved", record: rec as unknown as Record<string, unknown>, reviewedBy: u.id, reviewedAt: new Date(), reviewNote: note, targetOpportunityId: opp.id })
      .where(eq(schema.extractions.id, ext.id));
    await tx.insert(schema.auditLog).values({
      actorUserId: u.id, actorName: u.name, actorDepartmentId: u.departmentId,
      action: existing ? "opportunity.update" : "opportunity.publish", entity: "opportunity", entityId: opp.id,
      before: existing ? snapshot(existing) : null, after: { ...snapshot(opp), version, editedByOfficer: edited, extractionId: ext.id },
    });
    return opp;
  });
}

/** Apply a reviewed amendment to its target post: new version, status change, notify savers. */
export async function approveAmendment(u: CurrentUser, extractionId: string, a: Amendment, note: string | null) {
  const [ext] = await db.select().from(schema.extractions).where(eq(schema.extractions.id, extractionId));
  if (!ext || ext.mode !== "amendment") throw new PublishError("Record not found.");
  if (!ext.targetOpportunityId) throw new PublishError("This amendment does not match any post in iGovPath.");
  if (ext.status === "approved" || ext.status === "rejected") throw new PublishError("This record was already reviewed.");
  const [opp] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, ext.targetOpportunityId));
  if (!opp) throw new PublishError("Target post no longer exists.");
  if (!canActOnDepartment(u, opp.departmentId)) {
    throw new PublishError("This amendment is for another department's post. An officer from that department must approve it.");
  }
  const [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.id, ext.sourceDocumentId));

  const ch = a.changes;
  const update: Partial<Opp> = {};
  if (ch.closing_date) update.closingDate = ch.closing_date;
  if (ch.minimum_requirements?.length) update.minimumRequirements = ch.minimum_requirements;
  if (ch.apply_route) update.applyRoute = { ...(opp.applyRoute ?? { email: null, portal_url: null, postal: null, hand_delivery: null }), ...Object.fromEntries(Object.entries(ch.apply_route).filter(([, v]) => v)) } as Opp["applyRoute"];
  if (ch.location) update.location = ch.location;
  if (ch.salary) update.salary = ch.salary;
  const status = a.status_change === "withdrawn" ? "withdrawn" : a.status_change === "extended" && !ch.minimum_requirements?.length ? "extended" : "amended";
  update.status = status;
  const before = snapshot(opp);
  const after = snapshot({ ...opp, ...update });
  const changedFields = changed(before, after);
  if (!changedFields.length && status === opp.status) throw new PublishError("This amendment does not change anything on the post.");
  const version = opp.currentVersion + 1;

  const updated = await db.transaction(async (tx) => {
    const [o] = await tx.update(schema.opportunities)
      .set({ ...update, currentVersion: version, updatedAt: new Date(), sourceDate: doc?.documentDate ?? opp.sourceDate })
      .where(eq(schema.opportunities.id, opp.id)).returning();
    await tx.insert(schema.opportunityVersions).values({
      opportunityId: opp.id, version, record: after, changedFields: status !== opp.status && !changedFields.length ? ["status"] : changedFields,
      sourceDocumentId: ext.sourceDocumentId, extractionId: ext.id,
      note: note || `Amendment: ${a.summary || status}`, approvedBy: u.id,
    });
    await tx.update(schema.extractions)
      .set({ status: "approved", record: a as unknown as Record<string, unknown>, reviewedBy: u.id, reviewedAt: new Date(), reviewNote: note })
      .where(eq(schema.extractions.id, ext.id));
    return o;
  });
  await logAudit({ actor: toActor(u), action: `opportunity.${status}`, entity: "opportunity", entityId: opp.id, before, after: { ...after, version, changedFields } });

  const title = displayTitle(opp.postTitle);
  const msg =
    status === "withdrawn"
      ? `"${title}" has been withdrawn. Do not apply.`
      : status === "extended"
        ? `"${title}" was extended. New closing date: ${formatDate(update.closingDate ?? opp.closingDate)}.`
        : `"${title}" was amended: ${changedFields.map((f) => ({ closingDate: "closing date", minimumRequirements: "requirements", applyRoute: "how to apply", location: "location", salary: "salary" })[f as string] ?? f).join(", ")} changed. Check the updated checklist.`;
  await notifySavers(opp.id, status, msg, `v${version}`);
  return updated;
}

export async function rejectExtraction(u: CurrentUser, extractionId: string, note: string) {
  const [ext] = await db.select().from(schema.extractions).where(eq(schema.extractions.id, extractionId));
  if (!ext) throw new PublishError("Record not found.");
  if (!canActOnDepartment(u, ext.departmentId)) throw new PublishError("You can only review records for your own department.");
  await db.update(schema.extractions).set({ status: "rejected", reviewedBy: u.id, reviewedAt: new Date(), reviewNote: note }).where(eq(schema.extractions.id, ext.id));
  await logAudit({ actor: toActor(u), action: "extraction.reject", entity: "extraction", entityId: ext.id, before: { status: ext.status }, after: { status: "rejected", note } });
}
