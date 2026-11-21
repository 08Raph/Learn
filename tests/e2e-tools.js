/* 4.1 features: backup and restore, spaced review, Git and terminal simulator, mock interview, portfolio,
   extended electives, contrast of theme colours.   node tests/e2e-tools.js   (own local server; all external hosts blocked) */
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'), path = require('path');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const PORT = 8775, BASE = 'http://localhost:' + PORT + '/Learn/index.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (!u.startsWith('/Learn/')) { r.writeHead(404); return r.end(); } u = u.slice(7) || 'index.html'; const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let pass = 0, fail = 0; const ok = (m, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m + (x ? ' [' + String(x).slice(0, 240) + ']' : '')); } };
const GitSim = require(path.join(ROOT, 'uni', 'gitsim.js'));
const dayPlus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

(async () => {
  /* ---------- 1. simulator unit checks (Node, no browser) ---------- */
  { const s = GitSim.create(); const r = (l) => s.exec(l);
    ok('sim: commands outside a repository report "not a git repository"', r('git status').err && /not a git repository/.test(r('git status').out[0]));
    r('mkdir p && cd p && git init'); ok('sim: git init creates .git and the prompt shows the branch', s.isDir(s.HOME + '/p/.git') && /\(main\)\$$/.test(s.prompt()));
    ok('sim: commit with nothing staged is refused', r('git commit -m x').err);
    r('echo a > f.txt'); ok('sim: commit without -m explains how to give a message', r('git add f.txt && git commit').err && /-m/.test(r('git commit').out.join(' ')));
    r('git commit -m "first"'); ok('sim: first commit is a root commit and the tree is clean', s.log().length === 1 && s.clean());
    r('git switch -c b && echo b > f.txt && git commit -am "on b" && git switch main');
    r('echo local > f.txt'); const sw = r('git switch b'); ok('sim: switching with a conflicting local change is refused', sw.err && /overwritten by checkout/.test(sw.out.join(' ')));
    r('git restore f.txt'); ok('sim: git restore discards a working-tree change', s.read(s.HOME + '/p/f.txt') === 'a\n');
    ok('sim: deleting an unmerged branch with -d is refused', r('git branch -d b').err);
    r('echo m > f.txt && git commit -am "on main"'); const mg = r('git merge b'); ok('sim: a real conflict is reported with markers in the file', /CONFLICT/.test(mg.out.join(' ')) && /<<<<<<< HEAD/.test(s.read(s.HOME + '/p/f.txt')));
    r('git merge --abort'); ok('sim: merge --abort restores the previous state', !s.repo().merging && s.read(s.HOME + '/p/f.txt') === 'm\n' && s.clean());
    r('echo x > secret.env && echo secret.env > .gitignore'); ok('sim: .gitignore hides a file from status and blocks git add', !s.status().untracked.includes('secret.env') && r('git add secret.env').err);
    ok('sim: pipes, grep -c and redirection work', (() => { r('echo one > l.txt && echo two >> l.txt && echo one >> l.txt'); r('grep -c one l.txt > n.txt'); return s.read(s.HOME + '/p/n.txt') === '2\n' && r('cat l.txt | sort | head -n 1').out[0] === 'one'; })());
    ok('sim: && stops after a failing command', (() => { const x = r('cat nope && echo after'); return x.err && !x.out.includes('after'); })());
    ok('sim: rm refuses to delete the current folder', r('rm -r ~/p').err && s.isDir(s.HOME + '/p'));
    ok('sim: tab completion completes a unique file name', s.complete('cat l.t').line === 'cat l.txt');
    ok('sim: unknown commands are explained, not crashed on', /command not found/.test(r('sudo rm -rf /').out[0]) && /not available/.test(r('git push').out[0]));
    ok('sim: unclosed quotes give a syntax error', r('echo "abc').err);
  }
  await new Promise((k) => srv.listen(PORT, k));
  const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1180, height: 900 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await ctx.route('**/*', (r) => (r.request().url().startsWith('http://localhost:' + PORT) ? r.continue() : r.abort()));
  const UE = (fn, arg) => p.evaluate(fn, arg); const text = () => p.evaluate(() => document.querySelector('#app').innerText);
  const go = async (h, wait) => { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(wait || 900); };
  try {
    await p.goto(BASE + '#/uni'); await p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready, null, { timeout: 20000 });
    /* ---------- 2. all ten graded simulator tasks: unsolved at the start, solved by their sample solutions ---------- */
    await go('#/uni/terminal'); ok('terminal hub lists 10 tasks and a sandbox', /Folders and files/.test(await text()) && /Resolve a merge conflict/.test(await text()) && /Sandbox/.test(await text()));
    const taskRes = await UE(() => window.LearnUniversity.tools.TASKS.map((t) => { const s = window.GitSim.create(); if (t.setup) t.setup(s); const before = t.checks(s).every((c) => c[1]);
      let sol = t.sol.slice(); if (t.id === 'history') { s.exec('cd shop'); const c = s.log('main').find((x) => x.msg === 'Change discount to 0.5'); sol = ['echo ' + c.id.slice(0, 7) + ' > ~/bug.txt']; }
      sol.forEach((l) => s.exec(l)); const res = t.checks(s); return { id: t.id, before, after: res.every((c) => c[1]), n: res.length, failed: res.filter((c) => !c[1]).map((c) => c[0]) }; }));
    ok('simulator: there are 10 tasks', taskRes.length === 10);
    ok('simulator: no task passes before any command is typed', taskRes.every((r) => !r.before), JSON.stringify(taskRes.filter((r) => r.before)));
    ok('simulator: every task passes with its sample solution', taskRes.every((r) => r.after), JSON.stringify(taskRes.filter((r) => !r.after)));
    ok('simulator: a wrong approach fails the check (committing the secret)', await UE(() => { const t = window.LearnUniversity.tools.TASKS.find((x) => x.id === 'stage'); const s = window.GitSim.create(); t.setup(s); ['cd app', 'git add .', 'git commit -m all', 'echo secret.env > .gitignore', 'git add .gitignore', 'git commit -m ignore'].forEach((l) => s.exec(l)); return !t.checks(s).every((c) => c[1]); }));
    // drive one task through the real UI, including Tab completion, history and the editor
    await go('#/uni/terminal/files', 1200); const type = async (c) => { await p.fill('#tsIn', c); await p.press('#tsIn', 'Enter'); await p.waitForTimeout(60); };
    await type('mkdir project'); await type('cd proj'); ok('terminal UI: errors are shown in the output', /No such file or directory/.test(await p.innerText('#tsOut')));
    await p.fill('#tsIn', 'cd proj'); await p.press('#tsIn', 'Tab'); ok('terminal UI: Tab completes a folder name', (await p.inputValue('#tsIn')) === 'cd project/'); await p.press('#tsIn', 'Enter');
    await type('edit notes.txt'); ok('terminal UI: edit opens the editor', await p.isVisible('#tsEdit'));
    await p.fill('#tsEditBox', 'hello terminal'); await p.click('#tsSave'); await type('mkdir docs');
    ok('terminal UI: checklist turns green and the pass is recorded once', /Passed ✓/.test(await p.innerText('#tsState')) && await UE(() => window.LearnUniversity.st().git.files.pass === true));
    await p.press('#tsIn', 'ArrowUp'); ok('terminal UI: arrow up recalls the previous command', (await p.inputValue('#tsIn')) === 'mkdir docs');
    await p.click('[data-k="|"]'); ok('terminal UI: extra-key buttons insert symbols for iPad keyboards', (await p.inputValue('#tsIn')).endsWith('|'));
    await go('#/uni/terminal'); ok('terminal hub shows the task as passed', /Passed ✓/.test(await text()));
    await go('#/uni/labs'); ok('labs hub links to the simulator', await p.locator('a[href="#/uni/terminal"]').count() >= 1);
    await go('#/uni/course/c107'); ok('SEU 107 (Terminal, Files and Git) links to the simulator', await p.locator('a[href="#/uni/terminal"]').count() >= 1);

    /* ---------- 3. spaced review ---------- */
    await go('#/uni/course/c101/lesson/0', 1400); const right = await UE(() => window.LearnUniversity.content.c101.lessons[0].quiz[0].a);
    await p.locator('.u-q').first().locator('.u-opt:not([data-o="' + right + '"])').first().click(); await p.waitForTimeout(200);
    ok('review: a wrong lesson answer is scheduled for tomorrow', await UE((d) => { const r = window.LearnUniversity.st().srs['c101:0:0']; return !!r && r.b === 0 && r.due === d; }, dayPlus(1)));
    ok('review: nothing is due today yet', await UE(() => window.LearnUniversity.srsCounts().due === 0));
    await UE((d) => { window.LearnUniversity.st().srs['c101:0:0'].due = d; }, dayPlus(0)); await go('#/uni/review');
    ok('review page shows 1 due today and a start button', /1\s*due today/.test(await text()) && await p.locator('a[href="#/uni/review/go"]').count() === 1);
    await go('#/uni/review/go', 1500); await p.locator('#rvQ .u-opt[data-o="' + right + '"]').click(); await p.waitForTimeout(200);
    ok('review: a correct answer moves the question to 3 days', await UE((d) => { const r = window.LearnUniversity.st().srs['c101:0:0']; return r.b === 1 && r.due === d; }, dayPlus(3)) && /Next review in 3 days/.test(await text()));
    await UE((d) => { window.LearnUniversity.st().srs['c101:0:0'].due = d; }, dayPlus(0)); await go('#/uni/dashboard', 400); await go('#/uni/review/go', 1500);
    await p.locator('#rvQ .u-opt:not([data-o="' + right + '"])').first().click(); await p.waitForTimeout(200);
    ok('review: a wrong answer sends it back to tomorrow', await UE((d) => { const r = window.LearnUniversity.st().srs['c101:0:0']; return r.b === 0 && r.due === d; }, dayPlus(1)));
    await UE((d) => { const r = window.LearnUniversity.st().srs['c101:0:0']; r.b = 2; r.due = d; }, dayPlus(0)); await go('#/uni/dashboard', 400); await go('#/uni/review/go', 1500);
    await p.locator('#rvQ .u-opt[data-o="' + right + '"]').click(); await p.waitForTimeout(200);
    ok('review: correct at the 7-day stage marks it mastered', await UE(() => window.LearnUniversity.st().srs['c101:0:0'].b === 3) && /Mastered/.test(await text()));
    await p.click('#rvGo'); ok('review: results page after the session', /1 of 1 correct/.test(await text()));
    await UE(() => { const u = window.LearnUniversity.st(); u.missed['c102:x1'] = 2; }); ok('review: older missed answers are picked up automatically', await UE(() => { window.LearnUniversity.srsSync(); return !!window.LearnUniversity.st().srs['c102:x1']; }));
    await UE(() => { window.LearnUniversity.st().srs['zz999:x1'] = { b: 0, due: '2000-01-01', n: 1 }; window.LearnUniversity.st().srs['bad'] = 5; }); await go('#/uni/dashboard', 400); await go('#/uni/review/go', 1800);
    ok('review: entries for unknown courses or malformed entries are dropped safely', await UE(() => !window.LearnUniversity.st().srs['zz999:x1'] && !window.LearnUniversity.st().srs.bad));
    await go('#/uni/dashboard'); ok('dashboard shows the review count; Review is in the navigation', /due for review/.test(await text()) && await p.locator('.u-nav a[href="#/uni/review"]').count() === 1);

    /* ---------- 4. mock interview ---------- */
    await go('#/uni/career/mock'); ok('mock interview page explains how it is marked', /marked automatically by test cases/.test(await text()) && /self-assessed/.test(await text()));
    await p.click('#mkStart'); await p.waitForSelector('#mkClock', { timeout: 10000 }); ok('mock: the timer starts at about 30 minutes', /^(30:00|29:5\d)$/.test(await p.innerText('#mkClock')));
    await p.fill('#mkAns', 'A hash map gives average constant time lookup by key while a balanced tree keeps keys in order for range queries.'); await p.click('#mkNext'); await p.waitForSelector('#mkHost textarea', { timeout: 10000 });
    const code = await UE(() => window.LearnUniversity.tools._mock().code); ok('mock: the 30-minute session uses an Easy coding exercise', code.level === 'Easy');
    await p.locator('#mkHost textarea').first().fill(code.solution); await p.locator('#mkHost [data-a="submit"]').first().click(); await p.waitForTimeout(1500);
    ok('mock: the coding exercise is marked by its tests', /Passed ✓/.test(await p.innerText('#mkCodeState')), await p.innerText('#mkCodeState'));
    await p.click('#mkNext'); await p.waitForSelector('#mkAns'); await p.click('#mkNext'); await p.waitForSelector('#mkAns'); await p.fill('#mkAns', 'In my project I had to fix a slow page. I measured, found the query, added an index and the page went from 4 s to 300 ms. I learned to measure first.');
    await p.click('#mkNext'); await p.waitForTimeout(800); ok('mock: report shows coding result, both technical answers and the STAR checklist', /Your interview report/.test(await text()) && /passed every test/.test(await text()) && await p.locator('.ux-rub[data-part]').count() === 3);
    await p.locator('.ux-rub[data-part="3"] input').nth(0).check(); await p.locator('.ux-rub[data-part="3"] input').nth(2).check(); await p.click('#mkSave'); await p.waitForTimeout(300);
    ok('mock: saved with self-assessment kept separate from the tested result', await UE(() => { const m = Object.values(window.LearnUniversity.st().mock); return m.length === 1 && m[0].pass === true && m[0].star === 2; }) && /What to work on/.test(await text()));
    await go('#/uni/career/mock'); await p.click('#mkStart'); await p.waitForSelector('#mkClock'); await UE(() => { window.LearnUniversity.tools._mock().end = Date.now() + 1200; }); await p.waitForTimeout(3500);
    ok('mock: when time runs out the interview ends and goes to the report', /time ran out/i.test(await text()));
    await go('#/uni/career/mock'); ok('mock: past sessions are listed', /Your past sessions/.test(await text()) && await p.locator('tbody tr').count() >= 1);

    /* ---------- 5. portfolio ---------- */
    await UE(() => { const u = window.LearnUniversity.st(); u.cv.headline = 'Junior developer <script>x</script>'; u.cv.github = 'javascript:alert(1)'; u.cv.site = 'https://example.com/me'; u.projects.c101 = { at: '2026-11-01', title: 'My first <b>project</b>', notes: 'Line one\nLine two', pct: 80, url: 'https://example.com/p' }; });
    await go('#/uni/portfolio'); const pf = await p.innerHTML('#pfPage');
    ok('portfolio: shows the project, the record and the honesty note', /My first &lt;b&gt;project/.test(pf) && /Record at a glance/.test(pf) && /not an accredited qualification/.test(pf));
    ok('portfolio: user text is escaped and unsafe links are dropped', !/<script>x/.test(pf) && !/javascript:alert/.test(pf) && /https:\/\/example\.com\/me/.test(pf));
    ok('portfolio: lists simulator tasks and interview work', /Git and terminal simulator tasks passed: 1 of 10/.test(await p.innerText('#pfPage')));
    await p.uncheck('[data-inc="projects"]'); ok('portfolio: unticked sections are marked for leaving out', await p.locator('.pf-sec[data-sec="projects"].pf-off').count() === 1);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pfDown')]); const html = fs.readFileSync(await dl.path(), 'utf8');
    ok('portfolio: downloaded page leaves out unticked sections, has no scripts and keeps the note', !/My first/.test(html) && !/<script/i.test(html) && /not an accredited/.test(html) && /Completed courses/.test(html));
    await go('#/uni/projects'); ok('projects page links to the portfolio page', await p.locator('a[href="#/uni/portfolio"]').count() === 1);

    /* ---------- 6. backup and restore ---------- */
    await UE(() => { const S = JSON.parse(localStorage.getItem('learn-code-v2')); }); await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(500);
    await p.goto(BASE + '#/'); await p.waitForTimeout(900);
    const seeded = await UE(() => { const S = JSON.parse(localStorage.getItem('learn-code-v2')); S.done = Object.assign({}, S.done, { 'py:0': 1, 'py:1': 1, 'py:2': 1, 'py:3': 1, 'py:4': 1 }); delete S.lastBackup; localStorage.setItem('learn-code-v2', JSON.stringify(S)); return true; });
    await p.reload(); await p.waitForTimeout(900); ok('backup: a reminder appears when there is progress and no backup', seeded && await p.locator('#bkNudge').count() === 1);
    await p.click('#bkNudgeGo'); ok('backup: the reminder opens the backup section', await p.evaluate(() => document.getElementById('bkDetails').open));
    const [bk] = await Promise.all([p.waitForEvent('download'), p.click('#bkFile')]); const bkText = fs.readFileSync(await bk.path(), 'utf8'); const bkObj = JSON.parse(bkText);
    ok('backup: file is named by date and holds the app id, version and University progress', /^learn-backup-\d{4}-\d{2}-\d{2}\.json$/.test(bk.suggestedFilename()) && bkObj.app === 'learn' && bkObj.v === 3 && bkObj.ver === '5.10' && !!bkObj.d.uni && !!bkObj.d.uni.git.files);
    ok('backup: the online sign-in identity is not copied into the file', !bkObj.d.duel || (!bkObj.d.duel.uid && !bkObj.d.duel.fc));
    ok('backup: the date of the last backup is shown and the reminder goes away', /Last backup file made on this device/.test(await p.innerText('#bkLast')) && await p.locator('#bkNudge').count() === 0);
    const pick = (name, content) => p.setInputFiles('#bkPick', { name, mimeType: 'application/json', buffer: Buffer.from(content) });
    await pick('x.json', 'this is not json'); await p.waitForTimeout(300); ok('restore: a damaged file is rejected with a clear message and nothing changes', /damaged|not a Learn backup/.test(await p.innerText('#bkMsg')) && await p.locator('#bkMerge').count() === 0);
    await pick('x.json', JSON.stringify({ app: 'other', d: { done: {} } })); await p.waitForTimeout(300); ok('restore: a backup from another app is rejected', /different app/.test(await p.innerText('#bkMsg')));
    const evil = '{"app":"learn","v":3,"at":"2026-01-02T00:00:00Z","ver":"4.1","d":{"done":{"js:7":1},"__proto__":{"polluted":1},"uni":{"lessons":{"c101:4":"2026-01-01"},"__proto__":{"x":1}},"days":["2026-01-01","not-a-date"],"spent":"lots","bonus":-5}}';
    await pick('evil.json', evil); await p.waitForTimeout(300); ok('restore: a preview shows what the backup contains before anything changes', /made on 2026-01-02/.test(await p.innerText('#bkPreview')) && /1 lesson in the language courses/.test(await p.innerText('#bkPreview')) && await UE(() => !JSON.parse(localStorage.getItem('learn-code-v2')).done['js:7']));
    await p.click('#bkMerge'); await p.waitForTimeout(600);
    const merged = await UE(() => { const S = JSON.parse(localStorage.getItem('learn-code-v2')); return { a: !!S.done['js:7'], b: !!S.done['py:0'], c: !!(S.uni.lessons || {})['c101:4'], pol: ({}).polluted === undefined && ({}).x === undefined, days: (S.days || []).every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), git: !!(S.uni.git || {}).files }; });
    ok('restore (merge): keeps this device\'s progress and adds the backup\'s', merged.a && merged.b && merged.c && merged.git, JSON.stringify(merged));
    ok('restore: the backup section stays open with a confirmation', await p.evaluate(() => document.getElementById('bkDetails').open) && /merged/.test(await p.innerText('#bkMsg')));
    ok('restore: prototype keys and invalid values in the file are ignored', merged.pol && merged.days);
    await pick('evil.json', evil); await p.waitForTimeout(300); await p.click('#bkReplace'); ok('restore (replace): needs a second press', /Press again/.test(await p.innerText('#bkReplace')));
    await p.click('#bkReplace'); await p.waitForTimeout(600); const rep = await UE(() => { const S = JSON.parse(localStorage.getItem('learn-code-v2')); return { keys: Object.keys(S.done), lb: S.lastBackup, git: !!((S.uni || {}).git || {}).files }; });
    ok('restore (replace): this device now matches the backup exactly (keeping the backup date and theme)', rep.keys.length === 1 && rep.keys[0] === 'js:7' && !!rep.lb && !rep.git, JSON.stringify(rep));
    await pick('good.json', bkText); await p.waitForTimeout(300); await p.click('#bkMerge'); await p.waitForTimeout(600);
    ok('restore: the earlier backup file brings everything back', await UE(() => { const S = JSON.parse(localStorage.getItem('learn-code-v2')); return !!S.done['py:4'] && !!S.uni.git.files && !!S.done['js:7']; }));
    await p.evaluate(() => { document.getElementById('bkDetails').open = true; document.querySelector('#bkDetails details').open = true; }); await p.click('#bkCopy'); await p.waitForTimeout(200);
    const bcode = await p.inputValue('#bkBox'); await p.fill('#bkBox', bcode); await p.click('#bkRestore'); await p.waitForTimeout(200);
    ok('backup code: copying and checking a code shows the same preview', bcode.length > 50 && await p.locator('#bkMerge').count() === 1);
    await p.click('#bkCancel'); await p.fill('#bkBox', 'abc!!'); await p.click('#bkRestore'); ok('backup code: an invalid code is rejected', /not a Learn backup/.test(await p.innerText('#bkMsg')));

    /* ---------- 7. extended electives ---------- */
    await go('#/uni', 400); await p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready, null, { timeout: 20000 });
    const ext = await UE(async () => { const U = window.LearnUniversity; const out = {}; for (const id of ['ma101', 'ma102', 'nm101', 'hc101', 'gd102', 'gd103', 'ce102', 'ce103', 'mb102', 'mb103']) { const d = await U.loadCourse(id); out[id] = [U.courseById(id).n, d.lessons.length, d.exam.items.length]; } return out; });
    ok('all ten department electives now have 6 lessons and 8+ exam items', Object.values(ext).every((x) => x[0] === 6 && x[1] === 6 && x[2] >= 8), JSON.stringify(ext));
    ok('electives still never count toward the 52 core courses', await UE(() => window.LearnUniversity.cat.courses.length === 52 && window.LearnUniversity.cat.courses.every((c) => !c.elective)));
    ok('12 interview coding exercises', await UE(() => window.UNI_DEPTS.coding.length === 12));
    await go('#/uni/videos/karpathy-build-gpt'); ok('video pages state when the video ID was last matched, without claiming playback', /last matched against public listings on 2026-11-13; that check does not prove the video still plays/.test(await text()));

    /* ---------- 7b. personal lesson notes (4.2) ---------- */
    await UE(() => { window.LearnUniversity.st().lessons['c101:0'] = '2026-11-01'; window.LearnUniversity.save(); });
    await go('#/uni/course/c101/lesson/1', 1400); ok('lessons have a My notes box', await p.locator('#uNote').count() === 1);
    await p.fill('#uNote', 'Binary uses base 2. <img src=x onerror=alert(1)> remember 1010 = ten'); await p.waitForTimeout(1000);
    ok('notes save automatically with the date', await UE(() => { const n = window.LearnUniversity.st().notes['c101:1']; return !!n && /base 2/.test(n.t) && /^\d{4}-\d{2}-\d{2}$/.test(n.at); }) && /Saved/.test(await p.innerText('#uNoteMsg')));
    await go('#/uni/course/c101/lesson/0', 1400); await p.fill('#uNote', 'Algorithms are recipes'); await p.waitForTimeout(1000);
    await go('#/uni/course/c101/lesson/1', 1400); ok('a note is shown again when the lesson is reopened', /base 2/.test(await p.inputValue('#uNote')));
    await go('#/uni/notes', 1200); ok('My notes lists every note in course order', await p.locator('.u-noteitem').count() === 2 && /Lesson 1\b/.test(await p.locator('.u-noteitem').first().innerText()));
    ok('note text is escaped on the notes page', !(await p.innerHTML('#ntList')).includes('<img src=x') && /&lt;img/.test(await p.innerHTML('#ntList')));
    await p.fill('#ntQ', 'RECIPES'); await p.waitForTimeout(200); ok('search filters notes, ignores case and highlights the match', await p.locator('.u-noteitem').count() === 1 && await p.locator('.u-noteitem mark').count() === 1 && /1 of 2/.test(await p.innerText('#ntCount')));
    await p.fill('#ntQ', '<img'); await p.waitForTimeout(200); ok('searching for markup still finds the note and never injects it', await p.locator('.u-noteitem').count() === 1 && !(await p.innerHTML('#ntList')).includes('<img src=x'));
    const [nd] = await Promise.all([p.waitForEvent('download'), p.click('#ntDown')]); const ntxt = fs.readFileSync(await nd.path(), 'utf8'); ok('all notes download as a text file', /SEU 101/.test(ntxt) && /Algorithms are recipes/.test(ntxt));
    await go('#/uni/course/c101/lesson/0', 1400); await p.fill('#uNote', ''); await p.waitForTimeout(1000); ok('clearing the box deletes the note', await UE(() => !window.LearnUniversity.st().notes['c101:0']));
    await go('#/uni/study', 1000); ok('My study links to My notes', await p.locator('a[href="#/uni/notes"]').count() >= 1);
    ok('notes are not included in the portfolio', await (async () => { await go('#/uni/portfolio', 900); return !/base 2/.test(await p.innerText('#pfPage')); })());
    ok('malformed notes from a backup are dropped', await UE(() => { const u = window.LearnUniversity.st(); u.notes['bad key'] = { t: 'x' }; u.notes['c101:3'] = { t: 5 }; u.notes['c101:4'] = { t: 'ok', at: 'x' }; const v = window.LearnUniversity.st(); return !v.notes['bad key'] && !v.notes['c101:3'] && v.notes['c101:4'].at === ''; }));

    /* ---------- 8. contrast of theme colours (WCAG AA 4.5:1 for text) ---------- */
    const PAIRS = [['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface2'], ['accent', 'surface'], ['accent', 'bg'], ['accent-ink', 'accent'], ['good', 'surface'], ['good', 'good-bg'], ['bad', 'surface'], ['bad', 'bad-bg'], ['out-text', 'out-bg'], ['t-kw', 'code-bg'], ['t-str', 'code-bg'], ['t-num', 'code-bg'], ['t-com', 'code-bg'], ['t-fn', 'code-bg'], ['t-pp', 'code-bg'], ['beg', 'surface'], ['mid', 'surface'], ['prc', 'surface'], ['bug', 'surface'], ['prj', 'surface']];
    const low = []; for (const th of ['light', 'dark']) { const r = await UE(([th, PAIRS]) => { document.documentElement.setAttribute('data-theme', th); const cs = getComputedStyle(document.documentElement); const pr = document.createElement('i'); document.body.appendChild(pr); const rgb = (v) => { pr.style.color = v; return getComputedStyle(pr).color.match(/[\d.]+/g).slice(0, 3).map(Number); }; const L = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }; const out = []; PAIRS.forEach(([a, z]) => { const x = L(rgb(cs.getPropertyValue('--' + a).trim())), y = L(rgb(cs.getPropertyValue('--' + z).trim())); const cr = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); if (cr < 4.5) out.push(th + ' ' + a + '/' + z + ' ' + cr.toFixed(2)); }); pr.remove(); return out; }, [th, PAIRS]); low.push(...r); }
    ok('contrast: all ' + PAIRS.length + ' text colour pairs reach 4.5:1 in light and dark themes', low.length === 0, low.join(', '));
    const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'); const L2 = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }; const CR = (a, z) => { const x = L2(a), y = L2(z); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const acc = Array.from(src.matchAll(/kind: 'accent', name: ["']([^"']+)["'][^}]*?l: '(#[0-9a-f]{6})', d: '(#[0-9a-f]{6})'/g)); const accLow = acc.filter((m) => Math.min(CR(m[2], '#eef2f9'), CR('#ffffff', m[2]), CR(m[3], '#161c35'), CR('#0d1224', m[3])) < 4.5).map((m) => m[1]);
    ok('contrast: all ' + acc.length + ' unlockable accent colours reach 4.5:1 as text and as button backgrounds', acc.length >= 20 && accLow.length === 0, accLow.join(', '));
    /* ---------- 9. University search (4.5) ---------- */
    await p.goto(BASE + '#/uni/search'); await p.waitForSelector('#srQ', { timeout: 15000 });
    ok('search: the page opens with an empty box and a hint', /All words must appear/.test(await text()));
    await p.fill('#srQ', 'hash table'); await p.click('#srF button[type=submit]'); await p.waitForSelector('.sr-item', { timeout: 20000 });
    const first = await UE(() => document.querySelector('.sr-item').innerText);
    ok('search: "hash table" finds the Hash tables lesson first', /Hash tables/.test(first) && /lesson/.test(first), first.slice(0, 120));
    ok('search: matching words are highlighted', await UE(() => document.querySelectorAll('.sr-item mark').length > 0));
    ok('search: the address keeps the query', /#\/uni\/search\/hash-table$/.test(await UE(() => location.hash)));
    ok('search: every lesson is indexed (345)', await UE(() => { let n = 0; Object.values(window.LearnUniversity.content).forEach((c) => { n += c.lessons.length; }); return n; }) === 345);
    await UE(() => document.querySelector('.sr-item a').click()); await p.waitForTimeout(1200);
    ok('search: a result opens its lesson', /#\/uni\/course\/c202\/lesson\/2$/.test(await UE(() => location.hash)), await UE(() => location.hash));
    await p.goto(BASE + '#/uni/search/qqqzzzx'); await p.waitForTimeout(1500); ok('search: no results gives advice', /Nothing found/.test(await text()));
    await p.goto(BASE + '#/uni/search/<script>'); await p.waitForTimeout(800); ok('search: unsafe text in the address is ignored', await UE(() => !document.querySelector('#app script')));
    ok('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  } catch (e) { ok('test run crashed', false, e.stack); }
  console.log(fail + ' failed of ' + (pass + fail) + ' (simulator unit checks in Node; browser checks on a local server with external hosts blocked)'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
