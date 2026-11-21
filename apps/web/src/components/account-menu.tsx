"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Modal } from "@/components/modal";
import { deleteMyAccount } from "@/app/account/actions";

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full bg-black text-white font-semibold select-none"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

type Props = { name: string; email: string; roleLabel: string; isOfficer: boolean; unread: number };

export function AccountMenu({ name, email, roleLabel, isOfficer, unread }: Props) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "signout" | "delete">(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] hover:bg-black/[0.05] focus-visible:bg-black/[0.05] outline-none";

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full ring-offset-2 hover:ring-2 hover:ring-black/15 focus-visible:ring-2 focus-visible:ring-black outline-none"
      >
        <Avatar name={name} />
        {unread > 0 && (
          <span data-testid="unread" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-black px-1 text-center text-[11px] font-bold leading-5 text-white ring-2 ring-white">{unread}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-black/10 bg-white/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-md animate-[menu-in_120ms_ease-out] z-50"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar name={name} size={40} />
            <div className="min-w-0">
              <p className="font-semibold truncate">{name}</p>
              <p className="text-sm text-muted truncate">{email}</p>
            </div>
          </div>
          <p className="px-3 pb-2 text-xs font-medium text-muted">{roleLabel}</p>
          <div className="my-1 h-px bg-black/10" />
          <Link role="menuitem" href="/account" className={item} onClick={() => setOpen(false)}>My account</Link>
          <Link role="menuitem" href="/saved" className={item} onClick={() => setOpen(false)}>My saved jobs</Link>
          <Link role="menuitem" href="/notifications" className={item} onClick={() => setOpen(false)}>
            Messages {unread > 0 && <span className="rounded-full bg-black px-2 text-xs font-bold leading-5 text-white">{unread}</span>}
          </Link>
          {isOfficer && <Link role="menuitem" href="/portal" className={item} onClick={() => setOpen(false)}>Officer portal</Link>}
          <div className="my-1 h-px bg-black/10" />
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); setDialog("signout"); }}>Sign out</button>
          <button role="menuitem" type="button" className={`${item} text-[#b42318] hover:bg-[#b42318]/[0.06]`} onClick={() => { setOpen(false); setDialog("delete"); }}>
            Delete account
          </button>
        </div>
      )}

      <SignOutDialog open={dialog === "signout"} onClose={() => setDialog(null)} />
      <DeleteDialog open={dialog === "delete"} onClose={() => setDialog(null)} isOfficer={isOfficer} />
    </div>
  );
}

function SignOutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Sign out of iGovPath?" labelledBy="signout-title">
      <p className="text-muted">You can sign in again at any time. Your saved jobs stay on your account.</p>
      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-black/20 px-5 font-semibold hover:bg-black/5">Cancel</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
          className="min-h-11 rounded-full bg-black px-5 font-semibold text-white hover:bg-[#222] disabled:opacity-60"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </Modal>
  );
}

function DeleteDialog({ open, onClose, isOfficer }: { open: boolean; onClose: () => void; isOfficer: boolean }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toUpperCase() === "DELETE";
  return (
    <Modal open={open} onClose={() => { setTyped(""); onClose(); }} title="Delete your account?" labelledBy="delete-title">
      <p className="text-muted">
        This permanently deletes your account and everything linked to you: your login, saved jobs, checklist progress,
        messages, your CV summary and your activity history. <strong className="text-foreground">This cannot be undone.</strong>
      </p>
      {isOfficer && <p className="mt-2 text-muted">Jobs you approved stay published for your department, without your name.</p>}
      <form action={deleteMyAccount} onSubmit={() => setBusy(true)} className="mt-5 space-y-4">
        <div>
          <label htmlFor="confirm" className="block text-sm font-semibold mb-1.5">Type DELETE to confirm</label>
          <input
            id="confirm"
            name="confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full rounded-xl border-2 border-black/15 px-4 py-2.5 focus:border-black outline-none"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={() => { setTyped(""); onClose(); }} className="min-h-11 rounded-full border border-black/20 px-5 font-semibold hover:bg-black/5">Cancel</button>
          <button type="submit" disabled={!ok || busy} className="min-h-11 rounded-full bg-[#b42318] px-5 font-semibold text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? "Deleting…" : "Delete my account permanently"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
