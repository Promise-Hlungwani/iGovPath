import Link from "next/link";
import { cookies } from "next/headers";
import { PROFILE_COOKIE } from "@/lib/profile";
import { getCurrentUser, isActiveOfficer, isAdmin } from "@/lib/session";
import { remindersAndUnread } from "@/lib/notify";
import { AccountMenu } from "@/components/account-menu";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { NavLink } from "@/components/nav-link";
import { CountBadge } from "@/components/count-badge";
import { MobileNav } from "@/components/mobile-nav";
import { pendingOfficerCount, reviewQueueCount } from "@/lib/queue";

const ROLE_LABEL = { applicant: "Applicant", officer: "Government officer", admin: "Admin" } as const;

export async function SiteHeader() {
  const u = await getCurrentUser().catch(() => null);
  // Counts are nice-to-have: if the database hiccups, show the header without them.
  const [unread, queue, officerRequests] = u
    ? await Promise.all([
        remindersAndUnread(u.id).catch(() => 0),
        reviewQueueCount(u).catch(() => 0),
        pendingOfficerCount(u).catch(() => 0),
      ])
    : [0, 0, 0];
  // Officers switch between their personal profile and their officer profile (avatar menu).
  const canOfficer = isActiveOfficer(u) || isAdmin(u);
  const officerMode = canOfficer && (await cookies()).get(PROFILE_COOKIE)?.value === "officer";
  const navLinkClass =
    "flex min-h-11 items-center rounded-lg px-3 py-2 hover:bg-black/5 hover:text-black lg:min-h-0 lg:rounded-none lg:px-0 lg:py-0 lg:hover:bg-transparent";
  // The same links in the desktop bar and the mobile menu; the page you're on is highlighted.
  const navLinks = (mobile: boolean) => {
    const cls = mobile ? "w-full min-h-11 !rounded-lg px-3" : "";
    return officerMode ? (
      <>
        {isActiveOfficer(u) && <NavLink href="/portal" className={`${cls} gap-1`} aria-label={`Officer portal${queue ? `, ${queue} waiting for review` : ""}`}>Officer portal<CountBadge n={queue} testId={mobile ? undefined : "queue-count"} /></NavLink>}
        {isAdmin(u) && <NavLink href="/admin/users" className={`${cls} gap-1`} aria-label={`Users${officerRequests ? `, ${officerRequests} officer requests` : ""}`}>Users<CountBadge n={officerRequests} testId={mobile ? undefined : "officer-requests-count"} /></NavLink>}
      </>
    ) : (
      <>
        <NavLink href="/search" also={["/posts"]} className={cls}>Find opportunities</NavLink>
        <NavLink href="/match" className={cls}>What can I apply for?</NavLink>
        <NavLink href="/assistant" className={cls}>Ask</NavLink>
        {u && <NavLink href="/saved" className={cls}>Saved</NavLink>}
        {u && <NavLink href="/applications" className={cls}>My applications</NavLink>}
      </>
    );
  };
  return (
    <header className="bg-navy backdrop-blur-md text-navy-ink border-b border-black/10 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 min-h-16 py-2 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="shrink-0 font-bold text-xl tracking-tight text-black">
          <span className="text-logo">iGov</span>Path
        </Link>
        <nav aria-label="Main navigation" className="hidden flex-1 items-center gap-x-1 text-sm text-black/80 lg:flex">
          {navLinks(false)}
        </nav>
        <MobileNav>
          {navLinks(true)}
          {!u && (
            <>
              <div className="my-1 h-px bg-black/10" />
              <Link href="/sign-in" className={navLinkClass}>Sign in</Link>
              <Link href="/sign-up" className={navLinkClass}>Sign up</Link>
            </>
          )}
        </MobileNav>
        {u ? (
          <div className="flex items-center text-sm text-black/80">
            <AccountMenu
              name={u.name}
              email={u.email}
              roleLabel={`${ROLE_LABEL[u.role]}${u.status === "pending" ? " · awaiting approval" : ""}${u.departmentName ? ` · ${u.departmentName}` : ""}`}
              isOfficer={isActiveOfficer(u)}
              unread={unread}
              queue={queue}
              officerRequests={officerRequests}
              profiles={canOfficer ? { current: officerMode ? "officer" : "personal", officerLabel: u.departmentName ?? (isAdmin(u) ? "Admin" : "Officer") } : null}
            />
          </div>
        ) : (
          <div className="ml-auto hidden items-center gap-4 text-sm text-black/80 lg:flex">
            <Link href="/sign-in" className="hover:text-black hover:underline">Sign in</Link>
            <Link href="/sign-up" className="rounded-md bg-black text-white font-semibold px-4 py-2 hover:bg-[#222]">Sign up</Link>
          </div>
        )}
      </div>
      <Breadcrumbs />
    </header>
  );
}
