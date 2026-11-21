import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, ButtonLink, Card, Input, Notice, PageTitle } from "@/components/ui";
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
      ) : (
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
      )}

      {profile && (
        <Card className="space-y-2" data-testid="cv-summary">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">What we read from your CV</h2>
            <span className="text-xs text-muted">Updated {formatDateTime(p!.cvUpdatedAt)}</span>
          </div>
          {profile.summary && <p className="text-sm">{profile.summary}</p>}
          <div className="flex flex-wrap gap-1.5">
            {profile.highest_qualification && <Badge tone="brand">{profile.highest_qualification}</Badge>}
            {profile.total_years_experience != null && <Badge tone="info">{profile.total_years_experience} years experience</Badge>}
            {profile.licences.map((l) => <Badge key={l}>{l}</Badge>)}
            {profile.skills.slice(0, 8).map((s) => <Badge key={s}>{s}</Badge>)}
          </div>
          <div className="flex flex-wrap gap-4 pt-1 text-sm">
            <form action={refreshMatches}><SubmitButton variant="ghost" pendingText="Checking new posts…" className="px-0 underline">Check for new posts</SubmitButton></form>
            <form action={removeCv}><SubmitButton variant="ghost" pendingText="Removing…" className="px-0 underline text-danger">Remove my CV details</SubmitButton></form>
          </div>
        </Card>
      )}

      {profile && (
        <section className="space-y-3">
          <h2 className="font-semibold">Posts for you ({matches.length})</h2>
          {matches.length === 0 && <Card><p className="text-sm text-muted">No open posts fit your CV right now. Check again when new circulars come out.</p></Card>}
          {matches.map((m) => {
            const x = byId.get(m.id);
            if (!x) return null;
            return (
              <Card key={m.id} className="space-y-2" data-testid="match">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={m.fit === "strong" ? "brand" : "warn"}>{m.fit === "strong" ? "Good match" : "Worth a look"}</Badge>
                  {x.o.type !== "post" && <Badge tone="info">{x.o.type === "internship" ? "Internship" : "Learnership"}</Badge>}
                </div>
                <Link href={`/posts/${x.o.id}`} className="font-semibold text-lg hover:text-brand block">{displayTitle(x.o.postTitle)}</Link>
                <p className="text-sm text-muted">{x.dept}{x.o.location && ` · ${x.o.location}`} · <ClosingText date={x.o.closingDate} /></p>
                {m.reasons.length > 0 && <ul className="text-sm space-y-1">{m.reasons.map((r, i) => <li key={i}>✓ {r}</li>)}</ul>}
                {m.missing.length > 0 && <ul className="text-sm space-y-1 text-warn-ink">{m.missing.map((r, i) => <li key={i}>• You may need: {r}</li>)}</ul>}
                <div className="flex gap-4 text-sm">
                  <Link className="text-brand underline" href={`/posts/${x.o.id}/checklist`}>Checklist</Link>
                  <Link className="text-brand underline" href={`/posts/${x.o.id}`}>See the post</Link>
                </div>
              </Card>
            );
          })}
          {matches.length > 0 && <p className="text-xs text-muted">A guide from AI, not a decision. It doesn&apos;t mean you will be shortlisted. Always check the advert.</p>}
        </section>
      )}
    </div>
  );
}
