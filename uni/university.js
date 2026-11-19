/* ============================================================
   Software Engineering University: core module (vanilla JS)
   Loaded lazily by index.html (renderUni) the first time #/uni is opened.
   Layers:
     1. State      S.uni inside the existing Learn save (localStorage + backup code)
     2. Content    catalog.js (metadata) + data/*.txt (course text, parsed on demand)
     3. Progress   mastery rules: lessons > lab > exam > project > stage final
     4. Views      home, dashboard, catalogue, stage, course, lesson, videos
     5. Lazy mods  uni-assess.js (labs, exams, projects, transcript, certificates)
                   uni-professor.js (AI Professor + built-in tutor)
   No framework, no network calls except same-origin file loads.
   ============================================================ */
(function () {
  'use strict';
  const CAT = window.UNI_CATALOG; const CFG = window.UNI_CONFIG || {};
  const BUILD = '2.0.3'; // bump together with UNI_VER in index.html and the stamp at the top of each uni-*.js file
  const U = { build: BUILD, ready: false, cat: CAT, cfg: CFG, content: {}, files: {}, views: {}, mods: {} };
  let A = null; // API handed over by index.html
  const PASS = 70, FINAL_PASS = 75;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const E = (t) => A.esc(String(t === undefined || t === null ? '' : t));
  const courseById = (id) => CAT.courses.find((c) => c.id === id) || (CAT.electives || []).find((c) => c.id === id);
  const stageById = (n) => CAT.stages.find((s) => s.id === +n);
  const coursesOf = (n) => CAT.courses.filter((c) => c.stage === +n);

  /* ---------- 1. state ---------- */
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  function st() {
    const S = A.state();
    if (!isObj(S.uni)) S.uni = {};
    const u = S.uni;
    // sanitize: a restored backup is untrusted input
    ['lessons', 'labs', 'exams', 'projects', 'videos', 'missed', 'scratch', 'tries', 'certs', 'bm', 'goal', 'cv', 'arena', 'iv', 'studio', 'srs', 'git', 'mock', 'circ', 'range'].forEach((k) => { if (!isObj(u[k])) u[k] = {}; });
    if (!Array.isArray(u.days)) u.days = [];
    u.days = u.days.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-2000);
    u.time = Math.max(0, Math.min(1e9, Math.floor(+u.time || 0)));
    if (!Array.isArray(u.last)) u.last = null;
    if (u.pyEngine !== 'real' && u.pyEngine !== 'teach') u.pyEngine = 'teach';
    if (!isObj(u.notes)) u.notes = {};
    Object.keys(u.notes).forEach((k) => { const n = u.notes[k]; if (!/^[a-z0-9]+:\d+$/.test(k) || !isObj(n) || typeof n.t !== 'string' || !n.t.trim()) delete u.notes[k]; else { n.t = n.t.slice(0, 5000); if (typeof n.at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(n.at)) n.at = ''; } });
    if (typeof u.name !== 'string') u.name = '';
    u.name = u.name.slice(0, 60);
    return u;
  }
  const save = () => A.save();
  /* review scheduling (4.1): a missed question comes back after 1 day; each correct review moves it to the next
     box (3 days, then 7 days); a correct answer at 7 days retires it as mastered. A new miss starts it again. */
  const SRS_GAP = [1, 3, 7];
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return A.dayStr(d); };
  function srsMiss(key) { if (typeof key !== 'string' || !/^[a-z0-9]+:(x\d+|\d+:\d+)$/.test(key)) return; const u = st(); if (Object.keys(u.srs).length > 3000 && !u.srs[key]) return; u.srs[key] = { b: 0, due: addDays(SRS_GAP[0]), n: ((u.srs[key] || {}).n || 0) + 1, at: A.dayStr(new Date()) }; }
  function srsAnswer(key, ok) { const u = st(), r = u.srs[key]; if (!r) return; if (!ok) { r.b = 0; r.due = addDays(SRS_GAP[0]); r.n = (r.n || 0) + 1; } else if (r.b >= 2) { r.b = 3; r.due = ''; } else { r.b = (r.b || 0) + 1; r.due = addDays(SRS_GAP[r.b]); } r.at = A.dayStr(new Date()); save(); }
  function srsSync() { const u = st(); Object.keys(u.missed).forEach((k) => { if (!u.srs[k] && /^[a-z0-9]+:(x\d+|\d+:\d+)$/.test(k)) u.srs[k] = { b: 0, due: A.dayStr(new Date()), n: +u.missed[k] || 1, at: A.dayStr(new Date()) }; }); Object.keys(u.srs).forEach((k) => { const r = u.srs[k]; if (!r || typeof r !== 'object' || ![0, 1, 2, 3].includes(r.b) || (r.b < 3 && !/^\d{4}-\d{2}-\d{2}$/.test(r.due))) delete u.srs[k]; }); }
  function srsCounts() { srsSync(); const u = st(), today = A.dayStr(new Date()); let due = 0, later = 0, mastered = 0; Object.keys(u.srs).forEach((k) => { const r = u.srs[k]; if (r.b === 3) mastered++; else if (r.due <= today) due++; else later++; }); return { due, later, mastered }; }
  function markStudy() { const u = st(); const d = A.dayStr(new Date()); if (!u.days.includes(d)) u.days.push(d); A.markDay(); }
  function streak() {
    const set = new Set(st().days); const d = new Date(); let n = 0;
    if (!set.has(A.dayStr(d))) d.setDate(d.getDate() - 1);
    while (set.has(A.dayStr(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // study timer: counts seconds only while a university page is visible
  let tickT = null;
  function startClock() {
    if (tickT) return;
    tickT = setInterval(() => {
      if (document.hidden || !/^#\/uni/.test(location.hash)) return;
      const u = st(); u.time += 15; if (u.time % 60 === 0) save();
    }, 15000);
  }

  /* ---------- 2. content: parser for data/*.txt ---------- */
  // Format (see uni/README.md): #COURSE id / #LESSON title | minutes / #Q question (- wrong, * right, ! why)
  // #TRY, #LAB lang | title (@starter @solution @tests @out @setup @rows @checks @hints) / #EXAM minutes
  // #W written prompt (+ rubric line) / #C lang | prompt / #PROJECT title (@requirements @deliverables @rubric)
  const DIRECTIVE = /^#(COURSE|LESSON|Q|TRY|LAB|EXAM|W|C|PROJECT)(?:\s+(.*))?$/;
  function parseTests(lines, owner) {
    return lines.filter((l) => l.trim()).map((l) => {
      let head = l, setup = ''; const j = l.indexOf(' ;; ');
      if (j >= 0) { setup = l.slice(j + 4).trim().replace(/\\n/g, '\n'); head = l.slice(0, j); }
      const i = head.lastIndexOf(' => '); let val, bad = i < 0;
      if (!bad) { try { val = JSON.parse(head.slice(i + 4).trim()); } catch (e) { bad = true; } }
      if (bad) { if (owner) owner.badTests = (owner.badTests || 0) + 1; return null; }
      const expr = head.slice(0, i).trim();
      return setup ? [expr, val, setup] : [expr, val];
    }).filter(Boolean);
  }
  function finishCode(o) { // turn @sections into fields
    const sec = o._sec || {}; delete o._sec; delete o._cur;
    const txt = (k) => (sec[k] ? sec[k].join('\n').replace(/^\n+|\s+$/g, '') : undefined);
    if (sec.starter) o.starter = txt('starter') + '\n'; else o.starter = '';
    if (sec.solution) o.solution = txt('solution') + '\n';
    if (sec.tests) o.tests = parseTests(sec.tests, o);
    if (sec.out) o.out = txt('out');
    if (sec.setup) o.setup = txt('setup');
    if (sec.rows) { try { o.rows = JSON.parse(txt('rows')); } catch (e) { o.rows = []; } }
    if (sec.checks) o.checks = sec.checks.filter((l) => l.trim()).map((l) => { const i = l.indexOf(' :: '); return i < 0 ? null : { label: l.slice(0, i).trim(), rule: l.slice(i + 4).trim() }; }).filter(Boolean);
    if (sec.hints) o.hints = sec.hints.map((l) => l.trim()).filter(Boolean);
    if (sec.requirements) o.requirements = sec.requirements.map((l) => l.trim()).filter(Boolean);
    if (sec.deliverables) o.deliverables = sec.deliverables.map((l) => l.trim()).filter(Boolean);
    if (sec.rubric) o.rubric = sec.rubric.map((l) => l.trim()).filter(Boolean).map((l) => { const p = l.split('|'); return { c: p[0].trim(), pts: Math.max(1, parseInt(p[1], 10) || 10) }; });
    if (o._body) { o.md = o._body.join('\n').replace(/^\n+|\s+$/g, ''); } delete o._body;
    return o;
  }
  function parseCourseFile(text) {
    const out = {}; let course = null, block = null, q = null, where = null; // where: 'lesson' | 'exam'
    const closeBlock = () => { if (block) { finishCode(block); block = null; } q = null; };
    const lines = String(text).replace(/\r/g, '').split('\n');
    for (const raw of lines) {
      const m = DIRECTIVE.exec(raw);
      if (m) {
        const kind = m[1], arg = (m[2] || '').trim();
        if (kind === 'COURSE') { closeBlock(); course = { lessons: [], lab: null, exam: null, project: null }; out[arg] = course; where = null; continue; }
        if (!course) continue;
        if (kind === 'LESSON') { closeBlock(); const p = arg.split('|'); block = { t: p[0].trim(), min: parseInt(p[1], 10) || 10, quiz: [], _body: [] }; course.lessons.push(block); where = 'lesson'; continue; }
        if (kind === 'Q') { q = { type: 'mc', q: arg, o: [], a: -1, why: '' }; if (where === 'exam' && course.exam) course.exam.items.push(q); else if (course.lessons.length) course.lessons[course.lessons.length - 1].quiz.push(q); if (block && block._sec) { finishCode(block); block = null; } continue; }
        if (kind === 'TRY') { const les = course.lessons[course.lessons.length - 1]; if (block && block !== les) finishCode(block); const p = arg.split('|'); block = { lang: p[0].trim(), prompt: p.slice(1).join('|').trim(), _sec: {}, _body: [] }; if (les) les.try = block; q = null; continue; }
        if (kind === 'LAB') { closeBlock(); const p = arg.split('|'); block = { lang: p[0].trim(), title: p.slice(1).join('|').trim(), _sec: {}, _body: [] }; course.lab = block; where = null; continue; }
        if (kind === 'EXAM') { closeBlock(); course.exam = { min: parseInt(arg, 10) || 20, items: [] }; where = 'exam'; continue; }
        if (kind === 'W') { closeBlock(); q = { type: 'written', q: arg, rubric: [] }; if (course.exam) course.exam.items.push(q); continue; }
        if (kind === 'C') { closeBlock(); const p = arg.split('|'); block = { type: 'code', lang: p[0].trim(), q: p.slice(1).join('|').trim(), _sec: {}, _body: [] }; if (course.exam) course.exam.items.push(block); continue; }
        if (kind === 'PROJECT') { closeBlock(); block = { title: arg, _sec: {}, _body: [] }; course.project = block; where = null; continue; }
      }
      if (!course) continue;
      if (q && !block) { // option / rubric lines
        if (q.type === 'mc') {
          if (/^\* /.test(raw)) { q.a = q.o.length; q.o.push(raw.slice(2).trim()); continue; }
          if (/^- /.test(raw)) { q.o.push(raw.slice(2).trim()); continue; }
          if (/^! /.test(raw)) { q.why = raw.slice(2).trim(); continue; }
          if (!raw.trim()) continue;
          q.q += '\n' + raw; continue; // multi-line question (code)
        } else { if (/^\+ /.test(raw)) { q.rubric.push(raw.slice(2).trim()); } continue; }
      }
      if (q && block && !block._sec) { // quiz lines inside a lesson
        if (/^\* /.test(raw)) { q.a = q.o.length; q.o.push(raw.slice(2).trim()); continue; }
        if (/^- /.test(raw) && (q.o.length || q.a < 0)) { q.o.push(raw.slice(2).trim()); continue; }
        if (/^! /.test(raw)) { q.why = raw.slice(2).trim(); continue; }
        if (!raw.trim()) continue;
        if (!q.o.length) { q.q += '\n' + raw; continue; }
        continue;
      }
      if (block) {
        const sm = /^@(starter|solution|tests|out|setup|rows|checks|hints|requirements|deliverables|rubric)\s*$/.exec(raw);
        if (sm && block._sec) { block._cur = sm[1]; block._sec[sm[1]] = []; continue; }
        if (block._sec && block._cur) block._sec[block._cur].push(raw); else if (block._body) block._body.push(raw);
      }
    }
    closeBlock();
    Object.keys(out).forEach((id) => out[id].lessons.forEach((l) => { if (l._body) finishCode(l); if (l.try && l.try._sec) finishCode(l.try); }));
    return out;
  }
  async function loadFile(file) {
    if (U.files[file]) return U.files[file];
    U.files[file] = (async () => {
      const r = await fetch('uni/data/' + file + '?v=' + A.ver, { cache: 'no-cache' }).catch(() => null);
      const res = r && r.ok ? r : await fetch('uni/data/' + file + '?v=' + A.ver).catch(() => null);
      if (!res || !res.ok) { delete U.files[file]; throw new Error('offline'); }
      Object.assign(U.content, parseCourseFile(await res.text())); return true;
    })();
    return U.files[file];
  }
  async function loadCourse(id) { const c = courseById(id); if (!c) throw new Error('unknown course'); if (!U.content[id]) await loadFile(c.file); if (!U.content[id]) throw new Error('missing content'); return U.content[id]; }
  function loadMod(name) {
    if (U.mods[name]) return U.mods[name];
    U.mods[name] = new Promise((ok, no) => { const el = document.createElement('script'); el.src = 'uni/' + name + '.js?v=' + A.ver; el.onload = () => { const b = (window.LEARN_MOD_BUILD || {})[name]; if (b === BUILD) return ok(); delete U.mods[name]; U.mixed = { file: 'uni/' + name + '.js', have: b || 'an older version', want: BUILD }; if (A.repair && !A.repairTried(BUILD)) A.repair(BUILD); no(new Error('mixed versions')); }; el.onerror = () => { el.remove(); delete U.mods[name]; no(new Error('offline')); }; document.head.appendChild(el); });
    return U.mods[name];
  }

  /* ---------- markdown (safe: everything is escaped first) ---------- */
  function inline(t) {
    return E(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\[([^\]]+)\]\((#\/uni\/[a-z0-9\/-]+)\)/g, '<a href="$2">$1</a>');
  }
  function md(src) {
    const L = String(src || '').split('\n'); let h = '', i = 0;
    const flushP = (buf) => { if (buf.length) h += '<p>' + inline(buf.join(' ')) + '</p>'; };
    let p = [];
    while (i < L.length) {
      const l = L[i];
      if (/^```/.test(l)) { flushP(p); p = []; const lang = l.slice(3).trim(); const code = []; i++; while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]); i++;
        if (lang === 'diagram' || lang === 'text' || !lang) h += '<pre class="u-diagram" ' + (lang === 'diagram' ? 'role="img" aria-label="Diagram"' : '') + '>' + E(code.join('\n')) + '</pre>';
        else h += '<pre class="u-code"><span class="u-lang">' + E(lang) + '</span><code>' + (A.LANGS[lang] || ['html', 'css'].includes(lang) ? A.hl(code.join('\n'), lang) : E(code.join('\n'))) + '</code></pre>';
        continue; }
      if (/^#{2,4} /.test(l)) { flushP(p); p = []; const n = l.match(/^#+/)[0].length; h += '<h' + (n + 1) + '>' + inline(l.replace(/^#+ /, '')) + '</h' + (n + 1) + '>'; i++; continue; }
      if (/^> /.test(l)) { flushP(p); p = []; const b = []; while (i < L.length && /^> ?/.test(L[i]) && L[i].trim()) b.push(L[i++].replace(/^> ?/, '')); const first = b[0] || ''; const kind = /^(In industry|Key idea|Warning|Try it|Proof|Definition|Example)/.exec(first); h += '<div class="u-call' + (kind ? ' k-' + kind[1].toLowerCase().replace(/\s/g, '') : '') + '">' + inline(b.join(' ')) + '</div>'; continue; }
      if (/^(- |\d+\. )/.test(l)) { flushP(p); p = []; const ord = /^\d+\. /.test(l); const items = []; while (i < L.length && (ord ? /^\d+\. /.test(L[i]) : /^- /.test(L[i]))) items.push(L[i++].replace(/^(- |\d+\. )/, '')); h += (ord ? '<ol>' : '<ul>') + items.map((x) => '<li>' + inline(x) + '</li>').join('') + (ord ? '</ol>' : '</ul>'); continue; }
      if (/^\|.*\|$/.test(l.trim())) { flushP(p); p = []; const rows = []; while (i < L.length && /^\|.*\|$/.test(L[i].trim())) rows.push(L[i++].trim().slice(1, -1).split('|').map((c) => c.trim())); const body = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c))); h += '<div class="u-tablewrap"><table class="u-table"><thead><tr>' + body[0].map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + body.slice(1).map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'; continue; }
      if (!l.trim()) { flushP(p); p = []; i++; continue; }
      p.push(l.trim()); i++;
    }
    flushP(p); return h;
  }

  /* ---------- 3. progress and mastery rules ---------- */
  const lkey = (cid, i) => cid + ':' + i;
  const lessonDone = (cid, i) => !!st().lessons[lkey(cid, i)];
  const lessonsDone = (c) => { let n = 0; for (let i = 0; i < c.n; i++) if (lessonDone(c.id, i)) n++; return n; };
  const labPassed = (c) => !c.lab || !!c.labOpt || !!(st().labs[c.id] && st().labs[c.id].pass);
  const labReq = (c) => !!c.lab && !c.labOpt;
  const attempts = (id) => (Array.isArray(st().exams[id]) ? st().exams[id] : []);
  const bestOf = (id) => attempts(id).reduce((b, a) => Math.max(b, +a.score || 0), 0);
  const examPassed = (c) => attempts(c.id).some((a) => a.pass);
  const projectDone = (c) => !c.project || !!(st().projects[c.id] && st().projects[c.id].at);
  const projectPct = (c) => { const p = st().projects[c.id]; return p && p.at ? Math.max(0, Math.min(100, +p.pct || 0)) : 0; };
  const courseDone = (c) => lessonsDone(c) === c.n && labPassed(c) && examPassed(c) && projectDone(c);
  function coursePct(c) {
    const parts = c.n + (labReq(c) ? 1 : 0) + 1 + (c.project ? 1 : 0);
    const got = lessonsDone(c) + (labReq(c) && labPassed(c) ? 1 : 0) + (examPassed(c) ? 1 : 0) + (c.project && projectDone(c) ? 1 : 0);
    return Math.round(got / parts * 100);
  }
  // course grade: exam 50%, lab 25%, project 25% (weights re-normalised when a part does not exist)
  function courseGrade(c) {
    if (!courseDone(c)) return null;
    const w = [[bestOf(c.id), 50]]; if (labReq(c)) w.push([100, 25]); if (c.project) w.push([projectPct(c), 25]);
    const tot = w.reduce((n, x) => n + x[1], 0); const pct = Math.round(w.reduce((n, x) => n + x[0] * x[1], 0) / tot);
    return { pct, letter: letter(pct) };
  }
  const letter = (p) => (p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');
  const finalId = (n) => 'final-s' + n;
  const finalPassed = (n) => attempts(finalId(n)).some((a) => a.pass);
  const stageCoursesDone = (n) => coursesOf(n).filter(courseDone).length;
  const stageUnlocked = (n) => +n === 1 || finalPassed(+n - 1);
  const stageComplete = (n) => stageCoursesDone(n) === coursesOf(n).length && finalPassed(n);
  function courseUnlocked(c) { return stageUnlocked(c.stage) && (c.pre || []).every((p) => { const pc = courseById(p); return !pc || examPassed(pc) || finalPassed(pc.stage); }); }
  function whyLocked(c) {
    if (!stageUnlocked(c.stage)) return 'Pass the Stage ' + (c.stage - 1) + ' final examination to unlock Stage ' + c.stage + '.';
    const miss = (c.pre || []).map(courseById).filter((pc) => pc && !examPassed(pc) && !finalPassed(pc.stage));
    return miss.length ? 'Pass the examination for ' + miss.map((x) => x.code + ' ' + x.title).join(' and ') + ' first.' : '';
  }
  const currentStage = () => { let n = 1; while (n < CAT.stages.length && finalPassed(n)) n++; return n; };
  function overall() {
    const tot = CAT.courses.length; const done = CAT.courses.filter(courseDone).length;
    const les = CAT.courses.reduce((n, c) => n + c.n, 0); const lesDone = CAT.courses.reduce((n, c) => n + lessonsDone(c), 0);
    const pct = Math.round(CAT.courses.reduce((n, c) => n + coursePct(c), 0) / tot);
    return { tot, done, les, lesDone, pct };
  }
  function nextUp() { // the most useful next thing to do
    const u = st();
    if (u.last) { const c = courseById(u.last[0]); if (c && courseUnlocked(c) && !courseDone(c)) return c; }
    return CAT.courses.find((c) => courseUnlocked(c) && !courseDone(c)) || null;
  }
  function nextStep(c) {
    for (let i = 0; i < c.n; i++) if (!lessonDone(c.id, i)) return { path: ['course', c.id, 'lesson', String(i)], label: 'Lesson ' + (i + 1) };
    if (labReq(c) && !labPassed(c)) return { path: ['course', c.id, 'lab'], label: 'Programming assignment' };
    if (!examPassed(c)) return { path: ['course', c.id, 'exam'], label: 'Course examination' };
    if (c.project && !projectDone(c)) return { path: ['course', c.id, 'project'], label: 'Course project' };
    return { path: ['course', c.id], label: 'Review' };
  }
  const fmtTime = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + ' h ' + m + ' min' : m + ' min'; };

  /* ---------- 4. shell + views ---------- */
  const NAV = [['', '🏛', 'Home'], ['search', '🔎', 'Search'], ['dashboard', '📊', 'Dashboard'], ['study', '🎯', 'My study'], ['review', '🔁', 'Review'], ['departments', '🏫', 'Departments'], ['courses', '📚', 'Courses'], ['videos', '🎬', 'Videos'], ['labs', '🧪', 'Labs'], ['exams', '📝', 'Exams'], ['projects', '🗂', 'Projects'], ['career', '💼', 'Career'], ['professor', '🤖', 'AI Professor'], ['transcript', '🎓', 'Transcript']];
  const href = (path) => '#/uni' + (path && path.length ? '/' + path.join('/') : '');
  const link = (path, html, cls, extra) => '<a class="' + (cls || '') + '" href="' + href(path) + '"' + (extra || '') + '>' + html + '</a>';
  function shell(active, inner, crumbs) {
    const cr = crumbs && crumbs.length ? '<nav class="u-crumbs" aria-label="Breadcrumb">' + crumbs.map((c, i) => (c[1] && i < crumbs.length - 1 ? link(c[1], E(c[0])) : '<span aria-current="page">' + E(c[0]) + '</span>')).join('<span aria-hidden="true">›</span>') + '</nav>' : '';
    A.app.innerHTML = '<div class="wrap uni">' + A.topbar('<button class="btn small" id="uBack" type="button">← Learn</button><div class="crumb">🎓 <span class="u-brand">Software Engineering University</span></div>') +
      '<nav class="u-nav" aria-label="University sections">' + NAV.map((n) => link(n[0] ? [n[0]] : [], '<span aria-hidden="true">' + n[1] + '</span> ' + n[2], 'u-tab' + (n[0] === active ? ' on' : ''), n[0] === active ? ' aria-current="page"' : '')).join('') + '</nav>' +
      cr + '<main class="u-main" id="uMain" tabindex="-1">' + inner + '</main>' +
      '<footer class="u-foot"><p><b>Not an accredited qualification.</b> Software Engineering University is a self-study pathway inside Learn. It does not award a degree, and its certificates are completion records for this website only.</p></footer></div>';
    A.bindTheme(); $('#uBack').addEventListener('click', () => A.home());
    const on = $('.u-tab.on'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
  }
  const ring = (pct, label) => '<div class="u-ring" style="--p:' + pct + '" role="img" aria-label="' + E(label || pct + ' percent') + '"><b>' + pct + '<small>%</small></b></div>';
  const bar = (pct) => '<div class="bar sm" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><div style="width:' + pct + '%"></div></div>';
  function courseCard(c) {
    const un = courseUnlocked(c), done = courseDone(c), pct = coursePct(c);
    return link(['course', c.id], '<div class="uc-top"><span class="uc-code">' + E(c.code) + '</span><span class="uc-state ' + (done ? 'done' : !un ? 'lock' : pct ? 'prog' : '') + '">' + (done ? '✓ Completed' : !un ? '🔒 Locked' : pct ? 'In progress' : 'Not started') + '</span></div><h3>' + E(c.title) + '</h3><p>' + E(c.desc) + '</p><div class="uc-meta"><span>' + c.n + ' lessons</span><span>~' + c.hrs + ' h</span><span>' + E(c.sub) + '</span></div>' + bar(pct), 'u-ccard' + (un ? '' : ' locked'), ' aria-label="' + E(c.code + ' ' + c.title + (un ? '' : ', locked')) + '"');
  }

  U.views[''] = function () {
    const o = overall(), cs = currentStage(), nx = nextUp(); const started = o.lesDone > 0 || Object.keys(st().exams).length > 0;
    let h = '<section class="u-hero"><div class="uh-text"><p class="u-eyebrow">A free self-study pathway, from beginner to master\'s-level topics</p><h1>Learn software engineering the way a university teaches it.</h1><p>Six academic stages take you from "what is a computer?" to principal-level engineering: ' + CAT.courses.length + ' courses, ' + o.les + ' lessons, hands-on labs in Python, JavaScript, SQL and four more languages, graded examinations and capstone projects. Free, in your browser, at your own pace.</p><div class="uh-cta">' +
      (nx ? link(nextStep(nx).path, (started ? 'Continue: ' : 'Start: ') + E(nx.code + ' · ' + nextStep(nx).label) + ' →', 'btn primary') : link(['transcript'], 'View your transcript →', 'btn primary')) + link(['courses'], 'Browse the catalogue', 'btn') + '</div><p class="u-fine">This is not an accredited degree. See the note at the bottom of every page.</p></div>' +
      '<div class="uh-side">' + ring(o.pct, 'Overall completion ' + o.pct + ' percent') + '<dl><div><dt>Current stage</dt><dd>' + cs + ' of ' + CAT.stages.length + '</dd></div><div><dt>Courses</dt><dd>' + o.done + ' / ' + o.tot + '</dd></div><div><dt>Lessons</dt><dd>' + o.lesDone + ' / ' + o.les + '</dd></div></dl></div></section>';
    h += '<h2 class="u-h2">Your academic pathway</h2><ol class="u-timeline">' + CAT.stages.map((s) => {
      const un = stageUnlocked(s.id), cd = stageCoursesDone(s.id), ct = coursesOf(s.id).length, fin = finalPassed(s.id);
      return '<li class="' + (stageComplete(s.id) ? 'done' : un ? 'open' : 'locked') + '">' + link(['stage', String(s.id)], '<span class="ut-n">' + s.id + '</span><div class="ut-b"><small>' + E(s.level) + '</small><b>' + E(s.title) + '</b><p>' + E(s.blurb) + '</p><div class="ut-m"><span>' + cd + '/' + ct + ' courses</span><span>' + (fin ? '✓ Final passed' : un ? 'Final exam open' : '🔒 Locked') + '</span></div>' + bar(Math.round(coursesOf(s.id).reduce((n, c) => n + coursePct(c), 0) / ct)) + '</div>', 'ut-card') + '</li>';
    }).join('') + '</ol>';
    h += '<h2 class="u-h2">Departments</h2><div class="card u-deptstrip"><p>The same courses, organised by discipline: Software Engineering, Computer Science, AI and Machine Learning, Cybersecurity, Game Development, Computer Engineering, Cloud and DevOps, and Mobile Development.</p>' + link(['departments'], 'Explore the departments →', 'btn small') + ' ' + link(['career'], 'Career centre →', 'btn small') + ' ' + link(['study'], 'My study plan →', 'btn small') + '</div>';
    h += '<h2 class="u-h2">How it works</h2><div class="u-how">' + [['📖', 'Study', 'Written lessons explain each idea in plain language first, then in proper technical terms, with examples and diagrams.'], ['🧪', 'Practise', 'Each programming course has an assignment checked against test cases. Pressing Run is never enough to pass.'], ['📝', 'Prove it', 'Course examinations and a final for every stage. You can retake them; every attempt is recorded.'], ['🗂', 'Build', 'Projects in every stage and three capstones at the end become your portfolio.'], ['🤖', 'Get help', 'The AI Professor tab has a built-in tutor that works offline, and can be connected to a real AI model later.'], ['🎬', 'Watch', 'Lectures from MIT OpenCourseWare, Harvard CS50 and other reputable sources sit beside the written lessons.']].map((x) => '<div class="u-howc"><span aria-hidden="true">' + x[0] + '</span><b>' + x[1] + '</b><p>' + x[2] + '</p></div>').join('') + '</div>';
    shell('', h);
  };

  U.views.dashboard = function () {
    const u = st(), o = overall(), cs = currentStage(), nx = nextUp();
    const inprog = CAT.courses.filter((c) => !courseDone(c) && coursePct(c) > 0), done = CAT.courses.filter(courseDone);
    const vids = Object.keys(u.videos).length, projs = Object.keys(u.projects).filter((k) => u.projects[k] && u.projects[k].at).length;
    const examN = Object.keys(u.exams).reduce((n, k) => n + attempts(k).length, 0);
    const upcoming = CAT.courses.filter((c) => courseUnlocked(c) && lessonsDone(c) === c.n && !examPassed(c)).slice(0, 4);
    const skills = Array.from(new Set(done.reduce((a, c) => a.concat(c.skills || []), [])));
    let h = '<div class="u-dash">' +
      '<section class="card u-dcard ud-main"><h2>Welcome back' + (u.name ? ', ' + E(u.name) : '') + '</h2>' + (nx ? '<p class="pill">Current course</p><h3>' + E(nx.code + ' · ' + nx.title) + '</h3>' + bar(coursePct(nx)) + '<p class="ud-next">Next: ' + E(nextStep(nx).label) + '</p>' + link(nextStep(nx).path, 'Continue →', 'btn primary') : '<p>You have completed every course that is currently unlocked.</p>') + '</section>' +
      '<section class="card u-dcard">' + ring(o.pct, 'Overall completion') + '<p class="ud-cap">Overall completion</p></section>' +
      '<section class="card u-dcard"><div class="ud-stat"><b>Stage ' + cs + '</b><small>' + E(stageById(cs).title) + '</small></div><div class="ud-stat"><b>🔥 ' + streak() + '</b><small>day study streak</small></div><div class="ud-stat"><b>' + fmtTime(u.time) + '</b><small>total study time</small></div></section>' +
      (function () { const sc = srsCounts(); return sc.due + sc.later + sc.mastered ? '<section class="card u-dcard"><div class="ud-stat"><b>🔁 ' + sc.due + '</b><small>question' + (sc.due === 1 ? '' : 's') + ' due for review</small></div>' + link(['review'], sc.due ? 'Review now →' : 'Open review', 'btn small' + (sc.due ? ' primary' : '')) + '</section>' : ''; })() +
      '<section class="card u-dcard ud-grid4"><div><b>' + o.done + '</b><small>courses completed</small></div><div><b>' + inprog.length + '</b><small>in progress</small></div><div><b>' + o.lesDone + '</b><small>lessons done</small></div><div><b>' + examN + '</b><small>exam attempts</small></div><div><b>' + projs + '</b><small>projects submitted</small></div><div><b>' + vids + '</b><small>videos watched</small></div></section>' +
      '</div>';
    h += '<h2 class="u-h2">Degree-style progress</h2><div class="card"><ol class="u-track">' + CAT.stages.map((s) => { const ct = coursesOf(s.id).length, cd = stageCoursesDone(s.id); return '<li class="' + (stageComplete(s.id) ? 'done' : stageUnlocked(s.id) ? 'open' : 'locked') + '"><span>' + s.id + '</span><b>' + E(s.level) + '</b><small>' + cd + '/' + ct + ' courses' + (finalPassed(s.id) ? ' · final ✓' : '') + '</small></li>'; }).join('') + '</ol></div>';
    h += '<div class="u-cols"><section><h2 class="u-h2">In progress</h2>' + (inprog.length ? '<ul class="u-list">' + inprog.map((c) => '<li>' + link(['course', c.id], '<b>' + E(c.code + ' ' + c.title) + '</b><small>' + coursePct(c) + '% · next: ' + E(nextStep(c).label) + '</small>') + '</li>').join('') + '</ul>' : '<p class="pill">No courses in progress. Pick one from the catalogue.</p>') + '</section>' +
      '<section><h2 class="u-h2">Upcoming assessments</h2>' + (upcoming.length || stageUnlocked(cs) ? '<ul class="u-list">' + upcoming.map((c) => '<li>' + link(['course', c.id, 'exam'], '<b>' + E(c.code) + ' examination</b><small>All lessons done. Ready when you are.</small>') + '</li>').join('') + (finalPassed(cs) ? '' : '<li>' + link(['final', String(cs)], '<b>Stage ' + cs + ' final examination</b><small>' + stageCoursesDone(cs) + '/' + coursesOf(cs).length + ' courses completed · pass mark ' + FINAL_PASS + '%</small>') + '</li>') + '</ul>' : '') + '</section></div>';
    h += '<div class="u-cols"><section><h2 class="u-h2">Course grades</h2>' + (done.length ? '<div class="u-tablewrap"><table class="u-table"><thead><tr><th>Course</th><th>Exam</th><th>Grade</th></tr></thead><tbody>' + done.map((c) => { const g = courseGrade(c); return '<tr><td>' + E(c.code + ' ' + c.title) + '</td><td>' + bestOf(c.id) + '%</td><td><b>' + g.letter + '</b> (' + g.pct + '%)</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="pill">Grades appear here when you complete a course.</p>') + '</section>' +
      '<section><h2 class="u-h2">Skills mastered</h2>' + (skills.length ? '<div class="u-chips">' + skills.map((s) => '<span class="u-chip">' + E(s) + '</span>').join('') + '</div>' : '<p class="pill">Complete courses to add skills to your record.</p>') + '</section></div>';
    const gr = gradReqs();
    h += '<h2 class="u-h2">Graduation requirements</h2><div class="card"><ul class="u-reqs">' + gr.items.map((r) => '<li class="' + (r.ok ? 'ok' : '') + '"><span aria-hidden="true">' + (r.ok ? '✓' : '○') + '</span>' + E(r.t) + '<small>' + E(r.d) + '</small></li>').join('') + '</ul>' + link(['transcript'], 'Transcript and certificates →', 'btn small') + '</div>';
    shell('dashboard', h, [['University', []], ['Dashboard']]);
  };
  function gradReqs() {
    const o = overall(); const caps = CAT.courses.filter((c) => c.capstone); const capsDone = caps.filter(projectDone).length;
    const items = [
      { t: 'Complete all ' + o.tot + ' courses', d: o.done + ' of ' + o.tot + ' completed', ok: o.done === o.tot },
      { t: 'Pass all six stage final examinations', d: CAT.stages.filter((s) => finalPassed(s.id)).length + ' of ' + CAT.stages.length + ' passed', ok: CAT.stages.every((s) => finalPassed(s.id)) },
      { t: 'Submit the ' + caps.length + ' capstone projects', d: capsDone + ' of ' + caps.length + ' submitted', ok: capsDone === caps.length && caps.length > 0 },
    ];
    return { items, ok: items.every((x) => x.ok) };
  }

  U.views.courses = function (path) {
    const f = path[1] && /^s[1-6]$/.test(path[1]) ? +path[1][1] : 0;
    let h = '<div class="u-filter" role="group" aria-label="Filter by stage">' + link(['courses'], 'All stages', 'u-fbtn' + (f ? '' : ' on')) + CAT.stages.map((s) => link(['courses', 's' + s.id], 'Stage ' + s.id, 'u-fbtn' + (f === s.id ? ' on' : ''))).join('') + '</div>';
    CAT.stages.filter((s) => !f || s.id === f).forEach((s) => {
      h += '<section class="u-stagesec"><div class="u-stagehead"><div><p class="u-eyebrow">Stage ' + s.id + ' · ' + E(s.level) + '</p><h2>' + E(s.title) + '</h2></div>' + link(['stage', String(s.id)], 'Stage overview →', 'btn small') + '</div><div class="u-cgrid">' + coursesOf(s.id).map(courseCard).join('') + '</div></section>';
    });
    shell('courses', h, [['University', []], ['Course catalogue']]);
  };

  U.views.stage = function (path) {
    const s = stageById(path[1]); if (!s) return U.views['']();
    const cs = coursesOf(s.id), un = stageUnlocked(s.id), at = attempts(finalId(s.id));
    let h = '<section class="u-stagehero ' + (un ? '' : 'locked') + '"><p class="u-eyebrow">Stage ' + s.id + ' of ' + CAT.stages.length + ' · ' + E(s.level) + '</p><h1>' + E(s.title) + '</h1><p>' + E(s.blurb) + '</p>' + (un ? '' : '<p class="u-lockmsg">🔒 Pass the Stage ' + (s.id - 1) + ' final examination to unlock this stage. Already know the material? You can sit that final at any time.</p>') + '</section>';
    h += '<div class="u-cols"><section><h2 class="u-h2">What you will be able to do</h2><ul class="u-out">' + s.outcomes.map((x) => '<li>' + E(x) + '</li>').join('') + '</ul></section><section><h2 class="u-h2">Stage final examination</h2><div class="card"><p>Questions are drawn from every course in the stage. Pass mark ' + FINAL_PASS + '%. Passing unlocks Stage ' + Math.min(s.id + 1, CAT.stages.length) + (s.id === CAT.stages.length ? ' graduation' : '') + '.</p><p class="u-fine"><b>Testing out is not completing.</b> You may sit this final without finishing the courses: passing it unlocks the next stage, so that people who already know the material are not held back. It does not complete the stage. The stage certificate is earned only when every course in the stage is complete <i>and</i> the final is passed, and graduation needs all six.</p><p class="pill">' + (at.length ? at.length + ' attempt' + (at.length === 1 ? '' : 's') + ' · best ' + bestOf(finalId(s.id)) + '%' + (finalPassed(s.id) ? ' · passed ✓' : '') : 'No attempts yet') + '</p>' + (un ? link(['final', String(s.id)], finalPassed(s.id) ? 'Retake the final' : 'Sit the final examination', 'btn ' + (finalPassed(s.id) ? '' : 'primary')) : '') + '</div></section></div>';
    h += '<h2 class="u-h2">Courses in this stage</h2><div class="u-cgrid">' + cs.map(courseCard).join('') + '</div>';
    shell('courses', h, [['University', []], ['Courses', ['courses']], ['Stage ' + s.id]]);
  };

  /* Old and new files mixed (a half-finished upload, or an old copy kept by the browser). First time in this
     session: clear Learn's offline copies and reload automatically. If that does not help, say which file is wrong. */
  function mixedHtml() {
    const m = U.mixed || {}; return '<div class="card u-off" role="alert"><h2>Learn needs to finish updating</h2><p>Some University files on this device or on the website are from different versions' + (m.file ? ': <code>' + E(m.file) + '</code> is ' + E(String(m.have)) + ', but version ' + E(m.want) + ' is needed' : '') + '.</p><p>Press <b>Update now</b>. If this message comes back, the website itself has an old copy of that file: upload the whole <code>uni</code> folder from the latest ZIP again.</p><button class="btn small" id="uRepair" type="button">Update now</button></div>';
  }
  function looksMixed(e) { return !!U.mixed || /is not a function|is not defined|Cannot read properties of undefined/.test(String(e && e.message || '')); }
  function showMixed(active, crumbs) {
    if (A.repair && !A.repairTried(BUILD)) { shell(active || '', '<div class="card" role="status" aria-live="polite"><p>Updating Learn to the latest version…</p></div>', crumbs || [['University', []]]); A.repair(BUILD); return; }
    shell(active || '', mixedHtml(), crumbs || [['University', []]]); const b = $('#uRepair'); if (b) b.addEventListener('click', () => { if (A.repair) A.repair(BUILD, true); else location.reload(); });
  }
  function offlineHtml(msg) { if (U.mixed) return mixedHtml(); return '<div class="card u-off" role="alert"><h2>This part is not available right now</h2><p>' + E(msg || 'The course file could not be loaded. If you are offline, open this course once while online and it will be saved on this device.') + '</p><button class="btn small" id="uRetry" type="button">Try again</button></div>'; }
  function bindRetry() { const r = $('#uRetry'); if (r) r.addEventListener('click', () => U.render(U.path)); const q = $('#uRepair'); if (q) q.addEventListener('click', () => { if (A.repair) A.repair(BUILD, true); else location.reload(); }); }
  function loading(active, crumbs) { shell(active, '<div class="card" role="status" aria-live="polite"><p>Loading…</p></div>', crumbs); }

  U.views.course = async function (path) {
    const c = courseById(path[1]); if (!c) return U.views.courses(['courses']);
    const crumbs = c.elective ? [['University', []], ['Departments', ['departments']], [c.code]] : [['University', []], ['Courses', ['courses']], ['Stage ' + c.stage, ['stage', String(c.stage)]], [c.code]];
    const sub = path[2];
    if (sub === 'lab' || sub === 'exam' || sub === 'project') { loading('courses', crumbs); try { await loadCourse(c.id); await loadMod('uni-assess'); } catch (e) { shell('courses', offlineHtml(), crumbs); return bindRetry(); } if (U.path !== path) return; return U.assess[sub](c, U.content[c.id], path); }
    loading('courses', crumbs);
    let data; try { data = await loadCourse(c.id); } catch (e) { shell('courses', offlineHtml(), crumbs); return bindRetry(); }
    if (U.path !== path) return;
    if (sub === 'lesson') return lessonView(c, data, Math.max(0, Math.min(data.lessons.length - 1, parseInt(path[3], 10) || 0)));
    const un = courseUnlocked(c), u = st(), ns = nextStep(c), pre = (c.pre || []).map(courseById).filter(Boolean);
    const lab = u.labs[c.id], at = attempts(c.id), g = courseGrade(c);
    let h = '<section class="u-chead"><div><p class="u-eyebrow">' + E(c.code) + ' · Stage ' + c.stage + ' · ' + E(c.sub) + '</p><h1>' + E(c.title) + '</h1><p>' + E(c.desc) + '</p><div class="uc-meta"><span>' + c.n + ' lessons</span><span>~' + c.hrs + ' hours</span>' + (c.lang ? '<span>Lab language: ' + E(c.lang) + '</span>' : '') + '</div></div><div class="u-cside">' + ring(coursePct(c), 'Course completion') + (g ? '<p class="u-grade">Grade <b>' + g.letter + '</b> · ' + g.pct + '%</p>' : '') + '</div></section>';
    if (!un) h += '<div class="u-lockmsg" role="note">🔒 ' + E(whyLocked(c)) + ' You can read the outline below, but lessons open once the requirement is met.</div>';
    else h += '<p>' + link(ns.path, (coursePct(c) ? 'Continue: ' : 'Start: ') + E(ns.label) + ' →', 'btn primary') + '</p>';
    h += '<div class="u-cols"><section><h2 class="u-h2">Learning objectives</h2><ul class="u-out">' + c.obj.map((x) => '<li>' + E(x) + '</li>').join('') + '</ul></section><section><h2 class="u-h2">Prerequisites</h2>' + (pre.length ? '<ul class="u-list">' + pre.map((p) => '<li>' + link(['course', p.id], '<b>' + E(p.code + ' ' + p.title) + '</b><small>' + (examPassed(p) ? 'Examination passed ✓' : 'Examination not passed yet') + '</small>') + '</li>').join('') + '</ul>' : '<p>' + (c.stage === 1 ? 'None. This course assumes no earlier knowledge.' : 'Stage ' + (c.stage - 1) + ' final examination.') + '</p>') + '</section></div>';
    h += '<h2 class="u-h2">Lessons</h2><ol class="u-lessons">' + data.lessons.map((l, i) => { const d = lessonDone(c.id, i), open = un && (i === 0 || lessonDone(c.id, i - 1)); return '<li class="' + (d ? 'done' : open ? 'open' : 'locked') + '">' + (open || d ? link(['course', c.id, 'lesson', String(i)], '<span class="ul-n">' + (d ? '✓' : i + 1) + '</span><span class="ul-t">' + E(l.t) + '</span><span class="ul-m">' + l.min + ' min' + (l.quiz.length ? ' · ' + l.quiz.length + ' check' + (l.quiz.length === 1 ? '' : 's') : '') + (l.try ? ' · exercise' : '') + '</span>') : '<span class="u-lrow"><span class="ul-n">🔒</span><span class="ul-t">' + E(l.t) + '</span><span class="ul-m">' + l.min + ' min</span></span>') + '</li>'; }).join('') + '</ol>';
    h += '<h2 class="u-h2">Assessment</h2><div class="u-assess">' +
      (data.lab ? '<div class="card"><h3>🧪 Programming assignment' + (c.labOpt ? ' (optional)' : '') + '</h3><p>' + E(data.lab.title) + '</p>' + (c.labOpt ? '<p class="u-fine">Optional because this language runs on an online service that may be unavailable. It does not block the course.</p>' : '') + '<p class="pill">' + (lab && lab.pass ? 'Passed ✓ · ' + (lab.tries || 1) + ' submission' + ((lab.tries || 1) === 1 ? '' : 's') : lab && lab.tries ? lab.tries + ' submission' + (lab.tries === 1 ? '' : 's') + ' · not passed yet' : 'Checked against test cases') + '</p>' + (un ? link(['course', c.id, 'lab'], lab && lab.pass ? 'Open again' : 'Open assignment', 'btn small') : '') + '</div>' : '') +
      '<div class="card"><h3>📝 Course examination</h3><p>' + (data.exam ? data.exam.items.length + ' questions · about ' + data.exam.min + ' minutes · pass mark ' + PASS + '%' : '') + '</p><p class="pill">' + (at.length ? at.length + ' attempt' + (at.length === 1 ? '' : 's') + ' · best ' + bestOf(c.id) + '%' + (examPassed(c) ? ' · passed ✓' : '') : lessonsDone(c) === c.n ? 'Ready to sit' : 'Opens when every lesson is complete') + '</p>' + (un && lessonsDone(c) === c.n ? link(['course', c.id, 'exam'], examPassed(c) ? 'Retake' : 'Sit the examination', 'btn small') : '') + '</div>' +
      (data.project ? '<div class="card"><h3>🗂 Course project</h3><p>' + E(data.project.title) + '</p><p class="pill">' + (projectDone(c) ? 'Submitted ✓ · self-assessed ' + projectPct(c) + '%' : 'Build it, then submit your evidence') + '</p>' + (un ? link(['course', c.id, 'project'], projectDone(c) ? 'View submission' : 'Open project brief', 'btn small') : '') + '</div>' : '') + '</div>';
    const vids = (window.UNI_VIDEOS || []).filter((v) => (v.courses || []).includes(c.id));
    h += '<div class="u-cols"><section><h2 class="u-h2">Further reading</h2><ul class="u-refs">' + (c.refs || []).map((r) => '<li>' + (r[1] ? '<a href="' + E(r[1]) + '" target="_blank" rel="noopener noreferrer">' + E(r[0]) + '</a>' : E(r[0])) + (r[2] ? '<small>' + E(r[2]) + '</small>' : '') + '</li>').join('') + '</ul></section><section><h2 class="u-h2">Help and video</h2><ul class="u-list">' + (c.id === 'c107' || c.id === 'c206' ? '<li>' + link(['terminal'], '<b>⌨️ Practise in the Git and terminal simulator</b><small>Graded tasks that run in this page, offline</small>') + '</li>' : '') + '<li>' + link(['professor', c.id], '<b>🤖 Ask the AI Professor about this course</b><small>Explanations, hints and revision questions</small>') + '</li><li>' + link(['videos', 'c-' + c.id], '<b>🎬 Related video lectures</b><small>' + (U.videosLoaded ? vids.length + ' available' : 'Open the video centre') + '</small>') + '</li></ul></section></div>';
    shell('courses', h, crumbs);
  };

  /* ---------- knowledge-check component (shared with the professor) ---------- */
  function quizHtml(qs, idp) {
    return qs.map((q, qi) => { const order = q.o.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      return '<fieldset class="u-q" data-q="' + qi + '"><legend><span class="u-qn">Check ' + (qi + 1) + '</span>' + qText(q.q) + '</legend><div class="u-opts">' + order.map((oi) => '<button type="button" class="u-opt" data-o="' + oi + '">' + inline(q.o[oi]) + '</button>').join('') + '</div><p class="u-why" aria-live="polite"></p></fieldset>'; }).join('');
  }
  function qText(t) { const p = String(t).split('\n'); return '<span class="u-qt">' + inline(p[0]) + '</span>' + (p.length > 1 ? '<pre class="u-code"><code>' + E(p.slice(1).join('\n')) + '</code></pre>' : ''); }
  function bindQuiz(root, qs, onAll, missKey) {
    const ok = qs.map(() => false);
    $$('.u-q', root).forEach((fs) => { const qi = +fs.dataset.q, q = qs[qi];
      $$('.u-opt', fs).forEach((b) => b.addEventListener('click', () => {
        const right = +b.dataset.o === q.a; const why = $('.u-why', fs);
        if (right) { b.classList.add('right'); $$('.u-opt', fs).forEach((x) => { x.disabled = true; }); why.innerHTML = '<b class="good">Correct.</b> ' + inline(q.why); ok[qi] = true; if (ok.every(Boolean)) onAll(); }
        else { b.classList.add('wrong'); b.disabled = true; why.innerHTML = '<b class="bad">Not quite.</b> Think it through and try another option.'; if (missKey) { const u = st(); const k = missKey + ':' + qi; u.missed[k] = (u.missed[k] || 0) + 1; srsMiss(k); save(); } }
      })); });
    if (!qs.length) onAll();
  }

  async function lessonView(c, data, i) {
    const l = data.lessons[i]; const un = courseUnlocked(c) && (i === 0 || lessonDone(c.id, i - 1) || lessonDone(c.id, i));
    const crumbs = [['University', []], ['Courses', ['courses']], [c.code, ['course', c.id]], ['Lesson ' + (i + 1)]];
    if (!un) { shell('courses', '<div class="u-lockmsg" role="note">🔒 ' + E(whyLocked(c) || 'Complete the previous lesson first.') + '</div>' + link(['course', c.id], '← Back to the course', 'btn small'), crumbs); return; }
    const done = lessonDone(c.id, i); const u = st(); u.last = [c.id, i]; save();
    const vids = (window.UNI_VIDEOS || []).filter((v) => (v.lessons || []).includes(c.id + ':' + i));
    let h = '<article class="u-lesson"><header><p class="u-eyebrow">' + E(c.code + ' · ' + c.title) + ' · Lesson ' + (i + 1) + ' of ' + data.lessons.length + '</p><h1>' + E(l.t) + '</h1><p class="pill">About ' + l.min + ' minutes' + (done ? ' · completed ✓' : '') + '</p></header><div class="u-prose">' + md(l.md) + '</div>' +
      (vids.length ? '<aside class="u-vidnote">🎬 Prefer to watch? ' + vids.map((v) => link(['videos', v.id], E(v.title))).join(' · ') + '</aside>' : '') +
      (l.try ? '<section class="u-try" aria-label="Interactive exercise"><h2>🧪 Try it yourself</h2><p>' + inline(l.try.prompt) + '</p>' + (A.STATIC_LANGS.includes(l.try.lang) ? '<p class="pill">Optional exercise: this language runs on an online service, so it is not required to complete the lesson and is never marked as passed unless it really ran.</p>' : '') + '<div id="uTry"></div></section>' : '') +
      (l.quiz.length ? '<section class="u-check" aria-label="Knowledge check"><h2>Knowledge check</h2><p class="pill">Answer every question correctly to complete the lesson. Wrong answers are recorded for your revision list, not held against your grade.</p>' + quizHtml(l.quiz) + '</section>' : '') +
      '<section class="u-notes card" aria-label="My notes"><h2>📝 My notes</h2><label for="uNote" class="u-fine">Private notes for this lesson. Saved on this device as you type, included in backups, and searchable on the ' + link(['notes'], 'My notes') + ' page.</label><textarea id="uNote" maxlength="5000" placeholder="What did you learn? What is still unclear? An example in your own words.">' + E((st().notes[lkey(c.id, i)] || {}).t || '') + '</textarea><p class="u-fine" id="uNoteMsg" aria-live="polite"></p></section>' +
      '<p class="u-bmrow"><button type="button" class="btn small" id="uBm" aria-pressed="' + (st().bm[lkey(c.id, i)] ? 'true' : 'false') + '">' + (st().bm[lkey(c.id, i)] ? '★ Bookmarked' : '☆ Bookmark this lesson') + '</button></p><div class="u-lfoot"><div id="uDone" aria-live="polite">' + (done ? '<span class="u-donebadge">✓ Lesson complete</span>' : '') + '</div><div class="u-lnav">' + (i > 0 ? link(['course', c.id, 'lesson', String(i - 1)], '← Previous', 'btn small') : '') + link(['professor', c.id, String(i)], '🤖 Ask the professor', 'btn small') + '<span id="uNext">' + (done ? nextLink(c, data, i) : '') + '</span></div></div></article>';
    shell('courses', h, crumbs);
    { let nt = null; const ta = $('#uNote'), nm = $('#uNoteMsg'); ta.addEventListener('input', () => { nm.textContent = ''; clearTimeout(nt); nt = setTimeout(() => { const s2 = st(), k = lkey(c.id, i), v = ta.value.slice(0, 5000); if (v.trim()) { if (!s2.notes[k] && Object.keys(s2.notes).length >= 1000) { nm.textContent = 'Note limit reached (1,000 lessons).'; return; } s2.notes[k] = { t: v, at: A.dayStr(new Date()) }; } else delete s2.notes[k]; save(); nm.textContent = v.trim() ? 'Saved' : 'Note removed'; }, 600); }); }
    $('#uBm').addEventListener('click', (e) => { const s2 = st(), k = lkey(c.id, i); if (s2.bm[k]) delete s2.bm[k]; else { if (Object.keys(s2.bm).length >= 200) return A.toast('Bookmark limit reached (200).'); s2.bm[k] = A.dayStr(new Date()); } save(); e.currentTarget.setAttribute('aria-pressed', s2.bm[k] ? 'true' : 'false'); e.currentTarget.textContent = s2.bm[k] ? '★ Bookmarked' : '☆ Bookmark this lesson'; });
    const finish = () => {
      if (lessonDone(c.id, i)) return; const u2 = st(); u2.lessons[lkey(c.id, i)] = A.dayStr(new Date()); markStudy(); const xp = A.addXp(5); save();
      $('#uDone').innerHTML = '<span class="u-donebadge">✓ Lesson complete' + (xp ? ' · +' + xp + ' XP' : '') + '</span>'; $('#uNext').innerHTML = nextLink(c, data, i);
      A.toast('✓ Lesson complete' + (xp ? ' · +' + xp + ' XP' : ''));
    };
    let tryOk = !l.try || A.STATIC_LANGS.includes(l.try.lang), quizOk = !l.quiz.length; const both = () => { if (tryOk && quizOk) finish(); };
    if (l.quiz.length) bindQuiz(A.app, l.quiz, () => { quizOk = true; both(); if (!tryOk && !done) { const d = $('#uDone'); if (d) d.innerHTML = '<span class="pill">Now pass the exercise above to complete the lesson.</span>'; } }, c.id + ':' + i);
    if (l.try) { try { await loadMod('uni-assess'); if (U.path[1] !== c.id) return; U.assess.mountTry($('#uTry'), l.try, c.id + ':try' + i, () => { tryOk = true; both(); }); } catch (e) { $('#uTry').innerHTML = '<p class="pill">The exercise could not be loaded (offline). You can still complete the lesson with the knowledge check.</p>'; tryOk = true; both(); } }
    if (!l.quiz.length && !l.try) { const d = $('#uDone'); if (!done) { d.innerHTML = '<button class="btn primary" id="uMark" type="button">I have studied this lesson</button>'; $('#uMark').addEventListener('click', finish); } }
  }
  function nextLink(c, data, i) { return i + 1 < data.lessons.length ? link(['course', c.id, 'lesson', String(i + 1)], 'Next lesson →', 'btn primary small') : link(nextStep(c).path, E(nextStep(c).label) + ' →', 'btn primary small'); }

  /* ---------- videos ---------- */
  async function ensureVideos() { if (U.videosLoaded) return; await new Promise((ok, no) => { const el = document.createElement('script'); el.src = 'uni/data/videos.js?v=' + A.ver; el.onload = ok; el.onerror = () => { el.remove(); no(new Error('offline')); }; document.head.appendChild(el); }); U.videosLoaded = true; }
  U.views.videos = async function (path) {
    const crumbs = [['University', []], ['Video learning centre']];
    try { await ensureVideos(); } catch (e) { shell('videos', offlineHtml('The video list could not be loaded.'), crumbs); return bindRetry(); }
    if (U.path !== path) return;
    const V = window.UNI_VIDEOS || []; const u = st();
    const one = path[1] && V.find((v) => v.id === path[1]);
    if (one) return videoPage(one);
    const fc = path[1] && /^c-/.test(path[1]) ? path[1].slice(2) : ''; const fs = path[1] && /^s[1-6]$/.test(path[1]) ? +path[1][1] : 0; const ft = path[1] && /^t-/.test(path[1]) ? path[1].slice(2) : ''; const DP = (window.UNI_DEPTS || { depts: [] }).depts; const fd = path[1] && /^d-/.test(path[1]) ? DP.find((d) => d.id === path[1].slice(2)) : null;
    const list = V.filter((v) => (!fc || (v.courses || []).includes(fc)) && (!fs || v.stage === fs) && (!ft || (v.lang || '') === ft || (v.topic || '') === ft) && (!fd || (v.courses || []).some((id) => fd.path.includes(id))));
    const langs = Array.from(new Set(V.map((v) => v.lang).filter(Boolean)));
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Video learning centre</p><h1>Lectures that sit beside the written lessons</h1><p>Every video here is a publicly available lecture from a reputable educator, embedded from its original host. Nothing is downloaded or re-hosted. Videos need an internet connection; each one links to the written lesson that covers the same ground so you are never stuck.</p></section>' +
      '<div class="u-filter" role="group" aria-label="Filter videos">' + link(['videos'], 'All', 'u-fbtn' + (!fc && !fs && !ft && !fd ? ' on' : '')) + CAT.stages.map((s) => link(['videos', 's' + s.id], 'Stage ' + s.id, 'u-fbtn' + (fs === s.id ? ' on' : ''))).join('') + langs.map((l) => link(['videos', 't-' + l], E(l), 'u-fbtn' + (ft === l ? ' on' : ''))).join('') + '</div>' +
      '<div class="u-filter" role="group" aria-label="Filter videos by department">' + DP.map((d) => link(['videos', 'd-' + d.id], '<span aria-hidden="true">' + d.icon + '</span> ' + E(d.name), 'u-fbtn' + (fd && fd.id === d.id ? ' on' : ''))).join('') + '</div>' +
      (fc && courseById(fc) ? '<p class="pill">Showing videos for ' + E(courseById(fc).code + ' ' + courseById(fc).title) + '. ' + link(['videos'], 'Show all') + '</p>' : '');
    h += list.length ? '<div class="u-vgrid">' + list.map((v) => link(['videos', v.id], '<div class="uv-thumb" aria-hidden="true"><span>▶</span><small>' + E(v.dur) + '</small></div><div class="uv-b"><small>' + E(v.source) + ' · Stage ' + v.stage + ' · ' + E(v.level) + '</small><b>' + E(v.title) + '</b><span class="uc-state ' + (u.videos[v.id] ? 'done' : '') + '">' + (u.videos[v.id] ? '✓ Watched' : 'Not watched') + '</span></div>', 'u-vcard')).join('') + '</div>' : '<div class="card"><p>No videos are listed for this filter yet. The written lessons cover everything; use the course page instead.</p></div>';
    shell('videos', h, crumbs);
  };
  function videoPage(v) {
    const u = st(); const c = courseById((v.courses || [])[0]); const rel = (v.lessons || [])[0];
    const crumbs = [['University', []], ['Videos', ['videos']], [v.title]];
    let h = '<article class="u-video"><header><p class="u-eyebrow">' + E(v.source) + ' · Stage ' + v.stage + ' · ' + E(v.level) + (v.lang ? ' · ' + E(v.lang) : '') + '</p><h1>' + E(v.title) + '</h1><p class="pill">' + E(v.dur) + (u.videos[v.id] ? ' · watched ✓' : '') + '</p></header>' +
      '<div class="uv-player" id="uvPlayer"><button type="button" class="uv-load" id="uvLoad"><span aria-hidden="true">▶</span><b>Load video from ' + E(v.host || 'YouTube') + '</b><small>The player is only contacted when you press this button.</small></button></div>' +
      '<p class="u-fine">If the player does not appear, the video may be unavailable in your region or you may be offline. <a href="' + E(v.url) + '" target="_blank" rel="noopener noreferrer">Open it on ' + E(v.host || 'YouTube') + '</a>' + (v.alt ? ' or use the <a href="' + E(v.alt) + '" target="_blank" rel="noopener noreferrer">course page with transcripts and notes</a>' : '') + '. The written lesson below covers the same material.' + (v.idChecked && /^\d{4}-\d{2}-\d{2}$/.test(v.idChecked) ? ' The video ID and title were last matched against public listings on ' + E(v.idChecked) + '; that check does not prove the video still plays.' : '') + '</p>' +
      '<div class="u-cols"><section><h2 class="u-h2">About this lecture</h2><p>' + E(v.desc) + '</p><h3>Learning objectives</h3><ul class="u-out">' + (v.obj || []).map((x) => '<li>' + E(x) + '</li>').join('') + '</ul>' + (v.chapters && v.chapters.length ? '<h3>Chapters</h3><ul class="u-chap">' + v.chapters.map((ch) => '<li><code>' + E(ch[0]) + '</code> ' + E(ch[1]) + '</li>').join('') + '</ul>' : '') + '<p class="u-fine">Captions: ' + E(v.captions || 'available in the player (CC button) where the publisher provides them') + '. Licence and credit: ' + E(v.credit || v.source) + '.</p></section>' +
      '<section><h2 class="u-h2">Study with it</h2><ul class="u-list">' + (rel ? '<li>' + link(['course', rel.split(':')[0], 'lesson', rel.split(':')[1]], '<b>📖 Related written lesson</b><small>' + (c ? E(c.code + ' ' + c.title) : '') + '</small>') + '</li>' : c ? '<li>' + link(['course', c.id], '<b>📖 Related course</b><small>' + E(c.code + ' ' + c.title) + '</small>') + '</li>' : '') + (c && c.lab ? '<li>' + link(['course', c.id, 'lab'], '<b>🧪 Practical exercise</b><small>The course programming assignment</small>') + '</li>' : '') + '</ul>' +
      (v.quiz && v.quiz.length ? '<div class="u-check"><h3>Quiz after watching</h3>' + quizHtml(v.quiz) + '</div>' : '') + '<div id="uvDone" aria-live="polite">' + (u.videos[v.id] ? '<span class="u-donebadge">✓ Marked as watched</span>' : '<button class="btn primary" id="uvMark" type="button"' + (v.quiz && v.quiz.length ? ' disabled' : '') + '>Mark as completed</button>' + (v.quiz && v.quiz.length ? '<p class="pill">Answer the quiz to enable this.</p>' : '')) + '</div></section></div></article>';
    shell('videos', h, crumbs);
    $('#uvLoad').addEventListener('click', () => {
      if (!/^[\w-]{6,20}$/.test(v.yt || '')) return;
      $('#uvPlayer').innerHTML = '<iframe title="' + E(v.title) + '" src="https://www.youtube-nocookie.com/embed/' + v.yt + '?rel=0" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    });
    const mark = () => { const b = $('#uvMark'); if (b) b.disabled = false; };
    if (v.quiz && v.quiz.length) bindQuiz(A.app, v.quiz, mark);
    const mb = $('#uvMark'); if (mb) mb.addEventListener('click', () => { st().videos[v.id] = A.dayStr(new Date()); markStudy(); save(); $('#uvDone').innerHTML = '<span class="u-donebadge">✓ Marked as watched</span>'; });
  }

  /* ---------- lazily loaded sections ---------- */
  const viaMod = (mod, active, name) => async function (path) {
    const crumbs = [['University', []], [name]]; loading(active, crumbs);
    try { await loadMod(mod); } catch (e) { shell(active, offlineHtml('This section could not be loaded.'), crumbs); return bindRetry(); }
    if (U.path !== path) return; return U.lazy[active](path);
  };
  U.lazy = {};
  U.views.labs = viaMod('uni-assess', 'labs', 'Programming laboratories');
  U.views.exams = viaMod('uni-assess', 'exams', 'Examinations');
  U.views.final = async function (path) { const crumbs = [['University', []], ['Final examination']]; loading('exams', crumbs); try { await loadMod('uni-assess'); } catch (e) { shell('exams', offlineHtml(), crumbs); return bindRetry(); } if (U.path !== path) return; return U.lazy.final(path); };
  U.views.projects = viaMod('uni-assess', 'projects', 'Projects and portfolio');
  U.views.departments = viaMod('uni-campus', 'departments', 'Departments');
  U.views.career = viaMod('uni-campus', 'career', 'Career centre');
  U.views.study = viaMod('uni-campus', 'study', 'My study');
  U.views.notes = async function (path) { const crumbs = [['University', []], ['My study', ['study']], ['My notes']]; loading('study', crumbs); try { await loadMod('uni-campus'); } catch (e) { shell('study', offlineHtml('This section could not be loaded.'), crumbs); return bindRetry(); } if (U.path !== path) return; return U.lazy.notes(path); };
  U.views.transcript = viaMod('uni-assess', 'transcript', 'Transcript and certificates');
  U.views.professor = viaMod('uni-professor', 'professor', 'AI Professor');
  const studioView = (key, name) => async function (path) { const crumbs = [['University', []], ['Laboratories', ['labs']], [name]]; loading('labs', crumbs); try { await loadMod('uni-studio'); } catch (e) { shell('labs', offlineHtml('This section could not be loaded.'), crumbs); return bindRetry(); } if (U.path !== path) return; return U.studio[key](path); };
  U.views.visual = studioView('visual', 'Algorithm visualiser');
  const toolView = (key, active, crumbs) => async function (path) { loading(active, crumbs); try { await loadMod('uni-tools'); } catch (e) { shell(active, offlineHtml('This section could not be loaded.'), crumbs); return bindRetry(); } if (U.path !== path) return; return U.tools[key](path); };
  U.views.review = toolView('review', 'review', [['University', []], ['Review']]);
  U.views.search = toolView('search', 'search', [['University', []], ['Search']]);
  U.views.terminal = toolView('terminal', 'labs', [['University', []], ['Laboratories', ['labs']], ['Git and terminal simulator']]);
  U.views.portfolio = toolView('portfolio', 'projects', [['University', []], ['Projects', ['projects']], ['Portfolio']]);
  U.views.practice = studioView('practice', 'Practice studio');
  const simView = (key, name) => async function (path) { const crumbs = [['University', []], ['Laboratories', ['labs']], [name]]; loading('labs', crumbs); try { await loadMod('uni-sims'); } catch (e) { shell('labs', offlineHtml('This section could not be loaded.'), crumbs); return bindRetry(); } if (U.path !== path) return; return U.sims[key](path); };
  U.views.circuit = simView('circuit', 'Circuit simulator');
  U.views.range = simView('range', 'Ethical hacking range');

  /* ---------- public surface ---------- */
  Object.assign(U, { srsMiss, srsAnswer, srsSync, srsCounts, addDays, $, $$, E, md, inline, st, save, shell, link, href, ring, bar, courseCard, quizHtml, bindQuiz, qText, loadCourse, loadFile, loadMod, ensureVideos, markStudy, lkey, viaMod, streak, fmtTime, offlineHtml, bindRetry, loading,
    courseById, stageById, coursesOf, lessonDone, lessonsDone, labPassed, attempts, bestOf, examPassed, projectDone, projectPct, courseDone, coursePct, courseGrade, labReq, letter, finalId, finalPassed, stageUnlocked, stageComplete, stageCoursesDone, courseUnlocked, whyLocked, currentStage, overall, nextUp, nextStep, gradReqs, parseCourseFile, PASS, FINAL_PASS });
  U.init = async function (api) { A = api; U.api = api; window.LEARN_UNI_VER = api.ver; st(); startClock(); U.ready = true; };
  U.render = function (path) {
    U.path = path = path || []; const v = U.views[path[0] || ''] || U.views[''];
    try { const r = v(path); if (r && r.catch) r.catch((e) => { console.error(e); if (U.mixed || (looksMixed(e) && A.repair && !A.repairTried(BUILD))) return showMixed(path[0] || ''); shell(path[0] || '', offlineHtml('Something went wrong while opening this page: ' + (e && e.message ? e.message : 'unknown error')), [['University', []]]); bindRetry(); }); }
    catch (e) { console.error(e); if (U.mixed || (looksMixed(e) && A.repair && !A.repairTried(BUILD))) return showMixed(''); shell('', offlineHtml('Something went wrong while opening this page.'), [['University', []]]); bindRetry(); }
  };
  window.LearnUniversity = U;
})();
