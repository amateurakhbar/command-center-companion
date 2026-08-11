# Stage 1: Telegram Connection Flow (Ready to Build)

You've confirmed you revoked the leaked token via @BotFather and have a fresh one ready. On approval, I switch to Build mode and execute the steps below in order.

## Step 1: Open secure secrets form (immediate)

I'll trigger the secrets form for two values. They go straight into encrypted backend storage; never paste them in chat.

- `TELEGRAM_BOT_TOKEN`: the **new** token from @BotFather (format: `1234567890:AA...`). Not the username.
- `TELEGRAM_WEBHOOK_SECRET`: any random string. Suggested: `whk_7QJ4mP2nR8vK3xL9wT6yB1cF5sD0aZ` (or generate your own).

I'll wait for you to submit the form before continuing.

The bot username `ab_command_center_bot` is public info; I'll hardcode it in the Settings UI instructions, no secret needed.

## Step 2: Build the Edge Function

Create `supabase/functions/telegram-webhook/index.ts`:

- Public function (no JWT required; Telegram doesn't send one)
- Verifies `X-Telegram-Bot-Api-Secret-Token` header matches `TELEGRAM_WEBHOOK_SECRET`; returns 401 on mismatch
- Always returns 200 to Telegram (even on internal errors) so it doesn't retry-storm
- Uses service role key for DB writes
- Implements three commands:
  - **`/start`** → if `profiles.telegram_user_id` already set for this Telegram user → "AB Command Center is connected. Send /help for commands." Otherwise → "Generate a connection code in Settings, then send `/connect CODE`."
  - **`/help`** → lists Stage 1 commands and notes more are coming.
  - **`/connect CODE`** → looks up the code in `settings.preferences->telegram_link`, validates expiry, writes `telegram_user_id` + `telegram_chat_id` to that user's profile, clears the code, replies "Connected."
- Replies via direct Bot API call to `https://api.telegram.org/bot<TOKEN>/sendMessage` (webhook architecture, not the connector's long-polling path)

## Step 3: Build Settings UI

Edit `src/pages/Settings.tsx` to add a **Telegram** card:

- **If connected** (`profiles.telegram_user_id` is set): show "Connected" badge, the linked Telegram user/chat IDs, and a **Disconnect** button (clears both columns + any pending code).
- **If not connected**: show **Generate connection code** button.
  - Generates an 8-char code from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars).
  - Stores in `settings.preferences = { telegram_link: { code, expires_at } }` with 15-min expiry.
  - Displays the code with a copy button + countdown.
  - Shows: "Open Telegram → message **@ab_command_center_bot** → send `/connect YOURCODE`."

No bot token, webhook secret, or service role anywhere in the frontend.

## Step 4: Register the webhook with Telegram

After the function deploys, I'll register the webhook by calling Telegram's `setWebhook` once from a curl in the sandbox:

```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
{
  "url": "https://didfheewjogzulhjnmec.supabase.co/functions/v1/telegram-webhook",
  "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
  "allowed_updates": ["message"]
}
```

I'll then call `getWebhookInfo` to confirm registration and report the result back to you.

## Step 5: Walk you through testing

1. In your app → Settings → Telegram → **Generate connection code** → copy code.
2. Open Telegram → search **@ab_command_center_bot** → tap Start (sends `/start`; you should see the "generate a code" reply).
3. Send `/connect <CODE>` → should reply "Connected."
4. Send `/start` again → should reply "Connected. Send /help."
5. Send `/help` → should list Stage 1 commands.
6. Back in Settings → page should now show "Connected" with your Telegram IDs and a Disconnect button.

If anything fails I'll inspect Edge Function logs and fix.

## What's explicitly NOT in this stage

`/add`, `/today`, `/overdue`, `/done`, `/delay`, `/waiting`, `/reopen`, `raw_inputs` logging of telegram messages, date/tag parsing, short-ID resolution. All of that is **Stage 2**, which I'll plan separately after Stage 1 is verified working.

## Files touched

- **Create**: `supabase/functions/telegram-webhook/index.ts`
- **Edit**: `src/pages/Settings.tsx` (add Telegram card)
- **No DB migration**: schema already has the needed columns.

## What I need from you now

Approve this plan. On approval, my very first action will be opening the secrets form for `TELEGRAM_BOT_TOKEN` (your new token) and `TELEGRAM_WEBHOOK_SECRET`.
