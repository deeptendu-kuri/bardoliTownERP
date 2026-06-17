-- ============================================================================
-- 0012_onboarding.sql — OTP signup onboarding + role self-select (safe).
-- New users land un-onboarded and pick Staff/Freelancer/Anchor; CEO/Admin stay
-- locked to role_allowlist. A trigger blocks any self-escalation to admin/ceo.
-- ============================================================================
alter table profiles add column if not exists onboarded boolean not null default false;

-- Allowlisted users (CEO/Admin/known staff) are considered onboarded already.
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
  return new;
end $$;

-- Self-service onboarding. Cannot grant admin/ceo; privileged roles stay as-is.
create or replace function complete_onboarding(p_full_name text, p_phone text, p_role text, p_employment text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_current user_role;
begin
  select role into v_current from profiles where id = auth.uid();
  if v_current is null then raise exception 'no profile'; end if;
  if p_role not in ('staff', 'anchor') and v_current not in ('admin', 'ceo') then
    raise exception 'invalid role';
  end if;
  update profiles set
    full_name = coalesce(nullif(p_full_name, ''), full_name),
    phone = nullif(p_phone, ''),
    role = case when v_current in ('admin', 'ceo') then v_current
                when p_role in ('staff', 'anchor') then p_role::user_role
                else role end,
    employment_type = case when p_employment in ('employee', 'freelancer') then p_employment::employment_type else employment_type end,
    onboarded = true
  where id = auth.uid();
end $$;

-- Defense in depth: a non-admin can never set their own role to admin/ceo.
create or replace function guard_profile_role() returns trigger
  language plpgsql as $$
begin
  if is_admin() then return new; end if;
  if new.role is distinct from old.role and new.role in ('admin', 'ceo') then
    raise exception 'cannot self-assign a privileged role';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_role on profiles;
create trigger trg_guard_profile_role before update on profiles
  for each row execute function guard_profile_role();

-- Mark existing accounts onboarded so they aren't re-prompted.
update profiles set onboarded = true where onboarded = false;
