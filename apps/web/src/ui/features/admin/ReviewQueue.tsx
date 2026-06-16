import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useReviewQueue, useAction, useStaff } from '../../lib/hooks';
import { Button, Panel, StatusPill, EmptyState, Field, Textarea, Input, Select } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/overlays';
import { submitReview, addProjectNote, addAttachment, uploadProofImage, type ReviewItem } from '@/backend';

export default function ReviewQueue() {
  const user = useAuth((s) => s.user)!;
  const { data: items, isLoading } = useReviewQueue();
  const staff = useStaff().data ?? [];
  const [reviseFor, setReviseFor] = useState<ReviewItem | null>(null);

  const approve = useAction(
    (projectId: string) => submitReview(user.id, { projectId, outcome: 'approved' }),
    { success: 'Approved — upload task created.' },
  );
  const revise = useAction(async (v: { projectId: string; feedback: string; assigneeId: string; link: string; file: File | null }) => {
    await submitReview(user.id, { projectId: v.projectId, outcome: 'revisions', feedback: v.feedback, assigneeId: v.assigneeId || undefined });
    if (v.link.trim() || v.file) {
      const noteId = (await addProjectNote(user.id, v.projectId, `Client feedback: ${v.feedback}`, false)) as string;
      if (v.link.trim()) await addAttachment(user.id, 'note', noteId, 'link', v.link.trim());
      if (v.file) { const url = await uploadProofImage(v.file); if (url) await addAttachment(user.id, 'note', noteId, 'image', url); }
    }
  }, { success: 'Sent back for revision.', tone: 'amber' });

  return (
    <Panel title="Review Queue">
      {isLoading ? (
        <EmptyState message="Loading…" />
      ) : !items?.length ? (
        <EmptyState message="No cuts awaiting client review." />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.project_id} className="rounded-sm border border-line bg-surface2 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono text-xs text-ink-dim">#{it.project_no}</span>
                    {it.revision_count > 0 && <StatusPill label={`Rev ${it.revision_count}`} tone={it.revision_count > 3 ? 'red' : 'amber'} />}
                  </div>
                  <div className="mt-1 truncate text-ink">{it.client_name} — {it.title}</div>
                  <div className="mono text-[11px] text-ink-dim">Editor: {it.editor_name}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" onClick={() => setReviseFor(it)}>Request revisions</Button>
                  <Button variant="primary" onClick={() => approve.mutate(it.project_id)}>Approve</Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-dim">Relay the cut to the client, then record their verdict here.</p>
            </div>
          ))}
        </div>
      )}

      {reviseFor && (
        <ReviseModal
          item={reviseFor}
          staff={staff.map((s) => ({ id: s.id, name: s.full_name }))}
          onClose={() => setReviseFor(null)}
          onSubmit={(v) => revise.mutate({ projectId: reviseFor.project_id, ...v })}
        />
      )}
    </Panel>
  );
}

function ReviseModal({
  item, staff, onClose, onSubmit,
}: {
  item: ReviewItem;
  staff: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: { feedback: string; assigneeId: string; link: string; file: File | null }) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <Modal open onClose={onClose} title={`Client feedback · #${item.project_no}`}>
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">{item.client_name} — {item.title}</p>
        <Field label="What did the client ask for?">
          <Textarea autoFocus value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Make the logo bigger, soften the music…" />
        </Field>
        <Field label="Re-assign the re-edit to (defaults to the editor)">
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">{item.editor_name} (current editor)</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Reference link (optional)">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Drive link with marked-up notes…" />
        </Field>
        <Field label="Screenshot / reference image (optional)">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-ink" />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!feedback.trim()} onClick={() => { onSubmit({ feedback: feedback.trim(), assigneeId, link, file }); onClose(); }}>
          Reopen & send for revision
        </Button>
      </div>
    </Modal>
  );
}
