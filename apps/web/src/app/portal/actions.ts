"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { AiServiceError, type AdvertRecord, type Amendment } from "@/lib/ai";
import { createDocument, extractAmendments, extractChunk, fullText, listChunks } from "@/lib/documents";
import { approveAmendment, approveNew, PublishError, rejectExtraction } from "@/lib/publish";
import { canActOnDepartment, requireOfficer } from "@/lib/session";
import { SAMPLE_MODE } from "@/lib/flags";

const uploadSchema = z.object({
  kind: z.enum(["circular", "advert", "amendment", "form"]),
  title: z.string().trim().min(3).max(200),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  departmentId: z.coerce.number().int().positive().optional(),
  confirmPublic: z.literal("on").optional(),
});

export async function uploadDocument(formData: FormData) {
  const u = await requireOfficer();
  const parsed = uploadSchema.safeParse(Object.fromEntries(formData));
  const file = formData.get("file");
  const fail = (m: string) => redirect(`/portal/upload?error=${encodeURIComponent(m)}`);
  if (!parsed.success) fail("Please fill in every field.");
  if (!(file instanceof File) || file.size === 0) fail("Choose a PDF file.");
  const p = parsed.data!;
  const f = file as File;
  if (SAMPLE_MODE && p.confirmPublic !== "on") fail("In sample mode you must confirm the document is public.");
  if (f.size > 4 * 1024 * 1024) fail("The PDF must be smaller than 4 MB. For a whole circular, upload just your department\u2019s pages (its annexure).");
  const departmentId = u.role === "admin" ? p.departmentId ?? u.departmentId : u.departmentId;
  if (!departmentId) fail("Choose a department.");

  let target = "";
  try {
    const bytes = Buffer.from(await f.arrayBuffer());
    if (bytes.subarray(0, 4).toString() !== "%PDF") fail("That file is not a PDF.");
    const { doc } = await createDocument(u, {
      bytes, fileName: f.name, kind: p.kind, title: p.title, departmentId: departmentId!,
      documentDate: p.documentDate || null, isSample: true,
    });
    if (p.kind === "advert") {
      const ext = await extractChunk(u, doc, { chunk_ref: "all", text: fullText(doc), page: 1 });
      target = `/portal/review/${ext.id}`;
    } else if (p.kind === "amendment") {
      await extractAmendments(u, doc);
      target = `/portal/documents/${doc.id}`;
    } else if (p.kind === "form") {
      target = `/portal/forms?doc=${doc.id}`;
    } else {
      target = `/portal/documents/${doc.id}`;
    }
  } catch (e) {
    if (e instanceof AiServiceError) fail(e.message);
    throw e;
  }
  revalidatePath("/portal");
  redirect(target);
}

export async function extractChunkAction(formData: FormData) {
  const u = await requireOfficer();
  const docId = z.string().uuid().parse(formData.get("docId"));
  const ref = z.string().min(1).parse(formData.get("chunkRef"));
  const [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.id, docId));
  if (!doc || !canActOnDepartment(u, doc.departmentId)) redirect("/portal");
  let id = "";
  try {
    const chunk = (await listChunks(doc)).find((c) => c.chunk_ref === ref);
    if (!chunk) redirect(`/portal/documents/${docId}`);
    id = (await extractChunk(u, doc, { chunk_ref: chunk.chunk_ref, text: chunk.text, page: chunk.page })).id;
  } catch (e) {
    if (e instanceof AiServiceError) redirect(`/portal/documents/${docId}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/portal/review/${id}`);
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
const val = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

function recordFromForm(fd: FormData, original: AdvertRecord): AdvertRecord {
  return {
    ...original,
    post_title: val(fd.get("post_title")),
    reference_number: val(fd.get("reference_number")),
    closing_date: val(fd.get("closing_date")),
    salary: val(fd.get("salary")),
    location: val(fd.get("location")),
    form_required: val(fd.get("form_required")),
    opportunity_type: (["post", "internship", "learnership"].includes(String(fd.get("opportunity_type"))) ? fd.get("opportunity_type") : "post") as AdvertRecord["opportunity_type"],
    minimum_requirements: lines(fd.get("minimum_requirements")),
    documents_required: lines(fd.get("documents_required")),
    conditional_items: lines(fd.get("conditional_items")).map((l) => {
      const [item, ...rest] = l.split("|");
      return { item: item.trim(), when: rest.join("|").trim() || "see advert" };
    }),
    apply_route: {
      email: val(fd.get("apply_email")), portal_url: val(fd.get("apply_portal_url")),
      postal: val(fd.get("apply_postal")), hand_delivery: val(fd.get("apply_hand_delivery")),
    },
    contact: { name: val(fd.get("contact_name")), phone: val(fd.get("contact_phone")) },
  };
}

export async function approveAction(formData: FormData) {
  const u = await requireOfficer();
  const id = z.string().uuid().parse(formData.get("extractionId"));
  const note = val(formData.get("note"));
  const [ext] = await db.select().from(schema.extractions).where(eq(schema.extractions.id, id));
  if (!ext) redirect("/portal");
  let oppId = "";
  try {
    if (ext.mode === "amendment") {
      oppId = (await approveAmendment(u, id, ext.record as unknown as Amendment, note)).id;
    } else {
      const rec = recordFromForm(formData, ext.record as unknown as AdvertRecord);
      if (rec.closing_date && !/^\d{4}-\d{2}-\d{2}$/.test(rec.closing_date)) throw new PublishError("Closing date must be a date.");
      oppId = (await approveNew(u, id, rec, note)).id;
    }
  } catch (e) {
    if (e instanceof PublishError) redirect(`/portal/review/${id}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/portal");
  revalidatePath(`/posts/${oppId}`);
  redirect(`/portal/review/${id}?approved=${oppId}`);
}

export async function rejectAction(formData: FormData) {
  const u = await requireOfficer();
  const id = z.string().uuid().parse(formData.get("extractionId"));
  const note = val(formData.get("note")) ?? "Rejected by officer";
  try {
    await rejectExtraction(u, id, note);
  } catch (e) {
    if (e instanceof PublishError) redirect(`/portal/review/${id}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/portal");
  redirect("/portal");
}
