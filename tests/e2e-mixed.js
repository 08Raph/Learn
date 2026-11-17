/* 4.5: old and new University files mixed together (a half-finished upload, or an old copy kept by the browser).
   The app must notice, repair itself once by clearing its offline copies, and otherwise say exactly which file is old.
   node tests/e2e-mixed.js   (own local server; old files are taken from tests/fixtures/, all external hosts blocked) */
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'), path = require('path');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8781, BASE = 'http://localhost:' + PORT + '/Learn/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };
let swap = {}, swNext = false; const UV = (fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const UNI_VER = '([^']+)'/) || [])[1]; // served path -> fixture file, changed per scenario
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (!u.startsWith('/Learn/')) { r.writeHead(404); return r.end(); } u = u.slice(7) || 'index.html';
  if (u === 'sw.js' && swNext) { r.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' }); return r.end(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').replace(/const VER = '[^']+'/, "const VER = 'learn-test-next'")); }
  const f = swap[u] ? path.join(ROOT, 'tests', 'fixtures', swap[u]) : path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(r); });
let pass = 0, fail = 0; const ok = (m, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m + (x ? ' [' + String(x).slice(0, 240) + ']' : '')); } };
const text = (p) => p.evaluate(() => document.body.innerText);
async function page(b) { const ctx = await b.newContext({ serviceWorkers: 'block' }); await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); return { ctx, p, errs }; }
(async () => {
  await new Promise((ok) => srv.listen(PORT, ok)); const b = await chromium.launch();
  /* 1. everything current: My study opens normally */
  { swap = {}; const { ctx, p, errs } = await page(b); await p.goto(BASE + '#/uni/study'); await p.waitForTimeout(2500);
    const t = await text(p); ok('current files: My study opens', !/not available|finish updating/.test(t) && /study/i.test(t), t.slice(0, 200)); ok('current files: no page errors', errs.length === 0, errs.join(' | ')); await ctx.close(); }
  /* 2. old university.js (4.0) with new everything else: the exact situation reported on 13 Nov 2026 */
  { swap = { 'uni/university.js': 'university-4.0.js' }; const { ctx, p } = await page(b); let reloads = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) reloads++; });
    await p.goto(BASE + '#/uni/study'); await p.waitForTimeout(3500); const t = await text(p);
    ok('old university.js: the app repairs itself once (one automatic reload)', reloads === 2, 'navigations ' + reloads);
    ok('old university.js: after the repair it names the old file instead of "srsCounts is not a function"', /finish updating/.test(t) && /uni\/university\.js/.test(t) && !/srsCounts/.test(t), t.slice(0, 300));
    ok('old university.js: an Update now button is offered', await p.locator('#uniRepair').count() === 1);
    ok('old university.js: the repair does not loop (still on the page after 3 s)', reloads === 2);
    swap = {}; await p.click('#uniRepair'); await p.waitForTimeout(3000); const t2 = await text(p);
    ok('after the site is fixed, Update now loads the University', !/finish updating|not available/.test(t2) && /Software Engineering University/.test(t2), t2.slice(0, 200)); await ctx.close(); }
  /* 3. new university.js with an old module (4.3 uni-campus.js without a version stamp) */
  { swap = { 'uni/uni-campus.js': 'uni-campus-4.3.js' }; const { ctx, p } = await page(b); let reloads = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) reloads++; });
    await p.goto(BASE + '#/uni/study'); await p.waitForTimeout(3500); const t = await text(p);
    ok('old module: repaired once automatically, then the old file is named', reloads === 2 && /finish updating/.test(t) && /uni\/uni-campus\.js/.test(t), reloads + ' ' + t.slice(0, 300));
    ok('old module: the rest of the University still works (Courses opens)', await (async () => { await p.goto(BASE + '#/uni/courses'); await p.waitForTimeout(1500); return /Stage 1/.test(await text(p)); })());
    await ctx.close(); }
  /* 4. a version stamp on every lazily loaded module matches university.js */
  { const B = (fs.readFileSync(path.join(ROOT, 'uni', 'university.js'), 'utf8').match(/const BUILD = '([^']+)'/) || [])[1]; const I = (fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const UNI_VER = '([^']+)'/) || [])[1];
    ok('BUILD in university.js equals UNI_VER in index.html', B && B === I, B + ' vs ' + I);
    /* every file the University loads with loadMod() must carry a stamp, or loading it would always fail */
    const allSrc = fs.readdirSync(path.join(ROOT, 'uni')).filter((f) => /\.js$/.test(f)).map((f) => fs.readFileSync(path.join(ROOT, 'uni', f), 'utf8')).join('\n');
    const loaded = [...new Set([...allSrc.matchAll(/(?:loadMod|viaMod)\('([\w-]+)'/g)].map((m) => m[1]))];
    ok('every module loaded with loadMod is in the stamp check (' + loaded.length + ')', loaded.length >= 6, loaded.join(' '));
    loaded.forEach((m) => ok('version stamp in ' + m + '.js matches', new RegExp("\\['" + m + "'\\] = '" + B + "'").test(fs.readFileSync(path.join(ROOT, 'uni', m + '.js'), 'utf8')))); }
  /* 5. service worker: an old offline copy of a file is never served for a request that names a newer version */
  { const ctx = await b.newContext(); await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort()); const p = await ctx.newPage();
    swap = { 'uni/university.js': 'university-4.0.js' }; await p.goto(BASE); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500);
    const cached = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find((k) => /^learn-v/.test(k))); const r = await c.match('uni/university.js'); return r ? (await r.text()).includes('const BUILD') : null; });
    ok('service worker: the offline copy saved at install is the old file (test set-up)', cached === false, String(cached));
    swap = {}; await p.reload(); await p.waitForTimeout(800); const ctl = await p.evaluate(() => !!navigator.serviceWorker.controller);
    let nav = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) nav++; });
    await p.goto(BASE + '#/uni/study'); await p.waitForTimeout(3000); const t = await text(p);
    ok('service worker: no repair reload was needed (the old copy was never used)', nav === 1, 'navigations ' + nav);
    ok('service worker: the page is controlled by the service worker', ctl);
    ok('service worker: the versioned request gets the current file, so My study opens', !/finish updating|not available/.test(t) && await p.evaluate((uv) => window.LearnUniversity && window.LearnUniversity.build === uv, UV), t.slice(0, 200));
    swap = {}; await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(2500);
    ok('service worker: offline, the University still opens from the saved copies', await p.evaluate(() => !!(window.LearnUniversity && window.LearnUniversity.ready)));
    await ctx.close(); }
  /* 6. a new version arriving while the page is open: a "new version is ready" bar, no forced reload */
  { const ctx = await b.newContext(); await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort()); const p = await ctx.newPage(); swap = {}; swNext = false;
    await p.goto(BASE); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(800);
    ok('update bar: not shown when nothing changed', await p.locator('#updBar').count() === 0);
    let nav = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) nav++; });
    swNext = true; await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }); await p.waitForTimeout(2500);
    ok('update bar: shown when a new version takes over', await p.locator('#updBar').count() === 1);
    ok('update bar: the page is not reloaded without asking', nav === 0, 'navigations ' + nav);
    await p.click('#updGo'); await p.waitForTimeout(1500); ok('update bar: Reload now reloads the page', nav === 1 && await p.locator('#updBar').count() === 0, 'navigations ' + nav);
    swNext = false; await ctx.close(); }
  /* 7. 5.2: "Save everything for offline use" really makes the University, practice questions and challenges work offline */
  { const ctx = await b.newContext(); await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort()); const p = await ctx.newPage(); swap = {}; swNext = false;
    await p.goto(BASE); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(800);
    await p.goto(BASE + '#/stats'); await p.waitForSelector('#offBtn'); await p.click('#offBtn');
    await p.waitForFunction(() => /Everything is saved|Saved \d+ of/.test((document.querySelector('#offMsg') || {}).textContent || ''), null, { timeout: 60000 });
    const msg = await p.innerText('#offMsg'); ok('offline save: every file is saved', /Everything is saved/.test(msg), msg);
    await ctx.setOffline(true);
    await p.goto(BASE + '#/uni/course/c510'); await p.reload(); await p.waitForTimeout(3000);
    ok('offline save: a University course never opened before opens offline', /Lesson|lesson/.test(await text(p)) && !/not available|could not/i.test(await text(p)), (await text(p)).slice(0, 200));
    await p.goto(BASE + '#/challenges'); await p.waitForTimeout(1500); ok('offline save: the challenges open offline', await p.locator('.chcard').count() === 24);
    await p.goto(BASE + '#/practice'); await p.waitForSelector('#prGo'); await p.click('#prGo'); await p.waitForTimeout(1500); ok('offline save: a practice drill starts offline', await p.locator('.quizcard').count() === 1);
    await ctx.close(); }
  await b.close(); srv.close(); console.log((fail ? fail + ' FAILED, ' : '0 failed of ') + (pass + fail) + ' (local server; old files from tests/fixtures; service worker blocked except in parts 5, 6 and 7)'); process.exit(fail ? 1 : 0);
})();
