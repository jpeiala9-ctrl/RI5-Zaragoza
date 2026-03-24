// ==================== calendar.js - VERSIÓN CORREGIDA (ritmos realistas para series) ====================
// Versión: 2.17 - Corregido cálculo de ritmo rápido para sesiones de series
// ============================================================================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},

  FASES: {
    BASE: { nombre: 'Base', color: '#8AA0B0', intensidad: 0.7, volumenBase: 1.0 },
    CONSTRUCCION: { nombre: 'Construcción', color: '#9BB5A0', intensidad: 0.85, volumenBase: 1.15 },
    ESPECIFICA: { nombre: 'Específica', color: '#C9A78B', intensidad: 0.95, volumenBase: 1.2 },
    PICO: { nombre: 'Pico', color: '#C99BA5', intensidad: 1.0, volumenBase: 1.1 },
    TAPER: { nombre: 'Taper', color: '#9AA5A5', intensidad: 0.6, volumenBase: 0.7 }
  },

  ONDULACION_PATRONES: [
    { intensidad: 0.8, volumen: 1.2 },
    { intensidad: 1.0, volumen: 1.0 },
    { intensidad: 1.2, volumen: 0.8 },
    { intensidad: 0.9, volumen: 0.9 }
  ],

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

  DURACION_FUERZA: 40,

  DESCRIPCIONES_FUERZA: [
    { nombre: "Fuerza funcional", ejercicios: "sentadillas, zancadas, plancha, puente de glúteos, trabajo de core", objetivo: "Mejorar estabilidad y potencia en carrera." },
    { nombre: "Fuerza explosiva", ejercicios: "saltos al cajón, skipping, multisaltos, sentadillas con salto", objetivo: "Aumentar la reactividad y la capacidad de aceleración." },
    { nombre: "Fuerza de resistencia", ejercicios: "circuito de 8 ejercicios: sentadillas, zancadas, burpees, plancha, escaladores, etc.", objetivo: "Mejorar la capacidad de mantener la fuerza durante largos periodos." },
    { nombre: "Fuerza preventiva", ejercicios: "ejercicios de propiocepción, trabajo de tobillos, rotadores externos de cadera, fortalecimiento de isquiotibiales", objetivo: "Reducir riesgo de lesiones típicas del corredor." },
    { nombre: "Fuerza en el tren inferior", ejercicios: "peso muerto, sentadilla búlgara, máquina de prensa, curl femoral", objetivo: "Potenciar la musculatura principal del running." }
  ],

  ultimaSesionPorTipo: {},

  // ========== NUEVA FUNCIÓN: OBTENER RITMO REALISTA SEGÚN TIPO ==========
  obtenerRitmoParaTipo(tipo, nivel, distancia, ritmoBase, factorIntensidad) {
    const ritmoBaseAjustado = ritmoBase / factorIntensidad;
    let factor = 1.0;
    
    switch(tipo) {
      case 'rodaje':
        factor = 1.20;  // Z2, más lento que el ritmo base
        break;
      case 'tempo':
        factor = 1.05;   // Z3-Z4, ligeramente más rápido
        break;
      case 'series':
        // Factor base según nivel
        if (nivel === 'principiante') factor = 0.92;
        else if (nivel === 'intermedio') factor = 0.88;
        else factor = 0.85;
        
        // Ajuste por distancia: a menor distancia, más rápido
        if (distancia === '2k') factor *= 0.95;
        else if (distancia === '5k') factor *= 0.97;
        else if (distancia === '10k') factor *= 0.98;
        // Para media y maratón se mantiene
        break;
      case 'largo':
        factor = 1.25;   // Z2, más lento
        break;
      default:
        factor = 1.0;
    }
    
    return Utils.formatR(ritmoBaseAjustado * factor);
  },
  // ================================================================

  getOndulatoryFactor(semanaGlobal, semanasTotales, fase) {
    if (fase === 'TAPER') return { intensidad: 0.6, volumen: 0.7 };
    const ciclo = (semanaGlobal - 1) % 4;
    const patron = this.ONDULACION_PATRONES[ciclo] || { intensidad: 1.0, volumen: 1.0 };
    const factorFase = this.FASES[fase];
    return {
      intensidad: patron.intensidad * factorFase.intensidad,
      volumen: patron.volumen * factorFase.volumenBase
    };
  },

  getMaximosPorTipo(tipo, nivel, fase, distancia) {
    const maxBase = {
      rodaje: { principiante: 60, intermedio: 75, avanzado: 90 },
      tempo: 75,
      series: 120,
      largo: 210
    };
    const factorFase = {
      BASE: 0.8,
      CONSTRUCCION: 0.9,
      ESPECIFICA: 1.0,
      PICO: 1.0,
      TAPER: 0.7
    };
    let max;
    if (tipo === 'rodaje') {
      max = maxBase.rodaje[nivel] || 75;
    } else {
      max = maxBase[tipo] || 90;
    }
    max = Math.round(max * factorFase[fase]);
    if (distancia === '2k') {
      if (tipo === 'largo') max = Math.min(max, 60);
      if (tipo === 'series') max = Math.min(max, 60);
    } else if (distancia === '5k') {
      if (tipo === 'largo') max = Math.min(max, 90);
      if (tipo === 'series') max = Math.min(max, 75);
    } else if (distancia === '10k') {
      if (tipo === 'largo') max = Math.min(max, 120);
      if (tipo === 'series') max = Math.min(max, 90);
    } else if (distancia === 'medio') {
      if (tipo === 'largo') max = Math.min(max, 150);
      if (tipo === 'series') max = Math.min(max, 120);
    } else {
      if (tipo === 'largo') max = Math.min(max, 210);
      if (tipo === 'series') max = Math.min(max, 120);
    }
    return max;
  },

  ajustarDistribucionPorDistancia(baseDistribucion, distancia) {
    const nueva = JSON.parse(JSON.stringify(baseDistribucion));
    const factorSeries = distancia === '2k' || distancia === '5k' ? 1.5 : (distancia === '10k' ? 1.2 : (distancia === 'medio' ? 1.1 : 1.05));
    const factorTempo = distancia === '10k' ? 1.3 : (distancia === 'medio' ? 1.2 : (distancia === 'maraton' ? 1.15 : 1.0));
    const factorLargo = distancia === 'medio' || distancia === 'maraton' ? 1.4 : 1.0;
    const factorRodaje = distancia === 'maraton' ? 0.85 : 1.0;
    for (let nivel in nueva) {
      for (let fase in nueva[nivel]) {
        let d = nueva[nivel][fase];
        let sum = d.rodaje + d.tempo + d.series + d.largo;
        d.rodaje = (d.rodaje * factorRodaje) / sum;
        d.tempo = (d.tempo * factorTempo) / sum;
        d.series = (d.series * factorSeries) / sum;
        d.largo = (d.largo * factorLargo) / sum;
        sum = d.rodaje + d.tempo + d.series + d.largo;
        d.rodaje /= sum;
        d.tempo /= sum;
        d.series /= sum;
        d.largo /= sum;
      }
    }
    return nueva;
  },

  calcularVolumenSemanal(nivel, experiencia, objetivo, distancia) {
    const base = {
      principiante: 210,
      intermedio: 360,
      avanzado: 480
    };
    let volumen = base[nivel] || 300;
    if (distancia === '2k') volumen = Math.round(volumen * 0.7);
    else if (distancia === '5k') volumen = Math.round(volumen * 0.85);
    if (objetivo === 'acabar') volumen = Math.round(volumen * 0.85);
    if (objetivo === 'competir') volumen = Math.round(volumen * 1.15);
    if (distancia === 'medio') volumen = Math.round(volumen * 1.1);
    if (distancia === 'maraton') volumen = Math.round(volumen * 1.2);
    if (experiencia === 'no') volumen = Math.round(volumen * 0.9);
    return Math.min(720, Math.max(120, volumen));
  },

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
      AppState.feedbackSesiones = {};

      const modalidad = document.getElementById("modalidad").value;
      const distancia = document.getElementById("distObjetivo").value;
      const meses = parseInt(document.getElementById("duracionPlan").value);
      let nivel = document.getElementById("nivel").value;
      const experiencia = document.getElementById("experienciaDistancia").value;
      const objetivo = document.getElementById("objetivoPrincipal").value;

      const diasEntreno = this.obtenerDiasSeleccionados();
      let diaLargo = parseInt(document.getElementById("diaLargo").value);
      if (isNaN(diaLargo) || document.getElementById("diaLargo").value === 'auto') {
        diaLargo = this.elegirDiaLargoOptimo(diasEntreno);
      }
      if (!diasEntreno.includes(diaLargo)) {
        Utils.showToast(`⚠️ El día de tirada larga (${["", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][diaLargo]}) no está marcado como día de entrenamiento.`, 'error');
        Utils.hideLoading();
        return;
      }
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

      const ahora = new Date();
      const diaSemana = ahora.getDay();
      let diasHastaLunes = (diaSemana === 0 ? 1 : 8 - diaSemana) % 7;
      const fechaInicio = new Date(ahora);
      fechaInicio.setDate(ahora.getDate() + diasHastaLunes);
      fechaInicio.setHours(0, 0, 0, 0);

      const distribucionPersonalizada = this.ajustarDistribucionPorDistancia(this.DISTRIBUCION_TIPOS, distancia);

      const planCompleto = [];
      let diaGlobalCounter = 1;

      let ajusteVolumen = 1.0;
      let ajusteIntensidad = 1.0;
      if (AppState.planActualId) {
        const ajustes = await this.analizarFeedbackAdaptativo();
        ajusteVolumen = ajustes.volumen;
        ajusteIntensidad = ajustes.intensidad;
      }

      this.ultimaSesionPorTipo = {};

      for (let semanaGlobal = 1; semanaGlobal <= semanasTotales; semanaGlobal++) {
        const faseInfo = this.obtenerFaseSemana(fases, semanaGlobal);
        const { fase, semanaEnFase, duracionFase } = faseInfo;
        const nivelActual = this.calcularNivelSemana(semanaGlobal, nivel, semanasTotales);

        const { intensidad: intensidadOnd, volumen: volumenOnd } = this.getOndulatoryFactor(semanaGlobal, semanasTotales, fase);
        let volumenSemanaBase = this.calcularVolumenSemanal(nivelActual, experiencia, objetivo, distancia);
        volumenSemanaBase = Math.round(volumenSemanaBase * volumenOnd * ajusteVolumen);
        let volumenSemana = Math.round(volumenSemanaBase);
        volumenSemana = Math.min(720, Math.max(180, volumenSemana));

        const intensidadTotal = ajusteIntensidad * intensidadOnd;

        const distribucion = distribucionPersonalizada[nivelActual][fase.toLowerCase()];
        const minutosPorTipo = {
          rodaje: Math.round(volumenSemana * distribucion.rodaje),
          tempo: Math.round(volumenSemana * distribucion.tempo),
          series: Math.round(volumenSemana * distribucion.series),
          largo: Math.round(volumenSemana * distribucion.largo)
        };
        let suma = minutosPorTipo.rodaje + minutosPorTipo.tempo + minutosPorTipo.series + minutosPorTipo.largo;
        if (suma !== volumenSemana) {
          const diff = volumenSemana - suma;
          minutosPorTipo.rodaje += diff;
        }

        const tiposPorDia = {};
        const diasDisponibles = [...diasEntreno];
        
        if (minutosPorTipo.largo > 0) {
          let largoMinimo = 45;
          if (fase === 'CONSTRUCCION') largoMinimo = 60;
          if (fase === 'ESPECIFICA' || fase === 'PICO') largoMinimo = 90;
          if (minutosPorTipo.largo < largoMinimo) minutosPorTipo.largo = largoMinimo;
          const maxLargo = this.getMaximosPorTipo('largo', nivelActual, fase, distancia);
          minutosPorTipo.largo = Math.min(minutosPorTipo.largo, maxLargo);
          const esSimulacion = this.debeHacerSimulacion(fase, semanaGlobal, semanasTotales, distancia, nivelActual, objetivo);
          tiposPorDia[diaLargo] = { tipo: 'largo', minutos: minutosPorTipo.largo, esSimulacion };
          const index = diasDisponibles.indexOf(diaLargo);
          if (index > -1) diasDisponibles.splice(index, 1);
        }

        const tiposCalidad = [];
        if (minutosPorTipo.tempo > 0) tiposCalidad.push({ tipo: 'tempo', minutos: minutosPorTipo.tempo });
        if (minutosPorTipo.series > 0) tiposCalidad.push({ tipo: 'series', minutos: minutosPorTipo.series });
        
        let diasLibres = [...diasDisponibles];
        if (tiposCalidad.length > 0 && diasLibres.length > 0) {
          const numCalidad = tiposCalidad.length;
          let step = Math.floor(diasLibres.length / numCalidad);
          if (step < 1) step = 1;
          let indicesAsignados = [];
          for (let i = 0; i < numCalidad; i++) {
            let idx = Math.min(i * step, diasLibres.length - 1);
            if (i > 0 && idx === indicesAsignados[i-1] + 1 && diasLibres.length > numCalidad) {
              idx = Math.min(idx + 1, diasLibres.length - 1);
            }
            indicesAsignados.push(idx);
          }
          indicesAsignados.sort((a,b) => a - b);
          for (let i = 0; i < tiposCalidad.length; i++) {
            const dia = diasLibres[indicesAsignados[i]];
            const calidad = tiposCalidad[i];
            const max = this.getMaximosPorTipo(calidad.tipo, nivelActual, fase, distancia);
            const minutosDia = Math.min(calidad.minutos, max);
            tiposPorDia[dia] = { tipo: calidad.tipo, minutos: minutosDia };
            calidad.minutos -= minutosDia;
          }
          diasLibres = diasLibres.filter((_, idx) => !indicesAsignados.includes(idx));
        }

        let minutosRodajeTotal = minutosPorTipo.rodaje;
        tiposCalidad.forEach(q => { if (q.minutos > 0) minutosRodajeTotal += q.minutos; });
        const numDiasRodaje = diasLibres.length;
        if (numDiasRodaje > 0 && minutosRodajeTotal > 0) {
          const maxRodaje = this.getMaximosPorTipo('rodaje', nivelActual, fase, distancia);
          const minRodaje = 35;
          let valores = [];
          let sumaValores = 0;
          let valorBase = minutosRodajeTotal / numDiasRodaje;
          for (let i = 0; i < numDiasRodaje; i++) {
            let variacion = 0.9 + Math.random() * 0.2;
            let valor = Math.round(valorBase * variacion);
            valor = Math.min(maxRodaje, Math.max(minRodaje, valor));
            valores.push(valor);
            sumaValores += valor;
          }
          if (sumaValores !== minutosRodajeTotal) {
            const diff = minutosRodajeTotal - sumaValores;
            for (let i = 0; i < Math.abs(diff); i++) {
              let idx = i % valores.length;
              valores[idx] += Math.sign(diff);
              valores[idx] = Math.min(maxRodaje, Math.max(minRodaje, valores[idx]));
            }
          }
          for (let i = 0; i < numDiasRodaje; i++) {
            const dia = diasLibres[i];
            tiposPorDia[dia] = { tipo: 'rodaje', minutos: valores[i] };
          }
        } else {
          for (let i = 0; i < numDiasRodaje; i++) {
            const dia = diasLibres[i];
            tiposPorDia[dia] = { tipo: 'rodaje', minutos: minRodaje };
          }
        }

        for (let dia of diasLibres) {
          if (!tiposPorDia[dia]) {
            tiposPorDia[dia] = { tipo: 'rodaje', minutos: 35 };
          }
        }

        const diasFuerza = this.seleccionarDiasFuerza(tiposPorDia, diaLargo);

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
              letra: 'D',
              detalle: null,
              tieneFuerza: false
            });
          } else {
            const info = tiposPorDia[diaSemana];
            if (!info) {
              semana.push({
                diaGlobal: diaGlobalCounter++,
                semana: semanaGlobal,
                diaSemana,
                fase,
                nivel: nivelActual,
                tipo: 'descanso',
                color: 'sesion-descanso',
                letra: 'D',
                detalle: null,
                tieneFuerza: false
              });
              continue;
            }
            const { tipo, minutos, esSimulacion } = info;
            const sesion = await this.crearSesionDesdeMatriz(
              { tipo, esSimulacion: esSimulacion || false },
              true,
              fase,
              semanaEnFase,
              nivelActual,
              { modalidad, distancia, ritmoBase, fcUmbral, semanasTotales, semanaGlobal, objetivo },
              ajusteVolumen,
              intensidadTotal,
              minutos
            );
            semana.push({
              diaGlobal: diaGlobalCounter++,
              semana: semanaGlobal,
              diaSemana,
              fase,
              nivel: nivelActual,
              tipo,
              color: this.getColor(tipo),
              letra: this.getLetra(tipo),
              tieneFuerza: false,
              ...sesion
            });
          }
        }

        for (const dia of diasFuerza) {
          const sesion = semana.find(s => s.diaSemana === dia && s.tipo !== 'descanso');
          if (sesion && sesion.detalle) {
            this.agregarFuerzaASesion(sesion);
          }
        }

        planCompleto.push(...semana);
      }

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
          fcUmbral: AppState.lastUL,
          fechaInicio: fechaInicio.toISOString()
        },
        sesiones: planCompleto,
        feedback: {},
        ajustes: {},
        resumen: `${mapaDist[distancia] || distancia} · ${diasEntreno.length} días · Nivel ${nivel}`,
        fechaCreacion: new Date().toISOString()
      };

      await this.guardarPlanEnFirebase(planId, planParaGuardar);

      AppState.planGeneradoActual = planParaGuardar.params;
      AppState.planActualId = planId;
      AppState.sesionesRealizadas = {};
      AppState.trimestreActual = 0;

      const nombreDiaLargo = ["", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"][diaLargo];
      const fechaInicioFormateada = fechaInicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

      document.getElementById("resumenObjetivo").innerHTML = `
        <strong>${mapaDist[distancia]}</strong> · ${diasEntreno.length} DÍAS/SEMANA<br>
        <span style="color: var(--text-secondary); font-size: 13px;">
          ${nivel.toUpperCase()} · OBJ: ${objetivo.toUpperCase()} · 
          🏆 TIRADA LARGA: <strong>${nombreDiaLargo}</strong>
        </span>
        <div style="margin-top: 8px; font-size: 12px; color: var(--accent-yellow);">
          📅 El plan comienza el <strong>${fechaInicioFormateada}</strong> (LUNES)
        </div>
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

  debeHacerSimulacion(fase, semanaGlobal, semanasTotales, distancia, nivel, objetivo) {
    if (fase !== 'ESPECIFICA' && fase !== 'PICO') return false;
    if (!['10k', 'medio', 'maraton'].includes(distancia)) return false;
    if (nivel === 'principiante') return false;
    const semanaEnFase = semanaGlobal - this.obtenerInicioFase(fase, distancia, semanasTotales, objetivo);
    return semanaEnFase % 3 === 0 && semanaEnFase >= 2 && semanaEnFase <= (fase === 'ESPECIFICA' ? 6 : 4);
  },

  obtenerInicioFase(fase, distancia, semanasTotales, objetivo) {
    const fases = this.generarFases(semanasTotales, objetivo, distancia);
    for (let f of fases) {
      if (f.nombre === fase) return f.inicio;
    }
    return 1;
  },

  seleccionarDiasFuerza(tiposPorDia, diaLargo) {
    const candidatos = [];
    for (let dia = 1; dia <= 7; dia++) {
      const sesion = tiposPorDia[dia];
      if (sesion && sesion.tipo === 'rodaje' && dia !== diaLargo) {
        candidatos.push(dia);
      }
    }
    if (candidatos.length < 2) {
      for (let dia = 1; dia <= 7; dia++) {
        const sesion = tiposPorDia[dia];
        if (sesion && (sesion.tipo === 'tempo' || sesion.tipo === 'series') && dia !== diaLargo) {
          if (!candidatos.includes(dia)) candidatos.push(dia);
        }
      }
    }
    if (candidatos.length < 2) {
      for (let dia = 1; dia <= 7; dia++) {
        const sesion = tiposPorDia[dia];
        if (sesion && sesion.tipo !== 'largo' && dia !== diaLargo) {
          if (!candidatos.includes(dia)) candidatos.push(dia);
        }
      }
    }
    return candidatos.slice(0, 2);
  },

  agregarFuerzaASesion(sesion) {
    if (!sesion.detalle) return;
    const fuerzaMinutos = this.DURACION_FUERZA;
    const descripcion = this.DESCRIPCIONES_FUERZA[Math.floor(Math.random() * this.DESCRIPCIONES_FUERZA.length)];
    sesion.detalle.estructura += ` + ${fuerzaMinutos}' fuerza complementaria (${descripcion.nombre})`;
    const pasoFuerza = {
      icono: '🏋️',
      titulo: `FUERZA COMPLEMENTARIA: ${descripcion.nombre}`,
      accion: `${fuerzaMinutos}' de ejercicios de fuerza: ${descripcion.ejercicios}`,
      porque: descripcion.objetivo
    };
    sesion.detalle.pasosDetallados.push(pasoFuerza);
    sesion.tieneFuerza = true;
  },

  async crearSesionDesdeMatriz(sesionBase, esActivo, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad, duracionExacta = null) {
    const { modalidad, distancia, ritmoBase, fcUmbral, semanasTotales, semanaGlobal, objetivo } = datos;
    const tipo = sesionBase.tipo;
    const esSimulacion = sesionBase.esSimulacion || false;

    if (esSimulacion && tipo === 'largo' && (fase === 'ESPECIFICA' || fase === 'PICO')) {
      return this.crearSesionSimulacion(fase, semanaEnFase, nivel, datos, duracionExacta);
    }

    if (tipo === 'series' && (nivel !== 'principiante' || fase !== 'BASE')) {
      const estructuras = ['piramide', 'rotas', 'fartlek', 'cuestas'];
      let estructura = estructuras[Math.floor(Math.random() * estructuras.length)];
      if (modalidad === 'trail' && Math.random() < 0.5) estructura = 'cuestas';
      return this.crearSesionAvanzadaSeries(estructura, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad, duracionExacta);
    }

    const dbTipo = this.ENTRENAMIENTOS[modalidad]?.[distancia]?.[nivel]?.[tipo];
    let sesionMatriz = null;
    if (dbTipo?.length) {
      const ultima = this.ultimaSesionPorTipo[tipo];
      let candidatas = dbTipo;
      if (ultima) {
        candidatas = dbTipo.filter(s => s.nombre !== ultima);
      }
      if (candidatas.length === 0) candidatas = dbTipo;
      sesionMatriz = candidatas[Math.floor(Math.random() * candidatas.length)];
      this.ultimaSesionPorTipo[tipo] = sesionMatriz.nombre;
    }
    if (!sesionMatriz) {
      let nombreBase = '', duracionBase = 45;
      switch(tipo) {
        case 'rodaje': nombreBase = 'Rodaje aeróbico'; duracionBase = 45; break;
        case 'tempo': nombreBase = 'Entrenamiento de tempo'; duracionBase = 45; break;
        case 'series': nombreBase = 'Trabajo de series'; duracionBase = 50; break;
        case 'largo': nombreBase = 'Tirada larga'; duracionBase = 60; break;
      }
      sesionMatriz = { nombre: nombreBase, desc: '', duracion: duracionBase };
    }

    let duracion;
    if (duracionExacta !== null) {
      duracion = duracionExacta;
      const max = this.getMaximosPorTipo(tipo, nivel, fase, distancia);
      if (max) duracion = Math.min(duracion, max);
      const min = (semanaEnFase % 4 === 0 || fase === 'TAPER') ? 35 : 45;
      duracion = Math.max(duracion, min);
    } else {
      duracion = sesionMatriz.duracion || 45;
      duracion = Math.round(duracion * factorVolumen);
      const max = this.getMaximosPorTipo(tipo, nivel, fase, distancia);
      if (max) duracion = Math.min(duracion, max);
      const min = (semanaEnFase % 4 === 0 || fase === 'TAPER') ? 35 : 45;
      duracion = Math.max(duracion, min);
    }

    let calentamiento = Math.round(duracion * 0.15);
    let enfriamiento = Math.round(duracion * 0.1);
    calentamiento = Math.max(10, calentamiento);
    enfriamiento = Math.max(5, enfriamiento);
    if (calentamiento + enfriamiento > duracion) {
      calentamiento = Math.floor(duracion * 0.6);
      enfriamiento = duracion - calentamiento;
    }
    let partePrincipal = duracion - calentamiento - enfriamiento;
    if (partePrincipal < 5 && tipo !== 'descanso') {
      calentamiento = Math.floor(duracion * 0.4);
      enfriamiento = Math.floor(duracion * 0.2);
      partePrincipal = duracion - calentamiento - enfriamiento;
    }

    let pasoPrincipal = {};
    let descripcionPrincipal = '';

    // Usar la nueva función para obtener ritmo objetivo realista
    const obtenerRitmoObjetivo = () => {
      let factor = 1.0;
      if (tipo === 'rodaje') factor = 1.20;
      else if (tipo === 'tempo') factor = 1.05;
      else if (tipo === 'series') {
        if (nivel === 'principiante') factor = 0.92;
        else if (nivel === 'intermedio') factor = 0.88;
        else factor = 0.85;
        if (distancia === '2k') factor *= 0.95;
        else if (distancia === '5k') factor *= 0.97;
        else if (distancia === '10k') factor *= 0.98;
      }
      else if (tipo === 'largo') factor = 1.25;
      return Utils.formatR((ritmoBase / factorIntensidad) * factor);
    };

    const incluirRitmoObjetivo = (tipo === 'largo' && (fase === 'ESPECIFICA' || fase === 'PICO') && 
                                  (datos.distancia === 'medio' || datos.distancia === 'maraton') &&
                                  semanaEnFase > 2 && partePrincipal >= 30);

    if (incluirRitmoObjetivo) {
      const bloqueRitmo = Math.min(Math.round(partePrincipal * 0.4), 45);
      const parteZ2 = partePrincipal - bloqueRitmo;
      const ritmoObjetivoStr = obtenerRitmoObjetivo();
      descripcionPrincipal = `${parteZ2}' Z2 + ${bloqueRitmo}' a ritmo objetivo (${ritmoObjetivoStr} min/km)`;
      pasoPrincipal = {
        icono: '🎯',
        titulo: 'TIRADA CON RITMO OBJETIVO',
        accion: `${parteZ2}' a ritmo aeróbico (Z2) + ${bloqueRitmo}' a ritmo de competición (Z4)`,
        porque: 'Simular las exigencias de la carrera y ganar confianza en el ritmo objetivo.'
      };
    } else {
      switch(tipo) {
        case 'rodaje':
          descripcionPrincipal = `${partePrincipal}' rodaje continuo Z2`;
          pasoPrincipal = {
            icono: '🏃',
            titulo: 'RODAJE CONTINUO',
            accion: `${partePrincipal}' a ritmo aeróbico (Z2), conversación fluida`,
            porque: 'Desarrollar base aeróbica, mejorar eficiencia y quemar grasas.'
          };
          break;
        case 'tempo':
          descripcionPrincipal = `${partePrincipal}' tempo Z3-Z4`;
          pasoPrincipal = {
            icono: '⚡',
            titulo: 'TEMPO',
            accion: `${partePrincipal}' a ritmo sostenido (Z3-Z4), "cómodamente duro"`,
            porque: 'Elevar umbral de lactato, mejorar resistencia a ritmos exigentes.'
          };
          break;
        case 'largo':
          descripcionPrincipal = `${partePrincipal}' tirada larga Z2`;
          pasoPrincipal = {
            icono: '📏',
            titulo: 'TIRADA LARGA',
            accion: `${partePrincipal}' a ritmo aeróbico (Z2), manteniendo buena técnica`,
            porque: 'Aumentar capacidad aeróbica, resistencia específica y confianza.'
          };
          break;
        default:
          descripcionPrincipal = `${partePrincipal}' trabajo principal`;
          pasoPrincipal = {
            icono: '💪',
            titulo: 'TRABAJO PRINCIPAL',
            accion: `${partePrincipal}' a intensidad controlada`,
            porque: 'Mejorar condición física general y adaptaciones específicas.'
          };
      }
    }

    const estructuraDetallada = `${calentamiento}' calentamiento Z1 + ` +
                               `${descripcionPrincipal} + ` +
                               `${enfriamiento}' enfriamiento Z1`;

    const pasosDetallados = [
      {
        icono: '🔥',
        titulo: 'CALENTAMIENTO',
        accion: `${calentamiento}' de trote suave (Z1) + ejercicios de movilidad`,
        porque: 'Preparar músculos, articulaciones y sistema cardiovascular.'
      },
      pasoPrincipal,
      {
        icono: '🧘',
        titulo: 'ENFRIAMIENTO',
        accion: `${enfriamiento}' de trote suave + estiramientos suaves`,
        porque: 'Reducir frecuencia cardíaca, eliminar lactato y acelerar recuperación.'
      }
    ];

    let objetivoTexto = '', porque = '';
    if (tipo === 'descanso') {
      objetivoTexto = 'Recuperación activa';
      porque = 'Permitir que el cuerpo se recupere y asimile el entrenamiento.';
    } else {
      const objetivosPorTipo = {
        rodaje: {
          BASE: 'Construir base aeróbica',
          CONSTRUCCION: 'Mantener volumen con calidad',
          ESPECIFICA: 'Preparar para ritmos de competición',
          PICO: 'Mantener forma sin fatiga',
          TAPER: 'Recuperación activa'
        },
        tempo: {
          BASE: 'Introducir ritmos sostenidos',
          CONSTRUCCION: 'Mejorar umbral de lactato',
          ESPECIFICA: 'Simular ritmos de competición',
          PICO: 'Ajustar ritmos objetivo',
          TAPER: 'Mantener agilidad'
        },
        series: {
          BASE: 'Desarrollar velocidad básica',
          CONSTRUCCION: 'Aumentar tolerancia al lactato',
          ESPECIFICA: 'Estimular VO2max',
          PICO: 'Afinar velocidad específica',
          TAPER: 'Mantener explosividad'
        },
        largo: {
          BASE: 'Aumentar capacidad aeróbica',
          CONSTRUCCION: 'Mejorar resistencia específica',
          ESPECIFICA: 'Simular condiciones de carrera',
          PICO: 'Mantener confianza',
          TAPER: 'Cargar glucógeno'
        }
      };
      objetivoTexto = objetivosPorTipo[tipo]?.[fase] || `Sesión de ${tipo}`;
      porque = this.obtenerPorque(tipo, fase);
    }

    let zonaPrincipal = 'Z2';
    const zonaMatch = pasoPrincipal.accion.match(/Z([1-6])/);
    if (zonaMatch) zonaPrincipal = `Z${zonaMatch[1]}`;
    else if (tipo === 'tempo') zonaPrincipal = 'Z3';
    else if (tipo === 'series') zonaPrincipal = 'Z4';

    // Usar ritmo objetivo realista
    const ritmoObjetivo = obtenerRitmoObjetivo();
    
    let fcObjetivo = '';
    const fcRangos = {
      'Z1': [Math.round(fcUmbral * 0.75), Math.round(fcUmbral * 0.80)],
      'Z2': [Math.round(fcUmbral * 0.80), Math.round(fcUmbral * 0.90)],
      'Z3': [Math.round(fcUmbral * 0.90), Math.round(fcUmbral * 0.95)],
      'Z4': [Math.round(fcUmbral * 0.95), Math.round(fcUmbral * 1.02)],
      'Z5': [Math.round(fcUmbral * 1.02), Math.round(fcUmbral * 1.06)]
    };
    let fcAjuste = Math.min(1.1, factorIntensidad);
    if (zonaPrincipal === 'Z5') {
      fcObjetivo = `> ${Math.round(fcRangos.Z5[0] * fcAjuste)} lpm`;
    } else {
      fcObjetivo = `${Math.round(fcRangos[zonaPrincipal][0] * fcAjuste)}-${Math.round(fcRangos[zonaPrincipal][1] * fcAjuste)} lpm`;
    }

    const sensacion = this.obtenerSensacion(tipo, fase);

    let zonaMostrada = zonaPrincipal;
    const zonasEnPasos = pasosDetallados.filter(p => p.titulo !== 'CALENTAMIENTO' && p.titulo !== 'ENFRIAMIENTO')
      .flatMap(p => {
        const matches = [...p.accion.matchAll(/Z([1-6])/g)];
        return matches.map(m => m[1]);
      }).filter(z => z);
    if (zonasEnPasos.length) {
      const numeros = zonasEnPasos.map(z => parseInt(z));
      const maxZona = Math.max(...numeros);
      const minZona = Math.min(...numeros);
      if (minZona === maxZona) {
        zonaMostrada = `Z${maxZona}`;
      } else {
        zonaMostrada = `Z${minZona}-Z${maxZona}`;
      }
    }

    const detalle = {
      nombre: (sesionMatriz ? sesionMatriz.nombre : `${tipo}: ${fase.toLowerCase()}`) || `${tipo}: ${fase.toLowerCase()}`,
      descripcion: (sesionMatriz ? sesionMatriz.desc : `Sesión de ${tipo} en fase ${fase}`) || `Sesión de ${tipo} en fase ${fase}`,
      estructura: estructuraDetallada,
      sensacion: sensacion,
      zona: zonaMostrada,
      duracion: duracion,
      ritmoObjetivo: ritmoObjetivo,
      fcObjetivo: fcObjetivo,
      calentamiento: calentamiento,
      partePrincipal: partePrincipal,
      enfriamiento: enfriamiento,
      objetivo: objetivoTexto,
      porque: porque,
      pasosDetallados: pasosDetallados
    };

    const metricas = this.calcularMetricasSesion({ tipo, duracion, detalle, factorIntensidad });
    detalle.distanciaEstimada = metricas.distanciaTotal;
    detalle.tssEstimada = metricas.tssTotal;

    if (sesionMatriz && sesionMatriz.repeticiones) {
      detalle.repeticiones = sesionMatriz.repeticiones;
      detalle.distanciaSerie = sesionMatriz.distanciaSerie;
    }

    return { tipo, duracion, detalle };
  },

  crearSesionSimulacion(fase, semanaEnFase, nivel, datos, duracionExacta) {
    const { distancia, ritmoBase, fcUmbral, modalidad } = datos;
    let duracion = duracionExacta || 90;
    const maxLargo = this.getMaximosPorTipo('largo', nivel, fase, distancia);
    duracion = Math.min(duracion, maxLargo);

    let ritmoObjetivoBase = ritmoBase;
    if (distancia === '10k') ritmoObjetivoBase = ritmoBase * 0.98;
    if (distancia === 'medio') ritmoObjetivoBase = ritmoBase * 1.03;
    if (distancia === 'maraton') ritmoObjetivoBase = ritmoBase * 1.07;
    const ritmoObjetivoStr = Utils.formatR(ritmoObjetivoBase);

    const calentamiento = Math.max(15, Math.floor(duracion * 0.15));
    const enfriamiento = Math.max(10, Math.floor(duracion * 0.1));
    let partePrincipal = duracion - calentamiento - enfriamiento;

    const bloqueRitmo = Math.min(20, Math.max(10, Math.floor(partePrincipal / 3)));
    const numBloques = Math.floor(partePrincipal / bloqueRitmo);
    const recuperacion = Math.min(5, Math.floor(bloqueRitmo * 0.3));
    let descripcionBloques = '';
    let accionBloques = '';
    if (numBloques >= 2) {
      descripcionBloques = `${numBloques}x${bloqueRitmo}' a ritmo objetivo (${ritmoObjetivoStr} min/km) con ${recuperacion}' de trote suave entre bloques`;
      accionBloques = `${numBloques} repeticiones de ${bloqueRitmo}' a ritmo de competición, con ${recuperacion}' de recuperación activa entre series.`;
    } else {
      descripcionBloques = `${partePrincipal}' a ritmo objetivo (${ritmoObjetivoStr} min/km)`;
      accionBloques = `${partePrincipal}' continuos a ritmo de competición.`;
    }

    const estructuraDetallada = `${calentamiento}' calentamiento Z1 + ${descripcionBloques} + ${enfriamiento}' enfriamiento Z1`;

    const pasosDetallados = [
      {
        icono: '🔥',
        titulo: 'CALENTAMIENTO',
        accion: `${calentamiento}' de trote suave (Z1) + ejercicios de movilidad + 3 progresiones a ritmo objetivo`,
        porque: 'Preparar el cuerpo para el esfuerzo específico y activar el sistema neuromuscular.'
      },
      {
        icono: '🏁',
        titulo: 'SIMULACIÓN DE COMPETICIÓN',
        accion: accionBloques,
        porque: `Aclimatar al cuerpo al ritmo de carrera, practicar la estrategia de nutrición e hidratación, y ganar confianza.`
      },
      {
        icono: '🍽️',
        titulo: 'NUTRICIÓN E HIDRATACIÓN',
        accion: `Realizar una toma de gel o bebida isotónica cada 30 minutos. Probar la estrategia que usarás el día de la carrera.`,
        porque: 'Entrenar el estómago y evitar sorpresas el día de la competición.'
      },
      {
        icono: '🧘',
        titulo: 'ENFRIAMIENTO',
        accion: `${enfriamiento}' de trote suave + estiramientos suaves`,
        porque: 'Reducir frecuencia cardíaca, eliminar lactato y acelerar recuperación.'
      }
    ];

    const detalle = {
      nombre: `Simulación de ${distancia === '10k' ? '10K' : distancia === 'medio' ? 'Media Maratón' : 'Maratón'}`,
      descripcion: `Sesión que replica las condiciones de la carrera: ritmo, nutrición y estrategia.`,
      estructura: estructuraDetallada,
      sensacion: 'Exigente pero controlado',
      zona: 'Z4 (ritmo de carrera)',
      duracion: duracion,
      ritmoObjetivo: ritmoObjetivoStr,
      fcObjetivo: `> ${Math.round(fcUmbral * 0.95)} lpm`,
      calentamiento: calentamiento,
      partePrincipal: partePrincipal,
      enfriamiento: enfriamiento,
      objetivo: `Simular la competición de ${distancia === '10k' ? '10 km' : distancia === 'medio' ? '21 km' : '42 km'}`,
      porque: 'Ensaya el ritmo, la estrategia y la nutrición para maximizar el rendimiento el día de la carrera.',
      pasosDetallados: pasosDetallados
    };

    const metricas = this.calcularMetricasSesion({ tipo: 'largo', duracion, detalle, factorIntensidad: 1.0 });
    detalle.distanciaEstimada = metricas.distanciaTotal;
    detalle.tssEstimada = metricas.tssTotal;

    return { tipo: 'largo', duracion, detalle };
  },

  crearSesionAvanzadaSeries(estructura, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad, duracionExacta) {
    const { modalidad, distancia, ritmoBase, fcUmbral } = datos;
    let duracion = duracionExacta || 50;
    const maxSeries = this.getMaximosPorTipo('series', nivel, fase, distancia);
    duracion = Math.min(duracion, maxSeries);
    const minSeries = 40;
    duracion = Math.max(duracion, minSeries);

    let calentamiento = Math.max(15, Math.floor(duracion * 0.2));
    let enfriamiento = Math.max(10, Math.floor(duracion * 0.15));
    let partePrincipal = duracion - calentamiento - enfriamiento;

    let nombre = '';
    let descripcion = '';
    let accion = '';
    let porque = '';
    let zona = 'Z4-Z5';
    let pasosDetallados = [];

    // Usar la nueva función para obtener ritmos realistas
    const ritmoRapido = this.obtenerRitmoParaTipo('series', nivel, distancia, ritmoBase, factorIntensidad);
    const ritmoModerado = this.obtenerRitmoParaTipo('rodaje', nivel, distancia, ritmoBase, factorIntensidad);

    switch(estructura) {
      case 'piramide':
        nombre = 'Pirámide de series';
        descripcion = 'Estructura en pirámide ascendente y descendente.';
        const distancias = [200, 400, 600, 800, 600, 400, 200];
        const recuperaciones = [60, 90, 120, 120, 90, 60];
        let textoPir = '';
        for (let i = 0; i < distancias.length; i++) {
          const rec = i < recuperaciones.length ? recuperaciones[i] : 60;
          textoPir += `${distancias[i]}m (rec ${rec}") `;
        }
        accion = `${distancias.length} repeticiones: ${textoPir}. Realiza cada repetición a ritmo rápido (${ritmoRapido} min/km), recuperando caminando o trotando suave.`;
        porque = 'Mejora la capacidad de cambiar de ritmo, la potencia aeróbica y la tolerancia al lactato.';
        pasosDetallados = [
          { icono: '🔥', titulo: 'CALENTAMIENTO', accion: `${calentamiento}' trote suave + ejercicios de movilidad`, porque: 'Preparar el cuerpo.' },
          { icono: '📈', titulo: 'PIRÁMIDE', accion: accion, porque: porque },
          { icono: '🧘', titulo: 'ENFRIAMIENTO', accion: `${enfriamiento}' trote suave + estiramientos`, porque: 'Recuperación.' }
        ];
        break;
      case 'rotas':
        nombre = 'Series rotas (broken sets)';
        descripcion = 'Bloques de series con recuperación parcial entre bloques.';
        const distanciaSerie = distancia === '2k' || distancia === '5k' ? 400 : (distancia === '10k' ? 800 : 1000);
        const repPorBloque = 4;
        const bloques = 2;
        const recIntra = distanciaSerie <= 400 ? 60 : (distanciaSerie <= 800 ? 90 : 120);
        const recEntreBloques = 180;
        accion = `${bloques} bloques de ${repPorBloque}x${distanciaSerie}m a ritmo rápido (${ritmoRapido} min/km) con recuperación de ${recIntra}" entre series y ${Math.floor(recEntreBloques/60)}' entre bloques.`;
        porque = 'Aumenta la capacidad de mantener el ritmo rápido bajo fatiga.';
        pasosDetallados = [
          { icono: '🔥', titulo: 'CALENTAMIENTO', accion: `${calentamiento}' trote suave + ejercicios de movilidad`, porque: 'Preparar el cuerpo.' },
          { icono: '🔄', titulo: 'SERIES ROTAS', accion: accion, porque: porque },
          { icono: '🧘', titulo: 'ENFRIAMIENTO', accion: `${enfriamiento}' trote suave + estiramientos`, porque: 'Recuperación.' }
        ];
        break;
      case 'fartlek':
        nombre = 'Fartlek estructurado';
        descripcion = 'Cambios de ritmo sin parar.';
        const repFartlek = Math.floor(partePrincipal / 2.5);
        const tiempoFuerte = 60;
        const tiempoSuave = 90;
        accion = `${repFartlek} repeticiones de ${tiempoFuerte}" a ritmo fuerte (${ritmoRapido} min/km) + ${tiempoSuave}" a ritmo suave (${ritmoModerado} min/km), continuo.`;
        porque = 'Mejora la capacidad de cambiar de ritmo y la economía de carrera.';
        pasosDetallados = [
          { icono: '🔥', titulo: 'CALENTAMIENTO', accion: `${calentamiento}' trote suave + ejercicios de movilidad`, porque: 'Preparar el cuerpo.' },
          { icono: '🏃‍♂️', titulo: 'FARTLEK', accion: accion, porque: porque },
          { icono: '🧘', titulo: 'ENFRIAMIENTO', accion: `${enfriamiento}' trote suave + estiramientos`, porque: 'Recuperación.' }
        ];
        break;
      case 'cuestas':
        nombre = 'Repeticiones en cuesta';
        descripcion = 'Trabajo de potencia en pendiente.';
        const numCuestas = Math.max(6, Math.floor(partePrincipal / 3));
        const duracionCuesta = 60;
        const recCuesta = 90;
        accion = `${numCuestas} repeticiones de ${duracionCuesta}" en cuesta con desnivel moderado, recuperando trotando suave ${recCuesta}". Esfuerzo máximo.`;
        porque = 'Desarrolla fuerza específica, potencia y mejora la técnica de carrera.';
        pasosDetallados = [
          { icono: '🔥', titulo: 'CALENTAMIENTO', accion: `${calentamiento}' trote suave + ejercicios de movilidad + 2 progresiones en cuesta`, porque: 'Preparar el cuerpo.' },
          { icono: '⛰️', titulo: 'CUESTAS', accion: accion, porque: porque },
          { icono: '🧘', titulo: 'ENFRIAMIENTO', accion: `${enfriamiento}' trote suave + estiramientos`, porque: 'Recuperación.' }
        ];
        break;
      default:
        return this.crearSesionDesdeMatriz({ tipo: 'series' }, true, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad, duracionExacta);
    }

    const detalle = {
      nombre: nombre,
      descripcion: descripcion,
      estructura: `${calentamiento}' calentamiento + ${accion} + ${enfriamiento}' enfriamiento`,
      sensacion: 'Muy intenso',
      zona: zona,
      duracion: duracion,
      ritmoObjetivo: ritmoRapido,
      fcObjetivo: `> ${Math.round(fcUmbral * 1.02)} lpm`,
      calentamiento: calentamiento,
      partePrincipal: partePrincipal,
      enfriamiento: enfriamiento,
      objetivo: nombre,
      porque: porque,
      pasosDetallados: pasosDetallados
    };

    const metricas = this.calcularMetricasSesion({ tipo: 'series', duracion, detalle, factorIntensidad });
    detalle.distanciaEstimada = metricas.distanciaTotal;
    detalle.tssEstimada = metricas.tssTotal;

    return { tipo: 'series', duracion, detalle };
  },

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

  getLetra(tipo) {
    const letras = {
      rodaje: 'R',
      tempo: 'T',
      series: 'S',
      largo: 'L',
      descanso: 'D'
    };
    return letras[tipo] || '?';
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

  obtenerPorque(tipo, fase) {
    const porqueMap = {
      rodaje: {
        BASE: 'Construir la base aeróbica, fundamental para soportar volúmenes mayores.',
        CONSTRUCCION: 'Mantener el volumen mientras se introduce calidad.',
        ESPECIFICA: 'Preparar el cuerpo para los ritmos de competición.',
        PICO: 'Mantener la forma sin generar fatiga adicional.',
        TAPER: 'Activar la circulación y mantener la frescura muscular.'
      },
      tempo: {
        BASE: 'Introducir el cuerpo a ritmos sostenidos por encima del aeróbico.',
        CONSTRUCCION: 'Elevar el umbral de lactato para poder mantener ritmos más rápidos.',
        ESPECIFICA: 'Simular los ritmos de carrera y acostumbrar al cuerpo a la fatiga.',
        PICO: 'Ajustar el ritmo objetivo y ganar confianza.',
        TAPER: 'Mantener la agilidad sin acumular ácido láctico.'
      },
      series: {
        BASE: 'Desarrollar velocidad básica y eficiencia neuromuscular.',
        CONSTRUCCION: 'Aumentar la tolerancia al lactato y la capacidad de eliminar desechos.',
        ESPECIFICA: 'Estimular el VO2máx y mejorar la potencia aeróbica.',
        PICO: 'Afinar la velocidad específica para la distancia objetivo.',
        TAPER: 'Mantener la explosividad sin fatiga.'
      },
      largo: {
        BASE: 'Aumentar la capacidad aeróbica y la resistencia general.',
        CONSTRUCCION: 'Mejorar la resistencia específica para la distancia objetivo.',
        ESPECIFICA: 'Simular las condiciones de carrera (ritmo, nutrición, hidratación).',
        PICO: 'Mantener la confianza y la resistencia sin llegar al agotamiento.',
        TAPER: 'Cargar los depósitos de glucógeno y mantener la motivación.'
      }
    };
    return porqueMap[tipo]?.[fase] || 'Sesión clave para el desarrollo del plan.';
  },

  obtenerSensacion(tipo, fase) {
    const sensaciones = {
      rodaje: { BASE: 'Cómodo', CONSTRUCCION: 'Controlado', ESPECIFICA: 'Activo', PICO: 'Exigente', TAPER: 'Muy suave' },
      tempo: { BASE: 'Fuerte', CONSTRUCCION: 'Exigente', ESPECIFICA: 'Muy exigente', PICO: 'Límite', TAPER: 'Suave' },
      series: { BASE: 'Rápidas', CONSTRUCCION: 'Intensas', ESPECIFICA: 'Muy intensas', PICO: 'Máximas', TAPER: 'Suaves' },
      largo: { BASE: 'Resistencia', CONSTRUCCION: 'Fondo', ESPECIFICA: 'Calidad', PICO: 'Simulación', TAPER: 'Ligero' }
    };
    return sensaciones[tipo]?.[fase] || 'Controlado';
  },

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
    const duracionMeses = AppState.planGeneradoActual?.duracion || 3;
    const semanasTotales = duracionMeses * 4;
    const totalPaginas = Math.ceil(semanasTotales / 12);
    if (totalPaginas > 1) {
      navegacion.style.display = 'grid';
      this.actualizarNavegacionTrimestral(totalPaginas);
    } else {
      navegacion.style.display = 'none';
    }
    this.renderizarPagina(sesiones, semanasTotales);
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

  renderizarPagina(sesiones, semanasTotales) {
    const grid = document.getElementById("calendarioGrid");
    if (!grid) return;
    const semanasPorPagina = 12;
    const inicioPagina = AppState.trimestreActual * semanasPorPagina;
    const finPagina = Math.min(inicioPagina + semanasPorPagina, semanasTotales);
    const semanasAMostrar = finPagina - inicioPagina;
    if (semanasAMostrar <= 0) return;
    const celdas = new Array(semanasAMostrar * 7).fill(null);
    for (let i = 0; i < sesiones.length; i++) {
      const sesion = sesiones[i];
      if (!sesion) continue;
      const semanaSesion = sesion.semana - 1;
      if (semanaSesion >= inicioPagina && semanaSesion < finPagina) {
        const pos = (semanaSesion - inicioPagina) * 7 + (sesion.diaSemana - 1);
        if (pos >= 0 && pos < celdas.length) {
          celdas[pos] = sesion;
        }
      }
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
      let contenidoHtml = '';
      if (sesion.tipo !== 'descanso' && sesion.detalle) {
        const tiempo = sesion.duracion || '?';
        let letra = sesion.letra;
        if (sesion.tieneFuerza) letra += '+F';
        contenidoHtml = `<strong>${letra}</strong><div>${tiempo}'</div>`;
      } else {
        contenidoHtml = `<strong>D</strong><div>—</div>`;
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

  actualizarNavegacionTrimestral(totalPaginas) {
    const paginaSpan = document.getElementById('calendarioPagina');
    const anteriorBtn = document.getElementById('calendarioAnterior');
    const siguienteBtn = document.getElementById('calendarioSiguiente');
    if (paginaSpan) paginaSpan.innerText = `PÁGINA ${AppState.trimestreActual + 1}/${totalPaginas}`;
    if (anteriorBtn) anteriorBtn.disabled = AppState.trimestreActual === 0;
    if (siguienteBtn) siguienteBtn.disabled = AppState.trimestreActual === totalPaginas - 1;
  },

  async cambiarTrimestre(delta) {
    const duracionMeses = AppState.planGeneradoActual?.duracion || 3;
    const semanasTotales = duracionMeses * 4;
    const totalPaginas = Math.ceil(semanasTotales / 12);
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
            this.renderizarPagina(planCompleto.sesiones, semanasTotales);
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
    const feedbackContainer = document.getElementById("sesionFeedbackContainer");
    wrapper.className = "modal-content";
    if (sesion.tipo !== 'descanso' && sesion.detalle) {
      wrapper.classList.add(sesion.color);
      let icono = "";
      if (sesion.tipo === 'rodaje') icono = "🏃‍♂️";
      else if (sesion.tipo === 'tempo') icono = "⚡";
      else if (sesion.tipo === 'series') icono = "🔁";
      else if (sesion.tipo === 'largo') icono = "📏";
      const faseTexto = sesion.fase ? ` · ${this.FASES[sesion.fase]?.nombre || sesion.fase}` : '';
      titulo.innerText = `${icono} ${sesion.tipo.toUpperCase()}${faseTexto}: ${sesion.detalle.nombre}`;
      const metricas = this.calcularMetricasSesion(sesion);
      const tiempoTotal = this.formatearTiempo(sesion.duracion);
      const headerHTML = `
        <div class="sesion-resumen-horizontal">
          <div class="resumen-item"><span>🕒</span> ${tiempoTotal}</div>
          <div class="resumen-item"><span>📏</span> ${metricas.distanciaTotal.toFixed(2)} km</div>
          <div class="resumen-item"><span>⚡</span> ${metricas.tssTotal} TSS</div>
        </div>
      `;
      const objetivoHTML = `
        <div class="sesion-objetivo-principal">
          <h4>🎯 OBJETIVO PRINCIPAL</h4>
          <p><strong>${sesion.detalle.objetivo || 'Sesión de calidad'}</strong></p>
          <p class="porque">${sesion.detalle.porque || ''}</p>
        </div>
      `;
      const zonasHTML = `
        <div class="sesion-zonas">
          <div class="zona-item"><span>⏱️ Ritmo</span><strong>${sesion.detalle.ritmoObjetivo} min/km</strong></div>
          <div class="zona-item"><span>❤️ FC</span><strong>${sesion.detalle.fcObjetivo}</strong></div>
          <div class="zona-item"><span>😌 Sensación</span><strong>${sesion.detalle.sensacion}</strong></div>
          <div class="zona-item"><span>📊 Zona</span><strong>${sesion.detalle.zona}</strong></div>
        </div>
      `;
      let pasosHTML = '<div class="sesion-estructura-detallada">';
      if (sesion.detalle.pasosDetallados && sesion.detalle.pasosDetallados.length > 0) {
        sesion.detalle.pasosDetallados.forEach(paso => {
          pasosHTML += `
            <div class="paso-detalle-sesion">
              <div class="paso-header"><span>${paso.icono}</span><strong>${paso.titulo}</strong></div>
              <p class="paso-accion">${paso.accion}</p>
              <p class="paso-porque"><em>${paso.porque}</em></p>
            </div>
          `;
        });
      } else if (sesion.detalle.estructura) {
        const partes = sesion.detalle.estructura.split('+').map(p => p.trim());
        partes.forEach((parte, index) => {
          let iconoPaso = '', tituloPaso = '';
          if (parte.toLowerCase().includes('calentamiento')) {
            iconoPaso = '🔥';
            tituloPaso = 'CALENTAMIENTO';
          } else if (parte.toLowerCase().includes('enfriamiento')) {
            iconoPaso = '🧘';
            tituloPaso = 'ENFRIAMIENTO';
          } else {
            iconoPaso = '💪';
            tituloPaso = 'PARTE PRINCIPAL';
          }
          pasosHTML += `
            <div class="paso-detalle-sesion">
              <div class="paso-header"><span>${iconoPaso}</span><strong>${tituloPaso}</strong></div>
              <p class="paso-accion">${parte}</p>
            </div>
          `;
        });
      }
      pasosHTML += '</div>';
      descripcion.innerHTML = headerHTML + objetivoHTML + zonasHTML + pasosHTML;
      checkboxContainer.style.display = 'flex';
      checkbox.checked = AppState.sesionesRealizadas?.[diaIndex] || false;
      checkbox.onchange = async (e) => { await this.marcarSesionRealizada(diaIndex, e.target.checked); };
      feedbackContainer.style.display = 'block';
      this.mostrarFeedbackExistente(diaIndex);
      const feedbackButtons = feedbackContainer.querySelectorAll('.feedback-btn');
      feedbackButtons.forEach(btn => {
        btn.onclick = async (e) => {
          const valor = e.target.getAttribute('data-value');
          await this.guardarFeedback(diaIndex, valor);
        };
      });
    } else {
      wrapper.classList.add('sesion-descanso');
      titulo.innerText = "😴 DESCANSO";
      const objetivoDescanso = this.obtenerObjetivoDescanso(sesion);
      const porqueDescanso = this.obtenerPorqueDescanso(sesion);
      descripcion.innerHTML = `
        <div class="descanso-container">
          <div class="descanso-icono">😴</div>
          <p class="descanso-texto">Día de descanso</p>
          <div class="descanso-objetivo">
            <h4>🎯 OBJETIVO</h4>
            <p>${objetivoDescanso}</p>
            <p class="porque">${porqueDescanso}</p>
          </div>
          <ul class="descanso-recomendaciones">
            <li>🧘 Estiramientos suaves</li>
            <li>🌀 Foam roller</li>
            <li>🚶 Paseo activo</li>
            <li>💧 Hidratación adecuada</li>
          </ul>
        </div>
      `;
      checkboxContainer.style.display = 'none';
      feedbackContainer.style.display = 'none';
    }
    modal.classList.add("visible");
    overlay.classList.add("visible");
  },

  async guardarFeedback(diaIndex, valor) {
    if (!AppState.currentUserId || !AppState.planActualId) return;
    try {
      if (!AppState.feedbackSesiones) AppState.feedbackSesiones = {};
      AppState.feedbackSesiones[diaIndex] = valor;
      const planRef = firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(AppState.planActualId);
      await planRef.update({ [`feedback.${diaIndex}`]: valor });
      const feedbackContainer = document.getElementById("sesionFeedbackContainer");
      if (feedbackContainer) {
        const buttons = feedbackContainer.querySelectorAll('.feedback-btn');
        buttons.forEach(btn => {
          if (btn.getAttribute('data-value') === valor) {
            btn.style.background = 'var(--accent-blue)';
            btn.style.color = 'var(--bg-primary)';
          } else {
            btn.style.background = '';
            btn.style.color = '';
          }
        });
      }
      Utils.showToast('✅ Feedback guardado', 'success');
    } catch (error) {
      console.error('Error guardando feedback:', error);
      Utils.showToast('Error al guardar feedback', 'error');
    }
  },

  mostrarFeedbackExistente(diaIndex) {
    const feedbackContainer = document.getElementById("sesionFeedbackContainer");
    if (!feedbackContainer) return;
    const valor = AppState.feedbackSesiones?.[diaIndex];
    if (!valor) return;
    const buttons = feedbackContainer.querySelectorAll('.feedback-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-value') === valor) {
        btn.style.background = 'var(--accent-blue)';
        btn.style.color = 'var(--bg-primary)';
      } else {
        btn.style.background = '';
        btn.style.color = '';
      }
    });
  },

  obtenerObjetivoDescanso(sesion) {
    const fase = sesion.fase || 'BASE';
    const objetivosDescanso = {
      BASE: 'Recuperación activa tras el volumen de base',
      CONSTRUCCION: 'Asimilar las cargas de construcción',
      ESPECIFICA: 'Prepararse para las sesiones específicas',
      PICO: 'Descargar antes del pico de forma',
      TAPER: 'Máxima recuperación antes de la competición'
    };
    return objetivosDescanso[fase] || 'Recuperación y asimilación del entrenamiento';
  },

  obtenerPorqueDescanso(sesion) {
    const fase = sesion.fase || 'BASE';
    const porqueDescanso = {
      BASE: 'El descanso permite que el sistema cardiovascular se adapte al volumen.',
      CONSTRUCCION: 'Los días de descanso evitan la acumulación de fatiga y previenen lesiones.',
      ESPECIFICA: 'Las sesiones de calidad requieren días de descanso para llegar en óptimas condiciones.',
      PICO: 'El descanso es clave para alcanzar el pico de forma.',
      TAPER: 'Durante el taper, el descanso permite la supercompensación.'
    };
    return porqueDescanso[fase] || 'El descanso es parte fundamental del entrenamiento.';
  },

  async marcarSesionRealizada(diaIndex, realizada) {
    if (!AppState.currentUserId || !AppState.planActualId) return;
    try {
      const planRef = firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(AppState.planActualId);
      await planRef.update({ [`sesionesRealizadas.${diaIndex}`]: realizada });
      if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
      AppState.sesionesRealizadas[diaIndex] = realizada;
      const celda = document.querySelector(`.calendario-dia[data-index="${diaIndex}"]`);
      if (celda) {
        if (realizada) celda.classList.add('realizado');
        else celda.classList.remove('realizado');
      }
      if (realizada) {
        const planDoc = await planRef.get();
        const planCompleto = planDoc.data();
        const sesion = planCompleto.sesiones[diaIndex - 1];
        if (sesion) {
          const metricas = this.calcularMetricasSesion(sesion);
          const entry = {
            friendUid: AppState.currentUserId,
            friendUsername: AppState.currentUser,
            trainingDate: new Date().toISOString(),
            trainingType: sesion.tipo,
            duration: sesion.duracion,
            distancia: metricas.distanciaTotal,
            tss: metricas.tssTotal,
            planId: AppState.planActualId,
            sesionIndex: diaIndex,
            timestamp: firebaseServices.Timestamp.now(),
            leido: false
          };
          await Storage.addToFeed(AppState.currentUserId, entry);
        }
      }
      Utils.showToast(realizada ? '✅ Sesión marcada' : '📝 Sesión desmarcada', 'success');
    } catch (error) {
      console.error('Error marcando sesión:', error);
      Utils.showToast('Error al marcar la sesión', 'error');
    }
  },

  formatearTiempo(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = Math.floor(minutos % 60);
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    } else {
      return `${mins} min`;
    }
  },

  calcularMetricasSesion(sesion, factorIntensidad = 1.0) {
    if (!sesion.detalle) return { distanciaTotal: 0, tssTotal: 0 };
    const ritmoBase = AppState.planGeneradoActual?.ritmoBase || AppState.lastRitmoBase;
    const fcUmbral = AppState.planGeneradoActual?.fcUmbral || AppState.lastUL;
    if (!ritmoBase || !fcUmbral) return { distanciaTotal: 0, tssTotal: 0 };
    if (sesion.tipo === 'strength') return { distanciaTotal: 0, tssTotal: 0 };
    const zona = sesion.detalle.zona?.split('-')[0] || 'Z2';
    const factoresRitmo = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95 };
    const factoresIF = { 'Z1': 0.6, 'Z2': 0.7, 'Z3': 0.85, 'Z4': 0.95, 'Z5': 1.05 };
    const factorRitmo = factoresRitmo[zona] || 1.25;
    const ritmoMin = ritmoBase * factorRitmo / factorIntensidad;
    const distanciaTotal = sesion.duracion / ritmoMin;
    const ifactor = factoresIF[zona] || 0.7;
    const tssTotal = Math.round(sesion.duracion * ifactor * ifactor * factorIntensidad);
    return { distanciaTotal, tssTotal };
  },

  async mostrarUltimoPlanGuardado() {
    if (!AppState.currentUserId) {
      Utils.showToast("> NO HAY USUARIO_", 'error');
      return;
    }
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(AppState.currentUserId).get();
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
      AppState.feedbackSesiones = planCompleto.feedback || {};
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
    if (!AppState.isPremium) {
      Utils.showToast("> SOLO PREMIUM PUEDE ELIMINAR PLANES_", 'error');
      return;
    }
    const confirmed = await Utils.confirm('ELIMINAR PLAN', "> ¿ELIMINAR PLAN GUARDADO?_");
    if (!confirmed) return;
    Utils.showLoading();
    try {
      await firebaseServices.db.collection('users').doc(AppState.currentUserId).update({ ultimoPlanId: null });
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

  toggleCuestionario() {
    const cuestionario = document.getElementById('cuestionarioEntreno');
    if (cuestionario) {
      const isVisible = cuestionario.style.display !== 'none';
      cuestionario.style.display = isVisible ? 'none' : 'block';
    }
  },

  async analizarFeedbackAdaptativo() {
    if (!AppState.currentUserId || !AppState.planActualId) return { volumen: 1.0, intensidad: 1.0 };
    try {
      const planDoc = await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(AppState.planActualId)
        .get();
      if (!planDoc.exists) return { volumen: 1.0, intensidad: 1.0 };
      const feedback = planDoc.data().feedback || {};
      const valores = Object.values(feedback);
      if (valores.length === 0) return { volumen: 1.0, intensidad: 1.0 };
      const counts = { 1:0, 2:0, 3:0, 4:0 };
      valores.forEach(v => { if (counts[v] !== undefined) counts[v]++; });
      const total = valores.length;
      const muyDuraRatio = counts[1] / total;
      const excelenteRatio = counts[4] / total;
      let volumen = 1.0;
      let intensidad = 1.0;
      if (muyDuraRatio > 0.3) {
        volumen = 0.9;
        intensidad = 0.9;
        Utils.showToast('⚠️ Se han detectado sesiones muy duras. Reducimos la carga de las próximas semanas.', 'warning');
      } else if (excelenteRatio > 0.5) {
        volumen = 1.05;
        intensidad = 1.05;
        Utils.showToast('🔥 ¡Excelente rendimiento! Aumentamos ligeramente la carga.', 'success');
      }
      return { volumen, intensidad };
    } catch (error) {
      console.error('Error analizando feedback:', error);
      return { volumen: 1.0, intensidad: 1.0 };
    }
  }
};

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

console.log('✅ PlanGenerator v2.17 - Corregido cálculo de ritmo rápido para series');