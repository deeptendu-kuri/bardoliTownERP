-- ============================================================================
-- 0015_anchor_project_read.sql — anchors can read the projects they're
-- requested for (so the project number, title and shoot date show on their
-- dashboard). They still cannot read clients or other roles' tasks.
-- ============================================================================
drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (
  is_manager()
  or exists (select 1 from tasks t where t.project_id = projects.id and t.assignee_id = auth.uid())
  or exists (select 1 from anchor_requests a where a.project_id = projects.id and a.anchor_id = auth.uid())
);
