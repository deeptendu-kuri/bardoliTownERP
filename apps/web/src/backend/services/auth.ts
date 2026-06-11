import { getDb, commit } from '../db/store';
import { fail } from '../engine/errors';
import { publicProfile, type PublicProfile } from '../lib/safe';

/** Sign in with email + password against the seeded profiles (demo auth). */
export function login(email: string, password: string): PublicProfile {
  const db = getDb();
  const p = db.profiles.find(
    (x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.is_active,
  );
  if (!p || p.password !== password) {
    return fail('bad_credentials', 'Incorrect email or password.');
  }
  db.session.profile_id = p.id;
  commit();
  return publicProfile(p);
}

export function logout(): void {
  const db = getDb();
  db.session.profile_id = null;
  commit();
}

export function currentUser(): PublicProfile | null {
  const db = getDb();
  const id = db.session.profile_id;
  if (!id) return null;
  const p = db.profiles.find((x) => x.id === id && x.is_active);
  return p ? publicProfile(p) : null;
}

/** The list of demo accounts, surfaced on the login screen for convenience. */
export function demoAccounts(): { email: string; full_name: string; role: string; employment_type: string }[] {
  const db = getDb();
  return db.profiles.map((p) => ({
    email: p.email,
    full_name: p.full_name,
    role: p.role,
    employment_type: p.employment_type,
  }));
}
