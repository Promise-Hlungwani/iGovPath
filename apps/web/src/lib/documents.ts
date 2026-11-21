import "server-only";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ai, intakePdf, type AdvertRecord, type Amendment, type Flag } from "@/lib/ai";
import { logAudit } from "@/lib/audit";
import { toActor, type CurrentUser } from "@/lib/session";

type DocKind = (typeof schema.docKindEnum.enumValues)[number];

export async function createDocument(
  u: CurrentUser,
  input: { bytes: Buffer; fileName: string; kind: DocKind; title: string; departmentId: number; documentDate: string | null; isSample: boolean },
) {
  const sha = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const [existing] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.sha256, sha));
  if (existing) return { doc: existing, duplicate: true };

  const intake = await intakePdf(input.bytes, input.fileName);
  // Keep text for every page; keep block positions only for the first 40 pages (enough for review highlights).
  const pages = intake.pages.map((p, i) => ({ ...p, blocks: i < 40 ? p.blocks : [] }));
  const [doc] = await db
    .insert(schema.sourceDocuments)
    .values({
      departmentId: input.departmentId,
      kind: input.kind,
      title: input.title,
      fileName: input.fileName,
      filePath: `db:${sha}`,
      sha256: sha,
      pageCount: intake.page_count,
      pages,
      documentDate: input.documentDate,
      isSample: input.isSample,
      uploadedBy: u.id,
    })
    .returning();
  await db.insert(schema.documentFiles).values({ documentId: doc.id, data: input.bytes });
  await logAudit({
    actor: toActor(u), action: "document.upload", entity: "source_document", entityId: doc.id,
    after: { title: doc.title, kind: doc.kind, sha256: sha, pageCount: doc.pageCount },
  });
  return { doc, duplicate: false };
}

export function fullText(doc: typeof schema.sourceDocuments.$inferSelect) {
  return doc.pages.map((p) => p.text).join("\n");
}

export async function listChunks(doc: typeof schema.sourceDocuments.$inferSelect) {
  return (await ai.split(doc.pages.map((p) => p.text))).chunks;
}

/** Run Prompt 1 on one chunk and store the draft. Never re-extracts the same chunk of the same document. */
export async function extractChunk(
  u: CurrentUser,
  doc: typeof schema.sourceDocuments.$inferSelect,
  chunk: { chunk_ref: string; text: string; page: number | null },
) {
  const [existing] = await db
    .select()
    .from(schema.extractions)
    .where(and(eq(schema.extractions.sourceDocumentId, doc.id), eq(schema.extractions.chunkRef, chunk.chunk_ref)));
  if (existing) return existing;
  const r = await ai.extract(chunk.text, doc.isSample, doc.documentDate);
  const [row] = await db
    .insert(schema.extractions)
    .values({
      sourceDocumentId: doc.id, chunkRef: chunk.chunk_ref, chunkText: chunk.text, chunkPage: chunk.page,
      mode: "new", rawJson: r.record, record: r.record as unknown as Record<string, unknown>, flags: r.flags,
      model: r.model, status: r.status, departmentId: doc.departmentId,
    })
    .returning();
  await logAudit({
    actor: toActor(u), action: "extraction.create", entity: "extraction", entityId: row.id,
    after: { status: row.status, chunkRef: chunk.chunk_ref, flags: r.flags.length },
  });
  return row;
}

const normRef = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9/]/g, "");

/** The amendments section of a circular (or the whole text for a standalone notice). */
export function amendmentText(text: string) {
  const start = text.search(/\bAMENDMENTS?\b/);
  if (start < 0) return text.slice(0, 15000);
  const rest = text.slice(start);
  const end = rest.search(/\n\s*(INDEX|ANNEXURE [A-Z])\b/);
  return (end > 0 ? rest.slice(0, end) : rest).slice(0, 15000);
}

/** Run the amendment prompt and store one draft per amendment, matched to an existing post by reference number. */
export async function extractAmendments(u: CurrentUser, doc: typeof schema.sourceDocuments.$inferSelect) {
  const text = amendmentText(fullText(doc));
  const r = await ai.amendments(text, doc.isSample);
  const opps = await db
    .select({ id: schema.opportunities.id, ref: schema.opportunities.referenceNumber, departmentId: schema.opportunities.departmentId })
    .from(schema.opportunities);
  const rows = [];
  for (const [i, item] of r.amendments.entries()) {
    const ref = `amendment-${i + 1}`;
    const [existing] = await db
      .select()
      .from(schema.extractions)
      .where(and(eq(schema.extractions.sourceDocumentId, doc.id), eq(schema.extractions.chunkRef, ref)));
    if (existing) {
      rows.push(existing);
      continue;
    }
    const a: Amendment = item.amendment;
    const target = a.reference_number ? opps.find((o) => o.ref && normRef(o.ref) === normRef(a.reference_number)) : undefined;
    const flags: Flag[] = [...item.flags];
    if (!target) {
      flags.push({ field: "target", level: "warning", message: "No matching post found in iGovPath by reference number. Nothing to update." });
    }
    const [row] = await db
      .insert(schema.extractions)
      .values({
        sourceDocumentId: doc.id, chunkRef: ref, chunkText: text, mode: "amendment",
        rawJson: a, record: a as unknown as Record<string, unknown>, flags, model: r.model,
        status: flags.some((f) => f.level === "error") ? "needs_fix" : "draft",
        targetOpportunityId: target?.id ?? null,
        departmentId: target?.departmentId ?? doc.departmentId,
      })
      .returning();
    await logAudit({
      actor: toActor(u), action: "extraction.create", entity: "extraction", entityId: row.id,
      after: { mode: "amendment", reference: a.reference_number, matched: !!target },
    });
    rows.push(row);
  }
  return rows;
}

export type { AdvertRecord };
