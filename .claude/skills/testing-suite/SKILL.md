---
name: testing-suite
description: Use this skill whenever you write or update tests of any kind for Studio OS — unit, component, RLS/database security, or Playwright e2e — or set up the CI pipeline. Trigger it before marking any feature done (tests are part of the Definition of Done) and whenever you touch the state machine, RLS policies, or a user-facing flow. It encodes the test pyramid, the required state-machine and RLS test matrices, the e2e journeys that must pass, and the CI gates. A feature without its tests is not done.
---

# Testing (Studio OS)

Full strategy: `docs/09-testing.md`. Tests are part of Definition of Done (CLAUDE.md §6).

## Tools & layout
- Vitest + React Testing Library (unit/component), Playwright (e2e), a SQL/JWT harness (RLS).
- `*.test.ts(x)` beside source; `tests/e2e/`; `tests/rls/`.
- Mock Anthropic + WhatsApp in unit/component; never hit live APIs in CI.
- Deterministic data from `supabase/seed.sql`; reset DB before e2e/RLS suites.

## Required coverage
**State machine (highest priority, target 90%+):** every legal transition succeeds; every
illegal/skip move is rejected; each guard has a negative test —
- start without estimate → rejected
- complete overdue task without delay note → rejected
- reach `uploaded` without approved review → rejected
- `submit_review(revisions)` bumps `revision_count` + creates a reedit task
- `revision_count` crossing 3 notifies the CEO
- only assignee moves a task; assignment is admin-only

**RLS (the security boundary — never skip):** three JWTs (ceo/admin/staff); for each table assert
allowed AND denied per the doc-02 matrix; especially:
- staff cannot read others' tasks / any client / unrelated projects
- staff cannot change `assignee_id`/`project_id` on their own task (column guard)
- CEO is read-only on operational tables; users see only their own notifications

**Component:** primitives + key screens render loading/empty/error; forms validate; role gating
hides/shows correctly.

**E2E (must pass for MVP):**
1. lead → won → assign shoot+edit → appears on floor
2. staff start(estimate) → complete → admin notified → next task surfaces
3. review → revisions → reedit → review → approved → upload → uploaded
4. CEO overview counts/occupancy/funnel correct; Excel export downloads with right columns
5. staff cannot reach `/desk` or `/overview`

## RLS harness pattern
```ts
const staff = await signInAs('staff');
const { error } = await staff.from('clients').select('*');
expect(error).toBeTruthy();           // staff has no read policy on clients → denied
```

## CI gates (GitHub Actions, block merge on failure)
`pnpm lint` → `pnpm typecheck` → `pnpm test` → local Supabase → RLS suite → Playwright. Keep < ~10 min.

## Style
Test names describe behaviour, not implementation ("rejects completing an overdue task without a
note"). A reader should learn the system's rules from the test names alone.
