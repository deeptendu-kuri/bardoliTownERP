-- ============================================================================
-- 0014_signup_notify_team.sql — notify admins on new sign-up + team directory.
-- ============================================================================

-- handle_new_user now also pings every admin that someone signed up.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_emp employment_type;
begin
  select role, employment_type into v_role, v_emp from role_allowlist where email = new.email;
  insert into profiles (id, full_name, role, employment_type, onboarded)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(v_role, 'staff'),
    coalesce(v_emp, 'employee'),
    v_role is not null
  );
  insert into notifications (recipient_id, channel, type, title, body)
  select id, 'in_app', 'signup', 'New sign-up', new.email from profiles where role = 'admin' and is_active;
  return new;
end $$;

-- Team directory (managers only) — joins the email from auth.users.
create or replace function team_members()
  returns table (id uuid, full_name text, email text, role user_role, employment_type employment_type, is_active boolean, onboarded boolean)
  language sql security definer set search_path = public stable as $$
  select p.id, p.full_name, u.email::text, p.role, p.employment_type, p.is_active, p.onboarded
  from profiles p join auth.users u on u.id = p.id
  where is_manager()
  order by p.role, p.full_name
$$;
