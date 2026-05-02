// Telegram webhook receiver — Phase 2B: connection + task commands
// Commands: /start, /help, /connect, /add, /today, /overdue, /done, /delay, /waiting, /reopen
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const HELP_CONNECTED = [
  "Available commands:",
  "",
  "/add Follow up with Hamza tomorrow #followup !high",
  "/today",
  "/overdue",
  "/done 1   (or /done TASK_ID)",
  "/delay 1 tomorrow   (or /delay TASK_ID 1h)",
  "/waiting 1",
  "/reopen 1",
  "",
  "After /today or /overdue you can also reply without the slash:",
  "done 1",
  "delay 2 tomorrow",
  "waiting 1",
  "reopen 2",
  "",
  "You can also send tasks in plain English, e.g.:",
  "Follow up with Hamza tomorrow about Ektis",
].join("\n");

const LIST_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LIST_EXPIRED_REPLY =
  "That task list expired. Send /today or /overdue again.";

const HELP_UNCONNECTED =
  "To connect, open AB Command Center Settings, generate a Telegram code, then send /connect CODE.";

const UNCONNECTED_REPLY =
  "This Telegram account is not connected to AB Command Center. Go to Settings, generate a connection code, then send /connect CODE.";

const NOT_FOUND_REPLY =
  "Could not find that task. Use /today or /overdue and copy the short ID.";

const AMBIGUOUS_REPLY =
  "That task ID is ambiguous. Use /today or /overdue and copy the full short ID.";

async function tgSend(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("tgSend error", e);
  }
}

/* ---------------- Parsing helpers (no AI) ---------------- */

const PRIORITY_TOKENS: Record<string, string> = {
  "!high": "high",
  "!h": "high",
  "!medium": "medium",
  "!med": "medium",
  "!m": "medium",
  "!low": "low",
  "!l": "low",
};

const CATEGORY_TOKENS: Record<string, string> = {
  "#job": "job_application",
  "#jobs": "job_application",
  "#application": "job_application",
  "#networking": "networking",
  "#net": "networking",
  "#followup": "follow_up",
  "#follow-up": "follow_up",
  "#meeting": "meeting",
  "#interview": "interview_prep",
  "#prep": "interview_prep",
  "#admin": "admin",
  "#personal": "personal",
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

// Get current Y/M/D/H/m in a target IANA timezone
function nowInTz(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    year: parseInt(parts.year),
    month: parseInt(parts.month),
    day: parseInt(parts.day),
    hour: parseInt(parts.hour === "24" ? "0" : parts.hour),
    minute: parseInt(parts.minute),
    weekday: parts.weekday as string, // e.g. "Mon"
  };
}

// Compute the UTC instant corresponding to a given local wall-time in tz.
function zonedDateToUTC(tz: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  // First guess: treat the fields as if they were UTC.
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // What does that UTC instant look like in tz?
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asTz = Date.UTC(
    parseInt(parts.year),
    parseInt(parts.month) - 1,
    parseInt(parts.day),
    parseInt(parts.hour === "24" ? "0" : parts.hour),
    parseInt(parts.minute),
    0,
  );
  // The offset is (asTz - guess); the true UTC instant is guess - offset.
  const offset = asTz - guess;
  return new Date(guess - offset);
}

function weekdayShortToNum(s: string): number {
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[s] ?? 0;
}

type DueParse = { dueAt: string | null; matchedPhrase: string | null };

