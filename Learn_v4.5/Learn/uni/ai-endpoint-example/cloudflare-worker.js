// Cloudflare Worker. Set secrets with:  wrangler secret put AI_API_KEY
// Variables: AI_MODEL (model name from your provider), ALLOWED_ORIGIN (e.g. https://08raph.github.io)
// Add a rate-limiting rule for this route in the Cloudflare dashboard.
// The request format below is for the Anthropic Messages API. For another provider, change the fetch call.
const MAX_CHARS = 6000, MAX_MESSAGES = 12;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '';
    const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: cors });
    if (!origin || request.headers.get('origin') !== origin) return new Response(null, { status: 403, headers: cors });
    if (!env.AI_API_KEY || !env.AI_MODEL) return new Response(null, { status: 503, headers: cors });
    try {
      const body = await request.json();
      const system = String(body.system || '').slice(0, MAX_CHARS);
      const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-MAX_MESSAGES)
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
      if (!messages.length) return new Response(null, { status: 400, headers: cors });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.AI_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.AI_MODEL, max_tokens: 1000, system, messages }),
      });
      if (!r.ok) return new Response(null, { status: 502, headers: cors });
      const j = await r.json();
      const reply = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      return new Response(JSON.stringify({ reply }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } });
    } catch (e) {
      return new Response(null, { status: 502, headers: cors }); // the site falls back to the built-in tutor
    }
  },
};
