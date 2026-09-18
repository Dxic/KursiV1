/* KURSI service worker — app shell cache, runtime cache for images */
const VERSION = 'kursi-v2';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/backend.js',
  './js/qrcode.js',
  './js/data.js',
  './js/ui.js',
  './js/customer.js',
  './js/staff.js',
  './js/app.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // external images (QR API): cache-first, network fallback
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        } catch (err) { return hit || Response.error(); }
      })
    );
    return;
  }

  // app shell: network-first (fast updates), cache fallback for offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
