import Link from "next/link";
import { Suspense } from "react";
import { HowItWorks } from "@/components/how-it-works";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, Input, Notice, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ai, AiServiceError } from "@/lib/ai";
import { displayTitle } from "@/lib/text";

// AI steps can take up to a minute.
export const maxDuration = 60;

const STOP = new Set(["what", "when", "where", "which", "does", "with", "from", "that", "this", "have", "need", "post", "posts", "close", "closes", "apply", "there", "about", "your", "they", "will", "into", "must"]);

async function listings(question: string) {
  const all = await db
    .select({ o: schema.opportunities, dept: schema.departments.name })
    .from(schema.opportunities)
    .innerJoin(schema.departments, eq(schema.departments.id, schema.opportunities.departmentId));
  const words = question.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? [];
  const scored = all.map(({ o, dept }) => {
    const hay = `${o.postTitle} ${dept} ${o.location} ${o.province} ${o.referenceNumber} ${o.type}`.toLowerCase();
    return { o, dept, s: words.filter((w) => hay.includes(w)).length };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 12).map(({ o, dept }) => ({
    id: o.id, title: displayTitle(o.postTitle), department: dept, reference_number: o.referenceNumber, type: o.type,
    status: o.status, closing_date: o.closingDate, location: o.location, province: o.province, salary: o.salary,
    minimum_requirements: o.minimumRequirements.slice(0, 6), documents_required: o.documentsRequired.slice(0, 8),
    apply_route: o.applyRoute, contact: o.contact,
  }));
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle sub="Answers come only from approved listings. If we don't know, we say so and point you to the department.">Ask about a post</PageTitle>
      <Card>
        <form className="flex gap-2">
          <label htmlFor="q" className="sr-only">Your question</label>
          <Input id="q" name="q" defaultValue={q} placeholder="e.g. When does the driver post in Limpopo close?" required />
          <SubmitButton pendingText="Thinking…">Ask</SubmitButton>
        </form>
      </Card>
      {!q?.trim() && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Example questions">
            {["Which posts close this week?", "What documents do I need for a nursing post?", "Are there learnerships in Limpopo?", "Which jobs need only Grade 12?"].map((ex) => (
              <Link key={ex} href={`/assistant?q=${encodeURIComponent(ex)}`} className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm hover:border-interactive hover:text-interactive">{ex}</Link>
            ))}
          </div>
          <HowItWorks
            steps={[
              ["Ask in your own words", "About closing dates, documents, requirements or where a post is."],
              ["We look up approved posts", "Only listings that a department officer has approved are used."],
              ["Get an answer with sources", "Each answer links to the posts it came from. If we don't know, we say so."],
            ]}
            faq={[
              ["Can the answer be wrong?", "It can. Always open the linked post and check the official advert before you apply."],
              ["Can it tell me if I will get the job?", "No. iGovPath never decides or predicts who is shortlisted. The department decides."],
            ]}
          />
        </>
      )}
      {/* The page shows at once; the answer streams in when the AI is done. */}
      {q?.trim() && (
        <Suspense key={q} fallback={<Card className="animate-pulse text-muted" data-testid="thinking">Thinking about your question…</Card>}>
          <Answer q={q} />
        </Suspense>
      )}
    </div>
  );
}

async function Answer({ q }: { q: string }) {
  const used = await listings(q);
  let answer: Awaited<ReturnType<typeof ai.assistant>> | null = null;
  try {
    answer = await ai.assistant(q.slice(0, 500), used, true);
  } catch (e) {
    if (e instanceof AiServiceError) return <Notice tone="danger">{e.message}</Notice>;
    throw e;
  }
  const cited = used.filter((l) => answer.listing_ids.includes(l.id));
  return (
    <Card className="space-y-3" data-testid="answer">
      {!answer.known && <p className="text-sm font-medium text-warn-ink">We don&apos;t know this from the approved listings.</p>}
      <p className="whitespace-pre-wrap">{answer.answer}</p>
      {cited.length > 0 && (
        <div className="text-sm">
          <p className="text-muted">From these listings:</p>
          <ul className="list-disc pl-5">{cited.map((l) => <li key={l.id}><Link className="text-brand underline" href={`/posts/${l.id}`}>{l.title}</Link> · {l.department}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-muted">AI answer from approved listings ({answer.model}). It does not decide who is shortlisted. Check the original advert.</p>
    </Card>
  );
}
