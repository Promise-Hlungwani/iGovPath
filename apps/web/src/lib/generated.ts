import "server-only";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ai } from "@/lib/ai";
import { toAiRecord } from "@/lib/opportunities";

type Opp = typeof schema.opportunities.$inferSelect;

export const itemKey = (group: string, item: string) => crypto.createHash("sha1").update(`${group}|${item}`).digest("hex").slice(0, 16);

/** Checklist for the current version of a post, generated once from the approved record and cached. */
export async function getChecklist(opp: Opp, deptName: string) {
  const [cached] = await db
    .select()
    .from(schema.generatedChecklists)
    .where(and(eq(schema.generatedChecklists.opportunityId, opp.id), eq(schema.generatedChecklists.version, opp.currentVersion)));
  if (cached) return cached.items;
  const r = await ai.checklist(toAiRecord(opp, deptName), opp.isSample, opp.sourceText);
  await db.insert(schema.generatedChecklists).values({ opportunityId: opp.id, version: opp.currentVersion, items: r.items }).onConflictDoNothing();
  return r.items;
}

export type ExplanationContent = {
  explanation: Record<string, string | string[]>;
  fact_check_passed: boolean;
  fact_problems: string[];
  model: string;
};

export const LANGUAGES = ["English", "isiZulu"] as const;
export type Language = (typeof LANGUAGES)[number];

export async function getExplanation(opp: Opp, deptName: string, language: Language) {
  const [cached] = await db
    .select()
    .from(schema.generatedExplanations)
    .where(
      and(
        eq(schema.generatedExplanations.opportunityId, opp.id),
        eq(schema.generatedExplanations.version, opp.currentVersion),
        eq(schema.generatedExplanations.language, language),
      ),
    );
  if (cached) return cached.content as unknown as ExplanationContent;
  const contact = [opp.contact?.name, opp.contact?.phone].filter(Boolean).join(" on ") || deptName;
  const r = await ai.explain(toAiRecord(opp, deptName), language, contact, opp.isSample);
  const content: ExplanationContent = {
    explanation: r.explanation, fact_check_passed: r.fact_check_passed, fact_problems: r.fact_problems, model: r.model,
  };
  await db
    .insert(schema.generatedExplanations)
    .values({ opportunityId: opp.id, version: opp.currentVersion, language, content: content as unknown as Record<string, unknown> })
    .onConflictDoNothing();
  return content;
}
