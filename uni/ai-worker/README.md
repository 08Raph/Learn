# AI Professor service (Cloudflare Worker)

`worker.js` is the code of the Worker **learn-ai-professor**, deployed on 15 November 2026 to the site owner's
Cloudflare account at:

    https://learn-ai-professor.raphaelrst26.workers.dev/

`uni/config.js` points the AI Professor at that address.

## What it does
- Accepts `POST /` with `{ mode, system, messages }` from the AI Professor page, only from the origin
  `https://08raph.github.io` (other sites get 403; this is a browser rule, not a password).
- Limits each address to about 8 questions a minute (Workers rate-limit binding `PER_IP`, namespace 4601).
- Runs the model `@cf/zai-org/glm-4.7-flash` on **Cloudflare Workers AI** through the Worker's `AI` binding.
  **No API key exists anywhere**, so there is nothing to leak.
- Adds its own teaching rules (teach, do not do graded work, refuse harmful requests), answers in at most
  about 900 tokens, with the model's "thinking" switched off.
- Returns `{ reply }`. Stores nothing: no logs of questions are kept by this code.
- `GET /health` returns `{ ok, model }`.

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
  The bindings `AI` (Workers AI) and `PER_IP` (rate limit 8 per 60 s) must stay.

## What was tested
- The Worker's logic, locally with a fake model: CORS, wrong origin (403), empty question (400), body too large
  (413), rate limit (429), reply format.
- The real model through the Cloudflare API with the same settings: it answered.
- The AI Professor page against a mocked endpoint (`tests/e2e-core.js`): reply shown, formatted, labelled; a
  busy or failing service falls back to the built-in tutor; HTML in a reply is not executed.
- **Not tested from here:** a real browser on the live site calling the deployed Worker (this workspace cannot
  reach workers.dev). Open the AI Professor on the live site once to confirm.
