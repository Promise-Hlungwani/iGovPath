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

/** Create in-app "closing soon" reminders for saved posts closing within 3 days (idempotent). */
export async function ensureClosingReminders(userId: string) {
  const { and, gte, lte, ne } = await import("drizzle-orm");
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const in3 = new Date(today);
  in3.setDate(today.getDate() + 3);
  const rows = await db
    .select({ id: schema.opportunities.id, title: schema.opportunities.postTitle, closing: schema.opportunities.closingDate })
    .from(schema.savedOpportunities)
    .innerJoin(schema.opportunities, eq(schema.opportunities.id, schema.savedOpportunities.opportunityId))
    .where(
      and(
        eq(schema.savedOpportunities.userId, userId),
        gte(schema.opportunities.closingDate, iso(today)),
        lte(schema.opportunities.closingDate, iso(in3)),
        ne(schema.opportunities.status, "withdrawn"),
      ),
    );
  if (!rows.length) return;
  const { displayTitle } = await import("@/lib/text");
  const { formatDate } = await import("@/lib/format");
  await db
    .insert(schema.notifications)
    .values(
      rows.map((r) => ({
        userId,
        opportunityId: r.id,
        kind: "closing_soon" as const,
        message: `"${displayTitle(r.title)}" closes on ${formatDate(r.closing)}. Finish your checklist and apply.`,
        dedupeKey: `closing:${r.closing}`,
      })),
    )
    .onConflictDoNothing();
}

export async function unreadCount(userId: string) {
  const { and, count } = await import("drizzle-orm");
  const [r] = await db
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.read, false)));
  return r?.n ?? 0;
}

/**
 * Header badge in one database round trip: creates any due "closing soon" reminders
 * for saved posts (idempotent) and returns the unread count.
 */
export async function remindersAndUnread(userId: string): Promise<number> {
  const { sql } = await import("drizzle-orm");
  const { rows } = await db.execute<{ n: number }>(sql`
    with due as (
      select o.id, o.post_title, o.closing_date from saved_opportunities s
      join opportunities o on o.id = s.opportunity_id
      where s.user_id = ${userId} and o.status <> 'withdrawn'
        and o.closing_date between current_date and current_date + 3
    ), ins as (
      insert into notifications (user_id, opportunity_id, kind, message, dedupe_key)
      select ${userId}, id, 'closing_soon',
        '"' || initcap(post_title) || '" closes on ' || trim(to_char(closing_date, 'FMDD Month YYYY')) || '. Finish your checklist and apply.',
        'closing:' || to_char(closing_date, 'YYYY-MM-DD')
      from due
      on conflict (user_id, dedupe_key) do nothing
      returning 1
    )
    select ((select count(*) from notifications where user_id = ${userId} and read = false)
          + (select count(*) from ins))::int as n`);
  return rows[0]?.n ?? 0;
}
