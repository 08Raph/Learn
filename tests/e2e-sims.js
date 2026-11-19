// 5.9 simulators: the circuit simulator and the ethical hacking range, driven in a real browser.
//   node tests/e2e-sims.js   (needs the app served on :8765; see run-all.sh)
// Every hacking-range target is a fake system inside the page. This suite also checks that the range sends no
// request anywhere except the page's own files, and that the XSS guestbook frame cannot reach the Learn page.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/index.html';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const SITE_WIDE = /fonts\.googleapis\.com|fonts\.gstatic\.com|cloudflareinsights\.com/; // the site's own fonts and analytics, loaded on every page
  const outside = []; await ctx.route(/^https?:\/\/(?!localhost)/, (r) => { if (!SITE_WIDE.test(r.request().url())) outside.push(r.request().url()); r.abort(); });
  await p.addInitScript(() => { try { if (window !== window.top) return; if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', 1); localStorage.setItem('learn-code-v2', JSON.stringify({ seenPatch: '99' })); } } catch (e) {} }); // not inside the sandboxed guestbook frame, which has no storage
  const go = async (h, sel) => { await p.goto(BASE + h); await p.waitForSelector(sel || '.u-crumbs', { timeout: 20000 }); await p.waitForTimeout(150); };
  const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('learn-code-v2') || '{}').uni || {});
  await go('#/uni/circuit', '.u-list a');

  /* 1. circuit grading */
  const g = await p.evaluate(() => { const S = window.LearnUniversity.sims; const out = [];
    S.CT.forEach((t) => { out.push(['solution of ' + t.id + ' passes', S.grade(t.id, S.fromSol(t)).pass]); out.push(['empty board for ' + t.id + ' fails', !S.grade(t.id, { g: [], f: [], o: {} }).pass]); });
    const half = (x, y) => ({ g: [{ id: 'G1', t: x, i: ['A', 'B'] }, { id: 'G2', t: y, i: ['A', 'B'] }], f: [], o: { S: 'G1', C: 'G2' } });
    out.push(['half adder with OR for the sum fails the truth table', !S.grade('half', half('OR', 'AND')).pass]);
    out.push(['half adder with outputs swapped fails', !S.grade('half', { g: half('XOR', 'AND').g, f: [], o: { S: 'G2', C: 'G1' } }).pass]);
    out.push(['NOT built from a NOT gate fails the NAND-only rule', !S.grade('not', { g: [{ id: 'G1', t: 'NOT', i: ['A'] }], f: [], o: { Y: 'G1' } }).pass]);
    out.push(['AND from three NANDs fails the two-gate limit', S.grade('and', { g: [{ id: 'G1', t: 'NAND', i: ['A', 'B'] }, { id: 'G2', t: 'NAND', i: ['G1', 'G1'] }, { id: 'G3', t: 'NAND', i: ['G2', 'G2'] }], f: [], o: { Y: 'G3' } }).checks.find((c) => /At most/.test(c[0]))[1] === false]);
    out.push(['a gate cannot use a later gate (no loops)', !S.grade('not', { g: [{ id: 'G1', t: 'NAND', i: ['G2', 'G2'] }, { id: 'G2', t: 'NAND', i: ['A', 'A'] }], f: [], o: { Y: 'G2' } }).pass]);
    out.push(['toggle without the flip-flop feedback fails the sequence', !S.grade('toggle', { g: [{ id: 'G1', t: 'XOR', i: ['T', 'T'] }], f: [{ id: 'FF1', d: 'T' }], o: { Q: 'FF1' } }).pass]);
    out.push(['counter that ignores EN fails', !S.grade('count', { g: [{ id: 'G1', t: 'NOT', i: ['FF1'] }, { id: 'G2', t: 'XOR', i: ['FF2', 'FF1'] }], f: [{ id: 'FF1', d: 'G1' }, { id: 'FF2', d: 'G2' }], o: { Q1: 'FF2', Q0: 'FF1' } }).pass]);
    out.push(['junk in a saved circuit is cleaned, not run', S.grade('half', { g: [{ id: 'G1', t: 'EVIL', i: ['<img>', 'B'] }, { id: '"><x', t: 'AND', i: ['A', 'B'] }, null], f: 'x', o: { S: 'alert(1)' } }).pass === false]);
    return out; });
  g.forEach((x) => ok(x[1], x[0]));

  /* 2. circuit page: build through the interface, pass recorded, draft kept, loaded solution does not count */
  await go('#/uni/circuit/half', '#czBoard');
  await p.click('[data-add="XOR"]'); await p.click('[data-add="AND"]');
  await p.selectOption('#czA0', 'A'); await p.selectOption('#czB0', 'B'); await p.selectOption('#czA1', 'A'); await p.selectOption('#czB1', 'B');
  await p.selectOption('#czOS', 'G1'); ok(!/Passed/.test(await p.innerText('#czState')), 'not passed while an output is unconnected');
  await p.selectOption('#czOC', 'G2'); await p.waitForTimeout(500);
  ok(/Passed/.test(await p.innerText('#czState')), 'half adder built in the interface passes');
  ok((await save()).circ && (await save()).circ.half && (await save()).circ.half.pass === true, 'the pass is saved in the Learn save');
  await p.click('#czBoard [data-in="A"]'); await p.click('#czBoard [data-in="B"]');
  const nodes = () => p.$$eval('#czBoard .czn', (g) => g.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  let nd = await nodes(); ok(nd.includes('A1') && nd.includes('B1') && nd.includes('S0') && nd.includes('C1') && nd.includes('G1 XOR0') && nd.includes('G2 AND1'), 'switching both inputs to 1 shows S = 0 and C = 1 in the live diagram: ' + nd.join(','));
  await p.focus('#czBoard [data-in="A"]'); await p.keyboard.press('Enter'); nd = await nodes(); ok(nd.includes('A0') && nd.includes('S1') && nd.includes('C0'), 'an input can be switched with the keyboard (Enter)');
  ok((await p.$$eval('#czTable tbody tr', (r) => r.length)) === 4 && (await p.$$('#czTable tr.bad')).length === 0, 'truth table shows 4 correct rows');
  await p.reload(); await p.waitForSelector('#czParts li b'); ok((await p.$$('#czParts select')).length === 6, 'the circuit is still there after a reload');
  await go('#/uni/circuit/mux', '#czBoard'); await p.click('details:has(#czLoad) summary'); await p.click('#czLoad'); await p.waitForTimeout(300);
  ok(!/^Passed/.test(await p.innerText('#czState')) && /does not count/.test(await p.innerText('#czState')) && !((await save()).circ.mux || {}).pass, 'a loaded solution works but does not count as a pass');
  await p.click('#czClear'); await p.waitForTimeout(200); ok((await p.$$('#czParts select')).length === 0, 'Clear the board empties it');
  await go('#/uni/circuit/toggle', '#czBoard'); await p.click('[data-add="XOR"]'); await p.click('[data-add="FF"]');
  await p.selectOption('#czA0', 'FF1'); await p.selectOption('#czB0', 'T'); await p.selectOption('#czF0', 'G1'); await p.selectOption('#czOQ', 'FF1'); await p.waitForTimeout(500);
  ok(/Passed/.test(await p.innerText('#czState')), 'toggle flip-flop built in the interface passes its 12-tick sequence');
  await p.click('#czBoard [data-in="T"]'); await p.click('#czTick'); ok(/stores 1/.test(await p.textContent('#czBoard')), 'Clock tick stores the D input in the flip-flop');
  await p.evaluate(() => { window.LearnUniversity.api.state().uni.circ.eq = { c: { g: [{ id: 'G1', t: 'XOR', i: ['"><img src=x onerror=window.__pwn=1>', 'A1'] }, { id: 'G2', t: 'EVIL', i: ['A0', 'B0'] }], f: 7, o: 'zz' } }; }); // as if restored from an edited backup
  await go('#/uni/circuit/eq', '#czBoard'); ok(await p.evaluate(() => window.__pwn === undefined && !document.querySelector('#czParts img')) && (await p.$$('#czParts li b')).length === 1, 'a tampered saved circuit is cleaned (bad gate dropped, bad input emptied) and cannot inject HTML');
  await go('#/uni/circuit/sandbox', '#czBoard'); ok(await p.$('#czChecks') === null && /never graded/.test(await p.innerText('#czState')), 'sandbox has no checklist and is never graded');
  await go('#/uni/circuit', '.u-list a'); ok(/2 of 13 tasks passed/.test(await p.innerText('.uc-meta')), 'overview counts passed tasks');

  /* 3. hacking range: locked until the rules of engagement are passed */
  await go('#/uni/range', '.u-list a'); ok(/written permission/.test(await p.innerText('.hr-warn')), 'range overview warns that real testing needs written permission');
  await go('#/uni/range/sqli', '.u-crumbs'); ok(await p.$('.u-lockmsg') !== null && await p.$('#hrHost') === null, 'challenges are locked before Rules of engagement');
  await go('#/uni/range/scope', '#hrScope');
  const KEY = [1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
  await p.click('#hrScope li[data-i="1"] [data-a="1"]'); ok(/Not quite/.test(await p.innerText('#hrScope li[data-i="1"]')), 'a wrong scope answer is explained');
  for (let i = 0; i < KEY.length; i++) await p.click('#hrScope li[data-i="' + i + '"] [data-a="' + KEY[i] + '"]');
  ok(!(((await save()).range || {}).scope || {}).pass, 'all answers right but no promise ticked: not complete yet');
  await p.check('#hrPromise'); await p.waitForTimeout(200); ok(((await save()).range || {}).scope && (await save()).range.scope.pass, 'Rules of engagement completes with all answers right and the promise');

  const flag = async (v) => { await p.fill('#hrFlagIn', v); await p.click('#hrFlag button'); await p.waitForTimeout(150); return p.innerText('#hrFlagRes'); };
  const done = async (id) => ((await save()).range[id] || {}).pass === true;
  // recon
  await go('#/uni/range/recon', '#hrPage'); ok(/Northwind Bakery/.test(await p.innerText('#hrPage')), 'fake shop home page loads');
  await p.fill('#hrUrl', '/robots.txt'); await p.click('.hr-url button'); ok(/Disallow: \/staff-notes\//.test(await p.innerText('#hrPage')), 'robots.txt shows the hidden folder');
  await p.fill('#hrUrl', '/staff-notes'); await p.click('.hr-url button'); ok(/Index of/.test(await p.innerText('#hrPage')), 'folder redirects to a directory listing');
  await p.click('#hrPage [data-go="/staff-notes/todo.txt"]'); const rf = (await p.innerText('#hrPage')).match(/FLAG\{[^}]+\}/);
  ok(/That is not it/.test(await flag('FLAG{wrong}')) && !(await done('recon')), 'a wrong flag is rejected');
  await flag(rf ? rf[0] : 'x'); ok(await done('recon') && await p.evaluate(() => document.getElementById('hrFixBox').open), 'recon: flag accepted and the fix is shown');
  await p.fill('#hrUrl', '/<img src=x onerror=window.__pwn=2>'); await p.click('.hr-url button'); ok(await p.evaluate(() => window.__pwn === undefined && !document.querySelector('#hrPage img')), 'the fake browser escapes the address in its 404 page');
  // scan
  await go('#/uni/range/scan', '#hrIn'); const cmd = async (c) => { await p.fill('#hrIn', c); await p.press('#hrIn', 'Enter'); await p.waitForTimeout(60); return p.innerText('#hrOut'); };
  ok(/skipped 10\.10\.0\.1/.test(await cmd('scan 10.10.0.0/24')), 'range sweep skips the out-of-scope router');
  ok(/Refused: 8\.8\.8\.8/.test(await cmd('scan 8.8.8.8')) && /Refused: 10\.10\.0\.1/.test(await cmd('scan 10.10.0.1')), 'out-of-scope scans are refused');
  ok(/anonymous login allowed/.test(await cmd('scan 10.10.0.7')), 'single-host scan shows service versions');
  await cmd('ftp 10.10.0.7'); await cmd('anonymous'); const fo = await cmd('get backup-notes.txt'); const sf = fo.match(/FLAG\{anonymous[^}]+\}/);
  await flag(sf ? sf[0] : 'x'); ok(await done('scan'), 'scan: anonymous FTP flag accepted');
  // hash
  await go('#/uni/range/hash', '#hrRun'); await p.click('#hrRun'); await p.waitForSelector('#hrRunOut li');
  const hres = await p.innerText('#hrRunOut'); ok(/admin: bakery2024/.test(hres) && /sam: sunshine/.test(hres) && /alex: sunshine/.test(hres) && !/priya/.test(hres), 'dictionary attack cracks the three weak passwords and not the strong one');
  await p.fill('#hrGuess', 'letmein'); await p.click('#hrHashF button'); await p.waitForTimeout(150); ok(/Match: jordan/.test(await p.innerText('#hrHashOut')), 'hashing a guess finds the matching account');
  await flag('bakery2024'); ok(await done('hash'), 'hash: admin password accepted');
  // sqli
  await go('#/uni/range/sqli', '#hrLogin'); const login = async (u, pw) => { await p.fill('#hrU', u); await p.fill('#hrP', pw); await p.click('#hrLogin button'); await p.waitForTimeout(80); return p.innerText('#hrRes'); };
  ok(/Wrong user name or password/.test(await login('admin', 'guess')), 'a normal wrong login fails');
  ok(/Database error: unrecognized token/.test(await login("'", 'x')), 'a single quote produces a database error');
  ok(/administrator/.test(await login("admin' --", 'x')), "admin' -- bypasses the password check");
  ok(/administrator/.test(await login("' OR 1=1 --", 'x')), "' OR 1=1 -- signs in as the first user (admin)");
  ok(/Wrong user name/.test(await login("' OR '1'='1", 'x')), "' OR '1'='1 in the user name alone fails, as in a real database (AND binds tighter)");
  await login("admin' --", 'x'); const sqf = (await p.innerText('#hrRes')).match(/FLAG\{[^}]+\}/); await flag(sqf ? sqf[0] : 'x'); ok(await done('sqli'), 'sqli: flag accepted');
  // union
  await go('#/uni/range/union', '#hrS'); const search = async (q) => { await p.fill('#hrSq', q); await p.click('#hrS button'); await p.waitForTimeout(80); return p.innerText('#hrRes'); };
  const sb = await search('bread'); ok(/Rye bread/.test(sb) && !/Croissant/.test(sb), 'normal search works');
  ok(/same number of result columns/.test(await search("' UNION SELECT 1 --")), 'UNION with the wrong column count gives the real SQLite error');
  ok(/api_key/.test(await search("' UNION SELECT name, sql FROM sqlite_master --")), 'sqlite_master reveals the users table columns');
  const uf = (await search("' UNION SELECT name, api_key FROM users --")).match(/FLAG\{[^}]+\}/); await flag(uf ? uf[0] : 'x'); ok(await done('union'), 'union: flag accepted');
  // xss
  await go('#/uni/range/xss', '#hrPost'); ok(await p.getAttribute('#hrFrame', 'sandbox') === 'allow-scripts', 'guestbook frame is sandboxed without same-origin access');
  await p.evaluate(() => window.postMessage({ hr: 'xss', t: 'guess' }, '*')); await p.waitForTimeout(150); ok(!(await done('xss')), 'a forged message from the page itself does not complete the challenge');
  await p.fill('#hrM', '<b>hello</b>'); await p.click('#hrPost button'); await p.waitForTimeout(300); ok(!(await done('xss')), 'harmless HTML does not complete it');
  await p.fill('#hrM', '<img src=x onerror="try{parent.document.title=\'pwned\';parent.localStorage.clear()}catch(e){proof()}">'); await p.click('#hrPost button');
  await p.waitForFunction(() => /captured/.test(document.getElementById('hrFlagRes').innerText), null, { timeout: 5000 }).catch(() => {});
  ok(await done('xss'), 'xss: onerror payload runs proof() and completes the challenge');
  ok((await p.title()) !== 'pwned' && (await save()).range, 'the injected code could not touch the Learn page or its saved progress');
  await p.click('#hrFix'); await p.waitForTimeout(400); ok(/fixed/.test(await p.innerText('#hrVer')) && /&lt;img|<img src=x/.test(await p.frameLocator('#hrFrame').locator('body').innerText()), 'the fixed version shows the payload as text');
  // idor
  await go('#/uni/range/idor', '#hrApi'); const api = async (path) => { await p.fill('#hrPath', path); await p.click('#hrApi button'); await p.waitForTimeout(60); return p.innerText('#hrBody'); };
  ok(/Sam Lee/.test(await api('/api/invoices/5031')), 'own invoice is returned'); ok(/Ada|Leo|Mia|Omar|Zoe|Noah|Ella|Ravi/.test(await api('/api/invoices/5030')), 'another customer\'s invoice is returned (the bug)');
  await p.uncheck('#hrTok'); ok(/sign in required/.test(await api('/api/invoices/5001')), 'without the session the API answers 401'); await p.check('#hrTok');
  const idf = (await api('/api/invoices/5001')).match(/FLAG\{[^}]+\}/); await flag(idf ? idf[0] : 'x'); ok(await done('idor'), 'idor: flag accepted');
  // cookie
  await go('#/uni/range/cookie', '#hrCk'); await p.fill('#hrUrl', '/admin'); await p.click('.hr-url button'); ok(/403|Admins only/.test(await p.innerText('#hrPage')), '/admin is forbidden for the student role');
  await p.fill('#hrB64', await p.inputValue('#hrCv')); await p.click('#hrDec'); ok((await p.inputValue('#hrB64')).includes('"role":"student"'), 'Base64 tool decodes the cookie');
  await p.fill('#hrB64', '{"user":"sam","role":"admin"}'); await p.click('#hrEnc'); await p.fill('#hrCv', await p.inputValue('#hrB64')); await p.click('#hrCk button'); await p.waitForTimeout(150);
  const cf = (await p.innerText('#hrPage')).match(/FLAG\{[^}]+\}/); await flag(cf ? cf[0] : 'x'); ok(await done('cookie'), 'cookie: tampered role reaches /admin and the flag is accepted');
  await p.fill('#hrCv', 'not-base64!!'); await p.click('#hrCk button'); ok(/Session invalid/.test(await p.innerText('#hrPage')), 'a broken cookie gives a clear message');
  // cmdi
  await go('#/uni/range/cmdi', '#hrPing'); const ping = async (h) => { await p.fill('#hrPingHost', h); await p.click('#hrPing button'); await p.waitForTimeout(60); return p.innerText('#hrOut2'); };
  ok(/1 received/.test(await ping('10.10.0.5')), 'normal ping output'); ok(/www-data/.test(await ping('10.10.0.5; whoami')), '; runs a second command');
  ok(/www-data/.test(await ping('10.10.0.5 && whoami')) && !/www-data/.test(await ping('nosuchhost && whoami')), '&& runs the next command only after a success');
  ok(/www-data/.test(await ping('nosuchhost || whoami')), '|| runs after a failure');
  ok(/Permission denied/.test(await ping('x; cat /home/admin/secret')), 'files outside www-data\'s rights are denied');
  const cmf = (await ping('10.10.0.5; cat /var/www/flag.txt')).match(/FLAG\{[^}]+\}/); await flag(cmf ? cmf[0] : 'x'); ok(await done('cmdi'), 'cmdi: flag accepted');
  await go('#/uni/range', '.u-list a'); ok(/10 of 10 challenges complete/.test(await p.innerText('.uc-meta')), 'overview shows all 10 challenges complete');

  /* 4. courses, links and labs hub */
  await p.evaluate(() => { const ex = window.LearnUniversity.api.state().uni.exams; ['ce101', 'c105', 'c107'].forEach((id) => { ex[id] = [{ at: '2026-11-19', score: 90, pass: true }]; }); window.LearnUniversity.api.state().uni.lessons['ce104:0'] = '2026-11-19'; }); // prerequisites and the first lesson done
  await go('#/uni/labs', '.u-labgrid'); ok(await p.$('.u-labgrid a[href="#/uni/circuit"]') !== null && await p.$('.u-labgrid a[href="#/uni/range"]') !== null, 'labs hub links to both simulators');
  await go('#/uni/course/ce104/lesson/1', 'a[href="#/uni/circuit/mux"]'); ok(await p.$('a[href="#/uni/circuit/mux"]') !== null, 'lessons link straight to simulator tasks');
  await go('#/uni/course/sec101/lesson/0', 'a[href="#/uni/range/scope"]'); ok(await p.$('a[href="#/uni/range/scope"]') !== null, 'SEC 101 links to Rules of engagement');
  await go('#/uni/departments/sec', '.u-crumbs'); const dt = await p.innerText('#app'); ok(/SEC 101/.test(dt) && /SEC 102/.test(dt), 'Cybersecurity department lists SEC 101 and SEC 102');
  await go('#/uni/departments/ce', '.u-crumbs'); ok(/CEN 104/.test(await p.innerText('#app')), 'Computer Engineering department lists CEN 104');

  /* 5. phone width */
  await p.setViewportSize({ width: 390, height: 800 });
  for (const h of ['#/uni/circuit/full', '#/uni/circuit/count', '#/uni/range/scope', '#/uni/range/recon', '#/uni/range/xss', '#/uni/range/cookie', '#/uni/range/hash']) { await go(h); await p.waitForTimeout(300); const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(o <= 2, 'no horizontal page scroll at phone width on ' + h + ' (' + o + 'px)'); }

  ok(outside.length === 0, 'the simulators and range sent no request outside this site (apart from its usual fonts and analytics): ' + outside.slice(0, 3).join(' '));
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  console.log(fail + ' failed of ' + (pass + fail)); await b.close(); process.exit(fail ? 1 : 0);
})();
