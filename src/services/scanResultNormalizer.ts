/**
 * Scan Result Normalizer (Single module used by Dashboard + Battle + Golden Path)
 * 
 * Inputs: competitors[], gbp signals, reviews signals, errors[], radiusKm, profile, lang
 * Outputs: { status: 'ok' | 'sparse' | 'failed', summaryLines[3], drivers[3], actions[3], evidenceBadge, lastCalibrated, topCompetitors, remainingCompetitors, retryOptions }
 * 
 * Rules:
 * - If errors.length > 0 (provider failure): status = 'failed'; emit 3 offline-capable actions.
 * - If competitors.length === 0: status = 'sparse'; explain no direct competitors found; auto-offer one-tap retry at 10km and 25km.
 * - If ok: keep top 3 competitors only in UI default; advanced list collapsed.
 * - Caching: TTL cache keyed by uid + trade + geohash + radius.
 */

import { BusinessDnaService } from '../knowledge/memory/businessDnaService';

export type ScanState = 'fresh' | 'cached' | 'empty' | 'degraded' | 'action_required';
export type DegradedReason = 'quota' | 'timeout' | 'route' | 'provider' | null;

export interface NormalizedScanAction {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  targetTab: string;
  targetSubRow?: number;
  badge?: string;
  badgeColor?: string;
  icon?: string;
  isOfflineCapable?: boolean;
  priorityScore?: number;
  payload?: any;
}

export interface ScanNormalizerInput {
  competitors?: any[] | null;
  gbpSignals?: {
    connected?: boolean;
    verified?: boolean;
    hasPhotos?: boolean;
    hasDescription?: boolean;
    categories?: string[];
    [key: string]: any;
  } | null;
  reviewsSignals?: {
    rating?: number | null;
    totalReviews?: number | null;
    unansweredCount?: number;
    recentCount?: number;
    [key: string]: any;
  } | null;
  errors?: string[] | null;
  radiusKm: number;
  profile?: any;
  language?: string;
  timestamp?: number | string;
  userCoords?: { lat: number; lon: number } | null;
  trade?: string;
  uid?: string;
  isCached?: boolean;
  cacheTimestamp?: number;
  forceDegradedReason?: DegradedReason;
}

export interface NormalizedScanResult {
  status: 'ok' | 'sparse' | 'failed';
  scanState: ScanState;
  degradedReason?: DegradedReason;
  isCached?: boolean;
  cacheAgeText?: string;
  userMessage: string;
  summaryLines: [string, string, string];
  drivers: [string, string, string];
  actions: [NormalizedScanAction, NormalizedScanAction, NormalizedScanAction];
  evidenceBadge: string;
  lastCalibrated: string;
  lastCalibratedTimestamp: number;
  radiusKm: number;
  competitorsCount: number;
  topCompetitors: any[];
  remainingCompetitors: any[];
  retryOptions?: number[];
  cacheKey?: string;
}

