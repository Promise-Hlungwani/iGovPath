import "server-only";
import { and, asc, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";

const o = schema.opportunities;
const d = schema.departments;

export type OppStatus = "open" | "amended" | "extended" | "withdrawn" | "closed";

export function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Stored status plus closing date -> what applicants see. */
export function effectiveStatus(status: OppStatus, closingDate: string | null): OppStatus {
  if (status === "withdrawn") return "withdrawn";
  if (closingDate && closingDate < todayIso()) return "closed";
  return status;
}

export type SearchParams = { q?: string; province?: string; type?: string; openOnly?: boolean; departmentId?: number };

export async function searchOpportunities(p: SearchParams) {
  const where: SQL[] = [];
  const q = (p.q || "").trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where.push(
      or(
        sql`to_tsvector('english', coalesce(${o.postTitle}, '') || ' ' || coalesce(${o.location}, '') || ' ' || coalesce(${o.province}, '') || ' ' || coalesce(${o.referenceNumber}, '')) @@ websearch_to_tsquery('english', ${q})`,
        ilike(o.postTitle, like),
        ilike(o.referenceNumber, like),
        ilike(o.location, like),
        ilike(d.name, like),
      )!,
    );
  }
  if (p.province) where.push(eq(o.province, p.province));
  if (p.type && ["post", "internship", "learnership"].includes(p.type)) where.push(eq(o.type, p.type as "post"));
  if (p.departmentId) where.push(eq(o.departmentId, p.departmentId));
  if (p.openOnly) {
    where.push(gte(o.closingDate, todayIso()));
    where.push(sql`${o.status} <> 'withdrawn'`);
  }
  const order = q
    ? [desc(sql`ts_rank(to_tsvector('english', coalesce(${o.postTitle}, '')), websearch_to_tsquery('english', ${q}))`), asc(o.closingDate)]
    : [asc(o.closingDate)];
  return db
    .select({
      id: o.id, type: o.type, postTitle: o.postTitle, referenceNumber: o.referenceNumber, closingDate: o.closingDate,
      salary: o.salary, location: o.location, province: o.province, status: o.status, isSample: o.isSample,
      currentVersion: o.currentVersion, departmentName: d.name, sourceDate: o.sourceDate,
    })
    .from(o)
    .innerJoin(d, eq(d.id, o.departmentId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(...order)
    .limit(100);
}

export async function getOpportunity(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ opp: o, dept: d, form: schema.forms, doc: schema.sourceDocuments })
    .from(o)
    .innerJoin(d, eq(d.id, o.departmentId))
    .leftJoin(schema.forms, eq(schema.forms.id, o.formId))
    .leftJoin(schema.sourceDocuments, eq(schema.sourceDocuments.id, o.sourceDocumentId))
    .where(eq(o.id, id));
  if (!row) return null;
  const versions = await db
    .select({ v: schema.opportunityVersions, approver: schema.user.name, doc: schema.sourceDocuments.title })
    .from(schema.opportunityVersions)
    .leftJoin(schema.user, eq(schema.user.id, schema.opportunityVersions.approvedBy))
    .leftJoin(schema.sourceDocuments, eq(schema.sourceDocuments.id, schema.opportunityVersions.sourceDocumentId))
    .where(eq(schema.opportunityVersions.opportunityId, id))
    .orderBy(desc(schema.opportunityVersions.version));
  return { ...row, versions };
}

/** Record in the shape the AI service prompts expect (approved record only). */
export function toAiRecord(opp: typeof o.$inferSelect, deptName: string) {
  return {
    department: deptName,
    post_title: opp.postTitle,
    reference_number: opp.referenceNumber,
    closing_date: opp.closingDate,
    salary: opp.salary,
    location: opp.location,
    province: opp.province,
    opportunity_type: opp.type,
    minimum_requirements: opp.minimumRequirements,
    documents_required: opp.documentsRequired,
    form_required: opp.formRequired,
    apply_route: opp.applyRoute,
    contact: opp.contact,
    conditional_items: opp.conditionalItems,
  };
}
