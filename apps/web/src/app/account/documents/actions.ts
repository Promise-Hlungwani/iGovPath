"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ALLOWED_TYPES, MAX_FILE_BYTES, storeUserDocument, type FileKind } from "@/lib/applications";
import { safely, UserFacingError } from "@/lib/safe-action";
import { requireUser } from "@/lib/session";

async function uploadMyDocumentImpl(formData: FormData) {
  const u = await requireUser("/account/documents");
  const kind = z.enum(["cv", "id_copy", "qualification", "other"]).parse(formData.get("kind")) as FileKind;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) throw new UserFacingError("Each document must be smaller than 4 MB.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new UserFacingError("Upload a PDF, Word document, or a photo (JPG or PNG).");
  await storeUserDocument(u.id, kind, { fileName: file.name.slice(0, 200), contentType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) });
  revalidatePath("/account/documents");
  redirect("/account/documents");
}

async function deleteMyDocumentImpl(formData: FormData) {
  const u = await requireUser("/account/documents");
  const id = z.string().uuid().parse(formData.get("id"));
  // Applications already sent keep their own copy; only the saved copy is removed.
  await db.delete(schema.userDocuments).where(and(eq(schema.userDocuments.id, id), eq(schema.userDocuments.userId, u.id)));
  revalidatePath("/account/documents");
  redirect("/account/documents");
}

export async function uploadMyDocument(formData?: FormData) {
  return safely(() => uploadMyDocumentImpl(formData as FormData), "/account/documents");
}
export async function deleteMyDocument(formData?: FormData) {
  return safely(() => deleteMyDocumentImpl(formData as FormData), "/account/documents");
}
