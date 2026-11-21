import "server-only";
import { and, count, eq, inArray, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { departmentScope, isActiveOfficer, isAdmin, type CurrentUser } from "@/lib/session";

/** Drafts waiting for this officer (their department; admins see all). 0 for non-officers. */
export async function reviewQueueCount(u: CurrentUser | null): Promise<number> {
  if (!u || !isActiveOfficer(u)) return 0;
  const where: SQL[] = [inArray(schema.extractions.status, ["draft", "needs_fix"])];
  const scope = departmentScope(u);
  if (scope !== null) where.push(eq(schema.extractions.departmentId, scope));
  const [r] = await db.select({ n: count() }).from(schema.extractions).where(and(...where));
  return r?.n ?? 0;
}

/** People waiting for an admin to approve their officer access. 0 for non-admins. */
export async function pendingOfficerCount(u: CurrentUser | null): Promise<number> {
  if (!u || !isAdmin(u)) return 0;
  const [r] = await db
    .select({ n: count() })
    .from(schema.userRoles)
    .where(and(eq(schema.userRoles.role, "officer"), eq(schema.userRoles.status, "pending")));
  return r?.n ?? 0;
}
