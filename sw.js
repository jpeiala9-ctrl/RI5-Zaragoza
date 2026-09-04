// ==================== sw.js - Service Worker RI5 ====================
// Versión: 3.48 - Bump de caché (v291 -> v292): guia.html -- el fix de la
//                v3.47 (min-height:60px calculado a ojo) se quedaba corto:
//                un botón de dos líneas de verdad crece por encima de un
//                min-height si su texto lo pide, así que "RI5 Premium"
//                (una sola línea) seguía viéndose más bajo que esos.
//                Ahora es height FIJO (68px, sitio de sobra para dos
//                líneas a 12px) para TODOS los botones del índice -- ya
//                no depende de estimar cuánto ocupa cada texto, todos
//                miden exactamente lo mismo siempre.
// Versión: 3.47 - Bump de caché (v290 -> v291): guia.html -- FIX: el
//                botón "RI5 Premium" del índice de temas se veía más
//                pequeño (más bajo) que el resto. Causa: al ser el
//                último de un número impar de botones, queda solo en su
//                propia fila del grid -- los botones EMPAREJADOS ya se
//                igualan de alto entre sí solos (comportamiento por
//                defecto de CSS Grid dentro de una misma fila), pero al
//                no tener con quién igualarse, se quedaba con su altura
//                mínima natural (su texto es corto y cabe en una sola
//                línea, a diferencia de varios de los demás). Se añade
//                una altura mínima compartida por todos los botones del
//                índice para que esto no vuelva a pasar, y de paso, a
//                petición del usuario, un toque de color dorado (el
//                color de marca de la app, --gold) para distinguir este
//                tema como especial.
// Versión: 3.46 - Bump de caché (v289 -> v290): training.js, guia.html --
//                a petición del usuario, el enlace de texto subrayado
//                "Editar esta zona a mano" (añadido en la v3.45) se
//                sustituye por un botón pequeño y centrado ("EDITAR
//                ZONA") en el mismo sitio, al final del detalle
//                expandido de cada tarjeta de zona -- misma acción de
//                siempre (Training.abrirEdicionZona), solo cambia cómo
//                se ve: ya no es texto subrayado pegado a la izquierda,
//                ahora es un botón con borde, centrado. La guía se
//                actualiza para reflejarlo.
// Versión: 3.45 - Bump de caché (v288 -> v289): training.js, guia.html --
//                a petición del usuario, el botón EDITAR de cada tarjeta
//                de zona (flotante, con borde, siempre visible incluso
//                colapsada) tenía demasiado protagonismo para una acción
//                poco frecuente -- competía visualmente con el propio
//                título de la zona. Se sustituye por un enlace de texto
//                discreto ("Editar esta zona a mano") al final del
//                detalle EXPANDIDO de la tarjeta: solo aparece cuando el
//                usuario ya la ha tocado para ver más, que es cuando
//                tiene sentido ofrecérselo. La guía se actualiza para
//                reflejarlo.
// Versión: 3.44 - Bump de caché (v287 -> v288): index.html -- se
//                actualiza el contenido del modal "Novedades de esta
//                versión" (llevaba desde ri5-v133 sin tocarse, con
//                novedades ya viejas: colores por nivel, gestión de
//                carga, planes con TSS...). Ahora anuncia lo más
//                relevante de verdad para un usuario que abre la app hoy:
//                recibir sesiones de un admin/entrenador, la edición
//                manual de zonas, la mayor precisión de los récords por
//                tramo GPS, el visor de recorridos y la guía actualizada.
//                RI5_VERSION_NOVEDADES sube a 'ri5-v288' en línea con el
//                CACHE_NAME de este mismo bump, para que el modal vuelva
//                a aparecer aunque el usuario ya hubiera visto (y
//                cerrado) la versión antigua.
// Versión: 3.43 - Bump de caché (v286 -> v287): guia.html, training.js,
//                storage.js -- dos cambios:
//                1) guia.html: el botón "RI5 Premium" del índice (13º
//                   botón, número impar en una rejilla de 2 columnas)
//                   quedaba solo en su fila, pegado a la columna
//                   izquierda ("de pico"). Se añade la clase .item-solo
//                   (ocupa la fila entera pero limita su ancho al de un
//                   botón normal y lo centra con margin:auto) y se aplica
//                   a ese botón.
//                2) Se implementa de verdad la edición manual de zonas
//                   que la guía ya describía (la nota se añadió antes de
//                   que existiera la función -- ahora existe). Cada
//                   tarjeta de zona en "Calcular tus zonas" tiene un
//                   botón EDITAR (texto, sin emoticono de lápiz) que abre
//                   un formulario para ajustar a mano su FC (mínima/
//                   máxima) y su ritmo. Al guardar, esos valores se
//                   convierten al % de FC (sobre el umbral) y factor de
//                   ritmo (sobre el ritmo base) equivalentes y se
//                   sobrescriben en la propia zona -- así ningún otro
//                   sitio de la app (planes, sesiones GPS, invitaciones
//                   de admin) necesita cambiar nada, todos siguen leyendo
//                   la zona exactamente igual que antes. La zona editada
//                   se marca como "PERSONALIZADA" (8º elemento de la
//                   tupla, ahora también guardado/reconstruido en
//                   storage.js al leer/escribir en Firestore). Volver a
//                   pulsar CALCULAR regenera las zonas desde cero y borra
//                   cualquier ajuste manual, tal y como ya avisaba la
//                   guía.
// Versión: 3.42 - Bump de caché (v285 -> v286): guia.html -- se añade la
//                página que faltaba, "Sesiones enviadas" (invitaciones de
//                un admin/entrenador, cómo aceptarlas/rechazarlas, y que
//                hacen falta las zonas calculadas o se rechazan solas);
//                se añade una nota en "Calcular tus zonas" sobre el nuevo
//                botón ✏️ de edición manual de zona; y se corrige la
//                explicación de "Récords personales", que describía un
//                mecanismo antiguo (sesión entera dentro de un 15% de la
//                distancia estándar) que ya no es como funciona de verdad
//                desde el fix de récords por tramo GPS -- ahora explica
//                que busca el tramo continuo más rápido de esa distancia
//                DENTRO de cualquier sesión GPS, y que las paradas no
//                cuentan. guia.html no estaba en PRECACHE_URLS pero sí se
//                cachea igualmente al visitarla (fetch handler genérico),
//                así que sin este bump de versión los que ya la hubieran
//                abierto seguirían viendo la versión vieja.
// Versión: 3.41 - Bump de caché (v284 -> v285): app.js -- "Eliminar
//                usuario" (panel admin) ahora borra TODO su rastro en
//                Firestore: además de lo que ya borraba (subcolecciones
//                propias, gamificación, publicaciones), ahora también
//                purga mensajes de soporte (subcolección + colección
//                global del admin), solicitudes de amistad,
//                conversaciones, invitaciones de sesión, grupos creados
//                y membresía en grupos ajenos, sus "me gusta" en
//                publicaciones de otros usuarios, su presencia en la
//                lista de amigos de quien le tuviera añadido, y su foto
//                de perfil en Storage. La cuenta de Firebase
//                Authentication sigue sin poder borrarse desde el
//                cliente -- hay que borrarla a mano en la consola de
//                Firebase (Authentication > usuario > eliminar) o montar
//                una Cloud Function para automatizarlo.
// Versión: 3.40 - Bump de caché (v283 -> v284): app.js -- ahorro de
//                lecturas de Firestore. Los listeners en tiempo real de
//                "mensajes de soporte propios" y "me gusta propios"
//                (globalFeed) escuchaban TODO el historial del usuario
//                sin límite; cada reconexión (móvil bloqueado/desblo-
//                queado corriendo con GPS, cortes de cobertura) volvía a
//                facturar una lectura por cada documento de ese
//                histórico completo aunque no hubiera cambiado nada --
//                con pocos usuarios activos pero historial acumulado,
//                esto podía comerse gran parte de la cuota diaria
//                gratis sin tráfico real. Ahora ambos listeners se
//                acotan con orderBy+limit (últimos 50 mensajes / últimas
//                30 publicaciones); el chat de soporte completo y las
//                publicaciones antiguas se siguen viendo enteros al
//                abrir esas pantallas (usan una lectura puntual, no
//                estos listeners) -- solo se acota el aviso en vivo de
//                fondo. IMPORTANTE: la consulta de "me gusta propios"
//                combina un where con un orderBy en otro campo, así que
//                Firestore puede pedir crear un índice compuesto la
//                primera vez (aparece como error en la consola del
//                navegador con un enlace para crearlo en un clic, gratis
//                y en ~1 minuto).
// Versión: 3.39 - Bump de caché (v282 -> v283): gps-track-viewer.js -- FIX
//                del "latido" incómodo al abrir el modal del track GPS
//                desde el Muro o el Perfil. Causa: al crear el mapa, tras
//                el primer encuadre (fitBounds) había una segunda llamada
//                fija a los 300ms "por si acaso" el layout no estuviera
//                asentado -- pero esa llamada se disparaba SIEMPRE, en
//                cada apertura, aunque el contenedor no hubiera cambiado
//                de tamaño ni un píxel desde el primer encuadre; ese
//                segundo fitBounds sobre el mismo mapa (aunque con
//                animate:false) se notaba como un pequeño salto/latido
//                justo después de abrirse. Se sustituye por un
//                ResizeObserver que solo reencuadra si el contenedor
//                cambia de tamaño de verdad (layout tardío, rotación,
//                resize de ventana) -- en la apertura normal ya no hay
//                doble salto, y el mapa sigue totalmente interactivo
//                (se puede mover y hacer zoom con normalidad).
// Versión: 3.38 - Bump de caché (v281 -> v282): gamification.js -- FIX de
//                un caso límite real del fix de récords de la v3.36: capar
//                a 8s el tiempo de CUALQUIER hueco entre dos puntos GPS
//                (_MAX_GAP_MS) arreglaba las paradas/pausas, pero si
//                durante ese mismo hueco se cubría una distancia real
//                considerable -- ej. un corte de señal GPS de 40s dentro
//                de un túnel o entre edificios altos, sin dejar de correr
//                -- capar el tiempo dejando la distancia completa producía
//                un ritmo implícito imposible que "ganaría" con toda
//                seguridad la búsqueda del tramo más rápido: un récord
//                falso, esta vez demasiado RÁPIDO en vez de demasiado
//                lento (el problema contrario al de la v3.36). Ahora
//                _mejorTramo() distingue "parada de verdad" (poca o
//                ninguna distancia real en el hueco -- se sigue capando el
//                tiempo, como ya hacía) de "hueco no fiable" (mucho tiempo
//                Y mucha distancia real a la vez -- no hay forma de saber
//                el ritmo real ahí dentro, así que cualquier tramo
//                candidato que lo cruce se descarta directamente en vez de
//                adivinar). Con esto, cualquier récord (1/5/10/21.1/42.2
//                km) que se registre puede confiarse: o sale de un tramo
//                GPS completo y fiable de principio a fin, o no se
//                registra ningún récord para esa sesión.
// Versión: 3.37 - Bump de caché (v280 -> v281): index.html, app.js -- FIX
//                modales de admin (Detalle de usuario, y las 4 tarjetas
//                de listas: Total/Premium/Nuevos/Sesiones hoy): el botón
//                CERRAR se desplazaba con el scroll de la lista en vez de
//                quedarse fijo abajo -- había que bajar del todo para
//                llegar a él. Causa: .admin-modal-content (la caja que
//                envuelve cabecera+contenido+pie) tenía el overflow-y:auto
//                puesto a ELLA, así que los tres bloques hacían scroll
//                juntos como uno solo. Ahora .admin-modal-content es un
//                contenedor flex en columna que ya no hace scroll (over-
//                flow:hidden); cabecera y pie quedan fijos (flex-shrink:0)
//                y solo el div de contenido interior (#adminModalContent /
//                #adminListModalContent) crece y hace scroll -- el botón
//                CERRAR queda siempre visible sin importar cuántos
//                usuarios haya en la lista. De paso, en app.js, el reseteo
//                de scroll al abrir/cerrar el modal de detalle de usuario
//                apuntaba a la caja exterior (que ya no se mueve); ahora
//                apunta al div interior correcto, así que cada vez que se
//                abre con otro usuario aparece desde arriba, no por donde
//                se dejó la vez anterior. También había una regla CSS
//                duplicada específica de #adminListModal que volvía a
//                poner overflow-y:auto en toda la caja, deshaciendo el fix
//                solo para esa tarjeta -- se elimina.
// Versión: 3.36 - Bump de caché (v279 -> v280): gamification.js,
//                session-invites.js -- dos fixes:
//                1) gamification.js: FIX récord por km más lento que la
//                   propia media de la sesión (ej. sesión a 6:20/km de
//                   media, "nuevo récord" mostrado a 7:xx/km -- matemáti-
//                   camente imposible si de verdad es el tramo más
//                   rápido). Causa: _mejorTramo() calculaba la duración de
//                   cada tramo candidato como la diferencia bruta de
//                   marca de tiempo (reloj real) entre sus dos puntos GPS,
//                   sin descontar ninguna parada -- ni las del botón
//                   PAUSA (que sí se descuentan para la media de la
//                   sesión, ver _getElapsed() en gps-tracker.js), ni las
//                   paradas "silenciosas" sin pulsar pausa (semáforo,
//                   corte de señal bajo techo/entre edificios), que
//                   tampoco añaden puntos al track pero sí dejan pasar
//                   tiempo real. Si el tramo más rápido cruzaba uno de
//                   estos huecos, salía con una duración inflada. Ahora
//                   se usa un "tiempo activo" que tapa cualquier hueco
//                   entre dos puntos GPS consecutivos a un máximo de 8s
//                   antes de sumarlo (ver _MAX_GAP_MS), igual de estricto
//                   con una sesión corrida sin parar (los huecos normales
//                   entre puntos GPS son de pocos segundos) pero ya no
//                   penaliza un tramo por cruzar una parada larga.
//                2) session-invites.js: FIX bucle infinito en la pantalla
//                   "⏳ Calculando tu ritmo, tiempo y calorías..." al
//                   recibir una sesión enviada por un admin. Causa: un
//                   ReferenceError real (variables `modoParte`/
//                   `parteInput` usadas fuera del bloque donde se
//                   declaraban, para sesiones tipo 'series') que se
//                   disparaba en cuanto la comprobación de "sin zonas
//                   calculadas" no cortaba antes -- y esa comprobación
//                   nunca se disparaba de verdad porque miraba un campo
//                   que nunca llegaba a valer null. Al no capturarse el
//                   error, la ejecución se cortaba justo tras pintar el
//                   modal de "Calculando...", que quedaba así congelado
//                   para siempre. Ahora la comprobación de "sin zonas" se
//                   hace de forma fiable ANTES de intentar personalizar
//                   nada (mirando directamente si el destinatario tiene
//                   cálculo de zonas guardado): si no lo tiene, se avisa
//                   y la sesión se rechaza automáticamente en el momento
//                   (ya no se ofrece "ir a calcular zonas y volver más
//                   tarde" -- a petición del usuario, el admin tendrá que
//                   reenviarla cuando el destinatario tenga sus zonas).
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
// =====================================================================

const CACHE_NAME = 'ri5-v302';

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

console.log('[SW] sw.js cargado correctamente (v292)');
