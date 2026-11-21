import Link from "next/link";
import { getCurrentUser, isActiveOfficer, isAdmin } from "@/lib/session";

export async function SiteHeader() {
  const u = await getCurrentUser();
  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 min-h-14 py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          <span className="text-brand">iGov</span>Path
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm flex-1">
          <Link href="/search" className="hover:text-brand">Find opportunities</Link>
          <Link href="/match" className="hover:text-brand">What can I apply for?</Link>
          <Link href="/assistant" className="hover:text-brand">Ask</Link>
          {u && <Link href="/saved" className="hover:text-brand">Saved</Link>}
          {isActiveOfficer(u) && <Link href="/portal" className="hover:text-brand">Officer portal</Link>}
          {isAdmin(u) && <Link href="/admin/users" className="hover:text-brand">Users</Link>}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {u ? (
            <Link href="/account" className="hover:text-brand">{u.name}</Link>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-brand">Sign in</Link>
              <Link href="/sign-up" className="rounded-md bg-brand text-brand-ink px-3 py-1.5">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
