# AB Command Center — Phased MVP Plan

Ship a working manual dashboard first. Layer in Telegram, AI, reminders, and voice only after each prior phase is genuinely useful.

---

## Phase 1 — Manual Dashboard & Database

The whole app, minus automation. If this phase is good enough, you'd already use it daily.

**Build**
- Auth: single user, email/password (Supabase Auth).
- Tables (with RLS):
  - `tasks` — `id, user_id, title, notes, category ('job'|'networking'|'meeting'|'prep'|'general'), status ('open'|'done'|'delayed'|'killed'|'broken_down'), priority, due_at, parent_task_id, company, person_name, link, created_at, completed_at`
  - `job_applications` — `id, user_id, company, role, location, link, status ('saved'|'applied'|'interviewing'|'offer'|'closed'), applied_at, notes`
  - `people` — `id, user_id, name, role, company, channel, handle, last_contact_at, next_followup_at, notes`
- Pages:
  1. **Today** — today's + overdue tasks, grouped by category, quick-add input.
  2. **All Tasks** — filter by status/category/due.
  3. **Jobs** — simple table of applications with status dropdown.
  4. **People** — contacts with "last contact" and "next follow-up" fields.
  5. **Settings** — profile, timezone (stored for later phases).
- Task actions: Done, Delay (pick new date), Kill, Break down (creates child tasks via a small modal).
- Quick-add form: title + category + optional due date.

**Don't build yet**
- Telegram, AI parsing, reminders, daily briefing, kanban, analytics, multi-user, mobile app, notifications of any kind.

**Why it matters**
- Forces the data model to be real before automation.
- Gives you immediate value even if every later phase slips.
- Every later phase just writes into these same tables.

**Success looks like**
- You manually log a day's tasks, jobs, and contacts in under 5 minutes.
- You actually open the dashboard the next morning and work from it.

---

## Phase 2 — Telegram Text Capture

Get messages from your phone into the system. No AI yet — text becomes a task with the message as the title.

**Build**
- Connect Telegram connector.
- `telegram-poll` edge function + pg_cron (every minute, 55s long-poll).
- `telegram_bot_state` + `raw_messages` tables.
- Allowlist: only your `chat_id` (set in Settings).
- Each new message → insert one task with `title = message text`, `category = 'general'`, `status = 'open'`.
- Bot replies: "Captured ✅ — edit in dashboard."
- Inbox page in dashboard: raw messages + linked task, with an "edit task" shortcut.

**Don't build yet**
- AI parsing, multi-task extraction, inline buttons, callbacks, rich replies, voice notes.

**Why it matters**
- Removes the friction of opening the dashboard to capture.
- Proves the Telegram pipeline end-to-end before adding AI on top.

**Success looks like**
- You message the bot from anywhere; the task shows up in Today within ~1 minute.
- Zero capture friction during the day.

---

## Phase 3 — AI Task Parser

Turn messy text into structured tasks.

**Build**
- `parse-message` edge function called after each `raw_messages` insert.
- Lovable AI Gateway, `google/gemini-3-flash-preview`, tool-calling schema returning 1+ tasks: `title, category, priority, due_at, company, person_name`.
- System prompt resolves relative dates ("tomorrow morning") using user timezone.
- Bot reply summarizes the parsed task(s) and includes inline buttons: Confirm / Cancel.
- Inbox page shows raw → parsed mapping with a "reparse" button.

**Don't build yet**
- Reminders, escalation, daily briefing, voice, multi-turn clarifications.

**Why it matters**
- One sentence → multiple correctly-categorized tasks with due dates.
- This is the core "magic" of the product.

**Success looks like**
- "Follow up with Hamza tomorrow morning about Ektis and apply to IQVIA Riyadh by Friday" creates 2 tasks, correct categories, correct dates, on the first try ≥80% of the time.

---

## Phase 4 — Reminder Engine

Stop letting things drop.

**Build**
- `next_nudge_at` + `snooze_count` columns on `tasks`.
- `send-nudges` edge function + pg_cron every 5 minutes.
- Cadence: due−24h, due−2h, then every 6h overdue, max 4 nudges → auto-flag "stale".
- Quiet hours from Settings.
- Telegram nudge with inline buttons: Done / Snooze 1h / Snooze tomorrow / Kill / Break down.
- Daily briefing at user's chosen time: today's focus + overdue count.

**Don't build yet**
- Voice, email/calendar ingestion, smart prioritization beyond simple rules, web push.

**Why it matters**
- Without nudges, tasks rot. This is what turns the app into a true "command center".

**Success looks like**
- You routinely close tasks straight from Telegram nudges.
- Overdue count trends down week over week.

---

## Phase 5 — Voice Notes & Advanced Integrations

Capture without typing; pull in external context.

**Build (pick what you actually need)**
- Telegram voice notes → download via gateway → transcribe (Whisper or Gemini audio) → feed into Phase 3 parser.
- Optional: Google Calendar connector to auto-create "prep" tasks before meetings.
- Optional: Gmail connector to detect recruiter emails and create follow-up tasks.
- Optional: weekly review summary (AI-generated).

**Don't build yet**
- Anything not directly making capture or follow-through easier.
- Mobile app, multi-user, public sharing.

**Why it matters**
- Voice is the lowest-friction capture mode.
- Calendar/Gmail close the loop on inputs you don't manually type.

**Success looks like**
- You can dump a 30-second voice memo after a call and get clean tasks with the right person/company tagged.

---

## Cross-phase rules

- Each phase ships independently and is usable on its own.
- No phase blocks on the next; if Phase 3 is delayed, Phase 2 still works (raw text → task).
- Same `tasks` table throughout — later phases only add columns and writers, never restructure.
- Always single-user, allowlisted, until explicitly outgrown.
