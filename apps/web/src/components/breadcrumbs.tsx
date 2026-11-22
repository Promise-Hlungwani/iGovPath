"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/* Pages can give a level a real name (e.g. the job title instead of "Job") with <CrumbLabel>. */
let labels: Record<string, string> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const EMPTY: Record<string, string> = {};

export function CrumbLabel({ path, text }: { path: string; text: string }) {
  useEffect(() => {
    labels = { ...labels, [path]: text };
    emit();
    return () => { const { [path]: _, ...rest } = labels; void _; labels = rest; emit(); };
  }, [path, text]);
  return null;
}

/** Names for each level of the address. Levels without a page of their own are skipped. */
const STATIC: Record<string, string | null> = {
  "/search": "Find opportunities",
  "/match": "What can I apply for?",
  "/assistant": "Ask",
  "/saved": "Saved jobs",
  "/notifications": "Messages",
  "/accuracy": "Accuracy",
  "/privacy": "How we handle your information",
  "/applications": "My applications",
  "/account": "My account",
  "/account/documents": "My documents",
  "/account/request-officer-access": "Officer access",
  "/portal": "Officer portal",
  "/portal/applications": "Applications",
  "/portal/upload": "Upload",
  "/portal/opportunities": "Published",
  "/portal/forms": "Forms",
  "/portal/draft-check": "Draft check",
  "/portal/dashboard": "Dashboard",
  "/portal/audit": "Audit log",
  "/portal/review": null,
  "/portal/documents": null,
  "/admin": null,
  "/admin/users": "Users",
  "/posts": null,
};

function nameFor(path: string): string | null | undefined {
  if (path in STATIC) return STATIC[path];
  if (/^\/posts\/[^/]+$/.test(path)) return "Job";
  if (/^\/posts\/[^/]+\/explain$/.test(path)) return "In simple words";
  if (/^\/posts\/[^/]+\/checklist$/.test(path)) return "Checklist";
  if (/^\/applications\/[^/]+$/.test(path)) return "Application";
  if (/^\/portal\/applications\/[^/]+$/.test(path)) return "Application";
  if (/^\/portal\/review\/[^/]+$/.test(path)) return "Review";
  if (/^\/portal\/documents\/[^/]+$/.test(path)) return "Document";
  return undefined;
}

const HIDDEN = new Set(["/", "/sign-in", "/sign-up"]);

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const custom = useSyncExternalStore(subscribe, () => labels, () => EMPTY);
  if (HIDDEN.has(pathname)) return null;

  // A job opened from the officer side still belongs under Find opportunities.
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [{ href: "/", label: "Home" }];
  if (parts[0] === "posts") crumbs.push({ href: "/search", label: "Find opportunities" });
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    const label = custom[acc] ?? nameFor(acc);
    if (label) crumbs.push({ href: acc, label });
  }
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="You are here" className="border-t border-black/[0.06] text-sm">
      <ol className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-x-1.5 text-muted overflow-hidden whitespace-nowrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className={`flex items-center gap-1.5 ${i === 0 ? "shrink-0" : "min-w-0"}`}>
              {i > 0 && <span aria-hidden className="text-black/30">›</span>}
              {last ? (
                <span aria-current="page" className="font-semibold text-black truncate max-w-[11rem] sm:max-w-[20rem]" title={c.label}>{c.label}</span>
              ) : (
                <Link href={c.href} className={`hover:text-black hover:underline truncate ${i === 0 ? "" : "max-w-[7rem] sm:max-w-[14rem]"}`} title={c.label}>{c.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
