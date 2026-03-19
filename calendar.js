// ============================================================================
// calendar.js - VERSIÓN DEFINITIVA CON PROGRESIÓN DE NIVEL
// El usuario progresa NATURALMENTE durante el plan
// Principiante → Intermedio → Avanzado según semanas
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

  // ===== DURACIONES BASE POR NIVEL (minutos) =====
  DURACIONES_BASE: {
    principiante: {
      rodaje: { min: 35, max: 45 },
      tempo: { min: 30, max: 40 },
      series: { min: 35, max: 45 },
      largo: { min: 50, max: 70 }
    },
    intermedio: {
      rodaje: { min: 50, max: 65 },
      tempo: { min: 45, max: 55 },
      series: { min: 50, max: 60 },
      largo: { min: 75, max: 95 }
    },
    avanzado: {
      rodaje: { min: 70, max: 90 },
      tempo: { min: 60, max: 75 },
      series: { min: 65, max: 80 },
      largo: { min: 100, max: 130 }
    }
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
      const nivelInicial = document.getElementById("nivel").value;
      const experiencia = document.getElementById("experienciaDistancia").value;
      const objetivo = document.getElementById("objetivoPrincipal").value;

      // ===== DÍAS DE ENTRENO =====
      const diasEntreno = this.obtenerDiasSeleccionados();
      
      if (nivelInicial === 'avanzado' && diasEntreno.length < 5) {
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
        // ===== CALCULAR NIVEL ACTUAL SEGÚN LA SEMANA =====
        let nivelActual = nivelInicial;
        
        // Progresión natural: Principiante → Intermedio → Avanzado
        if (nivelInicial === 'principiante') {
          if (semanaGlobal > semanasTotales * 0.66) { // Último tercio
            nivelActual = 'avanzado';
          } else if (semanaGlobal > semanasTotales * 0.33) { // Tercio medio
            nivelActual = 'intermedio';
          } else { // Primer tercio
            nivelActual = 'principiante';
          }
        } else if (nivelInicial === 'intermedio') {
          if (semanaGlobal > semanasTotales * 0.66) { // Último tercio
            nivelActual = 'avanzado';
          } else { // Resto
            nivelActual = 'intermedio';
          }
        } else {
          nivelActual = 'avanzado'; // Siempre avanzado
        }

        const faseInfo = this.obtenerFaseSemana(fases, semanaGlobal);
        const { fase, semanaEnFase, duracionFase } = faseInfo;

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
            nivel: nivelInicial,
            tipo: 'no-realizado',
            color: 'sesion-no-realizada',
            letra: '✗',
            detalle: sesionPlanificada ? {
              nombre: sesionPlanificada.detalle.nombre,
              descripcion: sesionPlanificada.detalle.descripcion,
              estructura: sesionPlanificada.detalle.estructura,
              sensacion: sesionPlanificada.detalle.sensacion,
              zona: sesionPlanificada.detalle.zona,
              duracion: sesionPlanificada.detalle.duracion,
              ritmoObjetivo: sesionPlanificada.detalle.ritmoObjetivo,
              fcObjetivo: sesionPlanificada.detalle.fcObjetivo,
              calentamiento: sesionPlanificada.detalle.calentamiento,
              partePrincipal: sesionPlanificada.detalle.partePrincipal,
              enfriamiento: sesionPlanificada.detalle.enfriamiento,
              noRealizado: true
            } : {
              nombre: 'Entreno no realizado',
              descripcion: 'Este día ya pasó y no se realizó el entrenamiento.',
              estructura: '10\' calentamiento + trabajo principal + 10\' enfriamiento',
              sensacion: 'No realizado',
              zona: 'Z2',
              duracion: 50,
              ritmoObjetivo: '--:--',
              fcObjetivo: '-- lpm',
              noRealizado: true
            },
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
          nivel: nivelInicial, experiencia, objetivo, diaLargo,
          fechaInicio: fechaInicioStr,
          diasEntreno, planId,
          ritmoBase: AppState.lastRitmoBase,
          fcMax: AppState.lastFC,
          fcUmbral: AppState.lastUL
        },
        sesiones: planCompletoConRelleno,
        resumen: `${mapaDist[distancia] || distancia} · ${diasEntreno.length} días · Nivel ${nivelInicial} con progresión`,
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
          NIVEL INICIAL: ${nivelInicial.toUpperCase()} · PROGRESIÓN AUTOMÁTICA · 
          OBJ: ${objetivo.toUpperCase()} · 
          LARGO: ${["", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][diaLargo]}
        </span>
      `;

      document.getElementById("calendarioEntreno").style.display = "block";
      document.getElementById("cuestionarioEntreno").style.display = "none";

      this.mostrarCalendario(planCompletoConRelleno);
      
      Utils.scrollToElement('calendarioEntreno', -20);
      Utils.showToast('✅ PLAN GENERADO CON PROGRESIÓN', 'success');

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

    const LIMITES = { rodaje: 120, tempo: 90, series: 90, largo: 210 };

    // ===== OBTENER DURACIÓN BASE SEGÚN NIVEL =====
    const duracionesNivel = this.DURACIONES_BASE[nivel] || this.DURACIONES_BASE.intermedio;
    const rango = duracionesNivel[tipo] || duracionesNivel.rodaje;
    
    // Calcular duración base (entre min y max según progresión)
    let duracionBase = Math.round(rango.min + (rango.max - rango.min) * (semanaEnFase / 8));
    
    // Aplicar factor de volumen
    let duracion = Math.round(duracionBase * factorVolumen);
    if (LIMITES[tipo]) duracion = Math.min(duracion, LIMITES[tipo]);
    duracion = Math.max(duracion, 30);

    // ===== SIEMPRE 10' CALENTAMIENTO + 10' ENFRIAMIENTO =====
    const calentamiento = 10;
    const enfriamiento = 10;
    const partePrincipal = duracion - calentamiento - enfriamiento;

    // ===== BUSCAR EN BIBLIOTECA O CREAR SESIÓN =====
    const dbTipo = this.ENTRENAMIENTOS[modalidad]?.[distancia]?.[nivel]?.[tipo];
    let sesionMatriz = null;
    
    if (dbTipo?.length) {
      sesionMatriz = dbTipo[Math.floor(Math.random() * dbTipo.length)];
    }

    // ===== CONSTRUIR ESTRUCTURA =====
    let estructuraDetallada = '';
    let nombreSesion = '';
    let descripcionSesion = '';
    let sensacionSesion = '';
    let zonaSesion = '';

    if (sesionMatriz) {
      nombreSesion = sesionMatriz.nombre;
      descripcionSesion = sesionMatriz.desc;
      sensacionSesion = sesionMatriz.sensacion;
      zonaSesion = sesionMatriz.zona;
      
      // Adaptar estructura existente a 10' calentamiento + 10' enfriamiento
      if (sesionMatriz.estructura) {
        estructuraDetallada = sesionMatriz.estructura
          .replace(/\d+' calentamiento/, `${calentamiento}' calentamiento`)
          .replace(/\d+' enfriamiento/, `${enfriamiento}' enfriamiento`);
      } else {
        estructuraDetallada = `${calentamiento}' calentamiento Z1 + ${partePrincipal}' ${tipo} + ${enfriamiento}' enfriamiento Z1`;
      }
    } else {
      // Crear sesión genérica pero con duración adecuada al nivel
      switch(tipo) {
        case 'rodaje':
          nombreSesion = nivel === 'principiante' ? 'Rodaje base' : 
                        nivel === 'intermedio' ? 'Rodaje activo' : 'Rodaje calidad';
          descripcionSesion = `Sesión de running a ritmo suave para desarrollar base aeróbica.`;
          zonaSesion = 'Z2';
          sensacionSesion = nivel === 'principiante' ? 'Cómodo' : 
                           nivel === 'intermedio' ? 'Controlado' : 'Exigente';
          break;
        case 'tempo':
          nombreSesion = nivel === 'principiante' ? 'Introducción al tempo' : 
                        nivel === 'intermedio' ? 'Tempo continuo' : 'Tempo umbral';
          descripcionSesion = `Sesión a ritmo cómodamente duro para mejorar el umbral de lactato.`;
          zonaSesion = nivel === 'principiante' ? 'Z3' : 'Z3-Z4';
          sensacionSesion = nivel === 'principiante' ? 'Fuerte' : 
                           nivel === 'intermedio' ? 'Exigente' : 'Muy exigente';
          break;
        case 'series':
          nombreSesion = nivel === 'principiante' ? 'Series cortas' : 
                        nivel === 'intermedio' ? 'Series de VO2máx' : 'Series específicas';
          descripcionSesion = `Trabajo de calidad con repeticiones a alta intensidad.`;
          zonaSesion = nivel === 'principiante' ? 'Z4' : 
                      nivel === 'intermedio' ? 'Z4-Z5' : 'Z5';
          sensacionSesion = nivel === 'principiante' ? 'Rápidas' : 
                           nivel === 'intermedio' ? 'Intensas' : 'Máximas';
          break;
        case 'largo':
          nombreSesion = nivel === 'principiante' ? 'Tirada larga base' : 
                        nivel === 'intermedio' ? 'Tirada larga progresiva' : 'Tirada larga específica';
          descripcionSesion = `Sesión de fondo para desarrollar resistencia específica.`;
          zonaSesion = 'Z2';
          sensacionSesion = nivel === 'principiante' ? 'Resistencia' : 
                           nivel === 'intermedio' ? 'Fondo' : 'Calidad';
          break;
      }
      
      estructuraDetallada = `${calentamiento}' calentamiento Z1 + ${partePrincipal}' ${tipo} + ${enfriamiento}' enfriamiento Z1`;
    }

    // ===== CALCULAR RITMO Y FC =====
    const factoresRitmo = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95 };
    const zonaPrincipal = zonaSesion?.split('-')[0] || 'Z2';
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

    const detalle = {
      nombre: nombreSesion || `${tipo}: ${fase.toLowerCase()}`,
      descripcion: descripcionSesion || `Sesión de ${tipo} en fase ${fase}`,
      estructura: estructuraDetallada,
      sensacion: sensacionSesion || this.obtenerSensacion(tipo, fase),
      zona: zonaSesion || this.obtenerZonaPorTipo(tipo),
      duracion: duracion,
      ritmoObjetivo: ritmoObjetivo,
      fcObjetivo: fcObjetivo,
      calentamiento: calentamiento,
      partePrincipal: partePrincipal,
      enfriamiento: enfriamiento
    };

    if (sesionMatriz?.repeticiones) {
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
    
    const celdas = new Array(semanasPorPagina * 7).fill(null);

    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];
      if (!sesion) continue;
      
      const pos = sesion.diaGlobal - 1 - inicioPagina;
      if (pos >= 0 && pos < celdas.length) {
        celdas[pos] = sesion;
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
      const bloqueado = sesion.bloqueado ? 'bloqueado' : '';

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

      html += `<div class="calendario-dia ${sesion.color} ${realizada} ${bloqueado}" data-index="${sesion.diaGlobal}"${faseIndicator}>${contenidoHtml}</div>`;
    }

    grid.innerHTML = html;
    this.agregarLeyendaFases();

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

  abrirDetalleSesion(sesion, diaIndex) {
    if (!sesion) return;
    if (sesion.bloqueado) {
      Utils.showToast('⏰ Este día ya pasó', 'warning');
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
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
          <p style="font-size: 18px; margin-bottom: 15px;">Este día ya pasó</p>
          <p style="color: var(--text-secondary);">El entrenamiento planificado para este día no fue realizado.</p>
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

      const nivelTexto = sesion.nivel ? ` · ${sesion.nivel.toUpperCase()}` : '';
      titulo.innerText = `${icono} ${sesion.tipo.toUpperCase()}${nivelTexto}: ${sesion.detalle.nombre}`;

      let descHtml = `
        <div style="background: var(--bg-primary); padding: 15px; margin: 15px 0; border-radius: 10px; text-align: left;">
          <p style="margin-bottom: 10px; color: var(--text-secondary);">${sesion.detalle.descripcion}</p>
          <p><strong>Duración total:</strong> ${sesion.detalle.duracion} min</p>
          <p><strong>Ritmo objetivo:</strong> ${sesion.detalle.ritmoObjetivo} min/km</p>
          <p><strong>FC objetivo:</strong> ${sesion.detalle.fcObjetivo}</p>
          <p><strong>Zona:</strong> ${sesion.detalle.zona}</p>
          <p><strong>Sensación:</strong> ${sesion.detalle.sensacion}</p>
        </div>
        
        <div style="background: var(--bg-primary); padding: 15px; margin: 15px 0; border-radius: 10px; text-align: left;">
          <h4 style="margin: 0 0 15px 0; color: var(--accent-blue);">📋 ESTRUCTURA</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">🔥</span>
              <div>
                <strong>CALENTAMIENTO</strong>
                <p style="margin: 0;">${sesion.detalle.calentamiento}' Z1 (muy suave)</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">💪</span>
              <div>
                <strong>PARTE PRINCIPAL</strong>
                <p style="margin: 0;">${sesion.detalle.partePrincipal}' ${sesion.tipo}</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">🧘</span>
              <div>
                <strong>ENFRIAMIENTO</strong>
                <p style="margin: 0;">${sesion.detalle.enfriamiento}' Z1 (trote suave)</p>
              </div>
            </div>
          </div>
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
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">😴</div>
          <p style="font-size: 18px; margin-bottom: 15px;">Día de descanso</p>
          <div style="text-align: left; background: var(--bg-primary); padding: 15px; border-radius: 10px;">
            <p><strong>Recomendaciones:</strong></p>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 8px 0;">🧘 Estiramientos suaves</li>
              <li style="margin: 8px 0;">🌀 Foam roller</li>
              <li style="margin: 8px 0;">🚶 Paseo activo</li>
            </ul>
          </div>
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

console.log('✅ PlanGenerator v15.0 - Con progresión de nivel y duraciones corregidas');