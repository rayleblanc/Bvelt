import { TradePack } from './types';

export const PLUMBING_TRADE_PACK: TradePack = {
  id: 'plumbing',
  name: {
    es: 'Fontanería y Plomería',
    en: 'Plumbing & Drain Services'
  },
  keywords: [
    'plumber', 'plumbing', 'fontaneria', 'plomero', 'drain cleaning',
    'water heater', 'leak detection', 'pipe repair', 'faucet repair',
    'sewer line', 'desatascos', 'fugas de agua', 'calentador de agua',
    'termo electrico', 'griferia', 'inodoro'
  ],
  emergencyServices: [
    '24/7 Emergency Burst Pipe Repair',
    'Sewer Backup & Main Drain Hydro-Jetting',
    'Gas Line Leak Diagnostic & Shutoff',
    'Water Heater Leak & Flood Prevention',
    'Severe Toilet Overflow & Unclogging'
  ],
  highTicketServices: [
    'Trenchless Sewer Line Replacement ($4,500 - $9,500)',
    'Tankless Water Heater Conversion ($2,800 - $5,500)',
    'Whole-Home PEX Repiping ($4,000 - $8,500)',
    'Commercial Hydro-Jetting & Grease Trap Maintenance ($1,200 - $3,500)'
  ],
  averageTicket: 780,
  diagnosisStrings: {
    unverifiedGbp: {
      problemEs: 'Tu ficha de Google Maps para fontanería no está verificada — los clientes con fugas urgentes llaman a competidores.',
      problemEn: 'Your plumbing Google Maps profile is unverified — customers with urgent leaks call competitors.',
      whyThisMattersEs: 'El 85% de las llamadas por fugas y tuberías rotas se realizan desde los primeros 3 puestos de Google Maps.',
      whyThisMattersEn: '85% of urgent leak and burst pipe calls come from the Google Maps 3-pack.',
      evidenceDeepDiveEs: 'Sin verificación, Google no muestra tu teléfono en búsquedas locales de "fontanero urgente cerca de mí".',
      evidenceDeepDiveEn: 'Without verification, Google hides your phone number on high-intent "emergency plumber near me" queries.'
    },
    unansweredReviews: {
      problemEs: (count: number) => `Tienes ${count} reseñas de fontanería sin responder. El algoritmo de Maps penaliza perfiles inactivos.`,
      problemEn: (count: number) => `You have ${count} unanswered plumbing reviews. Google Maps algorithm penalizes inactive profiles.`,
      whyThisMattersEs: 'Responder a reseñas de desatascos y reparaciones genera confianza para trabajos de alto presupuesto.',
      whyThisMattersEn: 'Replying to repair and drain reviews builds trust for high-ticket repiping jobs.',
      actionTitleEs: 'Responder a Reseñas de Fontanería Pendientes',
      actionTitleEn: 'Reply to Pending Plumbing Reviews'
    },
    seasonalDemand: {
      problemEs: 'Pico de demanda por tuberías y calentadores activo: Búsquedas locales de fontanería suben +55%.',
      problemEn: 'Active plumbing & water heater seasonal spike: Local searches up +55%.',
      whyThisMattersEs: 'Los cambios de temperatura provocan roturas de tuberías y fallos en calentadores de agua.',
      whyThisMattersEn: 'Seasonal weather shifts cause frozen pipe bursts and water heater failures.',
      evidenceSummaryEs: 'Los competidores de fontanería están captando avisos prioritarios en Maps.',
      evidenceSummaryEn: 'Local plumbing rivals are capturing priority service calls on Maps.',
      actionTitleEs: 'Publicar Oferta de Inspección de Fugas en Google Maps',
      actionTitleEn: 'Post Plumbing Inspection Offer on Google Maps',
      expectedBenefitEs: 'Captar entre 4 y 9 avisos de reparación y cambio de calentador',
      expectedBenefitEn: 'Capture 4-9 repairs and water heater replacement jobs'
    },
    emergencyCoverage: {
      problemEs: 'Sin guardia de emergencias 24/7 visible: Pierdes llamadas críticas de inundaciones nocturnas.',
      problemEn: 'No 24/7 emergency badge: Losing after-hours flood and burst pipe calls.',
      whyThisMattersEs: 'Las emergencias nocturnas de fontanería tienen las tarifas más altas del sector.',
      whyThisMattersEn: 'After-hours plumbing emergencies command the highest margin rates in the industry.',
      evidenceSummaryEs: 'Los usuarios llaman inmediatamente a quien tenga el botón "Llamar Ahora - Guardia 24h".',
      evidenceSummaryEn: 'Distressed users call the first listing with a clear "Call Now - 24/7 Emergency" badge.',
      actionTitleEs: 'Activar Servicio de Emergencia 24 Horas en Google',
      actionTitleEn: 'Enable 24/7 Emergency Service on Google Profile',
      expectedBenefitEs: 'Captar 2-4 avisos urgentes por semana',
      expectedBenefitEn: 'Capture 2-4 emergency leak calls weekly'
    }
  },
  checklist: [
    {
      id: 'plumb_day_1',
      day: 'Día 1',
      titleEs: 'Auditoría de Palabras Clave de Fontanería en Maps',
      titleEn: 'Audit Plumbing Keywords & Maps Radius',
      descEs: 'Verifica tu posición para "fontanero urgente", "desatascos" y "fugas de agua".',
      descEn: 'Check rankings for "emergency plumber", "drain cleaning" and "water heater repair".',
      actionType: 'audit',
      actionPayload: {
        actionEs: 'Auditoría Local de Fontanería',
        actionEn: 'Plumbing Local Audit',
        whyNowEs: 'Comprueba qué llamadas de urgencia estás perdiendo en tu código postal.',
        whyNowEn: 'See what urgent plumbing calls you are missing in your zip code.',
        expectedBenefitEs: 'Detectar radio de llamadas perdidas',
        expectedBenefitEn: 'Spot missed call radius',
        destinationCode: 'SCAN'
      },
      completed: false
    },
    {
      id: 'plumb_day_2',
      day: 'Día 2',
      titleEs: 'Activar Presupuesto Rápido de Fontanería por WhatsApp',
      titleEn: 'Deploy 1-Tap WhatsApp Plumbing Quotes',
      descEs: 'Envía tarifas orientativas al instante para averías y desatascos.',
      descEn: 'Send upfront rates in seconds for leaks and drain unclogs.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Enviar Presupuesto Fontanería',
        actionEn: 'Send Plumbing Estimate',
        whyNowEs: 'El cliente con una fuga contrata al primer fontanero que responde.',
        whyNowEn: 'A customer with a leak hires the first plumber who responds.',
        expectedBenefitEs: 'Asegurar el trabajo en <10 minutos',
        expectedBenefitEn: 'Lock in the job in <10 minutes',
        destinationCode: 'CONTACT_LEAD'
      },
      completed: false
    },
    {
      id: 'plumb_day_3',
      day: 'Día 3',
      titleEs: 'Solicitar Reseña 5★ tras Reparar Fuga o Desatasco',
      titleEn: 'Request 5★ Review After Leak / Drain Fix',
      descEs: 'Envía el enlace directo a Google justo tras solucionar el problema.',
      descEn: 'Send the Google review link immediately after solving the issue.',
      actionType: 'review',
      actionPayload: {
        actionEs: 'Pedir Reseña por WhatsApp',
        actionEn: 'Request Review via WhatsApp',
        whyNowEs: 'El alivio del cliente al reparar una fuga genera reseñas de 5 estrellas al instante.',
        whyNowEn: 'Client relief after resolving a flood translates into instant 5-star reviews.',
        expectedBenefitEs: '+1 Reseña de 5 Estrellas en Google',
        expectedBenefitEn: '+1 5-Star Review on Google Maps',
        destinationCode: 'REQUEST_REVIEW'
      },
      completed: false
    }
  ],
  outreachTemplates: [
    {
      id: 'plumb_emergency',
      nameEs: 'Respuesta Urgente a Fuga / Tubería Rota',
      nameEn: 'Emergency Burst Pipe / Leak Response',
      category: 'emergency',
      whatsappTextEs: '¡Hola [Nombre]! Soy [MiNombre] de [MiEmpresa]. Veo que tienes una fuga o atasco urgente en [Zona]. Tenemos un fontanero equipado en tu área ahora mismo. ¿Cerramos la llave de paso y pasamos a repararlo de inmediato?',
      whatsappTextEn: 'Hi [Name]! This is [MyName] from [MyCompany]. Saw you have an urgent leak or drain issue in [Area]. We have a service van in your neighborhood right now. Would you like our tech to stop by immediately?',
      smsTextEs: '[MiEmpresa] Fontanería: Hola [Nombre], fontanero disponible para urgencia de agua/fugas en [Zona]. Responde o llámanos para llegada en <45 min.',
      smsTextEn: '[MyCompany] Plumbing: Hi [Name], plumber available for urgent leak repair in [Area]. Call or reply for <45m arrival.'
    }
  ],
  gbpPostTemplates: [
    {
      id: 'plumb_drain_special',
      titleEs: '🚰 Desatascos y Limpieza de Tuberías con Cámara en [Ciudad]',
      titleEn: '🚰 Professional Drain Cleaning & Camera Inspection in [City]',
      bodyEs: '¿Fregadero o inodoro atascado? Localizamos el origen exacto del atasco con cámara de inspección HD sin romper paredes ni suelos. Servicio en el día en todo [Ciudad].',
      bodyEn: 'Slow drains or frequent toilet backups? We inspect sewer lines with HD cameras to clear blockages fast with no mess. Same-day service across [City].',
      ctaType: 'CALL',
      suggestedTags: ['#Plumbing', '#DrainCleaning', '#CameraInspection', '#EmergencyPlumber']
    }
  ],
  quickQuotes: [
    { id: 'plumb_diag', labelEs: 'Inspección de Fugas y Diagnóstico', labelEn: 'Leak Inspection & Diagnostic', defaultPrice: 75, unit: 'visita / visit' },
    { id: 'plumb_drain', labelEs: 'Desatasco de Tubería / Desagüe Principal', labelEn: 'Main Drain Cleaning & Hydro-Jetting', defaultPrice: 240, unit: 'servicio / service' },
    { id: 'plumb_water_heater', labelEs: 'Sustitución de Calentador / Termo Eléctrico', labelEn: 'Water Heater Replacement & Install', defaultPrice: 1450, unit: 'instalación / install' }
  ],
  emptyStateExamples: {
    sampleBusinessName: 'Dallas Premier Plumbing',
    sampleCity: 'Dallas, TX',
    sampleCompetitor: 'Apex Rooter & Plumbing (4.9 ★, 410 reviews)',
    sampleLeads: [
      {
        id: 'plumb_lead_1',
        name: 'Michael Chang',
        phone: '+1 (214) 555-0322',
        service: 'Rotura de Tubería en Cocina (Urgente)',
        serviceEn: 'Emergency Kitchen Pipe Burst',
        status: 'new',
        estimatedValue: 350,
        timeAgo: 'Hace 10 min',
        timeAgoEn: '10m ago',
        notes: 'Agua filtrando debajo del fregadero. Llave de paso cortada.',
        notesEn: 'Water leaking under sink. Main valve shut off.'
      }
    ],
    sampleRecentScans: [
      { name: 'Dallas Premier Plumbing', city: 'Dallas, TX', score: 71, date: 'Hoy / Today' }
    ],
    sampleQuickQuotes: [
      { id: 'plumb_diag', labelEs: 'Inspección de Fugas y Diagnóstico', labelEn: 'Leak Inspection & Diagnostic', defaultPrice: 75, unit: 'visita / visit' },
      { id: 'plumb_drain', labelEs: 'Desatasco de Tubería', labelEn: 'Drain Cleaning', defaultPrice: 240, unit: 'servicio / service' }
    ]
  }
};
