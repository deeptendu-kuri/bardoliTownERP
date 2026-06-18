-- ============================================================================
-- 0018_cancel_script_sales.sql
--   (1) Cancel project / stop-work    — cancel_project RPC
--   (2) Scriptwriter deliverable flow — script_requests + RPCs (mirrors anchors)
--   (3) Salesperson lead intake       — submit_lead RPC (submit-only)
--   (4) Onboarding self-select widened to the two new roles
-- Append-only. RLS ships with every new table in this same migration.
-- ============================================================================

-- ── (1) Cancel project / stop-work ──────────────────────────────────────────
alter table projects add column if not exists cancelled_at timestamptz;
alter table projects add column if not exists cancel_reason text;

-- ── (2) Scriptwriter deliverable ────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'script_status') then
    create type script_status as enum ('requested','accepted','declined','submitted','completed','cancelled');
  end if;
end $$;

create table if not exists script_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  writer_id uuid not null references profiles(id),
  status script_status not null default 'requested',
  brief text,                 -- what the admin wants written
  script_text text,           -- the writer's submitted script
  note text,
  requested_by uuid references profiles(id),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_script_req_writer  on script_requests(writer_id, status);
create index if not exists idx_script_req_project on script_requests(project_id);

alter table script_requests enable row level security;
drop policy if exists srq_select on script_requests;
drop policy if exists srq_admin  on script_requests;
create policy srq_select on script_requests for select using (is_manager() or writer_id = auth.uid());
create policy srq_admin  on script_requests for all    using (is_admin()) with check (is_admin());

-- Scriptwriters can read the projects they're writing for (project no/title on
-- their dashboard), same as anchors got in 0015. Keep the anchor + task clauses.
drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (
  is_manager()
  or exists (select 1 from tasks t            where t.project_id = projects.id and t.assignee_id = auth.uid())
  or exists (select 1 from anchor_requests a  where a.project_id = projects.id and a.anchor_id  = auth.uid())
  or exists (select 1 from script_requests s  where s.project_id = projects.id and s.writer_id  = auth.uid())
);

