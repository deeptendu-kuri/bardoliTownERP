import type {
  Profile,
  Client,
  Project,
  Task,
  TaskEvent,
  ReviewRound,
  TimeLog,
  Notification,
  TeamFeedPost,
  ProjectNote,
  AiSuggestion,
} from '../models/types';

/**
 * The whole demo database, held as plain collections. This is the shape the
 * StoragePort persists. In production each of these is a Postgres table guarded
 * by RLS; here they are arrays and the guards live in the service layer.
 */
export interface Database {
  profiles: Profile[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  task_events: TaskEvent[];
  review_rounds: ReviewRound[];
  time_logs: TimeLog[];
  notifications: Notification[];
  team_feed: TeamFeedPost[];
  project_notes: ProjectNote[];
  ai_suggestions: AiSuggestion[];
  meta: {
    seed_version: number;
    project_seq: number;
    event_seq: number;
  };
  session: {
    profile_id: string | null;
  };
}

/**
 * The persistence seam. Today: LocalStorageAdapter. Swap a SupabaseAdapter in
 * here later and nothing above the service layer changes.
 */
export interface StoragePort {
  load(): Database | null;
  save(db: Database): void;
  clear(): void;
}
