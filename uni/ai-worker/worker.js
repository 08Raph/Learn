// Learn: AI Professor endpoint (Cloudflare Worker).
// Deployed as "learn-ai-professor" on the site owner's Cloudflare account.
//
// It tries several free AI services in order and uses the first one that answers:
//   1. Cloudflare Workers AI (always on; no key, runs through the Worker's AI binding)
//   2. Groq          (only if the secret GROQ_API_KEY is set)
//   3. Cerebras      (only if the secret CEREBRAS_API_KEY is set)
//   4. Google Gemini (only if the secret GEMINI_API_KEY is set)
//   5. OpenRouter    (only if the secret OPENROUTER_API_KEY is set; free models only)
// A service that is out of its free allowance (or failing) is skipped for a while, so the next one answers at once.
// Keys live only as encrypted Worker secrets. They are never in the website's code or in this file.
// Model names can be changed without editing code by adding a plain variable, e.g. GROQ_MODEL = "llama-3.3-70b-versatile".
//
// Bindings: AI (Workers AI), PER_IP (rate limit, 8 requests per 60 s per address and Cloudflare location).
// Cost: everything here uses free allowances. Workers AI includes 10,000 Neurons per day free (a short answer is about 2 to 20 Neurons).
// The other services have their own free limits; when all are used up, the page falls back to the built-in tutor.
const MODEL = '@cf/zai-org/glm-4.7-flash';
const MODEL_2 = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'; // second Workers AI model, used only if the first one errors (not when the daily allowance is used up)
const ALLOWED = ['https://08raph.github.io'];
const MAX_CHARS = 6000, MAX_MESSAGES = 13, MAX_BODY = 90000, MAX_TOKENS = 900, TIMEOUT_MS = 25000;
const RULES = 'You are the AI Professor of "Learn", a free self-study website for learning programming and software engineering. ' +
  'Reply in the language the student writes in. Be accurate; if you are not sure, say so. Use Markdown with short code blocks. ' +
  'Keep answers under about 350 words unless the student asks for more. Teach rather than hand over answers: never complete a graded ' +
  'assignment or examination for the student. Refuse anything harmful or unrelated to learning, politely. Do not ask for personal information.';

