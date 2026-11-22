import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Badge, Notice } from "@/components/ui";
import { Avatar } from "@/components/account-menu";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { headerCounts } from "@/lib/queue";
import { CountBadge } from "@/components/count-badge";
import { Suspense } from "react";
import { UrlError } from "@/components/url-error";

const roleLabel = { applicant: "Applicant", officer: "Government officer", admin: "Admin" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ deleteError?: string }> }) {
  const u = await requireUser("/account");
  const { deleteError } = await searchParams;
  // Two round trips in total: the header's counts (shared, already fetched) and one for this page.
  const [counts, mine] = await Promise.all([
    headerCounts(),
    db.execute<{ saved: number; docs: number; cv_at: string | null; created: string | null }>(sql`
      select (select count(*) from saved_opportunities where user_id = ${u.id})::int as saved,
             (select count(*) from user_documents where user_id = ${u.id})::int as docs,
             (select cv_updated_at from applicant_profiles where user_id = ${u.id}) as cv_at,
             (select created_at from "user" where id = ${u.id}) as created`),
  ]);
  const m = mine.rows[0];
  const saved = { n: m?.saved ?? 0 };
  const docs = { n: m?.docs ?? 0 };
  const unread = { n: counts.unread };
  const profile = m?.cv_at ? { at: new Date(m.cv_at) } : null;
  const me = m?.created ? { created: new Date(m.created) } : null;
  const officerActive = (u.role === "officer" || u.role === "admin") && u.status === "active";
  const { queue, officerRequests } = counts;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Profile */}
      <section className="rounded-2xl border border-black/10 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center gap-6">
        <Avatar name={u.name} size={76} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight truncate">{u.name}</h1>
          <p className="text-muted truncate">{u.email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{roleLabel[u.role]}</Badge>
            {u.status !== "active" && <Badge tone="neutral">{u.status === "pending" ? "Awaiting approval" : u.status}</Badge>}
            {u.departmentName && <Badge tone="neutral">{u.departmentName}</Badge>}
            {me?.created && <span className="text-sm text-muted">Member since {formatDate(me.created)}</span>}
          </div>
        </div>
      </section>

      <Suspense fallback={null}><UrlError /></Suspense>
      {deleteError && <Notice tone="danger">To delete your account, type DELETE in capital letters.</Notice>}
      {u.status === "deactivated" && <Notice tone="danger">This account has been deactivated. Contact the platform admin.</Notice>}
      {u.role === "officer" && u.status === "pending" && (
        <Notice tone="info">Your officer access is waiting for an admin. You can still use everything for applicants meanwhile.</Notice>
      )}
      {u.role === "officer" && u.status === "rejected" && (
        <Notice tone="danger">Your officer access was not approved. <Link className="underline" href="/account/request-officer-access">Ask again</Link></Notice>
      )}

      {/* Work waiting for this officer / admin */}
      {officerActive && (
        <section
          data-testid="queue-card"
          className={`rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5 border border-black/10 bg-white/70 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.06)]`}
        >
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Review queue</p>
            <p className="mt-1 text-lg font-semibold">
              {queue > 0 ? `${queue} ${queue === 1 ? "record is" : "records are"} waiting for your approval` : "Nothing waiting for approval"}
            </p>
            <p className={`mt-1 text-sm text-muted`}>
              {u.role === "admin" ? "All departments" : u.departmentName}. Nothing is published until an officer approves it.
            </p>
          </div>
          <Link
            href="/portal"
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-6 font-semibold bg-black text-white hover:bg-[#222]`}
          >
            Go to review queue <span aria-hidden>→</span>
          </Link>
        </section>
      )}
      {officerRequests > 0 && (
        <section className="rounded-2xl border border-black/10 bg-white p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold inline-flex items-center">Officer requests<CountBadge n={officerRequests} /></p>
            <p className="text-sm text-muted mt-1">People asking for officer access without a code.</p>
          </div>
          <Link href="/admin/users" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-black px-6 font-semibold text-white hover:bg-[#222]">Review requests</Link>
        </section>
      )}

      {/* Quick actions */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Tile href="/saved" title="My saved jobs" value={saved?.n ?? 0} hint="Jobs you are keeping an eye on" />
        <Tile href="/account/documents" title="My documents" value={docs?.n ?? 0} hint="CV, ID copy and qualifications, ready to reuse" />
        <Tile href="/notifications" title="Messages" value={unread?.n ?? 0} hint={unread?.n ? "New messages waiting" : "No new messages"} />
        <Tile
          href="/match"
          title="My CV"
          value={profile?.at ? "Uploaded" : "Not yet"}
          hint={profile?.at ? `Read on ${formatDate(profile.at)} · see your matching jobs` : "Upload it to see the jobs that fit you"}
        />
        {officerActive ? (
          <Tile href="/portal/upload" title="Upload a document" value="Upload" hint="Adverts, circulars, amendments or forms" />
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
      className="group rounded-2xl border border-black/10 bg-white p-5 lift"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="text-black/30 group-hover:text-black transition" aria-hidden>→</span>
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </Link>
  );
}
