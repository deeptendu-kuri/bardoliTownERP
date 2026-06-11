# 10 — Build Roadmap

**Scope:** the order of work. Each milestone lists deliverables and a Definition of Done. Build
top to bottom — later milestones assume earlier ones. Tick boxes honestly as you go.

---

## Phase 1 — Core spine + migrate the sheet (MVP foundation)

### M1 — Project setup & auth
- [ ] Vite + React + TS + Tailwind scaffold; tokens.css from doc 05; UI primitives stubbed.
- [ ] Supabase project (local + staging); supabase-js client; `.env.example`.
- [ ] Supabase Auth (email/password or magic link); `profiles` table + signup trigger.
- [ ] App shell: role-gated nav, top bar, route-by-role landing.
**DoD:** a user can log in and land on the right dashboard; RLS on `profiles`; types generated.

### M2 — Data model & RBAC
- [ ] All tables/enums/views from doc 03 in one migration; RLS + helper functions.
- [ ] RLS harness (doc 09 §3) passing for all three roles.
- [ ] `seed.sql` importing the existing spreadsheet (clients+projects+tasks; split assignees).
**DoD:** the doc-02 RBAC matrix is enforced and proven by the RLS suite.

### M3 — State machine engine
- [ ] Transition RPCs + guards (doc 04); `task_events` audit on every move.
- [ ] Unit tests for the full transition matrix + every guard (doc 09 §2).
**DoD:** no status/stage can change except through the engine; tests green; audit rows written.

### M4 — Lead pipeline & assignment (Admin desk, part 1)
- [ ] Lead Inbox + new-lead drawer; inline stage edits via `set_lead_stage`.
- [ ] `won` → project creation; Assign Board with free-now list; `assign_task`.
**DoD:** admin can take a lead to a confirmed, assigned project end-to-end.

### M5 — Task execution (Staff)
- [ ] My Tasks: current TaskCard, estimate-on-start, complete (+ delay-note guard), my queue.
- [ ] In-app notifications + Realtime bell/toast; "who's free" rules-based admin prompt.
**DoD:** e2e journey #2 (start→complete→notify→next) passes.

### M6 — Review loop + occupancy + export (CEO/Admin part 2)
- [ ] Review queue: approved / revisions(+feedback) → revision loop; CEO escalation >3.
- [ ] CEO overview: stat row, live floor, occupancy, pipeline funnel.
- [ ] Excel export from `v_sheet_export` (skill).
**DoD:** e2e journeys #1,#3,#4 pass; spreadsheet can be retired.

---

## Phase 2 — Intelligence + money + mobility
### M7 — Freelancer hours
- [ ] Rate at onboarding; `log_hours` + snapshot; `hours × rate` views (respect open Q2 on
      freelancer visibility).
### M8 — AI layer (doc 07)
- [ ] `ai-suggest` Edge Function + assignment/load/deadline/lead features; AISuggestionCard.
- [ ] `weekly-summary` cron + CEO digest.
### M9 — Analytics + WhatsApp
- [ ] Turnaround & revision-rate analytics on the CEO overview.
- [ ] WhatsApp broadcast (only after open Q4 is answered; doc 08) behind a feature flag.

---

## Phase 3 — Mobile
### M10 — Capacitor wrap
- [ ] iOS/Android builds of the same web app; phone-first review of staff screens; push.

---

## Sequencing rules
- Don't start a milestone before the previous one's DoD is met.
- Anything touching the data model / RBAC / state machine beyond the docs → stop, ask (CLAUDE.md §7).
- Keep `docs/` updated if reality forces a change, and note it in the PR.

## Suggested first prompt to Claude Code
> "Read CLAUDE.md and docs/00-index.md, then execute milestone M1 from docs/10-build-roadmap.md.
>  Use the skills in .claude/skills as needed. Stop and ask me at the first DoD checkpoint."
