# 04 — State Machines

**Scope:** the lifecycles that govern the product — lead pipeline, project production stages,
and task status — plus the transition rules, side effects, and guardrails. All status/stage
changes MUST go through the engine described here; never raw-`UPDATE` a status column.

---

## 1. Lead pipeline (`clients.lead_stage`)
```
new ──▶ contacted ──▶ qualified ──▶ proposal ──▶ won ──▶ (creates a project)
  └──────────┴────────────┴────────────┴──────▶ lost (+ lost_reason)   [terminal]
```
- Forward moves only between adjacent stages; `lost` reachable from any non-terminal stage.
- Reaching `won` triggers **project creation** (admin confirms shoot/edit assignment next).
- `lost` requires `lost_reason` (pending open Q3). Logged to `task_events` with `project_id`
  null and `payload.client_id` set.
- **Who can transition:** admin (CEO read-only).

## 2. Project production stage (`projects.current_stage`)
```
confirmed ──▶ shoot_pending ──▶ shooting_done ──▶ editing ──▶ client_review
                                                     ▲              │
                                                     │              ├──(approved)──▶ upload_ready ──▶ uploaded  [terminal]
                                                     └──(revisions)─┘  (revision_count++ , new reedit task)
```
The stage is **derived from task completion**, not set by hand:

| Transition | Trigger | Side effects |
|---|---|---|
| confirmed → shoot_pending | admin assigns a `shoot` task | create shoot task (queued) |
| shoot_pending → shooting_done | shoot task `completed` | notify admin; unblock/queue edit task |
| shooting_done → editing | edit task `in_progress` | — |
| editing → client_review | edit/reedit task `completed` | notify admin ("requirement fulfilled"); admin relays to client |
| client_review → upload_ready | review outcome `approved` | set `client_approval='approved'`; create `upload` task |
| client_review → editing | review outcome `revisions` | `revision_count++`; create `reedit` task back to the editor; attach feedback |
| upload_ready → uploaded | upload task `completed` | set `upload_date`; project `status='completed'` |

`projects.status` rollup: `pending` (no task started) → `in_progress` (any task active) →
`completed` (stage = uploaded). This column exists to reproduce the spreadsheet's "Task Status".

## 3. Task status (`tasks.status`)
```
queued ──▶ in_progress ──▶ completed
   └────────────┴────────▶ blocked  (with reason)  ──▶ in_progress (resume)
```
- `queued → in_progress`: assignee starts; MUST capture `estimate_minutes`; set `started_at`.
- `in_progress → completed`: set `completed_at`, `actual_minutes`. If `due_date < today` (or
  estimate exceeded), `delay_note` is REQUIRED before the transition is accepted.
- `blocked`: assignee or admin marks blocked with a reason in `payload`.
- Only the **assignee** may move their own task (admin may reassign/override).

## 4. The transition engine (single entry point)
Implement transitions as Postgres functions invoked via RPC (preferred) or in the `notify`
Edge Function. The engine is the ONLY thing allowed to change `status`/`current_stage`.

Every transition does, atomically:
1. **Validate** the move is legal for the current state (reject illegal/ skipped stages).
2. **Authorize** the actor (assignee for task moves; admin for assignment/review/lead moves).
3. **Enforce guards** (estimate-on-start, delay-note-on-late, revision cap — see §5).
4. **Apply** the column update(s).
5. **Recompute** derived state (`project.current_stage`, `project.status`, occupancy view).
6. **Append** a `task_events` row (actor, from, to, payload).
7. **Emit** notifications (in-app always; WhatsApp per doc 08 rules).
8. **Queue hand-off** — surface the next task to the admin as a "who's free" prompt (MVP:
   admin confirms; full-auto is a future toggle — do NOT auto-assign in MVP).

Pseudocode:
```ts
async function transition(input: TransitionInput) {
  const t = await load(input.taskId);
  assertLegal(t.status, input.to);              // (1)
  assertAuthorized(actor, t);                   // (2)
  enforceGuards(t, input);                      // (3)
  await applyUpdate(t, input);                  // (4)
  await recomputeProject(t.project_id);         // (5)
  await logEvent(actor, t, input);              // (6)
  await emitNotifications(t, input);            // (7)
  await queueHandoff(t.project_id);             // (8) admin prompt only in MVP
}
```

## 5. Guardrails (non-negotiable)
- **No stage skipping** — e.g. cannot reach `uploaded` without passing `client_review` approved.
- **Estimate required on start** — `queued → in_progress` without `estimate_minutes` is rejected.
- **Delay note required when late** — completing an overdue/over-estimate task without a
  `delay_note` is rejected.
- **Revision cap** — when `revision_count` would exceed 3, still allow it but **notify the CEO**
  (quality-risk escalation) and flag the project.
- **Single mover** — only the task's assignee changes its status; assignment changes are admin-only.
- **Everything is audited** — no transition without a `task_events` row.

## 6. Notifications fired by transitions (see doc 08 for delivery)
| Event | Recipients |
|---|---|
| shoot completed | admin |
| edit/reedit completed | admin |
| review → revisions | the editor (new reedit) |
| review → approved | admin (+ CEO digest) |
| uploaded | admin, CEO |
| revision_count > 3 | CEO |
| task overdue (daily check) | assignee + admin |

## 7. Test obligations (see doc 09)
Every transition path above needs a unit test (legal + illegal moves), and the guards each need
a negative test. The revision loop and the cap-escalation need explicit coverage.
