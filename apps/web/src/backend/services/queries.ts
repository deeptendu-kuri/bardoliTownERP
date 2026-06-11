import { getDb } from '../db/store';
import { publicProfile, type PublicProfile } from '../lib/safe';
import { todayIso } from '../lib/ids';
import type {
  Client,
  LeadStage,
  Priority,
  Project,
  ProjectStage,
  ProjectStatus,
  Approval,
  TaskStatus,
  TaskType,
} from '../models/types';

// ── DTOs (the read shapes the UI consumes) ──────────────────────────────────
export interface TeamMemberOnProject {
  id: string;
  name: string;
  type: TaskType;
  status: TaskStatus;
}
export interface ProjectRow {
  id: string;
  project_no: number;
  title: string;
  client_name: string;
  video_type: string | null;
  priority: Priority;
  current_stage: ProjectStage;
  status: ProjectStatus;
  client_approval: Approval;
  revision_count: number;
  shoot_date: string | null;
  editing_date: string | null;
  upload_date: string | null;
  created_at: string;
  team: TeamMemberOnProject[];
}
export interface OccupancyRow {
  profile_id: string;
  name: string;
  employment_type: string;
  active_count: number;
  load_pct: number;
  current: { label: string; stage: ProjectStage } | null;
}
export interface PipelineRow {
  stage: LeadStage | 'delivered';
  count: number;
}
export interface MyTaskRow {
  id: string;
  type: TaskType;
  status: TaskStatus;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  due_date: string | null;
  delay_note: string | null;
  blocked_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  project_id: string;
  project_no: number;
  project_title: string;
  client_name: string;
  priority: Priority;
  video_type: string | null;
  current_stage: ProjectStage;
  feedback: string | null;
}
export interface FreeNowRow {
  profile_id: string;
  name: string;
  skills: string[];
  load_pct: number;
  queued_count: number;
}
export interface AssignNeed {
  project_id: string;
  project_no: number;
  title: string;
  client_name: string;
  priority: Priority;
  current_stage: ProjectStage;
  needs: TaskType[];
}

const STAGE_LABEL: Record<ProjectStage, string> = {
  confirmed: 'Confirmed',
  shoot_pending: 'Shoot pending',
  shooting_done: 'Shot',
  editing: 'Editing',
  client_review: 'Client review',
  upload_ready: 'Upload ready',
  uploaded: 'Uploaded',
};

const clientName = (db: ReturnType<typeof getDb>, id: string): string =>
  db.clients.find((c) => c.id === id)?.name ?? 'Client';
const profName = (db: ReturnType<typeof getDb>, id: string | null): string =>
  db.profiles.find((p) => p.id === id)?.full_name ?? 'Unassigned';

function loadFor(db: ReturnType<typeof getDb>, profileId: string): { active: number; pct: number } {
  const active = db.tasks.filter(
    (t) => t.assignee_id === profileId && t.status !== 'completed',
  );
  const weight = active.reduce((sum, t) => sum + (t.status === 'queued' ? 20 : 40), 0);
  return { active: active.length, pct: Math.min(100, weight) };
}

// ── Projects ────────────────────────────────────────────────────────────────
export function listProjects(): ProjectRow[] {
  const db = getDb();
  return db.projects
    .map((p) => toProjectRow(db, p))
    .sort((a, b) => b.project_no - a.project_no);
}

export function activeProjects(): ProjectRow[] {
  return listProjects().filter((p) => p.current_stage !== 'uploaded');
}

function toProjectRow(db: ReturnType<typeof getDb>, p: Project): ProjectRow {
  const team: TeamMemberOnProject[] = db.tasks
    .filter((t) => t.project_id === p.id && t.assignee_id)
    .map((t) => ({ id: t.assignee_id!, name: profName(db, t.assignee_id), type: t.type, status: t.status }));
  return {
    id: p.id,
    project_no: p.project_no,
    title: p.title,
    client_name: clientName(db, p.client_id),
    video_type: p.video_type,
    priority: p.priority,
    current_stage: p.current_stage,
    status: p.status,
    client_approval: p.client_approval,
    revision_count: p.revision_count,
    shoot_date: p.shoot_date,
    editing_date: p.editing_date,
    upload_date: p.upload_date,
    created_at: p.created_at,
    team,
  };
}

// ── Leads ───────────────────────────────────────────────────────────────────
export function listLeads(): Client[] {
  const db = getDb();
  return db.clients
    .filter((c) => c.lead_stage !== 'won')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function pipeline(): PipelineRow[] {
  const db = getDb();
  const stages: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];
  const rows: PipelineRow[] = stages.map((stage) => ({
    stage,
    count: db.clients.filter((c) => c.lead_stage === stage).length,
  }));
  rows.push({ stage: 'delivered', count: db.projects.filter((p) => p.current_stage === 'uploaded').length });
  return rows;
}

