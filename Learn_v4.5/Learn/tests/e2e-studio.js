// Studio tests: every practice exercise is validated through the real graders, and the visualiser and
// practice UI are driven in a real browser.   node tests/e2e-studio.js   (needs the app served; see run-all.sh)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/index.html';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/judge0|emkc|wandbox|firebase|googleapis|gstatic|youtube/, (r) => r.abort());
  await p.goto(BASE + '#/uni'); await p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready, null, { timeout: 20000 });
  await p.evaluate(async () => { const U = window.LearnUniversity; await U.loadMod('uni-assess'); await U.loadMod('uni-studio'); });
  // 1. data integrity through the real graders
  const r = await p.evaluate(async () => {
    const U = window.LearnUniversity, D = U.studio.data, out = [];
    for (const x of D.DEBUG) { const sol = await U.assess.grade({ lang: 'js', tests: x.tests, solution: x.solution, starter: x.starter }, x.solution); const st = await U.assess.grade({ lang: 'js', tests: x.tests, solution: x.solution, starter: x.starter }, x.starter).catch(() => ({ pass: false })); out.push(['debug ' + x.id + ' solution passes', !!sol.pass]); out.push(['debug ' + x.id + ' buggy starter fails', !st.pass]); }
    for (const x of D.SQLX) { const spec = { lang: 'sql', setup: x.setup, rows: x.rows, ordered: x.ordered !== false }; const sol = await U.assess.grade(spec, x.solution); out.push(['sql ' + x.id + ' solution passes' + (sol.pass ? '' : ' :: ' + (sol.msg || '') + ' ' + ((sol.run && sol.run.error) || '')), !!sol.pass]); const wrong = await U.assess.grade(spec, 'SELECT 1;'); out.push(['sql ' + x.id + ' wrong query fails', !wrong.pass]); }
    for (const x of D.REVIEW) { out.push(['review ' + x.id + ' has real and false items', x.items.some((i) => i[1]) && x.items.some((i) => !i[1]) && x.items.every((i) => i[2])]); }
    for (const x of D.NORMAL) { out.push(['normal ' + x.id + ' keys valid', x.qs.every((q) => q.a >= 0 && q.a < q.o.length && q.why)]); }
    const KEY = { t1: '[2024] => true\n[2023] => false\n[1900] => false\n[2000] => true', t2: '[5, 0, 10] => 5\n[-3, 0, 10] => 0\n[30, 0, 10] => 10\n[10, 0, 10] => 10', t3: '[90] => "A"\n[89] => "B"\n[80] => "B"\n[79] => "C"\n[70] => "C"\n[69] => "F"\n[10] => "F"', t4: '[[3, 1, 2]] => 2\n[[1, 2, 3, 4]] => 2.5\n[[10, 9, 8]] => 9\n[[1, 2, 9]] => 2' };
    for (const x of D.TESTX) { const good = U.studio.runTests(x, KEY[x.id]); out.push(['testing ' + x.id + ' thorough tests catch every mutant ' + JSON.stringify(good.killed) + JSON.stringify(good.bad), good.killed.every(Boolean) && !good.bad.length]); const weak = U.studio.runTests(x, x.sample); out.push(['testing ' + x.id + ' sample alone is not enough', !weak.killed.every(Boolean)]); const wrong = U.studio.runTests(x, x.sample.split('\n')[0].replace(/=> .*/, '=> "nonsense"')); out.push(['testing ' + x.id + ' a wrong test is rejected', wrong.bad.length === 1 && wrong.tests.length === 0]); }
    for (const x of D.DESIGN) { out.push(['design ' + x.id + ' rubric', x.rubric.length >= 6 && x.prompt.length > 100]); }
    // visualiser algorithms: final frame sorted, for many random inputs
    for (const k of ['bubble', 'selection', 'insertion', 'merge', 'quick']) { let good = true; for (let t = 0; t < 40; t++) { const n = 1 + Math.floor(Math.random() * 20); const a = Array.from({ length: n }, () => Math.floor(Math.random() * 50)); const f = U.studio.sortFrames(k, a); const last = f[f.length - 1].a; const want = a.slice().sort((x, y) => x - y); if (JSON.stringify(last) !== JSON.stringify(want)) good = false; } out.push(['visual ' + k + ' sorts 40 random arrays', good]); }
    const arr = [1, 3, 5, 7, 9, 11, 13, 15]; let sgood = true; for (const k of ['linear', 'binary']) for (const t of [1, 15, 7, 8, 0, 99]) { const f = U.studio.searchFrames(k, arr, t); const last = f[f.length - 1]; const found = last.done.length === 1 && arr[last.done[0]] === t; if (found !== arr.includes(t)) sgood = false; } out.push(['visual searches find present and reject absent values', sgood]);
    const bs = U.studio.searchFrames('binary', Array.from({ length: 32 }, (_, i) => i * 2), 62); out.push(['binary search of 32 values uses at most 6 comparisons (' + bs[bs.length - 1].cmp + ')', bs[bs.length - 1].cmp <= 6]);
    const hn = U.studio.recursionFrames('hanoi', 4); out.push(['hanoi 4 discs ends with all on peg C', JSON.stringify(hn[hn.length - 1].pegs) === '[[],[],[4,3,2,1]]' && hn.length === 17]);
    const fb = U.studio.recursionFrames('fib', 6); out.push(['fib(6) reports 8 with 25 calls', /= 8,/.test(fb[fb.length - 1].msg) && fb[fb.length - 1].calls === 25]);
    return out;
  });
  r.forEach((x) => ok(x[1], x[0]));
  // 2. UI: visualiser
  const go = async (h) => { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(350); };
  await go('#/uni/labs'); ok(await p.locator('a[href="#/uni/visual"]').count() >= 1, 'labs hub links to the visualiser'); ok(await p.locator('a[href="#/uni/practice"]').count() >= 1, 'labs hub links to the practice studio');
  await go('#/uni/visual'); ok(await p.locator('.u-labcard').count() === 4, 'visualiser hub shows 4 topics');
  await go('#/uni/visual/sort'); ok(await p.locator('.uv-bar').count() === 12, 'sorting shows 12 bars');
  const s1 = await p.textContent('#uvPos'); await p.click('[data-v="next"]'); await p.click('[data-v="next"]'); const s2 = await p.textContent('#uvPos'); ok(/Step 1 of/.test(s1) && /Step 3 of/.test(s2), 'step button advances');
  await p.click('[data-v="prev"]'); ok(/Step 2 of/.test(await p.textContent('#uvPos')), 'back button goes back');
  await p.click('[data-v="last"]'); ok(/Sorted\./.test(await p.textContent('#uvMsg')) && await p.locator('.uv-bar.done').count() === 12, 'last step is fully sorted');
  await p.selectOption('#uvAlg', 'quick'); await p.selectOption('#uvSpeed', '50'); await p.click('[data-v="play"]'); await p.waitForFunction(() => /Sorted\./.test(document.querySelector('#uvMsg').textContent), null, { timeout: 20000 }).then(() => ok(true, '')).catch(() => ok(false, 'play runs quicksort to completion'));
  ok((await p.getAttribute('.uv-bars', 'aria-label') || '').startsWith('Values:'), 'bars have a text alternative');
  await go('#/uni/visual/search'); await p.selectOption('#uvAlg', 'linear'); await p.fill('#uvT', '1000'); await p.click('#uvGo'); await p.click('[data-v="last"]'); ok(/not in the list/.test(await p.textContent('#uvMsg')), 'linear search reports a missing value');
  await go('#/uni/visual/recur'); await p.click('[data-v="last"]'); ok(/Depth of recursion: 4/.test(await p.textContent('#uvMsg')), 'factorial recursion completes'); await p.selectOption('#uvAlg', 'hanoi'); ok(await p.locator('.uv-peg').count() === 3, 'hanoi shows three pegs');
  await go('#/uni/visual/struct'); await p.fill('#uvT', '5'); await p.click('[data-op="push"]'); await p.fill('#uvT', '9'); await p.click('[data-op="push"]'); await p.click('[data-op="pop"]'); ok(/Popped 9/.test(await p.textContent('#uvMsg')) && await p.locator('.uv-cell').count() === 1, 'stack is last in, first out');
  await p.click('[data-op="pop"]'); await p.click('[data-op="pop"]'); ok(/underflow/.test(await p.textContent('#uvMsg')), 'popping an empty stack is explained');
  await p.selectOption('#uvAlg', 'queue'); for (const v of ['1', '2', '3']) { await p.fill('#uvT', v); await p.click('[data-op="enq"]'); } await p.click('[data-op="deq"]'); ok(/Dequeued 1/.test(await p.textContent('#uvMsg')), 'queue is first in, first out');
  await p.selectOption('#uvAlg', 'bst'); for (const v of ['50', '30', '70', '20', '40']) { await p.fill('#uvT', v); await p.click('[data-op="ins"]'); } ok(await p.locator('.uv-tree circle').count() === 5 && /20, 30, 40, 50, 70/.test(await p.textContent('#uvStage')), 'BST holds 5 nodes, in-order sorted');
  await p.fill('#uvT', '40'); await p.click('[data-op="find"]'); ok(/Found 40 after 3 comparisons/.test(await p.textContent('#uvMsg')), 'BST search counts comparisons'); await p.fill('#uvT', '41'); await p.click('[data-op="find"]'); ok(/not in the tree/.test(await p.textContent('#uvMsg')), 'BST search reports a miss');
  // 3. UI: practice studio
  await go('#/uni/practice'); ok(await p.locator('.u-labcard').count() === 7, 'practice hub shows 6 kinds and the environment check'); ok(/0 of 27 exercises completed/.test(await p.textContent('.u-stagehero')), 'hub counts 27 exercises, none done');
  await go('#/uni/practice/debug/d1'); await p.waitForSelector('#psHost [data-a="submit"]'); await p.click('#psHost [data-a="submit"]'); await p.waitForSelector('#psHost .verdict'); ok(await p.locator('#psHost .verdict.no').count() === 1, 'buggy code is not accepted');
  ok(!(await p.evaluate(() => (window.LearnUniversity.st().studio['debug:d1'] || {}).pass)), 'failed attempt is not recorded as a pass');
  await p.evaluate(() => { const U = window.LearnUniversity; U.st().scratch['studio:debug:d1'] = U.studio.data.DEBUG[0].solution; U.save(); }); await go('#/uni/practice'); await go('#/uni/practice/debug/d1'); await p.waitForSelector('#psHost [data-a="submit"]'); await p.click('#psHost [data-a="submit"]'); await p.waitForSelector('#psHost .verdict.ok'); ok(/Completed/.test(await p.textContent('#psState')) && /off-by-one/.test(await p.textContent('#psAfter')), 'fixed code passes and the lesson is shown');
  await go('#/uni/practice/sql/s1'); await p.waitForSelector('#psHost [data-a="submit"]'); await p.evaluate(() => { const U = window.LearnUniversity; U.st().scratch['studio:sql:s1'] = 'SELECT name, price FROM products;'; U.save(); }); await go('#/uni/practice'); await go('#/uni/practice/sql/s1'); await p.waitForSelector('#psHost [data-a="submit"]'); await p.click('#psHost [data-a="submit"]'); await p.waitForSelector('#psHost .verdict'); ok(await p.locator('#psHost .verdict.no').count() === 1, 'an incomplete SQL query is not accepted');
  await go('#/uni/practice/review/r1'); await p.click('#psForm button[type=submit]'); ok(/missed/.test(await p.textContent('#psAfter')), 'empty review reports missed problems');
  await p.evaluate(() => { const x = window.LearnUniversity.studio.data.REVIEW[0]; document.querySelectorAll('#psForm input').forEach((c) => { c.checked = x.items[+c.value][1]; }); }); await p.click('#psForm button[type=submit]'); ok(/A complete review/.test(await p.textContent('#psAfter')), 'correct review passes');
  await p.evaluate(() => { document.querySelectorAll('#psForm input').forEach((c) => { c.checked = true; }); }); await p.click('#psForm button[type=submit]'); ok(/not a real problem/.test(await p.textContent('#psAfter')), 'ticking everything is not accepted');
  await go('#/uni/practice/normal/n1'); ok(await p.locator('.u-q').count() === 3, 'normalisation exercise shows its questions');
  await go('#/uni/practice/testing/t1'); await p.click('#psRun'); ok(/of 4 faulty versions caught/.test(await p.textContent('#psAfter')) && await p.locator('.ps-mut .bad').count() >= 1, 'sample tests leave mutants alive');
  await p.fill('#psTests', '[2024] => true\n[2023] => false\n[1900] => false\n[2000] => true'); await p.click('#psRun'); ok(/4 of 4/.test(await p.textContent('#psAfter')) && /Completed/.test(await p.textContent('#psState')), 'thorough tests catch all 4 mutants');
  await p.fill('#psTests', '[1900] => true'); await p.click('#psRun'); ok(/this test is itself wrong/.test(await p.textContent('#psAfter')), 'a wrong expectation is rejected');
  await p.fill('#psTests', 'alert(1) => <img src=x onerror=alert(1)>'); await p.click('#psRun'); ok(/could not be used/.test(await p.textContent('#psAfter')) && await p.locator('#psAfter img').count() === 0, 'malformed test input is rejected and never rendered as HTML');
  await go('#/uni/practice/design/g1'); await p.fill('#psText', 'too short'); await p.click('#psShow'); ok(/Write your own design first/.test(await p.textContent('#psAfter')), 'checklist is withheld until an answer is written');
  await p.fill('#psText', Array(130).fill('word').join(' ')); await p.click('#psShow'); ok(await p.locator('#psRub input').count() === 7, 'checklist appears after 120 words'); await p.click('#psRub button[type=submit]'); ok(/Self-assessed: 0 of 7/.test(await p.textContent('#psRes')), 'self-assessment is labelled and 0 ticks does not complete');
  // 4. environment check on the in-browser languages (real engines, no network)
  await go('#/uni/practice/env'); await p.click('#evLocal'); await p.waitForFunction(() => /This run:/.test(document.querySelector('#evSum').textContent), null, { timeout: 60000 });
  const env = await p.evaluate(() => Array.from(document.querySelectorAll('#evTable tr[data-l]')).slice(0, 7).map((tr) => [tr.dataset.l, tr.querySelector('.ev-ok').textContent, tr.querySelector('.ev-err').textContent, tr.querySelector('.ev-loop').textContent]));
  env.forEach((e) => { ok(/^✓/.test(e[1]), 'env ' + e[0] + ' correct program: ' + e[1]); ok(/^✓/.test(e[2]), 'env ' + e[0] + ' faulty program reported: ' + e[2]); if (e[0] !== 'sql') ok(/^✓/.test(e[3]), 'env ' + e[0] + ' endless loop stopped: ' + e[3]); });
  console.log('ENV ' + JSON.stringify(env)); console.log('SUMMARY ' + await p.textContent('#evSum'));
  // 5. persistence and backup merge of studio results
  await p.reload(); await p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready); ok(await p.evaluate(() => { const s = window.LearnUniversity.st().studio; return s['debug:d1'].pass && s['testing:t1'].pass && s['review:r1'].pass; }), 'studio results persist after reload');
  // 6. phone width: no horizontal overflow
  await p.setViewportSize({ width: 390, height: 800 }); for (const h of ['#/uni/visual/sort', '#/uni/practice', '#/uni/practice/review/r1', '#/uni/practice/env']) { await go(h); const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(o <= 2, 'no horizontal overflow at 390px on ' + h + ' (' + o + ')'); }
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  console.log(fail + ' failed of ' + (pass + fail)); await b.close(); process.exit(fail ? 1 : 0);
})();
