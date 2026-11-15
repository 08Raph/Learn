/* ============================================================
   Learn: Git and terminal simulator (no real shell, no network)
   A small in-memory file system with a Unix-style shell and a teaching model of Git.
   It is deliberately simplified and says so: one repository at a time, whole-file merges,
   no remotes, no stash, no rebase. Everything here runs on the student's device.
   Usage:  const sim = GitSim.create(); sim.exec('mkdir demo && cd demo'); -> { out: [...], err }
   Works in the browser (window.GitSim) and in Node (module.exports) so it can be unit-tested.
   ============================================================ */
(function (root) {
  'use strict';
  const HOME = '/home/student';
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } let h2 = 5381; for (let i = 0; i < s.length; i++) { h2 = (Math.imul(h2, 33) ^ s.charCodeAt(i)) >>> 0; } return ((h >>> 0).toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 10); };
  const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); };

  function create() {
    const st = { cwd: HOME, dirs: new Set(['/', '/home', HOME]), files: Object.create(null), repo: null, hist: [], clock: 0, editReq: null };

    /* ---------- paths ---------- */
    function norm(p, base) {
      if (p === undefined || p === '') return base || st.cwd;
      if (p === '~' || p.startsWith('~/')) p = HOME + p.slice(1);
      const parts = (p.startsWith('/') ? p : (base || st.cwd) + '/' + p).split('/'); const out = [];
      parts.forEach((x) => { if (!x || x === '.') return; if (x === '..') out.pop(); else out.push(x); });
      return '/' + out.join('/');
    }
    const parent = (p) => (p === '/' ? '/' : p.slice(0, p.lastIndexOf('/')) || '/');
    const base = (p) => p.slice(p.lastIndexOf('/') + 1);
    const isDir = (p) => st.dirs.has(p);
    const isFile = (p) => Object.prototype.hasOwnProperty.call(st.files, p);
    const pretty = (p) => (p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p);
    const children = (d) => { const pre = d === '/' ? '/' : d + '/'; const set = new Set(); st.dirs.forEach((x) => { if (x !== d && x.startsWith(pre) && !x.slice(pre.length).includes('/')) set.add(x.slice(pre.length) + '/'); }); Object.keys(st.files).forEach((x) => { if (x.startsWith(pre) && !x.slice(pre.length).includes('/')) set.add(x.slice(pre.length)); }); return Array.from(set).sort(); };
    const under = (d) => { const pre = d === '/' ? '/' : d + '/'; return Object.keys(st.files).filter((x) => x.startsWith(pre)); };
    function mkdirp(p) { const parts = p.split('/').filter(Boolean); let cur = ''; parts.forEach((x) => { cur += '/' + x; st.dirs.add(cur); }); }
    function write(p, text) { p = norm(p); mkdirp(parent(p)); st.files[p] = String(text); }
    const read = (p) => (isFile(norm(p)) ? st.files[norm(p)] : undefined);

    /* ---------- git model ---------- */
    const R = () => st.repo;
    const inRepo = (p) => !!st.repo && (p === st.repo.root || p.startsWith(st.repo.root + '/'));
    const rel = (p) => p.slice(st.repo.root.length + 1);
    const absOf = (r) => st.repo.root + '/' + r;
    function work() { const t = {}; under(st.repo.root).forEach((p) => { const r = rel(p); if (r === '.git' || r.startsWith('.git/')) return; t[r] = st.files[p]; }); return t; }
    function ignoreRules() { const g = st.files[absOf('.gitignore')]; return g ? g.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []; }
    function ignored(r) { const rules = ignoreRules(); const parts = r.split('/'); return rules.some((rule) => { let x = rule.replace(/^\//, ''); if (x.endsWith('/')) { x = x.slice(0, -1); return parts.slice(0, -1).includes(x) || r.startsWith(x + '/'); } const re = new RegExp('^' + x.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$'); return re.test(r) || re.test(parts[parts.length - 1]); }); }
    const headId = () => (R().head ? R().branches[R().head] : R().detached) || null;
    const treeOf = (id) => (id ? R().commits[id].tree : {});
    const headTree = () => treeOf(headId());
    function ancestors(id) { const seen = new Set(), q = id ? [id] : []; while (q.length) { const x = q.shift(); if (seen.has(x)) continue; seen.add(x); R().commits[x].parents.forEach((p) => q.push(p)); } return seen; }
    function mergeBase(a, b) { const A = ancestors(a); const q = [b], seen = new Set(); let best = null; while (q.length) { const x = q.shift(); if (seen.has(x)) continue; seen.add(x); if (A.has(x)) { if (!best || R().commits[x].seq > R().commits[best].seq) best = x; continue; } R().commits[x].parents.forEach((p) => q.push(p)); } return best; }
    function short(id) { return id ? id.slice(0, 7) : ''; }
    function resolveRev(s) { if (!s) return null; if (R().branches[s] !== undefined) return R().branches[s]; if (s === 'HEAD') return headId(); const m = /^HEAD~(\d+)$/.exec(s); if (m) { let id = headId(); for (let i = 0; i < +m[1] && id; i++) id = R().commits[id].parents[0] || null; return id; } const ids = Object.keys(R().commits).filter((id) => s.length >= 4 && id.startsWith(s)); return ids.length === 1 ? ids[0] : null; }
    function makeCommit(msg, parents) { const r = R(); r.seq++; const tree = Object.assign({}, r.index); const id = hash(JSON.stringify([msg, parents, tree, r.seq])); r.commits[id] = { id, msg, parents, tree, seq: r.seq, t: 1700000000000 + r.seq * 60000 }; if (r.head) r.branches[r.head] = id; else r.detached = id; return id; }
    function diffLines(a, b) { // LCS line diff; files in the simulator are small
      const x = a === undefined ? [] : a.replace(/\n$/, '').split('\n'), y = b === undefined ? [] : b.replace(/\n$/, '').split('\n'); const n = x.length, m = y.length;
      if (n * m > 250000) return x.map((l) => '-' + l).concat(y.map((l) => '+' + l));
      const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      const out = []; let i = 0, j = 0; while (i < n && j < m) { if (x[i] === y[j]) { out.push(' ' + x[i]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push('-' + x[i++]); else out.push('+' + y[j++]); }
      while (i < n) out.push('-' + x[i++]); while (j < m) out.push('+' + y[j++]); return out;
    }
    function status() { // { staged: [[kind, path]], unstaged: [[kind, path]], untracked: [], unmerged: [] }
      const H = headTree(), I = R().index, W = work(); const s = { staged: [], unstaged: [], untracked: [], unmerged: (R().merge ? R().merge.conflicts.slice() : []) };
      Array.from(new Set(Object.keys(H).concat(Object.keys(I)))).sort().forEach((p) => { if (s.unmerged.includes(p)) return; if (H[p] === undefined) s.staged.push(['new file', p]); else if (I[p] === undefined) s.staged.push(['deleted', p]); else if (H[p] !== I[p]) s.staged.push(['modified', p]); });
      Object.keys(I).sort().forEach((p) => { if (s.unmerged.includes(p)) return; if (W[p] === undefined) s.unstaged.push(['deleted', p]); else if (W[p] !== I[p]) s.unstaged.push(['modified', p]); });
      Object.keys(W).sort().forEach((p) => { if (I[p] === undefined && !s.unmerged.includes(p) && !ignored(p)) s.untracked.push(p); });
      return s;
    }
    const clean = () => { const s = status(); return !s.staged.length && !s.unstaged.length && !s.untracked.length && !s.unmerged.length; };
    function localChanges() { const H = headTree(), I = R().index, W = work(); const set = new Set(); Object.keys(Object.assign({}, H, I)).forEach((p) => { if (H[p] !== I[p] || (I[p] !== undefined && W[p] !== I[p])) set.add(p); }); return set; }
    function setTree(T, keep) { // make index and working tree match T, leaving paths in `keep` alone
      const H = headTree(); Object.keys(Object.assign({}, H, T)).forEach((p) => { if (keep && keep.has(p)) return; if (T[p] === undefined) { delete R().index[p]; delete st.files[absOf(p)]; } else { R().index[p] = T[p]; write(absOf(p), T[p]); } });
    }

    /* ---------- tokenising ---------- */
    function tokenize(line) {
      const out = []; let cur = '', q = null, has = false;
      for (let i = 0; i < line.length; i++) { const c = line[i];
        if (q) { if (c === q) { q = null; } else if (c === '\\' && q === '"' && (line[i + 1] === '"' || line[i + 1] === '\\')) { cur += line[++i]; } else cur += c; continue; }
        if (c === '"' || c === "'") { q = c; has = true; continue; }
        if (c === '\\' && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
        if (c === ' ' || c === '\t') { if (cur || has) { out.push(cur); cur = ''; has = false; } continue; }
        if (c === '|' || c === ';' || c === '>' || (c === '&' && line[i + 1] === '&')) { if (cur || has) { out.push(cur); cur = ''; has = false; } if (c === '&') { out.push({ op: '&&' }); i++; } else if (c === '>' && line[i + 1] === '>') { out.push({ op: '>>' }); i++; } else out.push({ op: c }); continue; }
        cur += c; has = true; }
      if (q) throw new Error('unclosed quote');
      if (cur || has) out.push(cur); return out;
    }

    /* ---------- commands ---------- */
    const E = (msg) => { const e = new Error(msg); e.sim = true; throw e; };
    const C = {};
    C.help = () => ['Shell: pwd  ls [-a] [path]  cd [path]  mkdir [-p] dir  touch file  cat file  echo text  rm [-r] path  rmdir dir',
      '       mv from to  cp from to  head [-n N] file  wc -l file  grep [-c] [-i] text file  sort  clear  history  edit file',
      '       command > file  (write output)   command >> file  (append)   a | b  (pipe)   a && b  (run b only if a worked)',
      'Git:   git init  status  add <path|.>  commit -m "message"  log [--oneline]  diff [--staged]  branch [-d] [name]',
      '       switch [-c] name  checkout [-b] name  merge name  merge --abort  restore [--staged] file  rm file  show [rev]',
      'This is a teaching simulator: no network, no remotes, one repository at a time, and merges compare whole files.'];
    C.pwd = () => [st.cwd];
    C.whoami = () => ['student'];
    C.date = () => [new Date().toString()];
    C.clear = () => { st.clearReq = true; return []; };
    C.history = () => st.hist.map((h, i) => String(i + 1).padStart(4) + '  ' + h);
    C.ls = (a) => { const all = a.includes('-a') || a.includes('-la') || a.includes('-al'); const paths = a.filter((x) => !x.startsWith('-')); const one = (p) => { const n = norm(p); if (isFile(n)) return [base(n)]; if (!isDir(n)) E("ls: cannot access '" + p + "': No such file or directory"); const c = children(n).filter((x) => all || !x.startsWith('.')); return all ? ['./', '../'].concat(c) : c; };
      if (paths.length <= 1) return [one(paths[0]).join('  ')].filter((l) => l); return paths.reduce((o, p) => o.concat([p + ':', one(p).join('  '), '']), []); };
    C.cd = (a) => { const t = norm(a[0] || '~'); if (isFile(t)) E('cd: ' + a[0] + ': Not a directory'); if (!isDir(t)) E('cd: ' + a[0] + ': No such file or directory'); st.cwd = t; return []; };
    C.mkdir = (a) => { const p = a.includes('-p'); a.filter((x) => x !== '-p').forEach((d) => { const n = norm(d); if (isDir(n) || isFile(n)) { if (!p) E("mkdir: cannot create directory '" + d + "': File exists"); return; } if (!isDir(parent(n)) && !p) E("mkdir: cannot create directory '" + d + "': No such file or directory"); mkdirp(n); }); return []; };
    C.touch = (a) => { if (!a.length) E('touch: missing file operand'); a.forEach((f) => { const n = norm(f); if (isDir(n)) return; if (!isDir(parent(n))) E("touch: cannot touch '" + f + "': No such file or directory"); if (!isFile(n)) st.files[n] = ''; }); return []; };
    const fileText = (f, cmd) => { const n = norm(f); if (isDir(n)) E(cmd + ': ' + f + ': Is a directory'); if (!isFile(n)) E(cmd + ': ' + f + ': No such file or directory'); return st.files[n]; };
    const lines = (t) => (t === '' ? [] : t.replace(/\n$/, '').split('\n'));
    C.cat = (a, inp) => (a.length ? a.reduce((o, f) => o.concat(lines(fileText(f, 'cat'))), []) : inp || []);
    C.echo = (a) => [a.filter((x, i) => !(i === 0 && x === '-e')).join(' ').replace(/\\n/g, a[0] === '-e' ? '\n' : '\\n')];
    C.head = (a, inp) => { let n = 10; const i = a.indexOf('-n'); if (i >= 0) { n = parseInt(a[i + 1], 10); a = a.filter((_, k) => k !== i && k !== i + 1); } if (!(n >= 0)) E('head: invalid number of lines'); return (a.length ? lines(fileText(a[0], 'head')) : inp || []).slice(0, n); };
    C.wc = (a, inp) => { const fs = a.filter((x) => !x.startsWith('-')); const L = fs.length ? lines(fileText(fs[0], 'wc')) : inp || []; return [String(L.length) + (fs.length ? ' ' + fs[0] : '')]; };
    C.sort = (a, inp) => { const L = (a.filter((x) => !x.startsWith('-')).length ? lines(fileText(a.filter((x) => !x.startsWith('-'))[0], 'sort')) : inp || []).slice().sort(); return a.includes('-r') ? L.reverse() : L; };
    C.grep = (a, inp) => { const c = a.includes('-c'), ci = a.includes('-i'), v = a.includes('-v'); const rest = a.filter((x) => !/^-[civ]+$/.test(x)); if (!rest.length) E('usage: grep [-c] [-i] [-v] text [file]'); const pat = ci ? rest[0].toLowerCase() : rest[0];
      const L = rest[1] ? lines(fileText(rest[1], 'grep')) : inp || []; const m = L.filter((l) => (ci ? l.toLowerCase() : l).includes(pat) !== v); if (!m.length && !c) { const e = new Error(''); e.sim = true; e.silent = true; throw e; } return c ? [String(m.length)] : m; };
    C.rm = (a) => { const r = a.some((x) => /^-[rf]*r[rf]*$/.test(x)), f = a.some((x) => /^-[rf]*f[rf]*$/.test(x)); const paths = a.filter((x) => !x.startsWith('-')); if (!paths.length) E('rm: missing operand');
      paths.forEach((p) => { const n = norm(p); if (isDir(n)) { if (!r) E("rm: cannot remove '" + p + "': Is a directory"); if (n === '/' || n === HOME || st.cwd === n || st.cwd.startsWith(n + '/')) E("rm: refusing to remove '" + p + "' (it contains your current folder or is a protected folder)"); under(n).forEach((x) => delete st.files[x]); Array.from(st.dirs).forEach((d) => { if (d === n || d.startsWith(n + '/')) st.dirs.delete(d); }); if (st.repo && (st.repo.root === n || st.repo.root.startsWith(n + '/'))) st.repo = null; return; } if (!isFile(n)) { if (!f) E("rm: cannot remove '" + p + "': No such file or directory"); return; } delete st.files[n]; }); return []; };
    C.rmdir = (a) => { a.forEach((p) => { const n = norm(p); if (!isDir(n)) E("rmdir: failed to remove '" + p + "': No such file or directory"); if (children(n).length) E("rmdir: failed to remove '" + p + "': Directory not empty"); if (st.cwd === n) E("rmdir: failed to remove '" + p + "': it is your current folder"); st.dirs.delete(n); }); return []; };
    function copyOrMove(a, move) { const cmd = move ? 'mv' : 'cp'; const rec = a.includes('-r') || a.includes('-R'); const p = a.filter((x) => !x.startsWith('-')); if (p.length !== 2) E(cmd + ': expected a source and a destination'); const s = norm(p[0]); let d = norm(p[1]);
      if (isDir(d)) d = d + '/' + base(s); if (s === d) E(cmd + ": '" + p[0] + "' and '" + p[1] + "' are the same file");
      if (isFile(s)) { if (!isDir(parent(d))) E(cmd + ": cannot create '" + p[1] + "': No such file or directory"); st.files[d] = st.files[s]; if (move) delete st.files[s]; return []; }
      if (isDir(s)) { if (!move && !rec) E("cp: -r not specified; omitting directory '" + p[0] + "'"); if (d.startsWith(s + '/')) E(cmd + ': cannot copy a folder into itself'); if (st.cwd === s || st.cwd.startsWith(s + '/')) { if (move) E('mv: cannot move the folder you are in; cd out of it first'); }
        mkdirp(d); Array.from(st.dirs).forEach((x) => { if (x.startsWith(s + '/')) mkdirp(d + x.slice(s.length)); }); under(s).forEach((x) => { st.files[d + x.slice(s.length)] = st.files[x]; });
        if (move) { under(s).forEach((x) => delete st.files[x]); Array.from(st.dirs).forEach((x) => { if (x === s || x.startsWith(s + '/')) st.dirs.delete(x); }); if (st.repo && st.repo.root === s) st.repo.root = d; } return []; }
      E(cmd + ": cannot stat '" + p[0] + "': No such file or directory"); }
    C.mv = (a) => copyOrMove(a, true); C.cp = (a) => copyOrMove(a, false);
    C.edit = (a) => { if (!a[0]) E('edit: name the file to edit, for example: edit notes.txt'); const n = norm(a[0]); if (isDir(n)) E('edit: ' + a[0] + ' is a directory'); if (!isDir(parent(n))) E('edit: ' + a[0] + ': No such directory'); st.editReq = { path: n, text: isFile(n) ? st.files[n] : '' }; return ['Opening ' + pretty(n) + ' in the editor below.']; };
    C.nano = C.vim = C.vi = C.code = C.edit;

    /* ---------- git ---------- */
    const needRepo = () => { if (!st.repo || !inRepo(st.cwd)) E('fatal: not a git repository (or any of the parent directories): .git'); };
    const needCommit = () => { if (!headId()) E("fatal: your current branch '" + R().head + "' does not have any commits yet"); };
    const G = {};
    G.init = () => { if (st.repo && inRepo(st.cwd)) return ['Reinitialized existing Git repository in ' + st.repo.root + '/.git/']; if (st.repo) E('This simulator holds one repository at a time. It already has one at ' + pretty(st.repo.root) + '. Remove it first (rm -r) or work inside it.'); st.repo = { root: st.cwd, commits: {}, branches: { main: null }, head: 'main', detached: null, index: {}, merge: null, seq: 0 }; mkdirp(st.cwd + '/.git'); return ['Initialized empty Git repository in ' + st.cwd + '/.git/']; };
    G.status = () => { needRepo(); const s = status(); const o = [R().head ? 'On branch ' + R().head : 'HEAD detached at ' + short(headId())]; if (!headId()) o.push('', 'No commits yet');
      if (R().merge) o.push('', s.unmerged.length ? 'You have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)' : 'All conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)');
      if (s.staged.length) o.push('', 'Changes to be committed:', '  (use "git restore --staged <file>..." to unstage)', ...s.staged.map((x) => '\t' + (x[0] + ':').padEnd(12) + x[1]));
      if (s.unmerged.length) o.push('', 'Unmerged paths:', '  (use "git add <file>..." to mark resolution)', ...s.unmerged.map((x) => '\tboth modified:   ' + x));
      if (s.unstaged.length) o.push('', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '  (use "git restore <file>..." to discard changes in working directory)', ...s.unstaged.map((x) => '\t' + (x[0] + ':').padEnd(12) + x[1]));
      if (s.untracked.length) o.push('', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)', ...s.untracked.map((x) => '\t' + x));
      if (!s.staged.length && !s.unstaged.length && !s.untracked.length && !s.unmerged.length) o.push(R().merge ? '' : headId() ? 'nothing to commit, working tree clean' : 'nothing to commit (create/copy files and use "git add" to track)');
      else if (!s.staged.length && !R().merge) o.push('', s.unstaged.length ? 'no changes added to commit (use "git add" and/or "git commit -a")' : 'nothing added to commit but untracked files present (use "git add" to track)');
      return o.join('\n').split('\n'); };
    G.add = (a) => { needRepo(); const force = a.includes('-f'); const args = a.filter((x) => !x.startsWith('-') || x === '-A'); if (!args.length) E('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?'); const W = work(), I = R().index; const out = [];
      args.forEach((arg) => { const all = arg === '-A' || arg === '--all'; const n = all ? R().root : norm(arg); if (!inRepo(n) && n !== R().root) E("fatal: '" + arg + "' is outside repository at '" + R().root + "'");
        const r = n === R().root ? '' : rel(n); const pre = r ? r + '/' : ''; const inside = (p) => !r || p === r || p.startsWith(pre);
        const cand = Array.from(new Set(Object.keys(W).concat(Object.keys(I)))).filter(inside);
        if (!cand.length) E("fatal: pathspec '" + arg + "' did not match any files");
        if (cand.length === 1 && cand[0] === r && W[r] !== undefined && I[r] === undefined && ignored(r) && !force) E('The following paths are ignored by one of your .gitignore files:\n' + r + '\nhint: Use -f if you really want to add them.');
        cand.forEach((p) => { if (W[p] === undefined) { delete I[p]; } else if (I[p] !== undefined || force || !ignored(p)) { I[p] = W[p]; } if (R().merge) R().merge.conflicts = R().merge.conflicts.filter((x) => x !== p); }); });
      return out; };
    G.commit = (a) => { needRepo(); let msg = null; const am = a.includes('-am') || a.includes('-a'); const mi = a.findIndex((x) => x === '-m' || x === '-am'); if (mi >= 0) msg = a[mi + 1]; if (am) { const W = work(); Object.keys(R().index).forEach((p) => { if (W[p] === undefined) delete R().index[p]; else R().index[p] = W[p]; }); }
      if (R().merge && R().merge.conflicts.length) E('error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use \'git add <file>\'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.');
      if (msg === null && R().merge) msg = "Merge branch '" + R().merge.name + "'"; if (msg === null || msg === undefined) E('Please give a commit message with -m, for example: git commit -m "Add login page"\n(This simulator has no text editor for commit messages.)'); if (!String(msg).trim()) E('Aborting commit due to empty commit message.');
      if (!R().merge && same(R().index, headTree())) { const s = status(); E(s.unstaged.length || s.untracked.length ? 'On branch ' + R().head + '\nno changes added to commit (use "git add" and/or "git commit -a")' : 'On branch ' + R().head + '\nnothing to commit, working tree clean'); }
      const H = headTree(), I = R().index; const changed = Object.keys(Object.assign({}, H, I)).filter((p) => H[p] !== I[p]).length; const root = !headId();
      const parents = headId() ? [headId()] : []; if (R().merge) parents.push(R().merge.theirs); const id = makeCommit(String(msg), parents); R().merge = null;
      return ['[' + (R().head || 'detached HEAD') + (root ? ' (root-commit)' : '') + ' ' + short(id) + '] ' + msg, ' ' + changed + ' file' + (changed === 1 ? '' : 's') + ' changed']; };
    function logList(fromId) { return Array.from(ancestors(fromId)).map((id) => R().commits[id]).sort((x, y) => y.seq - x.seq); }
    const decor = (id) => { const names = Object.keys(R().branches).filter((b) => R().branches[b] === id); const h = headId() === id && R().head ? ['HEAD -> ' + R().head].concat(names.filter((b) => b !== R().head)) : names; return h.length ? ' (' + h.join(', ') + ')' : ''; };
    G.log = (a) => { needRepo(); needCommit(); const one = a.includes('--oneline'); const ni = a.findIndex((x) => /^-\d+$/.test(x) || x === '-n'); let lim = Infinity; if (ni >= 0) lim = a[ni] === '-n' ? +a[ni + 1] : +a[ni].slice(1); const rev = a.find((x) => !x.startsWith('-') && !/^\d+$/.test(x)); const from = rev ? resolveRev(rev) : headId(); if (!from) E("fatal: ambiguous argument '" + rev + "': unknown revision"); const L = logList(from).slice(0, lim);
      return one ? L.map((c) => short(c.id) + decor(c.id) + ' ' + c.msg) : L.reduce((o, c) => o.concat(['commit ' + c.id + decor(c.id)].concat(c.parents.length > 1 ? ['Merge: ' + c.parents.map(short).join(' ')] : []).concat(['Author: Student <student@example.com>', 'Date:   ' + new Date(c.t).toUTCString(), '', '    ' + c.msg, ''])), []); };
    G.show = (a) => { needRepo(); needCommit(); const id = resolveRev(a[0] || 'HEAD'); if (!id) E("fatal: ambiguous argument '" + a[0] + "': unknown revision"); const c = R().commits[id]; const P = c.parents[0] ? treeOf(c.parents[0]) : {}; const o = ['commit ' + c.id + decor(c.id), 'Author: Student <student@example.com>', '', '    ' + c.msg, ''];
      Object.keys(Object.assign({}, P, c.tree)).sort().forEach((p) => { if (P[p] !== c.tree[p]) o.push('diff --git a/' + p + ' b/' + p, ...diffLines(P[p], c.tree[p])); }); return o; };
    G.diff = (a) => { needRepo(); const staged = a.includes('--staged') || a.includes('--cached'); const H = headTree(), I = R().index, W = work(); const from = staged ? H : I, to = staged ? I : W; const only = a.filter((x) => !x.startsWith('-')).map((x) => rel(norm(x))); const o = [];
      Object.keys(Object.assign({}, from, staged ? to : {})).sort().forEach((p) => { if (only.length && !only.includes(p)) return; const b = to[p]; if (from[p] === b) return; o.push('diff --git a/' + p + ' b/' + p, '--- ' + (from[p] === undefined ? '/dev/null' : 'a/' + p), '+++ ' + (b === undefined ? '/dev/null' : 'b/' + p), ...diffLines(from[p], b)); }); return o; };
    G.branch = (a) => { needRepo(); const del = a.find((x) => x === '-d' || x === '-D'); const names = a.filter((x) => !x.startsWith('-'));
      if (del) { if (!names.length) E('fatal: branch name required'); return names.map((n) => { if (R().branches[n] === undefined) E("error: branch '" + n + "' not found."); if (n === R().head) E("error: Cannot delete branch '" + n + "' checked out at '" + R().root + "'"); const tip = R().branches[n]; if (del === '-d' && tip && !ancestors(headId()).has(tip)) E("error: The branch '" + n + "' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D " + n + "'."); delete R().branches[n]; return 'Deleted branch ' + n + ' (was ' + short(tip) + ').'; }); }
      if (!names.length) return Object.keys(R().branches).sort().filter((b) => R().branches[b] || b === R().head).map((b) => (b === R().head ? '* ' : '  ') + b);
      const n = names[0]; if (!/^[A-Za-z0-9._\/-]+$/.test(n) || n.endsWith('/') || n.includes('..')) E("fatal: '" + n + "' is not a valid branch name"); if (R().branches[n] !== undefined && (R().branches[n] || n === R().head)) E("fatal: a branch named '" + n + "' already exists"); needCommit(); const at = names[1] ? resolveRev(names[1]) : headId(); if (!at) E("fatal: not a valid object name: '" + names[1] + "'"); R().branches[n] = at; return []; };
    function switchTo(name, create) {
      if (R().merge) E('error: you need to resolve your current index first (finish the merge with git commit, or run git merge --abort)');
      if (create) { if (R().branches[name] !== undefined && R().branches[name]) E("fatal: a branch named '" + name + "' already exists"); if (!/^[A-Za-z0-9._\/-]+$/.test(name) || name.includes('..')) E("fatal: '" + name + "' is not a valid branch name"); if (!headId()) { delete R().branches[R().head]; R().branches[name] = null; R().head = name; return ["Switched to a new branch '" + name + "'"]; } R().branches[name] = headId(); R().head = name; return ["Switched to a new branch '" + name + "'"]; }
      if (R().branches[name] === undefined || (!R().branches[name] && name !== R().head)) E("error: pathspec '" + name + "' did not match any file(s) known to git");
      if (name === R().head) return ["Already on '" + name + "'"];
      const T = treeOf(R().branches[name]), H = headTree(), lc = localChanges(); const bad = Array.from(lc).filter((p) => H[p] !== T[p]);
      if (bad.length) E('error: Your local changes to the following files would be overwritten by checkout:\n' + bad.map((p) => '\t' + p).join('\n') + '\nPlease commit your changes or stash them before you switch branches.\nAborting');
      const W = work(); const ut = Object.keys(T).filter((p) => H[p] === undefined && R().index[p] === undefined && W[p] !== undefined && W[p] !== T[p]); if (ut.length) E('error: The following untracked working tree files would be overwritten by checkout:\n' + ut.map((p) => '\t' + p).join('\n') + '\nPlease move or remove them before you switch branches.\nAborting');
      setTree(T, lc); R().head = name; return ["Switched to branch '" + name + "'"].concat(lc.size ? Array.from(lc).map((p) => 'M\t' + p) : []);
    }
    G.switch = (a) => { needRepo(); const c = a.includes('-c') || a.includes('--create'); const n = a.filter((x) => !x.startsWith('-'))[0]; if (!n) E('fatal: missing branch name'); return switchTo(n, c); };
    G.checkout = (a) => { needRepo(); const dd = a.indexOf('--'); if (dd >= 0) return G.restore(a.slice(dd + 1)); const b = a.includes('-b'); const n = a.filter((x) => !x.startsWith('-'))[0]; if (!n) E('fatal: missing branch name'); if (!b && R().branches[n] === undefined && (R().index[rel(norm(n))] !== undefined)) return G.restore([n]); return switchTo(n, b); };
    G.restore = (a) => { needRepo(); const staged = a.includes('--staged') || a.includes('-S'); const ps = a.filter((x) => !x.startsWith('-')); if (!ps.length) E('fatal: you must specify path(s) to restore'); const H = headTree(), I = R().index;
      ps.forEach((p) => { const n = norm(p); const r = n === R().root ? '' : rel(n); const pre = r ? r + '/' : ''; const set = Array.from(new Set(Object.keys(staged ? Object.assign({}, H, I) : I).concat(staged ? [] : Object.keys(work()).filter((x) => I[x] !== undefined)))).filter((x) => !r || x === r || x.startsWith(pre)); if (!set.length) E("error: pathspec '" + p + "' did not match any file(s) known to git");
        set.forEach((x) => { if (staged) { if (H[x] === undefined) delete I[x]; else I[x] = H[x]; } else if (I[x] !== undefined) write(absOf(x), I[x]); }); }); return []; };
    G.rm = (a) => { needRepo(); const cached = a.includes('--cached'); const ps = a.filter((x) => !x.startsWith('-')); if (!ps.length) E('usage: git rm [--cached] <file>'); ps.forEach((p) => { const r = rel(norm(p)); if (R().index[r] === undefined) E("fatal: pathspec '" + p + "' did not match any files"); delete R().index[r]; if (!cached) delete st.files[absOf(r)]; }); return ps.map((p) => "rm '" + rel(norm(p)) + "'"); };
    G.merge = (a) => { needRepo(); if (a.includes('--abort')) { if (!R().merge) E('fatal: There is no merge to abort (MERGE_HEAD missing).'); const H = headTree(); R().index = Object.assign({}, H); Object.keys(work()).forEach((p) => { if (H[p] === undefined && R().merge.touched.includes(p)) delete st.files[absOf(p)]; }); Object.keys(H).forEach((p) => write(absOf(p), H[p])); R().merge = null; return []; }
      const name = a.filter((x) => !x.startsWith('-'))[0]; if (!name) E('fatal: no branch to merge was given'); needCommit(); if (R().merge) E('error: Merging is not possible because you have unmerged files.'); const theirs = resolveRev(name); if (!theirs) E('merge: ' + name + ' - not something we can merge');
      const ours = headId(); if (ancestors(ours).has(theirs)) return ['Already up to date.'];
      if (localChanges().size) E('error: Your local changes would be overwritten by merge.\nPlease commit your changes or stash them before you merge.\nAborting');
      if (ancestors(theirs).has(ours)) { const T = treeOf(theirs), H = headTree(); const ch = Object.keys(Object.assign({}, H, T)).filter((p) => H[p] !== T[p]); setTree(T); R().branches[R().head] = theirs; return ['Updating ' + short(ours) + '..' + short(theirs), 'Fast-forward'].concat(ch.map((p) => ' ' + p)).concat([' ' + ch.length + ' file' + (ch.length === 1 ? '' : 's') + ' changed']); }
      const B = treeOf(mergeBase(ours, theirs)), O = treeOf(ours), T = treeOf(theirs); const res = {}, conflicts = [], out = [];
      Object.keys(Object.assign({}, B, O, T)).sort().forEach((p) => { const b = B[p], o = O[p], t = T[p]; if (o === t) { if (o !== undefined) res[p] = o; return; } if (b === o) { if (t !== undefined) res[p] = t; return; } if (b === t) { if (o !== undefined) res[p] = o; return; }
        conflicts.push(p); out.push('Auto-merging ' + p, 'CONFLICT (content): Merge conflict in ' + p); const nl = (s) => (s === undefined ? '' : s.endsWith('\n') ? s : s + '\n'); res[p] = '<<<<<<< HEAD\n' + nl(o) + '=======\n' + nl(t) + '>>>>>>> ' + name + '\n'; });
      const H = headTree(); Object.keys(Object.assign({}, H, res)).forEach((p) => { if (res[p] === undefined) { delete R().index[p]; delete st.files[absOf(p)]; } else { write(absOf(p), res[p]); if (!conflicts.includes(p)) R().index[p] = res[p]; } });
      if (conflicts.length) { R().merge = { theirs, name, conflicts, touched: Object.keys(res) }; return out.concat(['Automatic merge failed; fix conflicts and then commit the result.']); }
      R().merge = { theirs, name, conflicts: [], touched: [] }; const id = makeCommit("Merge branch '" + name + "'", [ours, theirs]); R().merge = null; return ["Merge made by the 'ort' strategy.", '[' + R().head + ' ' + short(id) + "] Merge branch '" + name + "'"]; };
    G.help = () => C.help();
    C.git = (a) => { const sub = a[0]; if (!sub || sub === '--help' || sub === 'help') return C.help(); if (sub === '--version' || sub === 'version') return ['git version 2.x (Learn teaching simulator)']; if (!G[sub]) E("git: '" + sub + "' is not available in this simulator. Type help to see what is."); return G[sub](a.slice(1)); };

    /* ---------- running a line ---------- */
    function runPipeline(tokens) { // tokens without && ; returns lines
      const segs = [[]]; tokens.forEach((t) => { if (t && t.op === '|') segs.push([]); else segs[segs.length - 1].push(t); });
      let input = null;
      for (let si = 0; si < segs.length; si++) { let seg = segs[si]; let redir = null; const ri = seg.findIndex((t) => t && (t.op === '>' || t.op === '>>')); if (ri >= 0) { const f = seg[ri + 1]; if (typeof f !== 'string') E('syntax error: a file name is needed after ' + seg[ri].op); redir = { mode: seg[ri].op, file: f }; seg = seg.slice(0, ri).concat(seg.slice(ri + 2)); }
        if (seg.some((t) => typeof t !== 'string')) E('syntax error near unexpected token'); if (!seg.length) E('syntax error: empty command');
        const cmd = seg[0], args = seg.slice(1); if (!C[cmd]) E(cmd + ': command not found. Type help for the commands this simulator knows.');
        let out = C[cmd](args, input);
        if (redir) { const n = norm(redir.file); if (isDir(n)) E(redir.file + ': Is a directory'); if (!isDir(parent(n))) E(redir.file + ': No such file or directory'); const text = out.length ? out.join('\n') + '\n' : ''; st.files[n] = redir.mode === '>>' && isFile(n) ? st.files[n] + text : text; out = []; }
        input = out; }
      return input || [];
    }
    function exec(line) {
      line = String(line || ''); if (line.trim()) st.hist.push(line.trim()); if (st.hist.length > 500) st.hist.shift();
      let toks; try { toks = tokenize(line.trim()); } catch (e) { return { out: ['syntax error: ' + e.message], err: true }; }
      const chains = [[]]; const ops = []; toks.forEach((t) => { if (t && (t.op === '&&' || t.op === ';')) { chains.push([]); ops.push(t.op); } else chains[chains.length - 1].push(t); });
      let all = [], err = false;
      for (let i = 0; i < chains.length; i++) { if (!chains[i].length) continue; if (i > 0 && ops[i - 1] === '&&' && err) break; err = false;
        try { all = all.concat(runPipeline(chains[i])); } catch (e) { if (!e.sim) throw e; err = true; if (!e.silent) all = all.concat(String(e.message).split('\n')); } }
      return { out: all, err };
    }
    function complete(line) { // Tab completion for the last word (files and folders)
      const m = /(\S*)$/.exec(line); const w = m[1]; const dirPart = w.includes('/') ? w.slice(0, w.lastIndexOf('/') + 1) : ''; const pre = w.slice(dirPart.length); const d = norm(dirPart || '.');
      if (!isDir(d)) return { line, options: [] }; const opts = children(d).filter((x) => x.startsWith(pre) && (pre.startsWith('.') || !x.startsWith('.')));
      if (opts.length === 1) return { line: line.slice(0, line.length - w.length) + dirPart + opts[0], options: [] };
      let common = pre; if (opts.length) { common = opts.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); }); } return { line: line.slice(0, line.length - w.length) + dirPart + (common.length > pre.length ? common : pre), options: opts };
    }
    const api = {
      exec, complete, norm, write, read, isDir, isFile, pretty, HOME,
      prompt: () => 'student@learn:' + pretty(st.cwd) + (st.repo && inRepo(st.cwd) ? ' (' + (st.repo.head || 'detached') + (st.repo.merge ? '|MERGING' : '') + ')' : '') + '$',
      get cwd() { return st.cwd; }, get state() { return st },
      takeEdit: () => { const e = st.editReq; st.editReq = null; return e; }, takeClear: () => { const c = st.clearReq; st.clearReq = false; return !!c; },
      // read-only views used by graded tasks
      repo: () => (st.repo ? { root: st.repo.root, head: st.repo.head, branches: Object.assign({}, st.repo.branches), merging: !!st.repo.merge } : null),
      headTree: () => (st.repo ? Object.assign({}, headTree()) : {}), tree: (b) => (st.repo && st.repo.branches[b] ? Object.assign({}, treeOf(st.repo.branches[b])) : null),
      commit: (id) => (st.repo && st.repo.commits[id] ? st.repo.commits[id] : null), log: (b) => (st.repo ? logList(b ? st.repo.branches[b] : headId()) : []), headId: () => (st.repo ? headId() : null),
      index: () => (st.repo ? Object.assign({}, st.repo.index) : {}), clean: () => !!st.repo && clean(), status: () => (st.repo ? status() : null), isAncestor: (a, b) => !!st.repo && ancestors(b).has(a),
      everCommitted: (path) => !!st.repo && Object.values(st.repo.commits).some((c) => c.tree[path] !== undefined),
    };
    return api;
  }
  const GitSim = { create, HOME };
  if (typeof module !== 'undefined' && module.exports) module.exports = GitSim; else root.GitSim = GitSim;
})(typeof window !== 'undefined' ? window : this);