// ── Occupancy / who's free ──────────────────────────────────────────────────
export function occupancy(): OccupancyRow[] {
  const db = getDb();
  return db.profiles
    .filter((p) => p.role === 'staff' && p.is_active)
    .map((p) => {
      const { active, pct } = loadFor(db, p.id);
      const inProgress = db.tasks.find((t) => t.assignee_id === p.id && t.status === 'in_progress');
      const proj = inProgress ? db.projects.find((x) => x.id === inProgress.project_id) : undefined;
      return {
        profile_id: p.id,
        name: p.full_name,
        employment_type: p.employment_type,
        active_count: active,
        load_pct: pct,
        current: proj ? { label: `${clientName(db, proj.client_id)} — ${proj.title}`, stage: proj.current_stage } : null,
      };
    })
    .sort((a, b) => b.load_pct - a.load_pct);
}

export function freeNow(): FreeNowRow[] {
  const db = getDb();
  return db.profiles
    .filter((p) => p.role === 'staff' && p.is_active)
    .map((p) => {
      const { pct } = loadFor(db, p.id);
      return {
        profile_id: p.id,
        name: p.full_name,
        skills: p.skills,
        load_pct: pct,
        queued_count: db.tasks.filter((t) => t.assignee_id === p.id && t.status === 'queued').length,
      };
    })
    .sort((a, b) => a.load_pct - b.load_pct);
}

export function assignableStaff(): PublicProfile[] {
  const db = getDb();
  return db.profiles.filter((p) => p.role === 'staff' && p.is_active).map(publicProfile);
}

// ── Assign board: projects still missing a shoot or edit owner ───────────────
export function assignBoard(): AssignNeed[] {
  const db = getDb();
  const out: AssignNeed[] = [];
  for (const p of db.projects) {
    if (p.current_stage === 'uploaded' || p.current_stage === 'upload_ready') continue;
    const hasShoot = db.tasks.some((t) => t.project_id === p.id && t.type === 'shoot');
    const hasEdit = db.tasks.some((t) => t.project_id === p.id && (t.type === 'edit' || t.type === 'reedit'));
    const needs: TaskType[] = [];
    if (!hasShoot) needs.push('shoot');
    if (!hasEdit) needs.push('edit');
    if (needs.length === 0) continue;
    out.push({
      project_id: p.id,
      project_no: p.project_no,
      title: p.title,
      client_name: clientName(db, p.client_id),
      priority: p.priority,
      current_stage: p.current_stage,
      needs,
    });
  }
  return out.sort((a, b) => a.project_no - b.project_no);
}

// ── Review queue ────────────────────────────────────────────────────────────
export interface ReviewItem {
  project_id: string;
  project_no: number;
  title: string;
  client_name: string;
  editor_name: string;
  revision_count: number;
  last_feedback: string | null;
}
export function reviewQueue(): ReviewItem[] {
  const db = getDb();
  return db.projects
    .filter((p) => p.current_stage === 'client_review')
    .map((p) => {
      const editorTask = db.tasks
        .filter((t) => t.project_id === p.id && (t.type === 'edit' || t.type === 'reedit'))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const lastRev = db.review_rounds
        .filter((r) => r.project_id === p.id && r.outcome === 'revisions')
        .sort((a, b) => b.round_no - a.round_no)[0];
      return {
        project_id: p.id,
        project_no: p.project_no,
        title: p.title,
        client_name: clientName(db, p.client_id),
        editor_name: profName(db, editorTask?.assignee_id ?? null),
        revision_count: p.revision_count,
        last_feedback: lastRev?.feedback ?? null,
      };
    })
    .sort((a, b) => a.project_no - b.project_no);
}

// ── My tasks (staff) ────────────────────────────────────────────────────────
export function myTasks(userId: string): { current: MyTaskRow[]; queue: MyTaskRow[]; done: MyTaskRow[] } {
  const db = getDb();
  const rows = db.tasks
    .filter((t) => t.assignee_id === userId)
    .map((t): MyTaskRow => {
      const proj = db.projects.find((p) => p.id === t.project_id)!;
      const lastRev = db.review_rounds
        .filter((r) => r.project_id === t.project_id && r.outcome === 'revisions')
        .sort((a, b) => b.round_no - a.round_no)[0];
      return {
        id: t.id,
        type: t.type,
        status: t.status,
        estimate_minutes: t.estimate_minutes,
        actual_minutes: t.actual_minutes,
        due_date: t.due_date,
        delay_note: t.delay_note,
        blocked_reason: t.blocked_reason,
        started_at: t.started_at,
        completed_at: t.completed_at,
        project_id: proj.id,
        project_no: proj.project_no,
        project_title: proj.title,
        client_name: clientName(db, proj.client_id),
        priority: proj.priority,
        video_type: proj.video_type,
        current_stage: proj.current_stage,
        feedback: t.type === 'reedit' ? lastRev?.feedback ?? null : null,
      };
    });
  const byPriority = (a: MyTaskRow, b: MyTaskRow) => {
    const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return rank[a.priority] - rank[b.priority];
  };
  return {
    current: rows.filter((r) => r.status === 'in_progress' || r.status === 'blocked').sort(byPriority),
    queue: rows.filter((r) => r.status === 'queued').sort(byPriority),
    done: rows.filter((r) => r.status === 'completed').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
  };
}

