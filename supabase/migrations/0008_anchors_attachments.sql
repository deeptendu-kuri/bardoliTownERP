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
