import React from 'react';
import { useAuth } from '../lib/auth';
import { useMyAnchorRequests, useAction } from '../lib/hooks';
import { Button, Card, Panel, StatusPill, EmptyState, SkeletonRows } from '../components/ui/primitives';
import { respondAnchor, anchorReport, anchorComplete, type MyAnchorRow, type AnchorStatus } from '@/backend';
import { fmtDate } from '../lib/format';
import type { Tone } from '../lib/status';

const meta: Record<AnchorStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Requested', tone: 'amber' },
  accepted: { label: 'Accepted', tone: 'blue' },
  declined: { label: 'Declined', tone: 'soft' },
  reported: { label: 'At location', tone: 'teal' },
  completed: { label: 'Wrapped', tone: 'green' },
};

export default function AnchorDashboard() {
  const user = useAuth((s) => s.user)!;
  const { data, isLoading } = useMyAnchorRequests(user.id);
  const respond = useAction((a: { id: string; accept: boolean }) => respondAnchor(user.id, a.id, a.accept), { success: 'Response sent.' });
  const report = useAction((id: string) => anchorReport(user.id, id), { success: 'Reported at location.', tone: 'teal' });
  const complete = useAction((id: string) => anchorComplete(user.id, id), { success: 'Shoot wrapped!' });

  if (isLoading) return <SkeletonRows rows={4} />;
  const { pending = [], active = [], done = [] } = data ?? {};

  const card = (r: MyAnchorRow, actions: React.ReactNode) => (
    <Card key={r.id} className="p-4">
      <div className="flex items-center gap-2">
        <span className="mono text-xs text-ink-dim">#{r.project_no}</span>
        <StatusPill label={meta[r.status].label} tone={meta[r.status].tone} />
      </div>
      <div className="mt-1.5 truncate text-base text-ink">{r.client_name} — {r.project_title}</div>
      <div className="mono text-[11px] text-ink-dim">{r.location ? `📍 ${r.location}` : 'location TBD'}{r.shoot_date ? ` · ${fmtDate(r.shoot_date)}` : ''}</div>
      {r.note && <div className="mt-1 text-sm text-ink-soft">{r.note}</div>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="display text-xl font-semibold">Hi {user.full_name.split(' ')[0]} 🎤</h1>
        <p className="text-sm text-ink-soft">{pending.length} new request{pending.length !== 1 ? 's' : ''} · {active.length} upcoming</p>
      </div>

      <Panel title="New shoot requests">
        {pending.length === 0 ? (
          <EmptyState message="No new shoot requests right now." />
        ) : (
          <div className="space-y-3">
            {pending.map((r) =>
              card(r, (
                <>
                  <Button variant="primary" onClick={() => respond.mutate({ id: r.id, accept: true })}>I'm available</Button>
                  <Button variant="ghost" onClick={() => respond.mutate({ id: r.id, accept: false })}>Can't make it</Button>
                </>
              )),
            )}
          </div>
        )}
      </Panel>

      <Panel title="Upcoming & on-set">
        {active.length === 0 ? (
          <EmptyState message="Nothing on your schedule." />
        ) : (
          <div className="space-y-3">
            {active.map((r) =>
              card(
                r,
                r.status === 'accepted' ? (
                  <Button variant="primary" onClick={() => report.mutate(r.id)}>I've reported at location</Button>
                ) : (
                  <Button variant="primary" onClick={() => complete.mutate(r.id)}>Mark shoot wrapped</Button>
                ),
              ),
            )}
          </div>
        )}
      </Panel>

      {done.length > 0 && (
        <Panel title="History">
          <div className="space-y-1.5">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line/50 py-2 text-sm last:border-0">
                <span className="truncate text-ink-soft"><span className="mono text-ink-dim">#{r.project_no}</span> {r.client_name} — {r.project_title}</span>
                <StatusPill label={meta[r.status].label} tone={meta[r.status].tone} />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
