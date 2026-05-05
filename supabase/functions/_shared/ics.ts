// Shared server-safe ICS builder (RFC 5545). Used by telegram-webhook,
// email-calendar-export, and daily-evening-brief.

function pad2(n: number) { return String(n).padStart(2, "0"); }

export function toIcsUtc(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

export function escIcs(s: string): string {
  return String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function fold(line: string): string {
  const out: string[] = [];
  let s = line;
  while (s.length > 73) { out.push(s.slice(0, 73)); s = " " + s.slice(73); }
  out.push(s);
  return out.join("\r\n");
}

export type IcsTask = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  category: string;
  status: string;
  source: string;
  due_at: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export function buildIcsForTasks(tasks: IcsTask[], opts?: { tz?: string; calName?: string; prodId?: string; method?: string }): string {
  const dtstamp = toIcsUtc(new Date());
  const events = tasks
    .filter(t => t.due_at && !t.deleted_at && t.status !== "done" && t.status !== "killed")
    .map(t => {
      const start = new Date(t.due_at!);
      const end = new Date(start.getTime() + 30 * 60_000);
      const desc = escIcs([
        `Priority: ${t.priority}`,
        `Category: ${t.category}`,
        `Status: ${t.status}`,
        `Source: ${t.source}`,
        t.description ? `\n${t.description}` : "",
      ].filter(Boolean).join("\n"));
      return [
        "BEGIN:VEVENT",
        fold(`UID:${t.id}@ab-command-center`),
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${toIcsUtc(start)}`,
        `DTEND:${toIcsUtc(end)}`,
        fold(`SUMMARY:${escIcs(t.title)}`),
        fold(`DESCRIPTION:${desc}`),
        `LAST-MODIFIED:${toIcsUtc(t.updated_at ?? t.due_at!)}`,
        "END:VEVENT",
      ].join("\r\n");
    });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts?.prodId ?? "-//AB Command Center//Remaining//EN"}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${opts?.method ?? "PUBLISH"}`,
    `X-WR-CALNAME:${opts?.calName ?? "AB Command Center — Remaining"}`,
    opts?.tz ? `X-WR-TIMEZONE:${opts.tz}` : "",
    ...events,
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

// Compute the UTC instant corresponding to a given local wall-time in tz.
export function zonedDateToUTC(tz: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const asTz = Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day),
    parseInt(parts.hour === "24" ? "0" : parts.hour), parseInt(parts.minute), 0,
  );
  return new Date(guess - (asTz - guess));
}

export function nowInTz(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  return {
    year: parseInt(parts.year),
    month: parseInt(parts.month),
    day: parseInt(parts.day),
    hour: parseInt(parts.hour === "24" ? "0" : parts.hour),
    minute: parseInt(parts.minute),
  };
}

// Build the "Tonight Execution Block" event: 22:00 today → 03:00 tomorrow in tz.
export function buildExecutionBlockIcs(opts: {
  userId: string;
  tz: string;
  description: string;
  organizerEmail?: string | null;
  attendeeEmail?: string | null;
}): { ics: string; localDate: string; uid: string } {
  const tz = opts.tz;
  const now = nowInTz(tz);
  const startUtc = zonedDateToUTC(tz, now.year, now.month, now.day, 22, 0);
  // 03:00 next day
  const next = new Date(Date.UTC(now.year, now.month - 1, now.day));
  next.setUTCDate(next.getUTCDate() + 1);
  const endUtc = zonedDateToUTC(tz, next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 3, 0);
  const localDate = `${now.year}-${pad2(now.month)}-${pad2(now.day)}`;
  const uid = `night-block-${opts.userId}-${localDate}@ab-command-center`;
  const dtstamp = toIcsUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AB Command Center//Daily Brief//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    fold(`UID:${uid}`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsUtc(startUtc)}`,
    `DTEND:${toIcsUtc(endUtc)}`,
    fold(`SUMMARY:AB Command Center: Night Execution Block`),
    fold(`DESCRIPTION:${escIcs(opts.description)}`),
  ];
  if (opts.organizerEmail) lines.push(fold(`ORGANIZER:mailto:${opts.organizerEmail}`));
  if (opts.attendeeEmail) lines.push(fold(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${opts.attendeeEmail}`));
  lines.push("END:VEVENT", "END:VCALENDAR");
  return { ics: lines.join("\r\n"), localDate, uid };
}
