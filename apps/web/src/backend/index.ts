/**
 * The PUBLIC BACKEND API — the only module the UI is allowed to import from.
 *
 * Everything below the frontend (state machine, guards, RBAC, persistence) lives
 * under `src/backend/**` and is reached exclusively through this surface. That is
 * the seam: today these functions mutate a localStorage-backed store; to go live,
 * reimplement them as Supabase RPC/Edge-Function calls and the UI never changes.
 */

// Auth
export { login, logout, currentUser, demoAccounts } from './services/auth';

// Mutations (the "RPCs")
export { createLead, setLeadStage } from './services/leads';
export type { NewLeadInput } from './services/leads';
export { assignTask } from './services/assign';
export type { AssignInput } from './services/assign';
export { submitReview } from './services/review';
export type { ReviewInput } from './services/review';
export {
  startTask,
  completeTask,
  blockTask,
  resumeTask,
  reestimate,
  logHours,
} from './services/tasks';

// Reads (the "views")
export {
  listProjects,
  activeProjects,
  listLeads,
  pipeline,
  occupancy,
  freeNow,
  assignableStaff,
  assignBoard,
  reviewQueue,
  myTasks,
  ceoStats,
  adminStats,
  freelancerHours,
  sheetExportRows,
} from './services/queries';
export type {
  ProjectRow,
  OccupancyRow,
  PipelineRow,
  MyTaskRow,
  FreeNowRow,
  AssignNeed,
  ReviewItem,
  CeoStats,
  AdminStats,
  FreelancerHours,
  SheetRow,
} from './services/queries';

// Notifications + simulated team feed
export {
  notificationsFor,
  unreadCount,
  markRead,
  markAllRead,
  teamFeed,
} from './services/notifications';

// Demo control + error type
export { resetDemo, configureStorage } from './db/store';
export { EngineError } from './engine/errors';
export { DEMO_PASSWORD } from './db/seed';

// Domain types the UI references
export type {
  UserRole,
  LeadStage,
  ProjectStage,
  TaskType,
  TaskStatus,
  Priority,
  ReviewOutcome,
  Client,
  Notification,
  TeamFeedPost,
} from './models/types';
export type { PublicProfile } from './lib/safe';
