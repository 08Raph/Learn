// Netlify Function: netlify/functions/professor.js
// Environment variables (Netlify > Site settings > Environment variables):
//   AI_API_KEY      your provider key (kept on the server, never sent to the browser)
//   AI_MODEL        the model name from your provider's documentation
//   ALLOWED_ORIGIN  e.g. https://08raph.github.io
// The request format below is for the Anthropic Messages API. For another provider, change callProvider().
const MAX_CHARS = 6000, MAX_MESSAGES = 12;
const hits = new Map(); // simple per-instance rate limit: 20 requests per 10 minutes per address

function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > 20;
}

async function callProvider(system, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.AI_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.AI_MODEL, max_tokens: 1000, system, messages }),
  });
  if (!r.ok) throw new Error('provider ' + r.status);
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

exports.handler = async (event) => {
  const origin = process.env.ALLOWED_ORIGIN || '';
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors };
  if (!origin || event.headers.origin !== origin) return { statusCode: 403, headers: cors };
  if (!process.env.AI_API_KEY || !process.env.AI_MODEL) return { statusCode: 503, headers: cors };
  const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
  if (limited(ip)) return { statusCode: 429, headers: cors };
  try {
    const body = JSON.parse(event.body || '{}');
    const system = String(body.system || '').slice(0, MAX_CHARS);
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-MAX_MESSAGES)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length) return { statusCode: 400, headers: cors };
    const reply = await callProvider(system, messages);
    return { statusCode: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ reply }) };
  } catch (e) {
    return { statusCode: 502, headers: cors }; // the site falls back to the built-in tutor
  }
};
