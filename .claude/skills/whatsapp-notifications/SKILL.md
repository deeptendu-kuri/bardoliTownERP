---
name: whatsapp-notifications
description: Use this skill whenever you implement or change notifications in Studio OS — the in-app feed or the WhatsApp "team bot" broadcast. Trigger it before writing the notify Edge Function, adding a notification event, or wiring WhatsApp/Telegram. It encodes the event→recipient map, the in-app Realtime pattern, and crucially the WhatsApp platform constraints (the official API cannot post to arbitrary groups) plus the recommended broadcast/Telegram paths. WhatsApp work is BLOCKED until open question Q4 is answered — read this before attempting it.
---

# Notifications (Studio OS)

Full spec: `docs/08-notifications.md`. Events are fired by the state engine (doc 04 §6).

## In-app (MVP, always build first)
- Insert a `notifications` row per recipient (RLS-scoped to self).
- Realtime subscription on the app shell (filter `recipient_id=eq.<me>`) → bell badge + toast.
- `/notifications` view lists history; opening marks `read_at`.
- This channel alone is sufficient to retire the spreadsheet.

## The notify Edge Function
```
state engine ──▶ notify(event) ──▶ insert notifications rows (→ Realtime → in-app)
                                └─ if event.broadcast: send via configured provider
```
- Typed event in; `notify` owns templates (`functions/notify/templates.ts`) + fan-out.
- Idempotent (carry an event id so retries don't double-send).
- Private events (revision-cap escalation, overdue) are **in-app only — never broadcast.**

## WhatsApp — READ BEFORE BUILDING (open question Q4 gates this)
The **official WhatsApp Cloud API cannot post into an arbitrary WhatsApp group.** It messages
individual numbers via approved templates (or session messages within 24h). So a literal
"bot in the team group" is not supported officially. Approaches:
1. **Broadcast to members (recommended/official):** send an approved template to each member's
   number. Reads like a bot feed per person; ToS-safe; reliable.
2. **Unofficial group bridge:** can post to a real group but violates ToS and is fragile — do
   not use for a business tool.
3. **Telegram bot (recommended if a true group feed is required):** native group posting, free,
   trivial — gives the exact "bot updates the group" UX without WhatsApp's limits.

**Do not build the broadcast piece until the human picks 1/2/3.** Until then, keep it behind a
feature flag and ship in-app only.

## Provider setup (option 1)
- Meta WhatsApp Cloud API: Business app, phone-number id, permanent token, approved templates.
- Secrets: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` (Edge secrets, never client).
- Send (template message):
```ts
await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
  method:'POST',
  headers:{ authorization:`Bearer ${TOKEN}`, 'content-type':'application/json' },
  body: JSON.stringify({ messaging_product:'whatsapp', to: memberPhone,
    type:'template', template:{ name:'studio_status_update', language:{code:'en'},
      components:[{ type:'body', parameters:[{type:'text', text: msg}] }] } }),
});
```
- Map `profiles.phone`; respect opt-out; rate-limit/batch bursts; log every send + failure.

## Guardrails
Never broadcast private events; never drop a failed send silently (surface to admin); keep the
in-app feed authoritative.
