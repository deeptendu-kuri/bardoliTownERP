import { getDb, commit } from '../db/store';
import type { Notification, TeamFeedPost } from '../models/types';

export function notificationsFor(userId: string): Notification[] {
  const db = getDb();
  return db.notifications
    .filter((n) => n.recipient_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function unreadCount(userId: string): number {
  const db = getDb();
  return db.notifications.filter((n) => n.recipient_id === userId && !n.read_at).length;
}

export function markRead(userId: string, id: string): void {
  const db = getDb();
  const n = db.notifications.find((x) => x.id === id && x.recipient_id === userId);
  if (n && !n.read_at) {
    n.read_at = new Date().toISOString();
    commit();
  }
}

export function markAllRead(userId: string): void {
  const db = getDb();
  const stamp = new Date().toISOString();
  let changed = false;
  for (const n of db.notifications) {
    if (n.recipient_id === userId && !n.read_at) {
      n.read_at = stamp;
      changed = true;
    }
  }
  if (changed) commit();
}

export function teamFeed(): TeamFeedPost[] {
  const db = getDb();
  return db.team_feed.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}
