import { TradePack } from './types';

export const GENERAL_TRADE_PACK: TradePack = {
  id: 'general',
  name: {
    es: 'Servicios Locales y Contratistas',
    en: 'Local Services & Contractors'
  },
  keywords: [
    'general contractor', 'handyman', 'electrician', 'roofing', 'landscaping',
    'pest control', 'cleaning', 'painting', 'fencing', 'remodelacion', 'electricista',
    'pintura', 'jardineria', 'limpieza', 'fumigacion', 'servicios para el hogar'
  ],
  emergencyServices: [
    'Reparación de Urgencia 24/7 / 24/7 Emergency Dispatch',
    'Intervención Inmediata por Avería / Immediate Breakdown Service',
    'Atención Prioritaria en el Mismo Día / Same-Day Priority Response'
  ],
  highTicketServices: [
    'Renovación o Instalación Completa ($2,500 - $8,000+)',
    'Contrato de Mantenimiento Anual Comercial ($1,800 - $4,500)',
    'Proyecto Integral de Reforma / Reparación Mayor ($3,500+)'
  ],
  averageTicket: 650,
  diagnosisStrings: {
    unverifiedGbp: {
      problemEs: 'Tu ficha de Google Maps no está verificada — los clientes de tu área eligen a tu competencia al buscar servicios cercanos.',
      problemEn: 'Your Google Maps profile is unverified — nearby clients hire competitors when searching local services.',
      whyThisMattersEs: 'El 80% de las contrataciones locales provienen de los 3 primeros resultados en Google Maps.',
      whyThisMattersEn: '80% of local contractor jobs originate from the Google Maps 3-pack.',
      evidenceDeepDiveEs: 'Sin verificación, tu negocio queda oculto para búsquedas con alta intención de compra en tu código postal.',
      evidenceDeepDiveEn: 'Without verification, your business remains hidden for high-intent queries in your zip code.'
    },
    unansweredReviews: {
      problemEs: (count: number) => `Tienes ${count} reseñas sin responder. Ignorar opiniones penaliza tu posicionamiento en Google Maps.`,
      problemEn: (count: number) => `You have ${count} unanswered reviews. Ignoring reviews directly harms your Maps visibility.`,
      whyThisMattersEs: 'Responder profesionalmente a cada cliente genera confianza y atrae un +30% más de llamadas.',
      whyThisMattersEn: 'Replying professionally to every client builds trust and brings +30% more calls.',
      actionTitleEs: 'Responder a Reseñas Pendientes en Google Maps',
      actionTitleEn: 'Reply to Pending Google Maps Reviews'
    },
    seasonalDemand: {
      problemEs: 'Pico de demanda local detectado: Aumentan las búsquedas de contratistas locales en tu zona.',
      problemEn: 'Local demand spike detected: High search volume for local service contractors in your area.',
      whyThisMattersEs: 'Los clientes buscan activamente profesionales con disponibilidad rápida y buenas valoraciones.',
      whyThisMattersEn: 'Customers are actively looking for reliable local pros with fast response times.',
      evidenceSummaryEs: 'Los competidores activos en Google Maps están captando los mejores proyectos del mes.',
      evidenceSummaryEn: 'Active competitors on Google Maps are capturing the highest value leads this month.',
      actionTitleEs: 'Publicar Oferta Destacada en Google Maps',
      actionTitleEn: 'Post Featured Offer on Google Maps',
      expectedBenefitEs: 'Aumentar llamadas y contactos directos',
      expectedBenefitEn: 'Boost phone calls and direct inquiries'
    },
    emergencyCoverage: {
      problemEs: 'Sin respuesta rápida visible: Los clientes con averías urgentes llaman a quien responda primero.',
      problemEn: 'No instant response visible: Urgent clients call whichever provider answers first.',
      whyThisMattersEs: 'El 70% de los trabajos de emergencia se cierran con el primer contratista que atiende la llamada.',
      whyThisMattersEn: '70% of emergency repair jobs are closed by the first pro to respond.',
      evidenceSummaryEs: 'Configurar respuestas automáticas asegura que no pierdas trabajos urgentes por estar en faena.',
      evidenceSummaryEn: 'Setting up fast WhatsApp dispatch ensures you never lose jobs while on the road.',
      actionTitleEs: 'Activar Respuestas Rápidas por WhatsApp',
      actionTitleEn: 'Activate Fast WhatsApp Response Flow',
      expectedBenefitEs: 'Captar trabajos urgentes en <10 minutos',
      expectedBenefitEn: 'Capture urgent jobs in under 10 minutes'
    }
  },
  checklist: [
    {
      id: 'gen_day_1',
      day: 'Día 1',
      titleEs: 'Auditoría de Visibilidad Local y Posición en Google Maps',
      titleEn: 'Audit Local Visibility & Google Maps Ranking',
      descEs: 'Revisa tu posicionamiento frente a competidores en tu radio de servicio.',
      descEn: 'Check your ranking against local rivals within your service zone.',
      actionType: 'audit',
      actionPayload: {
        actionEs: 'Ejecutar Auditoría Local',
        actionEn: 'Run Local Audit',
        whyNowEs: 'Identifica dónde pierdes llamadas frente a otros contratistas locales.',
        whyNowEn: 'Identify where you are losing calls to competing local pros.',
        expectedBenefitEs: 'Conocer posición exacta en el mapa',
        expectedBenefitEn: 'Know exact map rankings',
        destinationCode: 'SCAN'
      },
      completed: false
    },
    {
      id: 'gen_day_2',
      day: 'Día 2',
      titleEs: 'Configurar Enlace Directo de Presupuestos por WhatsApp',
      titleEn: 'Set Up 1-Tap WhatsApp Quotes',
      descEs: 'Responde presupuestos en segundos desde tu móvil mientras estás en obra.',
      descEn: 'Send estimates in seconds from your phone while on the job site.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Configurar Enlace WhatsApp',
        actionEn: 'Setup WhatsApp Link',
        whyNowEs: 'Responder en <10 minutos duplica tu tasa de cierre.',
        whyNowEn: 'Responding in <10m doubles your conversion rate.',
        expectedBenefitEs: 'Cerrar más presupuestos en el acto',
        expectedBenefitEn: 'Close more estimates immediately',
        destinationCode: 'CONTACT_LEAD'
      },
      completed: false
    },
    {
      id: 'gen_day_3',
      day: 'Día 3',
      titleEs: 'Pedir Reseña de 5 Estrellas a Clientes Recientes',
      titleEn: 'Request 5-Star Reviews from Recent Clients',
      descEs: 'Envía el enlace oficial de Google Maps justo al finalizar un trabajo bien hecho.',
      descEn: 'Send the official Google Maps review link right after finishing a job.',
      actionType: 'review',
      actionPayload: {
        actionEs: 'Pedir Reseña por WhatsApp',
        actionEn: 'Request Review via WhatsApp',
        whyNowEs: 'Las reseñas recientes y verificadas son un factor crítico para convertir búsquedas locales.',
        whyNowEn: 'Fresh verified reviews are a critical factor for local search conversion.',
        expectedBenefitEs: '+1 Reseña de 5 estrellas en tu perfil',
        expectedBenefitEn: '+1 5-Star review on your profile',
        destinationCode: 'REQUEST_REVIEW'
      },
      completed: false
    }
  ],
  outreachTemplates: [
    {
      id: 'gen_quote_fast',
      nameEs: 'Presupuesto Rápido por WhatsApp',
      nameEn: 'Fast Estimate via WhatsApp',
      category: 'quote',
      whatsappTextEs: '¡Hola [Nombre]! Soy [MiNombre] de [MiEmpresa]. Vi tu solicitud de presupuesto para [Servicio] en [Zona]. ¿Podrías enviarme una foto o breve detalle para darte un precio orientativo ahora mismo?',
      whatsappTextEn: 'Hi [Name]! This is [MyName] from [MyCompany]. Received your estimate request for [Service] in [Area]. Could you share a quick photo or detail so I can give you an upfront price right away?',
      smsTextEs: 'Hola [Nombre], [MiEmpresa]: Recibimos tu consulta de [Servicio]. Llámanos o responde para coordinar visita hoy mismo.',
      smsTextEn: 'Hi [Name], [MyCompany]: We received your [Service] request. Call or text back to set up a visit today.'
    },
    {
      id: 'gen_review_boost',
      nameEs: 'Solicitud de Reseña tras Trabajo Completado',
      nameEn: 'Review Request After Finished Job',
      category: 'review',
      whatsappTextEs: '¡Hola [Nombre]! Muchas gracias por confiar en [MiEmpresa] para tu trabajo de [Servicio]. Como negocio local, tu recomendación nos ayuda enormemente. ¿Nos regalas 1 minuto con una reseña en Google? [EnlaceReseña] ¡Mil gracias!',
      whatsappTextEn: 'Hi [Name]! Thank you for choosing [MyCompany] for your [Service]. As a local business, your review helps us immensely. Would you take 1 minute to leave a Google review? [ReviewLink] Thanks so much!',
      smsTextEs: '¡Hola [Nombre]! Gracias por elegir [MiEmpresa]. ¿Nos apoyas con una reseña en Google? [EnlaceReseña] ¡Gracias!',
      smsTextEn: 'Hi [Name]! Thanks for choosing [MyCompany]. Could you support us with a quick Google review? [ReviewLink] Thank you!'
    }
  ],
  gbpPostTemplates: [
    {
      id: 'gen_special_offer',
      titleEs: '🛠️ Servicio Local de Confianza en [Ciudad]: Presupuestos Sin Compromiso',
      titleEn: '🛠️ Trusted Local Service in [City]: Free Upfront Estimates',
      bodyEs: '¿Necesitas un profesional de confianza para [Servicio]? Ofrecemos servicio rápido, transparente y con garantía total en toda el área de [Ciudad]. ¡Llámanos hoy mismo!',
      bodyEn: 'Looking for a licensed, insured pro for [Service]? We provide fast, reliable, guaranteed work across all of [City]. Call us today for a free upfront estimate!',
      ctaType: 'CALL',
      suggestedTags: ['#LocalService', '#Contractor', '#HomeImprovement', '#QualityWork']
    }
  ],
  quickQuotes: [
    { id: 'gen_visit', labelEs: 'Visita de Inspección y Diagnóstico', labelEn: 'Inspection & Diagnostic Visit', defaultPrice: 65, unit: 'visita / visit' },
    { id: 'gen_standard', labelEs: 'Reparación / Mantenimiento Estándar', labelEn: 'Standard Repair / Maintenance', defaultPrice: 180, unit: 'servicio / service' },
    { id: 'gen_major', labelEs: 'Instalación / Trabajo Completo', labelEn: 'Major Installation / Job', defaultPrice: 1200, unit: 'proyecto / project' }
  ],
  emptyStateExamples: {
    sampleBusinessName: 'Apex Local Services',
    sampleCity: 'Austin, TX',
    sampleCompetitor: 'Austin Pro Solutions (4.7 ★, 185 reviews)',
    sampleLeads: [
      {
        id: 'gen_lead_1',
        name: 'David Miller',
        phone: '+1 (512) 555-0192',
        service: 'Servicio / Reparación Residencial',
        serviceEn: 'Residential Repair Service',
        status: 'new',
        estimatedValue: 240,
        timeAgo: 'Hace 30 min',
        timeAgoEn: '30m ago',
        notes: 'Consulta por reparación urgente para esta tarde.',
        notesEn: 'Inquired about urgent repair for this afternoon.'
      }
    ],
    sampleRecentScans: [
      { name: 'Apex Local Services', city: 'Austin, TX', score: 72, date: 'Hoy / Today' }
    ],
    sampleQuickQuotes: [
      { id: 'gen_visit', labelEs: 'Visita de Inspección y Diagnóstico', labelEn: 'Inspection & Diagnostic Visit', defaultPrice: 65, unit: 'visita / visit' },
      { id: 'gen_standard', labelEs: 'Reparación / Mantenimiento Estándar', labelEn: 'Standard Repair / Maintenance', defaultPrice: 180, unit: 'servicio / service' }
    ]
  }
};
