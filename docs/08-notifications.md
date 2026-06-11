# 08 — Notifications

**Scope:** how the system tells people things — the in-app feed and the WhatsApp "team bot" —
the events, the delivery architecture, and an honest account of WhatsApp's constraints with a
recommended path. Events are fired by the state machine (doc 04 §6).

---

## 1. Two channels
- **In-app (MVP, always on):** a `notifications` row per recipient + Supabase Realtime → bell
  badge + toast. This is the reliable, owned channel and is sufficient to retire the spreadsheet.
- **WhatsApp team bot (MVP intent):** a shared team space where a bot posts every status change
  so people see updates where they already talk. **Read §4 before building — there are real
  platform limits.**

## 2. Event → recipients (from doc 04)
| Event | In-app recipients | Team broadcast? |
|---|---|---|
| shoot completed | admin | yes |
| edit/reedit completed | admin | yes |
| review → revisions | the editor | optional |
| review → approved | admin (+CEO digest) | yes |
| uploaded | admin, CEO | yes |
| revision_count > 3 | CEO | no (private) |
| task overdue | assignee + admin | no (private) |
| new lead won | admin | yes |

Private events (escalations, overdue) stay in-app only — don't broadcast sensitive items.

## 3. Architecture
```
state machine ──▶ notify(event) Edge Function
                    ├─ insert notifications rows  ──▶ Realtime ──▶ in-app bell/toast
                    └─ if event.broadcast: post to WhatsApp via the configured provider
```
- The engine calls `notify` with a typed event; `notify` owns templates + fan-out.
- Templates live in `supabase/functions/notify/templates.ts` (one per event type).
- Idempotency: include an event id so retries don't double-post.

## 4. WhatsApp reality check (IMPORTANT — gates this work; open question Q4)
The **official WhatsApp Cloud API does not let a bot post into an arbitrary WhatsApp group.**
It sends messages to individual numbers (session messages within 24h of user contact, or
pre-approved template messages otherwise). So a literal "bot in the team WhatsApp group" is not
supported by the official API. Options, with our recommendation:

1. **Broadcast to members via Cloud API (recommended, official, durable).** Approve a small set
   of template messages; `notify` sends the relevant template to each team member's number. It
   reads like a bot feed in each person's chat, stays within Meta's ToS, and is reliable.
2. **Unofficial group bridge** (e.g. a library that drives WhatsApp Web). Can post to a real
   group, but violates WhatsApp ToS and breaks often — **not recommended for a business tool.**
3. **Telegram bot (recommended if a true group feed matters).** Telegram bots post into groups
   natively, free, trivial to build. If the team is open to a Telegram group, this gives the
   exact "bot updates the group" experience with none of the WhatsApp limitations.

**Do not build the WhatsApp piece until the operator picks 1, 2, or 3 (open Q4).** Until then,
ship the in-app feed (fully sufficient for MVP) and stub the broadcast behind a feature flag.

## 5. Provider setup (for option 1)
- Meta WhatsApp Cloud API: a Business app, a phone number id, a permanent access token, and
  approved message templates. Store `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` in Edge secrets.
- Map each `profiles.phone` to a recipient. Respect opt-out.
- See `.claude/skills/whatsapp-notifications` for the exact send code + template format.

## 6. In-app feed details
- Bell shows unread count (`notifications` where `read_at is null`, RLS-scoped to self).
- A `/notifications` view lists history; opening marks read.
- Toasts appear for high-signal events while the user is active.

## 7. Guardrails
- Never broadcast private/escalation events (§2).
- Rate-limit broadcasts (batch within a short window if many transitions fire at once).
- All sends logged; failures surfaced to the admin, never silently dropped.
