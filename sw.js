const CACHE_NAME = 'mickey-studio-v2.7';
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './shared/fonts/fonts.css',
  './assets/mickey-studio-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.includes('api.php') || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
