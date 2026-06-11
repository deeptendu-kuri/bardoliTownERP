# Studio OS

Internal production-management ERP for a video studio (~10 people). Replaces the team's
spreadsheet with a role-based dashboard system: lead pipeline, shoot/edit task routing,
client-review revision loop, live team occupancy, AI assignment hints, in-app + WhatsApp
notifications, and Excel export.

## Who this repo is for
- **The human (CEO/operator)** — reviews progress, answers the open product questions,
  approves stack/scope changes.
- **Claude Code** — builds the product. Start at `CLAUDE.md`, then `docs/00-index.md`.

## Quick start — demo build (no database needed)
The current build is a fully working MVP that runs entirely in the browser on a
localStorage-backed store seeded with realistic data. No Supabase, no keys.
```bash
pnpm install            # root convenience script proxies to apps/web
pnpm dev                # http://localhost:5173
```
Sign in with any seeded account (one-click on the login screen). Demo password
for every account: `studio123`. Accounts: `ceo@studio.test` (CEO),
`admin@studio.test` (Admin), `rahul@studio.test` / `neel@studio.test` / … (Staff),
`karan@freelance.test` / `divya@freelance.test` (Freelancers). "Reset demo" in the
nav restores the original seed.

Useful scripts (from the repo root): `pnpm test` (engine unit tests),
`pnpm typecheck`, `pnpm build`.

## Architecture seam (demo now, real DB later)
The frontend (`apps/web/src/ui`) only ever imports from the backend's single
public API (`apps/web/src/backend/index.ts`). Everything below it — state machine,
guards, RBAC, persistence — is isolated. Today it persists to localStorage; to go
live, implement a Supabase adapter behind that same API and the UI does not change.
The production schema is already written in `supabase/` (see `supabase/README.md`).

## Going live (later)
```bash
cp .env.example .env.local          # add Supabase URL + anon key
supabase start                      # local Postgres + Auth + Realtime
supabase db reset                   # apply migrations + seed
```

## Documentation map
| Doc | Owns |
|---|---|
| `docs/01-product-requirements.md` | Vision, roles, scope, MVP feature list, open questions |
| `docs/02-tech-design.md` | Architecture, stack rationale, RBAC matrix, environments |
| `docs/03-data-model.md` | Schema, enums, relations, RLS, spreadsheet mapping, DDL |
| `docs/04-state-machine.md` | Lead + project + task lifecycles, transitions, guardrails |
| `docs/05-ui-ux.md` | Design tokens, component system, all three dashboards |
| `docs/06-backend-api.md` | Edge Functions, RPCs, query hooks, business rules |
| `docs/07-ai-integration.md` | Claude API usage, suggestion features, prompts, guardrails |
| `docs/08-notifications.md` | In-app + WhatsApp architecture, events, templates |
| `docs/09-testing.md` | Test strategy across unit/component/e2e/RLS |
| `docs/10-build-roadmap.md` | Phased milestones with definition-of-done |

Reusable task playbooks live in `.claude/skills/`.
