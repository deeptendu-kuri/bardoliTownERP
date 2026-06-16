import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useMyTasks, useAction } from '../lib/hooks';
import { Button, Card, Field, Input, Panel, StatusPill, EmptyState, SkeletonRows } from '../components/ui/primitives';
import { Modal } from '../components/ui/overlays';
import { taskStatusMeta, taskTypeLabel, priorityMeta } from '../lib/status';
import { fmtDate, fmtMinutes, isOverdue } from '../lib/format';
import {
  startTask, completeTask, blockTask, resumeTask, reestimate, logHours,
  completeUpload, uploadProofImage, setTaskProof,
  type MyTaskRow,
} from '@/backend';

type ModalKind = 'start' | 'complete' | 'block' | 'reestimate' | 'hours' | 'proof';

const elapsedMin = (startedAt: string | null): number =>
  startedAt ? Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 60000)) : 0;

const isLate = (t: MyTaskRow): boolean =>
  isOverdue(t.due_date) || (!!t.estimate_minutes && elapsedMin(t.started_at) > t.estimate_minutes);

export default function MyTasksPage() {
  const user = useAuth((s) => s.user)!;
  const { data, isLoading } = useMyTasks(user.id);
  const [modal, setModal] = useState<{ kind: ModalKind; task: MyTaskRow } | null>(null);

  const close = () => setModal(null);
  const start = useAction((a: { id: string; est: number }) => startTask(user.id, a.id, a.est), { success: 'Task started — clock running.' });
  const complete = useAction(async (a: { id: string; note?: string; link: string; file: File | null }) => {
    const imageUrl = a.file ? await uploadProofImage(a.file) : null;
    if (a.link.trim() || imageUrl) await setTaskProof(user.id, a.id, a.link.trim() || null, imageUrl);
    return completeTask(user.id, a.id, { delayNote: a.note });
  }, { success: 'Task completed — proof saved.' });
  const block = useAction((a: { id: string; reason: string }) => blockTask(user.id, a.id, a.reason), { success: 'Task marked blocked.', tone: 'amber' });
  const resume = useAction((id: string) => resumeTask(user.id, id), { success: 'Back in progress.' });
  const reEst = useAction((a: { id: string; est: number }) => reestimate(user.id, a.id, a.est), { success: 'Estimate updated.' });
  const hours = useAction((a: { id: string; minutes: number }) => logHours(user.id, a.id, a.minutes), { success: 'Hours logged.' });
  const proof = useAction(async (a: { id: string; url: string; file: File | null }) => {
    const imageUrl = a.file ? await uploadProofImage(a.file) : null;
    return completeUpload(user.id, a.id, a.url, imageUrl);
  }, { success: 'Delivered — proof saved.' });

  if (isLoading) return <SkeletonRows rows={4} />;
  const { current = [], queue = [], done = [] } = data ?? {};
  const isFreelancer = user.employment_type === 'freelancer';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="display text-xl font-semibold">Hi {user.full_name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-ink-soft">
          {current.length + queue.length === 0 ? 'No active tasks — enjoy the breather.' : `${current.length} in progress · ${queue.length} queued`}
        </p>
      </div>

      {/* Current */}
      <Panel title="Current">
        {current.length === 0 ? (
          <EmptyState message="Nothing in progress. Start a task from your queue below." />
        ) : (
          <div className="space-y-3">
            {current.map((t) => (
              <TaskCard key={t.id} t={t} live>
                {t.status === 'blocked' ? (
                  <Button variant="primary" onClick={() => resume.mutate(t.id)}>Resume</Button>
                ) : (
                  <>
                    <Button variant="primary" onClick={() => setModal({ kind: t.type === 'upload' ? 'proof' : 'complete', task: t })}>
                      {t.type === 'upload' ? 'Upload & deliver' : 'Mark complete'}
                    </Button>
                    <Button variant="ghost" onClick={() => setModal({ kind: 'reestimate', task: t })}>Re-estimate</Button>
                    <Button variant="ghost" onClick={() => setModal({ kind: 'block', task: t })}>Block</Button>
                  </>
                )}
                {isFreelancer && <Button variant="ghost" onClick={() => setModal({ kind: 'hours', task: t })}>Log hours</Button>}
              </TaskCard>
            ))}
          </div>
        )}
      </Panel>

      {/* Queue */}
      <Panel title="My queue">
        {queue.length === 0 ? (
          <EmptyState message="Your queue is empty." />
        ) : (
          <div className="space-y-3">
            {queue.map((t) => (
              <TaskCard key={t.id} t={t}>
                <Button variant="primary" onClick={() => setModal({ kind: 'start', task: t })}>Start</Button>
              </TaskCard>
            ))}
          </div>
        )}
      </Panel>

      {/* History */}
      {done.length > 0 && (
        <Panel title="Recently completed">
          <div className="space-y-1.5">
            {done.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 border-b border-line/50 py-2 text-sm last:border-0">
                <span className="min-w-0 truncate text-ink-soft">
                  <span className="mono text-ink-dim">#{t.project_no}</span> {t.client_name} — {taskTypeLabel[t.type]}
                </span>
                <span className="mono shrink-0 text-xs text-ink-dim">
                  est {fmtMinutes(t.estimate_minutes)} · actual {fmtMinutes(t.actual_minutes)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {modal && (
        <TaskActionModal
          modal={modal}
          onClose={close}
          onStart={(est) => { start.mutate({ id: modal.task.id, est }); close(); }}
          onComplete={(note, link, file) => { complete.mutate({ id: modal.task.id, note, link, file }); close(); }}
          onBlock={(reason) => { block.mutate({ id: modal.task.id, reason }); close(); }}
          onReestimate={(est) => { reEst.mutate({ id: modal.task.id, est }); close(); }}
          onHours={(minutes) => { hours.mutate({ id: modal.task.id, minutes }); close(); }}
          onProof={(url, file) => { proof.mutate({ id: modal.task.id, url, file }); close(); }}
        />
      )}
    </div>
  );
}

function TaskCard({ t, live, children }: { t: MyTaskRow; live?: boolean; children: React.ReactNode }) {
  const elapsed = live && t.status === 'in_progress' ? elapsedMin(t.started_at) : 0;
  const pct = t.estimate_minutes ? Math.min(100, Math.round((elapsed / t.estimate_minutes) * 100)) : 0;
  const overdue = isOverdue(t.due_date);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-xs text-ink-dim">#{t.project_no}</span>
            <StatusPill label={taskTypeLabel[t.type]} tone="blue" />
            <StatusPill label={taskStatusMeta[t.status].label} tone={taskStatusMeta[t.status].tone} />
            <StatusPill label={priorityMeta[t.priority].label} tone={priorityMeta[t.priority].tone} />
          </div>
          <div className="mt-2 truncate text-base text-ink">{t.client_name} — {t.project_title}</div>
          {t.video_type && <div className="text-xs text-ink-dim">{t.video_type}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="mono text-[11px] text-ink-dim">Due</div>
          <div className={`mono text-sm ${overdue ? 'text-red' : 'text-ink-soft'}`}>{fmtDate(t.due_date)}</div>
        </div>
      </div>

      {t.type === 'reedit' && t.feedback && (
        <div className="mt-3 rounded-sm border border-[color:var(--amber)]/30 bg-[color:var(--amber)]/10 px-3 py-2 text-sm text-ink-soft">
          <span className="mono text-[11px] uppercase text-amber">Client feedback</span>
          <div className="mt-0.5">{t.feedback}</div>
        </div>
      )}

      {t.status === 'blocked' && t.blocked_reason && (
        <div className="mt-3 text-sm text-red">Blocked: {t.blocked_reason}</div>
      )}

      {live && t.status === 'in_progress' && t.estimate_minutes != null && (
        <div className="mt-3">
          <div className="mono mb-1 flex justify-between text-[11px] text-ink-dim">
            <span>elapsed {fmtMinutes(elapsed)}</span>
            <span>est {fmtMinutes(t.estimate_minutes)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, pct)}%`, backgroundColor: pct >= 100 ? 'var(--red)' : 'var(--amber)' }} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </Card>
  );
}

function TaskActionModal({
  modal, onClose, onStart, onComplete, onBlock, onReestimate, onHours, onProof,
}: {
  modal: { kind: ModalKind; task: MyTaskRow };
  onClose: () => void;
  onStart: (est: number) => void;
  onComplete: (note: string | undefined, link: string, file: File | null) => void;
  onBlock: (reason: string) => void;
  onReestimate: (est: number) => void;
  onHours: (minutes: number) => void;
  onProof: (url: string, file: File | null) => void;
}) {
  const { kind, task } = modal;
  const [num, setNum] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const late = isLate(task);

  const titles: Record<ModalKind, string> = {
    start: 'Start task — set an estimate',
    complete: 'Mark complete',
    block: 'Block task',
    reestimate: 'Re-estimate',
    hours: 'Log hours',
    proof: 'Deliver — attach proof',
  };

  return (
    <Modal open onClose={onClose} title={titles[kind]}>
      <p className="mb-4 text-sm text-ink-soft">{task.client_name} — {taskTypeLabel[task.type]}</p>

      {(kind === 'start' || kind === 'reestimate') && (
        <Field label="Estimate (minutes)">
          <Input type="number" min={1} autoFocus value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 120" />
        </Field>
      )}
      {kind === 'hours' && (
        <Field label="Minutes worked">
          <Input type="number" min={1} autoFocus value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 90" />
        </Field>
      )}
      {kind === 'complete' && (
        <div className="space-y-3">
          <Field label={late ? 'Delay note (required — task is late)' : 'Delay note (optional)'}>
            <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={late ? 'Why did it run over?' : 'Anything to note?'} />
          </Field>
          <Field label="Proof — screenshot (recommended)">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-ink" />
          </Field>
          <Field label="Proof — Drive link (optional)">
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
        </div>
      )}
      {kind === 'block' && (
        <Field label="Reason">
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What's blocking you?" />
        </Field>
      )}
      {kind === 'proof' && (
        <div className="space-y-3">
          <Field label="Drive / published link (required)">
            <Input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
          <Field label="Screenshot of the upload (optional)">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-ink"
            />
          </Field>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            if (kind === 'start') onStart(Number(num));
            else if (kind === 'reestimate') onReestimate(Number(num));
            else if (kind === 'hours') onHours(Number(num));
            else if (kind === 'complete') onComplete(text.trim() || undefined, link, file);
            else if (kind === 'block') onBlock(text.trim());
            else if (kind === 'proof') onProof(link.trim(), file);
          }}
          disabled={
            ((kind === 'start' || kind === 'reestimate' || kind === 'hours') && (!num || Number(num) <= 0)) ||
            (kind === 'block' && !text.trim()) ||
            (kind === 'proof' && !link.trim()) ||
            (kind === 'complete' && late && !text.trim())
          }
        >
          {kind === 'proof' ? 'Deliver' : 'Confirm'}
        </Button>
      </div>
    </Modal>
  );
}
