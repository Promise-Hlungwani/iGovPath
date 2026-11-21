import { Badge } from "@/components/ui";
import { daysUntil, formatDate } from "@/lib/format";
import type { OppStatus } from "@/lib/opportunities";

export function StatusBadge({ status }: { status: OppStatus }) {
  const map: Record<OppStatus, { tone: "brand" | "warn" | "danger" | "neutral" | "info"; label: string }> = {
    open: { tone: "brand", label: "Open" },
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
  return (
    <span className={n !== null && n >= 0 && n <= 3 ? "text-danger font-medium" : ""}>
      Closes {formatDate(date)}{when}
    </span>
  );
}
