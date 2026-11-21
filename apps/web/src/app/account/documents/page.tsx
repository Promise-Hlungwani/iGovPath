import { Suspense } from "react";
import { DocViewer } from "@/components/doc-viewer";
import { PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { UrlError } from "@/components/url-error";
import { FILE_LABEL, myDocuments, SINGLE_KINDS, type FileKind } from "@/lib/applications";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { deleteMyDocument, uploadMyDocument } from "./actions";

export default async function MyDocumentsPage() {
  const u = await requireUser("/account/documents");
  const docs = await myDocuments(u.id);
  return (
    <div className="max-w-3xl">
      <PageTitle sub="Upload once and reuse them on every application. Only you can see them, plus the department you send an application to.">My documents</PageTitle>
      <Suspense fallback={null}><UrlError /></Suspense>
      <div className="space-y-4">
        {(["cv", "id_copy", "qualification", "other"] as FileKind[]).map((k) => {
          const mine = docs.filter((d) => d.kind === k);
          const single = SINGLE_KINDS.includes(k);
          return (
            <section key={k} className="rounded-2xl border border-black/10 bg-white/70 backdrop-blur-sm p-5 sm:p-6">
              <h2 className="font-bold text-lg">{mine.length ? "✓ " : ""}{FILE_LABEL[k]}</h2>
              <ul className="mt-3 space-y-2">
                {mine.map((d) => (
                  <li key={d.id} data-testid="my-document" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-black/10 bg-white/60 px-4 py-3 text-sm">
                    <span aria-hidden>📄</span>
                    <DocViewer href={`/api/my-documents/${d.id}`} fileName={d.fileName} />
                    <span className="text-muted">{Math.round(d.size / 1024)} KB · Last updated {formatDateTime(d.updatedAt)}</span>
                    <form action={deleteMyDocument} className="ml-auto">
                      <input type="hidden" name="id" value={d.id} />
                      <SubmitButton variant="ghost" className="!min-h-0 px-2 py-0.5 text-sm underline" pendingText="Deleting…">Delete</SubmitButton>
                    </form>
                  </li>
                ))}
                {mine.length === 0 && <li className="text-sm text-muted">Nothing saved yet.</li>}
              </ul>
              <form action={uploadMyDocument} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="kind" value={k} />
                <input name="file" type="file" required accept=".pdf,.docx,.jpg,.jpeg,.png" aria-label={`Upload ${FILE_LABEL[k]}`}
                  className="text-sm max-w-full text-muted file:mr-3 file:rounded-full file:border file:border-black/15 file:bg-white file:px-4 file:py-1.5 file:font-semibold file:text-black hover:file:bg-black/5" />
                <SubmitButton variant="secondary" pendingText="Uploading…">{mine.length && single ? "Replace with a newer one" : mine.length ? "Add another" : "Upload"}</SubmitButton>
              </form>
            </section>
          );
        })}
        <p className="text-xs text-muted">PDF, Word or a clear photo, up to 4 MB each. Deleting a document here doesn&apos;t remove it from applications you already sent.</p>
      </div>
    </div>
  );
}
