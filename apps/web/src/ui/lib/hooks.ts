import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/backend';
import { toast } from '../components/ui/toast';
import type { Tone } from './status';

/** Every read first ensures the Supabase snapshot is hydrated, then computes
 *  its view from it. Mutations re-hydrate before invalidating so views refresh. */
const read = <T>(fn: () => T) => async (): Promise<T> => {
  await api.ensureLoaded();
  return fn();
};

// ── Reads ────────────────────────────────────────────────────────────────────
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: read(() => api.listProjects()) });
export const useActiveProjects = () => useQuery({ queryKey: ['projects', 'active'], queryFn: read(() => api.activeProjects()) });
export const useLeads = () => useQuery({ queryKey: ['leads'], queryFn: read(() => api.listLeads()) });
export const usePipeline = () => useQuery({ queryKey: ['pipeline'], queryFn: read(() => api.pipeline()) });
export const useOccupancy = () => useQuery({ queryKey: ['occupancy'], queryFn: read(() => api.occupancy()) });
export const useFreeNow = () => useQuery({ queryKey: ['free-now'], queryFn: read(() => api.freeNow()) });
export const useStaff = () => useQuery({ queryKey: ['staff'], queryFn: read(() => api.assignableStaff()) });
export const useAssignBoard = () => useQuery({ queryKey: ['assign-board'], queryFn: read(() => api.assignBoard()) });
export const useReviewQueue = () => useQuery({ queryKey: ['review-queue'], queryFn: read(() => api.reviewQueue()) });
export const useCeoStats = () => useQuery({ queryKey: ['ceo-stats'], queryFn: read(() => api.ceoStats()) });
export const useAdminStats = () => useQuery({ queryKey: ['admin-stats'], queryFn: read(() => api.adminStats()) });
export const useFreelancerHours = () => useQuery({ queryKey: ['freelancer-hours'], queryFn: read(() => api.freelancerHours()) });
export const useTeamFeed = () => useQuery({ queryKey: ['team-feed'], queryFn: read(() => api.teamFeed()) });
export const useAnchors = () => useQuery({ queryKey: ['anchors'], queryFn: read(() => api.assignableAnchors()) });
export const useMyAnchorRequests = (userId: string) =>
  useQuery({ queryKey: ['my-anchors', userId], queryFn: read(() => api.myAnchorRequests(userId)) });
export const useSidebarCounts = (userId: string) =>
  useQuery({ queryKey: ['sidebar-counts', userId], queryFn: read(() => api.sidebarCounts(userId)) });
export const useNeedsAttention = () => useQuery({ queryKey: ['needs-attention'], queryFn: read(() => api.needsAttention()) });
export const useTeamMembers = () => useQuery({ queryKey: ['team-members'], queryFn: () => api.teamMembers() });
export const useClientDetail = (id: string | null) =>
  useQuery({ queryKey: ['client-detail', id], queryFn: read(() => (id ? api.clientDetail(id) : null)), enabled: !!id });

export const useProjectDetail = (id: string | null) =>
  useQuery({ queryKey: ['project-detail', id], queryFn: read(() => (id ? api.projectDetail(id) : null)), enabled: !!id });
export const useMyTasks = (userId: string) =>
  useQuery({ queryKey: ['my-tasks', userId], queryFn: read(() => api.myTasks(userId)) });
export const useNotifications = (userId: string) =>
  useQuery({ queryKey: ['notifications', userId], queryFn: read(() => api.notificationsFor(userId)) });
export const useUnreadCount = (userId: string) =>
  useQuery({ queryKey: ['unread', userId], queryFn: read(() => api.unreadCount(userId)) });

// ── Generic mutation: run a backend action, re-hydrate, invalidate, toast ────
export function useAction<TArgs>(
  fn: (args: TArgs) => unknown,
  opts: { success?: string | ((r: unknown) => string); tone?: Tone } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => fn(args),
    onSuccess: async (r) => {
      await api.reloadAll();
      qc.invalidateQueries();
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(r) : opts.success, opts.tone ?? 'green');
    },
    onError: (e: unknown) => toast((e as Error)?.message ?? 'Something went wrong.', 'red'),
  });
}
