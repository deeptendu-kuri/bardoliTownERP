import { useOccupancy, useFreelancerHours } from '../lib/hooks';
import { Panel, OccupancyBar, EmptyState } from '../components/ui/primitives';
import { fmtMinutes, fmtMoney } from '../lib/format';

export default function TeamView() {
  const occ = useOccupancy().data ?? [];
  const freelancers = useFreelancerHours().data ?? [];

  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Team</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Occupancy">
          {occ.length === 0 ? <EmptyState message="No team members yet." /> : occ.map((p) => (
            <OccupancyBar key={p.profile_id} label={`${p.name}${p.employment_type === 'freelancer' ? ' · freelancer' : ''}`} pct={p.load_pct} sub={p.current ? p.current.label : 'idle'} />
          ))}
        </Panel>
        <Panel title="Freelancer hours">
          {freelancers.length === 0 ? <EmptyState message="No freelancer hours logged." /> : (
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
