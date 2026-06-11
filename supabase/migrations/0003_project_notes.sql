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
