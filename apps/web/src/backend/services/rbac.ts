import type { Database } from '../db/types';
import type { Profile } from '../models/types';
import { fail } from '../engine/errors';

/** The acting user, or a thrown auth error. Mirrors `auth.uid()` + profile lookup. */
export function actor(db: Database, actorId: string): Profile {
  const p = db.profiles.find((x) => x.id === actorId);
  if (!p || !p.is_active) return fail('auth', 'You are not signed in.');
  return p;
}

/** Operational CRUD (clients/projects/tasks/reviews) is Admin-only; CEO is
 *  read-only on these tables (doc 02 §3). */
export function requireAdmin(db: Database, actorId: string): Profile {
  const p = actor(db, actorId);
  if (p.role !== 'admin') return fail('forbidden', 'This action is for the Admin desk only.');
  return p;
}

/** Analytics / export — CEO or Admin. */
export function requireManager(db: Database, actorId: string): Profile {
  const p = actor(db, actorId);
  if (p.role !== 'admin' && p.role !== 'ceo') return fail('forbidden', 'Managers only.');
  return p;
}
