export type EvidenceStatus = 'VERIFIED' | 'DERIVED' | 'ESTIMATED' | 'MODELED' | 'BENCHMARK' | 'INFERRED' | 'USER_PROVIDED' | 'UNVERIFIED' | 'PENDING' | 'INSUFFICIENT_DATA';

export interface BveltEvidence {
  sourceType: 'CRM' | 'BUSINESS_PROFILE' | 'GROWTH_PLAN' | 'OPPORTUNITY' | 'REPUTATION' | 'SYSTEM' | 'OSM_RADAR' | 'BENCHMARK_MODEL' | 'LIVE_SEARCH' | 'REFERENCE_DATA' | 'CACHE';
  sourceLabel: string;
  sourceId?: string | null;
  evidenceStatus: EvidenceStatus;
  confidence: number; // 0.0 to 1.0
  confidenceLevel: 'High' | 'Medium' | 'Low';
  formula?: string;
  assumptions?: string[];
  lastUpdated: string;
}

export interface EvidenceBadgeInfo {
  label: string;
  colorClass: string;
  icon: string;
  description: string;
  tier: number; // 1: REAL/VERIFIED, 2: DERIVED, 3: ESTIMATED/MODELED, 4: BENCHMARK, 5: INSUFFICIENT_DATA
}

export const EVIDENCE_BACKED_THRESHOLD = 3;

export function getEvidenceBackedBadge(
  eventCount: number,
  threshold: number = EVIDENCE_BACKED_THRESHOLD,
  t?: (es: string, en: string) => string
): EvidenceBadgeInfo {
  const tr = t || ((es: string, _en: string) => es);
  const count = typeof eventCount === 'number' && !isNaN(eventCount) ? eventCount : 0;
  const isEvidenceBacked = count >= threshold;

  if (isEvidenceBacked) {
    return {
      label: tr('Bvelt evidence-backed', 'Bvelt evidence-backed'),
      colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs font-black',
      icon: '🛡️',
      description: tr(
        `Negocio respaldado por ${count} eventos de evidencia verificada (umbral ≥ ${threshold})`,
        `Business backed by ${count} verified evidence events (threshold ≥ ${threshold})`
      ),
      tier: 1
    };
  }

  return {
    label: tr(`Construyendo evidencia (${count}/${threshold})`, `Building evidence (${count}/${threshold})`),
    colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 border-dashed font-semibold',
    icon: '⏳',
    description: tr(
      `Acumulando evidencia verificable (${count}/${threshold} eventos registrados). Bvelt requiere ≥ ${threshold} para el sello oficial.`,
      `Accumulating verifiable evidence (${count}/${threshold} logged events). Bvelt requires ≥ ${threshold} for official badge.`
    ),
    tier: 3
  };
}

