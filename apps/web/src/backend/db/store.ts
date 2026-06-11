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

export function getDb(): Database {
  if (db) return db;
  const loaded = adapter.load();
  if (loaded && loaded.meta?.seed_version === SEED_VERSION) {
    db = loaded;
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