function parseDue(text: string, tz: string): DueParse {
  const lower = ` ${text.toLowerCase()} `;
  const now = nowInTz(tz);
  const todayWeekday = weekdayShortToNum(now.weekday);

  function build(y: number, mo: number, d: number, h: number, mi: number) {
    return zonedDateToUTC(tz, y, mo, d, h, mi).toISOString();
  }

  // Add days to a Y/M/D
  function addDays(y: number, mo: number, d: number, days: number) {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  // tomorrow with explicit time
  let m = lower.match(/\b(?:by\s+)?tomorrow\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (m) {
    let h = parseInt(m[1]);
    const mi = m[2] ? parseInt(m[2]) : 0;
    const ap = m[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const t = addDays(now.year, now.month, now.day, 1);
    return { dueAt: build(t.y, t.mo, t.d, h, mi), matchedPhrase: m[0].trim() };
  }

  // tonight
  m = lower.match(/\btonight\b/);
  if (m) {
    return { dueAt: build(now.year, now.month, now.day, 20, 0), matchedPhrase: "tonight" };
  }

  // by tomorrow / tomorrow
  m = lower.match(/\b(?:by\s+)?tomorrow\b/);
  if (m) {
    const t = addDays(now.year, now.month, now.day, 1);
    return { dueAt: build(t.y, t.mo, t.d, 9, 0), matchedPhrase: m[0].trim() };
  }

  // by today / today
  m = lower.match(/\b(?:by\s+)?today\b/);
  if (m) {
    return { dueAt: build(now.year, now.month, now.day, 18, 0), matchedPhrase: m[0].trim() };
  }

  // in Nh
  m = lower.match(/\bin\s+(\d{1,2})\s*h\b/);
  if (m) {
    const hours = parseInt(m[1]);
    const dt = new Date(Date.now() + hours * 3600_000);
    return { dueAt: dt.toISOString(), matchedPhrase: m[0].trim() };
  }

  // by next Monday / next Monday
  m = lower.match(/\b(?:by\s+)?next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/);
  if (m) {
    const target = WEEKDAYS[m[1]];
    // Days until end of this week (Sunday=0 rollover): target in NEXT week
    let delta = (target - todayWeekday + 7) % 7;
    if (delta === 0) delta = 7;
    delta += 7; // next week, not this week
    if (delta > 13) delta -= 7;
    const t = addDays(now.year, now.month, now.day, delta);
    return { dueAt: build(t.y, t.mo, t.d, 9, 0), matchedPhrase: m[0].trim() };
  }

  // by Friday / Friday (next upcoming)
  m = lower.match(/\b(?:by\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (m) {
    const target = WEEKDAYS[m[1]];
    let delta = (target - todayWeekday + 7) % 7;
    if (delta === 0) delta = 7;
    const t = addDays(now.year, now.month, now.day, delta);
    return { dueAt: build(t.y, t.mo, t.d, 18, 0), matchedPhrase: m[0].trim() };
  }

  return { dueAt: null, matchedPhrase: null };
}

type AddParse = {
  title: string;
  priority: string;
  category: string;
  dueAt: string | null;
};

function parseAdd(text: string, tz: string): AddParse {
  let priority = "medium";
  let category = "admin";

  const tokens = text.split(/\s+/);
  const remaining: string[] = [];
  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (PRIORITY_TOKENS[t]) { priority = PRIORITY_TOKENS[t]; continue; }
    if (CATEGORY_TOKENS[t]) { category = CATEGORY_TOKENS[t]; continue; }
    remaining.push(raw);
  }
  let cleaned = remaining.join(" ");

  const due = parseDue(cleaned, tz);
  if (due.matchedPhrase) {
    // Remove first occurrence (case-insensitive) of the matched phrase
    const re = new RegExp(`\\b${due.matchedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    cleaned = cleaned.replace(re, "");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return { title: cleaned, priority, category, dueAt: due.dueAt };
}

function parseDelayOption(opt: string, tz: string): { dueAt: string | null; label: string | null } {
  const lower = opt.toLowerCase().trim();
  const now = nowInTz(tz);

  function addDays(days: number) {
    const dt = new Date(Date.UTC(now.year, now.month - 1, now.day));
    dt.setUTCDate(dt.getUTCDate() + days);
    return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  function build(y: number, mo: number, d: number, h: number, mi: number) {
    return zonedDateToUTC(tz, y, mo, d, h, mi).toISOString();
  }

  let m = lower.match(/^(\d{1,2})h$/);
  if (m) {
    const dt = new Date(Date.now() + parseInt(m[1]) * 3600_000);
    return { dueAt: dt.toISOString(), label: `${m[1]}h from now` };
  }
  if (lower === "tonight") {
    return { dueAt: build(now.year, now.month, now.day, 20, 0), label: "tonight 20:00" };
  }
  m = lower.match(/^tomorrow\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    let h = parseInt(m[1]);
    const mi = m[2] ? parseInt(m[2]) : 0;
    const ap = m[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const t = addDays(1);
    return { dueAt: build(t.y, t.mo, t.d, h, mi), label: `tomorrow ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}` };
  }
  if (lower === "tomorrow") {
    const t = addDays(1);
    return { dueAt: build(t.y, t.mo, t.d, 9, 0), label: "tomorrow 09:00" };
  }
  m = lower.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (m) {
    const todayWeekday = weekdayShortToNum(now.weekday);
    const target = WEEKDAYS[m[1]];
    let delta = (target - todayWeekday + 7) % 7;
    if (delta === 0) delta = 7;
    delta += 7;
    if (delta > 13) delta -= 7;
    const t = addDays(delta);
    return { dueAt: build(t.y, t.mo, t.d, 9, 0), label: `next ${m[1]} 09:00` };
  }
  return { dueAt: null, label: null };
}

function shortId(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 8);
}

function fmtDue(iso: string | null, tz: string): string {
  if (!iso) return "No due date";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function startEndOfTodayUtc(tz: string): { startUtc: string; endUtc: string } {
  const now = nowInTz(tz);
  const startUtc = zonedDateToUTC(tz, now.year, now.month, now.day, 0, 0).toISOString();
  const endDt = new Date(zonedDateToUTC(tz, now.year, now.month, now.day, 0, 0).getTime() + 24 * 3600_000);
  return { startUtc, endUtc: endDt.toISOString() };
}

/* ---------------- Resolve task by short ID ---------------- */

async function resolveShortId(
  supabase: any,
  userId: string,
  short: string,
  includeDeleted = false,
): Promise<{ task: any | null; error: "missing" | "ambiguous" | "not_found" | null }> {
  const s = short.trim().toLowerCase();
  if (!s) return { task: null, error: "missing" };
  // We need to match on id::text starting with the short (UUIDs include dashes).
  // Postgrest doesn't filter on computed columns easily; fetch user's candidate tasks and filter in JS.
  // Limit by fetching only ids first.
  let q = supabase.from("tasks").select("*").eq("user_id", userId);
  if (!includeDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q;
  if (error) {
    console.error("resolveShortId query error", error);
    return { task: null, error: "not_found" };
  }
  const matches = (data ?? []).filter((t: any) => t.id.replace(/-/g, "").toLowerCase().startsWith(s));
  if (matches.length === 0) return { task: null, error: "not_found" };
  if (matches.length > 1) return { task: null, error: "ambiguous" };
  return { task: matches[0], error: null };
}

/* ---------------- Numbered list (last_telegram_task_list) ---------------- */

type ListItem = { index: number; task_id: string; short_id: string; title: string };
type StoredList = {
  source: "today" | "overdue";
  created_at: string;
  expires_at: string;
  items: ListItem[];
};

async function saveTaskList(
  supabase: any,
  userId: string,
  source: "today" | "overdue",
  tasks: { id: string; title: string }[],
) {
  const now = Date.now();
  const stored: StoredList = {
    source,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + LIST_TTL_MS).toISOString(),
    items: tasks.map((t, i) => ({
      index: i + 1,
      task_id: t.id,
      short_id: shortId(t.id),
      title: t.title,
    })),
  };
  const { data: existing } = await supabase
    .from("settings").select("preferences").eq("user_id", userId).maybeSingle();
  const prefs = ((existing?.preferences as any) ?? {}) as Record<string, unknown>;
  const newPrefs = { ...prefs, last_telegram_task_list: stored };
  await supabase.from("settings")
    .upsert({ user_id: userId, preferences: newPrefs }, { onConflict: "user_id" });
}

async function loadTaskList(supabase: any, userId: string): Promise<StoredList | null> {
  const { data } = await supabase
    .from("settings").select("preferences").eq("user_id", userId).maybeSingle();
  const prefs = (data?.preferences as any) ?? {};
  const list = prefs.last_telegram_task_list as StoredList | undefined;
  if (!list?.items?.length || !list?.expires_at) return null;
  return list;
}

/**
 * Resolve an argument that may be either a number (numbered list lookup) or
 * a short ID. Returns the same shape as resolveShortId, plus an "expired"
 * error code for stale numbered lists.
 */
async function resolveIdArg(
  supabase: any,
  userId: string,
  arg: string,
  includeDeleted = false,
): Promise<{ task: any | null; error: "missing" | "ambiguous" | "not_found" | "expired" | "bad_number" | null; numberRequested?: number }> {
  const trimmed = arg.trim();
  if (!trimmed) return { task: null, error: "missing" };
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    const list = await loadTaskList(supabase, userId);
    if (!list) return { task: null, error: "expired", numberRequested: n };
    if (new Date(list.expires_at).getTime() <= Date.now()) {
      return { task: null, error: "expired", numberRequested: n };
    }
    const item = list.items.find((it) => it.index === n);
    if (!item) return { task: null, error: "bad_number", numberRequested: n };
    let q = supabase.from("tasks").select("*").eq("user_id", userId).eq("id", item.task_id);
    if (!includeDeleted) q = q.is("deleted_at", null);
    const { data } = await q.maybeSingle();
    if (!data) return { task: null, error: "not_found", numberRequested: n };
    return { task: data, error: null, numberRequested: n };
  }
  return await resolveShortId(supabase, userId, trimmed, includeDeleted);
}

function replyForResolveError(
  err: "missing" | "ambiguous" | "not_found" | "expired" | "bad_number",
  numberRequested?: number,
): string {
  if (err === "expired") return LIST_EXPIRED_REPLY;
  if (err === "bad_number") return `I could not find task number ${numberRequested}. Send /today or /overdue again.`;
  if (err === "ambiguous") return AMBIGUOUS_REPLY;
  return NOT_FOUND_REPLY;
}

/* ---------------- AI parser bridge ---------------- */

const CLARIFICATION_TTL_MS = 30 * 60 * 1000;

type PendingClarification = {
  raw_input_id: string | null;
  original_text: string;
  question: string;
  created_at: string;
  expires_at: string;
};

async function callAiParser(userId: string, text: string, tz: string, source: string): Promise<any | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-parser`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        text,
        timezone: tz,
        current_time_iso: new Date().toISOString(),
        source,
      }),
    });
    if (!resp.ok) {
      console.error("ai-parser HTTP error", resp.status);
      return null;
    }
    return await resp.json();
  } catch (e) {
    console.error("ai-parser call failed", e);
    return null;
  }
}

