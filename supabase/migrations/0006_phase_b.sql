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
