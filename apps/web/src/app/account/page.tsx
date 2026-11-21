import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, Notice } from "@/components/ui";
import { Avatar } from "@/components/account-menu";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

const roleLabel = { applicant: "Applicant", officer: "Government officer", admin: "Admin" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ deleteError?: string }> }) {
  const u = await requireUser("/account");
  const { deleteError } = await searchParams;
  const [[saved], [unread], [profile], [me]] = await Promise.all([
    db.select({ n: count() }).from(schema.savedOpportunities).where(eq(schema.savedOpportunities.userId, u.id)),
    db.select({ n: count() }).from(schema.notifications).where(and(eq(schema.notifications.userId, u.id), eq(schema.notifications.read, false))),
    db.select({ at: schema.applicantProfiles.cvUpdatedAt }).from(schema.applicantProfiles).where(eq(schema.applicantProfiles.userId, u.id)),
    db.select({ created: schema.user.createdAt }).from(schema.user).where(eq(schema.user.id, u.id)),
  ]);
  const officerActive = (u.role === "officer" || u.role === "admin") && u.status === "active";

  return (
    <div className="max-w-4xl space-y-8">
      {/* Profile */}
      <section className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center gap-6">
        <Avatar name={u.name} size={76} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight truncate">{u.name}</h1>
          <p className="text-muted truncate">{u.email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{roleLabel[u.role]}</Badge>
            {u.status !== "active" && <Badge tone="neutral">{u.status === "pending" ? "Awaiting approval" : u.status}</Badge>}
            {u.departmentName && <Badge tone="neutral">{u.departmentName}</Badge>}
            {me?.created && <span className="text-sm text-muted">Member since {formatDate(me.created)}</span>}
          </div>
        </div>
      </section>

      {deleteError && <Notice tone="danger">To delete your account, type DELETE in capital letters.</Notice>}
      {u.status === "deactivated" && <Notice tone="danger">This account has been deactivated. Contact the platform admin.</Notice>}
      {u.role === "officer" && u.status === "pending" && (
        <Notice tone="info">Your officer access is waiting for an admin. You can still use everything for applicants meanwhile.</Notice>
      )}
      {u.role === "officer" && u.status === "rejected" && (
        <Notice tone="danger">Your officer access was not approved. <Link className="underline" href="/account/request-officer-access">Ask again</Link></Notice>
      )}

      {/* Quick actions */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Tile href="/saved" title="My saved jobs" value={saved?.n ?? 0} hint="Jobs you are keeping an eye on" />
        <Tile href="/notifications" title="Messages" value={unread?.n ?? 0} hint={unread?.n ? "New messages waiting" : "No new messages"} />
        <Tile
          href="/match"
          title="My CV"
          value={profile?.at ? "Uploaded" : "Not yet"}
          hint={profile?.at ? `Read on ${formatDate(profile.at)} · see your matching jobs` : "Upload it to see the jobs that fit you"}
        />
        {officerActive ? (
          <Tile href="/portal" title="Officer portal" value="Open" hint="Upload and approve your department's jobs" />
        ) : u.role === "applicant" ? (
          <Tile href="/account/request-officer-access" title="Government officer?" value="Get access" hint="Have an officer code? Start straight away" />
        ) : null}
      </section>

      <p className="text-sm text-muted">
        To sign out or delete your account, use the menu under your initials at the top right.
      </p>
    </div>
  );
}

function Tile({ href, title, value, hint }: { href: string; title: string; value: string | number; hint: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-black/10 bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="text-black/30 group-hover:text-black transition" aria-hidden>→</span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </Link>
  );
}
