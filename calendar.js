// ============================================================================
// calendar.js - GENERADOR DE PLANES DE ENTRENAMIENTO PROFESIONAL
// Versión: 7.3 - Asignación determinista de tipos (sin aleatoriedad)
// ============================================================================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},

  // ==========================================================================
  // CONSTANTES DE PERIODIZACIÓN
  // ==========================================================================
  FASES: {
    BASE: { nombre: 'Base', color: '#4CAF50', intensidad: 0.7, volumen: 0.8 },
    CONSTRUCCION: { nombre: 'Construcción', color: '#2196F3', intensidad: 0.85, volumen: 0.9 },
    ESPECIFICA: { nombre: 'Específica', color: '#FF9800', intensidad: 0.95, volumen: 1.0 },
    PICO: { nombre: 'Pico', color: '#F44336', intensidad: 1.0, volumen: 0.8 },
    TAPER: { nombre: 'Taper', color: '#9E9E9E', intensidad: 0.6, volumen: 0.5 }
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
  // GENERACIÓN PRINCIPAL
  // ==========================================================================
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

      // --- Recoger inputs ---
      const modalidad = document.getElementById("modalidad").value;
      const distancia = document.getElementById("distObjetivo").value;
      const meses = parseInt(document.getElementById("duracionPlan").value);
      const nivelInicial = document.getElementById("nivel").value;
      const experiencia = document.getElementById("experienciaDistancia").value;
      const objetivo = document.getElementById("objetivoPrincipal").value;
      
      let diaLargoInput = document.getElementById("diaLargo").value;
      let diaLargo;

      // Días marcados (tal cual, sin modificar)
      const diasEntreno = this.obtenerDiasSeleccionados();
      if (diasEntreno.length === 0) throw new Error("SELECCIONA AL MENOS UN DÍA DE ENTRENO");

      // Validar mínimo de días según distancia
      const diasMinimos = this.obtenerDiasMinimos(distancia);
      if (diasEntreno.length < diasMinimos) {
        throw new Error(`Para ${distancia === 'maraton' ? 'maratón' : 'media maratón'} necesitas al menos ${diasMinimos} días de entrenamiento a la semana`);
      }

      // Día largo (automático o elegido)
      if (diaLargoInput === 'auto') {
        diaLargo = this.elegirDiaLargoOptimo(diasEntreno);
        const nombreDia = ["", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"][diaLargo];
        Utils.showToast(`✅ Día de tirada larga seleccionado: ${nombreDia}`, 'info');
      } else {
        diaLargo = parseInt(diaLargoInput);
        if (isNaN(diaLargo) || diaLargo < 1 || diaLargo > 7) {
          Utils.showToast("> SELECCIONA UN DÍA VÁLIDO PARA LA TIRADA LARGA_", 'error');
          Utils.hideLoading();
          return;
        }
      }

      // Si el día largo no está en los días de entreno, lo añadimos (y avisamos)
      if (!diasEntreno.includes(diaLargo)) {
        diasEntreno.push(diaLargo);
        diasEntreno.sort((a, b) => a - b);
        document.getElementById(`dia${diaLargo}`).checked = true;
        Utils.showToast(`📅 Se ha añadido el día ${["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][diaLargo-1]} para la tirada larga`, 'info');
      }

      const fechaInicioStr = document.getElementById("fechaInicio").value;
      if (!fechaInicioStr) throw new Error("SELECCIONA UNA FECHA DE INICIO");
      const fechaInicio = new Date(fechaInicioStr + 'T12:00:00');

      // Validaciones adicionales
      if (meses === 1 && !['2k', '5k', '10k'].includes(distancia)) {
        throw new Error("Plan de 1 mes solo para 2km, 5km y 10km");
      }
      if (['medio', 'maraton'].includes(distancia) && meses === 3 && experiencia === 'no') {
        throw new Error("Para Media o Maratón en 3 meses necesitas experiencia previa");
      }

      // --- Calcular duración total en semanas ---
      const semanasTotales = meses * 4;

      // --- Generar la estructura de fases ---
      const fases = this.generarFases(semanasTotales, objetivo, distancia);

      // --- Preparar datos base ---
      const ritmoBase = AppState.lastRitmoBase;
      const fcUmbral = AppState.lastUL;

      const planCompleto = [];
      let fechaActual = new Date(fechaInicio);

      // --- Bucle principal: semana a semana ---
      for (let semanaGlobal = 1; semanaGlobal <= semanasTotales; semanaGlobal++) {
        const faseInfo = this.obtenerFaseSemana(fases, semanaGlobal);
        const { fase, semanaEnFase, duracionFase } = faseInfo;
        
        const nivelActual = this.calcularNivelSemana(semanaGlobal, nivelInicial, semanasTotales);
        const esDescarga = (semanaEnFase % 4 === 0) || fase === 'TAPER';

        const factorVolumen = this.calcularFactorVolumen(fase, semanaEnFase, duracionFase, esDescarga);
        const factorIntensidad = this.calcularFactorIntensidad(fase, semanaEnFase, duracionFase, esDescarga);

        const distribucion = this.DISTRIBUCION_TIPOS[nivelActual][fase.toLowerCase()];
        
        // Calcular cuántas sesiones de cada tipo tocan esta semana
        const numSesiones = diasEntreno.length;
        const tiposSemana = this.calcularTiposSemana(distribucion, numSesiones, esDescarga, fase);

        // Asignar los tipos a los días concretos (con criterio determinista)
        const tiposPorDia = this.asignarTiposADias(diasEntreno, diaLargo, tiposSemana);

        // Generar los 7 días de la semana
        const semana = [];
        for (let diaSemana = 1; diaSemana <= 7; diaSemana++) {
          const tipo = tiposPorDia[diaSemana] || 'descanso';

          let sesion;
          if (tipo === 'descanso') {
            sesion = {
              tipo: 'descanso',
              color: 'sesion-descanso',
              letra: 'D',
              detalle: null
            };
          } else {
            const sesionBase = { tipo, fromMatrix: true };
            sesion = await this.crearSesionDesdeMatriz(
              sesionBase,
              true,
              fase,
              semanaEnFase,
              nivelActual,
              { modalidad, distancia, ritmoBase, fcUmbral },
              factorVolumen,
              factorIntensidad
            );

            if (diaSemana === diaLargo && tipo === 'largo') {
              sesion = this.aplicarFactorLargo(sesion, fase, semanaEnFase, factorVolumen);
            }

            if (modalidad === 'trail') {
              sesion = this.aplicarFactorDesnivel(sesion, fase, semanaEnFase, factorIntensidad);
            }
          }

          semana.push({
            diaGlobal: (semanaGlobal - 1) * 7 + diaSemana,
            semana: semanaGlobal,
            diaSemana: diaSemana,
            fecha: fechaActual.toISOString(),
            fase: fase,
            nivel: nivelActual,
            ...sesion
          });

          fechaActual.setDate(fechaActual.getDate() + 1);
        }

        planCompleto.push(...semana);
      }

      // --- Guardar el plan ---
      const planId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const mapaDist = { "2k": "2 km", "5k": "5 km", "10k": "10 km", "medio": "MEDIA", "maraton": "MARATÓN" };

      const planParaGuardar = {
        params: {
          modalidad, distancia, duracion: meses, diasPorSemana: diasEntreno.length,
          nivel: nivelInicial, experiencia, objetivo, diaLargo, fechaInicio: fechaInicioStr, diasEntreno, planId,
          ritmoBase: AppState.lastRitmoBase, fcMax: AppState.lastFC, fcUmbral: AppState.lastUL
        },
        sesiones: planCompleto,
        resumen: `${mapaDist[distancia] || distancia} · ${diasEntreno.length} días · Periodización avanzada`,
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
          ${nivelInicial.toUpperCase()} · PERIODIZACIÓN AVANZADA · 
          OBJ: ${objetivo === 'acabar' ? 'TERMINAR' : objetivo === 'mejorar' ? 'MEJORAR' : 'COMPETIR'} · 
          LARGO: ${["", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][diaLargo]} · 
          ${modalidad === 'runner' ? 'ASFALTO' : 'MONTAÑA'} · ${meses} MES(ES)
        </span>
      `;

      document.getElementById("calendarioEntreno").style.display = "block";
      document.getElementById("cuestionarioEntreno").style.display = "none";

      this.mostrarCalendario(planCompleto);

      if (window.UI) await UI.cargarHistorialPlanes();

      Utils.scrollToElement('calendarioEntreno', -20);
      Utils.vibrate(50);
      Utils.playSound('success');
      Utils.launchConfetti();
      Utils.showToast('✅ PLAN PROFESIONAL GENERADO', 'success');

    } catch (error) {
      console.error('Error generando plan:', error);
      Utils.showToast(error.message || 'Error al generar el plan', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ==========================================================================
  // FUNCIONES AUXILIARES DE PERIODIZACIÓN
  // ==========================================================================

  obtenerDiasMinimos(distancia) {
    if (distancia === 'maraton') return 4;
    if (distancia === 'medio') return 3;
    return 2;
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

    if (duracionBase > 0) {
      fases.push({ nombre: 'BASE', inicio: semanaInicio, duracion: duracionBase });
      semanaInicio += duracionBase;
    }
    if (duracionConstruccion > 0) {
      fases.push({ nombre: 'CONSTRUCCION', inicio: semanaInicio, duracion: duracionConstruccion });
      semanaInicio += duracionConstruccion;
    }
    if (duracionEspecifica > 0) {
      fases.push({ nombre: 'ESPECIFICA', inicio: semanaInicio, duracion: duracionEspecifica });
      semanaInicio += duracionEspecifica;
    }
    if (duracionPico > 0) {
      fases.push({ nombre: 'PICO', inicio: semanaInicio, duracion: duracionPico });
      semanaInicio += duracionPico;
    }
    if (duracionTaper > 0) {
      fases.push({ nombre: 'TAPER', inicio: semanaInicio, duracion: duracionTaper });
    }

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

  // ==========================================================================
  // FUNCIONES PARA CALCULAR Y ASIGNAR TIPOS DE SESIÓN (DETERMINISTA)
  // ==========================================================================

  calcularTiposSemana(distribucion, numSesiones, esDescarga, fase) {
    let rodaje = Math.round(distribucion.rodaje * numSesiones);
    let tempo = Math.round(distribucion.tempo * numSesiones);
    let series = Math.round(distribucion.series * numSesiones);
    let largo = Math.round(distribucion.largo * numSesiones);

    const suma = rodaje + tempo + series + largo;
    if (suma > numSesiones) {
      rodaje -= (suma - numSesiones);
    } else if (suma < numSesiones) {
      rodaje += (numSesiones - suma);
    }

    if (esDescarga) {
      tempo = Math.min(tempo, 1);
      series = 0;
    }

    return { rodaje, tempo, series, largo };
  },

  // Nueva función determinista: asigna tipos según criterios de recuperación
  asignarTiposADias(diasEntreno, diaLargo, tiposSemana) {
    // Tipos a asignar (sin contar el largo, que ya tiene su día)
    const tiposDisponibles = [];
    for (let i = 0; i < tiposSemana.rodaje; i++) tiposDisponibles.push('rodaje');
    for (let i = 0; i < tiposSemana.tempo; i++) tiposDisponibles.push('tempo');
    for (let i = 0; i < tiposSemana.series; i++) tiposDisponibles.push('series');

    // Días de entrenamiento excluyendo el día largo
    const otrosDias = diasEntreno.filter(d => d !== diaLargo).sort((a, b) => a - b);

    // Determinar qué días son de descanso (los no marcados)
    const todosDias = [1, 2, 3, 4, 5, 6, 7];
    const diasDescanso = todosDias.filter(d => !diasEntreno.includes(d));

    // Función para saber si un día tiene descanso al día siguiente
    const tieneDescansoDespues = (dia) => {
      let diaSiguiente = dia + 1;
      if (diaSiguiente > 7) diaSiguiente = 1;
      return diasDescanso.includes(diaSiguiente);
    };

    // Función para contar días consecutivos de descanso a partir de un día
    const contarDescansoConsecutivo = (dia) => {
      let count = 0;
      let diaActual = dia;
      while (true) {
        diaActual = diaActual + 1;
        if (diaActual > 7) diaActual = 1;
        if (diasDescanso.includes(diaActual)) {
          count++;
        } else {
          break;
        }
      }
      return count;
    };

    // Ordenar los otros días según criterios: primero los que tienen descanso después,
    // y entre ellos los que tengan más descanso consecutivo
    otrosDias.sort((a, b) => {
      const aDesc = tieneDescansoDespues(a);
      const bDesc = tieneDescansoDespues(b);
      if (aDesc && !bDesc) return -1;
      if (!aDesc && bDesc) return 1;
      // Ambos tienen o no tienen descanso después, comparar cantidad de descanso consecutivo
      const aConsec = contarDescansoConsecutivo(a);
      const bConsec = contarDescansoConsecutivo(b);
      return bConsec - aConsec; // mayor cantidad primero
    });

    // Ordenamos los tipos de mayor a menor calidad (series > tempo > rodaje)
    const seriesCount = tiposDisponibles.filter(t => t === 'series').length;
    const tempoCount = tiposDisponibles.filter(t => t === 'tempo').length;
    const rodajeCount = tiposDisponibles.filter(t => t === 'rodaje').length;

    const tiposOrdenados = [];
    for (let i = 0; i < seriesCount; i++) tiposOrdenados.push('series');
    for (let i = 0; i < tempoCount; i++) tiposOrdenados.push('tempo');
    for (let i = 0; i < rodajeCount; i++) tiposOrdenados.push('rodaje');

    // Asignar a los días ordenados
    const tiposPorDia = {};
    tiposPorDia[diaLargo] = 'largo';

    for (let i = 0; i < otrosDias.length; i++) {
      if (i < tiposOrdenados.length) {
        tiposPorDia[otrosDias[i]] = tiposOrdenados[i];
      } else {
        // Si por algún error hay más días que tipos, asignamos rodaje
        tiposPorDia[otrosDias[i]] = 'rodaje';
      }
    }

    return tiposPorDia;
  },

  // Función auxiliar para mezclar arrays (solo se usa en la biblioteca de sesiones, no en tipos)
  mezclarArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },

  elegirDiaLargoOptimo(diasEntreno) {
    // Prioriza el día cuyo día siguiente NO está en diasEntreno
    const candidatos = diasEntreno.filter(d => !diasEntreno.includes(d % 7 + 1));
    if (candidatos.length > 0) {
      return Math.max(...candidatos);
    }
    if (diasEntreno.includes(6)) return 6;
    if (diasEntreno.includes(7)) return 7;
    return Math.max(...diasEntreno);
  },

  obtenerDiasSeleccionados() {
    const dias = [];
    for (let i = 1; i <= 7; i++) {
      const cb = document.getElementById(`dia${i}`);
      if (cb?.checked) dias.push(i);
    }
    return dias;
  },

  // ==========================================================================
  // CREACIÓN DE SESIONES (con variedad aleatoria en la biblioteca)
  // ==========================================================================
  async crearSesionDesdeMatriz(sesionBase, esActivo, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad) {
    const { modalidad, distancia, ritmoBase, fcUmbral } = datos;
    const tipo = sesionBase.tipo;

    const colores = {
      rodaje: 'sesion-rodaje',
      tempo: 'sesion-tempo',
      series: 'sesion-series',
      largo: 'sesion-largo',
      descanso: 'sesion-descanso'
    };
    const letras = {
      rodaje: 'R',
      tempo: 'T',
      series: 'S',
      largo: 'L',
      descanso: 'D'
    };

    const LIMITES = {
      rodaje: 90,
      tempo: 75,
      series: 120,
      largo: 210
    };

    const dbTipo = this.ENTRENAMIENTOS[modalidad]?.[distancia]?.[nivel]?.[tipo];
    let sesionMatriz = null;
    if (dbTipo?.length) {
      sesionMatriz = dbTipo[Math.floor(Math.random() * dbTipo.length)];
    }

    if (!sesionMatriz) {
      sesionMatriz = {
        nombre: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} base`,
        desc: `Sesión de ${tipo}`,
        duracion: 30,
        estructura: `30' continuos`,
        sensacion: 'Controlado',
        zona: tipo === 'rodaje' ? 'Z2' : tipo === 'tempo' ? 'Z3-Z4' : tipo === 'series' ? 'Z4-Z5' : 'Z2'
      };
    }

    // Validar zona
    if (tipo === 'series') {
      if (sesionMatriz.zona && (sesionMatriz.zona === 'Z2' || sesionMatriz.zona === 'Z3')) {
        sesionMatriz.zona = 'Z4';
      } else if (!sesionMatriz.zona) {
        sesionMatriz.zona = 'Z4';
      }
    } else if (tipo === 'tempo') {
      if (sesionMatriz.zona && sesionMatriz.zona === 'Z2') {
        sesionMatriz.zona = 'Z3';
      } else if (!sesionMatriz.zona) {
        sesionMatriz.zona = 'Z3';
      }
    } else if (tipo === 'rodaje' || tipo === 'largo') {
      if (sesionMatriz.zona && (sesionMatriz.zona === 'Z4' || sesionMatriz.zona === 'Z5')) {
        sesionMatriz.zona = 'Z2';
      } else if (!sesionMatriz.zona) {
        sesionMatriz.zona = 'Z2';
      }
    }

    let duracion;
    let estructuraEscalada;

    if (tipo === 'series' && sesionMatriz.repeticiones && sesionMatriz.distanciaSerie) {
      const calentamiento = 10;
      const enfriamiento = 5;
      const ritmoSeries = ritmoBase * 0.95;
      const distanciaKm = sesionMatriz.distanciaSerie / 1000;
      const tiempoSeries = Math.round(sesionMatriz.repeticiones * distanciaKm * ritmoSeries);
      duracion = calentamiento + tiempoSeries + enfriamiento;
      estructuraEscalada = `${calentamiento}' calentamiento + ${tiempoSeries}' series (${sesionMatriz.repeticiones}x${sesionMatriz.distanciaSerie}m) + ${enfriamiento}' enfriamiento`;
    } else {
      duracion = sesionMatriz.duracion || 30;
      duracion = Math.round(duracion * factorVolumen);
      if (LIMITES[tipo]) duracion = Math.min(duracion, LIMITES[tipo]);
      if (tipo !== 'descanso') duracion = Math.max(duracion, 20);
      const estructuraOriginal = sesionMatriz.estructura || `${duracion}' continuos`;
      estructuraEscalada = this.escalarEstructura(estructuraOriginal, duracion);
    }

    estructuraEscalada = this.normalizarEstructuraConCalentamientoEnfriamiento(estructuraEscalada, duracion, tipo);

    let ritmoObjetivo = '', fcObjetivo = '';
    if (tipo === 'rodaje') {
      ritmoObjetivo = Utils.formatR(ritmoBase * 1.25);
      fcObjetivo = `${Math.round(fcUmbral * 0.85)}-${Math.round(fcUmbral * 0.92)} lpm`;
    } else if (tipo === 'tempo') {
      ritmoObjetivo = Utils.formatR(ritmoBase * 1.05);
      fcObjetivo = `${Math.round(fcUmbral * 0.95)}-${Math.round(fcUmbral * 1.02)} lpm`;
    } else if (tipo === 'series') {
      ritmoObjetivo = Utils.formatR(ritmoBase * 0.95);
      fcObjetivo = `> ${Math.round(fcUmbral * 1.02)} lpm`;
    } else if (tipo === 'largo') {
      ritmoObjetivo = Utils.formatR(ritmoBase * 1.25);
      fcObjetivo = `${Math.round(fcUmbral * 0.80)}-${Math.round(fcUmbral * 0.90)} lpm`;
    }

    const detalle = {
      nombre: sesionMatriz.nombre || `${tipo}: ${sesionBase.variante || 'sesión'}`,
      descripcion: sesionMatriz.desc || sesionMatriz.descripcion || `Sesión de ${tipo}`,
      estructura: estructuraEscalada,
      sensacion: sesionMatriz.sensacion || this.obtenerSensacion(tipo, fase),
      zona: sesionMatriz.zona || this.obtenerZonaPorTipo(tipo),
      duracion: duracion,
      ritmoObjetivo: ritmoObjetivo,
      fcObjetivo: fcObjetivo
    };

    if (sesionMatriz.repeticiones) {
      detalle.repeticiones = sesionMatriz.repeticiones;
    }

    return {
      tipo,
      color: colores[tipo] || 'sesion-descanso',
      letra: letras[tipo] || '?',
      duracion,
      detalle
    };
  },

  normalizarEstructuraConCalentamientoEnfriamiento(estructura, duracionTotal, tipo) {
    const tieneCalentamiento = estructura.toLowerCase().includes('calentamiento');
    const tieneEnfriamiento = estructura.toLowerCase().includes('enfriamiento');
    if (tieneCalentamiento && tieneEnfriamiento) return estructura;

    let calentamiento = Math.min(15, Math.max(5, Math.round(duracionTotal * 0.15)));
    let enfriamiento = Math.min(10, Math.max(5, Math.round(duracionTotal * 0.1)));
    let partePrincipal = duracionTotal - calentamiento - enfriamiento;
    if (partePrincipal < 10) {
      calentamiento = Math.min(10, Math.max(3, Math.round(duracionTotal * 0.2)));
      enfriamiento = Math.min(5, Math.max(3, Math.round(duracionTotal * 0.1)));
      partePrincipal = duracionTotal - calentamiento - enfriamiento;
    }

    if (!tieneCalentamiento && !tieneEnfriamiento) {
      return `${calentamiento}' calentamiento Z1 + ${partePrincipal}' ${tipo} + ${enfriamiento}' enfriamiento Z1`;
    } else if (!tieneCalentamiento) {
      return `${calentamiento}' calentamiento Z1 + ${estructura}`;
    } else if (!tieneEnfriamiento) {
      return `${estructura} + ${enfriamiento}' enfriamiento Z1`;
    }
    return estructura;
  },

  escalarEstructura(estructura, duracionObjetivo) {
    if (!estructura) return `${duracionObjetivo}' continuos`;

    const segmentos = estructura.split('+').map(s => s.trim());
    const partes = [];

    for (let seg of segmentos) {
      const match = seg.match(/^(\d+)'(.*)$/);
      if (match) {
        partes.push({ texto: match[2], minutos: parseInt(match[1]) });
      } else {
        partes.push({ texto: seg, minutos: null });
      }
    }

    const partesConMinutos = partes.filter(p => p.minutos !== null);
    if (partesConMinutos.length === 0) return estructura;

    const sumaOriginal = partesConMinutos.reduce((acc, p) => acc + p.minutos, 0);
    if (sumaOriginal === duracionObjetivo) return estructura;

    const factor = duracionObjetivo / sumaOriginal;
    let nuevaEstructura = '';
    let sumaParcial = 0;

    for (let i = 0; i < partes.length; i++) {
      const p = partes[i];
      if (p.minutos !== null) {
        const restantes = partes.slice(i).filter(p => p.minutos !== null).length;
        let nuevosMinutos;
        if (restantes === 1) {
          nuevosMinutos = duracionObjetivo - sumaParcial;
        } else {
          nuevosMinutos = Math.round(p.minutos * factor);
          sumaParcial += nuevosMinutos;
        }
        nuevosMinutos = Math.max(1, nuevosMinutos);
        nuevaEstructura += `${nuevosMinutos}'${p.texto} + `;
      } else {
        nuevaEstructura += `${p.texto} + `;
      }
    }

    return nuevaEstructura.slice(0, -3);
  },

  aplicarFactorLargo(sesion, fase, semanaEnFase, factorVolumen) {
    const extra = 1.0 + (semanaEnFase * 0.02);
    const nuevaDuracion = Math.min(sesion.duracion * extra, 210);
    return {
      ...sesion,
      duracion: nuevaDuracion,
      detalle: {
        ...sesion.detalle,
        duracion: nuevaDuracion,
        nombre: sesion.detalle.nombre + ' (progresión)'
      }
    };
  },

  aplicarFactorDesnivel(sesion, fase, semanaEnFase, factorIntensidad) {
    if (!sesion.desnivel) return sesion;
    const match = sesion.desnivel.match(/\d+/);
    if (match) {
      const base = parseInt(match[0]);
      const nuevo = Math.min(Math.round(base * factorIntensidad), 2000);
      sesion.desnivel = `+${nuevo}m`;
      if (sesion.detalle) sesion.detalle.desnivel = sesion.desnivel;
    }
    return sesion;
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
      console.log('✅ Plan guardado en Firebase:', planId);
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

    const meses = AppState.planGeneradoActual?.duracion || 3;
    let semanasPorPagina = 13;
    if (meses === 6) semanasPorPagina = 12;
    if (meses === 3) semanasPorPagina = 12;

    const inicioPagina = AppState.trimestreActual * semanasPorPagina * 7;
    const finPagina = Math.min(inicioPagina + (semanasPorPagina * 7), sesiones.length);

    if (inicioPagina >= sesiones.length) return;

    const primeraSesion = sesiones[inicioPagina];
    if (!primeraSesion) return;

    const fechaPrimera = new Date(primeraSesion.fecha);
    let diaSem = fechaPrimera.getDay();
    let offset = diaSem === 0 ? 6 : diaSem - 1;

    let html = '';
    let sesionIndex = inicioPagina;

    for (let i = 0; i < offset; i++) {
      html += '<div class="calendario-dia sesion-descanso"></div>';
    }

    while (sesionIndex < finPagina) {
      const sesion = sesiones[sesionIndex];
      if (!sesion) break;

      const realizada = AppState.sesionesRealizadas?.[sesionIndex] ? 'realizado' : '';

      let bloqueado = false;
      if (!AppState.puedeVerDetalleSesion() && AppState.planGeneradoActual?.fechaInicio) {
        const fechaInicio = new Date(AppState.planGeneradoActual.fechaInicio + 'T12:00:00');
        const fechaSesion = new Date(sesion.fecha);
        const diasTranscurridos = Math.floor((fechaSesion - fechaInicio) / (1000 * 60 * 60 * 24));
        if (diasTranscurridos > 14) bloqueado = true;
      }

      let diaDelMes = '';
      if (sesion.fecha) {
        const fecha = new Date(sesion.fecha);
        diaDelMes = fecha.getDate().toString();
      }

      let faseColor = '';
      if (sesion.fase && this.FASES[sesion.fase]) {
        faseColor = this.FASES[sesion.fase].color;
      }

      const faseIndicator = faseColor ? ` style="border-top: 4px solid ${faseColor};"` : '';

      let contenidoHtml = '';
      if (sesion.tipo !== 'descanso' && sesion.detalle) {
        contenidoHtml = `<strong>${sesion.letra}</strong><div>${diaDelMes}</div>`;
      } else {
        contenidoHtml = `<strong>D</strong><div>${diaDelMes}</div>`;
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada} ${bloqueado ? 'bloqueado' : ''}" data-index="${sesionIndex}"${faseIndicator}>${contenidoHtml}</div>`;

      sesionIndex++;
    }

    const celdasTotales = offset + (finPagina - inicioPagina);
    const resto = celdasTotales % 7;
    if (resto !== 0) {
      for (let i = resto; i < 7; i++) {
        html += '<div class="calendario-dia sesion-descanso"></div>';
      }
    }

    grid.innerHTML = html;

    this.agregarLeyendaFases();

    document.querySelectorAll('.calendario-dia[data-index]').forEach(dia => {
      dia.addEventListener('click', (e) => {
        const diaIndex = e.currentTarget.dataset.index;
        if (diaIndex && sesiones[diaIndex]) {
          if (e.currentTarget.classList.contains('bloqueado')) {
            Utils.showToast('⭐ Hazte premium para ver más detalles', 'warning');
            return;
          }
          this.abrirDetalleSesion(sesiones[diaIndex], parseInt(diaIndex));
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

      let icono = "";
      if (sesion.tipo === 'rodaje') icono = "🏃‍♂️";
      else if (sesion.tipo === 'tempo') icono = "⚡";
      else if (sesion.tipo === 'series') icono = "🔁";
      else if (sesion.tipo === 'largo') icono = "📏";

      const faseTexto = sesion.fase ? ` · ${this.FASES[sesion.fase]?.nombre || sesion.fase}` : '';
      titulo.innerText = `${icono} ${sesion.tipo.toUpperCase()}${faseTexto}: ${sesion.detalle.nombre}`;

      const metricas = this.calcularMetricasSesion(sesion);
      const tiempoTotal = this.formatearTiempo(sesion.duracion);
      const comentarioPrevio = this.generarComentarioPrevio(sesion);
      const pasosHTML = this.generarPasosExplicativos(metricas.pasos, sesion.tipo);

      let descHtml = `
        <div class="sesion-resumen">
          <div><span>🕒</span> ${tiempoTotal}</div>
          <div><span>📏</span> ${metricas.distanciaTotal.toFixed(2)} km</div>
          <div><span>⚡</span> ${metricas.tssTotal} TSS</div>
        </div>
        <div class="sesion-comentarios">
          <h4>📋 COMENTARIOS PREVIOS</h4>
          <p>${comentarioPrevio}</p>
        </div>
        <div class="sesion-pasos">
          <h4>📋 PASOS A SEGUIR</h4>
          ${pasosHTML}
        </div>
      `;

      descripcion.innerHTML = descHtml;

      checkboxContainer.style.display = 'flex';
      checkbox.checked = AppState.sesionesRealizadas?.[diaIndex] || false;
      checkbox.onchange = async (e) => {
        await this.marcarSesionRealizada(diaIndex, e.target.checked);
      };
    } else {
      wrapper.classList.add('sesion-descanso');
      titulo.innerText = "😴 DESCANSO";
      descripcion.innerHTML = `
        <div class="descanso-container">
          <div class="descanso-icono">😴</div>
          <p class="descanso-texto">Día de descanso y recuperación</p>
          <ul class="descanso-recomendaciones">
            <li>🧘 Estiramientos suaves (15-20 min)</li>
            <li>🌀 Foam roller para liberar tensiones</li>
            <li>🚶 Paseo activo de 30-45 minutos</li>
            <li>💧 Hidratación y nutrición adecuada</li>
          </ul>
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

  // ==========================================================================
  // MÉTRICAS Y EXPLICACIONES
  // ==========================================================================
  formatearTiempo(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = Math.floor(minutos % 60);
    const segs = Math.round((minutos - Math.floor(minutos)) * 60);
    if (horas > 0) {
      return `${horas}:${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${segs.toString().padStart(2, '0')}`;
    }
  },

  extraerInfoSeries(parte) {
    const match = parte.match(/(\d+)x(\d+)m/i);
    if (match) {
      return { repeticiones: parseInt(match[1]), distancia: parseInt(match[2]) / 1000 };
    }
    return null;
  },

  calcularMetricasSesion(sesion) {
    if (!sesion.detalle || !sesion.detalle.estructura) {
      return { distanciaTotal: 0, tssTotal: 0, pasos: [] };
    }

    const estructura = sesion.detalle.estructura;
    const ritmoBase = AppState.planGeneradoActual?.ritmoBase || AppState.lastRitmoBase;
    const fcUmbral = AppState.planGeneradoActual?.fcUmbral || AppState.lastUL;
    const zonaSesion = sesion.detalle.zona || 'Z2';
    if (!ritmoBase || !fcUmbral) return { distanciaTotal: 0, tssTotal: 0, pasos: [] };

    const factoresRitmo = {
      'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95, 'Z6': 0.85
    };
    const factoresIF = {
      'Z1': 0.6, 'Z2': 0.7, 'Z3': 0.85, 'Z4': 0.95, 'Z5': 1.05, 'Z6': 1.15
    };
    const fcRangos = {
      'Z1': [Math.round(fcUmbral * 0.75), Math.round(fcUmbral * 0.80)],
      'Z2': [Math.round(fcUmbral * 0.80), Math.round(fcUmbral * 0.90)],
      'Z3': [Math.round(fcUmbral * 0.90), Math.round(fcUmbral * 0.95)],
      'Z4': [Math.round(fcUmbral * 0.95), Math.round(fcUmbral * 1.02)],
      'Z5': [Math.round(fcUmbral * 1.02), Math.round(fcUmbral * 1.06)],
      'Z6': [Math.round(fcUmbral * 1.06), Math.round(fcUmbral * 1.12)]
    };

    const partes = estructura.split('+').map(p => p.trim());
    let distanciaTotal = 0;
    let tssTotal = 0;
    let pasos = [];

    partes.forEach(parte => {
      let zona = null;
      if (parte.includes('Z1')) zona = 'Z1';
      else if (parte.includes('Z2')) zona = 'Z2';
      else if (parte.includes('Z3')) zona = 'Z3';
      else if (parte.includes('Z4')) zona = 'Z4';
      else if (parte.includes('Z5')) zona = 'Z5';
      else if (parte.includes('Z6')) zona = 'Z6';
      else if (parte.toLowerCase().includes('calentamiento')) zona = 'Z1';
      else if (parte.toLowerCase().includes('enfriamiento')) zona = 'Z1';
      else if (parte.toLowerCase().includes('recuperación')) zona = 'Z1';
      
      if (!zona) {
        zona = zonaSesion.split('-')[0];
      }

      const matchTiempo = parte.match(/(\d+)'/);
      if (!matchTiempo) return;
      const minutos = parseInt(matchTiempo[1]);

      const infoSeries = this.extraerInfoSeries(parte);
      let distanciaPaso;
      if (infoSeries) {
        distanciaPaso = infoSeries.repeticiones * infoSeries.distancia;
      } else {
        const factorRitmo = factoresRitmo[zona] || 1.25;
        const ritmoMin = ritmoBase * factorRitmo;
        distanciaPaso = minutos / ritmoMin;
      }
      distanciaTotal += distanciaPaso;

      const ifactor = factoresIF[zona] || 0.7;
      const tssPaso = minutos * ifactor * ifactor;
      tssTotal += tssPaso;

      let fcRange = '';
      if (zona === 'Z5' || zona === 'Z6') {
        fcRange = `> ${fcRangos[zona][0]} lpm`;
      } else {
        fcRange = `${fcRangos[zona][0]}-${fcRangos[zona][1]} lpm`;
      }

      const ritmoMostrar = (infoSeries) 
        ? Utils.formatR(ritmoBase * factoresRitmo[zona])
        : Utils.formatR(ritmoBase * (factoresRitmo[zona] || 1.25));

      pasos.push({
        titulo: parte,
        minutos,
        zona,
        ritmo: ritmoMostrar,
        distancia: distanciaPaso,
        tss: Math.round(tssPaso),
        fc: fcRange,
        esSerie: !!infoSeries,
        repeticiones: infoSeries ? infoSeries.repeticiones : null,
        distanciaSerie: infoSeries ? infoSeries.distancia * 1000 : null
      });
    });

    return { distanciaTotal, tssTotal: Math.round(tssTotal), pasos };
  },

  generarComentarioPrevio(sesion) {
    const tipo = sesion.tipo;
    const nombre = sesion.detalle.nombre || '';
    const descBase = sesion.detalle.descripcion || '';

    const comentarios = {
      rodaje: "Hoy toca un rodaje suave. El objetivo es acumular volumen aeróbico a un ritmo cómodo. Debes ser capaz de mantener una conversación sin esfuerzo. Concéntrate en mantener una zancada relajada y una frecuencia cardíaca estable.",
      tempo: "Sesión de ritmo tempo. El esfuerzo debe ser 'cómodamente duro': puedes decir frases cortas, pero no mantener una conversación. El objetivo es acostumbrar al cuerpo a ritmos de competición.",
      series: "Trabajo de calidad. Las series se corren a un ritmo rápido, con recuperaciones activas (trote suave) entre ellas. Concéntrate en mantener la técnica y el ritmo objetivo en cada repetición. No salgas demasiado rápido.",
      largo: "Tirada larga. El objetivo es la resistencia. Mantén un ritmo conversacional durante la mayor parte del recorrido. Si te sientes bien, puedes progresar ligeramente el ritmo en los últimos kilómetros."
    };

    let comentario = comentarios[tipo] || "Sesión de entrenamiento. Sigue las indicaciones de cada paso y escucha a tu cuerpo.";
    
    if (descBase && !descBase.includes('Sesión de')) {
      comentario += " " + descBase;
    }

    return comentario;
  },

  generarPasosExplicativos(pasos, tipoSesion) {
    if (!pasos || pasos.length === 0) {
      return '<p class="sin-pasos">No hay detalles de pasos</p>';
    }

    let html = '';
    pasos.forEach((paso, index) => {
      const consejo = this.generarConsejoPaso(paso, tipoSesion, index);

      let tituloPaso = paso.titulo;
      if (paso.esSerie && paso.repeticiones) {
        tituloPaso = `${paso.repeticiones} x ${paso.distanciaSerie}m`;
      }

      html += `
        <div class="paso-explicativo">
          <div class="paso-titulo">${index + 1}. ${tituloPaso}</div>
          <div class="paso-detalle">
            <div class="paso-fila"><span class="paso-etiqueta">⏱️ Duración:</span> ${paso.minutos} min</div>
            <div class="paso-fila"><span class="paso-etiqueta">🎯 Ritmo objetivo:</span> ${paso.ritmo} min/km</div>
            <div class="paso-fila"><span class="paso-etiqueta">❤️ Frecuencia cardíaca:</span> ${paso.fc}</div>
            <div class="paso-fila"><span class="paso-etiqueta">📏 Distancia estimada:</span> ${paso.distancia.toFixed(2)} km</div>
          </div>
          <div class="paso-consejo">💬 ${consejo}</div>
        </div>
      `;
    });

    return html;
  },

  generarConsejoPaso(paso, tipoSesion, index) {
    const zona = paso.zona;

    if (paso.titulo.toLowerCase().includes('calentamiento')) {
      return "Muy suave. Prepara músculos y activa la circulación. Debes sentir que puedes hablar sin esfuerzo. Aprovecha para hacer ejercicios de movilidad.";
    }
    if (paso.titulo.toLowerCase().includes('enfriamiento')) {
      return "Trote muy suave para eliminar residuos. Después, no olvides estirar y reponer líquidos.";
    }

    const consejosZona = {
      'Z1': "Esfuerzo muy ligero. Recuperación activa. Debes poder mantener una conversación larga.",
      'Z2': "Ritmo cómodo y controlado. Puedes hablar con frases completas. Es la base de tu resistencia.",
      'Z3': "Ritmo moderadamente fuerte. Puedes decir frases cortas, pero no mantener una charla. Sensación de 'trabajo' pero sin agobio.",
      'Z4': "Ritmo fuerte. Apenas puedes hablar. Es el umbral donde el cuerpo empieza a acumular lactato.",
      'Z5': "Esfuerzo muy intenso. Solo palabras sueltas. Mejora la capacidad aeróbica máxima.",
      'Z6': "Esfuerzo máximo. Sprints cortos. Desarrolla potencia y velocidad."
    };

    if (paso.esSerie) {
      return `Concéntrate en mantener el ritmo objetivo en cada repetición. La recuperación entre series es activa (trote suave) para bajar pulsaciones sin parar por completo. Sensación: ${consejosZona[zona] || 'controlada'}.`;
    }

    return consejosZona[zona] || "Mantén el ritmo indicado y escucha a tu cuerpo.";
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

    infoDiv.style.display = 'none';
    generarBtn.disabled = false;

    const duracionSelect = document.getElementById('duracionPlan');
    for (let i = 0; i < duracionSelect.options.length; i++) {
      if (duracionSelect.options[i].value === '1') {
        duracionSelect.options[i].disabled = !['2k', '5k', '10k'].includes(distancia);
      }
    }
  }
};

// ==========================================================================
// EXPORTACIÓN Y FUNCIONES GLOBALES
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

console.log('✅ PlanGenerator v7.3 - Asignación determinista de tipos por criterios de recuperación');