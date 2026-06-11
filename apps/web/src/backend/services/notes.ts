import { getDb, commit } from '../db/store';
import { requireManager } from './rbac';
import { fail } from '../engine/errors';
import { notifyAdmins, notifyCeos, projectLabel } from '../engine/effects';
import { uid, nowIso } from '../lib/ids';
import type { ProjectNote } from '../models/types';

/**
 * CEO/Admin post a note or question on a project (doc-extension: manager comms).
 * A CEO post pings the admins; an admin post pings the CEO — so questions don't
 * get lost. Notes are private (never broadcast to the team feed).
 */
export function addProjectNote(actorId: string, projectId: string, body: string, isQuestion = false): ProjectNote {
  const db = getDb();
  const actor = requireManager(db, actorId);
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return fail('not_found', 'Project not found.');
  if (!body?.trim()) return fail('validation', 'Write something first.');

  const note: ProjectNote = {
    id: uid(),
    project_id: projectId,
    author_id: actorId,
    body: body.trim(),
    is_question: isQuestion,
    created_at: nowIso(),
  };
  db.project_notes.push(note);

  const label = projectLabel(db, project);
  const verb = isQuestion ? 'Question' : 'Note';
  const preview = note.body.length > 80 ? note.body.slice(0, 80) + '…' : note.body;
  if (actor.role === 'ceo') notifyAdmins(db, 'project_note', `${verb} from the CEO`, `${label}: ${preview}`);
  else notifyCeos(db, 'project_note', `${verb} from the Admin`, `${label}: ${preview}`);

  commit();
  return note;
}
