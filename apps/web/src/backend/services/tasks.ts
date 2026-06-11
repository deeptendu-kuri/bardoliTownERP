import { getDb, commit } from '../db/store';
import { actor } from './rbac';
import { fail } from '../engine/errors';
import { transitionTask, type TransitionOpts } from '../engine/engine';
import { appendEvent } from '../engine/effects';
import { uid, nowIso } from '../lib/ids';
import type { Task } from '../models/types';

export function startTask(actorId: string, taskId: string, estimateMinutes: number): Task {
  const db = getDb();
  const t = transitionTask(db, actorId, taskId, 'in_progress', { estimateMinutes });
  commit();
  return t;
}

export function completeTask(
  actorId: string,
  taskId: string,
  opts: Pick<TransitionOpts, 'delayNote' | 'actualMinutes'> = {},
): Task {
  const db = getDb();
  const t = transitionTask(db, actorId, taskId, 'completed', opts);
  commit();
  return t;
}

export function blockTask(actorId: string, taskId: string, reason: string): Task {
  const db = getDb();
  const t = transitionTask(db, actorId, taskId, 'blocked', { blockedReason: reason });
  commit();
  return t;
}

export function resumeTask(actorId: string, taskId: string): Task {
  const db = getDb();
  const t = transitionTask(db, actorId, taskId, 'in_progress');
  commit();
  return t;
}

/** Re-estimate a running task (not a status change; audited as an estimate event). */
export function reestimate(actorId: string, taskId: string, estimateMinutes: number): Task {
  const db = getDb();
  const a = actor(db, actorId);
  const t = db.tasks.find((x) => x.id === taskId);
  if (!t) return fail('not_found', 'Task not found.');
  if (t.assignee_id !== actorId && a.role !== 'admin') return fail('forbidden', 'Not your task.');
  if (!estimateMinutes || estimateMinutes <= 0) return fail('validation', 'Enter a valid estimate.');
  const prev = t.estimate_minutes;
  t.estimate_minutes = estimateMinutes;
  appendEvent(db, { event_type: 'estimate', task_id: t.id, project_id: t.project_id, actor_id: actorId, payload: { from: prev, to: estimateMinutes } });
  commit();
  return t;
}

/** Log freelancer hours against a task; snapshots the current rate (doc 03 §5). */
export function logHours(actorId: string, taskId: string, minutes: number): void {
  const db = getDb();
  const a = actor(db, actorId);
  const t = db.tasks.find((x) => x.id === taskId);
  if (!t) return fail('not_found', 'Task not found.');
  if (t.assignee_id !== actorId && a.role !== 'admin') return fail('forbidden', 'Not your task.');
  if (!minutes || minutes <= 0) return fail('validation', 'Enter minutes greater than zero.');
  const profileId = t.assignee_id ?? actorId;
  const profile = db.profiles.find((p) => p.id === profileId);
  db.time_logs.push({
    id: uid(),
    task_id: t.id,
    profile_id: profileId,
    minutes,
    hourly_rate_snapshot: profile?.hourly_rate ?? null,
    logged_at: nowIso(),
  });
  appendEvent(db, { event_type: 'hours', task_id: t.id, project_id: t.project_id, actor_id: actorId, payload: { minutes } });
  commit();
}