async function setPendingClarification(supabase: any, userId: string, p: PendingClarification | null) {
  const { data: existing } = await supabase
    .from("settings").select("preferences").eq("user_id", userId).maybeSingle();
  const prefs = ((existing?.preferences as any) ?? {}) as Record<string, unknown>;
  if (p) (prefs as any).pending_clarification = p;
  else delete (prefs as any).pending_clarification;
  await supabase.from("settings")
    .upsert({ user_id: userId, preferences: prefs }, { onConflict: "user_id" });
}

async function getPendingClarification(supabase: any, userId: string): Promise<PendingClarification | null> {
  const { data } = await supabase
    .from("settings").select("preferences").eq("user_id", userId).maybeSingle();
  const p = (data?.preferences as any)?.pending_clarification as PendingClarification | undefined;
  if (!p) return null;
  if (new Date(p.expires_at).getTime() <= Date.now()) return null;
  return p;
}

async function aiParserEnabled(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("settings").select("preferences").eq("user_id", userId).maybeSingle();
  const prefs = (data?.preferences as any) ?? {};
  return prefs.ai_parser_enabled !== false;
}

async function findPersonId(supabase: any, userId: string, name: string | null | undefined): Promise<string | null> {
  if (!name || !name.trim()) return null;
  const n = name.trim();
  const { data } = await supabase
    .from("people").select("id, name").eq("user_id", userId).is("deleted_at", null);
  if (!data || data.length === 0) return null;
  const lower = n.toLowerCase();
  const exact = data.find((p: any) => (p.name ?? "").toLowerCase() === lower);
  if (exact) return exact.id;
  const partial = data.filter((p: any) => {
    const pn = (p.name ?? "").toLowerCase();
    return pn.includes(lower) || lower.includes(pn);
  });
  if (partial.length === 1) return partial[0].id;
  return null;
}

