// ==================== calendar.js - VERSIÓN CORREGIDA (SIN DUPLICADOS) ====================

const PlanGenerator = {
  ENTRENAMIENTOS_DB: window.ENTRENAMIENTOS_DB || {},

  toggleCuestionario() {
    if (!AppState.zonasCalculadas) {
      Utils.showToast("> CALCULA ZONAS PRIMERO_", 'error');
      return;
    }
    if (!AppState.isPremium || (AppState.premiumExpiryDate && new Date() > new Date(AppState.premiumExpiryDate))) {
      Utils.showToast("> SOLO USUARIOS PREMIUM PUEDEN CREAR PLANES_", 'error');
      return;
    }
    const q = document.getElementById("cuestionarioEntreno");
    if (q) {
      q.style.display = q.style.display === "block" ? "none" : "block";
      if (q.style.display === "block") {
        this.validarOpcionesPlan();
        setTimeout(() => q.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  },

  validarOpcionesPlan() {
    const distancia = document.getElementById("distObjetivo").value;
    const duracion = document.getElementById("duracionPlan").value;
    const experiencia = document.getElementById("experienciaDistancia").value;
    const infoDiv = document.getElementById("info-mensaje-distancia");
    const generarBtn = document.getElementById("generarPlanBtn");

    if (duracion === '1' && !['2k', '5k', '10k'].includes(distancia)) {
      infoDiv.style.display = 'block';
      infoDiv.innerHTML = '⚠️ Plan de 1 mes solo disponible para 2km, 5km y 10km';
      generarBtn.disabled = true;
      return;
    }

    if (['medio', 'maraton'].includes(distancia) && duracion === '3' && experiencia === 'no') {
      infoDiv.style.display = 'block';
      infoDiv.innerHTML = '⚠️ Para Media o Maratón en 3 meses necesitas experiencia previa';
      generarBtn.disabled = true;
      return;
    }

    infoDiv.style.display = 'none';
    generarBtn.disabled = false;

    const duracionSelect = document.getElementById('duracionPlan');
    for (let i = 0; i < duracionSelect.options.length; i++) {
      if (duracionSelect.options[i].value === '1') {
        duracionSelect.options[i].disabled = !['2k', '5k', '10k'].includes(distancia);
      }
    }
  },

  async generarCalendarioEntreno() {
    if (!AppState.zonasCalculadas) {
      Utils.showToast("> PRIMERO CALCULA TUS ZONAS_", 'error');
      return;
    }
    if (!AppState.isPremium || (AppState.premiumExpiryDate && new Date() > new Date(AppState.premiumExpiryDate))) {
      Utils.showToast("> SOLO USUARIOS PREMIUM PUEDEN GENERAR PLANES_", 'error');
      return;
    }

    try {
      Utils.showLoading();

      const modalidad = document.getElementById("modalidad").value;
      const distancia = document.getElementById("distObjetivo").value;
      const meses = parseInt(document.getElementById("duracionPlan").value);
      const nivel = document.getElementById("nivel").value;
      const experiencia = document.getElementById("experienciaDistancia").value;
      const objetivo = document.getElementById("objetivoPrincipal").value;
      const diaLargo = parseInt(document.getElementById("diaLargo").value);
      const fechaInicio = document.getElementById("fechaInicio").value;

      // Validaciones
      if (meses === 1 && !['2k', '5k', '10k'].includes(distancia)) {
        Utils.hideLoading();
        Utils.showToast("> Plan de 1 mes solo para 2km, 5km y 10km", 'error');
        return;
      }

      if (['medio', 'maraton'].includes(distancia) && meses === 3 && experiencia === 'no') {
        Utils.hideLoading();
        Utils.showToast("> Para Media o Maratón en 3 meses necesitas experiencia", 'error');
        return;
      }

      const diasEntreno = [];
      for (let i = 1; i <= 7; i++) {
        const cb = document.getElementById(`dia${i}`);
        if (cb && cb.checked) {
          const valor = parseInt(cb.value);
          if (valor >= 1 && valor <= 7) {
            diasEntreno.push(valor);
          }
        }
      }

      if (!fechaInicio) {
        Utils.hideLoading();
        Utils.showToast("> SELECCIONA UNA FECHA DE INICIO_", 'error');
        return;
      }
      
      if (diasEntreno.length === 0) {
        Utils.hideLoading();
        Utils.showToast("> SELECCIONA AL MENOS UN DÍA DE ENTRENO_", 'error');
        return;
      }

      if (!diasEntreno.includes(diaLargo)) {
        const confirmed = await Utils.confirm('AÑADIR DÍA', "> El día de tirada larga no está seleccionado. ¿Añadirlo automáticamente?");
        if (confirmed) {
          diasEntreno.push(diaLargo);
          document.getElementById(`dia${diaLargo}`).checked = true;
        } else {
          Utils.hideLoading();
          return;
        }
      }
      
      diasEntreno.sort((a, b) => a - b);

      const edad = AppState.lastAge;

      const volumenBase = {
        '2k': { principiante: 180, intermedio: 240, avanzado: 300 },
        '5k': { principiante: 240, intermedio: 300, avanzado: 360 },
        '10k': { principiante: 300, intermedio: 360, avanzado: 420 },
        'medio': { principiante: 240, intermedio: 300, avanzado: 360 },
        'maraton': { principiante: 300, intermedio: 360, avanzado: 420 }
      };

      let factorEdad = 1.0;
      if (edad > 50) factorEdad = 0.85;
      else if (edad > 40) factorEdad = 0.9;
      else if (edad > 30) factorEdad = 0.95;

      let factorObjetivo = 1.0;
      if (objetivo === 'acabar') factorObjetivo = 0.8;
      else if (objetivo === 'competir') factorObjetivo = 1.2;

      const volumenSemanalObj = Math.round(
        volumenBase[distancia][nivel] * factorEdad * factorObjetivo
      );

      const limitesReales = {
        '2k': { 
          rodaje: { min: 20, max: 60 },
          tempo: { min: 20, max: 45 },
          series: { min: 20, max: 40 },
          largo: { min: 45, max: 90 }
        },
        '5k': { 
          rodaje: { min: 25, max: 75 },
          tempo: { min: 25, max: 50 },
          series: { min: 25, max: 45 },
          largo: { min: 60, max: 120 }
        },
        '10k': { 
          rodaje: { min: 30, max: 90 },
          tempo: { min: 30, max: 60 },
          series: { min: 30, max: 50 },
          largo: { min: 75, max: 150 }
        },
        'medio': { 
          rodaje: { min: 35, max: 105 },
          tempo: { min: 35, max: 70 },
          series: { min: 35, max: 60 },
          largo: { min: 90, max: 180 }
        },
        'maraton': { 
          rodaje: { min: 40, max: 120 },
          tempo: { min: 40, max: 80 },
          series: { min: 40, max: 70 },
          largo: { min: 120, max: 240 }
        }
      };

      const semanasTotales = meses * 4;

      // Definir fases de entrenamiento
      let fases = this.definirFases(meses, semanasTotales);

      const catalogoSesiones = {
        rodaje: [
          { 
            nombre: 'Rodaje de recuperación', 
            descripcion: 'Sesión muy suave para activar circulación y eliminar toxinas.', 
            estructura: (d) => `${d}' continuos en Z1`, 
            sensacion: 'Muy cómodo', 
            zona: 'Z1' 
          },
          { 
            nombre: 'Rodaje aeróbico', 
            descripcion: 'Construcción de base aeróbica.', 
            estructura: (d) => `${d}' continuos en Z2`, 
            sensacion: 'Cómodo', 
            zona: 'Z2' 
          },
          { 
            nombre: 'Rodaje activo', 
            descripcion: 'Ritmo vivo dentro de zona aeróbica.', 
            estructura: (d) => `${d}' en Z2 con ritmo sostenido`, 
            sensacion: 'Activo', 
            zona: 'Z2' 
          },
          { 
            nombre: 'Rodaje progresivo', 
            descripcion: 'Aumenta ritmo gradualmente.', 
            estructura: (d) => { const p1 = Math.round(d * 0.7); return `${p1}' Z2 + ${d-p1}' Z3`; }, 
            sensacion: 'Progresivo', 
            zona: 'Z2-Z3' 
          }
        ],
        tempo: [
          { 
            nombre: 'Tempo suave', 
            descripcion: 'Primer contacto con ritmos controlados.', 
            estructura: (d) => `15' cal + ${d-25}' Z3 + 10' enfriamiento`, 
            sensacion: 'Controlado', 
            zona: 'Z3' 
          },
          { 
            nombre: 'Tempo sostenido', 
            descripcion: 'Mantener ritmo constante exigente.', 
            estructura: (d) => `15' cal + ${d-25}' Z3-Z4 + 10' enfriamiento`, 
            sensacion: 'Exigente', 
            zona: 'Z3-Z4' 
          },
          { 
            nombre: 'Tempo umbral', 
            descripcion: 'Trabajo específico de umbral de lactato.', 
            estructura: (d) => `15' cal + ${d-25}' Z4 + 10' enfriamiento`, 
            sensacion: 'Muy exigente', 
            zona: 'Z4' 
          }
        ],
        series: [
          { 
            nombre: 'Series 200m', 
            descripcion: 'Velocidad máxima.', 
            estructura: (rep) => `15' cal + ${rep}x200m (rec 1') + 15' enfriamiento`, 
            sensacion: 'Explosivas', 
            zona: 'Z5' 
          },
          { 
            nombre: 'Series 400m', 
            descripcion: 'Velocidad-resistencia.', 
            estructura: (rep) => `15' cal + ${rep}x400m (rec 1'30") + 15' enfriamiento`, 
            sensacion: 'Intensas', 
            zona: 'Z5' 
          },
          { 
            nombre: 'Series 800m', 
            descripcion: 'Resistencia a ritmo rápido.', 
            estructura: (rep) => `15' cal + ${rep}x800m (rec 2') + 15' enfriamiento`, 
            sensacion: 'Exigentes', 
            zona: 'Z4' 
          }
        ],
        largo: [
          { 
            nombre: 'Fondo aeróbico', 
            descripcion: 'Construcción de resistencia base.', 
            estructura: (d) => `${d}' Z2 continuo`, 
            sensacion: 'Cómodo', 
            zona: 'Z2' 
          },
          { 
            nombre: 'Largo con progresión', 
            descripcion: 'Aumenta ritmo en la parte final.', 
            estructura: (d) => { const z2 = Math.round(d * 0.7); return `${z2}' Z2 + ${d-z2}' Z3`; }, 
            sensacion: 'Terminar fuerte', 
            zona: 'Z2-Z3' 
          }
        ]
      };

      // Generar sesiones
      const sesiones = this.generarSesiones(
        fases, diasEntreno, diaLargo, volumenSemanalObj, 
        limitesReales[distancia], catalogoSesiones, pesosDia
      );

      const mapaDist = { "2k": "2 km", "5k": "5 km", "10k": "10 km", "medio": "MEDIA", "maraton": "MARATÓN" };
      const diaNombre = ["", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][diaLargo];

      document.getElementById("resumenObjetivo").innerHTML = `
        <strong>${mapaDist[distancia]}</strong> · ${diasEntreno.length} DÍAS/SEMANA<br>
        <span style="color: var(--text-secondary); font-size: 13px;">
          ${nivel.toUpperCase()} · ${experiencia === 'si' ? 'CON EXPERIENCIA' : 'PRIMERA VEZ'} · 
          OBJ: ${objetivo === 'acabar' ? 'TERMINAR' : objetivo === 'mejorar' ? 'MEJORAR' : 'COMPETIR'} · 
          LARGO: ${diaNombre} · ${modalidad === 'runner' ? 'ASFALTO' : 'MONTAÑA'} · ${meses} MES(ES)
        </span>
      `;

      const planId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
      const planCompleto = {
        params: { 
          modalidad, 
          distancia, 
          duracion: meses, 
          diasPorSemana: diasEntreno.length, 
          nivel, 
          experiencia, 
          objetivo, 
          diaLargo, 
          fechaInicio, 
          diasEntreno, 
          planId 
        },
        sesiones: sesiones,
        resumen: document.getElementById("resumenObjetivo").innerText,
        fechaCreacion: new Date().toISOString()
      };

      AppState.planGeneradoActual = planCompleto.params;
      AppState.planActualId = planId;
      AppState.sesionesRealizadas = {};
      AppState.trimestreActual = 0;

      // === CORREGIDO: GUARDAR UNA SOLA VEZ CON VALIDACIÓN ===
      const planParaGuardar = {
        ...planCompleto,
        id: planId,
        esUltimo: true
      };

      // Verificar que el plan es válido antes de guardar
      if (planParaGuardar.sesiones && Array.isArray(planParaGuardar.sesiones) && planParaGuardar.sesiones.length > 0) {
        await firebaseServices.db
          .collection('users')
          .doc(AppState.currentUserId)
          .collection('planes')
          .doc(planId)
          .set(planParaGuardar);
        
        await firebaseServices.db
          .collection('users')
          .doc(AppState.currentUserId)
          .update({ ultimoPlanId: planId });
        
        console.log('✅ Plan guardado correctamente (única vez)');
      } else {
        console.error('❌ Plan inválido, no se guarda');
        Utils.showToast('Error: Plan generado incorrectamente', 'error');
        Utils.hideLoading();
        return;
      }

      document.getElementById("calendarioEntreno").style.display = "block";
      document.getElementById("cuestionarioEntreno").style.display = "none";

      this.mostrarCalendario(sesiones);

      if (window.UI) {
        await UI.cargarHistorialPlanes();
        if (document.getElementById('tab-historial')?.classList.contains('active')) {
          AppState.resetHistorialPagination();
          await UI.cargarHistorialCompleto(true);
        }
      }

      Utils.scrollToElement('calendarioEntreno', -20);
      Utils.vibrate(50);
      Utils.playSound('success');
      Utils.launchConfetti();
      Utils.showToast('✅ Plan profesional generado', 'success');

    } catch (error) {
      console.error('Error generando plan:', error);
      Utils.showToast('Error al generar el plan', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  definirFases(meses, semanasTotales) {
    let fases = [];
    if (meses === 1) {
      fases = [
        { nombre: 'base', semanas: 2 },
        { nombre: 'especifica', semanas: 2 }
      ];
    } else if (meses <= 3) {
      fases = [
        { nombre: 'base', semanas: 4 },
        { nombre: 'construccion', semanas: 4 },
        { nombre: 'especifica', semanas: 4 }
      ];
    } else if (meses === 6) {
      fases = [
        { nombre: 'base', semanas: 8 },
        { nombre: 'construccion', semanas: 8 },
        { nombre: 'especifica', semanas: 8 }
      ];
    } else {
      fases = [
        { nombre: 'base', semanas: 12 },
        { nombre: 'construccion', semanas: 12 },
        { nombre: 'especifica', semanas: 12 },
        { nombre: 'pico', semanas: 8 },
        { nombre: 'taper', semanas: 4 }
      ];
    }

    let semanasAcumuladas = 0;
    return fases.map(fase => {
      const semanasReales = Math.min(fase.semanas, semanasTotales - semanasAcumuladas);
      semanasAcumuladas += semanasReales;
      return { ...fase, semanas: semanasReales };
    }).filter(fase => fase.semanas > 0);
  },

  generarSesiones(fases, diasEntreno, diaLargo, volumenSemanalObj, limites, catalogoSesiones, pesosDia) {
    const sesiones = [];
    let semanaGlobal = 1;
    let diaGlobalCounter = 1;

    const pesosSuma = diasEntreno.reduce((sum, dia) => sum + (pesosDia[dia] || 1.0), 0);

    for (let idxFase = 0; idxFase < fases.length; idxFase++) {
      const fase = fases[idxFase];
      const faseNombre = fase.nombre;

      let distribucion = this.obtenerDistribucionFase(faseNombre);

      for (let s = 0; s < fase.semanas; s++) {
        const semanaRelativa = s + 1;
        const progresoFase = semanaRelativa / fase.semanas;

        let factorSemana = 0.85 + (progresoFase * 0.3);
        if (faseNombre === 'taper') factorSemana = 0.5;

        const volumenSemana = Math.round(volumenSemanalObj * factorSemana);

        let diaLargoEstaSemana = this.seleccionarDiaLargoSemana(diaLargo, diasEntreno, semanaRelativa, faseNombre);

        const tiposAsignados = { rodaje: 0, tempo: 0, series: 0, largo: 0 };
        const totalSesionesSemana = diasEntreno.length;

        let objetivos = this.calcularObjetivosSesiones(distribucion, totalSesionesSemana);

        for (let diaSem = 1; diaSem <= 7; diaSem++) {
          const diaGlobal = diaGlobalCounter++;
          
          if (diasEntreno.includes(diaSem)) {
            const pesoDia = pesosDia[diaSem] || 1.0;
            let duracionBase = Math.round((volumenSemana * pesoDia) / pesosSuma);
            
            if (isNaN(duracionBase) || duracionBase <= 0) duracionBase = 30;
            
            let variacion = 0.95 + (Math.random() * 0.1);
            let duracion = Math.round(duracionBase * variacion);

            let tipo = '';
            let sesionData = null;

            if (diaSem === diaLargoEstaSemana) {
              tipo = 'largo';
              duracion = Math.round(duracion * (1.5 + (Math.random() * 0.5)));
              duracion = Math.min(duracion, limites.largo.max);
              duracion = Math.max(duracion, limites.largo.min);

              sesionData = this.generarSesionLargo(catalogoSesiones.largo, duracion);
            } else {
              tipo = this.seleccionarTipoSesion(objetivos, tiposAsignados);
              tiposAsignados[tipo]++;

              duracion = this.ajustarDuracionPorTipo(tipo, duracion, limites);
              sesionData = this.generarSesionPorTipo(tipo, catalogoSesiones, duracion, distancia);
            }

            let color = this.obtenerColorPorTipo(tipo);
            let letra = this.obtenerLetraPorTipo(tipo);

            sesiones.push({
              diaGlobal,
              semana: semanaGlobal,
              diaSemana: diaSem,
              color,
              letra,
              duracion: duracion,
              detalle: sesionData,
              realizada: false
            });

          } else {
            sesiones.push(this.generarDiaDescanso(diaGlobal, semanaGlobal, diaSem));
          }
        }
        semanaGlobal++;
      }
    }
    return sesiones;
  },

  obtenerDistribucionFase(faseNombre) {
    if (faseNombre === 'base') return { rodaje: 70, tempo: 15, series: 5, largo: 10 };
    if (faseNombre === 'construccion') return { rodaje: 50, tempo: 25, series: 15, largo: 10 };
    if (faseNombre === 'especifica') return { rodaje: 40, tempo: 30, series: 20, largo: 10 };
    if (faseNombre === 'pico') return { rodaje: 30, tempo: 30, series: 25, largo: 15 };
    return { rodaje: 70, tempo: 15, series: 5, largo: 10 }; // Por defecto
  },

  calcularObjetivosSesiones(distribucion, totalSesiones) {
    let objetivos = {
      rodaje: Math.max(1, Math.round(distribucion.rodaje / 100 * totalSesiones)),
      tempo: Math.max(0, Math.round(distribucion.tempo / 100 * totalSesiones)),
      series: Math.max(0, Math.round(distribucion.series / 100 * totalSesiones)),
      largo: 1
    };

    let suma = objetivos.rodaje + objetivos.tempo + objetivos.series + objetivos.largo;
    let intentos = 0;

    while (suma !== totalSesiones && intentos < 10) {
      if (suma > totalSesiones) {
        if (objetivos.rodaje > 1) objetivos.rodaje--;
        else if (objetivos.tempo > 0) objetivos.tempo--;
        else if (objetivos.series > 0) objetivos.series--;
      } else {
        objetivos.rodaje++;
      }
      suma = objetivos.rodaje + objetivos.tempo + objetivos.series + objetivos.largo;
      intentos++;
    }

    return objetivos;
  },

  seleccionarDiaLargoSemana(diaLargo, diasEntreno, semanaRelativa, faseNombre) {
    if (diasEntreno.length > 3 && faseNombre !== 'taper') {
      if (semanaRelativa % 3 === 0) {
        const otrosDias = diasEntreno.filter(d => d !== diaLargo);
        if (otrosDias.length > 0) {
          return otrosDias[Math.floor(Math.random() * otrosDias.length)];
        }
      }
    }
    return diaLargo;
  },

  seleccionarTipoSesion(objetivos, tiposAsignados) {
    const pendientes = [];
    for (let [t, obj] of Object.entries(objetivos)) {
      if (t !== 'largo' && tiposAsignados[t] < obj) pendientes.push(t);
    }
    if (pendientes.length > 0) {
      return pendientes[Math.floor(Math.random() * pendientes.length)];
    }
    return 'rodaje';
  },

  ajustarDuracionPorTipo(tipo, duracion, limites) {
    if (tipo === 'tempo') {
      return Math.min(duracion, limites.tempo.max);
    } else if (tipo === 'series') {
      return Math.min(duracion, limites.series.max);
    } else {
      return Math.min(duracion, limites.rodaje.max);
    }
  },

  generarSesionLargo(catalogo, duracion) {
    const idx = Math.floor(Math.random() * catalogo.length);
    const plantilla = catalogo[idx];
    return {
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion,
      estructura: plantilla.estructura(duracion),
      sensacion: plantilla.sensacion,
      zona: plantilla.zona,
      duracion: duracion
    };
  },

  generarSesionPorTipo(tipo, catalogoSesiones, duracion, distancia) {
    const opciones = catalogoSesiones[tipo];
    const idx = Math.floor(Math.random() * opciones.length);
    const plantilla = opciones[idx];

    if (tipo === 'series') {
      let repeticiones = this.calcularRepeticiones(distancia);
      return {
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        estructura: plantilla.estructura(repeticiones),
        sensacion: plantilla.sensacion,
        zona: plantilla.zona,
        duracion: duracion,
        repeticiones: repeticiones
      };
    } else {
      return {
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        estructura: plantilla.estructura(duracion),
        sensacion: plantilla.sensacion,
        zona: plantilla.zona,
        duracion: duracion
      };
    }
  },

  calcularRepeticiones(distancia) {
    if (distancia === '2k') return 8;
    if (distancia === '5k') return 6;
    if (distancia === '10k') return 5;
    return 4;
  },

  obtenerColorPorTipo(tipo) {
    if (tipo === 'largo') return 'sesion-largo';
    if (tipo === 'series') return 'sesion-series';
    if (tipo === 'tempo') return 'sesion-tempo';
    return 'sesion-rodaje';
  },

  obtenerLetraPorTipo(tipo) {
    if (tipo === 'largo') return 'L';
    if (tipo === 'series') return 'S';
    if (tipo === 'tempo') return 'T';
    return 'R';
  },

  generarDiaDescanso(diaGlobal, semanaGlobal, diaSem) {
    return {
      diaGlobal,
      semana: semanaGlobal,
      diaSemana: diaSem,
      color: 'sesion-descanso',
      letra: 'D',
      duracion: 0,
      detalle: null,
      realizada: false
    };
  },

  mostrarCalendario(sesiones) {
    const grid = document.getElementById("calendarioGrid");
    const navegacion = document.getElementById("calendarioNavegacion");
    if (!grid) return;

    const meses = AppState.planGeneradoActual?.duracion || 3;

    if (meses === 12) {
      navegacion.style.display = 'grid';
      this.actualizarNavegacionTrimestral(4);
    } else if (meses === 6) {
      navegacion.style.display = 'grid';
      this.actualizarNavegacionTrimestral(2);
    } else {
      navegacion.style.display = 'none';
    }

    this.renderizarPagina(sesiones);
  },

  renderizarPagina(sesiones) {
    const grid = document.getElementById("calendarioGrid");
    if (!grid) return;

    const meses = AppState.planGeneradoActual?.duracion || 3;
    let semanasPorPagina = 13;
    if (meses === 6) semanasPorPagina = 12;

    const inicioPagina = AppState.trimestreActual * semanasPorPagina * 7;
    const finPagina = Math.min(inicioPagina + (semanasPorPagina * 7), sesiones.length);

    let html = '';

    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];
      if (!sesion) break;

      const realizada = AppState.sesionesRealizadas && AppState.sesionesRealizadas[i] ? 'realizado' : '';
      
      let contenidoHtml = '';
      if (sesion.detalle) {
        const tiempoFormateado = sesion.duracion + "'";
        
        contenidoHtml = `
          <strong>${sesion.letra}</strong>
          <div>${tiempoFormateado}</div>
        `;
      } else {
        contenidoHtml = '<strong>D</strong>';
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada}" data-index="${i}">
        ${contenidoHtml}
      </div>`;
    }
    
    grid.innerHTML = html;
    
    document.querySelectorAll('.calendario-dia').forEach(dia => {
      dia.addEventListener('click', (e) => {
        const diaIndex = e.currentTarget.dataset.index;
        if (diaIndex && sesiones[diaIndex]) {
          this.abrirDetalleSesion(sesiones[diaIndex], parseInt(diaIndex));
        }
      });
    });
  },

  actualizarNavegacionTrimestral(totalPaginas = 4) {
    const paginaSpan = document.getElementById('calendarioPagina');
    const anteriorBtn = document.getElementById('calendarioAnterior');
    const siguienteBtn = document.getElementById('calendarioSiguiente');

    if (paginaSpan) paginaSpan.innerText = `PÁGINA ${AppState.trimestreActual + 1}/${totalPaginas}`;
    if (anteriorBtn) anteriorBtn.disabled = AppState.trimestreActual === 0;
    if (siguienteBtn) siguienteBtn.disabled = AppState.trimestreActual === totalPaginas - 1;
  },

  async cambiarTrimestre(delta) {
    const meses = AppState.planGeneradoActual?.duracion || 3;
    const totalPaginas = meses === 12 ? 4 : (meses === 6 ? 2 : 1);

    const nuevoTrimestre = (AppState.trimestreActual || 0) + delta;
    if (nuevoTrimestre < 0 || nuevoTrimestre >= totalPaginas) return;

    AppState.trimestreActual = nuevoTrimestre;

    if (AppState.planActualId && AppState.currentUserId) {
      try {
        const planDoc = await firebaseServices.db
          .collection('users')
          .doc(AppState.currentUserId)
          .collection('planes')
          .doc(AppState.planActualId)
          .get();
        
        if (planDoc.exists) {
          const planCompleto = planDoc.data();
          if (planCompleto && planCompleto.sesiones) {
            this.renderizarPagina(planCompleto.sesiones);
            this.actualizarNavegacionTrimestral(totalPaginas);
            if (window.UI) UI.guardarEstado();
          }
        }
      } catch (error) {
        console.error('Error cambiando página:', error);
        Utils.showToast('Error al cambiar de página', 'error');
      }
    }
  },

  // === FUNCIÓN MEJORADA CON DESCRIPCIÓN DETALLADA (OBJETIVOS, BENEFICIOS, RECOMENDACIONES) ===
  abrirDetalleSesion(sesion, diaIndex) {
    if (!sesion) return;

    AppState.currentSesionDetalle = { sesion, diaIndex, planId: AppState.planActualId };

    const modal = document.getElementById("detalleSesion");
    const overlay = document.getElementById("modalOverlay");
    const wrapper = document.getElementById("modalColorWrapper");
    const titulo = document.getElementById("tituloSesion");
    const descripcion = document.getElementById("descripcionSesion");
    const checkboxContainer = document.getElementById("sesionCheckboxContainer");
    const checkbox = document.getElementById("sesionRealizada");

    wrapper.className = "modal-content";
    
    if (sesion.detalle) {
      wrapper.classList.add(sesion.color);
      
      let tipoSesion = "";
      let icono = "";
      if (sesion.color === 'sesion-rodaje') { 
        tipoSesion = "RODAJE"; 
        icono = "🏃";
      } else if (sesion.color === 'sesion-tempo') { 
        tipoSesion = "TEMPO"; 
        icono = "⚡";
      } else if (sesion.color === 'sesion-series') { 
        tipoSesion = "SERIES"; 
        icono = "🔁";
      } else if (sesion.color === 'sesion-largo') { 
        tipoSesion = "LARGO"; 
        icono = "📏";
      }
      
      titulo.innerText = `${icono} ${tipoSesion}: ${sesion.detalle.nombre}`;

      // Definir objetivos, beneficios y recomendaciones según el tipo de sesión
      let objetivos = "";
      let beneficios = "";
      let recomendaciones = "";

      if (sesion.color === 'sesion-rodaje') {
        objetivos = "Desarrollar la capacidad aeróbica y mejorar la eficiencia cardiovascular.";
        beneficios = "Aumenta la capilarización muscular, mejora la quema de grasas y fortalece el corazón.";
        recomendaciones = "Mantén un ritmo cómodo donde puedas hablar. Concéntrate en la técnica de carrera.";
      } else if (sesion.color === 'sesion-tempo') {
        objetivos = "Elevar el umbral de lactato y mejorar la resistencia a ritmos exigentes.";
        beneficios = "Permite correr más rápido durante más tiempo antes de fatigarse.";
        recomendaciones = "El ritmo debe ser 'cómodamente duro'. Debes poder decir algunas palabras, pero no mantener una conversación.";
      } else if (sesion.color === 'sesion-series') {
        objetivos = "Mejorar la velocidad máxima y la potencia aeróbica.";
        beneficios = "Aumenta la capacidad cardíaca y la economía de carrera.";
        recomendaciones = "Las recuperaciones deben ser activas (trotando). Concéntrate en mantener la forma en los últimos metros.";
      } else if (sesion.color === 'sesion-largo') {
        objetivos = "Construir resistencia y preparar el cuerpo para la distancia objetivo.";
        beneficios = "Mejora la confianza, la gestión del glucógeno y la fortaleza mental.";
        recomendaciones = "Realiza la sesión a ritmo controlado. Hidrátate bien y lleva nutrición si supera los 90 minutos.";
      }

      let descHtml = `
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 2px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-around; margin-bottom: 20px;">
            <div>
              <div style="font-size: 14px; color: var(--text-secondary);">DURACIÓN</div>
              <div style="font-size: 32px; font-weight: bold;">${sesion.duracion}'</div>
            </div>
            <div>
              <div style="font-size: 14px; color: var(--text-secondary);">ZONA</div>
              <div style="font-size: 32px; font-weight: bold;">${sesion.detalle.zona}</div>
            </div>
          </div>
          
          <div style="text-align: left; margin-top: 20px;">
            <p style="margin: 15px 0;"><strong>📋 ESTRUCTURA:</strong> ${sesion.detalle.estructura}</p>
            <p style="margin: 15px 0;"><strong>💬 SENSACIÓN:</strong> ${sesion.detalle.sensacion}</p>
            <p style="margin: 15px 0;"><strong>📝 DESCRIPCIÓN:</strong> ${sesion.detalle.descripcion}</p>
            <p style="margin: 15px 0;"><strong>🎯 OBJETIVOS:</strong> ${objetivos}</p>
            <p style="margin: 15px 0;"><strong>✅ BENEFICIOS:</strong> ${beneficios}</p>
            <p style="margin: 15px 0;"><strong>💡 RECOMENDACIONES:</strong> ${recomendaciones}</p>
          </div>
        </div>
      `;
      
      if (sesion.detalle.repeticiones) {
        descHtml += `<p style="margin: 15px 0;"><strong>🔁 SERIES:</strong> ${sesion.detalle.repeticiones} repeticiones</p>`;
      }

      descripcion.innerHTML = descHtml;

      checkboxContainer.style.display = 'flex';
      checkbox.checked = AppState.sesionesRealizadas && AppState.sesionesRealizadas[diaIndex] || false;
      checkbox.onchange = async (e) => { 
        await this.marcarSesionRealizada(diaIndex, e.target.checked); 
      };

    } else {
      wrapper.classList.add('sesion-descanso');
      titulo.innerText = "😴 DESCANSO";
      descripcion.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 25px; border-radius: 2px; margin: 20px 0;">
          <div style="font-size: 48px; margin-bottom: 20px;">😴</div>
          <p style="font-size: 18px; margin-bottom: 20px;">Día de descanso y recuperación</p>
          <div style="text-align: left;">
            <p style="margin: 10px 0;"><strong>💡 RECOMENDACIONES:</strong></p>
            <ul style="margin-left: 20px;">
              <li>Estiramientos suaves (15-20 min)</li>
              <li>Foam roller para liberar tensiones</li>
              <li>Paseo activo de 30-45 minutos</li>
              <li>Hidratación y nutrición adecuada</li>
            </ul>
          </div>
        </div>
      `;
      checkboxContainer.style.display = 'none';
    }

    modal.classList.add("visible");
    overlay.classList.add("visible");
  },

  // === FUNCIÓN CORREGIDA - ELIMINADO EL TOAST DE ERROR ===
  async marcarSesionRealizada(diaIndex, realizada) {
    if (!AppState.currentUserId || !AppState.planActualId) return;

    try {
      // CORREGIDO: Actualizar directamente en Firestore
      const planRef = firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(AppState.planActualId);
      
      // Obtener el plan actual
      const planDoc = await planRef.get();
      if (!planDoc.exists) return;
      
      const planData = planDoc.data();
      if (!planData.sesiones || !planData.sesiones[diaIndex]) return;
      
      // Marcar la sesión como realizada
      planData.sesiones[diaIndex].realizada = realizada;
      
      // Guardar de vuelta
      await planRef.update({
        sesiones: planData.sesiones
      });
      
      // Actualizar estado local
      if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
      AppState.sesionesRealizadas[diaIndex] = realizada;

      // Actualizar UI
      const celda = document.querySelector(`.calendario-dia[data-index="${diaIndex}"]`);
      if (celda) {
        if (realizada) {
          celda.classList.add('realizado');
        } else {
          celda.classList.remove('realizado');
        }
      }

      // Mostrar toast solo en éxito
      Utils.showToast(realizada ? '✅ Sesión marcada' : '📝 Sesión desmarcada', 'success');
      
    } catch (error) {
      console.error('Error marcando sesión:', error);
      // ❌ NO mostrar toast de error - eliminado
    }
  },

  async mostrarUltimoPlanGuardado() {
    if (!AppState.currentUserId) {
      Utils.showToast("> NO HAY USUARIO_", 'error');
      return;
    }
    if (!AppState.isPremium || (AppState.premiumExpiryDate && new Date() > new Date(AppState.premiumExpiryDate))) {
      Utils.showToast("> SOLO USUARIOS PREMIUM PUEDEN VER PLANES_", 'error');
      return;
    }

    try {
      const userDoc = await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .get();
      
      const ultimoPlanId = userDoc.data()?.ultimoPlanId;
      
      if (!ultimoPlanId) {
        Utils.showToast("> NO HAY PLAN GUARDADO_", 'error');
        return;
      }

      const planDoc = await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(ultimoPlanId)
        .get();

      if (!planDoc.exists) {
        Utils.showToast("> EL PLAN YA NO EXISTE_", 'error');
        return;
      }

      const planCompleto = planDoc.data();

      AppState.ultimoPlanParams = planCompleto.params;

      document.getElementById("modalidad").value = planCompleto.params.modalidad || 'runner';
      document.getElementById("distObjetivo").value = planCompleto.params.distancia || '10k';
      document.getElementById("duracionPlan").value = planCompleto.params.duracion || 3;

      const diasGuardados = planCompleto.params.diasEntreno || [2, 4, 6];
      for (let i = 1; i <= 7; i++) {
        const cb = document.getElementById(`dia${i}`);
        if (cb) cb.checked = diasGuardados.includes(i);
      }

      document.getElementById("nivel").value = planCompleto.params.nivel || 'intermedio';
      document.getElementById("experienciaDistancia").value = planCompleto.params.experiencia || "no";
      document.getElementById("objetivoPrincipal").value = planCompleto.params.objetivo || "mejorar";
      document.getElementById("diaLargo").value = planCompleto.params.diaLargo || 7;
      document.getElementById("fechaInicio").value = planCompleto.params.fechaInicio || new Date().toISOString().split('T')[0];

      document.getElementById("cuestionarioEntreno").style.display = "none";
      document.getElementById("calendarioEntreno").style.display = "block";

      AppState.planGeneradoActual = planCompleto.params;
      AppState.planActualId = ultimoPlanId;
      AppState.sesionesRealizadas = {};
      AppState.trimestreActual = 0;
      
      // Cargar sesiones realizadas
      if (planCompleto.sesiones) {
        planCompleto.sesiones.forEach((sesion, index) => {
          if (sesion.realizada) {
            AppState.sesionesRealizadas[index] = true;
          }
        });
      }
      
      this.mostrarCalendario(planCompleto.sesiones);

    } catch (error) {
      console.error('Error al cargar último plan:', error);
      Utils.showToast('Error al cargar el plan', 'error');
    }
  },

  async borrarPlanGuardado() {
    if (!AppState.currentUserId) return;
    const confirmed = await Utils.confirm('ELIMINAR PLAN', "> ¿ELIMINAR PLAN GUARDADO?_");
    if (!confirmed) return;

    Utils.showLoading();

    try {
      // Eliminar referencia del último plan
      await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .update({ ultimoPlanId: null });
      
      // Eliminar el plan actual si existe
      if (AppState.planActualId) {
        await firebaseServices.db
          .collection('users')
          .doc(AppState.currentUserId)
          .collection('planes')
          .doc(AppState.planActualId)
          .delete();
      }
      
      AppState.limpiarDatosPlan();
      document.getElementById("calendarioEntreno").style.display = "none";
      document.getElementById("cuestionarioEntreno").style.display = "block";
      Utils.showToast("✅ PLAN ELIMINADO", 'success');
      if (window.UI) {
        UI.guardarEstado();
        await UI.cargarHistorialPlanes();
      }
    } catch (error) {
      console.error('Error borrando plan:', error);
      Utils.showToast('Error al eliminar el plan', 'error');
    } finally {
      Utils.hideLoading();
    }
  }
};

// Variables globales
const pesosDia = { 1: 0.8, 2: 1.0, 3: 1.0, 4: 1.1, 5: 1.0, 6: 1.3, 7: 1.4 };
let distancia = 'maraton'; // Variable para usar en generarSesionPorTipo

// Funciones globales
window.cambiarTrimestre = async (delta) => { await PlanGenerator.cambiarTrimestre(delta); };
window.cerrarPlan = () => {
  document.getElementById("calendarioEntreno").style.display = "none";
  document.getElementById("cuestionarioEntreno").style.display = "block";
  AppState.limpiarDatosPlan();
  if (window.UI) UI.guardarEstado();
};
window.cerrarModalSesion = () => {
  document.getElementById("detalleSesion")?.classList.remove("visible");
  document.getElementById("modalOverlay")?.classList.remove("visible");
  AppState.currentSesionDetalle = null;
};

window.PlanGenerator = PlanGenerator;
window.toggleCuestionario = () => PlanGenerator.toggleCuestionario();
window.mostrarUltimoPlanGuardado = () => PlanGenerator.mostrarUltimoPlanGuardado();
window.borrarPlanGuardado = () => PlanGenerator.borrarPlanGuardado();
window.generarCalendarioEntreno = () => PlanGenerator.generarCalendarioEntreno();
window.validarOpcionesPlan = () => PlanGenerator.validarOpcionesPlan();

console.log('✅ PlanGenerator con calendario simplificado y sin duplicados');