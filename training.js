// ==================== training.js - Módulo de Entrenamiento CORREGIDO ====================
// Versión: 4.1 - Añadido cálculo de zonas con Karvonen (FC reposo opcional)
// ====================

const Training = {
  // === NUEVAS FUNCIONES PARA PERSISTENCIA LOCAL ===
  _saveToLocalStorage(calc) {
    if (!calc) return;
    try {
      localStorage.setItem('ri5_last_calculation', JSON.stringify(calc));
      console.log('✅ Cálculo guardado en localStorage');
    } catch (e) {
      console.warn('Error guardando cálculo en localStorage:', e);
    }
  },

  _loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem('ri5_last_calculation');
      if (!raw) return null;
      const calc = JSON.parse(raw);
      // Validar que tenga las propiedades esenciales
      if (calc && calc.zones && calc.pred && calc.ritmoBase) {
        console.log('✅ Cálculo cargado desde localStorage');
        return calc;
      }
      return null;
    } catch (e) {
      console.warn('Error cargando cálculo desde localStorage:', e);
      return null;
    }
  },

  _clearLocalStorage() {
    localStorage.removeItem('ri5_last_calculation');
    console.log('🗑️ Cálculo eliminado de localStorage');
  },
  // === FIN NUEVAS FUNCIONES ===

  async startCalc() { 
    UI.validarTodo(); 
    if(document.getElementById("calcBtn").disabled) return; 
    
    if(!await AppState.incrementarCalculo()) return;
    
    const n = AppState.currentUser;
    const a = parseInt(document.getElementById("age").value);
    const t = Utils.parseTime(document.getElementById("time").value);
    
    if(!n || !a || isNaN(t)) { Utils.showToast("> COMPLETA TODOS LOS CAMPOS CORRECTAMENTE_", 'error'); return; }
    
    // --- CÁLCULO DE FC MÁXIMA Y UMBRAL CON FALLBACK (KARVONEN) ---
    const fc = 220 - a; // FC máxima estimada (220 - edad)

    // Obtener FC en reposo (opcional)
    const fcReposoInput = document.getElementById('fcReposo');
    const fcReposo = fcReposoInput ? parseInt(fcReposoInput.value) : null;

    let ul; // Umbral de lactato (FC a la que se produce el umbral)
    let metodoUsado = '';

    if (fcReposo && fcReposo >= 30 && fcReposo <= 100) {
      // Usar fórmula de Karvonen: umbral = reposo + (FCmáx - reposo) * 0.88
      const fcReserva = fc - fcReposo;
      ul = Math.round(fcReposo + fcReserva * 0.88);
      metodoUsado = 'Karvonen';
      console.log(`✅ Usando Karvonen: FC reposo=${fcReposo}, FC reserva=${fcReserva}, Umbral=${ul}`);
    } else {
      // Fallback al método antiguo (92% de FC máxima)
      ul = Math.round(fc * 0.92);
      metodoUsado = 'estándar (220-edad)';
      if (fcReposoInput && fcReposoInput.value) {
        console.log(`ℹ️ FC reposo no válida (${fcReposoInput.value}), usando método estándar.`);
      } else {
        console.log('ℹ️ Usando método estándar (sin FC reposo).');
      }
    }
    // --- FIN CÁLCULO ---

    const r = t / 6; // Ritmo base en min/km para 6km
    
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
        "<p><strong>🔹 PROPÓSITO:</strong> Recuperación activa. Ideal después de sesiones intensas.</p>" +
        "<p><strong>✅ BENEFICIOS:</strong> Mejora circulación, elimina toxinas, acelera recuperación.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Muy cómodo. Conversación completa sin esfuerzo.</p>"
      ],
      ["Z2", "BASE", 0.80, 0.90, 1.25, "z2",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 1.25) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Construir la base aeróbica. Es la zona más importante.</p>" +
        "<p><strong>✅ BENEFICIOS:</strong> Quema grasas, fortalece corazón, mejora capilarización.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Cómodo y controlado. Puedes mantener una conversación.</p>"
      ],
      ["Z3", "TEMPO", 0.90, 0.95, 1.15, "z3",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 1.15) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Mejorar la eficiencia y el umbral aeróbico.</p>" +
        "<p><strong>✅ BENEFICIOS:</strong> Eleva umbral de lactato, mejora economía de carrera.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> 'Cómodamente duro'. Solo puedes decir frases cortas.</p>"
      ],
      ["Z4", "UMBRAL", 0.95, 1.02, 1.05, "z4",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 1.05) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Aumentar la capacidad de eliminar lactato.</p>" +
        "<p><strong>✅ BENEFICIOS:</strong> Mejora la capacidad de mantener ritmos exigentes durante más tiempo.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Fuerte y controlado. Hablar es incómodo.</p>"
      ],
      ["Z5", "VO₂MÁX", 1.02, 1.06, 0.95, "z5",
        "<p><strong>🎯 Ritmo:</strong> " + Utils.formatR(r * 0.95) + " min/km</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Estimular la potencia aeróbica máxima.</p>" +
        "<p><strong>✅ BENEFICIOS:</strong> Aumenta la capacidad cardíaca y el VO₂máx.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Muy intenso. Apenas puedes hablar.</p>"
      ],
      ["Z6", "VELOCIDAD", 1.06, 1.12, 0.85, "z6",
        "<p><strong>🎯 Ritmo:</strong> < " + Utils.formatR(r * 0.85) + " min/km (más rápido)</p>" +
        "<p><strong>🔹 PROPÓSITO:</strong> Desarrollar potencia neuromuscular y velocidad.</p>" +
        "<p><strong>✅ BENEFICIOS:</strong> Mejora la zancada, coordinación y potencia explosiva.</p>" +
        "<p><strong>😌 SENSACIÓN:</strong> Esfuerzo máximo. Solo sprints cortos.</p>" +
        "<p><strong>⚠️ NOTA:</strong> Esta zona supera el umbral. No debe mantenerse más de 1-2 minutos.</p>"
      ]
    ];
    
    const calc = { name: n, age: a, fcMax: fc, ul: ul, zones: zones, pred: pred, ritmoBase: r };
    AppState.setLastCalc(calc); 
    this.mostrarResultados(calc); 
    // El footer se ha eliminado (ya no se usa)
    // document.getElementById("footer").innerText = `${n} · ${new Date().toLocaleDateString('es-ES')} · RI5`;
    await this.guardarCalculoAutomatico(calc);
    
    // === GUARDAR EN LOCALSTORAGE ===
    this._saveToLocalStorage(calc);
    
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
      Utils.showToast('Sin conexión. El cálculo se guardará localmente', 'warning');
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
    
    d.pred.forEach(p => {
      html += `<div class="pred-bar" style="border-color:${p.color}; color:${p.color};">${p.dist} km → ${Utils.formatR(p.ritmo)} min/km</div>`;
    });
    
    // Separación visual
    html += `<div style="margin-bottom: 35px;"></div>`;
    
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
    navigator.clipboard.writeText(txt).then(() => { Utils.showToast("✅ RESULTADOS COPIADOS AL PORTAPAPELES", 'success'); }).catch(() => Utils.showToast("> NO SE PUDO COPIAR.", 'error'));
  },
  
  async shareResults() {
    if(!AppState.lastName) { Utils.showToast("> CALCULA ZONAS PRIMERO_", 'error'); return; }
    Utils.vibrate(30);
    try {
      const blob = await this._generarTarjetaImagen();
      const fileName = `ri5-zonas-${AppState.lastName.replace(/\s+/g, '_').toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Mis zonas de entrenamiento RI5',
          text: `Mis zonas de entrenamiento RI5 🏃`
        });
      } else if (navigator.share) {
        // Algunos navegadores tienen share() pero no soportan archivos:
        // se descarga la imagen y se comparte el texto como respaldo.
        this._descargarImagen(blob, fileName);
        Utils.showToast("✅ IMAGEN DESCARGADA", 'success');
      } else {
        this._descargarImagen(blob, fileName);
        Utils.showToast("✅ IMAGEN DESCARGADA", 'success');
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // el usuario canceló el share, no es un error
      console.error('Error generando/compartiendo la tarjeta:', e);
      Utils.showToast("> NO SE PUDO GENERAR LA IMAGEN_", 'error');
    }
  },

  _descargarImagen(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  // Dibuja una tarjeta con el mismo estilo visual de la app (fondo oscuro,
  // dorado, colores de zona) en vez de compartir un bloque de texto plano.
  _generarTarjetaImagen() {
    return new Promise((resolve, reject) => {
      try {
        const W = 1080, H = 1550;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        const GOLD = '#c0a060';
        const BG = '#0f0f0f';
        const BG_CARD = '#1a1a1a';
        const BORDER = '#333333';
        const TEXT = '#ffffff';
        const TEXT_SEC = '#b0b0b0';
        const zoneColors = ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6'];

        // Fondo con un ligero degradado, como el resto de la app
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#141414');
        bgGrad.addColorStop(1, BG);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        let y = 90;

        // Cabecera
        ctx.textAlign = 'center';
        ctx.fillStyle = GOLD;
        ctx.font = '700 64px Arial';
        ctx.fillText('RI5', W / 2, y);
        y += 44;
        ctx.fillStyle = TEXT_SEC;
        ctx.font = '400 26px Arial';
        ctx.fillText('ZONAS DE ENTRENAMIENTO', W / 2, y);
        y += 60;

        ctx.strokeStyle = BORDER;
        ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(W - 80, y); ctx.stroke();
        y += 70;

        // Nombre / edad
        ctx.fillStyle = TEXT;
        ctx.font = '600 44px Arial';
        ctx.fillText(`${AppState.lastName} · ${AppState.lastAge} años`, W / 2, y);
        y += 70;

        // Fila de estadísticas (FC MÁX / UMBRAL / RITMO 6K)
        const stats = [
          { label: 'FC MÁX', value: `${AppState.lastFC}`, unit: 'lpm' },
          { label: 'UMBRAL', value: `${AppState.lastUL}`, unit: 'lpm' },
          { label: 'RITMO 6K', value: Utils.formatR(AppState.lastRitmoBase), unit: 'min/km' }
        ];
        const statW = (W - 160) / 3;
        stats.forEach((s, i) => {
          const cx = 80 + statW * i + statW / 2;
          ctx.fillStyle = BG_CARD;
          this._roundRect(ctx, 80 + statW * i + 10, y, statW - 20, 130, 16);
          ctx.fill();
          ctx.strokeStyle = BORDER;
          ctx.lineWidth = 1.5;
          this._roundRect(ctx, 80 + statW * i + 10, y, statW - 20, 130, 16);
          ctx.stroke();

          ctx.fillStyle = GOLD;
          ctx.font = '700 40px Arial';
          ctx.fillText(s.value, cx, y + 55);
          ctx.fillStyle = TEXT_SEC;
          ctx.font = '400 20px Arial';
          ctx.fillText(s.unit, cx, y + 82);
          ctx.font = '400 18px Arial';
          ctx.fillStyle = TEXT_SEC;
          ctx.fillText(s.label, cx, y + 112);
        });
        y += 175;

        // Predicciones
        ctx.textAlign = 'center';
        ctx.fillStyle = TEXT;
        ctx.font = '600 32px Arial';
        ctx.fillText('PREDICCIONES', W / 2, y);
        y += 45;
        const predColors = { 2: '#3498db', 6: '#2ecc71', 10: '#f1c40f', 21: '#e74c3c', 42: '#9b59b6' };
        AppState.lastPred.forEach(p => {
          const color = predColors[p.dist] || GOLD;
          ctx.fillStyle = BG_CARD;
          this._roundRect(ctx, 80, y, W - 160, 64, 12);
          ctx.fill();
          ctx.fillStyle = color;
          this._roundRect(ctx, 80, y, 8, 64, 4);
          ctx.fill();
          ctx.fillStyle = TEXT;
          ctx.font = '500 28px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(`${p.dist} km`, 115, y + 40);
          ctx.textAlign = 'right';
          ctx.fillStyle = color;
          ctx.font = '600 28px Arial';
          ctx.fillText(`${Utils.formatR(p.ritmo)} min/km`, W - 100, y + 40);
          y += 76;
        });
        y += 20;

        // Zonas
        ctx.textAlign = 'center';
        ctx.fillStyle = TEXT;
        ctx.font = '600 32px Arial';
        ctx.fillText('ZONAS', W / 2, y);
        y += 45;
        AppState.lastZones.forEach((z, index) => {
          const color = zoneColors[index];
          let rango;
          if (index === 5) {
            const min = Math.round(AppState.lastUL * z[2]);
            rango = `>${min} lpm`;
          } else {
            const min = Math.round(AppState.lastUL * z[2]), max = Math.round(AppState.lastUL * z[3]);
            rango = `${min}-${max} lpm`;
          }
          ctx.fillStyle = BG_CARD;
          this._roundRect(ctx, 80, y, W - 160, 54, 10);
          ctx.fill();
          ctx.fillStyle = color;
          this._roundRect(ctx, 80, y, 6, 54, 3);
          ctx.fill();
          ctx.fillStyle = TEXT;
          ctx.font = '600 24px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(`${z[0]} · ${z[1]}`, 110, y + 34);
          ctx.fillStyle = TEXT_SEC;
          ctx.font = '400 22px Arial';
          ctx.textAlign = 'right';
          ctx.fillText(rango, W - 100, y + 34);
          y += 64;
        });

        // Pie
        ctx.textAlign = 'center';
        ctx.fillStyle = TEXT_SEC;
        ctx.font = '400 20px Arial';
        ctx.fillText('RI5 · Running Intelligence', W / 2, H - 40);

        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('No se pudo generar la imagen'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

window.Training = Training;
window.startCalc = Training.startCalc.bind(Training);
window.copyResults = Training.copyResults.bind(Training);
window.shareResults = Training.shareResults.bind(Training);
