// ==================== gamification.js - Sistema de niveles, XP, rachas e insignias ====================
// Versión: 1.0
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
    SESSIONS_10: { id: 'SESSIONS_10', name: '10 entrenamientos', description: 'Completaste 10 sesiones', xp: 150, icon: '🎯' },
    SESSIONS_50: { id: 'SESSIONS_50', name: '50 entrenamientos', description: 'Completaste 50 sesiones', xp: 600, icon: '🏆' },
    LEVEL_5: { id: 'LEVEL_5', name: 'Nivel 5', description: 'Alcanzaste el nivel 5', xp: 0, icon: '⭐' },
    LEVEL_10: { id: 'LEVEL_10', name: 'Nivel 10', description: 'Alcanzaste el nivel 10', xp: 0, icon: '👑' }
  },

  // Niveles (cada nivel requiere XP acumulada)
  LEVELS: [
    { level: 1, xpNeeded: 0 },
    { level: 2, xpNeeded: 100 },
    { level: 3, xpNeeded: 250 },
    { level: 4, xpNeeded: 500 },
    { level: 5, xpNeeded: 1000 },
    { level: 6, xpNeeded: 2000 },
    { level: 7, xpNeeded: 3500 },
    { level: 8, xpNeeded: 5500 },
    { level: 9, xpNeeded: 8000 },
    { level: 10, xpNeeded: 11000 }
  ],

  // Calcular XP por sesión
  calculateXP(sesion, metricas) {
    let xp = 0;
    // 1 XP por minuto de duración
    if (sesion.duracion) xp += sesion.duracion;
    // 10 XP por kilómetro (si se ha podido estimar distancia)
    if (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal)) {
      xp += metricas.distanciaTotal * 10;
    }
    // Bonificaciones por tipo de sesión
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
      // Si no existe, crear documento por defecto (en caliente)
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

  // Actualizar después de completar una sesión
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
      const newLevel = this.getLevelByXP(newTotalXP);
      const newLongestStreak = Math.max(oldData.longestStreak || 0, newStreak);
      const newTotalSessions = (oldData.totalSessions || 0) + 1;
      const newTotalDistance = (oldData.totalDistance || 0) + distance;
      
      // Comprobar insignias desbloqueadas
      const currentBadges = oldData.badges || [];
      const newBadges = [...currentBadges];
      
      // Insignias por racha
      if (newStreak >= 7 && !currentBadges.includes('STREAK_7')) newBadges.push('STREAK_7');
      if (newStreak >= 30 && !currentBadges.includes('STREAK_30')) newBadges.push('STREAK_30');
      // Por distancia
      if (newTotalDistance >= 100 && !currentBadges.includes('DISTANCE_100')) newBadges.push('DISTANCE_100');
      if (newTotalDistance >= 500 && !currentBadges.includes('DISTANCE_500')) newBadges.push('DISTANCE_500');
      // Por número de sesiones
      if (newTotalSessions >= 10 && !currentBadges.includes('SESSIONS_10')) newBadges.push('SESSIONS_10');
      if (newTotalSessions >= 50 && !currentBadges.includes('SESSIONS_50')) newBadges.push('SESSIONS_50');
      // Por primera sesión
      if (newTotalSessions === 1 && !currentBadges.includes('FIRST_SESSION')) newBadges.push('FIRST_SESSION');
      // Por nivel alcanzado
      if (newLevel >= 5 && !currentBadges.includes('LEVEL_5')) newBadges.push('LEVEL_5');
      if (newLevel >= 10 && !currentBadges.includes('LEVEL_10')) newBadges.push('LEVEL_10');
      
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
        Utils.showToast(`🎉 ¡SUBES AL NIVEL ${newLevel}!`, 'success', 4000);
        Utils.launchConfetti();
      }
      const gainedBadges = newBadges.filter(b => !currentBadges.includes(b));
      gainedBadges.forEach(badgeId => {
        const badgeInfo = this.BADGES[badgeId];
        if (badgeInfo) {
          Utils.showToast(`🏅 ¡Insignia desbloqueada: ${badgeInfo.name}!`, 'success', 4000);
          if (badgeInfo.xp > 0) {
            // Si la insignia da XP, se añade al total (ya incluido en el cálculo anterior, pero por si acaso)
            // No sumamos XP adicional aquí porque las insignias ya están contempladas en los hitos.
          }
        }
      });
      
      return newData;
    } catch (error) {
      console.error('Error actualizando gamificación:', error);
      return null;
    }
  },
  
  yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  },
  
  getLevelByXP(xp) {
    let level = 1;
    for (let i = this.LEVELS.length - 1; i >= 0; i--) {
      if (xp >= this.LEVELS[i].xpNeeded) {
        level = this.LEVELS[i].level;
        break;
      }
    }
    return level;
  },
  
  // Obtener el progreso hacia el siguiente nivel (porcentaje)
  getProgressToNextLevel(xp) {
    const currentLevel = this.getLevelByXP(xp);
    const nextLevel = this.LEVELS.find(l => l.level === currentLevel + 1);
    if (!nextLevel) return 100; // Nivel máximo
    const currentLevelMinXP = this.LEVELS.find(l => l.level === currentLevel).xpNeeded;
    const xpInLevel = xp - currentLevelMinXP;
    const xpNeeded = nextLevel.xpNeeded - currentLevelMinXP;
    return Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100));
  }
};

window.Gamification = Gamification;