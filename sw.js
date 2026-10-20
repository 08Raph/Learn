/* Optional offline support; safe on Netlify and GitHub Pages. */
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
