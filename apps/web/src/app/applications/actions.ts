"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Z83 } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import {
  addEvent, ALLOWED_TYPES, attachUserDocument, myDocuments, getOrCreateDraft, MAX_FILE_BYTES, missingForSubmit, SINGLE_KINDS, storeUserDocument, type FileKind,
} from "@/lib/applications";
import { todayIso } from "@/lib/opportunities";
import { safely, UserFacingError } from "@/lib/safe-action";
import { requireUser, toActor } from "@/lib/session";
import { env } from "@/lib/env";
import { makeSimplePdf, sampleDocText, sampleZ83 } from "@/lib/sample-application";

const uuid = z.string().uuid();
const str = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const yesNo = (v: FormDataEntryValue | null) => (v === "yes" ? true : v === "no" ? false : undefined);

async function ownDraft(userId: string, applicationId: string) {
  const [a] = await db.select().from(schema.applications).where(and(eq(schema.applications.id, applicationId), eq(schema.applications.userId, userId)));
  if (!a) throw new UserFacingError("Application not found.");
  if (a.status !== "draft") throw new UserFacingError("This application has already been sent and can't be changed.");
  return a;
}

function z83FromForm(fd: FormData): Partial<Z83> {
  const rows = (prefix: string, keys: string[]) => {
    const out: Record<string, string>[] = [];
    for (let i = 0; i < 6; i++) {
      const row = Object.fromEntries(keys.map((k) => [k, str(fd.get(`${prefix}_${k}_${i}`))]));
      if (Object.values(row).some(Boolean)) out.push(row);
    }
    return out;
  };
  return {
    surname: str(fd.get("surname")),
    fullNames: str(fd.get("fullNames")),
    dateOfBirth: str(fd.get("dateOfBirth"), 10),
    idNumber: str(fd.get("idNumber"), 20).replace(/\s/g, ""),
    passportNumber: str(fd.get("passportNumber"), 20),
    citizenship: (["sa", "permanent_resident", "other"].includes(str(fd.get("citizenship"))) ? str(fd.get("citizenship")) : "sa") as Z83["citizenship"],
    nationality: str(fd.get("nationality")),
    phone: str(fd.get("phone"), 30),
    email: str(fd.get("email")),
    preferredLanguage: str(fd.get("preferredLanguage"), 40),
    contactMethod: (["email", "phone", "post"].includes(str(fd.get("contactMethod"))) ? str(fd.get("contactMethod")) : "email") as Z83["contactMethod"],
    driversLicence: fd.get("driversLicence") === "yes",
    disability: yesNo(fd.get("disability")),
    criminalRecord: yesNo(fd.get("criminalRecord")),
    criminalRecordDetails: str(fd.get("criminalRecordDetails"), 500),
    pendingCase: yesNo(fd.get("pendingCase")),
    dismissed: yesNo(fd.get("dismissed")),
    businessWithState: yesNo(fd.get("businessWithState")),
    businessDetails: str(fd.get("businessDetails"), 500),
    qualifications: rows("q", ["name", "institution", "year"]) as Z83["qualifications"],
    experience: rows("x", ["employer", "position", "from", "to", "reason"]) as Z83["experience"],
    declaration: fd.get("declaration") === "on",
  };
}

async function startApplicationImpl(formData: FormData) {
  const oppId = uuid.parse(formData.get("opportunityId"));
  const u = await requireUser(`/posts/${oppId}`);
  const app = await getOrCreateDraft(u, oppId);
  redirect(`/applications/${app.id}`);
}

async function saveApplicationImpl(formData: FormData) {
  const u = await requireUser("/applications");
  const id = uuid.parse(formData.get("applicationId"));
  const app = await ownDraft(u.id, id);
  const z83 = z83FromForm(formData);
  if (z83.idNumber && !/^\d{13}$/.test(z83.idNumber)) throw new UserFacingError("A South African ID number has 13 digits. Please check it.");
  await db.update(schema.applications).set({ z83, updatedAt: new Date() }).where(eq(schema.applications.id, id));

  if (formData.get("intent") !== "submit") {
    revalidatePath(`/applications/${id}`);
    redirect(`/applications/${id}?saved=1`);
  }
  // Send it.
  const [opp] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, app.opportunityId));
  if (!opp || opp.status === "withdrawn" || (opp.closingDate && opp.closingDate < todayIso())) {
    throw new UserFacingError("This job has closed, so the application can't be sent.");
  }
  const kinds = (await db.select({ kind: schema.applicationFiles.kind }).from(schema.applicationFiles).where(eq(schema.applicationFiles.applicationId, id))).map((r) => r.kind);
  const missing = missingForSubmit(z83, kinds);
  if (missing.length) throw new UserFacingError(`Almost there. Still needed: ${missing.join(", ")}.`);
  await db.update(schema.applications).set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() }).where(eq(schema.applications.id, id));
  await addEvent(id, "submitted", { id: u.id, name: u.name });
  await logAudit({ actor: toActor(u), action: "application.submit", entity: "application", entityId: id, after: { opportunityId: app.opportunityId } });
  revalidatePath("/applications");
  redirect(`/applications/${id}?flash=applied`);
}

