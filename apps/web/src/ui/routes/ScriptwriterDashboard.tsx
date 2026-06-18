import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useMyScriptRequests, useAction } from '../lib/hooks';
import { Button, Card, Panel, StatusPill, EmptyState, SkeletonRows, Field, Textarea, Input } from '../components/ui/primitives';
import { respondScript, submitScript, uploadDoc, addAttachment, type MyScriptRow, type ScriptStatus } from '@/backend';
import { fmtRelative } from '../lib/format';
import type { Tone } from '../lib/status';

const meta: Record<ScriptStatus, { label: string; tone: Tone }> = {
  requested: { label: 'New request', tone: 'amber' },
  accepted: { label: 'Writing', tone: 'blue' },
  declined: { label: 'Declined', tone: 'soft' },
  submitted: { label: 'Submitted', tone: 'teal' },
  completed: { label: 'Approved', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'soft' },
};

function WriteBox({ req, userId }: { req: MyScriptRow; userId: string }) {
  const [text, setText] = useState(req.script_text ?? '');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const submit = useAction(
    async (v: { text: string; link: string; file: File | null }) => {
      if (v.link.trim()) await addAttachment(userId, 'script', req.id, 'link', v.link.trim(), 'reference link');
      if (v.file) {
        const url = await uploadDoc(v.file);
        if (url) await addAttachment(userId, 'script', req.id, v.file.type.startsWith('image/') ? 'image' : 'link', url, v.file.name);
      }
      await submitScript(userId, req.id, v.text);
    },
    { success: req.status === 'submitted' ? 'Script updated.' : 'Script submitted.' },
  );

  return (
    <div className="mt-3 border-t border-line pt-3">
      <Field label="Your script">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write the script here…" className="min-h-[160px]" />
      </Field>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Attach a doc link (Google Docs…)" />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-ink"
        />
      </div>
      {req.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {req.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mono text-[11px] text-blue hover:underline">↗ {a.caption || 'attachment'}</a>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Button variant="primary" disabled={!text.trim() || submit.isPending} onClick={() => submit.mutate({ text, link, file })}>
          {req.status === 'submitted' ? 'Resubmit script' : 'Submit script'}
        </Button>
      </div>
    </div>
  );
}

export default function ScriptwriterDashboard() {
  const user = useAuth((s) => s.user)!;
  const { data, isLoading } = useMyScriptRequests(user.id);
  const respond = useAction((a: { id: string; accept: boolean }) => respondScript(user.id, a.id, a.accept), { success: 'Response sent.' });

  if (isLoading) return <SkeletonRows rows={4} />;
  const { pending = [], active = [], done = [] } = data ?? {};

  const head = (r: MyScriptRow) => (
    <div>
      <div className="flex items-center gap-2">
        <span className="mono text-xs text-ink-dim">#{r.project_no}</span>
        <StatusPill label={meta[r.status].label} tone={meta[r.status].tone} />
      </div>
      <div className="mt-1.5 truncate text-base text-ink">{r.project_title}</div>
      {r.brief && <div className="mt-1 text-sm text-ink-soft">Brief: {r.brief}</div>}
      {r.note && <div className="mono text-[11px] text-ink-dim">{r.note}</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="display text-xl font-semibold">Hi {user.full_name.split(' ')[0]} ✍️</h1>
        <p className="text-sm text-ink-soft">{pending.length} new request{pending.length !== 1 ? 's' : ''} · {active.length} in progress</p>
      </div>

      <Panel title="New script requests">
        {pending.length === 0 ? (
          <EmptyState message="No new requests right now." />
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id} className="p-4">
                {head(r)}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => respond.mutate({ id: r.id, accept: true })}>Accept</Button>
                  <Button variant="ghost" onClick={() => respond.mutate({ id: r.id, accept: false })}>Decline</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="In progress">
        {active.length === 0 ? (
          <EmptyState message="Nothing to write right now." />
        ) : (
          <div className="space-y-3">
            {active.map((r) => (
              <Card key={r.id} className="p-4">
                {head(r)}
                <WriteBox req={r} userId={user.id} />
              </Card>
            ))}
          </div>
        )}
      </Panel>

      {done.length > 0 && (
        <Panel title="History">
          <div className="space-y-1.5">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line/50 py-2 text-sm last:border-0">
                <span className="truncate text-ink-soft"><span className="mono text-ink-dim">#{r.project_no}</span> {r.project_title} · {fmtRelative(r.requested_at)}</span>
                <StatusPill label={meta[r.status].label} tone={meta[r.status].tone} />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