async function findJobId(supabase: any, userId: string, company: string | null | undefined, role: string | null | undefined): Promise<string | null> {
  if (!company && !role) return null;
  const { data } = await supabase
    .from("jobs").select("id, company, role_title").eq("user_id", userId).is("deleted_at", null);
  if (!data || data.length === 0) return null;
  if (company) {
    const c = company.trim().toLowerCase();
    const exact = data.find((j: any) => (j.company ?? "").toLowerCase() === c);
    if (exact) return exact.id;
    const partial = data.filter((j: any) => {
      const jc = (j.company ?? "").toLowerCase();
      return jc.includes(c) || c.includes(jc);
    });
    if (partial.length === 1) return partial[0].id;
    if (partial.length > 1 && role) {
      const r = role.trim().toLowerCase();
      const refined = partial.find((j: any) => (j.role_title ?? "").toLowerCase().includes(r));
      if (refined) return refined.id;
    }
  }
  return null;
}

async function createTasksFromAI(
  supabase: any,
  userId: string,
  tasks: any[],
  rawInputId: string | null,
  idemKeyBase: string | null,
): Promise<{ id: string; title: string; category: string; priority: string; due_at: string | null }[]> {
  const created: any[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const personId = await findPersonId(supabase, userId, t.person_name);
    const jobId = await findJobId(supabase, userId, t.company_name, t.job_title);

    const noteParts: string[] = [];
    if (t.notes) noteParts.push(t.notes);
    if (t.next_action) noteParts.push(`Next: ${t.next_action}`);
    if (t.person_name && !personId) noteParts.push(`Person: ${t.person_name}`);
    if (t.company_name && !jobId) noteParts.push(`Company: ${t.company_name}`);
    if (t.job_title && !jobId) noteParts.push(`Role: ${t.job_title}`);
    const description = ((t.description ? `${t.description}\n` : "") + noteParts.join("\n")) || null;

    const idemKey = idemKeyBase ? `${idemKeyBase}:${i}` : null;
    if (idemKey) {
      const { data: existing } = await supabase
        .from("tasks").select("id, title, category, priority, due_at")
        .eq("user_id", userId).eq("idempotency_key", idemKey).maybeSingle();
      if (existing) { created.push(existing); continue; }
    }

    const { data: inserted, error } = await supabase
      .from("tasks").insert({
        user_id: userId,
        title: (t.title ?? "Untitled").slice(0, 200),
        description,
        category: t.category ?? "admin",
        priority: t.priority ?? "medium",
        status: "to_do",
        source: "ai_parser",
        due_at: t.due_at ?? null,
        related_person_id: personId,
        related_job_id: jobId,
        raw_input_id: rawInputId,
        delay_count: 0,
        idempotency_key: idemKey,
      }).select("id, title, category, priority, due_at").single();
    if (error) { console.error("ai task insert error", error); continue; }
    if (inserted) created.push(inserted);
  }
  return created;
}

