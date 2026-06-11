import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useAssignBoard, useFreeNow, useAction } from '../../lib/hooks';
import { Button, Panel, StatusPill, EmptyState, Field, Input } from '../../components/ui/primitives';
import { Drawer } from '../../components/ui/overlays';
import { priorityMeta, stageMeta, taskTypeLabel } from '../../lib/status';
import { cn } from '../../lib/cn';
import { assignTask, type AssignNeed, type TaskType } from '@/backend';

export default function AssignBoard() {
  const { data: needs, isLoading } = useAssignBoard();
  const [target, setTarget] = useState<{ need: AssignNeed; type: TaskType } | null>(null);

  return (
    <Panel title="Assign Board">
      {isLoading ? (
        <EmptyState message="Loading…" />
      ) : !needs?.length ? (
        <EmptyState message="Every project has its team. Nothing to assign right now." />
      ) : (
        <div className="space-y-2">
          {needs.map((n) => (
            <div key={n.project_id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-surface2 px-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="mono text-xs text-ink-dim">#{n.project_no}</span>
                  <StatusPill label={stageMeta[n.current_stage].label} tone={stageMeta[n.current_stage].tone} />
                  <StatusPill label={priorityMeta[n.priority].label} tone={priorityMeta[n.priority].tone} />
                </div>
                <div className="mt-1.5 truncate text-ink">{n.client_name} — {n.title}</div>
              </div>
              <div className="flex gap-2">
                {n.needs.map((t) => (
                  <Button key={t} variant="primary" onClick={() => setTarget({ need: n, type: t })}>
                    Assign {taskTypeLabel[t].toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {target && <AssignDrawer target={target} onClose={() => setTarget(null)} />}
    </Panel>
  );
}

function AssignDrawer({ target, onClose }: { target: { need: AssignNeed; type: TaskType }; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const { data: free } = useFreeNow();
  const [assigneeId, setAssigneeId] = useState('');
  const [due, setDue] = useState('');
  const assign = useAction(
    (v: { assigneeId: string; dueDate: string }) =>
      assignTask(user.id, { projectId: target.need.project_id, type: target.type, assigneeId: v.assigneeId, dueDate: v.dueDate || null }),
    { success: 'Assigned — the team member has been notified.' },
  );

  return (
    <Drawer open onClose={onClose} title={`Assign ${taskTypeLabel[target.type].toLowerCase()} · #${target.need.project_no}`}>
      <p className="mb-1 text-sm text-ink">{target.need.client_name} — {target.need.title}</p>
      <p className="mono mb-4 text-[11px] uppercase tracking-wide text-ink-dim">Pick the freest hands first</p>

      <div className="space-y-1.5">
        {(free ?? []).map((p) => {
          const selected = assigneeId === p.profile_id;
          const tone = p.load_pct >= 80 ? 'var(--red)' : p.load_pct >= 50 ? 'var(--amber)' : 'var(--green)';
          return (
            <button
              key={p.profile_id}
              onClick={() => setAssigneeId(p.profile_id)}
              className={cn('flex w-full items-center justify-between gap-3 rounded-sm border px-3 py-2.5 text-left transition', selected ? 'border-blue bg-surface2' : 'border-line hover:border-line2')}
            >
              <span>
                <span className="block text-sm text-ink">{p.name}</span>
                <span className="mono block text-[11px] text-ink-dim">{p.skills.join(' · ') || 'general'} · {p.queued_count} queued</span>
              </span>
              <span className="mono text-xs" style={{ color: tone }}>{p.load_pct}%</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <Field label="Due date (optional)"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!assigneeId} onClick={() => { assign.mutate({ assigneeId, dueDate: due }); onClose(); }}>
          Confirm assignment
        </Button>
      </div>
    </Drawer>
  );
}
