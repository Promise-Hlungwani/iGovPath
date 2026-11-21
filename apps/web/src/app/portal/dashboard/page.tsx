import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card, Notice, PageTitle } from "@/components/ui";
import { departmentScope, requireOfficer } from "@/lib/session";
import { displayTitle } from "@/lib/text";

type Row = { id: string; title: string; ref: string | null; viewed: number; saved: number; started: number; complete: number; explained: number };

/** Counts of distinct anonymous sessions per step. No names, emails or IDs are ever shown. */
export default async function Dashboard() {
  const u = await requireOfficer();
  const scope = departmentScope(u);
  const deptFilter = scope === null ? sql`true` : sql`o.department_id = ${scope}`;
  const { rows } = await db.execute<Row>(sql`
    select o.id, o.post_title as title, o.reference_number as ref,
      count(distinct f.session_hash) filter (where f.step = 'viewed')::int as viewed,
      count(distinct f.session_hash) filter (where f.step = 'saved')::int as saved,
      count(distinct f.session_hash) filter (where f.step = 'checklist_started')::int as started,
      count(distinct f.session_hash) filter (where f.step = 'checklist_complete')::int as complete,
      count(distinct f.session_hash) filter (where f.step = 'explained')::int as explained
    from opportunities o left join funnel_events f on f.opportunity_id = o.id
    where ${deptFilter}
    group by o.id order by viewed desc, o.post_title`);
  const { rows: conflicts } = await db.execute<{ ref: string; n: number; dates: string }>(sql`
    select upper(regexp_replace(reference_number, '[^A-Za-z0-9/]', '', 'g')) as ref, count(*)::int as n,
      string_agg(distinct coalesce(to_char(closing_date, 'YYYY-MM-DD'), 'not stated'), ', ') as dates
    from opportunities o
    where reference_number is not null and ${deptFilter}
    group by 1 having count(distinct coalesce(closing_date::text, '')) > 1`);
  const totals = rows.reduce((t, r) => ({ viewed: t.viewed + r.viewed, started: t.started + r.started, complete: t.complete + r.complete }), { viewed: 0, started: 0, complete: 0 });
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <PageTitle sub={`Where applicants drop out. Anonymous counts only, ${scope === null ? "all departments" : u.departmentName}.`}>Dashboard</PageTitle>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card><p className="text-sm text-muted">Viewed a post</p><p className="text-3xl font-semibold">{totals.viewed}</p></Card>
        <Card><p className="text-sm text-muted">Started a checklist</p><p className="text-3xl font-semibold">{totals.started}</p><p className="text-xs text-muted">{pct(totals.started, totals.viewed)} of viewers</p></Card>
        <Card><p className="text-sm text-muted">Finished a checklist</p><p className="text-3xl font-semibold">{totals.complete}</p><p className="text-xs text-muted">{pct(totals.complete, totals.started)} of starters</p></Card>
      </div>
      {conflicts.length > 0 && (
        <Notice tone="warn">
          <strong>Conflicting records:</strong>{" "}
          {conflicts.map((c) => `${c.ref} has ${c.n} records with closing dates ${c.dates}`).join("; ")}. Check which one is current.
        </Notice>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm" data-testid="funnel">
          <thead className="text-left text-muted border-b border-border">
            <tr><th className="p-3">Post</th><th className="p-3">Viewed</th><th className="p-3">Saved</th><th className="p-3">Checklist started</th><th className="p-3">Checklist done</th><th className="p-3">Asked for plain language</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="p-3"><Link className="hover:text-brand" href={`/posts/${r.id}`}>{displayTitle(r.title)}</Link><div className="text-xs text-muted">{r.ref}</div></td>
                <td className="p-3">{r.viewed}</td><td className="p-3">{r.saved}</td><td className="p-3">{r.started}</td>
                <td className="p-3">{r.complete}</td><td className="p-3">{r.explained}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted">Each count is the number of different anonymous visitors. Visitors are identified only by a one-way hash; no names, emails or IP addresses are stored.</p>
    </div>
  );
}
