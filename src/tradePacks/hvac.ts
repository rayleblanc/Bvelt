import { TradePack } from './types';

export const HVAC_TRADE_PACK: TradePack = {
  id: 'hvac',
  name: {
    es: 'HVAC y Climatización',
    en: 'HVAC & Climate Control'
  },
  keywords: [
    'hvac', 'ac repair', 'air conditioning', 'heating', 'furnace', 'heat pump',
    'minisplit', 'mini split', 'duct cleaning', 'ductwork', 'refrigerant', 'freon',
    'climatizacion', 'aire acondicionado', 'calefaccion', 'cooling', 'ventilation',
    'hvac contractor', 'refrigeracion', 'caldera', 'aerotermia', 'ac tune up'
  ],
  emergencyServices: [
    '24/7 Emergency AC Outage Repair',
    'Furnace / Heating Failure in Winter Freeze',
    'Refrigerant Leak & Compressor Diagnostics',
    'Frozen Evaporator Coil Emergency Thaw',
    'Blown Capacitor & Blower Fan Motor Replacement'
  ],
  highTicketServices: [
    'Complete Central AC & Furnace Replacement ($5,500 - $12,000)',
    'Multi-Zone Ductless Mini-Split Installation ($3,800 - $8,500)',
    'High-Efficiency Heat Pump Conversion & Rebates ($6,000 - $13,500)',
    'Commercial RTU (Rooftop Unit) Maintenance & Replacement ($4,500+)'
  ],
  averageTicket: 1450,
  diagnosisStrings: {
    unverifiedGbp: {
      problemEs: 'Tu ficha de Google Maps para HVAC no está verificada — los propietarios de tu zona llaman a competidores cuando su aire o calefacción falla.',
      problemEn: 'Your Google Maps listing for HVAC is unverified — local homeowners call competitors when their AC or furnace fails.',
      whyThisMattersEs: 'El 82% de las llamadas urgentes de reparación de aire acondicionado van a los primeros 3 resultados del Local Pack de Google Maps.',
      whyThisMattersEn: '82% of urgent AC repair calls go directly to the top 3 spots on Google Maps Local Pack.',
      evidenceDeepDiveEs: 'Sin verificación oficial, Google no te muestra en búsquedas de "reparación de AC cerca de mí" con intención de contratación inmediata.',
      evidenceDeepDiveEn: 'Without official verification, Google omits you from high-intent "AC repair near me" search queries.'
    },
    unansweredReviews: {
      problemEs: (count: number) => `Tienes ${count} reseñas de clientes de climatización sin responder. Google Maps reduce tu visibilidad cuando ignoras feedback.`,
      problemEn: (count: number) => `You have ${count} unanswered HVAC customer reviews. Google Maps demotes listings that ignore client feedback.`,
      whyThisMattersEs: 'Responder en <24h a reseñas de instalaciones y reparaciones aumenta la tasa de conversión de llamadas un +35%.',
      whyThisMattersEn: 'Responding within 24h to HVAC repair and installation reviews boosts call conversion by +35%.',
      actionTitleEs: 'Responder Reseñas de Climatización Pendientes',
      actionTitleEn: 'Reply to Pending HVAC Reviews'
    },
    seasonalDemand: {
      problemEs: 'Pico de demanda estacional de climatización activo en tu zona: Búsquedas de revisión de AC / calefacción suben +65%.',
      problemEn: 'Active HVAC seasonal peak in your service area: Local searches for AC / heating tune-ups up +65%.',
      whyThisMattersEs: 'Los propietarios buscan puestas a punto preventivas y reparaciones rápidas antes de olas de calor o frío extremo.',
      whyThisMattersEn: 'Homeowners book pre-season maintenance and fast repairs right before heatwaves or winter freezes.',
      evidenceSummaryEs: 'Competidores locales ya publican ofertas de mantenimiento preventivo y captan presupuestos de sustitución de equipos.',
      evidenceSummaryEn: 'Local rivals are actively publishing seasonal tune-up specials and capturing lucrative changeout leads.',
      actionTitleEs: 'Lanzar Publicación de Mantenimiento Preventivo de AC / Calefacción',
      actionTitleEn: 'Post Seasonal HVAC Tune-Up Offer on Google Maps',
      expectedBenefitEs: 'Captar entre 3 y 8 puestas a punto y detectar cambios de compresor',
      expectedBenefitEn: 'Capture 3-8 seasonal tune-ups and uncover high-ticket changeout jobs'
    },
    emergencyCoverage: {
      problemEs: 'Sin guardia de urgencia 24/7 destacada en Google Maps: Pierdes avisos de averías nocturnas y de fin de semana.',
      problemEn: 'No 24/7 emergency badge highlighted on Google Maps: Missing lucrative night and weekend breakdown calls.',
      whyThisMattersEs: 'Las reparaciones de urgencia de HVAC tienen tarifas un 40-70% superiores al servicio programado ordinario.',
      whyThisMattersEn: 'Emergency after-hours HVAC repair calls command 40-70% higher profit margins than routine calls.',
      evidenceSummaryEs: 'Los clientes llaman al primer contratista que indica explícitamente "Servicio de Emergencia Inmediato".',
      evidenceSummaryEn: 'Distressed homeowners call the first contractor showing "24/7 Emergency AC & Heating Dispatch".',
      actionTitleEs: 'Configurar Insignia de Servicio de Urgencia 24/7 en Perfil',
      actionTitleEn: 'Enable 24/7 Emergency Service Badge in Google Profile',
      expectedBenefitEs: 'Capturar entre 2 y 5 reparaciones urgentes adicionales por semana',
      expectedBenefitEn: 'Capture 2-5 high-margin emergency service calls weekly'
    }
  },
  checklist: [
    {
      id: 'hvac_day_1',
      day: 'Día 1',
      titleEs: 'Auditoría de Palabras Clave HVAC y Radio de Cobertura en Maps',
      titleEn: 'Audit HVAC Keywords & Google Maps Radius',
      descEs: 'Verifica tu posición para "reparación de AC", "calefacción urgente" y códigos postales clave.',
      descEn: 'Verify ranking for "AC repair near me", "furnace fix" and your core HVAC service zip codes.',
      actionType: 'audit',
      actionPayload: {
        actionEs: 'Auditoría de Visibilidad Local HVAC',
        actionEn: 'HVAC Local Visibility Audit',
        whyNowEs: 'Paso 1: Identifica tu posición en Maps para búsquedas de alta intención de aire acondicionado y calefacción.',
        whyNowEn: 'Step 1: Check your Maps ranking for high-intent emergency AC and heating searches.',
        expectedBenefitEs: 'Detectar radio de llamadas HVAC perdidas',
        expectedBenefitEn: 'Spot lost HVAC phone calls in service zone',
        destinationCode: 'SCAN'
      },
      completed: false
    },
    {
      id: 'hvac_day_2',
      day: 'Día 2',
      titleEs: 'Activar Presupuesto Rápido HVAC por WhatsApp (wa.me)',
      titleEn: 'Deploy 1-Tap WhatsApp HVAC Quotes',
      descEs: 'Envía plantilla por WhatsApp al primer contacto para asegurar reparaciones urgentes y reemplazos.',
      descEn: 'Send 1-tap WhatsApp quotes to lock in emergency AC repairs and system replacements.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Enviar Presupuesto Rápido HVAC por WhatsApp',
        actionEn: 'Send Fast HVAC Estimate via WhatsApp',
        whyNowEs: 'En HVAC, responder en <10 minutos duplica la tasa de cierre frente a contratistas que tardan horas.',
        whyNowEn: 'In HVAC, responding within 10 minutes doubles close rate compared to slow competitors.',
        expectedBenefitEs: 'Asegurar trabajo de reparación o instalación',
        expectedBenefitEn: 'Secure repair or replacement contract',
        destinationCode: 'CONTACT_LEAD',
        contextData: {
          leadName: 'Propietario / Cliente HVAC',
          serviceType: 'Diagnóstico y Reparación HVAC'
        }
      },
      completed: false
    },
    {
      id: 'hvac_day_3',
      day: 'Día 3',
      titleEs: 'Solicitar Reseña 5 Estrellas tras Reparación o Mantenimiento',
      titleEn: 'Request 5-Star Review After Service Call',
      descEs: 'Envía el enlace pre-cargado de Google Maps al propietario justo al terminar la reparación del aire.',
      descEn: 'Send pre-filled Google Maps review link right after finishing the repair or seasonal tune-up.',
      actionType: 'review',
      actionPayload: {
        actionEs: 'Solicitar Reseña de Trabajo HVAC (wa.me)',
        actionEn: 'Request HVAC Review via WhatsApp',
        whyNowEs: 'Pedir reseña inmediatamente después de reparar el aire o calefacción genera +80% de tasa de respuesta positiva.',
        whyNowEn: 'Asking right after restoring cooling/heating yields >80% positive review conversion.',
        expectedBenefitEs: '+1 Reseña Verificada de 5 Estrellas en Maps',
        expectedBenefitEn: '+1 Verified 5-Star Review on Maps',
        destinationCode: 'REQUEST_REVIEW',
        contextData: {
          leadName: 'Cliente Reciente HVAC'
        }
      },
      completed: false
    },
    {
      id: 'hvac_day_4_5',
      day: 'Día 4-5',
      titleEs: 'Capturar Llamadas de Competidores HVAC Lentos',
      titleEn: 'Win High-Ticket Jobs from Slow HVAC Rivals',
      descEs: 'Aprovecha competidores con demoras >24h o sin guardia de fin de semana para ganar trabajos de urgencia.',
      descEn: 'Leverage competitor delays >24h to capture emergency calls and lucrative changeout jobs.',
      actionType: 'competitor',
      actionPayload: {
        actionEs: 'Activar Radar de Brechas de Competidores HVAC',
        actionEn: 'Activate HVAC Competitor Gap Radar',
        whyNowEs: 'Detecta qué competidores tienen quejas por falta de puntualidad o precios abusivos para posicionarte como alternativa de confianza.',
        whyNowEn: 'Identify rivals with slow response times or price gouging complaints to position as the trusted local expert.',
        expectedBenefitEs: 'Captar entre 2 y 4 avisos de sustitución de equipo al mes',
        expectedBenefitEn: 'Capture 2-4 system changeouts per month',
        destinationCode: 'RADAR'
      },
      completed: false
    },
    {
      id: 'hvac_day_6_7',
      day: 'Día 6-7',
      titleEs: 'Publicar Oferta de Puesta a Punto Estacional en Google Maps',
      titleEn: 'Publish Seasonal AC/Heat Tune-Up Post on GBP',
      descEs: 'Sube una foto del camión o equipo instalado con llamada a la acción para agendar revisiones.',
      descEn: 'Upload a truck or installed unit photo with direct CTA to book pre-season maintenance.',
      actionType: 'actions',
      actionPayload: {
        actionEs: 'Crear Publicación GMB de Puesta a Punto',
        actionEn: 'Create GMB Seasonal Tune-Up Post',
        whyNowEs: 'Las publicaciones recientes con fotos reales en Google Maps aumentan la interacción en el perfil un +42%.',
        whyNowEn: 'Fresh GBP posts with real job photos increase local profile engagement by +42%.',
        expectedBenefitEs: 'Aparecer en carrusel de novedades locales de Google',
        expectedBenefitEn: 'Appear in Google Local updates carousel',
        destinationCode: 'POST'
      },
      completed: false
    }
  ],
  outreachTemplates: [
    {
      id: 'hvac_emergency_quote',
      nameEs: 'Presupuesto Rápido de Emergencia (Sin Aire / Sin Calefacción)',
      nameEn: 'Emergency Fast Quote (No AC / No Heat)',
      category: 'emergency',
      whatsappTextEs: '¡Hola [Nombre]! Soy [MiNombre] de [MiEmpresa]. Veo que necesitas reparación urgente de aire acondicionado/calefacción en [Zona]. Tenemos una furgoneta con repuestos cerca de ti hoy. ¿A qué hora te viene bien que pase el técnico a revisar la avería?',
      whatsappTextEn: 'Hi [Name]! This is [MyName] with [MyCompany]. I saw you need urgent AC / Heating repair in [Area]. We have a fully stocked service truck in your neighborhood today. What time works best for our technician to inspect it?',
      smsTextEs: '[MiEmpresa] HVAC: Hola [Nombre], tenemos furgoneta disponible para revisión urgente de climatización hoy en [Zona]. Llámanos o responde a este SMS para reservar hora.',
      smsTextEn: '[MyCompany] HVAC: Hi [Name], technician available for urgent AC/Heating diagnostic today in [Area]. Call or reply to book your slot.'
    },
    {
      id: 'hvac_seasonal_tuneup',
      nameEs: 'Puesta a Punto Estacional (21 Puntos de Control)',
      nameEn: 'Seasonal 21-Point Tune-Up & Inspection',
      category: 'seasonal',
      whatsappTextEs: '¡Hola [Nombre]! Con las temperaturas extremas acercándose a [Zona], estamos realizando la Revisión Preventiva de 21 Puntos para aire y calefacción (presión de gas, condensador, filtros y cuadro eléctrico). Evita averías caras en plena temporada. ¿Te reservo un hueco esta semana con precio especial de vecino?',
      whatsappTextEn: 'Hi [Name]! With extreme temperatures ahead in [Area], we are scheduling our Pre-Season 21-Point AC & Heating Tune-Up (refrigerant levels, capacitor, coil & electrical checks). Prevent costly mid-summer breakdowns. Can I save you a neighborhood discount slot this week?',
      smsTextEs: '[MiEmpresa] HVAC: Evita que tu aire falle en el peor momento. Puesta a punto de 21 puntos en [Zona]. Responde SÍ para agendar revisión.',
      smsTextEn: '[MyCompany] HVAC: Avoid AC breakdown in the heat. 21-point cooling tune-up available in [Area]. Reply YES to schedule.'
    },
    {
      id: 'hvac_review_request',
      nameEs: 'Solicitud de Reseña tras Reparación de Climatización',
      nameEn: 'Review Request After Restoring Climate System',
      category: 'review',
      whatsappTextEs: '¡Hola [Nombre]! Fue un placer dejar funcionando tu sistema de climatización hoy. Como negocio local de [Zona], tu opinión nos ayuda muchísimo a seguir dando servicio de confianza. ¿Podrías dejarnos una breve reseña de 5 estrellas en Google? Te dejo el enlace directo: [EnlaceReseña]. ¡Muchas gracias!',
      whatsappTextEn: 'Hi [Name]! It was a pleasure getting your AC & Heating system running smoothly today. As a local [Area] service business, your feedback means the world to us. Could you leave us a quick 5-star review on Google? Here is the direct link: [ReviewLink]. Thank you!',
      smsTextEs: '¡Hola [Nombre]! Gracias por confiar en [MiEmpresa]. ¿Nos dejas una reseña rápida en Google? [EnlaceReseña] ¡Gracias!',
      smsTextEn: 'Hi [Name]! Thanks for choosing [MyCompany]. Could you leave us a quick Google review? [ReviewLink] Thank you!'
    },
    {
      id: 'hvac_b2b_propertymanager',
      nameEs: 'Propuesta B2B para Administradores de Fincas / Inmobiliarias',
      nameEn: 'B2B Proposal for Property Managers & Landlords',
      category: 'b2b',
      whatsappTextEs: 'Estimado/a [Nombre], soy [MiNombre], técnico especialista de [MiEmpresa] en [Zona]. Atendemos el mantenimiento y reparaciones prioritarias de climatización para administradores de fincas con respuesta garantizada en <3 horas y tarifas fijas para propietarios. ¿Podríamos coordinar una llamada de 5 minutos para presentarnos?',
      whatsappTextEn: 'Hi [Name], this is [MyName] with [MyCompany] in [Area]. We provide priority HVAC maintenance and emergency repair for property managers with guaranteed <3hr dispatch and fixed transparent rates. Would you have 5 minutes for a quick intro call this week?',
      smsTextEs: '[MiEmpresa] HVAC: Servicio prioritario de reparación de climatización para administradores e inmuebles en [Zona]. Llámanos al [Telefono] para tarifas de convenio.',
      smsTextEn: '[MyCompany] HVAC: Priority maintenance & emergency service for property managers in [Area]. Call [Phone] for commercial partner rates.'
    }
  ],
  gbpPostTemplates: [
    {
      id: 'hvac_spring_tuneup_post',
      titleEs: '❄️ ¿Tu Aire Acondicionado Listo para el Calor? Puesta a Punto Preventiva',
      titleEn: '❄️ Is Your AC Ready for the Summer Heat? 21-Point Tune-Up',
      bodyEs: 'No esperes a la primera ola de calor para descubrir que tu aire no enfría. Nuestro equipo realiza inspección completa de gas refrigerante, condensadora, filtros y rendimiento energético en toda la zona de [Ciudad]. ¡Reserva hoy y asegura confort total!',
      bodyEn: "Don't wait for the first 95°F heatwave to find out your AC isn't cooling. Our licensed technicians inspect refrigerant levels, electrical components, capacitors, and airflow across [City]. Book your preventive tune-up today and keep your electric bill low!",
      ctaType: 'CALL',
      suggestedTags: ['#HVAC', '#ACRepair', '#AirConditioning', '#TuneUp', '#CoolingService']
    },
    {
      id: 'hvac_emergency_dispatch_post',
      titleEs: '🚨 Servicio de Urgencia 24/7 de Aire y Calefacción en [Ciudad]',
      titleEn: '🚨 24/7 Emergency AC & Heating Repairs in [City]',
      bodyEs: '¿Tu climatización se detuvo en mitad de la noche o en fin de semana? Nuestras unidades móviles van equipadas con compresores, ventiladores y repuestos universales para reparar tu equipo en la primera visita. Llámanos ahora.',
      bodyEn: 'Did your AC or furnace stop working in the middle of the night or over the weekend? Our service trucks carry universal capacitors, motors, and parts to fix breakdowns on the spot. Call us 24/7 for fast dispatch.',
      ctaType: 'CALL',
      suggestedTags: ['#EmergencyHVAC', '#247ACRepair', '#FurnaceRepair', '#LocalHVAC']
    },
    {
      id: 'hvac_heatpump_rebate_post',
      titleEs: '⚡ Ahorra hasta un 40% en Electricidad: Cambio a Bomba de Calor de Alta Eficiencia',
      titleEn: '⚡ Cut Energy Bills by up to 40%: High-Efficiency Heat Pump Upgrades',
      bodyEs: 'Los sistemas antiguos consumen el doble de energía. Te asesoramos sobre sustitución por bombas de calor inverter de máxima eficiencia con subvenciones y presupuestos sin compromiso.',
      bodyEn: 'Old cooling units waste hundreds on monthly electric bills. Upgrade to a modern inverter heat pump or ductless mini-split system. Ask about local energy rebates and free in-home estimates.',
      ctaType: 'BOOK',
      suggestedTags: ['#HeatPump', '#MiniSplit', '#EnergySavings', '#HVACInstallation']
    }
  ],
  quickQuotes: [
    { id: 'hvac_diag', labelEs: 'Diagnóstico en Sitio y Prueba Eléctrica', labelEn: 'On-Site Diagnostic & Electrical Test', defaultPrice: 89, unit: 'visita / visit' },
    { id: 'hvac_tuneup', labelEs: 'Puesta a Punto de Climatización 21 Puntos', labelEn: '21-Point Seasonal AC Tune-Up', defaultPrice: 129, unit: 'unidad / unit' },
    { id: 'hvac_cap_swap', labelEs: 'Sustitución de Condensador / Capacitor y Relé', labelEn: 'Dual Capacitor & Contactor Replacement', defaultPrice: 220, unit: 'reparación / repair' },
    { id: 'hvac_freon_recharge', labelEs: 'Detección de Fuga y Recarga de Refrigerante (R410A)', labelEn: 'Refrigerant Leak Test & Recharge (R410A)', defaultPrice: 340, unit: 'servicio / service' },
    { id: 'hvac_full_changeout', labelEs: 'Sustitución Completa Sistema Central / Bomba de Calor', labelEn: 'Complete Central AC / Heat Pump Replacement', defaultPrice: 6800, unit: 'instalación / install' }
  ],
  emptyStateExamples: {
    sampleBusinessName: 'Dallas Elite Heating & Air',
    sampleCity: 'Dallas, TX',
    sampleCompetitor: 'Apex Climate Pros (4.8 ★, 320 reseñas)',
    sampleLeads: [
      {
        id: 'hvac_lead_1',
        name: 'Roberto Gómez',
        phone: '+1 (214) 555-0143',
        service: 'Reparación Urgente AC (No Enfría)',
        serviceEn: 'Emergency AC Repair (Blowing Warm Air)',
        status: 'new',
        estimatedValue: 280,
        timeAgo: 'Hace 15 min',
        timeAgoEn: '15m ago',
        notes: 'Unidad exterior hace ruido y el termostato no baja de 78°F.',
        notesEn: 'Outdoor unit humming, thermostat stuck at 78°F.'
      },
      {
        id: 'hvac_lead_2',
        name: 'Carlos Mendoza - Finca Residencial',
        phone: '+1 (214) 555-0189',
        service: 'Puesta a Punto Estacional 3 Unidades',
        serviceEn: 'Seasonal Maintenance (3 Units)',
        status: 'contacted',
        estimatedValue: 390,
        timeAgo: 'Hace 2 horas',
        timeAgoEn: '2h ago',
        notes: 'Solicitó presupuesto para revisión anual antes del verano.',
        notesEn: 'Requested annual pre-summer inspection estimate.'
      },
      {
        id: 'hvac_lead_3',
        name: 'Patricia White',
        phone: '+1 (214) 555-0211',
        service: 'Presupuesto Sustitución Bomba de Calor',
        serviceEn: 'Heat Pump Replacement Estimate',
        status: 'won',
        estimatedValue: 7400,
        timeAgo: 'Ayer',
        timeAgoEn: 'Yesterday',
        notes: 'Unidad de 14 años averiada. Quiere equipo inverter de alta eficiencia.',
        notesEn: '14-year-old unit broken. Wants high-efficiency inverter.'
      }
    ],
    sampleRecentScans: [
      { name: 'Dallas Elite Heating & Air', city: 'Dallas, TX', score: 68, date: 'Hoy / Today' },
      { name: 'Apex Climate Pros', city: 'Dallas, TX', score: 91, date: 'Ayer / Yesterday' },
      { name: 'North Texas Air Conditioning', city: 'Plano, TX', score: 54, date: 'Hace 3 días / 3d ago' }
    ],
    sampleQuickQuotes: [
      { id: 'hvac_diag', labelEs: 'Diagnóstico en Sitio y Prueba Eléctrica', labelEn: 'On-Site Diagnostic & Electrical Test', defaultPrice: 89, unit: 'visita / visit' },
      { id: 'hvac_tuneup', labelEs: 'Puesta a Punto de Climatización 21 Puntos', labelEn: '21-Point Seasonal AC Tune-Up', defaultPrice: 129, unit: 'unidad / unit' },
      { id: 'hvac_cap_swap', labelEs: 'Sustitución de Condensador / Capacitor y Relé', labelEn: 'Dual Capacitor & Contactor Replacement', defaultPrice: 220, unit: 'reparación / repair' },
      { id: 'hvac_full_changeout', labelEs: 'Sustitución Completa Sistema Central / Bomba de Calor', labelEn: 'Complete Central AC / Heat Pump Replacement', defaultPrice: 6800, unit: 'instalación / install' }
    ]
  }
};
