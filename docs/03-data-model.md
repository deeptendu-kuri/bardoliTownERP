# 03 — Data Model

**Scope:** the database. Entities, enums, relationships, RLS approach, the mapping from the old
spreadsheet, and reference DDL. State transitions over this data are in doc 04.

---

## 1. Entity overview
- **profiles** — every user (CEO, admin, staff, freelancer). 1:1 with `auth.users`.
- **clients** — leads and won clients (the CRM). `lead_stage` drives the pipeline.
- **projects** — one video deliverable for a client (≈ one row in the old sheet).
- **tasks** — granular work on a project: `shoot | edit | reedit | upload`, one assignee each.
- **task_events** — immutable audit log of every state transition / action.
- **review_rounds** — each client-review cycle on a project (feedback + outcome).
- **time_logs** — hours logged against a task (for freelancer billing; rate snapshot).
- **notifications** — per-recipient in-app/WhatsApp notifications.
- **ai_suggestions** — logged AI suggestions and their accept/dismiss outcome (phase 2).

```
clients 1───< projects 1───< tasks 1───< time_logs
                  │             └──< task_events
                  └──< review_rounds
profiles 1───< tasks (assignee)
profiles 1───< notifications (recipient)
```

## 2. Enums (create as Postgres enums)
- `user_role`: `ceo | admin | staff`
- `employment_type`: `employee | freelancer`
- `lead_stage`: `new | contacted | qualified | proposal | won | lost`
- `project_stage`: `confirmed | shoot_pending | shooting_done | editing | client_review | upload_ready | uploaded`
- `project_status`: `pending | in_progress | completed`  (rollup used for the sheet's "Task Status")
- `priority`: `low | medium | high`
- `approval`: `pending | approved`
- `task_type`: `shoot | edit | reedit | upload`
- `task_status`: `queued | in_progress | completed | blocked`
- `review_outcome`: `approved | revisions`
- `notif_channel`: `in_app | whatsapp`
- `suggestion_status`: `pending | accepted | dismissed`

## 3. Spreadsheet → schema mapping
| Old column | New location |
|---|---|
| Task No | `projects.project_no` (human-readable seq) |
| Date | `projects.created_at` |
| Shoot/Client Name | `clients.name` + `projects.title` |
| video type | `projects.video_type` |
| Task Status | `projects.status` (rolled up from tasks) |
| Lead Stage | `clients.lead_stage` (Upcoming → not-yet-won; Final Lead → won) |
| Current Workflow | `projects.current_stage` |
| Priority | `projects.priority` |
| Assigned Employee | `tasks.assignee_id` (one row per shoot/edit task; split roles → separate tasks) |
| Shoot Date | `projects.shoot_date` (and the shoot task's `due_date`) |
| Editing Date | `projects.editing_date` |
| Upload Date | `projects.upload_date` |
| Client Approval | `projects.client_approval` |

> Migration note: `seed.sql` parses the exported sheet, creating one client + one project per
> row and splitting `Assigned Employee` like `Rahul(Shoot)/Neel(Edit)` into a shoot task for
> Rahul and an edit task for Neel. Names map to `profiles` by `full_name` (create missing ones
> as inactive placeholders the admin can later fill in).

## 4. RLS approach
Enable RLS on **every** table in the same migration that creates it. Use helper functions:
```sql
create or replace function auth_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function is_admin() returns boolean
  language sql stable as $$ select auth_role() in ('admin','ceo') $$;
create or replace function is_ceo() returns boolean
  language sql stable as $$ select auth_role() = 'ceo' $$;
```
Then write policies to match the doc-02 matrix. Staff write-paths must restrict **columns** —
see `.claude/skills/rbac-rls-policy` for the exact pattern (policy + guard trigger).

## 5. Reference DDL (abridged — full version generated in the first migration)
```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role user_role not null default 'staff',
  employment_type employment_type not null default 'employee',
  hourly_rate numeric(10,2),               -- set at onboarding for freelancers
  skills text[] default '{}',              -- e.g. {shoot, edit, motion} — powers "who's free"
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  contact_phone text,
  contact_email text,
  requirements text,
  lead_stage lead_stage not null default 'new',
  lost_reason text,                        -- required iff lead_stage='lost' (see open Q3)
  source text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  project_no serial unique,                -- human-readable "Task No"
  client_id uuid not null references clients(id),
  title text not null,
  video_type text,
  priority priority not null default 'medium',
  current_stage project_stage not null default 'confirmed',
  status project_status not null default 'pending',
  client_approval approval not null default 'pending',
  revision_count int not null default 0,
  shoot_date date, editing_date date, upload_date date,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type task_type not null,
  assignee_id uuid references profiles(id),
  status task_status not null default 'queued',
  estimate_minutes int, actual_minutes int,
  due_date date,
  delay_note text,                         -- required when overdue + completed
  sort_order int not null default 0,       -- order within an assignee's queue
  started_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table task_events (
  id bigint generated always as identity primary key,
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  actor_id uuid references profiles(id),
  event_type text not null,                -- 'transition' | 'assign' | 'estimate' | 'note' ...
  from_state text, to_state text,
  payload jsonb default '{}',
  created_at timestamptz not null default now()
);

create table review_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  round_no int not null,
  sent_at timestamptz default now(),
  feedback text,
  outcome review_outcome,
  created_by uuid references profiles(id)
);

create table time_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  minutes int not null check (minutes > 0),
  hourly_rate_snapshot numeric(10,2),      -- copied from profile at log time
  logged_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  channel notif_channel not null default 'in_app',
  type text not null, title text not null, body text,
  payload jsonb default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  type text not null,                      -- 'assignment' | 'load_balance' | 'deadline_risk' ...
  context jsonb not null, suggestion jsonb not null,
  status suggestion_status not null default 'pending',
  created_at timestamptz not null default now()
);
```

## 6. Useful views
- `v_occupancy` — per active profile: active task count, weighted load %, current task + stage.
- `v_pipeline` — client counts per `lead_stage` (powers the funnel).
- `v_sheet_export` — projects joined to client + assignees, columns ordered to match the old
  spreadsheet exactly (consumed by the export function; see `.claude/skills/excel-export`).

## 7. Indexing & integrity
- Index `tasks(assignee_id, status)`, `tasks(project_id)`, `projects(current_stage)`,
  `clients(lead_stage)`, `notifications(recipient_id, read_at)`.
- Constraint: `lost_reason` not null when `lead_stage='lost'` (enforce via check or trigger,
  pending open Q3).
- `updated_at` maintained by a `BEFORE UPDATE` trigger on `clients`/`projects`.
