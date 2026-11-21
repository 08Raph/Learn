// 5.10: runs every Java, Go, Rust, PHP, Ruby and Bash lesson for real, with local compilers set to behave like the
// older versions the online runner (Judge0) uses: Java 13, Go 1.13, Rust 2018 edition, PHP 7.4, Ruby 2.7, Bash 5.0.
//   node tests/online-lessons.js   (needs the app served on :8765; see run-all.sh)
// Checks: every sample solution prints exactly its expected output; every example compiles and runs; no starter
// already prints the answer; no lesson code uses a feature newer than the runner (a list of known ones).
// LIMITS, said plainly: this is local emulation, not Judge0 itself. A language whose compiler is not installed is
// SKIPPED and reported as skipped, never as passed. Swift and Kotlin are not checked here (no compiler in this setup).
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765/index.html';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };
const NEW = {
  go: [[/\bany\b/, 'any (Go 1.18)'], [/\[T\s+(any|comparable)/, 'generics (Go 1.18)'], [/strings\.Cut\b/, 'strings.Cut (Go 1.18)'], [/\bos\.(ReadFile|WriteFile)\b/, 'os.ReadFile (Go 1.16)'], [/(^|[^\w.])(min|max|clear)\(/, 'min/max/clear (Go 1.21)'], [/\b(slices|maps)\./, 'slices/maps packages (Go 1.21)'], [/for\s+\w+\s*:=\s*range\s+\d/, 'range over int (Go 1.22)'], [/\bio\.ReadAll\b/, 'io.ReadAll (Go 1.16)']],
  rust: [[/(println|print|format|eprintln|write|writeln|panic)!\(\s*"[^"]*\{[a-z_][a-z0-9_]*(:[^}]*)?\}/, 'inline format arguments {x} (Rust 1.58)'], [/^\s*let\s+[^=;]+=[^;{]+\belse\s*\{/m, 'let-else (Rust 1.65)'], [/\bmatches!\(/, 'matches! (Rust 1.42)'], [/\.is_(some|ok)_and\(/, 'is_some_and (Rust 1.70)'], [/\.abs_diff\(/, 'abs_diff (Rust 1.60)'], [/\.then_some\(/, 'then_some (Rust 1.62)'], [/\b(i32|u32|usize|i64|u64)::MAX\b/, 'associated MAX constant (Rust 1.43)'], [/\.split_once\(/, 'split_once (Rust 1.52)'], [/\b(BTreeMap|HashMap)::from\(|\bVec::from\(\[/, 'HashMap::from([..]) (Rust 1.56)'], [/for\s+\w+\s+in\s+\[[^\]]*\]\s*\{/, 'arrays by value in for loops (Rust 1.53)']],
  php: [[/__construct\(\s*(public|private|protected)\s/, 'constructor promotion (PHP 8.0)'], [/\bstr_(contains|starts_with|ends_with)\(/, 'str_contains (PHP 8.0)'], [/\bmatch\s*\(/, 'match (PHP 8.0)'], [/\?->/, 'nullsafe ?-> (PHP 8.0)'], [/\bmixed\b/, 'mixed type (PHP 8.0)'], [/\b(int|string|float|bool|array)\|(int|string|float|bool|array|null)\b/, 'union types (PHP 8.0)'], [/(=|\?\?)\s*throw\b/, 'throw expression (PHP 8.0)'], [/\benum\s+\w+/, 'enums (PHP 8.1)'], [/\breadonly\b/, 'readonly (PHP 8.1)'], [/\bnever\b/, 'never type (PHP 8.1)'], [/#\[/, 'attributes (PHP 8.0)']],
  ruby: [[/^\s*def\s+\w+[!?]?(\([^)]*\))?\s*=\s*\S/m, 'endless method (Ruby 3.0)'], [/\{\s*\w+:\s*[,}]|,\s*\w+:\s*[,}]/, 'hash shorthand (Ruby 3.1)']],
  java: [[/\brecord\s+\w+\s*\(/, 'records (Java 16)'], [/case\s+[^:\n]+->/, 'switch arrows (Java 14)'], [/"""/, 'text blocks (Java 15)'], [/\binstanceof\s+\w+\s+\w+\s*[)&|]/, 'instanceof patterns (Java 16)'], [/\.toList\(\)/, 'Stream.toList (Java 16)']],
  bash: [],
};
const has = (cmd) => spawnSync('sh', ['-c', 'command -v ' + cmd], { encoding: 'utf8' }).status === 0;
const TOOLS = { java: ['javac', 'java'], go: ['go'], rust: ['rustc'], php: ['php'], ruby: ['ruby'], bash: ['bash'] };
const norm = (s) => String(s || '').replace(/\r/g, '').replace(/^\n+|\n+$/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').trim();
const GOCACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-gocache-'));
function run(lang, code, stdin) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-run-'));
  const env = Object.assign({}, process.env, { GOTOOLCHAIN: 'local', GOPROXY: 'off', GOFLAGS: '-mod=mod', GO111MODULE: 'on', GOCACHE });
  const ex = (cmd, args, t, input) => spawnSync(cmd, args, { cwd: d, env, input: input || '', encoding: 'utf8', timeout: t * 1000 });
  const clean = (s) => String(s || '').replace(/Picked up JAVA_TOOL_OPTIONS[^\n]*\n?/g, '').trim().slice(0, 300);
  try {
    let r;
    if (lang === 'java') { fs.writeFileSync(d + '/Main.java', code); const c = ex('javac', ['--release', '13', '-nowarn', 'Main.java'], 90); if (c.status) return { err: 'does not compile: ' + clean(c.stderr) }; r = ex('java', ['-cp', '.', 'Main'], 30, stdin); }
    else if (lang === 'go') { fs.writeFileSync(d + '/go.mod', 'module m\n\ngo 1.13\n'); fs.writeFileSync(d + '/main.go', code); const c = ex('go', ['build', '-o', 'x', '.'], 120); if (c.status) return { err: 'does not compile: ' + clean(c.stderr) }; r = ex('./x', [], 30, stdin); }
    else if (lang === 'rust') { fs.writeFileSync(d + '/main.rs', code); const c = ex('rustc', ['--edition', '2018', '-A', 'warnings', '-o', 'x', 'main.rs'], 120); if (c.status) return { err: 'does not compile: ' + clean(c.stderr) }; r = ex('./x', [], 30, stdin); }
    else { const f = { php: 'm.php', ruby: 'm.rb', bash: 'm.sh' }[lang]; fs.writeFileSync(d + '/' + f, code); r = ex(lang, [f], 30, stdin); }
    return { out: r.stdout, err: r.status ? 'exits with an error: ' + clean(r.stderr) : null };
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.addInitScript(() => localStorage.setItem('learn-code-v2', JSON.stringify({ seenPatch: '99' })));
  await p.goto(BASE + '#/'); await p.waitForFunction(() => typeof LANGS !== 'undefined', null, { timeout: 30000 });
  const D = await p.evaluate((ks) => Object.fromEntries(ks.map((k) => [k, LANGS[k].lessons.map((l) => ({ id: l.id, tier: l.tier, solution: l.solution, example: l.example, starter: l.starter, expect: l.expect, stdin: l.stdin }))])), Object.keys(TOOLS));
  await b.close();
  for (const lang of Object.keys(TOOLS)) {
    if (!TOOLS[lang].every(has)) { console.log('  SKIPPED ' + lang + ': ' + TOOLS[lang].join('/') + ' is not installed here, so its lessons were not run'); continue; }
    const bad = { sol: [], ex: [], starter: [], newer: [] };
    for (const l of D[lang]) {
      if (l.solution) { const r = run(lang, l.solution, l.stdin); if (r.err) bad.sol.push(l.id + ' ' + r.err.split('\n')[0]); else if (l.expect != null && norm(r.out) !== norm(l.expect)) bad.sol.push(l.id + ' prints ' + JSON.stringify(norm(r.out).slice(0, 60)) + ', expected ' + JSON.stringify(norm(l.expect).slice(0, 60))); }
      if (l.example) { const r = run(lang, l.example, l.stdin); if (r.err) bad.ex.push(l.id + ' ' + r.err.split('\n')[0]); }
      if (l.starter && l.expect) { const r = run(lang, l.starter, l.stdin); if (!r.err && norm(r.out) === norm(l.expect)) bad.starter.push(l.id); }
      for (const part of ['solution', 'example', 'starter']) for (const [re, label] of NEW[lang]) if (re.test(l[part] || '')) bad.newer.push(l.id + ' ' + part + ': ' + label);
    }
    console.log('  ' + lang + ': ' + D[lang].length + ' lessons run');
    ok(bad.sol.length === 0, lang + ': every sample solution runs and prints exactly its expected output: ' + bad.sol.slice(0, 3).join(' | '));
    ok(bad.ex.length === 0, lang + ': every example is a complete program that runs: ' + bad.ex.slice(0, 3).join(' | '));
    ok(bad.starter.length === 0, lang + ': no starter already prints the answer: ' + bad.starter.join(', '));
    ok(bad.newer.length === 0, lang + ': no lesson uses a feature newer than the online runner: ' + bad.newer.slice(0, 3).join(' | '));
  }
  fs.rmSync(GOCACHE, { recursive: true, force: true });
  console.log(fail + ' failed of ' + (pass + fail)); process.exit(fail ? 1 : 0);
})();
