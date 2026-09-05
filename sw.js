/* ShuttleIQ service worker — network-first with offline fallback.
   Keeps the app loading in gyms with bad wifi once it's been opened once.
   Only same-origin GETs are handled; AI provider calls pass through untouched. */

const CACHE = 'shuttleiq-v6-18';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json', './icon.svg',
  './js/data.js', './js/store.js', './js/analytics.js', './js/charts.js', './js/ai.js', './js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // network-first: cache the fresh copy so edits show up immediately in dev
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then(hit => hit || caches.match('./index.html'))
      )
  );
});
