import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../lib/hooks';
import { Panel, StatusPill, Card, Input, Select, EmptyState, SkeletonRows, AvatarStack } from '../components/ui/primitives';
import ProjectDetailDrawer from '../features/shared/ProjectDetailDrawer';
import { stageMeta, priorityMeta } from '../lib/status';
import { fmtDate } from '../lib/format';
import type { ProjectStage } from '@/backend';

const STAGES: ProjectStage[] = ['confirmed', 'shoot_pending', 'shooting_done', 'editing', 'client_review', 'upload_ready', 'uploaded'];
const isRecent = (iso: string) => Date.now() - Date.parse(iso) < 3 * 86_400_000;
const within30 = (iso: string) => Date.now() - Date.parse(iso) < 30 * 86_400_000;

export default function ProjectsBoard() {
  const { data: projects, isLoading } = useProjects();
  const [params, setParams] = useSearchParams();
  const openId = params.get('p');
  const setOpen = (id: string | null) => setParams(id ? { p: id } : {}, { replace: true });
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | ProjectStage>('all');
  const [win, setWin] = useState<'30d' | 'all'>('30d');

  if (isLoading) return <SkeletonRows rows={6} />;
  let rows = projects ?? [];
  if (win === '30d') rows = rows.filter((p) => within30(p.created_at) || p.current_stage !== 'uploaded');
  if (q.trim()) {
    const s = q.toLowerCase();
    rows = rows.filter((p) => p.client_name.toLowerCase().includes(s) || p.title.toLowerCase().includes(s));
  }
  if (stage !== 'all') rows = rows.filter((p) => p.current_stage === stage);
  const groups = STAGES.map((st) => ({ st, items: rows.filter((p) => p.current_stage === st) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Projects</h1>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client or title…" className="sm:max-w-xs" />
        <div className="flex gap-2">
          <Select value={stage} onChange={(e) => setStage(e.target.value as 'all' | ProjectStage)} className="flex-1 sm:flex-none sm:w-[180px]">
            <option value="all">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{stageMeta[s].label}</option>)}
          </Select>
          <Select value={win} onChange={(e) => setWin(e.target.value as '30d' | 'all')} className="flex-1 sm:flex-none sm:w-[160px]">
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </Select>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card className="p-6"><EmptyState message="No projects match your filters." /></Card>
      ) : (
        groups.map((g) => (
          <Panel key={g.st} title={<span className="flex items-center gap-2">{stageMeta[g.st].label}<span className="mono text-xs text-ink-dim">{g.items.length}</span></span>}>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.items.map((p) => {
                const names = [...new Set(p.team.map((t) => t.name))];
                return (
                  <button key={p.id} onClick={() => setOpen(p.id)} className="w-full min-w-0 overflow-hidden rounded-sm border border-line bg-surface2 p-3 text-left transition hover:border-line2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-xs text-ink-dim">#{p.project_no}</span>
                      <StatusPill label={priorityMeta[p.priority].label} tone={priorityMeta[p.priority].tone} />
                      {isRecent(p.created_at) && <StatusPill label="New" tone="teal" />}
                    </div>
                    <div className="mt-1 truncate text-sm text-ink">{p.client_name} — {p.title}</div>
                    {p.next.step !== 'done' && p.next.step !== 'cancelled' && (
                      <div
                        className="mono mt-2 inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px]"
                        style={
                          p.next.actionable
                            ? { backgroundColor: 'color-mix(in srgb, var(--amber) 16%, transparent)', color: 'var(--amber)' }
                            : { color: 'var(--ink-dim)' }
                        }
                      >
                        {p.next.actionable ? '▸' : '⏳'} {p.next.label}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {names.length ? <AvatarStack names={names} /> : <span className="mono text-[11px] text-ink-dim">unassigned</span>}
                      <span className="mono text-[11px] text-ink-dim">{fmtDate(p.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        ))
      )}

      {openId && <ProjectDetailDrawer projectId={openId} onClose={() => setOpen(null)} />}
    </div>
  );
}
