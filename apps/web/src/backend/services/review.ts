import { getDb, commit } from '../db/store';
import { requireAdmin } from './rbac';
import { fail } from '../engine/errors';
import {
  appendEvent,
  notify,
  notifyAdmins,
  notifyCeos,
  broadcast,
  recomputeStatus,
  projectLabel,
} from '../engine/effects';
import { uid, nowIso, dateFromToday } from '../lib/ids';
import type { ReviewOutcome, Task } from '../models/types';

export interface ReviewInput {
  projectId: string;
  outcome: ReviewOutcome;
  feedback?: string;
}

/**
 * Admin records the client's verdict after relaying the cut manually (doc 04 §2).
 * approved  → upload_ready + upload task.
 * revisions → editing + reedit task back to the editor; revision_count++.
 */
export function submitReview(actorId: string, input: ReviewInput): void {
  const db = getDb();
  requireAdmin(db, actorId);
  const project = db.projects.find((p) => p.id === input.projectId);
  if (!project) return fail('not_found', 'Project not found.');
  if (project.current_stage !== 'client_review') {
    return fail('illegal_move', 'This project is not awaiting client review.');
  }
  if (input.outcome === 'revisions' && !input.feedback?.trim()) {
    return fail('validation', 'Add the client feedback for a revision.');
  }

  // The editor is whoever did the most recent edit/reedit on this project.
  const editorTask = db.tasks
    .filter((t) => t.project_id === project.id && (t.type === 'edit' || t.type === 'reedit'))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const editorId = editorTask?.assignee_id ?? null;
  const label = projectLabel(db, project);
  const roundNo = db.review_rounds.filter((r) => r.project_id === project.id).length + 1;

  db.review_rounds.push({
    id: uid(),
    project_id: project.id,
    round_no: roundNo,
    sent_at: nowIso(),
    feedback: input.feedback?.trim() || null,
    outcome: input.outcome,
    created_by: actorId,
  });

  if (input.outcome === 'approved') {
    const prev = project.current_stage;
    project.current_stage = 'upload_ready';
    project.client_approval = 'approved';
    appendEvent(db, { event_type: 'review', project_id: project.id, actor_id: actorId, from_state: prev, to_state: 'upload_ready', payload: { outcome: 'approved', round: roundNo } });

    const upload: Task = {
      id: uid(),
      project_id: project.id,
      type: 'upload',
      assignee_id: editorId,
      status: 'queued',
      estimate_minutes: null,
      actual_minutes: null,
      due_date: dateFromToday(1),
      delay_note: null,
      blocked_reason: null,
      sort_order: db.tasks.filter((t) => t.assignee_id === editorId).length,
      started_at: null,
      completed_at: null,
      created_at: nowIso(),
    };
    db.tasks.push(upload);

    notifyAdmins(db, 'review_approved', 'Client approved', label);
    notifyCeos(db, 'review_approved', 'Client approved', label);
    if (editorId) notify(db, editorId, 'upload_ready', 'Ready to upload', label);
    broadcast(db, 'review_approved', `✅ Client approved: ${label}`);
  } else {
    const prev = project.current_stage;
    project.revision_count += 1;
    project.current_stage = 'editing';
    appendEvent(db, { event_type: 'review', project_id: project.id, actor_id: actorId, from_state: prev, to_state: 'editing', payload: { outcome: 'revisions', round: roundNo } });

    const reedit: Task = {
      id: uid(),
      project_id: project.id,
      type: 'reedit',
      assignee_id: editorId,
      status: 'queued',
      estimate_minutes: null,
      actual_minutes: null,
      due_date: dateFromToday(2),
      delay_note: null,
      blocked_reason: null,
      sort_order: db.tasks.filter((t) => t.assignee_id === editorId).length,
      started_at: null,
      completed_at: null,
      created_at: nowIso(),
    };
    db.tasks.push(reedit);

    if (editorId) notify(db, editorId, 'revision_requested', 'Revision requested', input.feedback?.trim() || label);

    // Revision cap escalation (doc 04 §5): allow it, but warn the CEO.
    if (project.revision_count > 3) {
      notifyCeos(db, 'revision_escalation', 'Quality risk — revision 4+', `${label} (revision ${project.revision_count})`);
      broadcast(db, 'revision_escalation', `⚠️ ${label} is on revision ${project.revision_count}`);
    }
  }

  recomputeStatus(project, db.tasks);
  commit();
}
