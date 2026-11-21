"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui";
import { toggleSave } from "@/app/posts/actions";

export function SaveButton({ opportunityId, saved, signedIn }: { opportunityId: string; saved: boolean; signedIn: boolean }) {
  const [isSaved, setSaved] = useState(saved);
  const [pending, start] = useTransition();
  if (!signedIn) {
    return (
      <ButtonLink href={`/sign-in?next=/posts/${opportunityId}`} className="w-full">
        Sign in to save
      </ButtonLink>
    );
  }
  return (
    <div className="space-y-1">
      <Button
        className="w-full"
        variant={isSaved ? "secondary" : "primary"}
        disabled={pending}
        onClick={() => start(async () => setSaved(await toggleSave(opportunityId)))}
      >
        {isSaved ? "Saved ✓ (remove)" : "Save and get reminders"}
      </Button>
      {isSaved && <p className="text-xs text-muted text-center"><Link href="/saved" className="underline">See my saved posts</Link></p>}
    </div>
  );
}