// ==========================================
// PURE GEOHASH ENCODING (Base32, 4-char ~20km)
// ==========================================
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function computeGeohash(lat: number, lon: number, precision: number = 4): string {
  if (isNaN(lat) || isNaN(lon)) return '0000';

  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  let geohash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch |= 1 << (4 - bit);
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

export interface WinLoseReason {
  type: 'win' | 'lose' | 'neutral';
  reason: string;
}

/**
 * Computes a plain-language explanation of why a competitor wins or loses against the user.
 */
export function computeCompetitorWinLoseReason(
  comp: {
    name?: string;
    reviewsCount?: number | null;
    reviews?: number | null;
    rating?: number | null;
    website?: string | boolean | null;
    isClaimed?: boolean;
    distanceKm?: number | null;
  },
  user: {
    reviewsCount?: number | null;
    rating?: number | null;
    website?: string | boolean | null;
    isClaimed?: boolean;
  } | null | undefined,
  lang: string = 'es'
): WinLoseReason {
  const isEn = lang === 'en';
  const compReviews = comp.reviewsCount ?? comp.reviews ?? 0;
  const userReviews = user?.reviewsCount ?? 0;
  const compRating = comp.rating ?? 0;
  const userRating = user?.rating ?? 0;
  const compHasWeb = Boolean(comp.website && String(comp.website).trim().length > 3);
  const userHasWeb = Boolean(user?.website && String(user?.website).trim().length > 3);

  // 1. Check Review volume gap (most critical local factor)
  if (compReviews > userReviews && compReviews > 5) {
    const diff = compReviews - userReviews;
    return {
      type: 'win',
      reason: isEn
        ? `Leading in review volume (+${diff} reviews vs you) — captures more local clicks.`
        : `Gana en volumen de reseñas (+${diff} opiniones frente a ti) — capta más clics locales.`
    };
  }

  // 2. User has higher rating vs competitor
  if (userRating > 0 && compRating > 0 && userRating > compRating + 0.2) {
    return {
      type: 'lose',
      reason: isEn
        ? `Losing on rating (★${compRating.toFixed(1)} vs your ★${userRating.toFixed(1)}) — your customer trust is higher.`
        : `Pierde en calificación (★${compRating.toFixed(1)} frente a tu ★${userRating.toFixed(1)}) — tu reputación es superior.`
    };
  }

  // 3. User has website but competitor does not
  if (userHasWeb && !compHasWeb) {
    return {
      type: 'lose',
      reason: isEn
        ? `Losing with no direct website — visitors cannot request online quotes or view portfolio.`
        : `Pierde al no tener sitio web — los clientes no pueden cotizar en línea ni ver trabajos.`
    };
  }

  // 4. Competitor has website but user does not
  if (!userHasWeb && compHasWeb) {
    return {
      type: 'win',
      reason: isEn
        ? `Winning on web presence — offers an online booking & instant quoting path.`
        : `Gana en presencia web — ofrece vía directa para cotizar presupuestos.`
    };
  }

  // 5. Competitor has lower review count
  if (userReviews > compReviews && userReviews > 0) {
    const diff = userReviews - compReviews;
    return {
      type: 'lose',
      reason: isEn
        ? `Losing in review count (-${diff} reviews vs you) — your social proof is stronger.`
        : `Pierde en número de reseñas (-${diff} frente a ti) — tu prueba social es más sólida.`
    };
  }

  // 6. Proximity / Location
  if (typeof comp.distanceKm === 'number' && comp.distanceKm <= 1.5) {
    return {
      type: 'win',
      reason: isEn
        ? `High proximity hub (${comp.distanceKm.toFixed(1)} km) — competes for nearby searches.`
        : `Alta proximidad (${comp.distanceKm.toFixed(1)} km) — compite por búsquedas inmediatas.`
    };
  }

  // Default balanced reason
  return {
    type: 'neutral',
    reason: isEn
      ? `Active local competitor in your service radius with comparable rating.`
      : `Competidor local activo en tu radio de servicio con calificación similar.`
  };
}

/**
 * Generates a clean, privacy-safe text snapshot summary of the battle / scan report.
 * Strictly excludes any private leads, client phone numbers, or confidential data.
 */
export function generateSafeMarketSnapshotText({
  businessName,
  city,
  healthScore,
  summaryLines,
  drivers,
  topCompetitors,
  actions,
  lang = 'es'
}: {
  businessName: string;
  city: string;
  healthScore?: number | null;
  summaryLines?: string[];
  drivers?: string[];
  topCompetitors?: Array<{ name: string; rating?: number | null; reviews?: number | null; winLoseReason?: string }>;
  actions?: Array<{ title: string; actionLabel?: string }>;
  lang?: string;
}): string {
  const isEn = lang === 'en';
  const dateStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'es-ES', { dateStyle: 'medium' });

  let text = `📍 ${isEn ? 'BVELT LOCAL VISIBILITY SNAPSHOT' : 'BVELT RESUMEN DE VISIBILIDAD LOCAL'}\n`;
  text += `${isEn ? 'Business' : 'Negocio'}: ${businessName}\n`;
  text += `${isEn ? 'Market Area' : 'Zona'}: ${city}\n`;
  text += `${isEn ? 'Date' : 'Fecha'}: ${dateStr}\n`;
  if (healthScore) {
    text += `${isEn ? 'Health Score' : 'Puntaje de Salud Local'}: ${healthScore}%\n`;
  }
  text += `\n`;

  if (summaryLines && summaryLines.length > 0) {
    text += `📊 ${isEn ? 'MARKET CONCLUSIONS' : 'CONCLUSIONES DE MERCADO'}:\n`;
    summaryLines.forEach((line) => {
      text += `• ${line}\n`;
    });
    text += `\n`;
  }

  if (topCompetitors && topCompetitors.length > 0) {
    text += `⚔️ ${isEn ? 'BENCHMARK (TOP COMPETITORS)' : 'BENCHMARK (COMPETIDORES PRINCIPALES)'}:\n`;
    topCompetitors.slice(0, 3).forEach((comp, idx) => {
      const rating = comp.rating ? `★${Number(comp.rating).toFixed(1)}` : (isEn ? 'No rating' : 'Sin calif.');
      const reviews = comp.reviews !== undefined && comp.reviews !== null ? `${comp.reviews} ${isEn ? 'reviews' : 'reseñas'}` : (isEn ? 'No reviews' : 'Sin reseñas');
      text += `${idx + 1}. ${comp.name} (${rating}, ${reviews})\n`;
      if (comp.winLoseReason) {
        text += `   ↳ ${comp.winLoseReason}\n`;
      }
    });
    text += `\n`;
  }

  if (drivers && drivers.length > 0) {
    text += `🎯 ${isEn ? 'KEY GROWTH DRIVERS' : 'PILARES CLAVE DE RENDIMIENTO'}:\n`;
    drivers.forEach((drv) => {
      text += `• ${drv}\n`;
    });
    text += `\n`;
  }

  if (actions && actions.length > 0) {
    text += `⚡ ${isEn ? 'RECOMMENDED ACTIONS' : 'ACCIONES RECOMENDADAS'}:\n`;
    actions.slice(0, 3).forEach((act, idx) => {
      text += `${idx + 1}. ${act.title}\n`;
    });
    text += `\n`;
  }

  text += `🔒 ${isEn ? 'Verified with public local indicators. Directional estimate.' : 'Verificado con indicadores públicos locales. Estimación orientativa.'}\n`;
  text += `Generated by Bvelt Local Engine`;

  return text;
}
export function getScanNormalizerCacheKey(params: {
  uid?: string;
  trade?: string;
  lat?: number;
  lon?: number;
  radiusKm: number;
}): string {
  const safeUid = (params.uid || 'anon').trim().toLowerCase();
  const safeTrade = (params.trade || 'general').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const geohash = (typeof params.lat === 'number' && typeof params.lon === 'number' && !isNaN(params.lat) && !isNaN(params.lon))
    ? computeGeohash(params.lat, params.lon, 4)
    : 'grid0';
  const radius = Math.round(params.radiusKm || 5);

  return `bvelt_scan_norm_${safeUid}_${safeTrade}_${geohash}_${radius}km`;
}

