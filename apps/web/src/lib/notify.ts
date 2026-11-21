import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

type Kind = (typeof schema.notificationKindEnum.enumValues)[number];

/** Notify everyone who saved this post. Deduplicated per (user, key). */
export async function notifySavers(opportunityId: string, kind: Kind, message: string, dedupeKey: string) {
  const savers = await db
    .select({ userId: schema.savedOpportunities.userId })
    .from(schema.savedOpportunities)
    .where(eq(schema.savedOpportunities.opportunityId, opportunityId));
  if (!savers.length) return 0;
  await db
    .insert(schema.notifications)
    .values(savers.map((s) => ({ userId: s.userId, opportunityId, kind, message, dedupeKey })))
    .onConflictDoNothing();
  return savers.length;
}
