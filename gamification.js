// ==================== gamification.js - Sistema de niveles basado en KILÓMETROS ====================
// Versión: 2.0 - El nivel depende exclusivamente de los kilómetros acumulados
// ====================

const Gamification = {
  // Definición de insignias (se pueden ampliar)
  BADGES: {
    FIRST_SESSION: { id: 'FIRST_SESSION', name: 'Primer entrenamiento', description: 'Completaste tu primera sesión', xp: 50, icon: '🏁' },
    FIRST_WEEK: { id: 'FIRST_WEEK', name: 'Primera semana', description: 'Completaste tu primera semana de entrenamiento', xp: 100, icon: '📅' },
    FIRST_MONTH: { id: 'FIRST_MONTH', name: 'Primer mes', description: 'Completaste tu primer mes', xp: 300, icon: '🏅' },
    STREAK_7: { id: 'STREAK_7', name: 'Racha de 7 días', description: 'Entrenaste 7 días seguidos', xp: 150, icon: '🔥' },
    STREAK_30: { id: 'STREAK_30', name: 'Racha de 30 días', description: '30 días seguidos', xp: 500, icon: '💪' },
    DISTANCE_100: { id: 'DISTANCE_100', name: '100 km', description: 'Acumulaste 100 km', xp: 200, icon: '📏' },
    DISTANCE_500: { id: 'DISTANCE_500', name: '500 km', description: 'Acumulaste 500 km', xp: 800, icon: '🌟' },
    DISTANCE_1000: { id: 'DISTANCE_1000', name: '1000 km', description: 'Acumulaste 1000 km', xp: 1500, icon: '🏆' },
    SESSIONS_10: { id: 'SESSIONS_10', name: '10 entrenamientos', description: 'Completaste 10 sesiones', xp: 150, icon: '🎯' },
    SESSIONS_50: { id: 'SESSIONS_50', name: '50 entrenamientos', description: 'Completaste 50 sesiones', xp: 600, icon: '🏆' },
    // Insignias de nivel (basadas en km) - opcionales
    LEVEL_5_KM: { id: 'LEVEL_5_KM', name: '500 km', description: 'Alcanzaste 500 km', xp: 0, icon: '⭐' },
    LEVEL_10_KM: { id: 'LEVEL_10_KM', name: '1000 km', description: 'Alcanzaste 1000 km', xp: 0, icon: '👑' }
  },

  // Niveles basados en kilómetros acumulados (NO en XP)
  LEVELS_KM: [
    { level: 1, kmNeeded: 0 },
    { level: 2, kmNeeded: 50 },
    { level: 3, kmNeeded: 120 },
    { level: 4, kmNeeded: 250 },
    { level: 5, kmNeeded: 500 },
    { level: 6, kmNeeded: 700 },
    { level: 7, kmNeeded: 850 },
    { level: 8, kmNeeded: 950 },
    { level: 9, kmNeeded: 990 },
    { level: 10, kmNeeded: 1050 }
  ],

  // Calcular XP por sesión (se mantiene para insignias y métrica secundaria, pero no afecta al nivel)
  calculateXP(sesion, metricas) {
    let xp = 0;
    if (sesion.duracion) xp += sesion.duracion;
    if (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal)) {
      xp += metricas.distanciaTotal * 10;
    }
    if (sesion.tipo === 'series') xp += 25;
    else if (sesion.tipo === 'tempo') xp += 20;
    else if (sesion.tipo === 'largo') xp += 30;
    else if (sesion.tipo === 'strength') xp += 15;
    else if (sesion.tipo === 'rodaje') xp += 10;
    return Math.floor(xp);
  },

  // Obtener datos de gamificación del usuario (desde Firestore)
  async getData(uid) {
    if (!uid) return this.getDefaultData();
    try {
      const doc = await firebaseServices.db.collection('gamification').doc(uid).get();
      if (doc.exists) return doc.data();
      const defaultData = this.getDefaultData();
      await firebaseServices.db.collection('gamification').doc(uid).set(defaultData);
      return defaultData;
    } catch (error) {
      console.error('Error obteniendo datos de gamificación:', error);
      return this.getDefaultData();
    }
  },

  getDefaultData() {
    return {
      totalXP: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      badges: [],
      totalDistance: 0,
      totalSessions: 0,
      lastSessionDate: null,
      lastUpdate: firebaseServices.Timestamp.now()
    };
  },

  // Calcular nivel según kilómetros acumulados
  getLevelByDistance(distance) {
    let level = 1;
    for (let i = this.LEVELS_KM.length - 1; i >= 0; i--) {
      if (distance >= this.LEVELS_KM[i].kmNeeded) {
        level = this.LEVELS_KM[i].level;
        break;
      }
    }
    return level;
  },

  // Progreso hacia el siguiente nivel (basado en km)
  getProgressToNextLevel(distance) {
    const currentLevel = this.getLevelByDistance(distance);
    const nextLevel = this.LEVELS_KM.find(l => l.level === currentLevel + 1);
    if (!nextLevel) return 100;
    const currentLevelMinKM = this.LEVELS_KM.find(l => l.level === currentLevel).kmNeeded;
    const kmInLevel = distance - currentLevelMinKM;
    const kmNeeded = nextLevel.kmNeeded - currentLevelMinKM;
    return Math.min(100, Math.floor((kmInLevel / kmNeeded) * 100));
  },

  // Actualizar después de completar una sesión (añade km, XP, racha, etc.)
  async updateAfterSession(uid, sesion, metricas) {
    if (!uid) return null;
    try {
      const oldData = await this.getData(uid);
      const xpGained = this.calculateXP(sesion, metricas);
      const distance = (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal)) ? metricas.distanciaTotal : 0;
      const today = new Date().toISOString().split('T')[0];
      
      // Calcular nueva racha
      let newStreak = oldData.currentStreak || 0;
      if (oldData.lastSessionDate === today) {
        // Ya entrenó hoy, no suma racha
      } else if (oldData.lastSessionDate === this.yesterday()) {
        newStreak++;
      } else {
        newStreak = 1;
      }
      
      const newTotalXP = (oldData.totalXP || 0) + xpGained;
      const newTotalDistance = (oldData.totalDistance || 0) + distance;
      const newLevel = this.getLevelByDistance(newTotalDistance);
      const newLongestStreak = Math.max(oldData.longestStreak || 0, newStreak);
      const newTotalSessions = (oldData.totalSessions || 0) + 1;
      
      // Comprobar insignias desbloqueadas
      const currentBadges = oldData.badges || [];
      const newBadges = [...currentBadges];
      
      // Insignias por racha
      if (newStreak >= 7 && !currentBadges.includes('STREAK_7')) newBadges.push('STREAK_7');
      if (newStreak >= 30 && !currentBadges.includes('STREAK_30')) newBadges.push('STREAK_30');
      // Por distancia
      if (newTotalDistance >= 100 && !currentBadges.includes('DISTANCE_100')) newBadges.push('DISTANCE_100');
      if (newTotalDistance >= 500 && !currentBadges.includes('DISTANCE_500')) newBadges.push('DISTANCE_500');
      if (newTotalDistance >= 1000 && !currentBadges.includes('DISTANCE_1000')) newBadges.push('DISTANCE_1000');
      // Por número de sesiones
      if (newTotalSessions >= 10 && !currentBadges.includes('SESSIONS_10')) newBadges.push('SESSIONS_10');
      if (newTotalSessions >= 50 && !currentBadges.includes('SESSIONS_50')) newBadges.push('SESSIONS_50');
      // Por primera sesión
      if (newTotalSessions === 1 && !currentBadges.includes('FIRST_SESSION')) newBadges.push('FIRST_SESSION');
      // Por nivel de kilómetros
      if (newTotalDistance >= 500 && !currentBadges.includes('LEVEL_5_KM')) newBadges.push('LEVEL_5_KM');
      if (newTotalDistance >= 1000 && !currentBadges.includes('LEVEL_10_KM')) newBadges.push('LEVEL_10_KM');
      
      const newData = {
        totalXP: newTotalXP,
        level: newLevel,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        badges: newBadges,
        totalDistance: newTotalDistance,
        totalSessions: newTotalSessions,
        lastSessionDate: today,
        lastUpdate: firebaseServices.Timestamp.now()
      };
      
      await firebaseServices.db.collection('gamification').doc(uid).set(newData, { merge: true });
      
      // Mostrar notificaciones de subida de nivel y nuevas insignias
      if (newLevel > oldData.level) {
        Utils.showToast(`🎉 ¡SUBES AL NIVEL ${newLevel}! (${newTotalDistance.toFixed(1)} km)`, 'success', 4000);
        Utils.launchConfetti();
      }
      const gainedBadges = newBadges.filter(b => !currentBadges.includes(b));
      gainedBadges.forEach(badgeId => {
        const badgeInfo = this.BADGES[badgeId];
        if (badgeInfo) {
          Utils.showToast(`🏅 ¡Insignia desbloqueada: ${badgeInfo.name}!`, 'success', 4000);
        }
      });
      
      return newData;
    } catch (error) {
      console.error('Error actualizando gamificación:', error);
      return null;
    }
  },
  
  // Revertir una sesión (al desmarcar)
  async removeSession(uid, sesion, metricas, diaIndex) {
    if (!uid) return null;
    try {
      const oldData = await this.getData(uid);
      const xpRemoved = this.calculateXP(sesion, metricas);
      const distanceRemoved = (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal)) ? metricas.distanciaTotal : 0;
      
      const newTotalXP = Math.max(0, (oldData.totalXP || 0) - xpRemoved);
      const newTotalDistance = Math.max(0, (oldData.totalDistance || 0) - distanceRemoved);
      const newLevel = this.getLevelByDistance(newTotalDistance);
      const newTotalSessions = Math.max(0, (oldData.totalSessions || 0) - 1);
      
      // Ajuste simple de racha: si la sesión que quitamos corresponde a la última fecha, decrementamos racha
      let newStreak = oldData.currentStreak;
      let newLongestStreak = oldData.longestStreak;
      const today = new Date().toISOString().split('T')[0];
      if (oldData.lastSessionDate === today) {
        newStreak = Math.max(0, newStreak - 1);
        // No ajustamos la racha máxima porque podría haberse conseguido antes
      }
      
      const newData = {
        totalXP: newTotalXP,
        level: newLevel,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        totalDistance: newTotalDistance,
        totalSessions: newTotalSessions,
        lastUpdate: firebaseServices.Timestamp.now()
        // Nota: lastSessionDate no se modifica porque podría haber otras sesiones ese día
      };
      
      await firebaseServices.db.collection('gamification').doc(uid).set(newData, { merge: true });
      
      if (newLevel < oldData.level) {
        Utils.showToast(`📉 Bajas al nivel ${newLevel} (${newTotalDistance.toFixed(1)} km)`, 'info', 3000);
      }
      
      return newData;
    } catch (error) {
      console.error('Error revirtiendo gamificación:', error);
      return null;
    }
  },
  
  yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  },
  
  // Método obsoleto pero mantenido por compatibilidad (usa km en lugar de XP)
  getLevelByXP(xp) {
    // Redirigimos a getLevelByDistance (pero no tiene sentido, mejor no usarlo)
    console.warn('getLevelByXP está obsoleto, usar getLevelByDistance');
    return 1;
  },
  
  getProgressToNextLevelXP(xp) {
    console.warn('getProgressToNextLevelXP obsoleto');
    return 0;
  }
};

window.Gamification = Gamification;