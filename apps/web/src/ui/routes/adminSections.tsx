import LeadInbox from '../features/admin/LeadInbox';
import AssignBoard from '../features/admin/AssignBoard';
import ReviewQueue from '../features/admin/ReviewQueue';
import { useOccupancy } from '../lib/hooks';
import { Panel, OccupancyBar, EmptyState } from '../components/ui/primitives';

export function LeadsPage() {
  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Leads</h1>
      <LeadInbox />
    </div>
  );
}

export function AssignPage() {
  const occ = [...(useOccupancy().data ?? [])].sort((a, b) => a.load_pct - b.load_pct);
  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Assign</h1>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2"><AssignBoard /></div>
        <Panel title="Who's free">
          {occ.length === 0 ? <EmptyState message="No team yet." /> : occ.map((p) => (
            <OccupancyBar key={p.profile_id} label={p.name} pct={p.load_pct} sub={p.current ? p.current.label : 'idle'} />
          ))}
        </Panel>
      </div>
    </div>
  );
}

export function ReviewPage() {
  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Review</h1>
      <ReviewQueue />
    </div>
  );
}
