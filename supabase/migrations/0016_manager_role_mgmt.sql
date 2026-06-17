-- ============================================================================
-- 0016_manager_role_mgmt.sql — let managers (CEO + Admin) manage team roles,
-- so the owner (CEO) can promote anyone to Admin. Non-managers still cannot
-- self-assign a privileged role.
-- ============================================================================
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (is_manager() or id = auth.uid());

create or replace function guard_profile_role() returns trigger
  language plpgsql as $$
begin
  if is_manager() then return new; end if;  -- CEO/Admin may set any role
  if new.role is distinct from old.role and new.role in ('admin', 'ceo') then
    raise exception 'cannot self-assign a privileged role';
  end if;
  return new;
end $$;
