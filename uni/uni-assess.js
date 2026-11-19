/* ============================================================
   Software Engineering University: assessment module (lazy)
   Labs and exercises (graded against tests), examinations with attempt
   history, projects and portfolio, transcript, certificates.
   Grading reuses the engines already in index.html (gradeLesson, runCodeAsync).
   ============================================================ */
(window.LEARN_MOD_BUILD = window.LEARN_MOD_BUILD || {})['uni-assess'] = '2.0.3'; // must equal BUILD in university.js
(function () {
  'use strict';
  const U = window.LearnUniversity; const A = U.api; const { $, $$, E, md, inline, st, save, shell, link } = U;
  const LAB_LANGS = [['py', 'Python', '🐍'], ['js', 'JavaScript', '🟨'], ['ts', 'TypeScript', '🔷'], ['java', 'Java', '☕'], ['c', 'C', '🇨'], ['cpp', 'C++', '➕'], ['cs', 'C#', '♯'], ['sql', 'SQL', '🗄'], ['go', 'Go', '🐹'], ['rust', 'Rust', '🦀'], ['php', 'PHP', '🐘'], ['ruby', 'Ruby', '💎'], ['swift', 'Swift', '🕊'], ['kotlin', 'Kotlin', '🅺'], ['bash', 'Bash', '⌨'], ['html', 'HTML and CSS', '🌐']];
  const langName = (k) => (LAB_LANGS.find((l) => l[0] === k) || [k, k])[1];
  const isRemote = (lang) => A.STATIC_LANGS.includes(lang);
  const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;

  /* ---------- grading ---------- */
  function htmlChecks(spec, code) {
    let doc; try { doc = new DOMParser().parseFromString(code, 'text/html'); } catch (e) { doc = null; }
    return (spec.checks || []).map((c) => {
      let ok = false; const r = c.rule; let m;
      try {
        if ((m = /^(css|src)\s*~\s*\/(.+)\/([a-z]*)$/.exec(r))) ok = new RegExp(m[2], m[3]).test(code);
        else if ((m = /^(.+?)\s*>=\s*(\d+)$/.exec(r))) ok = !!doc && doc.querySelectorAll(m[1]).length >= +m[2];
        else if ((m = /^(.+?)\s*~\s*\/(.+)\/([a-z]*)$/.exec(r))) { const el = doc && doc.querySelector(m[1]); ok = !!el && new RegExp(m[2], m[3]).test(el.textContent || ''); }
        else ok = !!doc && !!doc.querySelector(r);
      } catch (e) { ok = false; }
      return { label: c.label, setup: '', ok, exp: 'required', got: ok ? 'found' : 'missing' };
    });
  }
  async function grade(spec, code) {
    const lang = spec.lang; const blank = { pass: false, run: { out: '', error: null }, results: [] };
    if (!String(code || '').trim()) return Object.assign(blank, { msg: 'There is no code to grade yet.' });
    if (lang === 'html') { const results = htmlChecks(spec, code); const pass = results.length > 0 && results.every((r) => r.ok); return { pass, run: null, results, html: true, msg: pass ? null : 'Some requirements are not met yet. The list below shows which.' }; }
    if (lang === 'sql') return A.gradeLesson('sql', { setup: spec.setup || '', check: { rows: spec.rows || [], ordered: spec.ordered !== false } }, code, '');
    if (isRemote(lang)) {
      if (spec.out === undefined) return Object.assign(blank, { ungraded: true, msg: 'This task has no automatic check.' });
      const r = await A.runCodeAsync(lang, code, '');
      if (r.offline) return { pass: false, ungraded: true, run: r, results: [], msg: 'Your code could not be run, because ' + langName(lang) + ' runs on an online service that is unreachable right now. Nothing was graded and your work is saved. Try again when you are online.' };
      if (r.error) return { pass: false, run: r, results: [], msg: 'Your code has an error. Read the message in the output panel, fix it, and submit again.' };
      const ok = A.normalizeOut(r.out) === A.normalizeOut(spec.out);
      return ok ? { pass: true, run: r, results: [] } : { pass: false, run: r, results: [], msg: 'The program ran, but its output is not what the task asks for.', expected: spec.out, got: r.out };
    }
    if (!(spec.tests && spec.tests.length) && spec.out === undefined) return Object.assign(blank, { ungraded: true, msg: 'This task has no automatic check.' });
    return A.gradeLesson(lang, { check: spec.tests && spec.tests.length ? { tests: spec.tests } : { out: spec.out }, solution: spec.solution || '', starter: spec.starter || '' }, code, '');
  }
  function verdictHtml(g) {
    if (g.ungraded) return '<div class="verdict no" role="status"><strong>Not graded</strong>' + E(g.msg) + '</div>';
    let h = g.pass ? '<div class="verdict ok" role="status"><strong>✓ All checks passed</strong>Your submission meets every test.</div>' : '<div class="verdict no" role="status"><strong>Not passing yet</strong>' + E(g.msg || 'Keep going.') + (g.expected !== undefined ? '<pre>Expected:\n' + E(g.expected) + '\n\nYour output:\n' + E(g.got || '(nothing)') + '</pre>' : '') + '</div>';
    if (g.results && g.results.length) h += A.testsHtml(g.results);
    return h;
  }

  /* ---------- code task component (labs, lesson exercises, exam code items, free labs) ---------- */
  // opts: { saveKey, onPass, graded (bool), compact, onChange }
  function mountTask(host, spec, opts) {
    opts = opts || {}; const u = st(); const lang = spec.lang; const html = lang === 'html';
    const saved = opts.saveKey && typeof u.scratch[opts.saveKey] === 'string' ? u.scratch[opts.saveKey] : null;
    const start = saved !== null ? saved : (spec.starter || '');
    host.innerHTML = '<div class="u-task"><div class="u-ed"></div>' + (html ? '' : '') +
      '<div class="u-taskbar"><button type="button" class="btn small" data-a="run">▶ ' + (html ? 'Preview' : 'Run') + '</button>' + (opts.graded === false ? '' : '<button type="button" class="btn small primary" data-a="submit">✓ Submit for grading</button>') + (spec.hints && spec.hints.length ? '<button type="button" class="btn small" data-a="hint">💡 Hint</button>' : '') + '<button type="button" class="btn small" data-a="reset">Reset</button><span class="pill u-saved" aria-live="polite"></span></div>' +
      (isRemote(lang) ? '<p class="u-fine">' + E(langName(lang)) + ' runs on a free online service, so running and grading need an internet connection. If the service is unreachable, nothing is graded.</p>' : '') +
      '<div class="u-hints" aria-live="polite"></div>' + (html ? '<iframe class="u-preview" title="Preview of your page" sandbox=""></iframe>' : A.outHolder) + '<div class="u-result" aria-live="polite"></div></div>';
    const realOk = lang === 'py' && opts.graded === false; // real Python is offered only where nothing is graded
    if (realOk) { const eng = (st().pyEngine === 'real') ? 'real' : 'teach'; $('.u-taskbar', host).insertAdjacentHTML('beforeend', '<label class="u-eng">Engine <select data-eng aria-label="Python engine"><option value="teach"' + (eng === 'teach' ? ' selected' : '') + '>Learn teaching engine (offline)</option><option value="real"' + (eng === 'real' ? ' selected' : '') + '>Real Python 3 (Pyodide)</option></select></label>'); $('.u-taskbar', host).insertAdjacentHTML('afterend', '<p class="u-fine u-engnote" aria-live="polite"></p><label class="u-stdin"' + (eng === 'real' ? '' : ' hidden') + '>Input for <code>input()</code>, one line per call<textarea rows="2" spellcheck="false" autocapitalize="off"></textarea></label>'); }
    let busy = false, hintN = 0, saveT = null;
    const outEl = $('.out', host), resEl = $('.u-result', host), savedEl = $('.u-saved', host);
    const engNote = (t) => { const n = $('.u-engnote', host); if (n) n.textContent = t; };
    const realPy = async () => { await U.loadMod('realpy'); return window.LearnRealPython; };
    if (realOk) {
      const sel = $('[data-eng]', host);
      const explain = () => { const real = sel.value === 'real'; $('.u-stdin', host).hidden = !real; engNote(real ? 'Real Python runs the full language in your browser. The first time, about 7 MB is downloaded from the jsDelivr CDN; after that it is kept on this device. It is for experimenting only: graded assignments always use the Learn teaching engine.' : 'The Learn teaching engine runs the part of Python the lessons use, instantly and offline.'); };
      sel.addEventListener('change', async () => { st().pyEngine = sel.value; save(); explain();
        if (sel.value === 'real') { try { const R = await realPy(); engNote('Downloading Python…'); await R.load(); engNote('Real Python ' + (R.version || '3') + ' is ready.'); } catch (e) { sel.value = 'teach'; st().pyEngine = 'teach'; save(); explain(); engNote('Real Python could not be downloaded. You may be offline, or this network may block cdn.jsdelivr.net. Using the Learn teaching engine; try again later.'); console.warn('Real Python:', e); } } });
      explain();
    }
    const persist = (v) => { if (!opts.saveKey) return; clearTimeout(saveT); saveT = setTimeout(() => { const s = st(); s.scratch[opts.saveKey] = String(v).slice(0, 60000); save(); if (savedEl.isConnected) savedEl.textContent = 'Saved'; }, 500); if (savedEl) savedEl.textContent = ''; };
    const ed = A.mountEditor($('.u-ed', host), lang, start, () => run(), (v) => { persist(v); if (opts.onChange) opts.onChange(v); });
    // 5.1: AI hints on try-its, assignments, studio projects and the open lab; never in examinations, mock or practice interviews
    if (A.aiPanel && (opts.compact || /^(lab|free|studio):/.test(opts.saveKey || ''))) {
      const graded = !opts.compact && !/^free:/.test(opts.saveKey || '');
      $('.u-taskbar', host).insertAdjacentHTML('beforeend', '<button type="button" class="btn small u-aibtn">🤖 Ask AI</button>'); $('.u-hints', host).insertAdjacentHTML('beforebegin', '<div class="u-ai"></div>');
      A.aiPanel($('.u-aibtn', host), $('.u-ai', host), { title: 'Ask the AI about your code', placeholder: 'e.g. Why does my test fail?', fallback: spec.hints && spec.hints.length ? 'Use Hint instead.' : '',
        fine: graded ? 'This is graded work, so the AI only gives hints, never the solution. AI answers can be wrong.' : 'The AI gets the exercise, your code and the last output. AI answers can be wrong.',
        system: 'You are a tutor at a self-study software-engineering university. Exercise (' + langName(lang) + '): ' + A.aiPlain(spec.prompt || spec.title || spec.md || '') + (graded ? ' This is GRADED work: give one short hint only. Never write the corrected program or the answer.' : ' Give a short hint first; do not write the full solution.') + ' Answer in under 150 words.',
        user: (q) => A.aiCodeMsg(q, ed.get(), outEl ? outEl.innerText : '', 'Help me with this exercise.') });
    }
    const fn = $('.fname', host); if (fn && html) fn.textContent = 'index.html';
    async function run() {
      if (busy) return; const code = ed.get();
      if (html) { const fr = $('.u-preview', host); fr.srcdoc = code; return; }
      const t0 = performance.now(); busy = true;
      if (isRemote(lang)) outEl.innerHTML = '<div class="lab">OUTPUT</div><div class="dim">Running online…</div>';
      if (realOk && $('[data-eng]', host).value === 'real') {
        outEl.innerHTML = '<div class="lab">OUTPUT</div><div class="dim">' + (window.LearnRealPython && window.LearnRealPython.state === 'ready' ? 'Running real Python…' : 'Loading real Python (the first time this downloads about 7 MB)…') + '</div>';
        let r; try { const R = await realPy(); r = await R.run(code, ($('.u-stdin textarea', host) || {}).value || '', 10000); if (r.timeout) engNote('That run was stopped after 10 seconds.'); }
        catch (e) { $('[data-eng]', host).value = 'teach'; st().pyEngine = 'teach'; save(); $('.u-stdin', host).hidden = true; engNote('Real Python could not be loaded, so the lab switched back to the Learn teaching engine. Press Run again.'); console.warn('Real Python:', e); r = { out: '', error: 'Real Python is not available right now.' }; }
        finally { busy = false; }
        A.showOut(outEl, { out: r.out || '', error: r.error || null }, lang, performance.now() - t0); return;
      }
      let r; try { r = await A.runCodeAsync(lang, code, '', spec.setup || undefined); } catch (e) { r = { out: '', error: String(e && e.message || e) }; } finally { busy = false; }
      A.showOut(outEl, r || { out: '', error: null }, lang, performance.now() - t0);
    }
    async function submit() {
      if (busy) return; busy = true; const b = $('[data-a="submit"]', host); const old = b.innerHTML; b.disabled = true; b.textContent = 'Grading…'; resEl.innerHTML = '';
      let g; try { g = await grade(spec, ed.get()); } catch (e) { g = { pass: false, results: [], msg: 'Grading stopped with an internal error: ' + (e && e.message || e) }; } finally { busy = false; b.disabled = false; b.innerHTML = old; }
      if (g.run && outEl) A.showOut(outEl, g.run, lang); if (html) $('.u-preview', host).srcdoc = ed.get();
      resEl.innerHTML = verdictHtml(g);
      if (opts.onResult) opts.onResult(g); if (g.pass && opts.onPass) opts.onPass(g);
    }
    host.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b || !host.contains(b)) return; const a = b.dataset.a;
      if (a === 'run') run(); else if (a === 'submit') submit();
      else if (a === 'reset') { if (confirm('Replace your code with the starting code?')) { ed.set(spec.starter || ''); persist(spec.starter || ''); resEl.innerHTML = ''; } }
      else if (a === 'hint') { const hs = spec.hints || []; if (hintN < hs.length) hintN++; $('.u-hints', host).innerHTML = hs.slice(0, hintN).map((x, i) => '<p class="u-hint"><b>Hint ' + (i + 1) + ' of ' + hs.length + '.</b> ' + inline(x) + '</p>').join('') + (hintN >= hs.length ? '<p class="pill">Those are all the hints. The professor will not hand over the full answer, but it can explain any idea you are missing.</p>' : ''); }
    });
    if (html) $('.u-preview', host).srcdoc = start;
    return { get: () => ed.get(), run, submit };
  }
  function mountTry(host, spec, key, onPass) { return mountTask(host, spec, { saveKey: key, onPass, compact: true }); }

  function completeCourseCheck(c) { // award once, when the last requirement lands
    const u = st(); if (U.courseDone(c) && !u.certs['course:' + c.id]) { u.certs['course:' + c.id] = A.dayStr(new Date()); const xp = A.addXp(50); save(); A.confetti(); A.toast('🎓 ' + E(c.code) + ' completed' + (xp ? ' · +' + xp + ' XP' : '')); } }

  /* ---------- course lab ---------- */
  function labView(c, data) {
    const lab = data.lab; const crumbs = [['University', []], ['Courses', ['courses']], [c.code, ['course', c.id]], ['Assignment']];
    if (!lab) { shell('courses', '<div class="card"><p>This course has no programming assignment.</p></div>', crumbs); return; }
    if (!U.courseUnlocked(c)) { shell('courses', '<div class="u-lockmsg">🔒 ' + E(U.whyLocked(c)) + '</div>', crumbs); return; }
    const rec = st().labs[c.id] || {};
    shell('courses', '<article class="u-lab"><header><p class="u-eyebrow">' + E(c.code) + ' · Programming assignment · ' + E(langName(lab.lang)) + '</p><h1>' + E(lab.title) + '</h1><p class="pill" id="labState">' + (rec.pass ? 'Passed ✓ on ' + E(rec.at || '') : 'Graded by ' + (lab.lang === 'html' ? 'requirement checks' : lab.tests ? lab.tests.length + ' test cases, including edge cases' : 'comparing program output') + '. Running the code is not the same as passing.') + '</p></header><div class="u-prose">' + md(lab.md) + '</div><div id="labHost"></div><p>' + link(['course', c.id], '← Back to the course', 'btn small') + ' ' + link(['professor', c.id, 'lab'], '🤖 Ask the professor', 'btn small') + '</p></article>', crumbs);
    mountTask($('#labHost'), lab, { saveKey: 'lab:' + c.id, onResult: (g) => { if (g.ungraded) return; const u = st(); const r = u.labs[c.id] = u.labs[c.id] || {}; r.tries = (r.tries || 0) + 1; if (g.pass && !r.pass) { r.pass = true; r.at = A.dayStr(new Date()); U.markStudy(); A.addXp(20); $('#labState').textContent = 'Passed ✓ on ' + r.at; } save(); if (g.pass) completeCourseCheck(c); } });
  }

  /* ---------- examination engine ---------- */
  const WEIGHT = { mc: 1, code: 3, written: 2 };
  function shuffled(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function runExam(cfg) { // { id, title, sub, items, min, pass, crumbs, back, onPass }
    const items = cfg.items.map((it) => Object.assign({}, it, it.type === 'mc' ? { order: shuffled(it.o.map((_, i) => i)) } : {}));
    const prev = U.attempts(cfg.id);
    let h = '<article class="u-exam"><header><p class="u-eyebrow">' + E(cfg.sub) + '</p><h1>' + E(cfg.title) + '</h1><div class="ux-meta"><span>' + items.length + ' questions</span><span>Suggested time ' + cfg.min + ' min</span><span>Pass mark ' + cfg.pass + '%</span><span class="ux-timer" id="uxTimer" aria-label="Time used">0:00</span></div><p class="u-fine">Closed-book is the honest way to sit this. Multiple-choice and programming questions are marked automatically; written answers are marked by you against a published rubric, and the transcript labels them as self-assessed. You may retake the examination; every attempt is recorded' + (prev.length ? ' (' + prev.length + ' so far, best ' + U.bestOf(cfg.id) + '%)' : '') + '.</p></header><form id="uxForm" novalidate>';
    items.forEach((it, i) => {
      h += '<section class="ux-item" data-i="' + i + '"><h2><span class="ux-n">Question ' + (i + 1) + '</span><span class="ux-pts">' + WEIGHT[it.type] + ' mark' + (WEIGHT[it.type] === 1 ? '' : 's') + (it.from ? ' · ' + E(it.from) : '') + '</span></h2>';
      if (it.type === 'mc') h += '<fieldset><legend>' + U.qText(it.q) + '</legend>' + it.order.map((oi) => '<label class="ux-opt"><input type="radio" name="q' + i + '" value="' + oi + '"><span>' + inline(it.o[oi]) + '</span></label>').join('') + '</fieldset>';
      else if (it.type === 'written') h += '<label class="ux-wl" for="w' + i + '">' + U.qText(it.q) + '</label><textarea id="w' + i + '" class="ux-text" rows="7" maxlength="6000" placeholder="Write your answer in full sentences."></textarea><p class="pill ux-wc" data-wc="' + i + '">0 words · at least 40 needed to be marked</p>';
      else h += '<div class="ux-cq">' + U.qText(it.q) + '<p class="pill">' + E(langName(it.lang)) + ' · marked by running hidden-from-view test cases when you submit</p></div><div class="ux-code" data-code="' + i + '"></div>';
      h += '</section>';
    });
    h += '<div class="ux-submit"><button type="submit" class="btn primary">Submit examination</button> ' + link(cfg.back, 'Leave without submitting', 'btn small') + '<p class="pill" id="uxWarn" role="alert"></p></div></form></article>';
    shell('exams', h, cfg.crumbs);
    const t0 = Date.now(); const tm = setInterval(() => { const el = $('#uxTimer'); if (!el) return clearInterval(tm); const s = Math.floor((Date.now() - t0) / 1000); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);
    const eds = {}; items.forEach((it, i) => { if (it.type === 'code') eds[i] = mountTask($('[data-code="' + i + '"]'), it, { graded: false }); });
    $$('.ux-text').forEach((t) => t.addEventListener('input', () => { const i = t.id.slice(1); $('[data-wc="' + i + '"]').textContent = words(t.value) + ' words · at least 40 needed to be marked'; }));
    let confirmed = false;
    $('#uxForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const ans = items.map((it, i) => (it.type === 'mc' ? (($('input[name="q' + i + '"]:checked') || {}).value) : it.type === 'written' ? $('#w' + i).value : eds[i].get()));
      const blank = ans.filter((a, i) => a === undefined || (items[i].type !== 'mc' && !String(a).trim())).length;
      if (blank && !confirmed) { confirmed = true; $('#uxWarn').textContent = blank + ' question' + (blank === 1 ? ' is' : 's are') + ' unanswered. Press Submit again to hand in anyway.'; return; }
      clearInterval(tm); const secs = Math.floor((Date.now() - t0) / 1000);
      const btn = $('#uxForm button[type="submit"]'); btn.disabled = true; btn.textContent = 'Marking…';
      const res = [];
      for (let i = 0; i < items.length; i++) { const it = items[i];
        if (it.type === 'mc') res.push({ ok: ans[i] !== undefined && +ans[i] === it.a, pts: ans[i] !== undefined && +ans[i] === it.a ? 1 : 0, max: 1 });
        else if (it.type === 'code') { let g; try { g = await grade(it, ans[i]); } catch (e) { g = { pass: false, msg: 'Internal grading error.' }; } res.push({ ok: !!g.pass, pts: g.pass ? WEIGHT.code : 0, max: g.ungraded ? 0 : WEIGHT.code, g }); }
        else res.push({ pts: 0, max: WEIGHT.written, written: true, short: words(ans[i]) < 40 });
      }
      results(cfg, items, ans, res, secs);
    });
  }
  function results(cfg, items, ans, res, secs) {
    const hasW = res.some((r) => r.written && !r.short);
    const score = () => { const max = res.reduce((n, r) => n + r.max, 0); return max ? Math.round(res.reduce((n, r) => n + r.pts, 0) / max * 100) : 0; };
    let h = '<article class="u-exam"><header><p class="u-eyebrow">' + E(cfg.sub) + ' · results</p><h1>' + E(cfg.title) + '</h1><div id="uxScore" aria-live="polite"></div></header>';
    if (hasW) h += '<div class="card ux-self"><h2>Mark your written answers</h2><p>An automatic marker cannot judge an argument the way a human examiner can, so this part is transparent self-assessment. Read each rubric line and tick it only if your answer clearly does it. Your transcript will show that this examination contains self-assessed marks.</p></div>';
    items.forEach((it, i) => { const r = res[i];
      h += '<section class="ux-item ux-rev ' + (r.written ? '' : r.ok ? 'ok' : 'no') + '"><h2><span class="ux-n">Question ' + (i + 1) + '</span><span class="ux-pts">' + (r.written ? 'written' : r.ok ? '✓ correct' : r.max === 0 ? 'not graded' : '✗ incorrect') + '</span></h2>';
      if (it.type === 'mc') h += U.qText(it.q) + '<ul class="ux-revopts">' + it.o.map((o, oi) => '<li class="' + (oi === it.a ? 'right' : ans[i] !== undefined && +ans[i] === oi ? 'wrong' : '') + '">' + inline(o) + (oi === it.a ? ' <b>(correct answer)</b>' : ans[i] !== undefined && +ans[i] === oi ? ' <b>(your answer)</b>' : '') + '</li>').join('') + '</ul><p class="u-why">' + inline(it.why || '') + '</p>';
      else if (it.type === 'code') h += U.qText(it.q) + '<pre class="u-code"><code>' + E(ans[i] || '(no code submitted)') + '</code></pre>' + (r.g ? (r.g.ungraded ? '<div class="verdict no"><strong>Not graded</strong>' + E(r.g.msg) + ' This question is left out of your total.</div>' : r.g.pass ? '<div class="verdict ok"><strong>✓ All tests passed</strong></div>' : '<div class="verdict no"><strong>Tests failed</strong>' + E(r.g.msg || '') + '</div>' + (r.g.results && r.g.results.length ? A.testsHtml(r.g.results) : '')) : '');
      else h += U.qText(it.q) + '<blockquote class="ux-ans">' + (String(ans[i] || '').trim() ? E(ans[i]) : '<i>No answer written.</i>') + '</blockquote>' + (r.short ? '<p class="pill">Under 40 words, so this answer scores 0.</p>' : '<fieldset class="ux-rub" data-rub="' + i + '"><legend>Rubric: tick what your answer clearly does</legend>' + it.rubric.map((c, ci) => '<label><input type="checkbox" data-ci="' + ci + '"><span>' + inline(c) + '</span></label>').join('') + '</fieldset>');
      h += '</section>';
    });
    h += '<div class="ux-submit" id="uxFinal">' + (hasW ? '<button type="button" class="btn primary" id="uxFin">Record this attempt</button>' : '') + '</div></article>';
    shell('exams', h, cfg.crumbs);
    const record = () => {
      if (hasW) items.forEach((it, i) => { if (it.type === 'written' && !res[i].short) { const boxes = $$('[data-rub="' + i + '"] input'); const n = boxes.filter((b) => b.checked).length; res[i].pts = boxes.length ? WEIGHT.written * n / boxes.length : 0; boxes.forEach((b) => { b.disabled = true; }); } });
      const sc = score(), pass = sc >= cfg.pass; const u = st(); if (!Array.isArray(u.exams[cfg.id])) u.exams[cfg.id] = [];
      const first = !u.exams[cfg.id].some((a) => a.pass); const before = U.bestOf(cfg.id);
      u.exams[cfg.id].push({ at: A.dayStr(new Date()), score: sc, pass, secs, self: res.some((r) => r.written) }); u.exams[cfg.id] = u.exams[cfg.id].slice(-50);
      items.forEach((it, i) => { if (it.type === 'mc' && !res[i].ok && it.key) { u.missed[it.key] = (u.missed[it.key] || 0) + 1; U.srsMiss(it.key); } });
      U.markStudy(); if (pass && first) A.addXp(cfg.xp || 30); save();
      const ung = res.filter((r) => r.g && r.g.ungraded).length;
      $('#uxScore').innerHTML = '<div class="ux-score ' + (pass ? 'pass' : 'fail') + '">' + U.ring(sc, 'Score ' + sc + ' percent') + '<div><b>' + (pass ? 'Passed' : 'Not passed') + '</b><p>' + sc + '% · pass mark ' + cfg.pass + '% · time ' + Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s' + (u.exams[cfg.id].length > 1 ? ' · previous best ' + before + '%' : '') + '</p><p>' + (pass ? 'Well done. Read the explanations below anyway; they are part of learning.' : 'Review the explanations below, revisit the lessons, and sit it again when you are ready. Retakes are unlimited.') + '</p>' + (ung ? '<p class="u-fine"><b>' + ung + ' programming question' + (ung === 1 ? ' was' : 's were') + ' not graded</b> because the online code runner could not be reached. ' + (ung === 1 ? 'It was' : 'They were') + ' left out of the total and earned no marks; nothing was counted as correct. Retake when you are online to have ' + (ung === 1 ? 'it' : 'them') + ' marked.</p>' : '') + '<p class="u-fine">How this was marked: multiple choice ' + WEIGHT.mc + ' mark each (automatic), programming ' + WEIGHT.code + ' marks each (automatic tests), written ' + WEIGHT.written + ' marks each (self-assessed against the rubric).</p></div></div>';
      $('#uxFinal').innerHTML = link(cfg.back, 'Continue →', 'btn primary') + ' ' + link(cfg.retake, 'Retake', 'btn small');
      if (pass) { A.confetti(); if (cfg.onPass) cfg.onPass(); }
      window.scrollTo(0, 0);
    };
    if (hasW) $('#uxFin').addEventListener('click', record); else record();
  }
  function examView(c, data) {
    const crumbs = [['University', []], ['Courses', ['courses']], [c.code, ['course', c.id]], ['Examination']];
    if (!data.exam || !data.exam.items.length) { shell('exams', '<div class="card"><p>This course has no examination.</p></div>', crumbs); return; }
    if (!U.courseUnlocked(c) || U.lessonsDone(c) < c.n) { shell('exams', '<div class="u-lockmsg">🔒 The examination opens when every lesson in the course is complete (' + U.lessonsDone(c) + ' of ' + c.n + ' done).</div><p>' + link(U.nextStep(c).path, 'Continue the course →', 'btn primary') + '</p>', crumbs); return; }
    runExam({ id: c.id, title: c.title + ': course examination', sub: c.code + ' · Stage ' + c.stage, items: data.exam.items.map((it, i) => Object.assign({ key: c.id + ':x' + i }, it)), min: data.exam.min, pass: U.PASS, crumbs, back: ['course', c.id], retake: ['course', c.id, 'exam'], onPass: () => completeCourseCheck(c) });
  }
  U.lazy.final = async function (path) {
    const s = U.stageById(path[1]); const crumbs = [['University', []], ['Exams', ['exams']], ['Stage ' + (s ? s.id : '') + ' final']];
    if (!s) return U.lazy.exams(['exams']);
    if (!U.stageUnlocked(s.id)) { shell('exams', '<div class="u-lockmsg">🔒 Pass the Stage ' + (s.id - 1) + ' final examination first.</div><p>' + link(['final', String(s.id - 1)], 'Go to the Stage ' + (s.id - 1) + ' final', 'btn primary') + '</p>', crumbs); return; }
    U.loading('exams', crumbs);
    const cs = U.coursesOf(s.id); try { await Promise.all(Array.from(new Set(cs.map((c) => c.file))).map(U.loadFile)); } catch (e) { shell('exams', U.offlineHtml(), crumbs); return U.bindRetry(); }
    if (U.path !== path) return;
    let items = []; const codes = [], writ = [];
    cs.forEach((c) => { const ex = (U.content[c.id] || {}).exam; if (!ex) return; const mc = ex.items.map((it, i) => Object.assign({ key: c.id + ':x' + i, from: c.code }, it));
      items = items.concat(shuffled(mc.filter((x) => x.type === 'mc')).slice(0, 3)); codes.push(...mc.filter((x) => x.type === 'code')); writ.push(...mc.filter((x) => x.type === 'written')); });
    items = shuffled(items).concat(shuffled(codes).slice(0, 2)).concat(shuffled(writ).slice(0, 1));
    runExam({ id: U.finalId(s.id), title: 'Stage ' + s.id + ' final examination: ' + s.title, sub: s.level + ' · questions from all ' + cs.length + ' courses', items, min: Math.max(30, Math.round(items.length * 1.8)), pass: U.FINAL_PASS, xp: 100, crumbs, back: ['stage', String(s.id)], retake: ['final', String(s.id)],
      onPass: () => { A.toast('🎓 Stage ' + s.id + ' final passed' + (s.id < U.cat.stages.length ? '. Stage ' + (s.id + 1) + ' is now open.' : '.')); } });
  };
  U.lazy.exams = function () {
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Examinations</p><h1>Assessment record</h1><p>Every course ends with an examination, and every stage with a final that samples all of its courses. Difficulty rises with each stage. You advance by passing, not by pressing Next, and you can retake anything.</p></section>';
    U.cat.stages.forEach((s) => {
      const fid = U.finalId(s.id), fa = U.attempts(fid);
      h += '<h2 class="u-h2">Stage ' + s.id + ' · ' + E(s.title) + '</h2><div class="u-tablewrap"><table class="u-table u-examtable"><thead><tr><th>Examination</th><th>Status</th><th>Attempts</th><th>First</th><th>Best</th><th></th></tr></thead><tbody>' +
        U.coursesOf(s.id).map((c) => { const at = U.attempts(c.id), ready = U.courseUnlocked(c) && U.lessonsDone(c) === c.n; return '<tr><td>' + link(['course', c.id], E(c.code + ' ' + c.title)) + '</td><td>' + (U.examPassed(c) ? '<span class="uc-state done">Passed</span>' : ready ? '<span class="uc-state prog">Ready</span>' : '<span class="uc-state lock">' + (U.courseUnlocked(c) ? U.lessonsDone(c) + '/' + c.n + ' lessons' : 'Locked') + '</span>') + '</td><td>' + at.length + '</td><td>' + (at.length ? at[0].score + '%' : '–') + '</td><td>' + (at.length ? U.bestOf(c.id) + '%' : '–') + '</td><td>' + (ready ? link(['course', c.id, 'exam'], at.length ? 'Retake' : 'Sit', 'btn small') : '') + '</td></tr>'; }).join('') +
        '<tr class="ux-finalrow"><td><b>Stage ' + s.id + ' final examination</b></td><td>' + (U.finalPassed(s.id) ? '<span class="uc-state done">Passed</span>' : U.stageUnlocked(s.id) ? '<span class="uc-state prog">Open</span>' : '<span class="uc-state lock">Locked</span>') + '</td><td>' + fa.length + '</td><td>' + (fa.length ? fa[0].score + '%' : '–') + '</td><td>' + (fa.length ? U.bestOf(fid) + '%' : '–') + '</td><td>' + (U.stageUnlocked(s.id) ? link(['final', String(s.id)], fa.length ? 'Retake' : 'Sit', 'btn small') : '') + '</td></tr></tbody></table></div>';
    });
    shell('exams', h, [['University', []], ['Examinations']]);
  };

  /* ---------- projects and portfolio ---------- */
  const LEVELS = [['0', 'Not yet'], ['0.5', 'Partly'], ['1', 'Fully']];
  const safeUrl = (t) => { t = String(t || '').trim(); return /^https:\/\/[\w.-]+(\/[^\s<>"']*)?$/.test(t) && t.length < 300 ? t : ''; };
  // Five milestones for any project, built from its own requirements and deliverables.
  function milestones(c, p) {
    const req = p.requirements || [], del = p.deliverables || []; const half = Math.max(1, Math.ceil(req.length / 2));
    const short = (t) => { const s = String(t).replace(/[`*]/g, ''); return s.length > 90 ? s.slice(0, 87).replace(/\s+\S*$/, '') + '…' : s; };
    const list = (a) => a.map(short).join('; ');
    return [
      ['Plan', 'Read the brief and the rubric. Write a one-page plan: scope, the main design decisions, the risks, and what you will build first. Create the repository.'],
      ['First working slice', 'Build the smallest version that runs end to end, covering: ' + list(req.slice(0, half)) + '.'],
      ['Complete the requirements', req.length > half ? 'Add the rest: ' + list(req.slice(half)) + '.' : 'Harden the first slice: handle invalid input and failure cases for every requirement.'],
      ['Test and gather evidence', 'Run and record your tests and measurements, and produce the deliverables: ' + list(del) + '.'],
      ['Review and submit', 'Review the work against every rubric line as a strict reviewer would, fix what falls short, write your ' + (c.capstone ? 'explanation of engineering decisions' : 'reflection') + ', and submit.'],
    ];
  }
  function projectView(c, data) {
    const p = data.project; const crumbs = [['University', []], ['Courses', ['courses']], [c.code, ['course', c.id]], ['Project']];
    if (!p) { shell('projects', '<div class="card"><p>This course has no project.</p></div>', crumbs); return; }
    if (!U.courseUnlocked(c)) { shell('projects', '<div class="u-lockmsg">🔒 ' + E(U.whyLocked(c)) + '</div>', crumbs); return; }
    const rec = st().projects[c.id] || {}; const minWords = c.capstone ? 150 : 40;
    let h = '<article class="u-project"><header><p class="u-eyebrow">' + E(c.code) + ' · ' + (c.capstone ? 'Capstone project' : 'Course project') + '</p><h1>' + E(p.title) + '</h1><p class="pill">' + (rec.at ? 'Submitted ' + E(rec.at) + ' · self-assessed ' + (+rec.pct || 0) + '%' : 'Build this outside the browser or in the Learn workspace, then record your evidence here.') + '</p></header><div class="u-prose">' + md(p.md) + '</div>' +
      '<h2 class="u-h2">Objectives</h2><p class="pill">This project is where you show, in one piece of work, that you can do what the course teaches.</p><ul class="u-out">' + (c.obj || []).map((x) => '<li>' + E(x) + '</li>').join('') + '</ul>' +
      '<form id="upForm" novalidate><h2 class="u-h2">Milestones</h2><p class="pill">A suggested order of work. Tick each as you reach it; milestones are saved with your draft and are for your own planning.</p><div class="up-list" id="upMs">' + milestones(c, p).map((m, i) => '<label><input type="checkbox" data-ms="' + i + '"' + (rec.ms && rec.ms[i] ? ' checked' : '') + '><span><b>Milestone ' + (i + 1) + ': ' + E(m[0]) + '.</b> ' + E(m[1]) + '</span></label>').join('') + '</div>' +
      '<h2 class="u-h2">Requirements</h2><p class="pill">Tick each one only when your project really does it.</p><div class="up-list">' + (p.requirements || []).map((r, i) => '<label><input type="checkbox" data-req="' + i + '"' + (rec.req && rec.req[i] ? ' checked' : '') + '><span>' + inline(r) + '</span></label>').join('') + '</div>' +
      '<h2 class="u-h2">Deliverables</h2><div class="up-list">' + (p.deliverables || []).map((r, i) => '<label><input type="checkbox" data-del="' + i + '"' + (rec.del && rec.del[i] ? ' checked' : '') + '><span>' + inline(r) + '</span></label>').join('') + '</div>' +
      '<h2 class="u-h2">Evidence</h2><label class="up-f">Link to your repository or live demo (optional, must start with https://)<input type="url" id="upUrl" maxlength="300" placeholder="https://github.com/you/project" value="' + E(rec.url || '') + '"></label>' +
      '<label class="up-f">' + (c.capstone ? 'Explain your engineering decisions: what you built, the main trade-offs, what you would change (at least ' + minWords + ' words)' : 'Reflection: what you built and what you learned (at least ' + minWords + ' words)') + '<textarea id="upNotes" rows="7" maxlength="8000">' + E(rec.notes || '') + '</textarea></label><p class="pill" id="upWc"></p>' +
      '<h2 class="u-h2">Self-assessment rubric</h2><p class="pill">There is no human marker here. Grade yourself as a strict reviewer would; the transcript labels project marks as self-assessed.</p><div class="up-rub">' + (p.rubric || []).map((r, i) => '<fieldset><legend>' + inline(r.c) + ' <small>(' + r.pts + ' marks)</small></legend>' + LEVELS.map((lv) => '<label><input type="radio" name="rub' + i + '" value="' + lv[0] + '"' + (rec.rub && String(rec.rub[i]) === lv[0] ? ' checked' : '') + '><span>' + lv[1] + '</span></label>').join('') + '</fieldset>').join('') + '</div>' +
      '<h2 class="u-h2">Submission guidance</h2><ul class="u-out"><li>Keep the work in a version-controlled repository with a README that says what it is, how to run it and how to run its tests.</li><li>Collect evidence as you go: test output, screenshots, measurements and the documents listed under Deliverables.</li><li>Nothing is uploaded from this page. Your project stays wherever you keep it; this form records your checklist, an optional link, your explanation and your self-assessment on this device.</li><li>If you add a link, make sure it shows nothing private, and never commit passwords or keys.</li><li>You may update a submission later. The most recent one is shown in your portfolio and transcript.</li></ul>' +
      '<h2 class="u-h2">Completion criteria</h2><p>The project is recorded as complete when all of these are true:</p><ol class="u-out"><li>Every requirement is ticked (' + (p.requirements || []).length + ').</li><li>Every deliverable is ticked (' + (p.deliverables || []).length + ').</li><li>Your explanation has at least ' + minWords + ' words.</li><li>You have chosen a level for each of the ' + (p.rubric || []).length + ' rubric lines.</li></ol><p class="pill">The mark is your own assessment. It appears on the transcript labelled as self-assessed, because nobody else has examined the work.' + (c.capstone ? ' A capstone is required for its stage certificate.' : '') + '</p>' +
      '<div class="ux-submit"><button type="submit" class="btn primary">' + (rec.at ? 'Update submission' : 'Submit project') + '</button> <button type="button" class="btn small" id="upDraft">Save draft</button> ' + link(['course', c.id], '← Course', 'btn small') + '<p class="pill" id="upMsg" role="alert"></p></div></form></article>';
    shell('projects', h, crumbs);
    const read = () => ({ ms: $$('[data-ms]').map((b) => b.checked), req: $$('[data-req]').map((b) => b.checked), del: $$('[data-del]').map((b) => b.checked), url: $('#upUrl').value.trim(), notes: $('#upNotes').value.slice(0, 8000), rub: (p.rubric || []).map((_, i) => { const x = $('input[name="rub' + i + '"]:checked'); return x ? x.value : null; }) });
    const wc = () => { $('#upWc').textContent = words($('#upNotes').value) + ' words'; }; wc(); $('#upNotes').addEventListener('input', wc);
    $('#upDraft').addEventListener('click', () => { const d = read(); const u = st(); u.projects[c.id] = Object.assign({}, u.projects[c.id] || {}, { ms: d.ms, req: d.req, del: d.del, url: safeUrl(d.url), notes: d.notes, rub: d.rub }); save(); $('#upMsg').textContent = 'Draft saved on this device.'; });
    $('#upForm').addEventListener('submit', (ev) => {
      ev.preventDefault(); const d = read(); const msg = $('#upMsg');
      if (d.url && !safeUrl(d.url)) { msg.textContent = 'The link must be a full https:// address. Leave it empty if you have none.'; return; }
      if (d.req.some((x) => !x)) { msg.textContent = 'Every requirement must be met before you submit. Untick nothing you have not built.'; return; }
      if (d.del.some((x) => !x)) { msg.textContent = 'Every deliverable must be produced before you submit.'; return; }
      if (words(d.notes) < minWords) { msg.textContent = 'Write at least ' + minWords + ' words in the explanation.'; return; }
      if (d.rub.some((x) => x === null)) { msg.textContent = 'Choose a level for every rubric line.'; return; }
      const tot = p.rubric.reduce((n, r) => n + r.pts, 0); const got = p.rubric.reduce((n, r, i) => n + r.pts * (+d.rub[i]), 0); const pct = tot ? Math.round(got / tot * 100) : 0;
      const u = st(); const first = !(u.projects[c.id] && u.projects[c.id].at);
      u.projects[c.id] = { ms: d.ms, req: d.req, del: d.del, url: safeUrl(d.url), notes: d.notes, rub: d.rub, pct, at: A.dayStr(new Date()), title: p.title };
      U.markStudy(); if (first) A.addXp(c.capstone ? 150 : 40); save(); completeCourseCheck(c);
      A.toast('🗂 Project recorded in your portfolio'); A.go(['projects']);
    });
  }
  U.lazy.projects = function () {
    const u = st(); const withP = U.cat.courses.filter((c) => c.project); const done = withP.filter(U.projectDone);
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Projects and portfolio</p><h1>Graduate having built real software</h1><p>Each course ends in a project, each stage has a project studio, and Stage 6 requires three capstones with architecture documents, tests, security and performance analysis, deployment notes and a technical report. What you submit here becomes your portfolio.</p><p>' + link(['portfolio'], '📄 Open your printable portfolio page →', 'btn small primary') + '</p></section>';
    h += '<h2 class="u-h2">Your portfolio (' + done.length + ' of ' + withP.length + ' projects)</h2>' + (done.length ? '<div class="u-port">' + done.map((c) => { const r = u.projects[c.id]; return '<article class="card up-card"><p class="u-eyebrow">' + E(c.code) + (c.capstone ? ' · Capstone' : '') + ' · ' + E(r.at) + '</p><h3>' + E(r.title || c.title) + '</h3><p>' + E(String(r.notes || '').slice(0, 260)) + (String(r.notes || '').length > 260 ? '…' : '') + '</p><div class="uc-meta"><span>Self-assessed ' + (+r.pct || 0) + '%</span>' + (safeUrl(r.url) ? '<a href="' + E(safeUrl(r.url)) + '" target="_blank" rel="noopener noreferrer">Open project ↗</a>' : '') + link(['course', c.id, 'project'], 'Edit') + '</div><div class="u-chips">' + (c.skills || []).map((s) => '<span class="u-chip">' + E(s) + '</span>').join('') + '</div></article>'; }).join('') + '</div><p><button type="button" class="btn small" id="upExport">⬇ Download portfolio (HTML file)</button></p>' : '<div class="card"><p>Nothing submitted yet. Your first project is in Stage 1.</p></div>');
    U.cat.stages.forEach((s) => { const ps = withP.filter((c) => c.stage === s.id); if (!ps.length) return;
      h += '<h2 class="u-h2">Stage ' + s.id + ' projects</h2><ul class="u-list u-plist">' + ps.map((c) => '<li class="' + (U.courseUnlocked(c) ? '' : 'locked') + '">' + link(['course', c.id, 'project'], '<b>' + (c.capstone ? '🏆 ' : '') + E(c.ptitle || c.title) + '</b><small>' + E(c.code) + ' · ' + (U.projectDone(c) ? 'Submitted ✓' : U.courseUnlocked(c) ? 'Open' : '🔒 Locked') + '</small>') + '</li>').join('') + '</ul>'; });
    shell('projects', h, [['University', []], ['Projects and portfolio']]);
    const ex = $('#upExport'); if (ex) ex.addEventListener('click', () => {
      const doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio' + (u.name ? ' · ' + E(u.name) : '') + '</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;color:#141a33}h1{font-size:30px}article{border:1px solid #d5dcec;border-radius:12px;padding:16px 20px;margin:16px 0}small{color:#5a6385}</style></head><body><h1>Software engineering portfolio' + (u.name ? ': ' + E(u.name) : '') + '</h1><p><small>Projects completed in the Learn Software Engineering University self-study pathway. Marks are self-assessed. This is not an accredited qualification.</small></p>' +
        done.map((c) => { const r = u.projects[c.id]; return '<article><small>' + E(c.code + ' · ' + r.at) + '</small><h2>' + E(r.title || c.title) + '</h2><p>' + E(r.notes || '').replace(/\n/g, '<br>') + '</p>' + (safeUrl(r.url) ? '<p><a href="' + E(safeUrl(r.url)) + '">' + E(safeUrl(r.url)) + '</a></p>' : '') + '<p><small>Skills: ' + E((c.skills || []).join(', ')) + '</small></p></article>'; }).join('') + '</body></html>';
      download('portfolio.html', new Blob([doc], { type: 'text/html' }));
    });
  };
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

  /* ---------- transcript and certificates ---------- */
  U.lazy.transcript = function () {
    const u = st(), o = U.overall(), gr = U.gradReqs(); const graded = U.cat.courses.filter(U.courseDone).map(U.courseGrade);
    const avg = graded.length ? Math.round(graded.reduce((n, g) => n + g.pct, 0) / graded.length) : null;
    let h = '<section class="u-stagehero u-print-hide"><p class="u-eyebrow">Academic record</p><h1>Transcript and certificates</h1><p>Your record is stored on this device and travels with your Learn backup code. Because it is recorded in your own browser, it is an honest personal record, not a verified credential.</p><label class="up-f u-namef">Name to print on your transcript and certificates<input type="text" id="utName" maxlength="60" autocomplete="name" value="' + E(u.name) + '" placeholder="Your name"></label><p><button type="button" class="btn small" id="utPrint">🖨 Print or save as PDF</button></p></section>';
    h += '<section class="u-transcript" aria-label="Academic transcript"><header><h2>Software Engineering University · Academic transcript</h2><p><b id="utShow">' + (E(u.name) || 'Student') + '</b> · issued ' + E(A.dayStr(new Date())) + ' · ' + o.done + ' of ' + o.tot + ' courses completed' + (avg !== null ? ' · average ' + avg + '% (' + U.letter(avg) + ')' : '') + '</p><p class="u-fine">Self-study pathway inside the Learn website. Not an accredited academic qualification. Written answers and projects are self-assessed against published rubrics; multiple-choice and programming work is marked automatically in the student\'s browser.</p></header>';
    U.cat.stages.forEach((s) => { const fa = U.attempts(U.finalId(s.id));
      h += '<h3>Stage ' + s.id + ' · ' + E(s.title) + '</h3><div class="u-tablewrap"><table class="u-table"><thead><tr><th>Code</th><th>Course</th><th>Lessons</th><th>Assignment</th><th>Exam (best / attempts)</th><th>Project</th><th>Grade</th></tr></thead><tbody>' +
        U.coursesOf(s.id).map((c) => { const g = U.courseGrade(c), at = U.attempts(c.id), self = at.some((a) => a.self); return '<tr><td>' + E(c.code) + '</td><td>' + E(c.title) + '</td><td>' + U.lessonsDone(c) + '/' + c.n + '</td><td>' + (c.lab ? ((st().labs[c.id] || {}).pass ? 'Passed' : c.labOpt ? 'optional' : '–') : 'n/a') + '</td><td>' + (at.length ? U.bestOf(c.id) + '% / ' + at.length + (self ? ' †' : '') : '–') + '</td><td>' + (c.project ? (U.projectDone(c) ? U.projectPct(c) + '% †' : '–') : 'n/a') + '</td><td>' + (g ? '<b>' + g.letter + '</b> ' + g.pct + '%' : '–') + '</td></tr>'; }).join('') +
        '<tr class="ux-finalrow"><td colspan="4"><b>Stage ' + s.id + ' final examination</b></td><td>' + (fa.length ? U.bestOf(U.finalId(s.id)) + '% / ' + fa.length : '–') + '</td><td></td><td>' + (U.finalPassed(s.id) ? '<b>Passed</b>' : '–') + '</td></tr></tbody></table></div>'; });
    const els = (U.cat.electives || []).filter((c) => U.lessonsDone(c) > 0 || U.attempts(c.id).length);
    if (els.length) h += '<h3>Department electives (not counted toward stages or graduation)</h3><div class="u-tablewrap"><table class="u-table"><thead><tr><th>Code</th><th>Course</th><th>Lessons</th><th>Assignment</th><th>Exam (best / attempts)</th><th>Project</th><th>Grade</th></tr></thead><tbody>' + els.map((c) => { const g = U.courseGrade(c), at = U.attempts(c.id); return '<tr><td>' + E(c.code) + '</td><td>' + E(c.title) + '</td><td>' + U.lessonsDone(c) + '/' + c.n + '</td><td>' + ((st().labs[c.id] || {}).pass ? 'Passed' : '–') + '</td><td>' + (at.length ? U.bestOf(c.id) + '% / ' + at.length + (at.some((x) => x.self) ? ' †' : '') : '–') + '</td><td>' + (U.projectDone(c) ? U.projectPct(c) + '% ‡' : '–') + '</td><td>' + (g ? g.pct + '% (' + g.letter + ')' : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<p class="u-fine">† contains self-assessed marks. Study time recorded: ' + U.fmtTime(u.time) + '.</p></section>';
    h += '<section class="u-print-hide"><h2 class="u-h2">Certificates</h2><p class="pill">Certificates are completion records for this website\'s learning pathway. Each one states that it is not an accredited academic qualification.</p><div class="u-certs">' +
      U.cat.stages.map((s) => { const ok = U.stageComplete(s.id); return '<div class="card u-cert ' + (ok ? 'ok' : '') + '"><p class="u-eyebrow">Stage ' + s.id + '</p><h3>' + E(s.level) + '</h3><p>' + (ok ? 'Earned. All courses and the final examination are complete.' : U.stageCoursesDone(s.id) + ' of ' + U.coursesOf(s.id).length + ' courses' + (U.finalPassed(s.id) ? ' · final passed (next stage unlocked; finish the courses to earn this certificate)' : ' · final not passed')) + '</p>' + (ok ? '<button type="button" class="btn small" data-cert="s' + s.id + '">⬇ Download certificate (PNG)</button> <button type="button" class="btn small" data-vlink="s' + s.id + '">🔗 Verification link</button>' : '<span class="uc-state lock">Not earned yet</span>') + '</div>'; }).join('') +
      '<div class="card u-cert u-certmain ' + (gr.ok ? 'ok' : '') + '"><p class="u-eyebrow">Full pathway</p><h3>Software Engineering pathway, up to master\'s-level topics</h3><ul class="u-reqs">' + gr.items.map((r) => '<li class="' + (r.ok ? 'ok' : '') + '"><span aria-hidden="true">' + (r.ok ? '✓' : '○') + '</span>' + E(r.t) + '<small>' + E(r.d) + '</small></li>').join('') + '</ul>' + (gr.ok ? '<button type="button" class="btn primary" data-cert="all">⬇ Download completion certificate (PNG)</button> <button type="button" class="btn small" data-vlink="all">🔗 Verification link</button>' : '<span class="uc-state lock">Not earned yet</span>') + '</div></div></section>';
    shell('transcript', h, [['University', []], ['Transcript and certificates']]);
    $('#utName').addEventListener('input', (e) => { const v = e.target.value.replace(/[<>]/g, '').slice(0, 60); st().name = v; save(); $('#utShow').textContent = v || 'Student'; });
    $('#utPrint').addEventListener('click', () => window.print());
    $$('[data-cert]').forEach((b) => b.addEventListener('click', () => certificate(b.dataset.cert)));
    $$('[data-vlink]').forEach((b) => b.addEventListener('click', async () => { // 5.0: shareable, verifiable record of an earned certificate
      const which = b.dataset.vlink, all = which === 'all', s = all ? null : U.stageById(which.slice(1));
      if (all ? !U.gradReqs().ok : !(s && U.stageComplete(s.id))) return;
      if (!A.accountsOn || !A.accountsOn()) { A.toast('Certificate links need accounts, which are not switched on here.'); return; }
      if (!A.acctEmail()) { A.toast('Sign in first: 👤 Sign in at the top of the home page.'); return; }
      const t = all ? "Software Engineering pathway, up to master's-level topics — Learn University" : 'Stage ' + s.id + ': ' + s.title + ' — Learn University';
      const d = all ? U.overall().tot + ' courses, six stage finals and the capstone projects' : U.coursesOf(s.id).length + ' courses and the stage final examination';
      b.disabled = true; try { const url = await A.certIssue(t, d, st().name || 'Student'); const how = await A.shareLink(url, t); A.toast(how === 'copied' ? '🔗 Link copied' : '🔗 Link created'); b.insertAdjacentHTML('afterend', '<p class="u-fine">Verification link: <a href="' + E(url) + '">' + E(url) + '</a></p>'); }
      catch (e) { A.toast('Could not create the link' + (navigator.onLine ? '. Try again.' : ': you are offline.')); } b.disabled = false;
    }));
  };
  function certificate(which) {
    const u = st(); const all = which === 'all'; const s = all ? null : U.stageById(which.slice(1));
    if (all ? !U.gradReqs().ok : !(s && U.stageComplete(s.id))) return; // never issue an unearned certificate
    const W = 1600, H = 1130; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#1a2470'); g.addColorStop(1, '#5b3fb8'); x.fillStyle = g; x.fillRect(0, 0, W, 26); x.fillRect(0, H - 26, W, 26);
    x.strokeStyle = '#1a2470'; x.lineWidth = 3; x.strokeRect(46, 60, W - 92, H - 120); x.strokeStyle = '#c9a646'; x.lineWidth = 1.5; x.strokeRect(58, 72, W - 116, H - 144);
    x.textAlign = 'center'; x.fillStyle = '#1a2470';
    x.font = '600 26px Georgia, serif'; x.fillText('LEARN · SOFTWARE ENGINEERING UNIVERSITY', W / 2, 160);
    x.font = '700 68px Georgia, serif'; x.fillText('Certificate of Completion', W / 2, 270);
    x.fillStyle = '#39405f'; x.font = '28px Georgia, serif'; x.fillText('This records that', W / 2, 350);
    x.fillStyle = '#10163a'; x.font = 'italic 700 64px Georgia, serif'; x.fillText((u.name || 'Student').slice(0, 44), W / 2, 440);
    x.strokeStyle = '#c9a646'; x.beginPath(); x.moveTo(W / 2 - 360, 466); x.lineTo(W / 2 + 360, 466); x.stroke();
    x.fillStyle = '#39405f'; x.font = '28px Georgia, serif'; x.fillText(all ? 'has completed every course, all six stage final examinations and the capstone projects of the' : 'has completed every course and the final examination of', W / 2, 530);
    x.fillStyle = '#1a2470'; x.font = '700 44px Georgia, serif'; x.fillText(all ? "Software Engineering pathway, up to master's-level topics" : 'Stage ' + s.id + ': ' + s.title, W / 2, 600);
    x.fillStyle = '#39405f'; x.font = '26px Georgia, serif';
    const o = U.overall(); x.fillText(all ? o.tot + ' courses · ' + o.les + ' lessons · recorded study time ' + U.fmtTime(u.time) : U.coursesOf(s.id).length + ' courses · level: ' + s.level, W / 2, 660);
    x.fillText('Issued ' + A.dayStr(new Date()), W / 2, 705);
    x.fillStyle = '#7a2a2a'; x.font = '600 23px Georgia, serif'; x.fillText('This is not an accredited academic qualification and does not confer a degree.', W / 2, 850);
    x.fillStyle = '#5a6385'; x.font = '21px Georgia, serif';
    x.fillText('It is a completion record issued by the Learn website for its own self-study pathway. Progress is recorded on the', W / 2, 890);
    x.fillText('student\'s own device, and written work and projects are self-assessed, so the record has not been independently verified.', W / 2, 920);
    x.font = '90px serif'; x.fillText('🎓', W / 2, 1010);
    cv.toBlob((b) => { if (b) { download(all ? 'learn-university-certificate.png' : 'learn-university-stage-' + s.id + '.png', b); A.toast('⬇ Certificate downloaded'); } }, 'image/png');
  }

  /* ---------- laboratories hub ---------- */
  const SCRATCH = { py: 'print("Hello from the Python lab")\n', js: 'console.log("Hello from the JavaScript lab");\n', ts: 'const greet = (name: string): string => `Hello, ${name}`;\nconsole.log(greet("TypeScript lab"));\n', c: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from the C lab\\n");\n    return 0;\n}\n', cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from the C++ lab" << std::endl;\n    return 0;\n}\n', cs: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from the C# lab");\n    }\n}\n', sql: "CREATE TABLE students (id INTEGER, name TEXT, stage INTEGER);\nINSERT INTO students VALUES (1, 'Ada', 3), (2, 'Linus', 5);\nSELECT name, stage FROM students ORDER BY stage DESC;\n", java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from the Java lab");\n    }\n}\n', go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from the Go lab")\n}\n', rust: 'fn main() {\n    println!("Hello from the Rust lab");\n}\n', php: '<?php\necho "Hello from the PHP lab" . PHP_EOL;\n', ruby: 'puts "Hello from the Ruby lab"\n', swift: 'print("Hello from the Swift lab")\n', kotlin: 'fun main() {\n    println("Hello from the Kotlin lab")\n}\n', bash: '#!/usr/bin/env bash\necho "Hello from the Bash lab"\n', html: '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>HTML and CSS lab</title>\n  <style>\n    body { font-family: system-ui, sans-serif; padding: 24px; }\n    h1 { color: #2437d6; }\n  </style>\n</head>\n<body>\n  <h1>Hello from the HTML and CSS lab</h1>\n  <p>Edit me and press Preview.</p>\n</body>\n</html>\n' };
  U.lazy.labs = function (path) {
    const one = LAB_LANGS.find((l) => l[0] === path[1]);
    if (!one) {
      let h = '<section class="u-stagehero"><p class="u-eyebrow">Programming laboratories</p><h1>Sixteen labs, one for each language</h1><p>Open a lab to write and run code freely. Your work is saved on this device as you type. Graded assignments live in each course and are checked against tests; these open labs are for practice and experiment.</p></section><div class="u-labgrid">' +
        link(['visual'], '<span class="ulb-ico" aria-hidden="true">📊</span><b>Algorithm visualiser</b><small>Step through sorting, searching, data structures and recursion</small>', 'u-labcard') + link(['practice'], '<span class="ulb-ico" aria-hidden="true">🎯</span><b>Practice studio</b><small>Debugging, code review, SQL, normalisation, test writing and system design</small>', 'u-labcard') + link(['practice', 'env'], '<span class="ulb-ico" aria-hidden="true">🩺</span><b>Environment check</b><small>Test which language environments work right now</small>', 'u-labcard') + link(['terminal'], '<span class="ulb-ico" aria-hidden="true">⌨️</span><b>Git and terminal simulator</b><small>' + (U.tools && U.tools.TASKS ? '' : '') + '10 graded tasks: files, search, commits, branches, merges and conflicts</small>', 'u-labcard') + link(['circuit'], '<span class="ulb-ico" aria-hidden="true">🔌</span><b>Circuit simulator</b><small>13 graded tasks: gates from NAND, adders, decoders, flip-flops and counters</small>', 'u-labcard') + link(['range'], '<span class="ulb-ico" aria-hidden="true">🛡</span><b>Ethical hacking range</b><small>10 capture-the-flag challenges against fake targets: recon, passwords, SQL injection, XSS and more</small>', 'u-labcard') + LAB_LANGS.map((l) => { const n = U.cat.courses.concat(U.cat.electives || []).filter((c) => c.lang === l[0]).length; return link(['labs', l[0]], '<span class="ulb-ico" aria-hidden="true">' + l[2] + '</span><b>' + E(l[1]) + '</b><small>' + (isRemote(l[0]) ? 'Runs online' : l[0] === 'html' ? 'Live preview' : 'Runs in your browser, works offline') + '</small><small>' + n + ' graded assignment' + (n === 1 ? '' : 's') + '</small>', 'u-labcard'); }).join('') + '</div>' +
        '<div class="card"><h2>What runs where</h2><p>Python, JavaScript, TypeScript, C, C++, C# and SQL run inside your browser with the engines built into Learn, so they work offline. They are teaching engines and do not support every feature of the real languages; if one rejects valid code, that is the engine\'s limit, not your mistake. Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash are sent to a free public code-running service and need internet. If that service is down, the lab says so and nothing is marked.</p></div>';
      shell('labs', h, [['University', []], ['Laboratories']]); return;
    }
    const lang = one[0]; const asg = U.cat.courses.filter((c) => c.lang === lang);
    let h = '<article class="u-lab"><header><p class="u-eyebrow">Open laboratory</p><h1>' + one[2] + ' ' + E(one[1]) + ' lab</h1><p class="pill">Free practice. Nothing here is graded.</p></header><div id="labHost"></div>' +
      '<div class="u-cols"><section><h2 class="u-h2">Graded assignments in ' + E(one[1]) + '</h2>' + (asg.length ? '<ul class="u-list">' + asg.map((c) => '<li class="' + (U.courseUnlocked(c) ? '' : 'locked') + '">' + link(['course', c.id, 'lab'], '<b>' + E(c.code + ' ' + c.title) + '</b><small>' + (U.labPassed(c) ? 'Passed ✓' : U.courseUnlocked(c) ? 'Open' : '🔒 Locked') + '</small>') + '</li>').join('') + '</ul>' : '<p class="pill">No course assignment uses this language yet. Use the open lab and the Learn lesson track.</p>') + '</section><section><h2 class="u-h2">More practice</h2><ul class="u-list">' + (A.LANGS[lang] ? '<li><a href="#/' + lang + '"><b>Learn lesson track: ' + E(one[1]) + '</b><small>Step-by-step lessons with instant checks</small></a></li><li><a href="#/play/' + lang + '"><b>Playground</b><small>The original Learn scratchpad</small></a></li>' : '<li><a href="#/web"><b>HTML and CSS lab in Learn</b><small>Guided web exercises</small></a></li>') + (lang === 'js' || lang === 'py' ? '<li><a href="#/project"><b>Multi-file workspace</b><small>Folders, files and packages</small></a></li>' : '') + '</ul></section></div></article>';
    shell('labs', h, [['University', []], ['Laboratories', ['labs']], [one[1]]]);
    mountTask($('#labHost'), { lang, starter: SCRATCH[lang] || '' }, { saveKey: 'free:' + lang, graded: false });
  };

  U.assess = { lab: labView, exam: examView, project: projectView, mountTry, mountTask, grade, LAB_LANGS, langName };
})();
