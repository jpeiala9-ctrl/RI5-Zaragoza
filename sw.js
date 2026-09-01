// ==================== sw.js - Service Worker RI5 ====================
// Versión: 3.31 - Bump de caché (v274 -> v275): app.js -- FIX: al pulsar
//                en el admin sobre la tarjeta "Sesiones hoy" (Panel de
//                control) daba "Error al cargar la lista" y no enseñaba
//                nada, aunque el propio número mostrado en la tarjeta
//                fuera correcto (p.ej. "7"). Causa: Admin.
//                mostrarUsuariosPorFiltro('sessions') usaba
//                .select('userId') sobre la consulta a globalFeed --
//                .select() es un método del Admin SDK de Firebase (Node.js)
//                para proyección de campos, y NO existe en el SDK cliente
//                (firebase-firestore.js 8.10.1, el que usa la app en el
//                navegador). Esa llamada lanzaba un TypeError antes de
//                pedir nada a Firestore, y el catch de la función lo
//                convertía en el mensaje de error genérico. Se quita
//                .select('userId') y se piden los documentos completos,
//                igual que en el resto de listados del admin.
// Versión: 3.30 - Bump de caché (v273 -> v274): friends.js v3.53 --
//                "Explorar usuarios" (página 1, 20 usuarios) dejaba de
//                cachearse nada entre aperturas de la pantalla desde el
//                v3.52: cada vez que se abría "Amigos > Buscar", se volvía
//                a entrar a la pantalla, o se enviaba/cancelaba/aceptaba/
//                rechazaba una solicitud, se repetían esas mismas 20
//                lecturas de Firestore (más hasta 20 más de "gamification"
//                para los niveles), aunque la lista de usuarios casi nunca
//                cambia de una apertura a la siguiente. Ahora esa primera
//                página se sirve desde un listener en tiempo real que se
//                abre una sola vez por sesión: solo se vuelve a leer de
//                Firestore cuando de verdad cambia algo en esos 20
//                primeros usuarios (p.ej. un registro nuevo que entra
//                alfabéticamente ahí). Buscar por nombre no cambia: sigue
//                costando una lectura real por búsqueda. De paso se
//                corrige en app.js una referencia obsoleta
//                (Friends.todosUsuariosPagination, ya no existía desde el
//                refactor a _usuariosState en v3.52) que lanzaba un error
//                silencioso cada vez que se volvía a la pestaña "Amigos"
//                con "Buscar" activa.
// Versión: 3.29 - FIX FÓRMULA TSS: a la fórmula de TSS de carrera (usada
//                en calcularTSSdesdeReal, calcularMetricasSesion,
//                _distanciaYTssDesdeParteP de calendar.js y _calcularTSS
//                de session-invites.js) le faltaba el factor ×100/60 que
//                tiene la fórmula estándar (TSS = horas × IF² × 100) --
//                al trabajar en minutos en vez de horas, el TSS salía
//                sistemáticamente ~40% por debajo de lo real (una sesión
//                de 60' a umbral daba ~60 TSS en vez de ~90-100). Ahora
//                las 4 fórmulas usan una única constante compartida
//                (PlanGenerator.FACTOR_ESCALA_TSS = 100/60) para no volver
//                a desincronizarse. Esto también corrige, de rebote, las
//                horas de recuperación mostradas (calcularRecuperacion
//                multiplica el TSS ×0.5) y hace que los colores del
//                Dashboard (naranja a partir de 70 TSS, rojo a partir de
//                120) se disparen en sesiones realmente duras, como ya
//                estaban pensados para hacerlo. NOTA: el TSS ya guardado
//                en sesiones antiguas (Firestore) se queda en la escala
//                vieja -- no se ha migrado -- así que "carga aguda (7d)"
//                puede dar un salto visible los próximos 7-28 días hasta
//                que el historial reciente esté todo en la escala nueva.
//                También se añade Z6 (antes ausente) a las tablas de
//                factoresIF/factoresRitmo de calcularMetricasSesion y
//                _distanciaYTssDesdeParteP, por si alguna vez se genera
//                una sesión automática en zona Z6 (hasta ahora solo
//                aparecía en sesiones de series personalizadas del admin).
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

const CACHE_NAME = 'ri5-v275';

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

console.log('[SW] sw.js cargado correctamente (v275)');
