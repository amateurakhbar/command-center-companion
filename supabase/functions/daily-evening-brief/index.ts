// daily-evening-brief: send the daily PM brief with grouped tasks + .ics attachment
// Requires: RESEND_API_KEY, DAILY_BRIEF_RECIPIENT_EMAIL, DAILY_BRIEF_FROM_EMAIL
// User resolution: body.user_id > DAILY_BRIEF_USER_ID > DAILY_BRIEF_USER_EMAIL > DAILY_BRIEF_RECIPIENT_EMAIL > sole profile
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildExecutionBlockIcs, nowInTz } from "../_shared/ics.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("DAILY_BRIEF_FROM_EMAIL") ?? "";
const RECIPIENT_EMAIL = Deno.env.get("DAILY_BRIEF_RECIPIENT_EMAIL") ?? "";
const USER_EMAIL_ENV = Deno.env.get("DAILY_BRIEF_USER_EMAIL") ?? "";
const USER_ID_ENV = Deno.env.get("DAILY_BRIEF_USER_ID") ?? "";

const TZ = "Asia/Karachi";

function jres(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function resolveUser(supabase: any, body: any): Promise<{ id: string; email: string | null; tz: string } | null> {
  let id: string | null = null;
  if (body?.user_id && body?.test) id = body.user_id;
  else if (USER_ID_ENV) id = USER_ID_ENV;

  if (!id) {
    const candidates = [body?.user_email, USER_EMAIL_ENV, RECIPIENT_EMAIL].filter(Boolean);
    for (const email of candidates) {
      const { data } = await supabase.from("profiles").select("id,email,timezone").eq("email", email).maybeSingle();
      if (data) return { id: data.id, email: data.email, tz: data.timezone || TZ };
    }
    // Sole profile fallback
    const { data: all } = await supabase.from("profiles").select("id,email,timezone").limit(2);
    if (all && all.length === 1) return { id: all[0].id, email: all[0].email, tz: all[0].timezone || TZ };
    return null;
  }
  const { data } = await supabase.from("profiles").select("id,email,timezone").eq("id", id).maybeSingle();
  if (!data) return null;
  return { id: data.id, email: data.email, tz: data.timezone || TZ };
}

function isDueTodayLocal(iso: string, tz: string): boolean {
  const now = nowInTz(tz);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find(p => p.type === t)?.value;
  return parseInt(get("year")!) === now.year && parseInt(get("month")!) === now.month && parseInt(get("day")!) === now.day;
}

function groupTasks(tasks: any[], tz: string) {
  const nowMs = Date.now();
  const waiting = tasks.filter(t => t.status === "waiting");
  const active = tasks.filter(t => t.status !== "waiting");
  const overdue = active.filter(t => t.due_at && new Date(t.due_at).getTime() < nowMs);
  const today = active.filter(t => t.due_at && new Date(t.due_at).getTime() >= nowMs && isDueTodayLocal(t.due_at, tz));
  const upcoming = active.filter(t => t.due_at && new Date(t.due_at).getTime() >= nowMs && !isDueTodayLocal(t.due_at, tz));
  const noDue = active.filter(t => !t.due_at);
  return { overdue, today, upcoming, noDue, waiting };
}

function fmtDue(iso: string | null, tz: string): string {
  if (!iso) return "no due date";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso));
  } catch { return iso; }
}

