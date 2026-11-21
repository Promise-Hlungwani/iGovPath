import Link from "next/link";
import { getCurrentUser, isActiveOfficer, isAdmin } from "@/lib/session";
import { remindersAndUnread } from "@/lib/notify";
import { AccountMenu } from "@/components/account-menu";

const ROLE_LABEL = { applicant: "Applicant", officer: "Government officer", admin: "Admin" } as const;

export async function SiteHeader() {
  const u = await getCurrentUser();
  const unread = u ? await remindersAndUnread(u.id) : 0;
  return (
    <header className="bg-navy backdrop-blur-md text-navy-ink border-b border-black/10 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 min-h-16 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" className="font-bold text-xl tracking-tight text-black">
          <span className="text-logo">iGov</span>Path
        </Link>
        <nav className="order-last w-full sm:order-none sm:w-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:flex-1 text-black/80">
          <Link href="/search" className="hover:text-black hover:underline">Find opportunities</Link>
          <Link href="/match" className="hover:text-black hover:underline">What can I apply for?</Link>
          <Link href="/assistant" className="hover:text-black hover:underline">Ask</Link>
          {u && <Link href="/saved" className="hover:text-black hover:underline">Saved</Link>}
          {isActiveOfficer(u) && <Link href="/portal" className="hover:text-black hover:underline">Officer portal</Link>}
          {isAdmin(u) && <Link href="/admin/users" className="hover:text-black hover:underline">Users</Link>}
        </nav>
        <div className="ml-auto sm:ml-0 flex items-center gap-4 text-sm text-black/80">
          {u ? (
            <AccountMenu
              name={u.name}
              email={u.email}
              roleLabel={`${ROLE_LABEL[u.role]}${u.status === "pending" ? " · awaiting approval" : ""}${u.departmentName ? ` · ${u.departmentName}` : ""}`}
              isOfficer={isActiveOfficer(u)}
              unread={unread}
            />
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-black hover:underline">Sign in</Link>
              <Link href="/sign-up" className="rounded-md bg-black text-white font-semibold px-4 py-2 hover:bg-[#222]">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
