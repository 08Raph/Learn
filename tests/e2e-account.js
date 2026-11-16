/* Accounts (4.6): create an account, sign in, progress saved in the account, sign out, delete, with a MOCKED
   Firebase backend. Requests to Firebase Authentication and the Realtime Database are answered by an in-test backend
   that enforces firebase/database.rules.json with tests/rules-sim.js (a simulator). This proves the app's account
   flows work against those rules. It does NOT prove anything about Google's servers.   node tests/e2e-account.js */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const { canRead, canWrite, get } = require('./rules-sim.js');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8783, BASE = 'http://localhost:' + PORT + '/index.html';
const APPV = (fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const APP_VERSION = '([^']+)'/) || [])[1];
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase', 'database.rules.json'), 'utf8'));
let pass = 0, fail = 0; const ok = (m, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m + (x ? ' [' + String(x).slice(0, 260) + ']' : '')); } };
let db = { duel: { ping: 1 } }; const accounts = {}; let seq = 0; const denied = [], resets = []; let down = false;
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
const tokenFor = (uid) => ({ idToken: 'tok.' + uid, refreshToken: 'rt.' + uid, localId: uid, expiresIn: '3600', email: (accounts[uid] || {}).email });
async function backend(route) {
  if (down) return route.abort();
  const req = route.request(), u = new URL(req.url()); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.hostname === 'identitytoolkit.googleapis.com') { const b = JSON.parse(req.postData() || '{}');
    if (u.pathname.endsWith(':signUp') && b.idToken) { const uid = String(b.idToken).replace('tok.', ''); if (!accounts[uid]) return json(route, 400, { error: { message: 'INVALID_ID_TOKEN' } }); if (Object.keys(accounts).some((k) => accounts[k].email === b.email)) return json(route, 400, { error: { message: 'EMAIL_EXISTS' } }); Object.assign(accounts[uid], { email: b.email, pw: b.password }); return json(route, 200, tokenFor(uid)); } // link email+password to the anonymous account (4.9)
    if (u.pathname.endsWith(':signUp')) { const uid = 'authAnon' + (++seq); accounts[uid] = {}; return json(route, 200, tokenFor(uid)); }
    if (u.pathname.endsWith(':signInWithPassword')) { const uid = Object.keys(accounts).find((k) => accounts[k].email === b.email && accounts[k].pw === b.password); return uid ? json(route, 200, tokenFor(uid)) : json(route, 400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } }); }
    if (u.pathname.endsWith(':update') && b.email) return json(route, 400, { error: { message: 'OPERATION_NOT_ALLOWED : Please verify the new email before changing email.' } });
    if (u.pathname.endsWith(':update')) { const uid = String(b.idToken || '').replace('tok.', ''); if (!accounts[uid]) return json(route, 400, { error: { message: 'INVALID_ID_TOKEN' } }); if (Object.keys(accounts).some((k) => accounts[k].email === b.email)) return json(route, 400, { error: { message: 'EMAIL_EXISTS' } }); accounts[uid] = { email: b.email, pw: b.password }; return json(route, 200, tokenFor(uid)); }
    if (u.pathname.endsWith(':sendOobCode')) { resets.push(b); return json(route, 200, { email: b.email }); }
    if (u.pathname.endsWith(':delete')) { const uid = String(b.idToken || '').replace('tok.', ''); if (!accounts[uid]) return json(route, 400, { error: { message: 'INVALID_ID_TOKEN' } }); delete accounts[uid]; return json(route, 200, {}); }
    return json(route, 404, {}); }
  if (u.hostname === 'securetoken.googleapis.com') { const rt = new URLSearchParams(req.postData() || '').get('refresh_token') || ''; const uid = rt.replace('rt.', ''); return accounts[uid] ? json(route, 200, { id_token: 'tok.' + uid, refresh_token: rt, user_id: uid, expires_in: '3600' }) : json(route, 400, { error: { message: 'INVALID_REFRESH_TOKEN' } }); }
  const p = decodeURIComponent(u.pathname).replace(/\.json$/, '').replace(/^\/+/, ''); const tok = u.searchParams.get('auth'); const uid = tok && tok.startsWith('tok.') && accounts[tok.slice(4)] ? tok.slice(4) : null;
  const auth = uid ? { uid, token: Object.assign({ firebase: { sign_in_provider: accounts[uid].email ? 'password' : 'anonymous' } }, accounts[uid].email ? { email: accounts[uid].email } : {}) } : null;
  if (req.method() === 'GET') { if (!canRead(rules, db, p, auth, Date.now())) { denied.push('GET ' + p + ' as ' + uid); return json(route, 401, { error: 'Permission denied' }); } return json(route, 200, get(db, p.split('/').filter(Boolean))); }
  let v = req.method() === 'DELETE' ? null : JSON.parse(req.postData() || 'null'); v = JSON.parse(JSON.stringify(v), (k, x) => (x && typeof x === 'object' && x['.sv'] === 'timestamp' ? Date.now() - 1 : x));
  const res = canWrite(rules, db, p, v, auth, Date.now()); if (!res.ok) { denied.push(req.method() + ' ' + p + ' as ' + uid + ': ' + res.why); return json(route, 401, { error: 'Permission denied' }); }
  db = res.after; return json(route, 200, v);
}
const savedFor = (email) => { const uid = Object.keys(accounts).find((k) => accounts[k].email === email); const s = uid && db.saves && db.saves[uid]; return s ? JSON.parse(s.d).d : null; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch(); const errs = [];
  const mk = async (seed, secure = true) => { const ctx = await b.newContext({ viewport: { width: 1024, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|firebaseio\.com\/(?!.*mock-project)/, (r) => r.abort());
    if (!secure) await ctx.route('**/app.js*', async (route) => { const res = await route.fetch(); const t = (await res.text()).replace(/const FB_API_KEY = '[^']*';/, "const FB_API_KEY = '';"); return route.fulfill({ response: res, body: t }); });
    if (secure) await ctx.route('**/app.js*', async (route) => { const res = await route.fetch(); let t = await res.text(); if (!/const FB_API_KEY = '[^']*';/.test(t)) throw new Error('FB_API_KEY marker missing'); t = t.replace(/const FB_API_KEY = '[^']*';/, "const FB_API_KEY = 'TEST-WEB-KEY';").replace(/const DUEL_DB = '[^']*';/, "const DUEL_DB = 'https://mock-project-default-rtdb.firebaseio.com';"); return route.fulfill({ response: res, body: t }); });
    await ctx.route(/identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|mock-project-default-rtdb\.firebaseio\.com/, backend);
    if (seed) seed = Object.assign({ seenPatch: APPV }, seed);
    if (seed) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); if (!localStorage.getItem('learn-code-v2')) localStorage.setItem('learn-code-v2', JSON.stringify(s)); } }, seed);
    return { ctx, p }; };
  const T = (p) => p.evaluate(() => document.querySelector('#app').innerText);
  const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('learn-code-v2') || '{}'));
  try {
    /* 0. accounts switched off (no FB_API_KEY): honest page, no form */
    { const { ctx, p } = await mk(null, false); await p.goto(BASE + '#/'); await p.waitForTimeout(1200);
      ok('off: the top bar has a Sign in button', /Sign in/.test(await p.locator('#acctBtn').innerText()));
      await p.click('#acctBtn'); await p.waitForTimeout(600); const t = await T(p);
      ok('off: the account page says accounts are not switched on, and offers the backup file', /not switched on yet/.test(t) && /Backup file/.test(t) && await p.locator('#acForm').count() === 0);
      ok('off: owner instructions mention Email/Password, the rules file and FB_API_KEY', await p.evaluate(() => /Email\/Password/.test(document.body.textContent) && /database\.rules\.json/.test(document.body.textContent) && /FB_API_KEY/.test(document.body.textContent)));
      await ctx.close(); }
    /* 1. device A: create an account; the progress already on the device goes into it */
    const A = await mk({ days: ['2026-01-01'], bonus: 40, uni: { lessons: { 'c101:0': 1 } } }); await A.p.goto(BASE + '#/account'); await A.p.waitForSelector('#acForm');
    ok('form: Create account is shown first, with email and password labels', /Create your account/.test(await T(A.p)) && await A.p.locator('label[for=acEm]').count() === 1 && await A.p.locator('label[for=acPw]').count() === 1);
    await A.p.fill('#acEm', 'not-an-email'); await A.p.fill('#acPw', 'longenough1'); await A.p.click('#acGo'); await A.p.waitForTimeout(300);
    ok('form: an invalid email is caught before anything is sent', /valid email/.test(await A.p.innerText('#acMsg')) && Object.keys(accounts).length === 0);
    await A.p.fill('#acEm', 'ana@example.test'); await A.p.fill('#acPw', 'short'); await A.p.click('#acGo'); await A.p.waitForTimeout(300);
    ok('form: a password under 8 characters is refused', /at least 8/.test(await A.p.innerText('#acMsg')));
    await A.p.click('#acShow'); ok('form: Show reveals the password', await A.p.getAttribute('#acPw', 'type') === 'text'); await A.p.click('#acShow');
    await A.p.fill('#acPw', 'ana-password-1'); await A.p.click('#acGo'); await A.p.waitForSelector('#acNow', { timeout: 15000 }); await A.p.waitForTimeout(800);
    let d = savedFor('ana@example.test');
    ok('create: the account exists with that email', Object.values(accounts).some((a) => a.email === 'ana@example.test'));
    ok('create: progress already on the device is saved into the account', d && d.days.includes('2026-01-01') && d.bonus === 40 && d.uni && d.uni.lessons['c101:0'], JSON.stringify(d));
    ok('create: the page shows the email and that progress was saved', /Signed in as ana@example\.test/.test(await T(A.p)) && /Progress saved to your account/.test(await A.p.innerText('#acSync')));
    ok('create: the top bar now says Account', /Account/.test(await A.p.innerText('#acctBtn')));
    ok('create: the saved copy holds no GitHub token and no device player ID', d && !JSON.stringify(d).includes('"token"') && !(d.duel && d.duel.uid));
    /* 2. same email again from another device: clear message */
    const X = await mk(null); await X.p.goto(BASE + '#/account'); await X.p.waitForSelector('#acForm'); await X.p.fill('#acEm', 'ana@example.test'); await X.p.fill('#acPw', 'whatever-123'); await X.p.click('#acGo'); await X.p.waitForTimeout(1500);
    ok('create: an email that already has an account gets "Use Sign in"', /already has an account/.test(await X.p.innerText('#acMsg'))); await X.ctx.close();
    /* 3. device B: sign in; both devices' progress is combined */
    const B = await mk({ days: ['2026-02-02'], bonus: 10 }); await B.p.goto(BASE + '#/account'); await B.p.waitForSelector('#acForm'); await B.p.click('#acTabIn'); await B.p.waitForTimeout(200);
    ok('sign in: the Sign in tab has Forgot password', /Sign in/.test(await T(B.p)) && await B.p.locator('#acForgot').count() === 1);
    await B.p.fill('#acEm', 'ana@example.test'); await B.p.fill('#acPw', 'wrong-password'); await B.p.click('#acGo'); await B.p.waitForTimeout(1500);
    ok('sign in: a wrong password says so and does not sign in', /Wrong email or password/.test(await B.p.innerText('#acMsg')) && await B.p.locator('#acNow').count() === 0);
    await B.p.fill('#acPw', 'ana-password-1'); await B.p.click('#acGo'); await B.p.waitForSelector('#acNow', { timeout: 15000 }); await B.p.waitForTimeout(800);
    let sb = await S(B.p); d = savedFor('ana@example.test');
    ok('sign in: the account\'s progress arrives on device B (days, University lesson)', sb.days.includes('2026-01-01') && sb.days.includes('2026-02-02') && sb.uni && sb.uni.lessons && sb.uni.lessons['c101:0'], JSON.stringify(sb.days));
    ok('sign in: device B\'s own progress is kept and added to the account', d.days.includes('2026-02-02') && d.days.includes('2026-01-01'));
    ok('sign in: XP is never lowered by combining (40 kept)', sb.bonus === 40 && d.bonus === 40);
    /* 4. change on A reaches B */
    await A.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('learn-code-v2')); s.days.push('2026-03-03'); localStorage.setItem('learn-code-v2', JSON.stringify(s)); }); await A.p.reload(); await A.p.waitForSelector('#acNow'); await A.p.click('#acNow'); await A.p.waitForTimeout(1200);
    ok('save now: a new day on device A is in the account', savedFor('ana@example.test').days.includes('2026-03-03'));
    await B.p.goto(BASE + '#/'); await B.p.reload(); await B.p.waitForTimeout(3500);
    ok('start-up: device B picks up the change when Learn opens', (await S(B.p)).days.includes('2026-03-03'));
    /* 5. automatic saving a few seconds after a change */
    await B.p.goto(BASE + '#/'); await B.p.waitForTimeout(500); await B.p.click('#themeBtn'); const th = (await S(B.p)).theme;
    await B.p.waitForTimeout(17000); ok('auto-save: a change is saved to the account within about 15 seconds', savedFor('ana@example.test').theme === th, th);
    /* 6. privacy: another account cannot read Ana's saved progress, even with a genuine token */
    const C = await mk(null); await C.p.goto(BASE + '#/account'); await C.p.waitForSelector('#acForm'); await C.p.fill('#acEm', 'cy@example.test'); await C.p.fill('#acPw', 'cy-password-1'); await C.p.click('#acGo'); await C.p.waitForSelector('#acNow', { timeout: 15000 });
    const anaUid = Object.keys(accounts).find((k) => accounts[k].email === 'ana@example.test');
    const peek = await C.p.evaluate(async (target) => { const st = JSON.parse(localStorage.getItem('learn-fb-auth')); const r = await fetch('https://mock-project-default-rtdb.firebaseio.com/saves/' + target + '.json?auth=tok.' + st.uid); const w = await fetch('https://mock-project-default-rtdb.firebaseio.com/saves/' + target + '.json?auth=tok.' + st.uid, { method: 'PUT', body: JSON.stringify({ d: '{}', at: 1, v: 'x' }) }); return [r.status, w.status]; }, anaUid);
    ok('privacy: another signed-in account cannot read or overwrite Ana\'s progress', peek[0] === 401 && peek[1] === 401, JSON.stringify(peek)); await C.ctx.close();
    /* 7. offline: progress stays on the device and the page says so */
    down = true; await A.p.evaluate(() => { window.dispatchEvent(new Event('offline')); }); await A.p.click('#acNow'); await A.p.waitForTimeout(1200);
    ok('offline: a failed save is reported in plain words, not as an error page', /Could not reach your account|offline/.test(await A.p.innerText('#acSync')), await A.p.innerText('#acSync'));
    ok('offline: the top bar shows a warning sign', /⚠️/.test(await A.p.innerText('#acctBtn'))); down = false;
    /* 8. forgot password */
    const F = await mk(null); await F.p.goto(BASE + '#/account'); await F.p.waitForSelector('#acForm'); await F.p.click('#acTabIn'); await F.p.waitForTimeout(200);
    await F.p.click('#acForgot'); await F.p.waitForTimeout(200); ok('forgot: asks for the email first', /Type your email/.test(await F.p.innerText('#acMsg')) && resets.length === 0);
    await F.p.fill('#acEm', 'ana@example.test'); await F.p.click('#acForgot'); await F.p.waitForTimeout(1000);
    ok('forgot: a password-reset email is requested for that address', resets.length === 1 && resets[0].requestType === 'PASSWORD_RESET' && resets[0].email === 'ana@example.test');
    ok('forgot: the message does not reveal whether the account exists', /If an account exists/.test(await F.p.innerText('#acMsg'))); await F.ctx.close();
    /* 9. sign out keeps progress; sign out and clear removes it after saving */
    await B.p.goto(BASE + '#/account'); await B.p.waitForSelector('#acOut'); await B.p.click('#acOut'); await B.p.waitForTimeout(800);
    ok('sign out: the device is signed out and keeps its progress', await B.p.locator('#acForm').count() === 1 && (await S(B.p)).days.includes('2026-03-03') && /Sign in/.test(await B.p.innerText('#acctBtn')));
    await A.p.goto(BASE + '#/account'); await A.p.waitForSelector('#acOutClear'); await A.p.click('#acOutClear'); await A.p.waitForTimeout(300);
    ok('sign out and clear: needs a second press', await A.p.locator('#acNow').count() === 1);
    await A.p.click('#acOutClear'); await A.p.waitForTimeout(3000); const sa = await S(A.p);
    ok('sign out and clear: progress is removed from the device', !(sa.days || []).length && !sa.bonus, JSON.stringify(sa).slice(0, 120));
    ok('sign out and clear: the account copy is untouched', savedFor('ana@example.test').days.includes('2026-03-03'));
    await A.p.goto(BASE + '#/account'); await A.p.waitForSelector('#acForm'); await A.p.click('#acTabIn'); await A.p.fill('#acEm', 'ana@example.test'); await A.p.fill('#acPw', 'ana-password-1'); await A.p.click('#acGo'); await A.p.waitForSelector('#acNow', { timeout: 15000 }); await A.p.waitForTimeout(800);
    ok('sign in again: everything comes back from the account', (await S(A.p)).days.includes('2026-03-03') && (await S(A.p)).bonus === 40);
    /* 10. delete account */
    await A.p.click('#acDel'); await A.p.waitForTimeout(200); ok('delete: needs a second press', /Press again/.test(await A.p.innerText('#acDel')) && !!savedFor('ana@example.test'));
    await A.p.click('#acDel'); await A.p.waitForSelector('#acForm', { timeout: 20000 }); await A.p.waitForTimeout(500);
    ok('delete: the saved progress and the sign-in account are gone', !Object.values(accounts).some((a) => a.email === 'ana@example.test') && !(db.saves && db.saves[anaUid]), JSON.stringify(db.saves || {}).slice(0, 100));
    ok('delete: progress on this device is kept', (await S(A.p)).days.includes('2026-03-03'));
    ok('the app never sent a request without a token that the rules refused', !denied.some((x) => / as null/.test(x)), denied.join(' ; '));
    ok('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) { ok('test run crashed', false, e.stack); try { const pg = b.contexts().map((c) => c.pages()).flat(); for (let i = 0; i < pg.length; i++) await pg[i].screenshot({ path: '/tmp/acct-crash-' + i + '.png' }); } catch (e2) {} }
  await b.close(); srv.kill(); console.log((fail ? fail + ' FAILED, ' : '0 failed of ') + (pass + fail) + ' (MOCKED Firebase backend enforcing firebase/database.rules.json; not Google\'s servers)'); process.exit(fail ? 1 : 0);
})();
