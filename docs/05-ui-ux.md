# 05 — UI / UX

**Scope:** the design system (tokens, type, components) and every screen across the three role
dashboards, including responsive/mobile and accessibility rules. Data shapes come from doc 03;
behaviour from doc 04/06.

---

## 1. Design language
A calm "production command center": dark, data-dense but uncluttered, cinematic warmth. The
goal is glanceability — a user should read state in seconds. Avoid generic AI-template looks.

## 2. Design tokens (`apps/web/src/styles/tokens.css`)
```css
:root{
  --bg:#0a0c11; --bg2:#0e1118; --surface:#14181f; --surface2:#1b2029;
  --line:#262d39; --line2:#333c4a;
  --ink:#eef1f5; --ink-soft:#a9b3c2; --ink-dim:#69748a;
  --amber:#f6a623;  /* primary / in-production */
  --teal:#2dd4bf;   /* ready / live */
  --blue:#5b9dff;   /* review / staff */
  --green:#3fd17a;  /* completed / won */
  --red:#ff6b5e;    /* pending / overdue */
  --violet:#b794ff; /* AI */
  --radius:14px; --radius-sm:9px;
  --font-display:'Bricolage Grotesque',sans-serif;
  --font-body:'Hanken Grotesk',sans-serif;
  --font-mono:'IBM Plex Mono',monospace;  /* labels, data, metrics */
}
```
Status → color is fixed and used everywhere (badges, bars, dots):
`completed=green · in_progress/editing=amber · pending/overdue=red · review=blue · ready/uploaded=teal · ai=violet`.

## 3. Component primitives (`components/ui/`)
Build these once; reuse across all screens. Each is keyboard-accessible and theme-token-driven.
- `StatTile` (label, value, delta, accent)
- `StatusPill` (maps status enum → color)
- `Avatar` / `AvatarStack` (initials)
- `DataTable` (sortable, hover rows, empty + loading states)
- `OccupancyBar` (name, load %, color by load)
- `FunnelBar` (stage label, count, width)
- `Card`, `Panel` (titled section), `Drawer`/`Sheet` (mobile-friendly forms)
- `Toast` (success/error), `ConfirmDialog`
- `AISuggestionCard` (violet, with Accept / Dismiss)
- `TaskCard` (the staff "current task" card with progress + actions)

## 4. Navigation & shell
- Left rail (desktop) / bottom tab bar (mobile, ≤640px) — items gated by role.
- Top bar: studio name, global search, notification bell (unread count from Realtime), profile.
- Role determines the default landing route: CEO→`/overview`, Admin→`/desk`, Staff→`/my-tasks`.

## 5. CEO — Command Center (`/overview`, read-only)
- **Stat row:** Active Projects · Open Leads · Avg Turnaround (shoot→upload) · Team Utilisation.
- **Live Production Floor** — `DataTable`: client · stage `StatusPill` · assigned team `AvatarStack`.
- **Team Occupancy** — `OccupancyBar` list from `v_occupancy`.
- **Client Pipeline** — `FunnelBar` from `v_pipeline` (new→…→won + delivered).
- **Export** button → triggers the Excel export (doc 06/skill). Phase 2: analytics tiles
  (turnaround trend, revision rate).

## 6. Admin — Control Desk (`/desk`)
- **Stat row:** Leads to Action · To Assign (won, no team) · Awaiting Review · Done Today.
- **"Who's free" prompt** (rules-based MVP, AI in phase 2): a banner — "Anjali is now free —
  N pending tasks" with the actual queued tasks and an Assign action.
- **Lead Inbox** — `DataTable` of clients with editable `lead_stage` (inline select). New-lead
  form in a `Drawer`: name, company, phone, email, requirements, stage.
- **Assign Board** — won projects needing a team; pick shooter/editor/freelancer from the
  free-now list (`v_occupancy`). Assigning creates the appropriate `tasks` (doc 04).
- **Team — current task & stage** — `OccupancyBar` + each person's active task, so the admin
  assigns with context.
- **Review queue** — projects in `client_review`: mark `approved` or `revisions` (+ feedback)
  → drives the revision loop. Admin records that they relayed to the client (manual).
- **Freelancer hours** (phase 2 surface): log/adjust hours; show `hours × rate` per person/period.

## 7. Staff / Freelancer — My Tasks (`/my-tasks`)
- Greeting + role + today's count.
- **Current task** `TaskCard`: client/title, type, due date, progress, estimate vs elapsed.
  Actions: **Mark complete** (prompts delay note if late), **Add delay note**, **Re-estimate**.
  Starting a task forces an estimate (doc 04 guard).
- **My queue** — admin-assigned tasks in priority order (`sort_order`). Not auto-started.
- Freelancers also see a **Log hours** action per task (and, pending open Q2, possibly their
  running `hours × rate` total).

## 8. Empty / loading / error states (required for every list)
- **Loading:** skeleton rows, not spinners-only.
- **Empty:** a friendly line + the primary action (e.g. "No leads yet — Add your first lead").
- **Error:** inline message + retry; toast for write failures. Never a blank screen.

## 9. Responsive & mobile
- Every screen works at **380px**. Tables collapse to stacked cards below 640px.
- Touch targets ≥44px. Forms use `Drawer`/`Sheet` on mobile.
- The same components are what Capacitor ships to iOS/Android later — design phone-first where
  staff are concerned (they're in the field).

## 10. Accessibility
- All interactive elements keyboard-reachable with visible focus rings.
- Color is never the only signal — pair status color with text/icon.
- Contrast ≥ WCAG AA on the dark theme; verify the dim inks against `--surface`.
- Live regions for the notification bell and toasts.

> Build any screen via `.claude/skills/react-feature`, which encodes these tokens and patterns.