// ==========================================
// LOCAL STORAGE TTL CACHE (Default 15 min)
// ==========================================
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getCachedNormalizedScan(cacheKey: string): NormalizedScanResult | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.expiresAt || !parsed.result) return null;

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return parsed.result as NormalizedScanResult;
  } catch (err) {
    return null;
  }
}

export function setCachedNormalizedScan(cacheKey: string, result: NormalizedScanResult, ttlMs: number = DEFAULT_TTL_MS): void {
  try {
    const payload = {
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
      result
    };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch (err) {
    // ignore quota errors
  }
}

// Helper for formatted "Last calibrated: [time]"
export function formatLastCalibrated(timestamp: number | string, lang: string = 'es'): string {
  const isEn = lang === 'en';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(date.getTime())) {
    return isEn ? 'Last calibrated: Just now' : 'Última calibración: Reciente';
  }

  const timeStr = date.toLocaleTimeString(isEn ? 'en-US' : 'es-ES', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: isEn
  });

  return isEn ? `Last calibrated: ${timeStr}` : `Última calibración: ${timeStr}`;
}

// Helper for formatted "updated X ago"
export function formatCacheAge(timestamp: number, lang: string = 'es'): string {
  const isEn = lang === 'en';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) {
    return isEn ? 'updated just now' : 'actualizado hace un momento';
  }
  if (diffMins < 60) {
    return isEn ? `updated ${diffMins} min ago` : `actualizado hace ${diffMins} min`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return isEn
      ? `updated ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
      : `actualizado hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return isEn
    ? `updated ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    : `actualizado hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
}

