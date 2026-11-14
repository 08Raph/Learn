/* Question-bank answer check (4.3): runs every 'predict the output', 'find the bug' and 'value after this code runs'
   question for Python, JavaScript, TypeScript, SQL, C, C++ and C# through Learn's own engines and compares the result
   with the marked answer. Start a local server first (python3 -m http.server 8765 in the site folder), then:
   node tests/check-bank.js      Known difference: the C++ teaching engine prints bool values as 1/0, so the 100
   C++ comparison questions are reported although their answers (true/false) are correct (tests/e2e-app.js checks them). */
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.route(/googleapis|gstatic|firebase|judge0|emkc|wandbox/, (r) => r.abort());
  await p.goto('http://localhost:8765/index.html#/uni'); await p.waitForFunction(() => window.LearnUniversity && window.LearnUniversity.ready, null, { timeout: 20000 });
  const bank = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', 'ranked_extra.json'), 'utf8')); const items = [];
  for (const k of ['py', 'js', 'ts', 'sql', 'c', 'cpp', 'cs']) bank[k].forEach((q, i) => { const l0 = q.code.split('\n')[0]; if (/(Predict|Find the bug|What does this|after this code runs)/i.test(l0)) items.push({ k, i, code: q.code, opts: q.options, a: q.answer, l0 }); });
  const res = await p.evaluate(async (items) => { const A = window.LearnUniversity.api; const HEAD = { c: '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <math.h>\n\n', cpp: '#include <iostream>\n#include <string>\n#include <vector>\n#include <map>\n#include <algorithm>\nusing namespace std;\n\n' };
    const bad = []; for (const it of items) { let code = it.code; const v = /value of (\w+)/.exec(it.l0);
      if (v) code += it.k === 'c' ? '\nprintf("%d", ' + v[1] + ');' : it.k === 'cpp' ? '\ncout << boolalpha << ' + v[1] + ';' : '\nConsole.WriteLine(' + v[1] + (/bool/.test(code) ? '.ToString().ToLower()' : '') + ');';
      if (it.k === 'c' || it.k === 'cpp') code = HEAD[it.k] + (it.k === 'c' ? 'int main(void) {\n' : 'int main() {\n') + code + '\n    return 0;\n}';
      let r; try { r = await A.runCodeAsync(it.k, code, ''); } catch (e) { r = { out: '', error: String(e.message) }; }
      let o = String(r.out || '').trim(); const err = r.error ? String(r.error) : ''; if (it.k === 'sql') { const ls = o.split('\n').filter((l) => !/^\(\d+ rows?\)$/.test(l) && !/^-+$/.test(l)); o = ls[ls.length - 1] || ''; }
      const ans = String(it.opts[it.a]); const norm = (x) => String(x).trim().replace(/^"(.*)"$/s, '$1').replace(/\s+/g, ' ');
      let ok; if (/Find the bug/i.test(it.l0)) ok = !!err || /undefined|error|exception|out of range/i.test(o + ' ' + ans); else if (/^error$/i.test(ans)) ok = !!err; else ok = !err && (norm(o) === norm(ans) || norm(o.split('\n').pop()) === norm(ans));
      if (!ok) bad.push({ k: it.k, i: it.i, code: it.code.slice(0, 150), ans, got: err ? 'ERR ' + err.slice(0, 90) : o.slice(0, 90) }); }
    return { n: items.length, bad }; }, items);
  const by = {}; res.bad.forEach((x) => { by[x.k] = (by[x.k] || 0) + 1; }); console.log('checked', res.n, 'mismatches', res.bad.length, JSON.stringify(by)); res.bad.slice(0, 10).forEach((x) => console.log(JSON.stringify(x))); await b.close(); })();
