"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Thin mint bar at the top that starts the moment a link is clicked and finishes when the new page shows. */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Finish when the route actually changes.
  useEffect(() => {
    if (!visible) return;
    if (timer.current) clearInterval(timer.current);
    setWidth(100);
    const t = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    function start() {
      setVisible(true);
      setWidth(12);
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => setWidth((w) => (w < 85 ? w + (90 - w) * 0.12 : w)), 200);
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      if (!form.noValidate && !form.checkValidity()) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] pointer-events-none">
      <div
        className="h-full bg-brand shadow-[0_0_10px_var(--brand)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
