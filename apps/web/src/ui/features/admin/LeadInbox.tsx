import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useLeads, useAction } from '../../lib/hooks';
import { Button, Panel, Field, Input, Textarea, Select } from '../../components/ui/primitives';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Drawer, Modal } from '../../components/ui/overlays';
import { StatusPill } from '../../components/ui/primitives';
import { leadMeta } from '../../lib/status';
import { fmtDate } from '../../lib/format';
import { createLead, setLeadStage, addAttachment, uploadProofImage, type Client, type LeadStage } from '@/backend';
import LeadDetailDrawer from './LeadDetailDrawer';

const ORDER: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];
const nextOf = (s: LeadStage): LeadStage | null => {
  const i = ORDER.indexOf(s);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
};

export default function LeadInbox() {
  const user = useAuth((s) => s.user)!;
  const { data: leads, isLoading } = useLeads();
  const [drawer, setDrawer] = useState(false);
  const [lostFor, setLostFor] = useState<Client | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const move = useAction((a: { id: string; stage: LeadStage; reason?: string }) => setLeadStage(user.id, a.id, a.stage, a.reason), {
    success: 'Lead updated.',
  });

  const onPick = (c: Client, stage: LeadStage) => {
    if (stage === c.lead_stage) return;
    if (stage === 'lost') setLostFor(c);
    else move.mutate({ id: c.id, stage });
  };

  const stageOptions = (c: Client): LeadStage[] => {
    const set = new Set<LeadStage>([c.lead_stage]);
    const n = nextOf(c.lead_stage);
    if (n) set.add(n);
    set.add('lost');
    return [...set];
  };

  const columns: Column<Client>[] = [
    {
      key: 'client',
      header: 'Lead',
      render: (c) => (
        <button onClick={() => setDetailId(c.id)} className="min-w-0 text-left hover:underline">
          <div className="truncate text-ink">{c.name}</div>
          <div className="mono text-[11px] text-ink-dim">{c.company ?? c.contact_phone ?? '—'}</div>
        </button>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (c) =>
        c.lead_stage === 'lost' ? (
          <StatusPill label={`Lost · ${c.lost_reason ?? ''}`} tone="soft" />
        ) : (
          <Select value={c.lead_stage} onChange={(e) => onPick(c, e.target.value as LeadStage)} className="max-w-[170px]">
            {stageOptions(c).map((s) => (
              <option key={s} value={s}>{leadMeta[s].label}</option>
            ))}
          </Select>
        ),
    },
    { key: 'requirements', header: 'Needs', render: (c) => <span className="text-ink-soft">{c.requirements ?? '—'}</span> },
    { key: 'source', header: 'Source', render: (c) => <span className="mono text-xs text-ink-dim">{c.source ?? '—'}</span> },
    { key: 'created', header: 'Added', render: (c) => <span className="mono text-xs text-ink-dim">{fmtDate(c.created_at)}</span> },
  ];

  return (
    <Panel title="Lead Inbox" action={<Button variant="primary" onClick={() => setDrawer(true)}>+ New lead</Button>}>
      <DataTable
        columns={columns}
        rows={leads ?? []}
        getKey={(c) => c.id}
        loading={isLoading}
        empty={<p className="py-6 text-center text-sm text-ink-soft">No active leads — add your first lead.</p>}
      />
      <NewLeadDrawer open={drawer} onClose={() => setDrawer(false)} />
      <LostModal client={lostFor} onClose={() => setLostFor(null)} onConfirm={(reason) => lostFor && move.mutate({ id: lostFor.id, stage: 'lost', reason })} />
      {detailId && <LeadDetailDrawer clientId={detailId} onClose={() => setDetailId(null)} />}
    </Panel>
  );
}

function NewLeadDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const [form, setForm] = useState({ name: '', company: '', contact_phone: '', contact_email: '', requirements: '', lead_stage: 'new' as LeadStage });
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const create = useAction(async (v: { form: typeof form; link: string; file: File | null }) => {
    const client = (await createLead(user.id, v.form)) as { id: string };
    if (v.link.trim()) await addAttachment(user.id, 'client', client.id, 'link', v.link.trim());
    if (v.file) { const url = await uploadProofImage(v.file); if (url) await addAttachment(user.id, 'client', client.id, 'image', url); }
  }, { success: 'Lead added.' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Drawer open={open} onClose={onClose} title="New lead">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ form, link, file });
          setForm({ name: '', company: '', contact_phone: '', contact_email: '', requirements: '', lead_stage: 'new' });
          setLink(''); setFile(null);
          onClose();
        }}
      >
        <Field label="Client name *"><Input required value={form.name} onChange={set('name')} placeholder="Patel Motors" /></Field>
        <Field label="Company"><Input value={form.company} onChange={set('company')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.contact_phone} onChange={set('contact_phone')} /></Field>
          <Field label="Email"><Input type="email" value={form.contact_email} onChange={set('contact_email')} /></Field>
        </div>
        <Field label="Requirements"><Textarea value={form.requirements} onChange={set('requirements')} placeholder="60s showroom promo…" /></Field>
        <Field label="Stage">
          <Select value={form.lead_stage} onChange={set('lead_stage')}>
            {ORDER.filter((s) => s !== 'won').map((s) => <option key={s} value={s}>{leadMeta[s].label}</option>)}
          </Select>
        </Field>
        <Field label="Reference link (optional)">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Drive / brief / reference link…" />
        </Field>
        <Field label="Reference image (optional)">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-sm file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-ink" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!form.name.trim()}>Add lead</Button>
        </div>
      </form>
    </Drawer>
  );
}

function LostModal({ client, onClose, onConfirm }: { client: Client | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  if (!client) return null;
  return (
    <Modal open onClose={onClose} title={`Mark "${client.name}" lost`}>
      <Field label="Reason (required)">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Select a reason…</option>
          <option value="price">Price</option>
          <option value="timing">Timing</option>
          <option value="went elsewhere">Went elsewhere</option>
          <option value="no response">No response</option>
        </Select>
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!reason} onClick={() => { onConfirm(reason); onClose(); }}>Mark lost</Button>
      </div>
    </Modal>
  );
}
