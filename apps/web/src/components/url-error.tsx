"use client";

import { useSearchParams } from "next/navigation";

/** Shows the ?error= message a failed action sent us back with. */
export function UrlError() {
  const msg = useSearchParams().get("error");
  if (!msg || msg.length < 4) return null;
  return (
    <div role="alert" className="mb-4 rounded-2xl border border-danger/30 bg-danger-soft px-5 py-4 text-danger">
      {msg}
    </div>
  );
}
