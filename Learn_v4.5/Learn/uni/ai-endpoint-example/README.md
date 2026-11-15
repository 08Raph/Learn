# Connecting a real AI model to the AI Professor (optional)

The University works without any AI service. Out of the box the AI Professor is a **built-in tutor**:
fixed rules plus the course text. It runs in the browser, works offline and costs nothing. The page says
plainly that no AI model is connected.

If you later want a real model, you must run a small **server-side endpoint** that holds the API key.

## Never do this

- Never put an API key in `index.html`, in any `.js` file, in `uni/config.js`, in the GitHub repository or in
  browser storage. Anything shipped to the browser can be read by every visitor, and a leaked key will be
  used at your expense.
- GitHub Pages is static hosting. It cannot keep a secret, so the endpoint has to live somewhere else
  (a Netlify Function, a Cloudflare Worker, or any server you control).

## How it works

```
browser  --POST {mode, system, messages}-->  YOUR endpoint (holds the key)  -->  AI provider
browser  <--{ "reply": "..." }------------   YOUR endpoint
```

1. Deploy one of the examples in this folder. Store the key as an environment variable / secret there.
2. Set `ALLOWED_ORIGIN` to your site's origin (for example `https://08raph.github.io`) so other sites
   cannot use your endpoint.
3. Edit `uni/config.js`:

   ```js
   window.UNI_CONFIG = { aiEndpoint: 'https://your-endpoint.example/api/professor', aiLabel: 'Claude' };
   ```

4. Reload. The professor page now shows "Connected to ...". If the endpoint fails or times out
   (45 seconds), the built-in tutor answers instead, so the site never breaks.

## Request and response

Request body (JSON):

```json
{ "mode": "tutor", "system": "teaching instructions written by the site", "messages": [{ "role": "user", "content": "..." }] }
```

Response body (JSON): `{ "reply": "markdown text" }`

The `system` text tells the model to teach (explain, hint, ask questions) and not to hand over answers to
graded work. Your endpoint should pass it through unchanged.

## Costs and safety

- AI providers charge per use. Nothing in this site requires you to pay for one.
- Add a rate limit and a maximum message length (both examples do) so that a visitor cannot run up a bill.
- Student messages pass through your endpoint. Do not log them unless you have told students you do.
- These examples were written carefully but **have not been deployed or run against a live provider** as part
  of this build. Test them with your own key before relying on them, and check the provider's current
  documentation for model names and request format.
