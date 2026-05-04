// Email an Apple Calendar-compatible .ics of remaining dated tasks to the logged-in user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}
function escIcs(s: string) { return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function buildIcs(tasks: any[], tz: string): string {
  const dtstamp = toIcsUtc(new Date().toISOString());
  const events = tasks.map((t) => {
    const start = new Date(t.due_at);
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
      `UID:${t.id}@ab-command-center`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(start.toISOString())}`,
      `DTEND:${toIcsUtc(end.toISOString())}`,
      `SUMMARY:${escIcs(t.title)}`,
      `DESCRIPTION:${desc}`,
      `LAST-MODIFIED:${toIcsUtc(t.updated_at ?? t.due_at)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//AB Command Center//Remaining//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:AB Command Center — Remaining",
    `X-WR-TIMEZONE:${tz}`, ...events, "END:VCALENDAR",
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Probe mode: report whether the email export is configured without sending.
  let body: any = {};
  try { body = await req.clone().json(); } catch { /* no body */ }
  if (body?.probe) return json(200, { configured: !!RESEND_API_KEY });

  if (!RESEND_API_KEY) return json(200, { error: "not_configured" });

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: ce } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
  if (ce || !claims?.claims?.sub) return json(401, { error: "unauthorized" });
  const userId = claims.claims.sub as string;
  const email = claims.claims.email as string | undefined;
  if (!email) return json(400, { error: "no_email" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: prof } = await admin.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = prof?.timezone || "Europe/London";

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, description, priority, category, status, source, due_at, updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("status", "in", "(done,killed)")
    .not("due_at", "is", null);
  if (error) return json(500, { error: error.message });
  if (!tasks || tasks.length === 0) return json(200, { error: "no_tasks" });

  const ics = buildIcs(tasks, tz);
  const b64 = btoa(unescape(encodeURIComponent(ics)));

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "AB Command Center <onboarding@resend.dev>",
      to: [email],
      subject: "AB Command Center: Remaining Tasks Calendar Export",
      text: "Attached is your Apple Calendar-compatible .ics file for remaining tasks with due dates.",
      attachments: [{ filename: "ab-command-center-remaining-tasks.ics", content: b64 }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("resend error", r.status, t);
    return json(500, { error: "send_failed" });
  }
  return json(200, { ok: true });
});