function formatCapturedTasks(tasks: any[], tz: string): string {
  const lines = ["Captured:", ""];
  tasks.forEach((t, i) => {
    const prio = t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low";
    const cat = String(t.category ?? "admin").replace(/_/g, " ");
    lines.push(`${i + 1}. ${t.title}`);
    lines.push(`   Category: ${cat} · Priority: ${prio} · Due: ${fmtDue(t.due_at, tz)}`);
    lines.push(`   ID: ${shortId(t.id)}`);
  });
  return lines.join("\n");
}

/* ---------------- Main handler ---------------- */


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify Telegram secret header
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!WEBHOOK_SECRET || headerSecret !== WEBHOOK_SECRET) {
    console.warn("Rejected webhook: bad secret token");
    return new Response("unauthorized", { status: 401, headers: corsHeaders });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const msg = update?.message;
  const text: string | undefined = msg?.text;
  const chatId: number | undefined = msg?.chat?.id;
  const tgUserId: number | undefined = msg?.from?.id;
  const messageId: number | undefined = msg?.message_id;

  if (!msg || !text || !chatId || !tgUserId || !messageId) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const trimmed = text.trim();

  // Normalize command (strip @bot_username)
  const firstToken = trimmed.split(/\s+/)[0];
  let command = firstToken.startsWith("/") ? firstToken.split("@")[0].toLowerCase() : "";
  let restAfterCmd = command ? trimmed.slice(firstToken.length).trim() : trimmed;

  // Numbered shortcut: "done 1", "delay 1 tomorrow", "waiting 2", "reopen 3"
  // Only triggered when there is no slash command AND the first arg is a number,
  // so we don't hijack normal chat.
  if (!command) {
    const m = trimmed.match(/^(done|delay|waiting|reopen)\s+(\d+)(?:\s+(.+))?$/i);
    if (m) {
      command = `/${m[1].toLowerCase()}`;
      restAfterCmd = m[3] ? `${m[2]} ${m[3]}` : m[2];
    }
  }
  const argTokens = restAfterCmd ? restAfterCmd.split(/\s+/) : [];

  try {
    /* ---------- /connect (Phase 2A — preserved) ---------- */
    if (command === "/connect") {
      const code = (argTokens[0] ?? "").toUpperCase();
      if (!code) {
        await tgSend(chatId, "Usage: /connect YOURCODE\n\nGenerate the code in the app → Settings → Telegram.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      const { data: alreadyLinked } = await supabase
        .from("profiles").select("id").eq("telegram_user_id", tgUserId).maybeSingle();
      if (alreadyLinked) {
        await tgSend(chatId, "This Telegram account is already connected. Send /help for commands.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      const { data: matches, error: matchErr } = await supabase
        .from("settings").select("user_id, preferences");
      if (matchErr) {
        console.error("settings query error", matchErr);
        await tgSend(chatId, "Something went wrong. Please try again in a moment.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const now = Date.now();
      const match = (matches ?? []).find((row: any) => {
        const link = row?.preferences?.telegram_link;
        if (!link?.code || !link?.expires_at) return false;
        return link.code === code && new Date(link.expires_at).getTime() > now;
      });
      if (!match) {
        await tgSend(chatId, "That code is invalid or expired. Generate a new one in the app and try again.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const userId = match.user_id;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ telegram_user_id: tgUserId, telegram_chat_id: chatId })
        .eq("id", userId);
      if (profErr) {
        console.error("profile update error", profErr);
        await tgSend(chatId, "Could not save the link. Please try again.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const newPrefs = { ...(match as any).preferences };
      delete newPrefs.telegram_link;
      await supabase.from("settings").update({ preferences: newPrefs }).eq("user_id", userId);
      await tgSend(chatId, "Connected. Send /help to see what I can do.");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    /* ---------- Resolve connected user for everything else ---------- */
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, timezone")
      .eq("telegram_user_id", tgUserId)
      .maybeSingle();

    // /start (works for both connected & unconnected)
    if (command === "/start") {
      if (profile) {
        await tgSend(chatId, `AB Command Center is connected${profile.display_name ? ` to ${profile.display_name}` : ""}. Send /help for commands.`);
      } else {
        await tgSend(chatId, "Welcome to AB Command Center.\n\nThis Telegram account is not linked yet.\n\n1. Open the app → Settings → Telegram\n2. Tap “Generate connection code”\n3. Send me: /connect YOURCODE");
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // /help
    if (command === "/help") {
      await tgSend(chatId, profile ? HELP_CONNECTED : HELP_UNCONNECTED);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // For all other commands, require connection
    if (!profile) {
      if (command) await tgSend(chatId, UNCONNECTED_REPLY);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const userId = profile.id;
    const tz = profile.timezone || "Europe/London";

    /* ---------- Log raw_input for connected user ---------- */
    const rawParsed: Record<string, unknown> = {
      telegram_message_id: messageId,
      telegram_user_id: tgUserId,
      telegram_chat_id: chatId,
      command: command || null,
      command_args: command ? restAfterCmd : null,
      received_at: new Date().toISOString(),
    };

    // Idempotency check for mutating commands: did we already process this message_id?
    let alreadyProcessed = false;
    if (command === "/done" || command === "/delay" || command === "/waiting" || command === "/reopen" || command === "/add") {
      const { data: prior } = await supabase
        .from("raw_inputs")
        .select("id, parsed_json")
        .eq("user_id", userId)
        .eq("source", "telegram")
        .eq("parser_version", "telegram_text_v1")
        .contains("parsed_json", { telegram_message_id: messageId, telegram_chat_id: chatId })
        .limit(1);
      if (prior && prior.length > 0) alreadyProcessed = true;
    }

    /* ---------- /add ---------- */
    if (command === "/add") {
      if (!restAfterCmd) {
        await tgSend(chatId, "Send /add followed by your task. Example:\n/add Follow up with Hamza tomorrow #followup !high");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const parsed = parseAdd(restAfterCmd, tz);
      if (!parsed.title) {
        await tgSend(chatId, "I could not find a task title. Try:\n/add Call Ahmed #networking !low");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      rawParsed.extracted_fields = {
        title: parsed.title, priority: parsed.priority, category: parsed.category, due_at: parsed.dueAt,
      };
      const { data: rawRow } = await supabase
        .from("raw_inputs").insert({
          user_id: userId, source: "telegram",
          content: text, parsed_json: rawParsed, parser_version: "telegram_text_v1",
        }).select("id").single();

      const idemKey = `telegram:${chatId}:${messageId}`;
      const { data: existing } = await supabase
        .from("tasks").select("id, title, category, priority, due_at")
        .eq("user_id", userId).eq("idempotency_key", idemKey).maybeSingle();
      if (existing) {
        await tgSend(chatId,
          `Already captured: ${existing.title}\nCategory: ${existing.category}\nPriority: ${existing.priority}\nDue: ${fmtDue(existing.due_at, tz)}\nID: ${shortId(existing.id)}`);
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      const { data: inserted, error: insErr } = await supabase
        .from("tasks").insert({
          user_id: userId,
          title: parsed.title,
          description: null,
          category: parsed.category,
          priority: parsed.priority,
          status: "to_do",
          source: "telegram",
          due_at: parsed.dueAt,
          raw_input_id: rawRow?.id ?? null,
          delay_count: 0,
          idempotency_key: idemKey,
        }).select("id, title, category, priority, due_at").single();
      if (insErr || !inserted) {
        console.error("task insert failed", insErr);
        await tgSend(chatId, "I could not save that task. Please try again.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      await tgSend(chatId,
        `Captured: ${inserted.title}\nCategory: ${inserted.category}\nPriority: ${inserted.priority}\nDue: ${fmtDue(inserted.due_at, tz)}\nID: ${shortId(inserted.id)}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // For non-/add commands, log raw_input now (so retries are detectable)
    if (command && command !== "/start" && command !== "/help") {
      await supabase.from("raw_inputs").insert({
        user_id: userId, source: "telegram",
        content: text, parsed_json: rawParsed, parser_version: "telegram_text_v1",
      });
    }

    /* ---------- /today ---------- */
    if (command === "/today") {
      const { startUtc, endUtc } = startEndOfTodayUtc(tz);
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, priority, due_at, status")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .not("status", "in", "(done,killed,waiting)")
        .or(`and(due_at.gte.${startUtc},due_at.lt.${endUtc}),and(priority.eq.high,due_at.is.null),and(priority.eq.high,due_at.lt.${nowIso})`);
      if (error) {
        console.error("/today query error", error);
        await tgSend(chatId, "Could not load today's tasks. Try again.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const list = (data ?? []).slice().sort((a: any, b: any) => {
        const aOver = a.due_at && new Date(a.due_at) < new Date() && a.priority === "high" ? 0 : 1;
        const bOver = b.due_at && new Date(b.due_at) < new Date() && b.priority === "high" ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        const pri = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
        if (pri(a.priority) !== pri(b.priority)) return pri(a.priority) - pri(b.priority);
        const ad = a.due_at ? new Date(a.due_at).getTime() : Infinity;
        const bd = b.due_at ? new Date(b.due_at).getTime() : Infinity;
        return ad - bd;
      });
      if (list.length === 0) {
        await tgSend(chatId, "No active tasks for today.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const top = list.slice(0, 10);
      const lines = ["Today", ""];
      top.forEach((t: any, i: number) => {
        const time = t.due_at
          ? new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(t.due_at))
          : "No due time";
        const prio = t.priority === "high" ? "High" : t.priority === "medium" ? "Med" : "Low";
        lines.push(`${i + 1}. ${shortId(t.id)} ${t.title}, ${prio}, ${time}`);
      });
      if (list.length > 10) lines.push("", `And ${list.length - 10} more. Open the dashboard for the full list.`);
      lines.push("", "Reply: done 1   delay 2 tomorrow   waiting 1   reopen 2");
      await saveTaskList(supabase, userId, "today", top.map((t: any) => ({ id: t.id, title: t.title })));
      await tgSend(chatId, lines.join("\n"));
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    /* ---------- /overdue ---------- */
    if (command === "/overdue") {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, priority, due_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .not("status", "in", "(done,killed)")
        .lt("due_at", nowIso);
      if (error) {
        console.error("/overdue query error", error);
        await tgSend(chatId, "Could not load overdue tasks. Try again.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const list = (data ?? []).slice().sort((a: any, b: any) => {
        const pri = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
        if (pri(a.priority) !== pri(b.priority)) return pri(a.priority) - pri(b.priority);
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
      if (list.length === 0) {
        await tgSend(chatId, "No overdue tasks.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const top = list.slice(0, 10);
      const lines = ["Overdue", ""];
      top.forEach((t: any, i: number) => {
        const prio = t.priority === "high" ? "High" : t.priority === "medium" ? "Med" : "Low";
        lines.push(`${i + 1}. ${shortId(t.id)} ${t.title}, ${prio}, ${fmtDue(t.due_at, tz)}`);
      });
      if (list.length > 10) lines.push("", `And ${list.length - 10} more. Open the dashboard for the full list.`);
      lines.push("", "Reply: done 1   delay 2 tomorrow   waiting 1   reopen 2");
      await saveTaskList(supabase, userId, "overdue", top.map((t: any) => ({ id: t.id, title: t.title })));
      await tgSend(chatId, lines.join("\n"));
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    /* ---------- /done <number|short_id> ---------- */
    if (command === "/done") {
      const id = argTokens[0];
      if (!id) {
        await tgSend(chatId, "Send /done 1 (after /today or /overdue) or /done TASK_ID.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const r = await resolveIdArg(supabase, userId, id);
      if (r.error) { await tgSend(chatId, replyForResolveError(r.error, r.numberRequested)); return new Response("ok", { status: 200, headers: corsHeaders }); }
      if (alreadyProcessed) {
        await tgSend(chatId, `Done: ${r.task.title}`);
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const { error } = await supabase.from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", r.task.id).eq("user_id", userId);
      if (error) { console.error(error); await tgSend(chatId, "Could not update that task."); return new Response("ok", { status: 200, headers: corsHeaders }); }
      await tgSend(chatId, `Done: ${r.task.title}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    /* ---------- /delay <number|short_id> OPTION ---------- */
    if (command === "/delay") {
      const id = argTokens[0];
      const opt = argTokens.slice(1).join(" ");
      if (!id || !opt) {
        await tgSend(chatId, "Send /delay 1 tomorrow, /delay 1 1h, or /delay TASK_ID tomorrow.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const parsed = parseDelayOption(opt, tz);
      if (!parsed.dueAt) {
        await tgSend(chatId, "Unsupported delay option. Try 1h, 2h, tonight, tomorrow, tomorrow 9am, or next Monday.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const r = await resolveIdArg(supabase, userId, id);
      if (r.error) { await tgSend(chatId, replyForResolveError(r.error, r.numberRequested)); return new Response("ok", { status: 200, headers: corsHeaders }); }
      if (alreadyProcessed) {
        await tgSend(chatId, `Delayed: ${r.task.title}\nNew due: ${fmtDue(parsed.dueAt, tz)}`);
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const { error } = await supabase.from("tasks").update({
        due_at: parsed.dueAt,
        snoozed_until: parsed.dueAt,
        delay_count: (r.task.delay_count ?? 0) + 1,
        last_delayed_at: new Date().toISOString(),
      }).eq("id", r.task.id).eq("user_id", userId);
      if (error) { console.error(error); await tgSend(chatId, "Could not update that task."); return new Response("ok", { status: 200, headers: corsHeaders }); }
      await tgSend(chatId, `Delayed: ${r.task.title}\nNew due: ${fmtDue(parsed.dueAt, tz)}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    /* ---------- /waiting <number|short_id> ---------- */
    if (command === "/waiting") {
      const id = argTokens[0];
      if (!id) {
        await tgSend(chatId, "Send /waiting 1 (after /today or /overdue) or /waiting TASK_ID.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const r = await resolveIdArg(supabase, userId, id);
      if (r.error) { await tgSend(chatId, replyForResolveError(r.error, r.numberRequested)); return new Response("ok", { status: 200, headers: corsHeaders }); }
      const { error } = await supabase.from("tasks").update({ status: "waiting" }).eq("id", r.task.id).eq("user_id", userId);
      if (error) { console.error(error); await tgSend(chatId, "Could not update that task."); return new Response("ok", { status: 200, headers: corsHeaders }); }
      await tgSend(chatId, `Moved to waiting: ${r.task.title}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    /* ---------- /reopen <number|short_id> ---------- */
    if (command === "/reopen") {
      const id = argTokens[0];
      if (!id) {
        await tgSend(chatId, "Send /reopen 1 (after /today or /overdue) or /reopen TASK_ID.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const r = await resolveIdArg(supabase, userId, id, true);
      if (r.error) { await tgSend(chatId, replyForResolveError(r.error, r.numberRequested)); return new Response("ok", { status: 200, headers: corsHeaders }); }
      const { error } = await supabase.from("tasks").update({
        status: "to_do",
        completed_at: null,
        killed_at: null,
        killed_reason: null,
        deleted_at: null,
      }).eq("id", r.task.id).eq("user_id", userId);
      if (error) { console.error(error); await tgSend(chatId, "Could not update that task."); return new Response("ok", { status: 200, headers: corsHeaders }); }
      await tgSend(chatId, `Reopened: ${r.task.title}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Unknown command
    if (command) {
      await tgSend(chatId, "Unknown command. Send /help.");
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("telegram-webhook error", e);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
