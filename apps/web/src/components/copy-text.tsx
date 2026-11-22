"use client";

import { useState } from "react";

/** Shows a value with a Copy button (for reference numbers and email addresses). */
export function CopyText({ value, label, dark = false }: { value: string; label: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono font-semibold break-all select-all">{value}</span>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard not allowed: the text is selectable instead */
          }
        }}
        className={dark ? "rounded-lg bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-white/90" : "rounded-lg border border-black/20 px-3 py-0.5 text-xs font-semibold hover:bg-black/5"}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </span>
  );
}
