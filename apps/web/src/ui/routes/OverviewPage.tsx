import {
  useCeoStats, useActiveProjects, useOccupancy, usePipeline, useTeamFeed, useFreelancerHours,
} from '../lib/hooks';
import { StatTile, Panel, OccupancyBar, FunnelBar, AvatarStack, StatusPill, Button, EmptyState } from '../components/ui/primitives';
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
  const stats = useCeoStats().data;
  const projects = useActiveProjects().data ?? [];
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
        <StatTile label="Active projects" value={stats?.active_projects ?? '—'} tone="amber" />
        <StatTile label="Open leads" value={stats?.open_leads ?? '—'} tone="blue" />
        <StatTile label="Avg turnaround" value={stats?.avg_turnaround_days != null ? `${stats.avg_turnaround_days}d` : '—'} hint="shoot → upload" tone="teal" />
        <StatTile label="Team utilisation" value={stats != null ? `${stats.utilization_pct}%` : '—'} tone="green" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Live Production Floor">
            <DataTable columns={floorColumns} rows={projects} getKey={(p) => p.id} empty={<EmptyState message="No active projects." />} />
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
    </div>
  );
}
