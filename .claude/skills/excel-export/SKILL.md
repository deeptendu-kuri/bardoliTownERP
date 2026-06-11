---
name: excel-export
description: Use this skill whenever you implement or change the Excel/spreadsheet export in Studio OS — the CEO/admin "Export" button that reproduces the team's original sheet. Trigger it any time the task involves generating an .xlsx, the export-sheet Edge Function, SheetJS, or matching the legacy column layout. It encodes the exact column order/format from the old spreadsheet, the v_sheet_export view, and the weekly/monthly export expectation. The whole point is that the output is familiar to the operator — match the old sheet precisely.
---

# Excel export (Studio OS)

The operator must be able to export weekly/monthly and have it look like their current sheet
(PRD §5; mapping in `docs/03-data-model.md §3`). Familiarity is the feature — match it exactly.

## Source of truth: `v_sheet_export`
Build/maintain a Postgres view that emits one row per project with columns **in this order**,
matching the legacy sheet:

`Task No | Date | Shoot/Client Name | video type | Task Status | Lead Stage | Current Workflow |
Priority | Assigned Employee | Shoot Date | Editing Date | Upload Date | Client Approval`

Where:
- Task No = `projects.project_no`; Date = `projects.created_at::date`.
- Shoot/Client Name = client name (+ project title if distinct).
- Assigned Employee = aggregated like the original (`Rahul(Shoot)/Neel(Edit)`) by joining the
  project's shoot/edit/reedit tasks to assignee names with role suffixes.
- Task Status / Current Workflow / Lead Stage / Client Approval map from the enums (doc 03);
  render human-readable labels (e.g. `client_review` → "Client Review").

## Generation (prefer the Edge Function `export-sheet`)
- The function selects from `v_sheet_export` (RLS: admin/ceo only), builds the workbook with
  SheetJS, uploads to Supabase Storage, and returns a short-lived signed URL.
- Client-side fallback (small datasets) is acceptable, but the Edge path keeps it consistent and
  works for large exports.

```ts
import * as XLSX from 'xlsx';
const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMN_ORDER }); // enforce order
XLSX.utils.book_append_sheet(wb, ws, 'Production');
// style: bold header row; freeze top row; sensible column widths
```

## Conventions
- `COLUMN_ORDER` is a single exported constant — the one place the layout is defined; reuse it
  in tests.
- Date cells formatted `dd-MMM` to match the sheet (e.g. `23-May`).
- Filename: `studio-os-export-YYYY-MM-DD.xlsx`.
- Support an optional date range (week/month) filter passed to the view/function.

## Tests
- A unit test asserts the generated sheet's header row equals `COLUMN_ORDER` exactly and that a
  known seeded project renders with the right Assigned-Employee string and labels.
- E2E journey #4 (doc 09) downloads the file and checks the columns.
