/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-dim': 'var(--ink-dim)',
        amber: 'var(--amber)',
        teal: 'var(--teal)',
        blue: 'var(--blue)',
        green: 'var(--green)',
        red: 'var(--red)',
        violet: 'var(--violet)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
    },
  },
  plugins: [],
};
