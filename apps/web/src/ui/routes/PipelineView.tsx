import { usePipeline, useLeads } from '../lib/hooks';
import { Panel, FunnelBar, StatusPill, EmptyState } from '../components/ui/primitives';
import { DataTable, type Column } from '../components/ui/DataTable';
import { leadMeta, type Tone } from '../lib/status';
import { fmtDate } from '../lib/format';
import type { Client, LeadStage } from '@/backend';

const PIPELINE_TONE: Record<string, Tone> = {
  new: 'red', contacted: 'amber', qualified: 'blue', proposal: 'violet', won: 'green', delivered: 'teal',
};

export default function PipelineView() {
  const pipe = usePipeline().data ?? [];
  const leads = useLeads().data ?? [];
  const maxPipe = Math.max(1, ...pipe.map((p) => p.count));

  const columns: Column<Client>[] = [
    {
      key: 'client', header: 'Lead',
      render: (c) => <div className="min-w-0"><div className="truncate text-ink">{c.name}</div><div className="mono text-[11px] text-ink-dim">{c.company ?? '—'}</div></div>,
    },
    { key: 'stage', header: 'Stage', render: (c) => <StatusPill label={leadMeta[c.lead_stage].label} tone={leadMeta[c.lead_stage].tone} /> },
    { key: 'requirements', header: 'Needs', render: (c) => <span className="text-ink-soft">{c.requirements ?? '—'}</span> },
    { key: 'added', header: 'Added', render: (c) => <span className="mono text-xs text-ink-dim">{fmtDate(c.created_at)}</span> },
  ];

  return (
    <div className="space-y-5">
      <h1 className="display text-xl font-semibold">Pipeline</h1>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Funnel">
          {pipe.map((r) => (
            <FunnelBar key={r.stage} label={r.stage === 'delivered' ? 'Delivered' : leadMeta[r.stage as LeadStage].label} count={r.count} max={maxPipe} tone={PIPELINE_TONE[r.stage] ?? 'blue'} />
          ))}
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="Open leads">
            <DataTable columns={columns} rows={leads} getKey={(c) => c.id} empty={<EmptyState message="No open leads." />} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
