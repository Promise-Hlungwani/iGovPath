import "server-only";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

type Step = (typeof schema.funnelStepEnum.enumValues)[number];

/**
 * Anonymous funnel event for the department dashboard. The session hash is a one-way
 * hash (with a daily salt) — no name, email or IP is stored, and counts are only shown aggregated.
 */
export async function trackFunnel(opportunityId: string, step: Step) {
  try {
    const u = await getCurrentUser();
    const h = await headers();
    const day = new Date().toISOString().slice(0, 10);
    const basis = u ? `u:${u.id}` : `a:${h.get("x-forwarded-for") ?? "local"}:${h.get("user-agent") ?? ""}:${day}`;
    const sessionHash = crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(basis).digest("hex").slice(0, 32);
    await db.insert(schema.funnelEvents).values({ sessionHash, opportunityId, step }).onConflictDoNothing();
  } catch {
    // Analytics must never break the page.
  }
}
