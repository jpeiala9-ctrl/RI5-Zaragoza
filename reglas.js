rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================================
    //  FUNCIONES AUXILIARES (reutilizables)
    // ============================================================
    function isAuth() {
      return request.auth != null;
    }

    function myUid() {
      return request.auth.uid;
    }

    function isOwner(userId) {
      return isAuth() && myUid() == userId;
    }

    function isAdmin() {
      return isAuth()
        && exists(/databases/$(database)/documents/users/$(myUid()))
        && get(/databases/$(database)/documents/users/$(myUid())).data.isAdmin == true;
    }

    function changedKeys() {
      return request.resource.data.diff(resource.data).affectedKeys();
    }

    // Campos que un usuario puede modificar por sí mismo (sin ser admin)
    function safeUserKeys() {
      return changedKeys().hasOnly([
        'profile',
        'calculosMes',
        'mesActual',
        'lastLogin',
        'username_lowercase',
        'ultimoPlanId',
        'ultimoCalculoId',
        'friendIds',
        'friendsCount',
        'ultimaSesion'
      ]);
    }

    // Impide que un usuario se otorgue privilegios (admin, premium, etc.)
    function noPrivilegeEscalation() {
      return !changedKeys().hasAny([
        'isAdmin', 'premium', 'expires', 'emailVerified'
      ]);
    }

    // Permite corregir tu PROPIO premium de true a false SOLO si ya ha
    // caducado. Nunca permite subirlo a true ni tocar la fecha de
    // caducidad por esta vía: es una excepción estrecha, no un agujero.
    // 'expires' se guarda como texto ISO (no como Timestamp nativo), así
    // que se convierte con timestamp.value() para poder compararlo.
    function puedeCorregirPremiumExpirado() {
      return changedKeys().hasOnly(['premium'])
        && resource.data.premium == true
        && request.resource.data.premium == false
        && resource.data.expires is string
        && timestamp.value(resource.data.expires) < request.time;
    }

    // Permite tocar friendIds/friendsCount de OTRO usuario solo en dos
    // casos reales: aceptar una solicitud pendiente que esa persona te
    // envió (se comprueba que el documento de la solicitud existe de
    // verdad, con ese destinatario y en estado pendiente), o eliminar una
    // amistad que ya existía. Antes cualquier usuario autenticado podía
    // escribir esos campos en el documento de cualquier otro, sin
    // comprobar que hubiera una solicitud aceptada de por medio.
    function puedeModificarAmistadDeOtro(userId) {
      return changedKeys().hasOnly(['friendIds', 'friendsCount']) && (
        (
          exists(/databases/$(database)/documents/friendRequests/$(userId + '_' + myUid()))
          && get(/databases/$(database)/documents/friendRequests/$(userId + '_' + myUid())).data.to == myUid()
          && get(/databases/$(database)/documents/friendRequests/$(userId + '_' + myUid())).data.status == 'pending'
          && myUid() in request.resource.data.friendIds
        )
        || (
          myUid() in resource.data.friendIds
          && !(myUid() in request.resource.data.friendIds)
        )
      );
    }

    // Comprueba si el usuario actual es amigo del userId dado
    function isFriendOf(userId) {
      return isAuth()
        && exists(/databases/$(database)/documents/users/$(userId))
        && myUid() in get(/databases/$(database)/documents/users/$(userId)).data.friendIds;
    }

    // Permite que un participante de una conversación actualice SOLO su
    // propia entrada dentro de participantsData (por ejemplo, para
    // repintar su foto de perfil cuando la cambia). Comprueba que la
    // única clave de nivel superior tocada sea 'participantsData' y que,
    // dentro de ese mapa, solo se haya modificado su propio uid: así no
    // puede tocar el nombre ni la foto que se guardaron del otro
    // participante.
    function soloTocaMiParticipantsData() {
      return changedKeys().hasOnly(['participantsData'])
        && request.resource.data.participantsData.diff(resource.data.participantsData)
             .affectedKeys().hasOnly([myUid()]);
    }

    // ============================================================
    //  1. USUARIOS
    // ============================================================
    match /users/{userId} {
      allow read: if isAuth();

      allow create: if isAuth()
        && myUid() == userId
        && request.resource.data.isAdmin == false;

      allow update: if (isOwner(userId) && noPrivilegeEscalation() && safeUserKeys())
        || (isOwner(userId) && puedeCorregirPremiumExpirado())
        || isAdmin()
        || (isAuth() && puedeModificarAmistadDeOtro(userId));

      allow delete: if isAdmin();

      match /historial/{entryId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
      match /planes/{planId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
      match /calculos/{calculoId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
      match /gps_tracks/{trackId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }

      // ========== NUEVA REGLA PARA MENSAJES DE SOPORTE ==========
      match /mensajes/{messageId} {
        allow read: if isAuth() && (myUid() == userId || isAdmin());
        allow write: if isAuth() && (myUid() == userId || isAdmin());
      }
      // ==========================================================
    }

    // ============================================================
    //  2. USERNAMES (reserva de nombres de usuario)
    // ============================================================
    match /usernames/{username} {
      allow read: if true;
      allow create: if isAuth();
      allow update, delete: if isAdmin();
    }

    // ============================================================
    //  3. MENSAJES DE SOPORTE (buzón personal - sistema antiguo)
    // ============================================================
    match /mensajes/{docId} {
      // El usuario lee su buzón de respuestas (docId == su uid); el admin lee todo
      allow read: if isAuth() && (
        myUid() == docId
        || isAdmin()
        || docId == 'admin_' + myUid()
      );

      // El usuario puede crear:
      //   - su buzón de respuestas del admin (docId == myUid())
      //   - el buzón de solicitudes global
      //   - su buzón de mensajes salientes hacia el admin (docId == 'admin_' + myUid())
      allow create: if isAuth() && (
        docId == myUid()
        || docId == 'admin_solicitudes'
        || docId == 'admin_' + myUid()
      );

      // El usuario puede actualizar su propio buzón y su buzón saliente;
      // el admin puede actualizar cualquiera
      allow update: if isAuth() && (
        myUid() == docId
        || isAdmin()
        || docId == 'admin_solicitudes'
        || docId == 'admin_' + myUid()
      );

      allow delete: if isAdmin();
    }

    // ============================================================
    //  4. NUEVO SISTEMA DE SOPORTE INDEPENDIENTE (colección soporteMensajes)
    // ============================================================
    match /soporteMensajes/{mensajeId} {
      // Leer: el usuario puede ver sus mensajes (enviados o recibidos), el admin puede ver todos
      allow read: if isAuth() && (
        resource.data.toUid == myUid() 
        || resource.data.fromUid == myUid() 
        || isAdmin()
      );

      // Crear: cualquier usuario autenticado puede crear un mensaje (debe ser de él o para él)
      allow create: if isAuth() && (
        request.resource.data.fromUid == myUid() 
        || request.resource.data.toUid == myUid()
      );

      // Actualizar: solo el propietario (toUid o fromUid) o admin puede marcar como leído
      allow update: if isAuth() && (
        resource.data.toUid == myUid() 
        || resource.data.fromUid == myUid() 
        || isAdmin()
      ) && changedKeys().hasOnly(['leido']);

      // Eliminar: solo admin
      allow delete: if isAdmin();
    }

    // ============================================================
    //  5. SOLICITUDES DE AMISTAD
    // ============================================================
    match /friendRequests/{requestId} {
      allow read: if isAuth() && (
        resource.data.from == myUid()
        || resource.data.to == myUid()
        || isAdmin()
      );

      allow create: if isAuth()
        && request.resource.data.from == myUid()
        && request.resource.data.to != myUid()
        && request.resource.data.status == 'pending';

      allow update: if isAuth() && (
        (resource.data.to == myUid()
          && request.resource.data.status in ['accepted', 'rejected'])
        || (resource.data.from == myUid()
          && request.resource.data.status in ['pending', 'cancelled'])
      );

      allow delete: if isAdmin();
    }

    // ============================================================
    //  6. CHAT (CONVERSACIONES Y MENSAJES)
    // ============================================================
    match /conversations/{conversationId} {
      allow read: if isAuth() && (myUid() in resource.data.participants || isAdmin());
      allow list: if isAuth() && (myUid() in resource.data.participants || isAdmin());

      allow create: if isAuth()
        && myUid() in request.resource.data.participants
        && request.resource.data.participants.size() == 2;

      allow update: if isAuth()
        && myUid() in resource.data.participants
        && (
          changedKeys().hasOnly(['lastMessage', 'lastUpdated'])
          || soloTocaMiParticipantsData()
        );

      match /messages/{messageId} {
        function convParticipants() {
          return get(/databases/$(database)/documents/conversations/$(conversationId))
            .data.participants;
        }

        allow read: if isAuth() && myUid() in convParticipants();

        allow create: if isAuth()
          && myUid() in convParticipants()
          && request.resource.data.senderId == myUid()
          && request.resource.data.text.size() > 0
          && request.resource.data.text.size() <= 1000;

        allow update: if isAuth()
          && myUid() in convParticipants()
          && request.resource.data.diff(resource.data)
               .affectedKeys().hasOnly(['read', 'readBy']);

        allow delete: if isAuth() && myUid() in convParticipants();
      }
    }

    // ============================================================
    //  7. MURO GLOBAL
    // ============================================================
    match /globalFeed/{entryId} {
      allow read: if isAuth();

      allow create: if isAuth()
        && request.resource.data.userId == myUid()
        && request.resource.data.likeCount == 0
        && request.resource.data.likes.size() == 0;

      allow update: if isAuth() && (
        resource.data.userId == myUid()
        || (
          request.resource.data.diff(resource.data)
            .affectedKeys().hasOnly(['likes', 'likeCount'])
          && request.resource.data.likeCount == request.resource.data.likes.size()
          && resource.data.userId != myUid()
        )
      );

      allow delete: if isAuth() && (
        resource.data.userId == myUid() || isAdmin()
      );
    }

    // ============================================================
    //  8. GAMIFICACIÓN (pasaporte, nivel, insignias, zapatillas)
    // ============================================================
    match /gamification/{userId} {
      allow read: if isAuth() && (myUid() == userId || isFriendOf(userId) || isAdmin());
      allow write: if isAuth() && (myUid() == userId || isAdmin());
    }

    // ============================================================
    //  8b. PERFIL SOCIAL (bio, edad, ciudad -- visible solo a amigos)
    // ============================================================
    // Espejo de users/{uid}.profile.{bio,age,city} en su propia colección:
    // users/{uid} tiene que seguir siendo legible por cualquier usuario
    // autenticado (username, foto, altas de amistad...), así que no se
    // puede restringir SOLO esos campos ahí dentro -- Firestore no
    // permite reglas por campo, solo por documento. Al vivir aparte, sí
    // se puede aplicar la misma regla "solo yo, mis amigos, o admin" que
    // ya usa gamification.
    match /perfilSocial/{userId} {
      allow read: if isAuth() && (myUid() == userId || isFriendOf(userId) || isAdmin());
      allow write: if isAuth() && (myUid() == userId || isAdmin());
    }

    // ============================================================
    //  9. SESIONES ENVIADAS POR EL ADMIN (Generar sesión)
    // ============================================================
    match /sessionInvites/{inviteId} {
      // Leer: el admin que la envió, el usuario destinatario, o cualquier admin
      allow read: if isAuth() && (
        resource.data.fromUid == myUid()
        || resource.data.toUid == myUid()
        || isAdmin()
      );

      // Crear: solo un admin, y siempre como remitente de sí mismo y en pendiente
      allow create: if isAdmin()
        && request.resource.data.fromUid == myUid()
        && request.resource.data.status == 'pending';

      // Actualizar: el destinatario solo puede cambiar 'status' a
      // accepted/rejected (nada más); el admin puede actualizar cualquier cosa
      allow update: if isAuth() && (
        (
          resource.data.toUid == myUid()
          && changedKeys().hasOnly(['status'])
          && request.resource.data.status in ['accepted', 'rejected']
        )
        || isAdmin()
      );

      allow delete: if isAdmin();
    }

    // ============================================================
    //  10. GRUPOS DE DESTINATARIOS (para "Generar sesión")
    // ============================================================
    // Cada admin crea sus propios grupos (ej. "Gimnasio", "Amigos") para
    // marcar de golpe a todos sus miembros al enviar una sesión desde
    // "Generar sesión" (session-invites.js: colección 'sessionGroups',
    // campos name / members[] / createdBy / createdAt). Un grupo solo lo
    // puede leer, editar o eliminar el mismo admin que lo creó
    // (createdBy) -- nunca otro admin, y nunca un usuario normal. Los
    // "miembros" del grupo son simplemente uids guardados dentro del
    // propio documento del grupo (no hay que darles permiso a ELLOS
    // sobre el grupo: nunca lo leen ni lo escriben, solo reciben las
    // sessionInvites resultantes, que ya tienen sus propias reglas arriba).
    match /sessionGroups/{groupId} {
      allow read: if isAdmin() && resource.data.createdBy == myUid();

      allow create: if isAdmin()
        && request.resource.data.createdBy == myUid();

      // No se permite cambiar el dueño del grupo (createdBy) al editarlo,
      // solo su nombre y sus miembros.
      allow update: if isAdmin()
        && resource.data.createdBy == myUid()
        && request.resource.data.createdBy == myUid();

      allow delete: if isAdmin() && resource.data.createdBy == myUid();
    }

  }
}
