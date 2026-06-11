---
name: task-state-machine
description: Use this skill whenever work involves changing a task status, a project stage, an assignment, or the client-review/revision loop in Studio OS — or whenever you are tempted to write an UPDATE on a status/current_stage/lead_stage column. Trigger it before implementing "mark complete", "start task", "assign", "submit review", "move lead", or any hand-off. It encodes the one-entry-point engine, the legal transitions, the mandatory guards (estimate-on-start, delay-note-when-late, no stage skipping, revision cap), and the audit + notification side effects.
---

# The state machine (Studio OS)

Full spec: `docs/04-state-machine.md`. This skill is the implementation playbook. The cardinal
rule: **status, current_stage, and lead_stage change ONLY through the engine** — never a raw
`UPDATE` from the client or an ad-hoc query.

## Engine = RPCs
Transitions are Postgres `security definer` functions (doc 06 §3), called via `supabase.rpc(...)`:
- `task_transition(p_task, p_to, p_estimate?, p_note?)`
- `assign_task(p_project, p_type, p_assignee, p_due)`
- `set_lead_stage(p_client, p_stage, p_lost_reason?)`
- `submit_review(p_project, p_outcome, p_feedback)`

Each function performs, atomically: validate legal move → authorize actor → enforce guards →
apply update → recompute derived project state → insert `task_events` → emit notifications →
queue the admin hand-off prompt. (No auto-assign in MVP.)

## Legal transitions (enforce; reject everything else)
- Task: `queued→in_progress→completed`; `*→blocked→in_progress`.
- Project (derived from tasks): `confirmed→shoot_pending→shooting_done→editing→client_review→
  upload_ready→uploaded`, plus `client_review→editing` on revisions.
- Lead: `new→contacted→qualified→proposal→won`; `*→lost`.

## Guards (each needs a negative test)
- `queued→in_progress` requires `estimate_minutes` (else reject).
- Completing an overdue / over-estimate task requires `delay_note` (else reject).
- Cannot reach `uploaded` without an approved review.
- `submit_review(revisions)` increments `revision_count`, creates a `reedit` task for the editor,
  attaches feedback; crossing `revision_count > 3` notifies the CEO and flags the project.
- Only the assignee moves their task; assignment/review/lead moves are admin-only.

## Always
- Append a `task_events` row (`actor_id`, `from_state`, `to_state`, `payload`) for every change.
- Recompute `project.current_stage` and `project.status` from tasks after a task move.
- Fire the doc-08 notifications for the event.

## Adding/changing a transition
1. Update `docs/04` (and get sign-off if it changes the matrix — CLAUDE.md §7).
2. Edit the relevant RPC; keep the validate→authorize→guard→apply→recompute→log→notify order.
3. Add unit tests for the new legal path AND the illegal/guard cases (doc 09 §2).
4. Never let the client set the column directly to "shortcut" the engine.
