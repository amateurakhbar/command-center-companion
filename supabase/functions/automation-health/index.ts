// automation-health: returns safe operational status for the logged-in user.
// Does not send emails or Telegram messages. Read-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildExecutionBlockIcs, nowInTz } from "../_shared/ics.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("DAILY_BRIEF_FROM_EMAIL") ?? "";
const RECIPIENT_EMAIL = Deno.env.get("DAILY_BRIEF_RECIPIENT_EMAIL") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const TZ_DEFAULT = "Asia/Karachi";

function jres(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {};
  try { body = await req.json(); } catch { /* allow GET */ }
  const action = body?.action ?? "report";

  // Auth user via JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: ures } = await userClient.auth.getUser();
  const user = ures?.user;
  if (!user) return jres(401, { success: false, error: "unauthorized" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (action === "ics_preview") {
    return await icsPreview(admin, user.id);
  }

  // Default: full report
  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin.from("profiles").select("id,email,timezone,telegram_user_id,telegram_chat_id").eq("id", user.id).maybeSingle(),
    admin.from("settings").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const prefs = (settings?.preferences as any) ?? {};
  const tz = profile?.timezone || TZ_DEFAULT;

  // Recent nudges (this user only)
  const { data: nudges } = await admin
    .from("nudges")
    .select("id,kind,nudge_key,sent_at,delivery_status,metadata")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(40);

  const nudgeList = nudges ?? [];
  const byKind = (k: string) => nudgeList.find(n => n.kind === k) ?? null;
  const dailyBriefs = nudgeList.filter(n => n.kind === "daily_evening_brief").slice(0, 10);
  const tgNudges = nudgeList.filter(n => ["morning", "midday", "evening", "overdue"].includes(n.kind ?? "")).slice(0, 20);
  const failures = nudgeList.filter(n => n.delivery_status && n.delivery_status !== "sent").slice(0, 10);

  // Raw inputs counts
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: rawInputs } = await admin
    .from("raw_inputs")
    .select("source,created_at,parser_version")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  const rawSummary: Record<string, { count: number; latest: string | null }> = {};
  for (const r of rawInputs ?? []) {
    const key = r.parser_version || r.source || "unknown";
    if (!rawSummary[key]) rawSummary[key] = { count: 0, latest: null };
    rawSummary[key].count++;
    if (!rawSummary[key].latest || r.created_at > rawSummary[key].latest!) rawSummary[key].latest = r.created_at;
  }

  // Cron status (best-effort; service role likely cannot read cron schema)
  let cronStatus: any = { available: false, reason: "cron tables not accessible", jobs: [] };
  try {
    const { data, error } = await admin.rpc("cron_health_summary" as any);
    if (!error && data) cronStatus = data;
  } catch { /* ignore */ }

  // Provider status (no secret values)
  const providers = {
    resend: {
      configured: Boolean(RESEND_API_KEY && FROM_EMAIL),
      sender: FROM_EMAIL || null,
      recipient: RECIPIENT_EMAIL || null,
    },
    lovable_ai: { configured: Boolean(LOVABLE_API_KEY) },
    telegram_bot: { configured: Boolean(BOT_TOKEN) },
  };

  const connection = {
    user_id: user.id,
    email: profile?.email ?? user.email ?? null,
    timezone: tz,
    telegram_connected: Boolean(profile?.telegram_chat_id),
    telegram_chat_id_present: Boolean(profile?.telegram_chat_id),
  };

  const settingsView = {
    daily_email_brief_enabled: prefs.daily_email_brief_enabled !== false,
    telegram_nudges_enabled: prefs.telegram_nudges_enabled === true,
    morning_brief_enabled: prefs.morning_brief_enabled !== false,
    midday_check_enabled: prefs.midday_check_enabled !== false,
    evening_closeout_enabled: prefs.evening_closeout_enabled !== false,
    overdue_escalation_enabled: prefs.overdue_escalation_enabled !== false,
    draft_assistant_enabled: prefs.draft_assistant_enabled !== false,
    ai_parser_enabled: prefs.ai_parser_enabled !== false,
    morning_time: settings?.morning_time ?? null,
    midday_time: settings?.midday_time ?? null,
    evening_time: settings?.evening_time ?? null,
    quiet_hours_start: settings?.quiet_hours_start ?? null,
    quiet_hours_end: settings?.quiet_hours_end ?? null,
  };

  // Overall health rules
  const warnings: string[] = [];
  const criticals: string[] = [];
  if (!providers.resend.configured) warnings.push("Resend not configured");
  if (!connection.telegram_connected) warnings.push("Telegram not connected");
  if (!settingsView.daily_email_brief_enabled) warnings.push("Daily email brief disabled");
  if (!settingsView.telegram_nudges_enabled) warnings.push("Telegram nudges disabled");
  if (failures.length >= 3) criticals.push("Repeated automation failures");
  if (!cronStatus.available) warnings.push("Cron status unavailable");

  const overall = criticals.length ? "critical" : warnings.length ? "warning" : "healthy";

  return jres(200, {
    success: true,
    overall, warnings, criticals,
    connection, settings: settingsView, providers,
    cron: cronStatus,
    recent: {
      daily_briefs: dailyBriefs,
      telegram_nudges: tgNudges,
      failures,
      last_by_kind: {
        daily_evening_brief: byKind("daily_evening_brief"),
        morning: byKind("morning"),
        midday: byKind("midday"),
        evening: byKind("evening"),
        overdue: byKind("overdue"),
      },
    },
    raw_inputs_7d: rawSummary,
    night_block: { tz, start: "22:00", end: "03:00" },
    expected_cron: [
      { name: "scheduled-nudges-hourly", schedule: "0 * * * *" },
      { name: "daily-evening-brief-1700-pkt", schedule: "0 12 * * *" },
    ],
  });
});

async function icsPreview(admin: any, userId: string) {
  const { data: profile } = await admin.from("profiles").select("timezone,email").eq("id", userId).maybeSingle();
  const tz = profile?.timezone || TZ_DEFAULT;
  const { data: tasks } = await admin
    .from("tasks").select("id,title,priority,due_at,status")
    .eq("user_id", userId).is("deleted_at", null)
    .not("status", "in", "(done,killed)").limit(50);
  const list = tasks ?? [];
  const desc = list.length
    ? list.map((t: any) => `- ${t.title}`).join("\n")
    : "No pending tasks.";
  const { ics, localDate, uid } = buildExecutionBlockIcs({
    userId, tz, description: desc,
    organizerEmail: FROM_EMAIL || undefined,
    attendeeEmail: profile?.email || undefined,
  });
  const now = nowInTz(tz);
  return jres(200, {
    success: true, tz, local_date: localDate, uid,
    summary: "AB Command Center: Night Execution Block",
    start_local: "22:00", end_local: "03:00 (next day)",
    task_count: list.length,
    now_local: `${now.year}-${String(now.month).padStart(2,"0")}-${String(now.day).padStart(2,"0")} ${String(now.hour).padStart(2,"0")}:${String(now.minute).padStart(2,"0")}`,
    ics_base64: btoa(unescape(encodeURIComponent(ics))),
  });
}
