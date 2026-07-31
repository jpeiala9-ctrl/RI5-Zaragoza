// ==================== share-card.js ====================
// Versión: 2.0 - Tarjeta de resumen enriquecida (mapa de ruta, gráfica de
// los últimos 7 días, calorías y zapatilla) para compartir la ÚLTIMA
// SESIÓN desde la tarjeta de Inicio. Genera una imagen con <canvas> y la
// comparte con el panel nativo del móvil (cualquier app que el usuario
// elija: WhatsApp, Instagram, Strava...).
//
// No es una integración real con ninguna red social: es una imagen
// exportada con marca RI5, pensada como reclamo para quien la reciba.
// ====================

const ShareCard = {

  // ---------- Utilidades de formato ----------
  _fmtTiempo(ms) {
    if (!ms) return '0:00';
    const totalSeg = Math.floor(ms / 1000);
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  _fmtRitmo(distanciaKm, ms) {
    if (!distanciaKm || distanciaKm < 0.1 || !ms) return '--:--';
    const segPorKm = (ms / 1000) / distanciaKm;
    const m = Math.floor(segPorKm / 60);
    const s = Math.round(segPorKm % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  _tipoEmoji(tipo) {
    return { rodaje: '🏃‍♂️', tempo: '⚡', series: '🔁', largo: '📏', strength: '💪' }[tipo] || '🏃';
  },

  _cargarLogo() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = './icon-192.png';
    });
  },

  // ---------- Recopilar los datos de la última sesión ----------
  async _recopilarDatos() {
    const ult = AppState.currentUserData?.ultimaSesion;
    if (!ult) return null;

    const uid = AppState.currentUserId;
    const peso = AppState.currentUserData?.profile?.weight || null;

    // trackPoints / gpsDistanceKm / gpsDurationMs NO están en
    // 'ultimaSesion' (solo se guardan en el propio documento del muro).
    // Si la sesión llevaba GPS y guardamos su entryId, se piden aquí,
    // frescos, en el momento de compartir.
    let trackPoints = null;
    let gpsDistanciaKm = null;
    let gpsDuracionMs = null;
    if (ult.hasGPS && ult.entryId) {
      try {
        const doc = await firebaseServices.db.collection('globalFeed').doc(ult.entryId).get();
        if (doc.exists) {
          const d = doc.data();
          if (Array.isArray(d.trackPoints) && d.trackPoints.length >= 2) trackPoints = d.trackPoints;
          if (d.gpsDistanceKm) gpsDistanciaKm = d.gpsDistanceKm;
          if (d.gpsDurationMs) gpsDuracionMs = d.gpsDurationMs;
        }
      } catch (e) { console.warn('No se pudo recuperar la ruta GPS para compartir:', e); }
    }

    const distanciaKm = gpsDistanciaKm || parseFloat(ult.distancia || 0);
    const duracionMs = gpsDuracionMs || (ult.duration ? ult.duration * 60000 : 0);

    // Zapatilla actual (si tiene)
    let zapatilla = null;
    try {
      if (window.Gamification && uid) {
        const shoe = await Gamification.getCurrentShoe(uid);
        if (shoe && shoe.name && shoe.name !== 'Zapatilla actual') zapatilla = shoe;
      }
    } catch (e) { console.warn('No se pudo recuperar la zapatilla para compartir:', e); }

    // Km de los últimos 7 días, para la mini-gráfica
    let kmPorDia = [0, 0, 0, 0, 0, 0, 0];
    try {
      const desde = new Date();
      desde.setDate(desde.getDate() - 6);
      desde.setHours(0, 0, 0, 0);
      const snap = await firebaseServices.db.collection('globalFeed')
        .where('userId', '==', uid)
        .get();
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      snap.forEach(doc => {
        const d = doc.data();
        const fecha = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
        const fechaDia = new Date(fecha); fechaDia.setHours(0, 0, 0, 0);
        if (fechaDia >= desde && fechaDia <= hoy) {
          const idx = Math.round((fechaDia - desde) / 86400000);
          if (idx >= 0 && idx < 7) kmPorDia[idx] += parseFloat(d.gpsDistanceKm || d.distancia || 0);
        }
      });
    } catch (e) { console.warn('No se pudo recuperar el histórico de km para la gráfica:', e); }

    // Calorías estimadas de ESTA sesión (misma fórmula que "Esta semana")
    const pesoEstim = peso || 70;
    const calorias = Math.round(distanciaKm * pesoEstim * 1.036);

    return {
      username: AppState.currentUserData?.username || 'Runner',
      fecha: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      tipo: ult.trainingType || 'rodaje',
      nombreSesion: ult.trainingName || ult.trainingType || 'Sesión',
      zona: ult.zone || '',
      distanciaKm,
      duracionMs,
      calorias,
      trackPoints,
      zapatilla,
      kmPorDia
    };
  },

  // ---------- Dibujo del mapa de la ruta (sin mosaicos reales: solo la
  // silueta del recorrido, como hacen las tarjetas de Strava/Nike) ----------
  _dibujarRuta(ctx, trackPoints, x, y, w, h) {
    // Fondo de la zona del mapa
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, y, w, h);

    if (!trackPoints || trackPoints.length < 2) return;

    const lats = trackPoints.map(p => p.lat);
    const lngs = trackPoints.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const avgLat = (minLat + maxLat) / 2;
    // La longitud "encoge" según la latitud; sin este ajuste la ruta
    // saldría deformada horizontalmente.
    const corrLng = Math.cos(avgLat * Math.PI / 180);

    const padding = 36;
    const rangoLat = (maxLat - minLat) || 0.0005;
    const rangoLng = ((maxLng - minLng) * corrLng) || 0.0005;
    const escala = Math.min((w - padding * 2) / rangoLng, (h - padding * 2) / rangoLat);

    const proyectar = (p) => {
      const px = x + (w / 2) + ((p.lng - (minLng + maxLng) / 2) * corrLng) * escala;
      const py = y + (h / 2) - (p.lat - (minLat + maxLat) / 2) * escala;
      return [px, py];
    };

    const puntos = trackPoints.map(proyectar);

    // Resplandor dorado detrás de la línea
    ctx.save();
    ctx.shadowColor = 'rgba(192,160,96,0.7)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    puntos.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
    ctx.stroke();
    ctx.restore();

    // Inicio: círculo blanco hueco
    const [sx, sy] = puntos[0];
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Final: punto dorado sólido
    const [ex, ey] = puntos[puntos.length - 1];
    ctx.beginPath();
    ctx.arc(ex, ey, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#c0a060';
    ctx.fill();
  },

  // ---------- Mini gráfica de los últimos 7 días ----------
  _dibujarGraficaSemana(ctx, kmPorDia, x, y, w, h) {
    const max = Math.max(...kmPorDia, 1);
    const n = kmPorDia.length;
    const gap = 10;
    const barW = (w - gap * (n - 1)) / n;
    const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const hoyIdx = n - 1;

    kmPorDia.forEach((km, i) => {
      const barH = Math.max(4, (km / max) * (h - 22));
      const bx = x + i * (barW + gap);
      const by = y + (h - 22) - barH;
      ctx.fillStyle = i === hoyIdx ? '#c0a060' : 'rgba(192,160,96,0.35)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, barW, barH, 4) : ctx.rect(bx, by, barW, barH);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '400 20px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dias[i], bx + barW / 2, y + h - 2);
    });
    ctx.textAlign = 'left';
  },

  // ---------- Generar el canvas completo ----------
  async _generarCanvas(datos) {
    const W = 1080, H = 1500;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#151515');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(192,160,96,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, W - 36, H - 36);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // Cabecera: logo + marca + usuario/fecha
    const logo = await this._cargarLogo();
    if (logo) ctx.drawImage(logo, 56, 50, 84, 84);
    ctx.fillStyle = '#c0a060';
    ctx.font = '600 30px "Courier New", monospace';
    ctx.fillText('RI5 · RUNNING INTELLIGENCE', logo ? 156 : 56, 100);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '400 26px "Courier New", monospace';
    ctx.fillText(`${datos.username} · ${datos.fecha}`, logo ? 156 : 56, 132);

    // Título de la sesión + zona
    let y = 205;
    ctx.fillStyle = '#c0a060';
    ctx.font = '700 48px "Courier New", monospace';
    const titulo = `${this._tipoEmoji(datos.tipo)} ${(datos.nombreSesion || datos.tipo).toUpperCase()}`;
    ctx.fillText(titulo, 56, y);
    if (datos.zona) {
      ctx.font = '600 24px "Courier New", monospace';
      ctx.fillStyle = '#9BB5A0';
      ctx.fillText(datos.zona, W - 56 - ctx.measureText(datos.zona).width, y);
    }

    // Mapa de la ruta (si hay GPS) — deja más espacio a las stats si no
    y += 34;
    const alturaMapa = datos.trackPoints ? 360 : 0;
    if (datos.trackPoints) {
      this._dibujarRuta(ctx, datos.trackPoints, 56, y, W - 112, alturaMapa);
      y += alturaMapa + 40;
    } else {
      y += 20;
    }

    // Stats grandes: distancia / tiempo / ritmo / calorías (grid 2x2)
    const metrics = [
      { label: 'DISTANCIA', value: `${(datos.distanciaKm || 0).toFixed(2)} km` },
      { label: 'TIEMPO', value: this._fmtTiempo(datos.duracionMs) },
      { label: 'RITMO', value: `${this._fmtRitmo(datos.distanciaKm, datos.duracionMs)} /km` },
      { label: 'CALORÍAS', value: `${(datos.calorias || 0).toLocaleString('es-ES')} kcal` }
    ];
    const colW = (W - 112) / 2;
    metrics.forEach((m, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const mx = 56 + col * colW;
      const my = y + row * 150;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 22px "Courier New", monospace';
      ctx.fillText(m.label, mx, my);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 58px "Courier New", monospace';
      ctx.fillText(m.value, mx, my + 56);
    });
    y += 150 * 2 + 20;

    // Zapatilla
    if (datos.zapatilla) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(56, y, W - 112, 64, 14) : ctx.rect(56, y, W - 112, 64);
      ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.font = '600 26px "Courier New", monospace';
      ctx.fillText(`👟 ${datos.zapatilla.name}`, 76, y + 40);
      const kmTxt = `${(datos.zapatilla.km || 0).toFixed(0)} km`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 24px "Courier New", monospace';
      ctx.fillText(kmTxt, W - 76 - ctx.measureText(kmTxt).width, y + 40);
      y += 64 + 34;
    } else {
      y += 10;
    }

    // Mini gráfica de los últimos 7 días
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '400 22px "Courier New", monospace';
    ctx.fillText('ÚLTIMOS 7 DÍAS', 56, y);
    this._dibujarGraficaSemana(ctx, datos.kmPorDia, 56, y + 16, W - 112, 130);

    // Pie / reclamo
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Entrenado con RI5 — entrena gratis con tu móvil', W / 2, H - 50);
    ctx.textAlign = 'left';

    return canvas;
  },

  // ---------- Modal de vista previa + compartir ----------
  async mostrarModal(datos) {
    let canvas;
    try {
      if (typeof Utils !== 'undefined' && Utils.showLoading) Utils.showLoading();
      canvas = await this._generarCanvas(datos || {});
    } finally {
      if (typeof Utils !== 'undefined' && Utils.hideLoading) Utils.hideLoading();
    }

    document.getElementById('shareCardOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shareCardOverlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(4px);
      z-index:70000; display:flex; align-items:center; justify-content:center; padding:20px;
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:#0f0f0f; border-radius:20px; padding:16px; max-width:420px; width:100%;
      border:1px solid #2a2a2a; display:flex; flex-direction:column; gap:14px;
      max-height:90vh; overflow:auto; font-family:'Courier New', monospace;
    `;

    const imgDataUrl = canvas.toDataURL('image/png');
    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:600; letter-spacing:1px; color:#c0a060; font-size:13px;">📸 RESUMEN DE LA SESIÓN</span>
        <button id="closeShareCardBtn" style="background:#c0392b; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:14px;">✕</button>
      </div>
      <img src="${imgDataUrl}" style="width:100%; border-radius:12px; display:block; border:1px solid #2a2a2a;">
      <div style="display:flex; gap:10px;">
        <button id="shareCardBtn" style="flex:1; background:#c0a060; border:none; color:#000; font-weight:700; padding:12px; border-radius:12px; cursor:pointer; font-size:14px;">📤 Compartir</button>
        <button id="downloadCardBtn" style="flex:1; background:transparent; border:1px solid #2a2a2a; color:#ccc; font-weight:600; padding:12px; border-radius:12px; cursor:pointer; font-size:14px;">⬇️ Guardar</button>
      </div>
      <button id="skipShareCardBtn" style="background:none; border:none; color:#888; font-size:12px; cursor:pointer; padding:4px;">Ahora no</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cerrar = () => overlay.remove();
    document.getElementById('closeShareCardBtn').addEventListener('click', cerrar);
    document.getElementById('skipShareCardBtn').addEventListener('click', cerrar);

    document.getElementById('shareCardBtn').addEventListener('click', async () => {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `ri5-sesion-${Date.now()}.png`, { type: 'image/png' });
        const texto = `${this._tipoEmoji(datos.tipo)} ${(datos.nombreSesion || datos.tipo).toUpperCase()} · ${(datos.distanciaKm||0).toFixed(2)} km en ${this._fmtTiempo(datos.duracionMs)} 🏃 Entrenado con RI5 — la app gratuita de entrenamiento inteligente`;
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Mi sesión en RI5', text: texto });
          } else if (navigator.share) {
            await navigator.share({ title: 'Mi sesión en RI5', text: texto });
            if (typeof Utils !== 'undefined') Utils.showToast('Tu navegador no admite compartir la imagen: descárgala y adjúntala a mano', 'info', 5000);
          } else {
            this._descargar(canvas);
            if (typeof Utils !== 'undefined') Utils.showToast('Tu navegador no admite compartir directo: se ha descargado la imagen', 'info', 5000);
          }
        } catch (err) {
          if (err?.name !== 'AbortError') {
            console.error('Error al compartir:', err);
            if (typeof Utils !== 'undefined') Utils.showToast('No se pudo abrir el panel de compartir', 'error');
          }
        }
      }, 'image/png');
    });

    document.getElementById('downloadCardBtn').addEventListener('click', () => this._descargar(canvas));
  },

  _descargar(canvas) {
    const a = document.createElement('a');
    a.download = `ri5-sesion-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  },

  // ---------- Punto de entrada desde la tarjeta de Inicio ----------
  async compartirUltimaSesion() {
    if (!AppState.currentUserData?.ultimaSesion) {
      if (typeof Utils !== 'undefined') Utils.showToast('Todavía no tienes ninguna sesión registrada', 'info');
      return;
    }
    try {
      if (typeof Utils !== 'undefined' && Utils.showLoading) Utils.showLoading();
      const datos = await this._recopilarDatos();
      if (typeof Utils !== 'undefined' && Utils.hideLoading) Utils.hideLoading();
      if (!datos) return;
      await this.mostrarModal(datos);
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.hideLoading) Utils.hideLoading();
      console.error('Error preparando el resumen para compartir:', e);
      if (typeof Utils !== 'undefined') Utils.showToast('No se pudo preparar el resumen', 'error');
    }
  }
};

window.ShareCard = ShareCard;
console.log('✅ ShareCard v2.0 - Resumen enriquecido (mapa, gráfica, calorías, zapatilla)');
