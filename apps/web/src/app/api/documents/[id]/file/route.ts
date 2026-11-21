import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, isActiveOfficer } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser();
  if (!isActiveOfficer(u)) return new Response("Not allowed", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ name: schema.sourceDocuments.fileName, data: schema.documentFiles.data, type: schema.documentFiles.contentType })
    .from(schema.sourceDocuments)
    .innerJoin(schema.documentFiles, eq(schema.documentFiles.documentId, schema.sourceDocuments.id))
    .where(eq(schema.sourceDocuments.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "content-type": row.type,
      "content-disposition": `inline; filename="${row.name.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
