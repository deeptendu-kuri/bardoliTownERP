import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useProjectDetail, useAction } from '../../lib/hooks';
import { Drawer } from '../../components/ui/overlays';
import { Button, StatusPill, Field, Textarea, SkeletonRows, EmptyState } from '../../components/ui/primitives';
import { Avatar } from '../../components/ui/primitives';
import { stageMeta, taskStatusMeta, priorityMeta, taskTypeLabel } from '../../lib/status';
import { fmtDate, fmtMinutes, fmtRelative, isOverdue } from '../../lib/format';
import { addProjectNote } from '@/backend';

export default function ProjectDetailDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const { data: p, isLoading } = useProjectDetail(projectId);
  const isManager = user.role === 'ceo' || user.role === 'admin';

  const [body, setBody] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const post = useAction(
    (v: { body: string; isQuestion: boolean }) => addProjectNote(user.id, projectId, v.body, v.isQuestion),
    { success: 'Posted.' },
  );

  return (
    <Drawer open onClose={onClose} title={p ? `#${p.project_no} · ${p.client_name}` : 'Project'}>
      {isLoading || !p ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div>
            <div className="text-base text-ink">{p.title}</div>
            {p.client_company && <div className="text-xs text-ink-dim">{p.client_company}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill label={stageMeta[p.current_stage].label} tone={stageMeta[p.current_stage].tone} />
              <StatusPill label={priorityMeta[p.priority].label} tone={priorityMeta[p.priority].tone} />
              <StatusPill label={p.client_approval === 'approved' ? 'Approved' : 'Approval pending'} tone={p.client_approval === 'approved' ? 'green' : 'soft'} />
              {p.revision_count > 0 && <StatusPill label={`Rev ${p.revision_count}`} tone={p.revision_count > 3 ? 'red' : 'amber'} />}
            </div>
            {p.video_type && <div className="mono mt-2 text-[11px] text-ink-dim">{p.video_type}</div>}
          </div>

          {/* Who's working */}
          <Section title="Who's working">
            {p.tasks.length === 0 ? (
              <p className="text-sm text-ink-dim">No tasks assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {p.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface2 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={t.assignee_name} size={26} />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{t.assignee_name}</div>
                        <div className="mono text-[11px] text-ink-dim">{taskTypeLabel[t.type]} · est {fmtMinutes(t.estimate_minutes)}{t.actual_minutes != null ? ` · actual ${fmtMinutes(t.actual_minutes)}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill label={taskStatusMeta[t.status].label} tone={taskStatusMeta[t.status].tone} />
                      {t.due_date && <span className={`mono text-[11px] ${isOverdue(t.due_date) && t.status !== 'completed' ? 'text-red' : 'text-ink-dim'}`}>due {fmtDate(t.due_date)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Reviews */}
          {p.reviews.length > 0 && (
            <Section title="Review history">
              <div className="space-y-1.5">
                {p.reviews.map((r) => (
                  <div key={r.round_no} className="rounded-sm border border-line/60 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="mono text-[11px] text-ink-dim">Round {r.round_no}</span>
                      <StatusPill label={r.outcome === 'approved' ? 'Approved' : 'Revisions'} tone={r.outcome === 'approved' ? 'green' : 'amber'} />
                    </div>
                    {r.feedback && <div className="mt-1 text-ink-soft">{r.feedback}</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Notes / questions thread */}
          <Section title="Notes & questions">
            {p.notes.length === 0 ? (
              <EmptyState message="No notes yet." />
            ) : (
              <div className="space-y-2">
                {p.notes.map((n) => (
                  <div key={n.id} className="rounded-sm border px-3 py-2" style={{ borderColor: n.is_question ? 'color-mix(in srgb, var(--amber) 35%, var(--line))' : 'var(--line)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{n.author_name} <span className="mono text-[10px] uppercase text-ink-dim">{n.author_role}</span></span>
                      <span className="mono text-[11px] text-ink-dim">{fmtRelative(n.created_at)}</span>
                    </div>
                    {n.is_question && <span className="mono text-[10px] uppercase text-amber">Question</span>}
                    <div className="mt-0.5 text-sm text-ink-soft">{n.body}</div>
                  </div>
                ))}
              </div>
            )}

            {isManager && (
              <div className="mt-3 border-t border-line pt-3">
                <Field label={user.role === 'ceo' ? 'Add a note or ask the admin' : 'Reply / add a note'}>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Who's on this? What's the status?…" />
                </Field>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-ink-soft">
                    <input type="checkbox" checked={isQuestion} onChange={(e) => setIsQuestion(e.target.checked)} />
                    Flag as a question
                  </label>
                  <Button
                    variant="primary"
                    disabled={!body.trim()}
                    onClick={() => { post.mutate({ body, isQuestion }); setBody(''); setIsQuestion(false); }}
                  >
                    Post
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* Timeline */}
          {p.timeline.length > 0 && (
            <Section title="Activity timeline">
              <div className="space-y-1">
                {p.timeline.slice(0, 12).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-1 text-xs">
                    <span className="text-ink-soft">
                      <span className="mono text-ink-dim">{e.event_type}</span>
                      {e.from_state && e.to_state ? ` · ${e.from_state} → ${e.to_state}` : ''}
                      {e.actor_name !== 'Unassigned' ? ` · ${e.actor_name}` : ''}
                    </span>
                    <span className="mono shrink-0 text-ink-dim">{fmtRelative(e.created_at)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mono mb-2 text-[11px] uppercase tracking-wide text-ink-dim">{title}</h3>
      {children}
    </section>
  );
}
