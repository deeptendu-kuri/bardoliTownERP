-- ============================================================================
-- 0011_review_assignee.sql — at client review, let the admin choose WHO the
-- re-edit (reopened task) goes to, instead of always the last editor.
-- ============================================================================
drop function if exists submit_review(uuid, review_outcome, text);

create or replace function submit_review(p_project uuid, p_outcome review_outcome, p_feedback text default null, p_assignee uuid default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_stage project_stage; v_editor uuid; v_round int; v_label text; v_target uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select current_stage into v_stage from projects where id = p_project for update;
  if v_stage is null then raise exception 'project not found'; end if;
  if v_stage <> 'client_review' then raise exception 'project is not awaiting review'; end if;
  if p_outcome = 'revisions' and coalesce(p_feedback, '') = '' then raise exception 'feedback required'; end if;

  select assignee_id into v_editor from tasks
   where project_id = p_project and type in ('edit', 'reedit') order by created_at desc limit 1;
  v_target := coalesce(p_assignee, v_editor);
  select coalesce(max(round_no), 0) + 1 into v_round from review_rounds where project_id = p_project;
  v_label := _project_label(p_project);

  insert into review_rounds(project_id, round_no, feedback, outcome, created_by)
  values (p_project, v_round, nullif(p_feedback, ''), p_outcome, auth.uid());

  if p_outcome = 'approved' then
    update projects set current_stage = 'upload_ready', client_approval = 'approved' where id = p_project;
    insert into tasks(project_id, type, assignee_id, status, due_date)
    values (p_project, 'upload', v_target, 'queued', current_date + 1);
    insert into task_events(actor_id, event_type, project_id, from_state, to_state, payload)
    values (auth.uid(), 'review', p_project, 'client_review', 'upload_ready', jsonb_build_object('round', v_round));
    perform _notify_role('admin', 'review_approved', 'Client approved', v_label);
    perform _notify_role('ceo', 'review_approved', 'Client approved', v_label);
    if v_target is not null then perform _notify(v_target, 'upload_ready', 'Ready to upload', v_label); end if;
  else
    update projects set current_stage = 'editing', revision_count = revision_count + 1 where id = p_project;
    insert into tasks(project_id, type, assignee_id, status, due_date)
    values (p_project, 'reedit', v_target, 'queued', current_date + 2);
    insert into task_events(actor_id, event_type, project_id, from_state, to_state, payload)
    values (auth.uid(), 'review', p_project, 'client_review', 'editing', jsonb_build_object('round', v_round, 'assignee', v_target));
    if v_target is not null then perform _notify(v_target, 'revision_requested', 'Revision requested', coalesce(p_feedback, v_label)); end if;
    if (select revision_count from projects where id = p_project) > 3 then
      perform _notify_role('ceo', 'revision_escalation', 'Quality risk — revision 4+', v_label);
    end if;
  end if;

  perform _rollup_status(p_project);
  return jsonb_build_object('project_id', p_project, 'outcome', p_outcome);
end $$;
