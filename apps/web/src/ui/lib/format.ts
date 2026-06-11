export const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '—';

export const fmtDateTime = (iso?: string | null): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

export const fmtMinutes = (m?: number | null): string => {
  if (m == null) return '—';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
};

export const fmtMoney = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export const isOverdue = (iso?: string | null): boolean => !!iso && iso < todayStr();

export const fmtRelative = (iso?: string | null): string => {
  if (!iso) return '';
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
};

export const initials = (name: string): string =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