export function computeScanStateAndUserMessage(input: {
  hasLocation: boolean;
  competitorsCount: number;
  errors?: string[] | null;
  isCached?: boolean;
  cacheTimestamp?: number;
  forceDegradedReason?: DegradedReason;
  locationName: string;
  radiusKm: number;
  lang?: string;
}): {
  scanState: ScanState;
  degradedReason: DegradedReason;
  isCached: boolean;
  cacheAgeText: string;
  userMessage: string;
  evidenceBadge: string;
} {
  const isEn = input.lang === 'en';
  const errors = Array.isArray(input.errors) ? input.errors.filter(Boolean) : [];
  
  // Check URL query param for easy testing in 1 step: ?forceDegraded=quota|timeout|route|provider or ?degraded=true
  let forcedReason = input.forceDegradedReason || null;
  if (!forcedReason && typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const param = urlParams.get('forceDegraded') || urlParams.get('degraded');
      if (param && ['quota', 'timeout', 'route', 'provider'].includes(param)) {
        forcedReason = param as DegradedReason;
      } else if (param === 'true' || param === '1') {
        forcedReason = 'provider';
      }
    } catch {}
  }

  let scanState: ScanState = 'fresh';
  let degradedReason: DegradedReason = forcedReason;
  let isCached = Boolean(input.isCached);
  let cacheAgeText = '';

  if (input.cacheTimestamp) {
    cacheAgeText = formatCacheAge(input.cacheTimestamp, input.lang);
  } else if (isCached) {
    cacheAgeText = isEn ? 'updated recently' : 'actualizado recientemente';
  }

  // 1. ACTION_REQUIRED: Missing essential location or coordinates
  if (!input.hasLocation) {
    scanState = 'action_required';
    return {
      scanState,
      degradedReason: null,
      isCached: false,
      cacheAgeText: '',
      userMessage: isEn
        ? 'Action required: Set your business city or GPS location to enable market scan.'
        : 'Acción requerida: Configura la ciudad o ubicación GPS de tu negocio para activar el escaneo de mercado.',
      evidenceBadge: isEn ? 'ACTION REQUIRED • LOCATION' : 'ACCIÓN REQUERIDA • UBICACIÓN'
    };
  }

  // 2. DEGRADED: Provider errors or forced degraded testing state
  if (errors.length > 0 || forcedReason !== null) {
    scanState = 'degraded';
    const errText = (errors.join(' ') + ' ' + (forcedReason || '')).toLowerCase();

    if (!degradedReason) {
      if (errText.includes('quota') || errText.includes('429') || errText.includes('limit')) {
        degradedReason = 'quota';
      } else if (errText.includes('timeout') || errText.includes('504') || errText.includes('slow')) {
        degradedReason = 'timeout';
      } else if (errText.includes('route') || errText.includes('isochrone') || errText.includes('osrm')) {
        degradedReason = 'route';
      } else {
        degradedReason = 'provider';
      }
    }

    const reasonDescMap = {
      quota: isEn ? 'límite de cuota alcanzado' : 'límite de cuota alcanzado',
      timeout: isEn ? 'tiempo de respuesta agotado' : 'tiempo de respuesta agotado',
      route: isEn ? 'servicio de rutas degradado' : 'servicio de rutas degradado',
      provider: isEn ? 'proveedor de mapas no disponible' : 'proveedor de mapas no disponible'
    };

    const reasonDesc = reasonDescMap[degradedReason] || reasonDescMap.provider;

    let userMsg = '';
    if (isCached && cacheAgeText) {
      userMsg = isEn
        ? `Map provider degraded (${reasonDesc}). Showing cached market data (${cacheAgeText}).`
        : `Proveedor de mapas degradado (${reasonDesc}). Mostrando datos en caché (${cacheAgeText}).`;
    } else {
      userMsg = isEn
        ? `Map service temporarily degraded (${reasonDesc}). Network/API connection issue.`
        : `Fallo de red/API del proveedor de mapas (${reasonDesc}). Operando en modo de contingencia.`;
    }

    return {
      scanState,
      degradedReason,
      isCached,
      cacheAgeText,
      userMessage: userMsg,
      evidenceBadge: isEn ? `DEGRADED • ${degradedReason.toUpperCase()}` : `DEGRADADO • ${degradedReason.toUpperCase()}`
    };
  }

  // 3. EMPTY (no_results)
  if (input.competitorsCount === 0) {
    scanState = 'empty';
    return {
      scanState,
      degradedReason: null,
      isCached,
      cacheAgeText,
      userMessage: isEn
        ? `0 competitors in radius ${input.radiusKm} km — try 10 or 25 km.`
        : `0 en radio ${input.radiusKm} km — prueba ${input.radiusKm < 10 ? '10' : '25'} km.`,
      evidenceBadge: isEn ? 'NO RESULTS • SPARSE' : 'SIN RESULTADOS • RADIO'
    };
  }

  // 4. CACHED
  if (isCached) {
    scanState = 'cached';
    return {
      scanState,
      degradedReason: null,
      isCached: true,
      cacheAgeText,
      userMessage: isEn
        ? `Market signals loaded from cache (${cacheAgeText}).`
        : `Señales de mercado cargadas desde caché (${cacheAgeText}).`,
      evidenceBadge: isEn ? `CACHED • ${cacheAgeText}` : `EN CACHÉ • ${cacheAgeText}`
    };
  }

  // 5. FRESH
  scanState = 'fresh';
  return {
    scanState,
    degradedReason: null,
    isCached: false,
    cacheAgeText: '',
    userMessage: isEn
      ? 'Live market radar signals updated in real time.'
      : 'Señales del radar de mercado actualizadas en tiempo real.',
    evidenceBadge: isEn ? 'LIVE • VERIFIED' : 'EN VIVO • VERIFICADO'
  };
}

