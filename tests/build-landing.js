/* Builds the search-engine landing pages (learn-<language>.html, software-engineering.html) and sitemap.xml from the
   app's own lesson list and the University catalog, so they never disagree with the app.
   Run from the app folder after changing lessons:  node tests/build-landing.js   (needs a local server on PORT 8790) */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = process.env.APP_DIR || path.join(__dirname, '..'); const SITE = 'https://08raph.github.io/Learn/';
const SLUG = { py: 'python', js: 'javascript', ts: 'typescript', c: 'c', cpp: 'cpp', cs: 'csharp', sql: 'sql', java: 'java', go: 'go', rust: 'rust', php: 'php', ruby: 'ruby', swift: 'swift', kotlin: 'kotlin', bash: 'bash' };
const BLURB = {
  py: 'Python is the most popular first language: readable, used for automation, data science, AI and web servers.',
  js: 'JavaScript runs every interactive website and, with Node.js, servers too. It is the language of the web.',
  ts: 'TypeScript is JavaScript with types: the same language, with mistakes caught before the code runs.',
  c: 'C is the language under operating systems and devices. Learning it shows how memory and computers really work.',
  cpp: 'C++ powers games, browsers and fast software. It adds classes, templates and the standard library to C.',
  cs: 'C# is used for Windows apps, Unity games and web services with .NET. Clear, modern and strongly typed.',
  sql: 'SQL is how every company asks questions of its data. Learn to query, join, group and change databases.',
  java: 'Java runs Android apps, banks and large company systems. Strongly typed, object-oriented and everywhere.',
  go: 'Go is Google\'s simple, fast language for servers, cloud tools and anything that must handle many things at once.',
  rust: 'Rust is fast like C++ but prevents whole classes of memory bugs. Loved for systems, tools and WebAssembly.',
  php: 'PHP runs a large part of the web, including WordPress. Quick to start with for building websites.',
  ruby: 'Ruby is designed to be pleasant to write. Famous for Ruby on Rails and for clear, expressive code.',
  swift: 'Swift is Apple\'s language for iPhone, iPad and Mac apps: safe, modern and fast.',
  kotlin: 'Kotlin is the modern language for Android apps, and runs anywhere Java does with less code.',
  bash: 'Bash is the language of the terminal. Automate your computer, chain tools together and work like a developer.' };
