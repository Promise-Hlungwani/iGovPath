import Link from "next/link";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { ClosingText, StatusBadge } from "@/components/opportunity-bits";
import { departmentScope, requireOfficer } from "@/lib/session";
import { effectiveStatus, searchOpportunities } from "@/lib/opportunities";
import { displayTitle } from "@/lib/text";

export default async function PortalOpportunities() {
  const u = await requireOfficer();
  const scope = departmentScope(u);
  const rows = await searchOpportunities({ departmentId: scope ?? undefined });
  return (
    <div>
      <PageTitle sub={scope === null ? "All departments (admin view)." : `Records for ${u.departmentName}.`}>Published records</PageTitle>
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href={`/posts/${r.id}`} className="font-medium hover:text-brand" data-testid="portal-opp">{displayTitle(r.postTitle)}</Link>
              <p className="text-sm text-muted">{r.departmentName} · Ref {r.referenceNumber ?? "not stated"} · version {r.currentVersion}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <ClosingText date={r.closingDate} />
              <StatusBadge status={effectiveStatus(r.status, r.closingDate)} />
            </div>
          </Card>
        ))}
        {rows.length === 0 && <EmptyState>No published records for your department yet.</EmptyState>}
      </div>
    </div>
  );
}
