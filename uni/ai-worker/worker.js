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
// Bindings: AI (Workers AI), PER_IP (rate limit, 8 questions per 60 s per address and Cloudflare location), TR_IP (rate limit, 30 translation requests per 60 s).
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

async function runWorkersAI(env, msgs, now, maxTok = MAX_TOKENS, temp = 0.4) {
  const opts = { messages: msgs, max_completion_tokens: maxTok, temperature: temp };
  try {
    const r = await env.AI.run(MODEL, { ...opts, chat_template_kwargs: { enable_thinking: false } }); // thinking off: faster, and it cannot use up the answer's token budget
    const t = pickText(r); if (t) return t;
  } catch (e) {
    const m = String(e && e.message || e);
    if (/4006|daily free allocation|neurons/i.test(m)) { rest('workers-ai', untilUtcMidnight(now), now); throw new Fail('quota', m); }
  }
  try { // first model failed for another reason: try the second Workers AI model once
    const t = pickText(await env.AI.run(MODEL_2, { messages: msgs, max_tokens: maxTok, temperature: temp }));
    if (t) return t;
    throw new Fail('error', 'empty reply');
  } catch (e) {
    const m = String(e && e.message || e);
    if (/4006|daily free allocation|neurons/i.test(m)) { rest('workers-ai', untilUtcMidnight(now), now); throw new Fail('quota', m); }
    rest('workers-ai', 60000, now); throw e instanceof Fail ? e : new Fail('error', m);
  }
}

