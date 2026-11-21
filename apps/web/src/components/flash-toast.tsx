"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, (p: URLSearchParams) => string> = {
  deleted: () => "Your account and all your data have been deleted.",
  applied: () => "Application sent. You can follow its status here.",
  approved: (p) => {
    const n = Number(p.get("n") ?? 0);
    return n === 0 ? "Nothing was approved." : `${n} record${n === 1 ? "" : "s"} approved and published.`;
  },
};

/** Small pop-up for one-off messages passed as ?flash=<key>. Disappears after a few seconds. */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const key = params.get("flash");
    if (!key || !MESSAGES[key]) return;
    setText(MESSAGES[key](params));
    // Clean the address bar so a refresh doesn't show it again.
    const rest = new URLSearchParams(params);
    rest.delete("flash");
    rest.delete("n");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
    const t = setTimeout(() => setText(null), 5000);
    return () => clearTimeout(t);
  }, [params, pathname, router]);

  if (!text) return null;
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        data-testid="toast"
        className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-black text-white px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.3)] animate-[modal-in_180ms_ease-out]"
      >
        <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-black text-sm font-bold" aria-hidden>✓</span>
        <p className="font-medium">{text}</p>
        <button type="button" onClick={() => setText(null)} className="ml-2 text-white/60 hover:text-white" aria-label="Close">✕</button>
      </div>
    </div>
  );
}
