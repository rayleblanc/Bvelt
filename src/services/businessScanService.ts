import { BveltEvidence, EvidenceStatus } from '../lib/bveltEvidence';
import { getMarketData } from '../utils/marketMetrics';
import { BveltLocalCache, IndustryResolver, GeographyResolver, DataAcquisitionPlanner, MarketReferenceEngine, persistBusinessScanToBem, persistCompetitorPoiToBem } from '../knowledge';
import { parseRateLimitHeaders, updateQuotaFromServer, RATE_LIMIT_MESSAGE_ES } from '../lib/rateLimitService';
import { dispatchPlanLimitReached } from '../lib/planLimits';
import { Sentry } from '../sentry';
import { getFirebaseAuth } from '../lib/firebase';

export interface BusinessScanInput {
  businessId?: string;
  businessName: string;
  city: string;
  state?: string;
  country?: string;
  niche?: string;
  radiusKm?: number;
  sourceType?: 'USER' | 'RADAR' | 'COMPETITOR_GAP' | 'SYSTEM' | 'OSM_RADAR' | 'BUSINESS_PROFILE' | string;
  sourceLabel?: string;
  isCompetitorAudit?: boolean;
}

export interface BusinessScanIdentity {
  businessName: string;
  city: string;
  state?: string;
  country?: string;
  formattedName: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  isClaimed?: boolean | null;
  rating?: number | null;
  reviewCount?: number | null;
}

export interface BusinessScanLocation {
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  confidence: number; // 0.0 to 1.0
  provider: 'geoapify' | 'nominatim' | 'dictionary' | 'fallback' | 'unverified';
}

export interface BusinessScanEvidenceItem extends BveltEvidence {
  id: string;
  field: string;
  value: any;
  notes?: string;
}

export interface BusinessScanCompetitor {
  id?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  category: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  additionalInfo?: string | null;
  source?: string;
  retrievedAt?: string;
  evidenceStatus?: EvidenceStatus | "VERIFIED" | "DERIVED" | "ESTIMATED" | "UNVERIFIED" | "INSUFFICIENT_DATA";
  rating?: number | null;
  reviewCount?: number | null;
}

export type I18nText = string | { es: string; en: string };

export interface BusinessScanDiagnosis {
  strengths: Array<{ title: I18nText; desc: I18nText; evidenceId?: string }>;
  weaknesses: Array<{ title: I18nText; desc: I18nText; evidenceId?: string }>;
  opportunities: Array<{ title: I18nText; desc: I18nText; evidenceId?: string; projectedGainUsd?: number | string | I18nText; formulaExplanation?: I18nText; status?: "VERIFIED" | "DERIVED" | "ESTIMATED" | "BENCHMARK" | "INFERRED" | "PENDING" | "UNVERIFIED" | "INSUFFICIENT_DATA" }>;
  blindSpots: I18nText[];
  risks: I18nText[];
}

export interface BusinessScanScoreCategory {
  score: number | null;
  status: EvidenceStatus;
  weight: number;
  notes?: I18nText;
  reason?: I18nText;
  howToImprove?: I18nText;
}

export interface BusinessScanResult {
  id: string;
  timestamp: string;
  status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'PARTIAL' | 'ERROR';
  input: BusinessScanInput;
  identity: BusinessScanIdentity;
  location: BusinessScanLocation;
  evidences: Record<string, BusinessScanEvidenceItem>;
  sourcesUsed: string[];
  warnings: string[];
  errors: string[];
  competitors?: BusinessScanCompetitor[];
  diagnosis?: BusinessScanDiagnosis;
  marketContext?: {
    niche: string;
    tier: string;
    avgTicketUsd: number;
    estimatedMonthlyDemand: number;
    estimatedRevenueLossUsd: number;
    benchmarkData?: any;
  };
  score?: {
    overall: number | null;
    status: EvidenceStatus;
    mathExplanation?: I18nText;
    categories: {
      localPresence?: BusinessScanScoreCategory;
      reputation?: BusinessScanScoreCategory;
      website?: BusinessScanScoreCategory;
      marketPosition?: BusinessScanScoreCategory;
      competition?: BusinessScanScoreCategory;
      marketOpportunity?: BusinessScanScoreCategory;
    };
  };
  recommendedActions?: Array<{
    id: string;
    title: I18nText;
    description: I18nText;
    targetTab: string;
    actionLabel: I18nText;
  }>;
  messageForUi?: string;
  nextActions?: any[];
  suggestedRadii?: number[];
  radiusKm?: number;
  website?: string;
  hasWebsite?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
}

