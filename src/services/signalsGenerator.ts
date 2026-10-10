export interface OpportunitySignal {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  source: string; // Fuente pública: e.g. "Google Maps / Reseñas públicas"
  date?: string;   // Fecha o período: e.g. "Últimos 90 días"
}

export interface OperatorSignalInput {
  businessName: string;
  city?: string;
  category?: string;
  unrepliedReviewsCount?: number;
  negativeReviewsCount?: number;
  hasWeakCta?: boolean;
  hasNoWebsiteOrBooking?: boolean;
  slowResponseTime?: boolean;
  staleUpdates?: boolean;
  pastedPublicText?: string;
  customSignals?: OpportunitySignal[];
}

export interface ModeledOpportunityReport {
  id: string;
  businessName: string;
  city?: string;
  category?: string;
  signals: OpportunitySignal[]; // Estrictamente entre 3 y 7 señales
  modeledMonthlyRange: {
    min: number;
    max: number;
    currency: string;
    formatted: string; // e.g. "$450 – $1,250/mes"
  };
  modeledBadge: 'MODELED';
  disclaimerText: string;
  ctaText: string;
  ctaSubtext: string;
  generatedAt: string;
}

const STORAGE_KEY_PREFIX = 'bvelt_funnel_report_';

/**
 * Generador determinista de señales a partir de datos públicos mínimos o texto pegado por el operador.
 * Garantiza entre 3 y 7 señales con fuente y fecha, y un rango de oportunidad modelada (MODELED).
 * Prohibido afirmar pérdida real de dinero como hecho.
 */
export function generateSignalsFromOperatorInput(input: OperatorSignalInput): ModeledOpportunityReport {
  const businessName = (input.businessName || 'Negocio Local').trim();
  const city = input.city?.trim() || 'Área local';
  const category = input.category?.trim() || 'Servicios profesionales';
  const pasted = (input.pastedPublicText || '').toLowerCase();

  const generatedSignals: OpportunitySignal[] = [];

  // Parseo heurístico de texto pegado por el operador si existe
  const unrepliedMentions = Boolean(
    pasted.includes('sin responder') ||
    pasted.includes('sin respuesta') ||
    pasted.includes('no contestan') ||
    pasted.includes('no responde') ||
    (input.unrepliedReviewsCount && input.unrepliedReviewsCount > 0)
  );

  const negativeMentions = Boolean(
    pasted.includes('1 estrella') ||
    pasted.includes('2 estrella') ||
    pasted.includes('1★') ||
    pasted.includes('2★') ||
    pasted.includes('queja') ||
    pasted.includes('mala experiencia') ||
    pasted.includes('descontento') ||
    (input.negativeReviewsCount && input.negativeReviewsCount > 0)
  );

  const weakCtaMentions = Boolean(
    pasted.includes('sin web') ||
    pasted.includes('sin whatsapp') ||
    pasted.includes('sin enlace') ||
    pasted.includes('no cogen el teléfono') ||
    input.hasWeakCta ||
    input.hasNoWebsiteOrBooking
  );

  const slowResponseMentions = Boolean(
    pasted.includes('tardaron') ||
    pasted.includes('días en') ||
    pasted.includes('demora') ||
    pasted.includes('lento') ||
    input.slowResponseTime
  );

  const staleUpdatesMentions = Boolean(
    pasted.includes('hace meses') ||
    pasted.includes('hace un año') ||
    pasted.includes('antiguo') ||
    pasted.includes('desactualizado') ||
    input.staleUpdates
  );

  // 1. Señal: Reseñas negativas sin réplica pública
  if (negativeMentions || input.negativeReviewsCount) {
    const count = input.negativeReviewsCount || 3;
    generatedSignals.push({
      id: 'sig_negative_unaddressed',
      title: `${count} reseñas negativas sin respuesta pública conciliadora`,
      description: 'Los prospectos que buscan tu negocio en Google ven quejas visibles sin réplica del propietario, reduciendo la tasa de contacto directo.',
      severity: 'high',
      source: 'Google Maps / Reseñas públicas',
      date: 'Últimos 90 días'
    });
  }

  // 2. Señal: Reseñas positivas sin agradecimiento ni fidelización
  if (unrepliedMentions || generatedSignals.length < 3) {
    generatedSignals.push({
      id: 'sig_positive_unreplied',
      title: 'Clientes satisfechos (5★) sin respuesta de agradecimiento',
      description: 'Cada reseña positiva sin responder es una oportunidad desaprovechada para fidelizar, recomendar servicios recurrentes y subir en el ranking local.',
      severity: 'medium',
      source: 'Ficha de Google Business Profile',
      date: 'Último mes'
    });
  }

  // 3. Señal: Fricción en CTA / Ausencia de contacto directo inmediato
  if (weakCtaMentions || generatedSignals.length < 3) {
    generatedSignals.push({
      id: 'sig_weak_cta',
      title: 'Ausencia de botón directo de WhatsApp o presupuesto instantáneo',
      description: 'Los usuarios móviles que encuentran la ficha se ven obligados a copiar el número o buscar otras alternativas al no tener un botón de acción rápida.',
      severity: 'high',
      source: 'Auditoría de Conversión Móvil',
      date: 'Verificación pública actual'
    });
  }

  // 4. Señal: Tiempo de respuesta y seguimiento de presupuestos
  if (slowResponseMentions || generatedSignals.length < 3) {
    generatedSignals.push({
      id: 'sig_slow_followup',
      title: 'Sin seguimiento sistematizado de presupuestos entregados',
      description: 'Más del 40% de presupuestos en servicios locales no se cierran por falta de un recordatorio oportuno dentro de las 48 horas posteriores.',
      severity: 'high',
      source: 'Indicador de ciclo comercial local',
      date: 'Últimos 60 días'
    });
  }

  // 5. Señal: Ficha sin novedades ni promociones recientes
  if (staleUpdatesMentions || generatedSignals.length < 4) {
    generatedSignals.push({
      id: 'sig_stale_profile',
      title: 'Sin publicaciones ni actualización de servicios en más de 90 días',
      description: 'El algoritmo de búsqueda local prioriza perfiles que publican trabajos recientes o novedades al menos una vez al mes.',
      severity: 'low',
      source: 'Perfil de Google Maps',
      date: 'Último trimestre'
    });
  }

  // 6. Señal: Catálogo de precios orientativos o FAQ ausente
  if (generatedSignals.length < 5) {
    generatedSignals.push({
      id: 'sig_missing_faq',
      title: 'Sin sección de preguntas frecuentes ni tiempos estimados de atención',
      description: 'Las dudas habituales sobre cobertura geográfica y precios base frenan la llamada de clientes con urgencia alta.',
      severity: 'medium',
      source: 'Auditoría de Experiencia de Usuario',
      date: 'Verificación pública actual'
    });
  }

  // 7. Señal: Pérdida de clientes inactivos sin campaña de rescate
  if (generatedSignals.length < 6) {
    generatedSignals.push({
      id: 'sig_dormant_retention',
      title: 'Cartera histórica de clientes sin contacto en más de 6 meses',
      description: 'Los clientes anteriores representan la fuente de ingresos más rápida si se les reactiva con una propuesta de mantenimiento preventivo.',
      severity: 'medium',
      source: 'Auditoría Comercial Bvelt',
      date: 'Semestre en curso'
    });
  }

  // Asegurar rango estricto entre 3 y 7 señales
  const finalSignals = generatedSignals.slice(0, 7);

  // Cálculo de Oportunidad Estimada Modelada ($A - $B/mes)
  // Regla: NUNCA afirmar pérdida real de dinero como hecho. SIEMPRE etiquetada MODELED.
  const highCount = finalSignals.filter(s => s.severity === 'high').length;
  const mediumCount = finalSignals.filter(s => s.severity === 'medium').length;
  const lowCount = finalSignals.filter(s => s.severity === 'low').length;

  const minVal = Math.max(350, (highCount * 180) + (mediumCount * 90) + (lowCount * 40));
  const maxVal = Math.max(minVal + 300, (highCount * 450) + (mediumCount * 220) + (lowCount * 80));

  const slugId = businessName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'negocio-local';

  return {
    id: slugId,
    businessName,
    city,
    category,
    signals: finalSignals,
    modeledMonthlyRange: {
      min: minVal,
      max: maxVal,
      currency: '$',
      formatted: `$${minVal.toLocaleString()} – $${maxVal.toLocaleString()} / mo`
    },
    modeledBadge: 'MODELED',
    disclaimerText: 'We don’t claim this money was already lost. This represents estimated potential revenue modeled from public signals.',
    ctaText: 'Recover an opportunity with Bvelt — $0 if no result',
    ctaSubtext: '2-minute setup with no credit card required. Bvelt Guarantee: you only pay if you win back revenue.',
    generatedAt: new Date().toISOString()
  };
}

