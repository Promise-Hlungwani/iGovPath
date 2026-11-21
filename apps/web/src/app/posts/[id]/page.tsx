import Link from "next/link";
import { CrumbLabel } from "@/components/breadcrumbs";
import { notFound } from "next/navigation";
import { Badge, Notice, NotStated } from "@/components/ui";
import { ClosingText, StatusBadge, TypeBadge } from "@/components/opportunity-bits";
import { daysUntil, formatDate, formatDateTime } from "@/lib/format";
import { effectiveStatus, getOpportunity } from "@/lib/opportunities";
import { displayTitle } from "@/lib/text";
import { getCurrentUser } from "@/lib/session";
import { SaveButton } from "@/components/save-button";
import { isSaved, markSeen } from "@/lib/saved";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { STATUS_LABEL } from "@/lib/applications";
import { SubmitButton } from "@/components/submit-button";
import { startApplication } from "@/app/applications/actions";
import { trackFunnel } from "@/lib/funnel";

const FIELD_LABELS: Record<string, string> = {
  closingDate: "Closing date", minimumRequirements: "Requirements", applyRoute: "How to apply",
  location: "Location", salary: "Salary", status: "Status", documentsRequired: "Documents",
};

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOpportunity(id);
  if (!data) notFound();
  const { opp, dept, doc, versions } = data;
  const status = effectiveStatus(opp.status, opp.closingDate);
  const user = await getCurrentUser();
  const saved = user ? await isSaved(user.id, opp.id) : false;
  if (user && saved) await markSeen(user.id, opp.id, opp.currentVersion);
  await trackFunnel(opp.id, "viewed");
  const latestChange = versions.find((v) => v.v.version === opp.currentVersion && v.v.version > 1);
  const closed = status === "closed" || status === "withdrawn";
  const left = daysUntil(opp.closingDate);
  const [myApp] = user
    ? await db.select().from(schema.applications).where(and(eq(schema.applications.userId, user.id), eq(schema.applications.opportunityId, opp.id)))
    : [];

  return (
    <div className="max-w-3xl space-y-8">
      <CrumbLabel path={`/posts/${opp.id}`} text={displayTitle(opp.postTitle)} />
      {/* 1. What the job is, and how long you have */}
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge status={status} />
          <TypeBadge type={opp.type} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{displayTitle(opp.postTitle)}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {dept.name}{opp.location && ` · ${opp.location}`}{opp.salary && ` · ${opp.salary}`}
        </p>
        <p className={`mt-2 font-medium ${left !== null && left >= 0 && left <= 3 ? "text-danger" : ""}`}>
          <ClosingText date={opp.closingDate} />
        </p>
      </header>

      {latestChange && (
        <Notice tone="warn">
          <strong>This post was {opp.status === "extended" ? "extended" : "amended"}</strong> on {formatDate(latestChange.v.approvedAt)}.
          Changed: {latestChange.v.changedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.{" "}
          <a href="#more" className="underline">See what changed</a>
        </Notice>
      )}
      {status === "withdrawn" && <Notice tone="danger">This post has been withdrawn. Do not apply.</Notice>}

      {/* 2. How to apply */}
      <section className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-6 sm:p-8" aria-labelledby="apply">
        <h2 id="apply" className="text-lg font-semibold">Apply for this job</h2>
        {closed ? (
          <p className="mt-3 text-muted">This post is {status === "withdrawn" ? "withdrawn" : "closed"}. Applications are no longer accepted.</p>
        ) : (
          <>
            <p className="mt-1 text-muted">We fill in your details and documents for you. Check them, then send. It goes straight to {dept.name}.</p>

            {/* One clear action, with Save beside it */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-start gap-3">
              {myApp ? (
                <a href={`/applications/${myApp.id}`} data-testid="my-application" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-black bg-white/60 px-7 min-h-12 text-base font-semibold text-black hover:bg-black/5 transition">
                  {myApp.status === "draft" ? "Continue your application" : "View your application"} <span aria-hidden>→</span>
                </a>
              ) : user ? (
                <form action={startApplication}>
                  <input type="hidden" name="opportunityId" value={opp.id} />
                  <SubmitButton variant="secondary" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-black bg-white/60 px-7 min-h-12 text-base font-semibold text-black hover:bg-black/5 transition w-full sm:w-auto" pendingText="Starting your application…">Apply now →</SubmitButton>
                </form>
              ) : (
                <a href={`/sign-in?next=/posts/${opp.id}`} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-black bg-white/60 px-7 min-h-12 text-base font-semibold text-black hover:bg-black/5 transition">Sign in to apply <span aria-hidden>→</span></a>
              )}
              <div className="sm:w-64 [&_a]:!rounded-full [&_button]:!rounded-full [&_a]:!min-h-12 [&_button]:!min-h-12"><SaveButton opportunityId={opp.id} saved={saved} signedIn={!!user} /></div>
            </div>
            {myApp && <p className="mt-2 text-sm text-muted">Status: <strong className="text-black">{STATUS_LABEL[myApp.status]}</strong></p>}

          </>
        )}
      </section>

      {/* 4. What you must have */}
      <section aria-labelledby="need" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="need" className="text-lg font-semibold">What you must have</h2>
          <Link href={`/posts/${opp.id}/explain`} className="text-sm font-semibold underline">Explain this job in simple words</Link>
        </div>
        <List items={opp.minimumRequirements} />
        {(opp.contact?.name || opp.contact?.phone) && (
          <p className="text-sm text-muted">Questions about this job? Ask {[opp.contact?.name, opp.contact?.phone].filter(Boolean).join(" on ")}.</p>
        )}
      </section>

      {/* 5. Everything else, folded away */}
      <details id="more" open={!!latestChange} className="rounded-2xl border border-black/10 bg-white p-5 [&_summary]:cursor-pointer">
        <summary className="font-semibold">More about this advert</summary>
        <div className="mt-4 space-y-6">
          <div>
            {opp.sourceDate && <p className="mb-2 text-sm text-muted">Published {formatDate(opp.sourceDate)}</p>}
            {doc?.sourceUrl ? (
              <a className="inline-flex min-h-11 items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-[#222]" href={doc.sourceUrl} target="_blank" rel="noreferrer">
                View or download the official job advert (PDF)
              </a>
            ) : (
              <p className="text-sm text-muted">Official job advert link not available.</p>
            )}
          </div>
          {versions.length > 1 && (
            <div>
              <h3 className="font-semibold mb-2">Version history</h3>
              <ol className="space-y-3">
                {versions.map(({ v, approver, doc: vdoc }) => (
                  <li key={v.id} className="text-sm border-l-2 border-border pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={v.version === opp.currentVersion ? "brand" : "neutral"}>Version {v.version}</Badge>
                      <span className="text-muted">{formatDateTime(v.approvedAt)} · approved by {approver ?? "imported from the circular"}</span>
                    </div>
                    <p className="mt-1">{v.note}{vdoc && <span className="text-muted"> · {vdoc}</span>}</p>
                    {v.changedFields.length > 0 && <VersionDiff record={v.record} prev={versions.find((x) => x.v.version === v.version - 1)?.v.record} fields={v.changedFields} />}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </details>

      <p className="text-sm text-muted">
        The department decides who is shortlisted, not iGovPath or the AI.
      </p>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items?.length) return <NotStated />;
  return <ul className="list-disc pl-5 text-sm space-y-1">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

function show(v: unknown): string {
  if (v == null || v === "") return "(not stated)";
  if (Array.isArray(v)) return v.join("; ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).filter(([, x]) => x).map(([k, x]) => `${k}: ${x}`).join("; ");
  return String(v);
}

function VersionDiff({ record, prev, fields }: { record: Record<string, unknown>; prev?: Record<string, unknown>; fields: string[] }) {
  return (
    <div className="mt-2 space-y-2">
      {fields.map((f) => (
        <div key={f} className="rounded-md border border-border overflow-hidden">
          <p className="text-xs font-medium px-2 py-1 bg-background">{FIELD_LABELS[f] ?? f}</p>
          <p className="px-2 py-1 text-xs bg-danger-soft"><span className="font-medium">Before:</span> {show(prev?.[f])}</p>
          <p className="px-2 py-1 text-xs bg-brand-soft"><span className="font-medium">Now:</span> {show(record[f])}</p>
        </div>
      ))}
    </div>
  );
}
