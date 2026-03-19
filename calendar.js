// ============================================================================
// calendar.js - GENERADOR DE PLANES DE ENTRENAMIENTO PROFESIONAL
// Versión: 5.9 - CORREGIDO: respeta fecha de inicio y muestra el día del mes
// ============================================================================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},
  PLANTILLAS: window.PLANTILLAS_SEMANALES || {},

  // ==========================================================================
  // GENERACIÓN PRINCIPAL DEL PLAN
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

      // --- 1. Recoger inputs del usuario ---
      const modalidad = document.getElementById("modalidad").value;
      const distancia = document.getElementById("distObjetivo").value;
      const meses = parseInt(document.getElementById("duracionPlan").value);
      const nivel = document.getElementById("nivel").value;
      const experiencia = document.getElementById("experienciaDistancia").value;
      const objetivo = document.getElementById("objetivoPrincipal").value;
      
      let diaLargoInput = document.getElementById("diaLargo").value;
      let diaLargo;

      const diasEntreno = this.obtenerDiasSeleccionados();
      if (diasEntreno.length === 0) throw new Error("SELECCIONA AL MENOS UN DÍA DE ENTRENO");

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

      const fechaInicioStr = document.getElementById("fechaInicio").value;
      if (!fechaInicioStr) throw new Error("SELECCIONA UNA FECHA DE INICIO");
      
      // Normalizar fecha a las 12:00 del mediodía para evitar problemas de zona horaria
      const fechaInicio = new Date(fechaInicioStr + 'T12:00:00');

      if (!diasEntreno.includes(diaLargo)) {
        diasEntreno.push(diaLargo);
        diasEntreno.sort((a, b) => a - b);
        document.getElementById(`dia${diaLargo}`).checked = true;
        Utils.showToast(`📅 Se ha añadido el día ${["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][diaLargo-1]} para la tirada larga`, 'info');
      }

      if (meses === 1 && !['2k', '5k', '10k'].includes(distancia)) {
        throw new Error("Plan de 1 mes solo para 2km, 5km y 10km");
      }
      if (['medio', 'maraton'].includes(distancia) && meses === 3 && experiencia === 'no') {
        throw new Error("Para Media o Maratón en 3 meses necesitas experiencia");
      }

      const libreriaPerfil = this.PLANTILLAS[modalidad]?.[distancia]?.[nivel];
      if (!libreriaPerfil?.ciclos?.length) {
        throw new Error("No hay plantillas para tu perfil. Contacta al administrador.");
      }

      const fases = this.definirFasesProfesionales(meses, distancia, objetivo);
      const semanasTotales = meses * 4;

      const ritmoBase = AppState.lastRitmoBase;
      const fcUmbral = AppState.lastUL;

      const planCompleto = [];
      let fechaActual = new Date(fechaInicio); // Copia para ir incrementando

      console.log('📅 Fecha de inicio seleccionada:', fechaInicio.toLocaleDateString());

      for (let semanaGlobal = 1; semanaGlobal <= semanasTotales; semanaGlobal++) {
        const faseActual = this.obtenerFaseActual(fases, semanaGlobal);
        const semanaEnFase = semanaGlobal - faseActual.semanaInicio + 1;
        const esSemanaDescarga = (semanaEnFase % 4 === 0) || faseActual.nombre === 'taper';

        let plantillaSemana;
        if (esSemanaDescarga && libreriaPerfil.cicloDescarga) {
          plantillaSemana = libreriaPerfil.cicloDescarga;
        } else {
          const indiceCiclo = (semanaGlobal - 1) % libreriaPerfil.ciclos.length;
          plantillaSemana = libreriaPerfil.ciclos[indiceCiclo];
        }

        // Convertir la plantilla (objeto con claves 1-7) en un array ordenado (lunes a domingo)
        const plantillaArray = [];
        for (let i = 1; i <= 7; i++) {
          plantillaArray.push(plantillaSemana[i] || { tipo: 'descanso' });
        }

        // Encontrar la posición del día largo en la plantilla (índice 0=lunes)
        const idxLargoPlantilla = plantillaArray.findIndex(dia => dia.tipo === 'largo');
        if (idxLargoPlantilla === -1) {
          const primerNoDescanso = plantillaArray.findIndex(dia => dia.tipo !== 'descanso');
          if (primerNoDescanso === -1) {
            plantillaArray[6] = { tipo: 'largo', fromMatrix: true };
          } else {
            plantillaArray[primerNoDescanso] = { tipo: 'largo', fromMatrix: true };
          }
        }

        const idxLargoFinal = plantillaArray.findIndex(dia => dia.tipo === 'largo');
        const semanaOrdenada = new Array(7).fill(null);
        semanaOrdenada[diaLargo - 1] = plantillaArray[idxLargoFinal];

        let indicePlantilla = (idxLargoFinal + 1) % 7;
        for (let offset = 1; offset < 7; offset++) {
          const diaActual = ((diaLargo - 1) + offset) % 7;
          if (semanaOrdenada[diaActual] === null) {
            semanaOrdenada[diaActual] = plantillaArray[indicePlantilla];
            indicePlantilla = (indicePlantilla + 1) % 7;
          }
        }

        const semana = [];
        for (let diaSemana = 1; diaSemana <= 7; diaSemana++) {
          const sesionBase = semanaOrdenada[diaSemana - 1];
          const esDiaActivo = diasEntreno.includes(diaSemana) && sesionBase.tipo !== 'descanso';

          let sesion = await this.crearSesionDesdeMatriz(
            sesionBase,
            esDiaActivo,
            faseActual,
            semanaEnFase,
            libreriaPerfil,
            { modalidad, distancia, nivel, ritmoBase, fcUmbral }
          );

          if (diaSemana === diaLargo && sesion.tipo === 'largo') {
            sesion = this.aplicarFactorLargo(sesion, libreriaPerfil.progresionLargo, semanaEnFase);
          }

          if (modalidad === 'trail' && libreriaPerfil.progresionDesnivel) {
            sesion = this.aplicarFactorDesnivel(sesion, libreriaPerfil.progresionDesnivel, semanaEnFase);
          }

          // Guardar la fecha en formato ISO para evitar problemas de zona horaria
          semana.push({
            diaGlobal: (semanaGlobal - 1) * 7 + diaSemana,
            semana: semanaGlobal,
            diaSemana: diaSemana,
            fecha: fechaActual.toISOString(), // ← Guardamos como string ISO
            ...sesion
          });

          // Avanzar un día
          fechaActual.setDate(fechaActual.getDate() + 1);
        }

        planCompleto.push(...semana);
      }

      const planId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const mapaDist = { "2k": "2 km", "5k": "5 km", "10k": "10 km", "medio": "MEDIA", "maraton": "MARATÓN" };

      const planParaGuardar = {
        params: {
          modalidad, distancia, duracion: meses, diasPorSemana: diasEntreno.length,
          nivel, experiencia, objetivo, diaLargo, fechaInicio: fechaInicioStr, diasEntreno, planId,
          ritmoBase: AppState.lastRitmoBase, fcMax: AppState.lastFC, fcUmbral: AppState.lastUL
        },
        sesiones: planCompleto,
        resumen: `${mapaDist[distancia] || distancia} · ${diasEntreno.length} días · ${nivel}`,
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
          ${nivel.toUpperCase()} · ${experiencia === 'si' ? 'CON EXPERIENCIA' : 'PRIMERA VEZ'} · 
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
  // NUEVA FUNCIÓN: Elegir día óptimo de tirada larga
  // ==========================================================================
  elegirDiaLargoOptimo(diasEntreno) {
    for (let dia of diasEntreno) {
      let diaSiguiente = dia + 1;
      if (diaSiguiente > 7) diaSiguiente = 1;
      if (!diasEntreno.includes(diaSiguiente)) {
        return dia;
      }
    }
    if (diasEntreno.includes(6)) return 6;
    if (diasEntreno.includes(7)) return 7;
    return Math.max(...diasEntreno);
  },

  // ==========================================================================
  // CREACIÓN DE UNA SESIÓN INDIVIDUAL
  // ==========================================================================
  async crearSesionDesdeMatriz(sesionBase, esActivo, faseActual, semanaEnFase, libreriaPerfil, datos) {
    if (!esActivo) {
      return {
        tipo: 'descanso',
        color: 'sesion-descanso',
        letra: 'D',
        detalle: null
      };
    }

    const { modalidad, distancia, nivel, ritmoBase, fcUmbral } = datos;
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
      largo: 210,
      descanso: 0
    };

    let sesionMatriz = null;
    if (sesionBase.fromMatrix) {
      const dbTipo = this.ENTRENAMIENTOS[modalidad]?.[distancia]?.[nivel]?.[tipo];
      if (dbTipo?.length) {
        if (sesionBase.variante) {
          sesionMatriz = dbTipo.find(s =>
            s.nombre.toLowerCase().includes(sesionBase.variante.toLowerCase())
          );
        }
        if (!sesionMatriz) {
          sesionMatriz = dbTipo[Math.floor(Math.random() * dbTipo.length)];
        }
      }
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

    // === VALIDACIÓN Y CORRECCIÓN DE ZONA POR TIPO ===
    if (tipo === 'series') {
      if (sesionMatriz.zona && (sesionMatriz.zona === 'Z2' || sesionMatriz.zona === 'Z3')) {
        console.warn(`Zona incorrecta en sesión de series (${sesionMatriz.nombre}), corregida a Z4`);
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
      const calentamientoMatch = sesionMatriz.estructura.match(/(\d+)' calentamiento/);
      const enfriamientoMatch = sesionMatriz.estructura.match(/(\d+)' enfriamiento/);
      const calentamiento = calentamientoMatch ? parseInt(calentamientoMatch[1]) : 10;
      const enfriamiento = enfriamientoMatch ? parseInt(enfriamientoMatch[1]) : 5;

      const ritmoSeries = ritmoBase * 0.95;
      const distanciaKm = sesionMatriz.distanciaSerie / 1000;
      const tiempoSeries = Math.round(sesionMatriz.repeticiones * distanciaKm * ritmoSeries);

      duracion = calentamiento + tiempoSeries + enfriamiento;
      estructuraEscalada = `${calentamiento}' calentamiento + ${tiempoSeries}' series (${sesionMatriz.repeticiones}x${sesionMatriz.distanciaSerie}m) + ${enfriamiento}' enfriamiento`;

      if (LIMITES[tipo]) duracion = Math.min(duracion, LIMITES[tipo]);
    } else {
      duracion = sesionMatriz.duracion || 30;
      const factoresFase = {
        base: 0.9,
        construccion: 1.0,
        especifica: 1.1,
        pico: 1.2,
        taper: 0.6
      };
      duracion = Math.round(duracion * (factoresFase[faseActual.nombre] || 1.0));
      const progresoFase = semanaEnFase / faseActual.duracion;
      duracion = Math.round(duracion * (0.9 + (progresoFase * 0.3)));

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
      descripcion: sesionMatriz.desc || sesionMatriz.descripcion || `Sesión de ${tipo} en fase ${faseActual.nombre}`,
      estructura: estructuraEscalada,
      sensacion: sesionMatriz.sensacion || this.obtenerSensacion(tipo, faseActual.nombre),
      zona: sesionMatriz.zona || this.obtenerZonaPorTipo(tipo),
      duracion: duracion,
      ritmoObjetivo: ritmoObjetivo,
      fcObjetivo: fcObjetivo
    };

    if (sesionMatriz.repeticiones) {
      detalle.repeticiones = sesionMatriz.repeticiones;
    } else if (tipo === 'series' && sesionMatriz.estructura && sesionMatriz.estructura.includes('x')) {
      const match = sesionMatriz.estructura.match(/(\d+)x/);
      if (match) detalle.repeticiones = parseInt(match[1]);
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
      if (partePrincipal < 5) {
        calentamiento = 3;
        enfriamiento = 2;
        partePrincipal = duracionTotal - 5;
      }
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
        partes.push({
          texto: match[2],
          minutos: parseInt(match[1])
        });
      } else {
        partes.push({
          texto: seg,
          minutos: null
        });
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
        const restantesConMinutos = partes.slice(i).filter(p => p.minutos !== null).length;
        let nuevosMinutos;
        if (restantesConMinutos === 1) {
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

  aplicarFactorLargo(sesion, progresion, semanaEnFase) {
    if (!progresion?.length) return sesion;

    const factor = progresion[(semanaEnFase - 1) % progresion.length] || 1.0;
    const nuevaDuracion = Math.round(sesion.duracion * factor);
    const nuevaDuracionLimitada = Math.min(nuevaDuracion, 210);

    return {
      ...sesion,
      duracion: nuevaDuracionLimitada,
      detalle: {
        ...sesion.detalle,
        duracion: nuevaDuracionLimitada,
        estructura: sesion.tipo === 'series' ? sesion.detalle.estructura : this.escalarEstructura(sesion.detalle.estructura, nuevaDuracionLimitada),
        nombre: sesion.detalle.nombre + (factor > 1.2 ? ' (progresión)' : factor < 0.8 ? ' (descarga)' : '')
      }
    };
  },

  aplicarFactorDesnivel(sesion, progresion, semanaEnFase) {
    if (!progresion || !sesion.desnivel) return sesion;

    const factor = progresion[(semanaEnFase - 1) % progresion.length] || 1.0;
    const desnivelMatch = sesion.desnivel.match(/\d+/);
    if (desnivelMatch) {
      const desnivelBase = parseInt(desnivelMatch[0]);
      const nuevoDesnivel = Math.min(Math.round(desnivelBase * factor), 2000);
      sesion.desnivel = `+${nuevoDesnivel}m`;
      if (sesion.detalle) sesion.detalle.desnivel = sesion.desnivel;
    }
    return sesion;
  },

  obtenerDiasSeleccionados() {
    const dias = [];
    for (let i = 1; i <= 7; i++) {
      const cb = document.getElementById(`dia${i}`);
      if (cb?.checked) dias.push(i);
    }
    return dias;
  },

  definirFasesProfesionales(meses, distancia, objetivo) {
    const semanasPorMes = 4;
    const totalSemanas = meses * semanasPorMes;
    const fases = [];

    if (meses <= 3) {
      fases.push(
        { nombre: 'base', semanaInicio: 1, duracion: Math.round(totalSemanas * 0.4) },
        { nombre: 'construccion', semanaInicio: 1 + Math.round(totalSemanas * 0.4), duracion: Math.round(totalSemanas * 0.35) },
        { nombre: 'especifica', semanaInicio: 1 + Math.round(totalSemanas * 0.75), duracion: totalSemanas - Math.round(totalSemanas * 0.75) }
      );
    } else if (meses <= 6) {
      fases.push(
        { nombre: 'base', semanaInicio: 1, duracion: Math.round(totalSemanas * 0.3) },
        { nombre: 'construccion', semanaInicio: 1 + Math.round(totalSemanas * 0.3), duracion: Math.round(totalSemanas * 0.3) },
        { nombre: 'especifica', semanaInicio: 1 + Math.round(totalSemanas * 0.6), duracion: Math.round(totalSemanas * 0.3) },
        { nombre: 'taper', semanaInicio: 1 + Math.round(totalSemanas * 0.9), duracion: totalSemanas - Math.round(totalSemanas * 0.9) }
      );
    } else {
      fases.push(
        { nombre: 'base', semanaInicio: 1, duracion: 16 },
        { nombre: 'construccion', semanaInicio: 17, duracion: 12 },
        { nombre: 'especifica', semanaInicio: 29, duracion: 12 },
        { nombre: 'pico', semanaInicio: 41, duracion: 6 },
        { nombre: 'taper', semanaInicio: 47, duracion: 2 }
      );
    }

    const suma = fases.reduce((acc, f) => acc + f.duracion, 0);
    if (suma > totalSemanas) {
      fases[fases.length - 1].duracion -= (suma - totalSemanas);
    } else if (suma < totalSemanas) {
      fases[fases.length - 1].duracion += (totalSemanas - suma);
    }

    return fases.filter(f => f.duracion > 0);
  },

  obtenerFaseActual(fases, semanaGlobal) {
    for (let fase of fases) {
      if (semanaGlobal >= fase.semanaInicio && semanaGlobal < fase.semanaInicio + fase.duracion) {
        return fase;
      }
    }
    return fases[0];
  },

  obtenerSensacion(tipo, fase) {
    const sensaciones = {
      rodaje: { base: 'Cómodo', construccion: 'Controlado', especifica: 'Activo', pico: 'Exigente', taper: 'Muy suave' },
      tempo: { base: 'Fuerte', construccion: 'Exigente', especifica: 'Muy exigente', pico: 'Límite', taper: 'Suave' },
      series: { base: 'Rápidas', construccion: 'Intensas', especifica: 'Muy intensas', pico: 'Máximas', taper: 'Suaves' },
      largo: { base: 'Resistencia', construccion: 'Fondo', especifica: 'Calidad', pico: 'Simulación', taper: 'Ligero' }
    };
    return sensaciones[tipo]?.[fase] || 'Controlado';
  },

  obtenerZonaPorTipo(tipo) {
    const zonas = {
      rodaje: 'Z2',
      tempo: 'Z3-Z4',
      series: 'Z4-Z5',
      largo: 'Z2'
    };
    return zonas[tipo] || 'Z2';
  },

  // ==========================================================================
  // GUARDADO EN FIREBASE
  // ==========================================================================
  async guardarPlanEnFirebase(planId, planData) {
    if (!AppState.currentUserId) return;
    try {
      const dataToSave = {
        ...planData,
        sesionesRealizadas: {}  // Inicializar mapa vacío
      };
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

  // ==========================================================================
  // VISUALIZACIÓN DEL CALENDARIO
  // ==========================================================================
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

    let html = '';
    const puedeVerDetalle = AppState.puedeVerDetalleSesion();
    const fechaInicio = AppState.planGeneradoActual?.fechaInicio ? new Date(AppState.planGeneradoActual.fechaInicio + 'T12:00:00') : null;

    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];
      if (!sesion) break;

      // Usar el mapa de sesiones realizadas
      const realizada = AppState.sesionesRealizadas?.[i] ? 'realizado' : '';

      // Bloqueo para no premium basado en la fecha real de la sesión
      let bloqueado = false;
      if (!puedeVerDetalle && fechaInicio && sesion.fecha) {
        const fechaSesion = new Date(sesion.fecha);
        const diasTranscurridos = Math.floor((fechaSesion - fechaInicio) / (1000 * 60 * 60 * 24));
        if (diasTranscurridos > 14) bloqueado = true;
      }

      // Obtener el día del mes de la fecha de la sesión
      let diaDelMes = '';
      if (sesion.fecha) {
        const fecha = new Date(sesion.fecha);
        diaDelMes = fecha.getDate().toString();
      }

      let contenidoHtml = '';
      if (sesion.tipo !== 'descanso' && sesion.detalle) {
        contenidoHtml = `<strong>${sesion.letra}</strong><div>${diaDelMes}</div>`;
      } else {
        contenidoHtml = `<strong>D</strong><div>${diaDelMes}</div>`;
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada} ${bloqueado ? 'bloqueado' : ''}" data-index="${i}">${contenidoHtml}</div>`;
    }

    grid.innerHTML = html;

    document.querySelectorAll('.calendario-dia').forEach(dia => {
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
  // DETALLE DE SESIÓN (MODAL) - NUEVO DISEÑO EXPLICATIVO
  // ==========================================================================
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

      titulo.innerText = `${icono} ${sesion.tipo.toUpperCase()}: ${sesion.detalle.nombre}`;

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

  // ==========================================================================
  // FUNCIÓN PARA MARCAR UNA SESIÓN COMO REALIZADA (actualiza el mapa)
  // ==========================================================================
  async marcarSesionRealizada(diaIndex, realizada) {
    if (!AppState.currentUserId || !AppState.planActualId) return;

    try {
      const planRef = firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(AppState.planActualId);

      // Actualizar solo el campo sesionesRealizadas.diaIndex
      await planRef.update({
        [`sesionesRealizadas.${diaIndex}`]: realizada
      });

      // Actualizar estado local
      if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
      AppState.sesionesRealizadas[diaIndex] = realizada;

      // Actualizar la clase 'realizado' en la celda del calendario
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
  // FUNCIONES AUXILIARES PARA EL NUEVO MODAL EXPLICATIVO
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
      return {
        repeticiones: parseInt(match[1]),
        distancia: parseInt(match[2]) / 1000
      };
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

    return {
      distanciaTotal,
      tssTotal: Math.round(tssTotal),
      pasos
    };
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
            <div class="paso-fila">
              <span class="paso-etiqueta">⏱️ Duración:</span> ${paso.minutos} min
            </div>
            <div class="paso-fila">
              <span class="paso-etiqueta">🎯 Ritmo objetivo:</span> ${paso.ritmo} min/km
            </div>
            <div class="paso-fila">
              <span class="paso-etiqueta">❤️ Frecuencia cardíaca:</span> ${paso.fc}
            </div>
            <div class="paso-fila">
              <span class="paso-etiqueta">📏 Distancia estimada:</span> ${paso.distancia.toFixed(2)} km
            </div>
          </div>
          <div class="paso-consejo">
            💬 ${consejo}
          </div>
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
      // Leer sesiones realizadas desde el mapa
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

  // ==========================================================================
  // CONTROL DEL CUESTIONARIO
  // ==========================================================================
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

console.log('✅ PlanGenerator v5.9 - Fecha de inicio respetada y día del mes visible');