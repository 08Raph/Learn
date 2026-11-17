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
footer{margin-top:40px;border-top:1px solid var(--border);padding-top:16px;font-size:15px;color:var(--muted)}`;
function page(o) {
  return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${E(o.title)}</title><meta name="description" content="${E(o.desc)}"><link rel="canonical" href="${SITE}${o.file}">
<meta property="og:type" content="website"><meta property="og:title" content="${E(o.title)}"><meta property="og:description" content="${E(o.desc)}"><meta property="og:url" content="${SITE}${o.file}"><meta property="og:image" content="${SITE}og-image.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="favicon.png"><link rel="apple-touch-icon" href="apple-touch-icon.png"><style>${css}</style>
<script type="application/ld+json">${JSON.stringify(o.ld)}</script></head>
<body><div class="w"><header><a href="./">🎓 Learn to Code</a></header><main>${o.body}</main>
<footer><nav aria-label="Courses">${Object.entries(SLUG).map(([k, s]) => `<a href="learn-${s}.html">${E(o.names[k])}</a>`).join('')}<a href="software-engineering.html">Software engineering pathway</a></nav>
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
  global.window = {}; require(path.join(ROOT, 'uni', 'data', 'catalog.js')); const U = global.window.LEARN_CATALOG || Object.values(global.window)[0];
  const file = 'software-engineering.html'; files.push(file);
  const body = `<h1>A free software-engineering study pathway</h1><p class="lead">Six stages, from a complete beginner to master's-level topics: ${U.courses.length} courses with lessons, worked examples, labs, examinations and projects. Self-paced, free and in your browser. It is <b>not an accredited degree</b>: certificates are completion records of this website.</p>
<a class="cta" href="./#/uni">Open the University</a>${U.stages.map((s) => `<h2>Stage ${s.id}: ${E(s.title)}</h2><p class="muted">${E(s.level)}. ${E(s.blurb || '')}</p><ul>${U.courses.filter((c) => c.stage === s.id).map((c) => `<li><b>${E(c.code)}</b> ${E(c.title)}</li>`).join('')}</ul>`).join('')}<a class="cta" href="./#/uni">Start Stage 1</a>`;
  fs.writeFileSync(path.join(ROOT, file), page({ file, names, title: 'Free software engineering pathway: ' + U.courses.length + ' courses | Learn to Code', desc: 'A free, self-paced software-engineering pathway in six stages, from beginner to advanced: ' + U.courses.length + ' courses with labs, exams and projects. Not an accredited degree.', body,
    ld: { '@context': 'https://schema.org', '@type': 'Course', name: 'Software engineering pathway', description: 'Free, self-paced six-stage pathway. Not an accredited degree.', provider: { '@type': 'Organization', name: 'Learn to Code by 08Raph', url: SITE }, isAccessibleForFree: true, url: SITE + file, hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online' }, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' } } }));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [''].concat(files).map((f) => '  <url><loc>' + SITE + f + '</loc><lastmod>' + today + '</lastmod></url>').join('\n') + '\n</urlset>\n');
  console.log('wrote', files.length, 'pages and sitemap.xml');
})();
