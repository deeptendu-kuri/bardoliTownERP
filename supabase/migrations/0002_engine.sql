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
    case when v_stage = 'uploaded' then 'completed'
         when v_started then 'in_progress'
         else 'pending' end
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
