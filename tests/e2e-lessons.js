// 5.9.1: every main-app language lesson checked through the real grader, in a real browser.
//   node tests/e2e-lessons.js   (needs the app served on :8765; see run-all.sh)
// For the seven languages that run in the browser, the sample solution must pass and the starter must fail. For the
// eight online languages, the starter must fail the offline grader. Every lesson needs an explanation of at least
// 25 words, a task, a hint and a quiz with an explanation; runnable "what does this print?" quizzes must print their
// marked answer; hints and lesson text must not contain stray or broken HTML. The whole quiz bank is checked for
// wrong-language questions and short explanations. Asynchronous JavaScript output must not be lost.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/index.html';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.addInitScript(() => localStorage.setItem('learn-code-v2', JSON.stringify({ seenPatch: '99' })));
  await p.goto(BASE + '#/'); await p.waitForFunction(() => typeof LANGS !== 'undefined' && typeof gradeLessonAsync === 'function', null, { timeout: 30000 });
  const R = await p.evaluate(async () => {
    const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const KNOWN = /^<\/?(p|b|i|em|strong|code|br|ul|ol|li|pre|span|a|kbd|small|sub|sup|table|tr|td|th|thead|tbody|h3|h4|div|u|mark|abbr|q|s|img|hr)\b[^>]*>$/i;
    const r = { lessons: 0, solFail: [], starterPass: [], thin: [], missing: [], quizBad: [], quizWrong: [], tagsBody: [], tagsHint: [], dupId: [] };
    for (const k of LANG_ORDER) { const ids = new Set();
      for (const l of LANGS[k].lessons) { r.lessons++; const tag = k + '/' + l.id;
        if (ids.has(l.id)) r.dupId.push(tag); ids.add(l.id);
        if (strip(l.body).split(' ').length < 25) r.thin.push(tag);
        for (const f of ['title', 'concept', 'task', 'hint', 'solution']) if (!l[f]) r.missing.push(tag + ' ' + f);
        const q = l.quiz; if (!q || !q.why || !Array.isArray(q.options) || q.options.length < 2 || !(q.answer >= 0 && q.answer < q.options.length) || new Set(q.options).size !== q.options.length) r.quizBad.push(tag);
        for (const f of ['body', 'task']) { const bad = (String(l[f] || '').match(/<[^>]*>?/g) || []).filter((t) => !KNOWN.test(t)); if (bad.length) r.tagsBody.push(tag + ' ' + f + ' ' + bad[0]); }
        const hh = hintHtml(l.hint || ''); const doc = new DOMParser().parseFromString('<div>' + hh + '</div>', 'text/html'); if (/[<>]/.test(doc.body.textContent.replace(/[<>]=?|<<|>>|->|=>/g, '')) && /<\/?(code|b)>/.test(doc.body.textContent)) r.tagsHint.push(tag);
        if (!l.solution) continue;
        if (STATIC_LANGS.includes(k)) { if (l.starter !== undefined && gradeLesson(k, l, l.starter).pass) r.starterPass.push(tag); continue; }
        try { const g = await gradeLessonAsync(k, l, l.solution, l.stdin); if (!g.pass) r.solFail.push(tag + ': ' + (g.msg || '') + (g.run && g.run.error ? ' ' + g.run.error : ''));
          if (l.starter !== undefined && (await gradeLessonAsync(k, l, l.starter, l.stdin)).pass) r.starterPass.push(tag);
          if (q && q.code && k !== 'sql' && quizAsk(q) === 'what does this print?') { const o = await runCodeAsync(k, quizProgram(k, q).run); const got = normalizeOut(o.out), want = normalizeOut(q.options[q.answer]); if (!o.error && got !== want && got.replace(/\n/g, ' then ') !== want && got.replace(/\n/g, ', ') !== want) r.quizWrong.push(tag + ' prints ' + JSON.stringify(got) + ', marked ' + JSON.stringify(want)); }
        } catch (e) { r.solFail.push(tag + ': grader threw ' + e.message); }
      } }
    const bank = await (await fetch('ranked_extra.json')).json(); r.bankShort = []; r.bankLang = []; r.bankN = 0;
    const OTHER = { c: /C#|\bstd::|\bclass\b/, cpp: /C#/, cs: /C\/C\+\+|C\+\+ header|\bprintf\b.*header/, js: /TypeScript/, go: /\bclass\b/ };
    for (const k of Object.keys(bank)) for (const q of bank[k]) { r.bankN++; if (!q.why || q.why.length < 15) r.bankShort.push(k + ' ' + (q.id || q.code.slice(0, 40))); const first = q.code.split('\n')[0]; if (OTHER[k] && OTHER[k].test(first)) r.bankLang.push(k + ': ' + first.slice(0, 70)); }
    r.asyncJs = (await runCodeAsync('js', 'console.log(1); Promise.resolve().then(() => console.log(2)); setTimeout(() => console.log(4), 0); console.log(3);')).out;
    r.asyncTs = (await runCodeAsync('ts', 'async function f(): Promise<number> { return 5; }\nf().then((n) => console.log(n));')).out;
    return r; });
  console.log('  ' + R.lessons + ' lessons, ' + R.bankN + ' quiz bank questions');
  ok(R.lessons >= 360, 'all language lessons are loaded (' + R.lessons + ')');
  ok(R.dupId.length === 0, 'no duplicate lesson ids: ' + R.dupId.join(', '));
  ok(R.solFail.length === 0, 'every sample solution passes its own check through the real grader: ' + R.solFail.slice(0, 3).join(' | '));
  ok(R.starterPass.length === 0, 'no starter code passes without changes (offline grader included): ' + R.starterPass.join(', '));
  ok(R.thin.length === 0, 'every lesson explains its idea in at least 25 words: ' + R.thin.slice(0, 5).join(', '));
  ok(R.missing.length === 0, 'every lesson has a title, concept, task, hint and solution: ' + R.missing.slice(0, 5).join(', '));
  ok(R.quizBad.length === 0, 'every lesson quiz has an explanation, valid options and one marked answer: ' + R.quizBad.slice(0, 5).join(', '));
  ok(R.quizWrong.length === 0, 'every runnable "what does this print?" quiz really prints its marked answer: ' + R.quizWrong.slice(0, 3).join(' | '));
  ok(R.tagsBody.length === 0, 'no broken or unescaped HTML in lesson text (for example a lost << or ..<): ' + R.tagsBody.slice(0, 3).join(' | '));
  ok(R.tagsHint.length === 0, 'hints written with <code> show formatted code, not raw tags: ' + R.tagsHint.slice(0, 3).join(', '));
  ok(R.bankShort.length === 0, 'every quiz bank question has a real explanation: ' + R.bankShort.slice(0, 3).join(', '));
  ok(R.bankLang.length === 0, 'no quiz bank question is about another language: ' + R.bankLang.slice(0, 3).join(' | '));
  ok(R.asyncJs === '1\n3\n2\n4\n', 'JavaScript output from promises and timers is shown, in the right order: ' + JSON.stringify(R.asyncJs));
  ok(R.asyncTs === '5\n', 'TypeScript output from promises is shown: ' + JSON.stringify(R.asyncTs));
  // the two rebuilt SQL lessons and a hint, through the real page
  await p.goto(BASE + '#/sql/sql_order_limit'); await p.waitForSelector('#runBtn');
  ok(/ORDER BY/.test(await p.innerText('.learn')) && /3 most expensive/.test(await p.innerText('#app')), 'the ORDER BY and LIMIT lesson teaches ORDER BY and LIMIT');
  const hb = await p.$('button:has-text("Hint")'); if (hb) await hb.click(); await p.waitForTimeout(200);
  ok(await p.$('#reveal code') !== null && !/&lt;code&gt;|<code>/.test(await p.innerText('#reveal')), 'the hint shows formatted code instead of raw tags');
  ok(await p.evaluate(() => { const h = hintHtml('<code>x</code> <img src=x onerror=alert(1)> a < b'); const d = document.createElement('div'); d.innerHTML = h; return !d.querySelector('img') && d.querySelector('code') && /a < b/.test(d.textContent); }), 'hint formatting allows only bare code and bold tags, never images or handlers');
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  console.log(fail + ' failed of ' + (pass + fail)); await b.close(); process.exit(fail ? 1 : 0);
})();
