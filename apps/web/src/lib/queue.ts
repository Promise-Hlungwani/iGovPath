import "server-only";
import { cache } from "react";
import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { departmentScope, getSession, isActiveOfficer, isAdmin, type CurrentUser } from "@/lib/session";

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

/** Applications sent to this officer's department that nobody has looked at yet. */
export async function newApplicationsCount(u: CurrentUser | null): Promise<number> {
  if (!u || !isActiveOfficer(u)) return 0;
  const where: SQL[] = [eq(schema.applications.status, "submitted")];
  const scope = departmentScope(u);
  if (scope !== null) where.push(eq(schema.applications.departmentId, scope));
  const [r] = await db.select({ n: count() }).from(schema.applications).where(and(...where));
  return r?.n ?? 0;
}

/**
 * Every number the header and portal tabs show, in ONE database round trip (the database is far
 * away, so each extra query costs ~150 ms). The role rules are applied in SQL, so this doesn't wait
 * for getCurrentUser and the two run side by side. Also creates due "closes soon" reminders, like
 * remindersAndUnread. Cached per request, so the header, portal layout and account page share it.
 * Rules match isActiveOfficer / isAdmin / departmentScope: active officers see their department,
 * active admins see everything.
 */
export const headerCounts = cache(async () => {
  const none = { unread: 0, queue: 0, officerRequests: 0, newApps: 0 };
  const s = await getSession();
  if (!s) return none;
  const id = s.user.id;
  const { rows } = await db.execute<{ unread: number; queue: number; requests: number; apps: number }>(sql`
    with me as (
      select role, status, department_id from user_roles where user_id = ${id}
    ), due as (
      select o.id, o.post_title, o.closing_date from saved_opportunities s
      join opportunities o on o.id = s.opportunity_id
      where s.user_id = ${id} and o.status <> 'withdrawn'
        and o.closing_date between current_date and current_date + 3
    ), ins as (
      insert into notifications (user_id, opportunity_id, kind, message, dedupe_key)
      select ${id}, id, 'closing_soon',
        '"' || initcap(post_title) || '" closes on ' || trim(to_char(closing_date, 'FMDD Month YYYY')) || '. Finish your checklist and apply.',
        'closing:' || to_char(closing_date, 'YYYY-MM-DD')
      from due
      on conflict (user_id, dedupe_key) do nothing
      returning 1
    )
    select
      ((select count(*) from notifications where user_id = ${id} and read = false) + (select count(*) from ins))::int as unread,
      coalesce((select count(*) from extractions e, me
        where me.status = 'active' and me.role in ('officer', 'admin') and e.status in ('draft', 'needs_fix')
          and (me.role = 'admin' or e.department_id = me.department_id)), 0)::int as queue,
      coalesce((select count(*) from user_roles r, me
        where me.status = 'active' and me.role = 'admin' and r.role = 'officer' and r.status = 'pending'), 0)::int as requests,
      coalesce((select count(*) from applications a, me
        where me.status = 'active' and me.role in ('officer', 'admin') and a.status = 'submitted'
          and (me.role = 'admin' or a.department_id = me.department_id)), 0)::int as apps`);
  const r = rows[0];
  return r ? { unread: r.unread, queue: r.queue, officerRequests: r.requests, newApps: r.apps } : none;
});
