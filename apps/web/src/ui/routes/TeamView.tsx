import { useOccupancy, useFreelancerHours, useTeamMembers, useAction } from '../lib/hooks';
import { Panel, OccupancyBar, EmptyState, Select, StatusPill, Avatar } from '../components/ui/primitives';
import { fmtMinutes, fmtMoney } from '../lib/format';
import { useAuth } from '../lib/auth';
import { setUserRole } from '@/backend';
import type { Tone } from '../lib/status';

const ROLE_TONE: Record<string, Tone> = {
  ceo: 'violet',
  admin: 'amber',
  staff: 'blue',
  anchor: 'teal',
  scriptwriter: 'green',
  salesperson: 'red',
};
const ROLE_LABEL: Record<string, string> = {
  ceo: 'CEO',
  admin: 'Admin',
  staff: 'Staff',
  anchor: 'Anchor',
  scriptwriter: 'Scriptwriter',
  salesperson: 'Salesperson',
};
// Roles a manager can assign from the Team board.
const ASSIGNABLE_ROLES = ['staff', 'anchor', 'scriptwriter', 'salesperson', 'admin', 'ceo'] as const;

export default function TeamView() {
  const user = useAuth((s) => s.user)!;
  const isManager = user.role === 'admin' || user.role === 'ceo';
  const occ = useOccupancy().data ?? [];
  const freelancers = useFreelancerHours().data ?? [];
  const members = useTeamMembers().data ?? [];
  const changeRole = useAction((v: { id: string; role: string }) => setUserRole(user.id, v.id, v.role), { success: 'Role updated.' });

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="display text-xl font-semibold">Team</h1>
        {isManager && <p className="hidden text-xs text-ink-dim sm:block">Change a member's role to grant or revoke access.</p>}
      </div>

      <Panel title={`Members · ${members.length}`}>
        {members.length === 0 ? (
          <EmptyState message="No team members yet." />
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const editable = isManager && m.id !== user.id;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-sm border border-line bg-surface2 px-3 py-2.5"
                >
                  <Avatar name={m.full_name || m.email} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">
                      {m.full_name || '—'}
                      {m.id === user.id && <span className="mono text-[11px] text-ink-dim"> · you</span>}
                    </div>
                    <div className="mono truncate text-[11px] text-ink-dim">
                      {m.email}
                      {!m.onboarded && ' · not onboarded'}
                    </div>
                  </div>
                  {editable ? (
                    <div className="w-[150px] shrink-0">
                      <Select
                        aria-label={`Role for ${m.full_name || m.email}`}
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                        disabled={changeRole.isPending}
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <StatusPill label={ROLE_LABEL[m.role] ?? m.role.toUpperCase()} tone={ROLE_TONE[m.role] ?? 'soft'} className="shrink-0" />
                  )}
                </div>
              );
            })}
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
