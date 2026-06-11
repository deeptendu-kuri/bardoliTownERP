import type { Database } from './types';
import type {
  Profile,
  Client,
  Project,
  Task,
  TaskEvent,
  ReviewRound,
  TimeLog,
  Notification,
  TeamFeedPost,
  ProjectNote,
  Priority,
  ProjectStage,
} from '../models/types';
import { uid } from '../lib/ids';

/** Bump to force the demo to re-seed (clears any stale localStorage shape). */
export const SEED_VERSION = 3;

/** Shared demo password for every seeded account (shown on the login screen). */
export const DEMO_PASSWORD = 'studio123';

const ts = (daysAgo: number, hour = 9): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateAhead = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function profile(p: Partial<Profile> & Pick<Profile, 'full_name' | 'email' | 'role'>): Profile {
  return {
    id: uid(),
    password: DEMO_PASSWORD,
    employment_type: 'employee',
    hourly_rate: null,
    skills: [],
    phone: null,
    is_active: true,
    created_at: ts(150),
    ...p,
  };
}

export function buildSeed(): Database {
  // ── People ────────────────────────────────────────────────────────────────
  const ceo = profile({ full_name: 'Vikram Shah', email: 'ceo@studio.test', role: 'ceo', phone: '+91 90000 00001' });
  const admin = profile({ full_name: 'Priya Mehta', email: 'admin@studio.test', role: 'admin', phone: '+91 90000 00002' });

  const rahul = profile({ full_name: 'Rahul Patel', email: 'rahul@studio.test', role: 'staff', skills: ['shoot', 'edit'], phone: '+91 90000 00010' });
  const saurabh = profile({ full_name: 'Saurabh Desai', email: 'saurabh@studio.test', role: 'staff', skills: ['shoot'], phone: '+91 90000 00011' });
  const neel = profile({ full_name: 'Neel Joshi', email: 'neel@studio.test', role: 'staff', skills: ['edit', 'motion'], phone: '+91 90000 00012' });
  const aniket = profile({ full_name: 'Aniket Rao', email: 'aniket@studio.test', role: 'staff', skills: ['edit'], phone: '+91 90000 00013' });
  const anjali = profile({ full_name: 'Anjali Nair', email: 'anjali@studio.test', role: 'staff', skills: ['shoot', 'edit'], phone: '+91 90000 00014' });
  const mamta = profile({ full_name: 'Mamta Iyer', email: 'mamta@studio.test', role: 'staff', skills: ['edit'], phone: '+91 90000 00015' });

  const karan = profile({ full_name: 'Karan Bhatt', email: 'karan@freelance.test', role: 'staff', employment_type: 'freelancer', hourly_rate: 800, skills: ['shoot'], phone: '+91 90000 00020' });
  const divya = profile({ full_name: 'Divya Shah', email: 'divya@freelance.test', role: 'staff', employment_type: 'freelancer', hourly_rate: 900, skills: ['edit', 'motion'], phone: '+91 90000 00021' });

  const profiles = [ceo, admin, rahul, saurabh, neel, aniket, anjali, mamta, karan, divya];

  // ── Mutable collections + counters ──────────────────────────────────────────
  const clients: Client[] = [];
  const projects: Project[] = [];
  const tasks: Task[] = [];
  const task_events: TaskEvent[] = [];
  const review_rounds: ReviewRound[] = [];
  const time_logs: TimeLog[] = [];
  let projectSeq = 0;
  let eventSeq = 0;

  const logEvent = (e: Partial<TaskEvent> & Pick<TaskEvent, 'event_type'>): void => {
    eventSeq += 1;
    task_events.push({
      id: eventSeq,
      task_id: null,
      project_id: null,
      actor_id: admin.id,
      from_state: null,
      to_state: null,
      payload: {},
      created_at: ts(1),
      ...e,
    });
  };

  // ── Pure leads (not yet won) — populate the pipeline + admin inbox ──────────
  const lead = (
    name: string,
    company: string | null,
    stage: Client['lead_stage'],
    requirements: string,
    daysAgo: number,
    lost_reason: string | null = null,
  ): Client => {
    const c: Client = {
      id: uid(),
      name,
      company,
      contact_phone: '+91 98xxx ' + Math.floor(10000 + clients.length * 137).toString().slice(0, 5),
      contact_email: name.toLowerCase().split(' ')[0] + '@example.com',
      requirements,
      lead_stage: stage,
      lost_reason,
      source: ['Instagram', 'Referral', 'Walk-in', 'Website'][clients.length % 4],
      created_by: admin.id,
      created_at: ts(daysAgo),
      updated_at: ts(Math.max(0, daysAgo - 1)),
    };
    clients.push(c);
    return c;
  };

  lead('Patel Motors', 'Patel Motors Pvt Ltd', 'new', '60s showroom promo for new SUV launch', 1);
  lead('Sunrise Cafe', 'Sunrise Hospitality', 'contacted', 'Instagram reels package, 4 reels/month', 3);
  lead('Riya & Arjun', null, 'qualified', 'Wedding highlight film + teaser', 5);
  lead('Greenleaf Organics', 'Greenleaf Foods', 'proposal', 'Brand story video, 2 min', 7);
  lead('TechNova', 'TechNova Solutions', 'proposal', 'Product explainer + 3 social cutdowns', 9);
  lead('Old Town Diner', 'Old Town F&B', 'lost', 'Menu film — went with in-house', 20, 'went elsewhere');
  lead('Maple Realty', 'Maple Realty', 'lost', 'Property walkthrough — budget', 25, 'price');

  // ── Won projects across every production stage ──────────────────────────────
  interface PSpec {
    client: string;
    company: string | null;
    title: string;
    video_type: string;
    priority: Priority;
    stage: ProjectStage;
    shooter: Profile;
    editor: Profile;
    createdDaysAgo: number;
    revision?: boolean;
    overdue?: boolean;
  }

  const addProject = (s: PSpec): void => {
    const client: Client = {
      id: uid(),
      name: s.client,
      company: s.company,
      contact_phone: '+91 99xxx ' + Math.floor(20000 + projects.length * 211).toString().slice(0, 5),
      contact_email: s.client.toLowerCase().split(' ')[0] + '@example.com',
      requirements: s.title,
      lead_stage: 'won',
      lost_reason: null,
      source: ['Instagram', 'Referral', 'Walk-in', 'Website'][projects.length % 4],
      created_by: admin.id,
      created_at: ts(s.createdDaysAgo + 4),
      updated_at: ts(s.createdDaysAgo),
    };
    clients.push(client);

    projectSeq += 1;
    const stageOrder: ProjectStage[] = [
      'confirmed', 'shoot_pending', 'shooting_done', 'editing', 'client_review', 'upload_ready', 'uploaded',
    ];
    const atOrPast = (st: ProjectStage) => stageOrder.indexOf(s.stage) >= stageOrder.indexOf(st);

    const project: Project = {
      id: uid(),
      project_no: projectSeq,
      client_id: client.id,
      title: s.title,
      video_type: s.video_type,
      priority: s.priority,
      current_stage: s.stage,
      status: s.stage === 'uploaded' ? 'completed' : s.stage === 'confirmed' ? 'pending' : 'in_progress',
      client_approval: atOrPast('upload_ready') ? 'approved' : 'pending',
      revision_count: s.revision ? 1 : 0,
      shoot_date: dateAhead(s.stage === 'shoot_pending' ? (s.overdue ? -1 : 2) : -3),
      editing_date: atOrPast('shooting_done') ? dateAhead(-1) : null,
      upload_date: s.stage === 'uploaded' ? dateAhead(-1) : null,
      created_at: ts(s.createdDaysAgo),
    };
    projects.push(project);
    logEvent({ event_type: 'lead_stage', project_id: project.id, from_state: 'proposal', to_state: 'won', payload: { client_id: client.id }, created_at: project.created_at });

    const mkTask = (t: Partial<Task> & Pick<Task, 'type' | 'status'>): Task => {
      const task: Task = {
        id: uid(),
        project_id: project.id,
        assignee_id: null,
        estimate_minutes: null,
        actual_minutes: null,
        due_date: null,
        delay_note: null,
        blocked_reason: null,
        sort_order: tasks.filter((x) => x.assignee_id === t.assignee_id).length,
        started_at: null,
        completed_at: null,
        created_at: project.created_at,
        ...t,
      };
      tasks.push(task);
      return task;
    };

    // Shoot task — exists for every stage past 'confirmed'
    if (atOrPast('shoot_pending')) {
      const shootDone = atOrPast('shooting_done');
      const shoot = mkTask({
        type: 'shoot',
        assignee_id: s.shooter.id,
        status: shootDone ? 'completed' : 'queued',
        due_date: project.shoot_date,
        estimate_minutes: shootDone ? 120 : null,
        actual_minutes: shootDone ? 135 : null,
        started_at: shootDone ? ts(s.createdDaysAgo - 2, 10) : null,
        completed_at: shootDone ? ts(s.createdDaysAgo - 2, 13) : null,
      });
      if (shootDone) {
        logEvent({ event_type: 'transition', task_id: shoot.id, project_id: project.id, actor_id: s.shooter.id, from_state: 'in_progress', to_state: 'completed', created_at: shoot.completed_at!, payload: { type: 'shoot' } });
        if (s.shooter.employment_type === 'freelancer') {
          time_logs.push({ id: uid(), task_id: shoot.id, profile_id: s.shooter.id, minutes: 135, hourly_rate_snapshot: s.shooter.hourly_rate, logged_at: shoot.completed_at! });
        }
      }
    }

    // Edit / reedit task
    if (atOrPast('shooting_done')) {
      const editComplete = atOrPast('client_review');
      const editing = s.stage === 'editing';
      const edit = mkTask({
        type: 'edit',
        assignee_id: s.editor.id,
        status: editComplete ? 'completed' : editing ? 'in_progress' : 'queued',
        due_date: project.editing_date ?? dateAhead(2),
        estimate_minutes: editing || editComplete ? 240 : null,
        actual_minutes: editComplete ? 255 : null,
        started_at: editing || editComplete ? ts(s.createdDaysAgo - 3, 11) : null,
        completed_at: editComplete ? ts(s.createdDaysAgo - 3, 16) : null,
      });
      if (editComplete) {
        logEvent({ event_type: 'transition', task_id: edit.id, project_id: project.id, actor_id: s.editor.id, from_state: 'in_progress', to_state: 'completed', created_at: edit.completed_at!, payload: { type: 'edit' } });
        if (s.editor.employment_type === 'freelancer') {
          time_logs.push({ id: uid(), task_id: edit.id, profile_id: s.editor.id, minutes: 255, hourly_rate_snapshot: s.editor.hourly_rate, logged_at: edit.completed_at! });
        }
      }
    }

    // Revision loop: a client_review that bounced back to editing
    if (s.revision) {
      review_rounds.push({ id: uid(), project_id: project.id, round_no: 1, sent_at: ts(s.createdDaysAgo - 4), feedback: 'Make the logo bigger and soften the background music.', outcome: 'revisions', created_by: admin.id });
      mkTask({ type: 'reedit', assignee_id: s.editor.id, status: 'in_progress', due_date: dateAhead(1), estimate_minutes: 90, started_at: ts(0, 10) });
      logEvent({ event_type: 'review', project_id: project.id, from_state: 'client_review', to_state: 'editing', created_at: ts(s.createdDaysAgo - 4), payload: { outcome: 'revisions', round: 1 } });
    }

    // Approved review → upload
    if (atOrPast('upload_ready')) {
      review_rounds.push({ id: uid(), project_id: project.id, round_no: s.revision ? 2 : 1, sent_at: ts(s.createdDaysAgo - 5), feedback: null, outcome: 'approved', created_by: admin.id });
      const uploaded = s.stage === 'uploaded';
      const up = mkTask({
        type: 'upload',
        assignee_id: s.editor.id,
        status: uploaded ? 'completed' : 'queued',
        due_date: dateAhead(uploaded ? -1 : 1),
        estimate_minutes: uploaded ? 30 : null,
        actual_minutes: uploaded ? 25 : null,
        started_at: uploaded ? ts(1, 14) : null,
        completed_at: uploaded ? ts(1, 15) : null,
      });
      if (uploaded) {
        logEvent({ event_type: 'transition', task_id: up.id, project_id: project.id, actor_id: s.editor.id, from_state: 'in_progress', to_state: 'completed', created_at: up.completed_at!, payload: { type: 'upload' } });
      }
    }
  };

  addProject({ client: 'Bright Smile Dental', company: 'Bright Smile', title: 'Clinic intro film', video_type: 'Corporate', priority: 'medium', stage: 'confirmed', shooter: rahul, editor: neel, createdDaysAgo: 1 });
  addProject({ client: 'Urban Threads', company: 'Urban Threads', title: 'Festive collection lookbook', video_type: 'Fashion', priority: 'high', stage: 'shoot_pending', shooter: rahul, editor: aniket, createdDaysAgo: 2, overdue: true });
  addProject({ client: 'FitZone Gym', company: 'FitZone', title: 'Membership promo', video_type: 'Promo', priority: 'medium', stage: 'shoot_pending', shooter: saurabh, editor: mamta, createdDaysAgo: 2 });
  addProject({ client: 'Cafe Mocha', company: 'Cafe Mocha', title: 'Reel pack — Sep', video_type: 'Social', priority: 'low', stage: 'shooting_done', shooter: anjali, editor: neel, createdDaysAgo: 4 });
  addProject({ client: 'Sharma Weddings', company: null, title: 'Wedding highlight film', video_type: 'Wedding', priority: 'high', stage: 'editing', shooter: karan, editor: neel, createdDaysAgo: 6 });
  addProject({ client: 'NovaTech', company: 'NovaTech Labs', title: 'Product explainer', video_type: 'Explainer', priority: 'high', stage: 'editing', shooter: saurabh, editor: divya, createdDaysAgo: 6 });
  addProject({ client: 'Lotus Spa', company: 'Lotus Wellness', title: 'Ambience brand film', video_type: 'Brand', priority: 'medium', stage: 'client_review', shooter: rahul, editor: aniket, createdDaysAgo: 8 });
  addProject({ client: 'GreenCart', company: 'GreenCart', title: 'App launch teaser', video_type: 'Promo', priority: 'high', stage: 'client_review', shooter: anjali, editor: mamta, createdDaysAgo: 9, revision: true });
  addProject({ client: 'Heritage Hotel', company: 'Heritage Group', title: 'Property showcase', video_type: 'Hospitality', priority: 'medium', stage: 'upload_ready', shooter: saurabh, editor: neel, createdDaysAgo: 11 });
  addProject({ client: 'Daily Bites', company: 'Daily Bites', title: 'Menu reel', video_type: 'Social', priority: 'low', stage: 'uploaded', shooter: anjali, editor: aniket, createdDaysAgo: 14 });
  addProject({ client: 'AutoKraft', company: 'AutoKraft Motors', title: 'Service center ad', video_type: 'Ad', priority: 'medium', stage: 'uploaded', shooter: rahul, editor: mamta, createdDaysAgo: 18 });

  // ── A few unread notifications + a team feed history ───────────────────────
  const notifications: Notification[] = [
    { id: uid(), recipient_id: admin.id, channel: 'in_app', type: 'edit_completed', title: 'Ready for client review', body: 'Lotus Spa — Ambience brand film (Aniket)', payload: {}, read_at: null, created_at: ts(0, 8) },
    { id: uid(), recipient_id: admin.id, channel: 'in_app', type: 'shoot_completed', title: 'Shoot complete', body: 'Cafe Mocha — Reel pack (Anjali)', payload: {}, read_at: null, created_at: ts(0, 9) },
    { id: uid(), recipient_id: ceo.id, channel: 'in_app', type: 'uploaded', title: 'Delivered', body: 'Daily Bites — Menu reel', payload: {}, read_at: null, created_at: ts(0, 10) },
    { id: uid(), recipient_id: neel.id, channel: 'in_app', type: 'revision_requested', title: 'Revision requested', body: 'GreenCart — make the logo bigger, soften music', payload: {}, read_at: null, created_at: ts(0, 11) },
  ];

  // ── A sample CEO ↔ Admin note thread on a project ──────────────────────────
  const lotus = projects.find((p) => p.title.includes('Ambience'));
  const project_notes: ProjectNote[] = lotus
    ? [
        { id: uid(), project_id: lotus.id, author_id: ceo.id, body: 'Who is editing this one, and are we still on track for the client review this week?', is_question: true, created_at: ts(0, 9) },
        { id: uid(), project_id: lotus.id, author_id: admin.id, body: 'Aniket is on the edit — it just landed in the review queue, relaying to the client today.', is_question: false, created_at: ts(0, 10) },
      ]
    : [];

  const team_feed: TeamFeedPost[] = [
    { id: uid(), type: 'uploaded', text: '🎉 Delivered: Daily Bites — Menu reel', created_at: ts(1, 15) },
    { id: uid(), type: 'review_approved', text: '✅ Client approved: Heritage Hotel — Property showcase', created_at: ts(1, 12) },
    { id: uid(), type: 'edit_completed', text: '📋 Ready for review: Lotus Spa — Ambience brand film (Aniket)', created_at: ts(0, 8) },
    { id: uid(), type: 'shoot_completed', text: '✅ Shoot complete: Cafe Mocha — Reel pack (Anjali)', created_at: ts(0, 9) },
  ];

  return {
    profiles,
    clients,
    projects,
    tasks,
    task_events,
    review_rounds,
    time_logs,
    notifications,
    team_feed,
    project_notes,
    ai_suggestions: [],
    meta: { seed_version: SEED_VERSION, project_seq: projectSeq, event_seq: eventSeq },
    session: { profile_id: null },
  };
}
