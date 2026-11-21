import Link from "next/link";
import { Suspense } from "react";
import { SelectFilter } from "@/components/select-filter";
import { and, desc, eq, ne, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { EmptyState, PageTitle } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/applications";
import { formatDateTime } from "@/lib/format";
import { departmentScope, requireOfficer } from "@/lib/session";
import { displayTitle } from "@/lib/text";

export default async function OfficerApplications({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const u = await requireOfficer();
  const { status } = await searchParams;
  const where: SQL[] = [ne(schema.applications.status, "draft")];
  const scope = departmentScope(u);
  if (scope !== null) where.push(eq(schema.applications.departmentId, scope));
  if (status && status in STATUS_LABEL) where.push(eq(schema.applications.status, status as "submitted"));
  const rows = await db
    .select({ a: schema.applications, title: schema.opportunities.postTitle, ref: schema.opportunities.referenceNumber, oppId: schema.opportunities.id, dept: schema.departments.name })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.opportunities.id, schema.applications.opportunityId))
    .innerJoin(schema.departments, eq(schema.departments.id, schema.applications.departmentId))
    .where(and(...where))
    .orderBy(desc(schema.applications.submittedAt));
  const groups = new Map<string, { title: string; ref: string | null; dept: string; rows: typeof rows }>();
  for (const r of rows) {
    const g = groups.get(r.oppId) ?? { title: r.title, ref: r.ref, dept: r.dept, rows: [] };
    g.rows.push(r);
    groups.set(r.oppId, g);
  }
  const filters: [string, string][] = [["", "All applications"], ["submitted", "New"], ["under_review", "Being reviewed"], ["shortlisted", "Shortlisted"], ["not_successful", "Not successful"], ["appointed", "Appointed"], ["withdrawn", "Withdrawn"]];
  return (
    <div className="space-y-6">
      <PageTitle sub="Applications sent through iGovPath for your department's posts. People decide every outcome; the AI never ranks applicants.">Applications</PageTitle>
      <Suspense fallback={null}>
        <SelectFilter param="status" label="Show" options={filters} />
      </Suspense>
      {[...groups.entries()].map(([oppId, g]) => (
        <section key={oppId} className="rounded-2xl border border-black/10 bg-white">
          <div className="px-5 py-4 border-b border-black/10">
            <h2 className="font-bold">{displayTitle(g.title)}</h2>
            <p className="text-sm text-muted">{g.dept}{g.ref && ` · Ref ${g.ref}`} · {g.rows.length} applicant{g.rows.length === 1 ? "" : "s"}</p>
          </div>
          <ul>
            {g.rows.map(({ a }) => {
              const z = a.z83 as { fullNames?: string; surname?: string };
              return (
                <li key={a.id} className="border-b border-black/5 last:border-0">
                  <Link href={`/portal/applications/${a.id}`} data-testid="officer-application" className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-black/[0.03]">
                    <span className="font-medium">{[z.fullNames, z.surname].filter(Boolean).join(" ") || "Applicant"}</span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="text-muted hidden sm:inline">{formatDateTime(a.submittedAt)}</span>
                      <span className={`rounded-full px-3 py-0.5 font-semibold ${a.status === "submitted" ? "bg-black text-white" : "bg-black/[0.06]"}`}>{a.status === "submitted" ? "New" : STATUS_LABEL[a.status]}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {groups.size === 0 && <EmptyState>{status ? "No applications with this status." : "No applications yet. They appear here when people apply for your department's posts."}</EmptyState>}
    </div>
  );
}
