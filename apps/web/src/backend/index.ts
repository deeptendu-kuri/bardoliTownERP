/**
 * The PUBLIC BACKEND API — the only module the UI imports from.
 *
 * Now backed by Supabase: auth via Supabase Auth, writes via security-definer
 * RPCs, reads computed from an RLS-hydrated snapshot (see ./supabase/load).
 * The UI is unchanged from the localStorage era — this is the swap the seam was
 * built for. (The local engine/services remain for unit tests.)
 */

// Auth (Supabase)
export { sendOtp, verifyOtp, loginPassword, setPassword, logout, getCurrentProfile } from './supabase/auth';

// Data hydration
export { ensureLoaded, reloadAll, resetLoaded } from './supabase/load';

// Mutations (RPCs + inserts)
export {
  createLead,
  setLeadStage,
  assignTask,
  submitReview,
  startTask,
  completeTask,
  blockTask,
  resumeTask,
  reestimate,
  logHours,
  addProjectNote,
  markRead,
  markAllRead,
  reassignTask,
  uploadProofImage,
  completeUpload,
  requestAnchor,
  respondAnchor,
  anchorReport,
  anchorComplete,
  addAttachment,
} from './supabase/mutations';
export type { NewLeadInput } from './services/leads';
export type { AssignInput } from './services/assign';
export type { ReviewInput } from './services/review';

// Reads (computed from the hydrated snapshot)
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
  projectDetail,
  assignableAnchors,
  projectAnchors,
  myAnchorRequests,
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
  ProjectDetail,
  DetailTask,
  DetailReview,
  DetailEvent,
  DetailNote,
  AnchorRow,
  MyAnchorRow,
} from './services/queries';

// Notifications + feed (reads from the snapshot)
export { notificationsFor, unreadCount, teamFeed } from './services/notifications';

// Error type + domain types
export { EngineError } from './engine/errors';
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
  AnchorStatus,
  AnchorRequest,
  Attachment,
} from './models/types';
export type { PublicProfile } from './lib/safe';
