// ==================== gamification.js - VERSIÓN CON HISTORIAL DE ZAPATILLAS Y CORRECCIÓN DE DESMARCADO ====================
// Versión: 5.3 - removeSession acepta distancia exacta para consistencia
// ====================

const Gamification = {
  BADGES: {
    FIRST_SESSION: { id: 'FIRST_SESSION', name: 'Primer entrenamiento', description: 'Completaste tu primera sesión', xp: 50, icon: '🏁' },
    FIRST_WEEK: { id: 'FIRST_WEEK', name: 'Primera semana', description: 'Completaste tu primera semana de entrenamiento', xp: 100, icon: '📅' },
    FIRST_MONTH: { id: 'FIRST_MONTH', name: 'Primer mes', description: 'Completaste tu primer mes', xp: 300, icon: '🏅' },
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
    const colors = {
      1: '#6c757d',
      2: '#adb5bd',
      3: '#cd7f32',
      4: '#b87333',
      5: '#c0c0c0',
      6: '#e5e4e2',
      7: '#ffd700',
      8: '#ffc107',
      9: '#e0b0ff',
    };
    if (level >= 10) return '#b9f2ff';
    return colors[level] || '#6c757d';
  },

  async clearCache(uid) {
    if (!uid) return;
    try {
      sessionStorage.removeItem(`gamification_${uid}`);
      localStorage.removeItem(`gamification_${uid}`);
      console.log('🗑️ Caché de gamificación limpiada para', uid);
    } catch (e) {
      console.warn('Error limpiando caché:', e);
    }
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
      badges: [],
      totalDistance: 0,
      totalSessions: 0,
      lastSessionDate: null,
      lastUpdate: firebaseServices.Timestamp.now(),
      currentShoe: { name: 'Zapatilla actual', km: 0 },
      shoeHistory: []
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

  async getCurrentShoe(uid) {
    const data = await this.getData(uid);
    return data.currentShoe || { name: 'Zapatilla actual', km: 0 };
  },

  async getShoeHistory(uid) {
    const data = await this.getData(uid);
    return data.shoeHistory || [];
  },

  async setCurrentShoe(uid, newShoeName) {
    if (!uid || !newShoeName) return false;
    try {
      const data = await this.getData(uid);
      const oldShoe = data.currentShoe || { name: 'Zapatilla actual', km: 0 };
      if (oldShoe.name !== 'Zapatilla actual' || oldShoe.km > 0) {
        const historyEntry = {
          name: oldShoe.name,
          km: oldShoe.km,
          changedAt: new Date().toISOString()
        };
        const newHistory = [...(data.shoeHistory || []), historyEntry];
        if (newHistory.length > 15) newHistory.shift();
        await firebaseServices.db.collection('gamification').doc(uid).update({
          currentShoe: { name: newShoeName, km: 0 },
          shoeHistory: newHistory
        });
      } else {
        await firebaseServices.db.collection('gamification').doc(uid).update({
          currentShoe: { name: newShoeName, km: 0 }
        });
      }
      return true;
    } catch (error) {
      console.error('Error al cambiar zapatilla:', error);
      return false;
    }
  },

  async addKilometersToShoe(uid, km) {
    if (!uid || !km || km <= 0) return;
    try {
      const docRef = firebaseServices.db.collection('gamification').doc(uid);
      await docRef.update({
        'currentShoe.km': firebaseServices.FieldValue.increment(km)
      });
    } catch (error) {
      console.error('Error sumando km a la zapatilla:', error);
    }
  },

  async removeKilometersFromShoe(uid, km) {
    if (!uid || !km || km <= 0) return;
    try {
      const docRef = firebaseServices.db.collection('gamification').doc(uid);
      await docRef.update({
        'currentShoe.km': firebaseServices.FieldValue.increment(-km)
      });
    } catch (error) {
      console.error('Error restando km a la zapatilla:', error);
    }
  },

  async updateAfterSession(uid, sesion, metricas, distanciaUsada = null) {
    if (!uid) return null;
    try {
      const oldData = await this.getData(uid);
      const xpGained = this.calculateXP(sesion, metricas);
      const distance = (distanciaUsada !== null && isFinite(distanciaUsada)) ? distanciaUsada : (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal) ? metricas.distanciaTotal : 0);
      
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

      await this.addKilometersToShoe(uid, distance);

      const newData = {
        totalXP: newTotalXP,
        level: newLevel,
        badges: newBadges,
        totalDistance: newTotalDistance,
        totalSessions: newTotalSessions,
        lastSessionDate: new Date().toLocaleDateString('en-CA'),
        lastUpdate: firebaseServices.Timestamp.now()
      };

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

      return newData;
    } catch (error) {
      console.error('Error actualizando gamificación:', error);
      return null;
    }
  },

  async removeSession(uid, sesion, metricas, diaIndex, distanciaExacta = null) {
    if (!uid) return null;
    try {
      const oldData = await this.getData(uid);
      const xpRemoved = this.calculateXP(sesion, metricas);
      const distanceRemoved = (distanciaExacta !== null && isFinite(distanciaExacta)) ? distanciaExacta : (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal) ? metricas.distanciaTotal : 0);

      const newTotalXP = Math.max(0, (oldData.totalXP || 0) - xpRemoved);
      const newTotalDistance = Math.max(0, (oldData.totalDistance || 0) - distanceRemoved);
      const newLevel = this.getLevelByDistance(newTotalDistance);
      const newTotalSessions = Math.max(0, (oldData.totalSessions || 0) - 1);

      await this.removeKilometersFromShoe(uid, distanceRemoved);

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

      return newData;
    } catch (error) {
      console.error('Error revirtiendo gamificación:', error);
      return null;
    }
  }
};

window.Gamification = Gamification;