# 02 — Technical Design

**Scope:** architecture, stack rationale, the RBAC matrix, environments, and cross-cutting
concerns (security, realtime, error handling). Schema detail is in doc 03; APIs in doc 06.

---

## 1. Architecture at a glance
A thin React SPA talks directly to Supabase (Postgres + Auth + Realtime) for ordinary CRUD,
with RLS enforcing every permission. Anything privileged or external (Claude API, WhatsApp,
heavy export) runs in a Supabase **Edge Function** so secrets never reach the browser.

```
                ┌────────────────────────── Browser (React + Vite) ──────────────────────────┐
                │  TanStack Query  ·  Zustand (UI)  ·  Tailwind  ·  Supabase JS client         │
                └───────┬───────────────────────────────────────────────┬─────────────────────┘
                        │ (anon key + user JWT)                          │ (invoke)
                        ▼                                                ▼
        ┌─────────────────────────────┐                    ┌──────────────────────────────┐
        │ Supabase Postgres + RLS      │  Realtime (WS) ──▶ │ Edge Functions (Deno/TS)      │
        │  tables, enums, RPCs, views  │ ◀── triggers       │  ai-suggest · notify ·        │
        │  Row-Level Security policies │                    │  whatsapp · export · summary  │
        └─────────────────────────────┘                    └─────────┬────────────────────┘
                                                                      │ service-role key / API keys
                                                          ┌───────────┴───────────┐
                                                          ▼                       ▼
                                                   Anthropic Claude API     WhatsApp / channel
```

## 2. Why this stack (rationale)
- **Supabase** gives Postgres + Auth + Realtime + RLS in one box, so a single developer (or
  Claude Code) ships full-stack without standing up servers. RLS lets us enforce RBAC *in the
  database*, which is far safer than trusting the client.
- **RLS-as-RBAC** means a compromised or buggy client still cannot read another role's data.
- **Edge Functions** keep the Anthropic + WhatsApp keys server-side and let us add server logic
  without a separate backend service.
- **React + Vite + Tailwind** is the fastest path to the dashboards in doc 05, and **Capacitor**
  wraps the exact same build for mobile later — no rewrite (PRD platform decision).
- **TanStack Query** gives caching + realtime invalidation cheaply; **Zustand** covers the small
  amount of pure-UI state (open panels, filters) without Redux ceremony.

## 3. RBAC matrix (authoritative — RLS must implement exactly this)
Legend: **F** full CRUD · **R** read · **O** own rows only · **—** none.

| Table | CEO | Admin | Staff/Freelancer |
|---|---|---|---|
| profiles | R (all) | F | R(self), update limited self fields |
| clients | R | F | — |
| projects | R | F | R (only projects they have a task on) |
| tasks | R | F | O (read own; update status/estimate/delay on own only) |
| task_events | R | R (insert via engine) | R (own task events) |
| review_rounds | R | F | R (own project) |
| time_logs | R | F | O (insert/read own) |
| notifications | R(self) | R(self) | R(self), mark-read self |
| ai_suggestions | R | F (accept/dismiss) | — |

Enforcement rules:
- `role` and `employment_type` live on `profiles`; never trust a client-sent role.
- Helper SQL functions `auth_role()` and `is_admin()` / `is_ceo()` read the caller's profile.
- Staff write paths are narrowed by **column** where needed (a staff member may set their task's
  `status`, `estimate_minutes`, `delay_note` — not its `assignee_id` or `project_id`). Use a
  dedicated RPC or a `WITH CHECK` policy plus a `BEFORE UPDATE` trigger that rejects forbidden
  column changes. See `.claude/skills/rbac-rls-policy`.

## 4. Environments
- **local** — `supabase start` (Docker), `pnpm dev`. Seeded from `supabase/seed.sql`.
- **staging** — a Supabase project; auto-deploy on merge to `main`; used for human review.
- **prod** — separate Supabase project; deploy on tagged release.
- Config via `.env.local` (frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  Secrets (service role, `ANTHROPIC_API_KEY`, WhatsApp tokens) via `supabase secrets set`.

## 5. Cross-cutting concerns
- **Security:** RLS on every table from its first migration; no service-role key in the client;
  Edge Functions validate the caller's JWT and re-check role before privileged work.
- **Realtime:** dashboards subscribe to Postgres changes on `projects`, `tasks`, `notifications`.
  TanStack Query invalidates the relevant keys on each event (see doc 06 §realtime).
- **Error handling:** all writes are wrapped; user-visible toasts on failure; Edge Functions
  return structured `{ ok, data, error }`. Never swallow errors silently.
- **Audit:** every state transition writes a `task_events` row (actor, from, to, payload). This
  is non-negotiable — it powers accountability and analytics.
- **Time zones:** store all timestamps in UTC (`timestamptz`); render in the studio's local TZ.
- **Soft delete:** prefer `is_active=false` / `archived_at` over hard deletes for clients,
  profiles, projects.

## 6. Non-goals (architecture)
No microservices, no separate Node backend, no GraphQL, no custom auth. Keep it boring and
maintainable by one person.
