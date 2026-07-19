// Маркер релиза меняется вместе с version.js, чтобы iPhone точно установил новый Service Worker.
const SERVICE_WORKER_RELEASE = '1.12.0';
importScripts(`./version.js?v=${SERVICE_WORKER_RELEASE}`);
if (self.NIKITA_APP.version !== SERVICE_WORKER_RELEASE) throw new Error('Версии приложения и Service Worker не совпадают');
const CACHE_NAME = self.NIKITA_APP.cacheName;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './version.js',
  './seed.js',
  './exercise-guides.js',
  './offline-guide.js',
  './db.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_APP_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('nikita-workouts-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
    );
  }
});

const NETWORK_FIRST_PATHS = new Set(APP_SHELL.filter((url) => /\.(js|css|webmanifest)$/i.test(url)).map((url) => new URL(url, self.location).pathname));

function cacheMatchWithNormalizedUrl(request, url) {
  return caches.match(request).then((cached) => cached || caches.match(new Request(`${url.origin}${url.pathname}`)));
}

function putBothRequestForms(cache, request, response, url) {
  const copyForOriginal = response.clone();
  const copyForClean = response.clone();
  cache.put(request, copyForOriginal);
  cache.put(new Request(`${url.origin}${url.pathname}`), copyForClean);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'reload' }))
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'reload' }))
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => putBothRequestForms(cache, event.request, response, url));
          return response;
        })
        .catch(() => cacheMatchWithNormalizedUrl(event.request, url))
    );
    return;
  }

  event.respondWith(
    cacheMatchWithNormalizedUrl(event.request, url).then((cached) => cached || fetch(new Request(event.request, { cache: 'reload' })).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
