import { useState } from 'react';
import { useStaff, useWriters, useAnchors, useAction } from '../../lib/hooks';
import { Button, Field, Select, Input, Textarea } from '../../components/ui/primitives';
import {
  assignTask, requestScript, waiveScript, requestAnchor, submitReview, managerDeliver, advanceStage, uploadProofImage,
  type ProjectDetail, type WorkflowStep, type UserRole,
} from '@/backend';

type StepState = 'done' | 'active' | 'pending' | 'skipped';
const ORDER: WorkflowStep[] = ['script', 'shoot', 'edit', 'review', 'deliver'];
const STEP_LABEL: Record<WorkflowStep, string> = {
  script: 'Script', shoot: 'Shoot', edit: 'Edit', review: 'Review', deliver: 'Deliver', done: 'Done', cancelled: 'Cancelled',
};
const STAGE_IDX: Record<string, number> = {
  confirmed: 0, shoot_pending: 1, shooting_done: 2, editing: 3, client_review: 4, upload_ready: 5, uploaded: 6,
};

function stepStates(p: ProjectDetail): Record<WorkflowStep, StepState> {
  const idx = STAGE_IDX[p.current_stage] ?? 0;
  const scriptSubmitted = p.scripts.some((s) => s.status === 'submitted' || s.status === 'completed');
  const scriptInFlight = p.scripts.some((s) => s.status === 'requested' || s.status === 'accepted');
  const script: StepState = p.script_waived ? 'skipped' : scriptSubmitted ? 'done' : scriptInFlight ? 'active' : idx === 0 ? 'active' : 'pending';
  return {
    script,
    shoot: idx >= 2 ? 'done' : idx <= 1 ? 'active' : 'pending',
    edit: idx >= 4 ? 'done' : idx === 2 || idx === 3 ? 'active' : 'pending',
    review: idx >= 5 ? 'done' : idx === 4 ? 'active' : 'pending',
    deliver: idx >= 6 ? 'done' : idx === 5 ? 'active' : 'pending',
    done: 'pending', cancelled: 'pending',
  };
}

const dotStyle = (s: StepState) =>
  s === 'done' ? { backgroundColor: 'var(--green)', color: '#06210f' }
  : s === 'active' ? { backgroundColor: 'var(--amber)', color: '#1a1205' }
  : s === 'skipped' ? { backgroundColor: 'var(--line2)', color: 'var(--ink-dim)' }
  : { backgroundColor: 'var(--surface2)', color: 'var(--ink-dim)' };

