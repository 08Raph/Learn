/* ============================================================
   Software Engineering University: AI Professor (lazy)
   Two providers behind one interface:
     builtin   rule-based tutor shipped with the site. Always available, works
               offline, costs nothing. It is NOT an AI model and says so.
     endpoint  optional. If uni/config.js sets aiEndpoint to an https URL of a
               server-side function YOU deploy (which holds the API key), chat
               messages are POSTed there. No key ever lives in this site.
   ============================================================ */
(window.LEARN_MOD_BUILD = window.LEARN_MOD_BUILD || {})['uni-professor'] = '1.9.0'; // must equal BUILD in university.js
(function () {
  'use strict';
  const U = window.LearnUniversity; const A = U.api; const { $, $$, E, md, inline, st, save, shell, link } = U;
  const MODES = [
    ['beginner', 'Beginner Teacher', 'Plain words, small steps, everyday comparisons.', 'You are a patient teacher for someone who has never programmed. Use plain language and everyday analogies before any jargon.'],
    ['tutor', 'Programming Tutor', 'Explains code, traces it, helps you find bugs yourself.', 'You are a programming tutor. Explain with short code examples and guide the student to find bugs themselves.'],
    ['maths', 'Mathematics Professor', 'Definitions, worked derivations and practice problems.', 'You are a mathematics professor for computer science students. State definitions precisely and derive results step by step.'],
    ['algo', 'Algorithms Expert', 'Step-by-step traces and complexity analysis.', 'You are an algorithms expert. Trace algorithms on small inputs, state invariants and analyse complexity.'],
    ['architect', 'Software Architect', 'Reviews designs by asking the questions a senior engineer asks.', 'You are a principal software architect. Review designs through trade-offs, failure modes, data ownership and operability.'],
    ['review', 'Code Reviewer', 'Reads your code like a careful colleague.', 'You are a senior code reviewer. Point out correctness, clarity and maintainability issues, explain why each matters, and ask before rewriting.'],
    ['examiner', 'Examination Examiner', 'Asks you questions and marks them. No hints.', 'You are an examiner. Ask one question at a time, do not give hints, then mark the answer and explain the marking.'],
    ['research', 'Research Supervisor', 'Helps you frame questions, read papers and design experiments.', 'You are a research supervisor. Help the student sharpen a research question, find and read literature critically, and design sound experiments.'],
  ];
  const TEACH = 'Teach rather than hand over answers. Give hints before solutions, ask what the student has tried, never complete a graded assignment or examination for them, and adapt to their level.';
  const endpoint = () => { const u = String(U.cfg.aiEndpoint || '').trim(); return /^https:\/\/[\w.-]+(\/[^\s<>"']*)?$/.test(u) ? u : ''; };
  let KB = null, mode = 'beginner', ctx = null, log = [], labHint = 0, pendingOral = null;
  const kb = async () => { if (KB) return KB; await new Promise((ok, no) => { const el = document.createElement('script'); el.src = 'uni/data/tutor-kb.js?v=' + A.ver; el.onload = ok; el.onerror = () => { el.remove(); no(new Error('offline')); }; document.head.appendChild(el); }); KB = window.UNI_TUTOR_KB; return KB; };
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9+#/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const nums = (t) => (String(t).match(/-?\d+/g) || []).map(Number).slice(0, 12);

  /* ---------- built-in tutor: explain ---------- */
  function findTerm(q) {
    const n = ' ' + norm(q) + ' '; let best = null, score = 0;
    KB.glossary.forEach((g) => { let s = 0; const names = [g[0]].concat(g[1].split(' ')); if (n.includes(' ' + g[0] + ' ')) s += 6 + g[0].length / 4; names.forEach((a) => { if (a.length > 2 && n.includes(' ' + a + ' ')) s += 2; }); if (s > score) { score = s; best = g; } });
    return score >= 2 ? best : null;
  }
  function findCourse(q) {
    const w = norm(q).split(' ').filter((x) => x.length > 3); let best = null, score = 0;
    U.cat.courses.forEach((c) => { const hay = norm(c.title + ' ' + c.desc + ' ' + (c.topics || []).join(' ') + ' ' + (c.skills || []).join(' ')); let s = 0; w.forEach((x) => { if (hay.includes(x)) s += 1; }); if (s > score) { score = s; best = c; } });
    return score >= 1 ? best : null;
  }
  async function lessonExcerpt(c, q) {
    try { const d = await U.loadCourse(c.id); const w = norm(q).split(' ').filter((x) => x.length > 3); let bi = 0, bs = -1;
      d.lessons.forEach((l, i) => { const hay = norm(l.t + ' ' + l.md); let s = 0; w.forEach((x) => { s += hay.split(x).length - 1; if (norm(l.t).includes(x)) s += 6; }); if (s > bs) { bs = s; bi = i; } });
      const l = d.lessons[bi]; const paras = l.md.split(/\n\s*\n/).filter((p) => !/^```|^\|/.test(p.trim())).slice(0, 2).join('\n\n');
      return { i: bi, t: l.t, text: paras };
    } catch (e) { return null; }
  }
  async function explain(q) {
    const g = findTerm(q); const simple = mode === 'beginner';
    if (g) { const c = U.courseById(g[4]);
      let h = '<p><b>' + E(g[0].charAt(0).toUpperCase() + g[0].slice(1)) + '.</b> ' + inline(g[2]) + '</p>';
      if (!simple || /technical|formal|precise|detail|deeper|exactly/i.test(q)) h += '<p><b>More precisely:</b> ' + inline(g[3]) + '</p>'; else h += '<p class="pill">Say "more detail" for the technical version.</p>';
      h += '<p><b>Check yourself:</b> can you explain ' + E(g[0]) + ' in one sentence, in your own words, and give an example that is not the one above?</p>';
      if (c) h += '<small class="src">Taught in ' + link(['course', c.id], E(c.code + ' ' + c.title)) + '</small>';
      lastTerm = g; return h; }
    const c = (ctx && /this|here|lesson|course/i.test(q) && U.courseById(ctx.course)) || findCourse(q);
    if (c) { const ex = await lessonExcerpt(c, q); if (ex) return '<p>The closest match in the curriculum is <b>' + E(ex.t) + '</b> in ' + E(c.code + ' ' + c.title) + '. It begins:</p><div class="u-prose">' + md(ex.text) + '</div><small class="src">' + link(['course', c.id, 'lesson', String(ex.i)], 'Open the full lesson →') + '</small>';
      return '<p>That topic belongs to ' + link(['course', c.id], E(c.code + ' ' + c.title)) + '. I could not open the lesson text right now (you may be offline).</p>'; }
    return null;
  }
  let lastTerm = null;

  /* ---------- built-in tutor: code review ---------- */
  function guessLang(code) {
    if (/^\s*(def |import |from \w+ import|print\(|elif |class \w+.*:)/m.test(code) || /:\s*$/m.test(code) && !/[{};]\s*$/m.test(code)) return 'py';
    if (/#include|int main\s*\(|printf\(|std::/.test(code)) return /std::|cout|class /.test(code) ? 'cpp' : 'c';
    if (/public (static )?(class|void)|System\.out/.test(code)) return 'java';
    if (/\bSELECT\b[\s\S]*\bFROM\b/i.test(code)) return 'sql';
    if (/fn main|let mut |println!/.test(code)) return 'rust';
    if (/interface \w+|: (string|number|boolean)\b/.test(code)) return 'ts';
    return 'js';
  }
  const looksLikeCode = (t) => { const L = String(t).split('\n'); return L.length >= 2 && L.filter((l) => /[{}();=]|^\s{2,}\S|:\s*$|^\s*(def|for|if|while|function|const|let|var|class|return|import|#include)\b/.test(l)).length >= Math.max(2, L.length * 0.5); };
  function review(code) {
    const lang = guessLang(code); const L = code.replace(/\r/g, '').split('\n'); const issues = [], good = [];
    const add = (sev, line, msg, why) => issues.push({ sev, line, msg, why });
    let depthMax = 0, fnStart = -1, fnName = '';
    L.forEach((raw, i) => { const n = i + 1; const l = raw.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
      const ind = (raw.match(/^\s*/)[0].replace(/\t/g, '    ').length); const depth = lang === 'py' ? Math.floor(ind / 4) : 0; depthMax = Math.max(depthMax, depth);
      if (raw.length > 110) add('style', n, 'This line is ' + raw.length + ' characters long.', 'Long lines hide logic. Break the expression into named steps.');
      if (/(password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']{6,}/i.test(raw)) add('major', n, 'A secret appears to be written directly in the code.', 'Anything in source code leaks. Read secrets from the environment instead.');
      if (/(SELECT|INSERT|UPDATE|DELETE)\b.*["']\s*\+|f["'].*(SELECT|INSERT|UPDATE|DELETE)\b.*\{/i.test(raw)) add('major', n, 'A SQL statement is being built by joining strings.', 'This is how SQL injection happens. Use parameterised queries.');
      if (/\b(TODO|FIXME|XXX)\b/.test(raw)) add('minor', n, 'A TODO marker is still here.', 'Finish it or track it somewhere it will not be forgotten.');
      if (lang === 'py') {
        if (/^\s*(if|elif|while)\b[^=!<>]*[^=!<>]=[^=]/.test(l) && !/==|!=|<=|>=|:=/.test(l)) add('major', n, 'A single `=` is used inside a condition.', '`=` assigns; `==` compares. What did you mean to test?');
        if (/^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b.*[^:\s]\s*$/.test(l) && !/[\\,(\[{]\s*$/.test(l)) add('major', n, 'This line starts a block but does not end with a colon.', 'Python needs `:` to open the indented block that follows.');
        if (/def \w+\(.*=\s*(\[\]|\{\})/.test(l)) add('major', n, 'A list or dict is used as a default argument.', 'The default is created once and shared between calls. Use None and create it inside.');
        if (/^\s*except\s*:/.test(l)) add('major', n, 'A bare `except:` catches every error, including ones you did not expect.', 'Catch the specific exception you can actually handle.');
        if (/range\(len\(/.test(l)) add('minor', n, '`range(len(...))` is used to walk a list.', 'Loop over the items directly, or use `enumerate` when you need the position.');
        if (/[!=]=\s*None\b/.test(l)) add('minor', n, 'Comparison with None uses `==`.', 'Use `is None` / `is not None`.');
        if (/^\s*(list|dict|str|sum|max|min|id|input|type|len)\s*=[^=]/.test(l)) add('major', n, 'A built-in name is being overwritten.', 'After this line the built-in function is gone for the rest of the scope.');
        const m = /^\s*def (\w+)/.exec(l); if (m) { if (fnStart >= 0 && i - fnStart > 45) add('minor', fnStart + 1, 'Function `' + fnName + '` is ' + (i - fnStart) + ' lines long.', 'Long functions do several jobs. Which part could have its own name?'); fnStart = i; fnName = m[1]; if (/[A-Z]/.test(m[1])) add('style', n, 'Function name `' + m[1] + '` is not snake_case.', 'Python convention is lower_case_with_underscores.'); }
      } else if (lang === 'js' || lang === 'ts') {
        if (/\bvar\s+\w/.test(l)) add('minor', n, '`var` is used.', '`let` and `const` have block scope and avoid a class of bugs.');
        if (/[^=!<>]==[^=]/.test(l) || /!=[^=]/.test(l)) add('minor', n, 'Loose equality (`==` or `!=`) is used.', 'It converts types silently. Prefer `===` and `!==`.');
        if (/\bif\s*\([^=()]*[^=!<>]=[^=][^)]*\)/.test(l)) add('major', n, 'An assignment (`=`) appears inside an `if` condition.', 'Did you mean to compare with `===`?');
        if (/catch\s*\(\w*\)\s*\{\s*\}/.test(l)) add('major', n, 'An empty catch block swallows the error.', 'A failure will now be invisible. Handle it or at least log it.');
        if (/for\s*\(.*\bin\b/.test(l)) add('minor', n, '`for...in` is used.', 'On arrays it iterates keys as strings. Use `for...of`.');
        if (/console\.log/.test(l)) add('style', n, 'A console.log is left in.', 'Fine while debugging; remove before you ship.');
      } else if (lang === 'c' || lang === 'cpp') {
        if (/\bgets\s*\(/.test(l)) add('major', n, '`gets` is used.', 'It cannot limit input length and overflows the buffer. Use `fgets`.');
        if (/\bstrcpy\s*\(|\bsprintf\s*\(/.test(l)) add('minor', n, 'An unbounded copy (`strcpy`/`sprintf`) is used.', 'Check the destination size or use the bounded version.');
        if (/\bmalloc\s*\(/.test(l) && !/free\s*\(/.test(code)) add('major', n, 'Memory is allocated but never freed anywhere in this code.', 'Who owns this memory, and when should it be released?');
        if (/\bif\s*\([^=()]*[^=!<>]=[^=][^)]*\)/.test(l)) add('major', n, 'An assignment (`=`) appears inside an `if` condition.', 'Did you mean `==`?');
      }
      if (/[^\w.]\d{3,}[^\w.]/.test(' ' + l + ' ') && !/^\s*(#|\/\/|const|final|[A-Z_]+\s*=)/.test(l)) add('style', n, 'A bare number appears in the logic.', 'What does it mean? A named constant would say.');
    });
    if (depthMax >= 5) add('minor', 0, 'The code is nested ' + depthMax + ' levels deep.', 'Deep nesting is hard to follow. Early returns or helper functions flatten it.');
    const dup = {}; L.forEach((l) => { const t = l.trim(); if (t.length > 18) dup[t] = (dup[t] || 0) + 1; }); const d = Object.keys(dup).filter((k) => dup[k] >= 3)[0]; if (d) add('minor', 0, 'The line `' + d.slice(0, 50) + '` appears ' + dup[d] + ' times.', 'Repetition is a hint that a loop or function is missing.');
    if (/^\s*(#|\/\/|\/\*|""")/m.test(code)) good.push('It has comments.'); if (/\b(def|function|fn|void|int) \w+\s*\(/.test(code)) good.push('The work is split into named functions.'); if (L.length <= 40) good.push('It is short enough to read in one go.');
    let run = null;
    if ((lang === 'py' || lang === 'js') && code.length < 20000) { try { const r = A.runCode(lang, code, ''); if (r && r.error) run = r.error; else if (r) run = ''; } catch (e) { run = null; } }
    const order = { major: 0, minor: 1, style: 2 }; issues.sort((a, b) => order[a.sev] - order[b.sev] || a.line - b.line);
    let h = '<p><b>Code review</b> (' + E(U.assess ? U.assess.langName(lang) : lang) + ', ' + L.length + ' lines). I read it with fixed rules, so I will miss things a human reviewer would catch, especially whether the logic is right for your task.</p>';
    if (run !== null) h += run ? '<p><b>I ran it and it stopped with an error:</b></p><pre class="u-code"><code>' + E(run.slice(0, 600)) + '</code></pre>' + errorHelp(run) : '<p>✓ I ran it and it finished without an error. That shows it runs, not that it is correct.</p>';
    if (good.length) h += '<p><b>What is working:</b> ' + good.map(E).join(' ') + '</p>';
    if (issues.length) h += '<p><b>Things to look at:</b></p><ul>' + issues.slice(0, 12).map((x) => '<li><b>' + (x.sev === 'major' ? '● Important' : x.sev === 'minor' ? '○ Worth fixing' : '· Style') + (x.line ? ', line ' + x.line : '') + ':</b> ' + inline(x.msg) + ' <i>' + inline(x.why) + '</i></li>').join('') + '</ul>' + (issues.length > 12 ? '<p class="pill">…and ' + (issues.length - 12) + ' more of the same kinds.</p>' : '');
    else h += '<p>My rule set found nothing to flag. Now ask yourself the questions it cannot: what input would break this? What happens with an empty list, a zero, a very large value?</p>';
    h += '<p><b>Your turn:</b> pick the most important item, fix it yourself, and paste the new version. I will not rewrite it for you.</p>';
    return h;
  }
  function errorHelp(text) {
    const hit = KB.errors.find((e) => e[0].test(text)); if (!hit) return '';
    return '<p><b>What this error means:</b> ' + E(hit[1]) + '</p><p><b>How to investigate:</b></p><ol>' + hit[2].map((x) => '<li>' + inline(x) + '</li>').join('') + '</ol>';
  }

  /* ---------- built-in tutor: algorithm walkthroughs ---------- */
  const WALK = {
    'binary search': (a) => { const xs = a.slice(0, -1).sort((p, q) => p - q), t = a[a.length - 1]; if (xs.length < 2) return null; let lo = 0, hi = xs.length - 1, out = ['Sorted list: [' + xs.join(', ') + '], target ' + t + '.'], n = 0; while (lo <= hi && n++ < 20) { const mid = (lo + hi) >> 1; out.push('lo=' + lo + ', hi=' + hi + ' → middle index ' + mid + ' holds ' + xs[mid] + '. ' + (xs[mid] === t ? 'Found it.' : xs[mid] < t ? xs[mid] + ' < ' + t + ', so discard the left half: lo = ' + (mid + 1) + '.' : xs[mid] + ' > ' + t + ', so discard the right half: hi = ' + (mid - 1) + '.')); if (xs[mid] === t) return out.concat('Took ' + n + ' step' + (n === 1 ? '' : 's') + ' for ' + xs.length + ' items. Each step halves the range, so the cost is O(log n).'); if (xs[mid] < t) lo = mid + 1; else hi = mid - 1; } return out.concat('lo passed hi, so ' + t + ' is not in the list.'); },
    'bubble sort': (a) => { const x = a.slice(); const out = ['Start: [' + x.join(', ') + ']']; for (let i = 0; i < x.length - 1; i++) { let sw = false; for (let j = 0; j < x.length - 1 - i; j++) if (x[j] > x[j + 1]) { [x[j], x[j + 1]] = [x[j + 1], x[j]]; sw = true; } out.push('Pass ' + (i + 1) + ': [' + x.join(', ') + ']' + (sw ? '. The largest unsorted value has bubbled to position ' + (x.length - 1 - i) + '.' : '. No swaps, so it is sorted; stop early.')); if (!sw) break; } return out.concat('Worst case does n−1 passes of up to n−1 comparisons: O(n²).'); },
    'insertion sort': (a) => { const x = a.slice(); const out = ['Start: [' + x.join(', ') + ']']; for (let i = 1; i < x.length; i++) { const k = x[i]; let j = i - 1; while (j >= 0 && x[j] > k) { x[j + 1] = x[j]; j--; } x[j + 1] = k; out.push('Insert ' + k + ' into the sorted part: [' + x.slice(0, i + 1).join(', ') + '] | ' + x.slice(i + 1).join(', ')); } return out.concat('Invariant: everything left of the bar is sorted. O(n²) worst case, O(n) when already sorted.'); },
    'selection sort': (a) => { const x = a.slice(); const out = ['Start: [' + x.join(', ') + ']']; for (let i = 0; i < x.length - 1; i++) { let m = i; for (let j = i + 1; j < x.length; j++) if (x[j] < x[m]) m = j; [x[i], x[m]] = [x[m], x[i]]; out.push('Smallest of the rest is ' + x[i] + '; swap it into position ' + i + ': [' + x.join(', ') + ']'); } return out.concat('Always about n²/2 comparisons: O(n²), but only n−1 swaps.'); },
    'merge sort': (a) => { const out = []; const ms = (x, d) => { if (x.length <= 1) return x; const m = x.length >> 1; const l = ms(x.slice(0, m), d + 1), r = ms(x.slice(m), d + 1); const res = []; let i = 0, j = 0; while (i < l.length && j < r.length) res.push(l[i] <= r[j] ? l[i++] : r[j++]); const z = res.concat(l.slice(i), r.slice(j)); out.push('  '.repeat(d) + 'merge [' + l.join(', ') + '] and [' + r.join(', ') + '] → [' + z.join(', ') + ']'); return z; }; ms(a, 0); return ['Split [' + a.join(', ') + '] in half until pieces have one item, then merge on the way back up:'].concat(out, 'There are log n levels of merging and each level touches all n items: O(n log n).'); },
    'gcd': (a) => { let [p, q] = [Math.abs(a[0]), Math.abs(a[1])]; if (!(p >= 0 && q >= 0)) return null; const out = ['Euclid\'s algorithm: gcd(a, b) = gcd(b, a mod b), until b is 0.']; let n = 0; while (q && n++ < 40) { out.push('gcd(' + p + ', ' + q + '): ' + p + ' mod ' + q + ' = ' + (p % q)); [p, q] = [q, p % q]; } return out.concat('b reached 0, so the answer is ' + p + '.'); },
    'binary': (a) => { let n = Math.abs(a[0]); if (!(n >= 0) || n > 1e9) return null; const out = ['Convert ' + n + ' to binary by dividing by 2 and collecting remainders.'], bits = []; if (n === 0) bits.push(0); while (n > 0) { out.push(n + ' ÷ 2 = ' + (n >> 1) + ' remainder ' + (n % 2)); bits.push(n % 2); n = n >> 1; } return out.concat('Read the remainders from last to first: ' + bits.reverse().join('') + '.'); },
    'factorial': (a) => { const n = Math.min(12, Math.abs(a[0])); const out = ['factorial(n) = n × factorial(n − 1), with factorial(0) = 1 as the base case.']; for (let i = n; i >= 1; i--) out.push('  '.repeat(n - i) + 'factorial(' + i + ') waits for factorial(' + (i - 1) + ')'); out.push('  '.repeat(n) + 'factorial(0) = 1  ← base case, now the calls return'); let f = 1; for (let i = 1; i <= n; i++) { f *= i; out.push('  '.repeat(n - i) + 'factorial(' + i + ') = ' + f); } return out; },
  };
  function walkthrough(q) {
    const n = norm(q); const key = Object.keys(WALK).find((k) => n.includes(k)) || (n.includes('euclid') || n.includes('greatest common') ? 'gcd' : n.includes('to binary') ? 'binary' : null); if (!key) return null;
    let a = nums(q); if (key === 'gcd' && a.length < 2) a = [48, 18]; else if (key === 'binary' && !a.length) a = [37]; else if (key === 'factorial' && !a.length) a = [4]; else if (key === 'binary search' && a.length < 3) a = [3, 8, 15, 21, 29, 42, 57, 21]; else if (/sort/.test(key) && a.length < 2) a = [7, 2, 9, 4, 1];
    const steps = WALK[key](a); if (!steps) return null;
    return '<p><b>' + E(key.charAt(0).toUpperCase() + key.slice(1)) + ', step by step</b>' + (nums(q).length >= 2 ? '' : ' (using an example; put your own numbers in the message to use them)') + '</p><pre class="u-diagram">' + E(steps.join('\n')) + '</pre><p><b>Before you move on:</b> cover the steps and trace it yourself with different numbers. Where would it take the most steps?</p>';
  }

  /* ---------- built-in tutor: practice ---------- */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function genQuestion() {
    const pick = rnd(0, mode === 'maths' ? 5 : 3);
    if (pick === 0) { const n = rnd(9, 60), ok = n.toString(2); const o = new Set([ok]); while (o.size < 4) o.add(rnd(9, 60).toString(2)); return { q: 'What is ' + n + ' in binary?', o: Array.from(o), okTxt: ok, why: 'Divide by 2 repeatedly and read the remainders backwards: ' + ok + '.' }; }
    if (pick === 1) { const a = rnd(2, 5), b = rnd(3, 6), ok = String(a * b); const o = new Set([ok, String(a + b), String(a * b - a), String(a * (b + 1))]); return { q: 'What does this print?\ntotal = 0\nfor i in range(' + b + '):\n    total += ' + a + '\nprint(total)', o: Array.from(o), okTxt: ok, why: 'The loop runs ' + b + ' times and adds ' + a + ' each time.' }; }
    if (pick === 2) { const b = KB.bigO[rnd(0, KB.bigO.length - 1)]; return { q: 'What is the time complexity?\n' + b[0], o: b[2], okTxt: b[1], why: b[3] }; }
    if (pick === 3) { const n = rnd(17, 250), ok = n.toString(16).toUpperCase(); const o = new Set([ok]); while (o.size < 4) o.add(rnd(17, 250).toString(16).toUpperCase()); return { q: 'What is ' + n + ' in hexadecimal?', o: Array.from(o), okTxt: ok, why: n + ' = ' + Math.floor(n / 16) + ' × 16 + ' + (n % 16) + ', written ' + ok + '.' }; }
    if (pick === 4) { const n = rnd(4, 7), k = 2, ok = String(n * (n - 1) / 2); const o = new Set([ok, String(n * (n - 1)), String(n * k), String(n * n)]); return { q: 'How many ways can you choose ' + k + ' items from ' + n + ' when order does not matter?', o: Array.from(o), okTxt: ok, why: 'C(' + n + ', 2) = ' + n + ' × ' + (n - 1) + ' / 2 = ' + ok + '.' }; }
    const a = rnd(13, 60), m = rnd(5, 9), ok = String(a % m); const o = new Set([ok]); while (o.size < 4) o.add(String(rnd(0, m + 2))); return { q: 'What is ' + a + ' mod ' + m + '?', o: Array.from(o), okTxt: ok, why: a + ' = ' + Math.floor(a / m) + ' × ' + m + ' + ' + ok + '.' };
  }
  async function revisionSet() { // personalised: questions the student got wrong before, then the current course
    const u = st(); const out = []; const keys = Object.keys(u.missed).sort((a, b) => u.missed[b] - u.missed[a]).slice(0, 12);
    for (const k of keys) { const p = k.split(':'); const c = U.courseById(p[0]); if (!c) continue; try { const d = await U.loadCourse(c.id); const q = /^x/.test(p[1]) ? d.exam.items[+p[1].slice(1)] : (d.lessons[+p[1]] || { quiz: [] }).quiz[+p[2]]; if (q && q.type === 'mc') out.push(Object.assign({ from: c.code + ' (you missed this before)' }, q)); } catch (e) {} if (out.length >= 4) break; }
    const c = (ctx && U.courseById(ctx.course)) || U.nextUp();
    if (c && out.length < 5) { try { const d = await U.loadCourse(c.id); const pool = []; d.lessons.forEach((l, i) => { if (U.lessonDone(c.id, i) || ctx) l.quiz.forEach((q) => pool.push(Object.assign({ from: c.code }, q))); }); while (out.length < 5 && pool.length) out.push(pool.splice(rnd(0, pool.length - 1), 1)[0]); } catch (e) {} }
    return out;
  }
  function asQuiz(qs, intro) { const id = 'pq' + Date.now(); return { html: '<p>' + intro + '</p><div class="u-check" id="' + id + '">' + U.quizHtml(qs) + '</div>', after: (el) => U.bindQuiz($('#' + id, el), qs, () => { const p = document.createElement('p'); p.innerHTML = '<b>All correct.</b> Ask for another set whenever you like.'; $('#' + id, el).appendChild(p); }) }; }
  function generated(n) { const qs = []; for (let i = 0; i < n; i++) { const g = genQuestion(); const o = g.o.slice(0, 4); qs.push({ q: g.q, o, a: o.indexOf(g.okTxt), why: g.why }); } return qs.filter((q) => q.a >= 0); }

  /* ---------- built-in tutor: mode-specific guidance ---------- */
  const ARCH = ['<b>Purpose:</b> who uses it, and what is the one thing it must never get wrong?', '<b>Load:</b> how many users, requests per second and how much data, now and in two years? Put numbers on it.', '<b>Data:</b> what is the source of truth for each piece of data? What must be consistent immediately, and what may lag?', '<b>Failure:</b> what happens when each dependency is slow or down? Which failures do users see?', '<b>Security:</b> where does untrusted input enter? Who is allowed to do what, and where is that enforced?', '<b>Change:</b> which part will change most often? Is it isolated behind an interface?', '<b>Operation:</b> how will you know it is broken before users tell you? How do you deploy and roll back?', '<b>Simplicity:</b> what is the simplest design that meets the numbers above? What did you add "just in case"?'];
  const RESEARCH = ['<b>Question:</b> state it in one sentence that could be answered "yes", "no" or with a number. If it cannot, it is still a topic, not a question.', '<b>Prior work:</b> find three papers. Read each in three passes: title, abstract and figures; then the argument; then the details. Write down what each claims and how it shows it.', '<b>Hypothesis:</b> what result would prove you wrong? If nothing could, the hypothesis is not testable.', '<b>Method:</b> what will you measure, against which baseline, on what data? What are the threats to validity?', '<b>Analysis:</b> decide before you run it how you will compare results and what counts as a meaningful difference.', '<b>Writing:</b> claim, evidence, limitation. Say plainly what you did not show.'];

  let socratic = false;
  function studyPlan() {
    const u = st(); const all = U.cat.courses.concat(U.cat.electives || []); const nx = U.nextUp(); const o = U.overall();
    const by = {}; Object.keys(u.missed).forEach((k) => { const id = k.split(':')[0]; if (U.courseById(id)) by[id] = (by[id] || 0) + (+u.missed[k] || 0); });
    const weak = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 3).map((id) => U.courseById(id));
    const ready = all.filter((c) => U.courseUnlocked(c) && U.lessonsDone(c) === c.n && !U.examPassed(c)).slice(0, 3);
    const items = [];
    if (nx) items.push('<b>Next lesson or task:</b> ' + link(U.nextStep(nx).path, E(nx.code + ' ' + nx.title + ' · ' + U.nextStep(nx).label)) + '.');
    ready.forEach((c) => items.push('<b>Ready to be examined:</b> ' + link(['course', c.id, 'exam'], E(c.code + ' ' + c.title)) + '. You have finished every lesson.'));
    weak.forEach((c) => items.push('<b>Revise:</b> ' + link(['course', c.id], E(c.code + ' ' + c.title)) + ', where you have ' + by[c.id] + ' missed answer' + (by[c.id] === 1 ? '' : 's') + ' on record. Say <b>revision</b> and I will ask you those questions again.'));
    const cs = U.currentStage(); if (!U.finalPassed(cs) && U.stageCoursesDone(cs) === U.coursesOf(cs).length) items.push('<b>Stage final:</b> every Stage ' + cs + ' course is complete. ' + link(['final', String(cs)], 'Sit the Stage ' + cs + ' final examination') + '.');
    if (!items.length) items.push('You are up to date. Try the ' + link(['study', 'challenge'], 'weekly challenge') + ' or a ' + link(['career', 'interview'], 'practice interview') + '.');
    return '<p><b>Your study plan</b>, from your own record: ' + o.lesDone + ' of ' + o.les + ' lessons and ' + o.done + ' of ' + o.tot + ' courses complete, study streak ' + U.streak() + ' day' + (U.streak() === 1 ? '' : 's') + '.</p><ol>' + items.map((x) => '<li>' + x + '</li>').join('') + '</ol><p>Short sessions most days work better than one long one. ' + link(['study'], 'Open My study') + ' to set a weekly goal.</p>';
  }

  /* ---------- the built-in provider ---------- */
  // Where to practise what was just asked about (visualiser and practice studio, added in 4.0).
  function practicePointer(text) {
    const n = ' ' + String(text).toLowerCase() + ' '; const out = [];
    if (/\b(sort|sorting|bubble|quicksort|merge sort|insertion sort|selection sort)\b/.test(n)) out.push(link(['visual', 'sort'], 'step through the sorting algorithms'));
    if (/\b(binary search|linear search)\b/.test(n)) out.push(link(['visual', 'search'], 'watch linear and binary search side by side'));
    if (/\b(stack|queue|binary search tree|bst)\b/.test(n) && !/call stack|stack overflow|stack trace/.test(n)) out.push(link(['visual', 'struct'], 'try a stack, a queue and a search tree'));
    if (/\b(recursion|recursive|call stack|base case|hanoi|stack overflow)\b/.test(n)) out.push(link(['visual', 'recur'], 'see the call stack grow and unwind'));
    if (/\b(debug|debugging|bug|off by one)\b/.test(n)) out.push(link(['practice', 'debug'], 'practise on the debugging challenges'));
    if (/\b(code review|review code|pull request)\b/.test(n)) out.push(link(['practice', 'review'], 'practise reviewing code'));
    if (/\b(sql|join|group by|select)\b/.test(n)) out.push(link(['practice', 'sql'], 'practise SQL queries'));
    if (/\b(normali[sz]ation|normal form|1nf|2nf|3nf)\b/.test(n)) out.push(link(['practice', 'normal'], 'try the normalisation exercises'));
    if (/\b(unit test|test case|testing|boundary|mutation)\b/.test(n)) out.push(link(['practice', 'testing'], 'write tests that must catch faulty code'));
    if (/\b(system design|design a|scal(e|ing|ability)|rate limit|architecture)\b/.test(n)) out.push(link(['practice', 'design'], 'work a system-design exercise'));
    return out.length ? '<p class="pill">Practise this: ' + out.slice(0, 3).join(' · ') + '.</p>' : '';
  }
  async function builtin(text) {
    await kb(); const n = norm(text); const hasErr = /error|exception|traceback|segfault|failed|undefined reference|cannot/i.test(text);
    if (pendingOral) { const q = pendingOral; pendingOral = null; return { html: '<p><b>Marking.</b> The expected answer was: <b>' + inline(q.o[q.a]) + '</b>.</p><p>' + inline(q.why) + '</p><p>Compare that with what you wrote. Did you state the key idea, or only something near it? Say "next" for another question.</p>' }; }
    if (/\b(give|tell|show|write)\b.*\b(answer|solution|code)\b|solve (it|this) for me|do (it|my|the) (homework|assignment|lab|exam)/.test(n)) return { html: '<p>I will not hand over a finished answer, because then you would not learn it and the grade would not be yours. Here is what I can do instead:</p><ul><li>Tell me what you have tried and where it goes wrong, and I will point at the gap.</li><li>Say <b>hint</b> for the next hint on the current assignment.</li><li>Paste your code for a review, or paste the error message.</li><li>Ask me to explain the idea you think you are missing.</li></ul>' };
    // personalised study recommendations
    if (/what (should|do|can) i (study|do|learn|revise|work on)|study plan|recommend|where (am|should) i|my (progress|weak|plan)|what next|next step/.test(n)) return { html: studyPlan() };
    // Socratic mode: questions instead of explanations, until switched off
    if (/\bsocratic\b|ask me questions|don t (just )?tell me|make me think/.test(n)) { socratic = !/\b(off|stop|no more)\b/.test(n); return { html: socratic ? '<p><b>Socratic mode is on.</b> When you name a concept I will ask you questions about it instead of explaining, and show the definition only when you say <b>explain</b>. Say "socratic off" to stop. What concept shall we start with?</p>' : '<p>Socratic mode is off. I will explain directly again.</p>' }; }
    // misconception detection: a confident wrong statement gets corrected before anything else
    if (!looksLikeCode(text)) { const mc = (KB.misconceptions || []).find((m) => m[0].test(text)); if (mc) { const c = U.courseById(mc[4]); return { html: '<p><b>That is a common misconception.</b> The idea that ' + E(mc[1]) + ' is not right.</p><p>' + inline(mc[2]) + '</p><p><b>Check yourself:</b> ' + inline(mc[3]) + '</p>' + (c ? '<small class="src">' + link(['course', c.id], 'Covered in ' + E(c.code + ' ' + c.title) + ' →') + '</small>' : '') }; } }
    // worked derivations (always in Mathematics Professor mode; elsewhere when asked to derive or prove)
    if (mode === 'maths' || /\b(derive|derivation|prove|proof|why is|show that|worked)\b/.test(n)) { const dv = (KB.derivations || []).find((d) => d[0].test(text)); if (dv) return { html: '<p><b>' + E(dv[1]) + '</b>, step by step. Cover the next line and try to predict it before you read on.</p><ol>' + dv[2].map((x) => '<li>' + inline(x) + '</li>').join('') + '</ol><p>Now close this and reproduce the argument on paper. If a step does not follow for you, tell me its number.</p>' }; }
    // adaptive: simpler, or an example, for the last concept discussed
    if (lastTerm && /\b(simpler|simple terms|eli5|i (still )?(don t|do not) (understand|get)|confus|too (hard|complicated)|again)\b/.test(n)) return { html: '<p>Let us slow down. In plain words, <b>' + E(lastTerm[0]) + '</b> is this: ' + inline(lastTerm[2]) + '</p><p>Which part is unclear: a word in that sentence, why it is needed, or how to use it? Tell me which and I will take that part alone. It can also help to say it back in your own words; I will tell you what the precise version adds.</p>' + (U.courseById(lastTerm[4]) ? '<small class="src">' + link(['course', lastTerm[4]], 'See the worked examples in ' + E(U.courseById(lastTerm[4]).code) + ' →') + '</small>' : '') };
    if (socratic && !/^(explain|define|tell me)\b/.test(n)) { const tm = findTerm(text); if (tm) { lastTerm = tm; return { html: '<p>Before I explain <b>' + E(tm[0]) + '</b>, think about these and answer in your own words:</p><ol><li>What problem does it solve? What would you have to do without it?</li><li>Give the smallest example you can think of.</li><li>When would it be the wrong choice?</li><li>How is it different from the closest thing you already know?</li></ol><p>Write your answers, then say <b>explain</b> to compare them with the definition.</p>' }; } }
    if (looksLikeCode(text) && !/^(explain|what is|what does)/i.test(text.trim())) return { html: review(text) };
    if (hasErr && text.length < 1500) { const h = errorHelp(text); if (h) return { html: h + '<p>Try those steps, then tell me what you found. If you paste the code I will review it.</p>' }; }
    if (/\bhints?\b/.test(n)) {
      if (mode === 'examiner') return { html: '<p>Examiner mode gives no hints. Switch to Programming Tutor if you want guidance.</p>' };
      const c = ctx && U.courseById(ctx.course); if (c) { try { const d = await U.loadCourse(c.id); const hs = (d.lab && d.lab.hints) || []; if (hs.length) { labHint = Math.min(hs.length, labHint + 1); return { html: '<p><b>Hint ' + labHint + ' of ' + hs.length + ' for the ' + E(c.code) + ' assignment:</b> ' + inline(hs[labHint - 1]) + '</p>' + (labHint >= hs.length ? '<p class="pill">That was the last hint. If you are still stuck, tell me what your code does now and what you expected.</p>' : '<p class="pill">Try it before asking for the next one.</p>') }; } } catch (e) {} }
      return { html: '<p>Open a course assignment and press "Ask the professor" there, and I can give its hints one at a time. For anything else, tell me what you have tried so far.</p>' };
    }
    if (/\b(quiz|test me|practice|practise|exercise|revision|revise|exam prep|prepare|next|another)\b/.test(n) || mode === 'examiner') {
      if (mode === 'examiner') { const qs = await revisionSet(); const q = qs[0] || (() => { const g = generated(1)[0]; return g; })(); if (!q) return { html: '<p>I have no questions for you yet. Complete a lesson first.</p>' }; pendingOral = q; return { html: '<p><b>Examination question' + (q.from ? ' · ' + E(q.from) : '') + '.</b></p>' + U.qText(q.q) + '<p>Write your answer in your own words and send it. No options, no hints.</p>' }; }
      const mine = /revis|exam|prepare|missed|weak/.test(n) ? await revisionSet() : [];
      if (mine.length) return asQuiz(mine, '<b>Personal revision set.</b> Questions you missed earlier come first, then questions from ' + (ctx && U.courseById(ctx.course) ? 'this course' : 'your current course') + '.');
      return asQuiz(generated(3), '<b>Three practice questions</b>, freshly generated. Say "revision" for questions drawn from your own missed answers.');
    }
    if (/walk|trace|step by step|steps|how does .* work|show me how/.test(n) || mode === 'algo') { const w = walkthrough(text); if (w) return { html: w }; }
    if (/more detail|technical|deeper|formal/.test(n) && lastTerm) return { html: '<p><b>' + E(lastTerm[0]) + ', more precisely:</b> ' + inline(lastTerm[3]) + '</p>' };
    if (mode === 'architect' && (text.length > 120 || /design|architecture|system|review/.test(n))) return { html: '<p><b>Architecture review.</b> I cannot judge your design the way an experienced engineer would, but these are the questions one would ask. Answer each in writing; the weak spots show themselves.</p><ol>' + ARCH.map((x) => '<li>' + x + '</li>').join('') + '</ol><p>Then write it up as an architecture decision record: context, decision, alternatives, consequences.</p>' };
    if (mode === 'research' && (text.length > 60 || /research|paper|thesis|experiment|study|question/.test(n))) return { html: '<p><b>Research supervision checklist.</b> Work through these in order and bring me the one you are stuck on.</p><ol>' + RESEARCH.map((x) => '<li>' + x + '</li>').join('') + '</ol>' + (U.courseById('c510') ? '<small class="src">' + link(['course', 'c510'], 'Research Methods course →') + '</small>' : '') };
    const w = walkthrough(text); if (w && /\d/.test(text)) return { html: w };
    const ex = await explain(text); if (ex) return { html: ex };
    return { html: '<p>I do not have a prepared answer for that. I am a built-in tutor that works from fixed rules and the course text, not an AI model, so I cannot answer open questions.</p><p>Things I can do well:</p><ul><li><b>Explain a concept</b>: name it, for example "what is recursion?" or "explain hash tables".</li><li><b>Review code</b>: paste it.</li><li><b>Explain an error</b>: paste the message.</li><li><b>Trace an algorithm</b>: "walk through binary search on 3 8 15 21 for 15".</li><li><b>Practice</b>: "quiz me" or "revision".</li><li><b>Hints</b> for the current assignment: "hint".</li><li><b>A study plan</b> from your own record: "what should I study next?"</li><li><b>Worked derivations</b>: "derive the sum 1 to n", "why is merge sort n log n", "Bayes".</li><li><b>Socratic mode</b>: "socratic" makes me ask instead of tell.</li></ul>' };
  }

  /* ---------- provider: your own server endpoint ---------- */
  async function remote(text) {
    const c = ctx && U.courseById(ctx.course); const m = MODES.find((x) => x[0] === mode);
    const body = { mode, system: m[3] + ' ' + TEACH + (c ? ' The student is studying ' + c.code + ' ' + c.title + (ctx.lesson !== undefined ? ', lesson ' + (+ctx.lesson + 1) : '') + ' (Stage ' + c.stage + ' of 6).' : ''), messages: log.filter((x) => x.plain).slice(-12).map((x) => ({ role: x.who === 'me' ? 'user' : 'assistant', content: x.plain.slice(0, 6000) })).concat([{ role: 'user', content: text.slice(0, 6000) }]) };
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
    try { const r = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (!j || typeof j.reply !== 'string' || !j.reply.trim()) throw new Error('empty reply'); return { html: '<div class="u-prose">' + md(j.reply.slice(0, 20000)) + '</div>', plain: j.reply, ai: true }; }
    finally { clearTimeout(t); }
  }

  /* ---------- view ---------- */
  U.lazy.professor = async function (path) {
    const c = U.courseById(path[1]); ctx = c ? { course: c.id, lesson: /^\d+$/.test(path[2] || '') ? +path[2] : undefined, lab: path[2] === 'lab' } : null; labHint = 0; pendingOral = null;
    const on = !!endpoint(); const label = String(U.cfg.aiLabel || 'an AI model').replace(/[<>]/g, '').slice(0, 40);
    let h = '<section class="u-stagehero"><p class="u-eyebrow">🤖 AI Professor</p><h1>A tutor that teaches instead of answering for you</h1><p>Ask for an explanation, paste code for review, paste an error, ask for a step-by-step trace, or ask to be quizzed. The professor gives hints before answers and will not complete graded work for you.</p></section>' +
      '<div class="up-status ' + (on ? 'on' : 'off') + '" role="note">' + (on ? '<b>Connected to ' + E(label) + '.</b> Your messages on this tab are sent to this site\'s own AI service (a Cloudflare Worker running the model on Cloudflare Workers AI). Nothing is stored there. Do not paste passwords or private information. If the service fails, the built-in tutor answers instead.' : '<b>No AI model is connected to this site.</b> You are using the <b>built-in tutor</b>: fixed rules plus the course text. It works offline and costs nothing, but it is not an AI and cannot answer open questions. The site owner can connect a real model later without changing anything else (see <code>uni/README.md</code>).') + '</div>' +
      (c ? '<p class="pill">Context: ' + E(c.code + ' ' + c.title) + (ctx.lesson !== undefined ? ' · lesson ' + (ctx.lesson + 1) : ctx.lab ? ' · programming assignment' : '') + '. ' + link(['professor'], 'Clear context') + '</p>' : '') +
      '<h2 class="u-h2">Teaching mode</h2><div class="up-modes" role="group" aria-label="Teaching mode">' + MODES.map((m) => '<button type="button" class="up-mode" data-mode="' + m[0] + '" aria-pressed="' + (m[0] === mode) + '"><b>' + m[1] + '</b><small>' + m[2] + '</small></button>').join('') + '</div>' +
      '<div class="up-chatwrap"><div><div class="up-log" id="upLog" role="log" aria-live="polite" aria-label="Conversation" tabindex="0"></div><form class="up-chat" id="upForm"><label class="pill" for="upIn">Your message (Enter to send, Shift+Enter for a new line)</label><textarea id="upIn" rows="4" maxlength="8000" placeholder="Ask a question, or paste code or an error message"></textarea><div class="row"><button type="submit" class="btn primary">Send</button><button type="button" class="btn small" id="upClear">Clear conversation</button></div></form></div>' +
      '<aside class="up-side"><h3>Try one of these</h3><div class="up-quick">' + ['What should I study next?', 'What is recursion?', 'Explain Big O', 'Derive why merge sort is n log n', 'Socratic mode', 'Hashing is a kind of encryption, right?', 'Walk through binary search on 3 8 15 21 29 for 21', 'Walk through merge sort on 7 2 9 4 1', 'Quiz me', 'Revision from my missed questions'].concat(c && ctx.lab ? ['Hint'] : []).map((q) => '<button type="button" data-q="' + E(q) + '">' + E(q) + '</button>').join('') + '</div><p class="u-fine">The conversation is kept only until you leave this page. It is not saved or uploaded' + (on ? ' by this site beyond the request itself' : '') + '.</p></aside></div>';
    shell('professor', h, [['University', []], ['AI Professor']]);
    const logEl = $('#upLog');
    const push = (who, html, plain, after, src) => { log.push({ who, html, plain }); const d = document.createElement('div'); d.className = 'up-msg ' + who; if (who === 'me') d.textContent = plain; else d.innerHTML = html + (src ? '<small class="src">' + src + '</small>' : ''); logEl.appendChild(d); if (after) after(d); logEl.scrollTop = logEl.scrollHeight; return d; };
    const greet = () => { const m = MODES.find((x) => x[0] === mode); push('prof', '<p><b>' + m[1] + '.</b> ' + m[2] + '</p><p>' + (mode === 'examiner' ? 'Say "begin" and I will ask you a question from your courses.' : mode === 'review' ? 'Paste the code you want reviewed.' : mode === 'architect' ? 'Describe the system you are designing.' : mode === 'research' ? 'Tell me the topic you want to investigate.' : 'What are you working on?') + '</p>'); };
    log = []; greet();
    $$('.up-mode').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; pendingOral = null; $$('.up-mode').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); greet(); }));
    let busy = false;
    const send = async (text) => {
      text = String(text || '').trim(); if (!text || busy) return; busy = true; push('me', '', text.slice(0, 8000));
      const wait = push('prof', '<p class="pill">Thinking…</p>'); log.pop();
      let ans = null, src = '';
      if (on) { try { ans = await remote(text); src = 'Answered by ' + E(label) + '. AI answers can be wrong; check anything important.'; } catch (e) { src = /HTTP 429/.test(String(e && e.message)) ? 'The AI is busy (too many questions in a minute, or today\'s free limit is used up), so the built-in tutor replied. Try again in a minute.' : !navigator.onLine ? 'You are offline, so the built-in tutor replied.' : 'The AI service did not answer, so the built-in tutor replied.'; } }
      if (!ans) { try { ans = await builtin(text); const pt = practicePointer(text); if (pt && ans && ans.html && mode !== 'examiner') ans.html += pt; } catch (e) { ans = { html: '<p>The built-in tutor could not load its notes (you may be offline and they are not saved on this device yet).</p>' }; } if (!src) src = 'Built-in tutor (not an AI model)'; }
      wait.remove(); push('prof', ans.html, ans.plain || '', ans.after, src); busy = false;
    };
    $('#upForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('#upIn'); const v = t.value; t.value = ''; send(v); });
    $('#upIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#upForm').requestSubmit(); } });
    $('#upClear').addEventListener('click', () => { logEl.innerHTML = ''; log = []; pendingOral = null; greet(); });
    $$('.up-quick button').forEach((b) => b.addEventListener('click', () => send(b.dataset.q)));
  };
})();
