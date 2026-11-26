import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function compactDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({
      title: schema.opportunities.postTitle,
      referenceNumber: schema.opportunities.referenceNumber,
      closingDate: schema.opportunities.closingDate,
      status: schema.opportunities.status,
    })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.id, id));
  if (!row || !row.closingDate || row.status === "withdrawn") return new Response("No closing date", { status: 404 });

  const title = row.title;
  const reminder = new Date(`${row.closingDate}T00:00:00`);
  reminder.setDate(reminder.getDate() - 3);
  const reminderIso = `${reminder.getFullYear()}-${String(reminder.getMonth() + 1).padStart(2, "0")}-${String(reminder.getDate()).padStart(2, "0")}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const description = `iGovPath application deadline${row.referenceNumber ? ` for reference ${row.referenceNumber}` : ""}. Check the official advert before applying.`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//iGovPath//Application Timeline//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${id}-reminder@igovpath`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(reminderIso)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(reminderIso))}`,
    `SUMMARY:${escapeIcs(`Application reminder: ${title}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT",
    "BEGIN:VEVENT",
    `UID:${id}-closing@igovpath`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(row.closingDate)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(row.closingDate))}`,
    `SUMMARY:${escapeIcs(`Application closes: ${title}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="igovpath-${id}-timeline.ics"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
