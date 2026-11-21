import { and, desc, eq, ilike, inArray, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, Input, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requireOfficer } from "@/lib/session";

// Applicant activity is personal; officers never see it in the audit log.
const APPLICANT_ACTIONS = ["saved.add", "saved.remove", "profile.update", "user.sign_up"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireOfficer();
  const { q } = await searchParams;
  const where: SQL[] = [];
  if (u.role !== "admin") {
    const deptOpps = db.select({ id: sql<string>`${schema.opportunities.id}::text` }).from(schema.opportunities).where(eq(schema.opportunities.departmentId, u.departmentId ?? -1));
    where.push(notInArray(schema.auditLog.action, APPLICANT_ACTIONS));
    where.push(or(eq(schema.auditLog.actorDepartmentId, u.departmentId ?? -1), inArray(schema.auditLog.entityId, deptOpps))!);
  }
  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    where.push(or(ilike(schema.auditLog.action, like), ilike(schema.auditLog.actorName, like), ilike(schema.auditLog.entity, like), ilike(schema.auditLog.entityId, like))!);
  }
  const rows = await db
    .select({ a: schema.auditLog, dept: schema.departments.name })
    .from(schema.auditLog)
    .leftJoin(schema.departments, eq(schema.departments.id, schema.auditLog.actorDepartmentId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.auditLog.at))
    .limit(200);
  return (
    <div className="space-y-4">
      <PageTitle sub={u.role === "admin" ? "Every change, who made it and when (all departments)." : `Changes by or about ${u.departmentName}.`}>Audit log</PageTitle>
      <form><Input name="q" defaultValue={q} placeholder="Search by action, person, record or ID (e.g. approve, publish, amended)" /></form>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm" data-testid="audit">
          <thead className="text-left text-muted border-b border-border">
            <tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Record</th><th className="p-3">Details</th></tr>
          </thead>
          <tbody>
            {rows.map(({ a, dept }) => (
              <tr key={a.id} className="border-b border-border last:border-0 align-top">
                <td className="p-3 whitespace-nowrap text-muted">{formatDateTime(a.at)}</td>
                <td className="p-3">{a.actorName}{dept && <div className="text-xs text-muted">{dept}</div>}</td>
                <td className="p-3 font-mono text-xs">{a.action}</td>
                <td className="p-3 text-xs">{a.entity}<div className="text-muted font-mono">{a.entityId.slice(0, 8)}</div></td>
                <td className="p-3">
                  <details>
                    <summary className="cursor-pointer text-brand text-xs">Before / after</summary>
                    <pre className="text-xs whitespace-pre-wrap max-w-xl">{JSON.stringify({ before: a.before, after: a.after }, null, 1)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
