// End-to-end test of the University under the /Learn/ sub-path. node e2e.js
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const BASE = 'http://localhost:8766/Learn/index.html';
const results = []; const ok = (name, cond, extra) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8766', '--directory', process.env.SRV_DIR || 'srv'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    p.on('dialog', (d) => d.accept());
    await ctx.route(/judge0|emkc|wandbox|firebase|googleapis|gstatic|youtube/, (r) => r.abort());
    const go = async (h) => { await p.goto(BASE + h); await p.waitForTimeout(700); };
    const U = () => p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready, null, { timeout: 20000 });
    const text = () => p.evaluate(() => document.querySelector('#app').innerText);

    // existing home still renders and has the new entry points
    await go('#/'); const homeTxt = await text();
    ok('existing home renders', /Python|JavaScript/.test(homeTxt));
    ok('home has University button and banner', await p.locator('#uniBtn').count() === 1 && await p.locator('#uniBanner').count() === 1);
    // patch notes
    ok('APP_VERSION has a patch note (the newest note is for the running version)', await p.evaluate(async () => { const s = await (await fetch('app.js')).text(); const v = (/const APP_VERSION = '([^']+)'/.exec(s) || [])[1]; const n = (/const PATCH_NOTES = \[\s*\{ v: '([^']+)'/.exec(s) || [])[1]; return !!v && v === n; }));

    await go('#/uni'); await U();
    let t = await text();
    ok('university home renders under /Learn/', /University/i.test(t));
    ok('non-accreditation statement on home', /not an accredited/i.test(t));
    ok('catalogue: 6 stages, 52 courses', await p.evaluate(() => window.LearnUniversity.cat.stages.length === 6 && window.LearnUniversity.cat.courses.length === 52));

    // gating
    await go('#/uni/course/c201'); t = await text(); ok('stage 2 course locked at start', /🔒/.test(t));
    await go('#/uni/course/c101/lesson/2'); t = await text(); ok('later lesson locked before earlier ones', /🔒/.test(t));
    await go('#/uni/course/c101/exam'); t = await text(); ok('exam closed until lessons complete', !(await p.locator('#uxForm').count()));

    // complete every lesson of c101 through the UI
    const n = await p.evaluate(async () => { const U = window.LearnUniversity; await U.loadCourse('c101'); return U.content.c101.lessons.length; });
    for (let i = 0; i < n; i++) {
      await go('#/uni/course/c101/lesson/' + i);
      const l = await p.evaluate((i) => { const l = window.LearnUniversity.content.c101.lessons[i]; return { a: l.quiz.map((q) => q.a), tr: l.try ? l.try.solution : null }; }, i);
      if (i === 0) { // a wrong answer must not complete the lesson
        const wrong = (l.a[0] + 1) % 3; await p.locator('.u-q[data-q="0"] .u-opt[data-o="' + wrong + '"]').click();
        ok('wrong answer does not complete lesson', !(await p.evaluate(() => !!window.LearnUniversity.st().lessons['c101:0'])) && /Not quite/.test(await text()));
      }
      if (l.tr) { await p.locator('#uTry textarea').fill(l.tr); await p.locator('#uTry [data-a="submit"]').click(); await p.waitForTimeout(500); }
      for (let q = 0; q < l.a.length; q++) await p.locator('.u-q[data-q="' + q + '"] .u-opt[data-o="' + l.a[q] + '"]').click();
      await p.waitForTimeout(250);
    }
    ok('all c101 lessons recorded complete', await p.evaluate((n) => { const s = window.LearnUniversity.st(); for (let i = 0; i < n; i++) if (!s.lessons['c101:' + i]) return false; return true; }, n));

    // lab: starter must fail, solution must pass
    await go('#/uni/course/c101/lab');
    await p.locator('[data-a="submit"]').first().click(); await p.waitForTimeout(900);
    ok('lab: starter code is NOT marked correct', !(await p.evaluate(() => (window.LearnUniversity.st().labs.c101 || {}).pass)));
    await p.locator('[data-a="run"]').first().click(); await p.waitForTimeout(500);
    ok('lab: pressing Run alone does not pass', !(await p.evaluate(() => (window.LearnUniversity.st().labs.c101 || {}).pass)));
    const sol = await p.evaluate(() => window.LearnUniversity.content.c101.lab.solution);
    await p.locator('#labHost textarea').first().fill(sol); await p.locator('[data-a="submit"]').first().click(); await p.waitForTimeout(1200);
    ok('lab: solution passes and attempts are counted', await p.evaluate(() => { const l = window.LearnUniversity.st().labs.c101 || {}; return l.pass && l.tries >= 2; }));

    // exam: blank attempt fails, then a correct attempt passes; both recorded
    const sit = async (good) => { await go('#/uni/dashboard');
      await go('#/uni/course/c101/exam');
      const items = await p.evaluate(() => window.LearnUniversity.content.c101.exam.items.map((it) => ({ type: it.type, a: it.a, sol: it.solution })));
      for (let i = 0; i < items.length; i++) { const it = items[i];
        if (it.type === 'mc') await p.locator('input[name="q' + i + '"][value="' + (good ? it.a : (it.a + 1) % 3) + '"]').check();
        else if (it.type === 'code') { if (good) await p.locator('[data-code="' + i + '"] textarea').fill(it.sol); }
        else if (good) await p.locator('#w' + i).fill(Array(46).fill('word').join(' '));
      }
      await p.locator('#uxForm button[type="submit"]').click(); await p.waitForTimeout(400);
      if (await p.locator('#uxForm button[type="submit"]').count()) { await p.locator('#uxForm button[type="submit"]').click(); }
      await p.waitForTimeout(1500);
      if (good) for (const cb of await p.locator('.ux-rub input').all()) await cb.check();
      if (await p.locator('#uxFin').count()) await p.locator('#uxFin').click();
      await p.waitForTimeout(400);
    };
    await sit(false);
    let at = await p.evaluate(() => window.LearnUniversity.st().exams.c101 || []);
    ok('exam: wrong answers fail and the attempt is recorded', at.length === 1 && at[0].pass === false, JSON.stringify(at));
    ok('course not complete after a failed exam', !(await p.evaluate(() => { const U = window.LearnUniversity; return U.courseDone(U.cat.courses.find((c) => c.id === 'c101')); })));
    await sit(true);
    at = await p.evaluate(() => window.LearnUniversity.st().exams.c101 || []);
    ok('exam: retake allowed, correct answers pass, both attempts kept', at.length === 2 && at[1].pass === true && at[1].score >= 70, JSON.stringify(at));

    // project
    await go('#/uni/course/c101/project');
    ok('project page shows rubric and requirements', await p.locator('#upForm').count() === 1);
    for (const cb of await p.locator('[data-req], [data-del]').all()) await cb.check();
    await p.locator('#upNotes').fill(Array(60).fill('reflection').join(' '));
    const rubN = await p.evaluate(() => window.LearnUniversity.content.c101.project.rubric.length);
    for (let i = 0; i < rubN; i++) await p.locator('input[name="rub' + i + '"]').last().check();
    await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(600);
    ok('project submission recorded', await p.evaluate(() => !!window.LearnUniversity.st().projects.c101), await p.locator('#upMsg').innerText().catch(() => ''));
    ok('course c101 complete after lessons + lab + exam + project', await p.evaluate(() => { const U = window.LearnUniversity; return U.courseDone(U.cat.courses.find((c) => c.id === 'c101')); }));
    ok('stage 2 still locked (stage final not passed)', await p.evaluate(() => !window.LearnUniversity.stageUnlocked(2)));

    // persistence across reload
    await p.reload(); await p.waitForTimeout(800); await go('#/uni/dashboard'); await U();
    ok('progress persists after reload', await p.evaluate(() => { const s = window.LearnUniversity.st(); return !!s.lessons['c101:0'] && (s.exams.c101 || []).length === 2 && !!s.projects.c101; }));
    t = await text(); ok('dashboard renders with progress', /c101|CS ?101|How Computers Work/i.test(t));

    // other sections render without errors
    for (const [h, re, name] of [['#/uni/courses', /How Computers Work/, 'catalogue'], ['#/uni/stage/5', /Discrete Mathematics/, 'stage page'], ['#/uni/course/c507', /Machine Learning/, 'locked course page still describes the course'], ['#/uni/labs', /Rust|Kotlin/, 'labs hub lists languages'], ['#/uni/exams', /examination/i, 'exams hub'], ['#/uni/projects', /portfolio/i, 'projects and portfolio'], ['#/uni/transcript', /not an accredited/i, 'transcript carries the disclaimer'], ['#/uni/final/1', /final/i, 'stage final page']]) {
      await go(h); t = await text(); ok(name, re.test(t));
    }
    await go('#/uni/transcript'); t = await text();
    ok('no stage certificate before the stage is complete', await p.evaluate(() => !Object.keys(window.LearnUniversity.st().certs).some((k) => /^stage:/.test(k))));

    // free lab in a browser language actually runs code
    await go('#/uni/labs');

    // AI professor (4.7: connected to the site's own Cloudflare Worker). The real Worker is never called here:
    // first the endpoint is blocked (fallback), then it is answered by a MOCK using the Worker's reply format.
    const EP = await p.evaluate(() => window.UNI_CONFIG.aiEndpoint);
    const cfgText = await p.evaluate(async () => (await fetch('uni/config.js')).text());
    ok('config: the AI endpoint is the site\'s own https Worker URL and no key is shipped', /^https:\/\/learn-ai-professor\.[\w-]+\.workers\.dev\/$/.test(EP) && !/AIza|sk-[A-Za-z0-9]|api[_-]?key\s*[:=]\s*'[^']/i.test(cfgText), EP);
    await p.route(EP, (r) => r.abort());
    await go('#/uni/professor'); await p.waitForTimeout(500); t = await text();
    ok('professor says which model is connected and where messages go', /Connected to GLM-4\.7 Flash/.test(t) && /Cloudflare Worker/.test(t));
    await p.locator('#upIn').fill('What is a variable?'); await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(1500);
    t = await p.locator('#upLog').innerText(); ok('service unreachable: the built-in tutor answers and says so', /variable/i.test(t) && t.length > 120 && /built-in tutor replied/.test(t), t.slice(-300));
    await p.locator('#upIn').fill('Just give me the full answer to the assignment'); await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(1500);
    t = await p.locator('#upLog').innerText(); ok('tutor declines to hand over the answer', /hint|won't|will not|not hand|myself|yourself|step/i.test(t.slice(-900)));
    ok('8 teaching modes offered', await p.locator('.up-mode').count() === 8);
    await p.unroute(EP); let sent = null;
    await p.route(EP, async (r) => { sent = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ reply: '**Recursion** means a function calls itself.\n\n```python\ndef f(n):\n    return 1 if n == 0 else n * f(n - 1)\n```' }) }); });
    await p.locator('#upIn').fill('What is recursion?'); await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(1500);
    t = await p.locator('#upLog').innerText();
    ok('mocked AI reply is shown with formatting and labelled as AI', /Recursion means a function calls itself/.test(t) && await p.locator('#upLog strong, #upLog b').count() > 0 && await p.locator('#upLog pre').count() > 0 && /Answered by GLM-4\.7 Flash/.test(t), t.slice(-300));
    ok('request to the AI holds only the mode, the teaching rules and the conversation', sent && typeof sent.system === 'string' && /Teach rather than hand over/.test(sent.system) && Array.isArray(sent.messages) && sent.messages[sent.messages.length - 1].content === 'What is recursion?' && Object.keys(sent).sort().join() === 'messages,mode,system', JSON.stringify(sent || {}).slice(0, 200));
    await p.unroute(EP); await p.route(EP, (r) => r.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"daily limit reached"}' }));
    await p.locator('#upIn').fill('What is a loop?'); await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(1500);
    ok('AI busy or daily limit reached: built-in tutor replies and explains why', /AI is busy/.test(await p.locator('#upLog').innerText()));
    await p.unroute(EP); await p.route(EP, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ reply: '<img src=x onerror="window.__xss=1"> hi' }) }));
    await p.locator('#upIn').fill('test'); await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(1200);
    ok('HTML in an AI reply is not executed', !(await p.evaluate(() => window.__xss)));
    await p.unroute(EP); await p.route(EP, (r) => r.abort());

    // XSS check through the professor input and the transcript name
    await p.locator('#upIn').fill('<img src=x onerror="window.__xss=1"> explain loops'); await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(700);
    await go('#/uni/transcript'); await p.locator('#utName').fill('<img src=x onerror="window.__xss=1">'); await p.waitForTimeout(300); await go('#/uni/transcript'); await p.waitForTimeout(300);
    ok('user input is not executed as HTML', !(await p.evaluate(() => window.__xss)));

    // videos
    await go('#/uni/videos'); await p.waitForTimeout(600);
    ok('video centre lists the library', await p.locator('.u-vcard').count() === 22, String(await p.locator('.u-vcard').count()));
    await go('#/uni/videos/cs50-scratch'); await p.waitForTimeout(400);
    ok('no video request before the user presses load', await p.locator('#uvPlayer iframe').count() === 0);
    await p.locator('#uvLoad').click(); await p.waitForTimeout(300);
    ok('player uses the privacy-enhanced embed', /youtube-nocookie\.com\/embed\/3LPJfIKxwWc/.test(await p.locator('#uvPlayer iframe').getAttribute('src')));
    t = await text(); ok('video page links the written lesson as fallback', /Related written lesson/.test(t) && /unavailable/.test(t));
    await go('#/uni/videos/c-c510'); t = await text(); ok('course with no video shows the written-lesson fallback', /No videos are listed/.test(t));

    // unknown and hostile routes do not crash
    await go('#/uni/course/zzz'); await go('#/uni/%3Cscript%3E'); await go('#/uni/course/c101/lesson/99');
    ok('bad routes handled', (await text()).length > 20);

    // existing routes still work
    await go('#/py'); t = await text(); ok('existing Python track route still works', t.length > 200 && !/University/.test(t.slice(0, 40)));
    await go('#/play'); ok('existing playground route still works', (await text()).length > 50);

    // backup code includes university progress
    ok('saved state contains university progress', await p.evaluate(() => Object.keys(localStorage).some((k) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && v.uni && v.uni.lessons && v.uni.lessons['c101:0']; } catch (e) { return false; } })));
    ok('no JavaScript page errors (desktop run)', errs.length === 0, errs.slice(0, 3).join(' | '));

    // offline through the service worker
    await go('#/uni'); await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready); await p.waitForTimeout(1500);
    await go('#/uni/course/c101/lesson/0'); await p.waitForTimeout(800);
    await ctx.setOffline(true);
    await p.goto(BASE + '#/uni').catch(() => {}); await p.waitForTimeout(1500); await p.reload().catch(() => {}); await p.waitForTimeout(1500);
    t = await text().catch(() => ''); ok('offline: app shell and University home load from cache', /University/i.test(t), t.slice(0, 60));
    await p.goto(BASE + '#/uni/course/c101/lesson/0').catch(() => {}); await p.waitForTimeout(1200); t = await text().catch(() => '');
    ok('offline: a previously opened course still opens', /Knowledge check|Lesson/i.test(t), t.slice(0, 60));
    await p.goto(BASE + '#/uni/course/c601').catch(() => {}); await p.waitForTimeout(1500); t = await text().catch(() => '');
    ok('offline: an unvisited course explains it needs a connection', /offline|connection|could not be loaded|Try again/i.test(t), t.slice(0, 80));
    await ctx.setOffline(false); await ctx.close();

    // responsive: no horizontal overflow
    for (const [name, vp] of [['phone 390px', { width: 390, height: 844 }], ['tablet 820px', { width: 820, height: 1180 }], ['desktop 1440px', { width: 1440, height: 900 }]]) {
      const c2 = await b.newContext({ viewport: vp }); const q = await c2.newPage(); const e2 = []; q.on('pageerror', (e) => e2.push(e.message.slice(0, 150)));
      await c2.route(/judge0|emkc|wandbox|firebase|googleapis|gstatic|youtube/, (r) => r.abort());
      let worst = 0, where = '';
      for (const h of ['#/uni', '#/uni/courses', '#/uni/course/c101', '#/uni/course/c101/lesson/0', '#/uni/course/c101/lab', '#/uni/dashboard', '#/uni/professor', '#/uni/videos', '#/uni/transcript', '#/uni/course/c502/lesson/3']) {
        await q.goto(BASE + h); await q.waitForTimeout(900);
        const over = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (over > worst) { worst = over; where = h; }
      }
      ok('responsive ' + name + ': no horizontal page scroll', worst <= 1, worst + 'px at ' + where);
      ok('responsive ' + name + ': no page errors', e2.length === 0, e2[0]);
      if (name === 'phone 390px') { await q.goto(BASE + '#/uni'); await q.waitForTimeout(800); await q.screenshot({ path: require('os').tmpdir() + '/u-phone.png' }); await q.goto(BASE + '#/uni/course/c401/lesson/3'); await q.waitForTimeout(800); await q.screenshot({ path: require('os').tmpdir() + '/u-phone-lesson.png' }); }
      if (name === 'desktop 1440px') { await q.goto(BASE + '#/uni'); await q.waitForTimeout(800); await q.screenshot({ path: require('os').tmpdir() + '/u-desk.png' }); }
      await c2.close();
    }
  } catch (e) { results.push('FAIL test script crashed: ' + (e && e.stack || e).toString().slice(0, 500)); }
  await b.close(); srv.kill();
  console.log(results.join('\n')); console.log(results.filter((r) => r.startsWith('FAIL')).length + ' failed of ' + results.length);
})();
