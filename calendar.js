// ============================================================================
// calendar.js - VERSIÓN STABLE (SIN FECHA DE INICIO)
// CORREGIDO: sensación siempre según fase, zona a partir de pasos.
// ============================================================================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},

  FASES: {
    BASE: { nombre: 'Base', color: '#8AA0B0', intensidad: 0.7, volumen: 0.8 },
    CONSTRUCCION: { nombre: 'Construcción', color: '#9BB5A0', intensidad: 0.85, volumen: 0.9 },
    ESPECIFICA: { nombre: 'Específica', color: '#C9A78B', intensidad: 0.95, volumen: 1.0 },
    PICO: { nombre: 'Pico', color: '#C99BA5', intensidad: 1.0, volumen: 0.8 },
    TAPER: { nombre: 'Taper', color: '#9AA5A5', intensidad: 0.6, volumen: 0.5 }
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

      // Inicializar feedback de sesiones
      AppState.feedbackSesiones = {};

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
              letra: 'D',
              detalle: null
            });
          } else {
            const tipo = tiposPorDia[diaSemana];
            const sesion = await this.crearSesionDesdeMatriz(
              { tipo },
              true,
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
              letra: this.getLetra(tipo),
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
        feedback: {},
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
  // FUNCIONES AUXILIARES
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

  calcularFactorVolumen(fase, semanaEnFase, duracionFase, esDescarga) {
    const factorBase = this.FASES[fase].volumen;
    const progreso = semanaEnFase / duracionFase;
    let factor = factorBase * (0.9 + progreso * 0.2);
    if (esDescarga) factor *= 0.7;
    return Math.min(1.2, Math.max(0.5, factor));
  },

  calcularFactorIntensidad(fase, semanaEnFase, duracionFase, esDescarga) {
    const factorBase = this.FASES[fase].intensidad;
    const progreso = semanaEnFase / duracionFase;
    let factor = factorBase * (0.95 + progreso * 0.1);
    if (esDescarga) factor *= 0.8;
    return Math.min(1.1, Math.max(0.5, factor));
  },

  /**
   * Crea una sesión desde la matriz de entrenamientos
   * Añade campos objetivo, porque y pasosDetallados para el nuevo detalle
   * CORREGIDO: sensación según fase, zona a partir de pasos, textos limpios.
   */
  async crearSesionDesdeMatriz(sesionBase, esActivo, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad) {
    const { modalidad, distancia, ritmoBase, fcUmbral } = datos;
    const tipo = sesionBase.tipo;

    const LIMITES = { rodaje: 90, tempo: 75, series: 120, largo: 210 };

    const dbTipo = this.ENTRENAMIENTOS[modalidad]?.[distancia]?.[nivel]?.[tipo];
    let sesionMatriz = null;
    
    if (dbTipo?.length) {
      sesionMatriz = dbTipo[Math.floor(Math.random() * dbTipo.length)];
    }

    if (!sesionMatriz) {
      let nombreBase = '';
      let duracionBase = 45;
      switch(tipo) {
        case 'rodaje':
          nombreBase = 'Rodaje aeróbico';
          duracionBase = 45;
          break;
        case 'tempo':
          nombreBase = 'Entrenamiento de tempo';
          duracionBase = 40;
          break;
        case 'series':
          nombreBase = 'Trabajo de series';
          duracionBase = 50;
          break;
        case 'largo':
          nombreBase = 'Tirada larga';
          duracionBase = 75;
          break;
      }
      sesionMatriz = {
        nombre: nombreBase,
        desc: '',
        duracion: duracionBase
      };
    }

    let duracion = sesionMatriz.duracion || 45;
    duracion = Math.round(duracion * factorVolumen);
    if (LIMITES[tipo]) duracion = Math.min(duracion, LIMITES[tipo]);
    duracion = Math.max(duracion, 30);

    const calentamiento = Math.max(10, Math.round(duracion * 0.15));
    const enfriamiento = Math.max(5, Math.round(duracion * 0.1));
    const partePrincipal = duracion - calentamiento - enfriamiento;

    // Generar estructura detallada y pasos
    let estructuraDetallada = '';
    let pasosDetallados = [];
    let objetivo = '';
    let porque = '';

    // Construir pasos según tipo, con textos limpios (sin zonas múltiples)
    let pasoPrincipal = {};
    let descripcionPrincipal = '';

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
      case 'series':
        // Si la matriz tiene series con repeticiones, las usamos
        if (sesionMatriz.repeticiones && sesionMatriz.distanciaSerie) {
          const ritmoSeries = ritmoBase * 0.95;
          const distanciaKm = sesionMatriz.distanciaSerie / 1000;
          const tiempoSeries = Math.round(sesionMatriz.repeticiones * distanciaKm * ritmoSeries);
          descripcionPrincipal = `${tiempoSeries}' series (${sesionMatriz.repeticiones}x${sesionMatriz.distanciaSerie}m) Z4-Z5`;
          pasoPrincipal = {
            icono: '💪',
            titulo: 'SERIES',
            accion: `${tiempoSeries}' de series: ${sesionMatriz.repeticiones} x ${sesionMatriz.distanciaSerie}m a ritmo rápido (Z4-Z5)`,
            porque: 'Mejorar potencia aeróbica, velocidad y capacidad de eliminar lactato.'
          };
        } else {
          descripcionPrincipal = `${partePrincipal}' trabajo de series Z4-Z5`;
          pasoPrincipal = {
            icono: '💪',
            titulo: 'SERIES',
            accion: `${partePrincipal}' de series a alta intensidad (Z4-Z5), recuperaciones completas`,
            porque: 'Estimular el VO2máx y la tolerancia al lactato.'
          };
        }
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

    estructuraDetallada = `${calentamiento}' calentamiento Z1 + ` +
                         `${descripcionPrincipal} + ` +
                         `${enfriamiento}' enfriamiento Z1`;

    pasosDetallados = [
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

    // Definir objetivo y porque según tipo y fase
    if (tipo === 'descanso') {
      objetivo = 'Recuperación activa';
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
      objetivo = objetivosPorTipo[tipo]?.[fase] || `Sesión de ${tipo}`;
      porque = this.obtenerPorque(tipo, fase);
    }

    // Calcular ritmo y FC objetivo
    // Tomamos la zona principal del paso principal (extraemos del texto)
    let zonaPrincipal = 'Z2';
    const zonaMatch = pasoPrincipal.accion.match(/Z([1-6])/);
    if (zonaMatch) zonaPrincipal = `Z${zonaMatch[1]}`;
    else if (tipo === 'tempo') zonaPrincipal = 'Z3';
    else if (tipo === 'series') zonaPrincipal = 'Z4';

    const factoresRitmo = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95 };
    const ritmoObjetivo = Utils.formatR(ritmoBase * (factoresRitmo[zonaPrincipal] || 1.25));
    
    let fcObjetivo = '';
    const fcRangos = {
      'Z1': [Math.round(fcUmbral * 0.75), Math.round(fcUmbral * 0.80)],
      'Z2': [Math.round(fcUmbral * 0.80), Math.round(fcUmbral * 0.90)],
      'Z3': [Math.round(fcUmbral * 0.90), Math.round(fcUmbral * 0.95)],
      'Z4': [Math.round(fcUmbral * 0.95), Math.round(fcUmbral * 1.02)],
      'Z5': [Math.round(fcUmbral * 1.02), Math.round(fcUmbral * 1.06)]
    };
    
    if (zonaPrincipal === 'Z5') {
      fcObjetivo = `> ${fcRangos.Z5[0]} lpm`;
    } else {
      fcObjetivo = `${fcRangos[zonaPrincipal][0]}-${fcRangos[zonaPrincipal][1]} lpm`;
    }

    // La sensación se obtiene siempre de la fase, no de la matriz
    const sensacion = this.obtenerSensacion(tipo, fase);

    // Calcular zona mostrada exclusivamente a partir de los pasos detallados
    let zonaMostrada = zonaPrincipal;
    // Extraer zonas de todos los pasos que no son calentamiento/enfriamiento
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
      nombre: sesionMatriz.nombre || `${tipo}: ${fase.toLowerCase()}`,
      descripcion: sesionMatriz.desc || `Sesión de ${tipo} en fase ${fase}`,
      estructura: estructuraDetallada,
      sensacion: sensacion,
      zona: zonaMostrada,
      duracion: duracion,
      ritmoObjetivo: ritmoObjetivo,
      fcObjetivo: fcObjetivo,
      calentamiento: calentamiento,
      partePrincipal: partePrincipal,
      enfriamiento: enfriamiento,
      objetivo: objetivo,
      porque: porque,
      pasosDetallados: pasosDetallados
    };

    if (sesionMatriz.repeticiones) {
      detalle.repeticiones = sesionMatriz.repeticiones;
      detalle.distanciaSerie = sesionMatriz.distanciaSerie;
    }

    return { tipo, duracion, detalle };
  },

  /**
   * Obtiene el propósito de la sesión según tipo y fase
   */
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

  obtenerZonaPorTipo(tipo) {
    const zonas = { rodaje: 'Z2', tempo: 'Z3-Z4', series: 'Z4-Z5', largo: 'Z2' };
    return zonas[tipo] || 'Z2';
  },

  // ==========================================================================
  // VALIDACIÓN VISUAL
  // ==========================================================================
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

  // ==========================================================================
  // RENDERIZADO DE PÁGINA
  // ==========================================================================
  renderizarPagina(sesiones) {
    const grid = document.getElementById("calendarioGrid");
    if (!grid) return;

    const semanasPorPagina = 12;
    const inicioPagina = AppState.trimestreActual * semanasPorPagina * 7;
    const finPagina = Math.min(inicioPagina + (semanasPorPagina * 7), sesiones.length);

    if (inicioPagina >= sesiones.length) return;

    const diasSemanaAbr = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    
    // Crear array de 7 columnas x 12 filas
    const celdas = new Array(semanasPorPagina * 7).fill(null);

    // Colocar cada sesión en orden
    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];
      if (!sesion) continue;
      
      const pos = i - inicioPagina;
      celdas[pos] = sesion;
    }

    let html = '';

    // Generar grid
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

      // Mostrar letra del tipo arriba y tiempo abajo
      let contenidoHtml = '';
      if (sesion.tipo !== 'descanso' && sesion.detalle) {
        const tiempo = sesion.duracion || '?';
        contenidoHtml = `<strong>${sesion.letra}</strong><div>${tiempo}'</div>`;
      } else {
        contenidoHtml = `<strong>D</strong><div>—</div>`;
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada}" data-index="${sesion.diaGlobal}"${faseIndicator}>${contenidoHtml}</div>`;
    }

    grid.innerHTML = html;
    this.agregarLeyendaFases();

    // Event listeners
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

  /**
   * Abre el modal de detalle de sesión con la nueva estructura mejorada
   */
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

      // Calcular métricas
      const metricas = this.calcularMetricasSesion(sesion);
      const tiempoTotal = this.formatearTiempo(sesion.duracion);

      // Generar HTML para la cabecera horizontal (duración, distancia, TSS)
      const headerHTML = `
        <div class="sesion-resumen-horizontal">
          <div class="resumen-item">
            <span>🕒</span> ${tiempoTotal}
          </div>
          <div class="resumen-item">
            <span>📏</span> ${metricas.distanciaTotal.toFixed(2)} km
          </div>
          <div class="resumen-item">
            <span>⚡</span> ${metricas.tssTotal} TSS
          </div>
        </div>
      `;

      // Objetivo principal
      const objetivoHTML = `
        <div class="sesion-objetivo-principal">
          <h4>🎯 OBJETIVO PRINCIPAL</h4>
          <p><strong>${sesion.detalle.objetivo || 'Sesión de calidad'}</strong></p>
          <p class="porque">${sesion.detalle.porque || ''}</p>
        </div>
      `;

      // Grid de 4 columnas (ritmo, FC, sensación, zona)
      const zonasHTML = `
        <div class="sesion-zonas">
          <div class="zona-item"><span>⏱️ Ritmo</span><strong>${sesion.detalle.ritmoObjetivo} min/km</strong></div>
          <div class="zona-item"><span>❤️ FC</span><strong>${sesion.detalle.fcObjetivo}</strong></div>
          <div class="zona-item"><span>😌 Sensación</span><strong>${sesion.detalle.sensacion}</strong></div>
          <div class="zona-item"><span>📊 Zona</span><strong>${sesion.detalle.zona}</strong></div>
        </div>
      `;

      // Pasos detallados
      let pasosHTML = '<div class="sesion-estructura-detallada">';
      if (sesion.detalle.pasosDetallados && sesion.detalle.pasosDetallados.length > 0) {
        sesion.detalle.pasosDetallados.forEach(paso => {
          pasosHTML += `
            <div class="paso-detalle-sesion">
              <div class="paso-header">
                <span>${paso.icono}</span>
                <strong>${paso.titulo}</strong>
              </div>
              <p class="paso-accion">${paso.accion}</p>
              <p class="paso-porque"><em>${paso.porque}</em></p>
            </div>
          `;
        });
      } else {
        // Fallback
        if (sesion.detalle.estructura) {
          const partes = sesion.detalle.estructura.split('+').map(p => p.trim());
          partes.forEach((parte, index) => {
            let iconoPaso = '';
            let tituloPaso = '';
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
                <div class="paso-header">
                  <span>${iconoPaso}</span>
                  <strong>${tituloPaso}</strong>
                </div>
                <p class="paso-accion">${parte}</p>
              </div>
            `;
          });
        }
      }
      pasosHTML += '</div>';

      let descHtml = headerHTML + objetivoHTML + zonasHTML + pasosHTML;

      descripcion.innerHTML = descHtml;

      // Checkbox para marcar realizada
      checkboxContainer.style.display = 'flex';
      checkbox.checked = AppState.sesionesRealizadas?.[diaIndex] || false;
      checkbox.onchange = async (e) => {
        await this.marcarSesionRealizada(diaIndex, e.target.checked);
      };

      // Feedback container
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
      // Día de descanso (versión mejorada)
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

  /**
   * Guarda el feedback de una sesión en Firestore y en AppState
   */
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

      await planRef.update({
        [`feedback.${diaIndex}`]: valor
      });

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

  /**
   * Muestra el feedback existente para una sesión
   */
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

  /**
   * Obtiene el objetivo para un día de descanso según la fase
   */
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

  /**
   * Obtiene la razón para un día de descanso según la fase
   */
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

  // ==========================================================================
  // MÉTRICAS
  // ==========================================================================
  formatearTiempo(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = Math.floor(minutos % 60);
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    } else {
      return `${mins} min`;
    }
  },

  calcularMetricasSesion(sesion) {
    if (!sesion.detalle) {
      return { distanciaTotal: 0, tssTotal: 0 };
    }

    const ritmoBase = AppState.planGeneradoActual?.ritmoBase || AppState.lastRitmoBase;
    const fcUmbral = AppState.planGeneradoActual?.fcUmbral || AppState.lastUL;
    
    if (!ritmoBase || !fcUmbral) return { distanciaTotal: 0, tssTotal: 0 };

    const zona = sesion.detalle.zona?.split('-')[0] || 'Z2';
    const factoresRitmo = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95 };
    const factoresIF = { 'Z1': 0.6, 'Z2': 0.7, 'Z3': 0.85, 'Z4': 0.95, 'Z5': 1.05 };

    const factorRitmo = factoresRitmo[zona] || 1.25;
    const ritmoMin = ritmoBase * factorRitmo;
    const distanciaTotal = sesion.duracion / ritmoMin;

    const ifactor = factoresIF[zona] || 0.7;
    const tssTotal = Math.round(sesion.duracion * ifactor * ifactor);

    return { distanciaTotal, tssTotal };
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

console.log('✅ PlanGenerator v14.2 - CORREGIDO: sensación según fase, zona desde pasos, textos limpios');