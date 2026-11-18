/* Offline support: app shell is cached on first visit; updates are fetched in the background. */
const VER = 'learn-v5.6';
// Real Python (Pyodide) is downloaded from the CDN only when a student switches it on, and kept in its own cache
// so that app updates do not throw away a 7 MB download.
const PYO = 'learn-pyodide-0.26.4', PYO_PREFIX = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const SHELL = ['./', 'index.html', 'app.js', 'challenges.js', 'manifest.json', 'favicon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  // University core (courses, videos and labs are cached the first time each one is opened)
  'uni/university.css', 'uni/config.js', 'uni/data/catalog.js', 'uni/data/departments.js', 'uni/university.js', 'uni/uni-campus.js', 'uni/uni-studio.js', 'uni/uni-tools.js', 'uni/gitsim.js', 'uni/realpy.js', 'uni/realpy-worker.js', 'uni/uni-assess.js', 'uni/uni-professor.js', 'uni/data/tutor-kb.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VER).then((c) => {
    // The large question bank is stored in the background and never delays installation or the first page.
    c.match('ranked_extra.json', { ignoreSearch: true }).then((hit) => hit || c.add(new Request('ranked_extra.json', { cache: 'reload' }))).catch(() => {});
    return Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER && k !== PYO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (r.url.startsWith(PYO_PREFIX)) { // cache-first: versioned files that never change
    e.respondWith(caches.open(PYO).then(async (c) => (await c.match(r)) || fetch(r).then((res) => { if (res && res.ok) c.put(r, res.clone()); return res; })));
    return;
  }
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== location.origin && !font) return; // Firebase / GitHub API: always live
  if (u.pathname.endsWith('ranked_questions.json')) return;
  e.respondWith(caches.open(VER).then(async (c) => {
    // A request with ?v= names an exact version: only an exact copy may answer it from the cache. Otherwise ask the
    // network first (revalidating the browser's own copy), and fall back to any cached copy only when offline.
    // This stops an old copy of one file being served next to new copies of the others.
    let exact = null;
    if (u.searchParams.has('v')) {
      exact = await c.match(r);
      if (!exact) {
        let res = null; try { res = await fetch(new Request(r, { cache: 'no-cache' })); } catch (er) { try { res = await fetch(r); } catch (er2) { res = null; } }
        if (res && res.ok) { c.put(r, res.clone()); return res; }
        return (await c.match(r, { ignoreSearch: true })) || res || new Response('Offline', { status: 503 });
      }
    }
    const hit = exact || await c.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit && u.pathname.endsWith('ranked_extra.json')) return hit; // 1.2 MB and versioned with the cache: never re-download in the background
    const net = fetch(r).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline', { status: 503 });
  }));
});
