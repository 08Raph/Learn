# AI Professor service (Cloudflare Worker)

`worker.js` is the code of the Worker **learn-ai-professor**, deployed on 15 November 2026 to the site owner's
Cloudflare account at:

    https://learn-ai-professor.raphaelrst26.workers.dev/

`uni/config.js` points the AI Professor at that address.

## What it does
- Accepts `POST /` with `{ mode, system, messages }` from the AI Professor page, only from the origin
  `https://08raph.github.io` (other sites get 403; this is a browser rule, not a password).
- Limits each address to about 8 questions a minute (Workers rate-limit binding `PER_IP`, namespace 4601).
- Runs the model `@cf/zai-org/glm-4.7-flash` on **Cloudflare Workers AI** through the Worker's `AI` binding
  (no key needed). If that model errors, it tries `@cf/meta/llama-3.3-70b-instruct-fp8-fast` once.
- **Backup services (17 November 2026):** if Workers AI is out of its daily allowance or failing, the Worker tries,
  in this order, **Groq**, **Cerebras**, **Google Gemini** and **OpenRouter** (free models only). Each one is used
  only if its key has been added as a Worker **secret** (see below); without keys, only Workers AI is used, exactly
  as before. A service that says it is out of allowance (429/402) is skipped for a while (its `retry-after`, else
  10 minutes; Workers AI until 00:00 UTC), so later questions go straight to the next one. Keys are encrypted
  Cloudflare secrets: they are never in this file, in the website, or in the reply.
- Adds its own teaching rules (teach, do not do graded work, refuse harmful requests), answers in at most
  about 900 tokens, with the model's "thinking" switched off.
- Returns `{ reply, via }` (`via` names the service that answered). Stores nothing: no logs of questions are kept by this code.
- `GET /health` returns `{ ok, model, services }`: which services are switched on and which are resting. Never a key.

## Adding the backup services (free; each needs its own free account and key)
| Secret name | Where to get the key | Free allowance (as published, changes often) |
|---|---|---|
| `GROQ_API_KEY` | console.groq.com → API Keys | about 1,000 requests a day for the default model |
| `CEREBRAS_API_KEY` | cloud.cerebras.ai → API Keys | about 1 million tokens a day |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key | depends on the model; free-tier prompts may be used by Google to improve its products |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys | about 50 requests a day on `:free` models (more after a one-time $10 top-up) |

To add one: Cloudflare dashboard → Workers & Pages → **learn-ai-professor** → Settings → **Variables and Secrets**
→ Add → Type **Secret**, name exactly as above, paste the key → Deploy. Nothing on the website changes.
Optional plain variables to change a model without editing code: `GROQ_MODEL`, `CEREBRAS_MODEL`, `GEMINI_MODEL`,
`OPENROUTER_MODELS` (comma-separated, up to 3). Defaults: `llama-3.3-70b-versatile`, `gpt-oss-120b`,
`gemini-2.5-flash`, and three `:free` OpenRouter models. If a service retires a model, its requests fail and the
Worker simply moves on to the next service; set the variable to a current model name.

## Cost
Workers AI gives **10,000 Neurons a day free**. A short answer measured on 15 November 2026 used about
1.5 Neurons; long answers use more, so expect thousands of questions a day for free. On the **Workers Free**
plan, when the daily allowance is used up the model refuses until 00:00 UTC; the page then shows "The AI is busy"
and the built-in tutor answers. On **Workers Paid**, usage above the allowance is billed at $0.011 per 1,000
Neurons. Check usage at Cloudflare dashboard → AI → Workers AI.

## Changing it
- Model: change `MODEL` (pick a model the Workers Free plan allows, from the Workers AI model catalog).
- Allowed site: change `ALLOWED` (for example add a custom domain).
- Turn the AI off: set `aiEndpoint: ''` in `uni/config.js` (the built-in tutor stays), or delete the Worker in
  the Cloudflare dashboard → Workers & Pages.
- Redeploy: Cloudflare dashboard → Workers & Pages → learn-ai-professor → Edit code, paste `worker.js`, Deploy.
  The bindings `AI` (Workers AI) and `PER_IP` (rate limit 8 per 60 s) must stay. Redeploying keeps the secrets.

## What was tested
- 17 November 2026 (backup services): `tests/ai-worker.test.mjs`, 22 checks with **simulated** services: order,
  services without keys skipped, out-of-allowance service skipped then retried, `retry-after`, second Workers AI model,
  OpenRouter free models only, model variables, all used up → 429 "daily limit reached" (page falls back to the
  built-in tutor), `/health` never shows a key. Redeployed the same day with the same bindings; the second Workers AI
  model answered through the Cloudflare API. **Not tested:** the real Groq, Cerebras, Gemini and OpenRouter services
  (no keys exist yet).
- The Worker's logic, locally with a fake model: CORS, wrong origin (403), empty question (400), body too large
  (413), rate limit (429), reply format.
- The real model through the Cloudflare API with the same settings: it answered.
- The AI Professor page against a mocked endpoint (`tests/e2e-core.js`): reply shown, formatted, labelled; a
  busy or failing service falls back to the built-in tutor; HTML in a reply is not executed.
- **Not tested from here:** a real browser on the live site calling the deployed Worker (this workspace cannot
  reach workers.dev). Open the AI Professor on the live site once to confirm.
