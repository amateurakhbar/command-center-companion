# Phase 2 Telegram Text Capture — Staged Build

## Reality check

Phase 2 has **not** been built yet. The codebase only contains schema scaffolding from Phase 1:
- `profiles.telegram_user_id` and `profiles.telegram_chat_id` columns
- `task_source` enum includes `'telegram'`
- `raw_inputs` table with `source = 'telegram'` allowed

There is **no** Settings UI, **no** `supabase/functions/` directory, **no** `telegram-webhook`, **no** `/connect` flow, and no command handlers. Your QA pass therefore can't run yet — we need to build first, then QA.

We'll build in three stages so each one is small enough to debug end-to-end. This plan covers **Stage 1 only**. Stages 2 and 3 will be planned after Stage 1 is verified working.

---

## Before we write any code: create your Telegram bot

You'll need to do this once in the Telegram app. I can't do it for you.

1. Open Telegram and search for **@BotFather**. Start a chat.
2. Send `/newbot`.
3. BotFather asks for a **display name** — type anything (e.g. `AB Command Center`).
4. BotFather asks for a **username** — must end in `bot` and be unique (e.g. `ab_command_bot` or `abcc_yourname_bot`). If taken, try another.
5. BotFather replies with a message containing a line like:
   `Use this token to access the HTTP API: 1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   That long string **is** your bot token. Copy it.
6. (Optional but recommended) Send `/setdescription` and `/setabouttext` to BotFather to brand the bot.

When you confirm you've done this, I'll prompt you to add two secrets:
- `TELEGRAM_BOT_TOKEN` — the token from step 5
- `TELEGRAM_WEBHOOK_SECRET` — any random string you make up (I'll give you one if you want); this proves incoming webhook calls are really from Telegram

You will **never** paste these into chat or code — they're stored as backend secrets and only the Edge Function can read them.

---

## Stage 1 scope (this build)

Goal: prove the connection pipeline works. After Stage 1, you'll be able to link your Telegram account to your app account and see `/start`, `/help`, and `/connect` replies. No task commands yet.

### What gets built

**1. Edge Function: `telegram-webhook`** (`supabase/functions/telegram-webhook/index.ts`)
- Public function (`verify_jwt = false`) — Telegram has no Supabase JWT
- Validates `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`; rejects with 401 if mismatch
- Parses incoming update, extracts `chat_id`, `from.id` (telegram_user_id), `text`, `message_id`
- Handles malformed payloads safely (try/catch, returns 200 to Telegram so it doesn't retry-storm)
- Uses `SUPABASE_SERVICE_ROLE_KEY` server-side only
- Implements three commands for Stage 1:
  - `/start` — if user is connected → "AB Command Center is connected. Send /help for commands." If not → "Generate a connection code in AB Command Center Settings, then send /connect CODE."
  - `/help` — lists Stage 1 commands plus a "more coming soon" note
  - `/connect CODE` — looks up `settings.preferences->telegram_link` across all users, validates code + expiry, updates that user's `profiles.telegram_user_id` + `telegram_chat_id`, clears the code, replies "Connected. AB Command Center is ready."
- Replies to Telegram via `sendMessage` using `TELEGRAM_BOT_TOKEN` (direct Bot API, not connector — webhook-based architecture)
- Logs errors to console without leaking secrets

**2. Settings UI: Telegram section** (edit `src/pages/Settings.tsx`)
- New card: "Telegram"
- If `profiles.telegram_user_id` is set: show "Connected" with the user/chat IDs and a **Disconnect** button (clears both columns + any pending code)
- If not connected: show **Generate connection code** button
  - Generates 8-char uppercase code, stores in `settings.preferences = { telegram_link: { code, expires_at } }` with 15-min expiry
  - Displays the code prominently with copy button
  - Shows instructions: "Open Telegram, message @your_bot_username, and send `/connect CODE`"
  - Shows countdown of remaining validity
- No bot token, no webhook secret, no service role anywhere in frontend

**3. Webhook registration**
After deploy, I'll register the webhook with Telegram by calling `setWebhook` from a one-shot script (or guide you to paste a curl command — your choice). The URL will be `https://didfheewjogzulhjnmec.supabase.co/functions/v1/telegram-webhook` with the secret token header.

### Technical details

- **Code generation**: 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars). Stored as `{ code: "X7K2M4PQ", expires_at: "2026-04-28T21:00:00Z" }` in `settings.preferences.telegram_link`.
- **Connect lookup**: Edge Function queries `settings` for `preferences->'telegram_link'->>'code' = $1` and `(preferences->'telegram_link'->>'expires_at')::timestamptz > now()`. Updates `profiles` for that user_id, then clears the `telegram_link` key.
- **Disconnect**: clears `telegram_user_id`, `telegram_chat_id`, and `settings.preferences.telegram_link`.
- **No new tables / no migration needed** for Stage 1 — everything fits in existing schema.

### What's explicitly NOT in Stage 1
`/add`, `/today`, `/overdue`, `/done`, `/delay`, `/waiting`, `/reopen`, raw_inputs logging of telegram messages, tag/date parsing, short ID resolution. All of that is Stage 2.

---

## Stage 2 (next, after Stage 1 is verified)
- `raw_inputs` logging for every connected message
- `/add` with priority + category tag parsing and simple date parser (today/tomorrow/tonight/in Nh/9am/Friday) using profile timezone
- `/today` and `/overdue` with short-ID display

## Stage 3 (last)
- `/done`, `/delay`, `/waiting`, `/reopen` with short-ID lookup
- Full QA pass against your original 14-part checklist

---

## What I need from you to start Stage 1

1. Confirm you've created the bot in @BotFather and have the token ready (or say "walk me through it" and I'll wait).
2. Approve this plan.

Once approved, I'll:
1. Ask you to add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` as backend secrets.
2. Build the Edge Function and Settings UI.
3. Help you register the webhook with Telegram.
4. Walk you through testing `/start` → generate code → `/connect CODE` → `/start` again → `/help`.
