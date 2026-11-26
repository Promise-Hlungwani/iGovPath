"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A menu link that stays highlighted (black background) while you are on its page or a page under it. */
export function NavLink({ href, children, exact = false, also = [], className = "", ...rest }: {
  href: string; children: ReactNode; exact?: boolean; also?: string[]; className?: string; "aria-label"?: string;
}) {
  const pathname = usePathname() ?? "/";
  const under = (base: string) => pathname === base || pathname.startsWith(base + "/");
  const active = (exact ? pathname === href : under(href)) || also.some(under);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center rounded-full px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-interactive/50 transition ${active ? "bg-interactive text-white font-semibold" : "hover:bg-interactive-soft hover:text-interactive"} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
