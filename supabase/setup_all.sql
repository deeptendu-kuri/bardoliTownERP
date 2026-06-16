-- Studio OS — run this ONCE in the Supabase SQL editor (fresh project).
-- Full schema, RLS, RPC engine, notes, anchors, attachments, proof, + fixes.

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
-- ============================================================================
-- 0002_engine.sql — the state-machine engine as RPCs (docs 04, 06)
-- These security-definer functions are the ONLY sanctioned way to change a
-- status / current_stage / lead_stage. Each: validate → authorize → guard →
-- apply → recompute → audit → notify. They mirror apps/web/src/backend/engine.
-- ============================================================================

-- ── Internal helpers ────────────────────────────────────────────────────────
create or replace function _notify(p_recipient uuid, p_type text, p_title text, p_body text)
  returns void language sql security definer set search_path = public as $$
  insert into notifications (recipient_id, channel, type, title, body)
  values (p_recipient, 'in_app', p_type, p_title, p_body)
$$;

create or replace function _notify_role(p_role user_role, p_type text, p_title text, p_body text)
  returns void language sql security definer set search_path = public as $$
  insert into notifications (recipient_id, channel, type, title, body)
  select id, 'in_app', p_type, p_title, p_body from profiles where role = p_role and is_active
$$;

create or replace function _project_label(p_project uuid)
  returns text language sql stable security definer set search_path = public as $$
  select c.name || ' — ' || p.title from projects p join clients c on c.id = p.client_id where p.id = p_project
$$;

