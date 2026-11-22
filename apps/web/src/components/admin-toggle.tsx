"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { setAdmin } from "@/app/admin/users/actions";

/** "Make admin" / "Remove admin" with a confirmation window. */
export function AdminToggle({ userId, name, isAdmin }: { userId: string; name: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={isAdmin ? "min-h-9 rounded-lg border border-black/20 px-4 text-sm font-semibold hover:bg-black/5" : "min-h-9 rounded-lg bg-black px-4 text-sm font-semibold text-white hover:bg-[#222]"}
      >
        {isAdmin ? "Remove admin" : "Make admin"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={isAdmin ? `Remove admin rights from ${name}?` : `Make ${name} an admin?`} labelledBy={`admin-${userId}`}>
        <p className="text-muted">
          {isAdmin
            ? "They will no longer be able to manage users or see every department. If they belong to a department, they stay an officer there."
            : "Admins can approve officers, make other admins, and see and approve records for every department."}
        </p>
        <form action={setAdmin} onSubmit={() => setBusy(true)} className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="make" value={isAdmin ? "0" : "1"} />
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-black/20 px-5 font-semibold hover:bg-black/5">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-black px-5 font-semibold text-white hover:bg-[#222] disabled:opacity-60">
            {busy ? "Saving…" : isAdmin ? "Remove admin" : "Make admin"}
          </button>
        </form>
      </Modal>
    </>
  );
}
