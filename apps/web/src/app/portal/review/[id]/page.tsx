import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, Card, Input, Label, Notice, PageTitle, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { HighlightedText } from "@/components/highlighted-text";
import type { AdvertRecord, Amendment, Flag } from "@/lib/ai";
import { formatDate, formatDateTime } from "@/lib/format";
import { canActOnDepartment, requireOfficer } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { approveAction, rejectAction } from "../../actions";

// AI steps can take up to a minute.
export const maxDuration = 60;

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; approved?: string }> }) {
  const u = await requireOfficer();
  const { id } = await params;
  const { error, approved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ e: schema.extractions, doc: schema.sourceDocuments, dept: schema.departments, reviewer: schema.user.name })
    .from(schema.extractions)
    .innerJoin(schema.sourceDocuments, eq(schema.sourceDocuments.id, schema.extractions.sourceDocumentId))
    .leftJoin(schema.departments, eq(schema.departments.id, schema.extractions.departmentId))
    .leftJoin(schema.user, eq(schema.user.id, schema.extractions.reviewedBy))
    .where(eq(schema.extractions.id, id));
  if (!row) notFound();
  const { e, doc, dept } = row;
  if (!canActOnDepartment(u, e.departmentId)) redirect("/portal");
  const done = e.status === "approved" || e.status === "rejected";
  const quotes = Object.values((e.record as { evidence?: Record<string, string> })?.evidence ?? {});
  const flagsFor = (field: string) => e.flags.filter((f) => f.field === field || f.field.startsWith(field + "."));

  return (
    <div className="space-y-4">
      <PageTitle sub={<>From <strong>{doc.title}</strong>{e.chunkRef !== "all" && ` · ${e.chunkRef}`} · {dept?.name} · AI model {e.model}</>}>
        {e.mode === "amendment" ? "Review amendment" : "Review extracted record"}
      </PageTitle>
      {approved && (
        <Notice tone="brand">
          Approved and published. <Link className="underline" href={`/posts/${approved}`}>View it as an applicant</Link>
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {done && (
        <Notice tone={e.status === "approved" ? "brand" : "warn"}>
          {e.status === "approved" ? "Approved" : "Rejected"} by {row.reviewer ?? "seed script"} on {formatDateTime(e.reviewedAt)}
          {e.reviewNote && ` · “${e.reviewNote}”`}
        </Notice>
      )}
      {e.flags.length > 0 && (
        <Card className="space-y-1">
          <p className="font-medium text-sm">Checks</p>
          <ul className="text-sm space-y-1">
            {e.flags.map((f, i) => (
              <li key={i} className={f.level === "error" ? "text-danger" : "text-warn-ink"} data-testid="flag">
                <strong>{f.level === "error" ? "Fix" : "Check"}</strong> · {f.field}: {f.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 lg:max-h-[80vh] lg:overflow-auto">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">Source text <span className="text-muted font-normal">(highlighted = quoted as evidence)</span></p>
            <a className="text-brand underline text-sm" href={`/api/documents/${doc.id}/file${e.chunkPage ? `#page=${e.chunkPage}` : ""}`} target="_blank">PDF{e.chunkPage ? `, page ${e.chunkPage}` : ""}</a>
          </div>
          <HighlightedText text={e.chunkText} quotes={quotes} />
        </Card>

        {e.mode === "amendment" ? (
          <AmendmentPanel e={e} done={done} />
        ) : (
          <RecordForm e={e} done={done} flagsFor={flagsFor} />
        )}
      </div>
    </div>
  );
}

function FieldFlags({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {flags.map((f, i) => (
        <p key={i} className={`text-xs ${f.level === "error" ? "text-danger" : "text-warn-ink"}`}>{f.message}</p>
      ))}
    </div>
  );
}

function Evidence({ ev }: { ev?: string }) {
  if (!ev) return null;
  return <p className="text-xs text-muted mt-1">Evidence: “{ev.length > 220 ? ev.slice(0, 220) + "…" : ev}”</p>;
}

function RecordForm({ e, done, flagsFor }: { e: typeof schema.extractions.$inferSelect; done: boolean; flagsFor: (f: string) => Flag[] }) {
  const r = e.record as unknown as AdvertRecord;
  const ev = r.evidence ?? {};
  const T = ({ name, label, value, type = "text" }: { name: string; label: string; value: string | null; type?: string }) => (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={value ?? ""} disabled={done} placeholder={done ? "" : "Not stated in the advert"} />
      <Evidence ev={ev[name]} />
      <FieldFlags flags={flagsFor(name)} />
    </div>
  );
  return (
    <Card>
      <form className="space-y-4">
        <input type="hidden" name="extractionId" value={e.id} />
        <T name="post_title" label="Post title" value={r.post_title} />
        <div className="grid sm:grid-cols-2 gap-4">
          <T name="reference_number" label="Reference number" value={r.reference_number} />
          <T name="closing_date" label="Closing date" value={r.closing_date} type="date" />
          <T name="salary" label="Salary" value={r.salary} />
          <T name="location" label="Location" value={r.location} />
          <div>
            <Label htmlFor="opportunity_type">Type</Label>
            <Select id="opportunity_type" name="opportunity_type" defaultValue={r.opportunity_type} disabled={done}>
              <option value="post">Post</option>
              <option value="internship">Internship</option>
              <option value="learnership">Learnership</option>
            </Select>
          </div>
          <T name="form_required" label="Form required" value={r.form_required} />
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">How to apply</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <T name="apply_email" label="Email" value={r.apply_route?.email} />
            <T name="apply_portal_url" label="Online portal" value={r.apply_route?.portal_url} />
            <T name="apply_postal" label="Postal address" value={r.apply_route?.postal} />
            <T name="apply_hand_delivery" label="Hand delivery" value={r.apply_route?.hand_delivery} />
          </div>
          <FieldFlags flags={flagsFor("apply_route")} />
        </fieldset>
        <div className="grid sm:grid-cols-2 gap-4">
          <T name="contact_name" label="Contact name" value={r.contact?.name} />
          <T name="contact_phone" label="Contact phone" value={r.contact?.phone} />
        </div>
        {(["minimum_requirements", "documents_required"] as const).map((f) => (
          <div key={f}>
            <Label htmlFor={f}>{f === "minimum_requirements" ? "Minimum requirements" : "Documents required"} (one per line)</Label>
            <Textarea id={f} name={f} rows={5} defaultValue={(r[f] ?? []).join("\n")} disabled={done} />
            <Evidence ev={ev[f]} />
            <FieldFlags flags={flagsFor(f)} />
          </div>
        ))}
        <div>
          <Label htmlFor="conditional_items">Conditional items (one per line: item | when)</Label>
          <Textarea id="conditional_items" name="conditional_items" rows={3} defaultValue={(r.conditional_items ?? []).map((c) => `${c.item} | ${c.when}`).join("\n")} disabled={done} />
          <FieldFlags flags={flagsFor("conditional_items")} />
        </div>
        {!done && (
          <>
            <div>
              <Label htmlFor="note">Note (optional, saved in the audit log)</Label>
              <Input id="note" name="note" placeholder="e.g. Checked against page 307" />
            </div>
            <div className="flex flex-wrap gap-3">
              <SubmitButton formAction={approveAction} pendingText="Publishing…">Approve and publish</SubmitButton>
              <SubmitButton formAction={rejectAction} variant="secondary" formNoValidate pendingText="Rejecting…">Reject</SubmitButton>
            </div>
            <p className="text-xs text-muted">Your name and department are recorded with this decision.</p>
          </>
        )}
      </form>
    </Card>
  );
}

async function AmendmentPanel({ e, done }: { e: typeof schema.extractions.$inferSelect; done: boolean }) {
  const a = e.record as unknown as Amendment;
  const [opp] = e.targetOpportunityId
    ? await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, e.targetOpportunityId))
    : [];
  const ch = a.changes ?? {};
  const rows: { label: string; before: string; after: string; ev?: string }[] = [];
  if (ch.closing_date) rows.push({ label: "Closing date", before: formatDate(opp?.closingDate) ?? "(not stated)", after: formatDate(ch.closing_date) ?? ch.closing_date, ev: a.evidence?.closing_date });
  if (ch.minimum_requirements?.length) rows.push({ label: "Requirements", before: (opp?.minimumRequirements ?? []).join("; "), after: ch.minimum_requirements.join("; "), ev: a.evidence?.minimum_requirements });
  if (ch.apply_route) rows.push({ label: "How to apply", before: JSON.stringify(opp?.applyRoute ?? {}), after: JSON.stringify(ch.apply_route), ev: a.evidence?.apply_route });
  if (ch.location) rows.push({ label: "Location", before: opp?.location ?? "", after: ch.location, ev: a.evidence?.location });
  if (ch.salary) rows.push({ label: "Salary", before: opp?.salary ?? "", after: ch.salary, ev: a.evidence?.salary });
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm text-muted">Amendment for</p>
        <p className="font-medium">{displayTitle(a.post_title) || "Unknown post"} · Ref {a.reference_number ?? "not stated"}</p>
        <p className="text-sm text-muted">{a.department}{a.original_circular && ` · originally in ${a.original_circular}`}</p>
        <div className="mt-2 flex gap-2"><Badge tone="warn">{a.status_change}</Badge></div>
        <p className="text-sm mt-2">{a.summary}</p>
      </div>
      {opp ? (
        <Notice tone="info">
          Matched to the published post <Link className="underline" href={`/posts/${opp.id}`}>{displayTitle(opp.postTitle)}</Link> (version {opp.currentVersion}).
        </Notice>
      ) : (
        <Notice tone="warn">No post in iGovPath has this reference number, so there is nothing to update. You can reject this item.</Notice>
      )}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-md border border-border overflow-hidden text-sm">
            <p className="px-3 py-1.5 bg-background font-medium">{r.label}</p>
            <p className="px-3 py-1.5 bg-danger-soft"><strong>Before:</strong> {r.before || "(not stated)"}</p>
            <p className="px-3 py-1.5 bg-brand-soft"><strong>After:</strong> {r.after}</p>
            {r.ev && <p className="px-3 py-1.5 text-xs text-muted">Evidence: “{r.ev}”</p>}
          </div>
        ))}
        {rows.length === 0 && a.status_change !== "withdrawn" && <p className="text-sm text-muted">No field changes were found in the notice.</p>}
      </div>
      {!done && (
        <form className="space-y-3">
          <input type="hidden" name="extractionId" value={e.id} />
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" name="note" placeholder="e.g. Confirmed with HR" />
          </div>
          <div className="flex flex-wrap gap-3">
            {opp && <SubmitButton formAction={approveAction} pendingText="Applying…">Confirm and apply amendment</SubmitButton>}
            <SubmitButton formAction={rejectAction} variant="secondary" pendingText="Rejecting…">Reject</SubmitButton>
          </div>
        </form>
      )}
    </Card>
  );
}
