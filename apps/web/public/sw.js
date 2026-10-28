// Kobling: appen kan åpnes uten nett. Sider hentes fra nettet først (ny versjon etter oppdatering),
// med lagret kopi som reserve; byggede filer (/assets/…, navn med hash) lagres første gang.
// API og synkronisering går alltid direkte til serveren.
const CACHE = 'kobling-app';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/sync/') || url.pathname.startsWith('/i/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('/', copy));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok && (url.pathname.startsWith('/assets/') || /\.(woff2?|png|svg)$/.test(url.pathname))) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })));
});
