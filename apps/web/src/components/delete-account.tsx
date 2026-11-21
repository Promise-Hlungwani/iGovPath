"use client";

import { useState } from "react";
import { Card, Input, Label, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deleteMyAccount } from "@/app/account/actions";

export function DeleteAccount({ isOfficer, error }: { isOfficer: boolean; error: boolean }) {
  const [open, setOpen] = useState(error);
  const [typed, setTyped] = useState("");
  return (
    <Card className="border-danger/40 space-y-3">
      <h2 className="font-semibold text-danger">Delete my account</h2>
      <p className="text-sm text-muted">
        This permanently deletes your account and everything linked to you: your login, saved posts, checklist progress,
        notifications, your answers on “What can I apply for?” and your activity history. It cannot be undone.
      </p>
      {isOfficer && (
        <p className="text-sm text-muted">
          Posts you approved as an officer stay published because they belong to your department, but your name is removed from them.
        </p>
      )}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-danger underline">
          I want to delete my account
        </button>
      ) : (
        <form action={deleteMyAccount} className="space-y-3">
          <div>
            <Label htmlFor="confirm">Type DELETE to confirm</Label>
            <Input id="confirm" name="confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className="max-w-xs" />
          </div>
          {error && <Notice tone="danger">Type DELETE in capital letters to confirm.</Notice>}
          <div className="flex gap-3">
            <SubmitButton variant="danger" disabled={typed.trim().toUpperCase() !== "DELETE"} pendingText="Deleting…">
              Delete my account permanently
            </SubmitButton>
            <button type="button" className="text-sm underline" onClick={() => { setOpen(false); setTyped(""); }}>Cancel</button>
          </div>
        </form>
      )}
    </Card>
  );
}
