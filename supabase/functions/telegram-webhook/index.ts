// Telegram webhook receiver — Stage 1: connection flow only
// Commands: /start, /help, /connect <CODE>
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

const HELP_TEXT = [
  "AB Command Center — Stage 1 commands:",
  "",
  "/start — show connection status",
  "/help — show this help",
  "/connect CODE — link this Telegram account to your AB Command Center account",
  "",
  "More commands (/add, /today, /done, …) are coming in Stage 2.",
].join("\n");

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // One-off self-registration helper. Must be called with the webhook secret as ?setup=<secret>.
  if (url.searchParams.get("setup") && url.searchParams.get("setup") === WEBHOOK_SECRET) {
    const webhookUrl = `${SUPABASE_URL.replace(".supabase.co", ".supabase.co")}/functions/v1/telegram-webhook`;
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    });
    const setRes = await r.json();
    const info = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`).then((x) => x.json());
    return new Response(JSON.stringify({ setWebhook: setRes, info }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  // We only handle plain messages in Stage 1
  const msg = update?.message;
  const text: string | undefined = msg?.text;
  const chatId: number | undefined = msg?.chat?.id;
  const tgUserId: number | undefined = msg?.from?.id;

  if (!msg || !text || !chatId || !tgUserId) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const trimmed = text.trim();

  try {
    // /start
    if (trimmed === "/start" || trimmed.startsWith("/start ")) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("telegram_user_id", tgUserId)
        .maybeSingle();
      if (existing) {
        await tgSend(
          chatId,
          `AB Command Center is connected${existing.display_name ? ` to ${existing.display_name}` : ""}. Send /help for commands.`
        );
      } else {
        await tgSend(
          chatId,
          "Welcome to AB Command Center.\n\nThis Telegram account is not linked yet.\n\n1. Open the app → Settings → Telegram\n2. Tap “Generate connection code”\n3. Send me: /connect YOURCODE"
        );
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // /help
    if (trimmed === "/help" || trimmed.startsWith("/help ")) {
      await tgSend(chatId, HELP_TEXT);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // /connect CODE
    if (trimmed.startsWith("/connect")) {
      const parts = trimmed.split(/\s+/);
      const code = (parts[1] ?? "").toUpperCase();
      if (!code) {
        await tgSend(chatId, "Usage: /connect YOURCODE\n\nGenerate the code in the app → Settings → Telegram.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      // If this Telegram user is already linked, short-circuit
      const { data: alreadyLinked } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_user_id", tgUserId)
        .maybeSingle();
      if (alreadyLinked) {
        await tgSend(chatId, "This Telegram account is already connected. Send /help for commands.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      // Find a settings row with a matching, unexpired code
      const { data: matches, error: matchErr } = await supabase
        .from("settings")
        .select("user_id, preferences");
      if (matchErr) {
        console.error("settings query error", matchErr);
        await tgSend(chatId, "Something went wrong. Please try again in a moment.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      const now = Date.now();
      const match = (matches ?? []).find((row: any) => {
        const link = row?.preferences?.telegram_link;
        if (!link?.code || !link?.expires_at) return false;
        const exp = new Date(link.expires_at).getTime();
        return link.code === code && exp > now;
      });

      if (!match) {
        await tgSend(chatId, "That code is invalid or expired. Generate a new one in the app and try again.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      const userId = match.user_id;

      // Make sure no other profile holds this telegram_user_id (unique-ish guard)
      const { data: takenBy } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_user_id", tgUserId)
        .maybeSingle();
      if (takenBy && takenBy.id !== userId) {
        await tgSend(chatId, "This Telegram account is already linked to another user.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      // Write profile link
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ telegram_user_id: tgUserId, telegram_chat_id: chatId })
        .eq("id", userId);
      if (profErr) {
        console.error("profile update error", profErr);
        await tgSend(chatId, "Could not save the link. Please try again.");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      // Clear the used code
      const newPrefs = { ...(match as any).preferences };
      delete newPrefs.telegram_link;
      await supabase.from("settings").update({ preferences: newPrefs }).eq("user_id", userId);

      await tgSend(chatId, "Connected. Send /help to see what I can do.");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Unknown command in Stage 1 — gentle reply only if it looks like a command
    if (trimmed.startsWith("/")) {
      await tgSend(chatId, "Unknown command. Send /help.");
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("telegram-webhook error", e);
    // Always 200 so Telegram doesn't retry-storm
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
