// ============================================================================
// calendar.js - PLAN DE ENTRENAMIENTO PROFESIONAL CON BASE CIENTÍFICA
// Basado en investigación de:
// - Stephen Seiler (distribución polarizada 80/20)
// - Edward Coyle (determinantes del rendimiento)
// - Veronique Billat (VO2máx y tiempo límite)
// - TrainingPeaks / Brooks Beasts (periodización profesional)
// - Grupo Sobre Entrenamiento (G-SE) (fisiología del umbral)
// 
// VERSIÓN: 5.0 - ÉLITE ADAPTATIVO | CON FEEDBACK Y MODELO DE ATLETA
// ============================================================================

const PlanGenerator = {
  ENTRENAMIENTOS: window.ENTRENAMIENTOS_DB || {},

  // ==========================================================================
  // FUNDAMENTO CIENTÍFICO: LOS 3 DETERMINANTES DEL RENDIMIENTO (Coyle et al.)
  // ==========================================================================
  DETERMINANTES_RENDIMIENTO: {
    VO2MAX: 'Capacidad máxima de transporte y utilización de oxígeno',
    UMBRAL_LACTATO: 'Máximo estado estable de lactato sin acumulación',
    ECONOMIA_CARRERA: 'Eficiencia mecánica y metabólica'
  },

  // ==========================================================================
  // ZONAS FISIOLÓGICAS BASADAS EN UMBRAL DE LACTATO (G-SE, lactate.com)
  // ==========================================================================
  ZONAS_FISIOLOGICAS: {
    Z1: { 
      nombre: 'RECUPERACIÓN ACTIVA',
      lactato: '< 2 mMol/L',
      percepcion: 'Muy suave, conversación completa',
      beneficio: 'Eliminación de metabolitos, regeneración activa',
      fc: '60-75% FCumbral',
      duracionOptima: '45-90 min',
      adaptacion: '↑ Flujo sanguíneo muscular, ↑ Eliminación lactato'
    },
    Z2: { 
      nombre: 'AERÓBICO EXTENSIVO (BASE)',
      lactato: '2-3 mMol/L',
      percepcion: 'Cómodo, hablable pero con esfuerzo',
      beneficio: '↑ Capilarización, ↑ Mitocondrias, ↑ Oxidación de grasas',
      fc: '75-85% FCumbral',
      duracionOptima: '45-120 min',
      adaptacion: '↑ Densidad mitocondrial, ↑ Capilares, ↑ Eficiencia metabólica'
    },
    Z3: { 
      nombre: 'TEMPO / UMBRAL AERÓBICO',
      lactato: '3-4 mMol/L',
      percepcion: 'Cómodamente duro, frases cortas',
      beneficio: '↑ Umbral aeróbico, ↑ Tolerancia al lactato',
      fc: '80-85% FCumbral',
      duracionOptima: '20-40 min continuos',
      adaptacion: '↑ Capacidad de eliminar lactato, ↑ Resistencia muscular'
    },
    Z4: { 
      nombre: 'UMBRAL ANAERÓBICO',
      lactato: '4-6 mMol/L',
      percepcion: 'Fuerte, controlado, apenas palabras',
      beneficio: '↑ Umbral anaeróbico, ↑ Tolerancia al lactato',
      fc: '85-92% FCumbral',
      duracionOptima: '20-30 min efectivos',
      adaptacion: '↑ Eliminación de lactato, ↑ Eficiencia cardiovascular'
    },
    Z5: { 
      nombre: 'VO2MÁX (POTENCIA AERÓBICA)',
      lactato: '6-10 mMol/L',
      percepcion: 'Muy intenso, imposible hablar',
      beneficio: '↑ Gasto cardíaco, ↑ VO2máx',
      fc: '92-98% FCumbral',
      duracionOptima: '3-8 min por repetición',
      adaptacion: '↑ Volumen sistólico, ↑ Extracción de oxígeno'
    },
    Z6: { 
      nombre: 'CAPACIDAD ANAERÓBICA / VELOCIDAD',
      lactato: '> 10 mMol/L',
      percepcion: 'Máximo esfuerzo, sprint',
      beneficio: '↑ Potencia neuromuscular, ↑ Tolerancia ácido láctico',
      fc: '>98% FCumbral',
      duracionOptima: '30-90 segundos',
      adaptacion: '↑ Reclutamiento fibras rápidas, ↑ Capacidad buffer'
    }
  },

  // ==========================================================================
  // PERIODIZACIÓN PROFESIONAL COMPLETA (16 SEMANAS)
  // Basado en modelo de periodización por mesociclos de TrainingPeaks
  // ==========================================================================
  PERIODIZACION: {
    // MESOCICLO 1: BASE AERÓBICA + FUERZA GENERAL (Semanas 1-4)
    BASE: {
      nombre: 'BASE AERÓBICA',
      semanas: 4,
      volumen: 1.0,
      intensidad: 0.65,
      distribucionPolarizada: { Z1Z2: 0.85, Z3: 0.05, Z4: 0.00, Z5: 0.00, fuerza: 0.10 },
      objetivo: 'Construir base aeróbica, capilarización, economía de carrera',
      sesionesClave: ['rodajes Z2', 'cuestas suaves', 'fuerza general']
    },
    // MESOCICLO 2: CONSTRUCCIÓN + INTRODUCCIÓN UMBRAL (Semanas 5-8)
    CONSTRUCCION: {
      nombre: 'CONSTRUCCIÓN',
      semanas: 4,
      volumen: 1.1,
      intensidad: 0.75,
      distribucionPolarizada: { Z1Z2: 0.75, Z3: 0.10, Z4: 0.05, Z5: 0.00, fuerza: 0.10 },
      objetivo: 'Mejorar umbral aeróbico, resistencia muscular',
      sesionesClave: ['tempo Z3', 'series largas', 'fartlek']
    },
    // MESOCICLO 3: ESPECÍFICA + UMBRAL ANAERÓBICO (Semanas 9-12)
    ESPECIFICA: {
      nombre: 'ESPECÍFICA',
      semanas: 4,
      volumen: 1.15,
      intensidad: 0.85,
      distribucionPolarizada: { Z1Z2: 0.65, Z3: 0.10, Z4: 0.15, Z5: 0.10, fuerza: 0.00 },
      objetivo: 'Desarrollo de ritmo específico, VO2máx',
      sesionesClave: ['series VO2máx', 'over/unders', 'tirada larga específica']
    },
    // MESOCICLO 4: PICO + TAPER (Semanas 13-16)
    PICO_TAPER: {
      nombre: 'PICO + TAPER',
      semanas: 4,
      volumen: [1.2, 1.15, 0.8, 0.4], // progresión por semana
      intensidad: [0.95, 0.95, 0.7, 0.5],
      distribucionPolarizada: [
        { Z1Z2: 0.50, Z3: 0.15, Z4: 0.25, Z5: 0.10 }, // semana 13
        { Z1Z2: 0.55, Z3: 0.15, Z4: 0.20, Z5: 0.10 }, // semana 14
        { Z1Z2: 0.70, Z3: 0.10, Z4: 0.15, Z5: 0.05 }, // semana 15
        { Z1Z2: 0.90, Z3: 0.10, Z4: 0.00, Z5: 0.00 }  // semana 16
      ],
      objetivo: 'Máxima forma + supercompensación',
      sesionesClave: ['series cortas', 'ritmo competición', 'descanso activo']
    }
  },

  // ==========================================================================
  // REGLAS DE ENTRENADOR PROFESIONAL (NUEVO)
  // ==========================================================================
  REGLAS: {
    // Regla 1: Nunca dos sesiones de calidad consecutivas
    noCalidadConsecutiva: (dia, tipo, semana) => {
      const calidad = ['series', 'tempo', 'largo'];
      if (!calidad.includes(tipo)) return true;
      
      const diaAnterior = semana.find(d => d.diaSemana === dia - 1);
      if (diaAnterior && calidad.includes(diaAnterior.tipo)) {
        console.warn(`⚠️ Regla: No calidad consecutiva. Día ${dia}: ${tipo} después de ${diaAnterior.tipo}`);
        return false;
      }
      return true;
    },
    
    // Regla 2: Separación entre largos (mínimo 3 días)
    separacionLargos: (dia, tipo, semana, ultimoLargo) => {
      if (tipo !== 'largo') return true;
      if (!ultimoLargo) return true;
      
      const diasDesdeUltimoLargo = dia - ultimoLargo;
      if (diasDesdeUltimoLargo < 3) {
        console.warn(`⚠️ Regla: Separación largos. Solo ${diasDesdeUltimoLargo} días desde último largo. Mínimo 3.`);
        return false;
      }
      return true;
    },
    
    // Regla 3: Descarga automática si carga semanal > 10% respecto a anterior
    necesitaDescarga: (cargaSemanaActual, cargaSemanaAnterior) => {
      if (!cargaSemanaAnterior) return false;
      const incremento = (cargaSemanaActual - cargaSemanaAnterior) / cargaSemanaAnterior * 100;
      return incremento > 10;
    },
    
    // Regla 4: Progresión de nivel basada en rendimiento
    calcularNivelReal: (nivelBase, semanasCompletadas, feedbackPromedio) => {
      if (nivelBase === 'principiante') {
        if (semanasCompletadas >= 12 && feedbackPromedio > 4) return 'intermedio';
        if (semanasCompletadas >= 20) return 'intermedio';
      }
      if (nivelBase === 'intermedio') {
        if (semanasCompletadas >= 16 && feedbackPromedio > 4.5) return 'avanzado';
        if (semanasCompletadas >= 24) return 'avanzado';
      }
      return nivelBase;
    }
  },

  // ==========================================================================
  // BIBLIOTECA DE SESIONES DE ÉLITE (16 tipos diferentes)
  // Cada sesión tiene base fisiológica demostrada en investigación
  // ==========================================================================
  SESIONES_ELITE: {
    // ===== RODAJES AERÓBICOS (BASE) =====
    rodajeZ2_largo: {
      tipo: 'rodaje',
      nombre: 'Rodaje Aeróbico Extensivo',
      zonaPrincipal: 'Z2',
      objetivoFisiologico: 'Desarrollo de capacidad oxidativa (↑ mitocondrias, ↑ capilares)',
      estructura: {
        calentamiento: {
          duracion: 15,
          detalle: '5\' trote suave + 5\' progresión a Z2 + 5\' ejercicios técnicos',
          porQue: 'Activar sistema cardiovascular y neuromuscular',
          como: 'Trote muy suave (Z1), luego aumentar ritmo gradualmente, ejercicios: skipping, talones, elevación de rodillas',
          paraQue: 'Aumentar temperatura muscular, preparar articulaciones, activar sistema nervioso'
        },
        principal: {
          duracionBase: 75,
          detalle: 'Continuo en Z2 (75-85% FCumbral)',
          porQue: 'Estimular adaptaciones aeróbicas periféricas',
          como: 'Ritmo de conversación, respiración controlada, cadencia 170-180 ppm',
          paraQue: '↑ Densidad mitocondrial, ↑ Capilares, ↑ Oxidación de grasas'
        },
        vueltaCalma: {
          duracion: 10,
          detalle: 'Trote suave + estiramientos',
          porQue: 'Facilitar eliminación de metabolitos',
          como: '5\' trote Z1 + 5\' estiramientos estáticos',
          paraQue: 'Acelerar recuperación, mantener flexibilidad'
        }
      },
      metricas: {
        tssBase: 60,
        impacto: 'bajo',
        recuperacion: '24h'
      }
    },

    rodajeZ2_medio: {
      tipo: 'rodaje',
      nombre: 'Rodaje Aeróbico Medio',
      zonaPrincipal: 'Z2',
      objetivoFisiologico: 'Mantenimiento de base aeróbica',
      estructura: {
        calentamiento: { duracion: 10, detalle: 'trote progresivo', porQue: 'activación', como: 'trote suave', paraQue: 'preparar' },
        principal: { duracionBase: 50, detalle: 'Continuo Z2', porQue: 'mantener adaptaciones', como: 'ritmo cómodo', paraQue: 'consolidar base' },
        vueltaCalma: { duracion: 10, detalle: 'enfriamiento', porQue: 'recuperación', como: 'trote suave', paraQue: 'eliminar lactato' }
      }
    },

    rodajeZ2_corto: {
      tipo: 'rodaje',
      nombre: 'Rodaje de Recuperación Activa',
      zonaPrincipal: 'Z1-Z2',
      objetivoFisiologico: 'Eliminación de metabolitos, regeneración',
      estructura: {
        calentamiento: { duracion: 5, detalle: 'trote suave' },
        principal: { duracionBase: 30, detalle: 'Z1 suave' },
        vueltaCalma: { duracion: 5, detalle: 'estiramientos' }
      }
    },

    // ===== SESIONES DE TEMPO / UMBRAL =====
    tempoContinuo: {
      tipo: 'tempo',
      nombre: 'Tempo Continuo (Umbral Aeróbico)',
      zonaPrincipal: 'Z3',
      objetivoFisiologico: '↑ Umbral aeróbico, ↑ Tolerancia al lactato',
      estructura: {
        calentamiento: {
          duracion: 20,
          detalle: '10\' Z1 + 5\' Z2 + 5\' ejercicios dinámicos',
          porQue: 'Preparar para esfuerzo de umbral',
          como: 'Progresión gradual hasta Z2, incluir ejercicios de técnica',
          paraQue: 'Aumentar temperatura muscular y activar sistema cardiovascular'
        },
        principal: {
          duracionBase: 30,
          detalle: '30\' continuos en Z3 (80-85% FCumbral)',
          porQue: 'Mejorar capacidad de mantener ritmos aeróbicos exigentes',
          como: 'Ritmo "cómodamente duro" - puedes decir frases cortas',
          paraQue: '↑ Eficiencia cardiovascular, ↑ Capacidad de eliminar lactato'
        },
        vueltaCalma: {
          duracion: 15,
          detalle: '10\' Z1 + 5\' estiramientos',
          porQue: 'Eliminar lactato acumulado',
          como: 'Trote muy suave, luego estiramientos suaves',
          paraQue: 'Acelerar recuperación'
        }
      }
    },

    tempoUmbral: {
      tipo: 'tempo',
      nombre: 'Tempo de Umbral Anaeróbico',
      zonaPrincipal: 'Z4',
      objetivoFisiologico: '↑ Umbral anaeróbico, ↑ Tolerancia al lactato',
      estructura: {
        calentamiento: { duracion: 20, detalle: '15\' progresivo + 5\' ejercicios' },
        principal: { duracionBase: 25, detalle: '25\' en Z4 (85-92% FCumbral)' },
        vueltaCalma: { duracion: 15, detalle: '10\' Z1 + 5\' estiramientos' }
      }
    },

    overUnders: {
      tipo: 'tempo',
      nombre: 'Over/Unders (Sobrepaso/Recuperación)',
      zonaPrincipal: 'Z4/Z3',
      objetivoFisiologico: '↑ Capacidad de cambiar ritmos cerca del umbral',
      estructura: {
        calentamiento: { duracion: 20, detalle: 'progresivo + activación' },
        principal: { 
          duracionBase: 36, 
          detalle: '3x(5\' over Z4 + 5\' under Z3) + 2\' recuperación entre series',
          porQue: 'Mejorar transiciones metabólicas',
          como: 'Over: justo por encima umbral, Under: justo por debajo',
          paraQue: '↑ Flexibilidad metabólica, ↑ Tolerancia al lactato'
        },
        vueltaCalma: { duracion: 15, detalle: 'enfriamiento completo' }
      }
    },

    tempoProgresivo: {
      tipo: 'tempo',
      nombre: 'Tempo Progresivo',
      zonaPrincipal: 'Z3-Z4',
      objetivoFisiologico: '↑ Capacidad de aumentar ritmo bajo fatiga',
      estructura: {
        calentamiento: { duracion: 15 },
        principal: { duracionBase: 30, detalle: '10\' Z3 + 10\' Z4 + 10\' Z3' },
        vueltaCalma: { duracion: 15 }
      }
    },

    // ===== SERIES VO2MÁX (basado en Billat) =====
    seriesLargas: {
      tipo: 'series',
      nombre: 'Series VO2máx (Billat 3\')',
      zonaPrincipal: 'Z5',
      objetivoFisiologico: '↑ Gasto cardíaco, ↑ VO2máx',
      estructura: {
        calentamiento: {
          duracion: 25,
          detalle: '15\' progresivo + 5\' ejercicios + 3\' estímulos cortos',
          porQue: 'Preparación completa para esfuerzos máximos',
          como: 'Incluir 3 progresiones cortas de 30" para activar',
          paraQue: 'Alcanzar VO2máx rápidamente en las series'
        },
        principal: {
          duracionBase: 30,
          detalle: '6x3\' Z5 (92-98% FCumbral) con 3\' recuperación Z1',
          porQue: 'Estimular máxima potencia aeróbica',
          como: 'Ritmo que puedas mantener los 3\', pero MUY intenso',
          paraQue: '↑ Volumen sistólico, ↑ Extracción de oxígeno'
        },
        vueltaCalma: {
          duracion: 15,
          detalle: '10\' trote suave + 5\' estiramientos',
          porQue: 'Eliminar lactato acumulado',
          como: 'Muy suave, permitir que FC baje gradualmente',
          paraQue: 'Acelerar recuperación'
        }
      }
    },

    seriesCortas: {
      tipo: 'series',
      nombre: 'Series Cortas (Capacidad Anaeróbica)',
      zonaPrincipal: 'Z6',
      objetivoFisiologico: '↑ Potencia anaeróbica, ↑ Tolerancia ácido láctico',
      estructura: {
        calentamiento: { duracion: 20 },
        principal: { duracionBase: 20, detalle: '10x400m Z6 con 200m trote recuperación' },
        vueltaCalma: { duracion: 15 }
      }
    },

    seriesPiramidales: {
      tipo: 'series',
      nombre: 'Pirámide',
      zonaPrincipal: 'Z5-Z4',
      objetivoFisiologico: '↑ Versatilidad metabólica',
      estructura: {
        calentamiento: { duracion: 20 },
        principal: { duracionBase: 30, detalle: '200-400-600-800-600-400-200m' },
        vueltaCalma: { duracion: 15 }
      }
    },

    fartlek: {
      tipo: 'series',
      nombre: 'Fartlek (Juego de Ritmos)',
      zonaPrincipal: 'variable',
      objetivoFisiologico: '↑ Adaptabilidad neuromuscular y metabólica',
      estructura: {
        calentamiento: { duracion: 15 },
        principal: { duracionBase: 30, detalle: '2\' rápido + 2\' suave (repetir)' },
        vueltaCalma: { duracion: 10 }
      }
    },

    // ===== CUESTAS (Fuerza específica) =====
    cuestasCortas: {
      tipo: 'series',
      nombre: 'Cuestas Cortas (Potencia)',
      zonaPrincipal: 'Z5-Z6',
      objetivoFisiologico: '↑ Potencia neuromuscular, ↑ Reclutamiento fibras rápidas',
      estructura: {
        calentamiento: { duracion: 20 },
        principal: { duracionBase: 20, detalle: '12x45" cuesta 8-10% con trote bajada recuperación' },
        vueltaCalma: { duracion: 15 }
      }
    },

    cuestasLargas: {
      tipo: 'series',
      nombre: 'Cuestas Largas (Fuerza-Resistencia)',
      zonaPrincipal: 'Z4',
      objetivoFisiologico: '↑ Fuerza específica, ↑ Economía de carrera',
      estructura: {
        calentamiento: { duracion: 20 },
        principal: { duracionBase: 25, detalle: '8x90" cuesta 5-7% con trote bajada' },
        vueltaCalma: { duracion: 15 }
      }
    },

    // ===== TIRADAS LARGAS =====
    largoAerobico: {
      tipo: 'largo',
      nombre: 'Tirada Larga Aeróbica',
      zonaPrincipal: 'Z2',
      objetivoFisiologico: '↑ Resistencia aeróbica, ↑ Almacenamiento glucógeno',
      estructura: {
        calentamiento: { duracion: 15 },
        principal: { duracionBase: 90, detalle: '90\' continuos Z2' },
        vueltaCalma: { duracion: 10 }
      }
    },

    largoProgresivo: {
      tipo: 'largo',
      nombre: 'Tirada Larga Progresiva',
      zonaPrincipal: 'Z2-Z3',
      objetivoFisiologico: '↑ Resistencia específica, ↑ Capacidad de mantener ritmo bajo fatiga',
      estructura: {
        calentamiento: { duracion: 15 },
        principal: { duracionBase: 90, detalle: '60\' Z2 + 30\' Z3' },
        vueltaCalma: { duracion: 10 }
      }
    },

    largoRitmo: {
      tipo: 'largo',
      nombre: 'Tirada con Ritmo Objetivo',
      zonaPrincipal: 'Z3-Z4',
      objetivoFisiologico: '↑ Confianza en ritmo de competición',
      estructura: {
        calentamiento: { duracion: 20 },
        principal: { duracionBase: 70, detalle: '45\' Z2 + 25\' a ritmo objetivo' },
        vueltaCalma: { duracion: 15 }
      }
    }
  },

  // ==========================================================================
  // CONFIGURACIÓN POR DISTANCIA Y NIVEL (PROGRESIÓN CIENTÍFICA)
  // Basado en datos de corredores de élite y principiantes (Londres 2018)
  // ==========================================================================
  CONFIG_DISTANCIA: {
    '2k': {
      nombre: '2 km',
      volumenBase: { principiante: 20, intermedio: 25, avanzado: 30 }, // km/semana
      sesionesSemana: { principiante: 3, intermedio: 4, avanzado: 5 },
      intensidadBase: { principiante: 0.6, intermedio: 0.7, avanzado: 0.8 },
      enfoque: 'Velocidad y potencia anaeróbica'
    },
    '5k': {
      nombre: '5 km',
      volumenBase: { principiante: 25, intermedio: 35, avanzado: 50 },
      sesionesSemana: { principiante: 3, intermedio: 4, avanzado: 5 },
      intensidadBase: { principiante: 0.65, intermedio: 0.75, avanzado: 0.85 },
      enfoque: 'VO2máx y umbral'
    },
    '10k': {
      nombre: '10 km',
      volumenBase: { principiante: 30, intermedio: 45, avanzado: 65 },
      sesionesSemana: { principiante: 3, intermedio: 4, avanzado: 5 },
      intensidadBase: { principiante: 0.7, intermedio: 0.8, avanzado: 0.9 },
      enfoque: 'Umbral y resistencia'
    },
    'medio': {
      nombre: 'Media Maratón',
      volumenBase: { principiante: 35, intermedio: 55, avanzado: 80 },
      sesionesSemana: { principiante: 3, intermedio: 4, avanzado: 5 },
      intensidadBase: { principiante: 0.7, intermedio: 0.8, avanzado: 0.9 },
      enfoque: 'Umbral y resistencia específica'
    },
    'maraton': {
      nombre: 'Maratón',
      volumenBase: { principiante: 40, intermedio: 65, avanzado: 100 },
      sesionesSemana: { principiante: 3, intermedio: 4, avanzado: 6 },
      intensidadBase: { principiante: 0.7, intermedio: 0.8, avanzado: 0.9 },
      enfoque: 'Resistencia aeróbica máxima'
    }
  },

  // ==========================================================================
  // DISTRIBUCIÓN DE SESIONES POR NIVEL Y DISTANCIA (MATRIZ COMPLETA)
  // ==========================================================================
  DISTRIBUCION_SESIONES: {
    principiante: {
      '2k':  { rodajes: 2, tempo: 0, series: 0, cuestas: 0, largos: 1 },
      '5k':  { rodajes: 2, tempo: 0, series: 0, cuestas: 1, largos: 1 },
      '10k': { rodajes: 2, tempo: 0, series: 0, cuestas: 1, largos: 1 },
      'medio': { rodajes: 2, tempo: 0, series: 0, cuestas: 1, largos: 1 },
      'maraton': { rodajes: 2, tempo: 0, series: 0, cuestas: 1, largos: 1 }
    },
    intermedio: {
      '2k':  { rodajes: 2, tempo: 0, series: 1, cuestas: 1, largos: 1 },
      '5k':  { rodajes: 2, tempo: 0, series: 1, cuestas: 1, largos: 1 },
      '10k': { rodajes: 2, tempo: 1, series: 1, cuestas: 1, largos: 1 },
      'medio': { rodajes: 2, tempo: 1, series: 1, cuestas: 1, largos: 1 },
      'maraton': { rodajes: 2, tempo: 1, series: 1, cuestas: 1, largos: 1 }
    },
    avanzado: {
      '2k':  { rodajes: 2, tempo: 1, series: 2, cuestas: 1, largos: 1 },
      '5k':  { rodajes: 2, tempo: 1, series: 2, cuestas: 1, largos: 1 },
      '10k': { rodajes: 2, tempo: 1, series: 2, cuestas: 1, largos: 1 },
      'medio': { rodajes: 2, tempo: 1, series: 2, cuestas: 1, largos: 1 },
      'maraton': { rodajes: 2, tempo: 1, series: 2, cuestas: 1, largos: 1 }
    }
  },

  // ==========================================================================
  // PROGRESIÓN DE NIVEL (Principiante → Intermedio → Avanzado)
  // Basado en semanas de entrenamiento y adaptaciones fisiológicas
  // ==========================================================================
  PROGRESION_NIVEL: {
    principiante: {
      semanasMinimas: 0,
      semanasIntermedio: 8,  // A las 8 semanas pasa a intermedio
      semanasAvanzado: 16,    // A las 16 semanas pasa a avanzado
      factorProgresion: 1.0
    },
    intermedio: {
      semanasMinimas: 8,
      semanasAvanzado: 12,    // A las 12 semanas pasa a avanzado
      factorProgresion: 1.2
    },
    avanzado: {
      semanasMinimas: 16,
      factorProgresion: 1.5
    }
  },

  // ==========================================================================
  // GENERACIÓN DEL PLAN COMPLETO (MODIFICADO PARA USAR REGLAS)
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

      // Obtener parámetros del formulario
      const modalidad = document.getElementById("modalidad").value;
      const distanciaKey = document.getElementById("distObjetivo").value;
      const meses = parseInt(document.getElementById("duracionPlan").value);
      const nivelInput = document.getElementById("nivel").value;
      const experiencia = document.getElementById("experienciaDistancia").value;
      const objetivo = document.getElementById("objetivoPrincipal").value;

      // Validar días seleccionados
      const diasEntreno = this.obtenerDiasSeleccionados();
      if (diasEntreno.length === 0) {
        Utils.showToast("> SELECCIONA AL MENOS UN DÍA_", 'error');
        Utils.hideLoading();
        return;
      }

      // Calcular semanas totales
      const semanasTotales = meses * 4;

      // Obtener modelo de atleta para feedback
      const atleta = await this.obtenerModeloAtleta();

      // Determinar nivel REAL basado en progresión Y FEEDBACK
      const nivelReal = this.REGLAS.calcularNivelReal(
        nivelInput, 
        atleta.semanasCompletadas || 0,
        atleta.feedbackPromedio || 0
      );

      // Obtener configuración para esta distancia y nivel
      const configDist = this.CONFIG_DISTANCIA[distanciaKey];
      const distribucion = this.DISTRIBUCION_SESIONES[nivelReal][distanciaKey];

      // Calcular factor de progresión por nivel
      const factorProgresion = this.PROGRESION_NIVEL[nivelReal].factorProgresion;

      // Obtener datos fisiológicos del usuario
      const ritmoBase = AppState.lastRitmoBase;
      const fcUmbral = AppState.lastUL;

      // Generar plan completo
      const planCompleto = await this.generarPlanPeriodizado(
        semanasTotales,
        distanciaKey,
        nivelReal,
        diasEntreno,
        { modalidad, ritmoBase, fcUmbral },
        factorProgresion,
        atleta  // Pasamos el modelo de atleta
      );

      // Guardar plan
      const planId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const mapaDist = { "2k": "2 km", "5k": "5 km", "10k": "10 km", "medio": "MEDIA", "maraton": "MARATÓN" };

      const planParaGuardar = {
        params: {
          modalidad, distancia: distanciaKey, duracion: meses,
          diasPorSemana: diasEntreno.length,
          nivel: nivelInput, nivelReal, experiencia, objetivo,
          diasEntreno, planId,
          ritmoBase: AppState.lastRitmoBase,
          fcMax: AppState.lastFC,
          fcUmbral: AppState.lastUL
        },
        sesiones: planCompleto,
        resumen: `${mapaDist[distanciaKey] || distanciaKey} · ${diasEntreno.length} días · Nivel ${nivelReal}`,
        fechaCreacion: new Date().toISOString()
      };

      await this.guardarPlanEnFirebase(planId, planParaGuardar);

      // Actualizar estado
      AppState.planGeneradoActual = planParaGuardar.params;
      AppState.planActualId = planId;
      AppState.sesionesRealizadas = {};
      AppState.trimestreActual = 0;

      // Mostrar resumen (formato simplificado como en IMG_0895)
      document.getElementById("resumenObjetivo").innerHTML = `
        <strong>${mapaDist[distanciaKey]}</strong> · ${diasEntreno.length} días · ${nivelReal}
      `;

      // Mostrar calendario
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
  // OBTENER MODELO DE ATLETA (NUEVO)
  // ==========================================================================
  async obtenerModeloAtleta() {
    if (!AppState.currentUserId) return {};
    
    try {
      const doc = await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('rendimiento')
        .doc('modelo')
        .get();
      
      if (doc.exists) {
        return doc.data();
      }
    } catch (error) {
      console.warn('No se pudo cargar modelo de atleta:', error);
    }
    
    return {
      semanasCompletadas: 0,
      feedbackPromedio: 0,
      fatiga: 5,
      ultimaCarga: 0,
      historialSesiones: []
    };
  },

  // ==========================================================================
  // GUARDAR MODELO DE ATLETA (NUEVO)
  // ==========================================================================
  async guardarModeloAtleta(modelo) {
    if (!AppState.currentUserId) return;
    
    try {
      await firebaseServices.db
        .collection('users')
        .doc(AppState.currentUserId)
        .collection('rendimiento')
        .doc('modelo')
        .set(modelo, { merge: true });
    } catch (error) {
      console.warn('Error guardando modelo de atleta:', error);
    }
  },

  // ==========================================================================
  // DETERMINAR NIVEL REAL CON PROGRESIÓN
  // ==========================================================================
  determinarNivelReal(nivelInput, semanasTotales) {
    if (nivelInput === 'principiante') {
      if (semanasTotales >= this.PROGRESION_NIVEL.principiante.semanasAvanzado) {
        return 'avanzado';
      } else if (semanasTotales >= this.PROGRESION_NIVEL.principiante.semanasIntermedio) {
        return 'intermedio';
      }
      return 'principiante';
    } else if (nivelInput === 'intermedio') {
      if (semanasTotales >= this.PROGRESION_NIVEL.intermedio.semanasAvanzado) {
        return 'avanzado';
      }
      return 'intermedio';
    }
    return 'avanzado';
  },

  // ==========================================================================
  // GENERAR PLAN PERIODIZADO (CORAZÓN DEL ALGORITMO)
  // ==========================================================================
  async generarPlanPeriodizado(semanasTotales, distancia, nivel, diasEntreno, datos, factorProgresion, atleta) {
    const planCompleto = [];
    let diaGlobalCounter = 1;

    // Determinar mesociclos según duración
    const mesociclos = this.determinarMesociclos(semanasTotales);

    // Para cada semana del plan
    for (let semanaGlobal = 1; semanaGlobal <= semanasTotales; semanaGlobal++) {
      
      // Determinar mesociclo actual
      const mesociclo = this.obtenerMesocicloActual(mesociclos, semanaGlobal);
      const semanaEnMesociclo = semanaGlobal - mesociclo.inicio + 1;
      const esDescarga = (semanaEnMesociclo % 4 === 0) || (mesociclo.nombre === 'PICO_TAPER' && semanaEnMesociclo > 2);

      // Ajustar factores por fatiga del atleta
      let factorVolumen = this.calcularFactorVolumen(mesociclo, semanaEnMesociclo, esDescarga);
      let factorIntensidad = this.calcularFactorIntensidad(mesociclo, semanaEnMesociclo, esDescarga);
      
      // Ajustar por fatiga (NUEVO)
      if (atleta?.fatiga > 7) {
        factorVolumen *= 0.8;
        factorIntensidad *= 0.9;
      }

      // Generar sesiones para esta semana
      const semana = await this.generarSemana(
        semanaGlobal,
        mesociclo.nombre,
        nivel,
        distancia,
        diasEntreno,
        datos,
        factorVolumen,
        factorIntensidad,
        esDescarga,
        diaGlobalCounter,
        atleta  // Pasamos atleta para ajustes específicos
      );

      diaGlobalCounter += semana.length;
      planCompleto.push(...semana);
    }

    return planCompleto;
  },

  // ==========================================================================
  // DETERMINAR MESOCICLOS SEGÚN DURACIÓN
  // ==========================================================================
  determinarMesociclos(semanasTotales) {
    const mesociclos = [];
    
    if (semanasTotales <= 4) {
      // Plan corto: solo BASE
      mesociclos.push({ nombre: 'BASE', inicio: 1, duracion: semanasTotales });
    } else if (semanasTotales <= 8) {
      // Plan medio: BASE + CONSTRUCCIÓN
      const base = Math.floor(semanasTotales * 0.5);
      mesociclos.push({ nombre: 'BASE', inicio: 1, duracion: base });
      mesociclos.push({ nombre: 'CONSTRUCCION', inicio: base + 1, duracion: semanasTotales - base });
    } else if (semanasTotales <= 12) {
      // Plan largo: BASE + CONSTRUCCIÓN + ESPECÍFICA
      const base = Math.floor(semanasTotales * 0.4);
      const construccion = Math.floor(semanasTotales * 0.3);
      mesociclos.push({ nombre: 'BASE', inicio: 1, duracion: base });
      mesociclos.push({ nombre: 'CONSTRUCCION', inicio: base + 1, duracion: construccion });
      mesociclos.push({ nombre: 'ESPECIFICA', inicio: base + construccion + 1, duracion: semanasTotales - base - construccion });
    } else {
      // Plan completo: 4 mesociclos
      const base = Math.floor(semanasTotales * 0.25);
      const construccion = Math.floor(semanasTotales * 0.25);
      const especifica = Math.floor(semanasTotales * 0.25);
      const picoTaper = semanasTotales - base - construccion - especifica;
      
      mesociclos.push({ nombre: 'BASE', inicio: 1, duracion: base });
      mesociclos.push({ nombre: 'CONSTRUCCION', inicio: base + 1, duracion: construccion });
      mesociclos.push({ nombre: 'ESPECIFICA', inicio: base + construccion + 1, duracion: especifica });
      mesociclos.push({ nombre: 'PICO_TAPER', inicio: base + construccion + especifica + 1, duracion: picoTaper });
    }

    return mesociclos;
  },

  // ==========================================================================
  // OBTENER MESOCICLO ACTUAL
  // ==========================================================================
  obtenerMesocicloActual(mesociclos, semanaGlobal) {
    for (const m of mesociclos) {
      if (semanaGlobal >= m.inicio && semanaGlobal < m.inicio + m.duracion) {
        return m;
      }
    }
    return mesociclos[0];
  },

  // ==========================================================================
  // GENERAR UNA SEMANA DE ENTRENAMIENTO (MODIFICADO CON REGLAS)
  // ==========================================================================
  async generarSemana(semanaGlobal, fase, nivel, distancia, diasEntreno, datos, factorVolumen, factorIntensidad, esDescarga, diaGlobalCounter, atleta) {
    const semana = [];
    const { modalidad, ritmoBase, fcUmbral } = datos;

    // Obtener distribución base para este nivel y distancia
    const distribucionBase = this.DISTRIBUCION_SESIONES[nivel][distancia];
    
    // Ajustar distribución según fase y si es descarga
    let distribucion = { ...distribucionBase };
    
    if (esDescarga) {
      // Semana de descarga: reducir calidad
      distribucion.tempo = Math.max(0, (distribucion.tempo || 0) - 1);
      distribucion.series = 0;
      distribucion.cuestas = Math.max(0, (distribucion.cuestas || 0) - 1);
    }

    // Ajustar según fase
    if (fase === 'BASE') {
      // Más rodajes, menos calidad
      distribucion.rodajes = (distribucion.rodajes || 2) + 1;
      distribucion.tempo = 0;
      distribucion.series = 0;
    } else if (fase === 'CONSTRUCCION') {
      // Introducir tempo
      distribucion.tempo = Math.max(1, distribucion.tempo || 0);
    } else if (fase === 'ESPECIFICA') {
      // Máxima calidad
      distribucion.series = Math.max(2, distribucion.series || 1);
    } else if (fase === 'PICO_TAPER') {
      // Semanas de pico: máxima calidad
      if (semanaGlobal % 4 < 2) {
        distribucion.series = 2;
        distribucion.tempo = 1;
      } else {
        // Taper: reducir todo
        distribucion.rodajes = 1;
        distribucion.tempo = 0;
        distribucion.series = 0;
        distribucion.largos = 0;
      }
    }

    // Crear lista de tipos de sesión para esta semana
    const tiposSemana = [];
    
    // Añadir rodajes
    for (let i = 0; i < (distribucion.rodajes || 0); i++) {
      tiposSemana.push('rodaje');
    }
    
    // Añadir tempo
    for (let i = 0; i < (distribucion.tempo || 0); i++) {
      tiposSemana.push('tempo');
    }
    
    // Añadir series
    for (let i = 0; i < (distribucion.series || 0); i++) {
      tiposSemana.push('series');
    }
    
    // Añadir cuestas (como series especiales)
    for (let i = 0; i < (distribucion.cuestas || 0); i++) {
      tiposSemana.push('cuestas');
    }
    
    // Añadir largo (siempre 1 si está definido)
    if (distribucion.largos > 0) {
      tiposSemana.push('largo');
    }

    // Mezclar para distribución aleatoria pero controlada
    this.mezclarArray(tiposSemana);

    // Asignar a días disponibles (CON REGLAS)
    const diasDisponibles = [...diasEntreno];
    
    // Asegurar que el largo va en el día óptimo (generalmente domingo)
    const diaLargo = this.elegirDiaLargoOptimo(diasEntreno);
    
    // Mapa de tipos por día
    const tiposPorDia = {};
    
    // Primero, intentar colocar el largo respetando separación
    if (tiposSemana.includes('largo')) {
      // Buscar el último largo en las semanas anteriores
      const ultimoLargo = this.encontrarUltimoLargo(semanaGlobal, planCompleto);
      
      // Encontrar mejor día para largo que respete separación
      const mejorDiaLargo = this.encontrarMejorDiaParaLargo(diasDisponibles, ultimoLargo);
      
      if (mejorDiaLargo) {
        tiposPorDia[mejorDiaLargo] = 'largo';
        const index = diasDisponibles.indexOf(mejorDiaLargo);
        if (index !== -1) diasDisponibles.splice(index, 1);
        // Quitar largo de tiposSemana
        const largoIdx = tiposSemana.indexOf('largo');
        if (largoIdx !== -1) tiposSemana.splice(largoIdx, 1);
      } else {
        // No se puede poner largo esta semana, convertir a rodaje
        const largoIdx = tiposSemana.indexOf('largo');
        if (largoIdx !== -1) tiposSemana[largoIdx] = 'rodaje';
      }
    }

    // Asignar el resto de sesiones respetando no calidad consecutiva
    let tipoIndex = 0;
    const diasOrdenados = [...diasDisponibles].sort((a, b) => a - b);
    
    for (const dia of diasOrdenados) {
      if (tipoIndex < tiposSemana.length) {
        // Verificar si el día anterior fue calidad
        const diaAnterior = dia - 1;
        const tipoAnterior = tiposPorDia[diaAnterior];
        const calidad = ['series', 'tempo', 'largo'];
        
        if (tipoAnterior && calidad.includes(tipoAnterior)) {
          // Día anterior fue calidad, este día debe ser rodaje
          tiposPorDia[dia] = 'rodaje';
        } else {
          // Podemos poner el siguiente tipo disponible
          let tipo = tiposSemana[tipoIndex];
          if (tipo === 'cuestas') tipo = 'series';
          tiposPorDia[dia] = tipo;
          tipoIndex++;
        }
      } else {
        // Si sobran días, rodaje suave
        tiposPorDia[dia] = 'rodaje';
      }
    }

    // Generar cada día de la semana
    for (let diaSemana = 1; diaSemana <= 7; diaSemana++) {
      if (!diasEntreno.includes(diaSemana)) {
        // Día de descanso
        semana.push({
          diaGlobal: diaGlobalCounter++,
          semana: semanaGlobal,
          diaSemana,
          fase,
          nivel,
          tipo: 'descanso',
          color: 'sesion-descanso',
          letra: 'D',
          duracion: 0,
          detalle: null
        });
      } else {
        const tipo = tiposPorDia[diaSemana] || 'rodaje';
        
        // Seleccionar sesión específica según tipo y fase
        const sesion = this.seleccionarSesion(tipo, fase, nivel, distancia, modalidad);
        
        // Personalizar con datos del usuario y ajustar por fatiga
        const sesionPersonalizada = this.personalizarSesion(
          sesion,
          fase,
          nivel,
          distancia,
          { ritmoBase, fcUmbral },
          factorVolumen,
          factorIntensidad,
          atleta  // Pasamos atleta para ajustes
        );

        semana.push({
          diaGlobal: diaGlobalCounter++,
          semana: semanaGlobal,
          diaSemana,
          fase,
          nivel,
          tipo,
          color: this.getColor(tipo),
          letra: this.getLetra(tipo),
          duracion: sesionPersonalizada.duracionTotal,
          detalle: sesionPersonalizada
        });
      }
    }

    return semana;
  },

  // ==========================================================================
  // ENCONTRAR ÚLTIMO LARGO (NUEVO)
  // ==========================================================================
  encontrarUltimoLargo(semanaActual, planCompleto) {
    if (!planCompleto || planCompleto.length === 0) return -10;
    
    // Buscar en semanas anteriores
    for (let i = planCompleto.length - 1; i >= 0; i--) {
      if (planCompleto[i].tipo === 'largo') {
        return planCompleto[i].diaSemana;
      }
    }
    return -10;
  },

  // ==========================================================================
  // ENCONTRAR MEJOR DÍA PARA LARGO (NUEVO)
  // ==========================================================================
  encontrarMejorDiaParaLargo(diasDisponibles, ultimoLargo) {
    if (ultimoLargo === -10) {
      // Primer largo, preferir finde
      if (diasDisponibles.includes(7)) return 7;
      if (diasDisponibles.includes(6)) return 6;
      return diasDisponibles[0];
    }
    
    // Buscar día con al menos 3 días de diferencia
    const candidatos = diasDisponibles.filter(dia => Math.abs(dia - ultimoLargo) >= 3);
    
    if (candidatos.length === 0) return null;
    
    // Preferir domingo (7) o sábado (6)
    if (candidatos.includes(7)) return 7;
    if (candidatos.includes(6)) return 6;
    
    return candidatos[0];
  },

  // ==========================================================================
  // SELECCIONAR SESIÓN SEGÚN TIPO Y FASE
  // ==========================================================================
  seleccionarSesion(tipo, fase, nivel, distancia, modalidad) {
    const mapaSesiones = {
      rodaje: {
        BASE: 'rodajeZ2_largo',
        CONSTRUCCION: 'rodajeZ2_medio',
        ESPECIFICA: 'rodajeZ2_medio',
        PICO_TAPER: 'rodajeZ2_corto'
      },
      tempo: {
        BASE: 'tempoContinuo',
        CONSTRUCCION: 'tempoUmbral',
        ESPECIFICA: 'overUnders',
        PICO_TAPER: 'tempoProgresivo'
      },
      series: {
        BASE: 'cuestasLargas',
        CONSTRUCCION: 'seriesLargas',
        ESPECIFICA: 'seriesCortas',
        PICO_TAPER: 'seriesPiramidales'
      },
      largo: {
        BASE: 'largoAerobico',
        CONSTRUCCION: 'largoProgresivo',
        ESPECIFICA: 'largoRitmo',
        PICO_TAPER: 'largoAerobico'
      }
    };

    const sesionKey = mapaSesiones[tipo]?.[fase] || 'rodajeZ2_medio';
    return this.SESIONES_ELITE[sesionKey] || this.SESIONES_ELITE.rodajeZ2_medio;
  },

  // ==========================================================================
  // PERSONALIZAR SESIÓN CON DATOS DEL USUARIO (MODIFICADO)
  // ==========================================================================
  personalizarSesion(sesionBase, fase, nivel, distancia, datos, factorVolumen, factorIntensidad, atleta) {
    const { ritmoBase, fcUmbral } = datos;
    
    // Clonar para no modificar original
    const sesion = JSON.parse(JSON.stringify(sesionBase));
    
    // Determinar zona principal
    const zonaPrincipal = this.obtenerZonaPorTipoYFase(sesion.tipo, fase);
    
    // Calcular duraciones
    let duracionPrincipal = Math.round(sesion.estructura.principal.duracionBase * factorVolumen);
    
    // Ajustar según distancia
    const factorDistancia = this.obtenerFactorDistancia(distancia, sesion.tipo);
    duracionPrincipal = Math.round(duracionPrincipal * factorDistancia);
    
    // Ajustar por fatiga del atleta (NUEVO)
    if (atleta?.fatiga > 7) {
      duracionPrincipal = Math.round(duracionPrincipal * 0.8);
    }
    
    // Duración total
    const duracionTotal = sesion.estructura.calentamiento.duracion + duracionPrincipal + sesion.estructura.vueltaCalma.duracion;
    
    // Calcular ritmo objetivo
    const ritmoObjetivo = this.calcularRitmoObjetivo(ritmoBase, zonaPrincipal, factorIntensidad);
    
    // Calcular FC objetivo (COHERENTE CON ZONA)
    const fcObjetivo = this.calcularFcCoherente(fcUmbral, zonaPrincipal, factorIntensidad);
    
    // Calcular distancia total (aproximada)
    const ritmoPrincipalNumerico = this.convertirRitmoANumero(ritmoObjetivo);
    const distanciaTotal = (duracionTotal / ritmoPrincipalNumerico).toFixed(2);
    
    // Calcular TSS
    const ifactor = this.calcularIFactor(zonaPrincipal);
    const tss = Math.round(duracionTotal * ifactor * ifactor);
    
    // Calcular FC para cada paso (CORREGIDO - CADA PASO CON SU ZONA)
    const fcCalentamiento = this.calcularFcPaso(fcUmbral, 'Z1');
    const fcPrincipal = this.calcularFcPaso(fcUmbral, zonaPrincipal);
    const fcVuelta = this.calcularFcPaso(fcUmbral, 'Z1');
    
    // Calcular ritmo para cada paso
    const ritmoCalentamiento = this.calcularRitmoPaso(ritmoBase, 'Z1');
    const ritmoVuelta = this.calcularRitmoPaso(ritmoBase, 'Z1');
    
    return {
      nombre: sesion.nombre.toUpperCase(),
      tipo: sesion.tipo,
      zonaPrincipal,
      ritmoObjetivo,
      fcObjetivo,
      duracionTotal,
      distanciaTotal,
      tss,
      objetivoFisiologico: sesion.objetivoFisiologico,
      comentariosPrevios: sesion.objetivoFisiologico || 'Sesión de entrenamiento. Concéntrate en mantener la técnica y el ritmo objetivo.',
      estructura: {
        calentamiento: {
          duracion: sesion.estructura.calentamiento.duracion,
          ritmo: ritmoCalentamiento,
          fc: fcCalentamiento,
          distancia: ((sesion.estructura.calentamiento.duracion) / this.ritmoANumero(ritmoCalentamiento)).toFixed(2),
          descripcion: sesion.estructura.calentamiento.detalle || 'Trote suave + ejercicios de técnica. Prepara músculos y activa la circulación.'
        },
        principal: {
          duracion: duracionPrincipal,
          ritmo: ritmoObjetivo,
          fc: fcPrincipal,
          distancia: (duracionPrincipal / ritmoPrincipalNumerico).toFixed(2),
          descripcion: sesion.estructura.principal.detalle || 'Mantén el ritmo objetivo durante toda la sesión.'
        },
        vueltaCalma: {
          duracion: sesion.estructura.vueltaCalma.duracion,
          ritmo: ritmoVuelta,
          fc: fcVuelta,
          distancia: ((sesion.estructura.vueltaCalma.duracion) / this.ritmoANumero(ritmoVuelta)).toFixed(2),
          descripcion: sesion.estructura.vueltaCalma.detalle || 'Trote muy suave para eliminar el lactato acumulado. Termina con estiramientos.'
        }
      }
    };
  },

  // ==========================================================================
  // CALCULAR FC PARA UN PASO ESPECÍFICO (NUEVA)
  // ==========================================================================
  calcularFcPaso(fcUmbral, zona) {
    const rangos = {
      'Z1': [0.60, 0.75],
      'Z2': [0.75, 0.85],
      'Z3': [0.85, 0.88],
      'Z4': [0.88, 0.92],
      'Z5': [0.92, 0.97],
      'Z6': [0.97, 1.03]
    };
    
    const zonaBase = zona.split('-')[0] || 'Z1';
    const [min, max] = rangos[zonaBase] || rangos.Z1;
    
    return `${Math.round(fcUmbral * min)}-${Math.round(fcUmbral * max)} lpm`;
  },

  // ==========================================================================
  // CALCULAR RITMO PARA UN PASO ESPECÍFICO (NUEVA)
  // ==========================================================================
  calcularRitmoPaso(ritmoBase, zona) {
    const factores = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95, 'Z6': 0.85 };
    const zonaBase = zona.split('-')[0] || 'Z1';
    const factor = factores[zonaBase] || 1.25;
    return Utils.formatR(ritmoBase * factor);
  },

  // ==========================================================================
  // CALCULAR FC COHERENTE CON LA ZONA
  // ==========================================================================
  calcularFcCoherente(fcUmbral, zona, factorIntensidad) {
    // Rangos exactos según zona (basados en umbral de lactato)
    const rangos = {
      'Z1': [Math.round(fcUmbral * 0.60), Math.round(fcUmbral * 0.75)],
      'Z2': [Math.round(fcUmbral * 0.75), Math.round(fcUmbral * 0.85)],
      'Z3': [Math.round(fcUmbral * 0.85), Math.round(fcUmbral * 0.88)],
      'Z4': [Math.round(fcUmbral * 0.88), Math.round(fcUmbral * 0.92)],
      'Z5': [Math.round(fcUmbral * 0.92), Math.round(fcUmbral * 0.97)],
      'Z6': [Math.round(fcUmbral * 0.97), Math.round(fcUmbral * 1.03)]
    };

    const zonaBase = zona.split('-')[0] || 'Z2';
    const [min, max] = rangos[zonaBase] || rangos.Z2;
    
    // Ajuste por intensidad (mínimo)
    const ajuste = Math.round((max - min) * (factorIntensidad - 0.8) * 0.3);
    const fcMin = Math.max(min, min + ajuste);
    const fcMax = Math.min(max, max + ajuste);
    
    if (zonaBase === 'Z6') {
      return `> ${fcMin} lpm (máximo)`;
    }
    
    return `${fcMin}-${fcMax} lpm`;
  },

  // ==========================================================================
  // OBTENER FACTOR POR DISTANCIA
  // ==========================================================================
  obtenerFactorDistancia(distancia, tipo) {
    const factores = {
      '2k': { rodaje: 0.7, tempo: 0.8, series: 0.6, largo: 0.5 },
      '5k': { rodaje: 0.8, tempo: 0.9, series: 0.8, largo: 0.7 },
      '10k': { rodaje: 0.9, tempo: 1.0, series: 1.0, largo: 0.8 },
      'medio': { rodaje: 1.0, tempo: 1.1, series: 1.1, largo: 1.0 },
      'maraton': { rodaje: 1.2, tempo: 1.2, series: 1.2, largo: 1.5 }
    };
    return factores[distancia]?.[tipo] || 1.0;
  },

  // ==========================================================================
  // CALCULAR IFACTOR PARA TSS
  // ==========================================================================
  calcularIFactor(zona) {
    const factores = { 'Z1': 0.6, 'Z2': 0.7, 'Z3': 0.8, 'Z4': 0.9, 'Z5': 1.0, 'Z6': 1.1 };
    return factores[zona.split('-')[0]] || 0.7;
  },

  // ==========================================================================
  // OBTENER ZONA POR TIPO Y FASE
  // ==========================================================================
  obtenerZonaPorTipoYFase(tipo, fase) {
    const mapa = {
      rodaje: { BASE: 'Z2', CONSTRUCCION: 'Z2', ESPECIFICA: 'Z2', PICO_TAPER: 'Z1' },
      tempo: { BASE: 'Z3', CONSTRUCCION: 'Z3', ESPECIFICA: 'Z4', PICO_TAPER: 'Z2' },
      series: { BASE: 'Z4', CONSTRUCCION: 'Z4', ESPECIFICA: 'Z5', PICO_TAPER: 'Z3' },
      largo: { BASE: 'Z2', CONSTRUCCION: 'Z2', ESPECIFICA: 'Z2', PICO_TAPER: 'Z1' }
    };
    return mapa[tipo]?.[fase] || 'Z2';
  },

  // ==========================================================================
  // CALCULAR RITMO OBJETIVO
  // ==========================================================================
  calcularRitmoObjetivo(ritmoBase, zona, factorIntensidad) {
    const factores = { 'Z1': 1.35, 'Z2': 1.25, 'Z3': 1.15, 'Z4': 1.05, 'Z5': 0.95, 'Z6': 0.85 };
    const factor = factores[zona.split('-')[0]] || 1.25;
    return Utils.formatR(ritmoBase * factor * (0.95 + (factorIntensidad * 0.05)));
  },

  // ==========================================================================
  // CONVERTIR RITMO (MM:SS) A NÚMERO (MINUTOS)
  // ==========================================================================
  convertirRitmoANumero(ritmo) {
    if (!ritmo) return 5;
    const partes = ritmo.split(':');
    if (partes.length === 2) {
      return parseInt(partes[0]) + parseInt(partes[1]) / 60;
    }
    return 5;
  },

  // ==========================================================================
  // CALCULAR FACTORES DE CARGA
  // ==========================================================================
  calcularFactorVolumen(mesociclo, semanaEnMesociclo, esDescarga) {
    let factor = 1.0;
    
    if (mesociclo.nombre === 'BASE') factor = 0.9 + (semanaEnMesociclo * 0.05);
    else if (mesociclo.nombre === 'CONSTRUCCION') factor = 1.0 + (semanaEnMesociclo * 0.05);
    else if (mesociclo.nombre === 'ESPECIFICA') factor = 1.1 + (semanaEnMesociclo * 0.05);
    else if (mesociclo.nombre === 'PICO_TAPER') {
      if (semanaEnMesociclo <= 2) factor = 1.2;
      else factor = 0.8 - (semanaEnMesociclo - 3) * 0.2;
    }
    
    if (esDescarga) factor *= 0.7;
    
    return Math.min(1.3, Math.max(0.5, factor));
  },

  calcularFactorIntensidad(mesociclo, semanaEnMesociclo, esDescarga) {
    let factor = 0.8;
    
    if (mesociclo.nombre === 'BASE') factor = 0.7 + (semanaEnMesociclo * 0.03);
    else if (mesociclo.nombre === 'CONSTRUCCION') factor = 0.8 + (semanaEnMesociclo * 0.04);
    else if (mesociclo.nombre === 'ESPECIFICA') factor = 0.9 + (semanaEnMesociclo * 0.05);
    else if (mesociclo.nombre === 'PICO_TAPER') {
      if (semanaEnMesociclo <= 2) factor = 1.0;
      else factor = 0.7 - (semanaEnMesociclo - 3) * 0.15;
    }
    
    if (esDescarga) factor *= 0.8;
    
    return Math.min(1.0, Math.max(0.5, factor));
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

  elegirDiaLargoOptimo(diasEntreno) {
    if (diasEntreno.includes(7)) return 7; // Domingo
    if (diasEntreno.includes(6)) return 6; // Sábado
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

  // ==========================================================================
  // MOSTRAR CALENDARIO (VERSIÓN IMG_0895 - SOLO LETRA + DURACIÓN)
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

    const semanasPorPagina = 12;
    const inicioPagina = AppState.trimestreActual * semanasPorPagina * 7;
    const finPagina = Math.min(inicioPagina + (semanasPorPagina * 7), sesiones.length);

    if (inicioPagina >= sesiones.length) return;

    let html = '';

    for (let i = inicioPagina; i < finPagina; i++) {
      const sesion = sesiones[i];

      if (!sesion) {
        html += '<div class="calendario-dia"></div>';
        continue;
      }

      const realizada = AppState.sesionesRealizadas?.[sesion.diaGlobal] ? 'realizado' : '';

      // Formato: LETRA + DURACIÓN (ej: "R 45'")
      let contenido = '';
      if (sesion.tipo === 'descanso') {
        contenido = 'D';
      } else {
        contenido = `${sesion.letra} ${sesion.duracion || 0}'`;
      }

      html += `<div class="calendario-dia ${sesion.color} ${realizada}" data-index="${sesion.diaGlobal}">${contenido}</div>`;
    }

    grid.innerHTML = html;

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

  // ==========================================================================
  // ABRIR DETALLE DE SESIÓN (TARJETA IMG_0896 - CORREGIDA)
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

      const detalle = sesion.detalle;
      const tipoMayus = sesion.tipo.toUpperCase();

      // Formatear tiempo (MM:SS)
      const tiempoFormateado = this.formatearTiempoCompacto(sesion.duracion || 50);

      // Título: "# TIPO: NOMBRE"
      titulo.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 24px; margin: 0; padding: 0; border: none; text-transform: uppercase;"># ${tipoMayus}: ${detalle.nombre || ''}</h3>
        </div>
      `;

      // Construir los pasos con VALORES CORREGIDOS (cada paso usa SUS propios valores)
      const pasos = [
        {
          numero: 1,
          nombre: 'Calentamiento',
          duracion: detalle.estructura?.calentamiento?.duracion || 15,
          ritmo: detalle.estructura?.calentamiento?.ritmo || '6:05 min/km',
          fc: detalle.estructura?.calentamiento?.fc || '102-119 lpm',
          distancia: detalle.estructura?.calentamiento?.distancia || '2.47',
          texto: detalle.estructura?.calentamiento?.descripcion || 'Muy suave. Prepara músculos y activa la circulación. Debes sentir que puedes hablar sin esfuerzo. Aprovecha para hacer ejercicios de movilidad.'
        },
        {
          numero: 2,
          nombre: 'Parte principal',
          duracion: detalle.estructura?.principal?.duracion || sesion.duracion - 25,
          ritmo: detalle.ritmoObjetivo || detalle.estructura?.principal?.ritmo || '5:30 min/km',
          fc: detalle.fcObjetivo || detalle.estructura?.principal?.fc || '125-145 lpm',
          distancia: detalle.estructura?.principal?.distancia || '8.50',
          texto: detalle.estructura?.principal?.descripcion || detalle.comentariosPrevios || 'Trabajo de calidad. Las series se corren a un ritmo rápido, con recuperaciones activas (trote suave) entre ellas. Concéntrate en mantener la técnica y el ritmo objetivo en cada repetición. No salgas demasiado rápido.'
        },
        {
          numero: 3,
          nombre: 'Vuelta a la calma',
          duracion: detalle.estructura?.vueltaCalma?.duracion || 10,
          ritmo: detalle.estructura?.vueltaCalma?.ritmo || '7:00 min/km',
          fc: detalle.estructura?.vueltaCalma?.fc || '85-102 lpm',
          distancia: detalle.estructura?.vueltaCalma?.distancia || '1.43',
          texto: detalle.estructura?.vueltaCalma?.descripcion || 'Trote muy suave para eliminar el lactato acumulado. Termina con estiramientos suaves.'
        }
      ];

      // Generar HTML de los pasos
      let pasosHTML = '';
      pasos.forEach(paso => {
        pasosHTML += `
          <div style="margin-bottom: 25px;">
            <h5 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 500;">${paso.numero}. ${paso.nombre}</h5>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px;">
              <div>
                <div style="font-size: 12px; color: var(--text-secondary);">Duración:</div>
                <div style="font-size: 16px;">${paso.duracion}'</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-secondary);">Ritmo objetivo:</div>
                <div style="font-size: 16px;">${paso.ritmo}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-secondary);">Frecuencia cardíaca:</div>
                <div style="font-size: 16px;">${paso.fc}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-secondary);">Distancia estimada:</div>
                <div style="font-size: 16px;">${paso.distancia} km</div>
              </div>
            </div>

            <div style="font-style: italic; color: var(--text-secondary); font-size: 14px; margin-top: 5px;">
              > ${paso.texto}
            </div>
          </div>
        `;
      });

      // HTML completo de la descripción
      descripcion.innerHTML = `
        <!-- MÉTRICAS PRINCIPALES (formato: "59:00 · 12.12 km · 40 TSS") -->
        <div style="font-family: monospace; font-size: 18px; margin-bottom: 25px; color: var(--text-primary);">
          ${tiempoFormateado} · ${detalle.distanciaTotal || '12.12'} km · ${detalle.tss || 40} TSS
        </div>

        <!-- COMENTARIOS PREVIOS -->
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 10px 0; color: var(--accent-yellow); font-size: 16px; text-transform: uppercase;">COMENTARIOS PREVIOS</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: var(--text-primary);">
            ${detalle.comentariosPrevios || 'Trabajo de calidad. Las series se corren a un ritmo rápido, con recuperaciones activas (trote suave) entre ellas. Concéntrate en mantener la técnica y el ritmo objetivo en cada repetición. No salgas demasiado rápido.'}
          </p>
        </div>

        <!-- PASOS A SEGUIR -->
        <h4 style="margin: 0 0 15px 0; color: var(--accent-yellow); font-size: 16px; text-transform: uppercase;">PASOS A SEGUIR</h4>
        
        ${pasosHTML}
      `;

      checkboxContainer.style.display = 'flex';
      checkbox.checked = AppState.sesionesRealizadas?.[diaIndex] || false;
      
      // Añadir feedback si existe
      const feedbackContainer = document.getElementById('sesionFeedbackContainer');
      if (feedbackContainer && checkbox.checked) {
        feedbackContainer.style.display = 'block';
      }

      checkbox.onchange = async (e) => {
        await this.marcarSesionRealizada(diaIndex, e.target.checked, sesion);
      };

    } else {
      // SESIÓN DE DESCANSO
      wrapper.classList.add('sesion-descanso');
      
      titulo.innerHTML = `
        <div style="margin-bottom: 15px;">
          <h3 style="font-size: 24px; margin: 0; padding: 0; border: none;"># DESCANSO</h3>
        </div>
      `;
      
      descripcion.innerHTML = `
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 10px 0; color: var(--accent-yellow); font-size: 16px; text-transform: uppercase;">COMENTARIOS PREVIOS</h4>
          <p style="margin: 0; font-size: 14px;">El descanso es parte fundamental del entrenamiento. Permite que el cuerpo se recupere y se adapte al estímulo de las sesiones anteriores.</p>
        </div>

        <h4 style="margin: 0 0 15px 0; color: var(--accent-yellow); font-size: 16px; text-transform: uppercase;">RECOMENDACIONES</h4>

        <div style="margin-bottom: 15px;">
          <h5 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 500;">1. Descanso activo</h5>
          <p style="font-style: italic; color: var(--text-secondary);">> Paseo de 20-30 minutos a ritmo muy suave. Ayuda a la circulación y recuperación muscular.</p>
        </div>

        <div style="margin-bottom: 15px;">
          <h5 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 500;">2. Movilidad y estiramientos</h5>
          <p style="font-style: italic; color: var(--text-secondary);">> 10-15 minutos de estiramientos suaves y ejercicios de movilidad.</p>
        </div>

        <div style="margin-bottom: 15px;">
          <h5 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 500;">3. Foam roller</h5>
          <p style="font-style: italic; color: var(--text-secondary);">> Automasaje suave en piernas, especialmente en gemelos y cuádriceps.</p>
        </div>
      `;
      
      checkboxContainer.style.display = 'none';
    }

    modal.classList.add("visible");
    overlay.classList.add("visible");
  },

  // ==========================================================================
  // MARCAR SESIÓN REALIZADA CON FEEDBACK (NUEVO)
  // ==========================================================================
  async marcarSesionRealizada(diaIndex, realizada, sesion) {
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

      // Si se marcó como realizada, pedir feedback
      if (realizada) {
        this.mostrarFeedbackSesion(diaIndex, sesion);
      }

      Utils.showToast(realizada ? '✅ Sesión marcada' : '📝 Sesión desmarcada', 'success');
    } catch (error) {
      console.error('Error marcando sesión:', error);
      Utils.showToast('Error al marcar la sesión', 'error');
    }
  },

  // ==========================================================================
  // MOSTRAR FEEDBACK DE SESIÓN (NUEVO)
  // ==========================================================================
  mostrarFeedbackSesion(diaIndex, sesion) {
    const feedbackContainer = document.getElementById('sesionFeedbackContainer');
    if (!feedbackContainer) return;

    feedbackContainer.style.display = 'block';
    
    const botones = feedbackContainer.querySelectorAll('.feedback-btn');
    botones.forEach(btn => {
      btn.onclick = async () => {
        const valor = parseInt(btn.dataset.value);
        await this.guardarFeedbackSesion(diaIndex, sesion, valor);
        feedbackContainer.style.display = 'none';
        Utils.showToast('✅ Feedback guardado. El plan se adaptará a tu respuesta.', 'success');
      };
    });
  },

  // ==========================================================================
  // GUARDAR FEEDBACK Y ACTUALIZAR MODELO DE ATLETA (NUEVO)
  // ==========================================================================
  async guardarFeedbackSesion(diaIndex, sesion, feedback) {
    if (!AppState.currentUserId) return;

    try {
      const modelo = await this.obtenerModeloAtleta();
      
      modelo.historialSesiones = modelo.historialSesiones || [];
      modelo.historialSesiones.push({
        fecha: new Date().toISOString(),
        tipo: sesion.tipo,
        duracion: sesion.duracion,
        tss: sesion.detalle?.tss || 0,
        feedback
      });

      // Calcular feedback promedio de los últimos 7 días
      const ultimas7 = modelo.historialSesiones.slice(-7);
      const sumaFeedback = ultimas7.reduce((sum, s) => sum + (s.feedback || 3), 0);
      modelo.feedbackPromedio = sumaFeedback / ultimas7.length;

      // Calcular fatiga basada en carga reciente
      const ultimos14 = modelo.historialSesiones.slice(-14);
      const cargaTotal = ultimos14.reduce((sum, s) => sum + (s.tss || 0), 0);
      modelo.fatiga = Math.min(10, Math.max(1, Math.round(cargaTotal / 200)));

      // Calcular semanas completadas
      const fechasUnicas = new Set();
      modelo.historialSesiones.forEach(s => {
        const semana = s.fecha.split('T')[0];
        fechasUnicas.add(semana);
      });
      modelo.semanasCompletadas = fechasUnicas.size;

      await this.guardarModeloAtleta(modelo);

    } catch (error) {
      console.error('Error guardando feedback:', error);
    }
  },

  // ==========================================================================
  // FORMATEAR TIEMPO COMPACTO (MM:SS)
  // ==========================================================================
  formatearTiempoCompacto(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
      return `${horas}:${mins.toString().padStart(2, '0')}`;
    }
    return `${mins}:00`;
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
  // GESTIÓN DE PLANES GUARDADOS
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

console.log('✅ PlanGenerator v5.0 - ÉLITE ADAPTATIVO | Con feedback y modelo de atleta');