export function getEvidenceBadge(
  status: EvidenceStatus | string, 
  t?: (es: string, en: string) => string
): EvidenceBadgeInfo {
  const tr = t || ((es: string, _en: string) => es);

  switch (status) {
    case 'VERIFIED':
      return { 
        label: tr('VERIFICADO EN GOOGLE', 'VERIFIED ON GOOGLE'), 
        colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs font-black', 
        icon: '✓',
        description: tr('Confirmado con datos en vivo de Google Maps y perfil verificado', 'Confirmed with live Google Maps data and verified profile records'),
        tier: 1
      };
    case 'USER_PROVIDED':
      return { 
        label: tr('TU NEGOCIO', 'YOUR BUSINESS'), 
        colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs font-black', 
        icon: '👤',
        description: tr('Dato real configurado directamente por el propietario del negocio', 'Actual figure configured directly by the business owner'),
        tier: 1
      };
    case 'DERIVED':
      return { 
        label: tr('SEÑAL DE GOOGLE MAPS', 'LOCAL MAPS SIGNAL'), 
        colorClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 font-bold', 
        icon: '↗',
        description: tr('Calculado con datos reales de competidores y búsquedas locales', 'Calculated from actual local competitor and search demand data'),
        tier: 2
      };
    case 'ESTIMATED':
    case 'INFERRED':
      return { 
        label: tr('OPORTUNIDAD ESTIMADA', 'MARKET ESTIMATE'), 
        colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 border-dashed font-semibold', 
        icon: '≈',
        description: tr('Proyección basada en volumen y brechas de tu zona', 'Projection based on local call volume and competitor gaps'),
        tier: 3
      };
    case 'MODELED':
      return { 
        label: tr('PROYECCIÓN MODELADA', 'MODELED PROJECTION'), 
        colorClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 border-dashed font-semibold', 
        icon: '◈',
        description: tr('Proyección basada en simulación o escenario hipotético', 'Scenario or simulation projection'),
        tier: 3
      };
    case 'BENCHMARK':
      return { 
        label: tr('BENCHMARK DE MERCADO', 'MARKET BENCHMARK'), 
        colorClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40 font-bold', 
        icon: '📊',
        description: tr('Basado en estadísticas oficiales del sector (Census / BLS / BEA)', 'Based on official sector statistics (Census / BLS / BEA)'),
        tier: 4
      };
    case 'INSUFFICIENT_DATA':
      return { 
        label: tr('DATOS INSUFICIENTES', 'INSUFFICIENT DATA'), 
        colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-medium', 
        icon: '⚠',
        description: tr('No hay evidencia suficiente disponible en este momento', 'Insufficient evidence available at this time'),
        tier: 5
      };
    case 'UNVERIFIED':
      return { 
        label: tr('SIN VERIFICAR', 'UNVERIFIED'), 
        colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 font-medium', 
        icon: '?',
        description: tr('Evidencia insuficiente o fuente no confirmada', 'Insufficient evidence or unconfirmed source'),
        tier: 5
      };
    case 'PENDING':
    default:
      return { 
        label: tr('PENDIENTE DE CONEXIÓN', 'CONNECTION PENDING'), 
        colorClass: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20 font-medium', 
        icon: '○',
        description: tr('Dato aún no disponible, requiere conexión o escaneo', 'Data unavailable, requires connection or scan'),
        tier: 5
      };
  }
}

export function getConfidenceBadge(
  score: number | 'High' | 'Medium' | 'Low',
  t?: (es: string, en: string) => string
): { label: string; colorClass: string; level: 'High' | 'Medium' | 'Low' } {
  const tr = t || ((es: string, _en: string) => es);
  let level: 'High' | 'Medium' | 'Low' = 'Medium';

  if (typeof score === 'string') {
    level = score;
  } else if (typeof score === 'number') {
    if (score >= 0.8) level = 'High';
    else if (score >= 0.45) level = 'Medium';
    else level = 'Low';
  }

  switch (level) {
    case 'High':
      return {
        label: tr('Confianza: Alta', 'Confidence: High'),
        colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        level: 'High'
      };
    case 'Medium':
      return {
        label: tr('Confianza: Media', 'Confidence: Medium'),
        colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        level: 'Medium'
      };
    case 'Low':
    default:
      return {
        label: tr('Confianza: Baja', 'Confidence: Low'),
        colorClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
        level: 'Low'
      };
  }
}

export function getGbpStatus(
  connected: boolean,
  isVerified: boolean,
  t?: (es: string, en: string) => string
): { status: string; label: string; colorClass: string; isFullyVerified: boolean } {
  const tr = t || ((es: string, _en: string) => es);

  if (!connected) {
    return {
      status: 'NOT_CONNECTED',
      label: tr('GOOGLE BUSINESS: SIN CONECTAR', 'GOOGLE BUSINESS: NOT CONNECTED'),
      colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
      isFullyVerified: false
    };
  }

  if (!isVerified) {
    return {
      status: 'CONNECTED_PENDING',
      label: tr('CONECTADO — VERIFICACIÓN PENDIENTE', 'CONNECTED — VERIFICATION PENDING'),
      colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      isFullyVerified: false
    };
  }

  return {
    status: 'VERIFIED',
    label: tr('GOOGLE BUSINESS: VERIFICADO', 'GOOGLE BUSINESS: VERIFIED'),
    colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black',
    isFullyVerified: true
  };
}

