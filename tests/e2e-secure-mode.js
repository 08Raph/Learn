/* Secure-mode end-to-end test with a MOCKED Firebase backend.
   The real app runs in a browser with FB_API_KEY set. Requests to Firebase Authentication and to the Realtime
   Database are intercepted and answered by an in-test backend that enforces firebase/database.rules.json using
   tests/rules-sim.js. This proves the client's sign-in, identity claim, admin and redemption flows work against
   those rules. It does NOT prove anything about Google's servers.      node tests/e2e-secure-mode.js */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const { canRead, canWrite, get } = require('./rules-sim.js');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8771, BASE = 'http://localhost:' + PORT + '/index.html';
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase', 'database.rules.json'), 'utf8'));
const R = []; const ok = (n, c, x) => R.push((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + String(x).slice(0, 170) + ']' : ''));
let db = { duel: { ping: 1, admins: { authAdmin: true } } }; const accounts = { authAdmin: { email: 'owner@example.test', pw: 'correct horse battery staple' } }; let seq = 0; const denied = [];
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
const tokenFor = (uid) => ({ idToken: 'tok.' + uid, refreshToken: 'rt.' + uid, localId: uid, expiresIn: '3600', email: (accounts[uid] || {}).email });
async function backend(route) {
  const req = route.request(), u = new URL(req.url()); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.hostname === 'identitytoolkit.googleapis.com') { const b = JSON.parse(req.postData() || '{}');
    if (u.pathname.endsWith(':signUp')) { const uid = 'authAnon' + (++seq); accounts[uid] = {}; return json(route, 200, tokenFor(uid)); }
    if (u.pathname.endsWith(':signInWithPassword')) { const uid = Object.keys(accounts).find((k) => accounts[k].email === b.email && accounts[k].pw === b.password); return uid ? json(route, 200, tokenFor(uid)) : json(route, 400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } }); }
    if (u.pathname.endsWith(':update')) { const uid = String(b.idToken || '').replace('tok.', ''); if (!accounts[uid]) return json(route, 400, { error: { message: 'INVALID_ID_TOKEN' } }); if (Object.keys(accounts).some((k) => accounts[k].email === b.email)) return json(route, 400, { error: { message: 'EMAIL_EXISTS' } }); accounts[uid] = { email: b.email, pw: b.password }; return json(route, 200, tokenFor(uid)); }
    return json(route, 404, {}); }
  if (u.hostname === 'securetoken.googleapis.com') { const rt = new URLSearchParams(req.postData() || '').get('refresh_token') || ''; const uid = rt.replace('rt.', ''); return accounts[uid] ? json(route, 200, { id_token: 'tok.' + uid, refresh_token: rt, user_id: uid, expires_in: '3600' }) : json(route, 400, { error: { message: 'INVALID_REFRESH_TOKEN' } }); }
  // Realtime Database REST
  const p = decodeURIComponent(u.pathname).replace(/\.json$/, '').replace(/^\/+/, ''); const tok = u.searchParams.get('auth'); const uid = tok && tok.startsWith('tok.') && accounts[tok.slice(4)] ? tok.slice(4) : null; const auth = uid ? { uid } : null;
  if (req.method() === 'GET') { if (!canRead(rules, db, p, auth, Date.now())) { denied.push('GET ' + p + ' as ' + uid); return json(route, 401, { error: 'Permission denied' }); } return json(route, 200, get(db, p.split('/').filter(Boolean))); }
  let v = req.method() === 'DELETE' ? null : JSON.parse(req.postData() || 'null'); v = JSON.parse(JSON.stringify(v), (k, x) => (x && typeof x === 'object' && x['.sv'] === 'timestamp' ? Date.now() : x));
  const res = canWrite(rules, db, p, v, auth, Date.now()); if (!res.ok) { denied.push(req.method() + ' ' + p + ' as ' + uid + ': ' + res.why); return json(route, 401, { error: 'Permission denied' }); }
  db = res.after; return json(route, 200, v);
}
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch();
  const mk = async () => { const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160))); p.on('dialog', (d) => d.accept());
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/index.html*', async (route) => { const res = await route.fetch(); let t = await res.text(); if (!t.includes("const FB_API_KEY = '';")) throw new Error('FB_API_KEY marker missing'); t = t.replace("const FB_API_KEY = '';", "const FB_API_KEY = 'TEST-WEB-KEY';").replace(/const DUEL_DB = '[^']*';/, "const DUEL_DB = 'https://mock-project-default-rtdb.firebaseio.com';"); route.fulfill({ response: res, body: t }); });
    await ctx.route(/identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|mock-project-default-rtdb\.firebaseio\.com/, backend);
    return { ctx, p, errs }; };
  try {
    /* player A: anonymous sign-in and identity claim */
    const A = await mk(); await A.p.goto(BASE + '#/duel'); await A.p.waitForTimeout(4500);
    const aAuth = Object.keys(db.duel.uids || {})[0], aPid = aAuth && db.duel.uids[aAuth];
    ok('secure mode: the player is signed in anonymously and bound to exactly one player ID', !!aPid && db.duel.owners[aPid] === aAuth, JSON.stringify(db.duel.uids));
    ok('secure mode: every database request carried an ID token (no unauthenticated request was accepted)', denied.filter((d) => / as null/.test(d)).length === 0, denied.join(' ; '));
    await A.p.locator('[data-tab="more"]').click(); await A.p.waitForTimeout(600); let t = await A.p.locator('#fbAcc').innerText();
    ok('account card states the account is anonymous and what adding an email does', /anonymous account/.test(t) && /optional/i.test(t));
    await A.p.locator('[data-tab="leaders"]').click(); await A.p.waitForTimeout(1500);
    ok('signed-in player can load the leaderboard', !denied.some((d) => /GET duel\/lb/.test(d)), denied.join(' ; '));
    /* attacks from A's own session, using A's genuine token */
    const atk = await A.p.evaluate(async ({ aPid }) => { const st = JSON.parse(localStorage.getItem('learn-fb-auth')); const tok = 'tok.' + st.uid; const db = 'https://mock-project-default-rtdb.firebaseio.com/duel/'; const f = async (m, p, body, auth) => (await fetch(db + p + '.json' + (auth === false ? '' : '?auth=' + tok), { method: m, body: body === undefined ? undefined : JSON.stringify(body) })).status;
      return { noAuthRead: await f('GET', 'lb/1', undefined, false), noAuthWrite: await f('PUT', 'lb/1/' + aPid, { n: 'x', r: 1, w: 0, l: 0, d: 0 }, false), forgeOther: await f('PUT', 'lb/1/uvictim0001', { n: 'Victim', r: 0, w: 0, l: 9, d: 0 }), makeCode: await f('PUT', 'codes/FREEXP', { r: { xp: 999999 }, exp: 0, max: 0 }), selfAdmin: await f('PUT', 'admins/' + st.uid, true), wipe: await f('DELETE', ''), listCodes: await f('GET', 'codes'), own: await f('PUT', 'lb/1/' + aPid, { n: 'Me', r: 1000, w: 1, l: 0, d: 0 }), absurd: await f('PUT', 'lb/1/' + aPid, { n: 'Me', r: 99999999, w: 1, l: 0, d: 0 }), stealId: await f('PUT', 'owners/' + aPid, 'someoneElse') }; }, { aPid });
    ok('unauthenticated read and write are refused', atk.noAuthRead === 401 && atk.noAuthWrite === 401, JSON.stringify(atk));
    ok('a player cannot forge another player\'s leaderboard entry', atk.forgeOther === 401);
    ok('a player cannot create a reward code, list codes, wipe data or make themselves admin', atk.makeCode === 401 && atk.listCodes === 401 && atk.wipe === 401 && atk.selfAdmin === 401, JSON.stringify(atk));
    ok('a player can write their own valid leaderboard entry but not an absurd one', atk.own === 200 && atk.absurd === 401);
    ok('a claimed player ID cannot be reassigned', atk.stealId === 401);
    /* admin: no passphrase form; tools appear only for the administrator account */
    await A.p.goto(BASE + '#/shop'); await A.p.waitForTimeout(1500);
    ok('non-admin: no passphrase box and no admin form in secure mode', await A.p.locator('#admPass').count() === 0 && await A.p.locator('#acMake').count() === 0 && await A.p.locator('#admNote').count() === 1);
    const ADM = await mk(); await ADM.p.goto(BASE + '#/duel'); await ADM.p.waitForTimeout(3500); await ADM.p.locator('[data-tab="more"]').click(); await ADM.p.waitForTimeout(500);
    await ADM.p.locator('#fbEm').fill('owner@example.test'); await ADM.p.locator('#fbPw').fill('wrong password'); await ADM.p.locator('#fbIn').click(); await ADM.p.waitForTimeout(1200);
    ok('wrong admin password is rejected with a clear message', /Wrong email or password/.test(await ADM.p.locator('#fbMsg').innerText()));
    await ADM.p.locator('#fbPw').fill('correct horse battery staple'); await ADM.p.locator('#fbIn').click(); await ADM.p.waitForTimeout(2500);
    ok('administrator signs in with Firebase Authentication (email and password)', /Signed in as owner@example\.test/.test(await ADM.p.locator('#fbAcc').innerText()), await ADM.p.locator('#fbAcc').innerText());
    await ADM.p.goto(BASE + '#/shop'); await ADM.p.waitForTimeout(2500); await ADM.p.locator('#admBox').evaluate((el) => { el.closest('details').open = true; });
    ok('administrator account sees the code tools', await ADM.p.locator('#acMake').count() === 1);
    await ADM.p.locator('#acCode').fill('WELCOME50'); await ADM.p.locator('#acMake').click(); await ADM.p.waitForTimeout(1500);
    const made = Object.keys(db.duel.codes || {}).find((k) => db.duel.codes[k] && db.duel.codes[k].src === 'admin');
    ok('administrator can create a reward code (accepted by the rules)', !!made, (await ADM.p.locator('#acMsg').innerText()) + ' ' + JSON.stringify(Object.keys(db.duel.codes || {})));
    ok('security-sensitive actions are written to the audit log', Object.values(db.duel.audit || {}).some((x) => x.a === 'code-create') && Object.values(db.duel.audit || {}).some((x) => x.a === 'sign-in'), JSON.stringify(Object.values(db.duel.audit || {}).map((x) => x.a)));
    /* redemption by player A */
    await A.p.goto(BASE + '#/duel'); await A.p.goto(BASE + '#/shop'); await A.p.waitForTimeout(1200);
    await A.p.locator('#codeIn').fill(made || 'WELCOME50'); await A.p.locator('#codeGo').click(); await A.p.waitForTimeout(2000);
    ok('player redeems the code once; the redemption is recorded under their own ID', !!made && db.duel.codes[made].u && db.duel.codes[made].u[aPid] === 1, await A.p.locator('#codeMsg').innerText().catch(() => ''));
    await A.p.locator('#codeIn').fill(made || 'WELCOME50'); await A.p.locator('#codeGo').click(); await A.p.waitForTimeout(1500); t = await A.p.locator('#codeMsg').innerText().catch(() => '');
    const again = await A.p.evaluate(async ({ made, aPid }) => { const st = JSON.parse(localStorage.getItem('learn-fb-auth')); const u = 'https://mock-project-default-rtdb.firebaseio.com/duel/codes/' + made + '/u/' + aPid + '.json?auth=tok.' + st.uid; return [(await fetch(u, { method: 'DELETE' })).status, (await fetch(u, { method: 'PUT', body: '1' })).status]; }, { made, aPid });
    ok('second redemption is refused by the app and by the rules (cannot erase and repeat)', /already used/i.test(t) && again[0] === 401 && again[1] === 401, t + ' ' + again);
    /* account upgrade keeps the same player on a new device */
    await A.p.goto(BASE + '#/duel'); await A.p.waitForTimeout(1500); await A.p.locator('[data-tab="more"]').click(); await A.p.waitForTimeout(400);
    await A.p.locator('#fbEm').fill('student@example.test'); await A.p.locator('#fbPw').fill('a long enough password'); await A.p.locator('#fbUp').click(); await A.p.waitForTimeout(2500);
    ok('anonymous account upgraded to email without changing the player ID', /Signed in as student@example\.test/.test(await A.p.locator('#fbAcc').innerText()) && db.duel.uids[aAuth] === aPid);
    const B2 = await mk(); await B2.p.goto(BASE + '#/duel'); await B2.p.waitForTimeout(3500); await B2.p.locator('[data-tab="more"]').click(); await B2.p.waitForTimeout(400);
    await B2.p.locator('#fbEm').fill('student@example.test'); await B2.p.locator('#fbPw').fill('a long enough password'); await B2.p.locator('#fbIn').click(); await B2.p.waitForTimeout(2500);
    const pid2 = await B2.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('learn-code-v2')); return s.duel && s.duel.uid; });
    ok('signing in on a second device restores the same online identity', pid2 === aPid, pid2 + ' vs ' + aPid);
    ok('no JavaScript errors in secure mode', A.errs.concat(ADM.errs, B2.errs).length === 0, A.errs.concat(ADM.errs, B2.errs).join(' | '));
    /* legacy mode still works untouched when no key is configured */
    const ctx = await b.newContext(); const L = await ctx.newPage(); const calls = []; await ctx.route(/identitytoolkit|securetoken/, (r) => { calls.push(1); r.abort(); }); await ctx.route(/firebaseio\.com|fonts\./, (r) => r.abort());
    await L.goto(BASE + '#/duel'); await L.waitForTimeout(2500); await L.locator('[data-tab="more"]').click(); await L.waitForTimeout(400);
    ok('legacy mode (no key): no sign-in calls are made and the page says plainly that it is unprotected', calls.length === 0 && /legacy mode/i.test(await L.locator('#fbAcc').innerText()));
  } catch (e) { R.push('FAIL test crashed: ' + String(e && e.stack || e).slice(0, 500)); }
  await b.close(); srv.kill();
  console.log(R.join('\n')); console.log(R.filter((x) => x.startsWith('FAIL')).length + ' failed of ' + R.length + '  (MOCKED Firebase backend enforcing the real rules file)');
})();
