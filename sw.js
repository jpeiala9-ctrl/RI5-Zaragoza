// ==================== sw.js - Service Worker RI5 ====================
// Versión: 3.27 - Bump de caché (v267 -> v268): friends.js -- el
//                esqueleto pulsando de la v267 (para "Buscar"/"Explorar
//                usuarios") no convenció; se sustituye por la misma
//                animación de "CARGANDO" con letras de colores que ya usa
//                el panel de soporte del admin, y los resultados se
//                cachean en memoria hasta que hay un cambio real (enviar/
//                cancelar/aceptar/rechazar una solicitud) en vez de
//                expirar solos a los 30s.
// Versión: 3.26 - Bump de caché (v266 -> v267): friends.js -- "Buscar"
//                (búsqueda por nombre y "Explorar usuarios") carga ahora
//                con el mismo lenguaje visual que "Últimas sesiones
//                creadas" del admin: esqueleto pulsando desde el primer
//                instante y fundido al llegar los resultados, en vez del
//                hueco en blanco / texto fijo de antes. Y wall.js/
//                index.html -- el centrado de la publicación al tocar una
//                notificación de "me gusta" desde Comunidad (ver v3.25)
//                dependía de un único setTimeout fijo de 500ms que no
//                siempre bastaba (cargarMuro() puede tardar más); ahora
//                usa Wall.centrarPublicacion(), que reintenta cada 200ms
//                hasta 4s en vez de rendirse a la primera.
// Versión: 3.25 - Bump de caché (v265 -> v266): index.html -- al tocar
//                "Comunidad" con una notificación de "me gusta" pendiente,
//                ahora se va directo a la subpestaña Muro (centrado en la
//                publicación concreta), en vez de saltar a Perfil.
// Versión: 3.24 - Bump de caché (v264 -> v265): gps-tracker.js -- fix del
//                anuncio de voz en sesiones de series (ver cabecera de
//                gps-tracker.js v5.4): antes solo se anunciaba la primera
//                zona mencionada en el texto libre de la parte principal
//                (podía quedarse solo con "zona 2" de descanso y omitir
//                el esfuerzo real Z4/Z5); ahora se anuncian esfuerzo y
//                descanso por separado.
// =====================================================================

const CACHE_NAME = 'ri5-v268';

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

console.log('[SW] sw.js cargado correctamente (v268)');
