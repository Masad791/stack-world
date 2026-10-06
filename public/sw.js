// Tiny offline cache. Pages: network first (a new deploy shows up at once), cache as fallback.
// Everything else on this origin (hashed JS/CSS, logos, screenshots): cache first.
const CACHE = 'stack-world-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  const save = (res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  };
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).then(save).catch(() => caches.match(request)));
  } else {
    e.respondWith(caches.match(request).then((hit) => hit || fetch(request).then(save)));
  }
});
