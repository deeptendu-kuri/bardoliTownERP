import { supabase } from '../db/supabaseClient';
import { setStoreData } from '../db/store';
import type { Database } from '../db/types';

/**
 * Hydrate the in-memory Database cache from Supabase (RLS-guarded — each role
 * only receives the rows it may read). The existing pure query functions then
 * compute every dashboard view from this snapshot, so no read logic is rewritten.
 */
let loadedOnce = false;
let inflight: Promise<void> | null = null;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function reloadAll(): Promise<void> {
  const [
    sessionRes,
    profiles,
    clients,
    projects,
    tasks,
    events,
    reviews,
    timelogs,
    notifs,
    notes,
    anchors,
    scripts,
    atts,
  ] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('profiles').select('*'),
    supabase.from('clients').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('task_events').select('*'),
    supabase.from('review_rounds').select('*'),
    supabase.from('time_logs').select('*'),
    supabase.from('notifications').select('*'),
    supabase.from('project_notes').select('*'),
    supabase.from('anchor_requests').select('*'),
    supabase.from('script_requests').select('*'),
    supabase.from('attachments').select('*'),
  ]);

  const projectRows = (projects.data ?? []) as Database['projects'];

  const db: Database = {
    profiles: (profiles.data ?? []).map((p: Record<string, unknown>) => ({
      ...(p as object),
      hourly_rate: num(p.hourly_rate),
      skills: (p.skills as string[]) ?? [],
    })) as Database['profiles'],
    clients: (clients.data ?? []) as Database['clients'],
    projects: projectRows,
    tasks: (tasks.data ?? []) as Database['tasks'],
    task_events: (events.data ?? []) as Database['task_events'],
    review_rounds: (reviews.data ?? []) as Database['review_rounds'],
    time_logs: (timelogs.data ?? []).map((t: Record<string, unknown>) => ({
      ...(t as object),
      hourly_rate_snapshot: num(t.hourly_rate_snapshot),
    })) as Database['time_logs'],
    notifications: (notifs.data ?? []) as Database['notifications'],
    team_feed: [],
    project_notes: (notes.data ?? []) as Database['project_notes'],
    anchor_requests: (anchors.data ?? []) as Database['anchor_requests'],
    script_requests: (scripts.data ?? []) as Database['script_requests'],
    attachments: (atts.data ?? []) as Database['attachments'],
    ai_suggestions: [],
    meta: {
      seed_version: 0,
      project_seq: projectRows.reduce((m, p) => Math.max(m, p.project_no), 0),
      event_seq: 0,
    },
    session: { profile_id: sessionRes.data.session?.user?.id ?? null },
  };

  setStoreData(db);
  loadedOnce = true;
}

export async function ensureLoaded(): Promise<void> {
  if (loadedOnce) return;
  if (!inflight) inflight = reloadAll().finally(() => { inflight = null; });
  await inflight;
}

export function resetLoaded(): void {
  loadedOnce = false;
}
