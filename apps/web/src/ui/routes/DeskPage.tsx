import { useState } from 'react';
import { useAdminStats, useOccupancy, useFreeNow, useProjects } from '../lib/hooks';
import { StatTile, Panel, OccupancyBar, Card, EmptyState, StatusPill, AvatarStack } from '../components/ui/primitives';
import { DataTable, type Column } from '../components/ui/DataTable';
import { stageMeta } from '../lib/status';
import ProjectDetailDrawer from '../features/shared/ProjectDetailDrawer';
import LeadInbox from '../features/admin/LeadInbox';
import AssignBoard from '../features/admin/AssignBoard';
import ReviewQueue from '../features/admin/ReviewQueue';
import type { ProjectRow } from '@/backend';

export default function DeskPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const stats = useAdminStats().data;
  const occ = useOccupancy().data ?? [];
  const free = useFreeNow().data ?? [];
  const projects = useProjects().data ?? [];
  const freest = free.find((p) => p.load_pct < 50);

  const projColumns: Column<ProjectRow>[] = [
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
      key: 'team', header: 'Team',
      render: (p) => {
        const names = [...new Set(p.team.map((t) => t.name))];
        return names.length ? <AvatarStack names={names} /> : <span className="mono text-xs text-ink-dim">unassigned</span>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Control Desk</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Leads to action" value={stats?.leads_to_action ?? '—'} tone="amber" />
        <StatTile label="To assign" value={stats?.to_assign ?? '—'} tone="red" />
        <StatTile label="Awaiting review" value={stats?.awaiting_review ?? '—'} tone="blue" />
        <StatTile label="Done today" value={stats?.done_today ?? '—'} tone="green" />
      </div>

      {freest && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4" >
          <div className="flex items-center gap-3">
            <span className="text-lg">🟢</span>
            <div>
              <div className="text-sm text-ink">
                <span className="font-semibold">{freest.name}</span> is free
                {freest.queued_count > 0 ? ` — ${freest.queued_count} task${freest.queued_count > 1 ? 's' : ''} queued` : ' and ready for work'}
              </div>
              <div className="mono text-[11px] text-ink-dim">Assign upcoming work to keep the floor balanced.</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <LeadInbox />
          <AssignBoard />
          <ReviewQueue />
          <Panel title="All Projects" action={<span className="mono text-[11px] text-ink-dim">tap a row to open</span>}>
            <DataTable columns={projColumns} rows={projects} getKey={(p) => p.id} onRowClick={(p) => setOpenId(p.id)} empty={<EmptyState message="No projects yet." />} />
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Team occupancy">
            {occ.length === 0 ? (
              <EmptyState message="No team members yet." />
            ) : (
              occ.map((p) => (
                <OccupancyBar key={p.profile_id} label={`${p.name}${p.employment_type === 'freelancer' ? ' · freelancer' : ''}`} pct={p.load_pct} sub={p.current ? p.current.label : 'idle'} />
              ))
            )}
          </Panel>
        </div>
      </div>

      {openId && <ProjectDetailDrawer projectId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
