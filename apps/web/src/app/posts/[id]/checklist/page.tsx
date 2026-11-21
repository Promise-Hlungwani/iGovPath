import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice, PageTitle } from "@/components/ui";
import { Checklist } from "@/components/checklist";
import { AiServiceError } from "@/lib/ai";
import { getChecklist, itemKey } from "@/lib/generated";
import { getOpportunity } from "@/lib/opportunities";
import { getSaved } from "@/lib/saved";
import { getCurrentUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { trackFunnel } from "@/lib/funnel";

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOpportunity(id);
  if (!data) notFound();
  const { opp, dept } = data;
  const user = await getCurrentUser();
  let items: { group: string; item: string; source: string }[] = [];
  let error: string | null = null;
  try {
    items = await getChecklist(opp, dept.name);
  } catch (e) {
    if (e instanceof AiServiceError) error = e.message;
    else throw e;
  }
  const saved = user ? await getSaved(user.id, opp.id) : null;
  const withKeys = items.map((i) => ({ ...i, key: itemKey(i.group, i.item) }));
  const state = saved?.checklistState ?? {};
  if (withKeys.length && withKeys.every((i) => state[i.key])) await trackFunnel(opp.id, "checklist_complete");

  return (
    <div className="max-w-3xl">
      <p className="text-sm mb-2"><Link className="text-brand underline" href={`/posts/${opp.id}`}>← {displayTitle(opp.postTitle)}</Link></p>
      <PageTitle sub={`${dept.name}${opp.referenceNumber ? ` · Ref ${opp.referenceNumber}` : ""}`}>Application checklist</PageTitle>
      <div className="space-y-4">
        <Notice tone="info">
          Built only from the approved advert. Items marked <strong>standard rule</strong> apply to every public service application.
          Always check the original advert before you send anything.
        </Notice>
        {saved && saved.seenVersion < opp.currentVersion && (
          <Notice tone="warn">This post changed since you saved it. The checklist below is for the latest version.</Notice>
        )}
        {!user && (
          <Notice tone="warn"><Link className="underline" href={`/sign-in?next=/posts/${opp.id}/checklist`}>Sign in</Link> to tick items and keep your progress.</Notice>
        )}
        {error ? <Notice tone="danger">{error}</Notice> : <Checklist opportunityId={opp.id} items={withKeys} initial={state} signedIn={!!user} />}
      </div>
    </div>
  );
}
