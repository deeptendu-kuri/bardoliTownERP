-- ============================================================================
-- 0001_schema.sql — Studio OS core schema, RLS, helpers, views
-- Source of truth: docs 02 (RBAC), 03 (data model). Append-only: never edit a
-- committed migration; add a new numbered one. RLS ships in this same migration.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Enums (doc 03 §2) ───────────────────────────────────────────────────────
create type user_role        as enum ('ceo','admin','staff');
create type employment_type  as enum ('employee','freelancer');
create type lead_stage        as enum ('new','contacted','qualified','proposal','won','lost');
create type project_stage     as enum ('confirmed','shoot_pending','shooting_done','editing','client_review','upload_ready','uploaded');
create type project_status    as enum ('pending','in_progress','completed');
create type priority          as enum ('low','medium','high');
create type approval          as enum ('pending','approved');
create type task_type         as enum ('shoot','edit','reedit','upload');
create type task_status       as enum ('queued','in_progress','completed','blocked');
create type review_outcome    as enum ('approved','revisions');
create type notif_channel     as enum ('in_app','whatsapp');
create type suggestion_status as enum ('pending','accepted','dismissed');

-- ── Tables (doc 03 §5) ──────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role user_role not null default 'staff',
  employment_type employment_type not null default 'employee',
  hourly_rate numeric(10,2),
  skills text[] not null default '{}',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  contact_phone text,
  contact_email text,
  requirements text,
  lead_stage lead_stage not null default 'new',
  lost_reason text,
  source text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lost_requires_reason check (lead_stage <> 'lost' or lost_reason is not null)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  project_no serial unique,
  client_id uuid not null references clients(id),
  title text not null,
  video_type text,
  priority priority not null default 'medium',
  current_stage project_stage not null default 'confirmed',
  status project_status not null default 'pending',
  client_approval approval not null default 'pending',
  revision_count int not null default 0,
  shoot_date date,
  editing_date date,
  upload_date date,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type task_type not null,
  assignee_id uuid references profiles(id),
  status task_status not null default 'queued',
  estimate_minutes int,
  actual_minutes int,
  due_date date,
  delay_note text,
  blocked_reason text,
  sort_order int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table task_events (
  id bigint generated always as identity primary key,
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  actor_id uuid references profiles(id),
  event_type text not null,
  from_state text,
  to_state text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table review_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  round_no int not null,
  sent_at timestamptz default now(),
  feedback text,
  outcome review_outcome,
  created_by uuid references profiles(id)
);

create table time_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  minutes int not null check (minutes > 0),
  hourly_rate_snapshot numeric(10,2),
  logged_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  channel notif_channel not null default 'in_app',
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  context jsonb not null,
  suggestion jsonb not null,
  status suggestion_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ── Indexes (doc 03 §7) ─────────────────────────────────────────────────────
create index idx_tasks_assignee_status on tasks(assignee_id, status);
create index idx_tasks_project on tasks(project_id);
create index idx_projects_stage on projects(current_stage);
create index idx_clients_stage on clients(lead_stage);
create index idx_notifications_recipient on notifications(recipient_id, read_at);

-- ── Helper functions (doc 03 §4) ────────────────────────────────────────────
create or replace function auth_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function is_admin() returns boolean
  language sql stable as $$ select auth_role() = 'admin' $$;
create or replace function is_manager() returns boolean
  language sql stable as $$ select auth_role() in ('admin','ceo') $$;
create or replace function is_ceo() returns boolean
  language sql stable as $$ select auth_role() = 'ceo' $$;

-- ── updated_at maintenance ──────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger trg_clients_updated before update on clients
  for each row execute function touch_updated_at();

-- ── New auth user → profile row ─────────────────────────────────────────────
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── Staff task column guard (doc 02 §3) ─────────────────────────────────────
-- Staff may change status/estimate/delay/actual on their own task, never the
-- assignee/project/type. (Engine RPCs run as security definer and bypass this.)
create or replace function guard_task_columns() returns trigger
  language plpgsql as $$
begin
  if is_admin() then return new; end if;
  if new.assignee_id is distinct from old.assignee_id
     or new.project_id is distinct from old.project_id
     or new.type is distinct from old.type then
    raise exception 'staff may not change assignee, project, or type of a task';
  end if;
  return new;
end $$;
create trigger trg_guard_task_columns before update on tasks
  for each row execute function guard_task_columns();

