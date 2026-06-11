import type { LeadStage, TaskStatus } from '../models/types';

/** Legal task status moves (doc 04 §3). */
export const LEGAL_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ['in_progress', 'blocked'],
  in_progress: ['completed', 'blocked'],
  blocked: ['in_progress'],
  completed: [],
};

/** Legal lead pipeline moves (doc 04 §1): forward-adjacent only; lost from any
 *  non-terminal stage. */
export const LEGAL_LEAD_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['proposal', 'lost'],
  proposal: ['won', 'lost'],
  won: [],
  lost: [],
};

export const isLegalTaskMove = (from: TaskStatus, to: TaskStatus): boolean =>
  LEGAL_TASK_TRANSITIONS[from].includes(to);

export const isLegalLeadMove = (from: LeadStage, to: LeadStage): boolean =>
  LEGAL_LEAD_TRANSITIONS[from].includes(to);
