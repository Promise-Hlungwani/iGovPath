import { Card, Label, Notice, PageTitle, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ai, AiServiceError } from "@/lib/ai";
import { requireOfficer } from "@/lib/session";
import { SAMPLE_MODE } from "@/lib/flags";

// AI steps can take up to a minute.
export const maxDuration = 60;

export default async function DraftCheckPage({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  await requireOfficer();
  const { text } = await searchParams;
  let result: Awaited<ReturnType<typeof ai.draftCheck>> | null = null;
  let error: string | null = null;
  if (text?.trim()) {
    try {
      result = await ai.draftCheck(text.slice(0, 12000), SAMPLE_MODE);
    } catch (e) {
      if (e instanceof AiServiceError) error = e.message;
      else throw e;
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PageTitle sub="Paste a draft advert. We list missing mandatory items and suggest plainer wording. You own the final text.">Draft check</PageTitle>
        <Card>
          <form className="space-y-3">
            <Label htmlFor="text">Draft advert</Label>
            <Textarea id="text" name="text" rows={16} defaultValue={text} required placeholder="Paste the advert text here (public information only)" />
            <SubmitButton pendingText="Checking…">Check the draft</SubmitButton>
          </form>
        </Card>
      </div>
      <div className="space-y-4 lg:pt-16">
        {error && <Notice tone="danger">{error}</Notice>}
        {result && (
          <>
            <Card data-testid="missing">
              <h2 className="font-semibold mb-2">Missing mandatory items ({result.missing.length})</h2>
              {result.missing.length === 0 ? <p className="text-sm text-muted">Nothing mandatory is missing.</p> : (
                <ul className="space-y-2 text-sm">
                  {result.missing.map((m, i) => <li key={i}><strong>{m.item}</strong><div className="text-muted">{m.question_for_officer}</div></li>)}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="font-semibold mb-2">Could be clearer ({result.unclear.length})</h2>
              <ul className="space-y-3 text-sm">
                {result.unclear.map((u, i) => (
                  <li key={i}><p className="text-muted line-through decoration-1">{u.sentence}</p><p>{u.suggestion}</p></li>
                ))}
              </ul>
            </Card>
            <p className="text-xs text-muted">Checked by {result.model}. Nothing was invented; questions are for you to answer.</p>
          </>
        )}
      </div>
    </div>
  );
}
