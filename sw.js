/* Offline support: app shell is cached on first visit; updates are fetched in the background. */
const VER = 'learn-v4.0';
const SHELL = ['./', 'index.html', 'manifest.json', 'favicon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  // University core (courses, videos and labs are cached the first time each one is opened)
  'uni/university.css', 'uni/config.js', 'uni/data/catalog.js', 'uni/data/departments.js', 'uni/university.js', 'uni/uni-campus.js', 'uni/uni-studio.js', 'uni/uni-assess.js', 'uni/uni-professor.js', 'uni/data/tutor-kb.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VER).then((c) => {
    // The large question bank is stored in the background and never delays installation or the first page.
    c.match('ranked_extra.json', { ignoreSearch: true }).then((hit) => hit || c.add('ranked_extra.json')).catch(() => {});
    return Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== location.origin && !font) return; // Firebase / GitHub API: always live
  if (u.pathname.endsWith('ranked_questions.json')) return;
  e.respondWith(caches.open(VER).then(async (c) => {
    const hit = await c.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit && u.pathname.endsWith('ranked_extra.json')) return hit; // 8.5 MB and versioned with the cache: never re-download in the background
    const net = fetch(r).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline', { status: 503 });
  }));
});