-- ── Enable RLS on every table ───────────────────────────────────────────────
alter table profiles      enable row level security;
alter table clients       enable row level security;
alter table projects      enable row level security;
alter table tasks         enable row level security;
alter table task_events   enable row level security;
alter table review_rounds enable row level security;
alter table time_logs     enable row level security;
alter table notifications enable row level security;
alter table ai_suggestions enable row level security;

-- profiles: managers read all; everyone reads self. Admin writes; staff update self.
create policy profiles_select on profiles for select using (is_manager() or id = auth.uid());
create policy profiles_insert on profiles for insert with check (is_admin());
create policy profiles_update on profiles for update using (is_admin() or id = auth.uid());

-- clients: managers read; admin full CRUD.
create policy clients_select on clients for select using (is_manager());
create policy clients_write  on clients for all using (is_admin()) with check (is_admin());

-- projects: managers read; staff read projects they have a task on; admin writes.
create policy projects_select on projects for select using (
  is_manager() or exists (select 1 from tasks t where t.project_id = projects.id and t.assignee_id = auth.uid())
);
create policy projects_write on projects for all using (is_admin()) with check (is_admin());

-- tasks: managers read; staff read own; admin inserts/deletes; staff update own (column-guarded).
create policy tasks_select on tasks for select using (is_manager() or assignee_id = auth.uid());
create policy tasks_insert on tasks for insert with check (is_admin());
create policy tasks_delete on tasks for delete using (is_admin());
create policy tasks_update on tasks for update using (is_admin() or assignee_id = auth.uid());

-- task_events: managers read all; staff read events on their tasks/projects.
create policy events_select on task_events for select using (
  is_manager()
  or exists (select 1 from tasks t where t.id = task_events.task_id and t.assignee_id = auth.uid())
);
create policy events_insert on task_events for insert with check (is_admin());

-- review_rounds: managers read all; staff read own project; admin writes.
create policy reviews_select on review_rounds for select using (
  is_manager() or exists (select 1 from tasks t where t.project_id = review_rounds.project_id and t.assignee_id = auth.uid())
);
create policy reviews_write on review_rounds for all using (is_admin()) with check (is_admin());

-- time_logs: managers read all; staff read/insert own.
create policy timelogs_select on time_logs for select using (is_manager() or profile_id = auth.uid());
create policy timelogs_insert on time_logs for insert with check (is_admin() or profile_id = auth.uid());

-- notifications: each user sees and marks only their own.
create policy notif_select on notifications for select using (recipient_id = auth.uid());
create policy notif_update on notifications for update using (recipient_id = auth.uid());
create policy notif_insert on notifications for insert with check (is_admin());

-- ai_suggestions: managers read; admin accept/dismiss.
create policy ai_select on ai_suggestions for select using (is_manager());
create policy ai_write  on ai_suggestions for all using (is_admin()) with check (is_admin());

-- ── Views (doc 03 §6) ───────────────────────────────────────────────────────
create or replace view v_occupancy as
select p.id as profile_id,
       p.full_name,
       p.employment_type,
       count(t.*) filter (where t.status <> 'completed') as active_count,
       least(100, coalesce(sum(case when t.status = 'queued' then 20
                                     when t.status in ('in_progress','blocked') then 40
                                     else 0 end), 0)) as load_pct
from profiles p
left join tasks t on t.assignee_id = p.id
where p.role = 'staff' and p.is_active
group by p.id;

create or replace view v_pipeline as
select lead_stage::text as stage, count(*) as count
from clients group by lead_stage;

create or replace view v_sheet_export as
select p.project_no            as "Task No",
       p.created_at::date       as "Date",
       c.name                   as "Client Name",
       coalesce(p.video_type,'') as "Video Type",
       p.status::text           as "Task Status",
       'won'                    as "Lead Stage",
       p.current_stage::text    as "Current Workflow",
       p.priority::text         as "Priority",
       (select string_agg(pr.full_name || '(' || t.type || ')', ' / ' order by t.created_at)
          from tasks t join profiles pr on pr.id = t.assignee_id
         where t.project_id = p.id) as "Assigned Employee",
       coalesce(p.shoot_date::text,'')   as "Shoot Date",
       coalesce(p.editing_date::text,'') as "Editing Date",
       coalesce(p.upload_date::text,'')  as "Upload Date",
       p.client_approval::text  as "Client Approval"
from projects p join clients c on c.id = p.client_id
order by p.project_no;
