import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function isSaved(userId: string, opportunityId: string) {
  const [row] = await db
    .select({ id: schema.savedOpportunities.opportunityId })
    .from(schema.savedOpportunities)
    .where(and(eq(schema.savedOpportunities.userId, userId), eq(schema.savedOpportunities.opportunityId, opportunityId)));
  return !!row;
}

export async function getSaved(userId: string, opportunityId: string) {
  const [row] = await db
    .select()
    .from(schema.savedOpportunities)
    .where(and(eq(schema.savedOpportunities.userId, userId), eq(schema.savedOpportunities.opportunityId, opportunityId)));
  return row ?? null;
}
