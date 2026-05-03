import { TaskRow } from "@/lib/tasks";
import { isRemaining } from "@/lib/remaining";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function fold(line: string): string {
  // RFC 5545: lines should be ≤75 octets; split on 73 to be safe
  const out: string[] = [];
  let s = line;
  while (s.length > 73) {
    out.push(s.slice(0, 73));
    s = " " + s.slice(73);
  }
  out.push(s);
  return out.join("\r\n");
}

export function buildIcsForRemaining(tasks: TaskRow[], opts?: { tz?: string }): string {
  const events: string[] = [];
  const dtstamp = toIcsUtc(new Date().toISOString());
  for (const t of tasks) {
    if (!isRemaining(t)) continue;
    if (!t.due_at) continue;
    const start = new Date(t.due_at);
    const end = new Date(start.getTime() + 30 * 60_000);
    const descLines = [
      `Priority: ${t.priority}`,
      `Category: ${t.category}`,
      `Status: ${t.status}`,
      `Source: ${t.source}`,
    ];
    if (t.description) descLines.push("", t.description);
    const desc = escapeIcs(descLines.join("\n"));
    const summary = escapeIcs(t.title);
    events.push(
      [
        "BEGIN:VEVENT",
        fold(`UID:${t.id}@ab-command-center`),
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${toIcsUtc(start.toISOString())}`,
        `DTEND:${toIcsUtc(end.toISOString())}`,
        fold(`SUMMARY:${summary}`),
        fold(`DESCRIPTION:${desc}`),
        `LAST-MODIFIED:${toIcsUtc(t.updated_at)}`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AB Command Center//Remaining Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:AB Command Center — Remaining`,
    opts?.tz ? `X-WR-TIMEZONE:${opts.tz}` : "",
    ...events,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
