import Link from "next/link";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, ButtonLink, Card, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { departmentScope, requireOfficer } from "@/lib/session";
import { displayTitle } from "@/lib/text";

export default async function ReviewQueue() {
  const u = await requireOfficer();
  const scope = departmentScope(u);
  const where: SQL[] = [inArray(schema.extractions.status, ["draft", "needs_fix"])];
  if (scope !== null) where.push(eq(schema.extractions.departmentId, scope));
  const rows = await db
    .select({ e: schema.extractions, doc: schema.sourceDocuments.title, dept: schema.departments.name })
    .from(schema.extractions)
    .innerJoin(schema.sourceDocuments, eq(schema.sourceDocuments.id, schema.extractions.sourceDocumentId))
    .leftJoin(schema.departments, eq(schema.departments.id, schema.extractions.departmentId))
    .where(and(...where))
    .orderBy(desc(schema.extractions.createdAt));
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle sub="AI-prepared records waiting for an officer. Check each one against the source before approving.">Review queue</PageTitle>
        <ButtonLink href="/portal/upload">Upload a document</ButtonLink>
      </div>
      <div className="space-y-2">
        {rows.map(({ e, doc, dept }) => {
          const r = e.record as { post_title?: string; reference_number?: string };
          const errors = e.flags.filter((f) => f.level === "error").length;
          const warnings = e.flags.length - errors;
          return (
            <Card key={e.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/portal/review/${e.id}`} className="font-medium hover:text-brand" data-testid="queue-item">
                  {e.mode === "amendment" && <Badge tone="warn" className="mr-2">Amendment</Badge>}
                  {displayTitle(r.post_title) || "Untitled"}
                </Link>
                <p className="text-sm text-muted">Ref {r.reference_number ?? "not stated"} · {doc} · {dept} · {formatDateTime(e.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {errors > 0 && <Badge tone="danger">{errors} to fix</Badge>}
                {warnings > 0 && <Badge tone="warn">{warnings} to check</Badge>}
                <Badge tone={e.status === "needs_fix" ? "danger" : "neutral"}>{e.status === "needs_fix" ? "needs fix" : "draft"}</Badge>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && <Card><p className="text-muted">Nothing waiting. <Link className="text-brand underline" href="/portal/upload">Upload a document</Link> to start.</p></Card>}
      </div>
    </div>
  );
}
