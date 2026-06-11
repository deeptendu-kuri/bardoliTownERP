import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/backend';
import { toast } from '../components/ui/toast';
import type { Tone } from './status';

// ── Reads ────────────────────────────────────────────────────────────────────
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: () => api.listProjects() });
export const useActiveProjects = () => useQuery({ queryKey: ['projects', 'active'], queryFn: () => api.activeProjects() });
export const useLeads = () => useQuery({ queryKey: ['leads'], queryFn: () => api.listLeads() });
export const usePipeline = () => useQuery({ queryKey: ['pipeline'], queryFn: () => api.pipeline() });
export const useOccupancy = () => useQuery({ queryKey: ['occupancy'], queryFn: () => api.occupancy() });
export const useFreeNow = () => useQuery({ queryKey: ['free-now'], queryFn: () => api.freeNow() });
export const useStaff = () => useQuery({ queryKey: ['staff'], queryFn: () => api.assignableStaff() });
export const useAssignBoard = () => useQuery({ queryKey: ['assign-board'], queryFn: () => api.assignBoard() });
export const useReviewQueue = () => useQuery({ queryKey: ['review-queue'], queryFn: () => api.reviewQueue() });
export const useCeoStats = () => useQuery({ queryKey: ['ceo-stats'], queryFn: () => api.ceoStats() });
export const useAdminStats = () => useQuery({ queryKey: ['admin-stats'], queryFn: () => api.adminStats() });
export const useFreelancerHours = () => useQuery({ queryKey: ['freelancer-hours'], queryFn: () => api.freelancerHours() });
export const useTeamFeed = () => useQuery({ queryKey: ['team-feed'], queryFn: () => api.teamFeed() });

export const useProjectDetail = (id: string | null) =>
  useQuery({ queryKey: ['project-detail', id], queryFn: () => (id ? api.projectDetail(id) : null), enabled: !!id });

export const useMyTasks = (userId: string) =>
  useQuery({ queryKey: ['my-tasks', userId], queryFn: () => api.myTasks(userId) });
export const useNotifications = (userId: string) =>
  useQuery({ queryKey: ['notifications', userId], queryFn: () => api.notificationsFor(userId) });
export const useUnreadCount = (userId: string) =>
  useQuery({ queryKey: ['unread', userId], queryFn: () => api.unreadCount(userId), refetchInterval: 4000 });

// ── Generic mutation: run a backend action, invalidate everything, toast ─────
export function useAction<TArgs>(
  fn: (args: TArgs) => unknown,
  opts: { success?: string | ((r: unknown) => string); tone?: Tone } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => fn(args),
    onSuccess: (r) => {
      qc.invalidateQueries();
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(r) : opts.success, opts.tone ?? 'green');
    },
    onError: (e: unknown) => toast((e as Error)?.message ?? 'Something went wrong.', 'red'),
  });
}
