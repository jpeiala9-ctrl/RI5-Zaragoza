// ==================== training.js - Módulo de Entrenamiento ====================
// Versión: 4.1 - Mejoras en pestaña ENTRENO (último cálculo, resumen semanal, último entreno)
// ====================

const Training = {
  async startCalc() { 
    UI.validarTodo(); 
    if(document.getElementById("calcBtn").disabled) return; 
    
    if(!await AppState.incrementarCalculo()) return;
    
    const n = AppState.currentUser;
    const a = parseInt(document.getElementById("age").value);
    const t = Utils.parseTime(document.getElementById("time").value);
    
    if(!n || !a || isNaN(t)) { Utils.showToast("> COMPLETA TODOS LOS CAMPOS CORRECTAMENTE_", 'error'); return; }
    
    const r = t / 6;
    const fc = 220 - a;
    const ul = Math.round(fc * 0.92);
    
    const pred = [
      {dist: 2, color: "var(--accent-blue)", ritmo: r * 0.98},
      {dist: 6, color: "var(--accent-green)", ritmo: r},
      {dist: 10, color: "var(--accent-yellow)", ritmo: r * 1.05},
      {dist: 21, color: "var(--accent-red)", ritmo: r * 1.12},
      {dist: 42, color: "var(--accent-purple)", ritmo: r * 1.20}
    ];
    
    const zones = [
      ["Z1", "RECUPERACIÓN", 0.75, 0.80, 1.35, "z1",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 1.35) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Recuperación activa.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Muy cómodo.</p>"
      ],
      ["Z2", "BASE", 0.80, 0.90, 1.25, "z2",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 1.25) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Construir base aeróbica.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Cómodo.</p>"
      ],
      ["Z3", "TEMPO", 0.90, 0.95, 1.15, "z3",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 1.15) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Mejorar eficiencia.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Cómodamente duro.</p>"
      ],
      ["Z4", "UMBRAL", 0.95, 1.02, 1.05, "z4",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 1.05) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Aumentar capacidad de eliminar lactato.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Fuerte.</p>"
      ],
      ["Z5", "VO₂MÁX", 1.02, 1.06, 0.95, "z5",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 0.95) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Estimular potencia aeróbica.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Muy intenso.</p>"
      ],
      ["Z6", "VELOCIDAD", 1.06, 1.12, 0.85, "z6",
        "<p><strong>🎯 Ritmo:</strong> < " + Utils.formatR(r * 0.85) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Potencia neuromuscular.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Esfuerzo máximo.</p>"
      ]
    ];
    
    const calc = { name: n, age: a, fcMax: fc, ul: ul, zones: zones, pred: pred, ritmoBase: r };
    AppState.setLastCalc(calc); 
    this.mostrarResultados(calc); 
    document.getElementById("footer").innerText = `${n} · ${new Date().toLocaleDateString('es-ES')} · RI5`;
    await this.guardarCalculoAutomatico(calc);
    this.guardarUltimoCalculo(calc);
    Utils.showToast("✓ CALCULADO", 'success'); 
    Utils.vibrate(50);
    Utils.playSound('success');
    Utils.launchConfetti();
    Utils.scrollToElement('results', -20);
    AppState.actualizarBotonCalcular();
  },
  
  async guardarCalculoAutomatico(calc) {
    if(!AppState.currentUserId) return;
    if (!navigator.onLine) {
      const pendientes = JSON.parse(localStorage.getItem('ri5_calculos_pendientes') || '[]');
      pendientes.push(calc);
      localStorage.setItem('ri5_calculos_pendientes', JSON.stringify(pendientes));
      return;
    }
    const ahora = new Date();
    let zonasResumen = calc.zones.map(z => { 
      if (z[0] === "Z6") {
        const min = Math.round(calc.ul * z[2]);
        return {zona: z[0], min, max: "MÁX"}; 
      } else {
        const min = Math.round(calc.ul * z[2]), max = Math.round(calc.ul * z[3]); 
        return {zona: z[0], min, max}; 
      }
    });
    const data = { 
      date: ahora.toLocaleDateString('es-ES'), 
      hora: ahora.toLocaleTimeString('es-ES'), 
      nombre: calc.name, 
      edad: calc.age, 
      fcMax: calc.fcMax, 
      umbral: calc.ul, 
      ritmo6k: Utils.formatR(calc.ritmoBase), 
      predicciones: calc.pred.map(p => `${p.dist}km:${Utils.formatR(p.ritmo)}`).join(' '), 
      resumen: `${calc.name} · ${calc.age} años · 6km: ${Utils.formatR(calc.ritmoBase)}`, 
      zonasResumen: zonasResumen 
    };
    await Storage.addHistorialEntry(AppState.currentUserId, data);
    await Storage.setUltimoCalculo(AppState.currentUserId, calc);
    if(document.getElementById('tab-historial')?.classList.contains('active')) {
      AppState.resetHistorialPagination();
      await UI.cargarHistorialCompleto(true);
    }
    await Storage.procesarCalculosPendientes();
  },
  
  mostrarResultados(d) { 
    const results = document.getElementById("results");
    if (!results) return;
    const nombreEscapado = Utils.escapeHTML(d.name);
    let html = `<h2>MÉTRICAS</h2><div style="text-align:center; margin:20px 0;">${nombreEscapado} · ${d.age} años<br>FC MÁX: ${d.fcMax} lpm · UMBRAL: ${d.ul} lpm<br>RITMO 6km: ${Utils.formatR(d.ritmoBase)} min/km</div><h2>PREDICCIONES</h2>`; 
    d.pred.forEach(p => html += `<div class="pred-bar" style="border-color:${p.color}; color:${p.color};">${p.dist} km → ${Utils.formatR(p.ritmo)} min/km</div>`); 
    html += `<h2>ZONAS</h2>`; 
    const colores = ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6'];
    d.zones.forEach((z, index) => { 
      const estiloBase = 'font-size:14px;';
      if (index === 5) {
        const min = Math.round(d.ul * z[2]);
        html += `<div class="zone-card" style="border-left: 4px solid ${colores[index]};" onclick="this.classList.toggle('active')">
          <strong>${z[0]} – ${z[1]}</strong><br>
          FC: >${min} lpm (máximo)
          <div class="long">${z[6].replace(/<p>/g, `<p style="margin:12px 0;">`).replace(/<strong>/g, `<strong style="${estiloBase}">`)}</div>
        </div>`;
      } else {
        const min = Math.round(d.ul * z[2]), max = Math.round(d.ul * z[3]); 
        html += `<div class="zone-card" style="border-left: 4px solid ${colores[index]};" onclick="this.classList.toggle('active')">
          <strong>${z[0]} – ${z[1]}</strong><br>
          FC: ${min}-${max} lpm
          <div class="long">${z[6].replace(/<p>/g, `<p style="margin:12px 0;">`).replace(/<strong>/g, `<strong style="${estiloBase}">`)}</div>
        </div>`;
      }
    }); 
    html += `<button class="action-button btn-copy" onclick="window.copyResults()">📋 COPIAR</button>`;
    html += `<button class="action-button btn-share" onclick="window.shareResults()">📱 COMPARTIR</button>`;
    results.innerHTML = html; 
  },
  
  mostrarResultadosGuardados(d) { this.mostrarResultados(d); },
  
  copyResults() {
    if(!AppState.lastName) { Utils.showToast("> CALCULA ZONAS PRIMERO_", 'error'); return; }
    let txt = "🔹 RI5 - ZONAS DE ENTRENO 🔹\n\n";
    txt += `👤 ${AppState.lastName} · ${AppState.lastAge} años\n`;
    txt += `❤️ FC MÁX: ${AppState.lastFC} lpm · UMBRAL: ${AppState.lastUL} lpm\n`;
    txt += `⏱️ RITMO 6km: ${Utils.formatR(AppState.lastRitmoBase)} min/km\n\n`;
    txt += `📊 PREDICCIONES:\n`;
    AppState.lastPred.forEach(p => txt += `   ${p.dist} km → ${Utils.formatR(p.ritmo)} min/km\n`);
    txt += `\n🎯 ZONAS:\n`;
    AppState.lastZones.forEach((z, index) => { 
      if (index === 5) {
        const min = Math.round(AppState.lastUL * z[2]);
        txt += `   ${z[0]} ${z[1]}: >${min} lpm · Ritmo: < ${Utils.formatR(AppState.lastRitmoBase * z[4])} min/km\n`;
      } else {
        const min = Math.round(AppState.lastUL * z[2]), max = Math.round(AppState.lastUL * z[3]); 
        txt += `   ${z[0]} ${z[1]}: ${min}-${max} lpm · Ritmo: ${Utils.formatR(AppState.lastRitmoBase * z[4])} min/km\n`;
      }
    });
    navigator.clipboard.writeText(txt).then(() => { Utils.showToast("✅ RESULTADOS COPIADOS", 'success'); }).catch(() => Utils.showToast("> NO SE PUDO COPIAR.", 'error'));
  },
  
  shareResults() {
    if(!AppState.lastName) { Utils.showToast("> CALCULA ZONAS PRIMERO_", 'error'); return; }
    let txt = "🏃‍♂️ MIS ZONAS DE ENTRENAMIENTO RI5 🏃‍♀️\n\n";
    txt += `👤 ${AppState.lastName} · ${AppState.lastAge} años\n`;
    txt += `❤️ FC MÁX: ${AppState.lastFC} lpm · UMBRAL: ${AppState.lastUL} lpm\n`;
    txt += `⏱️ RITMO 6km: ${Utils.formatR(AppState.lastRitmoBase)} min/km\n\n`;
    txt += `📊 PREDICCIONES:\n`;
    AppState.lastPred.forEach(p => txt += `   ${p.dist} km → ${Utils.formatR(p.ritmo)} min/km\n`);
    if (navigator.share) {
      navigator.share({ title: 'Mis zonas de entrenamiento RI5', text: txt, url: window.location.href }).catch(() => { navigator.clipboard.writeText(txt).then(() => { Utils.showToast("✅ RESULTADOS COPIADOS", 'success'); }); });
    } else {
      navigator.clipboard.writeText(txt).then(() => { Utils.showToast("✅ RESULTADOS COPIADOS", 'success'); });
    }
    Utils.vibrate(30);
  },
  
  // ========== NUEVAS FUNCIONES PARA LA PESTAÑA ENTRENO ==========
  guardarUltimoCalculo(calculo) {
    if (!calculo) return;
    const dataToStore = {
      ...calculo,
      fecha: new Date().toISOString(),
      zones: calculo.zones,
      pred: calculo.pred,
      fcMax: calculo.fcMax,
      ul: calculo.ul,
      ritmoBase: calculo.ritmoBase
    };
    localStorage.setItem('ri5_last_zones', JSON.stringify(dataToStore));
    AppState.setLastCalc(dataToStore);
    if (document.getElementById('tab-entreno')?.classList.contains('active')) {
      this.mostrarUltimoCalculoEnUI();
    }
  },

  mostrarUltimoCalculoEnUI() {
    const container = document.getElementById('ultimoCalculoContainer');
    if (!container) return;
    
    const guardado = localStorage.getItem('ri5_last_zones');
    if (!guardado) {
      container.innerHTML = '<p style="text-align:center; color: var(--text-secondary); margin-top: 20px;">👉 Calcula tus zonas para ver los resultados aquí</p>';
      return;
    }
    
    let calculo;
    try {
      calculo = JSON.parse(guardado);
    } catch(e) { return; }
    
    const fecha = new Date(calculo.fecha).toLocaleDateString();
    const zonasHtml = this.renderZonasPastillas(calculo.zones);
    
    container.innerHTML = `
      <div style="background: var(--bg-secondary); border-radius: 16px; padding: 16px; margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <strong style="color: var(--accent-blue);">📊 ÚLTIMO CÁLCULO (${fecha})</strong>
          <button onclick="document.getElementById('calcBtn').click()" style="background: transparent; border: 1px solid var(--border-color); border-radius: 20px; padding: 4px 12px; font-size: 12px; cursor: pointer;">🔄 Recalcular</button>
        </div>
        <div style="display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap;">
          <div><span style="color: var(--text-secondary);">❤️ FC Máx:</span> <strong>${calculo.fcMax} lpm</strong></div>
          <div><span style="color: var(--text-secondary);">⚡ Umbral:</span> <strong>${calculo.ul} lpm</strong></div>
          <div><span style="color: var(--text-secondary);">🏃 Ritmo base:</span> <strong>${Utils.formatR(calculo.ritmoBase)} /km</strong></div>
        </div>
        <div style="margin-top: 8px;">
          <div style="font-weight: 500; margin-bottom: 8px;">🎯 ZONAS</div>
          ${zonasHtml}
        </div>
      </div>
    `;
  },
  
  renderZonasPastillas(zonas) {
    if (!zonas || !zonas.length) return '';
    let html = '<div class="zonas-pastillas" style="justify-content: flex-start;">';
    zonas.forEach(z => {
      let zonaNombre = z[0];
      let ritmo = z[4];
      let ritmoFormateado = ritmo ? Utils.formatR(ritmo) : '--:--';
      html += `<span class="zona-pastilla ${zonaNombre.toLowerCase()}" title="${zonaNombre}: ritmo ${ritmoFormateado}">
        <span></span> ${zonaNombre}: ${ritmoFormateado}
      </span>`;
    });
    html += '</div>';
    return html;
  },
  
  async cargarResumenSemanal() {
    const container = document.getElementById('resumenSemanalContainer');
    if (!container || !AppState.currentUserId) return;
    
    try {
      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);
      const timestamp7Dias = firebaseServices.Timestamp.fromDate(hace7Dias);
      
      const snapshot = await firebaseServices.db
        .collection('globalFeed')
        .where('userId', '==', AppState.currentUserId)
        .where('timestamp', '>=', timestamp7Dias)
        .get();
      
      let totalKm = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        totalKm += data.distancia || 0;
      });
      
      const objetivoSemanal = 30;
      const porcentaje = Math.min(100, Math.round((totalKm / objetivoSemanal) * 100));
      
      container.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 16px; padding: 16px; margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: var(--accent-blue);">📈 RESUMEN SEMANAL</strong>
            <span>${totalKm.toFixed(1)} km / ${objetivoSemanal} km</span>
          </div>
          <div style="background: var(--bg-primary); border-radius: 10px; height: 10px; overflow: hidden;">
            <div style="width: ${porcentaje}%; background: var(--accent-blue); height: 10px;"></div>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">${porcentaje === 100 ? '🎉 ¡Objetivo semanal alcanzado!' : `Te quedan ${(objetivoSemanal - totalKm).toFixed(1)} km para el objetivo`}</p>
        </div>
      `;
    } catch (error) {
      console.error('Error cargando resumen semanal:', error);
      container.innerHTML = '';
    }
  },
  
  async cargarUltimoEntreno() {
    const container = document.getElementById('ultimoEntrenoContainer');
    if (!container || !AppState.currentUserId) return;
    
    try {
      const snapshot = await firebaseServices.db
        .collection('globalFeed')
        .where('userId', '==', AppState.currentUserId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; margin-top:20px; color: var(--text-secondary);">🏁 Aún no has registrado entrenamientos</p>';
        return;
      }
      
      const entreno = snapshot.docs[0].data();
      const fecha = entreno.timestamp ? new Date(entreno.timestamp.toDate()).toLocaleDateString() : '';
      const tipoTexto = {
        rodaje: '🏃‍♂️ Rodaje',
        tempo: '⚡ Tempo',
        series: '🔁 Series',
        largo: '📏 Largo',
        strength: '🏋️ Fuerza'
      }[entreno.trainingType] || entreno.trainingType;
      
      const distancia = entreno.distancia ? entreno.distancia.toFixed(2) : '0';
      const duracion = entreno.duration || 0;
      
      container.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 16px; padding: 16px; margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: var(--accent-blue);">🏁 ÚLTIMO ENTRENAMIENTO</strong>
            <button onclick="window.switchTab('muro')" style="background: transparent; border: 1px solid var(--border-color); border-radius: 20px; padding: 4px 12px; font-size: 12px; cursor: pointer;">Ver muro →</button>
          </div>
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <div><span style="color: var(--text-secondary);">📅 Fecha:</span> ${fecha}</div>
            <div><span style="color: var(--text-secondary);">🏃 Tipo:</span> ${tipoTexto}</div>
            <div><span style="color: var(--text-secondary);">📏 Distancia:</span> ${distancia} km</div>
            <div><span style="color: var(--text-secondary);">⏱️ Duración:</span> ${duracion} min</div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error cargando último entreno:', error);
      container.innerHTML = '';
    }
  }
};

// ==================== FUNCIONES GLOBALES ====================
window.startCalc = Training.startCalc.bind(Training);
window.copyResults = Training.copyResults.bind(Training);
window.shareResults = Training.shareResults.bind(Training);