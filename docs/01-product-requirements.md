# 01 — Product Requirements (PRD)

**Scope:** the *what* and *why*. Vision, users, roles, in/out of scope, MVP features, success
metrics, and the open questions that still gate decisions. Architecture lives in doc 02.

---

## 1. Vision
Replace the studio's spreadsheet with a role-based ERP so the team stops spending its day
chasing status updates and manually re-keying data. One screen should answer "who is working
on what, who is free, and where is every client?" in seconds.

## 2. Users & personas
- **CEO (you).** Wants total visibility and analytics, minimal data entry. Reads everything.
- **Admin.** The operational hub: takes leads, confirms clients, assigns shoot/edit/freelance
  work, relays client feedback, tracks freelancer hours. Heaviest daily user.
- **Staff (editors who also shoot).** Execute shoot/edit tasks; update their own status;
  estimate time; explain delays. ~6 core people (Rahul, Saurabh, Neel, Aniket, Anjali, Mamta).
- **Freelancers.** Rotating pool, paid hourly, assigned by the admin; log hours against tasks.

## 3. Roles (RBAC summary — full matrix in doc 02)
- **CEO / super admin** — read-all, plus analytics & export. No day-to-day data entry required.
- **Admin** — full CRUD on leads, clients, projects, tasks, assignments, freelancer rates/hours.
- **Staff / freelancer** — see and update only their own tasks; log their own hours.

## 4. The workflow being digitized
1. **Lead intake** — client calls; admin logs contact + requirements; tags a CRM stage.
2. **Confirm & assign** — won lead becomes a project; admin assigns a shooter + an editor
   (and/or a freelancer), respecting who is free.
3. **Shoot** — shooter records, marks shoot task complete.
4. **Edit** — editor cuts; on completion the admin is auto-notified.
5. **Client review** — admin **manually** relays the cut to the client (no client login).
   Client approves, or returns notes.
6. **Revision loop** — notes → a `reedit` task back to the editor; `revision_count` increments;
   re-review until approved.
7. **Upload** — approved → upload-ready → uploaded → done.
Freelancers plug in at shoot or edit, assigned by the admin, billed by logged hours.

## 5. MVP feature list (must-have to retire the spreadsheet)
- Auth + three roles with enforced RLS.
- Lead intake & CRM-stage pipeline (standard stages, see §7).
- Confirm a won lead into a project; assign shoot/edit/freelance.
- Task lifecycle with the state machine (doc 04) and full audit trail.
- Staff self-update of task status; estimate-on-start; delay note when overdue.
- "Who's free" suggestion to the admin (NOT auto-assign — admin confirms).
- Live occupancy board (CEO + admin).
- Client-review stage with revision loop and notes.
- In-app notification feed (Realtime) + WhatsApp team broadcast (see doc 08 caveats).
- One-click Excel export reproducing the existing sheet's columns.

## 6. Phase 2 / later (explicitly NOT in MVP)
- AI flow-based assignment + load-balancing + deadline-risk + lead scoring + weekly summary
  (doc 07). *AI suggestions are phase 2; the "who's free" prompt in MVP is rules-based.*
- Freelancer hour tracking with rate captured at onboarding (track only — no payroll run).
- Turnaround & revision analytics dashboards.
- Capacitor mobile build (iOS/Android).
- **Full auto task hand-off** (no admin click) — a future toggle, not MVP.
- **No client self-review portal, ever per current decision** — admin always relays manually.

## 7. Decisions locked with the operator
- **Notifications:** in-app **and** WhatsApp; a shared team space where a bot posts every status
  change. (Real WhatsApp-group constraints + recommended approach in doc 08.)
- **Client review:** always relayed manually by the admin. No client login.
- **Freelancers:** rate is set at onboarding and stored; system tracks hours and shows
  `hours × rate` totals. No payroll run — operator pays outside.
- **Lead tags:** standard CRM stages — `new → contacted → qualified → proposal → won`, with
  `lost` (+ reason) as a terminal state. Nothing bespoke.
- **Assignment:** rules-based "who's free" prompt to the admin in MVP; AI hints in phase 2;
  full auto hand-off is a future toggle.
- **Platform:** web first; stack chosen so Capacitor can wrap it for mobile without a rewrite.

## 8. Success metrics (baseline from month 1, then track)
- Admin follow-up time ↓ (target ~6 h/week saved).
- Shoot→upload turnaround ↓ (target ~30%).
- 100% of task actions attributable to a person + timestamp (audit completeness).
- Spreadsheet fully retired: all new projects created in Studio OS within 30 days of launch.

## 9. OPEN QUESTIONS (still gating — surface to the human before building the affected area)
1. **One** team WhatsApp space, or several (per-team / client-facing)? Affects bot routing (doc 08).
2. Can a freelancer see their own running `hours × rate` total, or is it CEO/admin-only? (doc 05/03)
3. On `lost`, require a reason (price / timing / went elsewhere) for later analysis? (doc 03)
4. Are WhatsApp *groups* acceptable via an unofficial bridge, or do we broadcast to members
   (official API) / consider Telegram for true group-bot support? (doc 08) — **blocks WhatsApp work.**
5. Hosting preference for the frontend (Vercel / Netlify / self-host)? (doc 02)
6. Do shoot & edit dates need calendar/scheduling, or is a date field enough for MVP? (doc 05)
