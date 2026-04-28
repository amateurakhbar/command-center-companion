## Phase 1B QA pass

Static + parser-level checks ran clean on most criteria. Three real defects against the spec, plus one missing capability.

### Pass / fail per criterion

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Quick-add creates tasks | Pass — `useTaskMutations.create` writes `user_id` and parsed fields. |
| 2 | Regex hints (`!high/!med/!medium/!low`, `#job/#networking/#followup/#meeting/#interview/#admin/#personal`) | Pass — verified all 7 sample inputs parse correctly. |
| 3 | Today sections (Do Now / Due Today / Overdue / Waiting) | Pass — filters and dedup match the patch. |
| 4 | Waiting tasks only in Waiting section | Pass — Due Today excludes `status = waiting`; Do Now requires `in_progress`; Overdue excludes done/killed only, but waiting tasks have no overdue path because they appear in Waiting and we should also exclude them from Overdue. **Minor risk** — see Bug D. |
| 5 | Overdue page shows only active overdue | Mostly pass — filters `status NOT IN (done, killed)`; same Bug D risk: a `waiting` task with a past due_at would show up here. |
| 6 | Done sets `status=done` and `completed_at` | Pass. |
| 7 | Delay updates `due_at`, `snoozed_until`, `delay_count`, `last_delayed_at` | Pass. |
| 8 | Kill requires a reason | **FAIL — Bug A.** Dropdown calls `actions.kill(task)` with no reason. Drawer also lets `status=killed` save with no reason. |
| 9 | Break down creates child with `parent_task_id` | Pass. |
| 10 | Reopen clears `completed_at`, `killed_at`, `killed_reason`, **and `deleted_at` where needed** | **Partial FAIL — Bug B.** Reopen does not clear `deleted_at`. |
| 11 | Undo for done/delay/kill/waiting/soft-delete | Pass on done/delay/waiting/soft-delete. Kill undo will work once Bug A fix routes through the same toast helper. |
| 12 | Deleted tasks viewable + recoverable | **FAIL — Bug C.** `useTasks()` filters `deleted_at IS NULL`; no Trash UI exists. |
| 13 | Mobile 375px no horizontal scroll | Will verify in browser after fixes. |
| 14 | No out-of-scope modules built | Pass — Jobs/People/Score still scaffolds; no Telegram/AI/reminders/voice/Gmail/Calendar/scraping/swipe/keyboard shortcuts. |

### Bugs

- **Bug A — Kill has no reason prompt.** Spec criterion 8.
- **Bug B — Reopen does not clear `deleted_at`.** Spec criterion 10.
- **Bug C — No Trash view.** Spec criterion 12. Soft-deleted tasks are invisible and unrecoverable.
- **Bug D — Waiting tasks with past `due_at` leak into Overdue section + Overdue page.** Spec criterion 4 says waiting tasks should only appear in the Waiting accordion on Today; criterion 5 says Overdue page shows "only active overdue tasks" — `waiting` is not active. Easy filter tightening.
- **Bug E (minor) — Drawer can set `status = killed` without a reason.** Same root cause as Bug A. Will reuse the same dialog flow.

### Fix plan

1. **Add `KillTaskDialog`** (`src/components/tasks/KillTaskDialog.tsx`) — required-text textarea, calls `useTaskMutations.kill(task, reason)`, fires the same Undo toast.
2. **Wire kill through the dialog**:
   - `TaskRowItem` — replace inline `actions.kill(task)` with opening the dialog (lift state to a parent or local).
   - `Today.tsx`, `Tasks.tsx`, `Overdue.tsx` — manage one `killTask` state alongside `breakDownTask` and render `<KillTaskDialog>`.
   - `TaskDrawer` — when user changes status to `killed` in the drawer, route through the same dialog instead of saving silently. If the task already has a `killed_reason`, allow re-saving without prompting.
3. **Fix Reopen to also clear `deleted_at`**: update `useTaskMutations.reopen` patch to include `deleted_at: null`. Snapshot already captured for undo correctness — extend snapshot to include `deleted_at` too.
4. **Tighten Today's Overdue + Overdue page filter** to also exclude `status = waiting` (Bug D). Waiting tasks already render in the Waiting section regardless of due_at.
5. **Add a Trash view** without inflating scope:
   - New hook `useDeletedTasks()` (read-only query with `.not("deleted_at", "is", null)`).
   - New component `<TrashSheet>` (sheet from the right) listing deleted tasks with a "Restore" button per row that calls `update({ deleted_at: null })` and triggers the existing query invalidation. Restore toast confirms.
   - Trigger: a small "Trash (n)" link/button at the bottom of the **Settings** page (cheapest place; avoids new sidebar entry, stays within Phase 1B scope).
6. Verify in the browser at desktop and 375px mobile after fixes (criterion 13).

### Out of scope (do NOT touch)

Jobs UI, People UI, Score, Telegram, AI parser, reminders, voice, Gmail, Calendar, scraping, swipe gestures, keyboard shortcuts, bulk delay/kill/category, job/person linking UI.

### Files touched

- `src/hooks/useTasks.ts` — extend `reopen` patch + snapshot to include `deleted_at`; add `useDeletedTasks()` query.
- `src/components/tasks/KillTaskDialog.tsx` — new.
- `src/components/tasks/TrashSheet.tsx` — new.
- `src/components/tasks/TaskRowItem.tsx` — kill menu item now calls `onKill?(task)` (callback prop) instead of `actions.kill`.
- `src/components/tasks/TaskDrawer.tsx` — if status changes to `killed`, defer save and surface kill dialog (or require reason inline before save).
- `src/pages/Today.tsx`, `src/pages/Tasks.tsx`, `src/pages/Overdue.tsx` — render `<KillTaskDialog>`, wire `onKill`. Tighten `status !== "waiting"` in Overdue filters.
- `src/pages/Settings.tsx` — add "Trash" trigger that opens `<TrashSheet>`.

### After fixes

I'll launch the preview at desktop + 375px to confirm:
- Quick-add + parser
- Section dedup
- Kill flow blocks empty reason
- Soft-delete then restore from Trash
- Reopen on a deleted+done task brings it back live
- No horizontal scroll at 375px

Then I'll report the final summary (bugs found, fixed, anything still broken, Phase 1C readiness).