// OpenAI-compatible services. Order = order they are tried after Workers AI.
const SERVICES = [
  { id: 'groq', name: 'Groq', key: 'GROQ_API_KEY', modelVar: 'GROQ_MODEL', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { id: 'cerebras', name: 'Cerebras', key: 'CEREBRAS_API_KEY', modelVar: 'CEREBRAS_MODEL', url: 'https://api.cerebras.ai/v1/chat/completions', model: 'gpt-oss-120b' },
  { id: 'gemini', name: 'Google Gemini', key: 'GEMINI_API_KEY', modelVar: 'GEMINI_MODEL', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash' },
  { id: 'openrouter', name: 'OpenRouter', key: 'OPENROUTER_API_KEY', modelVar: 'OPENROUTER_MODELS', url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-120b:free,qwen/qwen3-coder:free', multi: true },
];

// "Resting" services: id -> time (ms) until which it is skipped. Kept in memory of this Worker instance only.
const resting = new Map();
const isResting = (id, now) => (resting.get(id) || 0) > now;
const rest = (id, ms, now) => resting.set(id, now + ms);
const untilUtcMidnight = (now) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now + 60000; };

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const pickText = (r) => String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '').trim();

class Fail extends Error { constructor(kind, msg) { super(msg); this.kind = kind; } } // kind: 'quota' | 'error'

async function runWorkersAI(env, msgs, now) {
  const opts = { messages: msgs, max_completion_tokens: MAX_TOKENS, temperature: 0.4 };
  try {
    const r = await env.AI.run(MODEL, { ...opts, chat_template_kwargs: { enable_thinking: false } }); // thinking off: faster, and it cannot use up the answer's token budget
    const t = pickText(r); if (t) return t;
  } catch (e) {
    const m = String(e && e.message || e);
    if (/4006|daily free allocation|neurons/i.test(m)) { rest('workers-ai', untilUtcMidnight(now), now); throw new Fail('quota', m); }
  }
  try { // first model failed for another reason: try the second Workers AI model once
    const t = pickText(await env.AI.run(MODEL_2, { messages: msgs, max_tokens: MAX_TOKENS, temperature: 0.4 }));
    if (t) return t;
    throw new Fail('error', 'empty reply');
  } catch (e) {
    const m = String(e && e.message || e);
    if (/4006|daily free allocation|neurons/i.test(m)) { rest('workers-ai', untilUtcMidnight(now), now); throw new Fail('quota', m); }
    rest('workers-ai', 60000, now); throw e instanceof Fail ? e : new Fail('error', m);
  }
}

async function runService(s, env, msgs, now, fetchImpl) {
  const models = String(env[s.modelVar] || s.model).split(',').map((x) => x.trim()).filter(Boolean);
  const body = { messages: msgs, temperature: 0.4, max_tokens: MAX_TOKENS };
  if (s.multi) { body.model = models[0]; if (models.length > 1) body.models = models.slice(0, 3); } else body.model = models[0];
  const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + env[s.key] };
  if (s.id === 'openrouter') { headers['HTTP-Referer'] = ALLOWED[0] + '/Learn/'; headers['X-Title'] = 'Learn'; }
  let res;
  try { res = await fetchImpl(s.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) }); }
  catch (e) { rest(s.id, 60000, now); throw new Fail('error', 'network: ' + String(e && e.message || e)); }
  if (res.status === 429 || res.status === 402) {
    const ra = Number(res.headers.get('retry-after'));
    rest(s.id, ra > 0 ? Math.min(ra * 1000, 6 * 3600000) : 10 * 60000, now);
    throw new Fail('quota', s.id + ' ' + res.status);
  }
  if (res.status === 401 || res.status === 403) { rest(s.id, 3600000, now); throw new Fail('error', s.id + ' key refused (' + res.status + ')'); }
  if (!res.ok) { rest(s.id, 60000, now); throw new Fail('error', s.id + ' ' + res.status); }
  let data; try { data = await res.json(); } catch (e) { throw new Fail('error', s.id + ' bad json'); }
  const t = pickText(data);
  if (!t) throw new Fail('error', s.id + ' empty reply');
  return t;
}

// Exposed for tests. Returns { reply, via } or throws Fail with kind 'quota' if every service was out of allowance.
export async function answer(env, msgs, fetchImpl = fetch, now = Date.now()) {
  const chain = [{ id: 'workers-ai', run: () => runWorkersAI(env, msgs, now), on: !!env.AI }]
    .concat(SERVICES.map((s) => ({ id: s.id, run: () => runService(s, env, msgs, now, fetchImpl), on: !!env[s.key] })));
  let quota = 0, tried = 0;
  const ready = chain.filter((c) => c.on && !isResting(c.id, now));
  const list = ready.length ? ready : chain.filter((c) => c.on); // if everything is resting, try them all anyway
  for (const c of list) {
    tried++;
    try { return { reply: await c.run(), via: c.id }; }
    catch (e) { if (e && e.kind === 'quota') quota++; }
  }
  throw new Fail(tried && quota === tried ? 'quota' : 'error', 'all services failed');
}
export const _resting = resting; // tests only

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = ALLOWED.includes(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method === 'GET' && url.pathname === '/health') {
      const now = Date.now();
      const services = [{ id: 'workers-ai', on: !!env.AI }].concat(SERVICES.map((s) => ({ id: s.id, on: !!env[s.key] })))
        .map((s) => ({ ...s, resting: isResting(s.id, now) }));
      return json({ ok: true, model: MODEL, services }, 200, cors); // shows which services are switched on, never any key
    }
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
      const { reply, via } = await answer(env, [{ role: 'system', content: system }, ...messages]);
      return json({ reply: reply.slice(0, 20000), via }, 200, cors);
    } catch (e) {
      if (e && e.kind === 'quota') return json({ error: 'daily limit reached' }, 429, cors);
      return json({ error: 'model unavailable' }, 503, cors);
    }
  },
};
