import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, Notice, PageTitle } from "@/components/ui";
import { ClosingText, StatusBadge } from "@/components/opportunity-bits";
import { effectiveStatus } from "@/lib/opportunities";
import { ensureClosingReminders } from "@/lib/notify";
import { requireUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { ApplicationTimeline } from "@/components/application-timeline";

export default async function SavedPage() {
  const u = await requireUser("/saved");
  await ensureClosingReminders(u.id);
  const rows = await db
    .select({ s: schema.savedOpportunities, o: schema.opportunities, dept: schema.departments.name, checklist: schema.generatedChecklists.items })
    .from(schema.savedOpportunities)
    .innerJoin(schema.opportunities, eq(schema.opportunities.id, schema.savedOpportunities.opportunityId))
    .innerJoin(schema.departments, eq(schema.departments.id, schema.opportunities.departmentId))
    .leftJoin(
      schema.generatedChecklists,
      eq(schema.generatedChecklists.opportunityId, schema.opportunities.id),
    )
    .where(eq(schema.savedOpportunities.userId, u.id))
    .orderBy(desc(schema.savedOpportunities.savedAt));
  // Keep only the checklist row for each post's current version.
  const seen = new Set<string>();
  const list = rows.filter((r) => {
    if (seen.has(r.o.id)) return false;
    seen.add(r.o.id);
    return true;
  });
  list.sort((a, b) => (a.o.closingDate ?? "9999").localeCompare(b.o.closingDate ?? "9999"));
  return (
    <div>
      <PageTitle sub="Your saved posts, soonest closing first. We remind you 3 days before a post closes.">My saved posts</PageTitle>
      <div className="space-y-3">
        {list.map(({ s, o, dept, checklist }) => {
          const total = checklist?.length ?? 0;
          const done = Object.values(s.checklistState).filter(Boolean).length;
          return (
            <Card key={o.id} className="space-y-2" data-testid="saved-item">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={effectiveStatus(o.status, o.closingDate)} />
                {s.seenVersion < o.currentVersion && <span className="text-xs font-medium text-warn-ink">Changed since you saved it</span>}
              </div>
              <Link href={`/posts/${o.id}`} className="font-semibold text-lg hover:text-brand block">{displayTitle(o.postTitle)}</Link>
              <p className="text-sm text-muted">{dept}{o.referenceNumber && ` · Ref ${o.referenceNumber}`}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm items-center">
                <ClosingText date={o.closingDate} />
                <Link href={`/posts/${o.id}/checklist`} className="text-brand underline">
                  Checklist{total ? `: ${Math.min(done, total)} of ${total} done` : ""}
                </Link>
              </div>
              <details className="border-t border-border pt-3">
                <summary className="cursor-pointer text-sm font-semibold">View application timeline</summary>
                <ApplicationTimeline
                  opportunityId={o.id}
                  closingDate={o.closingDate}
                  sourceDate={o.sourceDate}
                  status={o.status}
                  versions={[]}
                  compact
                />
              </details>
            </Card>
          );
        })}
        {list.length === 0 && (
          <Notice tone="info">Nothing saved yet. <Link className="underline" href="/search">Find opportunities</Link> and press “Save”.</Notice>
        )}
      </div>
    </div>
  );
}
