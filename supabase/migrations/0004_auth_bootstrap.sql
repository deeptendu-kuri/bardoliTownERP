-- ============================================================================
-- 0004_auth_bootstrap.sql — first-sign-in role assignment ("Start empty")
-- The DB starts with no users. When someone signs in via email OTP for the
-- first time, handle_new_user creates their profile; this maps known emails to
-- the right role (CEO / Admin / Staff). Everyone else defaults to staff.
-- ============================================================================

create table if not exists role_allowlist (
  email text primary key,
  role user_role not null,
  employment_type employment_type not null default 'employee'
);

insert into role_allowlist (email, role, employment_type) values
  ('avinashss1211@gmail.com',    'ceo',   'employee'),
  ('deeptendukuri@gmail.com',    'admin', 'employee'),
  ('deeptendukuri178@gmail.com', 'staff', 'employee')
on conflict (email) do update set role = excluded.role, employment_type = excluded.employment_type;

alter table role_allowlist enable row level security;
create policy allowlist_select on role_allowlist for select using (is_manager());
create policy allowlist_write  on role_allowlist for all    using (is_admin()) with check (is_admin());

-- Override the skeleton trigger from 0001 to honour the allowlist.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_emp employment_type;
begin
  select role, employment_type into v_role, v_emp from role_allowlist where email = new.email;
  insert into profiles (id, full_name, role, employment_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(v_role, 'staff'),
    coalesce(v_emp, 'employee')
  );
  return new;
end $$;
