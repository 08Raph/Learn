/* ============================================================
   Workspace: multi-file project panel + Package Explorer (vanilla JS)
   Layers:
     1. Store      pure state: files, dirs, tabs, active, entry, open, pkgs, track
     2. Bundlers   resolve imports across files (JS/TS ES modules, Python)
     3. Packages   mock npm / pip: registry, manifest editing, install state
     4. View       VS Code style sidebar (Files | Packages) + tabs + editor + terminal
   Depends on page globals: mountEditor, runCode, showOut, outHolder,
   stdinBox, RUNKEY, esc, $, $$  (all already in index.html).
   ============================================================ */
const Workspace = (() => {
  'use strict';

  /* ---------- 0. path helpers ---------- */
  const norm = (p) => { const o = []; for (const s of String(p).split('/')) { if (!s || s === '.') continue; if (s === '..') o.pop(); else o.push(s); } return '/' + o.join('/'); };
  const dirname = (p) => { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); };
  const basename = (p) => p.slice(p.lastIndexOf('/') + 1);
  const join = (a, b) => norm(a + '/' + b);
  const under = (p, root) => p === root || p.startsWith(root + '/');
  const extOf = (p) => { const b = basename(p), i = b.lastIndexOf('.'); return i < 1 ? '' : b.slice(i + 1).toLowerCase(); };
  const EXT_LANG = { js: 'js', mjs: 'js', ts: 'ts', py: 'py', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'cs', sql: 'sql' };
  const langOf = (p) => EXT_LANG[extOf(p)] || null;
  const ENTRY_GUESS = ['/src/index.js', '/src/main.js', '/index.js', '/main.js', '/src/main.py', '/main.py', '/src/index.ts', '/main.ts'];
  const trackOf = (st) => st.track || (st.entry && langOf(st.entry) === 'py' ? 'py' : 'js');

  /* ---------- 1. store ---------- */
  function createStore(seed, persist) {
    const st = { files: {}, dirs: [], tabs: [], active: null, entry: null, open: {}, pkgs: {}, track: null };
    const s0 = JSON.parse(JSON.stringify(seed || {}));
    Object.keys(st).forEach((k) => { if (s0[k] !== undefined) st[k] = s0[k]; });
    const subs = [];
    const emit = (quiet) => { if (persist) persist(JSON.parse(JSON.stringify(st))); if (!quiet) subs.forEach((f) => f(st)); };
    const isFile = (p) => Object.prototype.hasOwnProperty.call(st.files, p);
    const isDir = (p) => p === '/' || st.dirs.includes(p);
    const exists = (p) => isFile(p) || isDir(p);
    const ensureDirs = (p) => { let d = dirname(p); while (d !== '/') { if (!st.dirs.includes(d)) st.dirs.push(d); st.open[d] = st.open[d] !== false; d = dirname(d); } };
    const checkName = (name) => { if (!name || name === '.' || name === '..' || /[\/\\:*?"<>|]/.test(name)) throw new Error('Names cannot be empty or contain / \\ : * ? " < > |'); };
    const pickEntry = () => { if (st.entry && isFile(st.entry)) return; st.entry = ENTRY_GUESS.find(isFile) || null; };
    Object.keys(st.files).forEach(ensureDirs);
    pickEntry();
    if (!st.active || !isFile(st.active)) st.active = st.entry || Object.keys(st.files).sort()[0] || null;
    st.tabs = st.tabs.filter(isFile); if (st.active && !st.tabs.includes(st.active)) st.tabs.push(st.active);

    const api = {
      state: st, isFile, isDir, exists,
      subscribe(fn) { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); },
      touch() { emit(); },                       // state changed in place (used by package commands)
      ensureFile(path, content) { if (!isFile(path)) { st.files[path] = content; ensureDirs(path); emit(true); } },
      createFile(path, content) {
        path = norm(path); checkName(basename(path));
        if (exists(path)) throw new Error(basename(path) + ' already exists');
        if (isFile(dirname(path))) throw new Error('Parent is a file');
        st.files[path] = content || ''; ensureDirs(path); pickEntry(); api.open(path, true); emit();
      },
      createFolder(path) {
        path = norm(path); checkName(basename(path));
        if (exists(path)) throw new Error(basename(path) + ' already exists');
        st.dirs.push(path); ensureDirs(path); st.open[path] = true; emit();
      },
      rename(from, to) {
        from = norm(from); to = norm(to); checkName(basename(to));
        if (from === to) return;
        if (exists(to)) throw new Error(basename(to) + ' already exists');
        if (under(to, from)) throw new Error('Cannot move a folder into itself');
        const mv = (p) => (under(p, from) ? to + p.slice(from.length) : p);
        const fixed = rewriteImports(st.files, st.entry, from, to); // keep imports pointing at the moved file
        const files = {}; Object.keys(fixed).forEach((k) => { files[mv(k)] = fixed[k]; }); st.files = files;
        st.dirs = st.dirs.map(mv); const open = {}; Object.keys(st.open).forEach((k) => { open[mv(k)] = st.open[k]; }); st.open = open;
        st.tabs = st.tabs.map(mv); st.active = st.active && mv(st.active); st.entry = st.entry && mv(st.entry);
        ensureDirs(to); emit();
      },
      remove(path) {
        path = norm(path);
        Object.keys(st.files).forEach((k) => { if (under(k, path)) delete st.files[k]; });
        st.dirs = st.dirs.filter((d) => !under(d, path));
        const i = st.tabs.findIndex((t) => under(t, path));
        st.tabs = st.tabs.filter((t) => !under(t, path));
        if (st.active && under(st.active, path)) st.active = st.tabs[Math.min(Math.max(i, 0), st.tabs.length - 1)] || null;
        if (st.entry && under(st.entry, path)) st.entry = null;
        pickEntry(); emit();
      },
      setContent(path, text) { if (isFile(path)) { st.files[path] = text; emit(true); } }, // quiet: no re-render while typing
      open(path, quiet) { if (!isFile(path)) return; if (!st.tabs.includes(path)) st.tabs.push(path); st.active = path; let d = dirname(path); while (d !== '/') { st.open[d] = true; d = dirname(d); } if (!quiet) emit(); },
      closeTab(path) { const i = st.tabs.indexOf(path); if (i < 0) return; st.tabs.splice(i, 1); if (st.active === path) st.active = st.tabs[Math.min(i, st.tabs.length - 1)] || null; emit(); },
      toggleDir(path) { st.open[path] = st.open[path] === false; emit(); },
      collapseAll() { st.dirs.forEach((d) => { st.open[d] = false; }); emit(); },
      setEntry(path) { if (isFile(path)) { st.entry = path; emit(); } },
      tree() {
        const kids = (d) => {
          const dirs = st.dirs.filter((x) => dirname(x) === d).sort((a, b) => basename(a).localeCompare(basename(b)));
          const files = Object.keys(st.files).filter((x) => dirname(x) === d).sort((a, b) => basename(a).localeCompare(basename(b)));
          return dirs.map((x) => ({ type: 'dir', path: x, name: basename(x), children: kids(x) })).concat(files.map((x) => ({ type: 'file', path: x, name: basename(x) })));
        };
        return kids('/');
      },
    };
    return api;
  }

  /* ---------- 2a. JavaScript / TypeScript: ES modules -> CommonJS-style bundle ---------- */
  const JS_TRY = ['', '.js', '.mjs', '.ts', '/index.js', '/index.ts'];
  function resolveJs(spec, from, files) {
    const rel = /^\.{1,2}\/|^\//.test(spec);
    const base = !rel ? '/node_modules/' + spec : spec.startsWith('/') ? norm(spec) : join(dirname(from), spec); // bare name -> node_modules
    for (const e of JS_TRY) if (files[base + e] !== undefined) return base + e;
    return null;
  }
  function esmToCjs(src) {
    const deps = [], exp = [], imps = [];
    const spec = (s) => { deps.push(s); return JSON.stringify(s); };
    const imp = (s) => { spec(s); const o = { m: '__m' + imps.length, s, binds: [] }; imps.push(o); return o; };
    const names = (list) => list.split(',').map((s) => s.trim()).filter((s) => s && !/^type\s/.test(s)).map((s) => { const m = s.split(/\s+as\s+/); return [m[0].trim(), (m[1] || m[0]).trim()]; });
    let o = src;
    o = o.replace(/^[ \t]*import\s+type\s[^\n]*$/gm, '');
    o = o.replace(/^[ \t]*import\s+([\w$]+)\s*,\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\3;?/gm, (m, d, n, q, s) => { const i = imp(s); i.binds.push([d, 'default']); names(n).forEach(([a, b]) => i.binds.push([b, a])); return ''; });
    o = o.replace(/^[ \t]*import\s+\*\s*as\s+([\w$]+)\s+from\s*(['"])([^'"]+)\2;?/gm, (m, ns, q, s) => { imp(s).binds.push([ns, null]); return ''; });
    o = o.replace(/^[ \t]*import\s+([\w$]+)\s+from\s*(['"])([^'"]+)\2;?/gm, (m, d, q, s) => { imp(s).binds.push([d, 'default']); return ''; });
    o = o.replace(/^[ \t]*import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2;?/gm, (m, n, q, s) => { const i = imp(s); names(n).forEach(([a, b]) => i.binds.push([b, a])); return ''; });
    o = o.replace(/^[ \t]*import\s*(['"])([^'"]+)\1;?/gm, (m, q, s) => { imp(s); return ''; });
    o = o.replace(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g, (m, q, s) => { spec(s); return m; });
    o = o.replace(/^[ \t]*export\s+default\s+(async\s+function|function|class)(\s*\*)?\s*([\w$]+)/gm, (m, kw, star, n) => { exp.push(['default', n]); return kw + (star || '') + ' ' + n; });
    o = o.replace(/^[ \t]*export\s+default\s+/gm, 'exports.default = ');
    o = o.replace(/^[ \t]*export\s+(async\s+function|function|class|const|let|var)(\s*\*)?\s*([\w$]+)/gm, (m, kw, star, n) => { exp.push([n, n]); return kw + (star || '') + ' ' + n; });
    o = o.replace(/^[ \t]*export\s*\*\s*from\s*(['"])([^'"]+)\1;?/gm, (m, q, s) => 'Object.assign(exports, __req(' + spec(s) + '));');
    o = o.replace(/^[ \t]*export\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2;?/gm, (m, n, q, s) => '{ const __m = __req(' + spec(s) + '); ' + names(n).map(([a, b]) => 'exports[' + JSON.stringify(b) + '] = __m[' + JSON.stringify(a) + '];').join(' ') + ' }');
    o = o.replace(/^[ \t]*export\s*\{([^}]*)\};?/gm, (m, n) => { names(n).forEach(([a, b]) => exp.push([b, a])); return ''; });
    // Imports are live bindings: every imported name is a getter on __ns and the module body runs inside with (__ns),
    // so circular imports and late initialisation behave like real ES modules.
    const pre = imps.map((i) => 'const ' + i.m + ' = __req(' + JSON.stringify(i.s) + ');').join(' ') + ' const __ns = {}; ' +
      imps.map((i) => i.binds.map(([l, k]) => 'Object.defineProperty(__ns, ' + JSON.stringify(l) + ', { get: () => ' + i.m + (k === null ? '' : '[' + JSON.stringify(k) + ']') + ' });').join(' ')).join(' ');
    const pro = exp.map(([ex, loc]) => 'Object.defineProperty(exports, ' + JSON.stringify(ex) + ', { enumerable: true, get: () => ' + loc + ' });').join(' ');
    return { pre, body: pro + '\n' + o, deps };
  }
  function bundleJs(files, entry, opts) {
    const asyncEntry = !!(opts && opts.async), mods = {};
    const visit = (p) => {
      if (mods[p]) return;
      const t = mods[p] = esmToCjs(files[p]); t.map = {};
      t.deps.forEach((s) => { const r = resolveJs(s, p, files); t.map[s] = r; if (r) visit(r); });
    };
    visit(entry);
    let code = 'const __defs = {}, __cache = {};\nfunction __load(p) { if (__cache[p]) return __cache[p].exports; const m = __cache[p] = { exports: {} }; const r = __defs[p](m.exports); return r && typeof r.then === "function" ? r.then(() => m.exports) : m.exports; }\n';
    Object.keys(mods).forEach((p) => {
      code += '__defs[' + JSON.stringify(p) + '] = ' + (asyncEntry && p === entry ? 'async ' : '') + 'function (exports) { const __map = ' + JSON.stringify(mods[p].map) + '; ' +
        'const __req = (s) => { const r = __map[s]; if (!r) throw new Error("Cannot find module \'" + s + "\'" + (/^[.\\/]/.test(s) ? " imported from " + ' + JSON.stringify(p) + ' + " (only files in this project can be imported)" : "")); return __load(r); }; const require = __req;\n' +
        mods[p].pre + '\nwith (__ns) {\n' + mods[p].body + '\n}\n};\n';
    });
    return { code: code + (asyncEntry ? 'await ' : '') + '__load(' + JSON.stringify(entry) + ');\n', files: Object.keys(mods), warnings: [] };
  }

  /* ---------- 2b. Python: inline local modules in dependency order ---------- */
  const PY_STD = ['math', 'random', 'time'];
  function resolvePy(mod, from, files, rootDir) {
    const m = mod.match(/^(\.*)(.*)$/), dots = m[1].length, rest = m[2].replace(/\./g, '/');
    let roots;
    if (dots) { let d = dirname(from); for (let i = 1; i < dots; i++) d = dirname(d); roots = [d]; } else roots = [rootDir, '/', '/site-packages'];
    for (const r of roots) { const b = rest ? join(r, rest) : r; for (const c of [b + '.py', b + '/__init__.py']) if (files[c] !== undefined) return c; }
    return null;
  }
  const pyTopNames = (src, priv) => { const n = new Set(); src.replace(/^(?:def|class)\s+(\w+)|^(\w+)\s*(?::[^=\n]+)?=(?!=)/gm, (m, a, b) => { const x = a || b; if (x && !/^__\w+__$/.test(x) && (priv || !x.startsWith('_'))) n.add(x); return m; }); return Array.from(n); };
  // Renames top-level names inside one Python module without touching strings, comments, attributes or keyword arguments.
  function pyRename(src, map) {
    if (!Object.keys(map).length) return src;
    // parameters of a def shadow module-level names inside that def's body, so they must not be renamed there
    const ex = [], L = src.split('\n');
    L.forEach((ln, k) => { const m = ln.match(/^(\s*)def\s+\w+\s*\(([^)]*)\)/); if (!m) return; const ind = m[1].length, ps = new Set(m[2].split(',').map((x) => x.trim().replace(/^\*+/, '').split(/[:=\s]/)[0]).filter(Boolean));
      for (let j = k; j < L.length; j++) { if (j > k && L[j].trim() && L[j].length - L[j].trimStart().length <= ind) break; ex[j] = ex[j] || new Set(); ps.forEach((x) => ex[j].add(x)); } });
    let out = '', i = 0, depth = 0, line = 0; const n = src.length;
    const prevCh = () => { let k = out.length - 1; while (k >= 0 && (out[k] === ' ' || out[k] === '\t')) k--; return k < 0 ? '' : out[k]; };
    const fexpr = (body) => { let r = '', k = 0; while (k < body.length) { if (body[k] === '{' && body[k + 1] === '{') { r += '{{'; k += 2; continue; } if (body[k] === '{') { let d = 1, j = k + 1; while (j < body.length && d) { if (body[j] === '{') d++; else if (body[j] === '}') d--; j++; } r += '{' + pyRename(body.slice(k + 1, j - 1), map) + '}'; k = j; continue; } r += body[k++]; } return r; };
    while (i < n) {
      const c = src[i];
      if (c === '#') { const e = src.indexOf('\n', i); const j = e < 0 ? n : e; out += src.slice(i, j); i = j; continue; }
      const pm = /^([rRbBuUfF]{1,2})(?=['"])/.exec(src.slice(i, i + 3));
      if (pm || c === '"' || c === "'") {
        const pfx = pm ? pm[1] : '', q0 = i + pfx.length, q = src[q0], tri = src.substr(q0, 3) === q + q + q, ql = tri ? 3 : 1;
        let j = q0 + ql; while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (tri ? src.substr(j, 3) === q.repeat(3) : src[j] === q) break; j++; }
        const body = src.slice(q0 + ql, j), delim = q.repeat(ql);
        out += pfx + delim + (/f/i.test(pfx) ? fexpr(body) : body) + delim; line += (body.match(/\n/g) || []).length; i = Math.min(n, j + ql); continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        const w = src.slice(i, j), p = prevCh(); let rest = j; while (rest < n && (src[rest] === ' ' || src[rest] === '\t')) rest++;
        const kw = depth > 0 && (p === '(' || p === ',') && src[rest] === '=' && src[rest + 1] !== '=';
        out += (map[w] && p !== '.' && !kw && !(ex[line] && ex[line].has(w))) ? map[w] : w; i = j; continue;
      }
      if (c === '(' || c === '[' || c === '{') depth++; else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
      if (/[0-9]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_.]/.test(src[j])) j++; out += src.slice(i, j); i = j; continue; }
      if (c === '\n') line++;
      out += c; i++;
    }
    return out;
  }

  function bundlePy(files, entry) {
    const rootDir = dirname(entry), done = new Set(), out = [], warnings = [], used = [];
    let needMnf = false;
    // name clashes between modules are resolved by renaming the dependency's copy (the entry file always keeps its names)
    const importsOf = (f) => { const r = []; files[f].split('\n').forEach((ln) => { let m; if ((m = ln.match(/^import\s+(.+?)\s*$/))) m[1].split(',').forEach((q) => { const pm = q.trim().match(/^([\w.]+)/); const d = pm && resolvePy(pm[1], f, files, rootDir); if (d) r.push(d); }); else if ((m = ln.match(/^from\s+([\w.]+)\s+import\s/))) { const d = resolvePy(m[1], f, files, rootDir); if (d) r.push(d); } }); return r; };
    const reach = [], seenR = new Set(); (function walk(f) { if (seenR.has(f)) return; seenR.add(f); reach.push(f); importsOf(f).forEach(walk); })(entry);
    const defs = {}; reach.forEach((f) => pyTopNames(files[f], true).forEach((nm) => { (defs[nm] = defs[nm] || []).push(f); }));
    const ren = {}; reach.forEach((f, idx) => { if (f === entry) return; ren[f] = {}; pyTopNames(files[f], true).forEach((nm) => { if (defs[nm].length > 1) ren[f][nm] = '_m' + idx + '_' + nm; }); });
    const actual = (dep, nm) => (ren[dep] && ren[dep][nm]) || nm;
    const missing = (base, file, n) => { needMnf = true; return { t: 'raise ModuleNotFoundError("No module named \'' + base + '\'")', f: file, n }; };
    const emit = (file) => {
      if (done.has(file)) return; done.add(file); used.push(file);
      const lines = pyRename(files[file], ren[file] || {}).split('\n'), mine = [];
      const isMain = file === entry;
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i]; let m;
        if (!isMain && /^if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(ln)) { i++; while (i < lines.length && (/^\s+/.test(lines[i]) || lines[i].trim() === '')) i++; i--; continue; }
        if ((m = ln.match(/^import\s+(.+?)\s*$/))) {
          m[1].split(',').map((s) => s.trim()).forEach((part) => {
            const pm = part.match(/^([\w.]+)(?:\s+as\s+(\w+))?$/); const dep = pm && resolvePy(pm[1], file, files, rootDir);
            if (!dep) { const base = pm ? pm[1].split('.')[0] : ''; mine.push(base && !PY_STD.includes(base) ? missing(base, file, i + 1) : { t: 'import ' + part, f: file, n: i + 1 }); return; }
            emit(dep);
            const alias = pm[2] || pm[1].split('.').pop();
            mine.push({ t: 'class ' + alias + ':', f: file, n: i + 1 }); // class-body assignment is what PyEngine supports for namespaces
            const nms = pyTopNames(files[dep]); if (!nms.length) nms.push('pass');
            nms.forEach((nm) => mine.push({ t: '    ' + (nm === 'pass' ? 'pass' : nm + ' = ' + actual(dep, nm)), f: file, n: i + 1 }));
          });
          continue;
        }
        if ((m = ln.match(/^from\s+([\w.]+)\s+import\s+(\([^)]*\)|.+?)\s*$/)) || (m = joinParen(lines, i, /^from\s+([\w.]+)\s+import\s+\(/))) {
          const start = i; if (m.consumed) i = m.end;
          const dep = resolvePy(m[1], file, files, rootDir);
          if (!dep) { const base = m[1].split('.')[0]; if (base && !PY_STD.includes(base)) mine.push(missing(base, file, start + 1)); else for (let k = start; k <= i; k++) mine.push({ t: lines[k], f: file, n: k + 1 }); continue; }
          emit(dep);
          const have = pyTopNames(files[dep]);
          m[2].replace(/[()]/g, '').split(',').map((s) => s.trim()).filter(Boolean).forEach((part) => {
            if (part === '*') return;
            const pm = part.match(/^(\w+)(?:\s+as\s+(\w+))?$/); if (!pm) return;
            if (!have.includes(pm[1])) mine.push({ t: 'raise ImportError("cannot import name \'' + pm[1] + '\' from \'' + m[1] + '\'")', f: file, n: start + 1 });
            else if ((pm[2] || pm[1]) !== actual(dep, pm[1])) mine.push({ t: (pm[2] || pm[1]) + ' = ' + actual(dep, pm[1]), f: file, n: start + 1 });
          });
          continue;
        }
        mine.push({ t: ln, f: file, n: i + 1 });
      }
      mine.forEach((x) => out.push(x));
    };
    emit(entry);
    if (needMnf) { out.unshift({ t: '    pass', f: '(sandbox)', n: 0 }); out.unshift({ t: 'class ModuleNotFoundError(ImportError):', f: '(sandbox)', n: 0 }); }
    return { code: out.map((x) => x.t).join('\n') + '\n', map: out, files: used, warnings };
  }
  function joinParen(lines, i, re) { // from x import (\n a,\n b\n)
    const m = lines[i].match(re); if (!m) return null; let j = i, txt = lines[i];
    while (!/\)/.test(txt) && j + 1 < lines.length) txt += ' ' + lines[++j];
    const mm = txt.match(/^from\s+([\w.]+)\s+import\s+(\([^)]*\))/); if (!mm) return null; mm.consumed = true; mm.end = j; return mm;
  }
  const remapPyError = (msg, map) => (msg || '').replace(/[Ll]ine (\d+)/g, (m, n) => { const x = map[+n - 1]; return x && x.n ? x.f + ', line ' + x.n : m; });

  // When a file or folder is renamed/moved, rewrite imports that pointed at it (JS/TS relative paths, Python module names).
  const relTo = (fromFile, target, keepExt) => {
    const a = dirname(fromFile).split('/').filter(Boolean), b = target.split('/').filter(Boolean); let i = 0;
    while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
    let rel = '../'.repeat(a.length - i) + b.slice(i).join('/'); if (rel[0] !== '.') rel = './' + rel;
    return keepExt ? rel : rel.replace(/\/index\.(js|mjs|ts)$/, '').replace(/\.(js|mjs|ts)$/, '');
  };
  function rewriteImports(files, entry, from, to) {
    const mv = (p) => (under(p, from) ? to + p.slice(from.length) : p), out = {}, root = dirname(entry || '/x');
    Object.keys(files).forEach((f) => {
      let t = files[f]; const nf = mv(f), lang = langOf(f);
      if (lang === 'js' || lang === 'ts') {
        t = t.replace(/(\bfrom\s*|\bimport\s*|\brequire\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g, (m, pre, q, s) => {
          const old = resolveJs(s, f, files); if (!old) return m; const nt = mv(old); if (nt === old && nf === f) return m;
          return pre + q + relTo(nf, nt, /\.(js|mjs|ts)$/.test(s)) + q;
        });
      } else if (lang === 'py') {
        t = t.replace(/^(\s*)(from|import)\s+([\w.]+)/gm, (m, ws, kw, mod) => {
          if (mod[0] === '.') return m; const old = resolvePy(mod, f, files, root); if (!old) return m; const nt = mv(old); if (nt === old) return m;
          const base = under(nt, root) ? root : '/'; let rel = nt.slice(base === '/' ? 1 : base.length + 1).replace(/\/__init__\.py$/, '').replace(/\.py$/, '');
          return ws + kw + ' ' + rel.replace(/\//g, '.');
        });
      }
      out[f] = t;
    });
    return out;
  }
  // C / C++: #include "file" is replaced by the file's text (once). A header's matching .c/.cpp is pulled in too, like linking.
  function inlineC(files, entry) {
    const seen = new Set();
    const inc = (f) => {
      if (seen.has(f)) return ''; seen.add(f);
      let t = files[f].replace(/^[ \t]*#pragma\s+once[ \t]*$/gm, '').replace(/^[ \t]*#include\s+"([^"]+)"[ \t]*$/gm, (m, s) => { const p = [join(dirname(f), s), norm(s)].find((x) => files[x] !== undefined); return p ? inc(p) : m; });
      if (/\.(h|hpp)$/.test(f)) { const base = f.replace(/\.(h|hpp)$/, ''); ['.c', '.cpp'].forEach((e) => { if (files[base + e] !== undefined && !seen.has(base + e)) t += '\n' + inc(base + e); }); }
      return t;
    };
    return inc(entry);
  }

  /* ---------- 3. mock package manager (npm / pip) ---------- */
  // Package sources are real code that the bundlers inline, but only once the package is "installed".
  const LODASH = String.raw`const words = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
const by = (k) => (typeof k === 'function' ? k : (x) => x[k]);
export const chunk = (a, n = 1) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
export const uniq = (a) => Array.from(new Set(a));
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const flatten = (a) => [].concat(...a);
export const compact = (a) => a.filter(Boolean);
export const take = (a, n = 1) => a.slice(0, n);
export const last = (a) => a[a.length - 1];
export const range = (s, e, st = 1) => { if (e === undefined) { e = s; s = 0; } const o = []; for (let i = s; st > 0 ? i < e : i > e; i += st) o.push(i); return o; };
export const sortBy = (a, k) => { const f = by(k); return a.map((x, i) => [x, i]).sort((p, q) => (f(p[0]) < f(q[0]) ? -1 : f(p[0]) > f(q[0]) ? 1 : p[1] - q[1])).map((p) => p[0]); };
export const groupBy = (a, k) => { const f = by(k), o = {}; a.forEach((x) => { const g = f(x); (o[g] = o[g] || []).push(x); }); return o; };
export const capitalize = (s) => { s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
export const camelCase = (s) => words(s).map((w, i) => (i ? capitalize(w) : w.toLowerCase())).join('');
export const kebabCase = (s) => words(s).map((w) => w.toLowerCase()).join('-');
export const isEmpty = (v) => v == null || (typeof v === 'object' ? Object.keys(v).length === 0 : String(v).length === 0);
export const pick = (o, ks) => { const r = {}; ks.forEach((k) => { if (k in o) r[k] = o[k]; }); return r; };
export const omit = (o, ks) => { const r = {}; Object.keys(o).forEach((k) => { if (!ks.includes(k)) r[k] = o[k]; }); return r; };
export default { chunk, uniq, sum, flatten, compact, take, last, range, sortBy, groupBy, capitalize, camelCase, kebabCase, isEmpty, pick, omit };
`;
  const DAYJS = String.raw`const NOW = Date.UTC(2026, 0, 15, 9, 30, 0); // the sandbox clock is fixed so output is repeatable
const pad = (n, l = 2) => String(n).padStart(l, '0');
const MS = { week: 6048e5, day: 864e5, hour: 36e5, minute: 6e4, second: 1e3, millisecond: 1 };
const unit = (u) => String(u).replace(/s$/, '');
class Dayjs {
  constructor(t) { this.t = t; }
  year() { return new Date(this.t).getUTCFullYear(); }
  month() { return new Date(this.t).getUTCMonth(); }
  date() { return new Date(this.t).getUTCDate(); }
  day() { return new Date(this.t).getUTCDay(); }
  hour() { return new Date(this.t).getUTCHours(); }
  minute() { return new Date(this.t).getUTCMinutes(); }
  format(f = 'YYYY-MM-DDTHH:mm:ss') {
    const d = new Date(this.t);
    const m = { YYYY: pad(d.getUTCFullYear(), 4), MM: pad(d.getUTCMonth() + 1), DD: pad(d.getUTCDate()), HH: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()), M: d.getUTCMonth() + 1, D: d.getUTCDate() };
    return f.replace(/YYYY|MM|DD|HH|mm|ss|M|D/g, (k) => m[k]);
  }
  add(n, u = 'day') {
    u = unit(u); const d = new Date(this.t);
    if (u === 'year') d.setUTCFullYear(d.getUTCFullYear() + n);
    else if (u === 'month') d.setUTCMonth(d.getUTCMonth() + n);
    else d.setTime(d.getTime() + n * MS[u]);
    return new Dayjs(d.getTime());
  }
  subtract(n, u) { return this.add(-n, u); }
  diff(o, u = 'millisecond') { u = unit(u); const ms = this.t - dayjs(o).t; if (u === 'month') return Math.trunc(ms / (30.4375 * 864e5)); if (u === 'year') return Math.trunc(ms / (365.25 * 864e5)); return Math.trunc(ms / MS[u]); }
  isBefore(o) { return this.t < dayjs(o).t; }
  isAfter(o) { return this.t > dayjs(o).t; }
  valueOf() { return this.t; }
  toISOString() { return new Date(this.t).toISOString(); }
}
const dayjs = (v) => {
  if (v === undefined) return new Dayjs(NOW);
  if (v instanceof Dayjs) return new Dayjs(v.t);
  if (typeof v === 'number') return new Dayjs(v);
  const s = String(v); const iso = /Z|[+-]\d\d:\d\d$/.test(s) ? s : s.length <= 10 ? s + 'T00:00:00Z' : s.replace(' ', 'T') + 'Z';
  return new Dayjs(Date.parse(iso));
};
export default dayjs;
`;
  const REQUESTS = String.raw`_DB = {
    "https://api.example.com/users/1": {"id": 1, "name": "Ada Lovelace", "role": "engineer"},
    "https://api.example.com/users": [{"id": 1, "name": "Ada Lovelace"}, {"id": 2, "name": "Linus"}],
    "https://api.example.com/status": {"status": "ok", "uptime": 99.9},
}

class Response:
    def __init__(self, url, status, data):
        self.url = url
        self.status_code = status
        self._data = data
        self.ok = status < 400
        self.text = str(data)

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception("HTTPError: " + str(self.status_code) + " for url: " + self.url)

def get(url):
    if url in _DB:
        return Response(url, 200, _DB[url])
    return Response(url, 404, {"error": "Not Found"})

def post(url, json=None):
    return Response(url, 201, {"created": True, "echo": json})
`;
  const HUMANIZE = String.raw`def intcomma(n):
    s = str(abs(int(n)))
    out = ""
    while len(s) > 3:
        out = "," + s[-3:] + out
        s = s[:-3]
    out = s + out
    if n < 0:
        out = "-" + out
    return out

def naturalsize(b):
    units = ["B", "kB", "MB", "GB", "TB"]
    size = float(b)
    i = 0
    while size >= 1000 and i < 4:
        size = size / 1000
        i = i + 1
    if i == 0:
        return str(int(size)) + " B"
    return str(round(size, 1)) + " " + units[i]

def ordinal(n):
    n = int(n)
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return str(n) + suf
`;
  const AXIOS = String.raw`const DB = {
  '/users/1': { id: 1, name: 'Ada Lovelace', role: 'engineer' },
  '/users': [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Linus' }],
  '/status': { status: 'ok', uptime: 99.9 },
};
const mk = (method, url, data) => new Promise((resolve, reject) => {
  setTimeout(() => {
    const u = String(url), known = u.indexOf('api.example.com') >= 0 || u[0] === '/';
    const hit = DB[u.replace(/^https?:\/\/api\.example\.com/, '')];
    let status = 404, body = { error: 'Not Found' };
    if (known && method === 'get' && hit !== undefined) { status = 200; body = hit; }
    else if (known && method !== 'get') { status = 201; body = { created: true, echo: data }; }
    const res = { data: body, status, statusText: status < 400 ? 'OK' : 'Not Found', headers: { 'content-type': 'application/json' }, config: { url: u, method } };
    if (status < 400) resolve(res);
    else { const e = new Error('Request failed with status code ' + status); e.name = 'AxiosError'; e.code = 'ERR_BAD_REQUEST'; e.isAxiosError = true; e.response = res; reject(e); }
  }, 20);
});
const make = (base) => ({
  get: (u) => mk('get', base + u), post: (u, d) => mk('post', base + u, d), put: (u, d) => mk('put', base + u, d), delete: (u) => mk('delete', base + u),
  request: (c) => mk(c.method || 'get', base + c.url, c.data),
  create: (c) => make((c && c.baseURL) || ''), isAxiosError: (e) => !!(e && e.isAxiosError),
});
const axios = make('');
export default axios;
export const get = axios.get;
export const post = axios.post;
export const create = axios.create;
export const isAxiosError = axios.isAxiosError;
`;
  const REGISTRY = {
    js: {
      lodash: { version: '4.17.21', desc: 'Utility belt for arrays, objects and strings.', tags: ['utility', 'arrays', 'strings'], src: LODASH, use: "import _ from 'lodash';\nconsole.log(_.chunk([1, 2, 3, 4, 5], 2));\nconsole.log(_.camelCase('hello big world'));" },
      axios: { version: '1.6.2', desc: 'Promise-based HTTP client. Talks to a built-in fake API (try await).', tags: ['http', 'api', 'async'], src: AXIOS, use: "import axios from 'axios';\nconst res = await axios.get('https://api.example.com/users/1');\nconsole.log(res.status, res.data.name);" },
      dayjs: { version: '1.11.10', desc: 'Tiny date library: parse, format, add and compare dates.', tags: ['date', 'time'], src: DAYJS, use: "import dayjs from 'dayjs';\nconsole.log(dayjs('2026-03-01').add(7, 'day').format('YYYY-MM-DD'));" },
    },
    py: {
      requests: { version: '2.31.0', desc: 'HTTP for humans. Here it talks to a built-in fake API.', tags: ['http', 'api', 'web'], src: REQUESTS, use: 'import requests\nres = requests.get("https://api.example.com/users/1")\nprint(res.status_code, res.json()["name"])' },
      humanize: { version: '4.9.0', desc: 'Turn numbers into friendly text: 1,234,567 and 1.2 MB.', tags: ['format', 'numbers'], src: HUMANIZE, use: 'import humanize\nprint(humanize.intcomma(1234567))\nprint(humanize.naturalsize(1234567))' },
    },
  };
  REGISTRY.js.lodash.path = '/node_modules/lodash/index.js'; REGISTRY.js.dayjs.path = '/node_modules/dayjs/index.js'; REGISTRY.js.axios.path = '/node_modules/axios/index.js';
  REGISTRY.py.requests.path = '/site-packages/requests.py'; REGISTRY.py.humanize.path = '/site-packages/humanize.py';
  const MANIFEST = { js: '/package.json', py: '/requirements.txt' };
  const DEFAULT_MANIFEST = {
    js: JSON.stringify({ name: 'my-project', version: '1.0.0', main: 'src/index.js', dependencies: {} }, null, 2) + '\n',
    py: '# Project dependencies. "pip install <name>" adds a line here.\n',
  };

  function readDeps(track, text) {
    try {
      if (track === 'js') { const o = JSON.parse(text); return { deps: Object.assign({}, o.dependencies || {}), meta: o }; }
      const deps = {};
      String(text).split('\n').forEach((l) => { l = l.trim(); if (!l || l[0] === '#' || l[0] === '-') return; const m = l.match(/^([A-Za-z0-9_.-]+)\s*(?:(?:==|>=|<=|~=)\s*([\w.]+))?/); if (m) deps[m[1].toLowerCase()] = m[2] || ''; });
      return { deps, meta: {} };
    } catch (e) { return { deps: {}, meta: {}, error: e.message }; }
  }
  function writeManifest(track, text, set, remove) {
    if (track === 'js') {
      const o = JSON.parse(text), d = Object.assign({}, o.dependencies || {}), sorted = {};
      remove.forEach((n) => { delete d[n]; }); Object.assign(d, set); Object.keys(d).sort().forEach((k) => { sorted[k] = d[k]; });
      o.dependencies = sorted; return JSON.stringify(o, null, 2) + '\n';
    }
    const seen = {}, out = [];
    String(text).split('\n').forEach((l) => {
      const t = l.trim(), m = t.match(/^([A-Za-z0-9_.-]+)/), n = m && t[0] !== '#' && t[0] !== '-' ? m[1].toLowerCase() : null;
      if (n && remove.includes(n)) return;
      if (n && set[n] !== undefined) { out.push(n + '==' + set[n]); seen[n] = 1; return; }
      out.push(l);
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    Object.keys(set).forEach((n) => { if (!seen[n]) out.push(n + '==' + set[n]); });
    return out.join('\n') + '\n';
  }
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  // Runs one terminal line. Returns { lines, progress, after, commit, clear }.
  // Nothing changes until the UI calls commit(), after the loading bar finishes.
  function execCmd(store, line) {
    const st = store.state, track = trackOf(st), M = MANIFEST[track], reg = REGISTRY[track];
    const argv = line.trim().split(/\s+/).filter(Boolean), R = { lines: [], progress: null, after: [], commit: null, clear: false };
    const say = (...a) => { R.lines.push(...a); return R; };
    if (!argv.length) return R;
    let bin = argv[0]; if (bin === 'pip3') bin = 'pip';
    const mgr = track === 'js' ? 'npm' : 'pip';
    if (bin === 'clear') { R.clear = true; return R; }
    if (bin === 'help') return say('Commands for this ' + (track === 'js' ? 'JavaScript' : 'Python') + ' project:',
      ...(track === 'js'
        ? ['  npm install <pkg>     add a package (npm install with no name installs everything in package.json)', '  npm uninstall <pkg>   remove a package', '  npm ls                list packages', '  npm search <word>     look in the sandbox registry', '  npm init -y           create package.json']
        : ['  pip install <pkg>     install a package and record it in requirements.txt', '  pip install -r requirements.txt   install everything listed', '  pip uninstall <pkg>   remove a package', '  pip list | pip freeze | pip show <pkg>']),
      '  clear                 clear this terminal');
    if (bin !== mgr) return say(bin === 'npm' || bin === 'pip' ? bin + ': this is a ' + (track === 'js' ? 'JavaScript project. Use npm here.' : 'Python project. Use pip here.') : 'bash: ' + bin + ': command not found (type "help")');
    const sub = argv[1] || '', flags = argv.slice(2).filter((a) => a[0] === '-'), rest = argv.slice(2).filter((a) => a[0] !== '-');
    const known = Object.keys(reg).join(', ');
    const getText = () => st.files[M];
    const rd = () => readDeps(track, getText() === undefined ? '' : getText());
    const total = () => Object.keys(st.pkgs).length;
    const split = (sp) => { const m = track === 'js' ? sp.match(/^(@?[^@]+)(?:@(.+))?$/) : sp.match(/^([^=<>~]+)(?:==(.+))?$/); return { name: m[1].toLowerCase(), ver: m[2] || '' }; };

    if (mgr === 'npm') {
      if (['install', 'i', 'add'].includes(sub)) {
        if (getText() === undefined) return say('npm ERR! code ENOENT', 'npm ERR! enoent Could not read package.json. Run "npm init -y" to create one.');
        const r = rd(); if (r.error) return say('npm ERR! code EJSONPARSE', 'npm ERR! package.json is not valid JSON: ' + r.error);
        const want = {};
        const names = rest.length ? rest.map(split) : Object.keys(r.deps).map((n) => ({ name: n, ver: '' }));
        for (const p of names) {
          if (!reg[p.name]) return say('npm ERR! code E404', 'npm ERR! 404 Not Found - GET https://registry.npmjs.org/' + p.name, "npm ERR! 404 '" + p.name + "@*' is not in this sandbox registry. Try one of: " + known);
          const pin = /^\d/.test(p.ver); want[p.name] = { ver: pin ? p.ver : reg[p.name].version, pin };
        }
        const todo = Object.keys(want).filter((n) => st.pkgs[n] !== want[n].ver);
        if (!todo.length) return say('up to date, audited ' + (total() + 1) + ' packages in 312ms', '', 'found 0 vulnerabilities');
        R.progress = { label: 'npm install ' + todo.join(' ') };
        R.after = ['', 'added ' + plural(todo.length, 'package') + ', and audited ' + (total() + todo.length + 1) + ' packages in ' + (0.6 + todo.length * 0.3).toFixed(1) + 's', '', 'found 0 vulnerabilities'];
        R.commit = () => { const set = {}; todo.forEach((n) => { st.pkgs[n] = want[n].ver; set[n] = (want[n].pin ? '' : '^') + want[n].ver; }); if (rest.length) st.files[M] = writeManifest('js', st.files[M], set, []); store.touch(); };
        return R;
      }
      if (['uninstall', 'remove', 'rm', 'un'].includes(sub)) {
        if (getText() === undefined) return say('npm ERR! code ENOENT', 'npm ERR! enoent Could not read package.json.');
        const r = rd(); if (r.error) return say('npm ERR! code EJSONPARSE', 'npm ERR! package.json is not valid JSON: ' + r.error);
        const names = rest.map((s) => split(s).name), had = names.filter((n) => r.deps[n] !== undefined || st.pkgs[n]);
        if (!had.length) return say('up to date, audited ' + (total() + 1) + ' packages in 198ms');
        R.after = ['removed ' + plural(had.length, 'package') + ', and audited ' + (total() - had.filter((n) => st.pkgs[n]).length + 1) + ' packages in 0.2s'];
        R.commit = () => { had.forEach((n) => { delete st.pkgs[n]; }); st.files[M] = writeManifest('js', st.files[M], {}, had); store.touch(); };
        R.progress = { label: 'npm uninstall ' + had.join(' ') };
        return R;
      }
      if (sub === 'ls' || sub === 'list') {
        const r = rd(), meta = r.meta || {}, all = Object.keys(r.deps).concat(Object.keys(st.pkgs)).filter((n, i, a) => a.indexOf(n) === i).sort();
        const out = [(meta.name || 'my-project') + '@' + (meta.version || '1.0.0') + ' /project'];
        if (!all.length) out.push('└── (empty)');
        all.forEach((n, i) => { const b = i === all.length - 1 ? '└── ' : '├── '; const v = st.pkgs[n], d = r.deps[n]; out.push(b + (v && d !== undefined ? n + '@' + v : v ? n + '@' + v + ' extraneous' : 'UNMET DEPENDENCY ' + n + '@' + d)); });
        if (all.some((n) => !st.pkgs[n] && r.deps[n] !== undefined)) out.push('', 'npm ERR! missing: run "npm install" to fetch what package.json lists');
        return say(...out);
      }
      if (sub === 'search') {
        const q = rest.join(' ').toLowerCase(), hits = Object.keys(reg).filter((n) => !q || (n + ' ' + reg[n].desc + ' ' + reg[n].tags.join(' ')).toLowerCase().includes(q));
        return say(...(hits.length ? hits.map((n) => n + '  v' + reg[n].version + '  ' + reg[n].desc) : ['No matches for "' + q + '" in the sandbox registry (' + known + ').']));
      }
      if (sub === 'init') {
        if (getText() !== undefined) return say('package.json already exists.');
        R.lines = ['Wrote to /package.json:', '', DEFAULT_MANIFEST.js.trim()]; R.commit = () => { st.files[M] = DEFAULT_MANIFEST.js; store.touch(); }; return R;
      }
      return say('Unknown command: "' + sub + '"', 'Try: npm install <pkg>, npm uninstall <pkg>, npm ls, npm search <word>');
    }

    /* pip */
    if (sub === 'install') {
      const ri = argv.indexOf('-r'); let names;
      if (ri > 0) {
        const f = norm(argv[ri + 1] || ''), t = st.files[f];
        if (t === undefined) return say("ERROR: Could not open requirements file: [Errno 2] No such file or directory: '" + (argv[ri + 1] || '') + "'");
        names = Object.keys(readDeps('py', t).deps).map((n) => ({ name: n, ver: readDeps('py', t).deps[n] }));
      } else if (!rest.length) return say('ERROR: You must give at least one requirement to install (see "pip help install")');
      else names = rest.map(split);
      const want = {};
      for (const p of names) {
        if (!reg[p.name]) return say('ERROR: Could not find a version that satisfies the requirement ' + p.name + ' (from versions: none)', 'ERROR: No matching distribution found for ' + p.name, 'Sandbox registry has: ' + known);
        want[p.name] = p.ver || reg[p.name].version;
      }
      const todo = Object.keys(want).filter((n) => st.pkgs[n] !== want[n]);
      R.lines = Object.keys(want).filter((n) => !todo.includes(n)).map((n) => 'Requirement already satisfied: ' + n + ' in /site-packages (' + st.pkgs[n] + ')');
      if (!todo.length) return R;
      todo.forEach((n) => { R.lines.push('Collecting ' + n, '  Downloading ' + n + '-' + want[n] + '-py3-none-any.whl (' + (38 + n.length * 3) + ' kB)'); });
      R.progress = { label: 'Installing collected packages: ' + todo.join(', ') };
      R.after = ['Successfully installed ' + todo.map((n) => n + '-' + want[n]).join(' ')];
      R.commit = () => {
        todo.forEach((n) => { st.pkgs[n] = want[n]; });
        if (ri < 0) { const set = {}; todo.forEach((n) => { set[n] = want[n]; }); st.files[M] = writeManifest('py', st.files[M] === undefined ? DEFAULT_MANIFEST.py : st.files[M], set, []); }
        store.touch();
      };
      return R;
    }
    if (sub === 'uninstall') {
      const names = rest.map((s) => split(s).name), had = names.filter((n) => st.pkgs[n]);
      R.lines = names.filter((n) => !st.pkgs[n]).map((n) => 'WARNING: Skipping ' + n + ' as it is not installed.');
      if (!had.length) return R;
      had.forEach((n) => { R.lines.push('Found existing installation: ' + n + ' ' + st.pkgs[n]); });
      R.after = had.map((n) => 'Successfully uninstalled ' + n + '-' + st.pkgs[n]);
      R.progress = { label: 'Uninstalling ' + had.join(', ') };
      R.commit = () => { had.forEach((n) => { delete st.pkgs[n]; }); if (st.files[M] !== undefined) st.files[M] = writeManifest('py', st.files[M], {}, had); store.touch(); };
      return R;
    }
    if (sub === 'list') {
      const ns = Object.keys(st.pkgs).sort(); if (!ns.length) return say('(no packages installed)');
      const w = Math.max(7, ...ns.map((n) => n.length));
      return say('Package'.padEnd(w) + ' Version', '-'.repeat(w) + ' -------', ...ns.map((n) => n.padEnd(w) + ' ' + st.pkgs[n]));
    }
    if (sub === 'freeze') {
      const ls = Object.keys(st.pkgs).sort().map((n) => n + '==' + st.pkgs[n]), gt = argv.indexOf('>');
      if (gt > 0 && argv[gt + 1]) { const f = norm(argv[gt + 1]); R.commit = () => { st.files[f] = ls.join('\n') + (ls.length ? '\n' : ''); store.touch(); }; return say('(wrote ' + ls.length + ' packages to ' + argv[gt + 1] + ')'); }
      return say(...(ls.length ? ls : ['(nothing installed)']));
    }
    if (sub === 'show') {
      const n = (rest[0] || '').toLowerCase();
      if (!st.pkgs[n]) return say('WARNING: Package(s) not found: ' + n);
      return say('Name: ' + n, 'Version: ' + st.pkgs[n], 'Summary: ' + reg[n].desc, 'Location: /site-packages');
    }
    return say('ERROR: unknown command "' + sub + '"', 'Try: pip install <pkg>, pip uninstall <pkg>, pip list, pip freeze, pip show <pkg>');
  }

  /* ---------- 2c. run a project (evaluation engine) ---------- */
  // Installed packages become virtual files (/node_modules/x/index.js or /site-packages/x.py).
  // Not installed = file absent = the import fails exactly like a real missing dependency.
  function filesWithPackages(st) {
    const f = Object.assign({}, st.files), reg = REGISTRY[trackOf(st)] || {};
    Object.keys(st.pkgs || {}).forEach((n) => { if (reg[n]) f[reg[n].path] = reg[n].src; });
    return f;
  }
  function hintFor(err, track) {
    const m = track === 'js' ? err.match(/Cannot find module '([^'.\/][^']*)'/) : err.match(/No module named '([\w.]+)'/);
    if (!m) return '';
    const n = m[1].split('.')[0], mgr = track === 'js' ? 'npm install ' : 'pip install ';
    return REGISTRY[track][n] ? "\nTip: '" + n + "' is not installed yet. In the Terminal, run: " + mgr + n : "\nTip: '" + n + "' is not in this sandbox. Available: " + Object.keys(REGISTRY[track]).join(', ');
  }
  function runProject(store, run, stdin) {
    const st = store.state, entry = st.entry || st.active;
    if (!entry) return { out: '', error: 'There is no file to run. Create one in the explorer.' };
    const lang = langOf(entry), track = trackOf(st), files = filesWithPackages(st);
    if (!lang) return { out: '', error: 'Cannot run ' + basename(entry) + ' (unknown file type).' };
    let r;
    if (lang === 'js' || lang === 'ts') {
      let b = bundleJs(files, entry);
      const needAsync = b.files.some((p) => /\bawait\b|\.then\s*\(|\bPromise\b|\bsetTimeout\b|\basync\b/.test(files[p]));
      if (lang === 'js' && needAsync && typeof JsEngine !== 'undefined' && JsEngine.runAsync) {
        b = bundleJs(files, entry, { async: true });
        return JsEngine.runAsync(b.code).then((x) => { if (x.error) x.error += hintFor(x.error, 'js'); return x; });
      }
      r = run(lang, b.code, stdin);
    }
    else if (lang === 'py') {
      const b = bundlePy(files, entry); r = run('py', b.code, stdin);
      if (r.error) r.error = remapPyError(r.error, b.map);
      if (b.warnings.length) r.out = (r.out || '') + '\n[note] ' + b.warnings.join('\n[note] ') + '\n';
    } else if (lang === 'c' || lang === 'cpp') { r = run(lang, inlineC(files, entry), stdin); }
    else { r = run(lang, st.files[entry], stdin); }
    if (r && r.error && (lang === 'js' || lang === 'ts' || lang === 'py')) r.error += hintFor(r.error, lang === 'py' ? 'py' : 'js');
    return r;
  }
  function starter(track) {
    if (track === 'py') return { track: 'py', files: { '/main.py': '# 1) Run this. It fails: requests is not installed.\n# 2) In the Terminal below, run:  pip install requests\n# 3) Run again.\nimport requests\n\nres = requests.get("https://api.example.com/users/1")\nprint(res.status_code)\nprint(res.json()["name"])\n', '/requirements.txt': DEFAULT_MANIFEST.py }, entry: '/main.py' };
    return { track: 'js', files: { '/src/index.js': "// 1) Run this. It fails: lodash is not installed.\n// 2) In the Terminal below, run:  npm install lodash\n// 3) Run again.\nimport _ from 'lodash';\nimport { shout } from './utils.js';\n\nconsole.log(_.chunk([1, 2, 3, 4, 5], 2));\nconsole.log(shout('packages work'));\n", '/src/utils.js': 'export const shout = (s) => s.toUpperCase() + "!";\n', '/package.json': DEFAULT_MANIFEST.js }, entry: '/src/index.js' };
  }

  /* ---------- 4. view ---------- */
  const BADGE = { js: ['JS', '#d9a400'], mjs: ['JS', '#d9a400'], ts: ['TS', '#2f74c0'], py: ['PY', '#3b8ad9'], c: ['C', '#6b7bd6'], cpp: ['C+', '#6b7bd6'], cs: ['C#', '#7a5cc7'], sql: ['SQ', '#c26b1d'], json: ['{}', '#8a8f2a'], md: ['MD', '#6a7490'], html: ['<>', '#d2552b'], css: ['#', '#2f9bd1'], txt: ['TXT', '#8a93b5'] };
  const CSS = `
.ws{display:grid;grid-template-columns:260px minmax(0,1fr);border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface);min-height:460px}
.ws.collapsed{grid-template-columns:0 minmax(0,1fr)}.ws.collapsed .ws-side{display:none}
.ws-side{background:var(--surface2);border-right:1px solid var(--border);display:flex;flex-direction:column;min-width:0;max-height:760px}
.ws-vt-row{display:flex;border-bottom:1px solid var(--border)}
.ws-vt{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:var(--muted);height:38px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}
.ws-vt.on{color:var(--text);border-bottom-color:var(--accent)}.ws-vt i{font-style:normal;background:var(--accent);color:var(--accent-ink);border-radius:9px;padding:0 6px;font-size:11px;margin-left:4px}
.ws-sh{display:flex;align-items:center;gap:2px;padding:4px 6px 4px 12px;font-size:12px;color:var(--muted)}
.ws-sh b{flex:1;font-weight:600}
.ws-ib{background:none;border:0;color:var(--muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font:600 14px var(--mono)}
.ws-ib:hover,.ws-ib:focus-visible{background:var(--border);color:var(--text)}
.ws-tree{overflow:auto;flex:1;padding:2px 0 8px;font-size:13px;-webkit-overflow-scrolling:touch}
.ws-row{display:flex;align-items:center;gap:6px;height:30px;padding-right:4px;cursor:pointer;border-left:2px solid transparent;color:var(--text);position:relative;user-select:none}
.ws-row:hover{background:color-mix(in srgb,var(--border) 55%,transparent)}
.ws-row.sel{background:color-mix(in srgb,var(--accent) 14%,transparent);border-left-color:var(--accent)}
.ws-chev{width:14px;text-align:center;font-size:10px;color:var(--muted);transition:transform .12s}.ws-chev.open{transform:rotate(90deg)}
.ws-ic{font:700 9px var(--mono);min-width:18px;text-align:center}
.ws-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-entry{color:var(--accent);font-size:10px}
.ws-acts{display:none;gap:0}.ws-row.sel .ws-acts,.ws-row:hover .ws-acts{display:flex}
.ws-acts button{background:none;border:0;color:var(--muted);width:26px;height:26px;border-radius:5px;cursor:pointer;font-size:13px}
.ws-acts button:hover{background:var(--border);color:var(--text)}
.ws-in{flex:1;min-width:0;font:13px var(--mono);padding:2px 5px;border:1px solid var(--accent);border-radius:4px;background:var(--surface);color:var(--text)}
.ws-in.bad{border-color:var(--bad)}.ws-err{color:var(--bad);font-size:11px;padding:2px 12px}
.ws-pkbody{display:flex;flex-direction:column;min-height:0;flex:1;padding:10px 10px 0}
.ws-pks{width:100%;box-sizing:border-box;font-size:13px;font-family:inherit;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)}
.ws-pks:focus{outline:2px solid var(--accent);outline-offset:-1px}
.ws-pklist{overflow:auto;flex:1;padding:6px 0 12px;-webkit-overflow-scrolling:touch}
.ws-pkh{font-size:12px;font-weight:600;color:var(--muted);margin:12px 2px 6px}
.ws-pk{border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:9px 10px;margin-bottom:8px}
.ws-pk .top{display:flex;align-items:center;gap:8px}.ws-pk b{font:600 13px var(--mono)}.ws-pk .v{font:11px var(--mono);color:var(--muted)}
.ws-pk p{margin:4px 0 6px;font-size:12px;color:var(--muted);line-height:1.4}
.ws-tags{display:flex;gap:4px;flex-wrap:wrap}.ws-tags span{font-size:10px;border:1px solid var(--border);border-radius:9px;padding:0 6px;color:var(--muted)}
.ws-pk details{margin-top:6px;font-size:12px}.ws-pk summary{cursor:pointer;color:var(--accent)}
.ws-pk pre{margin:6px 0 0;padding:8px;background:var(--surface2);border-radius:6px;font:11px/1.5 var(--mono);overflow:auto;white-space:pre}
.ws-pb{margin-left:auto;font-weight:600;font-size:12px;font-family:inherit;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);border-radius:6px;padding:4px 10px;cursor:pointer}
.ws-pb.alt{background:none;color:var(--text);border-color:var(--border)}.ws-pb:disabled{opacity:.5}
.ws-chip{font-size:10px;border-radius:9px;padding:1px 7px;background:var(--good-bg);color:var(--good)}.ws-chip.warn{background:var(--bad-bg);color:var(--bad)}
.ws-main{display:flex;flex-direction:column;min-width:0}
.ws-tabs{display:flex;align-items:stretch;background:var(--surface2);border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none}
.ws-toggle{flex:none;border-right:1px solid var(--border)}
.ws-tab{display:flex;align-items:center;gap:6px;padding:0 6px 0 12px;height:36px;font-size:13px;color:var(--muted);border-right:1px solid var(--border);border-top:2px solid transparent;cursor:pointer;white-space:nowrap;flex:none}
.ws-tab.on{background:var(--surface);color:var(--text);border-top-color:var(--accent)}
.ws-tab button{background:none;border:0;color:inherit;width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:14px;line-height:1}
.ws-tab button:hover{background:var(--border)}
.ws-edit{min-width:0}.ws-empty{padding:48px 16px;text-align:center;color:var(--muted);font-size:13px}
.ws-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--border);flex-wrap:wrap}
.ws-bar .grow,.ws-th .grow{flex:1}.ws-status{font:11px var(--mono);color:var(--muted);padding:4px 10px;border-top:1px solid var(--border);background:var(--surface2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-term{background:#0d1117;color:#c9d1d9;border-top:1px solid var(--border);font:12.5px/1.55 var(--mono)}
.ws-th{display:flex;align-items:center;padding:2px 6px 2px 12px;color:#8b949e;font-weight:600;font-size:11px;font-family:inherit}
.ws-th .ws-ib{color:#8b949e}.ws-th .ws-ib:hover{background:#21262d;color:#fff}
.ws-tout{margin:0;padding:2px 12px 4px;max-height:210px;min-height:56px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.ws-tout .cmd{color:#7ee787}.ws-tout .bad{color:#ff8f86}.ws-tout .dim{color:#8b949e}.ws-tout .pbar{color:#8fa3ff}.ws-row.drop{outline:1px dashed var(--accent);outline-offset:-2px;background:color-mix(in srgb,var(--accent) 10%,transparent)}
.ws-tin{display:flex;align-items:center;gap:8px;padding:6px 12px 10px}
.ws-ps{color:#7ee787}.ws-tin input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:inherit;font:inherit;caret-color:#7ee787}
.ws-out{padding:0 10px 10px}
@media (max-width:700px){.ws{grid-template-columns:1fr}.ws-side{border-right:0;border-bottom:1px solid var(--border);max-height:340px}.ws.collapsed{grid-template-columns:1fr}}
`;

  function mount(host, opts) {
    opts = opts || {};
    const store = createStore(opts.seed || starter(opts.track || 'js'), opts.persist);
    if (opts.track) store.state.track = opts.track;
    const T = trackOf(store.state);
    store.state.track = T;
    store.ensureFile(MANIFEST[T], DEFAULT_MANIFEST[T]);
    const ui = { editing: null, sel: store.state.active, err: '', ed: null, edLang: null, edPath: null, view: 'files', q: '', busy: false, hist: [], hi: 0 };
    if (!document.getElementById('ws-css')) { const s = document.createElement('style'); s.id = 'ws-css'; s.textContent = CSS; document.head.appendChild(s); }
    const mgr = T === 'js' ? 'npm' : 'pip';
    host.innerHTML = '<div class="ws"><aside class="ws-side" aria-label="Sidebar"></aside><div class="ws-main"><div class="ws-tabs" role="tablist"></div><div class="ws-edit"></div>' +
      '<div class="ws-bar"><button class="btn primary" id="wsRun" type="button"></button><span class="grow"></span></div><div class="ws-status"></div>' +
      '<div class="ws-term"><div class="ws-th"><b>TERMINAL</b><span class="grow"></span><button class="ws-ib" id="wsClear" title="Clear terminal" aria-label="Clear terminal">⌫</button></div><pre class="ws-tout" aria-live="polite"></pre>' +
      '<label class="ws-tin"><span class="ws-ps">$</span><input id="wsCmd" aria-label="Terminal command" placeholder="' + (T === 'js' ? 'npm install lodash' : 'pip install requests') + '" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></label></div>' +
      '<div class="ws-out"><div id="wsStdin"></div>' + outHolder + '</div></div></div>';
    const root = $('.ws', host), side = $('.ws-side', host), tabs = $('.ws-tabs', host), edHost = $('.ws-edit', host), status = $('.ws-status', host), runBtn = $('#wsRun', host), outEl = $('.out', host);
    const tout = $('.ws-tout', host), cmdIn = $('#wsCmd', host);
    const badge = (n) => { const b = BADGE[extOf(n)] || ['··', '#8a93b5']; return '<span class="ws-ic" style="color:' + b[1] + '">' + b[0] + '</span>'; };
    const targetDir = () => { const s = ui.sel; return !s ? '/' : store.isDir(s) ? s : dirname(s); };
    const reduced = () => typeof REDUCED !== 'undefined' && REDUCED;

    /* ----- terminal ----- */
    const tp = (text, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; tout.appendChild(d); tout.scrollTop = tout.scrollHeight; return d; };
    tp('Package terminal. Type "help". Try: ' + mgr + ' install ' + (T === 'js' ? 'lodash' : 'requests'), 'dim');
    function termRun(cmd) {
      if (ui.busy || !cmd.trim()) return;
      ui.hist.push(cmd); ui.hi = ui.hist.length;
      tp('$ ' + cmd, 'cmd');
      const r = execCmd(store, cmd);
      if (r.clear) { tout.textContent = ''; return; }
      r.lines.forEach((l) => tp(l, /^(npm ERR!|ERROR|bash:|WARNING|[a-z]+: this is)/.test(l) ? 'bad' : ''));
      const finish = () => { if (r.commit) r.commit(); r.after.forEach((l) => tp(l)); ui.busy = false; cmdIn.disabled = false; };
      if (!r.progress) { finish(); return; }
      ui.busy = true; cmdIn.disabled = true;
      const N = 24, line = tp('', 'pbar'); let i = 0;
      const draw = () => { line.textContent = r.progress.label + '\n[' + '█'.repeat(i) + '░'.repeat(N - i) + '] ' + Math.round(i / N * 100) + '%'; tout.scrollTop = tout.scrollHeight; };
      if (reduced()) { i = N; draw(); finish(); return; }
      draw();
      const t = setInterval(() => { i += 1 + (Math.random() < 0.5 ? 1 : 0); if (i >= N) { i = N; clearInterval(t); draw(); finish(); } else draw(); }, 70);
    }
    cmdIn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); const v = cmdIn.value; cmdIn.value = ''; termRun(v); }
      else if (ev.key === 'ArrowUp' && ui.hist.length) { ev.preventDefault(); ui.hi = Math.max(0, ui.hi - 1); cmdIn.value = ui.hist[ui.hi] || ''; }
      else if (ev.key === 'ArrowDown' && ui.hist.length) { ev.preventDefault(); ui.hi = Math.min(ui.hist.length, ui.hi + 1); cmdIn.value = ui.hist[ui.hi] || ''; }
    });
    $('#wsClear', host).addEventListener('click', () => { tout.textContent = ''; });

    /* ----- sidebar: files ----- */
    function rowHtml(n, depth) {
      const sel = ui.sel === n.path, pad = 'padding-left:' + (8 + depth * 14) + 'px';
      if (ui.editing && ui.editing.mode === 'rename' && ui.editing.path === n.path) return inputRow(depth, n.type, basename(n.path));
      const chev = n.type === 'dir' ? '<span class="ws-chev' + (store.state.open[n.path] !== false ? ' open' : '') + '">▶</span>' : '<span class="ws-chev"></span>';
      const star = store.state.entry === n.path ? '<span class="ws-entry" title="Entry file (runs when you press Run)">▶</span>' : '';
      const acts = '<span class="ws-acts">' + (n.type === 'file' ? '<button data-a="entry" title="Set as entry file">★</button>' : '') + '<button data-a="mv" title="Move to folder">⇄</button><button data-a="ren" title="Rename (F2)">✎</button><button data-a="del" title="Delete">🗑</button></span>';
      let h = '<div class="ws-row' + (sel ? ' sel' : '') + '" role="treeitem" tabindex="0" draggable="true" data-p="' + esc(n.path) + '" data-t="' + n.type + '" style="' + pad + '">' + chev + (n.type === 'file' ? badge(n.name) : '<span class="ws-ic" style="color:var(--muted)">▣</span>') + '<span class="ws-name">' + esc(n.name) + '</span>' + star + acts + '</div>';
      if (n.type === 'dir' && store.state.open[n.path] !== false) {
        if (ui.editing && ui.editing.mode !== 'rename' && ui.editing.parent === n.path) h += inputRow(depth + 1, ui.editing.mode === 'folder' ? 'dir' : 'file', '');
        h += n.children.map((c) => rowHtml(c, depth + 1)).join('');
      }
      return h;
    }
    const inputRow = (depth, type, val) => '<div class="ws-row" style="padding-left:' + (8 + depth * 14) + 'px"><span class="ws-chev"></span>' + (type === 'dir' ? '<span class="ws-ic">▣</span>' : '<span class="ws-ic">+</span>') + '<input class="ws-in" aria-label="Name" value="' + esc(val) + '" spellcheck="false" autocapitalize="off" autocomplete="off"></div>' + (ui.err ? '<div class="ws-err">' + esc(ui.err) + '</div>' : '');
    const instCount = () => Object.keys(store.state.pkgs).length;

    function renderSide() {
      const hdr = '<div class="ws-vt-row" role="tablist"><button class="ws-vt' + (ui.view === 'files' ? ' on' : '') + '" data-v="files">Files</button><button class="ws-vt' + (ui.view === 'pkgs' ? ' on' : '') + '" data-v="pkgs">Packages' + (instCount() ? '<i>' + instCount() + '</i>' : '') + '</button></div>';
      if (ui.view === 'pkgs') {
        side.innerHTML = hdr + '<div class="ws-pkbody"><input class="ws-pks" type="search" placeholder="Search packages (try ' + (T === 'js' ? '“date”' : '“http”') + ')" aria-label="Search packages" value="' + esc(ui.q) + '" autocapitalize="off" autocomplete="off" spellcheck="false"><div class="ws-pklist"></div></div>';
        renderPkgList(); return;
      }
      const rootInput = ui.editing && ui.editing.mode !== 'rename' && ui.editing.parent === '/' ? inputRow(0, ui.editing.mode === 'folder' ? 'dir' : 'file', '') : '';
      side.innerHTML = hdr + '<div class="ws-sh"><b>PROJECT</b><button class="ws-ib" data-h="file" title="New file" aria-label="New file">+</button><button class="ws-ib" data-h="folder" title="New folder" aria-label="New folder">▣</button><button class="ws-ib" data-h="collapse" title="Collapse folders" aria-label="Collapse all folders">−</button></div>' +
        '<div class="ws-tree" role="tree">' + rootInput + store.tree().map((n) => rowHtml(n, 0)).join('') + '</div>';
      const inp = $('.ws-in', side); if (inp) { inp.focus(); inp.select(); bindInput(inp); }
    }

    /* ----- sidebar: package explorer ----- */
    function renderPkgList() {
      const box = $('.ws-pklist', side); if (!box) return;
      const reg = REGISTRY[T], st = store.state, q = ui.q.trim().toLowerCase();
      const r = readDeps(T, st.files[MANIFEST[T]] === undefined ? '' : st.files[MANIFEST[T]]);
      const inst = Object.keys(st.pkgs).concat(Object.keys(r.deps)).filter((n, i, a) => a.indexOf(n) === i).sort();
      let h = '<div class="ws-pkh">Installed (' + Object.keys(st.pkgs).length + ')</div>';
      if (r.error) h += '<div class="ws-err" style="padding:0">' + esc(MANIFEST[T].slice(1)) + ' is not valid: ' + esc(r.error) + '</div>';
      if (!inst.length) h += '<div class="ws-empty" style="padding:10px 4px;text-align:left">Nothing yet. Install one below, or type <code>' + mgr + ' install ' + Object.keys(reg)[0] + '</code> in the terminal.</div>';
      inst.forEach((n) => {
        const v = st.pkgs[n], declared = r.deps[n] !== undefined;
        const chip = v && declared ? '<span class="ws-chip">installed</span>' : v ? '<span class="ws-chip warn">not in ' + esc(MANIFEST[T].slice(1)) + '</span>' : '<span class="ws-chip warn">listed, not installed</span>';
        h += '<div class="ws-pk"><div class="top"><b>' + esc(n) + '</b><span class="v">' + (v ? esc(v) : esc(r.deps[n] || '')) + '</span>' + chip + '<button class="ws-pb alt" data-pk="' + (v ? 'rm:' : 'add:') + esc(n) + '">' + (v ? 'Remove' : 'Install') + '</button></div></div>';
      });
      const hits = Object.keys(reg).filter((n) => !q || (n + ' ' + reg[n].desc + ' ' + reg[n].tags.join(' ')).toLowerCase().includes(q));
      h += '<div class="ws-pkh">' + (q ? 'Results for “' + esc(ui.q.trim()) + '”' : 'Registry') + ' (' + hits.length + ')</div>';
      if (!hits.length) h += '<div class="ws-empty" style="padding:10px 4px;text-align:left">No match. This sandbox registry only has: ' + esc(Object.keys(reg).join(', ')) + '.</div>';
      hits.forEach((n) => {
        const p = reg[n], v = st.pkgs[n];
        h += '<div class="ws-pk"><div class="top"><b>' + esc(n) + '</b><span class="v">v' + esc(p.version) + '</span>' + (v ? '<span class="ws-chip">installed</span>' : '<button class="ws-pb" data-pk="add:' + esc(n) + '">Install</button>') + '</div><p>' + esc(p.desc) + '</p><div class="ws-tags">' + p.tags.map((t) => '<span>' + esc(t) + '</span>').join('') + '</div><details><summary>How to use</summary><pre>' + esc(p.use) + '</pre></details></div>';
      });
      box.innerHTML = h;
    }

    function bindInput(inp) {
      const done = (ok) => {
        const e = ui.editing; if (!e) return;
        if (!ok) { ui.editing = null; ui.err = ''; renderSide(); return; }
        const v = inp.value.trim();
        try {
          if (e.mode === 'rename') { const to = join(dirname(e.path), v); const wasSel = ui.sel === e.path; store.rename(e.path, to); if (wasSel) ui.sel = to; }
          else if (e.mode === 'file') { const p = join(e.parent, v); store.createFile(p); ui.sel = p; }
          else { const p = join(e.parent, v); store.createFolder(p); ui.sel = p; }
          ui.editing = null; ui.err = '';
        } catch (x) { ui.err = x.message; inp.classList.add('bad'); const el = document.createElement('div'); el.className = 'ws-err'; el.textContent = x.message; const old = $('.ws-err', side); if (old) old.remove(); inp.parentNode.after(el); return; }
        renderAll();
      };
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); done(true); } else if (ev.key === 'Escape') { ev.preventDefault(); done(false); } });
      inp.addEventListener('blur', () => setTimeout(() => { if (ui.editing && !ui.err) done(inp.value.trim() ? true : false); else if (ui.editing && !inp.value.trim()) done(false); }, 120));
    }
    function startEdit(mode, path) {
      ui.err = '';
      if (mode === 'rename') ui.editing = { mode, path };
      else { const parent = targetDir(); store.state.open[parent] = true; ui.editing = { mode, parent }; }
      renderSide();
    }

    /* ----- tabs, editor, bar ----- */
    function renderTabs() {
      const st = store.state;
      tabs.innerHTML = '<button class="ws-ib ws-toggle" id="wsToggle" title="Show or hide sidebar" aria-label="Toggle sidebar" style="width:40px;height:auto">☰</button>' +
        st.tabs.map((p) => '<div class="ws-tab' + (p === st.active ? ' on' : '') + '" role="tab" data-p="' + esc(p) + '">' + badge(basename(p)) + '<span>' + esc(basename(p)) + '</span><button data-x="1" aria-label="Close ' + esc(basename(p)) + '">×</button></div>').join('');
    }
    function renderEditor() {
      const p = store.state.active;
      if (!p) { ui.ed = null; ui.edPath = null; edHost.innerHTML = '<div class="ws-empty">No file open. Create one with + in the explorer.</div>'; return; }
      const text = store.state.files[p];
      if (ui.edPath === p && ui.ed) { if (ui.ed.get() !== text) { ui.switching = true; ui.ed.set(text); ui.switching = false; } return; } // manifest changed by a terminal command
      const lang = langOf(p) || (extOf(p) === 'json' ? 'js' : 'py');
      ui.edPath = p;
      if (ui.ed && ui.edLang === lang) { ui.switching = true; ui.ed.set(text); ui.switching = false; }
      else { ui.edLang = lang; ui.ed = mountEditor(edHost, lang, text, run, (v) => { if (!ui.switching && ui.edPath) store.setContent(ui.edPath, v); }); }
      const fn = $('.fname', edHost); if (fn) fn.textContent = basename(p);
    }
    function renderBar() {
      const st = store.state, e = st.entry, lang = e && langOf(e);
      runBtn.innerHTML = '▶ Run ' + (e ? esc(basename(e)) : '') + '<span class="kbd">' + RUNKEY + '</span>'; runBtn.disabled = !e;
      const sd = $('#wsStdin', host); const want = lang === 'py' || lang === 'c' || lang === 'cpp';
      if (want && !sd.firstChild) sd.innerHTML = stdinBox(lang); else if (!want) sd.innerHTML = '';
      status.textContent = (st.active || 'no file') + (e ? '  ·  entry: ' + e : '') + '  ·  ' + instCount() + ' package' + (instCount() === 1 ? '' : 's') + ' installed';
    }
    function renderAll() { renderSide(); renderTabs(); renderEditor(); renderBar(); }
    function run() {
      const sb = $('.stdinbox', host), t0 = performance.now();
      Promise.resolve(runProject(store, runCode, sb ? sb.value : '')).then((r) => showOut(outEl, r, langOf(store.state.entry || '') || 'js', performance.now() - t0));
    }

    /* ----- events (delegated) ----- */
    side.addEventListener('click', (ev) => {
      const v = ev.target.closest('[data-v]'); if (v) { ui.view = v.dataset.v; renderSide(); return; }
      const pk = ev.target.closest('[data-pk]'); if (pk) { const [op, n] = pk.dataset.pk.split(':'); termRun(mgr + (op === 'add' ? ' install ' : ' uninstall ') + n); return; }
      const h = ev.target.closest('[data-h]'); if (h) { if (h.dataset.h === 'collapse') store.collapseAll(); else startEdit(h.dataset.h); return; }
      const row = ev.target.closest('.ws-row[data-p]'); if (!row) return;
      const p = row.dataset.p, a = ev.target.closest('[data-a]');
      ui.sel = p;
      if (a) {
        if (a.dataset.a === 'ren') return startEdit('rename', p);
        if (a.dataset.a === 'mv') { const d = prompt('Move "' + basename(p) + '" to which folder? (for example /src/lib, or / for the top)', dirname(p)); if (d !== null) moveTo(p, d.trim() || '/'); return; }
        if (a.dataset.a === 'entry') return store.setEntry(p);
        if (a.dataset.a === 'del') { const n = store.isDir(p) ? 'folder "' + basename(p) + '" and everything in it' : '"' + basename(p) + '"'; if (confirm('Delete ' + n + '?')) { ui.sel = dirname(p) === '/' ? null : dirname(p); store.remove(p); } return; }
      }
      if (row.dataset.t === 'dir') store.toggleDir(p); else store.open(p);
    });
    function moveTo(p, dir) {
      try { dir = norm(dir); if (dir !== '/' && !store.isDir(dir)) store.createFolder(dir); const to = join(dir, basename(p)); if (to === p) return; const wasSel = ui.sel === p; store.rename(p, to); if (wasSel) ui.sel = to; }
      catch (x) { alert(x.message); }
    }
    side.addEventListener('dragstart', (ev) => { const r = ev.target.closest && ev.target.closest('.ws-row[data-p]'); if (!r) return; ui.drag = r.dataset.p; if (ev.dataTransfer) { ev.dataTransfer.setData('text/plain', ui.drag); ev.dataTransfer.effectAllowed = 'move'; } });
    side.addEventListener('dragover', (ev) => { if (!ui.drag) return; const r = ev.target.closest('.ws-row[data-t="dir"]'), t = ev.target.closest('.ws-tree'); if (r || t) { ev.preventDefault(); $$('.ws-row.drop', side).forEach((x) => x.classList.remove('drop')); if (r) r.classList.add('drop'); } });
    side.addEventListener('dragleave', (ev) => { const r = ev.target.closest && ev.target.closest('.ws-row'); if (r) r.classList.remove('drop'); });
    side.addEventListener('drop', (ev) => { if (!ui.drag) return; ev.preventDefault(); const r = ev.target.closest('.ws-row[data-t="dir"]'); const dir = r ? r.dataset.p : '/', p = ui.drag; ui.drag = null; if (dir === p || under(dir, p)) return; moveTo(p, dir); });
    side.addEventListener('dragend', () => { ui.drag = null; $$('.ws-row.drop', side).forEach((x) => x.classList.remove('drop')); });
    side.addEventListener('input', (ev) => { if (ev.target.classList.contains('ws-pks')) { ui.q = ev.target.value; renderPkgList(); } });
    side.addEventListener('keydown', (ev) => {
      if (ev.target.classList.contains('ws-in') || ev.target.classList.contains('ws-pks')) return;
      const row = ev.target.closest('.ws-row[data-p]'); if (!row) return;
      if (ev.key === 'F2') { ev.preventDefault(); ui.sel = row.dataset.p; startEdit('rename', row.dataset.p); }
      else if (ev.key === 'Delete' || ev.key === 'Backspace') { ui.sel = row.dataset.p; const b = $('[data-a="del"]', row); if (b) b.click(); }
      else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); row.click(); }
    });
    tabs.addEventListener('click', (ev) => {
      if (ev.target.closest('#wsToggle')) { root.classList.toggle('collapsed'); return; }
      const t = ev.target.closest('.ws-tab'); if (!t) return;
      if (ev.target.closest('[data-x]')) store.closeTab(t.dataset.p); else { ui.sel = t.dataset.p; store.open(t.dataset.p); }
    });
    runBtn.addEventListener('click', run);
    store.subscribe(() => { if (store.state.active) ui.sel = ui.sel && store.exists(ui.sel) ? ui.sel : store.state.active; renderAll(); });
    renderAll();
    return { store, run, term: termRun, destroy() { host.innerHTML = ''; } };
  }

  return { mount, createStore, bundleJs, bundlePy, runProject, execCmd, esmToCjs, langOf, norm, starter, REGISTRY, readDeps };
})();
if (typeof module !== 'undefined') module.exports = Workspace;
