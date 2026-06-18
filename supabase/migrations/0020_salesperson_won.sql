-- ============================================================================
-- 0020_salesperson_won.sql — let a salesperson submit an ALREADY-CONFIRMED lead.
-- When p_confirmed is true the lead lands as 'won' and a project is created
-- immediately (same effect as set_lead_stage → 'won'), so the admin sees a
-- ready-to-assign project instead of a fresh lead to qualify.
-- ============================================================================

drop function if exists submit_lead(text, text, text, text, text, text);

create or replace function submit_lead(
  p_name text, p_company text, p_phone text, p_email text, p_requirements text, p_source text,
  p_confirmed boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role user_role; v_project uuid;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role not in ('salesperson','admin','ceo') then raise exception 'not allowed'; end if;
  if coalesce(nullif(p_name,''), '') = '' then raise exception 'name is required'; end if;

  insert into clients(name, company, contact_phone, contact_email, requirements, source, lead_stage, created_by)
  values (p_name, nullif(p_company,''), nullif(p_phone,''), nullif(p_email,''), nullif(p_requirements,''),
          coalesce(nullif(p_source,''), 'salesperson'),
          (case when p_confirmed then 'won' else 'new' end)::lead_stage, auth.uid())
  returning id into v_id;

  if p_confirmed then
    insert into projects (client_id, title)
    select id, coalesce(left(requirements, 80), name || ' — video') from clients where id = v_id
    returning id into v_project;
    insert into task_events(actor_id, event_type, project_id, payload)
    values (auth.uid(), 'project_created', v_project, jsonb_build_object('client_id', v_id, 'via', 'salesperson'));
    perform _notify_role('admin', 'lead_won', 'New project to assign', _project_label(v_project));
    perform _notify_role('ceo',   'lead_won', 'New confirmed project',  _project_label(v_project));
  else
    perform _notify_role('admin', 'lead_submitted', 'New lead submitted',
      p_name || coalesce(' · ' || nullif(p_company,''), ''));
  end if;
  return v_id;
end $$;
