import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { db, schema } from "@/db";
import { EmptyState, PageTitle } from "@/components/ui";
import { UrlError } from "@/components/url-error";
import { ClosingText } from "@/components/opportunity-bits";
import { STATUS_LABEL } from "@/lib/applications";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";

export default async function MyApplications() {
  const u = await requireUser("/applications");
  const rows = await db
    .select({ a: schema.applications, title: schema.opportunities.postTitle, closing: schema.opportunities.closingDate, dept: schema.departments.name })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.opportunities.id, schema.applications.opportunityId))
    .innerJoin(schema.departments, eq(schema.departments.id, schema.applications.departmentId))
    .where(eq(schema.applications.userId, u.id))
    .orderBy(desc(schema.applications.updatedAt));
  return (
    <div className="max-w-3xl">
      <PageTitle sub="Every job you've applied for, and where it stands.">My applications</PageTitle>
      <Suspense fallback={null}><UrlError /></Suspense>
      <div className="space-y-3">
        {rows.map(({ a, title, closing, dept }) => (
          <Link key={a.id} href={`/applications/${a.id}`} data-testid="application" className="group flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white p-5 lift">
            <div className="min-w-0">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${a.status === "draft" ? "bg-black/[0.06]" : a.status === "shortlisted" || a.status === "appointed" ? "bg-black text-white" : "bg-black/[0.06]"}`}>
                {STATUS_LABEL[a.status]}
              </span>
              <h2 className="mt-2 font-bold truncate">{displayTitle(title)}</h2>
              <p className="text-sm text-muted">
                {dept} · {a.status === "draft" ? <ClosingText date={closing} /> : `Sent ${formatDate(a.submittedAt)}`}
              </p>
            </div>
            <span className="text-2xl text-black/30 group-hover:text-black" aria-hidden>→</span>
          </Link>
        ))}
        {rows.length === 0 && (
          <EmptyState action={<Link href="/search" className="underline font-medium text-black">Find a job to apply for</Link>}>You haven&apos;t applied for anything yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
