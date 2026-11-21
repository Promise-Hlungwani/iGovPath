import "server-only";
import { db, schema } from "@/db";

export type Actor = { id: string; name: string; departmentId: number | null } | null;

/** Write one audit row. Every create/update/approve/reject/role change must call this. */
export async function logAudit(input: {
  actor: Actor;
  action: string;
  entity: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(schema.auditLog).values({
    actorUserId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? "system",
    actorDepartmentId: input.actor?.departmentId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: String(input.entityId),
    before: input.before ?? null,
    after: input.after ?? null,
  });
}
