import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useProjectDetail, useAction, useStaff, useAnchors, useWriters } from '../../lib/hooks';
import { Drawer, Modal } from '../../components/ui/overlays';
import { Button, StatusPill, Field, Textarea, Select, Input, SkeletonRows, EmptyState } from '../../components/ui/primitives';
import { Avatar } from '../../components/ui/primitives';
import WorkflowStepper from './WorkflowStepper';
import { stageMeta, taskStatusMeta, priorityMeta, taskTypeLabel, type Tone } from '../../lib/status';
import { fmtDate, fmtMinutes, fmtRelative, isOverdue } from '../../lib/format';
import { addProjectNote, reassignTask, requestAnchor, addAttachment, uploadProofImage, cancelProject, requestScript, completeScript, type AnchorStatus, type ScriptStatus } from '@/backend';

const anchorMeta: Record<AnchorStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Requested', tone: 'amber' },
  accepted: { label: 'Accepted', tone: 'blue' },
  declined: { label: 'Declined', tone: 'soft' },
  reported: { label: 'At location', tone: 'teal' },
  completed: { label: 'Wrapped', tone: 'green' },
};

const scriptMeta: Record<ScriptStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Requested', tone: 'amber' },
  accepted: { label: 'Writing', tone: 'blue' },
  declined: { label: 'Declined', tone: 'soft' },
  submitted: { label: 'Submitted', tone: 'teal' },
  completed: { label: 'Approved', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'soft' },
};

