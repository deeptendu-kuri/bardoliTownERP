import { useState } from 'react';
import {
  useCeoStats, useActiveProjects, useOccupancy, usePipeline, useTeamFeed, useFreelancerHours,
} from '../lib/hooks';
import ProjectDetailDrawer from '../features/shared/ProjectDetailDrawer';
import { StatTile, Panel, OccupancyBar, FunnelBar, AvatarStack, StatusPill, Button, EmptyState, Pager } from '../components/ui/primitives';
import { Modal } from '../components/ui/overlays';
import { usePaged } from '../lib/paginate';
import { DataTable, type Column } from '../components/ui/DataTable';
import { stageMeta, leadMeta, type Tone } from '../lib/status';
import { fmtRelative, fmtMoney, fmtMinutes } from '../lib/format';
import { exportSheet } from '../lib/export';
import { toast } from '../components/ui/toast';
import type { ProjectRow, PipelineRow, LeadStage } from '@/backend';

const PIPELINE_TONE: Record<string, Tone> = {
  new: 'red', contacted: 'amber', qualified: 'blue', proposal: 'violet', won: 'green', delivered: 'teal',
};

export default function OverviewPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showActive, setShowActive] = useState(false);
  const stats = useCeoStats().data;
  const projects = useActiveProjects().data ?? [];
  const activePaged = usePaged(projects, 8);
  const occ = useOccupancy().data ?? [];
  const pipe = usePipeline().data ?? [];
  const feed = useTeamFeed().data ?? [];
  const freelancers = useFreelancerHours().data ?? [];
  const maxPipe = Math.max(1, ...pipe.map((p) => p.count));

  const onExport = () => {
    try {
      exportSheet();
      toast('Excel exported — check your downloads.', 'green');
    } catch {
      toast('Export failed.', 'red');
    }
  };

  const floorColumns: Column<ProjectRow>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (p) => (
        <div className="min-w-0">
          <div className="truncate text-ink"><span className="mono text-xs text-ink-dim">#{p.project_no}</span> {p.client_name}</div>
          <div className="truncate text-xs text-ink-dim">{p.title}</div>
        </div>
      ),
    },
    { key: 'stage', header: 'Stage', render: (p) => <StatusPill label={stageMeta[p.current_stage].label} tone={stageMeta[p.current_stage].tone} /> },
    {
      key: 'approval', header: 'Client', render: (p) => (
        <StatusPill label={p.client_approval === 'approved' ? 'Approved' : 'Pending'} tone={p.client_approval === 'approved' ? 'green' : 'soft'} />
      ),
    },
    {
      key: 'team', header: 'Team',
      render: (p) => {
        const names = [...new Set(p.team.map((t) => t.name))];
        return names.length ? <AvatarStack names={names} /> : <span className="mono text-xs text-ink-dim">unassigned</span>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="display text-xl font-semibold">Command Center</h1>
        <Button variant="secondary" onClick={onExport}>⬇ Export Excel</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => setShowActive(true)} className="block text-left transition hover:brightness-110">
          <StatTile label="Active projects" value={stats?.active_projects ?? '—'} hint="tap to view all" tone="amber" />
        </button>
        <StatTile label="Open leads" value={stats?.open_leads ?? '—'} tone="blue" />
        <StatTile label="Avg turnaround" value={stats?.avg_turnaround_days != null ? `${stats.avg_turnaround_days}d` : '—'} hint="shoot → upload" tone="teal" />
        <StatTile label="Team utilisation" value={stats != null ? `${stats.utilization_pct}%` : '—'} tone="green" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Live Production Floor" action={<span className="mono text-[11px] text-ink-dim">tap a row to open</span>}>
            <DataTable columns={floorColumns} rows={projects} getKey={(p) => p.id} onRowClick={(p) => setOpenId(p.id)} empty={<EmptyState message="No active projects." />} />
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Client Pipeline">
            {pipe.map((r: PipelineRow) => (
              <FunnelBar
                key={r.stage}
                label={r.stage === 'delivered' ? 'Delivered' : leadMeta[r.stage as LeadStage].label}
                count={r.count}
                max={maxPipe}
                tone={PIPELINE_TONE[r.stage] ?? 'blue'}
              />
            ))}
          </Panel>

          <Panel title="Team Occupancy">
            {occ.map((p) => (
              <OccupancyBar key={p.profile_id} label={p.name} pct={p.load_pct} sub={p.current ? p.current.label : 'idle'} />
            ))}
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Team Feed"
            action={<span className="mono rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-dim">WhatsApp simulation</span>}
          >
            {feed.length === 0 ? (
              <EmptyState message="No broadcasts yet." />
            ) : (
              <div className="space-y-2">
                {feed.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface2 px-3 py-2.5">
                    <span className="text-sm text-ink">{f.text}</span>
                    <span className="mono shrink-0 text-[11px] text-ink-dim">{fmtRelative(f.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Freelancer hours">
          {freelancers.length === 0 ? (
            <EmptyState message="No freelancer hours logged." />
          ) : (
            <div className="space-y-2">
              {freelancers.map((f) => (
                <div key={f.profile_id} className="flex items-center justify-between gap-3 border-b border-line/50 py-2 last:border-0">
                  <div>
                    <div className="text-sm text-ink">{f.name}</div>
                    <div className="mono text-[11px] text-ink-dim">{fmtMinutes(f.total_minutes)} · {f.hourly_rate ? `${fmtMoney(f.hourly_rate)}/hr` : 'no rate'}</div>
                  </div>
                  <div className="mono text-sm text-green">{fmtMoney(f.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Modal open={showActive} onClose={() => setShowActive(false)} title={`Active projects · ${projects.length}`} className="max-w-2xl">
        {projects.length === 0 ? (
          <EmptyState message="No active projects." />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {activePaged.pageItems.map((p) => {
                const names = [...new Set(p.team.map((t) => t.name))];
                return (
                  <button key={p.id} onClick={() => { setOpenId(p.id); setShowActive(false); }} className="w-full min-w-0 rounded-sm border border-line bg-surface2 p-3 text-left transition hover:border-line2">
                    <div className="flex items-center gap-2">
                      <span className="mono text-xs text-ink-dim">#{p.project_no}</span>
                      <StatusPill label={stageMeta[p.current_stage].label} tone={stageMeta[p.current_stage].tone} />
                    </div>
                    <div className="mt-1 truncate text-sm text-ink">{p.client_name} — {p.title}</div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {names.length ? <AvatarStack names={names} /> : <span className="mono text-[11px] text-ink-dim">unassigned</span>}
                      <span className="mono text-[11px] text-ink-dim">{p.status.replace('_', ' ')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <Pager page={activePaged.page} totalPages={activePaged.totalPages} onPage={activePaged.setPage} />
          </>
        )}
      </Modal>

      {openId && <ProjectDetailDrawer projectId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
