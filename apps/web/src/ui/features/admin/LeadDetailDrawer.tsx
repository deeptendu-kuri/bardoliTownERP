import { useClientDetail } from '../../lib/hooks';
import { Drawer } from '../../components/ui/overlays';
import { StatusPill, SkeletonRows } from '../../components/ui/primitives';
import { leadMeta } from '../../lib/status';
import { fmtDate } from '../../lib/format';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/50 py-2 text-sm last:border-0">
      <span className="text-ink-dim">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

export default function LeadDetailDrawer({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { data: c, isLoading } = useClientDetail(clientId);
  return (
    <Drawer open onClose={onClose} title={c ? c.name : 'Lead'}>
      {isLoading || !c ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={leadMeta[c.lead_stage].label} tone={leadMeta[c.lead_stage].tone} />
            {c.source && <span className="mono text-[11px] text-ink-dim">via {c.source}</span>}
          </div>

          <div>
            {c.company && <Row label="Company" value={c.company} />}
            {c.contact_phone && <Row label="Phone" value={c.contact_phone} />}
            {c.contact_email && <Row label="Email" value={c.contact_email} />}
            <Row label="Added" value={fmtDate(c.created_at)} />
          </div>

          {c.requirements && (
            <div>
              <div className="mono mb-1 text-[11px] uppercase tracking-wide text-ink-dim">Requirements</div>
              <div className="text-sm text-ink-soft">{c.requirements}</div>
            </div>
          )}

          <div>
            <div className="mono mb-2 text-[11px] uppercase tracking-wide text-ink-dim">Attachments</div>
            {c.attachments.length === 0 ? (
              <p className="text-sm text-ink-dim">No links or files attached.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {c.attachments.map((a, i) => a.kind === 'image' ? (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="attachment" className="h-20 rounded-sm border border-line" /></a>
                ) : (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mono text-[11px] text-blue hover:underline">↗ link</a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
