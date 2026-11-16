/* Screen audit (4.3, extended in 4.5): every main-app and University route at iPad and phone sizes, light and dark. Reports script
   errors, horizontal overflow, small tap targets, unnamed controls, low-contrast text and images without alt text.
   Start a local server first:  python3 -m http.server 8765   (in the site folder), then:  node tests/audit-screens.js
   Writes audit.json in the current folder. Screenshots are not saved. */
// Screen audit: every route at iPad and phone sizes, light and dark. node audit.js > audit.json
const { chromium, devices } = require('playwright'); const fs = require('fs');
const MAIN = ['', 'account', 'week', 'classes', 'certs', 'verify/abcdefghjk23', 'py', 'js', 'ts', 'c', 'cpp', 'cs', 'sql', 'java', 'bash', 'term', 'cloud', 'play/py', 'play/js', 'project', 'web', 'quiz', 'stats', 'duel', 'shop', 'avatar', 'locker', 'catalog'];
const UNI = ['', 'search', 'search/hash-table', 'dashboard', 'study', 'review', 'notes', 'departments', 'departments/game', 'courses', 'stage/1', 'course/c101', 'course/c101/lesson/0', 'course/c101/lab', 'course/c101/exam', 'course/c101/project', 'videos', 'videos/karpathy-build-gpt', 'labs', 'labs/py', 'labs/sql', 'visual', 'practice', 'terminal', 'terminal/conflict', 'exams', 'final/1', 'projects', 'portfolio', 'career', 'career/cv', 'career/interview', 'career/interview/iv-two-sum', 'career/mock', 'career/present', 'career/guide', 'professor', 'transcript'];
const ROUTES = MAIN.map((r) => '#/' + r).concat(UNI.map((r) => '#/uni' + (r ? '/' + r : '')));
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [dev, opt] of [['ipad', devices['iPad (gen 7)']], ['phone', devices['iPhone 13']]]) for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', colorScheme: theme })); await ctx.route(/googleapis|gstatic|firebase|judge0|emkc|wandbox|jsdelivr|youtube/, (r) => r.abort());
    const p = await ctx.newPage(); let errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 160)); });
    await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(1200);
    await p.evaluate((t) => { const S = JSON.parse(localStorage.getItem('learn-code-v2') || '{}'); S.theme = t; localStorage.setItem('learn-code-v2', JSON.stringify(S)); }, theme);
    for (const r of ROUTES) {
      errs = []; await p.goto('http://localhost:8765/index.html' + r); await p.waitForTimeout(r.includes('uni') ? 1600 : 900);
      const res = await p.evaluate(() => {
        const vw = innerWidth, R = { overflow: document.documentElement.scrollWidth - vw, wide: [], small: [], unnamed: [], contrast: [], noalt: 0 };
        const vis = (e) => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const inScroller = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll|hidden)/.test(s.overflowX)) return true; } return false; };
        const desc = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 30) + '"');
        document.querySelectorAll('#app *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.right > vw + 2 && r.width > 0 && vis(e) && !inScroller(e)) R.wide.push(desc(e) + ' right=' + Math.round(r.right)); });
        document.querySelectorAll('#app a[href], #app button, #app input, #app select, #app textarea, #app summary, #app [role=button]').forEach((e) => { if (!vis(e)) return; const r = e.getBoundingClientRect(); const inline = e.tagName === 'A' && /^(P|LI|SPAN|SMALL|TD|LABEL)$/.test(e.parentElement.tagName) && getComputedStyle(e).display === 'inline';
          if (!inline && r.right > 0 && e.type !== 'checkbox' && e.type !== 'radio' && (r.height < 32 || r.width < 32)) R.small.push(desc(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
          if (/^(A|BUTTON)$/.test(e.tagName) && !(e.textContent || '').trim() && !e.getAttribute('aria-label') && !e.title) R.unnamed.push(desc(e)); });
        document.querySelectorAll('#app img').forEach((i) => { if (!i.hasAttribute('alt')) R.noalt++; });
        const rgb = (s) => { const m = s.match(/[\d.]+/g); return m ? m.map(Number) : null; }; const L = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.backgroundImage && s.backgroundImage !== 'none') return null; const c = rgb(s.backgroundColor); if (c && (c.length < 4 || c[3] > 0.9)) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
        const seen = new Set(); const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (!n.textContent.trim()) continue; const e = n.parentElement; if (!e || !vis(e) || e.closest('svg,canvas,iframe,.editor pre,.u-preview')) continue; const s = getComputedStyle(e); const fg = rgb(s.color), bg = bgOf(e); if (!fg || !bg) continue;
          const a = fg.length > 3 ? fg[3] : 1; const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a) * (+s.opacity || 1)); const x = L(mix), y = L(bg); const cr = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); const big = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
          if (cr < (big ? 3 : 4.5)) { const k = s.color + '|' + bg.join(',') + '|' + e.className; if (!seen.has(k)) { seen.add(k); R.contrast.push(desc(e) + ' ' + cr.toFixed(2) + ' fg=' + s.color + ' bg=rgb(' + bg.slice(0, 3).join(',') + ')'); } } }
        R.wide = R.wide.slice(0, 6); R.small = R.small.slice(0, 12); R.unnamed = R.unnamed.slice(0, 6); R.contrast = R.contrast.slice(0, 10); return R; });
      out.push(Object.assign({ dev, theme, route: r, errs: errs.slice(0, 4) }, res));

    }
    await ctx.close();
  }
  fs.writeFileSync('audit.json', JSON.stringify(out, null, 1)); await b.close();
  const sum = (k) => out.filter((x) => (Array.isArray(x[k]) ? x[k].length : x[k] > 0)).length;
  console.log('pages', out.length, 'errors', sum('errs'), 'overflow', out.filter((x) => x.overflow > 0).length, 'wide', sum('wide'), 'small', sum('small'), 'unnamed', sum('unnamed'), 'contrast', sum('contrast'), 'noalt', sum('noalt'));
})();
