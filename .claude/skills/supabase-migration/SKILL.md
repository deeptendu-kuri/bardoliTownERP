---
name: supabase-migration
description: Use this skill whenever you create or change anything in the Postgres database for Studio OS — new tables, columns, enums, indexes, views, or functions/RPCs. Trigger it any time you are about to write a file under supabase/migrations/, run a schema change, or are tempted to ALTER a committed migration. It encodes the append-only migration rules, the mandatory RLS-in-the-same-migration rule, and the type-regeneration step. Always consult it before touching the schema, even for a "small" column add.
---

# Supabase Migrations (Studio OS)

Authoritative schema is `docs/03-data-model.md`; RBAC matrix is `docs/02-tech-design.md §3`.
Read those before writing a migration.

## Hard rules
- **Append-only.** Never edit a migration that is already committed. Add a new, numbered one.
- **RLS ships with the table.** A `create table` migration MUST, in the same file, `enable row
  level security` and add the policies for all three roles. A table without policies is a bug.
- **Regenerate types after every migration:** `supabase gen types typescript --local >
  apps/web/src/lib/database.types.ts` and commit it.
- **Test the boundary.** Any policy change requires a matching update to `tests/rls/` (see the
  `rbac-rls-policy` and `testing-suite` skills).

## File naming
`supabase/migrations/<timestamp>_<verb>_<subject>.sql`, e.g.
`20260115093000_create_tasks_and_rls.sql`. Timestamps keep order; one logical change per file.

## Migration template
```sql
-- 1. enums (if new)
create type task_status as enum ('queued','in_progress','completed','blocked');

-- 2. table
create table tasks (
  id uuid primary key default gen_random_uuid(),
  -- ... columns from docs/03 ...
  created_at timestamptz not null default now()
);

-- 3. indexes
create index on tasks (assignee_id, status);

-- 4. RLS (mandatory, same file)
alter table tasks enable row level security;
-- read: staff own rows; admin/ceo all
create policy tasks_read on tasks for select using (
  is_admin() or assignee_id = auth.uid()
);
-- write paths: see rbac-rls-policy skill for the column-guard pattern
create policy tasks_admin_write on tasks for all using (is_admin()) with check (is_admin());

-- 5. triggers (updated_at, derived state) if needed
```

## Workflow
1. Confirm the change is in `docs/03` (or get human sign-off to extend it — CLAUDE.md §7).
2. Write the migration with table + indexes + RLS + triggers together.
3. `supabase db reset` locally to verify it applies cleanly against the seed.
4. Regenerate + commit types.
5. Add/extend RLS tests; run them.

## Don't
- Don't hand-edit `database.types.ts`. Don't disable RLS to "make it work". Don't put business
  logic that changes `status`/`current_stage` in a migration trigger that bypasses the state
  engine — transitions go through the RPCs in `docs/04`/`06`.
