// ==================== group-sessions.js ====================
// Versión: 1.2 - Sesiones compartidas con verificación GPS obligatoria
// ====================

const GroupSessions = {
  // ============================================================
  // 1. CREAR INVITACIÓN (1 o más amigos)
  // ============================================================
  async invitar(fromUserId, toUserIds, sesion, diaGlobal = null) {
    if (!fromUserId || !toUserIds || !Array.isArray(toUserIds) || toUserIds.length === 0) {
      throw new Error('Faltan datos para crear la invitación');
    }
    if (!sesion) throw new Error('La sesión no puede estar vacía');

    const participants = [fromUserId, ...toUserIds];
    const participantStates = {};
    for (const uid of participants) {
      participantStates[uid] = {
        accepted: uid === fromUserId,
        completed: false,
        gpsTrackId: null,
        distance: null,
        duration: null,
        pace: null,
        verified: false
      };
    }

    const ref = firebaseServices.db.collection('groupSessions').doc();
    const data = {
      createdBy: fromUserId,
      participants: participants,
      status: 'pending', // pending | active | completed | rejected | cancelled
      sesion: {
        tipo: sesion.tipo,
        duracion: sesion.duracion || 0,
        detalle: sesion.detalle ? JSON.parse(JSON.stringify(sesion.detalle)) : null,
        diaGlobalOriginal: diaGlobal || null,
        fuente: diaGlobal ? 'plan' : 'manual'
      },
      createdAt: firebaseServices.Timestamp.now(),
      updatedAt: firebaseServices.Timestamp.now(),
      scheduledDate: null,
      completedAt: null,
      participantStates: participantStates,
      verified: false,
      verificationMethod: 'gps',
      isChallenge: false,
      challengeId: null,
      chatMessageIds: {} // { uid: messageId }
    };

    await ref.set(data);

    // Enviar mensaje especial a cada destinatario
    const creatorUsername = AppState.currentUserData?.username || 'Alguien';
    const sesionNombre = sesion.detalle?.nombre || sesion.tipo;

    const messageIds = {};
    for (const uid of toUserIds) {
      const messageText = `📩 @${creatorUsername} te ha invitado a entrenar: ${sesionNombre}`;
      const messageId = await Chat.enviarMensajeEspecial(fromUserId, uid, {
        type: 'group_invitation',
        groupSessionId: ref.id,
        text: messageText
      });
      if (messageId) messageIds[uid] = messageId;
    }

    if (Object.keys(messageIds).length > 0) {
      await ref.update({ chatMessageIds: messageIds });
    }

    return ref.id;
  },

  // ============================================================
  // 2. ACEPTAR INVITACIÓN
  // ============================================================
  async aceptar(groupId, userId) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('La sesión grupal no existe');
    const data = doc.data();
    if (data.status !== 'pending') throw new Error('La invitación ya ha sido procesada');
    if (!data.participants.includes(userId)) throw new Error('No eres participante de esta sesión');

    // Marcar como aceptado
    await ref.update({
      [`participantStates.${userId}.accepted`]: true,
      updatedAt: firebaseServices.Timestamp.now()
    });

    // Verificar si todos han aceptado para pasar a 'active'
    const allAccepted = data.participants.every(uid => data.participantStates[uid]?.accepted === true);
    if (allAccepted) {
      await ref.update({ status: 'active' });
    }

    // Añadir la sesión al calendario del usuario (si tiene plan activo)
    await this._añadirSesionAlCalendario(userId, data.sesion);

    // Notificar al creador (mensaje en el chat)
    if (userId !== data.createdBy) {
      await Chat.enviarMensajeEspecial(userId, data.createdBy, {
        type: 'group_accepted',
        groupSessionId: groupId,
        text: `✅ @${AppState.currentUserData?.username} ha aceptado la invitación`
      });
    }

    return true;
  },

  // ============================================================
  // 3. RECHAZAR INVITACIÓN
  // ============================================================
  async rechazar(groupId, userId) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('La sesión grupal no existe');
    const data = doc.data();
    if (data.status !== 'pending') throw new Error('La invitación ya ha sido procesada');

    // Marcar como rechazado
    await ref.update({
      [`participantStates.${userId}.accepted`]: false,
      status: 'rejected',
      updatedAt: firebaseServices.Timestamp.now()
    });

    // Si el creador rechaza, cancelar toda la sesión
    if (userId === data.createdBy) {
      await ref.update({ status: 'cancelled' });
      // Notificar a todos que el creador canceló
      for (const uid of data.participants) {
        if (uid !== userId) {
          await Chat.enviarMensajeEspecial(data.createdBy, uid, {
            type: 'group_cancelled',
            groupSessionId: groupId,
            text: `❌ @${AppState.currentUserData?.username} ha cancelado la sesión grupal`
          });
        }
      }
    }

    return true;
  },

  // ============================================================
  // 4. SUBIR TRACK GPS (desde el GPS tracker)
  // ============================================================
  async subirTrack(groupId, userId, trackData) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('La sesión grupal no existe');
    const data = doc.data();
    if (data.status !== 'active') throw new Error('La sesión no está activa');
    if (!data.participants.includes(userId)) throw new Error('No eres participante');

    // Guardar el track en la subcolección gps_tracks del usuario
    const trackId = await this._guardarTrackUsuario(userId, trackData);

    await ref.update({
      [`participantStates.${userId}.gpsTrackId`]: trackId,
      [`participantStates.${userId}.distance`]: trackData.distanceKm,
      [`participantStates.${userId}.duration`]: trackData.durationMs,
      [`participantStates.${userId}.pace`]: trackData.distanceKm > 0 ? (trackData.durationMs / 1000) / trackData.distanceKm : null,
      updatedAt: firebaseServices.Timestamp.now()
    });

    // Verificar si todos han subido su track
    await this._verificarYCompletar(groupId);
  },

  // ============================================================
  // 5. VERIFICACIÓN AUTOMÁTICA Y COMPLETADO
  // ============================================================
  async _verificarYCompletar(groupId) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) return;
    const data = doc.data();

    // Todos los participantes deben tener track (incluyendo el creador)
    const allHaveTrack = data.participants.every(uid => data.participantStates[uid].gpsTrackId);
    if (!allHaveTrack) return;

    // Extraer métricas
    const metrics = data.participants.map(uid => ({
      uid,
      distance: data.participantStates[uid].distance,
      duration: data.participantStates[uid].duration,
      pace: data.participantStates[uid].pace
    }));

    // Verificar consistencia (distancia ±15%, ritmo ±30%, duración ±20%)
    const distances = metrics.map(m => m.distance).filter(d => d !== null && d > 0);
    if (distances.length < 2) {
      await ref.update({ verified: false });
      return;
    }

    const maxDist = Math.max(...distances);
    const minDist = Math.min(...distances);
    const diffPercent = (maxDist - minDist) / maxDist * 100;

    const paces = metrics.map(m => m.pace).filter(p => p !== null && p > 0);
    let paceDiffOk = true;
    if (paces.length >= 2) {
      const maxPace = Math.max(...paces);
      const minPace = Math.min(...paces);
      const paceDiff = (maxPace - minPace) / maxPace * 100;
      if (paceDiff > 30) paceDiffOk = false;
    }

    const durations = metrics.map(m => m.duration).filter(d => d !== null && d > 0);
    let durationDiffOk = true;
    if (durations.length >= 2) {
      const maxDur = Math.max(...durations);
      const minDur = Math.min(...durations);
      const durDiff = (maxDur - minDur) / maxDur * 100;
      if (durDiff > 20) durationDiffOk = false;
    }

    const verified = (diffPercent <= 15) && paceDiffOk && durationDiffOk;

    // Actualizar estado de verificación
    const updates = {};
    for (const uid of data.participants) {
      updates[`participantStates.${uid}.verified`] = verified;
    }
    updates.verified = verified;
    updates.updatedAt = firebaseServices.Timestamp.now();

    if (verified) {
      updates.status = 'completed';
      updates.completedAt = firebaseServices.Timestamp.now();
      await ref.update(updates);
      await this._completarSesionParaTodos(groupId, data);
    } else {
      await ref.update(updates);
      await this._notificarFalloVerificacion(groupId, data);
    }
  },

  // ============================================================
  // 6. COMPLETAR SESIÓN PARA TODOS (gamificación + muro)
  // ============================================================
  async _completarSesionParaTodos(groupId, data) {
    const participants = data.participants;
    const sesion = data.sesion;

    // Actualizar gamificación de cada participante
    for (const uid of participants) {
      const metricas = {
        distanciaTotal: data.participantStates[uid].distance || 0,
        tssTotal: 0
      };
      await Gamification.updateAfterSession(uid, {
        tipo: sesion.tipo,
        duracion: sesion.duracion,
        detalle: sesion.detalle
      }, metricas);
    }

    // Publicación conjunta en el muro
    const usernames = [];
    for (const uid of participants) {
      const userData = await Storage.getUser(uid);
      if (userData) usernames.push(userData.username);
    }
    const totalDistance = participants.reduce((sum, uid) => sum + (data.participantStates[uid].distance || 0), 0);
    const avgDistance = totalDistance / participants.length;
    const avgDuration = participants.reduce((sum, uid) => sum + (data.participantStates[uid].duration || 0), 0) / participants.length;

    const entry = {
      userId: participants[0],
      username: usernames.join(' y '),
      trainingType: sesion.tipo,
      duration: Math.round(avgDuration / 60000),
      distancia: parseFloat(avgDistance.toFixed(2)),
      tss: 0,
      timestamp: firebaseServices.Timestamp.now(),
      planId: null,
      sesionIndex: null,
      zone: sesion.detalle?.zona || '',
      trainingName: sesion.detalle?.nombre || '',
      hasGPS: true,
      trackPoints: [],
      isGroup: true,
      participants: usernames
    };

    await firebaseServices.db.collection('globalFeed').add(entry);

    // Notificar a todos que la sesión se completó
    for (const uid of participants) {
      if (uid !== data.createdBy) {
        await Chat.enviarMensajeEspecial(data.createdBy, uid, {
          type: 'group_completed',
          groupSessionId: groupId,
          text: `✅ Sesión grupal completada: ${sesion.detalle?.nombre || sesion.tipo}`
        });
      }
    }
  },

  // ============================================================
  // 7. FUNCIONES AUXILIARES
  // ============================================================
  async _guardarTrackUsuario(userId, trackData) {
    const trackRef = await firebaseServices.db
      .collection('users')
      .doc(userId)
      .collection('gps_tracks')
      .add({
        points: trackData.points || [],
        distanceKm: trackData.distanceKm,
        durationMs: trackData.durationMs,
        recordedAt: firebaseServices.Timestamp.now()
      });
    return trackRef.id;
  },

  async _notificarFalloVerificacion(groupId, data) {
    for (const uid of data.participants) {
      await Chat.enviarMensajeEspecial(data.createdBy, uid, {
        type: 'group_verification_failed',
        groupSessionId: groupId,
        text: `⚠️ Las métricas de la sesión grupal no coinciden. Revisa los tracks.`
      });
    }
  },

  async _añadirSesionAlCalendario(userId, sesion) {
    // Guardar en una subcolección "sharedSessions" del usuario
    const sharedRef = firebaseServices.db
      .collection('users')
      .doc(userId)
      .collection('sharedSessions')
      .doc();
    await sharedRef.set({
      sesion: sesion,
      groupId: null,
      addedAt: firebaseServices.Timestamp.now(),
      completed: false
    });
  },

  // ============================================================
  // 8. OBTENER SESIONES GRUPALES (para el tab GRUPO)
  // ============================================================
  async getPendientes(userId) {
    const snapshot = await firebaseServices.db
      .collection('groupSessions')
      .where('participants', 'array-contains', userId)
      .where('status', 'in', ['pending', 'active'])
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async get(groupId) {
    const doc = await firebaseServices.db.collection('groupSessions').doc(groupId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  // ============================================================
  // 9. SELECTOR DE AMIGOS (para calendar.js)
  // ============================================================
  async mostrarSelectorAmigos(sesion, diaGlobal) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = 'groupInviteOverlay';
      overlay.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.85); backdrop-filter:blur(4px);
        z-index:50000; display:flex; align-items:center; justify-content:center;
      `;

      const modal = document.createElement('div');
      modal.style.cssText = `
        background:var(--bg-card); border-radius:16px; padding:24px;
        max-width:500px; width:90%; max-height:80vh; overflow-y:auto;
        border:1px solid var(--border-color);
      `;

      modal.innerHTML = `
        <h3 style="margin:0 0 16px 0; color:var(--accent-yellow);">👥 Invitar a amigos</h3>
        <p style="margin-bottom:16px; color:var(--text-secondary);">Selecciona los amigos que quieres invitar a esta sesión</p>
        <div id="friendsListSelector" style="margin-bottom:16px;"></div>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="confirmInviteBtn" class="action-button" style="flex:1; margin:0;">ENVIAR INVITACIÓN</button>
          <button id="cancelInviteBtn" class="action-button" style="flex:1; margin:0; border-color:var(--border-color);">CANCELAR</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Cargar lista de amigos
      const listContainer = document.getElementById('friendsListSelector');
      if (listContainer) {
        Friends.cargarListaAmigos().then(() => {
          const amigosItems = document.querySelectorAll('#listaAmigos .resultado-busqueda');
          listContainer.innerHTML = '';
          for (const item of amigosItems) {
            const clone = item.cloneNode(true);
            const uid = clone.querySelector('.resultado-info')?.dataset.uid;
            const nombre = clone.querySelector('.resultado-nombre')?.textContent || '';
            if (uid) {
              const btnContainer = clone.querySelector('div:last-child');
              if (btnContainer) {
                btnContainer.innerHTML = `
                  <input type="checkbox" class="friend-checkbox" data-uid="${uid}" style="width:24px;height:24px;margin:0;accent-color:var(--accent-blue);">
                `;
              }
              clone.style.cursor = 'pointer';
              clone.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                  const cb = clone.querySelector('.friend-checkbox');
                  if (cb) cb.checked = !cb.checked;
                }
              });
              listContainer.appendChild(clone);
            }
          }
        });
      }

      document.getElementById('cancelInviteBtn')?.addEventListener('click', () => {
        overlay.remove();
        resolve(null);
      });

      document.getElementById('confirmInviteBtn')?.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.friend-checkbox:checked');
        const selectedUids = Array.from(checkboxes).map(cb => cb.dataset.uid);
        if (selectedUids.length === 0) {
          Utils.showToast('Selecciona al menos un amigo', 'warning');
          return;
        }
        overlay.remove();
        try {
          const groupId = await GroupSessions.invitar(AppState.currentUserId, selectedUids, sesion, diaGlobal);
          Utils.showToast(`✅ Invitación enviada a ${selectedUids.length} amigo(s)`, 'success');
          resolve(groupId);
        } catch (error) {
          Utils.showToast('Error al enviar invitación: ' + error.message, 'error');
          resolve(null);
        }
      });
    });
  }
};

window.GroupSessions = GroupSessions;
console.log('✅ GroupSessions v1.2 - Sesiones compartidas con verificación GPS');