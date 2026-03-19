// ============================================================================
// calendar.js - VERSIÓN CIENTÍFICA PROFESIONAL
// Duración mínima 50 min | Sin fecha inicio | Sin letras en calendario
// ============================================================================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},

  FASES: {
    BASE: { 
      nombre: 'BASE AERÓBICA', 
      color: '#3498db', 
      desc: 'Desarrollo de capacidad aeróbica y eficiencia metabólica',
      objetivo: '↑ Capilarización, ↑ Mitocondrias, ↑ Economía de carrera',
      duracion: '4-6 semanas'
    },
    CONSTRUCCION: { 
      nombre: 'CONSTRUCCIÓN', 
      color: '#2ecc71', 
      desc: 'Mejora del umbral y tolerancia al lactato',
      objetivo: '↑ Umbral anaeróbico, ↑ Resistencia muscular',
      duracion: '3-4 semanas' 
    },
    ESPECIFICA: { 
      nombre: 'ESPECÍFICA', 
      color: '#f39c12', 
      desc: 'Preparación específica para la distancia objetivo',
      objetivo: '↑ Potencia aeróbica, ↑ Ritmo específico',
      duracion: '3-4 semanas'
    },
    PICO: { 
      nombre: 'PICO DE FORMA', 
      color: '#e74c3c', 
      desc: 'Máxima estimulación con recuperación controlada',
      objetivo: '↑ VO2máx, ↑ Potencia neuromuscular',
      duracion: '2-3 semanas'
    },
    TAPER: { 
      nombre: 'TAPER', 
      color: '#9b59b6', 
      desc: 'Supercompensación y descarga para el día de la competición',
      objetivo: 'Recuperación total, ↑ Reservas de glucógeno',
      duracion: '1-2 semanas'
    }
  },

  ZONAS_ENTRENO: {
    Z1: { nombre: 'RECUPERACIÓN ACTIVA', fc: '60-70%', percepcion: 'Muy suave', beneficio: 'Eliminación de metabolitos' },
    Z2: { nombre: 'AERÓBICO', fc: '70-80%', percepcion: 'Cómodo, hablable', beneficio: '↑ Capilarización, ↑ Mitocondrias' },
    Z3: { nombre: 'TEMPO', fc: '80-85%', percepcion: 'Cómodamente duro', beneficio: '↑ Umbral aeróbico' },
    Z4: { nombre: 'UMBRAL', fc: '85-92%', percepcion: 'Fuerte, controlado', beneficio: '↑ Tolerancia al lactato' },
    Z5: { nombre: 'VO2MÁX', fc: '92-98%', percepcion: 'Muy intenso', beneficio: '↑ Potencia aeróbica máxima' },
    Z6: { nombre: 'VELOCIDAD', fc: '>98%', percepcion: 'Máximo esfuerzo', beneficio: '↑ Potencia neuromuscular' }
  },

  // ==========================================================================
  // GENERACIÓN PRINCIPAL (SIN FECHA DE INICIO)
  // ==========================================================================
  async generarCalendarioEntreno() {
    if (!AppState.zonasCalculadas) {
      Utils.showToast("> PRIMERO CALCULA TUS ZONAS_", 'error');
      return;
    }
    if (!AppState.isPremium) {
      Utils.showToast("> SOLO USUARIOS PREMIUM_", 'error');
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

      // ===== DÍAS DE ENTRENO =====
      const diasEntreno = this.obtenerDiasSeleccionados();
      
      if (nivel === 'avanzado' && diasEntreno.length < 5) {
        Utils.showToast("> NIVEL AVANZADO REQUIERE MÍNIMO 5 DÍAS DE ENTRENO_", 'error');
        Utils.hideLoading();
        return;
      }
      
      if (diasEntreno.length === 0) {
        Utils.showToast("> SELECCIONA AL MENOS UN DÍA_", 'error');
        Utils.hideLoading();
        return;
      }

      const diasMinimos = this.obtenerDiasMinimos(distancia);
      if (diasEntreno.length < diasMinimos) {
        Utils.showToast(`> PARA ${distancia === 'maraton' ? 'MARATÓN' : 'MEDIA'} NECESITAS MÍNIMO ${diasMinimos} DÍAS_`, 'error');
        Utils.hideLoading();
        return;
      }

      let diaLargo = parseInt(document.getElementById("diaLargo").value);
      if (isNaN(diaLargo) || document.getElementById("diaLargo").value === 'auto') {
        diaLargo = this.elegirDiaLargoOptimo(diasEntreno);
      }
      
      if (!diasEntreno.includes(diaLargo)) {
        diaLargo = Math.max(...diasEntreno);
      }

      if (meses === 1 && !['2k', '5k', '10k'].includes(distancia)) {
        Utils.showToast("> PLAN DE 1 MES SOLO PARA 2KM, 5KM Y 10KM_", 'error');
        Utils.hideLoading();
        return;
      }
      if (['medio', 'maraton'].includes(distancia) && meses === 3 && experiencia === 'no') {
        Utils.showToast("> PARA MEDIA O MARATÓN EN 3 MESES NECESITAS EXPERIENCIA_", 'error');
        Utils.hideLoading();
        return;
      }

      const semanasTotales = meses * 4;
      const fases = this.generarFases(semanasTotales, objetivo, distancia);
      const ritmoBase = AppState.lastRitmoBase;
      const fcUmbral = AppState.lastUL;

      // ===== GENERAR PLAN =====
      const planCompleto = [];
      let diaGlobalCounter = 1;

      for (let semanaGlobal = 1; semanaGlobal <= semanasTotales; semanaGlobal++) {
        const faseInfo = this.obtenerFaseSemana(fases, semanaGlobal);
        const { fase, semanaEnFase, duracionFase } = faseInfo;

        const nivelActual = this.calcularNivelSemana(semanaGlobal, nivel, semanasTotales);
        const esDescarga = (semanaEnFase % 4 === 0) || fase === 'TAPER';

        const factorVolumen = this.calcularFactorVolumen(fase, semanaEnFase, duracionFase, esDescarga);
        const factorIntensidad = this.calcularFactorIntensidad(fase, semanaEnFase, duracionFase, esDescarga);

        const distribucion = this.DISTRIBUCION_TIPOS[nivelActual][fase.toLowerCase()];

        const numSesiones = diasEntreno.length;
        let rodajes = Math.round(distribucion.rodaje * numSesiones);
        let tempos = Math.round(distribucion.tempo * numSesiones);
        let series = Math.round(distribucion.series * numSesiones);
        let largos = Math.round(distribucion.largo * numSesiones);

        const suma = rodajes + tempos + series + largos;
        if (suma > numSesiones) rodajes -= (suma - numSesiones);
        else if (suma < numSesiones) rodajes += (numSesiones - suma);

        if (esDescarga) {
          tempos = Math.min(tempos, 1);
          series = 0;
        }

        // ===== ASIGNACIÓN DE TIPOS =====
        const tiposDisponibles = [];
        for (let i = 0; i < rodajes; i++) tiposDisponibles.push('rodaje');
        for (let i = 0; i < tempos; i++) tiposDisponibles.push('tempo');
        for (let i = 0; i < series; i++) tiposDisponibles.push('series');

        this.mezclarArray(tiposDisponibles);

        const diasDisponibles = [...diasEntreno];
        const tiposPorDia = {};

        const tieneLargo = largos > 0;
        if (tieneLargo) {
          tiposPorDia[diaLargo] = 'largo';
          const index = diasDisponibles.indexOf(diaLargo);
          if (index > -1) diasDisponibles.splice(index, 1);
        }

        for (let i = 0; i < diasDisponibles.length; i++) {
          const dia = diasDisponibles[i];
          if (i < tiposDisponibles.length) {
            tiposPorDia[dia] = tiposDisponibles[i];
          } else {
            tiposPorDia[dia] = 'rodaje';
          }
        }

        const semana = [];
        for (let diaSemana = 1; diaSemana <= 7; diaSemana++) {
          if (!diasEntreno.includes(diaSemana)) {
            semana.push({
              diaGlobal: diaGlobalCounter++,
              semana: semanaGlobal,
              diaSemana,
              fase,
              nivel: nivelActual,
              tipo: 'descanso',
              color: 'sesion-descanso',
              detalle: null
            });
          } else {
            const tipo = tiposPorDia[diaSemana];
            const sesion = await this.crearSesionCientifica(
              tipo,
              fase,
              semanaEnFase,
              nivelActual,
              { modalidad, distancia, ritmoBase, fcUmbral },
              factorVolumen,
              factorIntensidad
            );

            semana.push({
              diaGlobal: diaGlobalCounter++,
              semana: semanaGlobal,
              diaSemana,
              fase,
              nivel: nivelActual,
              tipo,
              color: this.getColor(tipo),
              ...sesion
            });
          }
        }

        planCompleto.push(...semana);
      }

      // ===== GUARDAR PLAN =====
      const planId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const mapaDist = { "2k": "2 km", "5k": "5 km", "10k": "10 km", "medio": "MEDIA", "maraton": "MARATÓN" };

      const planParaGuardar = {
        params: {
          modalidad, distancia, duracion: meses,
          diasPorSemana: diasEntreno.length,
          nivel, experiencia, objetivo, diaLargo,
          diasEntreno, planId,
          ritmoBase: AppState.lastRitmoBase,
          fcMax: AppState.lastFC,
          fcUmbral: AppState.lastUL
        },
        sesiones: planCompleto,
        resumen: `${mapaDist[distancia] || distancia} · ${diasEntreno.length} días · Nivel ${nivel}`,
        fechaCreacion: new Date().toISOString()
      };

      await this.guardarPlanEnFirebase(planId, planParaGuardar);

      AppState.planGeneradoActual = planParaGuardar.params;
      AppState.planActualId = planId;
      AppState.sesionesRealizadas = {};
      AppState.trimestreActual = 0;

      document.getElementById("resumenObjetivo").innerHTML = `
        <strong>${mapaDist[distancia]}</strong> · ${diasEntreno.length} DÍAS/SEMANA<br>
        <span style="color: var(--text-secondary); font-size: 13px;">
          ${nivel.toUpperCase()} · OBJ: ${objetivo.toUpperCase()} · 
          LARGO: ${["", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][diaLargo]}
        </span>
      `;

      document.getElementById("calendarioEntreno").style.display = "block";
      document.getElementById("cuestionarioEntreno").style.display = "none";

      this.mostrarCalendario(planCompleto);
      
      Utils.scrollToElement('calendarioEntreno', -20);
      Utils.showToast('✅ PLAN GENERADO', 'success');

    } catch (error) {
      console.error('Error:', error);
      Utils.showToast(error.message || 'Error al generar plan', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ==========================================================================
  // CREACIÓN DE SESIONES CIENTÍFICAS (DURACIÓN MÍNIMA 50min)
  // ==========================================================================
  crearSesionCientifica(tipo, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad) {
    const { modalidad, distancia, ritmoBase, fcUmbral } = datos;
    
    // Duración base según tipo y fase (mínimo 30min de parte principal)
    const duracionesBase = {
      rodaje: { min: 40, max: 90, principal: 30 },
      tempo: { min: 45, max: 75, principal: 35 },
      series: { min: 50, max: 90, principal: 40 },
      largo: { min: 60, max: 150, principal: 50 }
    };

    const base = duracionesBase[tipo] || duracionesBase.rodaje;
    
    // Calcular duración total (mínimo 50 min)
    let duracionTotal = Math.round(base.min * factorVolumen);
    duracionTotal = Math.max(50, Math.min(duracionTotal, base.max));
    
    // Estructura fija: 10' calentamiento + partePrincipal + 10' enfriamiento
    const calentamiento = 10;
    const enfriamiento = 10;
    let partePrincipal = duracionTotal - calentamiento - enfriamiento;
    
    // Asegurar que la parte principal sea al menos 30 min
    if (partePrincipal < 30) {
      partePrincipal = 30;
      duracionTotal = calentamiento + partePrincipal + enfriamiento;
    }

    // ===== GENERAR DETALLE CIENTÍFICO SEGÚN TIPO =====
    let detalle = {};
    const zonaObjetivo = this.obtenerZonaObjetivo(tipo, fase, nivel);
    const ritmoObjetivo = this.calcularRitmoObjetivo(ritmoBase, zonaObjetivo, factorIntensidad);
    const fcObjetivo = this.calcularFcObjetivo(fcUmbral, zonaObjetivo, factorIntensidad);
    
    switch(tipo) {
      case 'rodaje':
        detalle = this.generarRodajeCientifico(partePrincipal, zonaObjetivo, ritmoObjetivo, fcObjetivo, fase, nivel);
        break;
      case 'tempo':
        detalle = this.generarTempoCientifico(partePrincipal, zonaObjetivo, ritmoObjetivo, fcObjetivo, fase, nivel);
        break;
      case 'series':
        detalle = this.generarSeriesCientifico(partePrincipal, zonaObjetivo, ritmoObjetivo, fcObjetivo, fase, nivel, distancia);
        break;
      case 'largo':
        detalle = this.generarLargoCientifico(partePrincipal, zonaObjetivo, ritmoObjetivo, fcObjetivo, fase, nivel, distancia);
        break;
    }

    return {
      duracion: duracionTotal,
      detalle: {
        ...detalle,
        calentamiento,
        partePrincipal,
        enfriamiento,
        fase,
        nivel,
        tipo
      }
    };
  },

  generarRodajeCientifico(duracion, zona, ritmo, fc, fase, nivel) {
    const intensidadTexto = zona === 'Z2' ? 'aeróbico' : 'recuperación';
    
    return {
      nombre: `Rodaje ${fase === 'BASE' ? 'Aeróbico' : fase === 'TAPER' ? 'Recuperación' : 'Activo'}`,
      descripcion: `Sesión de rodaje continuo en ${this.ZONAS_ENTRENO[zona].nombre.toLowerCase()}`,
      estructura: `${duracion}' continuos a ritmo aeróbico`,
      objetivos: [
        `↑ Capilarización muscular`,
        `↑ Densidad mitocondrial`,
        `↑ Economía de carrera`
      ],
      indicaciones: [
        `Mantén una frecuencia cardíaca estable`,
        `Respiración controlada y rítmica`,
        `Cadencia objetivo: 170-180 ppm`
      ],
      percepcion: this.ZONAS_ENTRENO[zona].percepcion,
      zona,
      ritmoObjetivo: Utils.formatR(ritmo),
      fcObjetivo: fc,
      beneficioPrincipal: this.ZONAS_ENTRENO[zona].beneficio
    };
  },

  generarTempoCientifico(duracion, zona, ritmo, fc, fase, nivel) {
    const zonaBase = zona.split('-')[0] || 'Z3';
    
    return {
      nombre: fase === 'ESPECIFICA' ? 'Tempo Umbral' : 'Entrenamiento de Umbral',
      descripcion: `Sesión de tempo a ritmo de umbral anaeróbico`,
      estructura: `${duracion}' continuos a ritmo de umbral`,
      objetivos: [
        `↑ Tolerancia al lactato`,
        `↑ Umbral anaeróbico`,
        `↑ Eficiencia metabólica`
      ],
      indicaciones: [
        `Ritmo "cómodamente duro"`,
        `Deberías poder decir frases cortas`,
        `Mantén la concentración en la técnica`
      ],
      percepcion: 'Fuerte pero controlado',
      zona,
      ritmoObjetivo: Utils.formatR(ritmo),
      fcObjetivo: fc,
      beneficioPrincipal: 'Mejora del umbral de lactato'
    };
  },

  generarSeriesCientifico(duracion, zona, ritmo, fc, fase, nivel, distancia) {
    // Determinar número y distancia de series según nivel y fase
    const configSeries = this.configurarSeries(nivel, fase, distancia);
    const { repeticiones, distanciaSerie, recuperacion } = configSeries;
    
    const ritmoSerie = ritmo * 0.95; // Las series son más rápidas
    
    return {
      nombre: `${repeticiones}x${distanciaSerie}m`,
      descripcion: `Trabajo de series en ${zona}`,
      estructura: `${repeticiones}x${distanciaSerie}m con ${recuperacion}' recuperación`,
      objetivos: [
        `↑ Potencia aeróbica máxima (VO2máx)`,
        `↑ Tolerancia al lactato`,
        `↑ Capacidad de trabajo a ritmo rápido`
      ],
      indicaciones: [
        `Las repeticiones deben ser de alta calidad`,
        `Recuperación activa caminando o trotando`,
        `Mantén la técnica incluso al final`
      ],
      repeticiones,
      distanciaSerie,
      recuperacion,
      percepcion: zona === 'Z5' ? 'Muy intenso' : 'Intenso controlado',
      zona,
      ritmoObjetivo: Utils.formatR(ritmoSerie),
      fcObjetivo: fc,
      beneficioPrincipal: 'Mejora de la capacidad anaeróbica'
    };
  },

  generarLargoCientifico(duracion, zona, ritmo, fc, fase, nivel, distancia) {
    const esProgresivo = fase === 'ESPECIFICA' || fase === 'PICO';
    
    return {
      nombre: esProgresivo ? 'Tirada Larga Progresiva' : 'Tirada Larga Aeróbica',
      descripcion: `Fondo para desarrollar resistencia específica`,
      estructura: esProgresivo ? 
        `${Math.round(duracion*0.7)}' Z2 + ${Math.round(duracion*0.3)}' Z3/Z4` : 
        `${duracion}' continuos Z2`,
      objetivos: [
        `↑ Resistencia muscular`,
        `↑ Capacidad de almacenar glucógeno`,
        `↑ Adaptaciones metabólicas`
      ],
      indicaciones: [
        `Ritmo de conversación al inicio`,
        `Hidrátate durante la sesión`,
        `Nutrición: tomar algo cada 45-60 min`
      ],
      percepcion: 'Controlado al inicio, exigente al final',
      zona,
      ritmoObjetivo: Utils.formatR(ritmo),
      fcObjetivo: fc,
      beneficioPrincipal: 'Desarrollo de la resistencia específica'
    };
  },

  configurarSeries(nivel, fase, distancia) {
    const base = {
      principiante: { rep: 6, dist: 400, rec: 2 },
      intermedio: { rep: 8, dist: 600, rec: 1.5 },
      avanzado: { rep: 10, dist: 800, rec: 1 }
    };

    const factorDist = {
      '2k': 0.5,
      '5k': 0.8,
      '10k': 1,
      'medio': 1.5,
      'maraton': 2
    };

    const faseFactor = {
      'BASE': 0.8,
      'CONSTRUCCION': 1,
      'ESPECIFICA': 1.2,
      'PICO': 1.3,
      'TAPER': 0.5
    };

    const conf = base[nivel] || base.intermedio;
    const factor = factorDist[distancia] || 1;
    const faseMult = faseFactor[fase] || 1;

    let distanciaSerie = Math.round(conf.dist * factor * faseMult);
    // Redondear a múltiplos de 50 para que sea legible
    distanciaSerie = Math.round(distanciaSerie / 50) * 50;
    
    // Ajustar repeticiones para mantener volumen
    let repeticiones = conf.rep;
    if (distanciaSerie > 1000) {
      repeticiones = Math.max(4, Math.round(conf.rep * 0.7));
    }

    return {
      repeticiones,
      distanciaSerie,
      recuperacion: conf.rec
    };
  },

  obtenerZonaObjetivo(tipo, fase, nivel) {
    const zonas = {
      rodaje: { BASE: 'Z2', CONSTRUCCION: 'Z2', ESPECIFICA: 'Z2', PICO: 'Z2', TAPER: 'Z1' },
      tempo: { BASE: 'Z3', CONSTRUCCION: 'Z3', ESPECIFICA: 'Z4', PICO: 'Z4', TAPER: 'Z2' },
      series: { BASE: 'Z4', CONSTRUCCION: 'Z4', ESPECIFICA: 'Z5', PICO: 'Z5', TAPER: 'Z2' },
      largo: { BASE: 'Z2', CONSTRUCCION: 'Z2', ESPECIFICA: 'Z2', PICO: 'Z2', TAPER: 'Z1' }
    };
    return zonas[tipo]?.[fase] || 'Z2';
  },

  calcularRitmoObjetivo(ritmoBase, zona, factorIntensidad) {
    const factores = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95, 'Z6': 0.85 };
    const factor = factores[zona.split('-')[0]] || 1.25;
    return ritmoBase * factor * (0.9 + (factorIntensidad * 0.1));
  },

  calcularFcObjetivo(fcUmbral, zona, factorIntensidad) {
    const rangos = {
      'Z1': [0.6, 0.7],
      'Z2': [0.7, 0.8],
      'Z3': [0.8, 0.85],
      'Z4': [0.85, 0.92],
      'Z5': [0.92, 0.98],
      'Z6': [0.98, 1.05]
    };
    const zonaBase = zona.split('-')[0] || 'Z2';
    const [min, max] = rangos[zonaBase] || [0.7, 0.8];
    
    const fcMin = Math.round(fcUmbral * min * factorIntensidad);
    const fcMax = Math.round(fcUmbral * max * factorIntensidad);
    
    return zonaBase === 'Z6' ? `> ${fcMin} lpm` : `${fcMin}-${fcMax} lpm`;
  },

  // ==========================================================================
  // FUNCIONES AUXILIARES (sin cambios)
  // ==========================================================================
  obtenerDiasSeleccionados() {
    const dias = [];
    for (let i = 1; i <= 7; i++) {
      const cb = document.getElementById(`dia${i}`);
      if (cb?.checked) dias.push(i);
    }
    return dias;
  },

  obtenerDiasMinimos(distancia) {
    if (distancia === 'maraton') return 4;
    if (distancia === 'medio') return 3;
    return 2;
  },

  elegirDiaLargoOptimo(diasEntreno) {
    if (diasEntreno.includes(6)) return 6;
    if (diasEntreno.includes(7)) return 7;
    return Math.max(...diasEntreno);
  },

  mezclarArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },

  getColor(tipo) {
    const colores = {
      rodaje: 'sesion-rodaje',
      tempo: 'sesion-tempo',
      series: 'sesion-series',
      largo: 'sesion-largo',
      descanso: 'sesion-descanso'
    };
    return colores[tipo] || 'sesion-descanso';
  },

  DISTRIBUCION_TIPOS: {
    principiante: {
      base: { rodaje: 0.8, tempo: 0.1, series: 0.0, largo: 0.1 },
      construccion: { rodaje: 0.7, tempo: 0.15, series: 0.05, largo: 0.1 },
      especifica: { rodaje: 0.6, tempo: 0.2, series: 0.1, largo: 0.1 },
      pico: { rodaje: 0.5, tempo: 0.25, series: 0.15, largo: 0.1 },
      taper: { rodaje: 0.8, tempo: 0.1, series: 0.0, largo: 0.1 }
    },
    intermedio: {
      base: { rodaje: 0.7, tempo: 0.15, series: 0.05, largo: 0.1 },
      construccion: { rodaje: 0.6, tempo: 0.2, series: 0.1, largo: 0.1 },
      especifica: { rodaje: 0.5, tempo: 0.2, series: 0.2, largo: 0.1 },
      pico: { rodaje: 0.4, tempo: 0.25, series: 0.25, largo: 0.1 },
      taper: { rodaje: 0.7, tempo: 0.15, series: 0.05, largo: 0.1 }
    },
    avanzado: {
      base: { rodaje: 0.6, tempo: 0.2, series: 0.1, largo: 0.1 },
      construccion: { rodaje: 0.5, tempo: 0.2, series: 0.2, largo: 0.1 },
      especifica: { rodaje: 0.4, tempo: 0.2, series: 0.3, largo: 0.1 },
      pico: { rodaje: 0.3, tempo: 0.25, series: 0.35, largo: 0.1 },
      taper: { rodaje: 0.6, tempo: 0.2, series: 0.1, largo: 0.1 }
    }
  },

  PROGRESION_NIVEL: {
    principiante: { intermedio: 8, avanzado: 16 },
    intermedio: { avanzado: 12 }
  },

  generarFases(semanasTotales, objetivo, distancia) {
    const fases = [];
    let semanaInicio = 1;

    let duracionBase = Math.round(semanasTotales * 0.4);
    let duracionConstruccion = Math.round(semanasTotales * 0.3);
    let duracionEspecifica = Math.round(semanasTotales * 0.2);
    let duracionPico = Math.round(semanasTotales * 0.05);
    let duracionTaper = semanasTotales - duracionBase - duracionConstruccion - duracionEspecifica - duracionPico;

    if (objetivo === 'acabar') {
      duracionBase += 2;
      duracionEspecifica -= 2;
    }
    if (objetivo === 'competir') {
      duracionBase -= 2;
      duracionEspecifica += 1;
      duracionPico += 1;
    }

    const suma = duracionBase + duracionConstruccion + duracionEspecifica + duracionPico + duracionTaper;
    if (suma > semanasTotales) {
      duracionTaper -= (suma - semanasTotales);
    } else if (suma < semanasTotales) {
      duracionEspecifica += (semanasTotales - suma);
    }

    if (duracionBase > 0) fases.push({ nombre: 'BASE', inicio: semanaInicio, duracion: duracionBase });
    semanaInicio += duracionBase;
    if (duracionConstruccion > 0) fases.push({ nombre: 'CONSTRUCCION', inicio: semanaInicio, duracion: duracionConstruccion });
    semanaInicio += duracionConstruccion;
    if (duracionEspecifica > 0) fases.push({ nombre: 'ESPECIFICA', inicio: semanaInicio, duracion: duracionEspecifica });
    semanaInicio += duracionEspecifica;
    if (duracionPico > 0) fases.push({ nombre: 'PICO', inicio: semanaInicio, duracion: duracionPico });
    semanaInicio += duracionPico;
    if (duracionTaper > 0) fases.push({ nombre: 'TAPER', inicio: semanaInicio, duracion: duracionTaper });

    return fases;
  },

  obtenerFaseSemana(fases, semanaGlobal) {
    for (const fase of fases) {
      if (semanaGlobal >= fase.inicio && semanaGlobal < fase.inicio + fase.duracion) {
        return {
          fase: fase.nombre,
          semanaEnFase: semanaGlobal - fase.inicio + 1,
          duracionFase: fase.duracion
        };
      }
    }
    return { fase: 'BASE', semanaEnFase: 1, duracionFase: 1 };
  },

  calcularNivelSemana(semanaGlobal, nivelInicial, semanasTotales) {
    if (nivelInicial === 'principiante') {
      if (semanaGlobal >= this.PROGRESION_NIVEL.principiante.avanzado) return 'avanzado';
      if (semanaGlobal >= this.PROGRESION_NIVEL.principiante.intermedio) return 'intermedio';
      return 'principiante';
    }
    if (nivelInicial === 'intermedio') {
      if (semanaGlobal >= this.PROGRESION_NIVEL.intermedio.avanzado) return 'avanzado';
      return 'intermedio';
    }
    return 'avanzado';
  },

  calcularFactorVolumen(fase, semanaEnFase, duracionFase, esDescarga) {
    const factorBase = this.FASES[fase]?.volumen || 0.8;
    const progreso = semanaEnFase / duracionFase;
    let factor = factorBase * (0.9 + progreso * 0.2);
    if (esDescarga) factor *= 0.7;
    return Math.min(1.2, Math.max(0.5, factor));
  },

  calcularFactorIntensidad(fase, semanaEnFase, duracionFase, esDescarga) {
    const factorBase = this.FASES[fase]?.intensidad || 0.8;
    const progreso = semanaEnFase / duracionFase;
    let factor = factorBase * (0.95 + progreso * 0.1);
    if (esDescarga) factor *= 0.8;
    return Math.min(1.1, Math.max(0.5, factor));
  },

  // ==========================================================================
  // GUARDADO Y VISUALIZACIÓN
  // ==========================================================================
  async guardarPlanEnFirebase(planId, planData) {
    if (!AppState.currentUserId) return;
    try {
      const dataToSave = { ...planData, sesionesRealizadas: {} };
      await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(planId)
        .set(dataToSave);
      await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .update({ ultimoPlanId: planId });
    } catch (error) {
      console.error('Error guardando plan:', error);
      Utils.showToast('Error al guardar el plan', 'error');
    }
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

    const puedeVerDetalle = AppState.puedeVerDetalleSesion();
    if (!puedeVerDetalle) {
      const notaPlan = document.querySelector('.nota-plan');
      if (notaPlan) {
        const msgAnterior = document.querySelector('.premium-expired-message');
        if (msgAnterior) msgAnterior.remove();
        const msgExpirado = document.createElement('div');
        msgExpirado.className = 'premium-expired-message';
        msgExpirado.innerHTML = '⚠️ Versión gratuita: puedes ver detalles de las primeras 2 semanas. <button onclick="showPremiumBenefits()">HAZTE PREMIUM</button>';
        notaPlan.parentNode.insertBefore(msgExpirado, notaPlan.nextSibling);
      }
    }
  },

  renderizarPagina(sesiones) {
    const grid = document.getElementById("calendarioGrid");
    if (!grid) return;

    const semanasPorPagina = 12;
    const inicioPagina = AppState.trimestreActual * semanasPorPagina * 7;
    const finPagina = Math.min(inicioPagina + (semanasPorPagina * 7), sesiones.length);

    if (inicioPagina >= sesiones.length) return;

    const celdas = new Array(semanasPorPagina * 7).fill(null);

    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];
      if (!sesion) continue;
      
      const pos = i - inicioPagina;
      celdas[pos] = sesion;
    }

    let html = '';

    for (let pos = 0; pos < celdas.length; pos++) {
      const sesion = celdas[pos];

      if (!sesion) {
        html += '<div class="calendario-dia sesion-descanso"></div>';
        continue;
      }

      const realizada = AppState.sesionesRealizadas?.[sesion.diaGlobal] ? 'realizado' : '';

      let faseColor = '';
      if (sesion.fase && this.FASES[sesion.fase]) {
        faseColor = this.FASES[sesion.fase].color;
      }
      const faseIndicator = faseColor ? ` style="border-top: 4px solid ${faseColor};"` : '';

      // SIN LETRA DEL DÍA DE LA SEMANA - Solo número de día y tipo
      let contenidoHtml = '';
      if (sesion.tipo !== 'descanso' && sesion.detalle) {
        // Mostrar el tipo de sesión de forma más visual
        const emoji = this.getEmoji(sesion.tipo);
        contenidoHtml = `<div style="font-size: 20px; margin-bottom: 2px;">${emoji}</div>
                         <div style="font-size: 11px; text-transform: uppercase;">${sesion.tipo}</div>`;
      } else {
        contenidoHtml = `<div style="font-size: 20px;">😴</div>
                         <div style="font-size: 11px;">DESCANSO</div>`;
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada}" data-index="${sesion.diaGlobal}"${faseIndicator}>${contenidoHtml}</div>`;
    }

    grid.innerHTML = html;
    this.agregarLeyendaFases();

    document.querySelectorAll('.calendario-dia[data-index]').forEach(dia => {
      dia.addEventListener('click', (e) => {
        const diaIndex = e.currentTarget.dataset.index;
        if (diaIndex && sesiones[diaIndex - 1]) {
          this.abrirDetalleSesion(sesiones[diaIndex - 1], parseInt(diaIndex));
        }
      });
    });
  },

  getEmoji(tipo) {
    const emojis = {
      rodaje: '🏃',
      tempo: '⚡',
      series: '🔁',
      largo: '📏',
      descanso: '😴'
    };
    return emojis[tipo] || '🏃';
  },

  agregarLeyendaFases() {
    const contenedor = document.querySelector('.calendario-navegacion');
    if (!contenedor) return;
    if (document.getElementById('leyenda-fases')) return;

    const leyenda = document.createElement('div');
    leyenda.id = 'leyenda-fases';
    leyenda.style.cssText = 'display: flex; justify-content: center; gap: 15px; margin-top: 10px; font-size: 11px; flex-wrap: wrap;';
    
    for (const [fase, datos] of Object.entries(this.FASES)) {
      const item = document.createElement('span');
      item.innerHTML = `<span style="display:inline-block; width:12px; height:12px; background-color:${datos.color}; margin-right:4px;"></span> ${datos.nombre}`;
      leyenda.appendChild(item);
    }
    
    contenedor.parentNode.insertBefore(leyenda, contenedor.nextSibling);
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
          if (planCompleto?.sesiones) {
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

  abrirDetalleSesion(sesion, diaIndex) {
    if (!sesion) return;
    if (!AppState.puedeVerDetalleSesion()) {
      Utils.showToast('⭐ Premium necesario para ver detalles de sesiones', 'warning');
      return;
    }

    AppState.currentSesionDetalle = { sesion, diaIndex, planId: AppState.planActualId };

    const modal = document.getElementById("detalleSesion");
    const overlay = document.getElementById("modalOverlay");
    const wrapper = document.getElementById("modalColorWrapper");
    const titulo = document.getElementById("tituloSesion");
    const descripcion = document.getElementById("descripcionSesion");
    const checkboxContainer = document.getElementById("sesionCheckboxContainer");
    const checkbox = document.getElementById("sesionRealizada");

    wrapper.className = "modal-content";

    if (sesion.tipo !== 'descanso' && sesion.detalle) {
      wrapper.classList.add(sesion.color);

      const faseInfo = this.FASES[sesion.fase] || { nombre: sesion.fase };
      const zonaInfo = this.ZONAS_ENTRENO[sesion.detalle.zona?.split('-')[0]] || { nombre: 'Zona', percepcion: '' };

      titulo.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <span style="font-size: 32px;">${this.getEmoji(sesion.tipo)}</span>
          <div>
            <div style="font-size: 20px; text-transform: uppercase;">${sesion.tipo}</div>
            <div style="font-size: 14px; color: var(--accent-yellow);">${faseInfo.nombre}</div>
          </div>
        </div>
      `;

      const duracionTotal = sesion.duracion || 50;
      const tiempoFormateado = this.formatearTiempo(duracionTotal);

      // Construir objetivos HTML
      const objetivosHTML = sesion.detalle.objetivos?.map(obj => 
        `<li style="margin-bottom: 8px;">🎯 ${obj}</li>`
      ).join('') || '<li>Mejora del rendimiento</li>';

      const indicacionesHTML = sesion.detalle.indicaciones?.map(ind => 
        `<li style="margin-bottom: 8px;">💡 ${ind}</li>`
      ).join('') || '<li>Mantén la técnica adecuada</li>';

      descripcion.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center;">
            <div>
              <div style="font-size: 24px; color: var(--accent-blue);">⏱️</div>
              <div style="font-size: 18px; font-weight: 400;">${tiempoFormateado}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">DURACIÓN</div>
            </div>
            <div>
              <div style="font-size: 24px; color: var(--accent-blue);">❤️</div>
              <div style="font-size: 18px; font-weight: 400;">${sesion.detalle.fcObjetivo || '—'}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">FC OBJETIVO</div>
            </div>
            <div>
              <div style="font-size: 24px; color: var(--accent-blue);">⚡</div>
              <div style="font-size: 18px; font-weight: 400;">${sesion.detalle.ritmoObjetivo || '—'}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">RITMO</div>
            </div>
          </div>
        </div>

        <div style="background: var(--bg-primary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 15px 0; color: var(--accent-yellow); font-size: 16px;">📋 ESTRUCTURA DE LA SESIÓN</h4>
          <div style="display: flex; flex-direction: column; gap: 15px;">
            <div style="display: flex; align-items: center;">
              <span style="background: var(--accent-blue); color: var(--bg-primary); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">1</span>
              <div><strong>Calentamiento:</strong> ${sesion.detalle.calentamiento}' en Z1-Z2 (trote suave + ejercicios de movilidad)</div>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="background: var(--accent-blue); color: var(--bg-primary); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">2</span>
              <div><strong>Parte Principal:</strong> ${sesion.detalle.estructura}</div>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="background: var(--accent-blue); color: var(--bg-primary); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">3</span>
              <div><strong>Vuelta a la calma:</strong> ${sesion.detalle.enfriamiento}' en Z1 + estiramientos</div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
          <div style="background: var(--bg-primary); border-radius: 12px; padding: 15px;">
            <h4 style="margin: 0 0 10px 0; color: var(--accent-yellow); font-size: 14px;">🎯 OBJETIVOS</h4>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${objetivosHTML}
            </ul>
          </div>
          <div style="background: var(--bg-primary); border-radius: 12px; padding: 15px;">
            <h4 style="margin: 0 0 10px 0; color: var(--accent-yellow); font-size: 14px;">💪 INDICACIONES</h4>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${indicacionesHTML}
            </ul>
          </div>
        </div>

        <div style="background: var(--bg-primary); border-radius: 12px; padding: 15px; text-align: center;">
          <span style="color: var(--text-secondary);">Percepción del esfuerzo:</span>
          <span style="color: var(--accent-blue); font-weight: 400; margin-left: 10px;">${sesion.detalle.percepcion || 'Controlado'}</span>
        </div>
      `;

      checkboxContainer.style.display = 'flex';
      checkbox.checked = AppState.sesionesRealizadas?.[diaIndex] || false;
      checkbox.onchange = async (e) => {
        await this.marcarSesionRealizada(diaIndex, e.target.checked);
      };
    } else {
      wrapper.classList.add('sesion-descanso');
      titulo.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <span style="font-size: 32px;">😴</span>
          <span style="font-size: 20px;">DESCANSO ACTIVO</span>
        </div>
      `;
      descripcion.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 20px; text-align: center;">
          <p style="font-size: 18px; margin-bottom: 20px;">El descanso es parte fundamental del entrenamiento</p>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div>
              <div style="font-size: 24px;">🧘</div>
              <div>Estiramientos suaves</div>
            </div>
            <div>
              <div style="font-size: 24px;">🚶</div>
              <div>Paseo activo 20-30'</div>
            </div>
            <div>
              <div style="font-size: 24px;">🌀</div>
              <div>Foam roller</div>
            </div>
            <div>
              <div style="font-size: 24px;">💧</div>
              <div>Hidratación</div>
            </div>
          </div>
          <p style="margin-top: 20px; color: var(--text-secondary); font-size: 14px;">
            Beneficios: Recuperación muscular, adaptación al entrenamiento, prevención de lesiones
          </p>
        </div>
      `;
      checkboxContainer.style.display = 'none';
    }

    modal.classList.add("visible");
    overlay.classList.add("visible");
  },

  async marcarSesionRealizada(diaIndex, realizada) {
    if (!AppState.currentUserId || !AppState.planActualId) return;

    try {
      const planRef = firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(AppState.planActualId);

      await planRef.update({
        [`sesionesRealizadas.${diaIndex}`]: realizada
      });

      if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
      AppState.sesionesRealizadas[diaIndex] = realizada;

      const celda = document.querySelector(`.calendario-dia[data-index="${diaIndex}"]`);
      if (celda) {
        if (realizada) celda.classList.add('realizado');
        else celda.classList.remove('realizado');
      }

      Utils.showToast(realizada ? '✅ Sesión marcada' : '📝 Sesión desmarcada', 'success');
    } catch (error) {
      console.error('Error marcando sesión:', error);
      Utils.showToast('Error al marcar la sesión', 'error');
    }
  },

  formatearTiempo(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    }
    return `${mins} min`;
  },

  // ==========================================================================
  // GESTIÓN DE PLANES GUARDADOS
  // ==========================================================================
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

      AppState.planGeneradoActual = planCompleto.params;
      AppState.planActualId = ultimoPlanId;
      AppState.sesionesRealizadas = planCompleto.sesionesRealizadas || {};
      AppState.trimestreActual = 0;

      document.getElementById("calendarioEntreno").style.display = "block";
      document.getElementById("cuestionarioEntreno").style.display = "none";
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
      await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .update({ ultimoPlanId: null });

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
  },

  validarOpcionesPlan() {
    const nivel = document.getElementById("nivel").value;
    const distancia = document.getElementById("distObjetivo").value;
    const duracion = document.getElementById("duracionPlan").value;
    const experiencia = document.getElementById("experienciaDistancia").value;
    const infoDiv = document.getElementById("info-mensaje-distancia");
    const generarBtn = document.getElementById("generarPlanBtn");
    
    generarBtn.disabled = false;
    infoDiv.style.display = 'none';
    
    if (nivel === 'avanzado') {
      infoDiv.style.display = 'block';
      infoDiv.innerHTML = '⚠️ NIVEL AVANZADO: Necesitas al menos 5 días de entrenamiento a la semana';
    }
    
    if (duracion === '1' && !['2k', '5k', '10k'].includes(distancia)) {
      infoDiv.style.display = 'block';
      infoDiv.innerHTML = '⚠️ Plan de 1 mes solo para 2km, 5km y 10km';
      generarBtn.disabled = true;
      return;
    }
    
    if (['medio', 'maraton'].includes(distancia) && duracion === '3' && experiencia === 'no') {
      infoDiv.style.display = 'block';
      infoDiv.innerHTML = '⚠️ Para Media o Maratón en 3 meses necesitas experiencia previa';
      generarBtn.disabled = true;
      return;
    }
  },

  toggleCuestionario() {
    if (!AppState.zonasCalculadas) {
      Utils.showToast("> CALCULA ZONAS PRIMERO_", 'error');
      return;
    }
    if (!AppState.isPremium) {
      Utils.showToast("> SOLO USUARIOS PREMIUM_", 'error');
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
  }
};

// ==========================================================================
// EXPORTACIÓN
// ==========================================================================
window.PlanGenerator = PlanGenerator;
window.toggleCuestionario = () => PlanGenerator.toggleCuestionario();
window.generarCalendarioEntreno = () => PlanGenerator.generarCalendarioEntreno();
window.validarOpcionesPlan = () => PlanGenerator.validarOpcionesPlan();
window.mostrarUltimoPlanGuardado = () => PlanGenerator.mostrarUltimoPlanGuardado();
window.borrarPlanGuardado = () => PlanGenerator.borrarPlanGuardado();
window.cambiarTrimestre = async (delta) => { await PlanGenerator.cambiarTrimestre(delta); };
window.cerrarModalSesion = () => {
  document.getElementById("detalleSesion")?.classList.remove("visible");
  document.getElementById("modalOverlay")?.classList.remove("visible");
  AppState.currentSesionDetalle = null;
};

console.log('✅ PlanGenerator v15.0 - CIENTÍFICO | 50min mínimo | Sin letras');