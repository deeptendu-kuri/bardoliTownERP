-- seed_demo.sql — populate projects across every stage + anchor requests in
-- every state, so the dashboards look real for a walkthrough. Run cleanup_demo.sql
-- afterwards to wipe it.
do $$
declare v_staff uuid; v_anchor uuid; v_admin uuid; c uuid; p uuid;
begin
  select pr.id into v_staff  from profiles pr join auth.users u on u.id=pr.id where u.email='deeptendukuri178@gmail.com';
  select pr.id into v_anchor from profiles pr join auth.users u on u.id=pr.id where u.email='anchor1@studio.test';
  select pr.id into v_admin  from profiles pr join auth.users u on u.id=pr.id where u.email='deeptendukuri@gmail.com';

  -- 1) confirmed  (+ anchor: requested)
  insert into clients(name, company, requirements, lead_stage, created_by) values ('Bright Cafe','Bright Cafe','30s Instagram promo','won',v_admin) returning id into c;
  insert into projects(client_id, title, video_type, priority, current_stage, status) values (c,'Instagram promo','Social','medium','confirmed','pending') returning id into p;
  insert into anchor_requests(project_id, anchor_id, status, location, requested_by) values (p, v_anchor, 'requested', 'Bright Cafe, MG Road', v_admin);

  -- 2) shoot_pending  (+ anchor: accepted)
  insert into clients(name, company, requirements, lead_stage, created_by) values ('Patel Motors','Patel Motors','60s showroom promo','won',v_admin) returning id into c;
  insert into projects(client_id, title, video_type, priority, current_stage, status, shoot_date) values (c,'Showroom promo','Ad','high','shoot_pending','in_progress', current_date+2) returning id into p;
  insert into tasks(project_id, type, assignee_id, status, due_date) values (p,'shoot',v_staff,'queued', current_date+2);
  insert into anchor_requests(project_id, anchor_id, status, location, requested_by, responded_at) values (p, v_anchor, 'accepted', 'Patel Motors showroom', v_admin, now());

  -- 3) shooting_done  (+ anchor: reported)
  insert into clients(name, requirements, lead_stage, created_by) values ('FitZone Gym','Membership promo','won',v_admin) returning id into c;
  insert into projects(client_id, title, video_type, priority, current_stage, status) values (c,'Membership promo','Promo','medium','shooting_done','in_progress') returning id into p;
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'shoot',v_staff,'completed',120,130, now()-interval '2 day', now()-interval '2 day'+interval '2 hour');
  insert into tasks(project_id, type, assignee_id, status) values (p,'edit',v_staff,'queued');
  insert into anchor_requests(project_id, anchor_id, status, location, requested_by, responded_at, reported_at) values (p, v_anchor, 'reported', 'FitZone Gym', v_admin, now()-interval '1 day', now());

  -- 4) editing
  insert into clients(name, requirements, lead_stage, created_by) values ('Sharma Weddings','Wedding highlight','won',v_admin) returning id into c;
  insert into projects(client_id, title, video_type, priority, current_stage, status) values (c,'Wedding highlight','Wedding','high','editing','in_progress') returning id into p;
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'shoot',v_staff,'completed',180,190, now()-interval '3 day', now()-interval '3 day'+interval '3 hour');
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, started_at) values (p,'edit',v_staff,'in_progress',240, now()-interval '1 hour');

  -- 5) client_review  (+ anchor: declined)
  insert into clients(name, requirements, lead_stage, created_by) values ('Lotus Spa','Brand film','won',v_admin) returning id into c;
  insert into projects(client_id, title, video_type, priority, current_stage, status) values (c,'Brand film','Brand','medium','client_review','in_progress') returning id into p;
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'shoot',v_staff,'completed',120,120, now()-interval '4 day', now()-interval '4 day'+interval '2 hour');
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'edit',v_staff,'completed',240,255, now()-interval '2 day', now()-interval '2 day'+interval '4 hour');
  insert into anchor_requests(project_id, anchor_id, status, location, requested_by, responded_at) values (p, v_anchor, 'declined', 'Lotus Spa', v_admin, now()-interval '3 day');

  -- 6) upload_ready
  insert into clients(name, requirements, lead_stage, created_by) values ('Heritage Hotel','Property showcase','won',v_admin) returning id into c;
  insert into projects(client_id, title, video_type, priority, current_stage, status, client_approval) values (c,'Property showcase','Hospitality','medium','upload_ready','in_progress','approved') returning id into p;
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'shoot',v_staff,'completed',120,120, now()-interval '5 day', now()-interval '5 day'+interval '2 hour');
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'edit',v_staff,'completed',240,240, now()-interval '3 day', now()-interval '3 day'+interval '4 hour');
  insert into tasks(project_id, type, assignee_id, status, due_date) values (p,'upload',v_staff,'queued', current_date+1);
  insert into review_rounds(project_id, round_no, outcome, created_by) values (p,1,'approved',v_admin);

  -- 7) uploaded  (+ anchor: completed)
  insert into clients(name, requirements, lead_stage, created_by) values ('Daily Bites','Menu reel','won',v_admin) returning id into c;
  insert into projects(client_id, title, video_type, priority, current_stage, status, client_approval, shoot_date, upload_date) values (c,'Menu reel','Social','low','uploaded','completed','approved', current_date-7, current_date-1) returning id into p;
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'shoot',v_staff,'completed',90,90, now()-interval '7 day', now()-interval '7 day'+interval '90 minute');
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at) values (p,'edit',v_staff,'completed',180,180, now()-interval '5 day', now()-interval '5 day'+interval '3 hour');
  insert into tasks(project_id, type, assignee_id, status, estimate_minutes, actual_minutes, started_at, completed_at, proof_url) values (p,'upload',v_staff,'completed',30,25, now()-interval '1 day', now()-interval '1 day'+interval '30 minute', 'https://drive.google.com/menu-reel');
  insert into review_rounds(project_id, round_no, outcome, created_by) values (p,1,'approved',v_admin);
  insert into anchor_requests(project_id, anchor_id, status, location, requested_by, responded_at, reported_at, completed_at) values (p, v_anchor, 'completed', 'Daily Bites kitchen', v_admin, now()-interval '8 day', now()-interval '7 day', now()-interval '7 day'+interval '2 hour');

  -- a few open leads for the pipeline
  insert into clients(name, requirements, lead_stage, created_by) values ('Old Town Diner','Menu film','contacted',v_admin);
  insert into clients(name, requirements, lead_stage, created_by) values ('TechNova','Product explainer','qualified',v_admin);
  insert into clients(name, requirements, lead_stage, created_by) values ('Greenleaf Organics','Brand story','proposal',v_admin);
end $$;
