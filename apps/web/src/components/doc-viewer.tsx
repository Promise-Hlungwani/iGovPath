"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Opens a document in a pop-up on the same page. The pop-up is placed at the end of <body>, so the
 * button can sit anywhere (even inside a paragraph) without breaking the page. PDFs and photos show inside it; Word files can be downloaded. */
export function DocViewer({ href, fileName, className = "underline font-medium break-all text-left" }: { href: string; fileName: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ref = useRef<HTMLDialogElement>(null);
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png"].includes(ext);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{fileName}</button>
      {mounted && createPortal(
      <dialog
        ref={ref}
        aria-label={fileName}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === ref.current) setOpen(false); }}
        className="m-auto w-[min(96vw,60rem)] h-[min(92vh,56rem)] rounded-2xl bg-white p-0 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop:bg-black/40 backdrop:backdrop-blur-sm open:flex open:flex-col open:animate-[modal-in_160ms_ease-out]"
      >
        <div className="flex items-center gap-3 border-b border-black/10 px-5 py-3">
          <p className="font-semibold truncate flex-1" title={fileName}>{fileName}</p>
          <a href={href} download={fileName} className="rounded-lg border border-black/15 px-4 py-1.5 text-sm font-semibold hover:bg-black/5">Download</a>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-black px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#222]" autoFocus>
            Close
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-black/[0.03]">
          {open && (isPdf ? (
            <iframe src={href} title={fileName} className="h-full w-full border-0" />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- private file from our own API, not a static asset
            <img src={href} alt={fileName} className="h-full w-full object-contain p-4" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p>This Word document can&apos;t be shown here.</p>
              <a href={href} download={fileName} className="rounded-lg bg-black px-5 py-2 font-semibold text-white hover:bg-[#222]">Download it</a>
            </div>
          ))}
        </div>
      </dialog>,
      document.body,
      )}
    </>
  );
}
