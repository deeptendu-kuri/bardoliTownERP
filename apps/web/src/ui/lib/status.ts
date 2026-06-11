import type { LeadStage, Priority, ProjectStage, TaskStatus, TaskType } from '@/backend';

/** Visual tones — the fixed status→color language from doc 05 §2. */
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'teal' | 'violet' | 'soft';

export const TONE_VAR: Record<Tone, string> = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  blue: 'var(--blue)',
  teal: 'var(--teal)',
  violet: 'var(--violet)',
  soft: 'var(--ink-dim)',
};

interface Meta {
  label: string;
  tone: Tone;
}

export const stageMeta: Record<ProjectStage, Meta> = {
  confirmed: { label: 'Confirmed', tone: 'soft' },
  shoot_pending: { label: 'Shoot pending', tone: 'red' },
  shooting_done: { label: 'Shot', tone: 'blue' },
  editing: { label: 'Editing', tone: 'amber' },
  client_review: { label: 'Client review', tone: 'blue' },
  upload_ready: { label: 'Upload ready', tone: 'teal' },
  uploaded: { label: 'Uploaded', tone: 'green' },
};

export const taskStatusMeta: Record<TaskStatus, Meta> = {
  queued: { label: 'Queued', tone: 'soft' },
  in_progress: { label: 'In progress', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  blocked: { label: 'Blocked', tone: 'red' },
};

export const leadMeta: Record<LeadStage, Meta> = {
  new: { label: 'New', tone: 'red' },
  contacted: { label: 'Contacted', tone: 'amber' },
  qualified: { label: 'Qualified', tone: 'blue' },
  proposal: { label: 'Proposal', tone: 'violet' },
  won: { label: 'Won', tone: 'green' },
  lost: { label: 'Lost', tone: 'soft' },
};

export const priorityMeta: Record<Priority, Meta> = {
  high: { label: 'High', tone: 'red' },
  medium: { label: 'Medium', tone: 'amber' },
  low: { label: 'Low', tone: 'soft' },
};

export const taskTypeLabel: Record<TaskType, string> = {
  shoot: 'Shoot',
  edit: 'Edit',
  reedit: 'Re-edit',
  upload: 'Upload',
};
