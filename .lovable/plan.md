# AB Command Center — UX Specification

A personal operating system for execution. Dark, executive, mobile-first. No confetti, no streak emojis, no playful illustrations. Density and speed over decoration.

---

## Global Design Language

- **Theme**: Near-black background (`#0A0B0D`), surface (`#14161A`), 1px hairline borders (`#23262C`). High-contrast off-white text. Single accent (cool electric blue or amber) used sparingly for primary action and "due today".
- **Typography**: Display = a precise grotesk (e.g. Space Grotesk / Sora). Body = neutral sans (Inter Tight / Geist). Monospace for numbers and timestamps.
- **Status colors** (muted, not neon): open=neutral, due-today=accent, overdue=red, done=dim green, delayed=amber, killed=gray strikethrough, drafted=violet.
- **Density**: Tight rows on desktop, comfortable taps on mobile (48px min touch). No card shadows; rely on hairlines.
- **Motion**: 120ms fades and slides only. No bounces. No celebratory animation.
- **Numbers everywhere**: counts in headers, last-touched timestamps on rows, "x days idle" badges.

**Global shell**
- Top bar: page title (left), global quick-add (`+` opens a one-line input from anywhere, `⌘K`), date/timezone (right).
- Bottom nav on mobile: Today · Tasks · Jobs · People · More. Sidebar on desktop with same items + Meetings, Overdue, Score, Settings.
- Quick-add accepts free text now; later it routes through the AI parser.

---

## 1. Today

**Purpose** — The single screen you open in the morning and live in all day. What's on fire, what's next, what to ignore.

**Sections**
1. **Header strip** — Date, day of week, 3 stat tiles: `Open today`, `Overdue`, `Done today`.
2. **Now** — Top 3 tasks for the day (manual pin or earliest due). Large rows, primary action visible.
3. **Today's tasks** — Grouped collapsible sections: Jobs · Networking · Meetings · Prep · General. Count beside each header.
4. **Coming up** — Next 48h preview, collapsed by default.
5. **Quick capture** — Persistent input pinned to bottom of content area.

**Data per row** — title · category icon · due time · company/person chip · idle days (if applicable).

**Actions** — Done · Delay (popover: +1h, tonight, tomorrow, pick) · Kill · Break down · Open detail.

**Filters** — Category chips (toggle on/off). No other filters here; this is the focused view.

**Mobile** — Single column. Stat tiles become a horizontal scroll strip. Row swipe: left = Done, right = Delay. Long-press = full action sheet.

---

## 2. Tasks

**Purpose** — The full backlog. Search, slice, bulk-act.

**Sections**
1. **Filter bar** — Status · Category · Due range · Company · Person · Has-link · text search.
2. **Saved views** (chips) — Open, This week, Overdue, Stale (>7d idle), Killed, Done.
3. **Table/list**

**Columns (desktop)** — Title · Category · Status · Due · Company · Person · Updated.
**Mobile row** — Title (line 1) + meta row (category · due · status pill).

**Actions** — Single: Done/Delay/Kill/Break down/Edit. Bulk: select-all in current filter, then change status or category.

**Filters** — Multi-select chips, persisted per session. Sort: due asc (default), recently updated, idle longest.

**Mobile** — List view only, sticky filter bar collapses to a single "Filters (3)" button opening a sheet. Swipe actions identical to Today.

---

## 3. Job Pipeline

**Purpose** — See every role you're chasing and what state it's in.

**Sections**
1. **Pipeline stats** — Saved · Applied · Interviewing · Offer · Closed (counts + this-week deltas).
2. **Pipeline view** — Kanban on desktop (5 columns), vertical stacked sections on mobile.
3. **Stale shelf** — Applications with no movement in 14+ days, surfaced at top.
4. **Detail drawer** — Right-side drawer when a card is tapped: company, role, location, link, applied_at, notes, related tasks (auto-linked by company).

**Card data** — Company · Role · Location · Days since last update · Next task chip (if any).

**Actions** — Move stage (drag on desktop, dropdown on mobile) · Add follow-up task · Mark closed (with reason: rejected/withdrew/ghosted/accepted) · Open link.

**Filters** — Stage · Location · Source · Date range. Search: company/role.

**Mobile** — Stage tabs across the top, swipe between stages. Cards full-width. "Add application" FAB bottom-right.

---

## 4. Networking Pipeline

**Purpose** — Don't let people go cold.

**Sections**
1. **Health stats** — Contacts touched this week · Overdue follow-ups · New contacts this month.
2. **Needs follow-up** — People where `next_followup_at <= today` or no contact in 30+ days. Sorted by most overdue.
3. **All people** — Compact list with last-touch and next-follow-up.
4. **Detail drawer** — Name, role, company, channel + handle, notes, contact history (timeline of related tasks/messages), set next follow-up.

**Row data** — Name · Role @ Company · Last contact (relative: "12d ago") · Next follow-up · Channel icon.

**Actions** — Mark contacted (sets last_contact_at = now, prompts for next follow-up date) · Snooze · Create follow-up task · Edit · Archive.

**Filters** — Channel · Company · Status (active/cold/archived) · search by name.