export default function ProjectDetailDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const { data: p, isLoading } = useProjectDetail(projectId);
  const isManager = user.role === 'ceo' || user.role === 'admin';

  const [body, setBody] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const [noteLink, setNoteLink] = useState('');
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const post = useAction(async (v: { body: string; isQuestion: boolean; link: string; file: File | null }) => {
    const noteId = (await addProjectNote(user.id, projectId, v.body, v.isQuestion)) as string;
    if (v.link.trim()) await addAttachment(user.id, 'note', noteId, 'link', v.link.trim());
    if (v.file) { const url = await uploadProofImage(v.file); if (url) await addAttachment(user.id, 'note', noteId, 'image', url); }
  }, { success: 'Posted.' });

  const isAdmin = user.role === 'admin';
  const staff = useStaff().data ?? [];
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const doReassign = useAction(
    (v: { taskId: string; assigneeId: string }) => reassignTask(user.id, v.taskId, v.assigneeId),
    { success: 'Task reassigned.' },
  );

  const anchors = useAnchors().data ?? [];
  const [requesting, setRequesting] = useState(false);
  const [anchorPick, setAnchorPick] = useState('');
  const [location, setLocation] = useState('');
  const reqAnchor = useAction(
    (v: { anchorId: string; location: string }) => requestAnchor(user.id, projectId, v.anchorId, v.location),
    { success: 'Anchor requested — awaiting their confirmation.' },
  );

  const writers = useWriters().data ?? [];
  const [requestingScript, setRequestingScript] = useState(false);
  const [writerPick, setWriterPick] = useState('');
  const [brief, setBrief] = useState('');
  const reqScript = useAction(
    (v: { writerId: string; brief: string }) => requestScript(user.id, projectId, v.writerId, v.brief),
    { success: 'Scriptwriter requested.' },
  );
  const approveScript = useAction((id: string) => completeScript(user.id, id), { success: 'Script approved.' });

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const doCancel = useAction(
    (v: { reason: string }) => cancelProject(user.id, projectId, v.reason),
    { success: 'Project cancelled — everyone working has been told to stop.', tone: 'red' },
  );
  const isCancelled = !!p?.cancelled_at;

  return (
    <Drawer open onClose={onClose} title={p ? `#${p.project_no} · ${p.client_name}` : 'Project'}>
      {isLoading || !p ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="space-y-5">
          {/* Cancelled banner */}
          {isCancelled && (
            <div className="rounded-sm border px-3 py-2.5 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--red) 45%, var(--line))', backgroundColor: 'color-mix(in srgb, var(--red) 10%, transparent)' }}>
              <div className="mono text-[11px] font-semibold uppercase tracking-wide text-red">⊘ Project cancelled</div>
              <div className="mt-0.5 text-ink-soft">{p.cancel_reason || 'No reason given.'} · {fmtRelative(p.cancelled_at!)}</div>
            </div>
          )}

          {/* Header */}
          <div>
            <div className="text-base text-ink">{p.title}</div>
            {p.client_company && <div className="text-xs text-ink-dim">{p.client_company}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {isCancelled && <StatusPill label="Cancelled" tone="red" />}
              <StatusPill label={stageMeta[p.current_stage].label} tone={stageMeta[p.current_stage].tone} />
              <StatusPill label={priorityMeta[p.priority].label} tone={priorityMeta[p.priority].tone} />
              <StatusPill label={p.client_approval === 'approved' ? 'Approved' : 'Approval pending'} tone={p.client_approval === 'approved' ? 'green' : 'soft'} />
              {p.revision_count > 0 && <StatusPill label={`Rev ${p.revision_count}`} tone={p.revision_count > 3 ? 'red' : 'amber'} />}
            </div>
            {p.video_type && <div className="mono mt-2 text-[11px] text-ink-dim">{p.video_type}</div>}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${p.client_name} — ${p.title} (#${p.project_no})\nOpen in Studio OS: ${window.location.origin}/projects?p=${projectId}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mono mt-3 inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] text-green hover:brightness-110"
              style={{ borderColor: 'color-mix(in srgb, var(--green) 40%, transparent)' }}
            >
              ↗ Share on WhatsApp
            </a>
          </div>

          {/* Guided workflow */}
          {!isCancelled && (
            <Section title="Workflow">
              <WorkflowStepper p={p} userId={user.id} role={user.role} />
            </Section>
          )}

          {/* Who's working */}
          <Section title="Who's working">
            {p.tasks.length === 0 ? (
              <p className="text-sm text-ink-dim">No tasks assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {p.tasks.map((t) => (
                  <div key={t.id} className="rounded-sm border border-line bg-surface2 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
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
                    {(t.proof_url || (isAdmin && t.status !== 'completed')) && (
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/50 pt-2">
                        {t.proof_url ? (
                          <a href={t.proof_url} target="_blank" rel="noreferrer" className="mono text-[11px] text-blue hover:underline">↗ View upload proof</a>
                        ) : <span />}
                        {isAdmin && t.status !== 'completed' && (
                          <button onClick={() => { setReassignId(t.id); setPick(''); }} className="mono text-[11px] text-ink-dim hover:text-ink">⇄ Reassign</button>
                        )}
                      </div>
                    )}
                    {t.proof_image_url && (
                      <a href={t.proof_image_url} target="_blank" rel="noreferrer">
                        <img src={t.proof_image_url} alt="upload proof" className="mt-2 max-h-32 rounded-sm border border-line" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Anchors */}
          <Section title="Anchors">
            {p.anchors.length === 0 && !isAdmin ? (
              <p className="text-sm text-ink-dim">No anchors on this shoot.</p>
            ) : (
              <div className="space-y-2">
                {p.anchors.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-sm border border-line bg-surface2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm text-ink">{a.anchor_name}</div>
                      {a.location && <div className="mono text-[11px] text-ink-dim">📍 {a.location}</div>}
                    </div>
                    <StatusPill label={anchorMeta[a.status].label} tone={anchorMeta[a.status].tone} />
                  </div>
                ))}
                {p.anchors.length === 0 && <p className="text-sm text-ink-dim">No anchors requested yet.</p>}
                {isAdmin && !isCancelled && (
                  <Button variant="secondary" onClick={() => { setRequesting(true); setAnchorPick(''); setLocation(''); }}>+ Request anchor</Button>
                )}
              </div>
            )}
          </Section>

          {/* Scriptwriters */}
          <Section title="Script">
            {p.scripts.length === 0 && !isAdmin ? (
              <p className="text-sm text-ink-dim">No script for this project.</p>
            ) : (
              <div className="space-y-2">
                {p.scripts.map((s) => (
                  <div key={s.id} className="rounded-sm border border-line bg-surface2 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{s.writer_name}</div>
                        {s.brief && <div className="mono text-[11px] text-ink-dim">Brief: {s.brief}</div>}
                      </div>
                      <StatusPill label={scriptMeta[s.status].label} tone={scriptMeta[s.status].tone} />
                    </div>
                    {s.script_text && (
                      <div className="mt-2 whitespace-pre-wrap rounded-sm border border-line/60 bg-bg px-2.5 py-2 text-sm text-ink-soft">{s.script_text}</div>
                    )}
                    {s.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {s.attachments.map((a, i) => a.kind === 'image' ? (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="attachment" className="h-16 rounded-sm border border-line" /></a>
                        ) : (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mono text-[11px] text-blue hover:underline">↗ {a.caption || 'doc'}</a>
                        ))}
                      </div>
                    )}
                    {isAdmin && s.status === 'submitted' && (
                      <div className="mt-2 flex justify-end border-t border-line/50 pt-2">
                        <Button variant="primary" onClick={() => approveScript.mutate(s.id)}>Approve script</Button>
                      </div>
                    )}
                  </div>
                ))}
                {p.scripts.length === 0 && <p className="text-sm text-ink-dim">No scriptwriter requested yet.</p>}
                {isAdmin && !isCancelled && (
                  <Button variant="secondary" onClick={() => { setRequestingScript(true); setWriterPick(''); setBrief(''); }}>+ Request scriptwriter</Button>
                )}
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
                    {n.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {n.attachments.map((a, i) => a.kind === 'image' ? (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="attachment" className="h-16 rounded-sm border border-line" /></a>
                        ) : (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mono text-[11px] text-blue hover:underline">↗ link</a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isManager && (
              <div className="mt-3 border-t border-line pt-3">
                <Field label={user.role === 'ceo' ? 'Add a note or ask the admin' : 'Reply / add a note'}>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Who's on this? What's the status?…" />
                </Field>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input value={noteLink} onChange={(e) => setNoteLink(e.target.value)} placeholder="Attach a link (optional)" />
                  <input type="file" accept="image/*" onChange={(e) => setNoteFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-ink" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-ink-soft">
                    <input type="checkbox" checked={isQuestion} onChange={(e) => setIsQuestion(e.target.checked)} />
                    Flag as a question
                  </label>
                  <Button
                    variant="primary"
                    disabled={!body.trim()}
                    onClick={() => { post.mutate({ body, isQuestion, link: noteLink, file: noteFile }); setBody(''); setIsQuestion(false); setNoteLink(''); setNoteFile(null); }}
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

          {/* Danger zone — cancel the whole project */}
          {isManager && !isCancelled && p.current_stage !== 'uploaded' && (
            <Section title="Danger zone">
              <Button variant="danger" onClick={() => { setCancelling(true); setCancelReason(''); }}>⊘ Cancel project & stop all work</Button>
              <p className="mt-1.5 text-[11px] text-ink-dim">Blocks every active task, cancels pending anchor/script requests, and notifies everyone working to stop.</p>
            </Section>
          )}

          {reassignId && (
            <Modal open onClose={() => setReassignId(null)} title="Reassign task">
              <Field label="Assign to">
                <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Choose a team member…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </Select>
              </Field>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setReassignId(null)}>Cancel</Button>
                <Button variant="primary" disabled={!pick} onClick={() => { doReassign.mutate({ taskId: reassignId, assigneeId: pick }); setReassignId(null); }}>Reassign</Button>
              </div>
            </Modal>
          )}

          {requesting && (
            <Modal open onClose={() => setRequesting(false)} title="Request an anchor">
              <div className="space-y-3">
                <Field label="Anchor">
                  <Select value={anchorPick} onChange={(e) => setAnchorPick(e.target.value)}>
                    <option value="">Choose an anchor…</option>
                    {anchors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                  </Select>
                </Field>
                <Field label="Shoot location">
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Patel Motors showroom" />
                </Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRequesting(false)}>Cancel</Button>
                <Button variant="primary" disabled={!anchorPick} onClick={() => { reqAnchor.mutate({ anchorId: anchorPick, location }); setRequesting(false); }}>Send request</Button>
              </div>
            </Modal>
          )}

          {requestingScript && (
            <Modal open onClose={() => setRequestingScript(false)} title="Request a scriptwriter">
              <div className="space-y-3">
                <Field label="Scriptwriter">
                  <Select value={writerPick} onChange={(e) => setWriterPick(e.target.value)}>
                    <option value="">Choose a scriptwriter…</option>
                    {writers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                  </Select>
                </Field>
                <Field label="Brief (what to write)">
                  <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. 60s showroom promo script, upbeat tone, highlight the new SUV…" />
                </Field>
                {writers.length === 0 && <p className="text-[11px] text-ink-dim">No scriptwriters yet — add one from the Team board.</p>}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRequestingScript(false)}>Cancel</Button>
                <Button variant="primary" disabled={!writerPick} onClick={() => { reqScript.mutate({ writerId: writerPick, brief }); setRequestingScript(false); }}>Send request</Button>
              </div>
            </Modal>
          )}

          {cancelling && (
            <Modal open onClose={() => setCancelling(false)} title="Cancel this project?">
              <p className="text-sm text-ink-soft">Everyone with active work will be notified to stop, and all open tasks will be blocked. This can't be undone from here.</p>
              <div className="mt-3">
                <Field label="Reason (shared with the team)">
                  <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Client cancelled the order / scope dropped…" />
                </Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCancelling(false)}>Keep project</Button>
                <Button variant="danger" onClick={() => { doCancel.mutate({ reason: cancelReason }); setCancelling(false); }}>Cancel project</Button>
              </div>
            </Modal>
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
