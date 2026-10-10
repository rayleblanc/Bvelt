import { TradePack } from './types';

export const LAWN_TRADE_PACK: TradePack = {
  id: 'lawn',
  name: {
    es: 'Cuidado de Césped y Jardinería',
    en: 'Lawn Care & Landscaping'
  },
  keywords: [
    'lawn', 'lawn care', 'mowing', 'jardineria', 'jardinero', 'cesped', 'poda',
    'landscaping', 'yard maintenance', 'grass cutting', 'fertilization', 'weed control',
    'mulching', 'leaf removal', 'aeration', 'limpieza de jardin', 'riego'
  ],
  emergencyServices: [
    'Caída de Árbol / Rama de Urgencia (Post-Tormenta)',
    'Reparación Urgente de Tubería de Riego / Fuga de Aspersor',
    'Corte Inmediato por Infracción de Ordenanza / Aviso Municipal'
  ],
  highTicketServices: [
    'Instalación Completa de Tepes / Césped en Rollo ($2,200 - $6,500)',
    'Contrato Anual de Mantenimiento Residencial/Comercial ($1,800 - $4,200)',
    'Diseño Paisajístico y Parterres de Piedra/Mulch ($3,000 - $8,500)',
    'Aireación, Escarificado y Resiembra Completa ($600 - $1,400)'
  ],
  averageTicket: 320,
  diagnosisStrings: {
    unverifiedGbp: {
      problemEs: 'Tu ficha de Google Maps de jardinería no está verificada — los vecinos que buscan "cuidado de césped cerca de mí" contratan a competidores.',
      problemEn: 'Your lawn care Google Maps profile is unverified — homeowners searching "lawn care near me" book competitors.',
      whyThisMattersEs: 'El 82% de los propietarios buscan jardineros locales directamente en Google Maps antes de la temporada alta.',
      whyThisMattersEn: '82% of homeowners look up local lawn care on Google Maps right before the peak season.',
      evidenceDeepDiveEs: 'Sin verificación, tu negocio no aparece en el paquete local de 3 fichas para rutas residenciales de tu zona.',
      evidenceDeepDiveEn: 'Without verification, your business is hidden from the local 3-pack for residential routes in your zip code.'
    },
    unansweredReviews: {
      problemEs: (count: number) => `Tienes ${count} reseñas de jardinería sin contestar. Las opiniones sin responder frenan nuevas contrataciones recurrentes.`,
      problemEn: (count: number) => `You have ${count} unanswered lawn care reviews. Unanswered reviews reduce customer conversion on recurring route bids.`,
      whyThisMattersEs: 'Los clientes buscan confiabilidad semanal; responder a cada reseña transmite puntualidad y seriedad.',
      whyThisMattersEn: 'Homeowners look for weekly reliability; answering reviews proves punctual, trustworthy maintenance.',
      actionTitleEs: 'Responder a Reseñas de Jardinería Pendientes',
      actionTitleEn: 'Reply to Pending Lawn Care Reviews'
    },
    seasonalDemand: {
      problemEs: 'Inicio de temporada de corte y abonado: Aumentan las búsquedas locales de jardinería.',
      problemEn: 'Mowing & fertilization season kickoff: High search volume for lawn care.',
      whyThisMattersEs: 'Los propietarios reservan su cuadrilla para toda la temporada durante las primeras semanas de primavera.',
      whyThisMattersEn: 'Homeowners lock in their regular mowing crews for the full season during early spring weeks.',
      evidenceSummaryEs: 'Los competidores en Maps están promocionando paquetes mensuales de mantenimiento.',
      evidenceSummaryEn: 'Local rivals on Maps are promoting monthly recurring maintenance packages.',
      actionTitleEs: 'Publicar Paquete de Mantenimiento Mensual en Maps',
      actionTitleEn: 'Post Monthly Lawn Care Offer on Google Maps',
      expectedBenefitEs: 'Captar clientes residenciales para ruta recurrente',
      expectedBenefitEn: 'Capture recurring residential route clients'
    },
    emergencyCoverage: {
      problemEs: 'Sin cotizador rápido de corte por WhatsApp: Pierdes presupuestos frente a empresas con respuesta en 5 minutos.',
      problemEn: 'No fast WhatsApp estimate dispatch: Losing mowing quotes to rapid-response competitors.',
      whyThisMattersEs: 'El 75% de los presupuestos de corte de césped se adjudican a quien cotiza primero con foto del jardín.',
      whyThisMattersEn: '75% of lawn mowing jobs go to the contractor who provides the fastest estimate by photo.',
      evidenceSummaryEs: 'Un mensaje directo con rangos de $45-$65/visita cierra visitas de valoración el mismo día.',
      evidenceSummaryEn: 'A direct message with $45-$65/visit ranges secures on-site estimates same-day.',
      actionTitleEs: 'Activar Respuesta Rápida de Presupuestos de Césped',
      actionTitleEn: 'Enable Instant WhatsApp Lawn Care Estimates',
      expectedBenefitEs: 'Cerrar presupuestos de ruta en el mismo día',
      expectedBenefitEn: 'Close route quotes within the same day'
    }
  },
  checklist: [
    {
      id: 'lawn_day_1',
      day: 'Día 1',
      titleEs: 'Auditoría de Palabras Clave de Césped y Poda en Maps',
      titleEn: 'Audit Lawn Care & Mowing Keywords in Maps',
      descEs: 'Verifica tu posición para "corte de césped", "jardinería" y "mantenimiento de jardines".',
      descEn: 'Check rankings for "lawn mowing", "landscaping" and "yard maintenance".',
      actionType: 'audit',
      actionPayload: {
        actionEs: 'Auditoría de Rutas de Jardinería',
        actionEn: 'Lawn Route Audit',
        whyNowEs: 'Descubre qué barrios tienen demanda desatendida para optimizar tus rutas de corte.',
        whyNowEn: 'Identify neighborhoods with high unserved demand to optimize mowing routes.',
        expectedBenefitEs: 'Detectar zonas para densificar rutas',
        expectedBenefitEn: 'Spot high-density route opportunities',
        destinationCode: 'SCAN'
      },
      completed: false
    },
    {
      id: 'lawn_day_2',
      day: 'Día 2',
      titleEs: 'Activar Presupuesto Rápido de Césped por WhatsApp',
      titleEn: 'Deploy 1-Tap WhatsApp Lawn Care Quotes',
      descEs: 'Envía tarifas de $45-$65/visita al instante al recibir consultas por fotos de jardín.',
      descEn: 'Send $45-$65/visit upfront pricing in seconds for yard photo inquiries.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Enviar Cotización de Corte',
        actionEn: 'Send Mowing Estimate',
        whyNowEs: 'Los clientes piden presupuesto a varios jardineros; quien responde primero gana la ruta semanal.',
        whyNowEn: 'Homeowners request multiple bids; first responder wins the recurring weekly contract.',
        expectedBenefitEs: 'Asegurar clientes de ruta semanal',
        expectedBenefitEn: 'Lock in weekly route clients',
        destinationCode: 'QUICK_QUOTE'
      },
      completed: false
    },
    {
      id: 'lawn_day_3',
      day: 'Día 3',
      titleEs: 'Campaña de Reactivación de Clientes de Temporada Pasada',
      titleEn: 'Reactivate Past Season Lawn Care Clients',
      descEs: 'Envía un mensaje de inicio de temporada a clientes del año pasado antes de que contraten a otro.',
      descEn: 'Message previous clients to renew weekly mowing before rivals reach out.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Reactivar Clientes Pasados',
        actionEn: 'Reactivate Past Customers',
        whyNowEs: 'Reactivar clientes antiguos cuesta 5x menos que adquirir nuevos.',
        whyNowEn: 'Reactivating past customers costs 5x less than new customer acquisition.',
        expectedBenefitEs: 'Llenar 5-10 huecos en la ruta semanal',
        expectedBenefitEn: 'Fill 5-10 slots in weekly route',
        destinationCode: 'REACTIVATION'
      },
      completed: false
    }
  ],
  outreachTemplates: [
    {
      id: 'lawn_quote_reply',
      nameEs: 'Cotización Rápida de Corte de Césped',
      nameEn: 'Quick Lawn Mowing Quote Reply',
      category: 'quote',
      whatsappTextEs: '¡Hola! Gracias por contactarnos. Nuestro servicio estándar de corte incluye segado, perfilado de bordes en vallas y aceras, y soplado de restos. Para un jardín promedio, la visita suele rondar entre $45-$65 según la altura del césped y el tamaño del terreno. ¿Podríamos pasar mañana por la tarde para confirmarte el precio exacto en persona? ¡Dinos qué horario te viene mejor!',
      whatsappTextEn: `Hi! Thanks for reaching out. We'd love to help get your lawn back in shape! Our standard visit includes mowing, line trimming along fences/beds, edging walkways, and blowing off hard surfaces. For a typical yard, visits range between $45-$65 depending on turf height and lot size. Could we stop by tomorrow afternoon around 2 PM to give you an exact quote on the spot? Let us know what time works best for you!`,
      smsTextEs: '¡Hola! Tu presupuesto orientativo de corte de césped es $45-$65/visita con perfilado y soplado incluidos. ¿Confirmamos visita mañana?',
      smsTextEn: 'Hi! Your estimated lawn mowing is $45-$65/visit including edging and blowing. Shall we stop by tomorrow?'
    },
    {
      id: 'lawn_review_recovery',
      nameEs: 'Solicitud de Reseña tras Corte de Césped',
      nameEn: 'Post-Mowing Review Request',
      category: 'review',
      whatsappTextEs: '¡Hola! Acabamos de terminar el mantenimiento de tu jardín hoy. Esperamos que haya quedado impecable. Si te ha gustado el resultado, ¿nos dejarías una breve reseña de 5 estrellas en Google? Nos ayuda mucho como negocio local. ¡Muchas gracias por tu confianza!',
      whatsappTextEn: 'Hi! We just finished up your yard maintenance today. We hope your lawn looks great! If you are happy with the work, would you mind leaving us a quick 5-star Google review? It helps our local crew immensely. Thank you for your business!',
      smsTextEs: '¡Hola! Gracias por elegir nuestro servicio de jardinería. ¿Nos dejas una reseña rápida en Google? ¡Nos ayuda mucho!',
      smsTextEn: 'Hi! Thanks for choosing our lawn service. Mind leaving a quick Google review? It helps us a lot!'
    },
    {
      id: 'lawn_seasonal_aeration',
      nameEs: 'Oferta Estacional: Aireación y Abonado de Primavera/Otoño',
      nameEn: 'Seasonal Aeration & Overseeding Offer',
      category: 'seasonal',
      whatsappTextEs: '¡Hola! Empieza la mejor época para airear y resembrar el césped antes de que suban las temperaturas. Tenemos un cupo limitado para la ruta de este mes con descuento del 15% para clientes de mantenimiento. ¿Quieres que reservemos tu fecha?',
      whatsappTextEn: 'Hi! It is the prime window for lawn core aeration and overseeding before the weather changes. We have a few slots open on this week route with a 15% loyalty discount. Would you like us to reserve your spot?',
      smsTextEs: '¡Hola! Abrimos cupos para aireación y abono estacional con 15% de descuento. ¿Te reservamos fecha?',
      smsTextEn: 'Hi! Booking seasonal core aeration & fertilization slots this week. Want to reserve your date?'
    }
  ],
  gbpPostTemplates: [
    {
      id: 'lawn_gbp_spring_cleanup',
      titleEs: '🌿 Puesta a Punto de Jardines y Corte de Temporada',
      titleEn: '🌿 Spring Yard Cleanup & Seasonal Mowing',
      bodyEs: '¿Tu césped necesita un corte profesional y puesta a punto? Ofrecemos mantenimiento semanal y quincenal con perfilado impecable y retirada de restos. ¡Reserva tu ruta antes de que se llenen los cupos!',
      bodyEn: 'Ready for a pristine lawn this season? We offer weekly and bi-weekly mowing, crisp edge trimming, and hard surface blowing. Book your recurring route today!',
      ctaType: 'CALL',
      suggestedTags: ['#CuidadoDeCesped', '#JardineriaLocal', '#LawnCare', '#MowingService']
    }
  ],
  quickQuotes: [
    { id: 'mowing_standard', labelEs: 'Corte Estándar + Perfilado (< 5,000 sq ft)', labelEn: 'Standard Mowing + Edging (< 5,000 sq ft)', defaultPrice: 50, unit: 'visita' },
    { id: 'mowing_large', labelEs: 'Corte Terreno Grande (5,000 - 10,000 sq ft)', labelEn: 'Large Lot Mowing (5,000 - 10,000 sq ft)', defaultPrice: 75, unit: 'visita' },
    { id: 'yard_cleanup', labelEs: 'Limpieza Integral y Poda de Temporada', labelEn: 'Full Yard Cleanup & Shrub Trimming', defaultPrice: 280, unit: 'servicio' },
    { id: 'aeration_seed', labelEs: 'Aireación + Resiembra + Abono', labelEn: 'Core Aeration + Overseeding + Fert', defaultPrice: 350, unit: 'servicio' }
  ],
  emptyStateExamples: {
    sampleBusinessName: 'Verde & Vida Jardinería',
    sampleCity: 'Orlando, FL',
    sampleCompetitor: 'Apex Lawn Pro',
    sampleLeads: [
      {
        id: 'sample_lawn_1',
        name: 'Carlos Mendoza',
        phone: '+1 (407) 555-0142',
        service: 'Corte de césped semanal y perfilado',
        serviceEn: 'Weekly lawn mowing & edging',
        status: 'new',
        estimatedValue: 60,
        timeAgo: 'hace 18 min',
        timeAgoEn: '18 min ago',
        notes: 'Terreno de esquina, hierba crecida tras viaje.',
        notesEn: 'Corner lot, grass overgrown after travel.'
      },
      {
        id: 'sample_lawn_2',
        name: 'Elena Vance',
        phone: '+1 (407) 555-0198',
        service: 'Limpieza de jardín y recorte de setos',
        serviceEn: 'Yard cleanup & shrub trimming',
        status: 'contacted',
        estimatedValue: 320,
        timeAgo: 'hace 2 horas',
        timeAgoEn: '2 hours ago',
        notes: 'Pide presupuesto con fotos enviadas por WhatsApp.',
        notesEn: 'Requested estimate with photos via WhatsApp.'
      }
    ],
    sampleRecentScans: [
      { name: 'Sunstate Lawn Care', city: 'Orlando, FL', score: 74, date: '2026-03-28' },
      { name: 'Total Turf Services', city: 'Winter Park, FL', score: 62, date: '2026-03-29' }
    ],
    sampleQuickQuotes: [
      { id: 'qq_1', labelEs: 'Corte Residencial Estándar', labelEn: 'Standard Residential Mowing', defaultPrice: 50, unit: 'visita' },
      { id: 'qq_2', labelEs: 'Poda y Perfilado de Setos', labelEn: 'Shrub & Hedge Trimming', defaultPrice: 140, unit: 'servicio' }
    ]
  },
  // Honest Benchmark with explicit "insufficient sample" handling — never invent +18%
  benchmark: {
    status: 'INSUFFICIENT_SAMPLE',
    sampleCount: 0,
    minimumThreshold: 25,
    messageEs: 'Muestra local insuficiente (N < 25) para calcular porcentaje de crecimiento local preciso. Se habilitará cuando crezca el tamaño de muestra.',
    messageEn: 'Insufficient local sample (N < 25) to compute precise growth benchmark. Available once sample size grows.',
    localGrowthPct: null
  }
};