**Mobile** — Same layout, drawer becomes full-screen sheet. Primary CTA per row: "Mark contacted".

---

## 5. Meetings

**Purpose** — Prep before, capture after.

**Sections**
1. **Today's meetings** — Time-ordered list with prep status indicator.
2. **Upcoming (next 7 days)** — Grouped by day.
3. **Needs prep** — Meetings <24h away with no prep tasks linked.
4. **Recent (last 7 days)** — For follow-up logging.
5. **Detail view** — Time, attendees (linked to People), agenda notes, prep checklist (child tasks), post-meeting notes, "create follow-up" button.

**Row data** — Time · Title · Attendee chips · Prep status (none / partial / ready) · Post-meeting note status.

**Actions** — Add prep item (creates child task) · Mark prepped · Log notes · Generate follow-up tasks (manual now, AI later) · Reschedule · Cancel.

**Filters** — Date range · Attendee · Has-prep · Has-notes.

**Mobile** — Day-grouped list. Tap opens full-screen detail with tabs: Prep · Notes · Follow-ups.

---

## 6. Overdue

**Purpose** — A blunt accountability screen. Everything you're behind on, ranked by how badly.

**Sections**
1. **Counters** — Total overdue · Overdue >7d · Stale (no action 14d+).
2. **Triage list** — Sorted by days overdue desc. Each row shows the cost of inaction inline.
3. **Bulk decision bar** — Sticky bottom bar appears when items selected: Done · Delay all · Kill all · Reassign date.

**Row data** — Title · Days overdue (large, red) · Category · Last touched · Quick actions inline.

**Actions** — For each: Done · Delay (with required new date) · Kill (with one-tap reason) · Break down · Convert to "someday" (status=delayed, no date).

**Filters** — Category · Days overdue bucket (1-3 / 4-7 / 8-14 / 15+) · Has-due-date vs no-date.

**Mobile** — Same list, swipe-left = Kill (confirm), swipe-right = Delay sheet. Bulk select via long-press.

**UX intent** — This page should feel uncomfortable on purpose. No empty-state cheerleading; if empty, just: "Nothing overdue."

---

## 7. Execution Score

**Purpose** — One honest number that reflects whether you're actually executing. Not a game — a mirror.

**Score model (simple, transparent)**
- Daily score = `done_today / (done_today + overdue_added_today + ignored_nudges_today)`, expressed 0–100.
- Weekly score = trailing 7-day average.
- Shown as a number, not a badge.

**Sections**
1. **Headline** — Today's score, week score, 4-week trend (sparkline).
2. **Breakdown** — Tasks closed · Tasks killed · Tasks delayed · Tasks stale · Avg time-to-close.
3. **By category** — Same metrics split across Jobs / Networking / Meetings / Prep.
4. **Patterns** — "You close 70% of Job tasks but only 30% of Networking." Plain text insights, no graphics needed in v1.
5. **History** — 30-day calendar heatmap of done counts (one muted color, opacity by intensity — no rainbow).

**Data shown** — Numbers and a single sparkline. No badges, levels, streaks, or trophies. A subtle "current streak: 4 days closing ≥3 tasks" line is the only streak concept allowed.

**Actions** — Drill into any metric → filtered Tasks view. Toggle period: 7d / 30d / 90d.

**Filters** — Period · Category.

**Mobile** — Score and sparkline above fold. Breakdown stacks. Heatmap horizontally scrollable.

---

## 8. Settings

**Purpose** — Configure the system. Boring on purpose.

**Sections**
1. **Profile** — Name, email, timezone.
2. **Telegram** (placeholder until Phase 2) — Connect bot, paste/verify chat_id, test message button.
3. **Notifications & Quiet hours** (Phase 4) — Daily briefing time, quiet hours start/end, max nudges per task.
4. **Categories** — Rename or reorder the 5 fixed categories (no add/remove in v1).
5. **Defaults** — Default due time, default priority, week start day.
6. **Data** — Export CSV (tasks, jobs, people), wipe completed >90d.
7. **Appearance** — Accent color (small swatch picker), density (comfortable/compact).
8. **About** — Version, build, signed-in account, sign out.

**Actions** — Save inline per section (no global Save button). Destructive actions require typed confirmation.

**Mobile** — Single-column list of sections, each opens a sub-screen. No accordions on mobile.

---

## Cross-cutting UX rules

- **One quick-add everywhere** — `⌘K` on desktop, persistent bottom input on mobile. Same field, same parser later.
- **Empty states are blunt** — "No tasks." Not "🎉 You're all caught up!"
- **No modals for routine actions** — Use bottom sheets on mobile, popovers on desktop. Modals only for destructive confirms.
- **Optimistic updates** — Status changes apply instantly; revert quietly on failure with a single toast.
- **Keyboard first on desktop** — `J/K` navigate rows, `D` done, `X` kill, `S` snooze, `E` edit, `/` search.
- **No dashboards-of-dashboards** — Today is the home. Score is a check-in, not a destination.
- **Time is always explicit** — Show absolute date on hover/tap; show relative ("3d") in row.
- **No notification dots in nav** — Use the Overdue counter on the Overdue tab only.
