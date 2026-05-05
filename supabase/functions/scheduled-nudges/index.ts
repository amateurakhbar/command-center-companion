// scheduled-nudges: send morning/midday/evening/overdue nudges via Telegram.
// Time-window check from settings; duplicate-protected by nudge_key.
// Manual test: { test: true, force: true, nudge_type: "...", user_email: "..." }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { nowInTz } from "../_shared/ics.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

type NudgeType = "morning" | "midday" | "evening" | "overdue";
const ALL_TYPES: NudgeType[] = ["morning", "midday", "evening", "overdue"];
const WINDOW_MIN = 15; // ±15 minutes around scheduled times

function jres(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function tgSend(chatId: number, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return r.ok;
  } catch { return false; }
}

function todayLocalDate(tz: string): string {
  const n = nowInTz(tz);
  return `${n.year}-${String(n.month).padStart(2, "0")}-${String(n.day).padStart(2, "0")}`;
}

function timeStrToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = String(t).match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function inWindow(nowMin: number, targetMin: number | null): boolean {
  if (targetMin == null) return false;
  const d = Math.min(Math.abs(nowMin - targetMin), 1440 - Math.abs(nowMin - targetMin));
  return d <= WINDOW_MIN;
}

function inQuietHours(nowMin: number, qs: string | null, qe: string | null): boolean {
  const s = timeStrToMinutes(qs); const e = timeStrToMinutes(qe);
  if (s == null || e == null) return false;
  if (s === e) return false;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e; // wraps midnight
}

function isDueTodayLocal(iso: string, tz: string): boolean {
  const now = nowInTz(tz);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find(p => p.type === t)?.value;
  return parseInt(get("year")!) === now.year && parseInt(get("month")!) === now.month && parseInt(get("day")!) === now.day;
}

function buildMessage(kind: NudgeType, tasks: any[], tz: string): string | null {
  const nowMs = Date.now();
  const active = tasks.filter(t => t.status !== "waiting");
  const overdue = active.filter(t => t.due_at && new Date(t.due_at).getTime() < nowMs);
  const today = active.filter(t => t.due_at && new Date(t.due_at).getTime() >= nowMs && isDueTodayLocal(t.due_at, tz));

  const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));

  if (kind === "morning") {
    if (today.length === 0 && overdue.length === 0) return null;
    const lines = ["Morning brief", ""];
    if (overdue.length) {
      lines.push(`Overdue (${overdue.length}):`);
      overdue.slice(0, 5).forEach(t => lines.push(`• ${t.title}`));
      lines.push("");
    }
    if (today.length) {
      lines.push(`Today (${today.length}):`);
      today.slice(0, 8).forEach(t => lines.push(`• ${fmtTime(t.due_at)} ${t.title}`));
    }
    lines.push("", "Reply done 1 / delay 1 tomorrow / waiting 1 after /today.");
    return lines.join("\n");
  }
  if (kind === "midday") {
    if (today.length === 0 && overdue.length === 0) return null;
    const lines = ["Midday check-in", ""];
    if (overdue.length) lines.push(`${overdue.length} overdue.`);
    if (today.length) lines.push(`${today.length} due today.`);
    lines.push("", "Send /today to see your list.");
    return lines.join("\n");
  }
  if (kind === "evening") {
    const lines = ["Evening wrap-up", ""];
    if (today.length) {
      lines.push(`Still due today (${today.length}):`);
      today.slice(0, 8).forEach(t => lines.push(`• ${t.title}`));
    } else {
      lines.push("Nothing left for today.");
    }
    if (overdue.length) lines.push("", `${overdue.length} overdue rolling forward.`);
    return lines.join("\n");
  }
  // overdue
  if (overdue.length === 0) return null;
  const lines = [`Overdue (${overdue.length})`, ""];
  overdue.slice(0, 8).forEach(t => lines.push(`• ${t.title}`));
  lines.push("", "Send /overdue to manage them.");
  return lines.join("\n");
}

