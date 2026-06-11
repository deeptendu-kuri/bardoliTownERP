# CLAUDE.md — Studio OS

> Operating manual for Claude Code on this repository. Read this first, every session.
> This file is the single source of truth for *how we work*. The `docs/` folder is the
> source of truth for *what we build*. The `.claude/skills/` folder holds reusable
> playbooks for recurring tasks.

---

## 1. What we are building

**Studio OS** is a role-based ERP (internal tool) that replaces the spreadsheet a ~10-person
video-production studio currently runs on. It manages the full pipeline:

`Lead → Confirm/Assign → Shoot → Edit → Client Review → Upload`

with a revision loop, live team occupancy, an AI assignment assistant, in-app + WhatsApp
notifications, and one-click Excel export. There are three roles: **CEO (super admin)**,
**Admin (control desk)**, **Staff/Freelancer (executors)**.

The product is described in full in `docs/01-product-requirements.md`. Do not invent scope —
if a feature is not in the PRD or the build roadmap, ask the human before building it.

---

## 2. Locked technical stack

Do **not** swap any of these without explicit human approval (it cascades into every doc).

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere (strict mode) |
| Frontend | React 18 + Vite + React Router + Tailwind CSS |
| Data layer | TanStack Query (server cache) + Zustand (light UI state) |
| Forms/validation | react-hook-form + zod |
| Backend | Supabase — Postgres 15, Auth, Realtime, Storage, Edge Functions (Deno) |
| Auth & RBAC | Supabase Auth + Postgres Row-Level Security (RLS) |
| AI | Anthropic Claude API, called **only** from a Supabase Edge Function |
| Notifications | In-app (table + Realtime) + WhatsApp via Edge Function (see doc 08) |
| Excel export | SheetJS (`xlsx`) |
| Mobile | Capacitor wraps the same web build for iOS/Android (Phase 3) |
| Testing | Vitest + React Testing Library (unit/component), Playwright (e2e), SQL harness (RLS) |
| CI | GitHub Actions |

Claude model strings (verify at https://docs.claude.com/en/docs/about-claude/models before
shipping): suggestions use `claude-haiku-4-5-20251001` (cheap, fast); the weekly summary uses
`claude-sonnet-4-6`. The API key lives **only** in Edge Function secrets, never in the client.

---

## 3. Repository layout (target)

```
studio-os/
├── CLAUDE.md                      # this file
├── docs/                          # requirements & design — READ BEFORE CODING
├── .claude/skills/                # reusable task playbooks
├── apps/web/                      # React + Vite frontend
│   ├── src/
│   │   ├── routes/                # one folder per screen
│   │   ├── features/              # domain features (leads, projects, tasks, ...)
│   │   ├── components/ui/         # design-system primitives
│   │   ├── lib/                   # supabase client, query hooks, helpers
│   │   └── styles/tokens.css      # design tokens (doc 05)
├── supabase/
│   ├── migrations/                # numbered SQL migrations
│   ├── functions/                 # Edge Functions (ai-suggest, notify, export, weekly-summary)
│   └── seed.sql                   # seed from the existing spreadsheet
└── tests/                         # e2e + rls harness
```

---

## 4. How to use the docs and skills

1. **Before any task**, open `docs/00-index.md` and read the doc(s) that own the area you're
   touching. Each doc states its scope at the top.
2. **For recurring work**, consult the matching skill in `.claude/skills/` — they encode the
   exact conventions for this repo (migrations, RLS, React features, the state machine,
   AI calls, WhatsApp, Excel export, tests). Follow them rather than improvising.
3. **When docs and code disagree**, the docs win — fix the code, and flag the drift to the human.
4. **When two docs disagree**, stop and ask. Do not pick one silently.

---

## 5. Working conventions

- **Migrations are append-only.** Never edit a committed migration; add a new numbered one.
- **RLS first.** Every new table ships with RLS enabled and policies in the same migration.
  A table without policies is a bug. See `.claude/skills/rbac-rls-policy`.
- **No secrets in the client bundle.** Anything needing the service-role key or the Anthropic
  key goes in an Edge Function.
- **State transitions go through the engine**, never raw `UPDATE`s on `status`/`current_stage`.
  See `docs/04-state-machine.md` and `.claude/skills/task-state-machine`.
- **Types are generated**, not hand-written: run `supabase gen types typescript` after each
  migration and commit the result to `apps/web/src/lib/database.types.ts`.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). One logical
  change per commit. Reference the roadmap milestone (e.g. `feat(leads): intake form [M1]`).
- **Every feature ships with tests** at the appropriate level (see `docs/09-testing.md`).
- **Accessibility & mobile**: every screen must work at 380px width and be keyboard-navigable.

---

## 6. Definition of Done (per feature)

A feature is done only when ALL of these hold:
- [ ] Matches the relevant doc; no undocumented scope added.
- [ ] DB changes have a migration + RLS policies + regenerated types.
- [ ] State changes go through the state-machine engine, with a `task_events` audit row.
- [ ] UI uses design tokens from `styles/tokens.css`; works at 380px; keyboard-accessible.
- [ ] Unit/component tests pass; an e2e happy-path exists for user-facing flows.
- [ ] RLS verified: each role can do only what doc 02 §RBAC allows (run the RLS harness).
- [ ] No secret keys in the client; AI/WhatsApp calls go through Edge Functions.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` are green.

---

## 7. When to STOP and ask the human

Autonomy is the default, but pause and ask when:
- A decision changes the **data model**, **RBAC matrix**, or **state machine** in a way not
  already specified in the docs.
- A WhatsApp / payment / external-account credential or paid API quota is required.
- A spec is ambiguous or two docs conflict.
- You are about to delete data, run a destructive migration, or change auth.
- The **6 open product questions** in `docs/01-product-requirements.md §9` block progress.
- Anything touches real client PII beyond what the schema already defines.

Ask concisely: state the decision, the options, and your recommendation.

---

## 8. Build order

Follow `docs/10-build-roadmap.md`. Do not jump ahead — later milestones assume earlier ones
exist (e.g. the occupancy board needs tasks; tasks need the state machine; everything needs
RBAC). Tick the roadmap checkboxes as you go and keep them honest.
