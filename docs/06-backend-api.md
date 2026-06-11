# 06 — Backend & API

**Scope:** how the frontend talks to data — direct Supabase queries vs RPCs vs Edge Functions —
plus the data-access hook conventions, realtime wiring, and the contract of each Edge Function.

---

## 1. Access patterns — pick the right one
- **Direct table reads** (via supabase-js, guarded by RLS): lists and detail views the role is
  allowed to read. Wrapped in TanStack Query hooks.
- **RPC (Postgres function)**: anything that must be atomic or enforce rules — above all the
  **state-machine transitions** (doc 04), lead→project conversion, and assignment. Never let the
  client write `status`/`current_stage` directly.
- **Edge Function**: anything needing a secret or external call — `ai-suggest`, `notify`
  (incl. WhatsApp), `export-sheet`, `weekly-summary`.

## 2. Data-access hook conventions (`features/*/api.ts`)
- One file of hooks per feature. Query keys are arrays: `['projects', filters]`,
  `['tasks','mine']`, `['occupancy']`, `['pipeline']`.
- Reads: `useQuery`; writes: `useMutation` that calls an RPC/Edge Function then invalidates the
  affected keys. Realtime events also invalidate (see §4) so the UI never goes stale.
- All inputs validated with zod before the call; surface errors via `Toast`.

Example:
```ts
export function useStartTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; estimateMinutes: number }) =>
      rpc('task_transition', { p_task: v.taskId, p_to: 'in_progress', p_estimate: v.estimateMinutes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] });
                       qc.invalidateQueries({ queryKey: ['occupancy'] }); },
  });
}
```

## 3. RPCs (Postgres functions — security definer, re-check role inside)
- `task_transition(p_task uuid, p_to task_status, p_estimate int default null, p_note text default null)`
  → runs the engine (doc 04 §4). Returns the updated task + new project stage.
- `assign_task(p_project uuid, p_type task_type, p_assignee uuid, p_due date)` → admin-only;
  creates the task, sets project stage, logs event, notifies.
- `set_lead_stage(p_client uuid, p_stage lead_stage, p_lost_reason text default null)` → admin-only;
  on `won`, creates the project.
- `submit_review(p_project uuid, p_outcome review_outcome, p_feedback text)` → admin-only;
  drives client_review → upload_ready / editing(+reedit), bumps revision_count.
- `log_hours(p_task uuid, p_minutes int)` → inserts a `time_logs` row with rate snapshot.
Each RPC: validate → authorize → mutate → log `task_events` → return structured result.

## 4. Realtime wiring
Subscribe once at app shell to Postgres changes:
```ts
supabase.channel('floor')
  .on('postgres_changes', { event:'*', schema:'public', table:'tasks' },     onTaskChange)
  .on('postgres_changes', { event:'*', schema:'public', table:'projects' },  onProjectChange)
  .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications',
        filter:`recipient_id=eq.${userId}` }, onNotification)
  .subscribe();
```
Handlers invalidate the matching query keys; the notification handler also bumps the bell + toast.
Respect RLS — realtime only delivers rows the user may read.

## 5. Edge Functions (Deno/TS, in `supabase/functions/`)
All return `{ ok: boolean, data?: unknown, error?: string }`, validate the caller JWT, and
re-check role before privileged work. Secrets via `supabase secrets`.

| Function | Purpose | Doc |
|---|---|---|
| `notify` | Persist a notification + fan out to WhatsApp when applicable | 08 |
| `ai-suggest` | Call Claude for assignment / load / deadline / lead suggestions | 07 |
| `weekly-summary` | Generate the Monday digest for the CEO | 07 |
| `export-sheet` | Build the xlsx from `v_sheet_export` and return a signed URL | skill |

`ai-suggest` contract:
```
POST /functions/v1/ai-suggest
body: { type: 'assignment'|'load_balance'|'deadline_risk'|'lead_priority', context: {...} }
200:  { ok:true, data:{ suggestion:{...}, rationale:string } }
```

## 6. Business rules that live in the backend (not the client)
- Stage/status changes — engine RPC only.
- Project creation on lead `won`.
- Rate snapshot on `time_logs` insert.
- Revision-cap CEO escalation.
- Overdue scan — a scheduled function (cron) flips overdue tasks and notifies (doc 04 §6).

## 7. Validation & errors
- zod schemas mirror DB constraints on the client for fast feedback; the DB/RPC is the real
  guard. Map Postgres errors to friendly messages (e.g. unique-violation → "Already exists").
