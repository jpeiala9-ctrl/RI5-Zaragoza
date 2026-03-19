// ============================================================================
// calendar.js - VERSIÓN DEFINITIVA
// Días previos no entrenados: CHECK ROJO (✗)
// Días realizados: CHECK VERDE (✓)
// Cada sesión con CALENTAMIENTO + PARTE PRINCIPAL + ENFRIAMIENTO
// Modal con estructura detallada por pasos
// ============================================================================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},

  FASES: {
    BASE: { nombre: 'Base', color: '#8AA0B0', intensidad: 0.7, volumen: 0.8 },        // Azul suave
    CONSTRUCCION: { nombre: 'Construcción', color: '#9BB5A0', intensidad: 0.85, volumen: 0.9 }, // Verde suave
    ESPECIFICA: { nombre: 'Específica', color: '#C9A78B', intensidad: 0.95, volumen: 1.0 }, // Naranja suave
    PICO: { nombre: 'Pico', color: '#C99BA5', intensidad: 1.0, volumen: 0.8 },        // Rosa suave
    TAPER: { nombre: 'Taper', color: '#9AA5A5', intensidad: 0.6, volumen: 0.5 }       // Gris azulado suave
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

      // ===== VALIDACIÓN POR NIVEL =====
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

      const fechaInicioStr = document.getElementById("fechaInicio").value;
      if (!fechaInicioStr) {
        Utils.showToast("> SELECCIONA UNA FECHA DE INICIO_", 'error');
        Utils.hideLoading();
        return;
      }

      const fechaInicio = new Date(fechaInicioStr + 'T12:00:00');
      
      if (isNaN(fechaInicio.getTime())) {
        Utils.showToast("> FECHA DE INICIO NO VÁLIDA_", 'error');
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

      // ===== GENERAR PLAN REAL =====
      const planCompleto = [];
      let fechaActual = new Date(fechaInicio);
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

        // ===== ASIGNACIÓN DE TIPOS DE SESIÓN =====
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
          const fechaStr = fechaActual.toISOString();

          if (!diasEntreno.includes(diaSemana)) {
            semana.push({
              diaGlobal: diaGlobalCounter++,
              semana: semanaGlobal,
              diaSemana,
              fecha: fechaStr,
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
              fecha: fechaStr,
              fase,
              nivel: nivelActual,
              tipo,
              color: this.getColor(tipo),
              letra: this.getLetra(tipo),
              ...sesion
            });
          }
          fechaActual.setDate(fechaActual.getDate() + 1);
        }

        planCompleto.push(...semana);
      }

      // ===== RELLENO DE DÍAS ANTES DE LA FECHA DE INICIO =====
      const diaSemanaInicio = fechaInicio.getDay();
      const diaSemanaInicioNum = diaSemanaInicio === 0 ? 7 : diaSemanaInicio;
      const diasDesdeLunes = diaSemanaInicioNum - 1;

      const diasRelleno = [];

      if (diasDesdeLunes > 0) {
        const fechaLunes = new Date(fechaInicio);
        fechaLunes.setDate(fechaInicio.getDate() - diasDesdeLunes);
        
        for (let i = 0; i < diasDesdeLunes; i++) {
          const fechaRellenoActual = new Date(fechaLunes);
          fechaRellenoActual.setDate(fechaLunes.getDate() + i);
          
          const diaSemanaRelleno = fechaRellenoActual.getDay();
          const diaSemanaRellenoNum = diaSemanaRelleno === 0 ? 7 : diaSemanaRelleno;
          
          const esDiaEntreno = diasEntreno.includes(diaSemanaRellenoNum);
          
          // Buscar si hay una sesión planificada para este día en la primera semana
          const sesionPlanificada = planCompleto.find(s => 
            s.semana === 1 && s.diaSemana === diaSemanaRellenoNum
          );
          
          diasRelleno.push({
            diaGlobal: i + 1,
            semana: 0,
            diaSemana: diaSemanaRellenoNum,
            fecha: fechaRellenoActual.toISOString(),
            fase: 'PREVIO',
            nivel: nivel,
            tipo: esDiaEntreno ? 'no-realizado' : 'descanso',
            color: esDiaEntreno ? 'sesion-no-realizada' : 'sesion-descanso',
            letra: esDiaEntreno ? '✗' : 'D',
            detalle: esDiaEntreno ? { 
              nombre: 'Entreno no realizado', 
              descripcion: sesionPlanificada?.detalle?.descripcion || 'Este día ya pasó y no se realizó el entrenamiento.',
              estructura: sesionPlanificada?.detalle?.estructura || 'Calentamiento + Parte principal + Enfriamiento',
              sensacion: 'No realizado',
              zona: sesionPlanificada?.detalle?.zona || 'Z2',
              duracion: sesionPlanificada?.duracion || 45,
              ritmoObjetivo: sesionPlanificada?.detalle?.ritmoObjetivo || '--:--',
              fcObjetivo: sesionPlanificada?.detalle?.fcObjetivo || '-- lpm',
              noRealizado: true
            } : null,
            completado: false,
            noRealizado: true,
            bloqueado: true
          });
        }
      }

      // Reindexar diaGlobal del plan real
      planCompleto.forEach((sesion, index) => {
        sesion.diaGlobal = diasRelleno.length + index + 1;
      });

      // Unir días de relleno + plan real
      const planCompletoConRelleno = [...diasRelleno, ...planCompleto];

      // ===== GUARDAR PLAN =====
      const planId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const mapaDist = { "2k": "2 km", "5k": "5 km", "10k": "10 km", "medio": "MEDIA", "maraton": "MARATÓN" };

      const planParaGuardar = {
        params: {
          modalidad, distancia, duracion: meses,
          diasPorSemana: diasEntreno.length,
          nivel, experiencia, objetivo, diaLargo,
          fechaInicio: fechaInicioStr,
          diasEntreno, planId,
          ritmoBase: AppState.lastRitmoBase,
          fcMax: AppState.lastFC,
          fcUmbral: AppState.lastUL
        },
        sesiones: planCompletoConRelleno,
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

      this.mostrarCalendario(planCompletoConRelleno);
      
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
      descanso: 'sesion-descanso',
      'no-realizado': 'sesion-no-realizada'
    };
    return colores[tipo] || 'sesion-descanso';
  },

  getLetra(tipo) {
    const letras = {
      rodaje: 'R',
      tempo: 'T',
      series: 'S',
      largo: 'L',
      descanso: 'D',
      'no-realizado': '✗'
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

  async crearSesionDesdeMatriz(sesionBase, esActivo, fase, semanaEnFase, nivel, datos, factorVolumen, factorIntensidad) {
    const { modalidad, distancia, ritmoBase, fcUmbral } = datos;
    const tipo = sesionBase.tipo;

    const LIMITES = { rodaje: 90, tempo: 75, series: 120, largo: 210 };

    // Buscar en la biblioteca de entrenamientos
    const dbTipo = this.ENTRENAMIENTOS[modalidad]?.[distancia]?.[nivel]?.[tipo];
    let sesionMatriz = null;
    
    if (dbTipo?.length) {
      sesionMatriz = dbTipo[Math.floor(Math.random() * dbTipo.length)];
    }

    // Si no hay sesión en la biblioteca, crear una genérica pero con estructura completa
    if (!sesionMatriz) {
      // Estructura base según el tipo de sesión
      let estructuraBase = '';
      let nombreBase = '';
      let descBase = '';
      let duracionBase = 45;
      let zonaBase = 'Z2';
      
      switch(tipo) {
        case 'rodaje':
          nombreBase = 'Rodaje aeróbico';
          descBase = 'Sesión de running a ritmo suave para desarrollar base aeróbica.';
          estructuraBase = '{calentamiento} + {principal} Z2 + {enfriamiento}';
          duracionBase = 45;
          zonaBase = 'Z2';
          break;
        case 'tempo':
          nombreBase = 'Entrenamiento de tempo';
          descBase = 'Sesión a ritmo cómodamente duro para mejorar el umbral de lactato.';
          estructuraBase = '{calentamiento} + {principal} Z3-Z4 + {enfriamiento}';
          duracionBase = 40;
          zonaBase = 'Z3-Z4';
          break;
        case 'series':
          nombreBase = 'Trabajo de series';
          descBase = 'Sesión de calidad con repeticiones a alta intensidad.';
          estructuraBase = '{calentamiento} + {principal} series + {enfriamiento}';
          duracionBase = 50;
          zonaBase = 'Z4-Z5';
          break;
        case 'largo':
          nombreBase = 'Tirada larga';
          descBase = 'Sesión de fondo para desarrollar resistencia específica.';
          estructuraBase = '{calentamiento} + {principal} Z2 + {enfriamiento}';
          duracionBase = 75;
          zonaBase = 'Z2';
          break;
      }
      
      sesionMatriz = {
        nombre: nombreBase,
        desc: descBase,
        duracion: duracionBase,
        estructura: estructuraBase,
        sensacion: 'Controlado',
        zona: zonaBase
      };
    }

    // Validar zona según tipo
    if (tipo === 'series' && (!sesionMatriz.zona || sesionMatriz.zona === 'Z2')) {
      sesionMatriz.zona = fase === 'BASE' ? 'Z4' : 'Z5';
    }
    if (tipo === 'tempo' && (!sesionMatriz.zona || sesionMatriz.zona === 'Z2')) {
      sesionMatriz.zona = 'Z3';
    }

    // Calcular duración con factor de volumen
    let duracion = sesionMatriz.duracion || 45;
    duracion = Math.round(duracion * factorVolumen);
    if (LIMITES[tipo]) duracion = Math.min(duracion, LIMITES[tipo]);
    duracion = Math.max(duracion, 30);

    // Calcular calentamiento y enfriamiento (15% y 10% de la duración total)
    const calentamiento = Math.max(10, Math.round(duracion * 0.15));
    const enfriamiento = Math.max(5, Math.round(duracion * 0.1));
    const partePrincipal = duracion - calentamiento - enfriamiento;

    // Crear estructura detallada con calentamiento, parte principal y enfriamiento
    let estructuraDetallada = '';
    
    if (tipo === 'series' && sesionMatriz.repeticiones && sesionMatriz.distanciaSerie) {
      // Para series, usar la estructura específica
      const ritmoSeries = ritmoBase * 0.95;
      const distanciaKm = sesionMatriz.distanciaSerie / 1000;
      const tiempoSeries = Math.round(sesionMatriz.repeticiones * distanciaKm * ritmoSeries);
      
      estructuraDetallada = `${calentamiento}' calentamiento Z1 (muy suave) + ` +
                           `${tiempoSeries}' series (${sesionMatriz.repeticiones}x${sesionMatriz.distanciaSerie}m a ritmo rápido) + ` +
                           `${enfriamiento}' enfriamiento Z1 (trote suave)`;
    } else {
      // Para el resto de sesiones
      let descripcionPrincipal = '';
      
      switch(tipo) {
        case 'rodaje':
          descripcionPrincipal = `${partePrincipal}' rodaje continuo en Z2 (ritmo conversacional)`;
          break;
        case 'tempo':
          descripcionPrincipal = `${partePrincipal}' tempo en Z3-Z4 (ritmo cómodamente duro)`;
          break;
        case 'largo':
          descripcionPrincipal = `${partePrincipal}' tirada larga en Z2 (fondo aeróbico)`;
          break;
        default:
          descripcionPrincipal = `${partePrincipal}' trabajo principal`;
      }
      
      estructuraDetallada = `${calentamiento}' calentamiento Z1 (muy suave) + ` +
                           `${descripcionPrincipal} + ` +
                           `${enfriamiento}' enfriamiento Z1 (trote suave)`;
    }

    // Calcular ritmo objetivo según zona
    const factoresRitmo = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95 };
    const zonaPrincipal = sesionMatriz.zona?.split('-')[0] || 'Z2';
    const ritmoObjetivo = Utils.formatR(ritmoBase * (factoresRitmo[zonaPrincipal] || 1.25));
    
    // Calcular FC objetivo
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

    const detalle = {
      nombre: sesionMatriz.nombre || `${tipo}: ${fase.toLowerCase()}`,
      descripcion: sesionMatriz.desc || `Sesión de ${tipo} en fase ${fase}`,
      estructura: estructuraDetallada,
      sensacion: sesionMatriz.sensacion || this.obtenerSensacion(tipo, fase),
      zona: sesionMatriz.zona || this.obtenerZonaPorTipo(tipo),
      duracion: duracion,
      ritmoObjetivo: ritmoObjetivo,
      fcObjetivo: fcObjetivo,
      calentamiento: calentamiento,
      partePrincipal: partePrincipal,
      enfriamiento: enfriamiento
    };

    if (sesionMatriz.repeticiones) {
      detalle.repeticiones = sesionMatriz.repeticiones;
      detalle.distanciaSerie = sesionMatriz.distanciaSerie;
    }

    return { tipo, duracion, detalle };
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

    // Colocar cada sesión en su posición basada en diaGlobal
    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];
      if (!sesion) continue;
      
      const pos = sesion.diaGlobal - 1 - inicioPagina;
      if (pos >= 0 && pos < celdas.length) {
        celdas[pos] = sesion;
      }
    }

    let html = '';

    // Generar grid en orden
    for (let pos = 0; pos < celdas.length; pos++) {
      const sesion = celdas[pos];

      if (!sesion) {
        html += '<div class="calendario-dia sesion-descanso"></div>';
        continue;
      }

      const realizada = AppState.sesionesRealizadas?.[sesion.diaGlobal] ? 'realizado' : '';
      const bloqueado = sesion.bloqueado ? 'bloqueado' : '';
      const noRealizado = sesion.noRealizado ? 'data-no-realizado="true"' : '';

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

      const diaSemanaAbr = diasSemanaAbr[sesion.diaSemana - 1];

      let contenidoHtml = '';
      if (sesion.tipo === 'no-realizado') {
        contenidoHtml = `<strong>✗</strong><div>${diaDelMes} ${diaSemanaAbr}</div>`;
      } else if (sesion.tipo !== 'descanso' && sesion.detalle) {
        contenidoHtml = `<strong>${sesion.letra}</strong><div>${diaDelMes} ${diaSemanaAbr}</div>`;
      } else {
        contenidoHtml = `<strong>D</strong><div>${diaDelMes} ${diaSemanaAbr}</div>`;
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada} ${bloqueado}" data-index="${sesion.diaGlobal}"${faseIndicator} ${noRealizado} data-bloqueado="${sesion.bloqueado || false}">${contenidoHtml}</div>`;
    }

    grid.innerHTML = html;
    this.agregarLeyendaFases();

    // Event listeners
    document.querySelectorAll('.calendario-dia[data-index]:not(.bloqueado)').forEach(dia => {
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

  // ==========================================================================
  // ABRIR DETALLE DE SESIÓN (con estructura completa)
  // ==========================================================================
  abrirDetalleSesion(sesion, diaIndex) {
    if (!sesion) return;
    if (sesion.bloqueado) {
      if (sesion.tipo === 'no-realizado') {
        Utils.showToast('⏰ Este día ya pasó y no se realizó el entrenamiento', 'warning');
      } else {
        Utils.showToast('⭐ Este día ya pasó y no puede modificarse', 'warning');
      }
      return;
    }
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

    if (sesion.tipo === 'no-realizado') {
      wrapper.classList.add('sesion-no-realizada');
      titulo.innerText = "✗ ENTRENO NO REALIZADO";
      descripcion.innerHTML = `
        <div class="descanso-container">
          <div class="descanso-icono">⏰</div>
          <p class="descanso-texto">Este día ya pasó</p>
          <p>El entrenamiento planificado para este día no fue realizado.</p>
          ${sesion.detalle ? `
            <div style="margin-top: 20px; padding: 15px; background: var(--bg-primary); border-radius: 10px; text-align: left;">
              <h4 style="margin: 0 0 10px 0; color: var(--accent-blue);">ENTRENO PLANIFICADO:</h4>
              <p><strong>${sesion.detalle.nombre}</strong></p>
              <p>${sesion.detalle.descripcion}</p>
              <p style="margin-top: 10px;"><strong>Estructura:</strong> ${sesion.detalle.estructura}</p>
              <p><strong>Duración:</strong> ${sesion.detalle.duracion} min</p>
              <p><strong>Ritmo:</strong> ${sesion.detalle.ritmoObjetivo}</p>
              <p><strong>FC:</strong> ${sesion.detalle.fcObjetivo}</p>
            </div>
          ` : ''}
        </div>
      `;
      checkboxContainer.style.display = 'none';
    } else if (sesion.tipo !== 'descanso' && sesion.detalle) {
      wrapper.classList.add(sesion.color);

      let icono = "";
      if (sesion.tipo === 'rodaje') icono = "🏃‍♂️";
      else if (sesion.tipo === 'tempo') icono = "⚡";
      else if (sesion.tipo === 'series') icono = "🔁";
      else if (sesion.tipo === 'largo') icono = "📏";

      const faseTexto = sesion.fase ? ` · ${this.FASES[sesion.fase]?.nombre || sesion.fase}` : '';
      titulo.innerText = `${icono} ${sesion.tipo.toUpperCase()}${faseTexto}: ${sesion.detalle.nombre}`;

      // Mostrar estructura completa en pasos
      let pasosHTML = '';
      
      if (sesion.detalle.estructura) {
        // Extraer calentamiento, parte principal y enfriamiento de la estructura
        const partes = sesion.detalle.estructura.split('+').map(p => p.trim());
        
        pasosHTML = '<div class="sesion-pasos-detallados">';
        
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
              <div class="paso-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span style="font-size: 20px;">${iconoPaso}</span>
                <strong>${tituloPaso}</strong>
              </div>
              <p style="margin-left: 30px;">${parte}</p>
            </div>
          `;
        });
        
        pasosHTML += '</div>';
      }

      const metricas = this.calcularMetricasSesion(sesion);
      const tiempoTotal = this.formatearTiempo(sesion.duracion);
      const comentarioPrevio = this.generarComentarioPrevio(sesion);

      let descHtml = `
        <div class="sesion-resumen" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0;">
          <div style="text-align: center; background: var(--bg-primary); padding: 10px; border-radius: 10px;">
            <span style="display: block; font-size: 24px;">🕒</span>
            <span>${tiempoTotal}</span>
          </div>
          <div style="text-align: center; background: var(--bg-primary); padding: 10px; border-radius: 10px;">
            <span style="display: block; font-size: 24px;">📏</span>
            <span>${metricas.distanciaTotal.toFixed(2)} km</span>
          </div>
          <div style="text-align: center; background: var(--bg-primary); padding: 10px; border-radius: 10px;">
            <span style="display: block; font-size: 24px;">⚡</span>
            <span>${metricas.tssTotal} TSS</span>
          </div>
        </div>
        
        <div class="sesion-objetivos" style="background: var(--bg-primary); padding: 15px; margin: 15px 0; border-radius: 10px;">
          <h4 style="margin: 0 0 10px 0; color: var(--accent-blue);">🎯 OBJETIVOS</h4>
          <p><strong>Ritmo objetivo:</strong> ${sesion.detalle.ritmoObjetivo} min/km</p>
          <p><strong>Frecuencia cardíaca:</strong> ${sesion.detalle.fcObjetivo}</p>
          <p><strong>Sensación:</strong> ${sesion.detalle.sensacion}</p>
          <p><strong>Zona:</strong> ${sesion.detalle.zona}</p>
        </div>
        
        <div class="sesion-estructura" style="background: var(--bg-primary); padding: 15px; margin: 15px 0; border-radius: 10px;">
          <h4 style="margin: 0 0 15px 0; color: var(--accent-blue);">📋 ESTRUCTURA DE LA SESIÓN</h4>
          ${pasosHTML}
        </div>
        
        <div class="sesion-comentarios" style="background: var(--bg-primary); padding: 15px; margin: 15px 0; border-radius: 10px;">
          <h4 style="margin: 0 0 10px 0; color: var(--accent-blue);">💬 COMENTARIOS</h4>
          <p>${comentarioPrevio}</p>
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

    // Extraer minutos de la estructura
    const minutosMatch = estructura.match(/(\d+)'/g);
    let totalMinutos = 0;
    if (minutosMatch) {
      totalMinutos = minutosMatch.reduce((acc, m) => acc + parseInt(m), 0);
    } else {
      totalMinutos = sesion.duracion || 45;
    }

    // Calcular distancia estimada
    const zona = zonaSesion.split('-')[0];
    const factorRitmo = factoresRitmo[zona] || 1.25;
    const ritmoMin = ritmoBase * factorRitmo;
    const distanciaTotal = totalMinutos / ritmoMin;

    // Calcular TSS estimado
    const ifactor = factoresIF[zona] || 0.7;
    const tssTotal = Math.round(totalMinutos * ifactor * ifactor);

    return { distanciaTotal, tssTotal, pasos: [] };
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

console.log('✅ PlanGenerator v12.0 - DEFINITIVO: días previos ✗, sesiones con estructura completa');