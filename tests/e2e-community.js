/* 5.0 community features with a MOCKED Firebase backend (enforcing firebase/database.rules.json with tests/rules-sim.js)
   and a MOCKED AI service: AI help in lessons, weekly goal and leaderboard, calendar reminder, verifiable certificates,
   classes. It proves the app works against those rules; it does not prove anything about Google's or Cloudflare's servers.
   node tests/e2e-community.js */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const { canRead, canWrite, get } = require('./rules-sim.js');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8784, BASE = 'http://localhost:' + PORT + '/index.html';
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
  const signUp = async (p, email) => { await p.goto(BASE + '#/account'); await p.waitForSelector('#acForm'); await p.fill('#acEm', email); await p.fill('#acPw', 'password-' + email.length + 'xx'); await p.click('#acGo'); await p.waitForSelector('#acNow', { timeout: 15000 }); };
  const EP = (fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const AI_ENDPOINT = '([^']+)'/) || [])[1];
  try {
    /* 1. AI help inside a lesson (the Worker is MOCKED here) */
    { const { ctx, p } = await mk(null); let sent = null, mode = 'ok';
      await ctx.route(EP, async (r) => { if (mode === 'busy') return r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"x"}' }); if (mode === 'down') return r.abort(); sent = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Look at **line 2**: `print` needs brackets.\n\n```python\nprint("hi")\n```\n<img src=x onerror="window.__xss=1">' }) }); });
      const ids = await (async () => { await p.goto(BASE + '#/'); await p.waitForTimeout(800); return p.evaluate(() => window.__learnLessonIds('py')); })();
      await p.goto(BASE + '#/py/' + ids[0]); await p.waitForSelector('#aiBtn');
      ok('lesson: an Ask AI button sits next to Hint', await p.locator('#hintBtn + #resetBtn + #aiBtn, #aiBtn').count() === 1);
      await p.click('#runBtn'); await p.waitForTimeout(600); await p.click('#aiBtn'); await p.waitForSelector('#aiHelp .aiq'); await p.fill('#aiHelp .aiq', 'why is this wrong?'); await p.click('#aiHelp .aigo'); await p.waitForSelector('.aians', { timeout: 10000 });
      const ans = await p.innerText('#aiHelp .aiout');
      ok('lesson AI: the reply is shown with formatting and labelled', /line 2/.test(ans) && await p.locator('.aians b').count() === 1 && await p.locator('.aians pre').count() === 1 && /Answered by GLM-4\.7 Flash/.test(ans));
      ok('lesson AI: HTML in the reply is shown as text, never run', !(await p.evaluate(() => window.__xss)) && await p.locator('.aians img').count() === 0);
      ok('lesson AI: the request carries the lesson, the code, the run result and the question, and asks for a hint not the solution', sent && /Do NOT write the full corrected program/.test(sent.system) && /Python course/.test(sent.system) && /My code:/.test(sent.messages[0].content) && /What happened when I ran it/.test(sent.messages[0].content) && /why is this wrong\?/.test(sent.messages[0].content), JSON.stringify(sent || {}).slice(0, 300));
      mode = 'busy'; await p.click('#aiHelp .aigo'); await p.waitForTimeout(800); ok('lesson AI: busy or daily limit gives a clear message', /AI is busy/.test(await p.innerText('#aiHelp .aiout')));
      mode = 'down'; await p.click('#aiHelp .aigo'); await p.waitForTimeout(800); ok('lesson AI: unreachable gives a clear message and points to Hint', /did not answer|offline/.test(await p.innerText('#aiHelp .aiout')) && /Hint/.test(await p.innerText('#aiHelp .aiout')));
      await ctx.close(); }
    /* 2. weekly goal, leaderboard and calendar reminder */
    { const { ctx, p } = await mk({ bonus: 100 }); await p.goto(BASE + '#/'); await p.waitForSelector('#wkBtn');
      ok('home: a This week card shows weekly XP and goal', /THIS WEEK/.test(await p.innerText('#wkBtn')) && /\/ 150 XP/.test(await p.innerText('#wkBtn')));
      await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('learn-code-v2')); s.bonus = 160; localStorage.setItem('learn-code-v2', JSON.stringify(s)); }); await p.reload(); await p.waitForSelector('#wkBtn');
      ok('weekly XP counts only XP earned since the week started (60 of 150)', /60 \/ 150 XP/.test(await p.innerText('#wkBtn')), await p.innerText('#wkBtn'));
      await p.click('#wkBtn'); await p.waitForSelector('[data-g]'); await p.click('[data-g="50"]'); await p.waitForTimeout(300);
      ok('weekly goal can be changed and is reached', /Goal reached/.test(await T(p)) && (await S(p)).wkGoal === 50);
      ok('weekly leaderboard is opt-in (nothing posted before joining)', !(db.duel.wk) && await p.locator('#wkJoin').count() === 1);
      await p.click('#wkJoin'); await p.waitForSelector('.wklb', { timeout: 15000 });
      const wkKey = Object.keys(db.duel.wk || {})[0]; const entries = wkKey ? Object.values(db.duel.wk[wkKey]) : [];
      ok('weekly leaderboard: joining posts name and weekly XP only, under this ISO week', /^\d{4}-W\d{2}$/.test(wkKey || '') && entries.length === 1 && entries[0].x === 60 && Object.keys(entries[0]).sort().join() === 'at,n,x', JSON.stringify(db.duel.wk || {}).slice(0, 200));
      ok('weekly leaderboard: shows the player marked as you', /\(you\)/.test(await p.innerText('.wklb')));
      await p.click('#wkLeave'); await p.waitForTimeout(800); ok('weekly leaderboard: leaving removes the entry', !Object.values((db.duel.wk || {})[wkKey] || {}).length);
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#wkIcs')]); const ics = fs.readFileSync(await dl.path(), 'utf8');
      ok('reminder: a calendar file with a daily repeat and an alert is downloaded', /BEGIN:VCALENDAR/.test(ics) && /RRULE:FREQ=DAILY/.test(ics) && /BEGIN:VALARM/.test(ics) && /DTSTART:\d{8}T180000/.test(ics) && dl.suggestedFilename() === 'learn-daily-reminder.ics');
      await ctx.close(); }
    /* 3. certificates: create a link, check it signed out, it cannot be altered */
    { const { ctx, p } = await mk(null); await p.goto(BASE + '#/'); await p.waitForTimeout(800);
      await p.goto(BASE + '#/certs'); await p.waitForTimeout(500); ok('certificates: signed out, the page asks to sign in and offers no button', /Sign in to create links/.test(await T(p)) && await p.locator('[data-ce]').count() === 0);
      await signUp(p, 'cert@example.test');
      await p.evaluate(() => { const ids = window.__learnLessonIds('sql'); const s = JSON.parse(localStorage.getItem('learn-code-v2')); s.done = s.done || {}; ids.forEach((id) => { s.done['sql:' + id] = true; }); localStorage.setItem('learn-code-v2', JSON.stringify(s)); });
      await p.reload(); await p.goto(BASE + '#/certs'); await p.waitForSelector('[data-ce="lang-sql"]');
      ok('certificates: only earned courses are offered (SQL only)', await p.locator('[data-ce]').count() === 1);
      await p.click('[data-ce="lang-sql"]'); await p.waitForTimeout(400); ok('certificates: a name is required', /Type the name/.test(await p.innerText('#ceMsg')));
      await p.fill('#ceName', 'Ana <b>Lee</b>'); await p.click('[data-ce="lang-sql"]'); await p.waitForTimeout(1500);
      const id = Object.keys(db.certs || {})[0]; const c = id && db.certs[id];
      ok('certificates: a record is stored with the name, course and server time', c && c.n === 'Ana bLee/b' && /SQL course/.test(c.t) && typeof c.at === 'number', JSON.stringify(c));
      const V = await mk(null, true); const anonCalls = []; V.p.on('request', (r) => { if (/certs\//.test(r.url())) anonCalls.push(r.url()); });
      await V.p.goto(BASE + '#/verify/' + id); await V.p.waitForSelector('.vfok', { timeout: 10000 }); const vt = await T(V.p);
      ok('verify: a signed-out visitor sees the genuine record', /Genuine Learn certificate record/.test(vt) && /Ana bLee\/b/.test(vt) && /SQL course/.test(vt));
      ok('verify: the page says plainly it is not accredited and not independently examined', /not an accredited qualification/.test(vt) && /not independently examined/.test(vt));
      ok('verify: the check is made without any sign-in token', anonCalls.length > 0 && anonCalls.every((u) => !/auth=/.test(u)));
      await V.p.goto(BASE + '#/verify/zzzzzzzzzzzz'); await V.p.waitForTimeout(1500); ok('verify: an unknown link says no certificate exists', /No certificate with this link/.test(await T(V.p)));
      await V.p.goto(BASE + '#/verify/<script>'); await V.p.waitForTimeout(600); ok('verify: a malformed link is rejected without a request', /Not a valid certificate link/.test(await T(V.p)));
      const tamper = await p.evaluate(async (cid) => { const st = JSON.parse(localStorage.getItem('learn-fb-auth')); const r = await fetch('https://mock-project-default-rtdb.firebaseio.com/certs/' + cid + '/n.json?auth=tok.' + st.uid, { method: 'PUT', body: '"Someone else"' }); return r.status; }, id);
      ok('certificates: even the owner cannot alter a certificate after it is created', tamper === 401 && db.certs[id].n === 'Ana bLee/b');
      await V.ctx.close(); await ctx.close(); }
    /* 4. classes: teacher creates, student joins with consent, teacher sees progress, leave, remove, delete */
    { const Tc = await mk(null); await signUp(Tc.p, 'teacher@example.test'); await Tc.p.goto(BASE + '#/classes'); await Tc.p.waitForSelector('#ctGo');
      await Tc.p.click('#ctGo'); await Tc.p.waitForTimeout(300); ok('classes: a class needs a name', /Give the class a name/.test(await Tc.p.innerText('#ctMsg')));
      await Tc.p.fill('#ctName', 'Grade 10 CS'); await Tc.p.click('#ctGo'); await Tc.p.waitForSelector('[data-share]', { timeout: 10000 });
      const code = Object.keys(db.classes || {})[0];
      ok('classes: the class is created with a 6-character code', /^[A-HJ-NP-Z2-9]{6}$/.test(code || '') && db.classes[code].n === 'Grade 10 CS');
      ok('classes: the teacher sees an empty class with the code', new RegExp('No students yet. Share the code ' + code).test(await T(Tc.p)));
      const St = await mk({ days: ['2026-11-10', '2026-11-11'], bonus: 90 }); await signUp(St.p, 'student@example.test'); await St.p.goto(BASE + '#/classes'); await St.p.waitForSelector('#cjGo');
      ok('classes: the student is told exactly what the teacher will see, and what not', /will see only/i.test((await T(St.p)).replace(/\s+/g, ' ')) && /not see your email, your code or your answers/.test(await T(St.p)));
      await St.p.fill('#cjCode', 'ZZZZZZ'); await St.p.fill('#cjName', 'Sam'); await St.p.click('#cjGo'); await St.p.waitForTimeout(1200); ok('classes: a wrong code says no class has it', /No class has that code/.test(await St.p.innerText('#cjMsg')));
      await St.p.fill('#cjCode', code.toLowerCase()); await St.p.click('#cjGo'); await St.p.waitForSelector('[data-leave]', { timeout: 10000 });
      const xp0 = await St.p.evaluate(() => +(document.querySelector('.xpchip') || {}).textContent.replace(/\D/g, '')); const stuUid = Object.keys(db.classes[code].m || {})[0]; const m = db.classes[code].m[stuUid];
      ok('classes: joining stores only the chosen name and progress numbers', m && m.n === 'Sam' && Object.keys(m.p).sort().join() === 'at,d,l,u,w,x' && m.p.d === 2 && m.p.x === xp0 && !JSON.stringify(m).includes('@'), JSON.stringify(m));
      await Tc.p.reload(); await Tc.p.waitForSelector('.clstable', { timeout: 10000 });
      ok('classes: the teacher sees the student and their numbers', /Sam/.test(await Tc.p.innerText('.clstable')) && new RegExp('\\b' + xp0 + '\\b').test(await Tc.p.innerText('.clstable')));
      const peek = await St.p.evaluate(async (c) => { const st = JSON.parse(localStorage.getItem('learn-fb-auth')); return (await fetch('https://mock-project-default-rtdb.firebaseio.com/classes/' + c + '.json?auth=tok.' + st.uid)).status; }, code);
      ok('classes: a student cannot read the class list of other students', peek === 401);
      await St.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('learn-code-v2')); s.bonus = 150; localStorage.setItem('learn-code-v2', JSON.stringify(s)); }); await St.p.goto(BASE + '#/account'); await St.p.reload(); await St.p.waitForSelector('#acNow'); await St.p.click('#acNow'); await St.p.waitForTimeout(2000);
      ok('classes: the teacher\'s view updates when the student saves', db.classes[code].m[stuUid].p.x === xp0 + 60, JSON.stringify(db.classes[code].m[stuUid].p));
      await St.p.goto(BASE + '#/classes'); await St.p.waitForSelector('[data-leave]'); await St.p.click('[data-leave]'); await St.p.waitForTimeout(1200);
      ok('classes: leaving removes the student from the class', !Object.keys(db.classes[code].m || {}).length && !Object.keys((await S(St.p)).clsJ || {}).length);
      await St.p.fill('#cjCode', code); await St.p.fill('#cjName', 'Sam'); await St.p.click('#cjGo'); await St.p.waitForSelector('[data-leave]', { timeout: 10000 });
      await Tc.p.reload(); await Tc.p.waitForSelector('[data-rm]', { timeout: 10000 }); await Tc.p.click('[data-rm]'); await Tc.p.waitForTimeout(1200);
      ok('classes: the teacher can remove a student', !Object.keys(db.classes[code].m || {}).length);
      await Tc.p.click('[data-del]'); await Tc.p.waitForTimeout(200); ok('classes: deleting needs a second press', !!db.classes[code]);
      await Tc.p.click('[data-del]'); await Tc.p.waitForTimeout(1200); ok('classes: the teacher can delete the class', !db.classes || !db.classes[code]);
      await St.ctx.close(); await Tc.ctx.close(); }
    /* 5. deleting an account also removes its classes and certificate links */
    { const { ctx, p } = await mk(null); await signUp(p, 'leaver@example.test'); await p.goto(BASE + '#/classes'); await p.waitForSelector('#ctGo'); await p.fill('#ctName', 'Temp'); await p.click('#ctGo'); await p.waitForSelector('[data-share]', { timeout: 10000 });
      const before = Object.keys(db.classes || {}).length;
      await p.goto(BASE + '#/account'); await p.waitForSelector('#acDel'); await p.click('#acDel'); await p.click('#acDel'); await p.waitForSelector('#acForm', { timeout: 20000 });
      ok('delete account: the classes it taught are deleted too', before === 1 && !Object.keys(db.classes || {}).length, JSON.stringify(db.classes || {}).slice(0, 100));
      await ctx.close(); }
    /* 6. 5.1: AI in the Playground, practice drills, review of mistakes, AI explanations, University exercises */
    { const { ctx, p } = await mk(null); let sent = null;
      await ctx.route(EP, async (r) => { sent = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Because **2** is printed.' }) }); });
      await p.goto(BASE + '#/play/py'); await p.waitForSelector('#aiBtn', { timeout: 10000 });
      await p.click('#aiBtn'); await p.fill('.aiq', 'what does it do?'); await p.click('.aigo'); await p.waitForSelector('.aians', { timeout: 10000 });
      ok('playground: Ask AI answers and is labelled', /Because 2 is printed/.test(await p.innerText('#aiHelp')) && /Answered by/.test(await p.innerText('#aiHelp')) && /Playground/.test(sent.system));
      await p.goto(BASE + '#/practice'); await p.waitForSelector('#prGo');
      ok('practice: the page offers mistakes review and drills in all 15 languages', /No mistakes to review/.test(await T(p)) && await p.locator('#prLang option').count() === 15);
      await p.selectOption('#prLang', 'go'); await p.selectOption('#prDiff', '1'); await p.click('#prGo'); await p.waitForSelector('.quizcard', { timeout: 15000 });
      ok('practice: a 10-question Go drill starts', /1 \/ 10/.test(await T(p)) && /^Go:/.test(await p.innerText('.quiz h3')));
      let wrongs = 0;
      for (let i = 0; i < 10; i++) { await p.waitForSelector('.opt'); const a = await p.evaluate(() => window.__prAnswer()); const pick = i < 2 ? (a + 1) % 4 : a; // wrong on the first two, right after
        await p.locator('.opt').nth(pick).click(); const wrong = await p.locator('.opt.wrong').count(); wrongs += wrong;
        if (i === 0 && wrong) { await p.click('#qAiBtn'); await p.waitForSelector('#qAiHelp .aians', { timeout: 10000 }); ok('practice: after a wrong answer, Explain with AI asks at once, with the correct answer and official explanation as ground truth', /Correct answer:/.test(sent.messages[0].content) && /Official explanation:/.test(sent.messages[0].content)); }
        await p.click('#nxt'); }
      await p.waitForSelector('#prAgain'); const st = await S(p);
      ok('practice: results are shown and wrong answers are saved for review', /\/ 10 correct/.test(await T(p)) && Object.keys(st.miss || {}).length === wrongs && wrongs >= 1, wrongs + ' ' + JSON.stringify(st.miss || {}).slice(0, 120));
      ok('practice: correct answers give XP, at most 30 a day', st.prXp && st.prXp.n === 10 - wrongs && st.bonus === 10 - wrongs);
      await p.click('#prHome'); await p.waitForSelector('#prReview'); ok('practice: the review list shows the mistakes', new RegExp(wrongs + ' question').test(await T(p)));
      for (let round = 0; round < 2; round++) { await p.goto(BASE + '#/practice'); await p.waitForSelector('#prReview'); await p.click('#prReview');
        for (let i = 0; i < wrongs; i++) { await p.waitForSelector('.opt'); const idx = await p.evaluate(() => window.__prAnswer()); await p.locator('.opt').nth(idx).click(); if (round === 0 && i === 0) ok('review: a correct answer says one more is needed', /1 more correct answer/.test(await p.innerText('.why'))); await p.click('#nxt'); } }
      ok('practice: a mistake leaves the review list after two correct reviews', !Object.keys((await S(p)).miss || {}).length);
      await ctx.close(); }
    { const { ctx, p } = await mk(null); await ctx.route(EP, (r) => r.abort());
      await p.goto(BASE + '#/uni/labs/py'); await p.waitForTimeout(2500);
      ok('University open lab: an Ask AI button is offered', await p.locator('.u-aibtn').count() === 1);
      await p.goto(BASE + '#/uni/arena'); await p.waitForTimeout(500);
      const examSrc = require('fs').readFileSync(require('path').join(ROOT, 'uni', 'uni-assess.js'), 'utf8');
      ok('University: AI is only added to try-its, assignments, studio and the open lab, never examinations or interviews', /opts\.compact \|\| \/\^\(lab\|free\|studio\):\//.test(examSrc) && /mountTask\(\$\('\[data-code="' \+ i \+ '"\]'\), it, \{ graded: false \}\)/.test(examSrc));
      await ctx.close(); }
    /* 7. 5.2: coding challenges — every reference solution passes in the app's own engines; wrong code fails; XP once */
    { const { ctx, p } = await mk(null); const refPy = fs.readFileSync(path.join(ROOT, 'tests', 'challenges-ref.py'), 'utf8').split(/\n(?=def )/), refJs = fs.readFileSync(path.join(ROOT, 'tests', 'challenges-ref.js'), 'utf8').split(/\n(?=function )/);
      const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8').replace(/^[\s\S]*?window\.LEARN_CHALLENGES = /, '').replace(/;\s*$/, ''));
      ok('challenges: 24 problems, each with at least 3 tests, and no solutions shipped to the page', list.length === 24 && list.every((c) => c.tests.length >= 3) && !/return total|while i < j/.test(fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8')));
      await p.goto(BASE + '#/challenges'); await p.waitForSelector('.chcard', { timeout: 15000 }); ok('challenges: the list shows all 24 in three levels', await p.locator('.chcard').count() === 24 && /Warm-up/.test(await T(p)) && /Tough/.test(await T(p)));
      const bad = [];
      for (const lang of ['py', 'js']) {
        for (const c of list) {
          const src = (lang === 'py' ? refPy : refJs).find((s) => s.trim().startsWith((lang === 'py' ? 'def ' : 'function ') + c[lang] + '('));
          await p.goto(BASE + '#/challenges/' + c.id); await p.waitForSelector('#runBtn', { timeout: 10000 });
          if (!(await p.locator('[data-cl="' + lang + '"].on').count())) { await p.click('[data-cl="' + lang + '"]'); await p.waitForSelector('[data-cl="' + lang + '"].on'); }
          await p.evaluate((s) => { const ta = document.querySelector('#edhost textarea'); ta.value = s; ta.dispatchEvent(new Event('input', { bubbles: true })); }, src);
          await p.click('#runBtn'); await p.waitForSelector('.chsum', { timeout: 20000 }); const txt = await p.innerText('.chsum');
          if (!/All \d+ tests passed/.test(txt)) bad.push(lang + ':' + c.id + ' ' + txt + ' ' + (await p.innerText('#chRes')).slice(0, 200));
        }
      }
      ok('challenges: all 48 reference solutions (24 Python, 24 JavaScript) pass in the app\'s own engines', bad.length === 0, bad.join(' | '));
      const st = await S(p); ok('challenges: solving gives 20 XP once per language (48 solves = 960 XP)', st.bonus === 960 && Object.keys(st.chal || {}).length === 24, st.bonus);
      await p.goto(BASE + '#/challenges/fizzbuzz'); await p.waitForSelector('#runBtn'); await p.click('[data-cl="py"]'); await p.waitForSelector('[data-cl="py"].on');
      await p.evaluate(() => { const ta = document.querySelector('#edhost textarea'); ta.value = 'def fizzbuzz(n):\n    return []\n'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
      await p.click('#runBtn'); await p.waitForSelector('.chsum');
      ok('challenges: wrong code fails, shows expected vs got for visible tests and keeps hidden tests hidden', /❌ 1 of 4 tests passed/.test(await p.innerText('.chsum')) && /expected/.test(await p.innerText('.chtests')) && /hidden test/.test(await p.innerText('.chtests')));
      await p.goto(BASE + '#/stats'); await p.waitForSelector('.hmgrid'); ok('stats: a 26-week activity heatmap and a 12-week chart are shown', await p.locator('.hmcol').count() === 26 && await p.locator('.wkbars rect').count() === 12 && await p.locator('.hm.l4, .hm.l3, .hm.l2').count() >= 1);
      ok('stats: the offline save button is offered', await p.locator('#offBtn').count() === 1);
      await p.click('#offBtn'); await p.waitForTimeout(800); ok('offline: without the service worker it explains what to do instead of pretending', /reload Learn once/.test(await p.innerText('#offMsg')));
      await ctx.close(); }
    /* 8. 5.3: landing pages list exactly the app's lessons and link into them; share button on home */
    { const { ctx, p } = await mk(null); await p.goto(BASE + '#/'); await p.waitForFunction(() => !!window.__learnCatalog); const cat = await p.evaluate(() => window.__learnCatalog());
      const slug = { py: 'python', js: 'javascript', ts: 'typescript', cpp: 'cpp', cs: 'csharp' }; const bad = [];
      for (const c of cat) { const h = fs.readFileSync(path.join(ROOT, 'learn-' + (slug[c.k] || c.k) + '.html'), 'utf8'); const n = (h.match(/<li><a href="\.\/#\//g) || []).length; if (n !== c.lessons.length || !h.includes('./#/' + c.k + '/' + c.lessons[0].id)) bad.push(c.k + ' ' + n + '/' + c.lessons.length); }
      ok('5.3: each landing page lists exactly the lessons in the app (361 language lessons; the 26 terminal lessons are separate) and links to lesson 1', bad.length === 0 && cat.reduce((a, c) => a + c.lessons.length, 0) === 361, bad.join(' '));
      await p.goto(BASE.replace('index.html', 'learn-go.html')); await p.click('a.cta'); await p.waitForTimeout(1500); ok('5.3: the landing page button opens the first lesson in the app', /#\/go\//.test(await p.evaluate(() => location.hash)) && await p.locator('#runBtn').count() === 1);
      await p.goto(BASE + '#/'); await p.waitForSelector('#shareLearn'); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); await p.click('#shareLearn'); await p.waitForTimeout(500);
      ok('5.3: Share Learn copies an invitation with the site link (when the share sheet is not available)', /08raph\.github\.io\/Learn/.test(await p.evaluate(() => navigator.clipboard.readText().catch(() => ''))) || /copied/.test(await p.evaluate(() => document.body.innerText)));
      // 5.4: course and challenge pages open the right screen in the app; Share on a challenge copies its page link
      await p.goto(BASE.replace('index.html', 'course-c201.html')); await p.click('a.cta'); await p.waitForTimeout(2500);
      ok('5.4: a course page button opens that course in the University', /#\/uni\/course\/c201/.test(await p.evaluate(() => location.hash)) && /SEU 201|CS 201|201/.test(await T(p)));
      await p.goto(BASE.replace('index.html', 'challenge-two-sum.html')); await p.click('a.cta'); await p.waitForSelector('#chShare', { timeout: 15000 });
      ok('5.4: a challenge page button opens that challenge', /#\/challenges\/two-sum/.test(await p.evaluate(() => location.hash)) && await p.locator('#runBtn').count() === 1);
      await p.evaluate(() => navigator.clipboard.writeText('')); await p.click('#chShare'); await p.waitForTimeout(500);
      ok('5.4: Share on a challenge copies the link to its public page', /08raph\.github\.io\/Learn\/challenge-two-sum\.html/.test(await p.evaluate(() => navigator.clipboard.readText().catch(() => ''))));
      await ctx.close(); }
    ok('the app never sent a request without a token that the rules refused', !denied.some((x) => / as null/.test(x) && !/certs/.test(x)), denied.join(' ; '));
    ok('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) { ok('test run crashed', false, e.stack); }
  await b.close(); srv.kill(); console.log((fail ? fail + ' FAILED, ' : '0 failed of ') + (pass + fail) + ' (MOCKED Firebase backend enforcing firebase/database.rules.json and a MOCKED AI service; not Google\'s or Cloudflare\'s servers)'); process.exit(fail ? 1 : 0);
})();
