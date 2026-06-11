# Supabase (production backend — not used by the demo yet)

The demo app runs entirely on a localStorage-backed store (`apps/web/src/backend`).
These files are the **real** Postgres backend, written to match that store 1:1 so
switching over is mechanical.

## Contents
- `migrations/0001_schema.sql` — enums, tables, indexes, helper functions, RLS
  policies (the doc-02 RBAC matrix), the column guard, and the reporting views.
- `migrations/0002_engine.sql` — the state-machine as security-definer RPCs
  (`set_lead_stage`, `assign_task`, `task_transition`, `submit_review`, `log_hours`).
- `seed.sql` — illustrative local seed.

## When you're ready to go live
1. `supabase init` (if not already) and `supabase start` for a local stack.
2. `supabase db reset` — applies the migrations and runs `seed.sql`.
3. `supabase gen types typescript --local > apps/web/src/lib/database.types.ts`.
4. Implement a `SupabaseAdapter` and swap the service functions in
   `apps/web/src/backend` to call `supabase.rpc(...)` / table reads instead of the
   in-memory store. The UI (which only imports from `@/backend`) does not change.
5. Move the Anthropic / WhatsApp work into Edge Functions (`supabase/functions`)
   per docs 07 and 08 — those remain Phase 2.

Migrations are **append-only**: never edit a committed file; add a new numbered one.