// ==========================================
// CORE NORMALIZER FUNCTION (Pure function)
// ==========================================
export function normalizeScanResult(input: ScanNormalizerInput): NormalizedScanResult {
  const isEn = input.language === 'en';
  const radius = Math.max(1, Math.round(input.radiusKm || 5));
  const rawCompetitors = Array.isArray(input.competitors) ? input.competitors : [];
  const errors = Array.isArray(input.errors) ? input.errors.filter(Boolean) : [];
  const gbp = input.gbpSignals || {};
  const reviews = input.reviewsSignals || {};
  const location = input.profile?.location || input.profile?.city || (isEn ? 'your area' : 'tu zona');
  const trade = input.trade || input.profile?.category || input.profile?.niche || (isEn ? 'local business' : 'servicio local');

  const ts = typeof input.timestamp === 'number' ? input.timestamp : Date.now();
  const lastCalibrated = formatLastCalibrated(ts, input.language);

  // Compute Cache Key
  const coords = input.userCoords || (input.profile?.coords ? { lat: input.profile.coords.lat, lon: input.profile.coords.lng || input.profile.coords.lon } : null);
  const cacheKey = getScanNormalizerCacheKey({
    uid: input.uid || input.profile?.id,
    trade,
    lat: coords?.lat,
    lon: coords?.lon,
    radiusKm: radius
  });

  const stateInfo = computeScanStateAndUserMessage({
    hasLocation: Boolean(coords || input.profile?.location || input.profile?.city),
    competitorsCount: rawCompetitors.length,
    errors,
    isCached: input.isCached,
    cacheTimestamp: input.cacheTimestamp,
    forceDegradedReason: input.forceDegradedReason,
    locationName: location,
    radiusKm: radius,
    lang: input.language
  });

  // ----------------------------------------------------
  // CASE 1: PROVIDER ERROR (status = 'failed')
  // Still emit 3 offline-capable actions that do not need scan!
  // ----------------------------------------------------
  if (errors.length > 0) {
    const summaryLines: [string, string, string] = [
      isEn
        ? `External map provider temporarily degraded in ${location} — system operating in resilient offline mode.`
        : `Proveedor de mapas degradado temporalmente en ${location} — sistema operando en modo offline resiliente.`,
      isEn
        ? `Live competitor signals could not be refreshed, but your local conversion assets remain 100% active.`
        : `No se pudieron refrescar señales de competidores en vivo, pero tus herramientas de conversión están 100% activas.`,
      isEn
        ? `Prescribed action: complete core foundational tasks (GBP photo checklist, review outreach, manual lead logging).`
        : `Acción prescrita: completa tareas fundamentales de base (checklist de fotos GBP, solicitud de reseñas, registro de leads).`
    ];

    const drivers: [string, string, string] = [
      isEn
        ? 'High-resolution job photos build immediate customer trust even when external radars are calibrating.'
        : 'Fotos de trabajos en alta resolución construyen confianza inmediata mientras el radar se recalibra.',
      isEn
        ? 'Direct review requests generate verified Google reputation independently from search algorithms.'
        : 'Las solicitudes directas de reseñas generan reputación verificada independientemente del algoritmo.',
      isEn
        ? 'Logging all inbound inquiries in your CRM guarantees no lucrative job is forgotten.'
        : 'Registrar todas las consultas en tu CRM asegura que ningún trabajo cotizado quede sin seguimiento.'
    ];

    const actions: [NormalizedScanAction, NormalizedScanAction, NormalizedScanAction] = [
      {
        id: 'offline_gbp_photos',
        title: isEn ? 'GBP High-Impact Photo Checklist' : 'Checklist de Fotos Reales para GBP',
        description: isEn
          ? 'Upload high-resolution photos of recent completed jobs, work vehicles, and team on site.'
          : 'Sube fotos en alta resolución de trabajos terminados, vehículos rotulados y equipo en acción.',
        actionLabel: isEn ? 'Open Photo Checklist' : 'Ver Checklist de Fotos',
        targetTab: 'checklist',
        targetSubRow: 0,
        badge: isEn ? 'OFFLINE • ASSET' : 'OFFLINE • ACTIVO',
        badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        icon: 'camera',
        isOfflineCapable: true,
        priorityScore: 92
      },
      {
        id: 'offline_review_request',
        title: isEn ? 'Send 5 Review Requests to Past Clients' : 'Enviar 5 Solicitudes de Reseñas a Clientes',
        description: isEn
          ? 'Use pre-formatted WhatsApp & SMS templates to capture authentic 5-star Google feedback.'
          : 'Usa plantillas directas de WhatsApp y SMS para conseguir reseñas reales de 5 estrellas en Google.',
        actionLabel: isEn ? 'Get Review Template' : 'Obtener Plantilla de Reseñas',
        targetTab: 'reviews',
        targetSubRow: 0,
        badge: isEn ? 'OFFLINE • REPUTATION' : 'OFFLINE • REPUTACIÓN',
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        icon: 'star',
        isOfflineCapable: true,
        priorityScore: 88
      },
      {
        id: 'offline_manual_lead',
        title: isEn ? 'Log & Track Active Inquiries in CRM' : 'Registrar y Seguir Consultas en CRM',
        description: isEn
          ? 'Enter phone calls, direct quotes, and prospective client inquiries directly into your pipeline.'
          : 'Introduce llamadas, presupuestos entregados y nuevos prospectos en tu bandeja comercial.',
        actionLabel: isEn ? 'Log New Lead' : 'Añadir Lead a CRM',
        targetTab: 'leads',
        targetSubRow: 4,
        badge: isEn ? 'OFFLINE • PIPELINE' : 'OFFLINE • PIPELINE',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: 'users',
        isOfflineCapable: true,
        priorityScore: 85
      }
    ];

    return {
      status: 'failed',
      scanState: stateInfo.scanState,
      degradedReason: stateInfo.degradedReason,
      isCached: stateInfo.isCached,
      cacheAgeText: stateInfo.cacheAgeText,
      userMessage: stateInfo.userMessage,
      summaryLines,
      drivers,
      actions,
      evidenceBadge: stateInfo.evidenceBadge,
      lastCalibrated,
      lastCalibratedTimestamp: ts,
      radiusKm: radius,
      competitorsCount: 0,
      topCompetitors: [],
      remainingCompetitors: [],
      cacheKey
    };
  }

  // ----------------------------------------------------
  // CASE 2: ZERO COMPETITORS (status = 'sparse')
  // Auto-offer one-tap "Retry at 10 km" and "Retry at 25 km"
  // ----------------------------------------------------
  if (rawCompetitors.length === 0) {
    const summaryLines: [string, string, string] = [
      isEn
        ? `No direct competitors found in ${radius} km — expand radius or verify category/city.`
        : `No se encontraron competidores directos en ${radius} km — amplía el radio o verifica categoría/ciudad.`,
      isEn
        ? `Quiet local market or sparse map nodes detected in ${location}. You have an open field to claim #1 visibility.`
        : `Zona local despejada o datos dispersos en ${location}. Tienes campo abierto para consolidar el puesto #1.`,
      isEn
        ? `Prescribed action: expand radar radius to 10 km or 25 km to benchmark neighboring hubs, and verify local search terms.`
        : `Acción prescrita: amplía el radar a 10 km o 25 km para calibrar zonas vecinas y verifica tus términos de búsqueda.`
    ];

    const drivers: [string, string, string] = [
      isEn
        ? 'Zero direct competitors gives you maximum organic search visibility with minimal ad friction.'
        : 'Cero competidores directos te da máxima visibilidad orgánica con mínima fricción competitiva.',
      isEn
        ? `Expanding from ${radius} km to 10-25 km covers regional arterial roads and neighboring population centers.`
        : `Ampliar de ${radius} km a 10-25 km abarca arterias comerciales y centros urbanos contiguos.`,
      isEn
        ? 'Verifying exact trade categories ensures your business profile triggers on relevant local searches.'
        : 'Verificar categorías exactas asegura que tu perfil aparezca en búsquedas locales relevantes.'
    ];

    const actions: [NormalizedScanAction, NormalizedScanAction, NormalizedScanAction] = [
      {
        id: 'sparse_analyze_message',
        title: isEn ? 'Analyze Inbound Client Message (WhatsApp/Email)' : 'Analizar Mensaje de Cliente (WhatsApp/Email)',
        description: isEn
          ? 'Paste any client message to extract intent, estimate pricing, and generate an instant reply.'
          : 'Pega cualquier mensaje o WhatsApp de cliente para extraer intención, estimar precio y redactar respuesta.',
        actionLabel: isEn ? 'Analyze Message' : 'Analizar Mensaje',
        targetTab: 'leads',
        targetSubRow: 0,
        badge: isEn ? 'CAPTURE • MESSAGING' : 'CAPTURA • MENSAJES',
        badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        icon: 'message-square',
        isOfflineCapable: true,
        priorityScore: 95
      },
      {
        id: 'sparse_publish_website',
        title: isEn ? 'Publish Local Website for Direct Inquiries' : 'Publicar Sitio Web Local para Captar Clientes',
        description: isEn
          ? 'Your local landing page is ready to capture direct searchers into quote requests.'
          : 'Tu landing local está lista para convertir visitas en solicitudes directas de cotización.',
        actionLabel: isEn ? 'Publish Website' : 'Publicar Mi Web',
        targetTab: 'website',
        targetSubRow: 0,
        badge: isEn ? 'CAPTURE • WEBSITE' : 'CAPTURA • WEB',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: 'globe',
        isOfflineCapable: true,
        priorityScore: 90
      },
      {
        id: 'sparse_expand_radius',
        title: isEn ? 'Expand Search Radius (10 km / 25 km)' : 'Ampliar Radio de Búsqueda (10 km / 25 km)',
        description: isEn
          ? `Broaden your scan radius from ${radius} km to cover nearby commercial districts and regional clients.`
          : `Amplía tu radio de ${radius} km para abarcar distritos comerciales cercanos y clientes regionales.`,
        actionLabel: isEn ? 'Expand Radar' : 'Ampliar Radio',
        targetTab: 'business_scan',
        targetSubRow: 0,
        badge: isEn ? 'TERRITORY • SCAN' : 'TERRITORIO • ESCANEO',
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        icon: 'maximize',
        isOfflineCapable: false,
        priorityScore: 70,
        payload: { targetRadius: 10 }
      }
    ];

    return {
      status: 'sparse',
      scanState: stateInfo.scanState,
      degradedReason: stateInfo.degradedReason,
      isCached: stateInfo.isCached,
      cacheAgeText: stateInfo.cacheAgeText,
      userMessage: stateInfo.userMessage,
      summaryLines,
      drivers,
      actions,
      evidenceBadge: stateInfo.evidenceBadge,
      lastCalibrated,
      lastCalibratedTimestamp: ts,
      radiusKm: radius,
      competitorsCount: 0,
      topCompetitors: [],
      remainingCompetitors: [],
      retryOptions: [10, 25],
      cacheKey
    };
  }

  // ----------------------------------------------------
  // CASE 3: COMPETITORS FOUND (status = 'ok')
  // Keep top 3 competitors only in UI default; advanced list collapsed.
  // ----------------------------------------------------
  const sorted = [...rawCompetitors].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  
  const enrichedCompetitors = sorted.map(comp => {
    const reasonObj = computeCompetitorWinLoseReason(
      {
        name: comp.name,
        reviewsCount: comp.reviewsCount ?? comp.reviews,
        reviews: comp.reviewsCount ?? comp.reviews,
        rating: comp.rating,
        website: comp.website,
        isClaimed: comp.isClaimed,
        distanceKm: comp.distanceKm
      },
      {
        reviewsCount: reviews.totalReviews ?? input.profile?.reviewsCount,
        rating: reviews.rating ?? input.profile?.rating,
        website: input.profile?.website,
        isClaimed: gbp.connected || input.profile?.isClaimed
      },
      input.language || 'es'
    );

    return {
      ...comp,
      winLoseReason: reasonObj.reason,
      winLoseType: reasonObj.type
    };
  });

  const topCompetitors = enrichedCompetitors.slice(0, 3);
  const remainingCompetitors = enrichedCompetitors.slice(3);

  const avgDistance = (topCompetitors.reduce((acc, c) => acc + (c.distanceKm || 0), 0) / (topCompetitors.length || 1)).toFixed(1);
  const unansweredReviews = reviews.unansweredCount || 0;

  const summaryLines: [string, string, string] = [
    isEn
      ? `${sorted.length} local competitor${sorted.length === 1 ? '' : 's'} identified within ${radius} km in ${location}.`
      : `Detectamos ${sorted.length} competidor${sorted.length === 1 ? '' : 'es'} en tu radio de ${radius} km en ${location}.`,
    unansweredReviews > 0
      ? isEn
        ? `Critical bottleneck: ${unansweredReviews} review(s) awaiting reply while competitors actively defend ranking.`
        : `Cuello de botella: ${unansweredReviews} reseña(s) sin contestar mientras los competidores defienden su posición.`
      : isEn
        ? `Market pressure is active; positioning gap identified in direct customer follow-ups and review velocity.`
        : `Presión de mercado activa; brecha detectada en velocidad de seguimiento y generación de reseñas.`,
    isEn
      ? `Prescribed action: capture unserved demand by responding immediately to leads and publishing photo proof.`
      : `Acción prescrita: capta demanda desatendida respondiendo de inmediato a prospectos y subiendo fotos de evidencia.`
  ];

  const drivers: [string, string, string] = [
    isEn
      ? `Top competitors cluster at an average distance of ${avgDistance} km from your registered base.`
      : `Los competidores principales se concentran a una distancia media de ${avgDistance} km de tu base.`,
    isEn
      ? `${sorted.length} businesses competing directly for high-intent homeowner searches in ${trade}.`
      : `${sorted.length} negocios compitiendo directamente por búsquedas comerciales de alta intención en ${trade}.`,
    isEn
      ? 'Responding within 15 minutes and showing verified photos doubles closing rates against local rivals.'
      : 'Responder en menos de 15 minutos y mostrar fotos verificadas duplica la tasa de cierre frente a rivales locales.'
  ];

  const actions: [NormalizedScanAction, NormalizedScanAction, NormalizedScanAction] = [
    {
      id: 'ok_answer_leads',
      title: isEn ? 'Secure Inbound Leads Before Competitors Reply' : 'Responder Leads Antes que los Competidores',
      description: isEn
        ? 'Fast response velocity captures unserved homeowners before neighboring contractors get back to them.'
        : 'La velocidad de respuesta asegura prospectos locales antes de que la competencia responda.',
      actionLabel: isEn ? 'Answer Leads' : 'Atender Leads',
      targetTab: 'leads',
      targetSubRow: 4,
      badge: isEn ? 'PRIORITY • CONVERSION' : 'PRIORIDAD • CONVERSIÓN',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      icon: 'zap',
      isOfflineCapable: false,
      priorityScore: 98
    },
    {
      id: 'ok_review_outreach',
      title: isEn ? 'Outrank Rivals with Fresh 5-Star Reviews' : 'Superar a Rivales con Nuevas Reseñas de 5 Estrellas',
      description: isEn
        ? `Outpace the local average (${sorted.length} competitors) by sending review invitations to recent clients.`
        : `Supera el promedio local (${sorted.length} competidores) enviando enlaces de reseña a clientes recientes.`,
      actionLabel: isEn ? 'Collect Reviews' : 'Solicitar Reseñas',
      targetTab: 'reviews',
      targetSubRow: 0,
      badge: isEn ? 'RANKING • TRUST' : 'RANKING • CONFIANZA',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: 'star',
      isOfflineCapable: true,
      priorityScore: 89
    },
    {
      id: 'ok_competitor_gap',
      title: isEn ? 'Audit Top Competitor Blindspots' : 'Auditar Puntos Ciegos del Competidor #1',
      description: isEn
        ? `Inspect pricing, service offerings, and review weaknesses of ${topCompetitors[0]?.name || 'top competitor'}.`
        : `Inspecciona debilidades de servicio y reputación de ${topCompetitors[0]?.name || 'tu competidor principal'}.`,
      actionLabel: isEn ? 'View Competitor Audit' : 'Ver Auditoría Competitiva',
      targetTab: 'business_scan',
      targetSubRow: 0,
      badge: isEn ? 'RADAR • BENCHMARK' : 'RADAR • BENCHMARK',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      icon: 'shield',
      isOfflineCapable: false,
      priorityScore: 82
    }
  ];

  const result: NormalizedScanResult = {
    status: 'ok',
    scanState: stateInfo.scanState,
    degradedReason: stateInfo.degradedReason,
    isCached: stateInfo.isCached,
    cacheAgeText: stateInfo.cacheAgeText,
    userMessage: stateInfo.userMessage,
    summaryLines,
    drivers,
    actions,
    evidenceBadge: stateInfo.evidenceBadge,
    lastCalibrated,
    lastCalibratedTimestamp: ts,
    radiusKm: radius,
    competitorsCount: sorted.length,
    topCompetitors,
    remainingCompetitors,
    cacheKey
  };

  // QUIET LEARNING: Write small memory record into BusinessDNA structure
  try {
    const activeUid = input.uid || input.profile?.id || 'anonymous';
    BusinessDnaService.recordScanSummary(activeUid, {
      status: 'ok',
      competitorsCount: sorted.length,
      radiusKm: radius,
      trade
    });
  } catch (e) {
    console.warn('[Quiet Learning] Failed to save scan summary:', e);
  }

  return result;
}
