"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** A dropdown that filters the list as soon as you pick an option (the first option means "all"). */
export function SelectFilter({ param, label, options }: { param: string; label: string; options: [string, string][] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const value = params.get(param) ?? "";
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          start(() => router.push(next.size ? `${pathname}?${next}` : pathname));
        }}
        className="min-h-9 rounded-full border border-black/15 bg-white px-3 pr-8 outline-none focus-visible:ring-2 focus-visible:ring-black/40"
      >
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {pending && <span className="text-muted">Loading…</span>}
    </label>
  );
}
