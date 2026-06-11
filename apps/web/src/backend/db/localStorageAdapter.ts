import type { Database, StoragePort } from './types';

const KEY = 'studio-os:db:v1';

/** The demo persistence: the whole DB serialized to localStorage. */
export const localStorageAdapter: StoragePort = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Database) : null;
    } catch {
      return null;
    }
  },
  save(db) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* quota / private mode — demo degrades to in-memory only */
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};

/** In-memory adapter for unit tests (no persistence between runs). */
export function createMemoryAdapter(): StoragePort {
  let data: Database | null = null;
  return {
    load: () => data,
    save: (db) => {
      data = db;
    },
    clear: () => {
      data = null;
    },
  };
}
