import type { Database, StoragePort } from './types';
import { localStorageAdapter } from './localStorageAdapter';
import { buildSeed, SEED_VERSION } from './seed';

/**
 * The store owns the single in-memory Database and persists it through the
 * configured StoragePort. Services read via `getDb()` and persist via `commit()`.
 * Swapping `configureStorage()` is the entire "connect a real DB" story for the
 * persistence layer (the richer move is to replace the service calls with RPCs).
 */
let adapter: StoragePort = localStorageAdapter;
let db: Database | null = null;

export function configureStorage(next: StoragePort): void {
  adapter = next;
  db = null;
}

/** Defensive: ensure every collection exists so a partially-shaped persisted DB
 *  (e.g. saved during a dev HMR mid-edit) never hard-crashes a read. */
function backfill(db: Database): Database {
  db.profiles ??= [];
  db.clients ??= [];
  db.projects ??= [];
  db.tasks ??= [];
  db.task_events ??= [];
  db.review_rounds ??= [];
  db.time_logs ??= [];
  db.notifications ??= [];
  db.team_feed ??= [];
  db.project_notes ??= [];
  db.ai_suggestions ??= [];
  db.meta ??= { seed_version: SEED_VERSION, project_seq: db.projects.length, event_seq: 0 };
  db.session ??= { profile_id: null };
  return db;
}

export function getDb(): Database {
  if (db) return db;
  const loaded = adapter.load();
  if (loaded && loaded.meta?.seed_version === SEED_VERSION) {
    db = backfill(loaded);
  } else {
    db = buildSeed();
    adapter.save(db);
  }
  return db;
}

export function commit(): void {
  if (db) adapter.save(db);
}

/** Wipe the demo and re-seed (used by the "Reset demo" action). */
export function resetDemo(): Database {
  adapter.clear();
  db = buildSeed();
  adapter.save(db);
  return db;
}

export function nextProjectNo(): number {
  const d = getDb();
  d.meta.project_seq += 1;
  return d.meta.project_seq;
}

export function nextEventId(): number {
  const d = getDb();
  d.meta.event_seq += 1;
  return d.meta.event_seq;
}