const ONLINE = ['java', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'bash']; // run on an online service (see RemoteRun in app.js)
const E = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const css = `:root{--bg:#f6f7fb;--text:#141a33;--muted:#4a5272;--card:#fff;--border:#d5dcef;--accent:#2333d6;--accent-ink:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0a1030;--text:#e9ecff;--muted:#a9b0d6;--card:#141b45;--border:#2a3470;--accent:#8fa2ff;--accent-ink:#0a1030}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.w{max-width:960px;margin:0 auto;padding:24px 16px 48px}header a{color:var(--text);font-weight:800;text-decoration:none;font-size:20px}
h1{font-size:clamp(32px,6vw,52px);line-height:1.1;margin:28px 0 12px}.lead{font-size:19px;color:var(--muted);max-width:720px}
.cta{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:14px;background:var(--accent);color:var(--accent-ink);font-weight:800;text-decoration:none;margin:10px 10px 0 0}
.cta.alt{background:transparent;color:var(--text);border:1px solid var(--border)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:18px 0}.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}
.card h3{margin:0 0 6px}ol{padding-left:22px}li{margin:3px 0}.muted{color:var(--muted)}a{color:var(--accent)}nav a{margin-right:14px;display:inline-block;min-height:32px}
code,pre{font:15px/1.5 ui-monospace,Menlo,Consolas,monospace}code{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:1px 6px}pre{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;overflow-x:auto}
details{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 14px;margin:12px 0}summary{cursor:pointer;font-weight:700;min-height:32px}.tag{display:inline-block;border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:14px;margin-right:6px;color:var(--muted)}
footer{margin-top:40px;border-top:1px solid var(--border);padding-top:16px;font-size:15px;color:var(--muted)}`;
function page(o) {
  return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${E(o.title)}</title><meta name="description" content="${E(o.desc)}"><link rel="canonical" href="${SITE}${o.file}">
<meta property="og:type" content="website"><meta property="og:title" content="${E(o.title)}"><meta property="og:description" content="${E(o.desc)}"><meta property="og:url" content="${SITE}${o.file}"><meta property="og:image" content="${SITE}og-image.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="favicon.png"><link rel="apple-touch-icon" href="apple-touch-icon.png"><style>${css}</style>
<script type="application/ld+json">${JSON.stringify(o.ld)}</script></head>
<body><div class="w"><header><a href="./">🎓 Learn to Code</a></header><main>${o.body}</main>
<footer><nav aria-label="Courses">${Object.entries(SLUG).map(([k, s]) => `<a href="learn-${s}.html">${E(o.names[k])}</a>`).join('')}<a href="software-engineering.html">Software engineering pathway</a><a href="coding-challenges.html">Coding challenges</a></nav>
<p>Learn to Code is free and needs no account. Made by 08Raph. It is a self-study website, not an accredited school.</p></footer></div></body></html>\n`;
}
(async () => {
  const PORT = 8790; const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1000));
  const b = await chromium.launch(); const p = await (await b.newContext({ serviceWorkers: 'block' })).newPage(); await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.goto('http://localhost:' + PORT + '/index.html#/'); await p.waitForFunction(() => !!window.__learnCatalog); const cat = await p.evaluate(() => window.__learnCatalog());
  await b.close(); srv.kill();
  const names = Object.fromEntries(cat.map((c) => [c.k, c.name])); const files = [];
  for (const c of cat) {
    if (!SLUG[c.k]) continue; const file = 'learn-' + SLUG[c.k] + '.html'; files.push(file); const n = c.lessons.length;
    const body = `<h1>Learn ${E(c.name)} for free</h1><p class="lead">${E(BLURB[c.k])} ${n} interactive lessons take you from your first line to professional level. You write real ${E(c.name)} in the browser and get instant feedback: no installs, no account, no cost.</p>
<a class="cta" href="./#/${c.k}/${E(c.lessons[0].id)}">Start lesson 1 now</a><a class="cta alt" href="./#/play/${c.k}">Open the ${E(c.name)} playground</a>
<div class="grid"><div class="card"><h3>✍️ Write real code</h3><p class="muted">Every lesson ends with code you write and run yourself, checked automatically.</p></div><div class="card"><h3>🤖 AI hints</h3><p class="muted">Stuck? Ask the AI for a hint about your own code. It explains instead of giving the answer.</p></div><div class="card"><h3>🧩 Practice</h3><p class="muted">Coding challenges with hidden tests, 10-question drills and a review list of your mistakes.</p></div>${ONLINE.includes(c.k) ? '<div class="card"><h3>📱 Any device</h3><p class="muted">Works on an iPad, phone or computer. Running ' + E(c.name) + ' code needs an internet connection; reading lessons works offline.</p></div>' : '<div class="card"><h3>📱 Works offline</h3><p class="muted">Install it on an iPad, phone or computer and keep learning without internet.</p></div>'}</div>
<h2>All ${n} ${E(c.name)} lessons</h2><ol>${c.lessons.map((l) => `<li><a href="./#/${c.k}/${E(l.id)}">${E(l.title)}</a> <span class="muted">· ${E(l.concept)}</span></li>`).join('')}</ol>
<a class="cta" href="./#/${c.k}/${E(c.lessons[0].id)}">Start learning ${E(c.name)}</a>`;
    fs.writeFileSync(path.join(ROOT, file), page({ file, names, title: 'Learn ' + c.name + ' free: ' + n + ' interactive lessons | Learn to Code', desc: 'Learn ' + c.name + ' for free with ' + n + ' interactive lessons. Write and run real code in your browser, get instant feedback and AI hints. No account needed.', body,
      ld: { '@context': 'https://schema.org', '@type': 'Course', name: 'Learn ' + c.name, description: BLURB[c.k], provider: { '@type': 'Organization', name: 'Learn to Code by 08Raph', url: SITE }, isAccessibleForFree: true, inLanguage: 'en', url: SITE + file, hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT' + Math.round(n * 0.25) + 'H' }, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' } } }));
  }
  global.window = {}; require(path.join(ROOT, 'uni', 'data', 'catalog.js')); require(path.join(ROOT, 'uni', 'data', 'departments.js')); const U = global.window.UNI_CATALOG;
  const file = 'software-engineering.html'; files.push(file);
  const body = `<h1>A free software-engineering study pathway</h1><p class="lead">Six stages, from a complete beginner to master's-level topics: ${U.courses.length} courses with lessons, worked examples, labs, examinations and projects. Self-paced, free and in your browser. It is <b>not an accredited degree</b>: certificates are completion records of this website.</p>
<a class="cta" href="./#/uni">Open the University</a>${U.stages.map((s) => `<h2>Stage ${s.id}: ${E(s.title)}</h2><p class="muted">${E(s.level)}. ${E(s.blurb || '')}</p><ul>${U.courses.filter((c) => c.stage === s.id).map((c) => `<li><a href="course-${E(c.id)}.html"><b>${E(c.code)}</b> ${E(c.title)}</a></li>`).join('')}</ul>`).join('')}<h2>Electives</h2><p class="muted">Optional courses that do not count toward the six stages.</p><ul>${(U.electives || []).map((c) => `<li><a href="course-${E(c.id)}.html"><b>${E(c.code)}</b> ${E(c.title)}</a></li>`).join('')}</ul><a class="cta" href="./#/uni">Start Stage 1</a>`;
  fs.writeFileSync(path.join(ROOT, file), page({ file, names, title: 'Free software engineering pathway: ' + U.courses.length + ' courses | Learn to Code', desc: 'A free, self-paced software-engineering pathway in six stages, from beginner to advanced: ' + U.courses.length + ' courses with labs, exams and projects. Not an accredited degree.', body,
    ld: { '@context': 'https://schema.org', '@type': 'Course', name: 'Software engineering pathway', description: 'Free, self-paced six-stage pathway. Not an accredited degree.', provider: { '@type': 'Organization', name: 'Learn to Code by 08Raph', url: SITE }, isAccessibleForFree: true, url: SITE + file, hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online' }, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' } } }));

  /* 5.4: one page per University course (lessons read from the course text files) */
  const lessonsOf = {}; for (const f of fs.readdirSync(path.join(ROOT, 'uni', 'data')).filter((x) => /\.txt$/.test(x))) {
    let cur = null; for (const line of fs.readFileSync(path.join(ROOT, 'uni', 'data', f), 'utf8').split('\n')) {
      const mc = /^#COURSE (\S+)/.exec(line); if (mc) { cur = mc[1]; lessonsOf[cur] = lessonsOf[cur] || []; continue; }
      const ml = /^#LESSON (.+?) \| (\d+)/.exec(line); if (ml && cur) lessonsOf[cur].push({ t: ml[1], min: +ml[2] }); } }
  const allC = U.courses.concat(U.electives || []); const byId = Object.fromEntries(allC.map((c) => [c.id, c]));
  const stageOf = Object.fromEntries(U.stages.map((s) => [s.id, s]));
  for (const c of allC) {
    const f2 = 'course-' + c.id + '.html'; files.push(f2); const ls = lessonsOf[c.id] || [];
    const st = c.stage ? stageOf[c.stage] : null; const pre = (c.pre || []).map((id) => byId[id]).filter(Boolean);
    const b2 = `<p class="muted"><a href="software-engineering.html">Software engineering pathway</a> › ${st ? 'Stage ' + st.id + ': ' + E(st.title) : 'Elective'}</p>
<h1>${E(c.code)}: ${E(c.title)}</h1><p class="lead">${E(c.desc)}</p>
<p><span class="tag">Free</span><span class="tag">${ls.length} lessons</span>${c.hrs ? `<span class="tag">about ${E(c.hrs)} hours</span>` : ''}${c.lab ? '<span class="tag">programming assignment</span>' : ''}<span class="tag">examination</span>${c.project ? '<span class="tag">project</span>' : ''}</p>
<a class="cta" href="./#/uni/course/${E(c.id)}">Start this course</a>
${(c.obj || []).length ? `<h2>What you will learn</h2><ul>${c.obj.map((o) => `<li>${E(o)}</li>`).join('')}</ul>` : ''}
<h2>Lessons</h2><ol>${ls.map((l) => `<li>${E(l.t)} <span class="muted">· ${l.min} min</span></li>`).join('')}</ol>
${pre.length ? `<h2>Before this course</h2><ul>${pre.map((p) => `<li><a href="course-${E(p.id)}.html">${E(p.code)} ${E(p.title)}</a></li>`).join('')}</ul>` : '<p class="muted">No earlier course is needed.</p>'}
${(c.skills || []).length ? `<h2>Skills</h2><p>${c.skills.map((s) => `<span class="tag">${E(s)}</span>`).join('')}</p>` : ''}
<p class="muted">Self-paced and free in your browser. Finishing gives a completion record of this website; it is not an accredited university course.</p>
<a class="cta" href="./#/uni/course/${E(c.id)}">Open ${E(c.code)}</a><a class="cta alt" href="software-engineering.html">See all courses</a>`;
    fs.writeFileSync(path.join(ROOT, f2), page({ file: f2, names, title: c.code + ' ' + c.title + ': free course | Learn to Code', desc: (c.desc.length > 150 ? c.desc.slice(0, 147).replace(/\s+\S*$/, '') + '…' : c.desc) + ' Free, ' + ls.length + ' lessons.', body: b2,
      ld: { '@context': 'https://schema.org', '@type': 'Course', name: c.code + ' ' + c.title, description: c.desc, courseCode: c.code, provider: { '@type': 'Organization', name: 'Learn to Code by 08Raph', url: SITE }, isAccessibleForFree: true, inLanguage: 'en', url: SITE + f2, hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT' + (c.hrs || ls.length) + 'H' }, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' } } }));
  }

  /* 5.4: coding challenges: an index page and one page per challenge (problem, examples, hint; never the solution) */
  global.window = {}; require(path.join(ROOT, 'challenges.js')); const CH = global.window.LEARN_CHALLENGES;
  const pyRepr = (v) => v === true ? 'True' : v === false ? 'False' : v === null ? 'None' : typeof v === 'string' ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" : Array.isArray(v) ? '[' + v.map(pyRepr).join(', ') + ']' : String(v);
  const LV = { 1: 'Warm-up', 2: 'Core', 3: 'Tough' };
  for (const c of CH) {
    const f3 = 'challenge-' + c.id + '.html'; files.push(f3); const ex = c.tests.slice(0, 2);
    const same = CH.filter((x) => x.lv === c.lv && x.id !== c.id).slice(0, 5);
    const b3 = `<p class="muted"><a href="coding-challenges.html">Coding challenges</a> › ${LV[c.lv]}</p>
<h1>${E(c.t)} in Python and JavaScript</h1><p class="lead">${E(c.d)}</p><p><span class="tag">${LV[c.lv]}</span><span class="tag">Free</span><span class="tag">${c.tests.length} tests</span></p>
<a class="cta" href="./#/challenges/${E(c.id)}">Solve it now in your browser</a>
<h2>Write this function</h2><p>Python:</p><pre>def ${E(c.py)}(${E(c.p)}):\n    ...</pre><p>JavaScript:</p><pre>function ${E(c.js)}(${E(c.p)}) {\n  ...\n}</pre>
<h2>Examples</h2><ul>${ex.map((t) => `<li><code>${E(c.py + '(' + t.a.map(pyRepr).join(', ') + ')')}</code> returns <code>${E(pyRepr(t.e))}</code></li>`).join('')}</ul>
<p class="muted">The site checks your answer against ${c.tests.length} tests, ${c.tests.length - 2} of them hidden, and you earn XP when they all pass.</p>
<details><summary>💡 Show a hint</summary><p>${E(c.h)}</p></details>
<a class="cta" href="./#/challenges/${E(c.id)}">Solve “${E(c.t)}”</a>
${same.length ? `<h2>More ${LV[c.lv].toLowerCase()} challenges</h2><ul>${same.map((x) => `<li><a href="challenge-${E(x.id)}.html">${E(x.t)}</a></li>`).join('')}</ul>` : ''}`;
    fs.writeFileSync(path.join(ROOT, f3), page({ file: f3, names, title: c.t + ': coding challenge in Python and JavaScript | Learn to Code', desc: c.d + ' Solve it free in your browser with instant tests and a hint.', body: b3,
      ld: { '@context': 'https://schema.org', '@type': 'LearningResource', name: c.t, description: c.d, learningResourceType: 'Coding exercise', educationalLevel: LV[c.lv], programmingLanguage: ['Python', 'JavaScript'], isAccessibleForFree: true, url: SITE + f3, provider: { '@type': 'Organization', name: 'Learn to Code by 08Raph', url: SITE } } }));
  }
  const fi = 'coding-challenges.html'; files.push(fi);
  const bi = `<h1>Free coding challenges in Python and JavaScript</h1><p class="lead">${CH.length} problems in three levels, from warm-ups to tough interview-style questions. Write a function in your browser and the site runs it against hidden tests instantly. No account, no install.</p>
<a class="cta" href="./#/challenges">Open the challenges</a>${[1, 2, 3].map((lv) => `<h2>${LV[lv]}</h2><ul>${CH.filter((c) => c.lv === lv).map((c) => `<li><a href="challenge-${E(c.id)}.html">${E(c.t)}</a> <span class="muted">· ${E(c.d.length > 90 ? c.d.slice(0, 87).replace(/\s+\S*$/, '') + '…' : c.d)}</span></li>`).join('')}</ul>`).join('')}`;
  fs.writeFileSync(path.join(ROOT, fi), page({ file: fi, names, title: CH.length + ' free coding challenges in Python and JavaScript | Learn to Code', desc: CH.length + ' free coding challenges with instant hidden tests, from warm-ups to interview-style problems. Solve them in Python or JavaScript in your browser.', body: bi,
    ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Coding challenges', isAccessibleForFree: true, url: SITE + fi } }));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [''].concat(files).map((f) => '  <url><loc>' + SITE + f + '</loc><lastmod>' + today + '</lastmod></url>').join('\n') + '\n</urlset>\n');
  console.log('wrote', files.length, 'pages and sitemap.xml');
})();
