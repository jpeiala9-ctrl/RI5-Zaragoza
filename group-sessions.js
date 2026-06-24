// ==================== group-sessions.js ====================
// Versión: 1.6 - Corrección definitiva: la sesión aparece en el tab GRUPO
// ====================

const GroupSessions = {
  // ============================================================
  // 1. CREAR INVITACIÓN
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
      status: 'pending',
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
      chatMessageIds: {}
    };

    await ref.set(data);

    const creatorUsername = AppState.currentUserData?.username || 'Alguien';
    const sesionNombre = sesion.detalle?.nombre || sesion.tipo;
    const messageIds = {};

    for (const uid of toUserIds) {
      try {
        const messageText = `📩 @${creatorUsername} te ha invitado a entrenar: ${sesionNombre}`;
        const messageId = await Chat.enviarMensajeEspecial(fromUserId, uid, {
          type: 'group_invitation',
          groupSessionId: ref.id,
          text: messageText
        });
        if (messageId) messageIds[uid] = messageId;
      } catch (e) {
        console.error('Error enviando mensaje a', uid, e);
      }
    }

    if (Object.keys(messageIds).length > 0) {
      try {
        await ref.update({ chatMessageIds: messageIds });
      } catch (e) {
        console.warn('No se pudo guardar chatMessageIds, pero la sesión se creó:', e);
      }
    }

    return ref.id;
  },

  // ============================================================
  // 2. ACEPTAR INVITACIÓN (con recarga del tab GRUPO)
  // ============================================================
  async aceptar(groupId, userId) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('La sesión grupal no existe');
    const data = doc.data();
    if (data.status !== 'pending') throw new Error('La invitación ya ha sido procesada');
    if (!data.participants.includes(userId)) throw new Error('No eres participante de esta sesión');

    await ref.update({
      [`participantStates.${userId}.accepted`]: true,
      updatedAt: firebaseServices.Timestamp.now()
    });

    const allAccepted = data.participants.every(uid => data.participantStates[uid]?.accepted === true);
    if (allAccepted) {
      await ref.update({ status: 'active' });
    }

    await this._añadirSesionAlCalendario(userId, data.sesion);

    if (userId !== data.createdBy) {
      await Chat.enviarMensajeEspecial(userId, data.createdBy, {
        type: 'group_accepted',
        groupSessionId: groupId,
        text: `✅ @${AppState.currentUserData?.username} ha aceptado la invitación`
      });
    }

    // === NUEVO: Recargar el tab GRUPO si está activo ===
    this._recargarTabGrupo();

    return true;
  },

  // ============================================================
  // 3. RECHAZAR INVITACIÓN (con recarga del tab GRUPO)
  // ============================================================
  async rechazar(groupId, userId) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('La sesión grupal no existe');
    const data = doc.data();
    if (data.status !== 'pending') throw new Error('La invitación ya ha sido procesada');

    await ref.update({
      [`participantStates.${userId}.accepted`]: false,
      status: 'rejected',
      updatedAt: firebaseServices.Timestamp.now()
    });

    if (userId === data.createdBy) {
      await ref.update({ status: 'cancelled' });
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

    // === NUEVO: Recargar el tab GRUPO si está activo ===
    this._recargarTabGrupo();

    return true;
  },

  // ============================================================
  // 4. SUBIR TRACK GPS
  // ============================================================
  async subirTrack(groupId, userId, trackData) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('La sesión grupal no existe');
    const data = doc.data();
    if (data.status !== 'active') throw new Error('La sesión no está activa');
    if (!data.participants.includes(userId)) throw new Error('No eres participante');

    const trackId = await this._guardarTrackUsuario(userId, trackData);

    await ref.update({
      [`participantStates.${userId}.gpsTrackId`]: trackId,
      [`participantStates.${userId}.distance`]: trackData.distanceKm,
      [`participantStates.${userId}.duration`]: trackData.durationMs,
      [`participantStates.${userId}.pace`]: trackData.distanceKm > 0 ? (trackData.durationMs / 1000) / trackData.distanceKm : null,
      updatedAt: firebaseServices.Timestamp.now()
    });

    await this._verificarYCompletar(groupId);
  },

  // ============================================================
  // 5. VERIFICACIÓN AUTOMÁTICA
  // ============================================================
  async _verificarYCompletar(groupId) {
    const ref = firebaseServices.db.collection('groupSessions').doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) return;
    const data = doc.data();

    const allHaveTrack = data.participants.every(uid => data.participantStates[uid].gpsTrackId);
    if (!allHaveTrack) return;

    const metrics = data.participants.map(uid => ({
      uid,
      distance: data.participantStates[uid].distance,
      duration: data.participantStates[uid].duration,
      pace: data.participantStates[uid].pace
    }));

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
  // 6. COMPLETAR SESIÓN PARA TODOS
  // ============================================================
  async _completarSesionParaTodos(groupId, data) {
    const participants = data.participants;
    const sesion = data.sesion;

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
  // 8. RECARGAR TAB GRUPO (si está activo) - CORREGIDO
  // ============================================================
  _recargarTabGrupo() {
    // Comprobar si el panel grupo está visible
    const grupoPanel = document.getElementById('amigos-grupo');
    if (grupoPanel && grupoPanel.classList.contains('active')) {
      if (typeof Friends !== 'undefined' && typeof Friends.cargarSesionesGrupo === 'function') {
        setTimeout(() => Friends.cargarSesionesGrupo(), 500);
      }
    }
  },

  // ============================================================
  // 9. OBTENER SESIONES GRUPALES
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
  // 10. SELECTOR DE AMIGOS
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
        <div id="friendsListSelector" style="margin-bottom:16px;">
          <div style="text-align:center; padding:20px; color:var(--text-secondary);">Cargando amigos...</div>
        </div>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="confirmInviteBtn" class="action-button" style="flex:1; margin:0;">ENVIAR INVITACIÓN</button>
          <button id="cancelInviteBtn" class="action-button" style="flex:1; margin:0; border-color:var(--border-color);">CANCELAR</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const listContainer = document.getElementById('friendsListSelector');
      if (listContainer) {
        const friendIds = AppState.currentUserData?.friendIds || [];
        if (friendIds.length === 0) {
          listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-secondary);">No tienes amigos. Añade amigos para invitarlos.</p>';
        } else {
          (async () => {
            try {
              const amigosData = [];
              for (let i = 0; i < friendIds.length; i += 10) {
                const batch = friendIds.slice(i, i + 10);
                const snapshots = await Promise.all(batch.map(fid => firebaseServices.db.collection('users').doc(fid).get()));
                snapshots.forEach(doc => {
                  if (doc.exists) amigosData.push({ uid: doc.id, ...doc.data() });
                });
              }
              if (amigosData.length === 0) {
                listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-secondary);">No se encontraron datos de amigos.</p>';
                return;
              }
              let html = '';
              for (const amigo of amigosData) {
                const usernameFormatted = Utils.capitalizeUsername(amigo.username);
                const photoURL = amigo.profile?.photoURL;
                const avatarHTML = photoURL
                  ? `<img src="${Utils.escapeHTML(photoURL)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
                  : `<div style="width:40px;height:40px;border-radius:50%;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;">👤</div>`;
                html += `
                  <div class="friend-select-item" data-uid="${amigo.uid}" style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-secondary);border-radius:10px;margin-bottom:8px;cursor:pointer;border:1px solid var(--border-color);transition:all 0.2s;">
                    ${avatarHTML}
                    <div style="flex:1;">
                      <div style="font-weight:bold;color:var(--accent-yellow);">${Utils.escapeHTML(usernameFormatted)}</div>
                      <div style="font-size:12px;color:var(--text-secondary);">@${Utils.escapeHTML(amigo.username)}</div>
                    </div>
                    <input type="checkbox" class="friend-checkbox" data-uid="${amigo.uid}" style="width:24px;height:24px;margin:0;accent-color:var(--accent-blue);">
                  </div>
                `;
              }
              listContainer.innerHTML = html;
              listContainer.querySelectorAll('.friend-select-item').forEach(item => {
                item.addEventListener('click', (e) => {
                  if (e.target.tagName !== 'INPUT') {
                    const cb = item.querySelector('.friend-checkbox');
                    if (cb) cb.checked = !cb.checked;
                  }
                });
              });
            } catch (error) {
              console.error('Error cargando amigos:', error);
              listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--zone-5);">Error al cargar amigos.</p>';
            }
          })();
        }
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
console.log('✅ GroupSessions v1.6 - Recarga automática del tab GRUPO al aceptar/rechazar');