/** Number badge with a gentle pulsing dot, for work that is waiting (review queue, officer requests). */
export function CountBadge({ n, testId }: { n: number; testId?: string }) {
  if (n <= 0) return null;
  return (
    <span className="relative ml-1.5 inline-flex" data-testid={testId}>
      <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#b42318] opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#b42318]" />
      </span>
      <span className="inline-flex min-w-5 justify-center rounded-full bg-black px-1.5 text-xs font-bold leading-5 text-white" aria-label={`${n} waiting`}>
        {n}
      </span>
    </span>
  );
}
