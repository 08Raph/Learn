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
  const b = await chromium.launch(); const errs = []; const aiBodies = []; const trSent = [];
  const J = (r, st, o) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  let TR = (r, bd) => J(r, 200, { items: [] }); // MOCKED /translate: by default it translates nothing
  const mk = async (locale, seed) => { const ctx = await b.newContext(Object.assign({}, devices['iPad (gen 7) landscape'], { serviceWorkers: 'block', locale }));
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => { if (EP && r.request().url() === EP + 'translate') { const bd = JSON.parse(r.request().postData() || '{}'); trSent.push(bd); return TR(r, bd); }
      if (EP && r.request().url().startsWith(EP)) { aiBodies.push(r.request().postData() || ''); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ reply: 'Respuesta de prueba' }) }); } return r.abort(); });
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
      ok(c + ': the big headline and the hero sentence are translated with their numbers', (await p.innerHTML('.hero h1')) === L.html.hero && (await p.innerText('.hero p')).includes('435'));
      await p.goto(BASE + '#/py/hello'); await p.waitForSelector('#runBtn'); await p.waitForTimeout(500);
      const lesLeft = (await p.evaluate(() => window.__learnI18n.harvest(document.querySelector('#app')))).filter(still);
      ok(c + ': the lesson screen is translated (title, explanation, task, buttons)', lesLeft.length === 0 && (await p.innerText('.learn h2')).includes(L.lessons['py:hello'].title), lesLeft.slice(0, 6).join(' | '));
      ok(c + ': code is never translated (example, editor, the text the task asks for)', /print\("Hello!"\)/.test(await p.innerText('.codeblock')) && /print\("Hello, world!"\)/.test(await p.evaluate(() => document.querySelector('#edhost').innerText)) && (await p.innerText('.task code')) === 'Hello, world!');
      await p.click('#runBtn'); await p.waitForSelector('.verdict', { timeout: 15000 });
      ok(c + ': the same correct code still passes, and the result is translated', await p.locator('.verdict.ok').count() === 1 && (await p.innerText('.verdict.ok strong')) === L.ui['✓ Nice work, that passes!'] && (await p.innerText('.out pre')).trim() === 'Hello, world!');
      if (c === 'ar') ok('ar: code inside Arabic sentences stays left to right', await p.evaluate(() => getComputedStyle(document.querySelector('.task code')).direction === 'ltr' && getComputedStyle(document.querySelector('.task code')).unicodeBidi === 'isolate'));
      ok(c + ': a translated lesson shows no "English only" note', await p.locator('.i18nnote').count() === 0);
      await p.goto(BASE + '#/js/hello'); await p.waitForSelector('#runBtn'); await p.waitForTimeout(400);
      ok(c + ': with automatic translation on, a lesson with no hand translation shows no "English for now" note', await p.locator('.i18nnote').count() === 0);
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

    /* 6. 5.8 automatic translation of text without a hand translation (MOCKED /translate service) */
    { const L = loadL('es'); TR = (r, bd) => J(r, 200, { items: bd.items.map((x) => '«ES» ' + x) }); trSent.length = 0;
      const { ctx, p } = await mk('es-ES', { seenPatch: '99' });
      await p.goto(BASE + '#/js/hello'); await p.waitForSelector('#runBtn'); await p.waitForFunction(() => document.querySelector('.learn .body [data-autotr]'), null, { timeout: 15000 }); await p.waitForTimeout(600);
      const body = await p.innerHTML('.learn .body'); const sent = trSent.flatMap((x) => x.items);
      ok('auto: English text with no hand translation is sent in Spanish mode and the answer is shown', trSent.length >= 1 && trSent.every((x) => x.lang === 'es') && /«ES» Every program talks to you/.test(await p.innerText('.learn .body')));
      ok('auto: code is never sent or changed (example block, editor)', !/«ES»/.test(await p.innerText('.codeblock')) && !/«ES»/.test(await p.evaluate(() => document.querySelector('#edhost').innerText)) && !sent.some((x) => /console\.log\("Hi there/.test(x)));
      ok('auto: inline code goes as a placeholder and comes back as the original code', sent.some((x) => /<x i="0"\/>/.test(x)) && /<code[^>]*>console\.log\(\)<\/code>/.test(body) && !sent.some((x) => /<code/.test(x)));
      ok('auto: hand translations win, so text that has one is never sent', !sent.some((x) => L.ui[x.replace(/<[^>]+>/g, '')] !== undefined));
      ok('auto: brand and language names alone are not sent; ordinary single words are', !sent.some((x) => /^(JavaScript|Python|TikTok|YouTube|Learn)$/.test(x)));
      ok('auto: the small note says it was translated automatically, with Show original and ✕', (await p.innerText('#autoTrNote')).includes(L.ui['Some text was translated automatically and may contain mistakes.']) && await p.locator('#autoTrBtn').count() === 1 && await p.locator('#autoTrX').count() === 1);
      const n1 = trSent.length; await p.goto(BASE + '#/'); await p.waitForTimeout(800); await p.goto(BASE + '#/js/hello'); await p.waitForSelector('.learn .body [data-autotr]', { timeout: 10000 }); await p.waitForTimeout(800);
      ok('auto: coming back uses the saved translation without asking again', trSent.filter((x) => x.items.some((i) => /Every program talks/.test(i))).length === 1, trSent.length - n1);
      await p.reload(); await p.waitForSelector('#runBtn'); await p.waitForSelector('.learn .body [data-autotr]', { timeout: 10000 }); await p.waitForTimeout(600);
      ok('auto: after a reload the translation comes from this device (Cache Storage), not the service', trSent.filter((x) => x.items.some((i) => /Every program talks/.test(i))).length === 1);
      await p.click('#autoTrBtn'); await p.waitForTimeout(900);
      ok('auto: Show original puts the English back and offers to translate again', /^Every program talks/.test((await p.innerText('.learn .body')).trim()) && (await p.innerText('#autoTrNote')).includes(L.ui['Translate this page automatically']) && JSON.parse(await p.evaluate(() => localStorage.getItem('learn-code-v2'))).autoTr === false);
      ok('auto: with it switched off, a lesson with no hand translation says it is in English for now', (await p.innerText('.i18nnote')).includes(L.lessonNote.slice(0, 12)));
      ok('auto: hand-translated interface text stays translated with Show original', (await p.innerText('#runBtn')).includes(L.ui['▶ Run and check']));
      await p.click('#autoTrBtn'); await p.waitForSelector('.learn .body [data-autotr]', { timeout: 10000 });
      ok('auto: switching it back on translates again', /«ES» Every program/.test(await p.innerText('.learn .body')));
      await p.click('#autoTrX'); await p.waitForTimeout(300); ok('auto: ✕ hides the note for this screen', await p.locator('#autoTrNote').count() === 0);
      await p.goto(BASE + '#/js/variables'); await p.waitForSelector('#autoTrNote', { timeout: 10000 }); ok('auto: the note comes back on the next screen', true);
      await ctx.close(); }
    { TR = (r, bd) => J(r, 200, { items: bd.items.map((x) => '«ES» ' + x + ' <img src=x onerror="window.__pwn=1"><script>window.__pwn=2</script><a href="javascript:window.__pwn=3">x</a> <b onclick="window.__pwn=4">b</b>') });
      const { ctx, p } = await mk('es-ES', { seenPatch: '99' }); await p.goto(BASE + '#/js/hello'); await p.waitForSelector('.learn .body [data-autotr]', { timeout: 15000 }); await p.waitForTimeout(800);
      const bad = await p.evaluate(() => ({ pwn: window.__pwn, tags: document.querySelectorAll('#app [data-autotr] img, #app [data-autotr] script, #app [data-autotr] [onclick], #app [data-autotr] a[href^="javascript"]').length }));
      ok('auto: unsafe HTML in an answer is removed before it is shown (no script, image, handler or javascript: link)', bad.pwn === undefined && bad.tags === 0, JSON.stringify(bad));
      await ctx.close(); }
    { TR = (r, bd) => J(r, 200, { items: bd.items.map(() => '') }); trSent.length = 0; // a service that refuses every piece
      const { ctx, p } = await mk('fr-FR', { seenPatch: '99' }); await p.goto(BASE + '#/js/loops'); await p.waitForSelector('#runBtn'); await p.waitForTimeout(2500); const n = trSent.length;
      await p.evaluate(() => { const d = document.createElement('p'); d.textContent = 'A new sentence appears on the page.'; document.querySelector('.learn .body').appendChild(d); }); await p.waitForTimeout(2500);
      ok('auto: each request is one small batch (at most 20 pieces, 3,500 characters)', n >= 1 && trSent.every((x) => x.items.length <= 20 && x.items.join('').length <= 3500));
      ok('auto: a piece the service refuses is not asked for again and again', trSent.length === n + 1 && trSent[n].items.length === 1, trSent.length + ' vs ' + n);
      await ctx.close(); }
    { TR = (r) => J(r, 429, { error: 'daily limit reached' }); const L = loadL('es');
      const { ctx, p } = await mk('es-ES', { seenPatch: '99' }); await p.goto(BASE + '#/js/hello'); await p.waitForSelector('#autoTrNote', { timeout: 15000 }); await p.waitForTimeout(800);
      ok('auto: when the daily limit is reached it says so, keeps the hand translations and shows the rest in English', (await p.innerText('#autoTrNote')).includes(L.ui['Automatic translation is not available right now, so some text is in English.']) && /^Every program talks/.test((await p.innerText('.learn .body')).trim()) && (await p.innerText('#runBtn')).length > 0);
      const n = trSent.length; await p.goto(BASE + '#/js/variables'); await p.waitForTimeout(1500); ok('auto: after a limit it waits instead of asking again on every screen', trSent.length === n);
      await ctx.close(); }
    { TR = (r, bd) => J(r, 200, { items: bd.items.map((x) => '«AR» ' + x) }); trSent.length = 0;
      const { ctx, p } = await mk('ar-SA', { seenPatch: '99' }); await p.goto(BASE + '#/js/hello'); await p.waitForSelector('.learn .body [data-autotr]', { timeout: 15000 });
      ok('auto: Arabic asks for Arabic, the page stays right to left and code stays left to right', trSent.every((x) => x.lang === 'ar') && await p.evaluate(() => document.documentElement.dir) === 'rtl' && await p.evaluate(() => getComputedStyle(document.querySelector('.learn .body code')).direction) === 'ltr');
      await ctx.close(); }
    { TR = (r, bd) => J(r, 200, { items: bd.items.map((x) => '«EN?» ' + x) }); trSent.length = 0;
      const { ctx, p } = await mk('en-US', { seenPatch: '99' }); await p.goto(BASE + '#/js/hello'); await p.waitForSelector('#runBtn'); await p.waitForTimeout(1500);
      ok('auto: in English nothing is sent and no note is shown', trSent.length === 0 && await p.locator('#autoTrNote').count() === 0);
      await ctx.close(); }
    ok('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  } catch (e) { ok('test run crashed', false, e.stack); }
  await b.close(); srv.kill();
  console.log(fail + ' failed of ' + (pass + fail) + ' (local server; external hosts blocked; MOCKED AI and /translate services; translation quality is not tested)');
  process.exit(fail ? 1 : 0);
})();
