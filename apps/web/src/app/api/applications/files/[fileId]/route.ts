import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getApplicationFor } from "@/lib/applications";
import { getCurrentUser } from "@/lib/session";

/** A document attached to an application: only the applicant and that department's officers can open it. */
export async function GET(_: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return new Response("Sign in first", { status: 401 });
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return new Response("Not found", { status: 404 });
  const [f] = await db.select().from(schema.applicationFiles).where(eq(schema.applicationFiles.id, fileId));
  if (!f) return new Response("Not found", { status: 404 });
  const app = await getApplicationFor(u, f.applicationId);
  if (!app) return new Response("Not allowed", { status: 403 });
  return new Response(new Uint8Array(f.data), {
    headers: {
      "content-type": f.contentType,
      "content-disposition": `inline; filename="${f.fileName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
