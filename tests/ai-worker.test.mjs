// AI Worker fallback chain, run in Node with SIMULATED services (no real AI service is contacted).
// Proves the order, skipping, "resting" and error mapping in uni/ai-worker/worker.js. It does not prove the real services' APIs.
import W, { answer, _resting, translateItems, trCheck } from '../uni/ai-worker/worker.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const reply = (t) => new Response(JSON.stringify({ choices: [{ message: { content: t } }] }), { status: 200 });
const status = (s, h = {}) => new Response('{}', { status: s, headers: h });
const ai = (behaviour) => ({ calls: [], async run(model, o) { this.calls.push(model); return behaviour(model, o); } });
const msgs = [{ role: 'user', content: 'hi' }];
const quotaErr = () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); };
const T0 = Date.UTC(2026, 10, 17, 12);
const reset = () => _resting.clear();

// 1. Workers AI answers: nothing else is called
reset(); { let n = 0; const env = { AI: ai(() => ({ response: 'cf' })), GROQ_API_KEY: 'k' };
  const r = await answer(env, msgs, async () => { n++; return reply('groq'); }, T0);
  ok(r.via === 'workers-ai' && r.reply === 'cf' && n === 0, 'workers-ai first'); }

// 2. Workers AI daily quota -> Groq answers; Workers AI rests until UTC midnight
reset(); { const urls = []; const env = { AI: ai(quotaErr), GROQ_API_KEY: 'g', GEMINI_API_KEY: 'm' };
  const r = await answer(env, msgs, async (u, o) => { urls.push(u); ok(o.headers.authorization === 'Bearer g', 'groq key sent'); return reply('from groq'); }, T0);
  ok(r.via === 'groq' && r.reply === 'from groq', 'falls to groq'); ok(urls.length === 1 && /groq/.test(urls[0]), 'only groq called');
  ok(env.AI.calls.length === 1, 'no second CF model after quota');
  const again = await answer(env, msgs, async () => reply('g2'), T0 + 3600e3);
  ok(again.via === 'groq' && env.AI.calls.length === 1, 'workers-ai skipped while resting');
  await answer(env, msgs, async () => reply('g3'), T0 + 13 * 3600e3);
  ok(env.AI.calls.length === 2, 'workers-ai retried after midnight'); }

// 3. Unset keys are skipped; order groq -> cerebras -> gemini -> openrouter
reset(); { const urls = []; const env = { AI: ai(quotaErr), CEREBRAS_API_KEY: 'c', GEMINI_API_KEY: 'm', OPENROUTER_API_KEY: 'o' };
  const r = await answer(env, msgs, async (u) => { urls.push(u); if (/cerebras/.test(u)) return status(429, { 'retry-after': '30' }); if (/googleapis/.test(u)) return status(500); return reply('or'); }, T0);
  ok(r.via === 'openrouter', 'reaches openrouter'); ok(urls.length === 3 && !urls.some((u) => /groq/.test(u)), 'groq without key not called, order ok');
  ok(_resting.get('cerebras') === T0 + 30000, 'retry-after respected'); }

// 4. OpenRouter gets free model list + referer
reset(); { let body, hdr; const env = { OPENROUTER_API_KEY: 'o' };
  await answer(env, msgs, async (u, o) => { body = JSON.parse(o.body); hdr = o.headers; return reply('x'); }, T0);
  ok(body.models.length === 3 && body.models.every((m) => m.endsWith(':free')) && body.model === body.models[0], 'openrouter free models only');
  ok(/08raph\.github\.io/.test(hdr['HTTP-Referer']), 'referer'); }

// 5. Model override variable
reset(); { let body; const env = { GROQ_API_KEY: 'g', GROQ_MODEL: 'some-new-model' };
  await answer(env, msgs, async (u, o) => { body = JSON.parse(o.body); return reply('x'); }, T0); ok(body.model === 'some-new-model', 'model override'); }

// 6. First CF model errors (not quota) -> second CF model answers
reset(); { const env = { AI: ai((m) => { if (m.includes('glm')) throw new Error('5xx boom'); return { response: 'llama' }; }) };
  const r = await answer(env, msgs, fetch, T0); ok(r.via === 'workers-ai' && r.reply === 'llama' && env.AI.calls.length === 2, 'second CF model'); }

// 7. All out of quota -> kind quota; mixed -> error; everything resting -> still tries
reset(); { const env = { AI: ai(quotaErr), GROQ_API_KEY: 'g' };
  let e1; try { await answer(env, msgs, async () => status(429), T0); } catch (e) { e1 = e; } ok(e1 && e1.kind === 'quota', 'all quota');
  let calls = 0; const r = await answer(env, msgs, async () => { calls++; return reply('back'); }, T0 + 60e3);
  ok(r.via === 'groq' && calls === 1, 'when all resting, tries anyway'); }
reset(); { const env = { AI: ai(quotaErr), GROQ_API_KEY: 'g' };
  let e2; try { await answer(env, msgs, async () => status(401), T0); } catch (e) { e2 = e; } ok(e2 && e2.kind === 'error', 'bad key = error not quota'); }
reset(); { const env = { GROQ_API_KEY: 'g' };
  let e3; try { await answer(env, msgs, async () => { throw new TypeError('network down'); }, T0); } catch (e) { e3 = e; } ok(e3 && e3.kind === 'error', 'network error'); }

