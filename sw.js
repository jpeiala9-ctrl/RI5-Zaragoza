// ==================== sw.js - Service Worker RI5 ====================
// Versión: 3.35 - Bump de caché (v278 -> v279): gps-tracker.js -- a
//                petición del usuario, se ELIMINA POR COMPLETO el ajuste
//                a calles (OSRM _mapMatchTrack/_matchEsFiable): el track
//                del mapa debe ser exactamente el grabado por el GPS,
//                sin que ningún servicio externo lo reinterprete (podía
//                "pegar" la ruta a un camino no pisado si se corría por
//                campo). El único procesado que queda es Douglas-Peucker,
//                con el margen bajado de 4m a 2m (el error máximo pedido)
//                -- solo reduce el número de puntos guardados, nunca
//                desvía el trazado más de esos 2m. Los saltos GPS
//                imposibles (ej. "20m en 1s") ya se descartaban en
//                directo desde antes (_filterGPS, tope 18 km/h).
// Versión: 3.34 - Bump de caché (v277 -> v278): gps-tracker.js -- a
//                petición del usuario, se separa del todo la DISTANCIA
//                (siempre sale del track GPS/Douglas-Peucker, nunca del
//                ajuste a calles OSRM) del DIBUJO del mapa (que sí puede
//                usar el ajuste a calles, solo si pasa la comprobación de
//                fiabilidad -- ahora también valida el punto FINAL,
//                además del inicial). Así el kilometraje guardado es
//                siempre el real y completo de principio a fin, y el
//                "pegado a las calles" queda como mejora puramente visual
//                que nunca puede recortar ni falsear la distancia.
// Versión: 3.33 - Bump de caché (v276 -> v277): gps-tracker.js --
//                FIX GRAVE: al terminar una sesión con GPS, el "ajuste a
//                calles" (OSRM, gaps=split) podía descartar en silencio
//                el tramo inicial del recorrido si no lograba encajarlo
//                con ninguna calle mapeada (ej. si la sesión empezaba en
//                un parque, una senda de tierra, o cualquier zona sin
//                calles en el mapa) -- OSRM no lanzaba ningún error, solo
//                devolvía un resultado "correcto" pero más corto y que
//                empezaba varios km después del inicio real. La app lo
//                aceptaba sin comprobar nada: por eso una sesión de 7.7km
//                reales salía calculada en 4.4km, y el track guardado
//                empezaba a mitad de la ruta aunque la voz (que no
//                depende de OSRM) sí hubiera anunciado bien el
//                calentamiento/parte principal/enfriamiento desde el
//                principio. Ahora, antes de aceptar el ajuste a calles, se
//                comprueba que su distancia no sea muchísimo menor que la
//                medida por GPS y que su punto de inicio esté cerca del
//                inicio real -- si no, se descarta y se usa el track GPS
//                (ya "limpiado" con Douglas-Peucker) tal cual, que es más
//                fiable aunque tenga algo más de zigzag. Ver
//                _matchEsFiable() en gps-tracker.js.
// Versión: 3.32 - Bump de caché (v275 -> v276): firebase-config.js,
//                app.js, friends.js, profile.js -- FIX: al marcar una
//                sesión y pulsar en el admin sobre "Sesiones hoy" (con al
//                menos 1 sesión real ese día) volvía a dar "Error al
//                cargar la lista". Causa: la consulta para traer los
//                perfiles de esos usuarios usaba
//                .where('__name__', 'in', [...uids]) -- un string suelto
//                en vez de la forma oficial documentada del SDK cliente de
//                Firebase, firebase.firestore.FieldPath.documentId().
//                Se añade FieldPath a firebaseServices (firebase-config.js)
//                y se usa esa forma oficial en las 3 consultas de la app
//                que buscan "estos usuarios por su UID" (admin > Sesiones
//                hoy en app.js, y la limpieza de amigos huérfanos en
//                friends.js y profile.js, que usaban el mismo patrón).
// =====================================================================

const CACHE_NAME = 'ri5-v279';

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

console.log('[SW] sw.js cargado correctamente (v279)');
