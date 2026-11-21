import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, ButtonLink, Card, EmptyState, Input, Notice, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ClosingText } from "@/components/opportunity-bits";
import type { CvProfile } from "@/lib/ai";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { refreshMatches, removeCv, uploadCv } from "./actions";

// AI steps can take up to a minute.
export const maxDuration = 60;

export default async function MatchPage({ searchParams }: { searchParams: Promise<{ error?: string; removed?: string }> }) {
  const { error, removed } = await searchParams;
  const u = await getCurrentUser();
  const [p] = u ? await db.select().from(schema.applicantProfiles).where(eq(schema.applicantProfiles.userId, u.id)) : [];
  const profile = p?.cvProfile as CvProfile | undefined;
  const matches = p?.cvMatches ?? [];
  const posts = matches.length
    ? await db
        .select({ o: schema.opportunities, dept: schema.departments.name })
        .from(schema.opportunities)
        .innerJoin(schema.departments, eq(schema.departments.id, schema.opportunities.departmentId))
        .where(inArray(schema.opportunities.id, matches.map((m) => m.id)))
    : [];
  const byId = new Map(posts.map((x) => [x.o.id, x]));

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle sub="Upload your CV. AI reads it and shows you the government posts that fit, and why.">What can I apply for?</PageTitle>

      {error && <Notice tone="danger">{error}</Notice>}
      {removed && <Notice tone="brand">Your CV details have been removed.</Notice>}

      {!u ? (
        <Card className="space-y-3">
          <p>Sign in to upload your CV. We keep a short summary on your account so you can come back to your matches.</p>
          <ButtonLink href="/sign-in?next=/match">Sign in to start</ButtonLink>
        </Card>
      ) : !profile ? (
        <Card>
          <form action={uploadCv} className="space-y-4">
            <div>
              <label htmlFor="cv" className="block font-medium mb-2">{profile ? "Upload a newer CV" : "Your CV"}</label>
              <Input id="cv" name="cv" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
              <p className="text-xs text-muted mt-1">PDF or Word, up to 4 MB.</p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>I agree to my CV being read by AI to find posts for me. Your name, ID number, contact details and address are removed first, and the file itself is not kept.</span>
            </label>
            <SubmitButton pendingText="Reading your CV and finding posts… (about 20 seconds)">Find posts for me</SubmitButton>
          </form>
        </Card>
      ) : null}
      {profile && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Jobs for you ({matches.length})</h2>
          <p className="text-muted -mt-1">Tap a job to see the details and how to apply.</p>
          {matches.length === 0 && <EmptyState>No open posts fit your CV right now. Check again when new circulars come out.</EmptyState>}
          {matches.map((m) => {
            const x = byId.get(m.id);
            if (!x) return null;
            return (
              <Link
                key={m.id}
                href={`/posts/${x.o.id}`}
                data-testid="match"
                className="group block rounded-2xl border border-black/10 bg-white p-5 sm:p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:border-black/25 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${m.fit === "strong" ? "bg-black text-white" : "bg-black/[0.06] text-black"}`}>
                      {m.fit === "strong" ? "Good match" : "Worth a look"}
                    </span>
                    <h3 className="mt-3 text-lg font-semibold">{displayTitle(x.o.postTitle)}</h3>
                    <p className="mt-1 text-muted">{x.dept} · <ClosingText date={x.o.closingDate} /></p>
                  </div>
                  <span className="mt-1 text-2xl text-black/30 group-hover:text-black transition" aria-hidden>→</span>
                </div>
                {m.reasons[0] && <p className="mt-4">✓ {m.reasons[0]}</p>}
                {m.missing[0] && (
                  <p className="mt-1 text-muted">
                    You may need: {m.missing[0]}
                    {m.missing.length > 1 && <span className="whitespace-nowrap"> (+{m.missing.length - 1} more)</span>}
                  </p>
                )}
              </Link>
            );
          })}
          {matches.length > 0 && <p className="text-xs text-muted">A guide from AI, not a decision. It doesn&apos;t mean you will be shortlisted. Always check the advert.</p>}
        </section>
      )}
      {profile && (
        <Card className="space-y-2" data-testid="cv-summary">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Your CV</h2>
            <span className="text-xs text-muted">Updated {formatDateTime(p!.cvUpdatedAt)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.highest_qualification && <Badge tone="brand">{profile.highest_qualification}</Badge>}
            {profile.total_years_experience != null && <Badge tone="info">{profile.total_years_experience} years experience</Badge>}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-black">See everything we read</summary>
            {profile.summary && <p className="mt-2">{profile.summary}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.licences.map((l) => <Badge key={l}>{l}</Badge>)}
              {profile.skills.map((s) => <Badge key={s}>{s}</Badge>)}
            </div>
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-black">Upload a newer CV</summary>
            <div className="mt-3">
            <div>
              <form action={uploadCv} className="space-y-4">
                <div>
                  <label htmlFor="cv" className="block font-medium mb-2">{profile ? "Upload a newer CV" : "Your CV"}</label>
                  <Input id="cv" name="cv" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
                  <p className="text-xs text-muted mt-1">PDF or Word, up to 4 MB.</p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="consent" required className="mt-1" />
                  <span>I agree to my CV being read by AI to find posts for me. Your name, ID number, contact details and address are removed first, and the file itself is not kept.</span>
                </label>
                <SubmitButton pendingText="Reading your CV and finding posts… (about 20 seconds)">Find posts for me</SubmitButton>
              </form>
            </div>
            </div>
          </details>
          <div className="flex flex-wrap gap-4 pt-1 text-sm">
            <form action={refreshMatches}><SubmitButton variant="ghost" pendingText="Checking new posts…" className="px-0 underline">Check for new posts</SubmitButton></form>
            <form action={removeCv}><SubmitButton variant="ghost" pendingText="Removing…" className="px-0 underline text-danger">Remove my CV details</SubmitButton></form>
          </div>
        </Card>
      )}
    </div>
  );
}
