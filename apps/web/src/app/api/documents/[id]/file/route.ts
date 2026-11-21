import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, isActiveOfficer } from "@/lib/session";
import { resolveDataPath } from "@/lib/paths";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser();
  if (!isActiveOfficer(u)) return new Response("Not allowed", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [doc] = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.id, id));
  if (!doc) return new Response("Not found", { status: 404 });
  const bytes = await fs.readFile(resolveDataPath(doc.filePath));
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"` },
  });
}
