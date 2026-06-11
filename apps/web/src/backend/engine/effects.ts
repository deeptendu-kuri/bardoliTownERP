import type { Database } from '../db/types';
import type { Project, Task, TaskEvent, Profile } from '../models/types';
import { nextEventId } from '../db/store';
import { uid, nowIso } from '../lib/ids';

/** Append an immutable audit row (doc 02 §5 — non-negotiable). */
export function appendEvent(
  db: Database,
  e: Partial<TaskEvent> & Pick<TaskEvent, 'event_type'>,
): void {
  db.task_events.push({
    id: nextEventId(),
    task_id: null,
    project_id: null,
    actor_id: null,
    from_state: null,
    to_state: null,
    payload: {},
    created_at: nowIso(),
    ...e,
  });
}

/** Persist an in-app notification (Realtime in production; polled here). */
export function notify(
  db: Database,
  recipientId: string,
  type: string,
  title: string,
  body: string,
): void {
  db.notifications.push({
    id: uid(),
    recipient_id: recipientId,
    channel: 'in_app',
    type,
    title,
    body,
    payload: {},
    read_at: null,
    created_at: nowIso(),
  });
}

/** Post to the simulated WhatsApp "team bot" feed (doc 08). */
export function broadcast(db: Database, type: string, text: string): void {
  db.team_feed.unshift({ id: uid(), type, text, created_at: nowIso() });
}

export const admins = (db: Database): Profile[] =>
  db.profiles.filter((p) => p.role === 'admin' && p.is_active);
export const ceos = (db: Database): Profile[] =>
  db.profiles.filter((p) => p.role === 'ceo' && p.is_active);

export const notifyAdmins = (db: Database, type: string, title: string, body: string): void =>
  admins(db).forEach((a) => notify(db, a.id, type, title, body));
export const notifyCeos = (db: Database, type: string, title: string, body: string): void =>
  ceos(db).forEach((c) => notify(db, c.id, type, title, body));

/** Roll up project.status from its tasks (doc 04 §2). */
export function recomputeStatus(project: Project, tasks: Task[]): void {
  const mine = tasks.filter((t) => t.project_id === project.id);
  if (project.current_stage === 'uploaded') {
    project.status = 'completed';
  } else if (mine.some((t) => t.status !== 'queued')) {
    project.status = 'in_progress';
  } else {
    project.status = 'pending';
  }
}

export const minutesBetween = (startIso: string | null, endIso: string): number => {
  if (!startIso) return 0;
  return Math.max(1, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
};

export const nameOf = (db: Database, profileId: string | null): string =>
  db.profiles.find((p) => p.id === profileId)?.full_name ?? 'Unassigned';

/** "Client — Project title" — the label used in notifications and the feed. */
export function projectLabel(db: Database, project: Project): string {
  const client = db.clients.find((c) => c.id === project.client_id);
  return `${client?.name ?? 'Client'} — ${project.title}`;
}
