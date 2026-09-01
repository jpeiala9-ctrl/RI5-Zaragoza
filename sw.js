// ==================== sw.js - Service Worker RI5 ====================
// Versión: 3.30 - Bump de caché (v270 -> v271): friends.js -- "Buscar" y
//                "Explorar usuarios" (Comunidad > Amigos) se unifican en
//                una sola lista: al entrar, si no había caché se ve la
//                animación de "CARGANDO" y al terminar aparecen TODOS los
//                usuarios ya cargados (sin pedir por tandas de 20 con
//                "cargar más"); si ya estaban en caché sin cambios,
//                aparecen al instante sin animación. Escribir en el
//                buscador ya no lanza una consulta a Firestore por letra
//                -- filtra en el cliente la lista ya cargada, al
//                instante, y al borrar el texto vuelve a verse la lista
//                completa. index.html actualizado a juego (quitado el
//                botón "CARGAR MÁS" y el contenedor de resultados de
//                búsqueda separado, fundidos en una sola lista).
// Versión: 3.29 - Bump de caché (v269 -> v270): calendar.js -- la
//                recuperación de fuerza seguía siendo demasiado alta
//                (factor 1.1, tope 72h) y encima el aviso de "aún no
//                recuperado" bloqueaba salir a correr solo por haber hecho
//                fuerza el día anterior. Factor bajado a 0.75 con tope
//                propio de 24h, y el aviso ahora solo compara fuerza↔fuerza
//                o carrera↔carrera, nunca cruzado. index.html -- la tarjeta
//                "Carga y recuperación" del Dashboard aclara que la cuenta
//                atrás es solo para repetir fuerza cuando el tipo es fuerza.
// Versión: 3.28 - Bump de caché (v268 -> v269): calendar.js -- el TSS de
//                una sesión de fuerza al marcarla como hecha aplicaba un
//                RPE=6 fijo a TODOS sus minutos, incluidos calentamiento y
//                estiramientos/enfriamiento (esfuerzo mucho más bajo que
//                la parte principal). Con calcularRecuperacion() usando el
//                factor más alto de todos los tipos para 'strength' (1.1),
//                eso disparaba la recomendación de descanso a 2 días para
//                sesiones de intensidad en realidad moderada (ej. 50' con
//                buen calentamiento/vuelta a la calma). Nuevo
//                calcularTSSFuerza() reparte el RPE por fase, igual que ya
//                se hace con las zonas en las sesiones de carrera.
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

const CACHE_NAME = 'ri5-v271';

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

console.log('[SW] sw.js cargado correctamente (v271)');
