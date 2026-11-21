import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Z83 } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { todayIso } from "@/lib/opportunities";
import { UserFacingError } from "@/lib/safe-action";
import { canActOnDepartment, isActiveOfficer, toActor, type CurrentUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";

export type AppStatus = (typeof schema.applicationStatusEnum.enumValues)[number];
export type FileKind = (typeof schema.applicationFileKindEnum.enumValues)[number];

export const STATUS_LABEL: Record<AppStatus, string> = {
  draft: "Not sent yet",
  submitted: "Sent",
  under_review: "Being reviewed",
  shortlisted: "Shortlisted",
  not_successful: "Not successful",
  appointed: "Appointed",
  withdrawn: "Withdrawn",
};

/** What officers may move an application to (applicants can only submit or withdraw). */
export const OFFICER_STATUSES: AppStatus[] = ["under_review", "shortlisted", "not_successful", "appointed"];

export const FILE_LABEL: Record<FileKind, string> = {
  cv: "CV",
  id_copy: "Certified copy of your ID",
  qualification: "Certified copies of qualifications",
  other: "Other documents",
};
export const REQUIRED_FILES: FileKind[] = ["cv", "id_copy"];
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export const maskId = (id?: string) => (id && id.length > 4 ? `${"•".repeat(Math.max(0, id.length - 4))}${id.slice(-4)}` : id ?? "");

/** Load an application the given user may see: the applicant, or an officer of that department (or admin). */
export async function getApplicationFor(u: CurrentUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ a: schema.applications, o: schema.opportunities, dept: schema.departments.name, applicant: schema.user.name, applicantEmail: schema.user.email })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.opportunities.id, schema.applications.opportunityId))
    .innerJoin(schema.departments, eq(schema.departments.id, schema.applications.departmentId))
    .innerJoin(schema.user, eq(schema.user.id, schema.applications.userId))
    .where(eq(schema.applications.id, id));
  if (!row) return null;
  const isOwner = row.a.userId === u.id;
  const isDeptOfficer = isActiveOfficer(u) && canActOnDepartment(u, row.a.departmentId) && row.a.status !== "draft";
  if (!isOwner && !isDeptOfficer) return null;
  const files = await db
    .select({ id: schema.applicationFiles.id, kind: schema.applicationFiles.kind, fileName: schema.applicationFiles.fileName, size: schema.applicationFiles.size, uploadedAt: schema.applicationFiles.uploadedAt, fromUserDocumentId: schema.applicationFiles.fromUserDocumentId })
    .from(schema.applicationFiles)
    .where(eq(schema.applicationFiles.applicationId, id));
  const events = await db
    .select()
    .from(schema.applicationEvents)
    .where(eq(schema.applicationEvents.applicationId, id))
    .orderBy(desc(schema.applicationEvents.at));
  return { ...row, files, events, isOwner, isDeptOfficer };
}

/** Find the user's application for a post, or start a draft pre-filled from their account and CV summary. */
export async function getOrCreateDraft(u: CurrentUser, opportunityId: string) {
  const [existing] = await db
    .select()
    .from(schema.applications)
    .where(and(eq(schema.applications.userId, u.id), eq(schema.applications.opportunityId, opportunityId)));
  if (existing) return existing;
  const [opp] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  if (!opp) throw new UserFacingError("That job no longer exists.");
  if (opp.status === "withdrawn" || (opp.closingDate && opp.closingDate < todayIso())) {
    throw new UserFacingError("This job has closed, so new applications can't be started.");
  }
  const [profile] = await db.select().from(schema.applicantProfiles).where(eq(schema.applicantProfiles.userId, u.id));
  const cv = (profile?.cvProfile ?? {}) as { qualifications?: string[]; experience?: { role: string; years: number | null }[]; licences?: string[] };
  // Reuse the answers from the person's last application, so they don't type them again.
  const [last] = await db
    .select({ z83: schema.applications.z83 })
    .from(schema.applications)
    .where(eq(schema.applications.userId, u.id))
    .orderBy(desc(schema.applications.updatedAt))
    .limit(1);
  const parts = u.name.trim().split(/\s+/);
  const prefill: Partial<Z83> = {
    fullNames: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0],
    surname: parts.length > 1 ? parts[parts.length - 1] : "",
    email: u.email,
    contactMethod: "email",
    citizenship: "sa",
    driversLicence: (cv.licences ?? []).length > 0,
    qualifications: (cv.qualifications ?? []).slice(0, 6).map((q) => ({ name: q, institution: "", year: "" })),
    experience: (cv.experience ?? []).slice(0, 6).map((e) => ({ employer: "", position: e.role, from: "", to: "" })),
  };
  // Previous answers win over the account/CV guess; the declaration is always signed afresh.
  const fromLast = (last?.z83 ?? {}) as Partial<Z83>;
  const z83: Partial<Z83> = { ...prefill, ...Object.fromEntries(Object.entries(fromLast).filter(([, v]) => v !== "" && v !== undefined && !(Array.isArray(v) && v.length === 0))), declaration: false };
  const [created] = await db
    .insert(schema.applications)
    .values({ opportunityId, userId: u.id, departmentId: opp.departmentId, status: "draft", z83 })
    .onConflictDoNothing()
    .returning();
  if (created) {
    await attachAllSavedDocuments(u.id, created.id);
    return created;
  }
  const [again] = await db.select().from(schema.applications).where(and(eq(schema.applications.userId, u.id), eq(schema.applications.opportunityId, opportunityId)));
  return again;
}