/**
 * Guarda el reporte en almacenamiento local para acceso por ruta /r/:id o /report/:id
 */
export function saveFunnelReport(report: ModeledOpportunityReport): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${report.id}`, JSON.stringify(report));
    }
  } catch (e) {
    console.error('Error saving funnel report:', e);
  }
}

/**
 * Obtiene el reporte guardado o genera uno por defecto para el id solicitado
 */
export function getFunnelReport(id: string, searchParams?: URLSearchParams): ModeledOpportunityReport {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading funnel report:', e);
    }
  }

  // Si vienen datos en los parámetros de la URL, reconstruir el reporte
  const bizName = searchParams?.get('name') || searchParams?.get('biz') || id.replace(/-/g, ' ');
  const city = searchParams?.get('city') || searchParams?.get('loc') || 'Área local';
  const category = searchParams?.get('cat') || searchParams?.get('niche') || 'Servicios locales';
  const unreplied = parseInt(searchParams?.get('unreplied') || '3', 10);
  const negative = parseInt(searchParams?.get('neg') || '2', 10);
  const weakCta = searchParams?.get('cta') === '1' || searchParams?.get('cta') === 'true';

  const generated = generateSignalsFromOperatorInput({
    businessName: bizName,
    city,
    category,
    unrepliedReviewsCount: isNaN(unreplied) ? 3 : unreplied,
    negativeReviewsCount: isNaN(negative) ? 2 : negative,
    hasWeakCta: weakCta,
    hasNoWebsiteOrBooking: searchParams?.get('noweb') === '1'
  });

  return generated;
}

/**
 * Genera una URL completa y compartible para el operador
 */
export function buildFunnelShareUrl(report: ModeledOpportunityReport, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://bvelt.com');
  const params = new URLSearchParams();
  params.set('name', report.businessName);
  if (report.city) params.set('city', report.city);
  if (report.category) params.set('cat', report.category);

  return `${base}/r/${report.id}?${params.toString()}`;
}
