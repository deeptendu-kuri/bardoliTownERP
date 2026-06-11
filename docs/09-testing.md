# 09 — Testing Strategy

**Scope:** what to test, at which level, and the conventions/tools. Testing is part of the
Definition of Done (CLAUDE.md §6) — a feature without its tests is not done.

---

## 1. The pyramid for this project
- **Unit (Vitest):** pure logic — the state-machine transition rules + guards (doc 04), zod
  schemas, formatters, occupancy/load math, the AI JSON parser. Fast, the bulk of tests.
- **Component (Vitest + React Testing Library):** UI primitives and key screens render with the
  right states (loading/empty/error), forms validate, role-gated elements show/hide correctly.
- **RLS / database (SQL harness):** the security boundary — each role can do exactly what doc 02
  §RBAC allows and nothing more. **This is the highest-value layer; never skip it.**
- **E2E (Playwright):** the few critical journeys end-to-end against a seeded local Supabase.

## 2. State-machine tests (doc 04) — required matrix
For each transition: assert legal moves succeed and illegal/skip moves are rejected. For each
guard, a negative test:
- start without estimate → rejected.
- complete an overdue task without a delay note → rejected.
- reach `uploaded` without an approved review → rejected.
- review `revisions` increments `revision_count` and creates a `reedit` task.
- `revision_count` crossing 3 fires a CEO notification.
- only the assignee can move their task; assignment is admin-only.

## 3. RLS harness (the security tests)
Create three test JWTs (ceo, admin, staff) via local Supabase. For every table, assert the
matrix from doc 02:
- staff **cannot** read another staff member's tasks, any client row, or projects they aren't on.
- staff **cannot** change `assignee_id`/`project_id` on their own task (column guard).
- admin can CRUD clients/projects/tasks; CEO is read-only on operational tables.
- a user only ever receives their own notifications.
Pattern (per case): sign in as role → attempt the op → assert allowed/denied. Put these in
`tests/rls/` and run in CI. See `.claude/skills/rbac-rls-policy` for helpers.

## 4. E2E journeys (Playwright) — MVP must-pass
1. Admin: add lead → move to won → assign shoot+edit → project appears on the floor.
2. Staff: start task (estimate) → complete → admin gets in-app notification → next task surfaces.
3. Admin: review → revisions → editor gets a reedit task → review → approved → upload → uploaded.
4. CEO: overview shows correct counts, occupancy, funnel; Excel export downloads with the right
   columns.
5. Role gating: staff cannot reach `/desk` or `/overview`.

## 5. Conventions
- Test files next to source: `*.test.ts(x)`; e2e in `tests/e2e/`; RLS in `tests/rls/`.
- Deterministic data from `supabase/seed.sql`; reset DB before the e2e/RLS suites.
- Mock the Anthropic + WhatsApp calls in unit/component tests; never hit live APIs in CI.
- Coverage target: 90%+ on the state-machine module; meaningful coverage elsewhere (don't chase
  100% on glue code).

## 6. CI (GitHub Actions)
On every PR: `pnpm lint` → `pnpm typecheck` → `pnpm test` (unit+component) → spin local Supabase
→ RLS suite → Playwright e2e. Block merge on any failure. Keep the pipeline under ~10 min.

## 7. What good looks like
A reviewer can read the test names and understand the rules of the system. Tests describe
behaviour ("rejects completing an overdue task without a note"), not implementation.
