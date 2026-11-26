"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown instead of a crash when a page fails. The rest of the app keeps working. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);
  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-black/10 bg-white p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
      <h1 className="text-2xl font-extrabold">This page didn&apos;t load</h1>
      <p className="mt-3 text-muted">
        Something went wrong on our side. Nothing you did caused it. Please try again; if it keeps happening, tell the iGovPath team.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-black px-6 font-semibold text-white hover:bg-[#222]">Try again</button>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/20 px-6 font-semibold hover:bg-black/5">Go to the home page</Link>
      </div>
    </div>
  );
}
