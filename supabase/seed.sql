-- ============================================================================
-- seed.sql — illustrative seed for a LOCAL Supabase stack (`supabase db reset`).
-- In production, team members are created through Supabase Auth signup (which
-- fires handle_new_user to make their profile). Here we insert auth.users rows
-- directly so the demo has data. Passwords are placeholders — set real ones via
-- the Auth API. This mirrors the synthetic seed in apps/web/src/backend/db/seed.ts.
-- ============================================================================

-- Fixed UUIDs so relations line up.
\set ceo    '11111111-1111-1111-1111-111111111111'
\set admin  '22222222-2222-2222-2222-222222222222'
\set rahul  '33333333-3333-3333-3333-333333333333'
\set neel   '44444444-4444-4444-4444-444444444444'

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values
  (:'ceo',   'ceo@studio.test',   crypt('studio123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'),
  (:'admin', 'admin@studio.test', crypt('studio123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'),
  (:'rahul', 'rahul@studio.test', crypt('studio123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'),
  (:'neel',  'neel@studio.test',  crypt('studio123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- handle_new_user created skeleton profiles; fill in roles/skills.
update profiles set full_name = 'Vikram Shah', role = 'ceo'   where id = :'ceo';
update profiles set full_name = 'Priya Mehta', role = 'admin' where id = :'admin';
update profiles set full_name = 'Rahul Patel', role = 'staff', skills = '{shoot,edit}' where id = :'rahul';
update profiles set full_name = 'Neel Joshi',  role = 'staff', skills = '{edit,motion}' where id = :'neel';

-- A won client + a project mid-production.
with c as (
  insert into clients (name, company, requirements, lead_stage, created_by)
  values ('Lotus Spa', 'Lotus Wellness', 'Ambience brand film', 'won', :'admin')
  returning id
), p as (
  insert into projects (client_id, title, video_type, priority, current_stage, status)
  select id, 'Ambience brand film', 'Brand', 'medium', 'client_review', 'in_progress' from c
  returning id
)
insert into tasks (project_id, type, assignee_id, status, estimate_minutes, actual_minutes, completed_at)
select id, 'shoot', :'rahul', 'completed', 120, 135, now() from p
union all
select id, 'edit',  :'neel',  'completed', 240, 255, now() from p;

-- A fresh lead in the pipeline.
insert into clients (name, requirements, lead_stage, created_by)
values ('Patel Motors', '60s showroom promo', 'new', :'admin');
