import { Card, Notice, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
// Bundled copy of the numbers (see scripts/sync_accuracy.py); the deployed site can't read data/.
import accuracy from "@/generated/accuracy.json";

type Results = {
  run_at: string; model: string | null; adverts_labelled: number; templates_total: number;
  overall_field_accuracy: number | null;
  fields: Record<string, { correct: number; total: number; accuracy: number | null }>;
  nulls_kept_null: { correct: number; total: number; rate: number | null };
  list_item_recall: Record<string, number | null>;
  evidence_check_failures: number;
};

const LABELS: Record<string, string> = {
  department: "Department", post_title: "Post title", reference_number: "Reference number", closing_date: "Closing date",
  salary: "Salary", location: "Location", form_required: "Form", "apply_route.email": "Apply by email",
  "apply_route.portal_url": "Apply online", "apply_route.postal": "Apply by post", "apply_route.hand_delivery": "Hand delivery",
  "contact.name": "Contact name", "contact.phone": "Contact phone",
};
const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);

export default function AccuracyPage() {
  const r = accuracy.results as Results | null;
  const sampleCount = accuracy.sample.adverts;
  const sampleErrors = accuracy.sample.guardrail_errors;

  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle sub="How often the AI pulls the right facts out of real adverts, measured against answers typed by a person.">Extraction accuracy</PageTitle>

      {!r || r.adverts_labelled === 0 ? (
        <Notice tone="warn">
          <strong>No accuracy result yet.</strong> {r?.templates_total ?? 15} real adverts are ready in <code>data/eval/labels/</code>, but a person
          has not labelled the correct answers yet. We will not report a number until they have.
        </Notice>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Stat label="Fields correct" value={pct(r.overall_field_accuracy)} sub={`${r.adverts_labelled} adverts labelled by people`} />
            <Stat label="“Not stated” kept empty" value={pct(r.nulls_kept_null.rate)} sub={`${r.nulls_kept_null.correct} of ${r.nulls_kept_null.total} empty fields`} />
            <Stat label="Evidence check failures" value={String(r.evidence_check_failures)} sub="caught and blanked before review" />
          </div>
          <Card>
            <table className="w-full text-sm">
              <thead className="text-left text-muted"><tr><th className="py-1">Field</th><th>Correct</th><th>Accuracy</th></tr></thead>
              <tbody>
                {Object.entries(r.fields).map(([k, v]) => (
                  <tr key={k} className="border-t border-border"><td className="py-1.5">{LABELS[k] ?? k}</td><td>{v.correct} / {v.total}</td><td>{pct(v.accuracy)}</td></tr>
                ))}
                {Object.entries(r.list_item_recall).map(([k, v]) => (
                  <tr key={k} className="border-t border-border"><td className="py-1.5">{k === "minimum_requirements" ? "Requirements found (recall)" : "Documents found (recall)"}</td><td>—</td><td>{pct(v)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted mt-3">Run {formatDateTime(r.run_at)} · model {r.model}. Numbers are reported as measured.</p>
          </Card>
        </>
      )}

      <Card className="space-y-2">
        <h2 className="font-semibold">Guardrail self-check on the listed adverts (not an accuracy score)</h2>
        <p className="text-sm">
          {sampleCount} listed adverts were extracted by the pipeline. Guardrail errors: <strong>{sampleErrors}</strong>. Every filled field
          carries an exact quote from the advert, and an officer approves each record before it is shown.
        </p>
        <p className="text-xs text-muted">This shows the safety checks ran. It does not show the answers are right; only the labelled test set above can.</p>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
      <p className="text-xs text-muted mt-1">{sub}</p>
    </Card>
  );
}
