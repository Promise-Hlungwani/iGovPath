/** Placeholder shown instantly while a page loads. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-8 w-64 rounded-md bg-white/10" />
        <div className="h-4 w-96 max-w-full rounded bg-white/5" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white/[0.03] p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="h-5 w-2/3 rounded bg-white/10" />
            <div className="h-4 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
