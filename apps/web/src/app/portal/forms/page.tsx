import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, Card, Input, Label, Notice, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ai, AiServiceError } from "@/lib/ai";
import { fullText } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { canActOnDepartment, requireOfficer } from "@/lib/session";
import { publishFormVersion } from "./actions";

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ doc?: string; error?: string; published?: string }> }) {
  const u = await requireOfficer();
  const sp = await searchParams;
  const forms = await db
    .select({ f: schema.forms, dept: schema.departments.name })
    .from(schema.forms)
    .leftJoin(schema.departments, eq(schema.departments.id, schema.forms.ownerDepartmentId))
    .orderBy(desc(schema.forms.isCentral), schema.forms.code, desc(schema.forms.createdAt));

  let draft: Awaited<ReturnType<typeof ai.formDetails>> | null = null;
  let draftError: string | null = null;
  let doc: typeof schema.sourceDocuments.$inferSelect | undefined;
  if (sp.doc && /^[0-9a-f-]{36}$/i.test(sp.doc)) {
    [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.id, sp.doc));
    if (doc && canActOnDepartment(u, doc.departmentId)) {
      try {
        draft = await ai.formDetails(fullText(doc), doc.isSample);
      } catch (e) {
        if (e instanceof AiServiceError) draftError = e.message;
        else throw e;
      }
    } else doc = undefined;
  }

  return (
    <div className="space-y-6">
      <PageTitle sub="Versioned forms. Old versions are archived, never deleted. Government-wide forms are read-only links to the official source.">Forms library</PageTitle>
      {sp.published && <Notice tone="brand">New version published. The previous version was archived and affected applicants were warned.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}

      {doc && (
        <Card className="space-y-4">
          <h2 className="font-semibold">Check the details AI read from “{doc.title}”</h2>
          {draftError && <Notice tone="danger">{draftError}</Notice>}
          {draft?.flags.map((f, i) => <p key={i} className="text-sm text-danger">{f.field}: {f.message}</p>)}
          <form action={publishFormVersion} className="grid sm:grid-cols-2 gap-4">
            <input type="hidden" name="docId" value={doc.id} />
            <div><Label htmlFor="code">Form code</Label><Input id="code" name="code" required defaultValue={draft?.code ?? ""} /></div>
            <div><Label htmlFor="version">Version</Label><Input id="version" name="version" required defaultValue={draft?.version ?? ""} /></div>
            <div className="sm:col-span-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required defaultValue={draft?.name ?? ""} /></div>
            <div><Label htmlFor="effectiveDate">Effective date</Label><Input id="effectiveDate" name="effectiveDate" type="date" defaultValue={draft?.effective_date ?? ""} /></div>
            <div className="sm:col-span-2"><SubmitButton pendingText="Publishing…">Approve and publish this version</SubmitButton></div>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {forms.map(({ f, dept }) => {
          const mine = !f.isCentral && canActOnDepartment(u, f.ownerDepartmentId);
          return (
            <Card key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-3" data-testid={`form-${f.code}-${f.version}`}>
              <div>
                <p className="font-medium">{f.name} <span className="text-muted font-normal">· {f.code} · version {f.version}</span></p>
                <p className="text-sm text-muted">
                  {f.isCentral ? "Prescribed centrally (read-only)" : `Owned by ${dept}`}
                  {f.effectiveDate && ` · effective ${formatDate(f.effectiveDate)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge tone={f.status === "current" ? "brand" : "neutral"}>{f.status === "current" ? "Current" : "Archived"}</Badge>
                {f.isCentral && <Badge tone="info">Read-only</Badge>}
                {f.officialUrl && <a className="text-brand underline" href={f.officialUrl} target="_blank" rel="noreferrer">Official source</a>}
                {f.sourceDocumentId && <a className="text-brand underline" href={`/api/documents/${f.sourceDocumentId}/file`} target="_blank">PDF</a>}
                {mine && f.status === "current" && <span className="text-muted">Upload a new version via Upload → “A form”</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
