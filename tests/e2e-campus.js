// Second suite: stage finals, certificates, electives, departments, career, study tools, professor modes,
// runner-failure handling, service worker update, cloud-sync merge, responsive checks.  node e2e2.js
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const BASE = 'http://localhost:8767/Learn/index.html';
const R = []; const ok = (n, c, x) => R.push((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + String(x).slice(0, 160) + ']' : ''));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8767', '--directory', process.env.SRV_DIR || 'srv'], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200))); p.on('dialog', (d) => d.accept());
    await ctx.route(/judge0|emkc|piston|wandbox|firebase|googleapis|gstatic|youtube/, (r) => r.abort());
    const go = async (h) => { await p.goto(BASE + '#/uni/dashboard'); await p.goto(BASE + h); await p.waitForTimeout(650); };
    const text = () => p.evaluate(() => document.querySelector('#app').innerText);
    await p.goto(BASE + '#/uni'); await p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready, null, { timeout: 20000 });
    const UE = (fn, arg) => p.evaluate(fn, arg);

    ok('programme totals unchanged by electives (52 courses, 255 lessons)', await UE(() => { const o = window.LearnUniversity.overall(); return o.tot === 52 && o.les === 255; }));
    ok('13 electives registered and resolvable', await UE(() => { const U = window.LearnUniversity; return U.cat.electives.length === 13 && U.cat.electives.every((c) => U.courseById(c.id) === c); }));

    /* ---- stage final through the UI ---- */
    const sitFinal = async (good) => {
      await go('#/uni/final/1'); await p.waitForSelector('#uxForm', { timeout: 15000 });
      await UE((good) => { const U = window.LearnUniversity; const strip = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.trim(); };
        const all = []; U.coursesOf(1).forEach((c) => U.content[c.id].exam.items.forEach((it) => all.push(it)));
        document.querySelectorAll('.ux-item').forEach((sec) => {
          const qt = sec.querySelector('.u-qt'); const q = qt ? qt.textContent.trim() : '';
          const labels = Array.from(sec.querySelectorAll('.ux-opt span')).map((x) => x.textContent.trim()).sort().join('|'); const cands = all.filter((x) => strip(U.inline(String(x.q).split('\n')[0])) === q); const it = cands.find((x) => x.type !== 'mc' || x.o.map((o) => strip(U.inline(o))).sort().join('|') === labels) || cands[0]; if (!it) { sec.dataset.unmatched = '1'; return; }
          if (it.type === 'mc') { const want = strip(U.inline(it.o[good ? it.a : (it.a + 1) % it.o.length])); const lab = Array.from(sec.querySelectorAll('.ux-opt')).find((l) => l.querySelector('span').textContent.trim() === want); if (lab) lab.querySelector('input').checked = true; else sec.dataset.unmatched = '1'; }
          else if (it.type === 'code') { if (good) { const ta = sec.querySelector('textarea'); ta.value = it.solution; ta.dispatchEvent(new Event('input', { bubbles: true })); } }
          else if (good) { const ta = sec.querySelector('textarea'); ta.value = Array(50).fill('word').join(' '); ta.dispatchEvent(new Event('input', { bubbles: true })); }
        }); }, good);
      const un = await p.locator('.ux-item[data-unmatched]').count();
      await p.locator('#uxForm button[type="submit"]').click(); await p.waitForTimeout(400);
      if (await p.locator('#uxForm button[type="submit"]').count()) await p.locator('#uxForm button[type="submit"]').click();
      await p.waitForTimeout(2500);
      if (good) for (const cb of await p.locator('.ux-rub input').all()) await cb.check();
      if (await p.locator('#uxFin').count()) await p.locator('#uxFin').click(); await p.waitForTimeout(400); return un;
    };
    await sitFinal(false);
    ok('stage final: failing attempt recorded, stage 2 stays locked', await UE(() => { const U = window.LearnUniversity; const a = U.attempts('final-s1'); return a.length === 1 && !a[0].pass && !U.stageUnlocked(2); }));
    let t = await text(); ok('failed final explains the result and how it was marked', /Not passed/.test(t) && /pass mark 75%/.test(t) && /How this was marked/.test(t));
    const un = await sitFinal(true);
    ok('stage final: every question matched to the course content', un === 0, un + ' unmatched');
    ok('stage final: passing attempt unlocks stage 2 (attempt history kept)', await UE(() => { const U = window.LearnUniversity; const a = U.attempts('final-s1'); return a.length === 2 && a[1].pass && a[1].score >= 75 && U.stageUnlocked(2) && !U.stageUnlocked(3); }), JSON.stringify(await UE(() => window.LearnUniversity.attempts('final-s1'))));
    ok('passing the final alone does not complete the stage or earn a certificate', await UE(() => !window.LearnUniversity.stageComplete(1)));
    await go('#/uni/transcript'); ok('no certificate button while stage 1 is incomplete', await p.locator('[data-cert="s1"]').count() === 0);

    /* ---- certificate (STATE INJECTED: stage 1 courses marked complete directly in the save) ---- */
    await UE(() => { const U = window.LearnUniversity, s = U.st(); U.coursesOf(1).forEach((c) => { for (let i = 0; i < c.n; i++) s.lessons[c.id + ':' + i] = '2026-11-01'; if (c.lab) s.labs[c.id] = { pass: true, at: '2026-11-01', tries: 1 }; s.exams[c.id] = [{ at: '2026-11-01', score: 88, pass: true, secs: 600, self: false }]; s.projects[c.id] = { at: '2026-11-01', pct: 80, notes: 'Injected by the test suite for certificate testing.', title: 'Test project ' + c.code }; }); s.name = 'Test Student'; U.save(); });
    await go('#/uni/transcript');
    ok('stage 1 complete after all courses + final', await UE(() => window.LearnUniversity.stageComplete(1)));
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.locator('[data-cert="s1"]').click()]);
    const cpath = await dl.path(); const png = fs.readFileSync(cpath);
    ok('earned certificate downloads as a real PNG', dl.suggestedFilename() === 'learn-university-stage-1.png' && png.length > 20000 && png.slice(1, 4).toString() === 'PNG', png.length + ' bytes');
    ok('no certificate offered for stage 2 or the full pathway', await p.locator('[data-cert="s2"]').count() === 0 && await p.locator('[data-cert="all"]').count() === 0);
    t = await text(); ok('transcript shows grades and the disclaimer', /88%/.test(t) && /not an accredited/i.test(t));

    /* ---- electives ---- */
    await go('#/uni/course/gd101'); t = await text(); ok('elective course page renders with lessons', /Game Programming Foundations/.test(t) && /The game loop/.test(t));
    ok('elective unlocked by its prerequisite', await UE(() => { const U = window.LearnUniversity; return U.courseUnlocked(U.courseById('gd101')); }));
    await go('#/uni/course/gd101/lab'); const sol = await UE(() => window.LearnUniversity.content.gd101.lab.solution);
    await p.locator('[data-a="submit"]').first().click(); await p.waitForTimeout(700);
    ok('elective lab: starter not accepted', !(await UE(() => (window.LearnUniversity.st().labs.gd101 || {}).pass)));
    await p.locator('#labHost textarea').first().fill(sol); await p.locator('[data-a="submit"]').first().click(); await p.waitForTimeout(1000);
    ok('elective lab: solution passes', await UE(() => !!(window.LearnUniversity.st().labs.gd101 || {}).pass));
    await UE(() => { const U = window.LearnUniversity; return U.loadCourse('ce101').then(() => U.loadCourse('mb101')); });
    ok('electives never count toward stage completion', await UE(() => window.LearnUniversity.coursesOf(1).every((c) => !c.elective)));

    /* ---- departments ---- */
    await go('#/uni/departments'); ok('eight departments listed', await p.locator('.u-dept').count() === 8);
    for (const d of ['se', 'cs', 'ai', 'sec', 'game', 'ce', 'cloud', 'mobile']) { await go('#/uni/departments/' + d); const n = await p.locator('.u-path li').count(); t = await text(); ok('department ' + d + ': pathway with real courses and a coverage statement', n >= 6 && /What this department covers/.test(t), n + ' courses'); }
    await go('#/uni/videos/d-ai'); ok('videos filter by department', (await p.locator('.u-vcard').count()) >= 3);
    await go('#/uni/videos'); ok('video library has 22 entries', await p.locator('.u-vcard').count() === 22);
    ok('video data: unique ids, well-formed YouTube ids and https links', await UE(() => { const V = window.UNI_VIDEOS; return new Set(V.map((v) => v.yt)).size === V.length && V.every((v) => /^[\w-]{11}$/.test(v.yt) && v.url === 'https://www.youtube.com/watch?v=' + v.yt && v.courses.every((c) => window.LearnUniversity.courseById(c)) && v.quiz.length >= 1 && v.obj.length >= 2); }));

    /* ---- career centre ---- */
    await go('#/uni/career'); ok('career: nine roles', await p.locator('.u-ccard').count() === 9);
    await go('#/uni/career/role/frontend'); t = await text(); ok('career: skill-gap analysis reflects the record', /Skill gap analysis/.test(t) && /Skills you have evidence for/.test(t) && /✓ Completed/.test(t));
    await go('#/uni/career/cv');
    await p.locator('[data-cv="headline"]').fill('<img src=x onerror="window.__xss2=1"> Junior developer');
    await p.locator('[data-cv="github"]').fill('javascript:alert(1)'); await p.locator('[data-cv="site"]').fill('http://insecure.example'); await p.locator('[data-cv="summary"]').fill('I build small web tools. </script><script>window.__xss2=2</script>');
    await p.waitForTimeout(700); t = await p.locator('#cvPrev').innerText();
    ok('CV preview shows the record and escapes input', /Test Student/.test(t) && /Junior developer/.test(t) && /Not an accredited qualification/.test(t) && !(await UE(() => window.__xss2)));
    ok('CV form field keeps hostile text as text (attribute injection blocked)', (await p.locator('[data-cv="headline"]').inputValue()).includes('Junior developer'));
    ok('CV rejects non-https and javascript: links with an explanation', /left out/.test(await p.locator('#cvWarn').innerText()) && !/javascript:|insecure\.example/.test(await p.locator('#cvPrev').innerHTML()));
    const [cvdl] = await Promise.all([p.waitForEvent('download'), p.locator('#cvDown').click()]); const cv = fs.readFileSync(await cvdl.path(), 'utf8');
    ok('CV downloads as HTML with no executable injection', /<h1>Test Student<\/h1>/.test(cv) && !/<script>window/.test(cv) && !/<img src=x/.test(cv) && /&lt;img/.test(cv));
    await p.waitForTimeout(2500); await p.reload(); await p.waitForTimeout(900); await go('#/uni/career/cv'); ok('CV fields persist after reload', /Junior developer/.test(await p.locator('[data-cv="headline"]').inputValue()));
    await go('#/uni/career/interview'); ok('interview: 12 coding exercises and 14 technical questions', await p.locator('.u-ivq').count() === 14 && /Two sum/.test(await text()));
    await p.locator('.u-ivq summary').first().click(); await p.locator('.u-ivq').first().locator('[data-rev]').click();
    ok('interview: key points hidden until an answer is written', await p.locator('.u-ivq').first().locator('.u-ivkey').isHidden());
    await go('#/uni/career/interview/iv-two-sum'); const s2 = await UE(() => window.UNI_DEPTS.coding[0].solution);
    await p.locator('[data-a="submit"]').first().click(); await p.waitForTimeout(600); const before = await UE(() => !!(window.LearnUniversity.st().iv['code:iv-two-sum'] || {}).pass);
    await p.locator('#ivHost textarea').first().fill(s2); await p.locator('[data-a="submit"]').first().click(); await p.waitForTimeout(900);
    ok('interview exercise: starter fails, solution passes, attempts counted', !before && await UE(() => { const r = window.LearnUniversity.st().iv['code:iv-two-sum']; return r.pass && r.tries === 2; }));
    await go('#/uni/career/present/c101'); t = await text(); ok('presentation outline built from a submitted project', /The problem/.test(t) && /Injected by the test suite/.test(t));
    await go('#/uni/career/guide'); t = await text(); ok('career guide: no job listings, no promise of employment', /does not list jobs/.test(t) && /nothing here promises employment/i.test(t));

    await go('#/uni/transcript'); await p.locator('#utName').fill('Ada" onfocus="window.__xss3=1" x="'); await p.waitForTimeout(300); await go('#/uni/transcript'); await p.locator('#utName').focus(); await p.waitForTimeout(200);
    ok('quote characters in the student name cannot inject attributes', !(await UE(() => window.__xss3)) && (await p.locator('#utName').inputValue()).startsWith('Ada"'));
    await p.locator('#utName').fill('Test Student'); await p.waitForTimeout(300);
    /* ---- my study ---- */
    await go('#/uni/course/c201/lesson/0'); await p.locator('#uBm').click(); await p.waitForTimeout(200);
    await go('#/uni/study'); t = await text();
    ok('study: bookmark appears, history and achievements derive from the record', /Bookmarks \(1\)/.test(t) && /Learning history/.test(t) && /Stage 1 final: \d+% \(passed\)/.test(t) && /🏅 Stage one/.test(t));
    await p.locator('#sgGoal').selectOption('10'); await p.waitForTimeout(300); ok('study: weekly goal saved', await UE(() => window.LearnUniversity.st().goal.week === 10));
    await p.locator('[data-unbm]').first().click(); await p.waitForTimeout(300); ok('study: bookmark removed', await UE(() => Object.keys(window.LearnUniversity.st().bm).length === 0));
    await go('#/uni/study/challenge'); await p.waitForSelector('#chForm'); const nq = await p.locator('#chForm .ux-item').count();
    await p.locator('#chForm button[type="submit"]').click(); await p.waitForTimeout(400);
    ok('weekly challenge: unanswered scores 0 and is recorded as a personal result only', nq === 8 && await UE(() => { const a = window.LearnUniversity.st().arena; const k = Object.keys(a); return k.length === 1 && a[k[0]].score === 0 && a[k[0]].of === 8; }));
    t = await text(); ok('challenge shows correct answers and explanations after marking', /Answer:/.test(t) && /Score: 0 of 8/.test(t));

    /* ---- AI professor: all eight modes + new behaviours ---- */
    await go('#/uni/professor'); await p.waitForTimeout(500);
    const ask = async (q) => { await p.locator('#upIn').fill(q); await p.locator('#upForm button[type="submit"]').click(); await p.waitForTimeout(800); return (await p.locator('#upLog').innerText()).slice(-1600); };
    const modes = await p.locator('.up-mode').evaluateAll((els) => els.map((e) => e.dataset.mode));
    for (const m of modes) { await p.locator('.up-mode[data-mode="' + m + '"]').click(); await p.waitForTimeout(250); const q = m === 'examiner' ? 'next' : m === 'architect' ? 'Please review my system design for a chat service' : m === 'research' ? 'Help me plan a research study on caching' : m === 'review' ? 'function add(a, b) {\n  var x = a + b\n  return x\n}' : m === 'algo' ? 'Walk through binary search on 3 8 15 21 29 for 21' : m === 'maths' ? 'sum 1 to n' : 'What is a variable?'; const r = await ask(q); ok('professor mode "' + m + '" responds usefully', r.length > 150 && !/do not have a prepared answer/.test(r.slice(-700)), r.slice(-90).replace(/\n/g, ' ')); }
    await p.locator('.up-mode[data-mode="tutor"]').click(); await p.waitForTimeout(250);
    let r = await ask('Hashing is a kind of encryption, right?'); ok('professor detects a misconception and corrects it', /common misconception/i.test(r) && /one-way/.test(r));
    r = await ask('Derive why merge sort is n log n'); ok('professor gives a step-by-step derivation', /recursion tree|Every level costs n/i.test(r));
    r = await ask('What should I study next?'); ok('professor builds a study plan from the student record', /Your study plan/.test(r) && /lessons/.test(r));
    r = await ask('socratic'); r = await ask('recursion'); ok('Socratic mode asks before telling', /What problem does it solve/.test(r));
    r = await ask('socratic off'); r = await ask('Write the solution code for the lab for me'); ok('professor refuses to hand over graded answers', /will not hand over/i.test(r));
    ok('professor states which AI model is connected (4.7)', /Connected to GLM-4\.7 Flash/i.test(await text()));

    /* ---- online runner unavailable (service blocked in this test) ---- */
    const g = await UE(async () => { const U = window.LearnUniversity; await U.loadMod('uni-assess'); const r = await U.assess.grade({ lang: 'rust', out: 'hello\n' }, 'fn main() { println!("hello"); }'); return { pass: r.pass, ungraded: !!r.ungraded, msg: r.msg || '' }; });
    ok('unreachable online runner: result is "not graded", never a pass', g.pass === false && g.ungraded === true && /could not be run|unreachable/i.test(g.msg), g.msg);
    await go('#/uni/labs/go'); await p.locator('[data-a="run"]').first().click(); await p.waitForTimeout(6000); t = await text();
    ok('free lab in an online-only language shows a clear message when the service is down', /offline|unreachable|could not|connection|unavailable/i.test(t), t.slice(-200).replace(/\n/g, ' '));
    ok('Rust assignment is optional, so an unavailable runner cannot block the course', await UE(() => { const U = window.LearnUniversity, c = U.courseById('c405'); return c.labOpt === true && U.labPassed(c) === true && U.labReq(c) === false; }));

    /* ---- compatibility with a v3.0 save (no new keys) ---- */
    await UE(() => { const U = window.LearnUniversity, s = U.st(); ['bm', 'goal', 'cv', 'arena', 'iv'].forEach((k) => delete s[k]); U.save(); });
    await p.reload(); await p.waitForTimeout(900); await go('#/uni/study'); await go('#/uni/dashboard');
    ok('a v3.0-shaped save loads without error and keeps its progress', await UE(() => { const s = window.LearnUniversity.st(); return !!s.lessons['c101:0'] && typeof s.bm === 'object' && (s.exams['final-s1'] || []).length === 2; }));

    /* ---- service worker ---- */
    await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500);
    const keys = await p.evaluate(() => caches.keys()); ok('service worker: only the current cache exists', keys.length === 1 && keys[0] === 'learn-v5.5', keys.join(','));
    const cached = await p.evaluate(async () => { const c = await caches.open('learn-v5.5'); const ks = (await c.keys()).map((r) => new URL(r.url).pathname); return ['uni/uni-campus.js', 'uni/data/departments.js', 'uni/university.js'].every((f) => ks.some((k) => k.endsWith(f))); });
    ok('service worker: new University files are precached', cached);
    await ctx.setOffline(true); await p.goto(BASE + '#/uni/dashboard').catch(() => {}); await p.goto(BASE + '#/uni/departments').catch(() => {}); await p.waitForTimeout(1500); t = await text().catch(() => '');
    ok('offline: departments page works from cache', /Eight departments/.test(t)); await ctx.setOffline(false);

    ok('no JavaScript page errors in the whole run', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();

    /* ---- responsive + accessibility smoke on the new pages ---- */
    for (const [name, vp] of [['phone 390px', { width: 390, height: 844 }], ['tablet 820px', { width: 820, height: 1180 }], ['desktop 1440px', { width: 1440, height: 900 }]]) {
      const c2 = await b.newContext({ viewport: vp }); const q = await c2.newPage(); const e2 = []; q.on('pageerror', (e) => e2.push(e.message.slice(0, 150)));
      await c2.route(/judge0|emkc|piston|wandbox|firebase|googleapis|gstatic|youtube/, (r) => r.abort());
      let worst = 0, where = '', unl = 0;
      for (const h of ['#/uni/departments', '#/uni/departments/game', '#/uni/career', '#/uni/career/role/backend', '#/uni/career/cv', '#/uni/career/interview', '#/uni/career/guide', '#/uni/study', '#/uni/course/ce101', '#/uni/course/ce101/lesson/1', '#/uni/course/mb101/lab', '#/uni/videos', '#/uni/course/c501/lesson/2']) {
        await q.goto(BASE + '#/uni/dashboard'); await q.goto(BASE + h); await q.waitForTimeout(800);
        const m = await q.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, unl: Array.from(document.querySelectorAll('#uMain input, #uMain textarea, #uMain select')).filter((el) => !el.closest('label') && !el.getAttribute('aria-label') && !(el.id && document.querySelector('label[for="' + el.id + '"]'))).length + Array.from(document.querySelectorAll('#uMain button')).filter((x) => !x.textContent.trim() && !x.getAttribute('aria-label')).length }));
        if (m.over > worst) { worst = m.over; where = h; } unl += m.unl;
      }
      ok('responsive ' + name + ': no horizontal page scroll on new pages', worst <= 1, worst + 'px at ' + where);
      ok('responsive ' + name + ': no page errors', e2.length === 0, e2[0]);
      if (name === 'phone 390px') { ok('accessibility smoke: every form control and button on the new pages has a label', unl === 0, unl + ' unlabelled'); await q.goto(BASE + '#/uni/departments'); await q.waitForTimeout(700); await q.screenshot({ path: require('os').tmpdir() + '/u2-phone-depts.png' }); }
      if (name === 'desktop 1440px') { await q.goto(BASE + '#/uni/career/cv'); await q.waitForTimeout(700); await q.screenshot({ path: require('os').tmpdir() + '/u2-desk-cv.png' }); await q.goto(BASE + '#/uni/study'); await q.waitForTimeout(700); await q.screenshot({ path: require('os').tmpdir() + '/u2-desk-study.png', fullPage: true }); }
      await c2.close();
    }
  } catch (e) { R.push('FAIL test script crashed: ' + String(e && e.stack || e).slice(0, 600)); }
  await b.close(); srv.kill();

  /* ---- unit test: cloud-sync merge of University progress (function extracted from index.html) ---- */
  try {
    const src = fs.readFileSync((process.env.APP_DIR || 'app') + '/app.js', 'utf8'); const m = /function mergeUni\(r\) \{[\s\S]*?\n\}\n/.exec(src);
    const run = new Function('S', 'r', m[0] + '; mergeUni(r); return S;');
    const local = { uni: { lessons: { 'c101:0': '2026-11-01' }, labs: { c101: { tries: 3 } }, exams: { c101: [{ at: '2026-11-01', score: 40, pass: false }] }, projects: {}, missed: { 'c101:x1': 2 }, days: ['2026-11-01'], time: 100, name: '' } };
    const remote = { lessons: { 'c101:1': '2026-11-02' }, labs: { c101: { pass: true, at: '2026-11-02', tries: 1 } }, exams: { c101: [{ at: '2026-11-01', score: 40, pass: false }, { at: '2026-11-03', score: 90, pass: true }] }, projects: { c101: { at: '2026-11-03', pct: 70 } }, missed: { 'c101:x1': 1, 'c101:x2': 4 }, days: ['2026-11-02'], time: 50, name: 'Ada' };
    const S = run(local, remote).uni;
    ok('cloud sync merge: union of lessons, no lost attempts, no duplicates, pass preserved', Object.keys(S.lessons).length === 2 && S.labs.c101.pass === true && S.labs.c101.tries === 3 && S.exams.c101.length === 2 && S.projects.c101.pct === 70 && S.missed['c101:x1'] === 2 && S.missed['c101:x2'] === 4 && S.days.length === 2 && S.time === 100 && S.name === 'Ada', JSON.stringify(S).slice(0, 150));
    const S2 = run({ uni: { lessons: { a: '1' } } }, '<script>'); ok('cloud sync merge: hostile or malformed remote data is ignored', Object.keys(S2.uni.lessons).length === 1);
  } catch (e) { R.push('FAIL cloud-sync merge unit test crashed: ' + e.message); }
  console.log(R.join('\n')); console.log(R.filter((x) => x.startsWith('FAIL')).length + ' failed of ' + R.length);
})();
