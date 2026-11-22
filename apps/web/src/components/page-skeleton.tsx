/** Placeholder shown instantly while a page loads. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-8 w-64 rounded-lg bg-black/[0.07]" />
        <div className="h-4 w-96 max-w-full rounded bg-black/[0.04]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-white p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-black/[0.07]" />
            <div className="h-5 w-2/3 rounded bg-black/[0.07]" />
            <div className="h-4 w-1/2 rounded bg-black/[0.04]" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