async function processUser(supabase: any, profile: any, settings: any, opts: { test: boolean; force: boolean; forcedType: NudgeType | null }): Promise<any> {
  const tz = profile.timezone || "Europe/London";
  const now = nowInTz(tz);
  const nowMin = now.hour * 60 + now.minute;
  const localDate = todayLocalDate(tz);

  if (!opts.test && inQuietHours(nowMin, settings?.quiet_hours_start, settings?.quiet_hours_end)) {
    return { user_id: profile.id, skipped: "quiet_hours" };
  }

  const targets: Record<NudgeType, number | null> = {
    morning: timeStrToMinutes(settings?.morning_time ?? "09:00:00"),
    midday: timeStrToMinutes(settings?.midday_time ?? "13:30:00"),
    evening: timeStrToMinutes(settings?.evening_time ?? "20:30:00"),
    overdue: null,
  };

  const types: NudgeType[] = opts.forcedType ? [opts.forcedType] : ALL_TYPES;
  const results: any[] = [];

  // Load tasks once
  const { data: tasks } = await supabase
    .from("tasks").select("id, title, priority, due_at, status")
    .eq("user_id", profile.id).is("deleted_at", null).not("status", "in", "(done,killed)");

  for (const kind of types) {
    if (!opts.test && kind !== "overdue" && !inWindow(nowMin, targets[kind])) {
      results.push({ kind, skipped: "outside_window" }); continue;
    }
    if (!opts.test && kind === "overdue") {
      // Send overdue nudge once per day, ~1h after morning_time
      const target = (targets.morning ?? 540) + 60;
      if (!inWindow(nowMin, target)) { results.push({ kind, skipped: "outside_window" }); continue; }
    }
    const nudgeKey = `${kind}:${profile.id}:${localDate}`;
    if (!opts.force) {
      const { data: prior } = await supabase.from("nudges").select("id").eq("user_id", profile.id).eq("nudge_key", nudgeKey).maybeSingle();
      if (prior) { results.push({ kind, skipped: "duplicate" }); continue; }
    }
    if (!profile.telegram_chat_id) { results.push({ kind, skipped: "no_telegram" }); continue; }

    const message = buildMessage(kind, tasks ?? [], tz);
    if (!message) { results.push({ kind, skipped: "nothing_to_say" }); continue; }

    let delivered = false;
    if (!opts.test || opts.force) {
      delivered = await tgSend(profile.telegram_chat_id, message);
    } else {
      delivered = true; // dry run report only
    }

    await supabase.from("nudges").upsert({
      user_id: profile.id, kind, nudge_key: nudgeKey,
      sent_at: new Date().toISOString(),
      delivery_status: delivered ? "sent" : "failed",
      metadata: { test: opts.test, force: opts.force, preview: message.slice(0, 200) },
    }, { onConflict: "user_id,nudge_key" });

    results.push({ kind, delivered, preview: message });
  }
  return { user_id: profile.id, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const test = body?.test === true;
  const force = body?.force === true;
  const forcedType: NudgeType | null = ALL_TYPES.includes(body?.nudge_type) ? body.nudge_type : null;
  const userEmail = body?.user_email;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let profilesQ = supabase.from("profiles").select("id, email, timezone, telegram_chat_id, telegram_user_id").not("telegram_user_id", "is", null);
  if (userEmail) profilesQ = profilesQ.eq("email", userEmail);
  const { data: profiles, error } = await profilesQ;
  if (error) return jres(500, { success: false, error: error.message });

  const reports: any[] = [];
  for (const p of (profiles ?? [])) {
    const { data: s } = await supabase.from("settings")
      .select("morning_time, midday_time, evening_time, quiet_hours_start, quiet_hours_end")
      .eq("user_id", p.id).maybeSingle();
    reports.push(await processUser(supabase, p, s, { test, force, forcedType }));
  }

  return jres(200, { success: true, test, force, processed: reports.length, reports });
});