const CACHE_PREFIX = 'bvelt_business_scan_v1_';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

export function getScanCacheKey(input: BusinessScanInput): string {
  const nameKey = (input.businessName || '').toLowerCase().trim();
  const cityKey = (input.city || '').toLowerCase().trim();
  const stateKey = (input.state || '').toLowerCase().trim();
  const stableId = input.businessId || `biz_${hashString(`${nameKey}_${cityKey}_${stateKey}`)}`;
  return `${CACHE_PREFIX}id_${stableId}`;
}

export function getAreaTradeCacheKey(city: string, state?: string, niche?: string): string {
  const cityKey = (city || '').toLowerCase().trim();
  const stateKey = (state || '').toLowerCase().trim();
  const nicheKey = (niche || 'all').toLowerCase().trim();
  return `${CACHE_PREFIX}area_${hashString(`${cityKey}_${stateKey}_${nicheKey}`)}`;
}

export function getCachedScan(input: BusinessScanInput): BusinessScanResult | null {
  try {
    const key = getScanCacheKey(input);
    const cached = BveltLocalCache.get<BusinessScanResult>(key);
    if (cached) return cached;
    
    // Strict isolation: Do NOT return area-trade fallback of a different business.
    // Each business must compute from its own verified inputs or show insufficient data.
    return null;
  } catch (e) {
    return null;
  }
}

export function getCachedScanByAreaTrade(city: string, state?: string, niche?: string): BusinessScanResult | null {
  try {
    const areaKey = getAreaTradeCacheKey(city, state, niche);
    return BveltLocalCache.get<BusinessScanResult>(areaKey);
  } catch (e) {
    return null;
  }
}

export function getRecentScans(): BusinessScanResult[] {
  try {
    const list: BusinessScanResult[] = [];
    const fullPrefix = `bvelt_cache_v2_${CACHE_PREFIX}`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(fullPrefix)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsedCache = JSON.parse(raw);
          const parsed = parsedCache.data;
          if (parsed && parsed.id) {
            list.push(parsed);
          }
        }
      }
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
  } catch (e) {
    console.warn("Failed to read recent scans from cache:", e);
    return [];
  }
}

// Inflight request coalescing for business scan
const inflightBusinessScans = new Map<string, Promise<BusinessScanResult>>();

/**
 * Business Scan Orchestrator Service
 * Coordinates validation, server API calls, adaptive fallback, and market context enrichment.
 */
