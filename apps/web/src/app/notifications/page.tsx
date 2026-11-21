import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { ensureClosingReminders } from "@/lib/notify";
import { requireUser } from "@/lib/session";

const LABEL = { amended: "Amended", extended: "Extended", withdrawn: "Withdrawn", closing_soon: "Closing soon", form_superseded: "New form version", application_status: "Application update" } as const;

export default async function NotificationsPage() {
  const u = await requireUser("/notifications");
  await ensureClosingReminders(u.id);
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, u.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(100);
  await db.update(schema.notifications).set({ read: true }).where(and(eq(schema.notifications.userId, u.id), eq(schema.notifications.read, false)));
  return (
    <div className="max-w-3xl">
      <PageTitle>Notifications</PageTitle>
      <div className="space-y-2">
        {rows.map((n) => (
          <Card key={n.id} className={`py-3 ${n.read ? "" : "border-brand"}`} data-testid="notification">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge tone={n.kind === "withdrawn" ? "danger" : n.kind === "closing_soon" ? "warn" : "info"}>{LABEL[n.kind]}</Badge>
              {!n.read && <Badge tone="brand">New</Badge>}
              <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
            </div>
            <p className="text-sm">{n.message}</p>
            {n.opportunityId && <Link className="text-sm text-brand underline" href={`/posts/${n.opportunityId}`}>Open the post</Link>}
          </Card>
        ))}
        {rows.length === 0 && <EmptyState>No messages yet. Save a post to get reminders and updates.</EmptyState>}
      </div>
    </div>
  );
}
