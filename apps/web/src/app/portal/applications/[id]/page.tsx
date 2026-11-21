import Link from "next/link";
import { DocViewer } from "@/components/doc-viewer";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Z83 } from "@/db/schema";
import { Notice, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { UrlError } from "@/components/url-error";
import { FILE_LABEL, getApplicationFor, maskId, OFFICER_STATUSES, STATUS_LABEL } from "@/lib/applications";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireOfficer } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { setApplicationStatus } from "../actions";

const yn = (v?: boolean) => (v === true ? "Yes" : v === false ? "No" : "Not answered");

export default async function OfficerApplication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string; showId?: string }> }) {
  const u = await requireOfficer();
  const { id } = await params;
  const { updated, showId } = await searchParams;
  const app = await getApplicationFor(u, id);
  if (!app || !app.isDeptOfficer) notFound();
  const z = app.a.z83 as Partial<Z83>;
  const name = [z.fullNames, z.surname].filter(Boolean).join(" ") || app.applicant;
  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm"><Link href="/portal/applications" className="underline">← All applications</Link></p>
      <header>
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="text-muted">For <Link className="underline" href={`/posts/${app.o.id}`}>{displayTitle(app.o.postTitle)}</Link>{app.o.referenceNumber && ` · Ref ${app.o.referenceNumber}`} · sent {formatDateTime(app.a.submittedAt)}</p>
      </header>
      <Suspense fallback={null}><UrlError /></Suspense>
      {updated && <Notice tone="brand">Status updated. The applicant has been told.</Notice>}

      <section className="rounded-2xl border border-black/10 bg-white/70 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted">Current status</p>
          <span className="rounded-full bg-black/[0.06] px-4 py-1 text-lg font-bold" data-testid="officer-status">{STATUS_LABEL[app.a.status]}</span>
        </div>
        {app.a.status !== "withdrawn" && (
          <form action={setApplicationStatus} className="space-y-3 border-t border-black/10 pt-5 max-w-xl">
            <input type="hidden" name="applicationId" value={app.a.id} />
            <div>
              <label htmlFor="status" className="block font-semibold mb-1.5">Change the status to</label>
              <Select id="status" name="status" defaultValue={OFFICER_STATUSES.includes(app.a.status) ? app.a.status : "under_review"}>
                {OFFICER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="note" className="block font-semibold mb-1.5">Note to the applicant <span className="font-normal text-muted">(optional)</span></label>
              <Textarea id="note" name="note" rows={2} placeholder="Optional note to the applicant" />
            </div>
            <p className="text-sm text-muted">The applicant gets a message when you save.</p>
            <SubmitButton pendingText="Saving…">Save status</SubmitButton>
          </form>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Box title="Personal details">
          <Row k="Surname" v={z.surname} /><Row k="Full names" v={z.fullNames} />
          <Row k="Date of birth" v={z.dateOfBirth ? formatDate(z.dateOfBirth) ?? z.dateOfBirth : undefined} />
          <Row k="ID number" v={showId ? z.idNumber : maskId(z.idNumber)} extra={!showId && z.idNumber ? <Link className="underline text-sm" href={`/portal/applications/${app.a.id}?showId=1`}>Show</Link> : null} />
          {z.passportNumber && <Row k="Passport" v={z.passportNumber} />}
          <Row k="Citizenship" v={z.citizenship === "sa" ? "South African" : z.citizenship === "permanent_resident" ? "Permanent resident" : z.nationality || "Other"} />
          <Row k="Language" v={z.preferredLanguage} />
        </Box>
        <Box title="Contact">
          <Row k="Phone" v={z.phone} /><Row k="Email" v={z.email} /><Row k="Prefers" v={z.contactMethod} />
          <Row k="Driver's licence" v={yn(z.driversLicence)} />
        </Box>
        <Box title="Qualifications">
          {(z.qualifications ?? []).map((q, i) => <p key={i} className="text-sm">{q.name}{q.institution && ` · ${q.institution}`}{q.year && ` · ${q.year}`}</p>)}
        </Box>
        <Box title="Work experience">
          {(z.experience ?? []).map((x, i) => <p key={i} className="text-sm">{x.position}{x.employer && ` at ${x.employer}`}{(x.from || x.to) && ` (${x.from}–${x.to})`}{x.reason && `. Left: ${x.reason}`}</p>)}
        </Box>
        <Box title="Questions">
          <Row k="Criminal record" v={yn(z.criminalRecord)} />{z.criminalRecordDetails && <p className="text-sm text-muted">{z.criminalRecordDetails}</p>}
          <Row k="Pending case" v={yn(z.pendingCase)} /><Row k="Dismissed for misconduct" v={yn(z.dismissed)} />
          <Row k="Business with the state" v={yn(z.businessWithState)} />{z.businessDetails && <p className="text-sm text-muted">{z.businessDetails}</p>}
          <Row k="Disability" v={yn(z.disability)} /><Row k="Declaration signed" v={z.declaration ? "Yes" : "No"} />
        </Box>
        <Box title="Documents">
          {app.files.map((f) => (
            <p key={f.id} className="text-sm"><DocViewer className="underline text-left" href={`/api/applications/files/${f.id}`} fileName={f.fileName} /> <span className="text-muted">· {FILE_LABEL[f.kind]} · Last updated {formatDateTime(f.uploadedAt)}</span></p>
          ))}
        </Box>
      </div>

      <Box title="History">
        {app.events.map((e) => <p key={e.id} className="text-sm">{formatDateTime(e.at)} · {STATUS_LABEL[e.status]}{e.actorName && ` · ${e.actorName}`}{e.note && ` · “${e.note}”`}</p>)}
      </Box>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-black/10 bg-white p-5 space-y-1.5"><h2 className="font-bold mb-2">{title}</h2>{children}</section>;
}
function Row({ k, v, extra }: { k: string; v?: string; extra?: React.ReactNode }) {
  return <p className="text-sm flex gap-2"><span className="text-muted w-40 shrink-0">{k}</span><span className="font-medium">{v || "—"}</span>{extra}</p>;
}