/** Everything still missing before an application can be sent. */
export function missingForSubmit(z: Partial<Z83>, fileKinds: FileKind[]): string[] {
  const m: string[] = [];
  if (!z.surname?.trim()) m.push("Surname");
  if (!z.fullNames?.trim()) m.push("Full names");
  if (!z.dateOfBirth) m.push("Date of birth");
  if (!z.idNumber?.trim() && !z.passportNumber?.trim()) m.push("ID number (or passport number)");
  if (!z.phone?.trim()) m.push("Phone number");
  if (!z.email?.trim()) m.push("Email address");
  if (!(z.qualifications ?? []).some((q) => q.name?.trim())) m.push("At least one qualification");
  if (z.criminalRecord === undefined || z.pendingCase === undefined || z.dismissed === undefined || z.businessWithState === undefined) {
    m.push("Answers to the yes/no questions");
  }
  for (const k of REQUIRED_FILES) if (!fileKinds.includes(k)) m.push(FILE_LABEL[k]);
  if (!z.declaration) m.push("The declaration");
  return m;
}

export async function addEvent(applicationId: string, status: AppStatus, actor: { id: string; name: string } | null, note?: string | null) {
  await db.insert(schema.applicationEvents).values({ applicationId, status, note: note ?? null, actorUserId: actor?.id ?? null, actorName: actor?.name ?? null });
}

/** Officer changes the status; the applicant gets a message. People decide; AI never does. */
export async function setStatusByOfficer(u: CurrentUser, applicationId: string, status: AppStatus, note: string | null) {
  if (!OFFICER_STATUSES.includes(status)) throw new UserFacingError("That status can't be set by an officer.");
  const app = await getApplicationFor(u, applicationId);
  if (!app || !app.isDeptOfficer) throw new UserFacingError("You can only manage applications for your own department.");
  if (app.a.status === "withdrawn") throw new UserFacingError("The applicant withdrew this application.");
  if (app.a.status === status) return;
  await db.update(schema.applications).set({ status, updatedAt: new Date() }).where(eq(schema.applications.id, applicationId));
  await addEvent(applicationId, status, { id: u.id, name: u.name }, note);
  await logAudit({ actor: toActor(u), action: "application.status", entity: "application", entityId: applicationId, before: { status: app.a.status }, after: { status } });
  await db
    .insert(schema.notifications)
    .values({
      userId: app.a.userId,
      opportunityId: app.o.id,
      kind: "application_status",
      message: `Your application for "${displayTitle(app.o.postTitle)}" is now: ${STATUS_LABEL[status]}.${note ? ` Note from the department: ${note}` : ""}`,
      dedupeKey: `app:${applicationId}:${status}:${Date.now()}`,
    })
    .onConflictDoNothing();
}


/** CV and ID copy keep one current version each; qualifications and other documents can have several. */
export const SINGLE_KINDS: FileKind[] = ["cv", "id_copy"];

type FileData = { fileName: string; contentType: string; size: number; data: Buffer };

/** Keep a document in the person's own store so they can reuse it on their next application. Returns the stored row. */
export async function storeUserDocument(userId: string, kind: FileKind, f: FileData) {
  const now = new Date();
  if (SINGLE_KINDS.includes(kind)) {
    const [existing] = await db.select({ id: schema.userDocuments.id }).from(schema.userDocuments)
      .where(and(eq(schema.userDocuments.userId, userId), eq(schema.userDocuments.kind, kind)));
    if (existing) {
      const [row] = await db.update(schema.userDocuments).set({ ...f, updatedAt: now }).where(eq(schema.userDocuments.id, existing.id)).returning({ id: schema.userDocuments.id, updatedAt: schema.userDocuments.updatedAt });
      return row;
    }
  }
  const [row] = await db.insert(schema.userDocuments).values({ userId, kind, ...f, updatedAt: now }).returning({ id: schema.userDocuments.id, updatedAt: schema.userDocuments.updatedAt });
  return row;
}

/** The person's saved documents (without file bytes). */
export async function myDocuments(userId: string) {
  return db
    .select({ id: schema.userDocuments.id, kind: schema.userDocuments.kind, fileName: schema.userDocuments.fileName, size: schema.userDocuments.size, updatedAt: schema.userDocuments.updatedAt })
    .from(schema.userDocuments)
    .where(eq(schema.userDocuments.userId, userId))
    .orderBy(desc(schema.userDocuments.updatedAt));
}

/** Copy one saved document into a draft application. A CV or ID copy replaces the one already attached. */
export async function attachUserDocument(userId: string, applicationId: string, userDocumentId: string) {
  const [d] = await db.select().from(schema.userDocuments).where(and(eq(schema.userDocuments.id, userDocumentId), eq(schema.userDocuments.userId, userId)));
  if (!d) throw new UserFacingError("That saved document no longer exists.");
  if (SINGLE_KINDS.includes(d.kind)) {
    await db.delete(schema.applicationFiles).where(and(eq(schema.applicationFiles.applicationId, applicationId), eq(schema.applicationFiles.kind, d.kind)));
  } else {
    await db.delete(schema.applicationFiles).where(and(eq(schema.applicationFiles.applicationId, applicationId), eq(schema.applicationFiles.fromUserDocumentId, d.id)));
  }
  await db.insert(schema.applicationFiles).values({
    applicationId, kind: d.kind, fileName: d.fileName, contentType: d.contentType, size: d.size, data: d.data,
    fromUserDocumentId: d.id, uploadedAt: d.updatedAt,
  });
}

/** A new draft starts with every saved document already attached. */
export async function attachAllSavedDocuments(userId: string, applicationId: string) {
  for (const d of await myDocuments(userId)) await attachUserDocument(userId, applicationId, d.id);
}
