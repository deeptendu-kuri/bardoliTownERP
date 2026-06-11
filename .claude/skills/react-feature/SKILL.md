---
name: react-feature
description: Use this skill whenever you build or modify any frontend screen, route, component, or UI in Studio OS — dashboards, forms, tables, cards, drawers, anything visual or interactive. Trigger it before writing any .tsx, styling anything, or wiring data into the UI. It encodes the design tokens, the component primitives, the TanStack-Query + Realtime data pattern, and the required loading/empty/error and mobile/accessibility states so screens come out consistent and on-brand instead of generic.
---

# Building a React feature (Studio OS)

Design language, tokens, components, and every screen spec are in `docs/05-ui-ux.md`. Data
access conventions are in `docs/06-backend-api.md`. Read the relevant screen spec first.

## Folder convention
```
features/<domain>/        # leads, projects, tasks, occupancy, reviews, notifications
  api.ts                  # TanStack Query hooks (reads) + mutations (RPC/Edge)
  components/             # feature-specific components
  <Screen>.tsx            # the route screen
routes/                   # thin route wrappers → feature screens
components/ui/            # shared primitives (StatTile, StatusPill, DataTable, ...)
styles/tokens.css         # the design tokens — import, never hardcode hexes
```

## Rules
- **Use tokens, not raw colors.** Pull from `tokens.css`/Tailwind theme. Status color mapping is
  fixed (doc 05 §2) — use the `StatusPill`/`OccupancyBar` primitives, don't reinvent.
- **Fonts:** display = Bricolage Grotesque, body = Hanken Grotesk, mono = IBM Plex Mono (labels,
  data, metrics). Don't introduce other fonts.
- **Data:** reads via `useQuery` hooks in `api.ts`; writes via `useMutation` calling an RPC/Edge
  Function then invalidating keys. Validate inputs with zod + react-hook-form.
- **Realtime:** the app shell owns subscriptions (doc 06 §4); features just consume the
  invalidated queries — don't open ad-hoc channels per component.
- **Every list needs three states:** skeleton loading, friendly empty + primary action, and an
  error with retry. No bare spinners, no blank screens (doc 05 §8).
- **Role-gate** UI by the current profile role, but remember the real guard is RLS — never trust
  the hidden button.
- **Mobile + a11y (required):** works at 380px (tables → stacked cards <640px), ≥44px touch
  targets, keyboard reachable with visible focus, color never the only signal.

## Screen build checklist
1. Open the screen's section in `docs/05`. Identify which primitives it needs (build any missing
   ones in `components/ui/` first, generically).
2. Write the `api.ts` hooks (query keys per doc 06).
3. Compose the screen from primitives; wire data; add loading/empty/error states.
4. Add the mutation flows (forms in a Drawer on mobile).
5. Component test: renders each state, validates forms, respects role gating (doc 09 §1).
6. Verify at 380px and via keyboard.

## Example: a query hook
```ts
export function useOccupancy() {
  return useQuery({ queryKey:['occupancy'],
    queryFn: async () => (await supabase.from('v_occupancy').select('*')).data ?? [] });
}
```

## Don't
Don't hardcode colors/spacing, don't fetch in `useEffect` (use Query), don't ship a list without
empty/error states, don't skip the 380px check.
