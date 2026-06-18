-- ============================================================================
-- 0019_workflow.sql — guided per-project workflow controls.
--   • script_waived       — admin skipped the (optional) script step
--   • waive_script(...)    — record that skip (audited)
--   • manager_deliver(...) — admin OR CEO uploads + delivers the final video
--   • advance_stage(...)   — manager manual override, FORWARD-ONLY (audited)
-- All state changes go through these engine RPCs (never raw UPDATEs), each
-- writing a task_events row, consistent with 0002_engine.sql.
-- ============================================================================

alter table projects add column if not exists script_waived boolean not null default false;

-- ── Skip the script step (script is guided, never a hard gate) ───────────────
create or replace function waive_script(p_project uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_stage project_stage;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select current_stage into v_stage from projects where id = p_project for update;
  if v_stage is null then raise exception 'project not found'; end if;
  update projects set script_waived = true where id = p_project;
  insert into task_events(actor_id, event_type, project_id, payload)
  values (auth.uid(), 'script_waived', p_project, jsonb_build_object('manual', true));
end $$;

-- ── Deliver: admin OR CEO uploads proof + marks the project delivered ────────
create or replace function manager_deliver(p_project uuid, p_url text, p_image_url text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_stage project_stage; v_task uuid; v_label text;
begin
  if not is_manager() then raise exception 'managers only'; end if;
  if coalesce(p_url, '') = '' then raise exception 'attach the upload proof link before delivering'; end if;
  select current_stage into v_stage from projects where id = p_project for update;
  if v_stage is null then raise exception 'project not found'; end if;
  if v_stage = 'uploaded' then raise exception 'already delivered'; end if;

  -- Reuse the latest upload task if one exists (e.g. created by submit_review),
  -- otherwise create one owned by the manager doing the delivery.
  select id into v_task from tasks
   where project_id = p_project and type = 'upload' order by created_at desc limit 1;
  if v_task is null then
    insert into tasks(project_id, type, assignee_id, status, started_at)
    values (p_project, 'upload', auth.uid(), 'in_progress', now())
    returning id into v_task;
  end if;

  update tasks set proof_url = p_url, proof_image_url = p_image_url, status = 'completed',
         started_at = coalesce(started_at, now()), completed_at = now(),
         actual_minutes = coalesce(actual_minutes, 1)
   where id = v_task;

  update projects set current_stage = 'uploaded', status = 'completed', upload_date = current_date
   where id = p_project;

  insert into task_events(actor_id, event_type, task_id, project_id, from_state, to_state, payload)
  values (auth.uid(), 'transition', v_task, p_project, v_stage::text, 'uploaded',
          jsonb_build_object('type', 'upload', 'proof', p_url, 'by_manager', true));

  v_label := _project_label(p_project);
  perform _notify_role('admin', 'uploaded', 'Delivered', v_label);
  perform _notify_role('ceo', 'uploaded', 'Delivered', v_label);
  return jsonb_build_object('project_id', p_project, 'task_id', v_task);
end $$;

-- ── Manual forward-only stage advance (skip a step) ─────────────────────────
create or replace function advance_stage(p_project uuid, p_note text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_stage project_stage; v_next project_stage;
        v_order project_stage[] := array['confirmed','shoot_pending','shooting_done','editing','client_review','upload_ready','uploaded']::project_stage[];
        v_idx int;
begin
  if not is_manager() then raise exception 'managers only'; end if;
  select current_stage into v_stage from projects where id = p_project for update;
  if v_stage is null then raise exception 'project not found'; end if;
  if v_stage = 'uploaded' then raise exception 'already at the final stage'; end if;

  v_idx := array_position(v_order, v_stage);
  v_next := v_order[v_idx + 1];

  update projects set current_stage = v_next,
         client_approval = case when v_next in ('upload_ready','uploaded') then 'approved' else client_approval end
   where id = p_project;

  insert into task_events(actor_id, event_type, project_id, from_state, to_state, payload)
  values (auth.uid(), 'stage', p_project, v_stage::text, v_next::text,
          jsonb_build_object('manual', true, 'note', nullif(p_note,'')));

  perform _rollup_status(p_project);
  return jsonb_build_object('project_id', p_project, 'from', v_stage, 'to', v_next);
end $$;
