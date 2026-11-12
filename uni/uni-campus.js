/* ============================================================
   Technology University: campus module (loaded on demand)
     departments   8 departments as pathways over the course catalogue + electives
     career        roles and skill-gap analysis, CV builder, interview practice, presentation outline, guidance
     study         weekly goal, recommendations, weak subjects, bookmarks, history, achievements, weekly challenge
   Everything here is derived from, or stored inside, the student's own Learn save (S.uni) on their device.
   Nothing is sent anywhere. There are no shared leaderboards: see docs/SECURITY.md for why.
   ============================================================ */
(function () {
  'use strict';
  const U = window.LearnUniversity, A = U.api, D = window.UNI_DEPTS || { depts: [], roles: [], concepts: [], behavioural: [], coding: [] };
  const { $, $$, E, md, inline, st, save, shell, link, bar, ring } = U; const CAT = U.cat;
  const C = (id) => U.courseById(id);
  const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
  const clip = (v, n) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
  const safeUrl = (u) => { const s = String(u || '').trim(); return /^https:\/\/[\w.-]+(\/[^\s<>"'`]*)?$/.test(s) && s.length < 300 ? s : ''; };
  const status = (c) => (U.courseDone(c) ? 'done' : !U.courseUnlocked(c) ? 'lock' : U.coursePct(c) ? 'prog' : '');
  const statusText = (c) => (U.courseDone(c) ? '✓ Completed' : !U.courseUnlocked(c) ? '🔒 Locked' : U.coursePct(c) ? 'In progress · ' + U.coursePct(c) + '%' : 'Open');
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/html' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const pathRow = (c, i) => '<li class="' + status(c) + '">' + link(['course', c.id], '<span class="ul-n">' + (U.courseDone(c) ? '✓' : i + 1) + '</span><span class="ul-t">' + E(c.code + ' · ' + c.title) + '</span><span class="ul-m">' + (c.elective ? 'Department elective' : 'Stage ' + c.stage) + ' · ' + c.n + ' lessons · ' + E(statusText(c)) + '</span>') + '</li>';

  /* ---------------- departments ---------------- */
  const deptProgress = (d) => { const cs = d.path.map(C).filter(Boolean); const done = cs.filter(U.courseDone).length; return { cs, done, pct: cs.length ? Math.round(cs.reduce((n, c) => n + U.coursePct(c), 0) / cs.length) : 0 }; };
  U.lazy.departments = function (path) {
    const d = D.depts.find((x) => x.id === path[1]);
    if (!d) {
      let h = '<section class="u-stagehero"><p class="u-eyebrow">Technology University</p><h1>Eight departments, one catalogue</h1><p>A department is a recommended route through the courses for one discipline. Courses are shared: completing a course counts in every department that uses it. The six academic stages and their examinations stay exactly as they are; department electives are extra and do not change graduation requirements.</p></section><div class="u-deptgrid">' +
        D.depts.map((x) => { const p = deptProgress(x); const own = (CAT.electives || []).filter((e) => e.dept === x.id).length; return link(['departments', x.id], '<span class="ud-ico" aria-hidden="true">' + x.icon + '</span><h3>' + E(x.name) + '</h3><p>' + E(x.blurb) + '</p><p class="ud-meta">' + p.cs.length + ' courses on the pathway' + (own ? ' · ' + own + ' dedicated elective' + (own === 1 ? '' : 's') : '') + '</p>' + bar(p.pct) + '<p class="ud-meta">' + p.done + ' of ' + p.cs.length + ' completed</p>', 'card u-dept'); }).join('') + '</div>' +
        '<div class="card"><h2>How complete is each department?</h2><p>Software Engineering and Computer Science are full programmes. AI, Cybersecurity and Cloud each have several dedicated advanced courses. Game Development, Computer Engineering and Mobile Development each have <b>one dedicated foundation course so far</b>, plus a pathway through the shared courses they depend on. Each department page states plainly what it does not cover yet.</p></div>';
      return shell('departments', h, [['University', []], ['Departments']]);
    }
    const p = deptProgress(d); const vids = (window.UNI_VIDEOS || []).filter((v) => (v.courses || []).some((id) => d.path.includes(id)));
    const next = p.cs.find((c) => U.courseUnlocked(c) && !U.courseDone(c));
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Department</p><h1><span aria-hidden="true">' + d.icon + '</span> ' + E(d.name) + '</h1><p>' + E(d.blurb) + '</p><div class="uc-meta"><span>' + p.cs.length + ' courses</span><span>' + p.done + ' completed</span><span>' + p.pct + '% of pathway</span></div>' + (next ? link(U.nextStep(next).path, 'Continue: ' + E(next.code + ' · ' + U.nextStep(next).label) + ' →', 'btn primary') : '') + '</section>';
    h += '<div class="u-cols"><section><h2 class="u-h2">What you will be able to do</h2><ul class="u-out">' + d.outcomes.map((x) => '<li>' + E(x) + '</li>').join('') + '</ul></section><section><h2 class="u-h2">What this department covers</h2><div class="card"><p>' + E(d.note) + '</p></div></section></div>';
    h += '<h2 class="u-h2">Learning pathway</h2><p class="pill">Take these in order. Locked courses open as you pass the stage finals and prerequisites of the main programme.</p><ol class="u-lessons u-path">' + p.cs.map(pathRow).join('') + '</ol>';
    const more = [];
    (d.labs || []).forEach((l) => more.push(link(['labs', l], '<b>🧪 ' + E(l[0].toUpperCase() + l.slice(1)) + ' practice lab</b><small>Runs on an online service; needs a connection</small>')));
    (d.extra || []).forEach((x) => more.push('<a href="' + E(x[0]) + '"><b>🚀 ' + E(x[1]) + '</b><small>' + E(x[2]) + '</small></a>'));
    more.push(link(['videos'], '<b>🎬 Video lectures</b><small>' + (U.videosLoaded ? vids.length + ' linked to this pathway' : 'Open the video centre') + '</small>'));
    (d.careers || []).forEach((r) => { const role = D.roles.find((x) => x.id === r); if (role) more.push(link(['career', 'role', role.id], '<b>💼 Career: ' + E(role.name) + '</b><small>See what you still need for this role</small>')); });
    h += '<h2 class="u-h2">Also in this department</h2><ul class="u-list">' + more.map((m) => '<li>' + m + '</li>').join('') + '</ul>';
    shell('departments', h, [['University', []], ['Departments', ['departments']], [d.name]]);
  };

  /* ---------------- career centre ---------------- */
  const CTABS = [['', 'Roles and skill gaps'], ['cv', 'CV builder'], ['interview', 'Interview practice'], ['present', 'Present a project'], ['guide', 'Job and internship guide']];
  const ctabs = (on) => '<div class="u-filter" role="group" aria-label="Career centre sections">' + CTABS.map((t) => link(t[0] ? ['career', t[0]] : ['career'], t[1], 'u-fbtn' + (t[0] === on ? ' on' : ''))).join('') + '</div>';
  const gap = (r) => { const need = r.need.map(C).filter(Boolean); const done = need.filter(U.courseDone); return { need, done, pct: need.length ? Math.round(done.length / need.length * 100) : 0, missing: need.filter((c) => !U.courseDone(c)) }; };
  const crumbsC = (x) => [['University', []], ['Career centre', ['career']]].concat(x ? [[x]] : []);
  const HONEST = '<p class="u-fine">This centre helps you present skills you really have. It does not list jobs, and nothing here promises employment. Courses and certificates on this site are not accredited qualifications; describe them as self-study.</p>';

  U.lazy.career = async function (path) {
    const sub = path[1] || '';
    if (sub === 'role') return roleView(path[2]);
    if (sub === 'cv') return cvView();
    if (sub === 'interview') return interviewView(path);
    if (sub === 'present') return presentView(path[2]);
    if (sub === 'guide') return guideView();
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Career centre</p><h1>Turn what you have learned into evidence</h1><p>Pick a role to see which courses it needs and how far you are. Build a CV from your real record, practise interviews, and prepare to present a project.</p></section>' + ctabs('') +
      '<div class="u-cgrid">' + D.roles.map((r) => { const g = gap(r); return link(['career', 'role', r.id], '<div class="uc-top"><span class="uc-code">Role</span><span class="uc-state ' + (g.pct === 100 ? 'done' : g.pct ? 'prog' : '') + '">' + g.pct + '% ready</span></div><h3>' + E(r.name) + '</h3><p>' + E(r.does) + '</p>' + bar(g.pct) + '<p class="ud-meta">' + g.done.length + ' of ' + g.need.length + ' core courses completed</p>', 'card u-ccard'); }).join('') + '</div>' + HONEST;
    shell('career', h, crumbsC());
  };
  function roleView(id) {
    const r = D.roles.find((x) => x.id === id); if (!r) return U.lazy.career(['career']);
    const g = gap(r); const nxt = g.missing.find((c) => U.courseUnlocked(c)); const further = (r.next || []).map(C).filter(Boolean);
    const have = Array.from(new Set(g.done.reduce((a, c) => a.concat(c.skills || []), []))); const lack = Array.from(new Set(g.missing.reduce((a, c) => a.concat(c.skills || []), [])));
    let h = '<section class="u-chead"><div><p class="u-eyebrow">Career pathway</p><h1>' + E(r.name) + '</h1><p>' + E(r.does) + '</p>' + (nxt ? link(U.nextStep(nxt).path, 'Next for this role: ' + E(nxt.code + ' · ' + U.nextStep(nxt).label) + ' →', 'btn primary') : g.pct === 100 ? '<p class="pill">You have completed every core course for this role. Build the project evidence next.</p>' : '<p class="pill">The next course for this role is locked. Keep going with the main programme to open it.</p>') + '</div><div class="uc-side">' + ring(g.pct, 'Readiness ' + g.pct + ' percent') + '<p class="ud-cap">core courses completed</p></div></section>';
    h += '<h2 class="u-h2">Skill gap analysis</h2><div class="u-cols"><section><h3>Skills you have evidence for</h3>' + (have.length ? '<div class="u-chips">' + have.map((s) => '<span class="u-chip">' + E(s) + '</span>').join('') + '</div>' : '<p class="pill">None yet. Skills are added when you complete a course.</p>') + '</section><section><h3>Skills still to build</h3>' + (lack.length ? '<div class="u-chips">' + lack.map((s) => '<span class="u-chip u-chip-off">' + E(s) + '</span>').join('') + '</div>' : '<p class="pill">Nothing missing from the core list.</p>') + '</section></div>';
    h += '<h2 class="u-h2">Core courses for this role</h2><ol class="u-lessons u-path">' + g.need.map(pathRow).join('') + '</ol>' + (further.length ? '<h2 class="u-h2">To go further</h2><ol class="u-lessons u-path">' + further.map(pathRow).join('') + '</ol>' : '') +
      '<div class="card"><h2>What employers look for beyond courses</h2><ul><li>One or two finished projects you can explain in depth matter more than many certificates.</li><li>Public code with a clear README, tests and a history of commits.</li><li>Being able to describe a trade-off you made and what you would do differently.</li></ul>' + link(['projects'], 'Open your portfolio →', 'btn small') + ' ' + link(['career', 'interview'], 'Practise interviews →', 'btn small') + '</div>' + HONEST;
    shell('career', h, crumbsC(r.name));
  }

  /* CV builder: stored only on this device, inside the Learn save */
  const CVF = [['headline', 'Headline', 'For example: Junior back-end developer', 90, 'input'], ['location', 'Location (city or region, optional)', '', 60, 'input'], ['email', 'Contact email (optional; it appears only in the file you export)', '', 90, 'input'], ['github', 'GitHub profile link (https://github.com/your-name)', '', 120, 'input'], ['site', 'Portfolio or website link (https)', '', 200, 'input'], ['summary', 'Summary (2 to 4 sentences about what you build and what you are looking for)', '', 700, 'area'], ['experience', 'Experience (one item per line: role, organisation, dates, what you did)', '', 2500, 'area'], ['education', 'Education (one item per line)', '', 1500, 'area'], ['skills', 'Other skills (comma separated; only ones you can demonstrate)', '', 500, 'input']];
  function cvData() { const u = st(); const cv = u.cv; CVF.forEach((f) => { cv[f[0]] = clip(cv[f[0]], f[3]); }); if (typeof cv.incCourses !== 'boolean') cv.incCourses = true; if (typeof cv.incProjects !== 'boolean') cv.incProjects = true; return cv; }
  function cvHtml(full) {
    const u = st(), cv = cvData(); const done = CAT.courses.concat(CAT.electives || []).filter(U.courseDone);
    const skills = Array.from(new Set(done.reduce((a, c) => a.concat(c.skills || []), []).concat(cv.skills.split(',').map((s) => s.trim()).filter(Boolean)))).slice(0, 60);
    const projs = CAT.courses.concat(CAT.electives || []).filter((c) => c.project && U.projectDone(c)).map((c) => ({ c, r: u.projects[c.id] }));
    const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const gh = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/?$/.test(cv.github.trim()) ? cv.github.trim() : ''; const site = safeUrl(cv.site);
    const mail = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(cv.email.trim()) ? cv.email.trim() : '';
    let b = '<h1>' + (E(u.name) || 'Your name') + '</h1>' + (cv.headline ? '<p class="cv-head">' + E(cv.headline) + '</p>' : '') + '<p class="cv-contact">' + [cv.location ? E(cv.location) : '', mail ? E(mail) : '', gh ? '<a href="' + E(gh) + '">' + E(gh.replace('https://', '')) + '</a>' : '', site ? '<a href="' + E(site) + '">' + E(site.replace('https://', '')) + '</a>' : ''].filter(Boolean).join(' · ') + '</p>';
    if (cv.summary) b += '<h2>Summary</h2><p>' + E(cv.summary) + '</p>';
    if (skills.length) b += '<h2>Skills</h2><p>' + skills.map(E).join(' · ') + '</p>';
    if (cv.incProjects && projs.length) b += '<h2>Projects</h2>' + projs.slice(0, 8).map((p) => '<div class="cv-item"><b>' + E(p.r.title || p.c.ptitle || p.c.title) + '</b>' + (safeUrl(p.r.url) ? ' · <a href="' + E(safeUrl(p.r.url)) + '">' + E(safeUrl(p.r.url).replace('https://', '')) + '</a>' : '') + '<p>' + E(String(p.r.notes || '').slice(0, 320)) + (String(p.r.notes || '').length > 320 ? '…' : '') + '</p></div>').join('');
    if (lines(cv.experience).length) b += '<h2>Experience</h2><ul>' + lines(cv.experience).map((x) => '<li>' + E(x) + '</li>').join('') + '</ul>';
    b += '<h2>Education and training</h2><ul>' + lines(cv.education).map((x) => '<li>' + E(x) + '</li>').join('') + (cv.incCourses && done.length ? '<li>Self-study: Learn Software Engineering University pathway, ' + done.length + ' course' + (done.length === 1 ? '' : 's') + ' completed (' + done.slice(0, 12).map((c) => E(c.title)).join(', ') + (done.length > 12 ? ', and more' : '') + '). Not an accredited qualification.</li>' : '') + '</ul>';
    if (!full) return b;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CV' + (u.name ? ' · ' + E(u.name) : '') + '</title><style>body{font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;max-width:780px;margin:36px auto;padding:0 22px;color:#141a33}h1{font-size:30px;margin:0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #c9d1e6;padding-bottom:4px;margin:22px 0 8px}.cv-head{font-size:17px;margin:4px 0}.cv-contact{color:#4a5475;margin:4px 0}.cv-item{margin:8px 0}.cv-item p{margin:2px 0}a{color:#1a2470}ul{padding-left:20px;margin:6px 0}@media print{body{margin:0 auto}}</style></head><body>' + b + '</body></html>';
  }
  function cvView() {
    const u = st(), cv = cvData();
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Career centre</p><h1>CV builder</h1><p>Fill in the form; the preview updates as you type. Skills and projects come from courses you have actually completed here. Everything is stored on this device only, and is not sent anywhere. Download the file or print it to PDF.</p></section>' + ctabs('cv') +
      '<div class="u-cols u-cvcols"><form id="cvForm" class="card" novalidate><label class="up-f">Name (shared with your transcript)<input type="text" id="cvName" maxlength="60" value="' + E(u.name) + '" autocomplete="name"></label>' +
      CVF.map((f) => '<label class="up-f">' + E(f[1]) + (f[4] === 'area' ? '<textarea data-cv="' + f[0] + '" rows="' + (f[0] === 'summary' ? 4 : 5) + '" maxlength="' + f[3] + '">' + E(cv[f[0]]) + '</textarea>' : '<input type="text" data-cv="' + f[0] + '" maxlength="' + f[3] + '" placeholder="' + E(f[2]) + '" value="' + E(cv[f[0]]) + '">') + '</label>').join('') +
      '<label class="u-check"><input type="checkbox" id="cvIncP"' + (cv.incProjects ? ' checked' : '') + '> Include my submitted projects</label><label class="u-check"><input type="checkbox" id="cvIncC"' + (cv.incCourses ? ' checked' : '') + '> Include completed courses, labelled as self-study</label>' +
      '<p class="u-fine" id="cvWarn" role="status"></p><div class="ux-submit"><button type="button" class="btn primary" id="cvDown">⬇ Download CV (HTML)</button> <button type="button" class="btn small" id="cvPrint">Print or save as PDF</button></div></form>' +
      '<section aria-label="CV preview"><h2 class="u-h2">Preview</h2><div class="card u-cvprev" id="cvPrev"></div></section></div>' +
      '<div class="card"><h2>Writing a CV that is believed</h2><ul><li>Lead with what you built, not what you studied. Link to the code.</li><li>Use numbers where they are real: "cut page load from 3.1 s to 0.9 s".</li><li>List only skills you could be questioned on for ten minutes.</li><li>One page is enough at the start of a career.</li><li>GitHub: only your public profile link is used. This site does not connect to GitHub or read your repositories.</li></ul></div>' + HONEST;
    shell('career', h, crumbsC('CV builder'));
    const paint = () => { $('#cvPrev').innerHTML = cvHtml(false); const c2 = cvData(); const w = []; if (c2.github.trim() && !/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/?$/.test(c2.github.trim())) w.push('The GitHub link must look like https://github.com/your-name, so it was left out.'); if (c2.site.trim() && !safeUrl(c2.site)) w.push('The website link must start with https://, so it was left out.'); if (c2.email.trim() && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(c2.email.trim())) w.push('The email address does not look valid, so it was left out.'); $('#cvWarn').textContent = w.join(' '); };
    let t = null; const later = () => { clearTimeout(t); t = setTimeout(save, 400); };
    $$('[data-cv]').forEach((el) => el.addEventListener('input', () => { cvData()[el.dataset.cv] = clip(el.value, +el.getAttribute('maxlength')); paint(); later(); }));
    $('#cvName').addEventListener('input', (e) => { st().name = e.target.value.replace(/[<>]/g, '').slice(0, 60); paint(); later(); });
    $('#cvIncP').addEventListener('change', (e) => { cvData().incProjects = e.target.checked; paint(); later(); });
    $('#cvIncC').addEventListener('change', (e) => { cvData().incCourses = e.target.checked; paint(); later(); });
    $('#cvDown').addEventListener('click', () => download('cv.html', cvHtml(true)));
    $('#cvPrint').addEventListener('click', () => { const w = window.open('', '_blank'); if (!w) return A.toast('Allow pop-ups to print, or use Download.'); w.document.open(); w.document.write(cvHtml(true)); w.document.close(); setTimeout(() => { try { w.print(); } catch (e) {} }, 300); });
    paint();
  }

  /* interview practice */
  async function interviewView(path) {
    const u = st(); const crumbs = crumbsC('Interview practice');
    const ex = D.coding.find((x) => x.id === path[2]);
    if (ex) {
      U.loading('career', crumbs); try { await U.loadMod('uni-assess'); } catch (e) { shell('career', U.offlineHtml('The code runner could not be loaded.'), crumbs); return U.bindRetry(); }
      if (U.path !== path) return;
      const rec = u.iv['code:' + ex.id] || {};
      shell('career', '<article class="u-lab"><header><p class="u-eyebrow">Programming interview exercise · ' + E(ex.level) + ' · ' + E(U.assess.langName(ex.lang)) + '</p><h1>' + E(ex.title) + '</h1><p class="pill" id="ivState">' + (rec.pass ? 'Solved ✓ on ' + E(rec.at) + ' · ' + (rec.tries || 1) + ' submission' + ((rec.tries || 1) === 1 ? '' : 's') : 'Marked by ' + ex.tests.length + ' test cases. In a real interview, talk through your approach before you write code.') + '</p></header><div class="u-prose">' + md(ex.md) + '</div><div id="ivHost"></div><p>' + link(['career', 'interview'], '← All interview practice', 'btn small') + '</p></article>', crumbs);
      U.assess.mountTask($('#ivHost'), ex, { saveKey: 'iv:' + ex.id, onResult: (g) => { if (g.ungraded) return; const s2 = st(); const r = s2.iv['code:' + ex.id] = s2.iv['code:' + ex.id] || {}; r.tries = (r.tries || 0) + 1; if (g.pass && !r.pass) { r.pass = true; r.at = A.dayStr(new Date()); U.markStudy(); $('#ivState').textContent = 'Solved ✓ on ' + r.at; } save(); } });
      return;
    }
    const solved = D.coding.filter((x) => (u.iv['code:' + x.id] || {}).pass).length; const revised = D.concepts.filter((q, i) => u.iv['c:' + i]).length;
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Career centre</p><h1>Technical interview practice</h1><p>Three kinds of practice: programming exercises marked by tests, technical questions you answer in your own words and then check against key points, and behavioural questions with a structure for answering them.</p><div class="uc-meta"><span>' + solved + ' of ' + D.coding.length + ' exercises solved</span><span>' + revised + ' of ' + D.concepts.length + ' technical questions practised</span></div></section>' + ctabs('interview');
    h += '<h2 class="u-h2">Programming exercises (marked automatically)</h2><ul class="u-list">' + D.coding.map((x) => { const r = u.iv['code:' + x.id] || {}; return '<li>' + link(['career', 'interview', x.id], '<b>' + E(x.title) + '</b><small>' + E(x.level) + ' · ' + E(x.lang === 'py' ? 'Python' : 'JavaScript') + ' · ' + (r.pass ? 'Solved ✓' : r.tries ? r.tries + ' attempt' + (r.tries === 1 ? '' : 's') + ', not solved yet' : 'Not attempted') + '</small>') + '</li>'; }).join('') + '</ul>';
    h += '<h2 class="u-h2">Technical questions (self-checked)</h2><p class="pill">Write your answer first. Then reveal the key points and tick the ones your answer really covered. This is self-assessment; no one is marking it but you.</p>' +
      D.concepts.map((q, i) => { const r = u.iv['c:' + i]; const c = C(q[3]); return '<details class="card u-ivq" data-i="' + i + '"><summary><span class="uc-code">' + E(q[0]) + '</span> ' + E(q[1]) + (r ? ' <span class="uc-state done">last: ' + r.n + '/' + q[2].length + '</span>' : '') + '</summary><label class="up-f">Your answer<textarea rows="5" maxlength="3000" placeholder="Answer as you would aloud, in full sentences."></textarea></label><button type="button" class="btn small" data-rev>Reveal key points</button><div class="u-ivkey" hidden><fieldset class="ux-rub"><legend>Tick what your answer covered</legend>' + q[2].map((k) => '<label><input type="checkbox"><span>' + E(k) + '</span></label>').join('') + '</fieldset><button type="button" class="btn small primary" data-rec>Record this practice</button> ' + (c ? link(['course', c.id], 'Revise in ' + E(c.code), 'btn small') : '') + '<span class="pill" data-msg role="status"></span></div></details>'; }).join('');
    h += '<h2 class="u-h2">Behavioural questions</h2><div class="card"><p>Answer with <b>STAR</b>: the <b>S</b>ituation, the <b>T</b>ask you had, the <b>A</b>ction you personally took, and the <b>R</b>esult, with what you learned. Use real examples, including from your projects here. Two minutes each, aloud.</p><ol>' + D.behavioural.map((b) => '<li>' + E(b) + '</li>').join('') + '</ol></div>' +
      '<div class="card"><h2>In the interview</h2><ul><li>Restate the problem and ask about inputs, sizes and edge cases before coding.</li><li>Say your plan and its complexity first; start simple and improve.</li><li>Test your code aloud with a small example and an edge case.</li><li>If you are stuck, say what you are thinking. Silence gives the interviewer nothing.</li><li>"I do not know, but here is how I would find out" is a good answer.</li></ul></div>' + HONEST;
    shell('career', h, crumbs);
    $$('.u-ivq').forEach((d) => { const i = +d.dataset.i; const ta = $('textarea', d);
      $('[data-rev]', d).addEventListener('click', () => { if (words(ta.value) < 15) { $('[data-rev]', d).textContent = 'Write at least 15 words first, then reveal'; return; } $('.u-ivkey', d).hidden = false; $('[data-rev]', d).hidden = true; });
      $('[data-rec]', d).addEventListener('click', () => { const n = $$('.ux-rub input', d).filter((b) => b.checked).length; st().iv['c:' + i] = { n, at: A.dayStr(new Date()) }; U.markStudy(); save(); $('[data-msg]', d).textContent = 'Recorded: ' + n + ' of ' + D.concepts[i][2].length + ' key points.'; }); });
  }

  function presentView(id) {
    const u = st(); const all = CAT.courses.concat(CAT.electives || []).filter((c) => c.project && U.projectDone(c)); const c = all.find((x) => x.id === id);
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Career centre</p><h1>Present a project</h1><p>A five-minute talk about one finished project is the most useful thing you can prepare for an interview, a meetup or a portfolio video. Choose a submitted project to get an outline built from your own notes.</p></section>' + ctabs('present');
    if (!all.length) h += '<div class="card"><p>You have not submitted a project yet. Projects are submitted from each course page; once you have one, come back here.</p>' + link(['projects'], 'Open projects →', 'btn small') + '</div>';
    else h += '<div class="u-filter" role="group" aria-label="Choose a project">' + all.map((x) => link(['career', 'present', x.id], E(x.code), 'u-fbtn' + (c && c.id === x.id ? ' on' : ''))).join('') + '</div>';
    if (c) { const r = u.projects[c.id];
      h += '<article class="card u-present"><h2>' + E(r.title || c.ptitle || c.title) + '</h2><p class="u-fine">Five minutes. Rehearse aloud with a timer.</p><ol class="u-talk">' +
        [['0:00', 'The problem', 'Who had what problem? One sentence a non-programmer would understand.'], ['0:40', 'Show it working', 'Demonstrate the most valuable thing first. Have a recording in case the live demo fails.'], ['2:00', 'How it is built', 'One diagram. The two or three decisions that mattered and what you chose between.'], ['3:15', 'Evidence', 'Tests, measurements, what broke and how you fixed it.'], ['4:15', 'Limits and next steps', 'What it does not do, and what you would change. Saying this plainly builds trust.']].map((s) => '<li><code>' + s[0] + '</code> <b>' + s[1] + '</b><p>' + s[2] + '</p></li>').join('') + '</ol>' +
        '<h3>Your own notes on this project</h3><blockquote class="ux-ans">' + E(r.notes || '') + '</blockquote>' + (safeUrl(r.url) ? '<p>Link: <a href="' + E(safeUrl(r.url)) + '" target="_blank" rel="noopener noreferrer">' + E(safeUrl(r.url)) + '</a></p>' : '') + '<p>Skills to mention: ' + E((c.skills || []).join(', ') || 'see the course objectives') + '</p><button type="button" class="btn small" id="prPrint">Print this outline</button></article>'; }
    shell('career', h + HONEST, crumbsC('Present a project'));
    const pb = $('#prPrint'); if (pb) pb.addEventListener('click', () => window.print());
  }
  function guideView() {
    const t = '### Before you apply\n- Finish one project properly: deployed or runnable, with a README, tests and a short write-up. One finished project is worth more than five started ones.\n- Put your code somewhere public and keep the history: reviewers read commits.\n- Write a one-page CV with the builder here, and ask someone to read it for clarity.\n\n### Finding real openings\nThis site does not list jobs and cannot verify any. Use employers\' own careers pages, your school or college careers service, and established job boards. Be cautious: a real employer never asks you to pay to apply, to buy equipment up front, or for bank details before a written offer.\n\n### Internships and first roles\n- Apply to roles that ask for slightly more than you have. Requirements lists are wish lists.\n- A short, specific message beats a long generic one: what you built, why this team, a link.\n- Open-source contributions and small freelance or volunteer work count as experience. Describe exactly what you did.\n\n### Preparing for interviews\n| Stage | What it tests | How to prepare here |\n|---|---|---|\n| Screening call | Motivation, communication | Behavioural questions with STAR |\n| Coding interview | Problem solving and clear thinking | Programming exercises; talk aloud |\n| Technical discussion | Depth of understanding | Technical questions; your project |\n| System design (later roles) | Trade-offs at scale | Stage 4 courses on system design |\n\n### After each interview\nWrite down every question the same day. Whatever the outcome, that list is your revision plan.\n\n### If you are under 18\nRules on work for young people vary by country and region. Ask a parent, guardian or teacher before applying for anything, and never share personal details with someone you cannot verify.\n\n### Honesty\nDescribe the courses here as self-study. The certificates are records of completion on this site and are not accredited qualifications. What persuades an employer is what you can show and explain.';
    shell('career', '<section class="u-stagehero"><p class="u-eyebrow">Career centre</p><h1>Job and internship preparation</h1><p>Practical guidance for getting from "I have learned this" to a first role.</p></section>' + ctabs('guide') + '<div class="card u-prose">' + md(t) + '</div>' + HONEST, crumbsC('Guide'));
  }

  /* ---------------- my study ---------------- */
  const weekStart = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const weekKey = (d) => A.dayStr(weekStart(d || new Date()));
  function history() {
    const u = st(), ev = []; const name = (id) => { const c = C(id); return c ? c.code + ' ' + c.title : id; };
    Object.keys(u.lessons).forEach((k) => { const p = k.split(':'); if (typeof u.lessons[k] === 'string') ev.push([u.lessons[k], '📖', 'Lesson ' + (+p[1] + 1) + ' completed', name(p[0]), ['course', p[0], 'lesson', p[1]]]); });
    Object.keys(u.exams).forEach((k) => U.attempts(k).forEach((a) => { const fin = /^final-s(\d)$/.exec(k); ev.push([a.at, '📝', (fin ? 'Stage ' + fin[1] + ' final' : 'Examination') + ': ' + a.score + '% (' + (a.pass ? 'passed' : 'not passed') + ')', fin ? '' : name(k), fin ? ['final', fin[1]] : ['course', k]]); }));
    Object.keys(u.labs).forEach((k) => { if (u.labs[k] && u.labs[k].pass) ev.push([u.labs[k].at, '🧪', 'Programming assignment passed', name(k), ['course', k, 'lab']]); });
    Object.keys(u.projects).forEach((k) => { if (u.projects[k] && u.projects[k].at) ev.push([u.projects[k].at, '🗂', 'Project submitted', name(k), ['course', k, 'project']]); });
    Object.keys(u.videos).forEach((k) => { if (typeof u.videos[k] === 'string') ev.push([u.videos[k], '🎬', 'Video completed', k, ['videos', k]]); });
    Object.keys(u.certs).forEach((k) => { const m = /^course:(.+)$/.exec(k); if (m && typeof u.certs[k] === 'string') ev.push([u.certs[k], '🎓', 'Course completed', name(m[1]), ['course', m[1]]]); });
    return ev.filter((e) => typeof e[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e[0])).sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  }
  function weak() { // missed knowledge checks and exam questions, grouped by course
    const u = st(), by = {}; Object.keys(u.missed).forEach((k) => { const id = k.split(':')[0]; if (C(id)) by[id] = (by[id] || 0) + (+u.missed[k] || 0); });
    return Object.keys(by).map((id) => [C(id), by[id]]).sort((a, b) => b[1] - a[1]);
  }
  function badges() {
    const u = st(); const all = CAT.courses.concat(CAT.electives || []); const les = Object.keys(u.lessons).length, done = all.filter(U.courseDone).length; const passes = Object.keys(u.exams).filter((k) => U.attempts(k).some((a) => a.pass)).length;
    return [['First step', 'Complete a lesson', les >= 1], ['Getting going', 'Complete 10 lessons', les >= 10], ['Committed', 'Complete 50 lessons', les >= 50], ['Scholar', 'Complete 150 lessons', les >= 150], ['Examined', 'Pass an examination', passes >= 1], ['Course complete', 'Complete a whole course', done >= 1], ['Five courses', 'Complete five courses', done >= 5], ['Stage one', 'Pass the Stage 1 final', U.finalPassed(1)], ['Halfway', 'Pass the Stage 3 final', U.finalPassed(3)], ['Builder', 'Submit a project', Object.keys(u.projects).some((k) => u.projects[k] && u.projects[k].at)], ['Steady', 'Study 7 days in a row', U.streak() >= 7], ['Explorer', 'Complete a department elective', (CAT.electives || []).some(U.courseDone)], ['Challenger', 'Finish a weekly challenge', Object.keys(u.arena).length >= 1], ['Interview ready', 'Solve 3 interview exercises', D.coding.filter((x) => (u.iv['code:' + x.id] || {}).pass).length >= 3]];
  }
  U.lazy.study = async function (path) {
    if (path[1] === 'challenge') return challenge(path);
    const u = st(); const goal = [3, 5, 7, 10, 15].includes(+u.goal.week) ? +u.goal.week : 5; const ws = weekKey();
    const thisWeek = Object.keys(u.lessons).filter((k) => typeof u.lessons[k] === 'string' && u.lessons[k] >= ws).length; const gp = Math.min(100, Math.round(thisWeek / goal * 100));
    const nx = U.nextUp(), wk = weak().slice(0, 5), ev = history(), bms = Object.keys(u.bm), bd = badges(); const best = u.arena[ws];
    const ready = CAT.courses.concat(CAT.electives || []).filter((c) => U.courseUnlocked(c) && U.lessonsDone(c) === c.n && !U.examPassed(c)).slice(0, 3);
    const recs = [];
    if (nx) recs.push([U.nextStep(nx).path, 'Continue ' + nx.code + ': ' + U.nextStep(nx).label, nx.title]);
    ready.forEach((c) => recs.push([['course', c.id, 'exam'], 'Sit the ' + c.code + ' examination', 'Every lesson is done']));
    if (wk.length) recs.push([['professor', wk[0][0].id], 'Revise ' + wk[0][0].code + ' with the professor', wk[0][1] + ' missed answer' + (wk[0][1] === 1 ? '' : 's') + ' recorded in this course']);
    if (!best) recs.push([['study', 'challenge'], 'Take this week\'s challenge', '8 questions from courses you have started']);
    let h = '<section class="u-stagehero"><p class="u-eyebrow">My study</p><h1>Your plan, your record</h1><p>Set a weekly goal, see what to do next, and find the subjects that need another look. Everything here comes from your own record on this device.</p></section>';
    h += '<div class="u-cols"><section class="card"><h2>🎯 Weekly goal</h2><p><b>' + thisWeek + '</b> of <b>' + goal + '</b> lessons this week (since ' + E(ws) + ')</p>' + bar(gp) + '<label class="up-f">Lessons per week<select id="sgGoal">' + [3, 5, 7, 10, 15].map((n) => '<option value="' + n + '"' + (n === goal ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label><p class="u-fine">' + (gp >= 100 ? 'Goal met. Well done.' : 'A little most days beats a lot once a week.') + ' Streak: ' + U.streak() + ' day' + (U.streak() === 1 ? '' : 's') + '.</p></section>' +
      '<section class="card"><h2>➡ Recommended next</h2>' + (recs.length ? '<ul class="u-list">' + recs.slice(0, 5).map((r) => '<li>' + link(r[0], '<b>' + E(r[1]) + '</b><small>' + E(r[2]) + '</small>') + '</li>').join('') + '</ul>' : '<p class="pill">You are up to date.</p>') + '</section></div>';
    h += '<div class="u-cols"><section><h2 class="u-h2">Subjects to revise</h2>' + (wk.length ? '<ul class="u-list">' + wk.map((w) => '<li>' + link(['course', w[0].id], '<b>' + E(w[0].code + ' ' + w[0].title) + '</b><small>' + w[1] + ' missed answer' + (w[1] === 1 ? '' : 's') + ' in knowledge checks and examinations</small>') + '</li>').join('') + '</ul><p>' + link(['professor'], '🤖 Build a revision set with the professor', 'btn small') + '</p>' : '<p class="pill">No missed answers recorded yet. When you get a question wrong, the course appears here.</p>') + '</section>' +
      '<section><h2 class="u-h2">Bookmarks (' + bms.length + ')</h2>' + (bms.length ? '<ul class="u-list" id="sgBm">' + bms.slice(-30).reverse().map((k) => { const p = k.split(':'), c = C(p[0]); return c ? '<li class="u-bmli">' + link(['course', c.id, 'lesson', p[1]], '<b>' + E(c.code) + ' · Lesson ' + (+p[1] + 1) + '</b><small>' + E(c.title) + '</small>') + '<button type="button" class="btn small" data-unbm="' + E(k) + '" aria-label="Remove bookmark">✕</button></li>' : ''; }).join('') + '</ul>' : '<p class="pill">Bookmark a lesson with the ☆ button at the bottom of any lesson page.</p>') + '</section></div>';
    h += '<h2 class="u-h2">Weekly challenge</h2><div class="card"><p>Eight questions drawn from the courses you have started, the same set all week. ' + (best ? 'Your best this week: <b>' + best.score + ' / ' + best.of + '</b>.' : 'Not attempted this week.') + ' Past weeks: ' + (Object.keys(u.arena).length ? Object.keys(u.arena).sort().slice(-6).map((k) => E(k) + ' ' + (+u.arena[k].score || 0) + '/' + (+u.arena[k].of || 8)).join(' · ') : 'none yet') + '.</p>' + link(['study', 'challenge'], best ? 'Try again →' : 'Start the challenge →', 'btn small primary') + '<p class="u-fine">The challenge is a personal record. There is no shared leaderboard, team play or tournament in the University: those need a server that checks results, and this site keeps University progress on your own device. Head-to-head matches remain in the main Learn app.</p></div>';
    h += '<h2 class="u-h2">Achievements (' + bd.filter((b) => b[2]).length + ' of ' + bd.length + ')</h2><div class="u-badges">' + bd.map((b) => '<div class="u-badge ' + (b[2] ? 'on' : '') + '"><b>' + (b[2] ? '🏅 ' : '○ ') + E(b[0]) + '</b><small>' + E(b[1]) + '</small></div>').join('') + '</div>';
    h += '<h2 class="u-h2">Learning history</h2>' + (ev.length ? '<div class="u-tablewrap"><table class="u-table"><thead><tr><th>Date</th><th>Activity</th><th>Course</th></tr></thead><tbody>' + ev.slice(0, 40).map((e) => '<tr><td>' + E(e[0]) + '</td><td>' + e[1] + ' ' + link(e[4], E(e[2])) + '</td><td>' + E(e[3]) + '</td></tr>').join('') + '</tbody></table></div>' + (ev.length > 40 ? '<p class="u-fine">Showing the latest 40 of ' + ev.length + ' entries.</p>' : '') : '<p class="pill">Your history starts with your first completed lesson.</p>');
    shell('study', h, [['University', []], ['My study']]);
    $('#sgGoal').addEventListener('change', (e) => { st().goal.week = +e.target.value; save(); U.render(U.path); });
    $$('[data-unbm]').forEach((b) => b.addEventListener('click', () => { delete st().bm[b.dataset.unbm]; save(); U.render(U.path); }));
  };

  /* weekly challenge: deterministic for the week, so a retry shows the same questions */
  function rng(seed) { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } let a = h >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  async function challenge(path) {
    const crumbs = [['University', []], ['My study', ['study']], ['Weekly challenge']]; U.loading('study', crumbs);
    const u = st(); const all = CAT.courses.concat(CAT.electives || []);
    let pool = all.filter((c) => U.lessonsDone(c) > 0); if (pool.length < 2) pool = U.coursesOf(1).filter(U.courseUnlocked);
    try { await Promise.all(Array.from(new Set(pool.map((c) => c.file))).map(U.loadFile)); } catch (e) { shell('study', U.offlineHtml('The challenge needs course files that are not saved on this device yet.'), crumbs); return U.bindRetry(); }
    if (U.path !== path) return;
    const wk = weekKey(), r = rng('w' + wk + pool.map((c) => c.id).join(''));
    let qs = []; pool.forEach((c) => ((U.content[c.id] || {}).exam || { items: [] }).items.forEach((it, i) => { if (it.type === 'mc') qs.push(Object.assign({ from: c.code, key: c.id + ':x' + i }, it)); }));
    for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
    qs = qs.slice(0, 8);
    if (!qs.length) { shell('study', '<div class="card"><p>No questions are available yet. Complete a lesson first.</p></div>', crumbs); return; }
    let h = '<article class="u-exam"><header><p class="u-eyebrow">Weekly challenge · week of ' + E(wk) + '</p><h1>' + qs.length + ' questions, one attempt at a time</h1><p class="u-fine">Marked automatically. It does not affect your grades or unlock anything; it is practice with a personal best.</p></header><form id="chForm" novalidate>' +
      qs.map((q, i) => { const order = q.o.map((_, k) => k); for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; } return '<section class="ux-item"><h2><span class="ux-n">Question ' + (i + 1) + '</span><span class="ux-pts">' + E(q.from) + '</span></h2><fieldset><legend>' + U.qText(q.q) + '</legend>' + order.map((oi) => '<label class="ux-opt"><input type="radio" name="c' + i + '" value="' + oi + '"><span>' + inline(q.o[oi]) + '</span></label>').join('') + '</fieldset><p class="u-why" data-why="' + i + '" aria-live="polite"></p></section>'; }).join('') +
      '<div class="ux-submit"><button type="submit" class="btn primary">Mark my answers</button> ' + link(['study'], 'Back', 'btn small') + '<p class="pill" id="chMsg" role="status"></p></div></form></article>';
    shell('study', h, crumbs);
    $('#chForm').addEventListener('submit', (e) => { e.preventDefault(); let score = 0;
      qs.forEach((q, i) => { const sel = $('input[name="c' + i + '"]:checked'); const ok = !!sel && +sel.value === q.a; if (ok) score++; else { const s2 = st(); s2.missed[q.key] = (s2.missed[q.key] || 0) + 1; } $('[data-why="' + i + '"]').innerHTML = (ok ? '<b class="good">Correct.</b> ' : '<b class="bad">' + (sel ? 'Not right.' : 'Not answered.') + '</b> Answer: ' + inline(q.o[q.a]) + '. ') + inline(q.why || ''); $$('input[name="c' + i + '"]').forEach((x) => { x.disabled = true; }); });
      const s2 = st(); const prev = s2.arena[wk]; if (!prev || score > (+prev.score || 0)) s2.arena[wk] = { score, of: qs.length, at: A.dayStr(new Date()) }; const keys = Object.keys(s2.arena).sort(); while (keys.length > 60) delete s2.arena[keys.shift()];
      U.markStudy(); save(); $('#chForm button[type="submit"]').disabled = true; $('#chMsg').textContent = 'Score: ' + score + ' of ' + qs.length + (prev && score <= (+prev.score || 0) ? ' (best this week stays ' + prev.score + ')' : ' · new best this week'); });
  }
  U.campus = { history, weak, badges, cvHtml, weekKey };
})();
