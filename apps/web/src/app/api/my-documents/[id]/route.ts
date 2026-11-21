import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";

/** A document from the person's own store: only its owner can open it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return new Response("Sign in first", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [d] = await db.select().from(schema.userDocuments).where(and(eq(schema.userDocuments.id, id), eq(schema.userDocuments.userId, u.id)));
  if (!d) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(d.data), {
    headers: { "content-type": d.contentType, "content-disposition": `inline; filename="${d.fileName.replace(/"/g, "")}"`, "cache-control": "private, no-store" },
  });
}
