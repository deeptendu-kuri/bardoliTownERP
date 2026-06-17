import React from 'react';
import { cn } from '../../lib/cn';
import { initials } from '../../lib/format';
import { TONE_VAR, type Tone } from '../../lib/status';

const tint = (tone: Tone, pct: number) => `color-mix(in srgb, ${TONE_VAR[tone]} ${pct}%, transparent)`;

// ── Surfaces ─────────────────────────────────────────────────────────────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-surface', className)} {...props} />;
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('card-surface flex flex-col', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="display text-sm font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

// ── Status pill + dot ────────────────────────────────────────────────────────
export function StatusPill({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span
      className={cn('mono inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5', className)}
      style={{ backgroundColor: tint(tone, 14), color: TONE_VAR[tone], borderColor: tint(tone, 32) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TONE_VAR[tone] }} />
      {label}
    </span>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'secondary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-amber text-[#1a1205] hover:brightness-110 font-semibold',
    secondary: 'bg-surface2 text-ink border border-line hover:border-line2',
    ghost: 'text-ink-soft hover:text-ink hover:bg-surface2',
    danger: 'text-red border border-[color:var(--red)]/40 hover:bg-[color:var(--red)]/10',
  };
  return (
    <button
      className={cn(
        'mono inline-flex min-h-[40px] items-center justify-center gap-2 rounded-sm px-3.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

// ── Avatars ──────────────────────────────────────────────────────────────────
const AVATAR_TONES: Tone[] = ['amber', 'teal', 'blue', 'green', 'violet', 'red'];
const toneFor = (name: string) => AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length];

export function Avatar({ name, size = 28, title }: { name: string; size?: number; title?: string }) {
  const tone = toneFor(name);
  return (
    <span
      title={title ?? name}
      className="mono inline-flex items-center justify-center rounded-full border font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        backgroundColor: tint(tone, 18),
        color: TONE_VAR[tone],
        borderColor: tint(tone, 34),
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((n, i) => (
        <span key={n + i} className="-ml-1.5 first:ml-0 rounded-full ring-2 ring-[color:var(--surface)]">
          <Avatar name={n} size={26} />
        </span>
      ))}
      {extra > 0 && <span className="mono ml-1 text-xs text-ink-dim">+{extra}</span>}
    </span>
  );
}

// ── Stat tile ────────────────────────────────────────────────────────────────
export function StatTile({
  label,
  value,
  hint,
  tone = 'soft',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card className="p-4">
      <div className="mono text-[11px] uppercase tracking-wide text-ink-dim">{label}</div>
      <div className="display mt-1.5 text-3xl font-semibold" style={{ color: tone === 'soft' ? 'var(--ink)' : TONE_VAR[tone] }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
    </Card>
  );
}

// ── Bars ─────────────────────────────────────────────────────────────────────
export function OccupancyBar({ label, pct, sub }: { label: string; pct: number; sub?: string }) {
  const tone: Tone = pct >= 80 ? 'red' : pct >= 50 ? 'amber' : 'green';
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-ink">{label}</span>
        <span className="mono text-xs text-ink-soft">{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, pct)}%`, backgroundColor: TONE_VAR[tone] }} />
      </div>
      {sub && <div className="mt-1 truncate text-xs text-ink-dim">{sub}</div>}
    </div>
  );
}

export function FunnelBar({ label, count, max, tone = 'blue' }: { label: string; count: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink">{label}</span>
        <span className="mono text-xs text-ink-soft">{count}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, backgroundColor: TONE_VAR[tone] }} />
      </div>
    </div>
  );
}

// ── Empty / loading ──────────────────────────────────────────────────────────
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-ink-soft">{message}</p>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-sm bg-surface2" />
      ))}
    </div>
  );
}

// ── Form controls ────────────────────────────────────────────────────────────
const fieldClasses =
  'w-full rounded-sm border border-line bg-surface2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-dim focus:border-blue focus:outline-none';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldClasses, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldClasses, 'min-h-[84px] resize-y', className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldClasses, 'appearance-none pr-8', className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <button disabled={page === 0} onClick={() => onPage(page - 1)} className="mono rounded-sm border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-line2 disabled:opacity-40">‹ Prev</button>
      <span className="mono text-[11px] text-ink-dim">{page + 1} / {totalPages}</span>
      <button disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)} className="mono rounded-sm border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-line2 disabled:opacity-40">Next ›</button>
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono mb-1.5 block text-[11px] uppercase tracking-wide text-ink-dim">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red">{error}</span>}
    </label>
  );
}