// 8. HTTP layer: origin check, health never leaks keys, 429 mapping, via field
reset(); { const env = { AI: ai(quotaErr), GROQ_API_KEY: 'SECRET-123', PER_IP: { limit: async () => ({ success: true }) } };
  const h = await W.fetch(new Request('https://w/health', { headers: { origin: 'https://08raph.github.io' } }), env);
  const ht = await h.text(); ok(!ht.includes('SECRET') && /"groq","on":true/.test(ht) && /"gemini","on":false/.test(ht), 'health lists services, no key');
  const bad = await W.fetch(new Request('https://w/', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), env); ok(bad.status === 403, 'other origin refused');
  const realFetch = globalThis.fetch; globalThis.fetch = async () => status(429);
  const q = await W.fetch(new Request('https://w/', { method: 'POST', headers: { origin: 'https://08raph.github.io' }, body: JSON.stringify({ messages: msgs }) }), env);
  ok(q.status === 429 && (await q.json()).error === 'daily limit reached', 'all used up -> 429 daily limit');
  reset(); globalThis.fetch = async () => reply('hello');
  const g = await W.fetch(new Request('https://w/', { method: 'POST', headers: { origin: 'https://08raph.github.io' }, body: JSON.stringify({ messages: msgs }) }), env);
  const gj = await g.json(); ok(g.status === 200 && gj.reply === 'hello' && gj.via === 'groq', 'http reply via groq');
  globalThis.fetch = realFetch; }


// 9. 5.8 automatic translation
const mkCache = () => { const m = new Map(); return { m, async match(r) { const v = m.get(r.url); return v === undefined ? undefined : new Response(v); }, async put(r, res) { m.set(r.url, await res.text()); } }; };
reset(); { let calls = 0, lastSys = '', lastUser = '';
  const env = { AI: { async run(model, o) { calls++; lastSys = o.messages[0].content; lastUser = o.messages[1].content; const a = JSON.parse(o.messages[1].content); return { response: JSON.stringify(a.map((s) => 'ES:' + s)) }; } } };
  const cache = mkCache();
  const r = await translateItems(env, 'es', ['Hello <b>world</b>', 'Use <x i="0"/> to print.'], { cache, now: T0 });
  ok(r.items[0] === 'ES:Hello <b>world</b>' && r.items[1] === 'ES:Use <x i="0"/> to print.', 'translate: items translated in order');
  ok(/into Spanish/.test(lastSys) && /placeholders/i.test(lastSys) && JSON.parse(lastUser).length === 2, 'translate: one model call with the rules and a JSON array');
  ok(cache.m.size === 2, 'translate: each translation is cached');
  await translateItems(env, 'es', ['Hello <b>world</b>'], { cache, now: T0 }); ok(calls === 1, 'translate: a cached item is not sent to the model again');
  const big = Array.from({ length: 30 }, (_, i) => 'Sentence number ' + i + ' ' + 'x'.repeat(200)); calls = 0; await translateItems(env, 'fr', big, { cache: mkCache(), now: T0 }); ok(calls >= 2, 'translate: long pages are split into several model calls'); }
ok(trCheck('Use <x i="0"/> now', 'Usa <x i="0"/> ya') && !trCheck('Use <x i="0"/> now', 'Usa ya') && !trCheck('Use <x i="0"/>', 'Usa <x i="0"/><x i="1"/>'), 'translate: placeholders must be kept exactly');
ok(!trCheck('Hi', '<img src=x onerror=alert(1)>Hola') && !trCheck('Hi', 'Hola <script>x</script>') && !trCheck('Hi', '<a href="javascript:alert(1)">Hola</a>') && !trCheck('Hi', ''), 'translate: dangerous or empty output is refused');
reset(); { const env = { AI: { async run() { return { response: 'Sure! Here you go: ["Hola", "<b>bad"]' }; } } };
  const r = await translateItems(env, 'es', ['Hello', 'Bye'], { cache: mkCache(), now: T0 }); ok(r.items[0] === 'Hola' && r.items[1] === null, 'translate: a bad item is dropped (shown in English), good ones kept'); }
reset(); { const env = { AI: { async run() { return { response: 'not json' }; } } }; const r = await translateItems(env, 'es', ['Hello'], { cache: mkCache(), now: T0 }); ok(r.items[0] === null && !r.quota, 'translate: unreadable model output leaves English'); }
reset(); { const env = { AI: { async run() { quotaErr(); } } }; const r = await translateItems(env, 'es', ['Hello'], { cache: mkCache(), now: T0 }); ok(r.quota && r.items[0] === null, 'translate: daily allowance used up is reported'); }
reset(); { const env = { AI: { async run(m, o) { return { response: JSON.stringify(JSON.parse(o.messages[1].content).map(() => 'T')) }; } }, TR_IP: { limit: async () => ({ success: true }) } };
  const post = (origin, body) => W.fetch(new Request('https://w/translate', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }), env);
  ok((await post('https://evil.example', { lang: 'es', items: ['a'] })).status === 403, 'translate: other websites are refused');
  ok((await post('https://08raph.github.io', { lang: 'de', items: ['a'] })).status === 400, 'translate: only the five languages');
  const ok1 = await post('https://08raph.github.io', { lang: 'hi', items: ['Hello'] }); ok(ok1.status === 200 && (await ok1.json()).items[0] === 'T', 'translate: HTTP request works');
  env.TR_IP = { limit: async () => ({ success: false }) }; ok((await post('https://08raph.github.io', { lang: 'es', items: ['a'] })).status === 429, 'translate: its own rate limit'); }
console.log(`AI worker fallback and translation (SIMULATED services and cache): ${fail} failed of ${pass + fail}`);
process.exit(fail ? 1 : 0);
