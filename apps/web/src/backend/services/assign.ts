import { getDb, commit } from '../db/store';
import { requireAdmin } from './rbac';
import { fail } from '../engine/errors';
import { appendEvent, notify, recomputeStatus, projectLabel } from '../engine/effects';
import { uid, nowIso } from '../lib/ids';
import type { Task, TaskType } from '../models/types';

export interface AssignInput {
  projectId: string;
  type: TaskType;
  assigneeId: string;
  dueDate?: string | null;
}

/** Admin assigns a person to a shoot/edit task (doc 04 §2 / doc 06 §3). */
export function assignTask(actorId: string, input: AssignInput): Task {
  const db = getDb();
  requireAdmin(db, actorId);
  const project = db.projects.find((p) => p.id === input.projectId);
  if (!project) return fail('not_found', 'Project not found.');
  const assignee = db.profiles.find((p) => p.id === input.assigneeId && p.is_active);
  if (!assignee) return fail('validation', 'Pick a team member to assign.');

  const task: Task = {
    id: uid(),
    project_id: project.id,
    type: input.type,
    assignee_id: assignee.id,
    status: 'queued',
    estimate_minutes: null,
    actual_minutes: null,
    due_date: input.dueDate ?? null,
    delay_note: null,
    blocked_reason: null,
    sort_order: db.tasks.filter((t) => t.assignee_id === assignee.id).length,
    started_at: null,
    completed_at: null,
    created_at: nowIso(),
  };
  db.tasks.push(task);
  appendEvent(db, { event_type: 'assign', task_id: task.id, project_id: project.id, actor_id: actorId, payload: { type: input.type, assignee_id: assignee.id } });

  // Assigning the shoot on a freshly confirmed project advances the stage.
  if (input.type === 'shoot' && project.current_stage === 'confirmed') {
    const prev = project.current_stage;
    project.current_stage = 'shoot_pending';
    if (input.dueDate) project.shoot_date = input.dueDate;
    appendEvent(db, { event_type: 'stage', project_id: project.id, from_state: prev, to_state: 'shoot_pending' });
  }

  notify(db, assignee.id, 'assigned', 'New task assigned', `${projectLabel(db, project)} — ${input.type}`);
  recomputeStatus(project, db.tasks);
  commit();
  return task;
}
