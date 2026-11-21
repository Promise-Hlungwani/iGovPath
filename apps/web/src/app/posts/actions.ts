"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { trackFunnel } from "@/lib/funnel";
import { requireUser, toActor } from "@/lib/session";

const uuid = z.string().uuid();

export async function toggleSave(opportunityId: string) {
  const u = await requireUser(`/posts/${opportunityId}`);
  const id = uuid.parse(opportunityId);
  const [opp] = await db.select({ v: schema.opportunities.currentVersion }).from(schema.opportunities).where(eq(schema.opportunities.id, id));
  if (!opp) throw new Error("Post not found");
  const where = and(eq(schema.savedOpportunities.userId, u.id), eq(schema.savedOpportunities.opportunityId, id));
  const [existing] = await db.select().from(schema.savedOpportunities).where(where);
  if (existing) {
    await db.delete(schema.savedOpportunities).where(where);
    await logAudit({ actor: toActor(u), action: "saved.remove", entity: "opportunity", entityId: id });
  } else {
    await db.insert(schema.savedOpportunities).values({ userId: u.id, opportunityId: id, seenVersion: opp.v });
    await logAudit({ actor: toActor(u), action: "saved.add", entity: "opportunity", entityId: id });
    await trackFunnel(id, "saved");
  }
  revalidatePath(`/posts/${id}`);
  revalidatePath("/saved");
  return !existing;
}

const checklistSchema = z.object({ opportunityId: uuid, key: z.string().min(1).max(300), done: z.boolean() });

export async function setChecklistItem(input: { opportunityId: string; key: string; done: boolean }) {
  const u = await requireUser(`/posts/${input.opportunityId}/checklist`);
  const p = checklistSchema.parse(input);
  const where = and(eq(schema.savedOpportunities.userId, u.id), eq(schema.savedOpportunities.opportunityId, p.opportunityId));
  let [row] = await db.select().from(schema.savedOpportunities).where(where);
  if (!row) {
    // Ticking a checklist item saves the post, so progress is kept.
    const [opp] = await db.select({ v: schema.opportunities.currentVersion }).from(schema.opportunities).where(eq(schema.opportunities.id, p.opportunityId));
    if (!opp) throw new Error("Post not found");
    [row] = await db.insert(schema.savedOpportunities).values({ userId: u.id, opportunityId: p.opportunityId, seenVersion: opp.v }).returning();
    await logAudit({ actor: toActor(u), action: "saved.add", entity: "opportunity", entityId: p.opportunityId });
  }
  const state = { ...row.checklistState, [p.key]: p.done };
  await db.update(schema.savedOpportunities).set({ checklistState: state }).where(where);
  await trackFunnel(p.opportunityId, "checklist_started");
  return state;
}
