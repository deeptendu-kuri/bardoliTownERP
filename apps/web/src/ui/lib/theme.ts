import { create } from 'zustand';

export type Theme = 'light' | 'dark';
const KEY = 'studio-theme';

/** Read the persisted preference; default LIGHT. */
export function initialTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

/** Apply the theme to <html> (data-theme="light" toggles the light token set). */
export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === 'light') el.setAttribute('data-theme', 'light');
  else el.removeAttribute('data-theme');
  el.style.colorScheme = theme;
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initialTheme(),
  toggle: () => get().set(get().theme === 'light' ? 'dark' : 'light'),
  set: (t) => {
    applyTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
    set({ theme: t });
  },
}));
