import { useAdminStats, useOccupancy, useFreeNow } from '../lib/hooks';
import { StatTile, Panel, OccupancyBar, Card, EmptyState } from '../components/ui/primitives';
import LeadInbox from '../features/admin/LeadInbox';
import AssignBoard from '../features/admin/AssignBoard';
import ReviewQueue from '../features/admin/ReviewQueue';

export default function DeskPage() {
  const stats = useAdminStats().data;
  const occ = useOccupancy().data ?? [];
  const free = useFreeNow().data ?? [];
  const freest = free.find((p) => p.load_pct < 50);

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
    </div>
  );
}
