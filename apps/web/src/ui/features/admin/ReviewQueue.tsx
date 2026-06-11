import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useReviewQueue, useAction } from '../../lib/hooks';
import { Button, Panel, StatusPill, EmptyState, Field, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/overlays';
import { submitReview, type ReviewItem } from '@/backend';

export default function ReviewQueue() {
  const user = useAuth((s) => s.user)!;
  const { data: items, isLoading } = useReviewQueue();
  const [reviseFor, setReviseFor] = useState<ReviewItem | null>(null);

  const decide = useAction(
    (v: { projectId: string; outcome: 'approved' | 'revisions'; feedback?: string }) => submitReview(user.id, v),
    { success: 'Review recorded.' },
  );

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
                  <Button variant="primary" onClick={() => decide.mutate({ projectId: it.project_id, outcome: 'approved' })}>Approve</Button>
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
          onClose={() => setReviseFor(null)}
          onSubmit={(feedback) => decide.mutate({ projectId: reviseFor.project_id, outcome: 'revisions', feedback })}
        />
      )}
    </Panel>
  );
}

function ReviseModal({ item, onClose, onSubmit }: { item: ReviewItem; onClose: () => void; onSubmit: (feedback: string) => void }) {
  const [feedback, setFeedback] = useState('');
  return (
    <Modal open onClose={onClose} title={`Client feedback · #${item.project_no}`}>
      <p className="mb-3 text-sm text-ink-soft">{item.client_name} — {item.title}</p>
      <Field label="What did the client ask for?">
        <Textarea autoFocus value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Make the logo bigger, soften the music…" />
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!feedback.trim()} onClick={() => { onSubmit(feedback.trim()); onClose(); }}>
          Send back for revision
        </Button>
      </div>
    </Modal>
  );
}
