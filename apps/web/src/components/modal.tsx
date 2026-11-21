"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Accessible modal built on <dialog>: focus is trapped, Escape and backdrop clicks close it. */
export function Modal({ open, onClose, title, children, labelledBy = "modal-title" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-2xl bg-white p-0 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-[modal-in_160ms_ease-out]"
    >
      <div className="p-6 sm:p-7">
        <h2 id={labelledBy} className="text-lg font-semibold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}
