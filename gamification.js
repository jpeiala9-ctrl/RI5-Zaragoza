// ==================== gamification.js - VERSIÓN DEFINITIVA (RACHA SIMPLE Y FIABLE) ====================
// La racha se calcula exclusivamente desde globalFeed: días consecutivos con al menos una sesión.
// Se recalcula automáticamente al iniciar, al marcar y al desmarcar.
// ====================

const Gamification = {
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
    LEVEL_5_KM: { id: 'LEVEL_5_KM', name: '500 km', description: 'Alcanzaste 500 km', xp: 0, icon: '⭐' },
    LEVEL_10_KM: { id: 'LEVEL_10_KM', name: '1000 km', description: 'Alcanzaste 1000 km', xp: 0, icon: '💎' }
  },

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

  getColorByLevel(level) {
    if (level <= 2) return '#6c757d';
    if (level <= 4) return '#cd7f32';
    if (level <= 6) return '#c0c0c0';
    if (level <= 8) return '#ffd700';
    if (level === 9) return '#e0b0ff';
    return '#b9f2ff';
  },

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

  getProgressToNextLevel(distance) {
    const currentLevel = this.getLevelByDistance(distance);
    const nextLevel = this.LEVELS_KM.find(l => l.level === currentLevel + 1);
    if (!nextLevel) return 100;
    const currentLevelMinKM = this.LEVELS_KM.find(l => l.level === currentLevel).kmNeeded;
    const kmInLevel = distance - currentLevelMinKM;
    const kmNeeded = nextLevel.kmNeeded - currentLevelMinKM;
    return Math.min(100, Math.floor((kmInLevel / kmNeeded) * 100));
  },

  // ========== OBTENER FECHA LOCAL EN YYYY-MM-DD ==========
  _toLocalDateString(date) {
    const d = date.toDate ? date.toDate() : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // ========== RESTAR UN DÍA A UNA FECHA YYYY-MM-DD (SIN ERRORES DE ZONA) ==========
  _subtractOneDay(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },

  // ========== CÁLCULO DE RACHA: DÍAS CONSECUTIVOS CON SESIÓN (DESDE HOY HACIA ATRÁS) ==========
  async _calculateStreak(uid) {
    if (!uid) return 0;
    try {
      const snapshot = await firebaseServices.db
        .collection('globalFeed')
        .where('userId', '==', uid)
        .select('timestamp')
        .get();

      const fechasSet = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
          const localDate = this._toLocalDateString(data.timestamp);
          fechasSet.add(localDate);
        }
      });

      if (fechasSet.size === 0) return 0;

      const hoyStr = this._toLocalDateString(new Date());
      // Comprobar si hoy tiene sesión; si no, empezar desde ayer
      let current = fechasSet.has(hoyStr) ? hoyStr : this._subtractOneDay(hoyStr);
      let streak = 0;
      while (fechasSet.has(current)) {
        streak++;
        current = this._subtractOneDay(current);
      }
      return streak;
    } catch (error) {
      console.error('Error calculando racha:', error);
      return 0;
    }
  },

  // ========== ACTUALIZAR LOS CAMPOS DE RACHA EN FIRESTORE (SOBRESCRIBE) ==========
  async _updateStreakFields(uid) {
    const newStreak = await this._calculateStreak(uid);
    const userData = await this.getData(uid);
    const newLongest = Math.max(userData.longestStreak || 0, newStreak);
    await firebaseServices.db.collection('gamification').doc(uid).update({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastUpdate: firebaseServices.Timestamp.now()
    });
    return { newStreak, newLongest };
  },

  // ========== ACTUALIZAR TRAS MARCAR SESIÓN ==========
  async updateAfterSession(uid, sesion, metricas) {
    if (!uid) return null;
    try {
      const oldData = await this.getData(uid);
      const xpGained = this.calculateXP(sesion, metricas);
      const distance = (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal)) ? metricas.distanciaTotal : 0;

      const newTotalXP = (oldData.totalXP || 0) + xpGained;
      const newTotalDistance = (oldData.totalDistance || 0) + distance;
      const newLevel = this.getLevelByDistance(newTotalDistance);
      const newTotalSessions = (oldData.totalSessions || 0) + 1;

      const currentBadges = oldData.badges || [];
      const newBadges = [...currentBadges];

      if (newTotalSessions >= 1 && !currentBadges.includes('FIRST_SESSION')) newBadges.push('FIRST_SESSION');
      if (newTotalSessions >= 10 && !currentBadges.includes('SESSIONS_10')) newBadges.push('SESSIONS_10');
      if (newTotalSessions >= 50 && !currentBadges.includes('SESSIONS_50')) newBadges.push('SESSIONS_50');
      if (newTotalDistance >= 100 && !currentBadges.includes('DISTANCE_100')) newBadges.push('DISTANCE_100');
      if (newTotalDistance >= 500 && !currentBadges.includes('DISTANCE_500')) newBadges.push('DISTANCE_500');
      if (newTotalDistance >= 1000 && !currentBadges.includes('DISTANCE_1000')) newBadges.push('DISTANCE_1000');
      if (newTotalDistance >= 500 && !currentBadges.includes('LEVEL_5_KM')) newBadges.push('LEVEL_5_KM');
      if (newTotalDistance >= 1000 && !currentBadges.includes('LEVEL_10_KM')) newBadges.push('LEVEL_10_KM');

      // Recalcular racha (siempre actual)
      const { newStreak, newLongest } = await this._updateStreakFields(uid);
      if (newStreak >= 7 && !currentBadges.includes('STREAK_7')) newBadges.push('STREAK_7');
      if (newStreak >= 30 && !currentBadges.includes('STREAK_30')) newBadges.push('STREAK_30');

      const newData = {
        totalXP: newTotalXP,
        level: newLevel,
        badges: newBadges,
        totalDistance: newTotalDistance,
        totalSessions: newTotalSessions,
        lastSessionDate: this._toLocalDateString(new Date()),
        lastUpdate: firebaseServices.Timestamp.now()
      };
      // No sobrescribimos currentStreak/longestStreak porque ya se actualizaron en _updateStreakFields
      await firebaseServices.db.collection('gamification').doc(uid).set(newData, { merge: true });

      if (newLevel > oldData.level) {
        Utils.showToast(`🎉 ¡SUBES AL NIVEL ${newLevel}! (${newTotalDistance.toFixed(1)} km)`, 'success', 4000);
        Utils.launchConfetti();
      }
      const gainedBadges = newBadges.filter(b => !currentBadges.includes(b));
      gainedBadges.forEach(badgeId => {
        const badgeInfo = this.BADGES[badgeId];
        if (badgeInfo) Utils.showToast(`🏅 ¡Insignia desbloqueada: ${badgeInfo.name}!`, 'success', 4000);
      });

      // Recargar perfil siempre (para que se vea la racha actualizada)
      setTimeout(() => {
        if (window.Profile) Profile.cargarPerfil();
      }, 500);

      return newData;
    } catch (error) {
      console.error('Error actualizando gamificación:', error);
      return null;
    }
  },

  // ========== ACTUALIZAR TRAS DESMARCAR SESIÓN ==========
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

      // Recalcular racha (siempre actual)
      const { newStreak, newLongest } = await this._updateStreakFields(uid);
      // Las insignias de racha no se eliminan, pero si la racha ya no alcanza el mínimo, podríamos quitarlas, pero no es necesario

      const newData = {
        totalXP: newTotalXP,
        level: newLevel,
        totalDistance: newTotalDistance,
        totalSessions: newTotalSessions,
        lastUpdate: firebaseServices.Timestamp.now()
      };
      await firebaseServices.db.collection('gamification').doc(uid).set(newData, { merge: true });

      if (newLevel < oldData.level) {
        Utils.showToast(`📉 Bajas al nivel ${newLevel} (${newTotalDistance.toFixed(1)} km)`, 'info', 3000);
      }

      // Recargar perfil siempre
      setTimeout(() => {
        if (window.Profile) Profile.cargarPerfil();
      }, 500);

      return newData;
    } catch (error) {
      console.error('Error revirtiendo gamificación:', error);
      return null;
    }
  },

  // ========== FUERZA UN RECÁLCULO COMPLETO DE LA RACHA (para usar al iniciar) ==========
  async forceRecalc(uid) {
    if (!uid) uid = AppState.currentUserId;
    if (!uid) return;
    const { newStreak, newLongest } = await this._updateStreakFields(uid);
    console.log(`Racha forzada: actual ${newStreak}, máxima ${newLongest}`);
    // Recargar perfil si visible
    setTimeout(() => {
      if (window.Profile) Profile.cargarPerfil();
    }, 500);
    return newStreak;
  }
};

// ========== INICIALIZACIÓN: recalcular racha al cargar la app ==========
setTimeout(() => {
  if (AppState && AppState.currentUserId) {
    Gamification.forceRecalc(AppState.currentUserId);
  }
}, 3000);

window.Gamification = Gamification;