import { create } from 'zustand';
import { TONE_VAR, type Tone } from '../../lib/status';

interface ToastItem {
  id: string;
  message: string;
  tone: Tone;
}
interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: Tone) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'soft') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({ items: [...s.items, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** Fire a toast from anywhere (including mutation callbacks). */
export const toast = (message: string, tone: Tone = 'soft'): void => useToasts.getState().push(message, tone);

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-sm border px-3.5 py-2.5 text-left text-sm shadow-lg"
          style={{ backgroundColor: 'var(--surface2)', borderColor: `color-mix(in srgb, ${TONE_VAR[t.tone]} 40%, var(--line))`, color: 'var(--ink)' }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONE_VAR[t.tone] }} />
          {t.message}
        </button>
      ))}
    </div>
  );
}
