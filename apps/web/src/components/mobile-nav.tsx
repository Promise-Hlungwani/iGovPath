"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !sheet.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative ml-auto lg:hidden" ref={root}>
      <button
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-black/20 px-4 text-sm font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
        Menu
      </button>
      {/* Rendered at the end of <body>: the header's blur would otherwise trap these fixed layers inside it. */}
      {open && createPortal(
        <div ref={sheet}>
          {/* Dim the page behind the menu; tapping it closes the menu. */}
          <div aria-hidden className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/40 backdrop-blur-[2px] animate-[menu-in_120ms_ease-out]" onClick={() => setOpen(false)} />
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
            }}
            className="fixed inset-x-0 top-16 z-50 flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto border-b border-black/10 bg-white px-4 pb-5 pt-3 text-base text-black/80 shadow-[0_18px_40px_rgba(0,0,0,0.18)] animate-[menu-in_140ms_ease-out]"
          >
            {children}
          </nav>
        </div>,
        document.body,
      )}
    </div>
  );
}
