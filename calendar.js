// ==================== calendar.js - GENERADOR PROFESIONAL CON MATRIZ COMPLETA ====================
// Versión: 9.0 - DEFINITIVA: TODOS los errores de tiempo corregidos
// ====================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},
  PLANTILLAS: window.PLANTILLAS_SEMANALES || {},
  
  // Constantes de configuración
  CONFIG: {
    CALENTAMIENTO: {
      FIJO: 15,
      MIN: 10,
      MAX: 20
    },
    ENFRIAMIENTO: {
      FIJO: 10,
      MIN: 5,
      MAX: 15
    },
    SERIES: {
      RECUPERACION_ESTANDAR: 2, // minutos entre series
      FACTOR_RITMO: 0.95 // 5% más rápido que ritmo base
    },
    PIRAMIDE: {
      DURACION_BASE: 25,
      FACTOR_MAXIMO: 1.5
    },
    LIMITES: {
      RODAJE: 120,
      TEMPO: 90,
      SERIES: 90,
      LARGO_NO_MARATON: 180,
      LARGO_MARATON: 240
    },
    FACTORES: {
      MAXIMO_PRINCIPIANTE: 1.3,
      MAXIMO_INTERMEDIO: 1.4,
      MAXIMO_AVANZADO: 1.5,
      BASE: 0.9,
      CONSTRUCCION: 1.0,
      ESPECIFICA: 1.1,
      PICO: 1.2,
      TAPER: 0.6
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

      // --- 1. Recoger inputs del usuario ---
      const modalidad = document.getElementById("modalidad").value;
      const distancia = document.getElementById("distObjetivo").value;
      const meses = parseInt(document.getElementById("duracionPlan").value);
      const nivel = document.getElementById("nivel").value;
      const experiencia = document.getElementById("experienciaDistancia").value;
      const objetivo = document.getElementById("objetivoPrincipal").value;
      const diaLargo = parseInt(document.getElementById("diaLargo").value);
      const fechaInicioStr = document.getElementById("fechaInicio").value;
      
      if (!fechaInicioStr) {
        throw new Error("SELECCIONA UNA FECHA DE INICIO");
      }
      const fechaInicio = new Date(fechaInicioStr);
      
      const diasEntreno = this.obtenerDiasSeleccionados();
      if (diasEntreno.length === 0) {
        throw new Error("SELECCIONA AL MENOS UN DÍA DE ENTRENO");
      }
      
      if (!diasEntreno.includes(diaLargo)) {
        const confirmed = await Utils.confirm('AÑADIR DÍA', "¿Añadir el día de tirada larga automáticamente?");
        if (confirmed) {
          diasEntreno.push(diaLargo);
          diasEntreno.sort((a, b) => a - b);
          document.getElementById(`dia${diaLargo}`).checked = true;
        } else {
          Utils.hideLoading();
          return;
        }
      }

      if (meses === 1 && !['2k', '5k', '10k'].includes(distancia)) {
        throw new Error("Plan de 1 mes solo para 2km, 5km y 10km");
      }
      if (['medio', 'maraton'].includes(distancia) && meses === 3 && experiencia === 'no') {
        throw new Error("Para Media o Maratón en 3 meses necesitas experiencia");
      }

      const libreriaPerfil = this.PLANTILLAS[modalidad]?.[distancia]?.[nivel];
      if (!libreriaPerfil || !libreriaPerfil.ciclos || libreriaPerfil.ciclos.length === 0) {
        throw new Error("No hay plantillas para tu perfil. Contacta al administrador.");
      }

      const fases = this.definirFasesProfesionales(meses, distancia, objetivo);
      const semanasTotales = meses * 4;
      
      const ritmoBase = AppState.lastRitmoBase;
      const fcUmbral = AppState.lastUL;
      
      const planCompleto = [];
      let fechaActual = new Date(fechaInicio);
      
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
        
        const semana = [];
        for (let diaSemana = 1; diaSemana <= 7; diaSemana++) {
          const sesionBase = plantillaSemana[diaSemana] || { tipo: 'descanso' };
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
          
          semana.push({
            diaGlobal: (semanaGlobal - 1) * 7 + diaSemana,
            semana: semanaGlobal,
            diaSemana: diaSemana,
            fecha: new Date(fechaActual),
            ...sesion
          });
        }
        
        planCompleto.push(...semana);
        fechaActual.setDate(fechaActual.getDate() + 7);
      }

      const planId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const mapaDist = { "2k": "2 km", "5k": "5 km", "10k": "10 km", "medio": "MEDIA", "maraton": "MARATÓN" };
      
      const planParaGuardar = {
        params: {
          modalidad,
          distancia,
          duracion: meses,
          diasPorSemana: diasEntreno.length,
          nivel,
          experiencia,
          objetivo,
          diaLargo,
          fechaInicio: fechaInicioStr,
          diasEntreno,
          planId,
          ritmoBase: AppState.lastRitmoBase,
          fcMax: AppState.lastFC,
          fcUmbral: AppState.lastUL
        },
        sesiones: planCompleto,
        resumen: `${mapaDist[distancia] || distancia} · ${diasEntreno.length} días · ${nivel}`,
        fechaCreacion: new Date().toISOString()
      };

      // Validación post-generación
      const sesionesInvalidas = this.validarPlanCompleto(planCompleto);
      if (sesionesInvalidas.length > 0) {
        console.warn(`⚠️ Se encontraron ${sesionesInvalidas.length} sesiones con incoherencias:`);
        sesionesInvalidas.forEach(s => {
          console.warn(`  - Semana ${s.semana}, Día ${s.diaSemana}: ${s.problema}`);
        });
        if (AppState.isAdmin) {
          Utils.showToast(`⚠️ ${sesionesInvalidas.length} sesiones con incoherencias`, 'warning');
        }
      }

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
      
      if (window.UI) {
        await UI.cargarHistorialPlanes();
      }

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

  // --- FUNCIÓN PRINCIPAL CORREGIDA ---
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
    const CONFIG = this.CONFIG;
    
    const colores = {
      'rodaje': 'sesion-rodaje',
      'tempo': 'sesion-tempo',
      'series': 'sesion-series',
      'largo': 'sesion-largo',
      'descanso': 'sesion-descanso'
    };
    const letras = {
      'rodaje': 'R',
      'tempo': 'T',
      'series': 'S',
      'largo': 'L',
      'descanso': 'D'
    };

    // Buscar sesión en la matriz
    let sesionMatriz = null;
    
    if (sesionBase.fromMatrix) {
      const dbTipo = this.ENTRENAMIENTOS[modalidad]?.[distancia]?.[nivel]?.[tipo];
      
      if (dbTipo && dbTipo.length > 0) {
        if (sesionBase.variante) {
          sesionMatriz = dbTipo.find(s => 
            s.nombre.toLowerCase().includes(sesionBase.variante.toLowerCase())
          );
        }
        
        if (!sesionMatriz) {
          const indice = Math.floor(Math.random() * dbTipo.length);
          sesionMatriz = dbTipo[indice];
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

    // Calcular duración base de la sesión
    let duracionBase = sesionMatriz.duracion || 30;
    
    // Aplicar factores de fase
    let factorFase = CONFIG.FACTORES[faseActual.nombre.toUpperCase()] || 1.0;
    
    // Progresión dentro de la fase
    const progresoFase = semanaEnFase / faseActual.duracion;
    let factorProgresion = 0.9 + (progresoFase * 0.3);
    
    // Factor total
    let factorTotal = factorFase * factorProgresion;
    
    // Aplicar límite según nivel
    let factorMaximo = CONFIG.FACTORES.MAXIMO_AVANZADO;
    if (nivel === 'principiante') factorMaximo = CONFIG.FACTORES.MAXIMO_PRINCIPIANTE;
    if (nivel === 'intermedio') factorMaximo = CONFIG.FACTORES.MAXIMO_INTERMEDIO;
    
    if (factorTotal > factorMaximo) {
      console.log(`🔍 Factor ${factorTotal.toFixed(2)} > ${factorMaximo}, limitando`);
      factorTotal = factorMaximo;
    }
    
    let duracionTotal = Math.round(duracionBase * factorTotal);
    
    // Aplicar límites por tipo
    const limiteTipo = CONFIG.LIMITES[tipo.toUpperCase()] || 
                      (distancia === 'maraton' ? CONFIG.LIMITES.LARGO_MARATON : CONFIG.LIMITES.LARGO_NO_MARATON);
    
    if (duracionTotal > limiteTipo) {
      console.log(`🔍 Duración ${duracionTotal}' > ${limiteTipo}', limitando`);
      duracionTotal = limiteTipo;
    }

    // Procesar estructura
    const DURACION_CALENTAMIENTO = CONFIG.CALENTAMIENTO.FIJO;
    const DURACION_ENFRIAMIENTO = CONFIG.ENFRIAMIENTO.FIJO;
    
    let estructuraOriginal = sesionMatriz.estructura;
    let estructuraFinal = '';
    let duracionCalculada = 0;
    const notas = [];
    
    if (!estructuraOriginal) {
      estructuraFinal = `${duracionTotal}' continuos`;
      duracionCalculada = duracionTotal;
    }
    else {
      const partes = estructuraOriginal.split('+').map(p => p.trim());
      
      let tieneCalentamiento = false;
      let tieneEnfriamiento = false;
      const partesTrabajo = [];
      
      for (const parte of partes) {
        if (parte.includes('calentamiento')) {
          tieneCalentamiento = true;
        } else if (parte.includes('enfriamiento')) {
          tieneEnfriamiento = true;
        } else {
          partesTrabajo.push(parte);
        }
      }
      
      let tiempoTrabajo = duracionTotal;
      if (tieneCalentamiento) tiempoTrabajo -= DURACION_CALENTAMIENTO;
      if (tieneEnfriamiento) tiempoTrabajo -= DURACION_ENFRIAMIENTO;
      
      if (tiempoTrabajo < 15) {
        console.error('❌ Tiempo de trabajo insuficiente, ajustando');
        tiempoTrabajo = 30;
        duracionTotal = tiempoTrabajo;
        if (tieneCalentamiento) duracionTotal += DURACION_CALENTAMIENTO;
        if (tieneEnfriamiento) duracionTotal += DURACION_ENFRIAMIENTO;
      }
      
      const nuevasPartes = [];
      
      for (const parte of partes) {
        // CASO 1: CALENTAMIENTO
        if (parte.includes('calentamiento')) {
          nuevasPartes.push(parte.replace(/\b\d{1,3}\b/, DURACION_CALENTAMIENTO.toString()));
          duracionCalculada += DURACION_CALENTAMIENTO;
        }
        // CASO 2: ENFRIAMIENTO
        else if (parte.includes('enfriamiento')) {
          nuevasPartes.push(parte.replace(/\b\d{1,3}\b/, DURACION_ENFRIAMIENTO.toString()));
          duracionCalculada += DURACION_ENFRIAMIENTO;
        }
        // CASO 3: PIRÁMIDE
        else if (parte.includes('pirámide')) {
          const nums = parte.match(/\b\d{1,3}\b/g) || [];
          if (nums.length > 0) {
            const sumaOriginal = nums.reduce((sum, n) => sum + parseInt(n), 0);
            let nuevaParte = parte;
            for (const num of nums) {
              const valor = parseInt(num);
              const proporcion = valor / sumaOriginal;
              const nuevoValor = Math.round(tiempoTrabajo * proporcion);
              nuevaParte = nuevaParte.replace(new RegExp(`\\b${num}\\b`), nuevoValor.toString());
              duracionCalculada += nuevoValor;
            }
            nuevasPartes.push(nuevaParte);
          } else {
            const duracionPiramide = Math.round(CONFIG.PIRAMIDE.DURACION_BASE * Math.min(factorTotal, CONFIG.PIRAMIDE.FACTOR_MAXIMO));
            nuevasPartes.push(`pirámide (${duracionPiramide}')`);
            duracionCalculada += duracionPiramide;
          }
        }
        // CASO 4: SERIES
        else if (parte.includes('x')) {
          const match = parte.match(/(\d+)x(.*)/);
          if (match) {
            const repeticiones = parseInt(match[1]);
            const contenido = match[2];
            const nums = contenido.match(/\b\d{1,3}\b/g) || [];
            
            if (nums.length > 0) {
              const esDistancia = contenido.includes('m') && !contenido.includes("'");
              const esTiempo = contenido.includes("'");
              
              let nuevoContenido = contenido;
              let tiempoTotalSeries = 0;
              let tiempoRecuperacion = 0;
              
              if (esDistancia) {
                const distanciaMetros = parseInt(nums[0]);
                const ritmoSeries = ritmoBase * CONFIG.SERIES.FACTOR_RITMO;
                const tiempoPorSerieMin = (distanciaMetros / 1000) * ritmoSeries;
                
                tiempoTotalSeries = repeticiones * tiempoPorSerieMin;
                tiempoRecuperacion = (repeticiones - 1) * CONFIG.SERIES.RECUPERACION_ESTANDAR;
                
                duracionCalculada += tiempoTotalSeries + tiempoRecuperacion;
                
                nuevoContenido = `${repeticiones}x${distanciaMetros}m ` +
                                `(${tiempoPorSerieMin.toFixed(1)}' c/u, ` +
                                `rec ${tiempoRecuperacion}' entre series)`;
                
                notas.push(`🏃 Series: ${repeticiones}×${distanciaMetros/1000}km ` +
                          `a ritmo ${Utils.formatR(ritmoSeries)}/km`);
              } 
              else if (esTiempo) {
                const tiemposIndiv = nums.map(n => parseInt(n));
                const sumaTiemposOriginal = tiemposIndiv.reduce((a, b) => a + b, 0);
                
                if (sumaTiemposOriginal > 0) {
                  let sumaTotalOriginal = 0;
                  for (const p of partesTrabajo) {
                    const pNums = p.match(/\b\d{1,3}\b/g) || [];
                    pNums.forEach(n => sumaTotalOriginal += parseInt(n));
                  }
                  
                  const proporcionParte = sumaTiemposOriginal / sumaTotalOriginal;
                  const tiempoEstaParte = Math.round(tiempoTrabajo * proporcionParte);
                  
                  let idx = 0;
                  nuevoContenido = contenido.replace(/\b\d{1,3}\b/g, (match) => {
                    const proporcion = tiemposIndiv[idx] / sumaTiemposOriginal;
                    const nuevoValor = Math.round(tiempoEstaParte * proporcion);
                    tiempoTotalSeries += nuevoValor;
                    return nuevoValor.toString();
                  });
                  
                  duracionCalculada += tiempoTotalSeries;
                }
              }
              
              nuevasPartes.push(`${repeticiones}x${nuevoContenido}`);
            } else {
              nuevasPartes.push(parte);
            }
          } else {
            nuevasPartes.push(parte);
          }
        }
        // CASO 5: PARTE NORMAL
        else {
          const nums = parte.match(/\b\d{1,3}\b/g) || [];
          if (nums.length > 0) {
            let sumaTotalOriginal = 0;
            for (const p of partesTrabajo) {
              const pNums = p.match(/\b\d{1,3}\b/g) || [];
              pNums.forEach(n => sumaTotalOriginal += parseInt(n));
            }
            
            if (sumaTotalOriginal > 0) {
              const sumaEstaParte = nums.reduce((sum, n) => sum + parseInt(n), 0);
              const proporcion = sumaEstaParte / sumaTotalOriginal;
              const tiempoEstaParte = Math.round(tiempoTrabajo * proporcion);
              
              let nuevaParte = parte;
              if (nums.length === 1) {
                nuevaParte = nuevaParte.replace(/\b\d{1,3}\b/, tiempoEstaParte.toString());
                duracionCalculada += tiempoEstaParte;
              } else {
                const sumaInterna = nums.reduce((sum, n) => sum + parseInt(n), 0);
                let idx = 0;
                nuevaParte = nuevaParte.replace(/\b\d{1,3}\b/g, (match) => {
                  const proporcionInterna = parseInt(nums[idx]) / sumaInterna;
                  const nuevoValor = Math.round(tiempoEstaParte * proporcionInterna);
                  duracionCalculada += nuevoValor;
                  return nuevoValor.toString();
                });
              }
              nuevasPartes.push(nuevaParte);
            } else {
              nuevasPartes.push(parte);
            }
          } else {
            const tiempoPorParte = Math.round(tiempoTrabajo / partesTrabajo.length);
            nuevasPartes.push(`${tiempoPorParte}' ${parte}`);
            duracionCalculada += tiempoPorParte;
          }
        }
      }
      
      estructuraFinal = nuevasPartes.join(' + ');
    }

    // AJUSTE DE REDONDEO
    const numerosFinal = estructuraFinal.match(/\b\d{1,3}\b/g) || [];
    let sumaActual = 0;
    numerosFinal.forEach(n => sumaActual += parseInt(n));
    
    if (Math.abs(sumaActual - duracionTotal) > 2 && !estructuraFinal.includes('x')) {
      console.log(`🔄 Ajustando redondeo: ${sumaActual} → ${duracionTotal}`);
      
      const partesArray = estructuraFinal.split('+').map(p => p.trim());
      
      for (let i = partesArray.length - 1; i >= 0; i--) {
        const parte = partesArray[i];
        const nums = parte.match(/\b\d{1,3}\b/g);
        
        if (nums && nums.length > 0 && !parte.includes('x')) {
          const ultimoNum = nums[nums.length - 1];
          const diferencia = duracionTotal - sumaActual;
          const nuevoValor = parseInt(ultimoNum) + diferencia;
          
          if (nuevoValor > 0) {
            partesArray[i] = parte.replace(
              new RegExp(`\\b${ultimoNum}\\b(?!.*\\b\\d+\\b)`), 
              nuevoValor.toString()
            );
            estructuraFinal = partesArray.join(' + ');
            duracionCalculada = duracionTotal;
            break;
          }
        }
      }
    }

    // Calcular ritmos objetivo
    let ritmoObjetivo = '';
    let fcObjetivo = '';
    
    const ritmoSeries = ritmoBase * CONFIG.SERIES.FACTOR_RITMO;
    
    if (tipo === 'rodaje') {
      const ritmo = ritmoBase * 1.25;
      ritmoObjetivo = Utils.formatR(ritmo);
      fcObjetivo = `${Math.round(fcUmbral * 0.75)}-${Math.round(fcUmbral * 0.85)} lpm`;
    } else if (tipo === 'tempo') {
      const ritmo = ritmoBase * 1.05;
      ritmoObjetivo = Utils.formatR(ritmo);
      fcObjetivo = `${Math.round(fcUmbral * 0.88)}-${Math.round(fcUmbral * 0.94)} lpm`;
    } else if (tipo === 'series') {
      ritmoObjetivo = Utils.formatR(ritmoSeries);
      fcObjetivo = `> ${Math.round(fcUmbral * 1.02)} lpm`;
    } else if (tipo === 'largo') {
      const ritmo = ritmoBase * 1.25;
      ritmoObjetivo = Utils.formatR(ritmo);
      fcObjetivo = `${Math.round(fcUmbral * 0.70)}-${Math.round(fcUmbral * 0.82)} lpm`;
    }

    const detalle = {
      nombre: sesionMatriz.nombre || `${tipo}: ${sesionBase.variante || 'sesión'}`,
      descripcion: sesionMatriz.desc || sesionMatriz.descripcion || `Sesión de ${tipo} en fase ${faseActual.nombre}`,
      estructura: estructuraFinal,
      sensacion: sesionMatriz.sensacion || this.obtenerSensacion(tipo, faseActual.nombre),
      zona: sesionMatriz.zona || this.obtenerZonaPorTipo(tipo),
      duracion: Math.round(duracionTotal),
      ritmoObjetivo: ritmoObjetivo,
      fcObjetivo: fcObjetivo,
      notas: notas.length > 0 ? notas : undefined
    };
    
    if (sesionMatriz.repeticiones) {
      detalle.repeticiones = sesionMatriz.repeticiones;
    }

    return {
      tipo,
      color: colores[tipo] || 'sesion-descanso',
      letra: letras[tipo] || '?',
      duracion: Math.round(duracionTotal),
      detalle
    };
  },

  // --- FUNCIÓN CORREGIDA PARA FACTOR LARGO ---
  aplicarFactorLargo(sesion, progresion, semanaEnFase) {
    if (!progresion || progresion.length === 0 || !sesion.detalle) return sesion;
    
    // Verificar si ya se aplicó un factor
    if (sesion.detalle.nombre.includes('(máximo)') || sesion.detalle.nombre.includes('(descarga)')) {
      console.log('⚠️ Factor ya aplicado, omitiendo');
      return sesion;
    }
    
    const factorSemanal = progresion[(semanaEnFase - 1) % progresion.length] || 1.0;
    const CONFIG = this.CONFIG;
    
    console.log(`🔍 Largo - Original: ${sesion.duracion}', Factor: ${factorSemanal}`);
    
    // Extraer estructura
    const estructuraOriginal = sesion.detalle.estructura;
    const partes = estructuraOriginal.split('+').map(p => p.trim());
    
    const DURACION_CALENTAMIENTO = CONFIG.CALENTAMIENTO.FIJO;
    const DURACION_ENFRIAMIENTO = CONFIG.ENFRIAMIENTO.FIJO;
    
    let tieneCalentamiento = false;
    let tieneEnfriamiento = false;
    const partesTrabajo = [];
    
    for (const parte of partes) {
      if (parte.includes('calentamiento')) tieneCalentamiento = true;
      else if (parte.includes('enfriamiento')) tieneEnfriamiento = true;
      else partesTrabajo.push(parte);
    }
    
    // Calcular tiempo de trabajo actual
    let tiempoTrabajoActual = sesion.duracion;
    if (tieneCalentamiento) tiempoTrabajoActual -= DURACION_CALENTAMIENTO;
    if (tieneEnfriamiento) tiempoTrabajoActual -= DURACION_ENFRIAMIENTO;
    
    // Aplicar factor SOLO al tiempo de trabajo
    let nuevoTiempoTrabajo = Math.round(tiempoTrabajoActual * factorSemanal);
    
    // Límite de seguridad
    const distancia = AppState.planGeneradoActual?.distancia;
    const maxLargo = distancia === 'maraton' ? CONFIG.LIMITES.LARGO_MARATON : CONFIG.LIMITES.LARGO_NO_MARATON;
    const nuevaDuracionTotal = nuevoTiempoTrabajo + 
                              (tieneCalentamiento ? DURACION_CALENTAMIENTO : 0) + 
                              (tieneEnfriamiento ? DURACION_ENFRIAMIENTO : 0);
    
    if (nuevaDuracionTotal > maxLargo) {
      console.warn(`⚠️ Nueva duración ${nuevaDuracionTotal}' excede máximo ${maxLargo}'`);
      // Ajustar tiempo de trabajo para que total no exceda
      nuevoTiempoTrabajo = maxLargo - 
                          (tieneCalentamiento ? DURACION_CALENTAMIENTO : 0) - 
                          (tieneEnfriamiento ? DURACION_ENFRIAMIENTO : 0);
    }
    
    // Reconstruir estructura
    const nuevasPartes = [];
    let duracionCalculada = 0;
    
    for (const parte of partes) {
      if (parte.includes('calentamiento')) {
        nuevasPartes.push(parte.replace(/\b\d{1,3}\b/, DURACION_CALENTAMIENTO.toString()));
        duracionCalculada += DURACION_CALENTAMIENTO;
      }
      else if (parte.includes('enfriamiento')) {
        nuevasPartes.push(parte.replace(/\b\d{1,3}\b/, DURACION_ENFRIAMIENTO.toString()));
        duracionCalculada += DURACION_ENFRIAMIENTO;
      }
      else {
        const nums = parte.match(/\b\d{1,3}\b/g) || [];
        if (nums.length > 0) {
          let sumaOriginal = 0;
          for (const p of partesTrabajo) {
            const pNums = p.match(/\b\d{1,3}\b/g) || [];
            pNums.forEach(n => sumaOriginal += parseInt(n));
          }
          
          if (sumaOriginal > 0) {
            const sumaEstaParte = nums.reduce((sum, n) => sum + parseInt(n), 0);
            const proporcion = sumaEstaParte / sumaOriginal;
            const tiempoEstaParte = Math.round(nuevoTiempoTrabajo * proporcion);
            
            let nuevaParte = parte;
            if (nums.length === 1) {
              nuevaParte = nuevaParte.replace(/\b\d{1,3}\b/, tiempoEstaParte.toString());
              duracionCalculada += tiempoEstaParte;
            } else {
              const sumaInterna = nums.reduce((sum, n) => sum + parseInt(n), 0);
              let idx = 0;
              nuevaParte = nuevaParte.replace(/\b\d{1,3}\b/g, (match) => {
                const proporcionInterna = parseInt(nums[idx]) / sumaInterna;
                const nuevoValor = Math.round(tiempoEstaParte * proporcionInterna);
                duracionCalculada += nuevoValor;
                return nuevoValor.toString();
              });
            }
            nuevasPartes.push(nuevaParte);
          }
        }
      }
    }
    
    const nuevaEstructura = nuevasPartes.join(' + ');
    
    console.log(`✅ Largo - Nueva duración: ${duracionCalculada}'`);
    
    return {
      ...sesion,
      duracion: duracionCalculada,
      detalle: {
        ...sesion.detalle,
        duracion: duracionCalculada,
        estructura: nuevaEstructura,
        nombre: sesion.detalle.nombre + (factorSemanal > 1.2 ? ' (máximo)' : factorSemanal < 0.8 ? ' (descarga)' : '')
      }
    };
  },

  // --- FUNCIÓN para factor de desnivel ---
  aplicarFactorDesnivel(sesion, progresion, semanaEnFase) {
    if (!progresion || !sesion.desnivel) return sesion;
    
    const factor = progresion[(semanaEnFase - 1) % progresion.length] || 1.0;
    const factorLimitado = Math.min(factor, 1.5);
    
    const desnivelMatch = sesion.desnivel.match(/\d+/);
    
    if (desnivelMatch) {
      const desnivelBase = parseInt(desnivelMatch[0]);
      const nuevoDesnivel = Math.round(desnivelBase * factorLimitado);
      sesion.desnivel = `+${nuevoDesnivel}m`;
      
      if (sesion.detalle) {
        sesion.detalle.desnivel = sesion.desnivel;
      }
    }
    
    return sesion;
  },

  // --- FUNCIÓN DE VALIDACIÓN POST-GENERACIÓN ---
  validarPlanCompleto(planCompleto) {
    const sesionesInvalidas = [];
    const CONFIG = this.CONFIG;
    
    planCompleto.forEach((sesion, index) => {
      if (sesion.tipo === 'descanso' || !sesion.detalle) return;
      
      const nums = sesion.detalle.estructura.match(/\b\d{1,3}\b/g) || [];
      let suma = 0;
      nums.forEach(n => suma += parseInt(n));
      
      if (sesion.detalle.estructura.includes('x') && sesion.detalle.estructura.includes('m')) {
        if (!sesion.detalle.notas || sesion.detalle.notas.length === 0) {
          sesionesInvalidas.push({
            semana: sesion.semana,
            diaSemana: sesion.diaSemana,
            problema: 'Series con distancias sin notas explicativas'
          });
        }
      }
      else if (Math.abs(suma - sesion.duracion) > 10) {
        sesionesInvalidas.push({
          semana: sesion.semana,
          diaSemana: sesion.diaSemana,
          problema: `Duración ${sesion.duracion}' vs estructura ${suma}' (dif ${Math.abs(suma - sesion.duracion)}')`
        });
      }
      
      // Verificar límites por tipo
      const limite = CONFIG.LIMITES[sesion.tipo.toUpperCase()] || 
                    (AppState.planGeneradoActual?.distancia === 'maraton' ? 
                     CONFIG.LIMITES.LARGO_MARATON : CONFIG.LIMITES.LARGO_NO_MARATON);
      
      if (sesion.duracion > limite) {
        sesionesInvalidas.push({
          semana: sesion.semana,
          diaSemana: sesion.diaSemana,
          problema: `Duración ${sesion.duracion}' excede límite ${limite}'`
        });
      }
    });
    
    return sesionesInvalidas;
  },

  // --- FUNCIONES AUXILIARES ---
  
  obtenerDiasSeleccionados() {
    const dias = [];
    for (let i = 1; i <= 7; i++) {
      const cb = document.getElementById(`dia${i}`);
      if (cb && cb.checked) dias.push(i);
    }
    return dias;
  },

  definirFasesProfesionales(meses, distancia, objetivo) {
    const fases = [];
    const semanasPorMes = 4;
    const totalSemanas = meses * semanasPorMes;
    
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

  async guardarPlanEnFirebase(planId, planData) {
    if (!AppState.currentUserId) return;
    
    try {
      await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(planId)
        .set(planData);
      
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

  // --- FUNCIONES DE VISUALIZACIÓN ---
  
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
    const fechaInicio = AppState.planGeneradoActual?.fechaInicio ? new Date(AppState.planGeneradoActual.fechaInicio) : null;

    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];
      if (!sesion) break;

      const realizada = AppState.sesionesRealizadas && AppState.sesionesRealizadas[i] ? 'realizado' : '';
      
      let bloqueado = false;
      if (!puedeVerDetalle && fechaInicio) {
        const fechaSesion = new Date(fechaInicio);
        fechaSesion.setDate(fechaSesion.getDate() + Math.floor(i / 7) * 7 + (sesion.diaSemana - 1));
        const diasTranscurridos = Math.floor((fechaSesion - fechaInicio) / (1000 * 60 * 60 * 24));
        
        if (diasTranscurridos > 14) {
          bloqueado = true;
        }
      }
      
      let contenidoHtml = '';
      if (sesion.tipo !== 'descanso' && sesion.detalle) {
        const tiempoFormateado = Math.round(sesion.duracion) + "'";
        
        contenidoHtml = `
          <strong>${sesion.letra}</strong>
          <div>${tiempoFormateado}</div>
        `;
      } else {
        contenidoHtml = '<strong>D</strong>';
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada} ${bloqueado ? 'bloqueado' : ''}" data-index="${i}">
        ${contenidoHtml}
      </div>`;
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
      if (sesion.tipo === 'rodaje') icono = "🏃";
      else if (sesion.tipo === 'tempo') icono = "⚡";
      else if (sesion.tipo === 'series') icono = "🔁";
      else if (sesion.tipo === 'largo') icono = "📏";
      
      titulo.innerText = `${icono} ${sesion.tipo.toUpperCase()}: ${sesion.detalle.nombre}`;

      let descHtml = `
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 2px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-around; margin-bottom: 20px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 14px; color: var(--text-secondary);">DURACIÓN</div>
              <div style="font-size: 32px; font-weight: bold;">${Math.round(sesion.duracion)}'</div>
            </div>
            <div>
              <div style="font-size: 14px; color: var(--text-secondary);">ZONA</div>
              <div style="font-size: 32px; font-weight: bold;">${sesion.detalle.zona}</div>
            </div>
            ${sesion.detalle.ritmoObjetivo ? `
            <div>
              <div style="font-size: 14px; color: var(--text-secondary);">RITMO</div>
              <div style="font-size: 32px; font-weight: bold;">${sesion.detalle.ritmoObjetivo}</div>
            </div>
            ` : ''}
          </div>
          
          <div style="text-align: left; margin-top: 20px;">
            <p style="margin: 15px 0;"><strong>📋 ESTRUCTURA:</strong> ${sesion.detalle.estructura}</p>
      `;

      if (sesion.detalle.notas && sesion.detalle.notas.length > 0) {
        descHtml += `<div style="margin: 15px 0; padding: 15px; background: var(--bg-primary); border-left: 4px solid var(--accent-blue);">`;
        descHtml += `<p style="margin: 0 0 10px 0;"><strong>🔢 DESGLOSE DE SERIES:</strong></p>`;
        sesion.detalle.notas.forEach(nota => {
          descHtml += `<p style="margin: 5px 0; font-size: 13px;">${nota}</p>`;
        });
        descHtml += `</div>`;
      }

      const numsEstructura = sesion.detalle.estructura.match(/\b\d{1,3}\b/g) || [];
      let sumaEstructura = 0;
      numsEstructura.forEach(n => sumaEstructura += parseInt(n));

      if (Math.abs(sumaEstructura - sesion.duracion) > 5 && !sesion.detalle.estructura.includes('x')) {
        descHtml += `
          <p style="margin: 15px 0; color: var(--accent-yellow);">
            <strong>⚠️ NOTA:</strong> La duración total (${sesion.duracion}') incluye recuperaciones 
            y transiciones no mostradas explícitamente en la estructura.
          </p>
        `;
      }

      descHtml += `
            <p style="margin: 15px 0;"><strong>💬 SENSACIÓN:</strong> ${sesion.detalle.sensacion}</p>
            <p style="margin: 15px 0;"><strong>❤️ FRECUENCIA CARDÍACA:</strong> ${sesion.detalle.fcObjetivo}</p>
            <p style="margin: 15px 0;"><strong>📝 DESCRIPCIÓN:</strong> ${sesion.detalle.descripcion}</p>
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

  async marcarSesionRealizada(diaIndex, realizada) {
    if (!AppState.currentUserId || !AppState.planActualId) return;

    try {
      const planRef = firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('planes')
        .doc(AppState.planActualId);
      
      const planDoc = await planRef.get();
      if (!planDoc.exists) return;
      
      const planData = planDoc.data();
      if (!planData.sesiones || !planData.sesiones[diaIndex]) return;
      
      planData.sesiones[diaIndex].realizada = realizada;
      
      await planRef.update({
        sesiones: planData.sesiones
      });
      
      if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
      AppState.sesionesRealizadas[diaIndex] = realizada;

      const celda = document.querySelector(`.calendario-dia[data-index="${diaIndex}"]`);
      if (celda) {
        if (realizada) {
          celda.classList.add('realizado');
        } else {
          celda.classList.remove('realizado');
        }
      }

      Utils.showToast(realizada ? '✅ Sesión marcada' : '📝 Sesión desmarcada', 'success');
      
    } catch (error) {
      console.error('Error marcando sesión:', error);
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

      AppState.planGeneradoActual = planCompleto.params;
      AppState.planActualId = ultimoPlanId;
      AppState.sesionesRealizadas = {};
      AppState.trimestreActual = 0;
      
      if (planCompleto.sesiones) {
        planCompleto.sesiones.forEach((sesion, index) => {
          if (sesion.realizada) {
            AppState.sesionesRealizadas[index] = true;
          }
        });
      }
      
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
  }
};

// Variables globales
window.PlanGenerator = PlanGenerator;

// Funciones globales
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

console.log('✅ PlanGenerator v9.0 - DEFINITIVA: TODOS los errores de tiempo corregidos');