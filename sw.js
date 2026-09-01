// ==================== sw.js - Service Worker RI5 ====================
// Versión: 3.26 - Bump de caché (v266 -> v267): index.html --
//                FIX: la búsqueda "> BUSCAR POR NOMBRE DE USUARIO..." y la
//                lista "EXPLORAR USUARIOS" de Comunidad > Amigos > Buscar
//                dejaron de funcionar porque index.html seguía llamando a
//                Friends.buscarUsuarios() y Friends.cargarMasTodosUsuarios(),
//                dos funciones que ya no existen en friends.js (se
//                eliminaron como código muerto al unificar Buscar/Explorar
//                en una sola lista). Ahora el input llama a
//                Friends.filtrarUsuarios() (filtro en cliente) y se quitó
//                el botón "CARGAR MÁS" (ya no hay paginación: la lista se
//                carga completa una vez y se filtra al escribir).
//                FIX 2 (calendar.js + index.html): restaurada la
//                diferenciación fuerza/carrera en la recuperación --
//                calcularRecuperacion vuelve a usar factor propio para
//                fuerza (0.75, tope 24h) y comprobarFatigaAntesDeSesion
//                vuelve a comparar por GRUPO (fuerza vs. carrera): no
//                recuperado de fuerza ya NO bloquea salir a correr, solo
//                avisa si se repite el mismo grupo. Restaurado el aviso en
//                rojo en "Carga y recuperación" del Dashboard.
//                FIX 3 (wall.js + profile.js): tocar una tarjeta en el
//                Muro o en "Mis últimos entrenamientos" del Perfil abría
//                la lista de "me gusta" en vez del detalle de la sesión --
//                por eso no se veía ya el desglose calentamiento/esfuerzo/
//                descanso/enfriamiento de una serie completada (ese
//                desglose SÍ se sigue calculando bien, solo no había forma
//                de abrirlo). Ahora el toque en la tarjeta abre el mismo
//                modal de detalle que ya usa el Dashboard
//                (abrirDetalleEntrenamientoCompletado); el corazón sigue
//                haciendo lo mismo que antes en cada sitio (toggle de like
//                en el Muro, ver quién dio like en el Perfil).
//                FIX 4 (calendar.js + session-invites.js): en el desglose
//                de una serie completada, la distancia de "ESFUERZO" salía
//                diluida (ej. 1.74 km en vez de los 2.4 km reales de 6x400)
//                porque se repartía proporcionalmente al TIEMPO entre
//                esfuerzo y descanso -- como el descanso se corre/anda
//                mucho más despacio, esa proporción de tiempo no
//                corresponde a la misma proporción de distancia. Ahora,
//                cuando se conoce la distancia FIJA planificada del
//                esfuerzo (nuevo campo det.distanciaEsfuerzoKm, ej. 2.4km
//                para 6x400m), se usa tal cual para "ESFUERZO" y el resto
//                del km real de esa parte va a "RECUPERACIÓN"; lo que
//                sobre respecto a toda la sesión programada sigue yendo
//                aparte como "CARRERA EXTRA" en Z2, sin cambios ahí.
// =====================================================================

const CACHE_NAME = 'ri5-v270';

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

console.log('[SW] sw.js cargado correctamente (v270)');
