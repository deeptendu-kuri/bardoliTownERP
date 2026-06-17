import { useOccupancy, useFreelancerHours, useTeamMembers, useAction } from '../lib/hooks';
import { Panel, OccupancyBar, EmptyState, Select, StatusPill } from '../components/ui/primitives';
import { fmtMinutes, fmtMoney } from '../lib/format';
import { useAuth } from '../lib/auth';
import { setUserRole } from '@/backend';
import type { Tone } from '../lib/status';

const ROLE_TONE: Record<string, Tone> = { ceo: 'violet', admin: 'amber', staff: 'blue', anchor: 'teal' };

export default function TeamView() {
  const user = useAuth((s) => s.user)!;
  const isAdmin = user.role === 'admin';
  const occ = useOccupancy().data ?? [];
  const freelancers = useFreelancerHours().data ?? [];
  const members = useTeamMembers().data ?? [];
  const changeRole = useAction((v: { id: string; role: string }) => setUserRole(user.id, v.id, v.role), { success: 'Role updated.' });

  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Team</h1>

      <Panel title={`Members · ${members.length}`}>
        {members.length === 0 ? (
          <EmptyState message="No team members yet." />
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">{m.full_name}{m.id === user.id && <span className="mono text-[11px] text-ink-dim"> · you</span>}</div>
                  <div className="mono truncate text-[11px] text-ink-dim">{m.email}{!m.onboarded && ' · not onboarded'}</div>
                </div>
                {isAdmin && m.id !== user.id ? (
                  <Select value={m.role} onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })} className="w-[120px] shrink-0">
                    <option value="staff">Staff</option>
                    <option value="anchor">Anchor</option>
                    <option value="admin">Admin</option>
                    <option value="ceo">CEO</option>
                  </Select>
                ) : (
                  <StatusPill label={m.role.toUpperCase()} tone={ROLE_TONE[m.role] ?? 'soft'} />
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

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
