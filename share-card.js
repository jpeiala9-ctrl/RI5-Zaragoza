// ==================== share-card.js ====================
// Versión: 1.0 - Genera una imagen-resumen ("tarjeta") de la sesión
// recién completada y permite compartirla directamente a la app que el
// usuario prefiera (Instagram, WhatsApp, Strava, etc.) usando el panel
// nativo de compartir del sistema (Web Share API con archivos).
//
// Esto NO es una integración real con Strava (eso requeriría OAuth y un
// backend con el client secret de una app registrada en Strava): aquí
// se genera una imagen y se abre el selector de apps del propio móvil,
// donde el usuario elige a dónde mandarla — puede incluir Strava si esa
// app soporta recibir imágenes compartidas desde otras apps.
// ====================

const ShareCard = {

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

  async _generarCanvas(datos) {
    const W = 1080, H = 1350; // 4:5, cómodo para stories/feed de Instagram y similares
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

    const logo = await this._cargarLogo();
    ctx.textBaseline = 'alphabetic';
    if (logo) ctx.drawImage(logo, 60, 55, 90, 90);
    ctx.fillStyle = '#c0a060';
    ctx.font = '600 32px "Courier New", monospace';
    ctx.fillText('RI5 · RUNNING INTELLIGENCE', logo ? 168 : 60, 112);

    ctx.fillStyle = '#e8e8e8';
    ctx.font = '400 28px "Courier New", monospace';
    ctx.fillText(`${datos.username || 'Runner'} · ${datos.fecha || ''}`, 60, 195);

    ctx.fillStyle = '#c0a060';
    ctx.font = '700 52px "Courier New", monospace';
    const titulo = `${this._tipoEmoji(datos.tipo)} ${(datos.nombreSesion || datos.tipo || 'SESIÓN').toUpperCase()}`;
    ctx.fillText(titulo, 60, 280);

    const metrics = [
      { label: 'DISTANCIA', value: `${(Number(datos.distanciaKm) || 0).toFixed(2)} km` },
      { label: 'TIEMPO', value: this._fmtTiempo(datos.duracionMs) },
      { label: 'RITMO', value: `${this._fmtRitmo(datos.distanciaKm, datos.duracionMs)} /km` }
    ];
    let y = 420;
    metrics.forEach(m => {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 24px "Courier New", monospace';
      ctx.fillText(m.label, 60, y);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 88px "Courier New", monospace';
      ctx.fillText(m.value, 60, y + 82);
      y += 190;
    });

    if (datos.zona) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 24px "Courier New", monospace';
      ctx.fillText('ZONA', 60, y);
      ctx.fillStyle = '#9BB5A0';
      ctx.font = '700 38px "Courier New", monospace';
      ctx.fillText(datos.zona, 60, y + 44);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '400 22px "Courier New", monospace';
    ctx.fillText('Entrenado con RI5', 60, H - 60);

    return canvas;
  },

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
      <button id="skipShareCardBtn" style="background:none; border:none; color:var(--text-secondary,#888); font-size:12px; cursor:pointer; padding:4px;">Ahora no</button>
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
        const texto = `${this._tipoEmoji(datos.tipo)} ${(datos.nombreSesion || datos.tipo || 'Sesión').toUpperCase()} · ${(Number(datos.distanciaKm) || 0).toFixed(2)} km en ${this._fmtTiempo(datos.duracionMs)} 🏃 #RI5`;
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Mi sesión en RI5', text: texto });
          } else if (navigator.share) {
            // Algunos navegadores (sobre todo de escritorio) no admiten
            // compartir archivos, solo texto/enlace.
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
  }
};

window.ShareCard = ShareCard;
console.log('✅ ShareCard v1.0 - Imagen-resumen de sesión lista para compartir');
