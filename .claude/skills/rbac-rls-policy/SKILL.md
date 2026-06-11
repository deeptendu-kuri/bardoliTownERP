---
name: rbac-rls-policy
description: Use this skill whenever you write, change, or debug Row-Level Security policies or any permission/role-gating in Studio OS. Trigger it any time you add a policy, see a "permission denied" or a row that shouldn't be visible, need a staff user restricted to their own rows, or must stop a staff user from editing forbidden columns (like reassigning their own task). It encodes the helper functions, the column-guard pattern, and how to prove the RBAC matrix with tests. Consult it before assuming RLS "just works".
---

# RBAC via RLS (Studio OS)

The permission matrix is authoritative in `docs/02-tech-design.md §3`. RLS must implement it
exactly. RBAC is enforced **in the database**, not the client — never rely on hiding a button.

## Helper functions (create once, in an early migration)
```sql
create or replace function auth_role() returns user_role
  language sql stable security definer set search_path=public as $$
  select role from profiles where id = auth.uid() $$;
create or replace function is_admin() returns boolean language sql stable
  as $$ select auth_role() in ('admin','ceo') $$;
create or replace function is_ceo() returns boolean language sql stable
  as $$ select auth_role() = 'ceo' $$;
```

## Patterns by need
**Read own-or-admin** (tasks, notifications):
```sql
create policy x_read on tasks for select
  using (is_admin() or assignee_id = auth.uid());
```
**Admin full write, CEO read-only** (clients, projects):
```sql
create policy x_admin_write on clients for all
  using (is_admin()) with check (is_admin());
-- CEO/staff get only the select policy above (no insert/update/delete policy → denied)
```
**Staff updates own task but only allowed columns** (can't change assignee/project):
RLS rows + a guard trigger for columns:
```sql
create policy task_self_update on tasks for update
  using (assignee_id = auth.uid()) with check (assignee_id = auth.uid());

create or replace function guard_task_columns() returns trigger language plpgsql as $$
begin
  if is_admin() then return new; end if;            -- admin may change anything
  if new.assignee_id is distinct from old.assignee_id
     or new.project_id is distinct from old.project_id
     or new.type is distinct from old.type then
    raise exception 'staff may not change assignment fields';
  end if;
  return new;
end $$;
create trigger trg_guard_task before update on tasks
  for each row execute function guard_task_columns();
```

## Prove it (always)
For every policy, add a case to `tests/rls/` asserting allowed AND denied paths for ceo/admin/
staff (see the `testing-suite` skill). A policy you didn't test is a policy you don't trust.

## Debugging "permission denied" / leaks
- Confirm RLS is enabled on the table.
- Remember: with RLS, **absence of a matching policy = denied**. Add the specific policy.
- `security definer` functions run as owner — keep `search_path` pinned to avoid surprises.
- Realtime respects RLS; if a subscription delivers nothing, check the read policy.

## Never
Never use the service-role key in the browser to "get past" RLS. Privileged work goes in an Edge
Function that re-checks the role.
