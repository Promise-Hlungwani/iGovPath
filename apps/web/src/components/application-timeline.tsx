import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui";

export type TimelineVersion = {
  version: number;
  approvedAt: Date | string;
  changedFields: string[];
  note: string | null;
};

type Props = {
  opportunityId: string;
  closingDate: string | null;
  sourceDate: string | null;
  status: string;
  versions: TimelineVersion[];
  compact?: boolean;
};

function dateOnly(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ApplicationTimeline({
  opportunityId,
  closingDate,
  sourceDate,
  status,
  versions,
  compact = false,
}: Props) {
  const events: { date: string; title: string; detail: string; tone: "neutral" | "brand" | "warn" }[] = [];
  if (sourceDate) {
    events.push({ date: sourceDate, title: "Advert published", detail: "Public source document", tone: "neutral" });
  }

  for (const version of [...versions].sort((a, b) => dateOnly(a.approvedAt).localeCompare(dateOnly(b.approvedAt)))) {
    if (version.version === 1) continue;
    events.push({
      date: dateOnly(version.approvedAt),
      title: status === "extended" && version.version === versions.length ? "Post extended" : "Post amended",
      detail: version.changedFields.length ? `Updated: ${version.changedFields.join(", ")}` : version.note || "Advert updated",
      tone: "warn",
    });
  }

  if (closingDate) {
    const reminder = addDays(closingDate, -3);
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    if (reminder >= today) {
      events.push({ date: reminder, title: "Closing reminder", detail: "Your 3-day reminder will appear", tone: "brand" });
    }
    events.push({ date: closingDate, title: "Application closes", detail: "Application closing date", tone: "brand" });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  const googleDate = closingDate?.replaceAll("-", "");
  const googleEndDate = closingDate ? addDays(closingDate, 1).replaceAll("-", "") : null;
  const googleUrl = closingDate
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Government application closing date")}&dates=${googleDate}/${googleEndDate}&details=${encodeURIComponent("Application deadline for an opportunity on iGovPath.")}`
    : null;

  return (
    <section className={compact ? "mt-3" : "rounded-2xl border border-black/10 bg-white p-5"} aria-label="Application timeline">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className={compact ? "text-sm font-semibold" : "text-lg font-semibold"}>Application timeline</h2>
        {closingDate && (
          <div className="flex flex-wrap gap-2">
            {googleUrl && (
              <a className="text-xs font-semibold underline" href={googleUrl} target="_blank" rel="noreferrer">
                Add closing date to Google Calendar
              </a>
            )}
            <a className="text-xs font-semibold underline" href={`/api/opportunities/${opportunityId}/calendar`}>
              Download calendar reminder
            </a>
          </div>
        )}
      </div>
      {events.length ? (
        <ol className={compact ? "mt-2 space-y-2" : "mt-4 space-y-3"}>
          {events.map((event) => (
            <li key={`${event.date}-${event.title}`} className="flex gap-3 text-sm">
              <div className="w-28 shrink-0 text-muted">{formatDate(event.date)}</div>
              <div className="border-l-2 border-border pl-3">
                <Badge tone={event.tone}>{event.title}</Badge>
                <p className="mt-1 text-muted">{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">No timeline dates are stated in the advert.</p>
      )}
    </section>
  );
}
