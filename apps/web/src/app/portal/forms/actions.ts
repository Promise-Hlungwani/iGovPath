"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { notifySavers } from "@/lib/notify";
import { todayIso } from "@/lib/opportunities";
import { canActOnDepartment, requireOfficer, toActor } from "@/lib/session";

const s = z.object({
  docId: z.string().uuid(),
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(3).max(200),
  version: z.string().trim().min(1).max(40),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

/** Register a new version of a department-owned form. Central forms (Z83) can never be changed here. */
export async function publishFormVersion(formData: FormData) {
  const u = await requireOfficer();
  const p = s.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect(`/portal/forms?doc=${formData.get("docId")}&error=${encodeURIComponent("Fill in every field.")}`);
  const { docId, code, name, version, effectiveDate } = p.data;
  const [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.id, docId));
  if (!doc || !canActOnDepartment(u, doc.departmentId)) redirect("/portal/forms");

  const sameCode = await db.select().from(schema.forms).where(eq(schema.forms.code, code));
  if (sameCode.some((f) => f.isCentral)) {
    redirect(`/portal/forms?doc=${docId}&error=${encodeURIComponent(`${code} is prescribed centrally. Departments use it as is and cannot publish versions of it.`)}`);
  }
  const current = sameCode.find((f) => f.status === "current");
  if (current && !canActOnDepartment(u, current.ownerDepartmentId)) {
    redirect(`/portal/forms?doc=${docId}&error=${encodeURIComponent("This form belongs to another department.")}`);
  }
  const owner = current?.ownerDepartmentId ?? doc.departmentId!;
  const [created] = await db
    .insert(schema.forms)
    .values({ code, name, version, effectiveDate: effectiveDate || null, isCentral: false, ownerDepartmentId: owner, sourceDocumentId: doc.id, status: "current" })
    .returning();
  if (current) {
    await db.update(schema.forms).set({ status: "superseded", supersededById: created.id }).where(eq(schema.forms.id, current.id));
    // Warn applicants who saved an open post from the owning department.
    const opps = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(and(eq(schema.opportunities.departmentId, owner), gte(schema.opportunities.closingDate, todayIso())));
    if (opps.length) {
      const saved = await db
        .select({ opportunityId: schema.savedOpportunities.opportunityId })
        .from(schema.savedOpportunities)
        .where(inArray(schema.savedOpportunities.opportunityId, opps.map((o) => o.id)));
      for (const oid of new Set(saved.map((x) => x.opportunityId))) {
        await notifySavers(oid, "form_superseded", `${name}: version ${version} replaces version ${current.version}. If you downloaded the old one, use the new version.`, `form:${created.id}`);
      }
    }
  }
  await logAudit({
    actor: toActor(u), action: current ? "form.new_version" : "form.create", entity: "form", entityId: created.id,
    before: current ? { id: current.id, version: current.version, status: "current" } : null,
    after: { code, version, status: "current", supersedes: current?.id ?? null },
  });
  revalidatePath("/portal/forms");
  redirect("/portal/forms?published=1");
}
