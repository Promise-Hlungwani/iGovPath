import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, Notice, NotStated } from "@/components/ui";
import { ClosingText, SampleTag, StatusBadge, TypeBadge } from "@/components/opportunity-bits";
import { formatDate, formatDateTime } from "@/lib/format";
import { effectiveStatus, getOpportunity } from "@/lib/opportunities";
import { displayTitle } from "@/lib/text";
import { getCurrentUser } from "@/lib/session";
import { SaveButton } from "@/components/save-button";
import { isSaved } from "@/lib/saved";
import { trackFunnel } from "@/lib/funnel";

const FIELD_LABELS: Record<string, string> = {
  closingDate: "Closing date", minimumRequirements: "Requirements", applyRoute: "How to apply",
  location: "Location", salary: "Salary", status: "Status", documentsRequired: "Documents",
};

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOpportunity(id);
  if (!data) notFound();
  const { opp, dept, form, doc, versions } = data;
  const status = effectiveStatus(opp.status, opp.closingDate);
  const user = await getCurrentUser();
  const saved = user ? await isSaved(user.id, opp.id) : false;
  await trackFunnel(opp.id, "viewed");
  const route = opp.applyRoute;
  const latestChange = versions.find((v) => v.v.version === opp.currentVersion && v.v.version > 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusBadge status={status} />
            <TypeBadge type={opp.type} />
            {opp.isSample && <SampleTag />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{displayTitle(opp.postTitle)}</h1>
          <p className="text-muted mt-1">
            {dept.name}{opp.location && ` · ${opp.location}`}
          </p>
        </div>

        {latestChange && (
          <Notice tone="warn">
            <strong>This post was {opp.status === "extended" ? "extended" : "amended"}</strong> on{" "}
            {formatDate(latestChange.v.approvedAt)}
            {latestChange.doc && <> ({latestChange.doc})</>}. Changed:{" "}
            {latestChange.v.changedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.{" "}
            <a href="#history" className="underline">See what changed</a>
          </Notice>
        )}
        {status === "withdrawn" && <Notice tone="danger">This post has been withdrawn. Do not apply.</Notice>}

        <Card className="grid gap-4 sm:grid-cols-2">
          <Fact label="Closing date"><ClosingText date={opp.closingDate} /></Fact>
          <Fact label="Reference number">{opp.referenceNumber ?? <NotStated />}</Fact>
          <Fact label="Salary">{opp.salary ?? <NotStated />}</Fact>
          <Fact label="Where">{opp.location ?? <NotStated />}{opp.province && opp.province !== "National" ? `, ${opp.province}` : ""}</Fact>
          <Fact label="Form">
            {form ? (
              <span>
                {form.name} ({form.version}){" "}
                {form.officialUrl && <a className="text-brand underline" href={form.officialUrl} target="_blank" rel="noreferrer">official form</a>}
              </span>
            ) : opp.formRequired ?? <NotStated />}
          </Fact>
          <Fact label="Contact">
            {opp.contact?.name || opp.contact?.phone ? [opp.contact?.name, opp.contact?.phone].filter(Boolean).join(", ") : <NotStated />}
          </Fact>
        </Card>

        <Section title="How to apply">
          {route && (route.email || route.portal_url || route.postal || route.hand_delivery) ? (
            <ul className="space-y-2 text-sm">
              {route.portal_url && <li><strong>Online:</strong> <a className="text-brand underline break-all" href={route.portal_url.startsWith("http") ? route.portal_url : `https://${route.portal_url}`} target="_blank" rel="noreferrer">{route.portal_url}</a></li>}
              {route.email && <li><strong>Email:</strong> {route.email}</li>}
              {route.postal && <li><strong>Post:</strong> {route.postal}</li>}
              {route.hand_delivery && <li><strong>Hand delivery:</strong> {route.hand_delivery}</li>}
            </ul>
          ) : (
            <NotStated />
          )}
        </Section>

        <Section title="What you must have">
          <List items={opp.minimumRequirements} />
        </Section>
        <Section title="Documents to send">
          <List items={opp.documentsRequired} />
          {opp.conditionalItems.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium">Only in some cases</p>
              <ul className="list-disc pl-5 text-sm space-y-1 mt-1">
                {opp.conditionalItems.map((c, i) => <li key={i}>{c.item} <span className="text-muted">({c.when})</span></li>)}
              </ul>
            </div>
          )}
        </Section>

        <Section title="Original advert" id="source">
          <p className="text-sm text-muted mb-2">
            Source: {doc?.title ?? "Unknown"}{opp.sourceDate && `, published ${formatDate(opp.sourceDate)}`}.{" "}
            {doc?.sourceUrl && <a className="text-brand underline" href={doc.sourceUrl} target="_blank" rel="noreferrer">Official PDF</a>}
          </p>
          <details>
            <summary className="cursor-pointer text-sm text-brand">Show the original wording</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs bg-background border border-border rounded-md p-3 max-h-[28rem] overflow-auto">{opp.sourceText}</pre>
          </details>
        </Section>

        <Section title="Version history" id="history">
          <ol className="space-y-3">
            {versions.map(({ v, approver, doc: vdoc }) => (
              <li key={v.id} className="text-sm border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={v.version === opp.currentVersion ? "brand" : "neutral"}>Version {v.version}</Badge>
                  <span className="text-muted">{formatDateTime(v.approvedAt)} · approved by {approver ?? "seed script (sample)"}</span>
                </div>
                <p className="mt-1">{v.note}{vdoc && <span className="text-muted"> · {vdoc}</span>}</p>
                {v.changedFields.length > 0 && <VersionDiff record={v.record} prev={versions.find((x) => x.v.version === v.version - 1)?.v.record} fields={v.changedFields} />}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 self-start">
        <Card className="space-y-3">
          <p className="text-sm font-medium"><ClosingText date={opp.closingDate} /></p>
          <SaveButton opportunityId={opp.id} saved={saved} signedIn={!!user} />
          <ButtonLink href={`/posts/${opp.id}/checklist`} variant="secondary" className="w-full">Application checklist</ButtonLink>
          <ButtonLink href={`/posts/${opp.id}/explain`} variant="secondary" className="w-full">Explain in plain language</ButtonLink>
          <p className="text-xs text-muted">
            iGovPath helps you prepare. It does not decide who is shortlisted. Questions about this post go to the department, not iGovPath.
          </p>
        </Card>
        <p className="text-xs text-muted px-1"><Link href="/search" className="underline">Back to search</Link></p>
      </aside>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id}>
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </section>
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
