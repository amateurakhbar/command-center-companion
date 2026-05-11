// Email a .ics export of remaining dated tasks to the logged-in user.
// Always returns HTTP 200 with a structured payload; the client decides what to render.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildIcsForTasks } from "../_shared/ics.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("DAILY_BRIEF_FROM_EMAIL") ?? "AB Command Center <onboarding@resend.dev>";

function jres(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let body: any = {};
  try { body = await req.json(); } catch { /* no body */ }

  if (body?.probe) return jres({ configured: !!RESEND_API_KEY, sender: FROM_EMAIL });

  if (!RESEND_API_KEY) {
    return jres({
      success: false,
      error: "not_configured",
      message: "Email export is not configured. Download the .ics file instead.",
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return jres({ success: false, error: "unauthorized", message: "Sign in and try again." });
  }

  let userId: string | null = null;
  let email: string | null = null;
  try {
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr) console.error("getUser error", userErr);
    userId = userData?.user?.id ?? null;
    email = userData?.user?.email ?? null;
  } catch (e) {
    console.error("auth resolve error", e);
  }
  if (!userId) return jres({ success: false, error: "unauthorized", message: "Sign in and try again." });

  const recipient = body?.recipient_email || email;
  if (!recipient) return jres({ success: false, error: "no_email", message: "No recipient email is set on your profile." });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: prof } = await admin.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = prof?.timezone || "Asia/Karachi";

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, description, priority, category, status, source, due_at, updated_at, deleted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("status", "in", "(done,killed)")
    .not("due_at", "is", null);

  if (error) {
    console.error("tasks query error", error);
    return jres({ success: false, error: "query_failed", message: "Could not load your tasks." });
  }
  if (!tasks || tasks.length === 0) {
    return jres({ success: false, error: "no_tasks", message: "No remaining dated tasks to export." });
  }

  const ics = buildIcsForTasks(tasks, { tz, calName: "AB Command Center — Remaining" });
  const b64 = btoa(unescape(encodeURIComponent(ics)));

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [recipient],
      subject: "AB Command Center: Remaining Tasks Calendar Export",
      text: "Attached is your .ics file for remaining tasks with due dates. Open it on iPhone/Mac to add to Apple Calendar.",
      attachments: [{ filename: "ab-command-center-remaining-tasks.ics", content: b64 }],
    }),
  });

  const sendBody: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const errMsg = String(sendBody?.message ?? sendBody?.error ?? "");
    const isVerification =
      r.status === 403 ||
      /verif|domain|sender|onboarding|allowed|test (mode|email)/i.test(errMsg);
    console.error("resend error", r.status, errMsg);
    return jres({
      success: false,
      error: isVerification ? "sender_or_recipient_not_verified" : "send_failed",
      message: isVerification
        ? "Resend rejected the email. onboarding@resend.dev can usually only send to the Resend account owner or verified recipient. Use the Resend account email or add a verified sending domain."
        : `Email could not be sent (Resend ${r.status}).`,
      status: r.status,
    });
  }

  return jres({ success: true, recipient, resend_message_id: sendBody?.id ?? null });
});
