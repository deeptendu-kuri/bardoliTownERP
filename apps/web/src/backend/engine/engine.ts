import type { Database } from '../db/types';
import type { Project, Task, TaskStatus } from '../models/types';
import { fail } from './errors';
import { isLegalTaskMove } from './transitions';
import {
  appendEvent,
  notifyAdmins,
  notifyCeos,
  broadcast,
  recomputeStatus,
  minutesBetween,
  projectLabel,
  nameOf,
} from './effects';
import { nowIso, todayIso } from '../lib/ids';

export interface TransitionOpts {
  estimateMinutes?: number;
  actualMinutes?: number;
  delayNote?: string;
  blockedReason?: string;
}

/**
 * The single entry point for task status changes (doc 04 §4). Validates the
 * move, authorizes the actor, enforces the guards, applies the update, runs the
 * project side effects, writes an audit row, and emits notifications.
 *
 * Mutates `db` in place; the caller (service layer) commits.
 */
export function transitionTask(
  db: Database,
  actorId: string,
  taskId: string,
  to: TaskStatus,
  opts: TransitionOpts = {},
): Task {
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) return fail('not_found', 'Task not found.');
  const project = db.projects.find((p) => p.id === task.project_id);
  if (!project) return fail('not_found', 'Project not found.');
  const actor = db.profiles.find((p) => p.id === actorId);
  if (!actor) return fail('auth', 'Unknown actor.');

  const from = task.status;

  // (1) Validate the move is legal.
  if (!isLegalTaskMove(from, to)) {
    return fail('illegal_move', `A task cannot move from "${from}" to "${to}".`);
  }

  // (2) Authorize: only the assignee moves their own task; admin may override.
  //     CEO is read-only on operational tables.
  const isAssignee = task.assignee_id === actorId;
  const isAdmin = actor.role === 'admin';
  if (!isAssignee && !isAdmin) {
    return fail('forbidden', 'Only the assignee or an admin can change this task.');
  }

  // (3) Enforce guards + apply column updates.
  if (from === 'queued' && to === 'in_progress') {
    const est = opts.estimateMinutes;
    if (!est || est <= 0) return fail('estimate_required', 'Add a time estimate before starting the task.');
    task.estimate_minutes = est;
    task.started_at = nowIso();
  }

  if (from === 'blocked' && to === 'in_progress') {
    task.blocked_reason = null;
    if (!task.started_at) task.started_at = nowIso();
  }

  if (to === 'blocked') {
    const reason = opts.blockedReason?.trim();
    if (!reason) return fail('reason_required', 'Add a reason when blocking a task.');
    task.blocked_reason = reason;
  }

  if (to === 'completed') {
    const actual = opts.actualMinutes ?? minutesBetween(task.started_at, nowIso());
    const overdue = !!task.due_date && task.due_date < todayIso();
    const overEstimate = !!task.estimate_minutes && actual > task.estimate_minutes;
    const note = opts.delayNote?.trim();
    if ((overdue || overEstimate) && !note) {
      return fail('delay_note_required', 'This task is late or over its estimate — add a delay note to complete it.');
    }
    task.actual_minutes = actual;
    if (note) task.delay_note = note;
    task.completed_at = nowIso();
  }

  task.status = to;

  // (6) Audit the transition.
  appendEvent(db, {
    event_type: 'transition',
    task_id: task.id,
    project_id: project.id,
    actor_id: actorId,
    from_state: from,
    to_state: to,
    payload: { type: task.type },
  });

  // (5) Project stage side effects + (7) notifications.
  applyProjectSideEffects(db, project, task, to);

  // Roll up project.status.
  recomputeStatus(project, db.tasks);

  return task;
}

function setStage(db: Database, project: Project, next: Project['current_stage']): void {
  const prev = project.current_stage;
  project.current_stage = next;
  appendEvent(db, { event_type: 'stage', project_id: project.id, from_state: prev, to_state: next });
}

function applyProjectSideEffects(db: Database, project: Project, task: Task, to: TaskStatus): void {
  const label = projectLabel(db, project);
  const who = nameOf(db, task.assignee_id);

  if (task.type === 'shoot' && to === 'completed') {
    setStage(db, project, 'shooting_done');
    notifyAdmins(db, 'shoot_completed', 'Shoot complete', `${label} (${who})`);
    broadcast(db, 'shoot_completed', `✅ Shoot complete: ${label} (${who})`);
  }

  if (task.type === 'edit' || task.type === 'reedit') {
    if (to === 'in_progress' && project.current_stage === 'shooting_done') {
      setStage(db, project, 'editing');
    }
    if (to === 'completed') {
      setStage(db, project, 'client_review');
      notifyAdmins(db, 'edit_completed', 'Ready for client review', `${label} (${who})`);
      broadcast(db, 'edit_completed', `📋 Ready for review: ${label} (${who})`);
    }
  }

  if (task.type === 'upload' && to === 'completed') {
    setStage(db, project, 'uploaded');
    project.status = 'completed';
    project.upload_date = todayIso();
    notifyAdmins(db, 'uploaded', 'Delivered', label);
    notifyCeos(db, 'uploaded', 'Delivered', label);
    broadcast(db, 'uploaded', `🎉 Delivered: ${label}`);
  }
}
