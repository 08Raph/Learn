/* 5.7: interface languages, the start guide and the progress card, in a real browser on a local server (external hosts blocked;
   the AI service is MOCKED). Proves: each language file loads, every interface string on the main screens that has a
   translation is shown translated, numbers survive, code and program output are never translated, Arabic is right to left,
   the first Python lessons are translated and still pass with the same code, the AI is asked to answer in the chosen language,
   switching back to English works. It does not prove the quality of the translations.   node tests/e2e-i18n.js */
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8786, BASE = 'http://localhost:' + PORT + '/index.html';
let pass = 0, fail = 0; const ok = (m, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m + (x ? ' [' + String(x).slice(0, 300) + ']' : '')); } };
const KEYS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'i18n-keys.json'), 'utf8'));
const EP = (fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const AI_ENDPOINT = '([^']+)'/) || [])[1];
const loadL = (c) => { const w = {}; try { require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'i18n', c + '.js'), 'utf8'), { window: w }); } catch (e) {} return w.LEARN_I18N || null; };
const LANGS = { es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN', hi: 'hi-IN', ar: 'ar-SA' };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch(); const errs = []; const aiBodies = [];
  const mk = async (locale, seed) => { const ctx = await b.newContext(Object.assign({}, devices['iPad (gen 7) landscape'], { serviceWorkers: 'block', locale }));
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => { if (EP && r.request().url().startsWith(EP)) { aiBodies.push(r.request().postData() || ''); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ reply: 'Respuesta de prueba' }) }); } return r.abort(); });
    if (seed) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('learn-code-v2', JSON.stringify(s)); } }, seed);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(locale + ': ' + e.message.slice(0, 160))); return { ctx, p }; };
  try {
    /* 1. files */
    for (const c of Object.keys(LANGS)) { const L = loadL(c);
      ok(c + ': language file exists and has every interface string and the first 10 Python lessons', !!L && L.code === c && KEYS.every((k) => typeof L.ui[k] === 'string' && L.ui[k]) && Object.keys(L.lessons).length === 10 && ['hero', 'footLocal', 'footAcct', 'install'].every((k) => L.html[k])); }
    ok('the language files are up to date with their sources (tests/build-i18n.js passes)', require('child_process').spawnSync('node', [path.join(ROOT, 'tests', 'build-i18n.js')], { env: Object.assign({}, process.env, { APP_DIR: ROOT, I18N_CHECK: '1' }) }).status === 0);

    /* 2. each language: picked from the browser, home and lesson translated, nothing left in English that has a translation */
    for (const [c, loc] of Object.entries(LANGS)) {
      const L = loadL(c); const still = (k) => L.ui[k] && L.ui[k] !== k;
      const { ctx, p } = await mk(loc, { seenPatch: '99', code: { 'py:hello': 'print("Hello, world!")\n' } });
      await p.goto(BASE + '#/'); await p.waitForFunction((code) => document.documentElement.lang.startsWith(code), c, { timeout: 15000 }); await p.waitForTimeout(800);
      ok(c + ': the browser language is used on a first visit, with the right text direction', await p.evaluate(() => document.documentElement.dir) === (c === 'ar' ? 'rtl' : 'ltr') && /🌐 /.test(await p.innerText('#langBtn')));
      const homeLeft = (await p.evaluate(() => window.__learnI18n.harvest(document.querySelector('#app')))).filter(still);
      ok(c + ': every home-page string that has a translation is shown translated', homeLeft.length === 0, homeLeft.slice(0, 6).join(' | '));
      ok(c + ': the big headline and the hero sentence are translated with their numbers', (await p.innerHTML('.hero h1')) === L.html.hero && (await p.innerText('.hero p')).includes('387'));
      await p.goto(BASE + '#/py/hello'); await p.waitForSelector('#runBtn'); await p.waitForTimeout(500);
      const lesLeft = (await p.evaluate(() => window.__learnI18n.harvest(document.querySelector('#app')))).filter(still);
      ok(c + ': the lesson screen is translated (title, explanation, task, buttons)', lesLeft.length === 0 && (await p.innerText('.learn h2')).includes(L.lessons['py:hello'].title), lesLeft.slice(0, 6).join(' | '));
      ok(c + ': code is never translated (example, editor, the text the task asks for)', /print\("Hello!"\)/.test(await p.innerText('.codeblock')) && /print\("Hello, world!"\)/.test(await p.evaluate(() => document.querySelector('#edhost').innerText)) && (await p.innerText('.task code')) === 'Hello, world!');
      await p.click('#runBtn'); await p.waitForSelector('.verdict', { timeout: 15000 });
      ok(c + ': the same correct code still passes, and the result is translated', await p.locator('.verdict.ok').count() === 1 && (await p.innerText('.verdict.ok strong')) === L.ui['✓ Nice work, that passes!'] && (await p.innerText('.out pre')).trim() === 'Hello, world!');
      if (c === 'ar') ok('ar: code inside Arabic sentences stays left to right', await p.evaluate(() => getComputedStyle(document.querySelector('.task code')).direction === 'ltr' && getComputedStyle(document.querySelector('.task code')).unicodeBidi === 'isolate'));
      ok(c + ': a translated lesson shows no "English only" note', await p.locator('.i18nnote').count() === 0);
      await p.goto(BASE + '#/js/hello'); await p.waitForSelector('#runBtn'); await p.waitForTimeout(400);
      ok(c + ': a lesson that is not translated yet says so in that language', (await p.innerText('.i18nnote')).includes(L.lessonNote.slice(0, 12)));
      if (c === 'es') { aiBodies.length = 0; await p.goto(BASE + '#/py/hello'); await p.waitForSelector('#aiBtn'); await p.click('#aiBtn'); await p.waitForSelector('#aiHelp .aiq'); await p.fill('#aiHelp .aiq', '¿por qué?'); await p.click('#aiHelp .aigo'); await p.waitForSelector('.aians', { timeout: 10000 });
        ok('es: the AI is asked to answer in Spanish (MOCKED AI service)', aiBodies.some((x) => /Español: answer in that language/.test(x))); }
      await p.goto(BASE + '#/start'); await p.waitForSelector('.gdopt'); ok(c + ': the start guide is translated', (await p.evaluate(() => window.__learnI18n.harvest(document.querySelector('#app')))).filter(still).length === 0);
      await ctx.close();
    }

    /* 3. switching back to English, and English stays English */
    { const { ctx, p } = await mk('es-ES', { seenPatch: '99' }); await p.goto(BASE + '#/'); await p.waitForFunction(() => document.documentElement.lang === 'es');
      await p.click('#langBtn'); await p.click('[data-lc="en"]'); await p.waitForTimeout(800);
      ok('switching to English from the 🌐 menu shows English again and remembers it', /From first line to pro/.test(await p.innerText('.hero h1')) && await p.evaluate(() => JSON.parse(localStorage.getItem('learn-code-v2')).uiLang === 'en'));
      await p.reload(); await p.waitForTimeout(1500); ok('after a reload it stays English', await p.evaluate(() => document.documentElement.lang === 'en') && /Choose a language/.test(await p.innerText('#app')));
      await ctx.close(); }
    { const { ctx, p } = await mk('en-US'); await p.goto(BASE + '#/'); await p.waitForTimeout(1500);
      ok('an English browser gets English and no language file is downloaded', await p.evaluate(() => !window.LEARN_I18N && document.documentElement.lang === 'en')); await ctx.close(); }

    /* 4. start guide */
    { const { ctx, p } = await mk('en-US', { seenPatch: '99' }); await p.goto(BASE + '#/'); await p.waitForSelector('#gdBanner');
      ok('start guide: a new visitor sees "New here? Find your starting point"', /New here\?/.test(await p.innerText('#gdBanner')));
      await p.click('#gdBanner'); for (const v of ['games', 'yes', '300']) { await p.click('.gdopt[data-v="' + v + '"]'); await p.waitForTimeout(150); }
      const t = await p.innerText('#app'); const st = await p.evaluate(() => JSON.parse(localStorage.getItem('learn-code-v2')));
      ok('start guide: games + experienced suggests C#, starts at Intermediate, and sets the weekly goal from the time chosen', /C#/.test(t) && /Start at Intermediate/.test(t) && st.wkGoal === 300 && st.guide && st.guide.lang === 'cs' && /About 20 lessons a week\./.test(t));
      await p.click('#gdStart'); await p.waitForTimeout(800); ok('start guide: the button opens that first lesson', await p.evaluate(() => /^#\/cs\//.test(location.hash)) && /Intermediate|INTERMEDIATE/i.test(await p.innerText('.lhead')));
      await p.goto(BASE + '#/'); await p.waitForTimeout(600); ok('start guide: the banner is not shown again once answered', await p.locator('#gdBanner').count() === 0 && await p.locator('a[href="#/start"]').count() === 1);
      await p.goto(BASE + '#/start'); await p.click('#gdAgain').catch(() => {}); await p.waitForSelector('.gdopt'); await p.click('.gdopt[data-v="web"]'); await p.click('.gdopt[data-v="new"]'); await p.click('.gdopt[data-v="50"]'); await p.waitForTimeout(200);
      const t2 = await p.innerText('#app'); ok('start guide: websites + beginner suggests JavaScript from lesson 1 and the HTML & CSS Lab', /JavaScript · 1\./.test(t2) && /HTML & CSS Lab/.test(t2) && /About 4 lessons a week\./.test(t2));
      /* 5. progress card */
      await p.goto(BASE + '#/'); await p.waitForSelector('#pcBtn'); await p.click('#pcBtn'); await p.waitForSelector('.pcmodal img');
      const img = await p.evaluate(() => { const i = document.querySelector('.pcmodal img'); return { src: i.src.slice(0, 22), w: i.naturalWidth, h: i.naturalHeight, dl: document.querySelector('#pcSave').getAttribute('download') }; });
      ok('progress card: a 1200 × 630 picture is made on the device, with Share and Save image', img.src === 'data:image/png;base64,' && img.w === 1200 && img.h === 630 && img.dl === 'learn-progress.png' && await p.locator('#pcShare').count() === 1);
      await p.click('#pcClose'); ok('progress card: Close removes it', await p.locator('.pcmodal').count() === 0);
      await ctx.close(); }
    { // finishing a level offers the card: 9 of 10 Python Beginner lessons done, the last one solved now
      const done = {}; ['hello', 'variables', 'strings', 'functions', 'decisions', 'loops', 'lists', 'dicts', 'classes'].forEach((id) => { done['py:' + id] = true; });
      const sol = 'def fizzbuzz(n):\n    if n % 15 == 0:\n        return "FizzBuzz"\n    elif n % 3 == 0:\n        return "Fizz"\n    elif n % 5 == 0:\n        return "Buzz"\n    return str(n)\n';
      const { ctx, p } = await mk('en-US', { seenPatch: '99', done, code: { 'py:challenge': sol } });
      await p.goto(BASE + '#/py/challenge'); await p.waitForSelector('#runBtn'); await p.click('#runBtn'); await p.waitForSelector('.verdict', { timeout: 15000 });
      ok('progress card: finishing a level says so and offers 📸 Share it', /You finished the Beginner level/.test(await p.innerText('.verdict')) && await p.locator('#vShare').count() === 1, await p.innerText('.verdict'));
      await p.click('#vShare'); await p.waitForSelector('.pcmodal img'); ok('progress card: its picture is titled for that level', /I finished Python Beginner!/.test(await p.getAttribute('.pcmodal img', 'alt')));
      await ctx.close(); }
    ok('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  } catch (e) { ok('test run crashed', false, e.stack); }
  await b.close(); srv.kill();
  console.log(fail + ' failed of ' + (pass + fail) + ' (local server; external hosts blocked; MOCKED AI service; translation quality is not tested)');
  process.exit(fail ? 1 : 0);
})();
