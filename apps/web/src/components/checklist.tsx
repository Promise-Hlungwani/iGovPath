"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { setChecklistItem } from "@/app/posts/actions";

type Item = { group: string; item: string; source: string; key: string };

export function Checklist({ opportunityId, items, initial, signedIn }: { opportunityId: string; items: Item[]; initial: Record<string, boolean>; signedIn: boolean }) {
  const [state, setState] = useState(initial);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const groups = Array.from(new Set(items.map((i) => i.group)));
  const done = items.filter((i) => state[i.key]).length;
  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>{done} of {items.length} done</span>
          {done === items.length && items.length > 0 && <span className="text-brand font-medium">Ready to apply ✓</span>}
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemax={items.length}>
          <div className="h-full bg-brand transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      {groups.map((g) => (
        <section key={g}>
          <h2 className="font-semibold mb-2">{g}</h2>
          <ul className="space-y-2">
            {items.filter((i) => i.group === g).map((i) => (
              <li key={i.key} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--brand)]"
                  checked={!!state[i.key]}
                  disabled={!signedIn}
                  aria-label={i.item}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setState((s) => ({ ...s, [i.key]: v }));
                    start(async () => {
                      setError(null);
                      try {
                        await setChecklistItem({ opportunityId, key: i.key, done: v });
                      } catch {
                        setState((s) => ({ ...s, [i.key]: !v }));
                        setError("Couldn't save that tick. Please try again.");
                      }
                    });
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm">{i.item}</p>
                </div>
                <Badge tone={i.source === "standard rule" ? "neutral" : "info"}>{i.source}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
