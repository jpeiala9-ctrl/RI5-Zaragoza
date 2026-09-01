// ==================== sw.js - Service Worker RI5 ====================
// Versión: 3.28 - Bump de caché (v270 -> v271): friends.js --
//                FIX DE COSTE: "Explorar/Buscar usuarios" cargaba TODOS
//                los usuarios de la app de golpe (hasta 5000 lecturas de
//                Firestore) cada vez que se abría esa pantalla -- eso
//                estaba generando cargos reales en el plan Blaze. Ahora
//                vuelve la paginación real: "Explorar" trae usuarios de
//                20 en 20 con el botón CARGAR MÁS, y escribir 2+ letras
//                en el buscador consulta Firestore directamente por ese
//                término (con debounce de 400ms, sin lanzar una consulta
//                por cada tecla). Ver friends.js v3.52 para el detalle.
//                FIX 2 (session-invites.js): en sesiones rodaje/tempo/largo
//                enviadas por el admin, el campo de arriba "duración de la
//                parte principal (min)" quedaba CAPADO por el bloque
//                "PARTE PRINCIPAL" de los pasos de abajo (por defecto 0) --
//                si no se rellenaba también esa fila, el tiempo puesto
//                arriba no servía de nada (contaba 0). Se quita el campo
//                de arriba: ahora la única fuente es la fila "PARTE
//                PRINCIPAL" de los bloques, igual que ya funcionaba fuerza.
//                FIX 3 (calendar.js): en el generador automático (cuando
//                un usuario se crea su propio calendario, sin sesiones
//                mandadas por el admin), el calentamiento no tenía techo y
//                podía superar los 10' en sesiones largas. Ahora nunca
//                dura más de 10'.
// =====================================================================

const CACHE_NAME = 'ri5-v272';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './auth.js',
  './storage.js',
  './training.js',
  './entrenamientos.js',
  './calendar.js',
  './friends.js',
  './wall.js',
  './profile.js',
  './gamification.js',
  './gps-tracker.js',
  './gps-track-viewer.js',
  './session-invites.js',
  './firebase-config.js'
];

const NETWORK_ONLY_DOMAINS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebasestorage.googleapis.com',
  'nominatim.openstreetmap.org'
];

self.addEventListener('install', event => {
  console.log('[SW] Instalando', CACHE_NAME, '...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Algunos archivos no se pudieron precargar:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando cache antigua:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
    .then(() => {
      return self.clients.matchAll({ type: 'window' }).then(clientsList => {
        clientsList.forEach(client => {
          client.postMessage({ type: 'RI5_NEW_VERSION', version: CACHE_NAME });
        });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (NETWORK_ONLY_DOMAINS.some(domain => url.hostname.includes(domain))) return;
  if (url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (
          response.ok &&
          (url.origin === self.location.origin ||
           url.hostname.includes('unpkg.com') ||
           url.hostname.includes('googleapis.com') ||
           url.hostname.includes('cdnjs.cloudflare.com') ||
           url.hostname.includes('basemaps.cartocdn.com'))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'RI5', {
      body: data.body || '',
      icon: data.icon || './icon-192.png',
      badge: './icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

console.log('[SW] sw.js cargado correctamente (v272)');
