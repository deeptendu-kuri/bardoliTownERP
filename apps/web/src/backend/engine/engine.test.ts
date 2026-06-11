import { describe, it, expect, beforeEach } from 'vitest';
import { configureStorage, getDb } from '../db/store';
import { createMemoryAdapter } from '../db/localStorageAdapter';
import { transitionTask } from './engine';
import { isLegalLeadMove } from './transitions';
import { submitReview } from '../services/review';
import type { Database } from '../db/types';
import type { Task } from '../models/types';

let db: Database;
const adminId = () => db.profiles.find((p) => p.role === 'admin')!.id;
const anotherStaff = (notId: string) => db.profiles.find((p) => p.role === 'staff' && p.id !== notId)!.id;
const queuedShoot = (): Task => db.tasks.find((t) => t.type === 'shoot' && t.status === 'queued')!;

beforeEach(() => {
  configureStorage(createMemoryAdapter());
  db = getDb();
});

describe('task state machine — guards', () => {
  it('rejects starting a task without an estimate', () => {
    const t = queuedShoot();
    expect(() => transitionTask(db, t.assignee_id!, t.id, 'in_progress', {})).toThrowError(/estimate/i);
  });

  it('starts a task with an estimate and stamps started_at', () => {
    const t = queuedShoot();
    const r = transitionTask(db, t.assignee_id!, t.id, 'in_progress', { estimateMinutes: 60 });
    expect(r.status).toBe('in_progress');
    expect(r.estimate_minutes).toBe(60);
    expect(r.started_at).toBeTruthy();
  });

  it('rejects completing an overdue task without a delay note', () => {
    const t = queuedShoot();
    t.due_date = '2000-01-01'; // far past → overdue
    transitionTask(db, t.assignee_id!, t.id, 'in_progress', { estimateMinutes: 60 });
    expect(() => transitionTask(db, t.assignee_id!, t.id, 'completed', {})).toThrowError(/delay note/i);
    const r = transitionTask(db, t.assignee_id!, t.id, 'completed', { delayNote: 'camera issue' });
    expect(r.status).toBe('completed');
    expect(r.delay_note).toBe('camera issue');
  });

  it('requires a reason to block', () => {
    const t = queuedShoot();
    expect(() => transitionTask(db, t.assignee_id!, t.id, 'blocked', {})).toThrowError(/reason/i);
  });
});

describe('task state machine — legality & authorization', () => {
  it('rejects an illegal move (queued → completed)', () => {
    const t = queuedShoot();
    expect(() => transitionTask(db, t.assignee_id!, t.id, 'completed', {})).toThrowError(/cannot move/i);
  });

  it('rejects a non-assignee, non-admin actor', () => {
    const t = queuedShoot();
    const intruder = anotherStaff(t.assignee_id!);
    expect(() => transitionTask(db, intruder, t.id, 'in_progress', { estimateMinutes: 30 })).toThrowError(/assignee or an admin/i);
  });
});

describe('project side effects', () => {
  it('shoot completion advances stage to shooting_done and notifies admin', () => {
    const t = queuedShoot();
    t.due_date = null; // isolate from the late-completion guard
    const before = db.notifications.length;
    transitionTask(db, t.assignee_id!, t.id, 'in_progress', { estimateMinutes: 60 });
    transitionTask(db, t.assignee_id!, t.id, 'completed', {});
    const project = db.projects.find((p) => p.id === t.project_id)!;
    expect(project.current_stage).toBe('shooting_done');
    expect(db.notifications.length).toBeGreaterThan(before);
  });

  it('edit completion lands on client_review, not a skipped stage', () => {
    // A shooting_done project already has its shoot complete and an edit queued.
    const edit = db.tasks.find((t) => t.type === 'edit' && t.status === 'queued')!;
    edit.due_date = null;
    transitionTask(db, edit.assignee_id!, edit.id, 'in_progress', { estimateMinutes: 120 });
    transitionTask(db, edit.assignee_id!, edit.id, 'completed', {});
    expect(db.projects.find((p) => p.id === edit.project_id)!.current_stage).toBe('client_review');
  });
});

describe('review loop', () => {
  it('revisions increments revision_count and creates a reedit task', () => {
    const proj = db.projects.find((p) => p.current_stage === 'client_review')!;
    const before = proj.revision_count;
    submitReview(adminId(), { projectId: proj.id, outcome: 'revisions', feedback: 'tighten the intro' });
    const after = db.projects.find((p) => p.id === proj.id)!;
    expect(after.revision_count).toBe(before + 1);
    expect(after.current_stage).toBe('editing');
    expect(db.tasks.some((t) => t.project_id === proj.id && t.type === 'reedit')).toBe(true);
  });

  it('approval moves to upload_ready and creates an upload task', () => {
    const proj = db.projects.find((p) => p.current_stage === 'client_review')!;
    submitReview(adminId(), { projectId: proj.id, outcome: 'approved' });
    const after = db.projects.find((p) => p.id === proj.id)!;
    expect(after.current_stage).toBe('upload_ready');
    expect(after.client_approval).toBe('approved');
    expect(db.tasks.some((t) => t.project_id === proj.id && t.type === 'upload')).toBe(true);
  });
});

describe('lead pipeline legality', () => {
  it('allows forward-adjacent and lost; rejects skips', () => {
    expect(isLegalLeadMove('new', 'contacted')).toBe(true);
    expect(isLegalLeadMove('proposal', 'won')).toBe(true);
    expect(isLegalLeadMove('new', 'lost')).toBe(true);
    expect(isLegalLeadMove('new', 'won')).toBe(false);
    expect(isLegalLeadMove('won', 'lost')).toBe(false);
  });
});