export async function executeBusinessScan(
  input: BusinessScanInput,
  options?: { forceFresh?: boolean; onProgress?: (step: string, percent: number) => void; signal?: AbortSignal }
): Promise<BusinessScanResult> {
  const { onProgress, signal } = options || {};

  // 1. Input Validation
  if (!input.businessName || !input.businessName.trim()) {
    throw new Error("El nombre del negocio es obligatorio.");
  }
  if (!input.city || !input.city.trim()) {
    throw new Error("La ciudad es obligatoria.");
  }

  const cleanInput: BusinessScanInput = {
    businessName: input.businessName.trim(),
    city: input.city.trim(),
    state: input.state ? input.state.trim() : '',
    country: input.country ? input.country.trim() : 'US',
    niche: input.niche ? input.niche.trim() : 'servicios_del_hogar',
    radiusKm: input.radiusKm,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel,
    isCompetitorAudit: input.isCompetitorAudit,
  };

  const inflightKey = `${cleanInput.businessName}_${cleanInput.city}_${cleanInput.niche}_${cleanInput.radiusKm || 5}`;
  if (!options?.forceFresh && inflightBusinessScans.has(inflightKey)) {
    console.log("[Inflight Coalescing] Reutilizando escaneo de negocio en curso para:", inflightKey);
    return inflightBusinessScans.get(inflightKey)!;
  }

  const scanPromise = (async () => {
    // 2. Check local cache if not forcing fresh
    const cacheKey = getScanCacheKey(cleanInput);
    if (!options?.forceFresh) {
      const cachedResult = BveltLocalCache.get<BusinessScanResult>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

  // Knowledge Layer: Industry & Geography Resolution
  const resolvedIndustry = IndustryResolver.resolve(cleanInput.niche || cleanInput.businessName);
  
  // Knowledge Layer: Fetch Market Benchmark using resolved industry
  const marketBenchmark = MarketReferenceEngine.getMarketBenchmark(
    resolvedIndustry.canonicalIndustry,
    cleanInput.city,
    cleanInput.state,
    '', // county
    resolvedIndustry.naicsCandidates,
    '' // msa
  );
  
  // Knowledge Layer: Data Acquisition Planning
  const acquisitionPlan = DataAcquisitionPlanner.planBusinessScan([
    { field: 'location', required: true, freshnessMaxAgeDays: 30 },
    { field: 'competitors', required: true, freshnessMaxAgeDays: 14 },
    { field: 'web_presence', required: true, freshnessMaxAgeDays: 7 },
  ], []);

  // 3. Initiate Orchestrated Scan Pipeline
  onProgress?.("Resolviendo identidad y geolocalización...", 25);

  let serverResponseData: any = null;
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const res = await fetch("/api/business-scan", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...cleanInput,
        forceRescan: options?.forceFresh,
        forceRefresh: options?.forceFresh,
        _acquisitionPlan: acquisitionPlan,
        _resolvedIndustry: resolvedIndustry
      }),
    });

    if (res.status === 429) {
      const { retryAfter } = parseRateLimitHeaders(res);
      updateQuotaFromServer(0);
      const errJson: any = await res.json().catch(() => ({}));
      const humanMsg = errJson.message || RATE_LIMIT_MESSAGE_ES;

      // Dispatch event to show the Upgrade Modal immediately (no silent failures)
      dispatchPlanLimitReached({
        action: (errJson.action as any) || 'scan',
        message: humanMsg,
        limit: errJson.limit || 5,
        current: errJson.current || 5,
        plan: errJson.plan || 'trial',
      });

      const rateLimitErr: any = new Error(humanMsg);
      rateLimitErr.isRateLimited = true;
      rateLimitErr.retryAfterSeconds = retryAfter;
      throw rateLimitErr;
    }

    // Capture remaining headers on successful or partial response
    parseRateLimitHeaders(res);

    if (res.ok || res.status === 206) {
      serverResponseData = await res.json();
    } else {
      const errJson: any = await res.json().catch(() => ({}));
      if (errJson.errors && Array.isArray(errJson.errors)) {
        warnings.push(...errJson.errors);
      } else {
        warnings.push("La consulta remota devolvió una respuesta parcial.");
      }
    }
  } catch (netErr: any) {
    try {
      const auth = getFirebaseAuth();
      const currentUid = input.businessId || auth?.currentUser?.uid || 'anonymous';
      if (currentUid && currentUid !== 'anonymous') {
        Sentry.setUser({ id: currentUid });
        Sentry.setTag('uid', currentUid);
      }
      Sentry.captureException(netErr, {
        tags: {
          feature: 'business_scan_api',
          uid: currentUid
        },
        extra: {
          businessName: cleanInput.businessName,
          city: cleanInput.city,
          niche: cleanInput.niche
        }
      });
    } catch (sentryErr) {
      // Non-blocking
    }

    if (netErr?.isRateLimited) {
      throw netErr;
    }
    console.warn("[BusinessScanService] Server API unavailable, utilizing local evidence fallback:", netErr);
    warnings.push("Modo sin conexión activa. Mostrando evidencias locales disponibles.");
  }

  onProgress?.("Consultando contexto de mercado y benchmarks...", 60);

  // 4. Enrich with Market Context using existing getMarketData utility
  const marketData = getMarketData(cleanInput.niche || 'otro', `${cleanInput.city}, ${cleanInput.state || ''}`);

  onProgress?.("Consolidando modelo de evidencias reales...", 90);

  const nowIso = new Date().toISOString();

  // Extract server location or fallback
  const location: BusinessScanLocation = serverResponseData?.location || {
    latitude: null,
    longitude: null,
    formattedAddress: `${cleanInput.city}${cleanInput.state ? ', ' + cleanInput.state : ''}`,
    confidence: 0.0,
    provider: 'unverified',
  };

  const identity: BusinessScanIdentity = serverResponseData?.identity || {
    businessName: cleanInput.businessName,
    city: cleanInput.city,
    state: cleanInput.state,
    country: cleanInput.country,
    formattedName: `${cleanInput.businessName} (${cleanInput.city}${cleanInput.state ? ', ' + cleanInput.state : ''})`,
    address: location.formattedAddress,
    phone: null,
    website: null,
    googleMapsUrl: null,
    isClaimed: null,
  };

  const isRadarAudit = cleanInput.sourceType === 'OSM_RADAR' || cleanInput.sourceType === 'RADAR' || cleanInput.sourceType === 'COMPETITOR_GAP' || Boolean(cleanInput.isCompetitorAudit);
  const effectiveIdentitySourceType = isRadarAudit ? 'RADAR' : (cleanInput.sourceType || 'BUSINESS_PROFILE') as any;
  const effectiveIdentitySourceLabel = cleanInput.sourceLabel || (isRadarAudit ? 'Radar de Competencia' : 'Entrada del Usuario');

  const evidences: Record<string, BusinessScanEvidenceItem> = serverResponseData?.evidences || {
    identity_business_name: {
      id: "ev_biz_name",
      field: "Nombre Comercial",
      value: cleanInput.businessName,
      sourceType: effectiveIdentitySourceType,
      sourceLabel: effectiveIdentitySourceLabel,
      evidenceStatus: "VERIFIED",
      confidence: 1.0,
      lastUpdated: nowIso,
    },
    identity_city: {
      id: "ev_city",
      field: "Ciudad",
      value: cleanInput.city,
      sourceType: effectiveIdentitySourceType,
      sourceLabel: effectiveIdentitySourceLabel,
      evidenceStatus: "VERIFIED",
      confidence: 1.0,
      lastUpdated: nowIso,
    },
    location_coordinates: {
      id: "ev_coords",
      field: "Coordenadas Geográficas",
      value: location.latitude ? `${location.latitude.toFixed(5)}, ${location.longitude?.toFixed(5)}` : null,
      sourceType: "SYSTEM",
      sourceLabel: location.provider === "geoapify" ? "Geoapify API" : "OpenStreetMap Nominatim",
      evidenceStatus: location.latitude ? "VERIFIED" : "UNVERIFIED",
      confidence: location.confidence,
      lastUpdated: nowIso,
    },
    website_url: {
      id: "ev_website",
      field: "Sitio Web Oficial",
      value: null,
      sourceType: "REPUTATION",
      sourceLabel: "Direct Verification",
      evidenceStatus: "UNVERIFIED",
      confidence: 0.0,
      lastUpdated: nowIso,
      notes: "Pendiente de verificación en escaneo extendido",
    },
  };

  const recommendedActions = serverResponseData?.recommendedActions || [
    {
      id: "act_seo",
      title: { es: "Optimizar Posicionamiento Local", en: "Optimize Local Search Positioning" },
      description: { es: "Analizar competidores en la zona e incrementar visibilidad en búsquedas locales.", en: "Analyze local competitors and increase search visibility." },
      targetTab: "growth",
      actionLabel: { es: "Ir a SEO Local", en: "Go to Local SEO" },
    },
    {
      id: "act_reviews",
      title: { es: "Verificar Reputación de Reseñas", en: "Verify Review Reputation" },
      description: { es: "Revisar y responder opiniones recibidas en Google Maps.", en: "Review and respond to Google Maps customer reviews." },
      targetTab: "reviews",
      actionLabel: { es: "Ir a Reseñas", en: "Go to Reviews" },
    },
    {
      id: "act_website",
      title: { es: "Asegurar Presencia Web Móvil", en: "Ensure Mobile Web Presence" },
      description: { es: "Asegurar que el negocio cuente con un sitio web con cotizador rápido.", en: "Ensure the business has a responsive website with quick quoting." },
      targetTab: "website",
      actionLabel: { es: "Ir a Mi Sitio Web", en: "Go to My Website" },
    },
  ];

  const overallStatus: 'SUCCESS' | 'PARTIAL' | 'ERROR' = 
    serverResponseData?.status === 'SUCCESS' ? 'SUCCESS' :
    serverResponseData?.status === 'PARTIAL' ? 'PARTIAL' :
    (location.latitude !== null || warnings.length > 0) ? 'PARTIAL' : 'ERROR';

  const finalResult: BusinessScanResult = {
    id: serverResponseData?.id || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: nowIso,
    status: overallStatus,
    input: cleanInput,
    identity,
    location,
    evidences,
    sourcesUsed: serverResponseData?.sourcesUsed || ["Cliente Bvelt"],
    warnings: Array.from(new Set([...(serverResponseData?.warnings || []), ...warnings])),
    errors,
    competitors: serverResponseData?.competitors || [],
    diagnosis: serverResponseData?.diagnosis || {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      blindSpots: [],
      risks: [],
    },
    marketContext: {
      niche: resolvedIndustry.canonicalIndustry,
      tier: 'Local Benchmark',
      avgTicketUsd: marketBenchmark.market_reference?.ticketReference || 100,
      estimatedMonthlyDemand: marketBenchmark.market_reference?.observableSignal ? marketBenchmark.market_reference.observableSignal * marketBenchmark.market_reference.conversionRange.max * 30 : 0,
      estimatedRevenueLossUsd: marketBenchmark.market_reference?.range.max || 0,
      benchmarkData: marketBenchmark
    },
    score: serverResponseData?.score || {
      overall: null,
      status: 'INSUFFICIENT_DATA',
      categories: {
        localPresence: { score: location.latitude ? 70 : null, status: location.latitude ? 'DERIVED' : 'INSUFFICIENT_DATA', weight: 0.25 },
        reputation: { score: null, status: 'INSUFFICIENT_DATA', weight: 0.15 },
        website: { score: null, status: 'INSUFFICIENT_DATA', weight: 0.25 },
        marketPosition: { score: null, status: 'INSUFFICIENT_DATA', weight: 0.15 },
        competition: { score: null, status: 'INSUFFICIENT_DATA', weight: 0.10 },
        marketOpportunity: { score: null, status: 'INSUFFICIENT_DATA', weight: 0.10 },
      },
    },
    recommendedActions,
    messageForUi: serverResponseData?.messageForUi || (serverResponseData?.competitors?.length ? `Se detectaron ${serverResponseData.competitors.length} competidores locales.` : `0 competidores directos detectados.`),
    nextActions: serverResponseData?.nextActions || [],
    suggestedRadii: serverResponseData?.suggestedRadii || [10, 25],
    radiusKm: serverResponseData?.radiusKm || cleanInput.radiusKm || 5,
  };

    // Save to Cache
    try {
      BveltLocalCache.set(cacheKey, finalResult, 24 * 60 * 60 * 1000);
      if (cleanInput.city) {
        const areaKey = getAreaTradeCacheKey(cleanInput.city, cleanInput.state, cleanInput.niche);
        BveltLocalCache.set(areaKey, finalResult, 24 * 60 * 60 * 1000);
      }
    } catch (e) {
      console.warn("Could not save scan result to local cache:", e);
    }

    // BEM Write-Back Integration (Phase F3 / P3)
    try {
      const competitorsSummary = finalResult.competitors && finalResult.competitors.length > 0 ? {
        count: finalResult.competitors.length,
        topCompetitors: finalResult.competitors.slice(0, 5).map(c => ({
          name: c.name,
          category: c.category,
          rating: c.rating,
          reviewCount: c.reviewCount
        }))
      } : null;

      const scanPayload = {
        businessName: identity.businessName || cleanInput.businessName,
        city: cleanInput.city || identity.city,
        state: cleanInput.state,
        country: cleanInput.country,
        address: identity.address,
        phone: identity.phone,
        website: identity.website,
        isClaimed: identity.isClaimed,
        rating: finalResult.score?.overall ? (finalResult.score.overall / 20) : (identity.rating ?? null),
        reviewCount: identity.reviewCount ?? null,
        coordinates: (location.latitude !== null && location.longitude !== null) ? { lat: location.latitude, lng: location.longitude } : null,
        competitorsSummary
      };

      const fallbackEntityId = `ent_${(scanPayload.businessName || 'business').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${(scanPayload.city || 'local').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const path = `entities/${fallbackEntityId}/evidence`;

      const bemSuccess = await persistBusinessScanToBem(scanPayload);
      console.log('[BEM Write-Back]', {
        bemPersist: bemSuccess ? 'SUCCESS' : 'SKIPPED',
        entityId: fallbackEntityId,
        reason: bemSuccess ? 'RESOLVED_SUCCESS' : 'FALLBACK_SLUG',
        path
      });

      if (finalResult.competitors && finalResult.competitors.length > 0) {
        const topCompetitors = finalResult.competitors.slice(0, 10);
        await Promise.all(topCompetitors.map(c => persistCompetitorPoiToBem({
          name: c.name,
          lat: c.latitude,
          lng: c.longitude,
          category: c.category || cleanInput.niche || 'Business',
          phone: c.phone,
          website: c.website,
          address: c.address,
          rating: c.rating,
          reviewCount: c.reviewCount
        }).catch(err => {
          console.warn('[BEM Write-Back]', {
            bemPersist: 'FAILED',
            entityId: `ent_${c.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            reason: err?.message || 'Competitor persist failed',
            path: `entities/competitors/${c.name}`
          });
          return false;
        })));
      }
    } catch (bemErr: any) {
      console.warn('[BEM Write-Back]', {
        bemPersist: 'FAILED',
        entityId: (cleanInput.businessName || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_'),
        reason: bemErr?.message || 'Non-blocking write warning',
        path: 'entities/unknown/evidence'
      });
    }

    onProgress?.("¡Análisis completado!", 100);

    return finalResult;
  })().finally(() => {
    inflightBusinessScans.delete(inflightKey);
  });

  inflightBusinessScans.set(inflightKey, scanPromise);
  return scanPromise;
}
