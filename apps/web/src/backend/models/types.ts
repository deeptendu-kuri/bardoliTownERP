/**
 * Data models — the TypeScript mirror of the Postgres schema (doc 03).
 * These types are the contract between the simulated backend and the real
 * Supabase schema. When the DB is connected, the generated `database.types.ts`
 * should line up with these 1:1.
 */

// ── Enums (doc 03 §2) ───────────────────────────────────────────────────────
export type UserRole = 'ceo' | 'admin' | 'staff';
export type EmploymentType = 'employee' | 'freelancer';
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
export type ProjectStage =
  | 'confirmed'
  | 'shoot_pending'
  | 'shooting_done'
  | 'editing'
  | 'client_review'
  | 'upload_ready'
  | 'uploaded';
export type ProjectStatus = 'pending' | 'in_progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
export type Approval = 'pending' | 'approved';
export type TaskType = 'shoot' | 'edit' | 'reedit' | 'upload';
export type TaskStatus = 'queued' | 'in_progress' | 'completed' | 'blocked';
export type ReviewOutcome = 'approved' | 'revisions';
export type NotifChannel = 'in_app' | 'whatsapp';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

// ── Entities ────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  /** Demo-only. In production this lives in Supabase Auth, never in a table. */
  password: string;
  role: UserRole;
  employment_type: EmploymentType;
  hourly_rate: number | null;
  skills: string[];
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  company: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  requirements: string | null;
  lead_stage: LeadStage;
  lost_reason: string | null;
  source: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_no: number;
  client_id: string;
  title: string;
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
}

export interface Task {
  id: string;
  project_id: string;
  type: TaskType;
  assignee_id: string | null;
  status: TaskStatus;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  due_date: string | null;
  delay_note: string | null;
  blocked_reason: string | null;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TaskEvent {
  id: number;
  task_id: string | null;
  project_id: string | null;
  actor_id: string | null;
  event_type: string; // 'transition' | 'assign' | 'estimate' | 'note' | 'lead_stage' | 'review'
  from_state: string | null;
  to_state: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ReviewRound {
  id: string;
  project_id: string;
  round_no: number;
  sent_at: string;
  feedback: string | null;
  outcome: ReviewOutcome | null;
  created_by: string | null;
}

export interface TimeLog {
  id: string;
  task_id: string;
  profile_id: string;
  minutes: number;
  hourly_rate_snapshot: number | null;
  logged_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  channel: NotifChannel;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/** Demo construct: the simulated WhatsApp "team bot" feed (doc 08 §1). */
export interface TeamFeedPost {
  id: string;
  type: string;
  text: string;
  created_at: string;
}

export interface AiSuggestion {
  id: string;
  type: string;
  context: Record<string, unknown>;
  suggestion: Record<string, unknown>;
  status: SuggestionStatus;
  created_at: string;
}
