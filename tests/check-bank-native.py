#!/usr/bin/env python3
"""Runs quiz-bank questions through REAL compilers and interpreters and compares the output
with the marked answer.  Not part of run-all.sh: it needs these tools installed locally
(any that are missing are skipped and reported):
  python3, node, bash, ruby, php, go, rustc, javac/java
Usage (from the app folder):  python3 tests/check-bank-native.py [ranked_extra.json]
Checks: "What does this print?" items (bash, ruby, php, go, rust, java), "What happens here?"
items that claim an error (they must really fail), and Python/JavaScript output items.
Swift and Kotlin are not checked here.  Exits with status 1 if any answer disagrees with the real output."""
import json, re, subprocess, os, sys, tempfile, shutil
B = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'ranked_extra.json', encoding='utf8'))
W = tempfile.mkdtemp(prefix='learn-bank-')
def run(cmd, **kw):
    try: r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, **kw); return r.stdout, r.stderr, r.returncode
    except subprocess.TimeoutExpired: return '', 'TIMEOUT', 1
def go(code):
    pk = [p for p in ['fmt', 'strings', 'strconv', 'sort', 'errors', 'time'] if re.search(r'\b' + p + r'\.', code)]
    src = 'package main\n' + ('import (\n' + '\n'.join('"%s"' % p for p in pk) + '\n)\n' if pk else '') + 'func main() {\n' + code + '\n}\n'
    open(W + '/m.go', 'w').write(src); return run(['go', 'run', 'm.go'], cwd=W, env=dict(os.environ, GOCACHE=W + '/gocache', HOME=W))
def rust(code):
    open(W + '/m.rs', 'w').write('#![allow(unused)]\nfn main() {\n' + code + '\n}\n'); o, e, c = run(['rustc', '--edition', '2021', '-o', W + '/m', 'm.rs'], cwd=W)
    return run([W + '/m']) if c == 0 else ('', e, c)
def java(code):
    open(W + '/Main.java', 'w').write('import java.util.*;\nimport java.util.stream.*;\npublic class Main { public static void main(String[] args) throws Exception {\n' + code + '\n} }\n')
    o, e, c = run(['javac', 'Main.java'], cwd=W); return run(['java', '-cp', W, 'Main']) if c == 0 else ('', e, c)
def simple(ext, cmd, pre=''):
    def f(code): open(W + '/m.' + ext, 'w').write(pre + code + '\n'); return run(cmd + ['m.' + ext], cwd=W)
    return f
R = {'go': (go, 'go'), 'rust': (rust, 'rustc'), 'java': (java, 'javac'), 'php': (simple('php', ['php'], '<?php\n'), 'php'),
     'ruby': (simple('rb', ['ruby']), 'ruby'), 'bash': (simple('sh', ['bash']), 'bash'), 'py': (simple('py', ['python3']), 'python3'), 'js': (simple('js', ['node']), 'node')}
norm = lambda s: re.sub(r'\s+', ' ', s.strip())
n = 0; bad = []; skipped = []
for lang, (fn, tool) in R.items():
    if not shutil.which(tool): skipped.append(lang); continue
    for q in B.get(lang, []):
        ls = q['code'].split('\n'); head = ls[0]
        if len(ls) < 2: continue
        code = '\n'.join(ls[1:]); ans = q['options'][q['answer']]
        if lang in ('py', 'js'):
            if not re.search(r'Predict|What does this|What is .* after this code', head): continue
            n += 1; o, e, c = fn(code); out = o.strip()
            if re.search(r'Find the bug', head): ok = c != 0 or 'undefined' in out
            else: ok = c == 0 and (out == ans.strip().strip('"') or out.split('\n')[-1] == ans.strip().strip('"'))
        elif re.search(r'What does this print\?', head):
            n += 1; o, e, c = fn(code); out = o.strip()
            ok = c == 0 and (norm(out) == norm(ans) or (ans.startswith('(an empty') and out == '') or (ans.startswith('A non-zero status') and out.isdigit() and out != '0'))
        elif re.search(r'What happens here\?|What does this function return\?', head):
            if lang == 'rust' and code.startswith('fn f()'): code += '\nprintln!("{}", f());'
            n += 1; o, e, c = fn(code); out = o.strip()
            fails = bool(re.search(r'not compile|panic|exception|thrown|raised|Error|error|crash|eadlock', ans))
            ok = (c != 0) if fails else (c == 0)
        else: continue
        if not ok: bad.append((lang, q.get('id', ''), head, 'ANSWER=' + ans, 'GOT=' + (out[:80] if c == 0 else 'ERROR ' + (e.strip().split('\n') or [''])[-1][:120])))
shutil.rmtree(W, ignore_errors=True)
print('checked', n, 'questions with real runtimes; mismatches', len(bad), ('; skipped (tool not installed): ' + ', '.join(skipped)) if skipped else '')
for b in bad: print(json.dumps(b, ensure_ascii=False))
sys.exit(1 if bad else 0)
