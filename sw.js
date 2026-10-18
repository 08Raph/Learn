const V = 'learn-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => Promise.all(['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'favicon.png'].map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const h = new URL(r.url).hostname; if (h === 'api.github.com' || h.indexOf('cloudflareinsights') >= 0 || h.indexOf('plausible') >= 0) return;
  e.respondWith(fetch(r).then((res) => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r).then((m) => m || caches.match('index.html'))));
});
