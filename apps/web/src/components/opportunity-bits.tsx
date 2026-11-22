import { Badge } from "@/components/ui";
import { daysUntil, formatDate } from "@/lib/format";
import type { OppStatus } from "@/lib/opportunities";

export function StatusBadge({ status }: { status: OppStatus }) {
  const map: Record<OppStatus, { tone: "brand" | "warn" | "danger" | "neutral" | "info" | "ok"; label: string }> = {
    open: { tone: "ok", label: "Open" },
    amended: { tone: "warn", label: "Amended" },
    extended: { tone: "info", label: "Extended" },
    withdrawn: { tone: "danger", label: "Withdrawn" },
    closed: { tone: "neutral", label: "Closed" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function TypeBadge({ type }: { type: "post" | "internship" | "learnership" }) {
  if (type === "post") return null;
  return <Badge tone="info">{type === "internship" ? "Internship" : "Learnership"}</Badge>;
}

export function ClosingText({ date }: { date: string | null }) {
  if (!date) return <span className="italic text-muted">Closing date not stated in the advert</span>;
  const n = daysUntil(date);
  const when =
    n === null ? "" : n < 0 ? " (closed)" : n === 0 ? " (closes today)" : n === 1 ? " (1 day left)" : ` (${n} days left)`;
  // Green while open, amber under 7 days, red under 48 hours, grey once closed.
  const tone = n === null ? "" : n < 0 ? "text-muted" : n <= 1 ? "text-urgent font-semibold" : n < 7 ? "text-soon font-semibold" : "text-ok font-medium";
  const dot = n === null ? "" : n < 0 ? "bg-black/25" : n <= 1 ? "bg-urgent" : n < 7 ? "bg-soon" : "bg-ok";
  return (
    <span className={`inline-flex items-center gap-1.5 ${tone}`} data-closing={n === null ? "unknown" : n < 0 ? "closed" : n <= 1 ? "urgent" : n < 7 ? "soon" : "open"}>
      <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      Closes {formatDate(date)}{when}
    </span>
  );
}
