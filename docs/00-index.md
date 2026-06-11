# Studio OS — Documentation Index

Read the doc that owns the area you are about to touch. Each doc opens with a **Scope** line.

| # | Doc | Read it when you are… |
|---|---|---|
| 01 | `01-product-requirements.md` | unsure what's in scope, who a role is, or what "done" means for the product |
| 02 | `02-tech-design.md` | setting up the project, wiring Supabase, or reasoning about architecture/RBAC |
| 03 | `03-data-model.md` | creating/altering tables, enums, relations, or writing RLS |
| 04 | `04-state-machine.md` | changing a status, stage, assignment, or the review/revision loop |
| 05 | `05-ui-ux.md` | building any screen, component, or styling anything |
| 06 | `06-backend-api.md` | writing an Edge Function, RPC, or data-access hook |
| 07 | `07-ai-integration.md` | building any AI suggestion or summary feature |
| 08 | `08-notifications.md` | sending an in-app or WhatsApp notification |
| 09 | `09-testing.md` | writing tests of any kind |
| 10 | `10-build-roadmap.md` | deciding what to build next |

## Reading order for a cold start
01 → 02 → 03 → 04 → 05, then 06–09 as needed, sequenced by 10.

## Glossary (used consistently across all docs)
- **Lead** — a potential client in the sales pipeline (`clients.lead_stage`).
- **Project** — one video deliverable for a won client (~ one row in the old spreadsheet).
- **Task** — a single unit of work on a project (`shoot`, `edit`, `reedit`, `upload`),
  assigned to one person.
- **Stage** — where a project is in production (`shoot_pending … uploaded`).
- **Occupancy** — how loaded a person is, derived from their active tasks.
- **Hand-off** — moving work to the next person; in MVP the admin confirms it (not auto).
