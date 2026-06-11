/** Small primitives the simulated backend uses for ids and timestamps.
 *  In the real backend these are Postgres `gen_random_uuid()` / `now()`. */

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

export const nowIso = (): string => new Date().toISOString();

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Days from today as an ISO date (negative = past). */
export const dateFromToday = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const isOverdue = (dueDate: string | null): boolean =>
  !!dueDate && dueDate < todayIso();
