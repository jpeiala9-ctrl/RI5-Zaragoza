// ============================================================
//  RI5 | Running LAB - Cloud Functions
//  eliminarCuentaCompleta: borra al 100 % la cuenta del usuario que la llama
//  (datos de Firestore, archivos de Storage y la cuenta de Firebase Auth).
//  Es idempotente: si algo falla a medias, el usuario puede volver a pulsar
//  y se reintenta (la cuenta de Auth se borra SIEMPRE la última).
// ============================================================
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

// Misma región que usa el cliente (auth.js -> functions('europe-west1'))
const REGION = 'europe-west1';
// Segundos máximos desde el último inicio de sesión (el cliente reautentica justo antes)
const MAX_EDAD_LOGIN_S = 5 * 60;

// Borra todos los documentos de una consulta (y sus subcolecciones) en lotes
async function borrarPorConsulta(query) {
  const snap = await query.get();
  for (const d of snap.docs) await db.recursiveDelete(d.ref);
  return snap.size;
}

// Aplica una actualización a todos los documentos de una consulta, en lotes de 400
async function actualizarPorConsulta(query, datos) {
  const snap = await query.get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach(d => batch.update(d.ref, datos));
    await batch.commit();
  }
  return snap.size;
}

exports.eliminarCuentaCompleta = onCall(
  { region: REGION, timeoutSeconds: 300, memory: '512MiB', maxInstances: 5 },
  async (request) => {
    // 1) Solo usuarios con sesión y correo verificado
    if (!request.auth || request.auth.token.email_verified !== true) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const uid = request.auth.uid;

    // 2) El inicio de sesión tiene que ser reciente (la app pide la contraseña justo antes)
    const authTime = Number(request.auth.token.auth_time || 0);
    if (!authTime || (Date.now() / 1000 - authTime) > MAX_EDAD_LOGIN_S) {
      throw new HttpsError('failed-precondition', 'reauth-required');
    }

    // 3) Un administrador no puede borrarse a sí mismo por esta vía (evita quedarse sin admin)
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const datosUsuario = userDoc.exists ? userDoc.data() : {};
    if (datosUsuario.isAdmin === true) {
      throw new HttpsError('permission-denied', 'Una cuenta de administrador no se puede eliminar desde la app.');
    }
    const username = datosUsuario.username || null;

    const fallos = [];
    const paso = async (nombre, fn) => {
      try { await fn(); } catch (e) { console.error(`Fallo en «${nombre}» (${uid}):`, e); fallos.push(nombre); }
    };

    // ---- Documentos propios (el de users incluye historial, planes, cálculos, gps_tracks, cargas, mensajes) ----
    await paso('gamificación', () => db.collection('gamification').doc(uid).delete());
    await paso('perfil social', () => db.collection('perfilSocial').doc(uid).delete());
    await paso('datos de salud', () => db.collection('saludPrivada').doc(uid).delete());
    await paso('datos privados', () => db.collection('usersPrivate').doc(uid).delete());
    await paso('buzón antiguo', async () => {
      await db.collection('mensajes').doc(uid).delete();
      await db.collection('mensajes').doc('admin_' + uid).delete();
    });

    // ---- Contenido propio repartido por otras colecciones ----
    await paso('publicaciones', () => borrarPorConsulta(db.collection('globalFeed').where('userId', '==', uid)));
    await paso('mensajes de soporte', async () => {
      await borrarPorConsulta(db.collection('soporteMensajes').where('fromUid', '==', uid));
      await borrarPorConsulta(db.collection('soporteMensajes').where('toUid', '==', uid));
    });
    await paso('solicitudes de amistad', async () => {
      await borrarPorConsulta(db.collection('friendRequests').where('from', '==', uid));
      await borrarPorConsulta(db.collection('friendRequests').where('to', '==', uid));
    });
    await paso('solicitudes de entrenador', async () => {
      await borrarPorConsulta(db.collection('trainerRequests').where('from', '==', uid));
      await borrarPorConsulta(db.collection('trainerRequests').where('to', '==', uid));
    });
    await paso('conversaciones', () => borrarPorConsulta(db.collection('conversations').where('participants', 'array-contains', uid)));
    await paso('invitaciones de sesión', async () => {
      await borrarPorConsulta(db.collection('sessionInvites').where('fromUid', '==', uid));
      await borrarPorConsulta(db.collection('sessionInvites').where('toUid', '==', uid));
    });
    await paso('grupos creados', () => borrarPorConsulta(db.collection('sessionGroups').where('createdBy', '==', uid)));

    // ---- Rastros del usuario en datos de otras personas ----
    await paso('grupos ajenos', () => actualizarPorConsulta(
      db.collection('sessionGroups').where('members', 'array-contains', uid), { members: FV.arrayRemove(uid) }));
    await paso('me gusta dados', () => actualizarPorConsulta(
      db.collection('globalFeed').where('likes', 'array-contains', uid), { likes: FV.arrayRemove(uid), likeCount: FV.increment(-1) }));
    await paso('listas de amigos', () => actualizarPorConsulta(
      db.collection('users').where('friendIds', 'array-contains', uid), { friendIds: FV.arrayRemove(uid), friendsCount: FV.increment(-1) }));
    await paso('listas de alumnos', () => actualizarPorConsulta(
      db.collection('users').where('alumnosAceptados', 'array-contains', uid), { alumnosAceptados: FV.arrayRemove(uid) }));
    await paso('listas de entrenadores', () => actualizarPorConsulta(
      db.collection('users').where('entrenadoresAceptados', 'array-contains', uid), { entrenadoresAceptados: FV.arrayRemove(uid) }));

    // ---- Nombre de usuario reservado: se libera ----
    await paso('nombre de usuario', async () => {
      if (username) await db.collection('usernames').doc(username).delete();
      const snap = await db.collection('usernames').where('uid', '==', uid).get();
      await Promise.all(snap.docs.map(d => d.ref.delete()));
    });

    // OJO: codigosReferido, referidos y comisiones NO se borran a propósito (mismo criterio que el borrado del admin):
    // las comisiones pendientes tienen que poder pagarse.

    // ---- Archivos de Storage ----
    await paso('archivos', async () => {
      const bucket = admin.storage().bucket();
      await bucket.deleteFiles({ prefix: `profile_pictures/${uid}/`, force: true });
      await bucket.deleteFiles({ prefix: `session_attachments/${uid}/`, force: true });
    });

    // ---- Documento principal (y todas sus subcolecciones) ----
    await paso('perfil', () => db.recursiveDelete(userRef));

    // Si algo ha fallado, NO se borra la cuenta de Auth: así el usuario puede volver a intentarlo
    // y no se quedan datos huérfanos sin forma de acceder a ellos.
    if (fallos.length) {
      throw new HttpsError('internal', 'No se pudo borrar todo: ' + fallos.join(', ') + '. Inténtalo de nuevo.');
    }

    // ---- Cuenta de inicio de sesión: siempre lo último ----
    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') {
        console.error('No se pudo borrar la cuenta de Auth:', e);
        throw new HttpsError('internal', 'Se borraron tus datos pero no la cuenta de acceso. Inténtalo de nuevo.');
      }
    }
    return { ok: true };
  }
);
