// Маркер релиза меняется вместе с version.js, чтобы iPhone точно установил новый Service Worker.
const SERVICE_WORKER_RELEASE = '2.2.0';
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
  './foods-ru-v1.json',
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

function isWorkoutReminderPayload(payload) {
  const kind = String(payload?.kind || '').toLowerCase();
  const tag = String(payload?.tag || '').toLowerCase();
  const body = String(payload?.body || '').toLowerCase();
  return kind.includes('workout') || tag.includes('workout') || /пора.*тренир|время.*тренир|тренировк.*сегодня/.test(body);
}

function currentLocalDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function scheduledMinuteOfDay(item) {
  const [hours, minutes] = String(item?.scheduledTime || '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

async function readDueScheduledWorkout() {
  if (!('indexedDB' in self)) return null;
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('nikita-workouts-db');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    if (!db.objectStoreNames.contains('meta')) return null;
    const activeProfileId = await new Promise((resolve, reject) => {
      const request = db.transaction('meta', 'readonly').objectStore('meta').get('activeProfileId');
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
    if (!activeProfileId) return null;

    const row = await new Promise((resolve, reject) => {
      const request = db.transaction('meta', 'readonly').objectStore('meta').get(`scheduledWorkouts:${activeProfileId}`);
      request.onsuccess = () => resolve(request.result?.value || []);
      request.onerror = () => reject(request.error);
    });
    if (!Array.isArray(row)) return null;

    const now = new Date();
    const today = currentLocalDateISO(now);
    const minuteNow = now.getHours() * 60 + now.getMinutes();
    return row
      .filter((item) => item?.status === 'scheduled' && item.scheduledDate === today && item.customDay?.exercises?.length)
      .map((item) => {
        const minute = scheduledMinuteOfDay(item);
        return { item, distance: minute === null ? null : Math.abs(minute - minuteNow) };
      })
      .filter(({ distance }) => Number.isFinite(distance) && distance <= 120)
      .sort((a, b) => a.distance - b.distance)[0]?.item || null;
  } catch (error) {
    console.warn('Scheduled workout notification lookup failed', error);
    return null;
  } finally {
    db.close();
  }
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text?.() || '' };
  }

  event.waitUntil((async () => {
    const planned = isWorkoutReminderPayload(payload) ? await readDueScheduledWorkout() : null;
    const payloadTitle = String(payload.title || '').trim();
    const title = planned
      ? 'Запланированная тренировка'
      : (payloadTitle === 'Тренировки' ? 'РЕЖИМ' : (payloadTitle || 'РЕЖИМ'));
    const targetUrl = planned ? './#/home' : (payload.targetUrl || './#/more');
    const tag = planned ? `scheduled-workout-${planned.id}` : (payload.tag || `trenirovki-${payload.kind || 'notice'}`);
    const options = {
      body: planned
        ? `${planned.customDay?.name || 'Своя тренировка'} · пора начинать`
        : (payload.body || 'Новое уведомление из приложения.'),
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag,
      renotify: true,
      data: {
        targetUrl,
        kind: planned ? 'scheduled-workout' : (payload.kind || 'notice'),
        scheduledWorkoutId: planned?.id || null,
        version: payload.version || null,
      },
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requested = event.notification.data?.targetUrl || './#/more';
  const targetUrl = new URL(requested, self.registration.scope).href;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if (new URL(client.url).origin !== new URL(targetUrl).origin) continue;
      if ('navigate' in client) await client.navigate(targetUrl).catch(() => null);
      return client.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
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
