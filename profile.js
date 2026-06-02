// ==================== profile.js - TARJETA CON MODAL DE INSIGNIAS (SOLO ICONOS) ====================
// Versión: 10.3 - Fallback SVG para minimapa GPS + visor de tracks
// ====================

const Profile = {
  _gpsEntries: {}, // cache de entries GPS para el viewer

  // ===== MINIMAPA SVG INLINE (sin depender de GPSTracker) =====
  _fallbackRenderTrackSVG(points, width = 300, height = 120) {
    if (!points || points.length < 2) return '';
    const w = width, h = height, pad = 14;
    const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeLng = maxLng - minLng || 0.0001, rangeLat = maxLat - minLat || 0.0001;
    const W = w - pad * 2, H = h - pad * 2;
    const scale = Math.min(W / rangeLng, H / rangeLat);
    const offX = pad + (W - rangeLng * scale) / 2;
    const offY = pad + (H - rangeLat * scale) / 2;
    const toXY = p => `${(offX + (p.lng - minLng) * scale).toFixed(1)},${(offY + (maxLat - p.lat) * scale).toFixed(1)}`;
    const pathD = 'M ' + points.map(toXY).join(' L ');
    const s = toXY(points[0]).split(',');
    const e = toXY(points[points.length - 1]).split(',');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"
      style="border-radius:10px;background:#0f0f0f;display:block;width:100%;"
      xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" fill="none" stroke="#c0a060" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
      <circle cx="${s[0]}" cy="${s[1]}" r="5" fill="#9BB5A0" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${e[0]}" cy="${e[1]}" r="5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  },

  async cargarPerfil(forceRefresh = false) {
    const container = document.getElementById('perfilContainer');
    if (!container || !AppState.currentUserId) {
      console.warn('⚠️ cargarPerfil: contenedor no encontrado o usuario no autenticado');
      return;
    }

    const cacheKey = `perfil_${AppState.currentUserId}`;
    let htmlCache = null;

    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { html, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 60 * 1000) {
            container.innerHTML = html;
            console.log('📦 Perfil cargado desde caché');
            htmlCache = html;
          }
        } catch (e) {}
      }
    } else {
      localStorage.removeItem(cacheKey);
      sessionStorage.removeItem(`gamification_${AppState.currentUserId}`);
      localStorage.removeItem(`gamification_${AppState.currentUserId}`);
      console.log('🔄 Recarga forzada del perfil (sin caché)');
    }

    try {
      console.time('cargarPerfil');
      console.log('🔄 Cargando perfil desde Firestore...');
      const userRef = firebaseServices.db.collection('users').doc(AppState.currentUserId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      // Limpieza de amigos huérfanos (lotes)
      let friendIds = userData.friendIds || [];
      let necesitaActualizacion = false;
      const amigosValidos = [];
      const chunks = [];
      for (let i = 0; i < friendIds.length; i += 10) {
        chunks.push(friendIds.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        const snapshot = await firebaseServices.db.collection('users')
          .where('__name__', 'in', chunk)
          .get();
        snapshot.forEach(doc => amigosValidos.push(doc.id));
      }
      if (amigosValidos.length !== friendIds.length) {
        necesitaActualizacion = true;
        await userRef.update({
          friendIds: amigosValidos,
          friendsCount: amigosValidos.length
        });
        userData.friendIds = amigosValidos;
        userData.friendsCount = amigosValidos.length;
        console.log(`✅ Lista de amigos limpiada. Ahora hay ${amigosValidos.length} amigos reales.`);
      }
      const amigosReales = amigosValidos.length;

      const profile = userData.profile || {
        bio: '', city: '', age: null, gender: '', weight: null, height: null,
        privacySettings: { showTrainings: 'friends', showProfile: 'public' },
        photoURL: null
      };

      const photoHTML = profile.photoURL
        ? `<img src="${Utils.escapeHTML(profile.photoURL)}" class="perfil-avatar" style="object-fit:cover;">`
        : `<div class="perfil-avatar-placeholder">👤</div>`;

      const age = profile.age ? Utils.escapeHTML(profile.age + ' años') : '—';
      const gender = profile.gender === 'male' ? 'Hombre' : profile.gender === 'female' ? 'Mujer' : profile.gender === 'other' ? 'Otro' : '—';
      const bio = profile.bio ? Utils.escapeHTML(profile.bio) : '—';
      const city = profile.city ? Utils.escapeHTML(profile.city) : '—';
      const weight = profile.weight ? Utils.escapeHTML(profile.weight + ' kg') : '—';
      const height = profile.height ? Utils.escapeHTML(profile.height + ' m') : '—';

      let html = `
        <div class="perfil-header">
          ${photoHTML}
          <div class="perfil-info">
            <div class="perfil-nombre">${Utils.escapeHTML(Utils.capitalizeUsername(userData.username))}</div>
            <div class="perfil-username">@${Utils.escapeHTML(userData.username)}</div>
            <div class="perfil-stats">
              <div class="perfil-stat"><span>${amigosReales}</span><label>Amigos</label></div>
              <div class="perfil-stat"><span>${userData.calculosMes || 0}</span><label>Cálculos/mes</label></div>
              <div class="perfil-stat"><span>${userData.premium ? 'PREMIUM' : 'GRATIS'}</span><label>Plan</label></div>
            </div>
          </div>
        </div>
        <div class="perfil-detalle-grid" style="grid-template-columns: repeat(2, 1fr) !important;">
          <div class="perfil-detalle-item"><span class="label">BIO</span><span class="value">${bio}</span></div>
          <div class="perfil-detalle-item"><span class="label">CIUDAD</span><span class="value">${city}</span></div>
          <div class="perfil-detalle-item"><span class="label">EDAD</span><span class="value">${age}</span></div>
          <div class="perfil-detalle-item"><span class="label">GÉNERO</span><span class="value">${gender}</span></div>
          <div class="perfil-detalle-item"><span class="label">PESO</span><span class="value">${weight}</span></div>
          <div class="perfil-detalle-item"><span class="label">ALTURA</span><span class="value">${height}</span></div>
          <div class="perfil-detalle-item" style="grid-column: span 2;">
            <span class="label">EMAIL</span>
            <span class="value">${Utils.escapeHTML(userData.email)}</span>
          </div>
        </div>
      `;

      // ========== TARJETA "PASAPORTE" ==========
      try {
        const gamificationData = await Gamification.getData(AppState.currentUserId);
        if (gamificationData) {
          const progress = Gamification.getProgressToNextLevel(gamificationData.totalDistance);
          const levelColor = Gamification.getColorByLevel(gamificationData.level);
          
          console.log(`🎨 Nivel ${gamificationData.level} → color: ${levelColor}`);
          
          let bgColor = levelColor;
          if (levelColor.startsWith('#')) {
            const r = parseInt(levelColor.slice(1,3), 16);
            const g = parseInt(levelColor.slice(3,5), 16);
            const b = parseInt(levelColor.slice(5,7), 16);
            bgColor = `rgba(${r}, ${g}, ${b}, 0.05)`;
          } else if (levelColor.startsWith('rgb')) {
            bgColor = levelColor.replace('rgb', 'rgba').replace(')', ', 0.05)');
          } else {
            bgColor = 'var(--bg-secondary)';
          }
          
          const badgesIcons = (gamificationData.badges || []).map(badgeId => {
            const badge = Gamification.BADGES[badgeId];
            if (!badge) return '';
            return `<span class="badge-icon" data-badge-id="${badgeId}" style="display:inline-block; font-size:28px; margin:0 6px; cursor:pointer;" title="${badge.name}">${badge.icon}</span>`;
          }).filter(b => b).join('');
          
          const shoe = await Gamification.getCurrentShoe(AppState.currentUserId);
          const shoeName = shoe.name || 'Zapatilla actual';
          const shoeKm = (shoe.km || 0).toFixed(1);
          
          const nextLevel = Gamification.LEVELS_KM.find(l => l.level === gamificationData.level + 1);
          const nextKm = nextLevel ? nextLevel.kmNeeded : gamificationData.totalDistance;
          
          const userName = Utils.capitalizeUsername(userData.username);
          
          html += `
            <div class="passport-card" style="margin-top:24px; border:2px solid ${levelColor}; border-radius:24px; background:${bgColor}; box-shadow:0 8px 20px rgba(0,0,0,0.1); overflow:hidden;">
              <div style="padding:16px 20px 0 20px; text-align:center; border-bottom:1px solid ${levelColor}40;">
                <span style="font-size:16px; font-weight:500; letter-spacing:1px; color:${levelColor};">${Utils.escapeHTML(userName)}</span>
              </div>
              <div style="padding:16px 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                  <div style="flex:1; text-align: center;">
                    <div style="font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--text-secondary);">Nivel</div>
                    <strong style="font-size:36px; font-weight:300; color:${levelColor};">${gamificationData.level}</strong>
                  </div>
                  <div style="flex:1; text-align: right;">
                    <div style="font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--text-secondary);">Zapatilla actual</div>
                    <strong style="font-size:14px;">${Utils.escapeHTML(shoeName)}</strong>
                    <div style="font-size:12px; opacity:0.8;">${shoeKm} km</div>
                  </div>
                </div>
                <div style="margin-bottom: 20px;">
                  <div class="level-progress" style="background:var(--border-color); height:3px; border-radius:3px; overflow:hidden;">
                    <div class="level-progress-fill" style="width: ${progress}%; background: ${levelColor}; height:3px;"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-top:4px;">
                    <span style="font-size:8px;">0 km</span>
                    <span style="font-size:8px;">${gamificationData.totalDistance.toFixed(0)} km</span>
                    <span style="font-size:8px;">${nextKm} km</span>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; text-align: center;">
                  <div style="flex:1;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-secondary);">📏 DISTANCIA</div>
                    <strong style="font-size:18px;">${gamificationData.totalDistance.toFixed(1)}</strong>
                    <span style="font-size:11px;"> km</span>
                  </div>
                  <div style="flex:1;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-secondary);">🎯 SESIONES</div>
                    <strong style="font-size:18px;">${gamificationData.totalSessions}</strong>
                  </div>
                  <div style="flex:1;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-secondary);">✨ XP</div>
                    <strong style="font-size:18px;">${gamificationData.totalXP}</strong>
                  </div>
                </div>
                ${badgesIcons ? `<div style="margin-bottom: 16px; border-top:1px solid ${levelColor}40; padding-top:16px;">
                  <div style="font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--text-secondary); margin-bottom:12px;">🏅 Sellos de progreso</div>
                  <div class="badges-icons-container" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">${badgesIcons}</div>
                </div>` : '<p style="text-align:center; font-size:11px; margin-bottom:16px;">Completa entrenamientos para desbloquear sellos</p>'}
                <div style="display: flex; justify-content: center; gap: 12px; margin-top:8px;">
                  <button id="changeShoeBtn" style="background:transparent; border:1px solid ${levelColor}; color:${levelColor}; padding:2px 10px; border-radius:30px; font-size:10px; letter-spacing:0.5px; cursor:pointer;">👟 Cambiar</button>
                  <button id="historyShoeBtn" style="background:transparent; border:1px solid ${levelColor}; color:${levelColor}; padding:2px 10px; border-radius:30px; font-size:10px; letter-spacing:0.5px; cursor:pointer;">📜 Historial</button>
                </div>
              </div>
            </div>
          `;
        }
      } catch (e) { console.warn(e); }

      // ========== MIS ÚLTIMOS ENTRENAMIENTOS ==========
      try {
        const misEntrenamientosSnapshot = await firebaseServices.db
          .collection('globalFeed')
          .where('userId', '==', AppState.currentUserId)
          .orderBy('timestamp', 'desc')
          .limit(5)
          .get();

        if (!misEntrenamientosSnapshot.empty) {
          let entrenamientosHTML = '<div class="mis-entrenamentos-section" style="margin-top:24px; margin-bottom:24px; background:var(--bg-secondary); border-radius:16px; padding:16px;">';
          entrenamientosHTML += '<h3 style="margin-top:0; margin-bottom:16px; text-align:left; font-size:18px;">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3>';
          
          for (const doc of misEntrenamientosSnapshot.docs) {
            const entry = doc.data();
            const entryId = doc.id;
            let fecha = '';
            try {
              if (entry.timestamp) {
                const dateObj = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
                fecha = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              }
            } catch (e) {}
            
            const tipoEmoji = { rodaje: '🏃‍♂️', tempo: '⚡', series: '🔁', largo: '📏', strength: '💪' }[entry.trainingType] || '🏃';
            const trainingName = entry.trainingName ? Utils.escapeHTML(entry.trainingName) : Utils.escapeHTML(entry.trainingType).toUpperCase();
            const duracion = entry.duration || 0;
            const distancia = (entry.distancia && isFinite(entry.distancia)) ? entry.distancia.toFixed(2) : '0.00';
            const tss = entry.tss || 0;
            
            let likeCount = 0;
            try {
              const feedDoc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
              if (feedDoc.exists) likeCount = (feedDoc.data().likes || []).length;
            } catch (err) {}
            
            // Guardar entry GPS en cache para el viewer
            if (entry.hasGPS && entry.trackPoints) {
              Profile._gpsEntries[entryId] = { ...entry, id: entryId };
            }

            const gpsBadge = entry.hasGPS
              ? `<span style="font-size:9px;color:#c0a060;background:rgba(192,160,96,.12);border:1px solid rgba(192,160,96,.3);border-radius:20px;padding:2px 7px;margin-left:6px;letter-spacing:1px;">📍GPS</span>`
              : '';

            // Minimap SVG (solo si hay datos GPS)
            let gpsMapBlock = '';
            if (entry.hasGPS && Array.isArray(entry.trackPoints) && entry.trackPoints.length >= 2) {
              const mapSVG = (typeof this._fallbackRenderTrackSVG === 'function')
                ? this._fallbackRenderTrackSVG(entry.trackPoints, 300, 120)
                : (window.GPSTracker && typeof GPSTracker.renderTrackSVG === 'function')
                  ? GPSTracker.renderTrackSVG(entry.trackPoints, 300, 120)
                  : '';
              if (mapSVG) {
                const distGPS  = entry.gpsDistanceKm ? Number(entry.gpsDistanceKm).toFixed(2) + ' km' : '';
                const timeGPS  = (entry.gpsDurationMs && window.GPSTrackViewer)
                  ? GPSTrackViewer._fmtTime(entry.gpsDurationMs) : '';
                gpsMapBlock = `
                  <div class="gps-minimap-tap-profile" data-entry-id="${entryId}"
                    style="margin-top:10px;border-radius:10px;overflow:hidden;
                           border:1px solid #2a2a2a;cursor:pointer;position:relative;
                           -webkit-tap-highlight-color:transparent;">
                    ${mapSVG}
                    <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                                align-items:center;justify-content:flex-end;padding-bottom:8px;
                                pointer-events:none;">
                      <div style="background:rgba(0,0,0,0.72);color:#c0a060;font-size:10px;
                                  letter-spacing:1.5px;padding:4px 12px;border-radius:20px;
                                  border:1px solid rgba(192,160,96,0.35);font-family:'Courier New',monospace;">
                        🗺 VER RECORRIDO${distGPS ? ' · 📍 ' + distGPS : ''}${timeGPS ? ' · ⏱ ' + timeGPS : ''}
                      </div>
                    </div>
                  </div>
                `;
              }
            }

            entrenamientosHTML += `
              <div class="mis-entreno-wrapper" data-entry-id="${entryId}" style="border-bottom:1px solid var(--border-color); margin-bottom:8px;">
                <div class="mis-entreno-header" style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; cursor:pointer;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:20px;">${tipoEmoji}</span>
                    <div>
                      <div style="font-weight:500; display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                        ${trainingName}${gpsBadge}
                      </div>
                      <div style="font-size:12px; color:var(--text-secondary);">${fecha}</div>
                    </div>
                  </div>
                  <div><span style="font-size:13px;">▶</span></div>
                </div>
                <div class="mis-entreno-detalle" style="display:none; padding:0 0 12px 0; flex-direction:column;">
                  <div style="display:flex; gap:16px; font-size:13px; margin-bottom:8px;">
                    <span>⏱️ ${duracion}'</span><span>📏 ${distancia} km</span><span>⚡ ${tss} TSS</span>
                  </div>
                  ${gpsMapBlock}
                  <div style="margin-top:8px;">
                    <button class="like-btn-profile" data-entry-id="${entryId}" style="background:none; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-size:14px; color:var(--text-secondary);">❤️ <span class="like-count-profile">${likeCount}</span></button>
                  </div>
                </div>
              </div>
            `;
          }
          entrenamientosHTML += '</div>';
          html += entrenamientosHTML;
        } else {
          html += `<div style="margin-top:24px; margin-bottom:24px; background:var(--bg-secondary); border-radius:16px; padding:16px; text-align:center;"><h3 style="margin-top:0; margin-bottom:8px;">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3><p style="font-size:14px;">Aún no has compartido ningún entrenamiento.<br>Completa sesiones en la pestaña PLAN y márcalas como realizadas.</p></div>`;
        }
      } catch (error) { console.warn(error); }

      container.innerHTML = html;
      console.timeEnd('cargarPerfil');

      if (!forceRefresh) {
        localStorage.setItem(cacheKey, JSON.stringify({ html, timestamp: Date.now() }));
      } else {
        localStorage.setItem(cacheKey, JSON.stringify({ html, timestamp: Date.now() }));
      }

      setTimeout(() => {
        document.querySelectorAll('.mis-entreno-header').forEach(header => {
          header.removeEventListener('click', Profile._toggleEntrenoDetail);
          header.addEventListener('click', Profile._toggleEntrenoDetail);
        });
        document.querySelectorAll('.like-btn-profile').forEach(btn => {
          btn.removeEventListener('click', Profile._showLikesModal);
          btn.addEventListener('click', Profile._showLikesModal);
        });
        
        document.querySelectorAll('.badge-icon').forEach(icon => {
          icon.removeEventListener('click', Profile._mostrarModalInsignias);
          icon.addEventListener('click', Profile._mostrarModalInsignias);
          icon.removeEventListener('touchstart', Profile._mostrarModalInsignias);
          icon.addEventListener('touchstart', Profile._mostrarModalInsignias);
        });

        // Abrir GPSTrackViewer al pulsar minimap en perfil
        document.querySelectorAll('.gps-minimap-tap-profile').forEach(el => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!window.GPSTrackViewer) {
              Utils.showToast('Cargando visor GPS...', 'info');
              return;
            }
            const entryId = el.dataset.entryId;
            const entry   = Profile._gpsEntries[entryId];
            if (entry) GPSTrackViewer.open(entry);
          });
        });
        
        const changeBtn = document.getElementById('changeShoeBtn');
        if (changeBtn) {
          changeBtn.onclick = () => {
            Profile._mostrarModalCambiarZapatilla();
          };
        }
        
        const historyBtn = document.getElementById('historyShoeBtn');
        if (historyBtn) {
          historyBtn.onclick = () => {
            Profile._mostrarModalHistorial();
          };
        }
      }, 0);

    } catch (error) {
      console.error('Error cargando perfil:', error);
      if (container && !htmlCache) container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar perfil</p>';
    }
  },

  _toggleEntrenoDetail(e) {
    e.stopPropagation();
    const wrapper = e.currentTarget.closest('.mis-entreno-wrapper');
    if (!wrapper) return;
    const detailDiv = wrapper.querySelector('.mis-entreno-detalle');
    const toggleIcon = e.currentTarget.querySelector('span:last-child');
    if (detailDiv) {
      const isVisible = detailDiv.style.display !== 'none';
      detailDiv.style.display = isVisible ? 'none' : 'flex';
      if (toggleIcon) toggleIcon.innerHTML = isVisible ? '▶' : '▼';
    }
  },

  async _showLikesModal(e) {
    e.stopPropagation();
    const entryId = e.currentTarget.getAttribute('data-entry-id');
    if (!entryId) return;
    try {
      if (typeof Wall !== 'undefined' && Wall.showLikesModal) {
        await Wall.showLikesModal(entryId);
      } else {
        const doc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
        if (!doc.exists) { Utils.showToast('La publicación ya no existe', 'error'); return; }
        const likes = doc.data().likes || [];
        if (likes.length === 0) { Utils.showToast('Nadie ha dado like a esta publicación aún', 'info'); return; }
        const usersData = [];
        for (const uid of likes) {
          const userData = await Storage.getUser(uid);
          usersData.push(userData ? { uid, ...userData } : { uid, username: 'Usuario desconocido', profile: {} });
        }
        this._createLikesModal(usersData);
      }
    } catch (error) { console.error(error); Utils.showToast('Error al cargar los likes', 'error'); }
  },

  _createLikesModal(users) {
    const existingModal = document.getElementById('likesModalProfile');
    const existingOverlay = document.getElementById('likesModalOverlayProfile');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'likesModalOverlayProfile';
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:2000; display:flex; align-items:center; justify-content:center;`;
    const modal = document.createElement('div');
    modal.id = 'likesModalProfile';
    modal.style.cssText = `background:var(--bg-primary); border-radius:24px; max-width:500px; width:90%; max-height:80vh; overflow-y:auto; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid var(--border-color);`;
    modal.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid var(--border-color);"><h3 style="margin:0; color:var(--accent-yellow);">❤️ Me gusta (${users.length})</h3><button id="closeLikesModalProfileBtn" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text-secondary);">&times;</button></div><div id="likesListProfile"></div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const listContainer = modal.querySelector('#likesListProfile');
    listContainer.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
    for (const user of users) {
      const photoURL = user.profile?.photoURL;
      const avatarHTML = photoURL ? `<img src="${Utils.escapeHTML(photoURL)}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">` : `<div style="width:48px; height:48px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px;">👤</div>`;
      const div = document.createElement('div');
      div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:8px; border-radius:16px; background:var(--bg-secondary); cursor:pointer;';
      div.innerHTML = `${avatarHTML}<div style="flex:1;"><div style="font-weight:bold; color:var(--accent-yellow);">${Utils.escapeHTML(Utils.capitalizeUsername(user.username))}</div><div style="font-size:12px; color:var(--text-secondary);">@${Utils.escapeHTML(user.username)}</div></div><button class="view-profile-btn-profile" data-uid="${user.uid}" style="background:var(--zone-2); border:none; padding:6px 12px; border-radius:20px; color:var(--bg-primary); cursor:pointer;">Ver perfil</button>`;
      div.addEventListener('click', (e) => { if (!e.target.classList.contains('view-profile-btn-profile')) { Friends?.abrirModalAmigo(user.uid); this._closeLikesModal(); } });
      div.querySelector('.view-profile-btn-profile')?.addEventListener('click', (e) => { e.stopPropagation(); Friends?.abrirModalAmigo(user.uid); this._closeLikesModal(); });
      listContainer.appendChild(div);
    }
    document.getElementById('closeLikesModalProfileBtn')?.addEventListener('click', () => this._closeLikesModal());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this._closeLikesModal(); });
  },

  _closeLikesModal() {
    document.getElementById('likesModalProfile')?.remove();
    document.getElementById('likesModalOverlayProfile')?.remove();
  },

  async _mostrarModalInsignias() {
    const gamificationData = await Gamification.getData(AppState.currentUserId);
    if (!gamificationData) return;
    
    const earnedBadges = gamificationData.badges || [];
    const allBadgesOrder = [
      'FIRST_SESSION', 'FIRST_WEEK', 'FIRST_MONTH',
      'SESSIONS_10', 'SESSIONS_50',
      'DISTANCE_100', 'DISTANCE_500', 'DISTANCE_1000',
      'LEVEL_5_KM', 'LEVEL_10_KM'
    ];
    
    const earned = [];
    const upcoming = [];
    for (const id of allBadgesOrder) {
      const badge = Gamification.BADGES[id];
      if (badge) {
        if (earnedBadges.includes(id)) {
          earned.push(badge);
        } else {
          upcoming.push(badge);
        }
      }
    }
    
    const existingModal = document.getElementById('badgesModal');
    const existingOverlay = document.getElementById('badgesModalOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'badgesModalOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
      z-index: 30000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'badgesModal';
    modal.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      max-width: 500px;
      width: 90%;
      max-height: 80%;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    let content = `<h3 style="margin: 0 0 16px 0; text-align: center; color: var(--accent-yellow);">🏅 INSIGNIAS</h3>`;
    
    content += `<div style="margin-bottom: 20px;">
      <div style="font-size: 14px; font-weight: bold; color: var(--accent-blue); margin-bottom: 12px;">✓ Conseguidas (${earned.length})</div>
      <div style="display: flex; flex-wrap: wrap; gap: 12px;">`;
    for (const badge of earned) {
      content += `
        <div style="flex: 1; min-width: 140px; background: var(--bg-secondary); border-radius: 16px; padding: 8px; text-align: center;">
          <div style="font-size: 32px;">${badge.icon}</div>
          <div style="font-weight: bold; font-size: 13px;">${badge.name}</div>
          <div style="font-size: 10px; color: var(--text-secondary);">${badge.description}</div>
        </div>
      `;
    }
    content += `</div></div>`;
    
    if (upcoming.length > 0) {
      content += `<div>
        <div style="font-size: 14px; font-weight: bold; color: var(--accent-blue); margin-bottom: 12px;">🔜 Próximas</div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">`;
      for (const badge of upcoming) {
        content += `
          <div style="flex: 1; min-width: 140px; background: var(--bg-secondary); border-radius: 16px; padding: 8px; text-align: center; opacity: 0.8;">
            <div style="font-size: 32px; filter: grayscale(0.3);">${badge.icon}</div>
            <div style="font-weight: bold; font-size: 13px;">${badge.name}</div>
            <div style="font-size: 10px; color: var(--text-secondary);">${badge.description}</div>
          </div>
        `;
      }
      content += `</div></div>`;
    } else {
      content += `<p style="text-align:center; color: var(--text-secondary);">¡Has conseguido todas las insignias! 🎉</p>`;
    }
    
    content += `<div style="display: flex; justify-content: center; margin-top: 24px;">
      <button id="closeBadgesModalBtn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CERRAR</button>
    </div>`;
    
    modal.innerHTML = content;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const closeBtn = document.getElementById('closeBadgesModalBtn');
    const closeModal = () => overlay.remove();
    if (closeBtn) closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  },

  _mostrarModalCambiarZapatilla() {
    const existingModal = document.getElementById('changeShoeModal');
    const existingOverlay = document.getElementById('changeShoeOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'changeShoeOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
      z-index: 30000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'changeShoeModal';
    modal.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      max-width: 400px;
      width: 90%;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      text-align: center;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--accent-yellow);">👟 CAMBIAR ZAPATILLA</h3>
      <div style="margin-bottom: 16px;">
        <label style="display: block; text-align: left; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Marca</label>
        <input type="text" id="newShoeBrand" placeholder="Ej. Nike" style="width: 100%; padding: 10px; border-radius: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);">
      </div>
      <div style="margin-bottom: 24px;">
        <label style="display: block; text-align: left; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Modelo</label>
        <input type="text" id="newShoeModel" placeholder="Ej. Pegasus 40" style="width: 100%; padding: 10px; border-radius: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);">
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="confirmChangeShoe" style="background: var(--accent-blue); border: none; color: var(--bg-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CAMBIAR</button>
        <button id="cancelChangeShoe" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CANCELAR</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const confirmBtn = document.getElementById('confirmChangeShoe');
    const cancelBtn = document.getElementById('cancelChangeShoe');
    const brandInput = document.getElementById('newShoeBrand');
    const modelInput = document.getElementById('newShoeModel');

    const closeModal = () => {
      overlay.remove();
    };

    confirmBtn.onclick = async () => {
      const brand = brandInput.value.trim();
      const model = modelInput.value.trim();
      if (!brand && !model) {
        Utils.showToast('Escribe al menos la marca o el modelo', 'warning');
        return;
      }
      const newName = `${brand} ${model}`.trim();
      if (newName) {
        await Gamification.setCurrentShoe(AppState.currentUserId, newName);
        await Profile.cargarPerfil();
        Utils.showToast('✅ Zapatilla actualizada', 'success');
        closeModal();
      }
    };

    cancelBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  },

  async _mostrarModalHistorial() {
    const history = await Gamification.getShoeHistory(AppState.currentUserId);
    if (!history || history.length === 0) {
      Utils.showToast('No hay historial de zapatillas aún', 'info');
      return;
    }

    const existingModal = document.getElementById('shoeHistoryModal');
    const existingOverlay = document.getElementById('shoeHistoryOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shoeHistoryOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
      z-index: 30000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'shoeHistoryModal';
    modal.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      max-width: 400px;
      width: 90%;
      max-height: 80%;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    let historyHtml = '<h3 style="margin: 0 0 16px 0; text-align: center; color: var(--accent-yellow);">📜 HISTORIAL DE ZAPATILLAS</h3><div style="display: flex; flex-direction: column; gap: 12px;">';
    [...history].reverse().forEach(entry => {
      const date = new Date(entry.changedAt).toLocaleDateString();
      historyHtml += `
        <div style="background: var(--bg-secondary); border-radius: 16px; padding: 12px; border: 1px solid var(--border-color);">
          <div style="font-weight: bold; color: var(--accent-blue);">${Utils.escapeHTML(entry.name)}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">📊 ${entry.km} km acumulados</div>
          <div style="font-size: 11px; color: var(--text-secondary);">🔄 Cambio: ${date}</div>
        </div>
      `;
    });
    historyHtml += '</div><div style="display: flex; justify-content: center; margin-top: 20px;"><button id="closeHistoryModalBtn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CERRAR</button></div>';
    modal.innerHTML = historyHtml;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('closeHistoryModalBtn');
    const closeModal = () => overlay.remove();
    if (closeBtn) closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  },

  abrirModal() {
    this.cargarDatosEnModal();
    this.cargarFotoActual();
    const overlay = document.getElementById('modalEditarPerfilOverlay');
    const modal = document.getElementById('modalEditarPerfil');
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'block';
    document.body.classList.add('modal-open');
  },

  cerrarModal() {
    const overlay = document.getElementById('modalEditarPerfilOverlay');
    const modal = document.getElementById('modalEditarPerfil');
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  },

  async cargarDatosEnModal() {
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(AppState.currentUserId).get();
      const profile = userDoc.data().profile || {};

      const bioInput = document.getElementById('editBio');
      const cityInput = document.getElementById('editCity');
      const ageInput = document.getElementById('editAge');
      const genderSelect = document.getElementById('editGender');
      const weightInput = document.getElementById('editWeight');
      const heightInput = document.getElementById('editHeight');

      if (bioInput) bioInput.value = profile.bio || '';
      if (cityInput) cityInput.value = profile.city || '';
      if (ageInput) ageInput.value = profile.age || '';
      if (genderSelect) genderSelect.value = profile.gender || '';
      if (weightInput) weightInput.value = profile.weight || '';
      if (heightInput) heightInput.value = profile.height || '';
    } catch (error) {
      console.error('Error cargando datos en modal:', error);
      Utils.showToast('Error al cargar datos del perfil', 'error');
    }
  },

  async cargarFotoActual() {
    const container = document.getElementById('currentPhotoPreview');
    if (!container) return;
    const uid = AppState.currentUserId;
    const url = await Storage.getProfilePictureURL(uid);
    if (url) {
      container.innerHTML = `<img src="${Utils.escapeHTML(url)}" style="width:100px; height:100px; border-radius:50%; object-fit:cover;">`;
    } else {
      container.innerHTML = `<div style="width:100px; height:100px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:40px;">👤</div>`;
    }
  },

  async seleccionarFoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      Utils.showLoading();
      try {
        const compressedFile = await this.compressImageToTarget(file, 1920, 5 * 1024 * 1024);
        const url = await Storage.uploadProfilePicture(AppState.currentUserId, compressedFile);
        if (url) {
          Utils.showToast('✅ Foto actualizada', 'success');
          this.cargarFotoActual();
          await Profile.cargarPerfil();
          if (window.Friends) Friends.cargarListaAmigos();
          if (window.Chat) Chat.updateUnreadBadge();
        }
      } catch (err) {
        console.error(err);
        Utils.showToast('Error al procesar la imagen', 'error');
      } finally {
        Utils.hideLoading();
      }
    };
    input.click();
  },

  async compressImageToTarget(file, maxDimension, maxSizeBytes) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          let resizedBlob = await this._resizeImage(img, maxDimension, 0.92);
          if (resizedBlob.size <= maxSizeBytes) {
            resolve(new File([resizedBlob], 'avatar.jpg', { type: 'image/jpeg' }));
            return;
          }
          let qualities = [0.85, 0.8, 0.75, 0.7];
          for (let q of qualities) {
            resizedBlob = await this._resizeImage(img, maxDimension, q);
            if (resizedBlob.size <= maxSizeBytes) {
              resolve(new File([resizedBlob], 'avatar.jpg', { type: 'image/jpeg' }));
              return;
            }
          }
          const finalBlob = await this._resizeImage(img, 1600, 0.7);
          resolve(new File([finalBlob], 'avatar.jpg', { type: 'image/jpeg' }));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  _resizeImage(img, maxDimension, quality) {
    return new Promise((resolve) => {
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  },

  async eliminarFoto() {
    const confirm = await Utils.confirm('Eliminar foto', '¿Eliminar tu foto de perfil?');
    if (!confirm) return;
    Utils.showLoading();
    const ok = await Storage.deleteProfilePicture(AppState.currentUserId);
    Utils.hideLoading();
    if (ok) {
      Utils.showToast('✅ Foto eliminada', 'success');
      this.cargarFotoActual();
      await Profile.cargarPerfil();
      if (window.Friends) Friends.cargarListaAmigos();
      if (window.Chat) Chat.updateUnreadBadge();
    } else {
      Utils.showToast('Error al eliminar foto', 'error');
    }
  },

  compressImage(file) {
    return this.compressImageToTarget(file, 1920, 5 * 1024 * 1024);
  },

  async guardarPerfil() {
    Utils.showLoading();

    try {
      const bio = document.getElementById('editBio')?.value.trim() || '';
      const city = document.getElementById('editCity')?.value.trim() || '';
      const age = parseInt(document.getElementById('editAge')?.value) || null;
      const gender = document.getElementById('editGender')?.value || '';
      const weight = parseFloat(document.getElementById('editWeight')?.value) || null;
      const height = parseFloat(document.getElementById('editHeight')?.value) || null;

      if (age !== null && (age < 14 || age > 85)) {
        Utils.showToast('La edad debe estar entre 14 y 85 años', 'error');
        Utils.hideLoading();
        return;
      }

      const updateData = {
        'profile.bio': bio,
        'profile.city': city,
        'profile.age': age,
        'profile.gender': gender,
        'profile.weight': weight,
        'profile.height': height
      };

      await firebaseServices.db.collection('users').doc(AppState.currentUserId).update(updateData);

      if (AppState.currentUserData) {
        AppState.currentUserData.profile = {
          ...(AppState.currentUserData.profile || {}),
          bio,
          city,
          age,
          gender,
          weight,
          height
        };
      }

      Utils.showToast('✅ Perfil actualizado', 'success');
      await this.cargarPerfil();
      this.cerrarModal();

    } catch (error) {
      console.error('Error guardando perfil:', error);
      Utils.showToast('Error al guardar perfil', 'error');
    } finally {
      Utils.hideLoading();
    }
  }
};

window.Profile = Profile;