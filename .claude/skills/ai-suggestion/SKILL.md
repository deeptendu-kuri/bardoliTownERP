---
name: ai-suggestion
description: Use this skill whenever you build or modify any AI feature in Studio OS — the flow-based assignment suggestion, load balancing, deadline-risk, lead prioritisation, or the weekly CEO summary. Trigger it any time you are about to call the Anthropic Claude API, write the ai-suggest or weekly-summary Edge Function, or design a prompt. It encodes the server-side-only rule, the suggest-never-act guardrail, model choice, the JSON-only IO contract, defensive parsing, and graceful degradation. These features are phase 2 — confirm before building in MVP.
---

# AI suggestions (Studio OS)

Full spec: `docs/07-ai-integration.md`. AI is **phase 2** — the MVP "who's free" prompt is
rules-based, not AI. Confirm the milestone before building.

## Non-negotiables
- **Server-side only.** Call Anthropic from the `ai-suggest` / `weekly-summary` Edge Functions.
  The `ANTHROPIC_API_KEY` is an Edge secret; the browser never calls Anthropic.
- **Suggest, never act.** Output is a suggestion the admin/CEO accepts (→ runs the normal RPC) or
  dismisses. AI never transitions or assigns on its own.
- **Grounded + logged.** Send only the minimal structured context (IDs + needed attributes);
  log every suggestion to `ai_suggestions`.
- **Graceful degradation.** On API failure or bad JSON, return `ok:false`; the UI falls back to
  the rules-based prompt. AI is never load-bearing.

## Models (verify at https://docs.claude.com/en/docs/about-claude/models)
- Suggestions: `claude-haiku-4-5-20251001` (fast/cheap).
- Weekly summary: `claude-sonnet-4-6`.
Keep `max_tokens` small; demand JSON-only.

## Call shape (Edge Function, Deno)
```ts
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method:'POST',
  headers:{ 'content-type':'application/json',
            'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
            'anthropic-version':'2023-06-01' },
  body: JSON.stringify({
    model:'claude-haiku-4-5-20251001', max_tokens:600,
    system: SYSTEM_PROMPTS[type],   // states role + exact JSON schema + "JSON only, no prose"
    messages:[{ role:'user', content: JSON.stringify(context) }],
  }),
});
const data = await res.json();
const text = data.content.map((c:any)=>c.type==='text'?c.text:'').join('');
let suggestion; try { suggestion = JSON.parse(stripFences(text)); }
catch { return json({ ok:false, error:'bad_ai_json' }); }
```

## Prompt rules
- System prompt: the role, the exact output JSON schema, and "return only JSON — no markdown,
  no prose". Keep prompts in `functions/ai-suggest/prompts.ts`, versioned + unit-tested with
  recorded fixtures.
- Validate `context` with zod before the call; re-check the caller is admin/ceo.
- Never include secrets or unrelated PII in context.

## Per-feature IO (see doc 07 §3 for context fields)
- assignment → `{ assignee_id, rationale }`
- load_balance → `{ moves:[{task_id,from,to,reason}] }`
- deadline_risk → `{ risk:'low'|'med'|'high', reason }`
- lead_priority → `{ ranked:[{client_id,score,reason}] }`
- weekly summary → markdown string for the CEO digest.

## UI
Render via the violet `AISuggestionCard` with Accept (runs the real RPC) / Dismiss (updates
`ai_suggestions.status`). On-demand (admin clicks "Suggest") + the weekly cron — not per keystroke.
