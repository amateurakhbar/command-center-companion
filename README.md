# Command Center

**One dashboard for everything I would otherwise keep in six apps and my head.**

I run a lot of my working life through AI automations: briefings, task capture,
inbox triage, follow-ups. Those automations need somewhere to land. This is that
place, and the place I go to see whether they are still working.

---

## What's in it

| Surface | What it answers |
|---|---|
| **Today** | What actually needs to happen in the next few hours |
| **Tasks** | The full backlog, with capture from automated sources |
| **Overdue** | What slipped, surfaced rather than buried |
| **Remaining** | What is left in the current window |
| **Calendar** | Commitments alongside the task load, not in a separate app |
| **People** | Who I owe a reply, an intro or a follow-up |
| **Jobs** | Pipeline tracking through stages |
| **Score** | A single read on whether the week is going well |
| **Automation Health** | Whether the background jobs feeding all of the above actually ran |

**Automation Health is the page that justifies the project.** Automations fail
silently. A briefing that stops arriving looks identical to a quiet news day
until you go looking. This surfaces the difference.

---

## Stack

- **React + TypeScript + Vite**
- **shadcn/ui on Radix primitives** for the component layer, Tailwind for styling
- **Supabase** for Postgres, auth, migrations and edge functions
- **React Hook Form + Zod** for form handling and validation
- **Vitest** for tests
- Route-level auth via a `ProtectedRoute` wrapper; responsive throughout, with a
  dedicated mobile bottom nav rather than a squeezed desktop sidebar

## Running it

```bash
npm install
cp .env.example .env      # add your own Supabase project values
npm run dev
```

Supabase schema lives in `supabase/migrations`, edge functions in
`supabase/functions`.

> **Note on config:** the `VITE_`-prefixed Supabase values are publishable by
> design — Vite inlines them into the client bundle, and the Supabase
> publishable key is protected by row-level security rather than secrecy. Access
> control lives in RLS policies, not in hiding the key.

---

## Why it exists

Personal tooling is the cheapest place to learn a stack properly, because you
are your own user and you notice immediately when something is wrong. This one
also happens to be load-bearing: it is where my automations report in.
