/* ============================================================
   Technology University: tools module (loaded on demand, 4.1)
     review     spaced review of questions the student got wrong (1, 3 and 7 days)
     terminal   Git and terminal simulator with graded tasks (uses uni/gitsim.js)
     mock       timed mock technical interview (coding marked by tests; the rest self-assessed)
     portfolio  one printable page of the student's real record
   Everything runs on the student's device and is stored in the Learn save.
   ============================================================ */
(window.LEARN_MOD_BUILD = window.LEARN_MOD_BUILD || {})['uni-tools'] = '2.0.2'; // must equal BUILD in university.js
(function () {
  'use strict';
  const U = window.LearnUniversity, A = U.api, D = window.UNI_DEPTS || { coding: [], concepts: [], behavioural: [] };
  const { $, $$, E, md, inline, st, save, shell, link } = U;
  const today = () => A.dayStr(new Date());
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
  const loadScript = (src) => new Promise((ok, no) => { if (window.GitSim) return ok(); const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => { el.remove(); no(new Error('offline')); }; document.head.appendChild(el); });
  const T = {};

  /* ================= 1. review ================= */
  async function resolveQ(key) { // 'c101:x3' (exam) or 'c101:2:1' (lesson 2, check 1)
    const p = key.split(':'); const c = U.courseById(p[0]); if (!c) return null;
    let d; try { d = await U.loadCourse(c.id); } catch (e) { return undefined; } // undefined = offline, keep the card
    const q = /^x\d+$/.test(p[1]) ? (d.exam && d.exam.items[+p[1].slice(1)]) : ((d.lessons[+p[1]] || { quiz: [] }).quiz[+p[2]]);
    return q && q.type === 'mc' ? { c, q, where: /^x/.test(p[1]) ? c.code + ' examination' : c.code + ' lesson ' + (+p[1] + 1) } : null;
  }
  const NEXT = ['tomorrow', 'in 3 days', 'in 7 days'];
  let session = null;
  T.review = async function (path) {
    const crumbs = [['University', []], ['Review']]; const u = st(); const sc = U.srsCounts();
    if (path[1] === 'go') return runReview(path, crumbs);
    const keys = Object.keys(u.srs); const t = today();
    const soon = {}; keys.forEach((k) => { const r = u.srs[k]; if (r.b < 3 && r.due > t) soon[r.due] = (soon[r.due] || 0) + 1; });
    const byCourse = {}; keys.forEach((k) => { const r = u.srs[k]; if (r.b === 3) return; const c = U.courseById(k.split(':')[0]); if (c) byCourse[c.id] = (byCourse[c.id] || 0) + 1; });
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Spaced review</p><h1>Questions you missed come back until you know them</h1><p>Every question you get wrong in a lesson check, course examination, final or weekly challenge is scheduled here. It returns the next day. Answer it correctly and it comes back in 3 days, then in 7 days; get it right then and it is marked as mastered. A wrong answer starts it again from the next day.</p></section>';
    h += '<div class="u-dash"><section class="card u-dcard"><div class="ud-stat"><b>' + sc.due + '</b><small>due today</small></div></section><section class="card u-dcard"><div class="ud-stat"><b>' + sc.later + '</b><small>scheduled for later</small></div></section><section class="card u-dcard"><div class="ud-stat"><b>' + sc.mastered + '</b><small>mastered</small></div></section></div>';
    h += sc.due ? '<p>' + link(['review', 'go'], 'Start review: ' + Math.min(sc.due, 15) + ' question' + (Math.min(sc.due, 15) === 1 ? '' : 's') + ' →', 'btn primary') + (sc.due > 15 ? ' <span class="u-fine">Sessions are capped at 15 questions; the rest wait for the next session.</span>' : '') + '</p>'
      : '<div class="card"><p>' + (keys.length ? 'Nothing is due today. Well done. Come back ' + (Object.keys(soon).sort()[0] ? 'on ' + E(Object.keys(soon).sort()[0]) : 'later') + '.' : 'Nothing to review yet. When you answer a question wrongly anywhere in the University, it appears here the next day.') + '</p></div>';
    const days = Object.keys(soon).sort().slice(0, 10);
    h += '<div class="u-cols"><section><h2 class="u-h2">Coming up</h2>' + (days.length ? '<ul class="u-list">' + days.map((d) => '<li><span class="u-lrow"><b>' + E(d) + '</b><small>' + soon[d] + ' question' + (soon[d] === 1 ? '' : 's') + '</small></span></li>').join('') + '</ul>' : '<p class="pill">Nothing scheduled.</p>') + '</section>' +
      '<section><h2 class="u-h2">By course</h2>' + (Object.keys(byCourse).length ? '<ul class="u-list">' + Object.keys(byCourse).sort((a, b) => byCourse[b] - byCourse[a]).slice(0, 10).map((id) => { const c = U.courseById(id); return '<li>' + link(['course', id], '<b>' + E(c.code + ' ' + c.title) + '</b><small>' + byCourse[id] + ' question' + (byCourse[id] === 1 ? '' : 's') + ' in review</small>') + '</li>'; }).join('') + '</ul>' : '<p class="pill">No questions in review.</p>') + '</section></div>';
    h += '<p class="u-fine">Review answers do not change grades, exam results or certificates. They only decide when a question comes back.</p>';
    shell('review', h, crumbs);
  };
  async function runReview(path, crumbs) {
    U.loading('review', crumbs); const u = st(), t = today();
    const due = Object.keys(u.srs).filter((k) => u.srs[k].b < 3 && u.srs[k].due <= t).sort((a, b) => (u.srs[a].due < u.srs[b].due ? -1 : u.srs[a].due > u.srs[b].due ? 1 : (u.srs[b].n || 0) - (u.srs[a].n || 0)));
    const items = []; let offline = false;
    for (const k of due) { if (items.length >= 15) break; const r = await resolveQ(k); if (r === undefined) { offline = true; continue; } if (r === null) { delete u.srs[k]; continue; } items.push(Object.assign({ key: k }, r)); }
    save(); if (U.path !== path) return;
    if (!items.length) { shell('review', '<div class="card"><p>' + (offline ? 'The questions due today are in course files that are not saved on this device yet. Connect to the internet and try again.' : 'Nothing is due right now.') + '</p>' + link(['review'], '← Review overview', 'btn small') + '</div>', crumbs); return; }
    session = { items, i: 0, right: 0, results: [] }; showCard(crumbs);
  }
  function showCard(crumbs) {
    const s = session, it = s.items[s.i]; const order = shuffle(it.q.o.map((_, i) => i));
    const h = '<article class="u-exam"><header><p class="u-eyebrow">Review · question ' + (s.i + 1) + ' of ' + s.items.length + ' · from ' + E(it.where) + '</p><h1>' + E(it.c.title) + '</h1></header>' +
      '<fieldset class="u-q" id="rvQ"><legend>' + U.qText(it.q.q) + '</legend><div class="u-opts">' + order.map((oi) => '<button type="button" class="u-opt" data-o="' + oi + '">' + inline(it.q.o[oi]) + '</button>').join('') + '</div><p class="u-why" id="rvWhy" aria-live="polite"></p></fieldset><p id="rvNext"></p><p class="u-fine">' + link(['review'], 'Stop and return to the overview', '') + '</p></article>';
    shell('review', h, crumbs);
    $$('#rvQ .u-opt').forEach((b) => b.addEventListener('click', () => {
      const ok = +b.dataset.o === it.q.a; $$('#rvQ .u-opt').forEach((x) => { x.disabled = true; if (+x.dataset.o === it.q.a) x.classList.add('right'); }); if (!ok) b.classList.add('wrong');
      U.srsAnswer(it.key, ok); const r = st().srs[it.key]; if (ok) s.right++; s.results.push(ok);
      $('#rvWhy').innerHTML = (ok ? '<b class="good">Correct.</b> ' : '<b class="bad">Not this time.</b> The right answer is highlighted. ') + inline(it.q.why) + ' <span class="pill">' + (r && r.b === 3 ? 'Mastered: it will not come back unless you miss it again.' : 'Next review ' + NEXT[r ? r.b : 0] + '.') + '</span>';
      U.markStudy();
      $('#rvNext').innerHTML = s.i + 1 < s.items.length ? '<button type="button" class="btn primary" id="rvGo">Next question →</button>' : '<button type="button" class="btn primary" id="rvGo">See results →</button>';
      $('#rvGo').addEventListener('click', () => { if (s.i + 1 < s.items.length) { s.i++; showCard(crumbs); } else finishReview(crumbs); }); $('#rvGo').focus();
    }));
  }
  function finishReview(crumbs) {
    const s = session; const sc = U.srsCounts(); session = null;
    shell('review', '<section class="u-stagehero"><p class="u-eyebrow">Review complete</p><h1>' + s.right + ' of ' + s.items.length + ' correct</h1><p>' + (s.right === s.items.length ? 'Every one right. Those questions move further out in your schedule.' : 'The ones you missed come back tomorrow. That is how the method works: short gaps until you know it, then longer ones.') + '</p></section><div class="card"><p>' + sc.due + ' still due today · ' + sc.later + ' scheduled · ' + sc.mastered + ' mastered.</p>' + (sc.due ? link(['review', 'go'], 'Continue reviewing →', 'btn primary') + ' ' : '') + link(['review'], 'Review overview', 'btn small') + ' ' + link(['study'], 'My study', 'btn small') + '</div>', crumbs);
  }

  /* ================= 2. Git and terminal simulator ================= */
  const HM = '/home/student';
  const TASKS = [
    { id: 'files', lvl: 'Terminal', title: 'Folders and files', goal: 'Create a folder called `project` in your home folder. Inside it, create a file `notes.txt` containing the single line `hello terminal`, and an empty folder `docs`. Finish with `project` as your current folder.',
      hints: ['`mkdir project` creates a folder; `cd project` moves into it.', '`echo "hello terminal" > notes.txt` writes a line into a new file.', '`pwd` shows where you are; `ls` lists what is there.'], sol: ['mkdir project', 'cd project', 'echo "hello terminal" > notes.txt', 'mkdir docs', 'ls'],
      checks: (s) => [['Folder ~/project exists', s.isDir(HM + '/project')], ['notes.txt contains "hello terminal"', (s.read(HM + '/project/notes.txt') || '').trim() === 'hello terminal'], ['Folder ~/project/docs exists', s.isDir(HM + '/project/docs')], ['Your current folder is ~/project', s.cwd === HM + '/project']] },
    { id: 'move', lvl: 'Terminal', title: 'Copy, move and delete', setup: (s) => { s.write(HM + '/drafts/a.txt', 'alpha\n'); s.write(HM + '/drafts/b.txt', 'beta\n'); s.write(HM + '/drafts/junk.tmp', 'x\n'); },
      goal: 'The folder `drafts` holds three files. Make a folder `backup` in your home folder and copy `drafts/a.txt` into it (keep the original). Rename `drafts/b.txt` to `drafts/final.txt`. Delete `drafts/junk.tmp`.',
      hints: ['`cp source destination` copies; `mv old new` renames or moves.', '`rm file` deletes a file. There is no recycle bin in a real terminal, so check the name first.', 'Use `ls drafts` to check your work.'], sol: ['mkdir backup', 'cp drafts/a.txt backup/', 'mv drafts/b.txt drafts/final.txt', 'rm drafts/junk.tmp', 'ls drafts backup'],
      checks: (s) => [['backup/a.txt is a copy of a.txt', s.read(HM + '/backup/a.txt') === 'alpha\n'], ['drafts/a.txt is still there', s.read(HM + '/drafts/a.txt') === 'alpha\n'], ['b.txt has been renamed to final.txt', s.read(HM + '/drafts/final.txt') === 'beta\n' && !s.isFile(HM + '/drafts/b.txt')], ['junk.tmp is deleted', !s.isFile(HM + '/drafts/junk.tmp')]] },
    { id: 'search', lvl: 'Terminal', title: 'Search a log file', setup: (s) => { s.write(HM + '/logs/server.log', ['09:00 INFO server started', '09:02 INFO user login alice', '09:05 ERROR database timeout', '09:06 INFO retry ok', '09:12 WARN slow request /search', '09:20 ERROR disk almost full', '09:31 INFO user login bob', '09:40 ERROR payment service unavailable', '09:41 INFO retry ok'].join('\n') + '\n'); },
      goal: '`logs/server.log` is a server log. Count how many lines contain `ERROR` and save just that number in a file `answer.txt` in your home folder. Then save every ERROR line, in order, to `errors.txt` in your home folder.',
      hints: ['`grep ERROR logs/server.log` prints the matching lines.', '`grep -c ERROR file` counts them instead. `>` sends the output to a file.', 'You could also pipe: `grep ERROR logs/server.log | wc -l`.'], sol: ['grep -c ERROR logs/server.log > answer.txt', 'grep ERROR logs/server.log > errors.txt', 'cat answer.txt'],
      checks: (s) => [['answer.txt holds the right count', (s.read(HM + '/answer.txt') || '').trim() === '3'], ['errors.txt holds exactly the three ERROR lines', (s.read(HM + '/errors.txt') || '').trim().split('\n').filter((l) => /ERROR/.test(l)).length === 3 && (s.read(HM + '/errors.txt') || '').trim().split('\n').length === 3]] },
    { id: 'init', lvl: 'Git', title: 'Your first commit', setup: (s) => { s.write(HM + '/site/README.md', '# My site\n'); s.write(HM + '/site/index.html', '<h1>Hello</h1>\n'); },
      goal: 'The folder `site` has two files but is not under version control. Turn it into a Git repository and commit both files. Finish with a clean working tree.',
      hints: ['`cd site`, then `git init` creates the repository.', '`git status` shows what Git sees. `git add .` stages everything in the folder.', '`git commit -m "Initial commit"` records the snapshot.'], sol: ['cd site', 'git init', 'git add .', 'git commit -m "Initial commit"', 'git status'],
      checks: (s) => { const r = s.repo(); const t = s.headTree(); return [['~/site is a Git repository', !!r && r.root === HM + '/site'], ['At least one commit', !!(r && s.headId())], ['README.md and index.html are committed', t['README.md'] !== undefined && t['index.html'] !== undefined], ['Working tree is clean', s.clean()]]; } },
    { id: 'stage', lvl: 'Git', title: 'Commit only what belongs', setup: (s) => { s.exec('mkdir app && cd app && git init'); s.write(HM + '/app/app.js', 'console.log("v1");\n'); s.exec('git add . && git commit -m "Start app"'); s.write(HM + '/app/app.js', 'console.log("v2");\n'); s.write(HM + '/app/secret.env', 'API_KEY=do-not-share\n'); s.exec('cd ~'); },
      goal: 'In `app`, `app.js` has a real change, and `secret.env` holds a password that must never be committed. Commit the change to `app.js`. Make Git ignore `secret.env` by listing it in a `.gitignore` file, and commit `.gitignore` too. Finish with a clean working tree.',
      hints: ['`git add app.js` stages one file only. Avoid `git add .` until secret.env is ignored.', '`echo secret.env > .gitignore` creates the ignore file.', 'After that, `git status` should no longer list secret.env.'], sol: ['cd app', 'echo secret.env > .gitignore', 'git add app.js .gitignore', 'git commit -m "Update app and ignore secrets"', 'git status'],
      checks: (s) => { const t = s.headTree(); return [['The app.js change is committed', t['app.js'] === 'console.log("v2");\n'], ['secret.env was never committed', !s.everCommitted('secret.env')], ['.gitignore is committed and lists secret.env', /(^|\n)\/?secret\.env\s*(\n|$)/.test(t['.gitignore'] || '')], ['Working tree is clean (secret.env is ignored)', s.clean()]]; } },
    { id: 'history', lvl: 'Git', title: 'Find a commit in the history', setup: (s) => { s.exec('mkdir shop && cd shop && git init'); const steps = [['price.js', 'const discount = 0.1;\n', 'Add price rules'], ['cart.js', 'export const cart = [];\n', 'Add cart'], ['price.js', 'const discount = 0.5;\n', 'Change discount to 0.5'], ['README.md', '# Shop\n', 'Add readme'], ['cart.js', 'export const cart = [];\nexport const max = 20;\n', 'Limit cart size']]; steps.forEach((x) => { s.write(HM + '/shop/' + x[0], x[1]); s.exec('git add . && git commit -m "' + x[2] + '"'); }); s.exec('cd ~'); },
      goal: 'Customers in `shop` are getting half price. Use the history to find the commit that changed the discount, and save its short ID (the first 7 characters) in a file `bug.txt` in your home folder.',
      hints: ['`git log --oneline` lists commits, newest first, one per line.', '`git show <id>` displays exactly what a commit changed.', 'Write it with `echo 1a2b3c4 > ~/bug.txt` using the real ID.'], sol: ['cd shop', 'git log --oneline', 'git show <id of "Change discount to 0.5">', 'echo <that id> > ~/bug.txt'],
      checks: (s) => { const r = s.repo(); const c = r ? s.log('main').find((x) => x.msg === 'Change discount to 0.5') : null; const got = (s.read(HM + '/bug.txt') || '').trim(); return [['bug.txt exists', s.isFile(HM + '/bug.txt')], ['It holds the ID of the commit that changed the discount', !!c && got.length >= 7 && c.id.startsWith(got)]]; } },
    { id: 'branch', lvl: 'Git', title: 'Work on a branch', setup: (s) => { s.exec('mkdir web && cd web && git init'); s.write(HM + '/web/index.html', '<h1>Home</h1>\n'); s.exec('git add . && git commit -m "Home page" && cd ~'); },
      goal: 'In `web`, create a branch `feature/login`, switch to it, add a file `login.html` and commit it there. Then switch back to `main`. The main branch must not contain `login.html` yet.',
      hints: ['`git switch -c feature/login` creates the branch and moves to it.', 'Create the file with `echo "<form></form>" > login.html`, then add and commit.', '`git switch main` goes back. Watch login.html disappear with `ls`: it lives on the other branch.'], sol: ['cd web', 'git switch -c feature/login', 'echo "<form></form>" > login.html', 'git add login.html', 'git commit -m "Add login page"', 'git switch main'],
      checks: (s) => { const r = s.repo(); const f = s.tree('feature/login'); return [['Branch feature/login exists', !!r && r.branches['feature/login'] !== undefined], ['login.html is committed on feature/login', !!f && f['login.html'] !== undefined], ['main does not contain login.html', !!s.tree('main') && s.tree('main')['login.html'] === undefined], ['You are back on main with a clean tree', !!r && r.head === 'main' && s.clean()]]; } },
    { id: 'merge', lvl: 'Git', title: 'Merge a finished branch', setup: (s) => { s.exec('mkdir blog && cd blog && git init'); s.write(HM + '/blog/index.html', '<h1>Blog</h1>\n'); s.exec('git add . && git commit -m "Blog home" && git switch -c feature/rss'); s.write(HM + '/blog/rss.xml', '<rss></rss>\n'); s.exec('git add . && git commit -m "Add RSS feed" && git switch main && cd ~'); },
      goal: 'In `blog`, the branch `feature/rss` is finished. Merge it into `main`, then delete the branch, because it is no longer needed.',
      hints: ['Be on main first: `git switch main` (you already are).', '`git merge feature/rss` brings its commits in. Here it is a fast-forward.', '`git branch -d feature/rss` deletes a branch that has been merged.'], sol: ['cd blog', 'git merge feature/rss', 'git branch -d feature/rss', 'git log --oneline'],
      checks: (s) => { const r = s.repo(); const rss = r ? s.log().find((c) => c.msg === 'Add RSS feed') : null; return [['main contains the RSS commit', !!rss && r.head === 'main'], ['rss.xml is on main', (s.tree('main') || {})['rss.xml'] !== undefined], ['Branch feature/rss is deleted', !!r && r.branches['feature/rss'] === undefined]]; } },
    { id: 'conflict', lvl: 'Git', title: 'Resolve a merge conflict', setup: (s) => { s.exec('mkdir team && cd team && git init'); s.write(HM + '/team/index.html', '<h1>Home</h1>\n'); s.exec('git add . && git commit -m "Home" && git switch -c new-title'); s.write(HM + '/team/index.html', '<h1>Welcome to Learn</h1>\n'); s.exec('git commit -am "Friendlier title" && git switch main'); s.write(HM + '/team/index.html', '<h1>Learn Home</h1>\n'); s.exec('git commit -am "Rename home" && cd ~'); },
      goal: 'In `team`, two people changed the same heading. Merge `new-title` into `main`. Git will report a conflict: resolve it so that `index.html` contains exactly `<h1>Welcome to Learn</h1>` with no conflict markers, then finish the merge with a commit.',
      hints: ['`git merge new-title` stops with CONFLICT. `cat index.html` shows both versions between <<<<<<<, ======= and >>>>>>>.', 'Replace the whole file: `echo "<h1>Welcome to Learn</h1>" > index.html` (or use `edit index.html`).', '`git add index.html` marks it resolved, then `git commit -m "Merge new-title"`.'], sol: ['cd team', 'git merge new-title', 'echo "<h1>Welcome to Learn</h1>" > index.html', 'git add index.html', 'git commit -m "Merge new-title"'],
      checks: (s) => { const r = s.repo(); const id = s.headId(); const c = id ? s.commit(id) : null; const t = s.headTree(); return [['The merge is finished (a commit with two parents)', !!c && c.parents.length === 2 && !r.merging], ['index.html has no conflict markers (in the file and in the last commit)', !!t['index.html'] && !/^(<{7}|={7}|>{7})/m.test(t['index.html']) && !/^(<{7}|={7}|>{7})/m.test(s.read(HM + '/team/index.html') || '')], ['index.html says exactly <h1>Welcome to Learn</h1>', (t['index.html'] || '').trim() === '<h1>Welcome to Learn</h1>'], ['Working tree is clean', s.clean()]]; } },
    { id: 'undo', lvl: 'Git', title: 'Undo safely', setup: (s) => { s.exec('mkdir notes && cd notes && git init'); s.write(HM + '/notes/plan.txt', 'Plan v1\n'); s.write(HM + '/notes/draft.txt', 'Draft v1\n'); s.exec('git add . && git commit -m "Notes"'); s.write(HM + '/notes/plan.txt', 'Plan v1\nMore ideas\n'); s.exec('git add plan.txt'); s.write(HM + '/notes/draft.txt', 'oops, typed over everything\n'); s.exec('cd ~'); },
      goal: 'In `notes`, `plan.txt` was staged by mistake: unstage it, but keep the new lines in the file. `draft.txt` was overwritten by accident: throw away that change so it matches the last commit again.',
      hints: ['`git status` shows one staged and one unstaged change.', '`git restore --staged plan.txt` unstages without touching the file.', '`git restore draft.txt` replaces the file with the committed version. That change is lost for good, so be sure.'], sol: ['cd notes', 'git status', 'git restore --staged plan.txt', 'git restore draft.txt', 'git status'],
      checks: (s) => { const t = s.headTree(), i = s.index(); return [['plan.txt is no longer staged', i['plan.txt'] === t['plan.txt']], ['plan.txt still has your new lines', /More ideas/.test(s.read(HM + '/notes/plan.txt') || '')], ['draft.txt matches the last commit', s.read(HM + '/notes/draft.txt') === t['draft.txt']]]; } },
  ];
  T.TASKS = TASKS;
  const gitRec = (id) => st().git[id] || {};
  T.terminal = async function (path) {
    const crumbs = [['University', []], ['Laboratories', ['labs']], ['Git and terminal simulator']];
    try { await loadScript('uni/gitsim.js?v=' + A.ver); } catch (e) { shell('labs', U.offlineHtml('The simulator could not be loaded.'), crumbs); return U.bindRetry(); }
    if (U.path !== path) return;
    const task = TASKS.find((x) => x.id === path[1]);
    if (!task && path[1] !== 'sandbox') {
      const n = TASKS.filter((x) => gitRec(x.id).pass).length;
      let h = '<section class="u-stagehero"><p class="u-eyebrow">Laboratory</p><h1>Git and terminal simulator</h1><p>Practise the command line and Git on a pretend computer inside this page. Nothing touches your real device, and it works offline. Each task checks the result, not the exact commands, so any correct approach passes.</p><div class="uc-meta"><span>' + n + ' of ' + TASKS.length + ' tasks passed</span></div></section>';
      ['Terminal', 'Git'].forEach((lv) => { h += '<h2 class="u-h2">' + (lv === 'Git' ? 'Git' : 'Terminal basics') + '</h2><ul class="u-list">' + TASKS.filter((x) => x.lvl === lv).map((x) => { const r = gitRec(x.id); return '<li>' + link(['terminal', x.id], '<b>' + E(x.title) + '</b><small>' + (r.pass ? 'Passed ✓ on ' + E(r.at) : r.tries ? 'Started' : 'Not started') + '</small>') + '</li>'; }).join('') + '</ul>'; });
      h += '<h2 class="u-h2">Free practice</h2><ul class="u-list"><li>' + link(['terminal', 'sandbox'], '<b>Sandbox</b><small>An empty home folder to experiment in. Nothing is checked.</small>') + '</li></ul>';
      h += '<div class="card"><h2>What the simulator does and does not do</h2><p>It models files, folders and a local Git repository closely enough to practise the everyday commands: <code>status</code>, <code>add</code>, <code>commit</code>, <code>log</code>, <code>diff</code>, <code>branch</code>, <code>switch</code>, <code>merge</code> and <code>restore</code>. It is simplified: one repository at a time, merges compare whole files rather than individual lines, and there are no remotes, push, pull, stash or rebase. Type <code>help</code> inside it for the full list. For the real thing, install Git on a computer and repeat these tasks there.</p></div>';
      shell('labs', h, crumbs); return;
    }
    const sim = window.GitSim.create(); if (task && task.setup) task.setup(sim); sim.state.hist.length = 0;
    const done0 = task && gitRec(task.id).pass;
    let h = '<article class="u-lab"><header><p class="u-eyebrow">' + (task ? 'Simulator task · ' + E(task.lvl) : 'Simulator') + '</p><h1>' + E(task ? task.title : 'Sandbox') + '</h1>' + (task ? '<p class="pill" id="tsState">' + (done0 ? 'Passed ✓ on ' + E(gitRec(task.id).at) + '. You can do it again.' : 'Checked automatically after every command.') + '</p>' : '<p class="pill">Free practice. Nothing is checked or saved.</p>') + '</header>' +
      (task ? '<div class="u-prose"><p>' + inline(task.goal) + '</p></div><div class="card ts-checks"><h2>Checklist</h2><ul id="tsChecks" aria-live="polite"></ul></div>' : '') +
      '<div class="tsim"><div class="tsim-out" id="tsOut" role="log" aria-label="Terminal output" tabindex="0"></div><form id="tsForm" class="tsim-in" autocomplete="off"><label for="tsIn" class="tsim-prompt" id="tsPrompt"></label><input id="tsIn" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Command"><button type="submit" class="btn small primary">Run</button></form>' +
      '<div class="tsim-keys" role="group" aria-label="Extra keys">' + ['Tab', '↑', '↓', '|', '>', '-', '/', '~', '"', '&&'].map((k) => '<button type="button" class="btn small" data-k="' + E(k) + '">' + E(k) + '</button>').join('') + '</div>' +
      '<div class="tsim-edit" id="tsEdit" hidden><label for="tsEditBox" id="tsEditName">Editor</label><textarea id="tsEditBox" rows="8" spellcheck="false" autocapitalize="off"></textarea><div class="row" style="gap:8px"><button type="button" class="btn small primary" id="tsSave">Save file</button><button type="button" class="btn small" id="tsCancel">Close without saving</button></div></div></div>' +
      (task ? '<details class="card"><summary>Hints</summary><ul>' + task.hints.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul></details><details class="card"><summary>One possible solution (try first)</summary><pre class="u-code"><code>' + E(task.sol.join('\n')) + '</code></pre></details>' : '') +
      '<p><button type="button" class="btn small" id="tsReset">' + (task ? 'Reset this task' : 'Reset the sandbox') + '</button> ' + link(['terminal'], '← All simulator tasks', 'btn small') + '</p></article>';
    shell('labs', h, crumbs);
    const out = $('#tsOut'), inp = $('#tsIn'); let hi = -1;
    const print = (lines, cls) => { const frag = document.createDocumentFragment(); lines.forEach((l) => { const d = document.createElement('div'); d.className = cls || ''; d.textContent = l === '' ? ' ' : l; frag.appendChild(d); }); out.appendChild(frag); while (out.childNodes.length > 800) out.removeChild(out.firstChild); out.scrollTop = out.scrollHeight; };
    const prompt = () => { $('#tsPrompt').textContent = sim.prompt(); };
    const check = () => { if (!task) return; let res; try { res = task.checks(sim); } catch (e) { res = [['Checking failed: ' + e.message, false]]; } $('#tsChecks').innerHTML = res.map((c) => '<li class="' + (c[1] ? 'ok' : '') + '"><span aria-hidden="true">' + (c[1] ? '✓' : '○') + '</span> ' + E(c[0]) + '</li>').join('');
      if (res.every((c) => c[1])) { const u = st(); const r = u.git[task.id] = u.git[task.id] || {}; if (!r.pass) { r.pass = true; r.at = today(); U.markStudy(); A.addXp(10); save(); A.toast('✅ Task passed: ' + task.title); } else save(); $('#tsState').textContent = 'Passed ✓ on ' + r.at + '.'; print(['', '✓ Task complete. Every check passes.'], 'ok'); } };
    print(task ? ['Task: ' + task.title + '. Type help for the command list. Your home folder is ~.', ''] : ['Sandbox. Type help for the command list.', '']); prompt(); check();
    const run = (line) => { print([sim.prompt() + ' ' + line], 'cmd'); const r = sim.exec(line); if (sim.takeClear()) out.innerHTML = ''; print(r.out, r.err ? 'err' : ''); prompt(); hi = -1;
      const ed = sim.takeEdit(); if (ed) { $('#tsEdit').hidden = false; $('#tsEditName').textContent = 'Editing ' + sim.pretty(ed.path); $('#tsEditBox').value = ed.text; $('#tsEditBox').dataset.path = ed.path; $('#tsEditBox').focus(); }
      if (task && line.trim()) { const u = st(); const rr = u.git[task.id] = u.git[task.id] || {}; rr.tries = Math.min(99999, (rr.tries || 0) + 1); if (rr.tries % 5 === 1) save(); }
      check(); };
    $('#tsForm').addEventListener('submit', (e) => { e.preventDefault(); const v = inp.value; inp.value = ''; run(v); inp.focus(); });
    const hist = () => sim.state.hist;
    const key = (k) => { if (k === 'Tab') { const c = sim.complete(inp.value); inp.value = c.line; if (c.options.length > 1) print(c.options.slice(0, 60)); } else if (k === '↑') { const H = hist(); if (!H.length) return; hi = hi < 0 ? H.length - 1 : Math.max(0, hi - 1); inp.value = H[hi]; } else if (k === '↓') { const H = hist(); if (hi < 0) return; hi++; if (hi >= H.length) { hi = -1; inp.value = ''; } else inp.value = H[hi]; } else { inp.value += (k === '&&' ? ' && ' : k); } inp.focus(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); key('Tab'); } else if (e.key === 'ArrowUp') { e.preventDefault(); key('↑'); } else if (e.key === 'ArrowDown') { e.preventDefault(); key('↓'); } });
    $$('.tsim-keys [data-k]').forEach((b) => b.addEventListener('click', () => key(b.dataset.k)));
    $('#tsSave').addEventListener('click', () => { const box = $('#tsEditBox'); let t = box.value; if (t && !t.endsWith('\n')) t += '\n'; sim.write(box.dataset.path, t); $('#tsEdit').hidden = true; print(['Saved ' + sim.pretty(box.dataset.path) + '.']); check(); inp.focus(); });
    $('#tsCancel').addEventListener('click', () => { $('#tsEdit').hidden = true; inp.focus(); });
    $('#tsReset').addEventListener('click', () => U.render(U.path));
  };

  /* ================= 3. mock interview ================= */
  let MOCK = null, mockTimer = null;
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const STAR = ['Situation: you set the scene in a sentence or two', 'Task: you said what you personally had to achieve', 'Action: you described what you did, in the first person', 'Result: you gave an outcome, ideally with a number or concrete change', 'Reflection: you said what you learned or would do differently'];
  T.mock = async function (path) {
    const crumbs = [['University', []], ['Career centre', ['career']], ['Mock interview']]; const u = st();
    if (path[2] === 'run' && MOCK && !MOCK.over) return runMock(path, crumbs);
    if (path[2] === 'report' && MOCK && MOCK.over) return mockReport(crumbs);
    const past = Object.keys(u.mock).sort().reverse().slice(0, 10).map((k) => u.mock[k]).filter((r) => r && typeof r === 'object');
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Career centre</p><h1>Mock technical interview</h1><p>A timed session in the shape of a real first-round technical interview: a warm-up technical question, a coding exercise marked by tests, a second technical question, and a behavioural question. When the time runs out the session ends, as it would in the real thing.</p></section>' +
      '<div class="card"><h2>Start a session</h2><fieldset class="ux-rub"><legend>Length</legend><label><input type="radio" name="mkLen" value="30" checked><span>30 minutes (coding: Easy)</span></label><label><input type="radio" name="mkLen" value="45"><span>45 minutes (coding: Medium or Hard)</span></label></fieldset><button type="button" class="btn primary" id="mkStart">Start the interview</button><p class="u-fine">How it is marked: the coding exercise is marked automatically by test cases. The technical and behavioural answers are self-assessed against key points and a checklist, because nothing on this device can judge free text fairly. Answer aloud as well as in writing if you can; speaking is half of a real interview.</p></div>';
    h += '<h2 class="u-h2">Your past sessions</h2>' + (past.length ? '<div class="u-tablewrap"><table class="u-table"><thead><tr><th>Date</th><th>Length</th><th>Coding</th><th>Technical (self)</th><th>Behavioural (self)</th><th>Time used</th></tr></thead><tbody>' + past.map((r) => '<tr><td>' + E(r.at) + '</td><td>' + (+r.len || 0) + ' min</td><td>' + E(r.code || '') + ' ' + (r.pass ? '✓ passed' : '✗ not passed') + '</td><td>' + (+r.tech || 0) + '%</td><td>' + (+r.star || 0) + ' / 5</td><td>' + fmt(+r.used || 0) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="pill">No sessions yet.</p>');
    h += '<p>' + link(['career', 'interview'], '← Untimed interview practice', 'btn small') + '</p>';
    shell('career', h, crumbs);
    $('#mkStart').addEventListener('click', () => {
      const len = +($('input[name="mkLen"]:checked') || {}).value || 30;
      const pool = D.coding.filter((x) => (len === 30 ? x.level === 'Easy' : x.level !== 'Easy')); const unsolved = pool.filter((x) => !(u.iv['code:' + x.id] || {}).pass);
      const code = shuffle(unsolved.length ? unsolved : pool)[0]; const cq = shuffle(D.concepts.map((_, i) => i)).slice(0, 2); const bq = shuffle(D.behavioural)[0];
      MOCK = { len, code, cq, bq, step: 0, start: Date.now(), end: Date.now() + len * 60000, ans: ['', '', '', ''], ticks: [[], [], [], []], pass: false, tries: 0, over: false, stepAt: [Date.now()], spent: [0, 0, 0, 0] };
      A.go(['career', 'mock', 'run']);
    });
  };
  const STEPS = ['Warm-up technical question', 'Coding exercise', 'Technical question', 'Behavioural question'];
  async function runMock(path, crumbs) {
    try { await U.loadMod('uni-assess'); } catch (e) { shell('career', U.offlineHtml('The code runner could not be loaded.'), crumbs); return U.bindRetry(); }
    if (U.path !== path) return; const M = MOCK, s = M.step;
    const head = '<div class="mk-bar" role="timer" aria-live="off"><b id="mkClock">' + fmt((M.end - Date.now()) / 1000) + '</b><span>remaining · part ' + (s + 1) + ' of 4: ' + E(STEPS[s]) + '</span><button type="button" class="btn small" id="mkEnd">End interview now</button></div>';
    let body = '';
    if (s === 0 || s === 2) { const q = D.concepts[M.cq[s === 0 ? 0 : 1]];
      body = '<div class="card"><p class="u-eyebrow">' + E(q[0]) + '</p><h2>' + E(q[1]) + '</h2><label class="up-f">Your answer, as you would say it<textarea id="mkAns" rows="7" maxlength="4000" placeholder="Explain in full sentences. Aim for 60 to 150 words.">' + E(M.ans[s]) + '</textarea></label><p class="u-fine" id="mkWc"></p></div><p><button type="button" class="btn primary" id="mkNext">Next part →</button></p>'; }
    else if (s === 1) { const x = M.code; body = '<div class="card"><p class="u-eyebrow">' + E(x.level) + ' · ' + E(U.assess.langName(x.lang)) + ' · marked by ' + x.tests.length + ' test cases</p><h2>' + E(x.title) + '</h2><div class="u-prose">' + md(x.md) + '</div><p class="u-fine">Before typing: restate the problem, ask yourself about edge cases, and say your plan and its complexity.</p></div><div id="mkHost"></div><p class="pill" id="mkCodeState">' + (M.pass ? 'Passed ✓' : 'Not passed yet. You can move on at any time.') + '</p><p><button type="button" class="btn primary" id="mkNext">Next part →</button></p>'; }
    else { body = '<div class="card"><p class="u-eyebrow">Behavioural</p><h2>' + E(M.bq) + '</h2><p class="u-fine">Use STAR: Situation, Task, Action, Result, and finish with what you learned.</p><label class="up-f">Your answer<textarea id="mkAns" rows="9" maxlength="5000" placeholder="Use a real example, including from projects here.">' + E(M.ans[3]) + '</textarea></label><p class="u-fine" id="mkWc"></p></div><p><button type="button" class="btn primary" id="mkNext">Finish the interview →</button></p>'; }
    shell('career', '<article class="u-exam">' + head + body + '</article>', crumbs);
    const ta = $('#mkAns'); if (ta) { const wc = () => { $('#mkWc').textContent = words(ta.value) + ' words'; M.ans[s] = ta.value; }; ta.addEventListener('input', wc); wc(); ta.focus(); }
    if (s === 1) { if (!M.fresh) { M.fresh = true; delete st().scratch['mock:' + M.code.id]; } } if (s === 1) U.assess.mountTask($('#mkHost'), M.code, { saveKey: 'mock:' + M.code.id, onResult: (g) => { if (g.ungraded) return; M.tries++; if (g.pass && !M.pass) { M.pass = true; $('#mkCodeState').textContent = 'Passed ✓ after ' + M.tries + ' submission' + (M.tries === 1 ? '' : 's') + '.'; const r = st().iv['code:' + M.code.id] = st().iv['code:' + M.code.id] || {}; r.tries = (r.tries || 0) + 1; if (!r.pass) { r.pass = true; r.at = today(); } save(); } } });
    const leaveStep = () => { M.spent[s] += Date.now() - M.stepAt[M.stepAt.length - 1]; M.stepAt.push(Date.now()); };
    $('#mkNext').addEventListener('click', () => { leaveStep(); if (s < 3) { M.step++; U.render(U.path); } else endMock(false); });
    $('#mkEnd').addEventListener('click', (e) => { if (e.currentTarget.dataset.armed) { leaveStep(); endMock(false); return; } e.currentTarget.dataset.armed = '1'; e.currentTarget.textContent = 'Press again to end'; });
    clearInterval(mockTimer); mockTimer = setInterval(() => { if (!MOCK || MOCK.over || U.path[1] !== 'mock' || U.path[2] !== 'run') { clearInterval(mockTimer); return; } const left = (MOCK.end - Date.now()) / 1000; const c = $('#mkClock'); if (c) { c.textContent = fmt(left); c.classList.toggle('low', left < 120); } if (left <= 0) { leaveStep(); endMock(true); } }, 1000);
  }
  function endMock(timeUp) { clearInterval(mockTimer); MOCK.over = true; MOCK.timeUp = timeUp; MOCK.used = Math.min(MOCK.len * 60, (Date.now() - MOCK.start) / 1000); A.go(['career', 'mock', 'report']); }
  function mockReport(crumbs) {
    const M = MOCK; const q1 = D.concepts[M.cq[0]], q2 = D.concepts[M.cq[1]];
    const selfBox = (q, i) => '<div class="card"><h3>' + E(q[1]) + '</h3><p class="u-fine">Your answer (' + words(M.ans[i]) + ' words):</p><blockquote class="mk-ans">' + (M.ans[i].trim() ? E(M.ans[i]).replace(/\n/g, '<br>') : '<i>No answer written.</i>') + '</blockquote><fieldset class="ux-rub" data-part="' + i + '"><legend>Tick each key point your answer really covered</legend>' + q[2].map((k) => '<label><input type="checkbox"><span>' + E(k) + '</span></label>').join('') + '</fieldset></div>';
    let h = '<section class="u-stagehero"><p class="u-eyebrow">Mock interview · ' + (M.timeUp ? 'time ran out' : 'finished') + '</p><h1>Your interview report</h1><p>Time used: ' + fmt(M.used) + ' of ' + M.len + ':00. Split: ' + M.spent.map((ms, i) => E(STEPS[i]) + ' ' + fmt(ms / 1000)).join(' · ') + '.</p></section>';
    h += '<h2 class="u-h2">1. Coding (marked by tests)</h2><div class="card"><p><b>' + E(M.code.title) + '</b> (' + E(M.code.level) + '): ' + (M.pass ? '✓ passed every test after ' + M.tries + ' submission' + (M.tries === 1 ? '' : 's') + '.' : '✗ not passed' + (M.tries ? ' after ' + M.tries + ' submission' + (M.tries === 1 ? '' : 's') : ' (no submission)') + '.') + '</p>' + (M.pass ? '' : '<p>' + link(['career', 'interview', M.code.id], 'Try it again untimed →', 'btn small') + '</p>') + '</div>';
    h += '<h2 class="u-h2">2. Technical questions (self-assessed)</h2>' + selfBox(q1, 0) + selfBox(q2, 2);
    h += '<h2 class="u-h2">3. Behavioural question (self-assessed)</h2><div class="card"><h3>' + E(M.bq) + '</h3><blockquote class="mk-ans">' + (M.ans[3].trim() ? E(M.ans[3]).replace(/\n/g, '<br>') : '<i>No answer written.</i>') + '</blockquote><fieldset class="ux-rub" data-part="3"><legend>STAR checklist: tick what your answer did</legend>' + STAR.map((k) => '<label><input type="checkbox"><span>' + E(k) + '</span></label>').join('') + '</fieldset></div>';
    h += '<p><button type="button" class="btn primary" id="mkSave">Save this report</button> <span class="pill" id="mkMsg" role="status"></span></p><div id="mkAdvice"></div><p>' + link(['career', 'mock'], 'Back to mock interviews', 'btn small') + '</p>';
    shell('career', h, crumbs);
    $('#mkSave').addEventListener('click', () => {
      const ticks = $$('.ux-rub[data-part]').map((f) => $$('input', f).filter((b) => b.checked).length);
      const tech = Math.round((ticks[0] + ticks[1]) / (q1[2].length + q2[2].length) * 100), star = ticks[2];
      const u = st(); const id = String(M.start); u.mock[id] = { at: today(), len: M.len, code: M.code.id, pass: M.pass, tries: M.tries, tech, star, used: Math.round(M.used) };
      const keys = Object.keys(u.mock).sort(); while (keys.length > 30) delete u.mock[keys.shift()]; U.markStudy(); save();
      $('#mkMsg').textContent = 'Saved.'; $('#mkSave').disabled = true;
      const adv = []; if (!M.pass) adv.push('Coding: solve the exercise untimed, then retry a mock. Practise saying your plan before you type.');
      if (tech < 60) { const c1 = U.courseById(q1[3]), c2 = U.courseById(q2[3]); adv.push('Technical answers covered ' + tech + '% of the key points. Revise ' + [c1, c2].filter(Boolean).map((c) => c.code + ' ' + c.title).filter((v, i, a) => a.indexOf(v) === i).join(' and ') + '.'); }
      if (star < 4) adv.push('Behavioural: your answer ticked ' + star + ' of 5 STAR points. Prepare three real stories in advance and practise them aloud.');
      if (M.timeUp) adv.push('Time ran out. In a real interview, keep moving: a partial answer to every part usually scores better than a perfect answer to one.');
      if (!adv.length) adv.push('A strong session. Try the 45-minute length next, or ask a friend to play the interviewer.');
      $('#mkAdvice').innerHTML = '<div class="card"><h2>What to work on</h2><ul>' + adv.map((a) => '<li>' + E(a) + '</li>').join('') + '</ul><p class="u-fine">This is practice, not an assessment by an employer, and it makes no prediction about real interviews.</p></div>';
    });
  }

  /* ================= 4. portfolio ================= */
  T.portfolio = function () {
    const u = st(), CAT = U.cat; const all = CAT.courses.concat(CAT.electives || []); const done = all.filter(U.courseDone);
    const cv = u.cv || {}; const name = (u.name || '').trim();
    const projs = all.filter((c) => U.projectDone(c)); const labs = all.filter((c) => U.labPassed(c)); const finals = CAT.stages.filter((s) => U.finalPassed(s.id));
    const ivs = D.coding.filter((x) => (u.iv['code:' + x.id] || {}).pass); const gits = TASKS.filter((x) => gitRec(x.id).pass); const studio = Object.keys(u.studio || {}).filter((k) => u.studio[k] && u.studio[k].pass).length;
    const skills = Array.from(new Set(done.reduce((a, c) => a.concat(c.skills || []), [])));
    const safe = (x) => (/^https:\/\/[^\s"'<>]+$/.test(String(x || '')) ? String(x) : '');
    const sec = (id, title, inner) => '<section class="pf-sec" data-sec="' + id + '"><h2>' + title + '</h2>' + inner + '</section>';
    let body = '<header class="pf-head"><h1>' + (name ? E(name) : 'Software engineering portfolio') + '</h1>' + (cv.headline ? '<p class="pf-sub">' + E(cv.headline) + '</p>' : '') + '<p class="pf-links">' + [safe(cv.github), safe(cv.site)].filter(Boolean).map((x) => '<a href="' + E(x) + '">' + E(x) + '</a>').join(' · ') + '</p>' + (cv.summary ? '<p>' + E(cv.summary) + '</p>' : '') + '</header>';
    body += sec('summary', 'Record at a glance', '<ul class="pf-stats"><li><b>' + done.length + '</b> course' + (done.length === 1 ? '' : 's') + ' completed</li><li><b>' + Object.keys(u.lessons).length + '</b> lessons</li><li><b>' + finals.length + '</b> of ' + CAT.stages.length + ' stage finals passed</li><li><b>' + labs.length + '</b> graded programming assignments passed</li><li><b>' + projs.length + '</b> projects submitted</li><li><b>' + U.fmtTime(u.time) + '</b> recorded study time</li></ul>');
    body += sec('projects', 'Projects', projs.length ? projs.map((c) => { const r = u.projects[c.id]; return '<article class="pf-proj"><h3>' + E(r.title || c.ptitle || c.title) + (c.capstone ? ' <small>(capstone)</small>' : '') + '</h3><p class="pf-meta">' + E(c.code + ' ' + c.title) + ' · submitted ' + E(r.at) + ' · self-assessed ' + (+r.pct || 0) + '%</p>' + (r.notes ? '<p>' + E(r.notes).replace(/\n/g, '<br>') + '</p>' : '') + (safe(r.url) ? '<p><a href="' + E(safe(r.url)) + '">' + E(safe(r.url)) + '</a></p>' : '') + (c.skills && c.skills.length ? '<p class="pf-meta">Skills: ' + E(c.skills.join(', ')) + '</p>' : '') + '</article>'; }).join('') : '<p>No projects submitted yet.</p>');
    body += sec('courses', 'Completed courses', done.length ? '<table class="pf-table"><thead><tr><th>Course</th><th>Grade</th><th>Completed</th></tr></thead><tbody>' + done.map((c) => { const g = U.courseGrade(c); return '<tr><td>' + E(c.code + ' ' + c.title) + (c.elective ? ' (elective)' : '') + '</td><td>' + (g ? E(g.letter) + ' (' + g.pct + '%)' : '') + '</td><td>' + E(u.certs['course:' + c.id] || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>No completed courses yet.</p>');
    body += sec('finals', 'Stage final examinations', finals.length ? '<ul>' + finals.map((s) => '<li>Stage ' + s.id + ': ' + E(s.title) + ' (best ' + U.bestOf(U.finalId(s.id)) + '%)</li>').join('') + '</ul>' : '<p>None passed yet.</p>');
    body += sec('practical', 'Practical work checked automatically', '<ul><li>Graded programming assignments passed: ' + (labs.length ? E(labs.map((c) => c.code).join(', ')) : 'none yet') + '</li><li>Interview coding exercises solved: ' + (ivs.length ? E(ivs.map((x) => x.title).join(', ')) : 'none yet') + '</li><li>Git and terminal simulator tasks passed: ' + gits.length + ' of ' + TASKS.length + (gits.length ? ' (' + E(gits.map((x) => x.title).join(', ')) + ')' : '') + '</li><li>Practice studio exercises completed: ' + studio + '</li></ul>');
    body += sec('skills', 'Skills from completed courses', skills.length ? '<p>' + E(skills.join(' · ')) + '</p>' : '<p>Complete courses to list skills here.</p>');
    body += '<p class="pf-note">This record comes from Learn\'s Software Engineering University, a free self-study pathway. It is not an accredited qualification. Examinations and assignments were completed on the learner\'s own device and are not invigilated; project marks are self-assessed. Generated on ' + E(today()) + '.</p>';
    const SECS = [['summary', 'Record at a glance'], ['projects', 'Projects'], ['courses', 'Completed courses'], ['finals', 'Stage finals'], ['practical', 'Practical work'], ['skills', 'Skills']];
    const h = '<div class="pf-tools no-print"><section class="u-stagehero"><p class="u-eyebrow">Projects</p><h1>Your portfolio page</h1><p>One page built from your real record: projects, courses, grades and the practical work checked by tests. Print it or save it as a PDF to share. Your name, headline, links and summary come from the ' + link(['career', 'cv'], 'CV builder') + '.</p></section>' +
      '<div class="card"><fieldset class="ux-rub"><legend>Include in the printed page</legend>' + SECS.map((x) => '<label><input type="checkbox" data-inc="' + x[0] + '" checked><span>' + E(x[1]) + '</span></label>').join('') + '</fieldset><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn primary small" id="pfPrint">🖨 Print or save as PDF</button><button type="button" class="btn small" id="pfDown">⬇ Download as a web page</button></div><p class="u-fine">On iPad: Print, then pinch outwards on the preview (or use Share) to save a PDF.</p></div></div>' +
      '<div class="pf-page" id="pfPage">' + body + '</div>';
    shell('projects', h, [['University', []], ['Projects', ['projects']], ['Portfolio']]);
    const apply = () => $$('[data-inc]').forEach((b) => { const s = $('.pf-sec[data-sec="' + b.dataset.inc + '"]'); if (s) s.classList.toggle('pf-off', !b.checked); });
    $$('[data-inc]').forEach((b) => b.addEventListener('change', apply));
    $('#pfPrint').addEventListener('click', () => { document.body.classList.add('pf-printing'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('pf-printing'), 500); }, 50); });
    $('#pfDown').addEventListener('click', () => { const pg = $('#pfPage').cloneNode(true); $$('.pf-off', pg).forEach((x) => x.remove()); const doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (name ? E(name) + ' · ' : '') + 'Portfolio</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:820px;margin:32px auto;padding:0 20px;color:#141a33;background:#fff}h1{font-size:30px;margin:0}h2{font-size:20px;border-bottom:1px solid #d5dcec;padding-bottom:4px;margin-top:28px}.pf-sub{font-size:18px;color:#3a4366;margin:4px 0}.pf-meta,.pf-note{color:#4a5373;font-size:14px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e3e8f3;padding:6px 8px;text-align:left}.pf-stats{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 20px}.pf-proj{border:1px solid #d5dcec;border-radius:10px;padding:10px 16px;margin:12px 0}a{color:#1d4ed8}</style></head><body>' + pg.innerHTML + '</body></html>';
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' })); a.download = 'portfolio.html'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); });
  };

  /* ================= search (4.5) ================= */
  // Searches every course, lesson, lab and project. Course files are downloaded the first time someone searches
  // (about 1.7 MB in total, much less compressed) and are then kept for offline use like any opened course.
  const plain = (s) => String(s || '').replace(/```[a-z]*\n?/g, ' ').replace(/[#>*`_|\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  let INDEX = null;
  async function buildIndex(onStep) {
    const all = U.cat.courses.concat(U.cat.electives || []); const files = [...new Set(all.map((c) => c.file))]; let done = 0, failed = 0;
    await Promise.all(files.map((f) => U.loadFile(f).catch(() => { failed++; }).then(() => { done++; onStep(done, files.length); })));
    const idx = [];
    all.forEach((c) => {
      const d = U.content[c.id]; idx.push({ kind: 'Course', title: c.code + ' · ' + c.title, text: plain((c.desc || '') + ' ' + (c.topics || []).join(', ')), path: ['course', c.id], where: c.elective ? 'Elective' : 'Stage ' + c.stage });
      if (!d) return;
      d.lessons.forEach((l, i) => idx.push({ kind: 'Lesson', title: l.t, text: plain(l.md), path: ['course', c.id, 'lesson', String(i)], where: c.code + ' · lesson ' + (i + 1) }));
      if (d.lab) idx.push({ kind: 'Lab', title: d.lab.title || 'Laboratory', text: plain(d.lab.md || d.lab.prompt || ''), path: ['course', c.id, 'lab'], where: c.code });
      if (d.project) idx.push({ kind: 'Project', title: d.project.title || 'Project', text: plain(d.project.md || ''), path: ['course', c.id, 'project'], where: c.code });
    });
    idx.forEach((x) => { x.lt = x.title.toLowerCase(); x.lx = x.text.toLowerCase(); });
    return { idx, failed };
  }
  function find(q) {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 8); if (!words.length) return [];
    const out = [];
    INDEX.idx.forEach((x) => {
      let score = 0; for (const w of words) { const t = x.lt.includes(w), b = x.lx.includes(w); if (!t && !b) return; score += t ? 10 : 0; if (b) score += Math.min(5, x.lx.split(w).length - 1); }
      if (x.lt.includes(q.toLowerCase())) score += 20; if (x.kind === 'Course') score += 3; out.push([score, x]);
    });
    return out.sort((a, b) => b[0] - a[0]).slice(0, 60).map((p) => p[1]);
  }
  function snippet(x, words) {
    const at = words.map((w) => x.lx.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0]; if (at === undefined) return E(x.text.slice(0, 150)) + (x.text.length > 150 ? '…' : '');
    const s = Math.max(0, at - 60); let t = (s ? '…' : '') + x.text.slice(s, s + 190) + (s + 190 < x.text.length ? '…' : '');
    t = E(t); words.forEach((w) => { t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return t;
  }
  T.search = async function (path) {
    const crumbs = [['University', []], ['Search']]; const q0 = String(path[1] || '').replace(/-/g, ' '); // the address keeps letters, digits and dots, with - for spaces
    shell('search', '<h1 class="u-h1">🔎 Search the University</h1><div class="card"><form id="srF" role="search"><label for="srQ" class="u-fine">Find courses, lessons, labs and projects</label><div class="row" style="gap:8px;margin-top:6px"><input type="search" id="srQ" autocomplete="off" placeholder="e.g. recursion, hash table, SQL join" style="flex:1;min-width:0;min-height:44px" value="' + E(q0) + '"><button class="btn primary" type="submit">Search</button></div></form></div><div id="srOut" aria-live="polite"></div>', crumbs);
    const out = $('#srOut'); const inp = $('#srQ');
    const run = async (q) => {
      q = q.trim(); if (!q) { out.innerHTML = '<p class="u-fine">Type a word or phrase. All words must appear.</p>'; return; }
      if (!INDEX) { out.innerHTML = '<div class="card" role="status"><p>Preparing search… <span id="srP">0</span> of the course files ready.</p></div>'; INDEX = await buildIndex((d, n) => { const s = $('#srP'); if (s) s.textContent = d + '/' + n; }); if (!INDEX.idx.some((x) => x.kind === 'Lesson')) { const failed = INDEX.failed; INDEX = null; out.innerHTML = '<div class="card u-off" role="alert"><p>The course files could not be downloaded' + (navigator.onLine ? '.' : ' because you are offline.') + ' Search needs them once; after that it works offline.</p></div>'; return; } }
      if (U.path[0] !== 'search') return;
      const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1); const r = find(q);
      out.innerHTML = (INDEX.failed ? '<p class="pill">Some course files could not be downloaded, so some results may be missing.</p>' : '') + '<p class="u-fine">' + (r.length ? r.length + (r.length === 60 ? '+' : '') + ' result' + (r.length === 1 ? '' : 's') + ' for “' + E(q) + '”' : 'Nothing found for “' + E(q) + '”. Try fewer or shorter words.') + '</p>' +
        '<ol class="sr-list">' + r.map((x) => '<li class="card sr-item">' + U.link(x.path, '<span class="pill">' + E(x.kind) + '</span> <b>' + E(x.title) + '</b>') + '<small class="u-fine"> · ' + E(x.where) + '</small><p>' + snippet(x, words) + '</p></li>').join('') + '</ol>';
    };
    $('#srF').addEventListener('submit', (e) => { e.preventDefault(); const q = inp.value; const slug = q.trim().toLowerCase().replace(/[^\w.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); history.replaceState(null, '', '#/uni/search' + (slug ? '/' + slug : '')); U.path = slug ? ['search', slug] : ['search']; run(q); });
    if (q0) run(q0); else { out.innerHTML = '<p class="u-fine">Type a word or phrase. All words must appear.</p>'; inp.focus(); }
  };

  T._mock = () => MOCK; // used by tests/e2e-tools.js
  U.tools = T;
})();
