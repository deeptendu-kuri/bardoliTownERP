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