create or replace function _rollup_status(p_project uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_stage project_stage; v_started boolean;
begin
  select current_stage into v_stage from projects where id = p_project;
  select exists(select 1 from tasks where project_id = p_project and status <> 'queued') into v_started;
  update projects set status =
    (case when v_stage = 'uploaded' then 'completed'
          when v_started then 'in_progress'
          else 'pending' end)::project_status
  where id = p_project;
end $$;

-- ── set_lead_stage: pipeline move; `won` creates a project ───────────────────
create or replace function set_lead_stage(p_client uuid, p_stage lead_stage, p_lost_reason text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from lead_stage; v_project uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select lead_stage into v_from from clients where id = p_client for update;
  if v_from is null then raise exception 'client not found'; end if;

  -- legal forward-adjacent or lost
  if not (
    (v_from = 'new' and p_stage in ('contacted','lost')) or
    (v_from = 'contacted' and p_stage in ('qualified','lost')) or
    (v_from = 'qualified' and p_stage in ('proposal','lost')) or
    (v_from = 'proposal' and p_stage in ('won','lost'))
  ) then raise exception 'illegal lead transition % -> %', v_from, p_stage; end if;

  if p_stage = 'lost' and coalesce(p_lost_reason,'') = '' then
    raise exception 'lost requires a reason';
  end if;

  update clients set lead_stage = p_stage,
         lost_reason = case when p_stage = 'lost' then p_lost_reason else null end
   where id = p_client;
  insert into task_events(actor_id, event_type, from_state, to_state, payload)
  values (auth.uid(), 'lead_stage', v_from::text, p_stage::text, jsonb_build_object('client_id', p_client));

  if p_stage = 'won' then
    insert into projects (client_id, title)
    select id, coalesce(left(requirements,80), name || ' — video') from clients where id = p_client
    returning id into v_project;
    insert into task_events(actor_id, event_type, project_id, payload)
    values (auth.uid(), 'project_created', v_project, jsonb_build_object('client_id', p_client));
    perform _notify_role('admin', 'lead_won', 'New project to assign', _project_label(v_project));
  end if;

  return jsonb_build_object('client_id', p_client, 'project_id', v_project);
end $$;

-- ── assign_task: admin creates a shoot/edit task ─────────────────────────────
create or replace function assign_task(p_project uuid, p_type task_type, p_assignee uuid, p_due date default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_task uuid; v_stage project_stage;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select current_stage into v_stage from projects where id = p_project for update;
  if v_stage is null then raise exception 'project not found'; end if;

  insert into tasks (project_id, type, assignee_id, due_date, sort_order)
  values (p_project, p_type, p_assignee, p_due,
          (select count(*) from tasks where assignee_id = p_assignee))
  returning id into v_task;

  insert into task_events(actor_id, event_type, task_id, project_id, payload)
  values (auth.uid(), 'assign', v_task, p_project, jsonb_build_object('type', p_type, 'assignee_id', p_assignee));

  if p_type = 'shoot' and v_stage = 'confirmed' then
    update projects set current_stage = 'shoot_pending', shoot_date = coalesce(p_due, shoot_date) where id = p_project;
    insert into task_events(actor_id, event_type, project_id, from_state, to_state)
    values (auth.uid(), 'stage', p_project, 'confirmed', 'shoot_pending');
  end if;

  perform _notify(p_assignee, 'assigned', 'New task assigned', _project_label(p_project) || ' — ' || p_type);
  perform _rollup_status(p_project);
  return v_task;
end $$;

-- ── task_transition: the task state machine (doc 04 §3-§5) ───────────────────
create or replace function task_transition(p_task uuid, p_to task_status, p_estimate int default null, p_note text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare t tasks; v_role user_role; v_actual int; v_overdue boolean; v_over_est boolean;
        v_label text; v_stage project_stage;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then raise exception 'task not found'; end if;
  v_role := auth_role();

  -- (2) authorize: assignee or admin
  if not (t.assignee_id = auth.uid() or v_role = 'admin') then
    raise exception 'only the assignee or an admin can change this task';
  end if;

  -- (1) legal move
  if not (
    (t.status = 'queued'      and p_to in ('in_progress','blocked')) or
    (t.status = 'in_progress' and p_to in ('completed','blocked')) or
    (t.status = 'blocked'     and p_to = 'in_progress')
  ) then raise exception 'illegal task transition % -> %', t.status, p_to; end if;

  -- (3) guards + apply
  if t.status = 'queued' and p_to = 'in_progress' then
    if coalesce(p_estimate,0) <= 0 then raise exception 'estimate required to start'; end if;
    update tasks set estimate_minutes = p_estimate, started_at = now() where id = p_task;
  end if;

  if p_to = 'blocked' then
    if coalesce(p_note,'') = '' then raise exception 'reason required to block'; end if;
    update tasks set blocked_reason = p_note where id = p_task;
  end if;

  if t.status = 'blocked' and p_to = 'in_progress' then
    update tasks set blocked_reason = null where id = p_task;
  end if;

  if p_to = 'completed' then
    v_actual := coalesce(p_estimate, greatest(1, round(extract(epoch from (now() - t.started_at))/60)::int));
    v_overdue := t.due_date is not null and t.due_date < current_date;
    v_over_est := t.estimate_minutes is not null and v_actual > t.estimate_minutes;
    if (v_overdue or v_over_est) and coalesce(p_note,'') = '' then
      raise exception 'delay note required for a late task';
    end if;
    update tasks set actual_minutes = v_actual, completed_at = now(),
           delay_note = nullif(p_note,'') where id = p_task;
  end if;

  update tasks set status = p_to where id = p_task;

  insert into task_events(actor_id, event_type, task_id, project_id, from_state, to_state, payload)
  values (auth.uid(), 'transition', p_task, t.project_id, t.status::text, p_to::text, jsonb_build_object('type', t.type));

  -- (5) project side effects (doc 04 §2)
  v_label := _project_label(t.project_id);
  select current_stage into v_stage from projects where id = t.project_id;

  if t.type = 'shoot' and p_to = 'completed' then
    update projects set current_stage = 'shooting_done' where id = t.project_id;
    perform _notify_role('admin', 'shoot_completed', 'Shoot complete', v_label);
  elsif t.type in ('edit','reedit') and p_to = 'in_progress' and v_stage = 'shooting_done' then
    update projects set current_stage = 'editing' where id = t.project_id;
  elsif t.type in ('edit','reedit') and p_to = 'completed' then
    update projects set current_stage = 'client_review' where id = t.project_id;
    perform _notify_role('admin', 'edit_completed', 'Ready for client review', v_label);
  elsif t.type = 'upload' and p_to = 'completed' then
    update projects set current_stage = 'uploaded', client_approval = client_approval,
           upload_date = current_date where id = t.project_id;
    perform _notify_role('admin', 'uploaded', 'Delivered', v_label);
    perform _notify_role('ceo', 'uploaded', 'Delivered', v_label);
  end if;

  perform _rollup_status(t.project_id);
  return jsonb_build_object('task_id', p_task, 'status', p_to);
end $$;

-- ── submit_review: client verdict drives the review loop (doc 04 §2) ─────────
create or replace function submit_review(p_project uuid, p_outcome review_outcome, p_feedback text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_stage project_stage; v_editor uuid; v_round int; v_label text;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select current_stage into v_stage from projects where id = p_project for update;
  if v_stage is null then raise exception 'project not found'; end if;
  if v_stage <> 'client_review' then raise exception 'project is not awaiting review'; end if;
  if p_outcome = 'revisions' and coalesce(p_feedback,'') = '' then raise exception 'feedback required'; end if;

  select assignee_id into v_editor from tasks
   where project_id = p_project and type in ('edit','reedit') order by created_at desc limit 1;
  select coalesce(max(round_no),0)+1 into v_round from review_rounds where project_id = p_project;
  v_label := _project_label(p_project);

  insert into review_rounds(project_id, round_no, feedback, outcome, created_by)
  values (p_project, v_round, nullif(p_feedback,''), p_outcome, auth.uid());

  if p_outcome = 'approved' then
    update projects set current_stage = 'upload_ready', client_approval = 'approved' where id = p_project;
    insert into tasks(project_id, type, assignee_id, status, due_date)
    values (p_project, 'upload', v_editor, 'queued', current_date + 1);
    insert into task_events(actor_id, event_type, project_id, from_state, to_state, payload)
    values (auth.uid(), 'review', p_project, 'client_review', 'upload_ready', jsonb_build_object('round', v_round));
    perform _notify_role('admin', 'review_approved', 'Client approved', v_label);
    perform _notify_role('ceo', 'review_approved', 'Client approved', v_label);
  else
    update projects set current_stage = 'editing', revision_count = revision_count + 1 where id = p_project;
    insert into tasks(project_id, type, assignee_id, status, due_date)
    values (p_project, 'reedit', v_editor, 'queued', current_date + 2);
    insert into task_events(actor_id, event_type, project_id, from_state, to_state, payload)
    values (auth.uid(), 'review', p_project, 'client_review', 'editing', jsonb_build_object('round', v_round));
    if v_editor is not null then perform _notify(v_editor, 'revision_requested', 'Revision requested', coalesce(p_feedback, v_label)); end if;
    if (select revision_count from projects where id = p_project) > 3 then
      perform _notify_role('ceo', 'revision_escalation', 'Quality risk — revision 4+', v_label);
    end if;
  end if;

  perform _rollup_status(p_project);
  return jsonb_build_object('project_id', p_project, 'outcome', p_outcome);
end $$;

-- ── log_hours: freelancer time with rate snapshot (doc 03 §5) ────────────────
create or replace function log_hours(p_task uuid, p_minutes int)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_assignee uuid; v_rate numeric(10,2); v_id uuid;
begin
  select assignee_id into v_assignee from tasks where id = p_task;
  if v_assignee is null then raise exception 'task has no assignee'; end if;
  if not (v_assignee = auth.uid() or is_admin()) then raise exception 'not your task'; end if;
  if coalesce(p_minutes,0) <= 0 then raise exception 'minutes must be > 0'; end if;
  select hourly_rate into v_rate from profiles where id = v_assignee;
  insert into time_logs(task_id, profile_id, minutes, hourly_rate_snapshot)
  values (p_task, v_assignee, p_minutes, v_rate) returning id into v_id;
  return v_id;
end $$;
-- ============================================================================
-- 0003_project_notes.sql — manager notes/questions on a project
-- Lets the CEO ask "who's on this / what's the status" and the Admin answer,
-- without the CEO touching operational tables. Notes are private (not broadcast).
-- ============================================================================

create table project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  is_question boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_project_notes_project on project_notes(project_id, created_at);

alter table project_notes enable row level security;

-- Managers read all; staff may read notes on projects they have a task on.
create policy notes_select on project_notes for select using (
  is_manager()
  or exists (select 1 from tasks t where t.project_id = project_notes.project_id and t.assignee_id = auth.uid())
);
-- Only managers (CEO/Admin) post, as themselves.
create policy notes_insert on project_notes for insert with check (is_manager() and author_id = auth.uid());

-- RPC mirrors apps/web/src/backend/services/notes.ts
create or replace function add_project_note(p_project uuid, p_body text, p_is_question boolean default false)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role user_role; v_label text;
begin
  if not is_manager() then raise exception 'managers only'; end if;
  if coalesce(p_body,'') = '' then raise exception 'empty note'; end if;
  insert into project_notes(project_id, author_id, body, is_question)
  values (p_project, auth.uid(), p_body, p_is_question) returning id into v_id;

  v_role := auth_role();
  v_label := _project_label(p_project);
  if v_role = 'ceo' then
    perform _notify_role('admin', 'project_note',
      case when p_is_question then 'Question from the CEO' else 'Note from the CEO' end, v_label);
  else
    perform _notify_role('ceo', 'project_note',
      case when p_is_question then 'Question from the Admin' else 'Note from the Admin' end, v_label);
  end if;
  return v_id;
end $$;
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
-- ============================================================================
-- 0005_fix_rollup_status.sql — cast the status rollup to the enum type.
-- A CASE of text literals must be explicitly cast to project_status before
-- assignment (Postgres won't do it implicitly). Unblocks assign_task /
-- task_transition / submit_review, which all call _rollup_status.
-- ============================================================================

create or replace function _rollup_status(p_project uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_stage project_stage; v_started boolean;
begin
  select current_stage into v_stage from projects where id = p_project;
  select exists(select 1 from tasks where project_id = p_project and status <> 'queued') into v_started;
  update projects set status =
    (case when v_stage = 'uploaded' then 'completed'
          when v_started then 'in_progress'
          else 'pending' end)::project_status
  where id = p_project;
end $$;
-- ============================================================================
-- 0006_phase_b.sql — Phase B data model: reassignment + upload proof.
-- ============================================================================

-- ── Upload proof columns ─────────────────────────────────────────────────────
alter table tasks add column if not exists proof_url text;        -- Drive/published link
alter table tasks add column if not exists proof_image_url text;  -- screenshot in Storage

-- ── Reassign a task to a different person (admin only) ───────────────────────
create or replace function reassign_task(p_task uuid, p_assignee uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare t tasks; v_old uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into t from tasks where id = p_task for update;
  if t.id is null then raise exception 'task not found'; end if;
  v_old := t.assignee_id;
  if v_old is not distinct from p_assignee then return; end if;

  update tasks set assignee_id = p_assignee,
         sort_order = (select count(*) from tasks where assignee_id = p_assignee)
   where id = p_task;

  insert into task_events(actor_id, event_type, task_id, project_id, payload)
  values (auth.uid(), 'reassign', p_task, t.project_id,
          jsonb_build_object('from', v_old, 'to', p_assignee, 'type', t.type));

  if p_assignee is not null then
    perform _notify(p_assignee, 'assigned', 'Task reassigned to you', _project_label(t.project_id) || ' — ' || t.type);
  end if;
  if v_old is not null then
    perform _notify(v_old, 'reassigned_away', 'A task was moved off your plate', _project_label(t.project_id) || ' — ' || t.type);
  end if;
end $$;

-- ── Complete an upload task WITH proof (Drive link + optional screenshot) ─────
create or replace function complete_upload(p_task uuid, p_url text, p_image_url text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare t tasks; v_label text; v_actual int;
begin
  select * into t from tasks where id = p_task for update;
  if t.id is null then raise exception 'task not found'; end if;
  if not (t.assignee_id = auth.uid() or is_admin()) then raise exception 'not your task'; end if;
  if t.type <> 'upload' then raise exception 'not an upload task'; end if;
  if t.status <> 'in_progress' then raise exception 'start the upload task first'; end if;
  if coalesce(p_url, '') = '' then raise exception 'attach the upload proof link before completing'; end if;

  v_actual := coalesce(t.actual_minutes, greatest(1, round(extract(epoch from (now() - t.started_at)) / 60)::int));
  update tasks set proof_url = p_url, proof_image_url = p_image_url, status = 'completed',
         actual_minutes = v_actual, completed_at = now()
   where id = p_task;
  update projects set current_stage = 'uploaded', status = 'completed', upload_date = current_date
   where id = t.project_id;

  insert into task_events(actor_id, event_type, task_id, project_id, from_state, to_state, payload)
  values (auth.uid(), 'transition', p_task, t.project_id, 'in_progress', 'completed', jsonb_build_object('type', 'upload', 'proof', p_url));

  v_label := _project_label(t.project_id);
  perform _notify_role('admin', 'uploaded', 'Delivered', v_label);
  perform _notify_role('ceo', 'uploaded', 'Delivered', v_label);
  return jsonb_build_object('task_id', p_task);
end $$;

-- ── Storage bucket for proof screenshots (public read, authenticated write) ──
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', true)
  on conflict (id) do nothing;

drop policy if exists "proofs_read" on storage.objects;
drop policy if exists "proofs_write" on storage.objects;
create policy "proofs_read"  on storage.objects for select using (bucket_id = 'proofs');
create policy "proofs_write" on storage.objects for insert to authenticated with check (bucket_id = 'proofs');
-- 0007_anchor_role.sql — add the anchor role (separate file: enum value must
-- commit before it can be referenced by later migrations).
alter type user_role add value if not exists 'anchor';
-- ============================================================================
-- 0008_anchors_attachments.sql — anchor availability workflow + attachments.
-- ============================================================================

create type anchor_status as enum ('requested', 'accepted', 'declined', 'reported', 'completed');

create table anchor_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  anchor_id uuid not null references profiles(id),
  status anchor_status not null default 'requested',
  location text,
  shoot_date date,
  note text,
  requested_by uuid references profiles(id),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  reported_at timestamptz,
  completed_at timestamptz
);
create index idx_anchor_req_anchor on anchor_requests(anchor_id, status);
create index idx_anchor_req_project on anchor_requests(project_id);

alter table anchor_requests enable row level security;
create policy ar_select on anchor_requests for select using (is_manager() or anchor_id = auth.uid());
create policy ar_admin  on anchor_requests for all    using (is_admin()) with check (is_admin());

-- Attachments (links + images) for notes / feedback / proof / projects.
create table attachments (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null,            -- 'note' | 'review' | 'project' | 'task'
  parent_id uuid not null,
  kind text not null check (kind in ('link', 'image')),
  url text not null,
  caption text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_attachments_parent on attachments(parent_type, parent_id);
alter table attachments enable row level security;
create policy att_select on attachments for select using (auth.uid() is not null);
create policy att_insert on attachments for insert with check (created_by = auth.uid());

-- ── Anchor workflow RPCs ─────────────────────────────────────────────────────
create or replace function request_anchor(p_project uuid, p_anchor uuid, p_location text default null, p_note text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  insert into anchor_requests(project_id, anchor_id, location, note, requested_by, shoot_date)
  values (p_project, p_anchor, p_location, p_note, auth.uid(), (select shoot_date from projects where id = p_project))
  returning id into v_id;
  perform _notify(p_anchor, 'anchor_requested', 'Shoot availability request',
    _project_label(p_project) || coalesce(' @ ' || p_location, ''));
  insert into task_events(actor_id, event_type, project_id, payload)
  values (auth.uid(), 'anchor_request', p_project, jsonb_build_object('anchor', p_anchor, 'request', v_id));
  return v_id;
end $$;

create or replace function respond_anchor(p_request uuid, p_accept boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare r anchor_requests;
begin
  select * into r from anchor_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.anchor_id <> auth.uid() then raise exception 'not your request'; end if;
  if r.status <> 'requested' then raise exception 'already responded'; end if;
  update anchor_requests set status = (case when p_accept then 'accepted' else 'declined' end)::anchor_status, responded_at = now()
   where id = p_request;
  perform _notify_role('admin', 'anchor_response',
    case when p_accept then 'Anchor accepted the shoot' else 'Anchor declined the shoot' end,
    _project_label(r.project_id));
end $$;

create or replace function anchor_report(p_request uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare r anchor_requests;
begin
  select * into r from anchor_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.anchor_id <> auth.uid() then raise exception 'not your request'; end if;
  if r.status <> 'accepted' then raise exception 'accept the shoot first'; end if;
  update anchor_requests set status = 'reported', reported_at = now() where id = p_request;
  perform _notify_role('admin', 'anchor_reported', 'Anchor reported at location', _project_label(r.project_id));
end $$;

create or replace function anchor_complete(p_request uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare r anchor_requests;
begin
  select * into r from anchor_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.anchor_id <> auth.uid() then raise exception 'not your request'; end if;
  if r.status not in ('accepted', 'reported') then raise exception 'not in progress'; end if;
  update anchor_requests set status = 'completed', completed_at = now() where id = p_request;
  perform _notify_role('admin', 'anchor_completed', 'Anchor wrapped the shoot', _project_label(r.project_id));
end $$;

-- Allow an anchor test account to land with the right role.
insert into role_allowlist(email, role) values ('anchor1@studio.test', 'anchor')
  on conflict (email) do update set role = excluded.role;
-- 0009_fix_respond_anchor.sql — cast the CASE to anchor_status (same enum-cast
-- rule as 0005). Unblocks anchor accept/decline.
create or replace function respond_anchor(p_request uuid, p_accept boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare r anchor_requests;
begin
  select * into r from anchor_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.anchor_id <> auth.uid() then raise exception 'not your request'; end if;
  if r.status <> 'requested' then raise exception 'already responded'; end if;
  update anchor_requests set status = (case when p_accept then 'accepted' else 'declined' end)::anchor_status, responded_at = now()
   where id = p_request;
  perform _notify_role('admin', 'anchor_response',
    case when p_accept then 'Anchor accepted the shoot' else 'Anchor declined the shoot' end,
    _project_label(r.project_id));
end $$;