async function uploadApplicationFileImpl(formData: FormData) {
  const u = await requireUser("/applications");
  const id = uuid.parse(formData.get("applicationId"));
  await ownDraft(u.id, id);
  const kind = z.enum(["cv", "id_copy", "qualification", "other"]).parse(formData.get("kind")) as FileKind;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) throw new UserFacingError("Each document must be smaller than 4 MB.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new UserFacingError("Upload a PDF, Word document, or a photo (JPG or PNG).");
  const f = { fileName: file.name.slice(0, 200), contentType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) };
  // Keep it in the person's documents too, so the next application can reuse it.
  const stored = await storeUserDocument(u.id, kind, f);
  if (SINGLE_KINDS.includes(kind)) {
    await db.delete(schema.applicationFiles).where(and(eq(schema.applicationFiles.applicationId, id), eq(schema.applicationFiles.kind, kind)));
  }
  await db.insert(schema.applicationFiles).values({ applicationId: id, kind, ...f, fromUserDocumentId: stored.id, uploadedAt: stored.updatedAt });
  revalidatePath(`/applications/${id}`);
  redirect(`/applications/${id}#documents`);
}

async function attachSavedDocumentImpl(formData: FormData) {
  const u = await requireUser("/applications");
  const id = uuid.parse(formData.get("applicationId"));
  await ownDraft(u.id, id);
  await attachUserDocument(u.id, id, uuid.parse(formData.get("userDocumentId")));
  revalidatePath(`/applications/${id}`);
  redirect(`/applications/${id}#documents`);
}

/** Testing aid (only while SAMPLE_DATA_ONLY is on): fill the form with sample answers (keeping the
 * person's own name and email). Where a document is missing, attach their saved one, or else a sample. */
async function fillWithSampleDataImpl(formData: FormData) {
  if (!env.SAMPLE_DATA_ONLY) throw new UserFacingError("Sample data is turned off.");
  const u = await requireUser("/applications");
  const id = uuid.parse(formData.get("applicationId"));
  const app = await ownDraft(u.id, id);
  await db.update(schema.applications).set({ z83: { ...app.z83, ...sampleZ83(u.name, u.email), declaration: false }, updatedAt: new Date() }).where(eq(schema.applications.id, id));
  const have = (await db.select({ kind: schema.applicationFiles.kind }).from(schema.applicationFiles).where(eq(schema.applicationFiles.applicationId, id))).map((r) => r.kind);
  const saved = await myDocuments(u.id);
  for (const kind of ["cv", "id_copy", "qualification"] as FileKind[]) {
    if (have.includes(kind)) continue;
    const mine = saved.find((d) => d.kind === kind);
    if (mine) {
      await attachUserDocument(u.id, id, mine.id);
      continue;
    }
    const t = sampleDocText(kind, { name: u.name, email: u.email });
    const data = makeSimplePdf(t.title, t.lines);
    const f = { fileName: t.fileName, contentType: "application/pdf", size: data.length, data };
    const stored = await storeUserDocument(u.id, kind, f);
    await db.insert(schema.applicationFiles).values({ applicationId: id, kind, ...f, fromUserDocumentId: stored.id, uploadedAt: stored.updatedAt });
  }
  revalidatePath(`/applications/${id}`);
  redirect(`/applications/${id}?sample=1`);
}

async function deleteApplicationFileImpl(formData: FormData) {
  const u = await requireUser("/applications");
  const id = uuid.parse(formData.get("applicationId"));
  await ownDraft(u.id, id);
  const fileId = uuid.parse(formData.get("fileId"));
  await db.delete(schema.applicationFiles).where(and(eq(schema.applicationFiles.id, fileId), eq(schema.applicationFiles.applicationId, id)));
  revalidatePath(`/applications/${id}`);
  redirect(`/applications/${id}#documents`);
}

async function withdrawApplicationImpl(formData: FormData) {
  const u = await requireUser("/applications");
  const id = uuid.parse(formData.get("applicationId"));
  const [a] = await db.select().from(schema.applications).where(and(eq(schema.applications.id, id), eq(schema.applications.userId, u.id)));
  if (!a) throw new UserFacingError("Application not found.");
  if (a.status === "draft") {
    await db.delete(schema.applications).where(eq(schema.applications.id, id));
    revalidatePath("/applications");
    redirect("/applications");
  }
  if (["withdrawn", "appointed", "not_successful"].includes(a.status)) throw new UserFacingError("This application can no longer be withdrawn.");
  await db.update(schema.applications).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(schema.applications.id, id));
  await addEvent(id, "withdrawn", { id: u.id, name: u.name });
  await logAudit({ actor: toActor(u), action: "application.withdraw", entity: "application", entityId: id });
  revalidatePath("/applications");
  redirect(`/applications/${id}`);
}

// Guarded entry points: a failure shows a message instead of crashing the app.
export async function startApplication(formData?: FormData) {
  return safely(() => startApplicationImpl(formData as FormData), `/posts/${formData?.get("opportunityId") ?? ""}`);
}
export async function saveApplication(formData?: FormData) {
  return safely(() => saveApplicationImpl(formData as FormData), `/applications/${formData?.get("applicationId") ?? ""}`);
}
export async function uploadApplicationFile(formData?: FormData) {
  return safely(() => uploadApplicationFileImpl(formData as FormData), `/applications/${formData?.get("applicationId") ?? ""}`);
}
export async function deleteApplicationFile(formData?: FormData) {
  return safely(() => deleteApplicationFileImpl(formData as FormData), `/applications/${formData?.get("applicationId") ?? ""}`);
}
export async function withdrawApplication(formData?: FormData) {
  return safely(() => withdrawApplicationImpl(formData as FormData), `/applications/${formData?.get("applicationId") ?? ""}`);
}
export async function attachSavedDocument(formData?: FormData) {
  return safely(() => attachSavedDocumentImpl(formData as FormData), `/applications/${formData?.get("applicationId") ?? ""}`);
}
export async function fillWithSampleData(formData?: FormData) {
  return safely(() => fillWithSampleDataImpl(formData as FormData), `/applications/${formData?.get("applicationId") ?? ""}`);
}
