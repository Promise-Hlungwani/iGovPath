"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui";
import { toggleSave } from "@/app/posts/actions";

export function SaveButton({ opportunityId, saved, signedIn }: { opportunityId: string; saved: boolean; signedIn: boolean }) {
  const [isSaved, setSaved] = useState(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) {
    return (
      <ButtonLink variant="secondary" href={`/sign-in?next=/posts/${opportunityId}`} className="w-full">
        Sign in to save
      </ButtonLink>
    );
  }
  return (
    <div className="space-y-1">
      <Button
        className="w-full"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              setSaved(await toggleSave(opportunityId));
            } catch {
              setError("Couldn't save just now. Please try again.");
            }
          })
        }
      >
        {isSaved ? "Saved ✓ (remove)" : "Save and get reminders"}
      </Button>
      {error && <p role="alert" className="text-xs text-danger text-center">{error}</p>}
      {isSaved && <p className="text-xs text-muted text-center"><Link href="/saved" className="underline">See my saved posts</Link></p>}
    </div>
  );
}
