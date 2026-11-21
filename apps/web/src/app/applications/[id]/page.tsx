import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Z83 } from "@/db/schema";
import { Input, Label, Notice, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { UrlError } from "@/components/url-error";
import { ClosingText } from "@/components/opportunity-bits";
import {
  FILE_LABEL, getApplicationFor, missingForSubmit, myDocuments, REQUIRED_FILES, SINGLE_KINDS, STATUS_LABEL, type FileKind,
} from "@/lib/applications";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { attachSavedDocument, deleteApplicationFile, saveApplication, uploadApplicationFile, withdrawApplication } from "../actions";

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const u = await requireUser(`/applications/${id}`);
  const app = await getApplicationFor(u, id);
  if (!app || !app.isOwner) notFound();
  const z = app.a.z83 as Partial<Z83>;
  const title = displayTitle(app.o.postTitle);

  if (app.a.status !== "draft") return <StatusView app={app} title={title} />;

  const kinds = app.files.map((f) => f.kind);
  const savedDocs = await myDocuments(u.id);
  const missing = missingForSubmit(z, kinds);
  const quals = [...(z.qualifications ?? []), ...Array(6).fill({})].slice(0, Math.max(3, (z.qualifications ?? []).length + 1));
  const exps = [...(z.experience ?? []), ...Array(6).fill({})].slice(0, Math.max(2, (z.experience ?? []).length + 1));

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Application</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{app.dept}{app.o.referenceNumber && ` · Ref ${app.o.referenceNumber}`} · <ClosingText date={app.o.closingDate} /></p>
      </header>
      <Suspense fallback={null}><UrlError /></Suspense>
      {saved && <Notice tone="brand">Saved. You can come back and finish later.</Notice>}
      <Notice tone="info">
        This is the Z83 application, filled in here. We filled in what we could from your account and CV; please check everything.
        Only you and the officers of {app.dept} can see it.
      </Notice>

      {/* Documents first: separate small uploads keep each request under the size limit */}
      <section id="documents" className="rounded-2xl border border-black/10 bg-white/70 backdrop-blur-sm p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold">1. Your documents</h2>
          <p className="text-sm text-muted mt-1">
            We attach the documents you saved before. Anything you upload here is also kept in <Link href="/account/documents" className="underline">My documents</Link> for your next application.
          </p>
        </div>
        {(["cv", "id_copy", "qualification", "other"] as FileKind[]).map((k) => {
          const files = app.files.filter((f) => f.kind === k);
          const attachedFrom = new Set(files.map((f) => f.fromUserDocumentId));
          const reusable = savedDocs.filter((d) => d.kind === k && !attachedFrom.has(d.id));
          return (
            <div key={k} className="border-t border-black/10 pt-4 first:border-0 first:pt-0">
              <p className="font-semibold">
                {files.length ? "✓ " : ""}{FILE_LABEL[k]} {REQUIRED_FILES.includes(k) ? <span className="text-muted font-normal">(required)</span> : <span className="text-muted font-normal">(optional)</span>}
              </p>
              <ul className="mt-2 space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-black/10 bg-white/60 px-4 py-3 text-sm">
                    <span aria-hidden>📄</span>
                    <a className="underline font-medium break-all" href={`/api/applications/files/${f.id}`} target="_blank">{f.fileName}</a>
                    <span className="text-muted">{Math.round(f.size / 1024)} KB · Last updated {formatDateTime(f.uploadedAt)}</span>
                    <form action={deleteApplicationFile} className="ml-auto">
                      <input type="hidden" name="applicationId" value={app.a.id} />
                      <input type="hidden" name="fileId" value={f.id} />
                      <SubmitButton variant="ghost" className="!min-h-0 px-2 py-0.5 text-sm underline" pendingText="Removing…">Remove</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
              {reusable.map((d) => (
                <form key={d.id} action={attachSavedDocument} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm">
                  <input type="hidden" name="applicationId" value={app.a.id} />
                  <input type="hidden" name="userDocumentId" value={d.id} />
                  <span>Saved: <span className="font-medium break-all">{d.fileName}</span> <span className="text-muted">· Last updated {formatDateTime(d.updatedAt)}</span></span>
                  <SubmitButton variant="secondary" className="ml-auto !min-h-0 px-3 py-1 text-sm" pendingText="Adding…">{files.length && SINGLE_KINDS.includes(k) ? "Use this one instead" : "Use this"}</SubmitButton>
                </form>
              ))}
              <form action={uploadApplicationFile} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="applicationId" value={app.a.id} />
                <input type="hidden" name="kind" value={k} />
                <input name="file" type="file" required accept=".pdf,.docx,.jpg,.jpeg,.png" aria-label={`Upload ${FILE_LABEL[k]}`}
                  className="text-sm max-w-full text-muted file:mr-3 file:rounded-full file:border file:border-black/15 file:bg-white file:px-4 file:py-1.5 file:font-semibold file:text-black hover:file:bg-black/5" />
                <SubmitButton variant="secondary" pendingText="Uploading…">{files.length && SINGLE_KINDS.includes(k) ? "Upload a newer one" : files.length ? "Upload another" : "Upload"}</SubmitButton>
              </form>
            </div>
          );
        })}
        <p className="text-xs text-muted">PDF, Word or a clear photo, up to 4 MB each.</p>
      </section>

      <form action={saveApplication} className="space-y-8">
        <input type="hidden" name="applicationId" value={app.a.id} />

        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-bold">2. About you</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <F name="surname" label="Surname" value={z.surname} />
            <F name="fullNames" label="Full names" value={z.fullNames} />
            <F name="dateOfBirth" label="Date of birth" value={z.dateOfBirth} type="date" />
            <F name="idNumber" label="South African ID number" value={z.idNumber} inputMode="numeric" hint="13 digits. Leave empty if you use a passport." />
            <div>
              <Label htmlFor="citizenship">Citizenship</Label>
              <Select id="citizenship" name="citizenship" defaultValue={z.citizenship ?? "sa"}>
                <option value="sa">South African</option>
                <option value="permanent_resident">Permanent resident</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <F name="passportNumber" label="Passport number (if no SA ID)" value={z.passportNumber} />
            <F name="nationality" label="Nationality (if not South African)" value={z.nationality} />
            <F name="preferredLanguage" label="Language you prefer" value={z.preferredLanguage} />
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-bold">3. How to reach you</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <F name="phone" label="Phone number" value={z.phone} type="tel" />
            <F name="email" label="Email" value={z.email} type="email" />
            <div>
              <Label htmlFor="contactMethod">Best way to contact you</Label>
              <Select id="contactMethod" name="contactMethod" defaultValue={z.contactMethod ?? "email"}>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="post">Post</option>
              </Select>
            </div>
            <YesNo name="driversLicence" label="Do you have a driver's licence?" value={z.driversLicence} />
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-bold">4. Your qualifications</h2>
          {quals.map((q, i) => (
            <div key={i} className="grid sm:grid-cols-[2fr_2fr_1fr] gap-3">
              <F name={`q_name_${i}`} label={i === 0 ? "Qualification" : ""} value={q.name} placeholder="e.g. National Senior Certificate" />
              <F name={`q_institution_${i}`} label={i === 0 ? "School, college or university" : ""} value={q.institution} />
              <F name={`q_year_${i}`} label={i === 0 ? "Year" : ""} value={q.year} inputMode="numeric" />
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-bold">5. Your work experience</h2>
          {exps.map((x, i) => (
            <div key={i} className="grid sm:grid-cols-2 gap-3 border-t border-black/10 pt-3 first:border-0 first:pt-0">
              <F name={`x_employer_${i}`} label="Employer" value={x.employer} />
              <F name={`x_position_${i}`} label="Your job" value={x.position} />
              <F name={`x_from_${i}`} label="From" value={x.from} placeholder="e.g. March 2019" />
              <F name={`x_to_${i}`} label="To" value={x.to} placeholder="e.g. now" />
              <F name={`x_reason_${i}`} label="Why you left (if you did)" value={x.reason} />
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-bold">6. Questions every applicant answers</h2>
          <YesNo name="criminalRecord" label="Have you been convicted of a crime?" value={z.criminalRecord} />
          <F name="criminalRecordDetails" label="If yes, give details" value={z.criminalRecordDetails} />
          <YesNo name="pendingCase" label="Do you have a criminal, civil or disciplinary case pending?" value={z.pendingCase} />
          <YesNo name="dismissed" label="Have you been dismissed for misconduct from the public service?" value={z.dismissed} />
          <YesNo name="businessWithState" label="Do you do business with the state (or are you a director of a company that does)?" value={z.businessWithState} />
          <F name="businessDetails" label="If yes, give details" value={z.businessDetails} />
          <YesNo name="disability" label="Do you have a disability? (optional)" value={z.disability} />
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-bold">7. Declaration</h2>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="declaration" defaultChecked={!!z.declaration} className="mt-1 h-5 w-5" />
            <span>I declare that the information in this application is true and complete. I understand that false information may disqualify me or lead to dismissal.</span>
          </label>
        </section>

        {missing.length > 0 && (
          <Notice tone="info">Before you can send it, we still need: {missing.join(", ")}. (Upload documents in step 1; press “Save” to keep your answers.)</Notice>
        )}
        <div className="sticky bottom-0 -mx-4 bg-white/90 backdrop-blur border-t border-black/10 px-4 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <SubmitButton name="intent" value="save" variant="secondary" pendingText="Saving…">Save and finish later</SubmitButton>
          <SubmitButton name="intent" value="submit" pendingText="Sending…">Send application</SubmitButton>
        </div>
      </form>

      <form action={withdrawApplication}>
        <input type="hidden" name="applicationId" value={app.a.id} />
        <SubmitButton variant="ghost" className="px-0 underline text-sm" pendingText="Deleting…">Delete this draft</SubmitButton>
      </form>
    </div>
  );
}

function F({ name, label, value, type = "text", hint, placeholder, inputMode }: {
  name: string; label: string; value?: string; type?: string; hint?: string; placeholder?: string; inputMode?: "numeric" | "text";
}) {
  return (
    <div>
      {label && <Label htmlFor={name}>{label}</Label>}
      <Input id={name} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} inputMode={inputMode} aria-label={label || name} />
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

function YesNo({ name, label, value }: { name: string; label: string; value?: boolean }) {
  return (
    <fieldset>
      <legend className="font-medium mb-1.5">{label}</legend>
      <div className="flex gap-3">
        {[["yes", "Yes"], ["no", "No"]].map(([v, t]) => (
          <label key={v} className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2 cursor-pointer has-[:checked]:bg-black has-[:checked]:text-white">
            <input type="radio" name={name} value={v} defaultChecked={value === (v === "yes")} className="sr-only" />
            {t}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type App = NonNullable<Awaited<ReturnType<typeof getApplicationFor>>>;

function StatusView({ app, title }: { app: App; title: string }) {
  const s = app.a.status;
  const canWithdraw = ["submitted", "under_review", "shortlisted"].includes(s);
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your application</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{app.dept}{app.o.referenceNumber && ` · Ref ${app.o.referenceNumber}`}</p>
      </header>
      <Suspense fallback={null}><UrlError /></Suspense>
      <section className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-6 sm:p-8">
        <p className="text-black/60 text-sm">Status</p>
        <p className="mt-1 text-3xl font-bold !text-black" data-testid="app-status">{STATUS_LABEL[s]}</p>
        <p className="mt-2 text-black/60">
          {s === "submitted" && "Your application has been sent to the department. We'll let you know when it changes."}
          {s === "under_review" && "The department is reviewing your application."}
          {s === "shortlisted" && "Good news: you've been shortlisted. The department will contact you about the next step."}
          {s === "not_successful" && "Unfortunately this application was not successful. Keep applying: new jobs come out every week."}
          {s === "appointed" && "Congratulations! The department will contact you about your appointment."}
          {s === "withdrawn" && "You withdrew this application."}
        </p>
      </section>
      <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
        <h2 className="font-bold mb-3">What has happened</h2>
        <ol className="space-y-3">
          {app.events.map((e) => (
            <li key={e.id} className="border-l-2 border-black/15 pl-3">
              <p className="font-semibold">{STATUS_LABEL[e.status]}</p>
              <p className="text-sm text-muted">{formatDateTime(e.at)}</p>
              {e.note && <p className="text-sm mt-1">“{e.note}”</p>}
            </li>
          ))}
        </ol>
      </section>
      <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
        <h2 className="font-bold mb-2">Documents you sent</h2>
        <ul className="space-y-1 text-sm">
          {app.files.map((f) => (
            <li key={f.id}><a className="underline" href={`/api/applications/files/${f.id}`} target="_blank">{f.fileName}</a> <span className="text-muted">· {FILE_LABEL[f.kind]} · Last updated {formatDateTime(f.uploadedAt)}</span></li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-4 items-center">
        <Link href="/applications" className="underline">All my applications</Link>
        <Link href={`/posts/${app.o.id}`} className="underline">See the job</Link>
        {canWithdraw && (
          <form action={withdrawApplication}>
            <input type="hidden" name="applicationId" value={app.a.id} />
            <SubmitButton variant="ghost" className="px-0 underline text-danger" pendingText="Withdrawing…">Withdraw my application</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
