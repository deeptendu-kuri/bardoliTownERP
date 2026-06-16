-- 0009_fix_respond_anchor.sql — cast the CASE to anchor_status (same enum-cast
-- rule as 0005). Unblocks anchor accept/decline.
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
