import { VerticalConfig } from './types';

export const HVAC_VERTICAL_CONFIG: VerticalConfig = {
  id: 'hvac',
  name: {
    es: 'HVAC y Climatización',
    en: 'HVAC & Climate Control'
  },
  keywords: [
    'hvac', 'ac repair', 'air conditioning', 'heating', 'furnace', 'heat pump',
    'minisplit', 'mini split', 'duct cleaning', 'ductwork', 'refrigerant', 'freon',
    'climatizacion', 'aire acondicionado', 'calefaccion', 'cooling', 'ventilation',
    'hvac contractor', 'refrigeracion'
  ],
  emergencyServices: [
    '24/7 Emergency AC Outage Repair',
    'Furnace / Heating Failure in Winter Freeze',
    'Refrigerant Leak & Compressor Diagnostics',
    'Frozen Evaporator Coil Emergency Thaw',
    'Blown Capacitor & Fan Motor Replacement'
  ],
  highTicketServices: [
    'Complete Central AC & Furnace Replacement ($5,500 - $11,000)',
    'Multi-Zone Ductless Mini-Split Installation ($3,800 - $7,500)',
    'High-Efficiency Heat Pump Conversion ($6,000 - $12,500)',
    'Commercial RTU (Rooftop Unit) Maintenance & Replacement ($3,500+)'
  ],
  averageTicket: 1450,
  checklist: [
    {
      id: 'day_1',
      day: 'Día 1',
      titleEs: 'Auditoría de Palabras Clave HVAC y Posición en Maps',
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
      id: 'day_1_2',
      day: 'Día 1-2',
      titleEs: 'Activar Respuestas Rápidas para Averías y Presupuestos',
      titleEn: 'Deploy HVAC Emergency & Estimate Follow-up',
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
      id: 'day_3',
      day: 'Día 3',
      titleEs: 'Solicitar Reseña 5 Estrellas tras Servicio de Climatización',
      titleEn: 'Request 5-Star Review After Service Call',
      descEs: 'Envía el enlace pre-cargado de Google Maps al propietario justo al terminar la reparación o mantenimiento.',
      descEn: 'Send the pre-filled Google Maps review link right after finishing the repair or seasonal tune-up.',
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
      id: 'day_4_5',
      day: 'Día 4-5',
      titleEs: 'Capturar Llamadas de Competidores HVAC Lentos',
      titleEn: 'Win High-Ticket Jobs from Slow HVAC Rivals',
      descEs: 'Aprovecha competidores con demoras >24h o sin guardia de fin de semana para ganar trabajos de urgencia.',
      descEn: 'Leverage competitor delays >24h to capture emergency calls and lucrative changeout jobs.',
      actionType: 'competitor',
      actionPayload: {
        actionEs: 'Oferta de Despacho Rápido HVAC vs Competencia',
        actionEn: 'Fast HVAC Dispatch Offer vs Slow Rivals',
        whyNowEs: 'Los propietarios con calor extremo o frío no esperan: asegura el trabajo ofreciendo disponibilidad prioritaria.',
        whyNowEn: 'Homeowners in extreme heat/cold will not wait: win the job with rapid dispatch availability.',
        expectedBenefitEs: 'Cerrar trabajo de emergencia de $350 - $1,500',
        expectedBenefitEn: 'Capture $350 - $1,500 emergency job',
        destinationCode: 'CONTACT_LEAD',
        contextData: {
          leadName: 'Llamada de Zona de Alta Demanda'
        }
      },
      completed: false
    },
    {
      id: 'day_6_7',
      day: 'Día 6-7',
      titleEs: 'Activar Radar Multizona Pro para Temporada Alta ($49/mo)',
      titleEn: 'Unlock Pro Multi-Zone Seasonal Radar ($49/mo)',
      descEs: 'Desbloquea escaneos ilimitados para cubrir múltiples códigos postales en picos de calor/frío.',
      descEn: 'Unlock unlimited scans to cover multiple zip codes during summer heatwaves & winter freezes.',
      actionType: 'upgrade',
      actionPayload: {
        actionEs: 'Activar Plan Bvelt Pro HVAC',
        actionEn: 'Activate Bvelt Pro HVAC Plan',
        whyNowEs: 'Monitorea todas tus zonas de servicio sin límite diario de escaneos y automatiza presupuestos.',
        whyNowEn: 'Monitor all service zip codes with zero daily scan limits and auto estimate follow-ups.',
        expectedBenefitEs: 'Escaneos y oportunidades ilimitadas',
        expectedBenefitEn: 'Unlimited scans & opportunities',
        destinationCode: 'UPGRADE'
      },
      completed: false
    }
  ],
  diagnosisStrings: {
    unverifiedGbp: {
      problemEs: 'Ficha de Google Business HVAC sin conectar o sin sincronizar',
      problemEn: 'HVAC Google Business Profile not connected or pending sync',
      whyThisMattersEs: 'En climatización (HVAC), más del 70% de llamadas son de urgencia inmediata (sin aire en verano / sin calefacción en invierno). Sin sincronizar tu ficha oficial de Google, estas llamadas de alto ticket ($1,200+ promedio) van a los 3 primeros competidores en Maps.',
      whyThisMattersEn: 'In HVAC, over 70% of calls are high-urgency emergencies (no AC in summer heatwaves / no heat in winter). A disconnected listing loses these $1,200+ ticket emergencies to the top 3 map competitors.',
      evidenceDeepDiveEs: 'Falta de conexión OAuth con la API de Google Business Profile. Los competidores locales de climatización en tu código postal acumulan un promedio de 4.8 estrellas con respuestas activas a reseñas.',
      evidenceDeepDiveEn: 'Missing OAuth authorization with Google Business Profile API. Local HVAC rivals in your zip code average 4.8 stars with active review responses.'
    },
    unansweredReviews: {
      problemEs: (count: number) => `${count} ${count === 1 ? 'reseña de HVAC sin responder' : 'reseñas de HVAC sin responder'} en Google Maps`,
      problemEn: (count: number) => `${count} unanswered HVAC ${count === 1 ? 'review' : 'reviews'} on Google Maps`,
      whyThisMattersEs: 'Los propietarios que buscan servicios de reparación de aire y calefacción revisan cómo respondes a incidencias pasadas. Responder en <24h aumenta un 35% las llamadas entrantes para servicios de mantenimiento.',
      whyThisMattersEn: 'Homeowners searching for AC & heating repair check how you handle past service calls. Replying within 24 hours boosts incoming inbound calls by up to 35%.',
      actionTitleEs: 'Responder Reseñas de Clientes HVAC',
      actionTitleEn: 'Reply to HVAC Client Reviews'
    },
    seasonalDemand: {
      problemEs: 'Fuga de llamadas por cambio de temporada (Mantenimiento preventivo HVAC)',
      problemEn: 'Seasonal Demand Leak: Missed Pre-Season AC & Heating Tune-ups',
      whyThisMattersEs: 'El 40% de los ingresos anuales de un contratista HVAC proviene de puestas a punto de primavera/otoño que evitan averías críticas y generan contratos de reemplazo de sistemas.',
      whyThisMattersEn: '40% of annual HVAC revenue comes from pre-season spring/fall tune-ups that prevent mid-season breakdowns and trigger system replacement contracts.',
      evidenceSummaryEs: 'Demanda de mantenimiento preventivo en tu radio de servicio no capturada en tu perfil.',
      evidenceSummaryEn: 'Uncaptured seasonal maintenance demand in your primary service radius.',
      actionTitleEs: 'Lanzar Campaña de Mantenimiento Preventivo HVAC',
      actionTitleEn: 'Launch Seasonal HVAC Tune-Up Campaign',
      expectedBenefitEs: 'Captar contratos de puesta a punto ($150 - $250 c/u)',
      expectedBenefitEn: 'Capture tune-up service contracts ($150 - $250 each)'
    },
    emergencyCoverage: {
      problemEs: 'Brecha de cobertura para emergencias HVAC 24/7 en tu zona',
      problemEn: '24/7 Emergency HVAC Dispatch Gap in Core Territory',
      whyThisMattersEs: 'Las averías de fin de semana y fuera de horario comercial tienen tickets 50% superiores. Si tu ficha no refleja atención de guardia, pierdes estos trabajos frente a franquicias caras.',
      whyThisMattersEn: 'After-hours and weekend breakdown calls command 50% higher ticket values. If your listing does not signal fast emergency dispatch, clients call costly national franchises.',
      evidenceSummaryEs: 'Competidores en tu radio carecen de respuesta rápida durante emergencias de fin de semana.',
      evidenceSummaryEn: 'Competitors in your service radius lack rapid after-hours emergency response.',
      actionTitleEs: 'Activar Oferta de Guardia de Emergencia HVAC',
      actionTitleEn: 'Activate 24/7 Emergency HVAC Dispatch Response',
      expectedBenefitEs: 'Capturar llamadas de emergencia de $350 - $1,800',
      expectedBenefitEn: 'Capture $350 - $1,800 emergency service calls'
    }
  },
  quickQuotes: [
    { id: 'hvac_tuneup', labelEs: 'Mantenimiento Preventivo / Puesta a Punto AC', labelEn: 'AC / Furnace Seasonal Tune-up', defaultPrice: 149, unit: 'servicio' },
    { id: 'hvac_capacitor', labelEs: 'Cambio de Capacitor / Motor de Ventilador', labelEn: 'Capacitor & Fan Motor Repair', defaultPrice: 285, unit: 'reparación' },
    { id: 'hvac_freon', labelEs: 'Recarga de Refrigerante y Detección de Fugas', labelEn: 'Refrigerant Leak Diagnostic & Recharge', defaultPrice: 420, unit: 'servicio' },
    { id: 'hvac_system', labelEs: 'Reemplazo Completo de Sistema Central HVAC', labelEn: 'Complete Central HVAC System Replacement', defaultPrice: 6800, unit: 'instalación' }
  ],
  whatsappTemplates: [
    {
      id: 'hvac_urgent_dispatch',
      titleEs: 'Respuesta Inmediata a Avería de Aire / Calefacción',
      titleEn: 'Immediate Dispatch Response for AC / Heating Outage',
      textEs: 'Hola {{nombre}}, recibí tu solicitud de reparación HVAC. Tengo un técnico en la zona que puede revisar tu equipo hoy mismo. ¿Te va bien que pasemos entre las {{hora}}?',
      textEn: 'Hi {{nombre}}, received your HVAC repair request. We have a technician nearby available to inspect your system today. Would {{hora}} work for you?'
    },
    {
      id: 'hvac_post_service_review',
      titleEs: 'Solicitud de Reseña tras Reparación de Climatización',
      titleEn: 'Review Request After HVAC Repair / Tune-Up',
      textEs: 'Hola {{nombre}}, un placer haber dejado tu sistema funcionando al 100%. ¿Podrías dejarnos una breve reseña de 5 estrellas en Google? Nos ayuda mucho: {{link}} ¡Gracias!',
      textEn: 'Hi {{nombre}}, glad we got your system running at 100%! Could you drop us a quick 5-star review on Google? It really helps our local team: {{link}} Thank you!'
    }
  ]
};