-- ── Scriptwriter workflow RPCs (mirror the anchor RPCs) ─────────────────────
create or replace function request_script(p_project uuid, p_writer uuid, p_brief text default null, p_note text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  insert into script_requests(project_id, writer_id, brief, note, requested_by)
  values (p_project, p_writer, nullif(p_brief,''), nullif(p_note,''), auth.uid())
  returning id into v_id;
  perform _notify(p_writer, 'script_requested', 'Script request', _project_label(p_project));
  insert into task_events(actor_id, event_type, project_id, payload)
  values (auth.uid(), 'script_request', p_project, jsonb_build_object('writer', p_writer, 'request', v_id));
  return v_id;
end $$;

create or replace function respond_script(p_request uuid, p_accept boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare r script_requests;
begin
  select * into r from script_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.writer_id <> auth.uid() then raise exception 'not your request'; end if;
  if r.status <> 'requested' then raise exception 'already responded'; end if;
  update script_requests set status = (case when p_accept then 'accepted' else 'declined' end)::script_status, responded_at = now()
   where id = p_request;
  perform _notify_role('admin', 'script_response',
    case when p_accept then 'Writer accepted the script' else 'Writer declined the script' end,
    _project_label(r.project_id));
end $$;

create or replace function submit_script(p_request uuid, p_text text)
  returns void language plpgsql security definer set search_path = public as $$
declare r script_requests;
begin
  select * into r from script_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.writer_id <> auth.uid() then raise exception 'not your request'; end if;
  if r.status not in ('accepted','submitted') then raise exception 'accept the request first'; end if;
  if coalesce(nullif(p_text,''), '') = '' then raise exception 'script text is empty'; end if;
  update script_requests set status = 'submitted', script_text = p_text, submitted_at = now() where id = p_request;
  perform _notify_role('admin', 'script_submitted', 'Script submitted', _project_label(r.project_id));
end $$;

create or replace function complete_script(p_request uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare r script_requests;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into r from script_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  update script_requests set status = 'completed', completed_at = now() where id = p_request;
  perform _notify(r.writer_id, 'script_completed', 'Script approved', _project_label(r.project_id));
end $$;

-- ── (1 cont.) cancel_project — references script_requests, so defined here ──
create or replace function cancel_project(p_project uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_label text; r record;
begin
  if not is_manager() then raise exception 'managers only'; end if;
  v_label := _project_label(p_project);
  if v_label is null then raise exception 'project not found'; end if;

  update projects set cancelled_at = now(), cancel_reason = nullif(p_reason,'') where id = p_project;

  -- Tell everyone with live work to stop, then block their tasks.
  for r in select distinct assignee_id from tasks
            where project_id = p_project and status in ('queued','in_progress') and assignee_id is not null loop
    perform _notify(r.assignee_id, 'project_cancelled', 'Stop work — project cancelled',
      v_label || coalesce(' · ' || nullif(p_reason,''), ''));
  end loop;
  update tasks set status = 'blocked',
                   blocked_reason = 'Project cancelled' || coalesce(': ' || nullif(p_reason,''), '')
   where project_id = p_project and status in ('queued','in_progress');

  -- Cancel pending anchor requests + notify those anchors.
  for r in select anchor_id from anchor_requests
            where project_id = p_project and status in ('requested','accepted','reported') loop
    perform _notify(r.anchor_id, 'project_cancelled', 'Shoot cancelled', v_label);
  end loop;
  update anchor_requests set status = 'declined', responded_at = coalesce(responded_at, now())
   where project_id = p_project and status in ('requested','accepted','reported');

  -- Cancel pending script requests + notify writers.
  for r in select writer_id from script_requests
            where project_id = p_project and status in ('requested','accepted','submitted') loop
    perform _notify(r.writer_id, 'project_cancelled', 'Script work cancelled', v_label);
  end loop;
  update script_requests set status = 'cancelled'
   where project_id = p_project and status in ('requested','accepted','submitted');

  -- Tell the CEO it happened.
  perform _notify_role('ceo', 'project_cancelled', 'Project cancelled',
    v_label || coalesce(' · ' || nullif(p_reason,''), ''));

  insert into task_events(actor_id, event_type, project_id, payload)
  values (auth.uid(), 'project_cancelled', p_project, jsonb_build_object('reason', p_reason));
end $$;

-- ── (3) Salesperson lead intake (submit-only; no read-back needed) ──────────
create or replace function submit_lead(p_name text, p_company text, p_phone text, p_email text, p_requirements text, p_source text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role user_role;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role not in ('salesperson','admin','ceo') then raise exception 'not allowed'; end if;
  if coalesce(nullif(p_name,''), '') = '' then raise exception 'name is required'; end if;
  insert into clients(name, company, contact_phone, contact_email, requirements, source, lead_stage, created_by)
  values (p_name, nullif(p_company,''), nullif(p_phone,''), nullif(p_email,''), nullif(p_requirements,''),
          coalesce(nullif(p_source,''), 'salesperson'), 'new', auth.uid())
  returning id into v_id;
  perform _notify_role('admin', 'lead_submitted', 'New lead submitted',
    p_name || coalesce(' · ' || nullif(p_company,''), ''));
  return v_id;
end $$;

-- ── (4) Onboarding self-select widened ──────────────────────────────────────
create or replace function complete_onboarding(p_full_name text, p_phone text, p_role text, p_employment text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_current user_role;
begin
  select role into v_current from profiles where id = auth.uid();
  if v_current is null then raise exception 'no profile'; end if;
  if p_role not in ('staff','anchor','scriptwriter','salesperson') and v_current not in ('admin','ceo') then
    raise exception 'invalid role';
  end if;
  update profiles set
    full_name = coalesce(nullif(p_full_name,''), full_name),
    phone = nullif(p_phone,''),
    role = case when v_current in ('admin','ceo') then v_current
                when p_role in ('staff','anchor','scriptwriter','salesperson') then p_role::user_role
                else role end,
    employment_type = case when p_employment in ('employee','freelancer') then p_employment::employment_type else employment_type end,
    onboarded = true
  where id = auth.uid();
end $$;
