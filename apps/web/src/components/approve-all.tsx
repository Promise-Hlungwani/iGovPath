"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { approveAllClean } from "@/app/portal/actions";

export function ApproveAllButton({ count, skipped }: { count: number; skipped: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (count === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-5 font-semibold text-white hover:bg-[#222]"
      >
        Approve all ({count})
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Approve ${count} record${count === 1 ? "" : "s"}?`} labelledBy="approve-all-title">
        <p className="text-muted">
          They will be published straight away and appear in search. Each approval is recorded under your name in the audit log.
        </p>
        {skipped > 0 && (
          <p className="mt-2 text-muted">
            {skipped} record{skipped === 1 ? " is" : "s are"} not included because {skipped === 1 ? "it has" : "they have"} problems to fix or {skipped === 1 ? "is an amendment" : "are amendments"}. Open {skipped === 1 ? "it" : "them"} one by one.
          </p>
        )}
        <form action={approveAllClean} onSubmit={() => setBusy(true)} className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full border border-black/20 px-5 font-semibold hover:bg-black/5">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-black px-5 font-semibold text-white hover:bg-[#222] disabled:opacity-60">
            {busy ? "Approving…" : "Approve all"}
          </button>
        </form>
      </Modal>
    </>
  );
}
