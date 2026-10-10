import { VerticalConfig } from './types';

export const PLUMBING_VERTICAL_CONFIG: VerticalConfig = {
  id: 'plumbing',
  name: {
    es: 'Fontanería y Plomería',
    en: 'Plumbing Services'
  },
  keywords: [
    'plumber', 'plumbing', 'plomer', 'fontan', 'drain cleaning', 'clog', 'water heater',
    'leak detection', 'pipe burst', 'sewer', 'faucet', 'toilet', 'repipe', 'repiping',
    'desatasco', 'fuga de agua', 'calentador'
  ],
  emergencyServices: [
    'Emergency Burst Pipe & Leak Isolation',
    'Main Sewer Line Backup & Hydro-Jetting',
    'Water Heater Leak & Emergency Replacement',
    'Clogged Main Drain Clearing',
    'Commercial Grease Trap Overflow'
  ],
  highTicketServices: [
    'Tankless Water Heater Installation ($2,800 - $5,500)',
    'Trenchless Sewer Line Replacement ($4,500 - $9,500)',
    'Whole-Home Copper/PEX Repiping ($5,000 - $12,000)',
    'Commercial Hydro-Jetting & Video Inspection ($1,200 - $2,800)'
  ],
  averageTicket: 650,
  checklist: [
    {
      id: 'day_1',
      day: 'Día 1',
      titleEs: 'Auditoría de Palabras Clave de Fontanería en Maps',
      titleEn: 'Audit Plumbing Keywords & Google Maps Radius',
      descEs: 'Revisa tu visibilidad para "fontanero urgente", "desatascos" y "calentadores".',
      descEn: 'Check ranking for "emergency plumber near me", "drain cleaning", and water heaters.',
      actionType: 'audit',
      actionPayload: {
        actionEs: 'Auditoría de Visibilidad Local de Fontanería',
        actionEn: 'Plumbing Local Visibility Audit',
        whyNowEs: 'Paso 1: Identifica llamadas de emergencia de fontanería perdidas en tu código postal.',
        whyNowEn: 'Step 1: Identify lost emergency plumbing calls in your service zip codes.',
        expectedBenefitEs: 'Detectar fugas de llamadas en tu zona',
        expectedBenefitEn: 'Spot lost plumbing calls in service territory',
        destinationCode: 'SCAN'
      },
      completed: false
    },
    {
      id: 'day_1_2',
      day: 'Día 1-2',
      titleEs: 'Activar Respuestas Rápidas para Desatascos y Fugas',
      titleEn: 'Deploy Plumbing Emergency Dispatch Templates',
      descEs: 'Contacta prospectos en <5 minutos para cerrar reparaciones urgentes antes que otros fontaneros.',
      descEn: 'Reply in <5 minutes to close emergency leaks and drain clogs before competitors.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Enviar Presupuesto Rápido de Fontanería',
        actionEn: 'Send Fast Plumbing Estimate via WhatsApp',
        whyNowEs: 'Las fugas de agua requieren acción inmediata; el primer fontanero que responde se queda el trabajo.',
        whyNowEn: 'Water leaks require immediate response; the first plumber to reply secures the contract.',
        expectedBenefitEs: 'Asegurar trabajo de reparación urgente',
        expectedBenefitEn: 'Lock in emergency repair job',
        destinationCode: 'CONTACT_LEAD',
        contextData: {
          leadName: 'Propietario con Fuga / Avería'
        }
      },
      completed: false
    },
    {
      id: 'day_3',
      day: 'Día 3',
      titleEs: 'Solicitar Reseña 5 Estrellas tras Reparar Fuga o Desatasco',
      titleEn: 'Request 5-Star Review After Plumbing Job',
      descEs: 'Envía el enlace wa.me al cliente justo al resolver su problema de fontanería.',
      descEn: 'Send the direct Google review link right after resolving the homeowner leak or clog.',
      actionType: 'review',
      actionPayload: {
        actionEs: 'Pedir Reseña de Fontanería por WhatsApp',
        actionEn: 'Request Plumbing Review on WhatsApp',
        whyNowEs: 'La satisfacción es máxima cuando acabas de solucionar una fuga o inundación.',
        whyNowEn: 'Customer satisfaction peaks right after resolving a leak or flood.',
        expectedBenefitEs: '+1 Reseña Verificada de 5 Estrellas en Google Maps',
        expectedBenefitEn: '+1 Verified 5-Star Review on Google Maps',
        destinationCode: 'REQUEST_REVIEW'
      },
      completed: false
    },
    {
      id: 'day_4_5',
      day: 'Día 4-5',
      titleEs: 'Aprovechar Competidores Lentos en Servicios de Urgencia',
      titleEn: 'Target Slow Plumbing Competitors on Urgent Calls',
      descEs: 'Destaca tu disponibilidad inmediata frente a competidores con retrasos o sin respuesta.',
      descEn: 'Highlight immediate availability against competitors with long delays or unanswered phones.',
      actionType: 'competitor',
      actionPayload: {
        actionEs: 'Oferta de Despacho de Fontanería Rápido',
        actionEn: 'Fast Plumbing Dispatch Offer',
        whyNowEs: 'Capta trabajos urgentes de clientes que no consiguieron contactar con sus fontaneros habituales.',
        whyNowEn: 'Win urgent jobs from homeowners unable to reach their standard plumber.',
        expectedBenefitEs: 'Cerrar trabajo de emergencia de $250 - $900',
        expectedBenefitEn: 'Capture $250 - $900 emergency job',
        destinationCode: 'CONTACT_LEAD'
      },
      completed: false
    },
    {
      id: 'day_6_7',
      day: 'Día 6-7',
      titleEs: 'Activar Radar Multizona Pro para Fontanería ($49/mo)',
      titleEn: 'Unlock Pro Multi-Zone Plumbing Radar ($49/mo)',
      descEs: 'Supervisa llamadas de emergencia y prospectos en múltiples zonas sin límites diarios.',
      descEn: 'Monitor emergency calls and commercial prospects across multiple zones with no daily limits.',
      actionType: 'upgrade',
      actionPayload: {
        actionEs: 'Activar Bvelt Pro Fontanería',
        actionEn: 'Activate Bvelt Pro Plumbing Plan',
        whyNowEs: 'Acceso a escaneos profundos ilimitados y automatización de clientes en toda tu área de servicio.',
        whyNowEn: 'Full access to unlimited deep scans and automated client nurturing across your territory.',
        expectedBenefitEs: 'Escaneos y oportunidades ilimitadas',
        expectedBenefitEn: 'Unlimited scans & opportunities',
        destinationCode: 'UPGRADE'
      },
      completed: false
    }
  ],
  diagnosisStrings: {
    unverifiedGbp: {
      problemEs: 'Ficha de Google Business de Fontanería sin conectar o sin verificar',
      problemEn: 'Plumbing Google Business Profile not connected or pending sync',
      whyThisMattersEs: 'En fontanería, las averías críticas (inundaciones, rotura de tuberías, calentadores rotos) se buscan en Maps directamente desde el móvil. Sin sincronización, los clientes llaman a las primeras 3 fichas verificadas.',
      whyThisMattersEn: 'In plumbing, emergency distress searches (burst pipes, flooding, broken water heaters) happen directly on mobile Maps. An unverified profile loses these calls to the top 3 verified competitors.',
      evidenceDeepDiveEs: 'Falta de conexión directa con la API de Google Business. Los competidores locales en tu zona promedian 35+ reseñas de 5 estrellas.',
      evidenceDeepDiveEn: 'Missing direct connection with Google Business API. Local plumbing competitors average 35+ 5-star reviews.'
    },
    unansweredReviews: {
      problemEs: (count: number) => `${count} ${count === 1 ? 'reseña de fontanería sin responder' : 'reseñas de fontanería sin responder'} en Google Maps`,
      problemEn: (count: number) => `${count} unanswered plumbing ${count === 1 ? 'review' : 'reviews'} on Google Maps`,
      whyThisMattersEs: 'Los clientes que confían en un fontanero para entrar en su hogar leen minuciosamente las respuestas a reseñas para evaluar seriedad y puntualidad.',
      whyThisMattersEn: 'Homeowners hiring a plumber to enter their home read review replies carefully to assess punctuality and professionalism.',
      actionTitleEs: 'Responder Reseñas de Fontanería',
      actionTitleEn: 'Reply to Plumbing Client Reviews'
    },
    seasonalDemand: {
      problemEs: 'Fuga de llamadas por heladas y revisión de tuberías / calentadores',
      problemEn: 'Winter Freeze & Water Heater Seasonal Demand Gap',
      whyThisMattersEs: 'Las olas de frío provocan picos de tuberías congeladas y fallos de calentadores. Preparar tu ficha duplica las llamadas en temporales.',
      whyThisMattersEn: 'Cold snaps cause sudden spikes in frozen pipes and water heater breakdowns. Optimizing your profile doubles call volume during freezes.',
      evidenceSummaryEs: 'Pico estacional de fontanería sin capturar en tu zona de servicio.',
      evidenceSummaryEn: 'Uncaptured seasonal plumbing search demand in your service area.',
      actionTitleEs: 'Lanzar Campaña de Prevención de Heladas y Calentadores',
      actionTitleEn: 'Launch Freeze Prevention & Water Heater Campaign',
      expectedBenefitEs: 'Captar reparaciones de $250 - $800',
      expectedBenefitEn: 'Capture $250 - $800 emergency repairs'
    },
    emergencyCoverage: {
      problemEs: 'Brecha de cobertura para emergencias de fontanería 24/7',
      problemEn: '24/7 Emergency Plumbing Call Gap in Core Radius',
      whyThisMattersEs: 'Las llamadas de inundaciones y desatascos en fines de semana tienen tarifas de urgencia con mayor margen de beneficio.',
      whyThisMattersEn: 'Weekend flood and emergency unclogging calls command premium after-hours emergency rates.',
      evidenceSummaryEs: 'Falta de señal de servicio de guardia 24 horas en tu perfil de Maps.',
      evidenceSummaryEn: 'Missing 24-hour emergency dispatch signal on your Maps profile.',
      actionTitleEs: 'Activar Guardia de Emergencia de Fontanería',
      actionTitleEn: 'Activate 24/7 Emergency Plumbing Dispatch',
      expectedBenefitEs: 'Capturar trabajos de urgencia de $300 - $1,200',
      expectedBenefitEn: 'Capture $300 - $1,200 emergency jobs'
    }
  },
  quickQuotes: [
    { id: 'plumb_drain', labelEs: 'Desatasco de Desagüe / Inodoro', labelEn: 'Drain & Toilet Unclogging', defaultPrice: 185, unit: 'servicio' },
    { id: 'plumb_leak', labelEs: 'Reparación de Fuga de Tubería', labelEn: 'Pipe Leak Diagnostic & Repair', defaultPrice: 275, unit: 'reparación' },
    { id: 'plumb_water_heater', labelEs: 'Reemplazo de Calentador de Agua (50 Gal)', labelEn: 'Standard 50-Gal Water Heater Replacement', defaultPrice: 1650, unit: 'instalación' },
    { id: 'plumb_tankless', labelEs: 'Instalación de Calentador Sin Tanque', labelEn: 'Tankless Water Heater Installation', defaultPrice: 3200, unit: 'instalación' }
  ],
  whatsappTemplates: [
    {
      id: 'plumb_urgent_dispatch',
      titleEs: 'Respuesta Rápida a Fuga o Desatasco Urgente',
      titleEn: 'Rapid Dispatch Response for Plumbing Leak / Clog',
      textEs: 'Hola {{nombre}}, recibí tu solicitud de fontanería. Podemos enviar un técnico a revisar la avería hoy mismo. ¿Te va bien que pasemos entre las {{hora}}?',
      textEn: 'Hi {{nombre}}, received your plumbing request. We can have a technician at your property today to inspect the issue. Would {{hora}} work?'
    },
    {
      id: 'plumb_post_service_review',
      titleEs: 'Solicitud de Reseña tras Trabajo de Fontanería',
      titleEn: 'Review Request After Plumbing Service',
      textEs: 'Hola {{nombre}}, fue un gusto dejar solucionado el trabajo de fontanería. ¿Podrías dejarnos una reseña de 5 estrellas en Google? Nos ayuda mucho: {{link}} ¡Gracias!',
      textEn: 'Hi {{nombre}}, glad we could resolve your plumbing issue today! Could you leave us a quick 5-star review on Google? {{link}} Thank you!'
    }
  ]
};
