const CACHE_NAME = 'nikita-workouts-v1.2.0-all-guides';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './seed.js',
  './exercise-guides.js',
  './db.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/maskable-512.png',
  './exercise-media/abs-complex.webp',
  './exercise-media/barbell-bench.webp',
  './exercise-media/barbell-curl.webp',
  './exercise-media/barbell-row.webp',
  './exercise-media/bridge-bench.webp',
  './exercise-media/bulgarian.webp',
  './exercise-media/calf-raise-2.webp',
  './exercise-media/calf-raise.webp',
  './exercise-media/close-pushups-2.webp',
  './exercise-media/close-pushups.webp',
  './exercise-media/concentration-curl.webp',
  './exercise-media/cycle-overview.webp',
  './exercise-media/db-bench-press.webp',
  './exercise-media/db-fly.webp',
  './exercise-media/db-shoulder-press.webp',
  './exercise-media/face-pull.webp',
  './exercise-media/farmer-hold.webp',
  './exercise-media/front-raise.webp',
  './exercise-media/hammer-curl.webp',
  './exercise-media/hip-thrust.webp',
  './exercise-media/incline-curl.webp',
  './exercise-media/incline-db-press.webp',
  './exercise-media/lat-pulldown-close.webp',
  './exercise-media/lat-pulldown-wide.webp',
  './exercise-media/lateral-raise.webp',
  './exercise-media/lunge-db.webp',
  './exercise-media/one-arm-row.webp',
  './exercise-media/overhead-triceps-2.webp',
  './exercise-media/overhead-triceps.webp',
  './exercise-media/pallof.webp',
  './exercise-media/pushups-blocks.webp',
  './exercise-media/rdl-barbell.webp',
  './exercise-media/rdl-db.webp',
  './exercise-media/rear-delt-fly.webp',
  './exercise-media/recovery.webp',
  './exercise-media/reverse-crunch-plank.webp',
  './exercise-media/reverse-curl.webp',
  './exercise-media/russian-twist.webp',
  './exercise-media/shrugs.webp',
  './exercise-media/side-plank-suitcase.webp',
  './exercise-media/side-plank.webp',
  './exercise-media/single-bridge.webp',
  './exercise-media/squat-barbell.webp',
  './exercise-media/squat-quad.webp',
  './exercise-media/suitcase.webp',
  './exercise-media/triceps-pushdown-2.webp',
  './exercise-media/triceps-pushdown.webp',
  './exercise-media/warmup.webp',
  './exercise-media/woodchopper.webp',
  './exercise-media/wrist-complex.webp',
  './exercise-media/wrist-curl.webp',
  './exercise-media/wrist-extension.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