async function runService(s, env, msgs, now, fetchImpl, maxTok = MAX_TOKENS, temp = 0.4) {
  const models = String(env[s.modelVar] || s.model).split(',').map((x) => x.trim()).filter(Boolean);
  const body = { messages: msgs, temperature: temp, max_tokens: maxTok };
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
export async function answer(env, msgs, fetchImpl = fetch, now = Date.now(), maxTok = MAX_TOKENS, temp = 0.4) {
  const chain = [{ id: 'workers-ai', run: () => runWorkersAI(env, msgs, now, maxTok, temp), on: !!env.AI }]
    .concat(SERVICES.map((s) => ({ id: s.id, run: () => runService(s, env, msgs, now, fetchImpl, maxTok, temp), on: !!env[s.key] })));
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

/* Automatic translation (5.8). POST /translate { lang, items: [html strings] } -> { items: [translation or null] }.
   Items are short pieces of the site's own text; code inside them has already been replaced by placeholders like <x i="0"/>
   in the browser, so code never reaches the model. Each translation is cached (Cloudflare cache, 30 days) by a hash of
   language + text, so a piece is translated once per language per Cloudflare location, not once per visitor. */
export const TR_LANGS = { es: 'Spanish (Latin American, informal "tú")', fr: 'French (informal "tu")', zh: 'Simplified Chinese', hi: 'Hindi (Devanagari script)', ar: 'Modern Standard Arabic' };
const TR_MAX_ITEMS = 40, TR_MAX_CHARS = 12000, TR_BATCH_CHARS = 3500;
const trRules = (L) => 'You translate text from a free website that teaches programming to beginners, from English into ' + L + '. ' +
  'The input is a JSON array of strings. Reply with ONLY a JSON array of the same length, where each string is the translation of the string at the same position. ' +
  'Each string may contain simple HTML tags such as <b>, <em>, <a href="...">, <br> and placeholders like <x i="3"/>. Keep every tag and every <x .../> placeholder exactly as written (same attributes), placed where they belong in the translated sentence. ' +
  'Placeholders stand for code: never add, drop or change them. Do not translate programming keywords, function or variable names, file names, commands, or English words that are part of code. Keep numbers, emoji and punctuation symbols. ' +
  'Use clear, friendly language for students. Keep common technical terms that learners use in English (for example Python, JavaScript, API, HTML) in their usual form. Never add explanations, notes or quotation marks around the strings.';
const phSet = (s) => (String(s).match(/<x i="\d+"\s*\/>/g) || []).map((x) => x.replace(/\s+/g, '')).sort().join('|');
const tagCount = (s) => (String(s).match(/<\/?(b|strong|em|i|a|br|span|sub|sup|small|kbd|mark|u|s)\b/gi) || []).length;
export function trCheck(src, out) { // a translation is used only if it keeps the same placeholders and tags and adds nothing dangerous
  if (typeof out !== 'string' || !out.trim() || out.length > src.length * 4 + 200) return false;
  if (/<\s*(script|style|iframe|img|svg|object|embed|form|input|button|link|meta)\b|\son[a-z]+\s*=|javascript:/i.test(out)) return false;
  return phSet(src) === phSet(out) && tagCount(src) === tagCount(out);
}
function parseArray(text, n) { const a = text.indexOf('['), b = text.lastIndexOf(']'); if (a < 0 || b < a) return null; try { const v = JSON.parse(text.slice(a, b + 1)); return Array.isArray(v) && v.length === n ? v : null; } catch (e) { return null; } }
async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export async function translateItems(env, lang, items, { fetchImpl = fetch, cache = (typeof caches !== 'undefined' ? caches.default : null), now = Date.now() } = {}) {
  const L = TR_LANGS[lang]; const out = new Array(items.length).fill(null); const keys = await Promise.all(items.map((s) => sha(lang + '\n' + s)));
  const reqOf = (k) => new Request('https://learn-translation-cache.invalid/' + lang + '/' + k);
  if (cache) await Promise.all(items.map(async (s, i) => { try { const r = await cache.match(reqOf(keys[i])); if (r) out[i] = await r.text(); } catch (e) {} }));
  const miss = items.map((s, i) => i).filter((i) => out[i] === null); let quota = false;
  const batches = []; let cur = [], len = 0; for (const i of miss) { const n = items[i].length; if (cur.length && (len + n > TR_BATCH_CHARS || cur.length >= 20)) { batches.push(cur); cur = []; len = 0; } cur.push(i); len += n; } if (cur.length) batches.push(cur);
  for (const bt of batches) {
    const src = bt.map((i) => items[i]); let arr = null;
    try { const r = await answer(env, [{ role: 'system', content: trRules(L) }, { role: 'user', content: JSON.stringify(src) }], fetchImpl, now, Math.min(4000, 400 + Math.ceil(src.join('').length * 1.2)), 0.2); arr = parseArray(r.reply, src.length); }
    catch (e) { if (e && e.kind === 'quota') { quota = true; break; } }
    if (!arr) continue;
    for (let j = 0; j < bt.length; j++) { const i = bt[j]; const v = String(arr[j] == null ? '' : arr[j]); if (!trCheck(items[i], v)) continue; out[i] = v;
      if (cache) { try { await cache.put(reqOf(keys[i]), new Response(v, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=2592000' } })); } catch (e) {} } }
  }
  return { items: out, quota };
}

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
    if (request.method === 'POST' && url.pathname === '/translate') {
      if (!allowed) return json({ error: 'origin not allowed' }, 403, cors);
      const ipT = request.headers.get('cf-connecting-ip') || 'unknown';
      if (env.TR_IP) { const { success } = await env.TR_IP.limit({ key: ipT }); if (!success) return json({ error: 'busy' }, 429, cors); }
      const rawT = await request.text(); if (rawT.length > TR_MAX_CHARS * 2 + 2000) return json({ error: 'too large' }, 413, cors);
      let bT; try { bT = JSON.parse(rawT); } catch (e) { return json({ error: 'bad json' }, 400, cors); }
      const items = Array.isArray(bT.items) ? bT.items.slice(0, TR_MAX_ITEMS).map((s) => String(s || '').slice(0, 3000)) : [];
      if (!TR_LANGS[bT.lang] || !items.length || items.join('').length > TR_MAX_CHARS) return json({ error: 'bad request' }, 400, cors);
      const r = await translateItems(env, bT.lang, items);
      if (r.quota && r.items.every((x) => x === null)) return json({ error: 'daily limit reached' }, 429, cors);
      return json({ items: r.items }, 200, cors);
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
