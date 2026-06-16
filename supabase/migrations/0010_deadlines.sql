-- ============================================================================
-- 0010_deadlines.sql — overdue scan. Notifies the assignee + admins once per day
-- about tasks past their due date that aren't done. Schedule daily via pg_cron
-- (see the cron.schedule call applied separately / in the dashboard).
-- ============================================================================
create or replace function scan_overdue()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into notifications(recipient_id, channel, type, title, body, payload)
  select t.assignee_id, 'in_app', 'overdue', 'Task overdue',
         _project_label(t.project_id) || ' — ' || t.type, jsonb_build_object('task_id', t.id)
  from tasks t
  where t.status in ('queued', 'in_progress', 'blocked')
    and t.due_date < current_date and t.assignee_id is not null
    and not exists (select 1 from notifications n
                    where n.type = 'overdue' and n.recipient_id = t.assignee_id
                      and n.payload->>'task_id' = t.id::text and n.created_at::date = current_date);
  get diagnostics n = row_count;

  insert into notifications(recipient_id, channel, type, title, body, payload)
  select p.id, 'in_app', 'overdue', 'Task overdue',
         _project_label(t.project_id) || ' — ' || t.type, jsonb_build_object('task_id', t.id)
  from tasks t cross join profiles p
  where p.role = 'admin' and p.is_active
    and t.status in ('queued', 'in_progress', 'blocked') and t.due_date < current_date
    and not exists (select 1 from notifications n
                    where n.type = 'overdue' and n.recipient_id = p.id
                      and n.payload->>'task_id' = t.id::text and n.created_at::date = current_date);
  return n;
end $$;
