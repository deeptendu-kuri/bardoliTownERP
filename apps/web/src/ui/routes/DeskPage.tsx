import { Link } from 'react-router-dom';
import { useAdminStats, useFreeNow } from '../lib/hooks';
import { StatTile, Card, Panel } from '../components/ui/primitives';

export default function DeskPage() {
  const stats = useAdminStats().data;
  const free = useFreeNow().data ?? [];
  const freest = free.find((p) => p.load_pct < 50);

  const tile = (to: string, label: string, value: number | undefined, tone: 'amber' | 'red' | 'blue' | 'green') => (
    <Link to={to} className="block transition hover:brightness-110">
      <StatTile label={label} value={value ?? '—'} tone={tone} />
    </Link>
  );

  const jump = [
    { to: '/leads', label: 'Leads', desc: 'Intake & pipeline stages' },
    { to: '/assign', label: 'Assign', desc: 'Staff & anchors for shoots' },
    { to: '/review', label: 'Review', desc: 'Client approvals & revisions' },
    { to: '/projects', label: 'Projects', desc: 'Every project by stage' },
    { to: '/team', label: 'Team', desc: 'Occupancy & freelancer hours' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Control Desk</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile('/leads', 'Leads to action', stats?.leads_to_action, 'amber')}
        {tile('/assign', 'To assign', stats?.to_assign, 'red')}
        {tile('/review', 'Awaiting review', stats?.awaiting_review, 'blue')}
        {tile('/projects', 'Done today', stats?.done_today, 'green')}
      </div>

      {freest && (
        <Card className="flex items-center gap-3 p-4">
          <span className="text-lg">🟢</span>
          <div className="text-sm text-ink">
            <span className="font-semibold">{freest.name}</span> is free
            {freest.queued_count > 0 ? ` — ${freest.queued_count} task${freest.queued_count > 1 ? 's' : ''} queued` : ' and ready for work'}.
            {' '}<Link to="/assign" className="text-blue hover:underline">Assign work →</Link>
          </div>
        </Card>
      )}

      <Panel title="Jump to">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {jump.map((j) => (
            <Link key={j.to} to={j.to} className="rounded-sm border border-line bg-surface2 p-3 transition hover:border-line2">
              <div className="text-sm font-medium text-ink">{j.label}</div>
              <div className="mono text-[11px] text-ink-dim">{j.desc}</div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
