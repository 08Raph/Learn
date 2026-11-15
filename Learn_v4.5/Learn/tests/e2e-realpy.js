/* Real Python (Pyodide) integration, 4.2.   node tests/e2e-realpy.js
   IMPORTANT: the real Pyodide could not be downloaded in the build environment (the CDN and package registries
   are blocked). Part A uses a MOCKED Pyodide served in place of the CDN file: it tests Learn's own code (the
   worker, messages, output, input(), error tidying, the 10-second stop and restart, the engine switch, and that
   grading never uses it). It proves nothing about Pyodide itself. Part B blocks the CDN to test the real
   failure path. Run the live check in docs/TESTING.md on a device with internet access. */
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'), path = require('path');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8777, BASE = 'http://localhost:' + PORT + '/Learn/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (!u.startsWith('/Learn/')) { r.writeHead(404); return r.end(); } u = u.slice(7) || 'index.html'; const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let pass = 0, fail = 0; const ok = (m, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m + (x ? ' [' + String(x).slice(0, 240) + ']' : '')); } };
const FAKE = `self.loadPyodide = async (o) => { if (!/pyodide\\/v0\\.26\\.4\\/full\\/$/.test(o.indexURL)) throw new Error('bad indexURL ' + o.indexURL); let out = () => {}, inp = () => undefined;
  return { version: '0.26.4-MOCK', globals: { get: () => () => ({ destroy() {} }) }, setStdout(x) { out = x.batched; }, setStderr() {}, setStdin(x) { inp = x.stdin; },
    async runPythonAsync(code, opt) { if (!opt || !opt.globals) throw new Error('no fresh namespace'); if (/while True/.test(code)) { for (;;) {} }
      if (/raise/.test(code)) throw new Error('Traceback (most recent call last):\\n  File "/lib/python3.12/site-packages/_pyodide/_base.py", line 596, in eval_code_async\\n  File "<exec>", line 2, in <module>\\nValueError: boom');
      for (const l of code.split('\\n')) { const m = /^print\\((.*)\\)$/.exec(l.trim()); if (m) { const v = m[1] === 'input()' ? inp() : JSON.parse(m[1]); if (v === undefined) throw new Error('Traceback (most recent call last):\\n  File "<exec>", line 1, in <module>\\nEOFError: EOF when reading a line'); out(String(v)); } } } }; };`;
