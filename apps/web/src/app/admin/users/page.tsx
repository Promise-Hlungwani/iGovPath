import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, Button, Card, PageTitle, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { approveOfficer, changeDepartment, rejectOfficer, setDeactivated } from "./actions";

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const depts = await db.select().from(schema.departments).orderBy(asc(schema.departments.name));
  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      createdAt: schema.user.createdAt,
      role: schema.userRoles.role,
      status: schema.userRoles.status,
      departmentId: schema.userRoles.departmentId,
      departmentName: schema.departments.name,
      jobTitle: schema.userRoles.jobTitle,
      requestedAt: schema.userRoles.requestedAt,
    })
    .from(schema.user)
    .leftJoin(schema.userRoles, eq(schema.userRoles.userId, schema.user.id))
    .leftJoin(schema.departments, eq(schema.departments.id, schema.userRoles.departmentId))
    .orderBy(desc(schema.user.createdAt));

  const pending = rows.filter((r) => r.role === "officer" && r.status === "pending");

  return (
    <div className="space-y-8">
      <PageTitle sub="Approve government officers before they can review and publish records.">Manage users</PageTitle>

      <section>
        <h2 className="font-semibold mb-3">Officer access requests ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id} className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div>
                  <p className="font-medium">{r.name} <span className="text-muted font-normal">· {r.email}</span></p>
                  <p className="text-sm text-muted">
                    {r.jobTitle} · asked for <strong>{r.departmentName}</strong> · {formatDateTime(r.requestedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={approveOfficer} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={r.id} />
                    <Select name="departmentId" defaultValue={r.departmentId ?? undefined} className="w-56" aria-label="Department">
                      {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <Button type="submit">Approve</Button>
                  </form>
                  <form action={rejectOfficer}>
                    <input type="hidden" name="userId" value={r.id} />
                    <Button type="submit" variant="secondary">Reject</Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">All users ({rows.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-muted border-b border-border">
              <tr>
                <th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Status</th>
                <th className="p-3">Department</th><th className="p-3">Joined</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 align-top">
                  <td className="p-3"><div className="font-medium">{r.name}</div><div className="text-muted">{r.email}</div></td>
                  <td className="p-3"><Badge tone="brand">{r.role ?? "applicant"}</Badge></td>
                  <td className="p-3">
                    <Badge tone={r.status === "active" ? "neutral" : r.status === "pending" ? "warn" : "danger"}>{r.status ?? "active"}</Badge>
                  </td>
                  <td className="p-3">
                    {r.role === "officer" && r.status === "active" ? (
                      <form action={changeDepartment} className="flex gap-2">
                        <input type="hidden" name="userId" value={r.id} />
                        <Select name="departmentId" defaultValue={r.departmentId ?? undefined} className="w-48" aria-label="Department">
                          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                        <Button type="submit" variant="secondary">Save</Button>
                      </form>
                    ) : (
                      <span className="text-muted">{r.departmentName ?? "—"}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="p-3">
                    {r.id !== me.id && (
                      <form action={setDeactivated}>
                        <input type="hidden" name="userId" value={r.id} />
                        <input type="hidden" name="deactivate" value={r.status === "deactivated" ? "0" : "1"} />
                        <Button type="submit" variant={r.status === "deactivated" ? "secondary" : "ghost"}>
                          {r.status === "deactivated" ? "Reactivate" : "Deactivate"}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
