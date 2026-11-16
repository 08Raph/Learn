// Learn: AI Professor endpoint (Cloudflare Worker using Workers AI).
// Deployed as "learn-ai-professor" on the site owner's Cloudflare account.
// No API key is needed or stored: the model runs through the Worker's AI binding.
// Bindings: AI (Workers AI), PER_IP (rate limit, 8 requests per 60 s per address and Cloudflare location).
// Cost: a short answer uses about 2 to 20 Neurons. Workers AI includes 10,000 Neurons per day free. On the Workers Free plan, requests fail once that is
// used up (the page then falls back to the built-in tutor). On Workers Paid, usage above it is billed.
const MODEL = '@cf/zai-org/glm-4.7-flash';
const ALLOWED = ['https://08raph.github.io'];
const MAX_CHARS = 6000, MAX_MESSAGES = 13, MAX_BODY = 90000;
const RULES = 'You are the AI Professor of "Learn", a free self-study website for learning programming and software engineering. ' +
  'Reply in the language the student writes in. Be accurate; if you are not sure, say so. Use Markdown with short code blocks. ' +
  'Keep answers under about 350 words unless the student asks for more. Teach rather than hand over answers: never complete a graded ' +
  'assignment or examination for the student. Refuse anything harmful or unrelated to learning, politely. Do not ask for personal information.';

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = ALLOWED.includes(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, model: MODEL }, 200, cors);
    if (request.method !== 'POST' || url.pathname !== '/') return json({ error: 'not found' }, 404, cors);
    if (!allowed) return json({ error: 'origin not allowed' }, 403, cors);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (env.PER_IP) { const { success } = await env.PER_IP.limit({ key: ip }); if (!success) return json({ error: 'Too many questions in a minute. Wait a moment and try again.' }, 429, cors); }
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'too large' }, 413, cors);
    let body; try { body = JSON.parse(raw); } catch (e) { return json({ error: 'bad json' }, 400, cors); }
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-MAX_MESSAGES)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'no question' }, 400, cors);
    const system = RULES + ' ' + String(body.system || '').slice(0, 1500);
    try {
      const r = await env.AI.run(MODEL, { messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: 900, temperature: 0.4, chat_template_kwargs: { enable_thinking: false } }); // thinking off: faster, and it cannot use up the answer's token budget
      const reply = String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '').trim();
      if (!reply) return json({ error: 'empty reply' }, 502, cors);
      return json({ reply: reply.slice(0, 20000) }, 200, cors);
    } catch (e) {
      const m = String(e && e.message || e);
      if (/4006|daily free allocation|neurons/i.test(m)) return json({ error: 'daily limit reached' }, 429, cors);
      return json({ error: 'model unavailable' }, 503, cors);
    }
  },
};
