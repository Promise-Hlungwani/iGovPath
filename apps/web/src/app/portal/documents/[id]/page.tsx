import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, Card, Notice, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { listChunks } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { canActOnDepartment, requireOfficer } from "@/lib/session";
import { displayTitle } from "@/lib/text";
import { extractChunkAction } from "../../actions";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; q?: string }> }) {
  const u = await requireOfficer();
  const { id } = await params;
  const { error, q } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.id, id));
  if (!doc) notFound();
  if (!canActOnDepartment(u, doc.departmentId)) redirect("/portal");
  const exts = await db.select().from(schema.extractions).where(eq(schema.extractions.sourceDocumentId, doc.id));
  const byRef = new Map(exts.map((e) => [e.chunkRef, e]));
  const chunks = doc.kind === "circular" ? await listChunks(doc) : [];
  const filter = (q || "").toLowerCase();
  const shown = chunks.filter((c) => !filter || c.title.toLowerCase().includes(filter) || c.text.toLowerCase().includes(filter));

  return (
    <div className="space-y-6">
      <PageTitle sub={`${doc.kind} · ${doc.pageCount} pages${doc.documentDate ? ` · issued ${formatDate(doc.documentDate)}` : ""}`}>{doc.title}</PageTitle>
      <p className="text-sm"><a className="text-brand underline" href={`/api/documents/${doc.id}/file`} target="_blank">Open the PDF</a></p>
      {error && <Notice tone="danger">{error}</Notice>}

      {doc.kind === "amendment" && (
        <section className="space-y-3">
          <h2 className="font-semibold">Amendments found ({exts.length})</h2>
          {exts.map((e) => {
            const r = e.record as { post_title?: string; reference_number?: string; summary?: string; status_change?: string };
            return (
              <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{displayTitle(r.post_title) || "Untitled"} <span className="text-muted font-normal">· Ref {r.reference_number ?? "not stated"}</span></p>
                  <p className="text-sm text-muted">{r.summary}</p>
                  {!e.targetOpportunityId && <p className="text-sm text-warn-ink">No matching post in iGovPath.</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={e.status === "approved" ? "brand" : e.status === "needs_fix" ? "danger" : "warn"}>{e.status.replace("_", " ")}</Badge>
                  <Link className="text-brand underline text-sm" href={`/portal/review/${e.id}`}>Review</Link>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {doc.kind === "advert" && exts.map((e) => (
        <Link key={e.id} className="text-brand underline" href={`/portal/review/${e.id}`}>Review the extracted record</Link>
      ))}

      {doc.kind === "circular" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-semibold">Posts in this document ({chunks.length})</h2>
            <form className="flex gap-2">
              <input name="q" defaultValue={q} placeholder="Filter by title or department" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
            </form>
          </div>
          <p className="text-sm text-muted">Choose the posts that belong to your department. Each one is read separately (about 5 seconds each).</p>
          <div className="space-y-2">
            {shown.slice(0, 80).map((c) => {
              const ext = byRef.get(c.chunk_ref);
              return (
                <Card key={c.chunk_ref} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{displayTitle(c.title)}</p>
                    <p className="text-xs text-muted">Post {c.chunk_ref} · annexure {c.annexure} · page {c.page}</p>
                  </div>
                  {ext ? (
                    <Link className="text-brand underline text-sm" href={`/portal/review/${ext.id}`}>{ext.status === "approved" ? "Approved" : "Review"}</Link>
                  ) : (
                    <form action={extractChunkAction}>
                      <input type="hidden" name="docId" value={doc.id} />
                      <input type="hidden" name="chunkRef" value={c.chunk_ref} />
                      <SubmitButton variant="secondary" pendingText="Reading…">Extract</SubmitButton>
                    </form>
                  )}
                </Card>
              );
            })}
            {shown.length > 80 && <p className="text-sm text-muted">Showing 80 of {shown.length}. Use the filter to narrow down.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
