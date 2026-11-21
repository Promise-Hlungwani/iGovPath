/* Seed sample data: departments, the central Z83 form, source circulars, and the
 * pipeline-extracted sample opportunities (data/sample/opportunities.json).
 * Idempotent: running it twice changes nothing. Run: pnpm db:seed */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "./index";

const ROOT = path.resolve(process.cwd(), "../..");
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

type Rec = {
  department: string | null; post_title: string | null; reference_number: string | null;
  closing_date: string | null; salary: string | null; location: string | null;
  minimum_requirements: string[]; documents_required: string[]; form_required: string | null;
  apply_route: schema.ApplyRoute; contact: schema.Contact; conditional_items: schema.ConditionalItem[];
  province: string | null; opportunity_type: "post" | "internship" | "learnership"; evidence: Record<string, string>;
};
type Sample = { file: string; chunk_ref: string; page: number; dept: string; text: string; record: Rec; flags: schema.ExtractionFlag[]; model: string };

export async function seed() {
  const sel = read("data/sample/selection.json");
  const samples: Sample[] = read("data/sample/opportunities.json");

  // Departments
  const deptIds: Record<string, number> = {};
  for (const d of sel.departments) {
    const [row] = await db
      .insert(schema.departments)
      .values({ name: d.name, sphere: d.sphere, province: d.province, isSample: true })
      .onConflictDoUpdate({ target: schema.departments.name, set: { sphere: d.sphere, province: d.province } })
      .returning();
    deptIds[d.key] = row.id;
  }

  // Central Z83 form (prescribed centrally; read-only link to the official source)
  let [z83] = await db.select().from(schema.forms).where(and(eq(schema.forms.code, "Z83"), eq(schema.forms.isCentral, true)));
  if (!z83) {
    [z83] = await db
      .insert(schema.forms)
      .values({
        code: "Z83",
        name: "Z83 Application for Employment",
        version: "Effective 1 January 2021",
        effectiveDate: "2021-01-01",
        isCentral: true,
        officialUrl: "https://www.gov.za/sites/default/files/Z83.pdf",
        status: "current",
        notes: "Prescribed centrally (Public Service Act Regulations, Gazette 43872, 6 Nov 2020). Departments cannot edit it.",
      })
      .returning();
  }

  // A fictional sample department form (version 1), clearly labelled, to demo form versioning (G16).
  const lp = deptIds["lp-dard"];
  const [saf] = await db.select().from(schema.forms).where(eq(schema.forms.code, "LDARD-SAF"));
  if (!saf && lp) {
    const file = path.join(ROOT, "data/sources/sample-form-ldard-saf-v1.pdf");
    const bytes = fs.readFileSync(file);
    const sha = crypto.createHash("sha256").update(bytes).digest("hex");
    const [existingDoc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.sha256, sha));
    const doc =
      existingDoc ??
      (await db
        .insert(schema.sourceDocuments)
        .values({ departmentId: lp, kind: "form", title: "LDARD Supplementary Application Form v1 (fictional sample)", fileName: "sample-form-ldard-saf-v1.pdf", filePath: "data/sources/sample-form-ldard-saf-v1.pdf", sha256: sha, pageCount: 1, documentDate: "2025-04-01", isSample: true })
        .returning())[0];
    await db.insert(schema.forms).values({
      code: "LDARD-SAF", name: "Supplementary Application Form for Entry-Level Posts (fictional sample)", version: "1",
      effectiveDate: "2025-04-01", isCentral: false, ownerDepartmentId: lp, sourceDocumentId: doc.id, status: "current",
      notes: "Fictional sample form for the demo. Not an official document.",
    });
  }

  // Source documents
  const docIds: Record<string, string> = {};
  for (const d of sel.documents) {
    const file = path.join(ROOT, "data/sources", d.file);
    const sha = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    const [existing] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.sha256, sha));
    if (existing) {
      docIds[d.file] = existing.id;
      continue;
    }
    const [row] = await db
      .insert(schema.sourceDocuments)
      .values({
        kind: "circular", title: d.title, fileName: d.file, filePath: `data/sources/${d.file}`, sha256: sha,
        documentDate: d.date, sourceUrl: d.source_url, isSample: true,
      })
      .returning();
    docIds[d.file] = row.id;
  }

  // Opportunities (approved by the seed; the team reviews them in the portal — see PLAN.md G9)
  let created = 0;
  for (const s of samples) {
    const docId = docIds[s.file];
    const [exists] = await db
      .select({ id: schema.extractions.id })
      .from(schema.extractions)
      .where(and(eq(schema.extractions.sourceDocumentId, docId), eq(schema.extractions.chunkRef, s.chunk_ref)));
    if (exists) continue;
    const r = s.record;
    const departmentId = deptIds[s.dept];
    const [ext] = await db
      .insert(schema.extractions)
      .values({
        sourceDocumentId: docId, chunkRef: s.chunk_ref, chunkText: s.text, chunkPage: s.page, mode: "new",
        rawJson: r, record: r, flags: s.flags, model: s.model, status: "approved", departmentId,
        reviewedAt: new Date(), reviewNote: "Pre-extracted sample, approved by seed script. Team to review (PLAN.md G9).",
      })
      .returning();
    const values = {
      type: r.opportunity_type,
      departmentId,
      postTitle: r.post_title || "Untitled post",
      referenceNumber: r.reference_number,
      closingDate: r.closing_date,
      salary: r.salary,
      location: r.location,
      province: sel.departments.find((d: { key: string }) => d.key === s.dept)?.province ?? r.province,
      minimumRequirements: r.minimum_requirements,
      documentsRequired: r.documents_required,
      formRequired: r.form_required,
      formId: r.form_required === "Z83" ? z83.id : null,
      applyRoute: r.apply_route,
      contact: r.contact,
      conditionalItems: r.conditional_items,
      evidence: r.evidence,
      isSample: true,
      sourceDocumentId: docId,
      sourceText: s.text,
      sourceDate: sel.documents.find((d: { file: string }) => d.file === s.file)?.date,
    };
    const [opp] = await db.insert(schema.opportunities).values(values).returning();
    await db.update(schema.extractions).set({ targetOpportunityId: opp.id }).where(eq(schema.extractions.id, ext.id));
    await db.insert(schema.opportunityVersions).values({
      opportunityId: opp.id, version: 1, record: values, changedFields: [], sourceDocumentId: docId,
      extractionId: ext.id, note: `Published from ${s.file} post ${s.chunk_ref}`,
    });
    await db.insert(schema.auditLog).values({
      actorName: "seed script", action: "opportunity.publish", entity: "opportunity", entityId: opp.id,
      after: { postTitle: values.postTitle, referenceNumber: values.referenceNumber, version: 1 },
    });
    created++;
  }
  // Store the PDF bytes in the database (hosting platforms don't keep files on disk).
  const docs = await db.select({ id: schema.sourceDocuments.id, filePath: schema.sourceDocuments.filePath }).from(schema.sourceDocuments);
  const have = new Set((await db.select({ id: schema.documentFiles.documentId }).from(schema.documentFiles)).map((r) => r.id));
  for (const d of docs) {
    if (have.has(d.id) || d.filePath.startsWith("db:")) continue;
    const file = path.join(ROOT, d.filePath);
    if (!fs.existsSync(file)) continue;
    await db.insert(schema.documentFiles).values({ documentId: d.id, data: fs.readFileSync(file) }).onConflictDoNothing();
  }
  return { departments: Object.keys(deptIds).length, opportunities: created };
}

if (process.argv[1]?.endsWith("seed.ts") && !process.env.SEED_IMPORTED) {
  seed()
    .then((r) => {
      console.log(`Seed done: ${r.departments} departments, ${r.opportunities} new opportunities.`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
