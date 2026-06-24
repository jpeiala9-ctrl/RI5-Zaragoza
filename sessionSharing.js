// ==================== sessionSharing.js ====================
// Versión: 1.0 - Compartir sesiones entre amigos
// ====================

const SessionSharing = {

  // --- Enviar sesión a uno o varios amigos ---
  async shareSession(senderId, receiverIds, sessionData, targetDay, message = '') {
    if (!senderId || !receiverIds || receiverIds.length === 0 || !sessionData) {
      Utils.showToast('Faltan datos para compartir', 'error');
      return false;
    }
    try {
      const receiverStatus = {};
      receiverIds.forEach(uid => { receiverStatus[uid] = 'pending'; });

      const shareRef = firebaseServices.db.collection('sharedSessions').doc();
      await shareRef.set({
        id: shareRef.id,
        senderId,
        receiverIds,
        receiverStatus,
        sessionData,
        targetDay,
        message: message.trim() || '',
        createdAt: firebaseServices.Timestamp.now(),
        updatedAt: firebaseServices.Timestamp.now()
      });

      Utils.showToast(`✅ Sesión enviada a ${receiverIds.length} amigo(s)`, 'success');
      return true;
    } catch (error) {
      console.error('Error compartiendo sesión:', error);
      Utils.showToast('Error al compartir', 'error');
      return false;
    }
  },

  // --- Obtener sesiones compartidas PENDIENTES para un usuario ---
  async getPendingShares(userId) {
    if (!userId) return [];
    try {
      const snapshot = await firebaseServices.db
        .collection('sharedSessions')
        .where('receiverIds', 'array-contains', userId)
        .where(`receiverStatus.${userId}`, '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error obteniendo sesiones compartidas:', error);
      return [];
    }
  },

  // --- Contar sesiones compartidas PENDIENTES (para badge) ---
  async countPendingShares(userId) {
    if (!userId) return 0;
    try {
      const snapshot = await firebaseServices.db
        .collection('sharedSessions')
        .where('receiverIds', 'array-contains', userId)
        .where(`receiverStatus.${userId}`, '==', 'pending')
        .get();
      return snapshot.size;
    } catch (error) {
      console.error('Error contando sesiones compartidas pendientes:', error);
      return 0;
    }
  },

  // --- ACEPTAR en el día original del remitente ---
  async acceptShare(shareId, userId) {
    if (!shareId || !userId) return false;

    const shareRef = firebaseServices.db.collection('sharedSessions').doc(shareId);
    const shareDoc = await shareRef.get();
    if (!shareDoc.exists) {
      Utils.showToast('Esta sesión compartida ya no existe', 'error');
      return false;
    }
    const shareData = shareDoc.data();
    if (shareData.receiverStatus[userId] !== 'pending') {
      Utils.showToast('Ya has respondido a esta sesión', 'info');
      return false;
    }

    if (!AppState.planActualId) {
      Utils.showToast('No tienes un plan activo. Crea o carga un plan primero.', 'error');
      return false;
    }

    const planRef = firebaseServices.db
      .collection('users')
      .doc(userId)
      .collection('planes')
      .doc(AppState.planActualId);
    const planDoc = await planRef.get();
    if (!planDoc.exists) {
      Utils.showToast('No se encontró tu plan', 'error');
      return false;
    }
    const planData = planDoc.data();
    const sesiones = planData.sesiones || [];

    const targetDay = shareData.targetDay;
    let encontrada = false;
    const nuevasSesiones = sesiones.map(sesion => {
      if (sesion.diaSemana === targetDay && sesion.tipo !== 'descanso') {
        encontrada = true;
        return {
          ...sesion,
          tipo: shareData.sessionData.tipo,
          duracion: shareData.sessionData.duracion,
          detalle: shareData.sessionData.detalle,
          color: shareData.sessionData.color || PlanGenerator.getColor(shareData.sessionData.tipo),
          letra: shareData.sessionData.letra || PlanGenerator.getLetra(shareData.sessionData.tipo),
          tieneFuerza: false
        };
      }
      return sesion;
    });

    if (!encontrada) {
      const primeraSemana = sesiones.find(s => s.semana === 1 && s.diaSemana === targetDay);
      if (primeraSemana) {
        const newSession = {
          ...primeraSemana,
          tipo: shareData.sessionData.tipo,
          duracion: shareData.sessionData.duracion,
          detalle: shareData.sessionData.detalle,
          color: shareData.sessionData.color || PlanGenerator.getColor(shareData.sessionData.tipo),
          letra: shareData.sessionData.letra || PlanGenerator.getLetra(shareData.sessionData.tipo),
          tieneFuerza: false
        };
        nuevasSesiones.push(newSession);
        nuevasSesiones.sort((a, b) => a.diaGlobal - b.diaGlobal);
      } else {
        Utils.showToast('No se pudo encontrar la ubicación para esta sesión', 'error');
        return false;
      }
    }

    await planRef.update({
      sesiones: nuevasSesiones,
      [`sesionesRealizadas.${shareId}`]: false
    });

    await shareRef.update({
      [`receiverStatus.${userId}`]: 'accepted',
      updatedAt: firebaseServices.Timestamp.now()
    });

    AppState.sesionesRealizadas = planData.sesionesRealizadas || {};
    if (window.PlanGenerator) {
      const planActualizado = await planRef.get();
      PlanGenerator.mostrarCalendario(planActualizado.data().sesiones);
    }

    return true;
  },

  // --- ACEPTAR en un día elegido por el receptor ---
  async acceptShareWithDay(shareId, userId, targetDay) {
    if (!shareId || !userId || !targetDay || targetDay < 1 || targetDay > 7) {
      Utils.showToast('Día inválido', 'error');
      return false;
    }

    const shareRef = firebaseServices.db.collection('sharedSessions').doc(shareId);
    const shareDoc = await shareRef.get();
    if (!shareDoc.exists) {
      Utils.showToast('Esta sesión compartida ya no existe', 'error');
      return false;
    }
    const shareData = shareDoc.data();
    if (shareData.receiverStatus[userId] !== 'pending') {
      Utils.showToast('Ya has respondido a esta sesión', 'info');
      return false;
    }

    if (!AppState.planActualId) {
      Utils.showToast('No tienes un plan activo. Crea o carga un plan primero.', 'error');
      return false;
    }

    const planRef = firebaseServices.db
      .collection('users')
      .doc(userId)
      .collection('planes')
      .doc(AppState.planActualId);
    const planDoc = await planRef.get();
    if (!planDoc.exists) {
      Utils.showToast('No se encontró tu plan', 'error');
      return false;
    }
    const planData = planDoc.data();
    const sesiones = planData.sesiones || [];

    let existe = false;
    let diaGlobalReferencia = null;
    for (const sesion of sesiones) {
      if (sesion.diaSemana === targetDay && sesion.semana === 1) {
        existe = true;
        diaGlobalReferencia = sesion.diaGlobal;
        break;
      }
    }

    const newSession = {
      diaGlobal: diaGlobalReferencia || (targetDay + (0 * 7)),
      semana: 1,
      diaSemana: targetDay,
      fase: 'BASE',
      nivel: 'intermedio',
      tipo: shareData.sessionData.tipo,
      duracion: shareData.sessionData.duracion,
      detalle: shareData.sessionData.detalle,
      color: shareData.sessionData.color || PlanGenerator.getColor(shareData.sessionData.tipo),
      letra: shareData.sessionData.letra || PlanGenerator.getLetra(shareData.sessionData.tipo),
      tieneFuerza: false
    };

    let nuevasSesiones;
    if (existe) {
      nuevasSesiones = sesiones.map(s => {
        if (s.diaSemana === targetDay && s.semana === 1) {
          return { ...newSession, diaGlobal: s.diaGlobal, semana: s.semana };
        }
        return s;
      });
    } else {
      nuevasSesiones = [...sesiones, newSession];
      nuevasSesiones.sort((a, b) => a.diaGlobal - b.diaGlobal);
    }

    await planRef.update({
      sesiones: nuevasSesiones,
      [`sesionesRealizadas.${shareId}`]: false
    });

    await shareRef.update({
      [`receiverStatus.${userId}`]: 'accepted',
      updatedAt: firebaseServices.Timestamp.now()
    });

    AppState.sesionesRealizadas = planData.sesionesRealizadas || {};
    if (window.PlanGenerator) {
      const planActualizado = await planRef.get();
      PlanGenerator.mostrarCalendario(planActualizado.data().sesiones);
    }

    return true;
  },

  // --- RECHAZAR sesión compartida ---
  async rejectShare(shareId, userId) {
    if (!shareId || !userId) return false;
    try {
      await firebaseServices.db.collection('sharedSessions').doc(shareId).update({
        [`receiverStatus.${userId}`]: 'rejected',
        updatedAt: firebaseServices.Timestamp.now()
      });
      return true;
    } catch (error) {
      console.error('Error rechazando sesión:', error);
      return false;
    }
  }
};

window.SessionSharing = SessionSharing;
console.log('✅ sessionSharing.js cargado');