// ── Dashboard stat rows ─────────────────────────────────────────────────────
export interface CeoStats {
  active_projects: number;
  open_leads: number;
  avg_turnaround_days: number | null;
  utilization_pct: number;
}
export function ceoStats(): CeoStats {
  const db = getDb();
  const open: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal'];
  const delivered = db.projects.filter((p) => p.current_stage === 'uploaded' && p.shoot_date && p.upload_date);
  const turnarounds = delivered.map((p) => {
    const days = Math.round((Date.parse(p.upload_date!) - Date.parse(p.shoot_date!)) / 86_400_000);
    return Math.max(0, days);
  });
  const occ = occupancy();
  return {
    active_projects: db.projects.filter((p) => p.current_stage !== 'uploaded').length,
    open_leads: db.clients.filter((c) => open.includes(c.lead_stage)).length,
    avg_turnaround_days: turnarounds.length ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : null,
    utilization_pct: occ.length ? Math.round(occ.reduce((a, b) => a + b.load_pct, 0) / occ.length) : 0,
  };
}

export interface AdminStats {
  leads_to_action: number;
  to_assign: number;
  awaiting_review: number;
  done_today: number;
}
export function adminStats(): AdminStats {
  const db = getDb();
  const open: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal'];
  const today = todayIso();
  return {
    leads_to_action: db.clients.filter((c) => open.includes(c.lead_stage)).length,
    to_assign: assignBoard().length,
    awaiting_review: db.projects.filter((p) => p.current_stage === 'client_review').length,
    done_today: db.tasks.filter((t) => t.status === 'completed' && (t.completed_at ?? '').slice(0, 10) === today).length,
  };
}

// ── Freelancer hours × rate ─────────────────────────────────────────────────
export interface FreelancerHours {
  profile_id: string;
  name: string;
  hourly_rate: number | null;
  total_minutes: number;
  amount: number;
}
export function freelancerHours(): FreelancerHours[] {
  const db = getDb();
  return db.profiles
    .filter((p) => p.employment_type === 'freelancer')
    .map((p) => {
      const logs = db.time_logs.filter((l) => l.profile_id === p.id);
      const total = logs.reduce((s, l) => s + l.minutes, 0);
      const amount = logs.reduce((s, l) => s + (l.minutes / 60) * (l.hourly_rate_snapshot ?? 0), 0);
      return { profile_id: p.id, name: p.full_name, hourly_rate: p.hourly_rate, total_minutes: total, amount: Math.round(amount) };
    });
}

// ── Excel export rows — exact legacy column order (doc 03 §3) ────────────────
export interface SheetRow {
  'Task No': number;
  Date: string;
  'Client Name': string;
  'Video Type': string;
  'Task Status': string;
  'Lead Stage': string;
  'Current Workflow': string;
  Priority: string;
  'Assigned Employee': string;
  'Shoot Date': string;
  'Editing Date': string;
  'Upload Date': string;
  'Client Approval': string;
}
export function sheetExportRows(): SheetRow[] {
  const db = getDb();
  return db.projects
    .slice()
    .sort((a, b) => a.project_no - b.project_no)
    .map((p) => {
      const ptasks = db.tasks.filter((t) => t.project_id === p.id);
      const assigned = ptasks
        .filter((t) => t.assignee_id)
        .map((t) => `${profName(db, t.assignee_id)}(${t.type})`)
        .join(' / ');
      return {
        'Task No': p.project_no,
        Date: p.created_at.slice(0, 10),
        'Client Name': clientName(db, p.client_id),
        'Video Type': p.video_type ?? '',
        'Task Status': p.status,
        'Lead Stage': 'won',
        'Current Workflow': STAGE_LABEL[p.current_stage],
        Priority: p.priority,
        'Assigned Employee': assigned,
        'Shoot Date': p.shoot_date ?? '',
        'Editing Date': p.editing_date ?? '',
        'Upload Date': p.upload_date ?? '',
        'Client Approval': p.client_approval,
      };
    });
}
