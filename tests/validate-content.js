// University content validator: node uv.js [file1,file2]   (runs every solution and starter through the real grader)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message.slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 300)); });
  await p.route(/judge0|emkc|wandbox|firebase|googleapis|gstatic/, (r) => r.abort());
  await p.goto('http://localhost:8765/index.html#/uni'); await p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready, null, { timeout: 20000 });
  await p.evaluate(() => window.LearnUniversity.loadMod('uni-assess'));
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const res = await p.evaluate(async (only) => {
    const U = window.LearnUniversity; const out = { problems: [], stats: {} }; const P = (m) => out.problems.push(m);
    const ALL = U.cat.courses.concat(U.cat.electives || []); const files = Array.from(new Set(ALL.map((c) => c.file))).filter((f) => !only || only.includes(f));
    let lessons = 0, qs = 0, tasks = 0, words = 0, examItems = 0;
    for (const f of files) { try { await U.loadFile(f); } catch (e) { P('MISSING FILE ' + f); continue; }
      for (const c of ALL.filter((x) => x.file === f)) {
        const d = U.content[c.id]; if (!d) { P(c.id + ': no content in ' + f); continue; }
        if (d.lessons.length !== c.n) P(c.id + ': catalog n=' + c.n + ' but ' + d.lessons.length + ' lessons');
        if (!!d.lab !== !!c.lab) P(c.id + ': lab mismatch (catalog ' + c.lab + ')');
        if (d.lab && c.lang !== d.lab.lang) P(c.id + ': lab lang ' + d.lab.lang + ' vs catalog ' + c.lang);
        if (!!d.project !== !!c.project) P(c.id + ': project mismatch');
        if (!d.exam || d.exam.items.length < 6) P(c.id + ': exam missing or short');
        const checkQ = (q, where) => { qs++; if (q.type !== 'mc') return; if (q.a < 0) P(where + ': no correct option: ' + q.q.slice(0, 50)); if (q.o.length < 3) P(where + ': fewer than 3 options: ' + q.q.slice(0, 50)); if (q.o.filter((x) => x === q.o[q.a]).length > 1) P(where + ': duplicate options'); if (!q.why) P(where + ': no explanation: ' + q.q.slice(0, 50)); };
        const checkTask = async (t, where) => { tasks++; if (t.badTests) P(where + ': ' + t.badTests + ' unparsable test line(s)'); if (t.tests && !t.tests.length) P(where + ': empty tests'); if (!t.solution) { P(where + ': no solution'); return; } if (U.api.STATIC_LANGS.includes(t.lang)) { if (t.out === undefined) P(where + ': remote task without @out'); return; }
          let g; try { g = await U.assess.grade(t, t.solution); } catch (e) { P(where + ': grade threw ' + e.message); return; }
          if (!g.pass) P(where + ': SOLUTION FAILS: ' + (g.msg || '') + ' ' + JSON.stringify((g.results || []).filter((r) => !r.ok).slice(0, 2)) + ' ' + ((g.run && g.run.error) || '').slice(0, 200));
          let s; try { s = await U.assess.grade(t, t.starter || ''); } catch (e) { s = { pass: false }; } if (s.pass) P(where + ': STARTER ALREADY PASSES'); };
        for (let i = 0; i < d.lessons.length; i++) { const l = d.lessons[i]; lessons++; const w = (l.md || '').split(/\s+/).length; words += w; if (w < 110) P(c.id + ' L' + (i + 1) + ' "' + l.t + '": only ' + w + ' words'); if (!l.quiz.length) P(c.id + ' L' + (i + 1) + ': no knowledge check'); l.quiz.forEach((q) => checkQ(q, c.id + ' L' + (i + 1))); if (l.try) await checkTask(l.try, c.id + ' L' + (i + 1) + ' TRY'); }
        if (d.lab) { await checkTask(d.lab, c.id + ' LAB'); if (!d.lab.md) P(c.id + ' LAB: no brief'); if (!(d.lab.hints || []).length) P(c.id + ' LAB: no hints'); }
        if (d.exam) for (const it of d.exam.items) { examItems++; if (it.type === 'mc') checkQ(it, c.id + ' EXAM'); else if (it.type === 'code') await checkTask(it, c.id + ' EXAM code'); else if (it.rubric.length < 3) P(c.id + ' EXAM written: short rubric'); }
        if (d.project) { const pr = d.project; if (!(pr.requirements || []).length || !(pr.deliverables || []).length || !(pr.rubric || []).length || !pr.md) P(c.id + ' PROJECT: incomplete'); }
      } }
    // interview exercises and department data integrity
    const DD = window.UNI_DEPTS; let iv = 0;
    if (DD && (!only || only.includes('departments'))) {
      for (const ex of DD.coding) { iv++; let g; try { g = await U.assess.grade(ex, ex.solution); } catch (e) { P('interview ' + ex.id + ': threw ' + e.message); continue; } if (!g.pass) P('interview ' + ex.id + ': SOLUTION FAILS ' + JSON.stringify((g.results || []).filter((r) => !r.ok).slice(0, 2)) + ' ' + ((g.run && g.run.error) || '')); const s2 = await U.assess.grade(ex, ex.starter); if (s2.pass) P('interview ' + ex.id + ': STARTER PASSES'); }
      DD.depts.forEach((d) => d.path.forEach((id) => { if (!U.courseById(id)) P('dept ' + d.id + ': unknown course ' + id); }));
      DD.roles.forEach((r) => r.need.concat(r.next || []).forEach((id) => { if (!U.courseById(id)) P('role ' + r.id + ': unknown course ' + id); }));
      DD.concepts.forEach((q, i) => { if (!U.courseById(q[3])) P('concept ' + i + ': unknown course'); if (q[2].length < 3) P('concept ' + i + ': short key'); });
      (U.cat.electives || []).forEach((c) => (c.pre || []).forEach((id) => { if (!U.courseById(id)) P('elective ' + c.id + ': unknown prerequisite ' + id); }));
    }
    out.stats = { files: files.length, lessons, questions: qs, examItems, tasks, words, interviewExercises: iv };
    return out;
  }, only);
  console.log(JSON.stringify(res.stats)); res.problems.forEach((x) => console.log(' - ' + x)); console.log(res.problems.length + ' problems'); errs.slice(0, 10).forEach((e) => console.log(e));
  await b.close();
})();