let cdnHits = 0;
(async () => {
  await new Promise((k) => srv.listen(PORT, k)); const b = await chromium.launch(); const errs = [];
  const mk = async (mode) => { const ctx = await b.newContext({ serviceWorkers: 'block' }); await ctx.route('**/*', (r) => { const u = r.request().url();
      if (u.startsWith('http://localhost:' + PORT)) return r.continue();
      if (u === 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js' && mode === 'mock') { cdnHits++; return r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE }); }
      return r.abort(); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept()); return { ctx, p }; };
  try {
    /* Part A: mocked Pyodide */
    const { ctx, p } = await mk('mock');
    await p.goto(BASE + '#/uni/labs/py'); await p.waitForSelector('[data-eng]', { timeout: 20000 });
    ok('open Python lab offers the engine switch, defaulting to the teaching engine', (await p.inputValue('[data-eng]')) === 'teach');
    ok('no CDN request until real Python is chosen', cdnHits === 0);
    await p.selectOption('[data-eng]', 'real'); await p.waitForFunction(() => /is ready/.test((document.querySelector('.u-engnote') || {}).textContent || ''), null, { timeout: 15000 });
    ok('choosing real Python loads it from the pinned CDN path and says so', cdnHits === 1 && /0\.26\.4-MOCK/.test(await p.innerText('.u-engnote')));
    ok('the input box appears for input()', await p.isVisible('.u-stdin textarea'));
    const runCode = async (code, stdin) => { await p.evaluate((c) => { const ta = document.querySelector('.u-ed textarea'); ta.value = c; ta.dispatchEvent(new Event('input', { bubbles: true })); }, code); if (stdin !== undefined) await p.fill('.u-stdin textarea', stdin); await p.click('[data-a="run"]'); await p.waitForFunction(() => !/Running real Python|Loading real Python/.test(document.querySelector('.out').innerText), null, { timeout: 20000 }); return p.innerText('.out'); };
    let o = await runCode('print("hello")\nprint(42)'); ok('output from real Python is shown', /hello/.test(o) && /42/.test(o), o);
    o = await runCode('print(input())\nprint(input())', 'Ada\nLovelace'); ok('input() receives the lines typed in the input box', /Ada/.test(o) && /Lovelace/.test(o), o);
    o = await runCode('print(input())', ''); ok('input() with no input gives EOFError, not a hang', /EOFError/.test(o), o);
    o = await runCode('x = 1\nraise ValueError("boom")'); ok('Python errors are shown with Pyodide-internal lines removed', /ValueError: boom/.test(o) && /File "<exec>", line 2/.test(o) && !/_pyodide/.test(o), o);
    const t0 = Date.now(); o = await runCode('while True:\n    pass'); const took = Date.now() - t0;
    ok('an endless loop is stopped after about 10 seconds and the page stays responsive', /Stopped after 10 seconds/.test(o) && took < 16000 && await p.evaluate(() => 1 + 1) === 2, took + 'ms ' + o);
    o = await runCode('print("again")'); ok('Python restarts automatically after a stop', /again/.test(o) && cdnHits === 2, o + ' hits=' + cdnHits);
    ok('the choice is remembered', await p.evaluate(() => window.LearnUniversity.st().pyEngine === 'real'));
    await p.reload(); await p.waitForSelector('[data-eng]'); ok('after reload the lab still shows real Python selected', (await p.inputValue('[data-eng]')) === 'real');
    await p.evaluate(() => { location.hash = '#/uni/career/interview/iv-reverse-words'; }); await p.waitForTimeout(2000);
    ok('graded assignments do not offer real Python (grading stays on the tested engine)', await p.locator('[data-eng]').count() === 0 && await p.locator('[data-a="submit"]').count() >= 1);
    /* main Playground (4.3) */
    await p.goto(BASE + '#/play/py'); await p.waitForSelector('#pyEng', { timeout: 15000 });
    ok('Playground offers the engine switch for Python', await p.locator('#pyEng option').count() === 2);
    await p.selectOption('#pyEng', 'real'); await p.waitForFunction(() => /is ready/.test(document.querySelector('#pyEngNote').textContent), null, { timeout: 15000 });
    await p.evaluate(() => { const ta = document.querySelector('#edhost textarea'); ta.value = 'print("from the playground")'; ta.dispatchEvent(new Event('input', { bubbles: true })); }); await p.click('#runBtn');
    await p.waitForFunction(() => /from the playground/.test(document.querySelector('.out').innerText), null, { timeout: 15000 }).catch(() => {});
    ok('Playground runs code on real Python when chosen', /from the playground/.test(await p.innerText('.out')));
    await p.goto(BASE + '#/play/js'); await p.waitForTimeout(600); ok('the switch appears only for Python', await p.locator('#pyEng').count() === 0);
    await ctx.close();
    /* Part B: CDN unreachable (the real failure path) */
    const B = await mk('blocked'); await B.p.goto(BASE + '#/uni/labs/py'); await B.p.waitForSelector('[data-eng]');
    await B.p.selectOption('[data-eng]', 'real'); await B.p.waitForFunction(() => /could not be downloaded/.test((document.querySelector('.u-engnote') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
    ok('CDN blocked: a clear message and the switch returns to the teaching engine', /could not be downloaded/.test(await B.p.innerText('.u-engnote')) && (await B.p.inputValue('[data-eng]')) === 'teach', await B.p.innerText('.u-engnote'));
    await B.p.evaluate(() => { const ta = document.querySelector('.u-ed textarea'); ta.value = 'print("still works")'; ta.dispatchEvent(new Event('input', { bubbles: true })); }); await B.p.click('[data-a="run"]'); await B.p.waitForTimeout(800);
    ok('CDN blocked: code still runs on the teaching engine', /still works/.test(await B.p.innerText('.out')));
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); ok('service worker keeps Pyodide in its own cache that survives app updates', /learn-pyodide-0\.26\.4/.test(sw) && /k !== VER && k !== PYO/.test(sw));
    ok('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) { ok('test run crashed', false, e.stack); }
  console.log(fail + ' failed of ' + (pass + fail) + ' (Part A uses a MOCKED Pyodide; Part B blocks the CDN; real Pyodide NOT tested here)'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