export default function WorkflowStepper({ p, userId, role }: { p: ProjectDetail; userId: string; role: UserRole }) {
  const isAdmin = role === 'admin';
  const isManager = role === 'admin' || role === 'ceo';
  const states = stepStates(p);
  const [focus, setFocus] = useState<WorkflowStep>(p.next.step);

  const staff = useStaff().data ?? [];
  const writers = useWriters().data ?? [];
  const anchors = useAnchors().data ?? [];

  // ── form state ──
  const [pick, setPick] = useState('');
  const [anchorPick, setAnchorPick] = useState('');
  const [due, setDue] = useState('');
  const [location, setLocation] = useState('');
  const [brief, setBrief] = useState('');
  const [outcome, setOutcome] = useState<'approved' | 'revisions'>('approved');
  const [feedback, setFeedback] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const reset = () => { setPick(''); setAnchorPick(''); setDue(''); setLocation(''); setBrief(''); setFeedback(''); setUrl(''); setFile(null); };

  const assign = useAction((v: { type: 'shoot' | 'edit'; assignee: string; due: string }) =>
    assignTask(userId, { projectId: p.id, type: v.type, assigneeId: v.assignee, dueDate: v.due || undefined }), { success: 'Assigned.' });
  const reqScript = useAction((v: { writer: string; brief: string }) => requestScript(userId, p.id, v.writer, v.brief), { success: 'Scriptwriter requested.' });
  const skipScript = useAction((_: void) => waiveScript(userId, p.id), { success: 'Script step skipped.' });
  const reqAnchor = useAction((v: { anchor: string; location: string }) => requestAnchor(userId, p.id, v.anchor, v.location), { success: 'Anchor requested.' });
  const review = useAction((v: { outcome: 'approved' | 'revisions'; feedback: string; assignee: string }) =>
    submitReview(userId, { projectId: p.id, outcome: v.outcome, feedback: v.feedback || undefined, assigneeId: v.assignee || undefined }), { success: 'Verdict sent.' });
  const deliver = useAction(async (v: { url: string; file: File | null }) => {
    const img = v.file ? await uploadProofImage(v.file) : null;
    await managerDeliver(userId, p.id, v.url, img);
  }, { success: 'Delivered! 🎉' });
  const skipStep = useAction((_: void) => advanceStage(userId, p.id, 'skipped via stepper'), { success: 'Moved to the next step.' });

  const busy = assign.isPending || reqScript.isPending || skipScript.isPending || reqAnchor.isPending || review.isPending || deliver.isPending || skipStep.isPending;

  const onFocusStep = (s: WorkflowStep) => { reset(); setFocus(s); };

  return (
    <section className="rounded-sm border border-line bg-surface2 p-3">
      {/* Step rail */}
      <div className="flex items-center gap-1">
        {ORDER.map((s, i) => {
          const st = states[s];
          const selected = focus === s;
          return (
            <button
              key={s}
              onClick={() => onFocusStep(s)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${STEP_LABEL[s]} · ${st}`}
            >
              <div className="flex w-full items-center gap-1">
                {i > 0 && <span className="h-px flex-1" style={{ backgroundColor: states[ORDER[i - 1]] === 'done' ? 'var(--green)' : 'var(--line)' }} />}
                <span className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={dotStyle(st)}>
                  {st === 'done' ? '✓' : st === 'skipped' ? '–' : i + 1}
                </span>
                {i < ORDER.length - 1 && <span className="h-px flex-1" style={{ backgroundColor: st === 'done' ? 'var(--green)' : 'var(--line)' }} />}
              </div>
              <span className={`mono text-[10px] ${selected ? 'text-ink' : 'text-ink-dim'}`}>{STEP_LABEL[s]}</span>
            </button>
          );
        })}
      </div>

      {/* Action panel for the focused step */}
      <div className="mt-3 border-t border-line pt-3">
        {!isManager ? (
          <p className="text-xs text-ink-dim">Read-only.</p>
        ) : focus === 'script' ? (
          states.script === 'done' || states.script === 'skipped' ? (
            <p className="text-xs text-ink-dim">{states.script === 'skipped' ? 'Script step was skipped.' : 'Script delivered.'}</p>
          ) : !isAdmin ? (
            <p className="text-xs text-ink-dim">Admin assigns the scriptwriter.</p>
          ) : (
            <div className="space-y-2">
              <Field label="Scriptwriter">
                <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Choose a scriptwriter…</option>
                  {writers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </Select>
              </Field>
              <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Brief — what to write (optional)" />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={!pick || busy} onClick={() => { reqScript.mutate({ writer: pick, brief }); reset(); }}>Request scriptwriter</Button>
                <Button variant="ghost" disabled={busy} onClick={() => skipScript.mutate()}>Skip script →</Button>
              </div>
            </div>
          )
        ) : focus === 'shoot' ? (
          states.shoot === 'done' ? (
            <p className="text-xs text-ink-dim">Shoot wrapped.</p>
          ) : !isAdmin ? (
            <p className="text-xs text-ink-dim">Admin assigns the shoot crew.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Field label="Shooter">
                  <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choose a shooter…</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </Select>
                </Field>
                <Field label="Shoot date (optional)">
                  <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </Field>
                <Button variant="primary" disabled={!pick || busy} onClick={() => { assign.mutate({ type: 'shoot', assignee: pick, due }); reset(); }}>Assign shooter</Button>
              </div>
              <div className="space-y-2 border-t border-line/60 pt-3">
                <p className="mono text-[10px] uppercase tracking-wide text-ink-dim">Anchor (optional)</p>
                <Field label="Anchor">
                  <Select value={anchorPick} onChange={(e) => setAnchorPick(e.target.value)}>
                    <option value="">Choose an anchor…</option>
                    {anchors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                  </Select>
                </Field>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Shoot location" />
                <Button variant="secondary" disabled={!anchorPick || busy} onClick={() => { reqAnchor.mutate({ anchor: anchorPick, location }); setAnchorPick(''); setLocation(''); }}>Request anchor</Button>
              </div>
            </div>
          )
        ) : focus === 'edit' ? (
          states.edit === 'done' ? (
            <p className="text-xs text-ink-dim">Edit complete.</p>
          ) : !isAdmin ? (
            <p className="text-xs text-ink-dim">Admin assigns the editor.</p>
          ) : (
            <div className="space-y-2">
              <Field label="Editor">
                <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Choose an editor…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </Select>
              </Field>
              <Button variant="primary" disabled={!pick || busy} onClick={() => { assign.mutate({ type: 'edit', assignee: pick, due }); reset(); }}>Assign editor</Button>
            </div>
          )
        ) : focus === 'review' ? (
          states.review !== 'active' ? (
            <p className="text-xs text-ink-dim">{states.review === 'done' ? 'Review passed.' : 'Not yet at client review.'}</p>
          ) : !isAdmin ? (
            <p className="text-xs text-ink-dim">Admin records the client verdict.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button variant={outcome === 'approved' ? 'primary' : 'secondary'} onClick={() => setOutcome('approved')}>Approved</Button>
                <Button variant={outcome === 'revisions' ? 'primary' : 'secondary'} onClick={() => setOutcome('revisions')}>Revisions</Button>
              </div>
              {outcome === 'revisions' && (
                <>
                  <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What does the client want changed?" />
                  <Field label="Re-edit by (optional)">
                    <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                      <option value="">Same editor</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </Select>
                  </Field>
                </>
              )}
              <Button
                variant="primary"
                disabled={busy || (outcome === 'revisions' && !feedback.trim())}
                onClick={() => { review.mutate({ outcome, feedback, assignee: pick }); reset(); }}
              >
                {outcome === 'approved' ? 'Approve & send to delivery' : 'Send revisions'}
              </Button>
            </div>
          )
        ) : focus === 'deliver' ? (
          states.deliver === 'done' ? (
            <p className="text-xs text-ink-dim">Delivered.</p>
          ) : (
            <div className="space-y-2">
              <Field label="Final video link (Drive / YouTube)">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border-0 file:bg-surface file:px-3 file:py-2 file:text-ink" />
              <Button variant="primary" disabled={!url.trim() || busy} onClick={() => { deliver.mutate({ url, file }); reset(); }}>Deliver & mark approved</Button>
            </div>
          )
        ) : null}

        {/* Forward-only manual skip for the focused active step (managers) */}
        {isManager && states[focus] === 'active' && focus !== 'script' && focus !== 'deliver' && (
          <button disabled={busy} onClick={() => skipStep.mutate()} className="mono mt-2 text-[11px] text-ink-dim hover:text-ink disabled:opacity-50">
            Skip this step manually →
          </button>
        )}
      </div>
    </section>
  );
}
