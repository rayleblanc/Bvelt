import { VerticalConfig } from './types';

export const GENERAL_VERTICAL_CONFIG: VerticalConfig = {
  id: 'general',
  name: {
    es: 'Servicios y Contratistas Locales',
    en: 'Local Services & Contractors'
  },
  keywords: ['contractor', 'services', 'servicios', 'remodel', 'repair', 'reparacion', 'maintenance'],
  emergencyServices: ['Same-Day Service Call', 'Urgent Repairs', 'Emergency Callout'],
  highTicketServices: ['Complete System Installation', 'Full Remodel / Renovation', 'Commercial Maintenance Contract'],
  averageTicket: 450,
  checklist: [
    {
      id: 'day_1',
      day: 'Día 1',
      titleEs: 'Auditoría Inicial de Mercado Local',
      titleEn: 'Initial Local Market Audit',
      descEs: 'Verifica tu visibilidad en Google Maps y el puntaje de tu zona comercial.',
      descEn: 'Verify your Google Maps visibility and local zone score.',
      actionType: 'audit',
      actionPayload: {
        actionEs: 'Auditoría de Visibilidad Local',
        actionEn: 'Local Visibility Audit',
        whyNowEs: 'Paso 1: Identifica tu posición en Maps frente a tus competidores locales.',
        whyNowEn: 'Step 1: Check your Maps ranking against local competitors in your zone.',
        expectedBenefitEs: 'Detectar oportunidades de llamadas en tu zona',
        expectedBenefitEn: 'Spot call opportunities in your area',
        destinationCode: 'SCAN'
      },
      completed: false
    },
    {
      id: 'day_1_2',
      day: 'Día 1-2',
      titleEs: 'Ejecutar las 3 Acciones Clave de Cierre',
      titleEn: 'Execute Top 3 Revenue Actions',
      descEs: 'Contacta prospectos y cierra trabajos directos por WhatsApp.',
      descEn: 'Contact priority leads and close direct jobs via WhatsApp.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Contactar Prospecto Caliente por WhatsApp',
        actionEn: 'Contact High-Intent Lead via WhatsApp',
        whyNowEs: 'Acción clave Día 1-2: Conectar directamente con un lead para asegurar el trabajo.',
        whyNowEn: 'Key Day 1-2 action: Connect directly with a local lead to lock in the job.',
        expectedBenefitEs: 'Cerrar trabajo pagado esta semana',
        expectedBenefitEn: 'Close paying job this week',
        destinationCode: 'CONTACT_LEAD'
      },
      completed: false
    },
    {
      id: 'day_3',
      day: 'Día 3',
      titleEs: 'Pedir Reseña 5 Estrellas (wa.me)',
      titleEn: 'Request 5-Star Review (wa.me)',
      descEs: 'Envía el enlace pre-cargado de Google Maps a tu cliente reciente.',
      descEn: 'Send the pre-loaded Google Maps link to your recent customer.',
      actionType: 'review',
      actionPayload: {
        actionEs: 'Solicitar Reseña en Google Maps',
        actionEn: 'Request Google Maps Review',
        whyNowEs: 'Acción recomendada del Día 3 para elevar tu puntuación de confianza algorítmica.',
        whyNowEn: 'Recommended Day 3 action to boost algorithmic trust score.',
        expectedBenefitEs: '+1 Reseña de 5 Estrellas',
        expectedBenefitEn: '+1 5-Star Review',
        destinationCode: 'REQUEST_REVIEW'
      },
      completed: false
    },
    {
      id: 'day_4_5',
      day: 'Día 4-5',
      titleEs: 'Analizar Competidor Débil y Seguimiento',
      titleEn: 'Target Weak Competitor & Follow-up',
      descEs: 'Identifica dónde flaquea la competencia y asegura clientes insatisfechos.',
      descEn: 'Identify where competitors fall short and secure underserved clients.',
      actionType: 'competitor',
      actionPayload: {
        actionEs: 'Oferta de Atención Rápida vs Competidores Lentos',
        actionEn: 'Fast Response Offer vs Slow Local Competitors',
        whyNowEs: 'Competidores cercanos tardan >24h en responder; asegura el cliente con respuesta inmediata.',
        whyNowEn: 'Nearby competitors take >24h to answer; win customer through rapid response.',
        expectedBenefitEs: 'Cerrar trabajo por velocidad de respuesta',
        expectedBenefitEn: 'Win customer through rapid response',
        destinationCode: 'CONTACT_LEAD'
      },
      completed: false
    },
    {
      id: 'day_6_7',
      day: 'Día 6-7',
      titleEs: 'Evaluar Valor y Activar Plan Pro ($49/mo)',
      titleEn: 'Unlock Value & Activate Pro Plan ($49/mo)',
      descEs: 'Desbloquea escaneos ilimitados y automatización de clientes.',
      descEn: 'Unlock unlimited scans and automated client outreach.',
      actionType: 'upgrade',
      actionPayload: {
        actionEs: 'Activar Plan Bvelt Pro',
        actionEn: 'Activate Bvelt Pro Plan',
        whyNowEs: 'Acceso a escaneos profundos diarios y captación multizona sin restricciones.',
        whyNowEn: 'Daily deep market scans and multi-zone prospect radar without restrictions.',
        expectedBenefitEs: 'Escaneos y oportunidades ilimitadas',
        expectedBenefitEn: 'Unlimited scans & opportunities',
        destinationCode: 'UPGRADE'
      },
      completed: false
    }
  ],
  diagnosisStrings: {
    unverifiedGbp: {
      problemEs: 'Google Business Profile sin conectar o pendiente de sincronización',
      problemEn: 'Google Business Profile not connected or pending sync',
      whyThisMattersEs: 'Los perfiles de Google no conectados pierden visibilidad frente a competidores optimizados en Maps.',
      whyThisMattersEn: 'Disconnected Google profiles lose visibility to optimized competitors in Maps.',
      evidenceDeepDiveEs: 'Bvelt ha detectado que la clave de acceso OAuth para Google Business Profile aún no ha sido autorizada.',
      evidenceDeepDiveEn: 'Bvelt has detected that OAuth authorization for Google Business Profile is pending.'
    },
    unansweredReviews: {
      problemEs: (count: number) => `${count} ${count === 1 ? 'reseña sin responder' : 'reseñas sin responder'} en Google Business`,
      problemEn: (count: number) => `${count} unanswered ${count === 1 ? 'review' : 'reviews'} on Google Business`,
      whyThisMattersEs: 'Responder reseñas en menos de 24 horas incrementa la puntuación de confianza algorítmica de Google.',
      whyThisMattersEn: 'Replying to reviews within 24 hours increases Google algorithmic trust score.',
      actionTitleEs: 'Responder Reseñas de Google Maps',
      actionTitleEn: 'Reply to Google Maps Reviews'
    },
    seasonalDemand: {
      problemEs: 'Demanda de mercado estacional no capturada en tu zona',
      problemEn: 'Uncaptured Seasonal Local Market Demand in Service Radius',
      whyThisMattersEs: 'El volumen de búsqueda local varía por temporada; optimizar el perfil asegura clientes durante los picos de demanda.',
      whyThisMattersEn: 'Local search volume varies seasonally; optimizing your profile captures high-intent prospects during peak cycles.',
      evidenceSummaryEs: 'Búsquedas de temporada sin capturar en tu radio comercial.',
      evidenceSummaryEn: 'Seasonal search queries uncaptured in your commercial radius.',
      actionTitleEs: 'Lanzar Campaña Estacional de Servicios',
      actionTitleEn: 'Launch Seasonal Service Campaign',
      expectedBenefitEs: 'Captar nuevos clientes en tu zona',
      expectedBenefitEn: 'Capture new clients in service zone'
    },
    emergencyCoverage: {
      problemEs: 'Brecha de respuesta rápida frente a competidores locales',
      problemEn: 'Fast Response Advantage Gap vs Local Competitors',
      whyThisMattersEs: 'Los primeros negocios en responder a consultas locales capturan más del 60% de los trabajos directos.',
      whyThisMattersEn: 'The first businesses to respond to local queries capture over 60% of direct work.',
      evidenceSummaryEs: 'Competidores locales presentan retrasos en atención.',
      evidenceSummaryEn: 'Local competitors show delays in client response.',
      actionTitleEs: 'Activar Plantillas de Respuesta Inmediata',
      actionTitleEn: 'Activate Immediate Response Templates',
      expectedBenefitEs: 'Cerrar trabajos con respuesta en <15 min',
      expectedBenefitEn: 'Close jobs with <15 min response time'
    }
  },
  quickQuotes: [
    { id: 'gen_service', labelEs: 'Visita Técnica de Diagnóstico', labelEn: 'Service Call & Diagnostic Visit', defaultPrice: 95, unit: 'visita' },
    { id: 'gen_repair', labelEs: 'Reparación Estándar', labelEn: 'Standard Repair Service', defaultPrice: 220, unit: 'servicio' }
  ],
  whatsappTemplates: [
    {
      id: 'gen_dispatch',
      titleEs: 'Respuesta Rápida a Consulta de Cliente',
      titleEn: 'Fast Response to Customer Inquiry',
      textEs: 'Hola {{nombre}}, gracias por contactarnos. Podemos revisar tu solicitud hoy mismo. ¿Te va bien sobre las {{hora}}?',
      textEn: 'Hi {{nombre}}, thank you for reaching out. We can look at your request today. Does around {{hora}} work?'
    }
  ]
};
