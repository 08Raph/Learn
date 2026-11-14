/* App-shell tests for 4.4: on-demand ranked bank, version, legacy-mode honesty, accessibility basics,
   escaping, and that no secret is shipped.   node tests/e2e-app.js   (starts its own local server; Firebase blocked) */
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'), path = require('path');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8773, BASE = 'http://localhost:' + PORT + '/Learn/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (!u.startsWith('/Learn/')) { r.writeHead(404); return r.end(); } u = u.slice(7) || 'index.html'; const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let pass = 0, fail = 0; const ok = (m, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m + (x ? ' [' + String(x).slice(0, 200) + ']' : '')); } };
(async () => {
  await new Promise((k) => srv.listen(PORT, k));
  const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const reqs = []; let blockBank = false; let ext = 0;
  await ctx.route('**/*', (r) => { const u = r.request().url(); reqs.push(u); if (!u.startsWith('http://localhost:' + PORT)) { ext++; return r.abort(); } if (blockBank && u.includes('ranked_extra.json')) return r.abort(); r.continue(); });
  const text = () => p.evaluate(() => document.querySelector('#app').innerText);
  try {
    // static checks on the shipped files
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    ok('index.html is under 2 MB (' + Math.round(html.length / 1024) + ' KB)', html.length < 2 * 1024 * 1024);
    ok('ranked bank is not inlined', !/RANKED_EXTRA_QUESTIONS\s*=\s*\{/.test(html));
    ok('FB_API_KEY ships empty (legacy mode until the owner configures it)', /const FB_API_KEY = '';/.test(html));
    const all = []; const walk = (d) => fs.readdirSync(d).forEach((n) => { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) walk(f); else if (/\.(js|html|json|md|txt|css)$/.test(n) && fs.statSync(f).size < 3e6) all.push(f); }); walk(ROOT);
    const secret = all.filter((f) => /-----BEGIN (RSA |EC )?PRIVATE KEY|"private_key"\s*:|AIza[0-9A-Za-z_-]{35}|sk-ant-[A-Za-z0-9]|sk-[A-Za-z0-9]{40,}/.test(fs.readFileSync(f, 'utf8')));
    ok('no private key, service account or API key in any shipped text file', secret.length === 0, secret.join(','));
    ok('.nojekyll present', fs.existsSync(path.join(ROOT, '.nojekyll')));
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase', 'database.rules.json'), 'utf8')); ok('rules file: root is closed by default', rules.rules['.read'] === false && rules.rules['.write'] === false);
    const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'ranked_extra.json'), 'utf8')); const nq = Object.values(bank).reduce((n, a) => n + a.length, 0);
    const shown = (c) => c;
    const dups = Object.keys(bank).reduce((n, k) => { const seen = new Set(); bank[k].forEach((q) => { const key = shown(q.code) + '|' + q.options.slice().sort().join('|'); if (seen.has(key)) n++; seen.add(key); }); return n; }, 0);
    ok('ranked_extra.json: 15 languages, ' + nq + ' questions, no duplicates as shown to players', Object.keys(bank).length === 15 && nq >= 5600 && dups === 0, 'duplicates: ' + dups);
    ok('Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash each have at least 100 questions', ['java','go','rust','php','ruby','swift','kotlin','bash'].every((k) => bank[k] && bank[k].length >= 100), ['java','go','rust','php','ruby','swift','kotlin','bash'].map((k) => k + ':' + (bank[k] || []).length).join(' '));
    ok('no concept question still carries unrelated filler code (like count = 2)', !Object.values(bank).some((a) => a.some((q) => { const ls = q.code.split('\n'); return /^\s*(\/\/|#|--)\s*Which .*\?\s*$/.test(ls[0]) && ls.length === 2 && /^\s*((int|let|val|var|const)\s+)?\$?\w+\s*:?=\s*\d+\s*;?\s*$/.test(ls[1]); })));
    ok('every bank question has 4 distinct options, a valid answer and an explanation', Object.values(bank).every((a) => a.every((q) => q.options.length === 4 && new Set(q.options).size === 4 && q.answer >= 0 && q.answer < 4 && q.why)));
    ok('no C or C++ question uses C#/Java array syntax, and no C question uses bool without its header', !bank.c.concat(bank.cpp).some((q) => /int\[\] \w+ = new/.test(q.code)) && !bank.c.some((q) => /\bbool\b/.test(q.code)));
    ok('comparison questions: the marked answer matches the comparison', bank.cpp.concat(bank.cs, bank.c).filter((q) => /result = (\d+) > (\d+)/.test(q.code)).every((q) => { const m = /result = (\d+) > (\d+)/.exec(q.code); const t = +m[1] > +m[2]; return [t ? 'true' : 'false', t ? '1' : '0'].includes(q.options[q.answer]); }));
    // home page
    await p.goto(BASE); await p.waitForSelector('#app .wrap, #app .card', { timeout: 15000 }); await p.waitForTimeout(600);
    ok('home page renders under /Learn/', (await text()).length > 200);
    ok('home page does not download the ranked bank', !reqs.some((u) => u.includes('ranked_extra.json') || u.includes('ranked_questions.json')));
    ok('html has lang and a title', await p.evaluate(() => document.documentElement.lang === 'en' && document.title.length > 3));
    ok('skip link exists and moves focus to the content', await p.evaluate(() => { const a = document.getElementById('skipLink'); a.click(); return document.activeElement && document.activeElement.id === 'app' && location.hash !== '#app'; }));
    await p.keyboard.press('Tab'); ok('keyboard focus lands on a visible control with an accessible name', await p.evaluate(() => { const e = document.activeElement; return !!e && e !== document.body && ((e.textContent || '').trim().length > 0 || e.getAttribute('aria-label') || e.title); }));
    const noName = await p.evaluate(() => Array.from(document.querySelectorAll('#app button, #app a[href]')).filter((e) => e.offsetParent && !(e.textContent || '').trim() && !e.getAttribute('aria-label') && !e.title).length); ok('every visible button and link on the home page has a name', noName === 0, noName);
    const noLabel = await p.evaluate(() => Array.from(document.querySelectorAll('#app input, #app select, #app textarea')).filter((e) => e.offsetParent && e.type !== 'hidden' && !e.getAttribute('aria-label') && !e.placeholder && !e.title && !(e.id && document.querySelector('label[for="' + e.id + '"]')) && !e.closest('label')).length); ok('every visible form field on the home page is labelled', noLabel === 0, noLabel);
    ok('version 4.4 is reported', await p.evaluate(() => /4\.4/.test(document.body.innerHTML)));
    // quiz loads the bank on demand
    const before = reqs.length; await p.evaluate(() => { location.hash = '#/quiz'; }); await p.waitForFunction(() => !/Loading the question bank/.test(document.querySelector('#app').innerText), null, { timeout: 30000 });
    ok('opening Quiz downloads the bank', reqs.slice(before).some((u) => u.includes('ranked_extra.json'))); ok('quiz page renders after loading', await p.locator('.quizcard .opt').count() >= 2 && !/could not be loaded/.test(await text()));
    ok('language badges use readable lettering (4.5:1)', await p.evaluate(() => { location.hash = '#/'; return true; }) && await (async () => { await p.waitForTimeout(500); return p.evaluate(() => Array.from(document.querySelectorAll('.badge')).every((b) => { const L = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }; const s = getComputedStyle(b); const x = L(s.color), y = L(s.backgroundColor); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) >= 4.5; })); })());
    ok('theme button uses an icon with an accessible name', await p.evaluate(() => { const t = document.getElementById('themeBtn'); return !!t.querySelector('svg') && !!t.getAttribute('aria-label'); }));
    await p.evaluate(() => { location.hash = '#/duel'; }); await p.waitForTimeout(1500); const duel = await text();
    ok('multiplayer page renders', /Practice vs computer|Multiplayer|Ranked/i.test(duel)); ok('bank is not downloaded twice', reqs.filter((u) => u.includes('ranked_extra.json')).length === 1);
    { const qs = []; for (let i = 0; i < 12; i++) { await p.goto(BASE + '#/quiz'); await p.reload(); await p.waitForSelector('.quizcard h3', { timeout: 30000 }); qs.push(await p.evaluate(() => ({ h: document.querySelector('.quizcard h3').innerText, code: (document.querySelector('.quizcard pre') || {}).innerText || '' }))); }
      ok('quiz headings are real questions; "what does this print?" only appears above code that prints', qs.every((q) => !/what does this print\?/i.test(q.h) || /print|console|cout|echo|puts|println|printf|Console\.Write|SELECT|fmt\./i.test(q.code)) && qs.every((q) => !/^\s*(\/\/|#|--)\s*(Which|What)/.test(q.code)), JSON.stringify(qs.slice(0, 3)));
      ok('quiz headings start with a capital letter', qs.every((q) => /^[A-Z][^:]*: [A-Z]/.test(q.h)), qs.map((q) => q.h).join(' | ')); }
    // failure path in a fresh page
    const p2 = await ctx.newPage(); blockBank = true; await p2.goto(BASE + '#/quiz'); await p2.waitForFunction(() => /could not be loaded/.test(document.querySelector('#app').innerText), null, { timeout: 20000 }).then(() => ok('offline with no saved bank: clear message', true)).catch(() => ok('offline with no saved bank: clear message', false));
    ok('retry button offered', await p2.locator('#rgRetry').count() === 1); blockBank = false; await p2.click('#rgRetry'); await p2.waitForFunction(() => !/question bank/.test(document.querySelector('#app').innerText), null, { timeout: 30000 }).then(() => ok('retry recovers when the network returns', true)).catch(() => ok('retry recovers when the network returns', false));
    await p2.evaluate(() => { location.hash = '#/'; }); await p2.waitForTimeout(400); await p2.evaluate(() => { location.hash = '#/py'; }); await p2.waitForTimeout(600); ok('lessons work without the bank', (await p2.evaluate(() => document.querySelector('#app').innerText)).length > 100); await p2.close();
    // University deep link under /Learn/
    const p3 = await ctx.newPage(); await p3.goto(BASE + '#/uni/course/ma102'); await p3.waitForFunction(() => /Linear Algebra for Computing/.test(document.querySelector('#app').innerText), null, { timeout: 20000 }).then(() => ok('deep link to a new elective works under /Learn/', true)).catch(() => ok('deep link to a new elective works under /Learn/', false));
    await p3.evaluate(() => { location.hash = '#/uni/course/c101/project'; }); await p3.waitForSelector('#upMs', { timeout: 15000 }).catch(() => {}); ok('project shows 5 milestones, objectives, guidance and completion criteria', await p3.locator('#upMs input').count() === 5 && /Objectives/.test(await p3.textContent('#app')) && /Submission guidance/.test(await p3.textContent('#app')) && /Completion criteria/.test(await p3.textContent('#app')));
    await p3.click('#upMs input >> nth=0'); await p3.click('#upDraft'); await p3.reload(); await p3.waitForSelector('#upMs'); ok('milestone progress is saved with the draft', await p3.locator('#upMs input >> nth=0').isChecked());
    await p3.evaluate(() => { location.hash = '#/uni/course/c101/lesson/0'; }); await p3.waitForSelector('section.u-check'); ok('University knowledge checks stack vertically (layout fix)', await p3.evaluate(() => getComputedStyle(document.querySelector('section.u-check')).display !== 'flex'));
    await p3.evaluate(() => { location.hash = '#/uni/stage/1'; }); await p3.waitForTimeout(500); ok('stage page explains testing out versus completing', /Testing out is not completing/.test(await p3.textContent('#app')));
    await p3.evaluate(() => { location.hash = '#/uni/departments/game'; }); await p3.waitForTimeout(700); ok('Game Development lists three dedicated courses', /GDV 101/.test(await p3.textContent('#app')) && /GDV 102/.test(await p3.textContent('#app')) && /GDV 103/.test(await p3.textContent('#app')));
    await p3.evaluate(() => { location.hash = '#/uni/professor'; }); await p3.waitForSelector('textarea, input[type=text]', { timeout: 15000 }); const box = p3.locator('#app textarea, #app input[type=text]').first(); await box.fill('how does quicksort work'); await box.press('Enter'); await p3.waitForTimeout(1500);
    if (!(await p3.locator('a[href="#/uni/visual/sort"]').count())) { const sb = p3.locator('#app button', { hasText: /send|ask/i }).first(); if (await sb.count()) { await sb.click(); await p3.waitForTimeout(1500); } }
    ok('professor points to the visualiser for a sorting question and is labelled as not an AI model', await p3.locator('a[href="#/uni/visual/sort"]').count() >= 1 && /not an AI model/i.test(await p3.textContent('#app')));
    await p3.close();
    ok('no request left the local server unblocked (' + ext + ' external requests were attempted and blocked)', true);
    ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) { ok('test run crashed', false, e.message); }
  console.log(fail + ' failed of ' + (pass + fail) + ' (local server; Firebase and all external hosts blocked)'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
