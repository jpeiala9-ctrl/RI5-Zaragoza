// ==================== gamification.js ====================
// Versión: 7.1 - Sistema híbrido de insignias (redondas y alargadas, con emojis/emoticonos) - COMPLETO
// ====================

const Gamification = {
  // ========== INSIGNIAS ==========
  BADGES: {
    // --- Progreso básico (píldoras alargadas con emoji) ---
    FIRST_SESSION: { id: 'FIRST_SESSION', name: 'Primer entrenamiento', description: 'Completaste tu primera sesión', xp: 50, shape: 'pill', emoji: '🏁' },
    FIRST_WEEK: { id: 'FIRST_WEEK', name: 'Primera semana', description: 'Completaste tu primera semana', xp: 100, shape: 'pill', emoji: '📅' },
    FIRST_MONTH: { id: 'FIRST_MONTH', name: 'Primer mes', description: 'Completaste tu primer mes', xp: 300, shape: 'pill', emoji: '🏅' },
    // Distancia
    DISTANCE_100: { id: 'DISTANCE_100', name: '100 km', description: 'Acumulaste 100 km', xp: 200, shape: 'pill', emoji: '📏' },
    DISTANCE_500: { id: 'DISTANCE_500', name: '500 km', description: 'Acumulaste 500 km', xp: 800, shape: 'pill', emoji: '🌟' },
    DISTANCE_1000: { id: 'DISTANCE_1000', name: '1000 km', description: 'Acumulaste 1000 km', xp: 1500, shape: 'pill', emoji: '🏆' },
    DISTANCE_2500: { id: 'DISTANCE_2500', name: '2500 km', description: 'Acumulaste 2500 km', xp: 2000, shape: 'pill', emoji: '💎' },
    DISTANCE_5000: { id: 'DISTANCE_5000', name: '5000 km', description: 'Acumulaste 5000 km', xp: 3000, shape: 'pill', emoji: '👑' },
    // Sesiones (píldoras redondas con emoticono)
    SESSIONS_10: { id: 'SESSIONS_10', name: '10', description: 'Completaste 10 sesiones', xp: 150, shape: 'round', emoticon: '🎯' },
    SESSIONS_50: { id: 'SESSIONS_50', name: '50', description: 'Completaste 50 sesiones', xp: 600, shape: 'round', emoticon: '🏆' },
    SESSIONS_100: { id: 'SESSIONS_100', name: '100', description: 'Completaste 100 sesiones', xp: 1200, shape: 'round', emoticon: '🎖️' },
    SESSIONS_250: { id: 'SESSIONS_250', name: '250', description: 'Completaste 250 sesiones', xp: 2000, shape: 'round', emoticon: '🏅' },
    SESSIONS_500: { id: 'SESSIONS_500', name: '500', description: 'Completaste 500 sesiones', xp: 3500, shape: 'round', emoticon: '👑' },
    // Rachas (alargadas con emoji)
    STREAK_3: { id: 'STREAK_3', name: 'Racha 3 días', description: '3 días seguidos', xp: 30, shape: 'pill', emoji: '🔥' },
    STREAK_7: { id: 'STREAK_7', name: 'Racha 7 días', description: 'Una semana seguida', xp: 70, shape: 'pill', emoji: '⚡' },
    STREAK_14: { id: 'STREAK_14', name: 'Racha 14 días', description: 'Dos semanas sin parar', xp: 150, shape: 'pill', emoji: '🌋' },
    STREAK_30: { id: 'STREAK_30', name: 'Racha 30 días', description: 'Un mes entero', xp: 300, shape: 'pill', emoji: '💪' },
    STREAK_60: { id: 'STREAK_60', name: 'Racha 60 días', description: 'Dos meses de racha', xp: 600, shape: 'pill', emoji: '🏅' },
    STREAK_100: { id: 'STREAK_100', name: 'Racha 100 días', description: '100 días seguidos', xp: 1200, shape: 'pill', emoji: '🏆' },
    // Ritmo (alargadas con emoticono)
    PACE_SUB6: { id: 'PACE_SUB6', name: '<6:00/km', description: 'Ritmo menor a 6:00', xp: 50, shape: 'pill', emoticon: '🐢' },
    PACE_SUB5: { id: 'PACE_SUB5', name: '<5:00/km', description: 'Ritmo menor a 5:00', xp: 100, shape: 'pill', emoticon: '🚶' },
    PACE_SUB4: { id: 'PACE_SUB4', name: '<4:00/km', description: 'Ritmo menor a 4:00', xp: 200, shape: 'pill', emoticon: '🏃' },
    PACE_SUB3_30: { id: 'PACE_SUB3_30', name: '<3:30/km', description: 'Ritmo de élite', xp: 400, shape: 'pill', emoticon: '🐆' },
    // Velocidad (redondas con emoji)
    SPEED_15: { id: 'SPEED_15', name: '15 km/h', description: 'Alcanzaste 15 km/h', xp: 30, shape: 'round', emoji: '💨' },
    SPEED_20: { id: 'SPEED_20', name: '20 km/h', description: 'Alcanzaste 20 km/h', xp: 60, shape: 'round', emoji: '🌬️' },
    SPEED_25: { id: 'SPEED_25', name: '25 km/h', description: 'Alcanzaste 25 km/h', xp: 120, shape: 'round', emoji: '🚀' },
    SPEED_30: { id: 'SPEED_30', name: '30 km/h', description: 'Velocidad de sprint', xp: 250, shape: 'round', emoji: '🦅' },
    // Zonas (redondas con emoticono corazón)
    ZONE_3_60: { id: 'ZONE_3_60', name: '60 min Z3', description: '60 min en zona 3', xp: 100, shape: 'round', emoticon: '❤️' },
    ZONE_3_300: { id: 'ZONE_3_300', name: '300 min Z3', description: '5 h en zona 3', xp: 400, shape: 'round', emoticon: '🧡' },
    ZONE_4_30: { id: 'ZONE_4_30', name: '30 min Z4', description: '30 min en zona 4', xp: 150, shape: 'round', emoticon: '💛' },
    ZONE_4_120: { id: 'ZONE_4_120', name: '120 min Z4', description: '2 h en zona 4', xp: 500, shape: 'round', emoticon: '💚' },
    ZONE_5_10: { id: 'ZONE_5_10', name: '10 min Z5', description: '10 min en zona 5', xp: 200, shape: 'round', emoticon: '💙' },
    ZONE_5_60: { id: 'ZONE_5_60', name: '60 min Z5', description: '1 h en zona 5', xp: 700, shape: 'round', emoticon: '💜' },
    // Desnivel (alargadas con emoji)
    ELEVATION_100: { id: 'ELEVATION_100', name: '100 m', description: '100 m de subida', xp: 50, shape: 'pill', emoji: '⛰️' },
    ELEVATION_500: { id: 'ELEVATION_500', name: '500 m', description: '500 m de subida', xp: 200, shape: 'pill', emoji: '🏔️' },
    ELEVATION_1000: { id: 'ELEVATION_1000', name: '1000 m', description: '1000 m de subida', xp: 500, shape: 'pill', emoji: '🗻' },
    ELEVATION_3000: { id: 'ELEVATION_3000', name: '3000 m', description: '3000 m de subida', xp: 1200, shape: 'pill', emoji: '🏞️' },
    // Tipos de entrenamiento (alargadas con emoticono)
    LONG_RUN_10: { id: 'LONG_RUN_10', name: '10 largas', description: '10 sesiones largas', xp: 200, shape: 'pill', emoticon: '🚶‍♂️' },
    LONG_RUN_50: { id: 'LONG_RUN_50', name: '50 largas', description: '50 sesiones largas', xp: 800, shape: 'pill', emoticon: '🏞️' },
    TEMPO_10: { id: 'TEMPO_10', name: '10 tempo', description: '10 sesiones de ritmo', xp: 150, shape: 'pill', emoticon: '⏱️' },
    TEMPO_50: { id: 'TEMPO_50', name: '50 tempo', description: '50 sesiones de ritmo', xp: 600, shape: 'pill', emoticon: '⌛' },
    INTERVALS_10: { id: 'INTERVALS_10', name: '10 series', description: '10 sesiones de series', xp: 250, shape: 'pill', emoticon: '⚡' },
    INTERVALS_50: { id: 'INTERVALS_50', name: '50 series', description: '50 sesiones de series', xp: 1000, shape: 'pill', emoticon: '🌀' },
    STRENGTH_10: { id: 'STRENGTH_10', name: '10 fuerza', description: '10 sesiones de fuerza', xp: 100, shape: 'pill', emoticon: '💪' },
    STRENGTH_50: { id: 'STRENGTH_50', name: '50 fuerza', description: '50 sesiones de fuerza', xp: 400, shape: 'pill', emoticon: '🏋️' },
    // Días de la semana (redondas con emoticono y letra)
    SUNDAY_RUNNER: { id: 'SUNDAY_RUNNER', name: 'D', description: 'Domingo', xp: 20, shape: 'round', emoticon: '☀️' },
    MONDAY_RUNNER: { id: 'MONDAY_RUNNER', name: 'L', description: 'Lunes', xp: 20, shape: 'round', emoticon: '🌙' },
    TUESDAY_RUNNER: { id: 'TUESDAY_RUNNER', name: 'M', description: 'Martes', xp: 20, shape: 'round', emoticon: '🔥' },
    WEDNESDAY_RUNNER: { id: 'WEDNESDAY_RUNNER', name: 'X', description: 'Miércoles', xp: 20, shape: 'round', emoticon: '🌊' },
    THURSDAY_RUNNER: { id: 'THURSDAY_RUNNER', name: 'J', description: 'Jueves', xp: 20, shape: 'round', emoticon: '🦵' },
    FRIDAY_RUNNER: { id: 'FRIDAY_RUNNER', name: 'V', description: 'Viernes', xp: 20, shape: 'round', emoticon: '💨' },
    SATURDAY_RUNNER: { id: 'SATURDAY_RUNNER', name: 'S', description: 'Sábado', xp: 20, shape: 'round', emoticon: '🏃‍♀️' },
    // Franjas horarias (alargadas con emoji)
    EARLY_BIRD: { id: 'EARLY_BIRD', name: 'Madrugador', description: 'Antes de 6:00', xp: 30, shape: 'pill', emoji: '🌅' },
    NIGHT_OWL: { id: 'NIGHT_OWL', name: 'Búho nocturno', description: 'Después de 22:00', xp: 30, shape: 'pill', emoji: '🦉' },
    // Distancia en una sesión (alargadas con emoji)
    FIRST_5K: { id: 'FIRST_5K', name: '5 km', description: 'Primeros 5 km', xp: 50, shape: 'pill', emoji: '🏃‍♂️' },
    TEN_K: { id: 'TEN_K', name: '10 km', description: '10 km en una sesión', xp: 100, shape: 'pill', emoji: '🏃‍♀️' },
    HALF_MARATHON: { id: 'HALF_MARATHON', name: '21.1 km', description: 'Media maratón', xp: 200, shape: 'pill', emoji: '🏃‍♂️' },
    MARATHON: { id: 'MARATHON', name: '42.2 km', description: 'Maratón', xp: 500, shape: 'pill', emoji: '🏅' },
    // Consistencia mensual (redondas con emoji)
    MONTH_STREAK_3: { id: 'MONTH_STREAK_3', name: '3 meses', description: '3 meses seguidos', xp: 200, shape: 'round', emoji: '📅' },
    MONTH_STREAK_6: { id: 'MONTH_STREAK_6', name: '6 meses', description: '6 meses seguidos', xp: 400, shape: 'round', emoji: '📆' },
    MONTH_STREAK_12: { id: 'MONTH_STREAK_12', name: '12 meses', description: 'Año completo', xp: 800, shape: 'round', emoji: '🗓️' },
    // GPS (redonda con emoji)
    FIRST_GPS: { id: 'FIRST_GPS', name: 'GPS', description: 'GPS activado', xp: 25, shape: 'round', emoji: '📍' }
  },

  // ========== NIVELES POR DISTANCIA ==========
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

  // ========== ESTILOS INYECTADOS ==========
  _injectStyles() {
    if (document.getElementById('gamification-styles')) return;
    const style = document.createElement('style');
    style.id = 'gamification-styles';
    style.textContent = `
      .gamification-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-weight: 500;
        transition: all 0.2s ease;
        cursor: default;
        background: #f0f2f5;
        color: #1a1a1a;
      }
      .gamification-badge-locked {
        opacity: 0.5;
        filter: grayscale(0.2);
      }
      .gamification-badge:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .badge-round {
        width: 42px;
        height: 42px;
        border-radius: 42px;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        flex-direction: column;
        gap: 2px;
      }
      .badge-round .badge-emojicon {
        font-size: 20px;
        line-height: 1;
      }
      .badge-round .badge-text {
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.5px;
      }
      .badge-pill {
        padding: 6px 14px;
        border-radius: 30px;
        font-size: 12px;
        gap: 8px;
        flex-direction: row;
      }
      .badge-pill .badge-emojicon {
        font-size: 16px;
      }
      .badge-pill .badge-text {
        font-size: 12px;
      }
      .badge-category-progress { background: #e3f2fd; color: #0d47a1; }
      .badge-category-distance { background: #e8f5e9; color: #1b5e20; }
      .badge-category-sessions { background: #fff3e0; color: #e65100; }
      .badge-category-streak { background: #fce4ec; color: #880e4f; }
      .badge-category-pace { background: #e0f7fa; color: #006064; }
      .badge-category-speed { background: #f3e5f5; color: #4a148c; }
      .badge-category-zone { background: #ffebee; color: #b71c1c; }
      .badge-category-elevation { background: #eceff1; color: #37474f; }
      .badge-category-training { background: #e8eaf6; color: #1a237e; }
      .badge-category-weekday { background: #fbe9e7; color: #bf360c; }
      .badge-category-special { background: #e0f2f1; color: #004d40; }
    `;
    document.head.appendChild(style);
  },

  // ========== COLOR DE NIVEL ==========
  getColorByLevel(level) {
    const colors = {
      1: '#6c757d', 2: '#adb5bd', 3: '#cd7f32', 4: '#b87333',
      5: '#c0c0c0', 6: '#e5e4e2', 7: '#ffd700', 8: '#ffc107',
      9: '#e0b0ff'
    };
    if (level >= 10) return '#b9f2ff';
    return colors[level] || '#6c757d';
  },

  // ========== LIMPIAR CACHÉ ==========
  async clearCache(uid) {
    if (!uid) return;
    try {
      sessionStorage.removeItem(`gamification_${uid}`);
      localStorage.removeItem(`gamification_${uid}`);
      console.log('🗑️ Caché de gamificación limpiada para', uid);
    } catch (e) { console.warn(e); }
  },

  // ========== CÁLCULO DE XP ==========
  calculateXP(sesion, metricas) {
    let xp = 0;
    if (sesion.duracion) xp += sesion.duracion;
    if (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal)) {
      xp += metricas.distanciaTotal * 10;
    }
    const tipo = sesion.tipo;
    if (tipo === 'series') xp += 25;
    else if (tipo === 'tempo') xp += 20;
    else if (tipo === 'largo') xp += 30;
    else if (tipo === 'strength') xp += 15;
    else if (tipo === 'rodaje') xp += 10;
    return Math.floor(xp);
  },

  // ========== OBTENER DATOS DEL USUARIO ==========
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
      shoeHistory: [],
      streakDays: 0,
      bestPace: null,
      maxSpeed: 0,
      totalZone3Minutes: 0,
      totalZone4Minutes: 0,
      totalZone5Minutes: 0,
      totalElevationGain: 0,
      countLongRuns: 0,
      countTempoRuns: 0,
      countIntervals: 0,
      countStrengthRuns: 0,
      daysOfWeek: { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
      earlyBirdCount: 0,
      nightOwlCount: 0,
      maxDistanceSingle: 0,
      monthStreak: 0,
      lastMonth: null,
      firstGPSEver: false
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

  // ========== GESTIÓN DE ZAPATILLAS ==========
  async getCurrentShoe(uid) {
    const data = await this.getData(uid);
    return data.currentShoe;
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

  // ========== ACTUALIZACIÓN TRAS SESIÓN ==========
  async updateAfterSession(uid, sesion, metricas) {
    this._injectStyles();
    if (!uid) return null;
    try {
      const oldData = await this.getData(uid);
      const xpGained = this.calculateXP(sesion, metricas);
      const distance = (metricas && metricas.distanciaTotal && isFinite(metricas.distanciaTotal)) ? metricas.distanciaTotal : 0;
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');

      // Racha
      let streak = (oldData.streakDays || 0);
      if (oldData.lastSessionDate) {
        const lastDate = new Date(oldData.lastSessionDate);
        const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) streak++;
        else if (diffDays > 1) streak = 1;
      } else { streak = 1; }

      // Mejor ritmo
      let bestPace = oldData.bestPace;
      if (metricas && metricas.bestPace && metricas.bestPace > 0)
        if (!bestPace || metricas.bestPace < bestPace) bestPace = metricas.bestPace;

      // Velocidad máxima
      let maxSpeed = oldData.maxSpeed || 0;
      if (metricas && metricas.maxSpeed && metricas.maxSpeed > maxSpeed) maxSpeed = metricas.maxSpeed;

      // Zonas
      let totalZ3 = (oldData.totalZone3Minutes || 0) + (metricas?.zone3Minutes || 0);
      let totalZ4 = (oldData.totalZone4Minutes || 0) + (metricas?.zone4Minutes || 0);
      let totalZ5 = (oldData.totalZone5Minutes || 0) + (metricas?.zone5Minutes || 0);
      let totalElev = (oldData.totalElevationGain || 0) + (metricas?.elevationGain || 0);

      // Contadores por tipo
      let countLong = oldData.countLongRuns || 0;
      let countTempo = oldData.countTempoRuns || 0;
      let countIntervals = oldData.countIntervals || 0;
      let countStrength = oldData.countStrengthRuns || 0;
      if (sesion.tipo === 'largo') countLong++;
      else if (sesion.tipo === 'tempo') countTempo++;
      else if (sesion.tipo === 'series') countIntervals++;
      else if (sesion.tipo === 'strength') countStrength++;

      // Días y horas
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      let daysOfWeek = oldData.daysOfWeek || { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
      daysOfWeek[dayOfWeek] = true;
      let earlyBirdCount = oldData.earlyBirdCount || 0;
      let nightOwlCount = oldData.nightOwlCount || 0;
      if (hour < 6) earlyBirdCount++;
      if (hour >= 22) nightOwlCount++;

      // Distancia máxima en una sesión
      let maxDistSingle = Math.max(oldData.maxDistanceSingle || 0, distance);

      // Rachas mensuales
      const currentMonth = now.toISOString().slice(0, 7);
      let monthStreak = oldData.monthStreak || 0;
      let lastMonth = oldData.lastMonth;
      if (!lastMonth) {
        monthStreak = 1;
        lastMonth = currentMonth;
      } else if (lastMonth !== currentMonth) {
        const lastMonthDate = new Date(lastMonth + '-01');
        const currentMonthDate = new Date(currentMonth + '-01');
        const diffMonths = (currentMonthDate.getFullYear() - lastMonthDate.getFullYear()) * 12 + (currentMonthDate.getMonth() - lastMonthDate.getMonth());
        if (diffMonths === 1) monthStreak++;
        else if (diffMonths > 1) monthStreak = 1;
        lastMonth = currentMonth;
      }

      // Primer GPS
      let firstGPS = oldData.firstGPSEver;
      if (!firstGPS && metricas?.gpsUsed) firstGPS = true;

      // Nuevos totales
      const newTotalXP = (oldData.totalXP || 0) + xpGained;
      const newTotalDistance = (oldData.totalDistance || 0) + distance;
      const newLevel = this.getLevelByDistance(newTotalDistance);
      const newTotalSessions = (oldData.totalSessions || 0) + 1;

      // Insignias
      const currentBadges = oldData.badges || [];
      const newBadges = [...currentBadges];

      const badgeChecks = {
        FIRST_SESSION: () => newTotalSessions >= 1,
        FIRST_WEEK: () => newTotalSessions >= 7,
        FIRST_MONTH: () => newTotalSessions >= 30,
        DISTANCE_100: () => newTotalDistance >= 100,
        DISTANCE_500: () => newTotalDistance >= 500,
        DISTANCE_1000: () => newTotalDistance >= 1000,
        DISTANCE_2500: () => newTotalDistance >= 2500,
        DISTANCE_5000: () => newTotalDistance >= 5000,
        SESSIONS_10: () => newTotalSessions >= 10,
        SESSIONS_50: () => newTotalSessions >= 50,
        SESSIONS_100: () => newTotalSessions >= 100,
        SESSIONS_250: () => newTotalSessions >= 250,
        SESSIONS_500: () => newTotalSessions >= 500,
        STREAK_3: () => streak >= 3,
        STREAK_7: () => streak >= 7,
        STREAK_14: () => streak >= 14,
        STREAK_30: () => streak >= 30,
        STREAK_60: () => streak >= 60,
        STREAK_100: () => streak >= 100,
        PACE_SUB6: () => bestPace !== null && bestPace < 6,
        PACE_SUB5: () => bestPace !== null && bestPace < 5,
        PACE_SUB4: () => bestPace !== null && bestPace < 4,
        PACE_SUB3_30: () => bestPace !== null && bestPace < 3.5,
        SPEED_15: () => maxSpeed >= 15,
        SPEED_20: () => maxSpeed >= 20,
        SPEED_25: () => maxSpeed >= 25,
        SPEED_30: () => maxSpeed >= 30,
        ZONE_3_60: () => totalZ3 >= 60,
        ZONE_3_300: () => totalZ3 >= 300,
        ZONE_4_30: () => totalZ4 >= 30,
        ZONE_4_120: () => totalZ4 >= 120,
        ZONE_5_10: () => totalZ5 >= 10,
        ZONE_5_60: () => totalZ5 >= 60,
        ELEVATION_100: () => totalElev >= 100,
        ELEVATION_500: () => totalElev >= 500,
        ELEVATION_1000: () => totalElev >= 1000,
        ELEVATION_3000: () => totalElev >= 3000,
        LONG_RUN_10: () => countLong >= 10,
        LONG_RUN_50: () => countLong >= 50,
        TEMPO_10: () => countTempo >= 10,
        TEMPO_50: () => countTempo >= 50,
        INTERVALS_10: () => countIntervals >= 10,
        INTERVALS_50: () => countIntervals >= 50,
        STRENGTH_10: () => countStrength >= 10,
        STRENGTH_50: () => countStrength >= 50,
        SUNDAY_RUNNER: () => daysOfWeek[0],
        MONDAY_RUNNER: () => daysOfWeek[1],
        TUESDAY_RUNNER: () => daysOfWeek[2],
        WEDNESDAY_RUNNER: () => daysOfWeek[3],
        THURSDAY_RUNNER: () => daysOfWeek[4],
        FRIDAY_RUNNER: () => daysOfWeek[5],
        SATURDAY_RUNNER: () => daysOfWeek[6],
        EARLY_BIRD: () => earlyBirdCount >= 1,
        NIGHT_OWL: () => nightOwlCount >= 1,
        FIRST_5K: () => maxDistSingle >= 5,
        TEN_K: () => maxDistSingle >= 10,
        HALF_MARATHON: () => maxDistSingle >= 21.1,
        MARATHON: () => maxDistSingle >= 42.2,
        MONTH_STREAK_3: () => monthStreak >= 3,
        MONTH_STREAK_6: () => monthStreak >= 6,
        MONTH_STREAK_12: () => monthStreak >= 12,
        FIRST_GPS: () => firstGPS === true
      };

      for (const [badgeId, condition] of Object.entries(badgeChecks)) {
        if (!currentBadges.includes(badgeId) && condition()) {
          newBadges.push(badgeId);
        }
      }

      const newData = {
        totalXP: newTotalXP,
        level: newLevel,
        badges: newBadges,
        totalDistance: newTotalDistance,
        totalSessions: newTotalSessions,
        lastSessionDate: todayStr,
        lastUpdate: firebaseServices.Timestamp.now(),
        streakDays: streak,
        bestPace: bestPace,
        maxSpeed: maxSpeed,
        totalZone3Minutes: totalZ3,
        totalZone4Minutes: totalZ4,
        totalZone5Minutes: totalZ5,
        totalElevationGain: totalElev,
        countLongRuns: countLong,
        countTempoRuns: countTempo,
        countIntervals: countIntervals,
        countStrengthRuns: countStrength,
        daysOfWeek: daysOfWeek,
        earlyBirdCount: earlyBirdCount,
        nightOwlCount: nightOwlCount,
        maxDistanceSingle: maxDistSingle,
        monthStreak: monthStreak,
        lastMonth: lastMonth,
        firstGPSEver: firstGPS
      };

      await firebaseServices.db.collection('gamification').doc(uid).set(newData, { merge: true });
      await this.addKilometersToShoe(uid, distance);

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

  // ========== REVERTIR SESIÓN ==========
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
  },

  // ========== GENERAR ELEMENTO HTML DE UNA INSIGNIA ==========
  getBadgeElement(badgeId, unlocked = true) {
    this._injectStyles();
    const badge = this.BADGES[badgeId];
    if (!badge) return null;

    const span = document.createElement('span');
    span.className = `gamification-badge ${!unlocked ? 'gamification-badge-locked' : ''}`;

    // Asignar forma
    if (badge.shape === 'round') {
      span.classList.add('badge-round');
    } else {
      span.classList.add('badge-pill');
    }

    // Asignar categoría de color
    if (badgeId.includes('FIRST') || badgeId.includes('WEEK') || badgeId.includes('MONTH'))
      span.classList.add('badge-category-progress');
    else if (badgeId.includes('DISTANCE')) span.classList.add('badge-category-distance');
    else if (badgeId.includes('SESSIONS')) span.classList.add('badge-category-sessions');
    else if (badgeId.includes('STREAK')) span.classList.add('badge-category-streak');
    else if (badgeId.includes('PACE')) span.classList.add('badge-category-pace');
    else if (badgeId.includes('SPEED')) span.classList.add('badge-category-speed');
    else if (badgeId.includes('ZONE')) span.classList.add('badge-category-zone');
    else if (badgeId.includes('ELEVATION')) span.classList.add('badge-category-elevation');
    else if (badgeId.includes('LONG') || badgeId.includes('TEMPO') || badgeId.includes('INTERVALS') || badgeId.includes('STRENGTH'))
      span.classList.add('badge-category-training');
    else if (badgeId.includes('SUNDAY') || badgeId.includes('MONDAY') || badgeId.includes('TUESDAY') || badgeId.includes('WEDNESDAY') || badgeId.includes('THURSDAY') || badgeId.includes('FRIDAY') || badgeId.includes('SATURDAY'))
      span.classList.add('badge-category-weekday');
    else span.classList.add('badge-category-special');

    // Construir contenido
    const emojicon = badge.emoji || badge.emoticon || '';
    const displayText = badge.shape === 'round' ? (badge.name || '') : (badge.name || '');

    if (badge.shape === 'round') {
      span.innerHTML = `
        <div class="badge-emojicon">${emojicon}</div>
        <div class="badge-text">${displayText}</div>
      `;
    } else {
      span.innerHTML = `
        <span class="badge-emojicon">${emojicon}</span>
        <span class="badge-text">${displayText}</span>
      `;
    }

    if (!unlocked) span.title = 'Bloqueado';
    else span.title = `${badge.name}: ${badge.description} (+${badge.xp} XP)`;
    return span;
  }
};

window.Gamification = Gamification;
console.log('✅ Gamification v7.1 - Sistema híbrido de insignias (redondas y alargadas, con emojis/emoticonos)');