function buildHtml(groups: ReturnType<typeof groupTasks>, tz: string, localDate: string): { html: string; text: string } {
  const sections: [string, any[]][] = [
    ["Overdue", groups.overdue],
    ["Due Today", groups.today],
    ["Upcoming", groups.upcoming],
    ["No Due Date", groups.noDue],
    ["Waiting", groups.waiting],
  ];
  const total = sections.reduce((s, [, a]) => s + a.length, 0);

  const htmlParts = [`<h2 style="font-family:system-ui;margin:0 0 8px">Evening Brief — ${localDate}</h2>`,
    `<p style="font-family:system-ui;color:#666;margin:0 0 16px">${total} pending task${total === 1 ? "" : "s"} · Night execution block 22:00–03:00 ${tz}</p>`];
  const textParts = [`Evening Brief — ${localDate}`, `${total} pending tasks`, ""];
  for (const [label, arr] of sections) {
    if (!arr.length) continue;
    htmlParts.push(`<h3 style="font-family:system-ui;margin:16px 0 4px">${label} (${arr.length})</h3><ul style="font-family:system-ui;padding-left:18px;margin:0">`);
    textParts.push(`${label} (${arr.length})`);
    for (const t of arr) {
      const prio = t.priority === "high" ? "High" : t.priority === "medium" ? "Med" : "Low";
      htmlParts.push(`<li style="margin:4px 0"><strong>${escapeHtml(t.title)}</strong> — ${prio}, ${fmtDue(t.due_at, tz)}</li>`);
      textParts.push(`  - ${t.title} (${prio}, ${fmtDue(t.due_at, tz)})`);
    }
    htmlParts.push(`</ul>`);
    textParts.push("");
  }
  if (total === 0) {
    htmlParts.push(`<p style="font-family:system-ui">No pending tasks. You're clear.</p>`);
    textParts.push("No pending tasks. You're clear.");
  }
  return { html: htmlParts.join(""), text: textParts.join("\n") };
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const test = body?.test === true;
  const force = body?.force === true;
  const probe = body?.probe === true;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return jres(probe ? 200 : 503, {
      success: false, configured: false, error: "email_not_configured",
      sender: FROM_EMAIL || null,
      missing: { RESEND_API_KEY: !RESEND_API_KEY, DAILY_BRIEF_FROM_EMAIL: !FROM_EMAIL },
    });
  }

  const user = await resolveUser(supabase, body);
  if (!user) {
    return jres(400, { success: false, error: "Daily brief user could not be resolved. Set DAILY_BRIEF_USER_EMAIL or DAILY_BRIEF_USER_ID." });
  }
  const recipient = body?.recipient_email || RECIPIENT_EMAIL || user.email;
  if (!recipient) return jres(400, { success: false, error: "No recipient email configured." });

  // Probe mode: report configuration only, do not send.
  if (probe) {
    return jres(200, {
      success: true, configured: true, probe: true,
      recipient, sender: FROM_EMAIL,
    });
  }


  // Check daily_email_brief_enabled (default true if configured)
  const { data: settings } = await supabase.from("settings").select("preferences").eq("user_id", user.id).maybeSingle();
  const prefs = (settings?.preferences as any) ?? {};
  const enabled = prefs.daily_email_brief_enabled !== false;
  if (!enabled && !test) {
    return jres(200, { success: false, skipped: true, reason: "daily_email_brief_disabled" });
  }

  const tz = TZ; // Pakistan time per spec
  const now = nowInTz(tz);
  const localDate = `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
  const nudgeKey = `daily_evening_brief:${user.id}:${localDate}`;

  // Duplicate prevention
  if (!force) {
    const { data: prior } = await supabase.from("nudges").select("id").eq("user_id", user.id).eq("nudge_key", nudgeKey).maybeSingle();
    if (prior) {
      return jres(200, { success: true, duplicate_skipped: true, recipient, local_date: localDate });
    }
  }

  // Fetch remaining tasks
  const { data: tasks, error: tErr } = await supabase
    .from("tasks")
    .select("id, title, priority, due_at, status, category, source")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .not("status", "in", "(done,killed)");
  if (tErr) return jres(500, { success: false, error: tErr.message });

  const groups = groupTasks(tasks ?? [], tz);
  const counts = {
    overdue: groups.overdue.length, today: groups.today.length, upcoming: groups.upcoming.length,
    no_due: groups.noDue.length, waiting: groups.waiting.length,
    total: (tasks ?? []).length,
  };

  const { html, text } = buildHtml(groups, tz, localDate);

  // Build .ics with execution block + description containing tasks
  const { ics } = buildExecutionBlockIcs({
    userId: user.id, tz, description: text,
    organizerEmail: FROM_EMAIL, attendeeEmail: recipient,
  });

  // Send via Resend
  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [recipient],
      subject: `Evening Brief — ${localDate} (${counts.total} pending)`,
      html, text,
      attachments: [{
        filename: "tonight-execution-block.ics",
        content: b64(ics),
        content_type: "text/calendar; charset=utf-8; method=REQUEST",
      }],
    }),
  });
  const sendBody = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    return jres(502, { success: false, error: "resend_error", status: sendRes.status, body: sendBody });
  }
  const messageId = sendBody?.id ?? null;

  // Log nudge for duplicate prevention
  await supabase.from("nudges").upsert({
    user_id: user.id, kind: "daily_evening_brief", nudge_key: nudgeKey,
    sent_at: new Date().toISOString(), delivery_status: "sent",
    metadata: { test, force, recipient, resend_message_id: messageId, counts, local_date: localDate },
  }, { onConflict: "user_id,nudge_key" });

  return jres(200, {
    success: true, recipient, local_date: localDate,
    counts, duplicate_skipped: false, resend_message_id: messageId, test,
  });
});
