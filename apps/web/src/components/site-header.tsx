import Link from "next/link";
import { getCurrentUser, isActiveOfficer, isAdmin } from "@/lib/session";
import { remindersAndUnread } from "@/lib/notify";

export async function SiteHeader() {
  const u = await getCurrentUser();
  const unread = u ? await remindersAndUnread(u.id) : 0;
  return (
    <header className="bg-navy/90 backdrop-blur text-navy-ink border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 min-h-16 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" className="font-bold text-xl tracking-tight text-white">
          <span className="text-accent">iGov</span>Path
        </Link>
        <nav className="order-last w-full sm:order-none sm:w-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:flex-1 text-white/85">
          <Link href="/search" className="hover:text-accent">Find opportunities</Link>
          <Link href="/match" className="hover:text-accent">What can I apply for?</Link>
          <Link href="/assistant" className="hover:text-accent">Ask</Link>
          {u && <Link href="/saved" className="hover:text-accent">Saved</Link>}
          {isActiveOfficer(u) && <Link href="/portal" className="hover:text-accent">Officer portal</Link>}
          {isAdmin(u) && <Link href="/admin/users" className="hover:text-accent">Users</Link>}
        </nav>
        <div className="ml-auto sm:ml-0 flex items-center gap-4 text-sm text-white/85">
          {u ? (
            <>
              <Link href="/notifications" className="hover:text-accent relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
                Notifications
                {unread > 0 && <span data-testid="unread" className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-brand text-brand-ink font-semibold text-xs px-1.5">{unread}</span>}
              </Link>
              <Link href="/account" className="hover:text-accent">{u.name}</Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-accent">Sign in</Link>
              <Link href="/sign-up" className="rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:brightness-105">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
