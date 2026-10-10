import { getDatasetManifest } from '../manifest';
import { BveltEvidence, EvidenceStatus } from '../../lib/bveltEvidence';
import { COMPACT_CBP_INDEX } from '../data/cbp_index';
import { COMPACT_QCEW_INDEX } from '../data/qcew_index';
import { COMPACT_OEWS_INDEX } from '../data/oews_index';
import { COMPACT_ACS_INDEX } from '../data/acs_index';
import { COMPACT_BEA_INDEX } from '../data/bea_index';

export interface MarketEstimate {
  value: string | number;
  unit: 'ESTABLISHMENTS' | 'EMPLOYMENT' | 'PAYROLL' | 'CUSTOMERS' | 'REVENUE' | 'INDEX' | 'WAGE' | 'POPULATION' | 'HOUSEHOLDS';
  evidence: BveltEvidence;
}

export interface OpportunityRange {
  min: number;
  max: number;
  unit: string;
}

export interface OpportunityEstimate {
  range: OpportunityRange;
  observableSignal: number | null;
  conversionRange: { min: number; max: number };
  ticketReference: number;
  formula: string;
  assumptions: string[];
  evidence: BveltEvidence;
}

export type GeographicScope = 
  | 'SAME_CITY_SAME_RADIUS'
  | 'SAME_CITY'
  | 'METRO_REGION'
  | 'NATIONAL'
  | 'BROADER_BENCHMARK_FALLBACK';

export interface LocalBenchmarkMetric<T = number | string | null> {
  value: T;
  evidenceStatus: EvidenceStatus;
  source: string;
  geographicScope: GeographicScope;
  sampleSize: number;
  confidence: number;
  description: string;
}

export interface LocalBenchmarkSet {
  competitorCount: LocalBenchmarkMetric<number>;
  competitorWebsiteRate: LocalBenchmarkMetric<number | null>; // % (0-100) or null if insufficient
  competitorDensity: LocalBenchmarkMetric<'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA'>;
  averageDistanceKm: LocalBenchmarkMetric<number | null>;
  ratingBenchmark: LocalBenchmarkMetric<number | null>;
  reviewVolumeBenchmark: LocalBenchmarkMetric<number | null>;
  generatedAt: string;
}

export interface MarketGap {
  id: string;
  type: 
    | 'RATING_GAP' 
    | 'REVIEW_VOLUME_GAP' 
    | 'MISSING_WEBSITE' 
    | 'WEBSITE_ADVANTAGE'
    | 'LOW_LOCAL_PRESENCE' 
    | 'COMPETITOR_DENSITY'
    | 'COMPETITOR_STRENGTH'
    | 'INSUFFICIENT_EVIDENCE'
    | 'GEOGRAPHIC_OPPORTUNITY' 
    | 'REPUTATION_OPPORTUNITY' 
    | 'CONVERSION_OPPORTUNITY' 
    | 'VISIBILITY_OPPORTUNITY';
  title: string;
  description: string;
  evidence: string;
  source: string;
  geographicScope: GeographicScope;
  confidence: number;
  status: EvidenceStatus;
  missingFields?: string[];
}

export interface MarketCompetitor {
  placeId?: string;
  businessName: string;
  niche: string;
  city: string;
  distanceKm?: number;
  rating?: number;
  userRatingCount?: number;
  hasWebsite: boolean;
  website?: string;
  phone?: string;
  address?: string;
  googleMapsUrl?: string;
  source?: string;
  retrievedAt?: string;
  evidenceStatus?: EvidenceStatus | 'VERIFIED' | 'DERIVED' | 'ESTIMATED' | 'UNVERIFIED' | 'INSUFFICIENT_DATA';
  relevanceScore: number; // 0 to 100
  relevanceReasons: string[];
}

export interface MarketContext {
  industryPresence: {
    marketSizeProxy: number | null;
    establishmentDensity: number | null;
    employmentDensity: number | null;
  };
  economicContext: {
    wagePressure: number | null;
    populationContext: number | null;
    incomeContext: number | null;
  };
  geographicCoverage: string;
  geographicScope?: GeographicScope;
  totalComparableBusinesses?: number;
  competitionDensity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'SATURATED';
  avgRating?: number;
  avgReviewCount?: number;
  websitePercentage?: number;
  lowVisibilityPercentage?: number;
  topCompetitors?: MarketCompetitor[];
  marketGaps?: MarketGap[];
}

export interface MarketBenchmark {
  market_reference: OpportunityEstimate | null;
  employment_reference: MarketEstimate | null;
  establishments_reference: MarketEstimate | null;
  payroll_reference: MarketEstimate | null;
  wage_reference: MarketEstimate | null;
  demographic_reference: { population: MarketEstimate, households: MarketEstimate } | null;
  economic_reference: MarketEstimate | null;
  market_context: MarketContext;
  geographicScope: GeographicScope;
  summaryStatus: 'REFERENCE DATA AVAILABLE' | 'NO LOCAL REFERENCE AVAILABLE';
}

export class MarketReferenceEngine {

  static getMarketBenchmark(
    category: string,
    city: string,
    state?: string,
    county?: string,
    naicsCandidates: string[] = [],
    msa?: string
  ): MarketBenchmark {
    const safeLocationId = city.toLowerCase().replace(/\s+/g, '_');
    const safeState = state ? state.toLowerCase() : '';
    const safeCounty = county ? county.toLowerCase().replace(/\s+/g, '_') : '';
    const safeMsa = msa ? msa.toLowerCase().replace(/\s+/g, '_') : '';

    const firstNaics = naicsCandidates.length > 0 ? naicsCandidates[0] : '';
    let establishments = this.getBaselineEstablishments(firstNaics, safeLocationId);
    
    // Attempt fallback to county/state for establishments if city misses
    if (establishments.evidence.evidenceStatus === 'INSUFFICIENT_DATA' && safeCounty) {
       const fallbackEst = this.getBaselineEstablishments(firstNaics, safeCounty);
       if (fallbackEst.evidence.evidenceStatus !== 'INSUFFICIENT_DATA') {
           establishments = fallbackEst;
       }
    }

    const qcewData = this.getQCEWReference(firstNaics, safeState, safeCounty);
    const oewsData = this.getOEWSReference(firstNaics, safeState, safeMsa);
    const acsData = this.getACSReference(safeState, safeCounty, safeLocationId);
    const beaData = this.getBEAReference(safeState, safeMsa);

    let hasAnyData = false;
    if (establishments.evidence.evidenceStatus !== 'INSUFFICIENT_DATA') hasAnyData = true;
    if (qcewData) hasAnyData = true;
    if (oewsData) hasAnyData = true;
    if (acsData) hasAnyData = true;

    const marketContext: MarketContext = {
      industryPresence: {
        marketSizeProxy: typeof establishments.value === 'number' ? establishments.value : null,
        establishmentDensity: null, // Could compute vs population if available
        employmentDensity: typeof qcewData?.employment?.value === 'number' ? qcewData.employment.value : null
      },
      economicContext: {
        wagePressure: typeof oewsData?.wage?.value === 'number' ? oewsData.wage.value : null,
        populationContext: typeof acsData?.population?.value === 'number' ? acsData.population.value : null,
        incomeContext: typeof acsData?.households?.value === 'number' ? acsData.households.value : null // using households as income context proxy for now
      },
      geographicCoverage: safeMsa || safeCounty || safeLocationId
    };

    // Derived Market Reference (Opportunity Engine with ranges)
    let marketRef: OpportunityEstimate | null = null;
    if (typeof establishments.value === 'number' && establishments.value > 0) {
      // Very basic model: Local market potential based on establishments
      // Assumption: Each establishment generates between 1 and 3 digital leads per day
      // Ticket reference: generic $100 value per conversion
      const ticketReference = 100;
      const conversionMin = 1;
      const conversionMax = 3;
      
      const minDaily = establishments.value * conversionMin * ticketReference;
      const maxDaily = establishments.value * conversionMax * ticketReference;

      marketRef = {
        range: { min: minDaily * 30, max: maxDaily * 30, unit: 'USD/month' }, // Monthly
        observableSignal: establishments.value,
        conversionRange: { min: conversionMin, max: conversionMax },
        ticketReference,
        formula: `opportunity = observable_market_signal (${establishments.value} estabs) × estimated_conversion_range (1-3 leads/day) × estimated_ticket_reference ($${ticketReference}) × 30 days`,
        assumptions: [
          'Using establishments as the observable market signal.',
          'Assuming 1 to 3 average daily conversions/leads per establishment.',
          `Assuming an average ticket value of $${ticketReference}.`
        ],
        evidence: {
          sourceType: 'BENCHMARK_MODEL',
          sourceLabel: 'Bvelt Local Market Model',
          evidenceStatus: 'ESTIMATED',
          confidence: 0.6,
          confidenceLevel: 'Medium',
          lastUpdated: new Date().toISOString()
        }
      };
    }

    let geographicScope: GeographicScope = 'SAME_CITY';
    if (establishments.evidence.evidenceStatus !== 'INSUFFICIENT_DATA') {
      geographicScope = 'SAME_CITY';
    } else if (safeCounty) {
      geographicScope = 'METRO_REGION';
    } else if (safeState) {
      geographicScope = 'NATIONAL';
    } else {
      geographicScope = 'BROADER_BENCHMARK_FALLBACK';
    }

    marketContext.geographicScope = geographicScope;

    return {
      market_reference: marketRef,
      employment_reference: qcewData?.employment || null,
      establishments_reference: establishments.evidence.evidenceStatus !== 'INSUFFICIENT_DATA' ? establishments : null,
      payroll_reference: qcewData?.payroll || null,
      wage_reference: oewsData?.wage || null,
      demographic_reference: acsData,
      economic_reference: beaData?.gdp || null,
      market_context: marketContext,
      geographicScope,
      summaryStatus: hasAnyData ? 'REFERENCE DATA AVAILABLE' : 'NO LOCAL REFERENCE AVAILABLE'
    };
  }

  /**
   * Builds a relevant competitor set for a prospect with explicit competitor relevance scoring (0-100).
   * Note: competitor relevance score is distinct from prospect opportunity score!
   */
  static buildCompetitorSet(
    prospectContext: { businessName?: string; niche?: string; city?: string; placeId?: string; latitude?: number | null; longitude?: number | null },
    candidates: any[] = []
  ): MarketCompetitor[] {
    const pNiche = (prospectContext.niche || '').toLowerCase();
    const pCity = (prospectContext.city || '').toLowerCase();
    const pPlaceId = prospectContext.placeId;
    const pName = (prospectContext.businessName || '').toLowerCase();

    const seenPlaceIds = new Set<string>();
    if (pPlaceId) seenPlaceIds.add(pPlaceId);

    const competitors: MarketCompetitor[] = [];

    candidates.forEach(c => {
      const cPlaceId = c.placeId || c.id;
      if (cPlaceId && seenPlaceIds.has(cPlaceId)) return;
      if (cPlaceId) seenPlaceIds.add(cPlaceId);

      const cName = c.name || c.businessName || c.title || '';
      if (cName.toLowerCase() === pName) return;

      const cNiche = c.category || c.niche || c.primaryCategory || 'Local Business';
      const cCity = c.city || pCity;
      const cRating = typeof c.rating === 'number' ? c.rating : undefined;
      const cReviews = typeof c.reviewCount === 'number' ? c.reviewCount : typeof c.userRatingCount === 'number' ? c.userRatingCount : undefined;
      const hasWeb = Boolean(c.website && c.website !== 'NOT_AVAILABLE');

      let relevanceScore = 40;
      const reasons: string[] = [];

      if (cNiche.toLowerCase().includes(pNiche) || pNiche.includes(cNiche.toLowerCase())) {
        relevanceScore += 30;
        reasons.push(`Mismo nicho (${cNiche})`);
      } else {
        relevanceScore += 10;
        reasons.push(`Nicho complementario (${cNiche})`);
      }

      if (cCity.toLowerCase() === pCity) {
        relevanceScore += 20;
        reasons.push(`Misma ciudad (${cCity})`);
      }

      if (cRating && cRating >= 4.2) {
        relevanceScore += 10;
        reasons.push(`Calificación fuerte (${cRating}★)`);
      }

      if (cReviews && cReviews >= 20) {
        relevanceScore += 10;
        reasons.push(`Volumen activo de reseñas (${cReviews} reseñas)`);
      }

      const cDist = typeof c.distanceKm === 'number' ? c.distanceKm : typeof c.distance === 'number' ? c.distance : undefined;

      competitors.push({
        placeId: cPlaceId,
        businessName: cName,
        niche: cNiche,
        city: cCity,
        distanceKm: cDist,
        rating: cRating,
        userRatingCount: cReviews,
        hasWebsite: hasWeb,
        website: hasWeb ? c.website : undefined,
        phone: c.phone || undefined,
        address: c.address || undefined,
        googleMapsUrl: c.googleMapsUrl || c.sourceUrl,
        source: c.source || 'openstreetmap',
        retrievedAt: c.retrievedAt || new Date().toISOString(),
        evidenceStatus: c.evidenceStatus || 'VERIFIED',
        relevanceScore: Math.min(100, relevanceScore),
        relevanceReasons: reasons
      });
    });

    competitors.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return competitors.slice(0, 10); // Return top bounded relevant competitors
  }

  /**
   * Identifies data-backed market gaps from observable competitor and territory evidence.
   * Strictly respects Phase 3C deterministic competitive signal rules.
   */
  static detectMarketGaps(
    prospectContext: { businessName?: string; niche?: string; city?: string; rating?: number | string; reviewCount?: number | string; website?: string; hasWebsite?: boolean },
    competitors: (MarketCompetitor | any)[] = [],
    lang: 'es' | 'en' = (typeof window !== 'undefined' && localStorage.getItem('lf_lang') === 'es') ? 'es' : 'en'
  ): MarketGap[] {
    const isEn = lang === 'en';
    const gaps: MarketGap[] = [];
    const pRating = typeof prospectContext.rating === 'number' ? prospectContext.rating : null;
    const pReviews = typeof prospectContext.reviewCount === 'number' ? prospectContext.reviewCount : null;
    const hasWeb = prospectContext.hasWebsite !== undefined
      ? Boolean(prospectContext.hasWebsite)
      : Boolean(prospectContext.website && prospectContext.website !== 'NOT_AVAILABLE' && prospectContext.website !== 'undefined');
    const city = prospectContext.city || (isEn ? 'Local Market' : 'Mercado Local');

    // 0. Source attribution from competitor set
    const hasGeoapify = competitors.some(c => (c.source || '').includes('geoapify'));
    const hasOsm = competitors.some(c => (c.source || '').includes('openstreetmap'));
    const sourceLabel = hasGeoapify && hasOsm 
      ? (isEn ? 'Market Radar (Geoapify & OpenStreetMap)' : 'Radar de Mercado (Geoapify y OpenStreetMap)')
      : hasGeoapify
        ? (isEn ? 'Market Radar (Geoapify Places)' : 'Radar de Mercado (Geoapify Places)')
        : (isEn ? 'Market Radar (OpenStreetMap)' : 'Radar de Mercado (OpenStreetMap)');

    // 1. DataCoverage / InsufficientEvidence Signal
    if (!competitors || competitors.length === 0) {
      gaps.push({
        id: 'gap_insufficient_competitor_data',
        type: 'INSUFFICIENT_EVIDENCE',
        title: isEn ? 'Insufficient Competitor Radar Data' : 'Datos de Competencia Insuficientes',
        description: isEn
          ? `No mapped competitors discovered within the 6 km radius around ${city}.`
          : `No se detectaron competidores mapeados en el radio de 6 km alrededor de ${city}.`,
        evidence: isEn ? '0 mapped establishments returned by local providers.' : '0 establecimientos registrados por proveedores locales.',
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.5,
        status: 'INSUFFICIENT_DATA'
      });
      return gaps;
    }

    // 2. WebSiteMissing / Digital Conversion Signal
    const compsWithWebsite = competitors.filter(c => Boolean(c.hasWebsite || (c.website && c.website !== 'NOT_AVAILABLE')));
    const compWebPercent = Math.round((compsWithWebsite.length / competitors.length) * 100);

    if (!hasWeb && competitors.length >= 2) {
      gaps.push({
        id: 'gap_missing_website',
        type: 'MISSING_WEBSITE',
        title: isEn ? 'Digital Conversion Gap (Missing Website)' : 'Brecha Digital de Conversión (Sin Sitio Web)',
        description: isEn
          ? `${compWebPercent}% of local competitors (${compsWithWebsite.length}/${competitors.length}) have a registered website to capture client inquiries.`
          : `El ${compWebPercent}% de los competidores locales (${compsWithWebsite.length}/${competitors.length}) cuenta con sitio web para captar clientes.`,
        evidence: isEn
          ? `User profile has no active website while ${compsWithWebsite.length} nearby competitors do.`
          : `El perfil del negocio no registra sitio web activo frente a ${compsWithWebsite.length} competidores cercanos.`,
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.9,
        status: 'DERIVED'
      });
    } else if (hasWeb && compWebPercent < 50 && competitors.length >= 3) {
      gaps.push({
        id: 'gap_website_advantage',
        type: 'WEBSITE_ADVANTAGE',
        title: isEn ? 'Digital Web Advantage' : 'Ventaja Competitiva Web',
        description: isEn
          ? `Only ${compWebPercent}% of competitors in your radius have an active website. Your online presence is a direct competitive moat.`
          : `Solo el ${compWebPercent}% de los competidores en tu radio tiene web. Tu presencia digital es una ventaja competitiva directa.`,
        evidence: isEn
          ? `Observed website gap across ${competitors.length} local businesses.`
          : `Brecha web observada en ${competitors.length} negocios locales.`,
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.85,
        status: 'DERIVED'
      });
    }

    // 3. CompetitorDensity / GeographicGap Signal
    if (competitors.length === 0) {
      gaps.push({
        id: 'gap_competitor_density_zero',
        type: 'GEOGRAPHIC_OPPORTUNITY',
        title: isEn ? 'Low Indexed Competitor Density' : 'Baja Densidad de Competidores Indexados',
        description: isEn
          ? 'No direct indexed competitors detected in the immediate 6 km radius. High territorial opportunity to capture early local search intent before competitors register.'
          : 'No se detectaron competidores directos indexados en el radio inmediato de 6 km. Oportunidad territorial alta para captar búsquedas locales antes de que otros se posicionen.',
        evidence: isEn ? '0 competing POIs indexed in exact radius.' : '0 competidores indexados en el radio exacto.',
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.8,
        status: 'VERIFIED'
      });
    } else if (competitors.length >= 6) {
      gaps.push({
        id: 'gap_competitor_density_high',
        type: 'COMPETITOR_DENSITY',
        title: isEn ? 'High Local Competitive Density' : 'Alta Densidad Competitiva Local',
        description: isEn 
          ? `High concentration of ${competitors.length} competitors within 6 km. Direct differentiation and fast response times are critical.`
          : `Alta concentración de ${competitors.length} competidores en un radio de 6 km. Se requiere diferenciación clara y velocidad de respuesta.`,
        evidence: isEn ? `${competitors.length} mapped competitors in immediate radius.` : `${competitors.length} competidores mapeados en el radio inmediato.`,
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.85,
        status: 'DERIVED'
      });
    } else if (competitors.length >= 1 && competitors.length <= 2) {
      gaps.push({
        id: 'gap_competitor_density_low',
        type: 'GEOGRAPHIC_OPPORTUNITY',
        title: isEn ? 'Low Territory Saturation' : 'Baja Saturación Territorial',
        description: isEn
          ? `Only ${competitors.length} competitor(s) detected in 6 km. Strong opportunity to establish local market dominance.`
          : `Solo ${competitors.length} competidor(es) detectado(s) en 6 km. Alta oportunidad para liderar el mercado local.`,
        evidence: isEn ? `Sparse competitor density (${competitors.length} POIs).` : `Baja densidad de competidores (${competitors.length} establecimientos).`,
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.8,
        status: 'DERIVED'
      });
    } else {
      gaps.push({
        id: 'gap_competitor_density_moderate',
        type: 'COMPETITOR_DENSITY',
        title: isEn ? 'Moderate Competitive Density' : 'Densidad Competitiva Moderada',
        description: isEn
          ? `${competitors.length} direct competitors detected within 6 km. Market has active demand with room for quality positioning.`
          : `${competitors.length} competidores directos detectados en 6 km. Mercado activo con espacio para posicionamiento por calidad.`,
        evidence: isEn ? `${competitors.length} competitors mapped within 6 km.` : `${competitors.length} competidores mapeados en 6 km.`,
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.85,
        status: 'DERIVED'
      });
    }

    // 4. CompetitorStrength Signal (Dominant close competitor with complete profile)
    const strongCompetitor = competitors.find(c => {
      const dist = typeof c.distanceKm === 'number' ? c.distanceKm : typeof c.distance === 'number' ? c.distance : 99;
      const hasContact = Boolean(c.phone || c.website || c.hasWebsite);
      const hasAddr = Boolean(c.address);
      return dist < 1.5 && hasContact && hasAddr;
    });

    if (strongCompetitor) {
      const distKm = typeof strongCompetitor.distanceKm === 'number' ? strongCompetitor.distanceKm : strongCompetitor.distance;
      const compName = strongCompetitor.businessName || strongCompetitor.name || (isEn ? 'Direct Competitor' : 'Competidor Directo');
      gaps.push({
        id: 'gap_competitor_strength',
        type: 'COMPETITOR_STRENGTH',
        title: isEn ? 'Immediate Strong Competitor' : 'Competidor Cercano con Presencia Completa',
        description: isEn
          ? `"${compName}" is located at ${distKm} km with structured contact channels and local presence.`
          : `"${compName}" se ubica a ${distKm} km con canales de contacto estructurados y presencia local completa.`,
        evidence: isEn 
          ? `Observed verified contact attributes at close range (${distKm} km).`
          : `Atributos de contacto y ubicación observados a corta distancia (${distKm} km).`,
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.8,
        status: 'DERIVED'
      });
    }

    // 5. ReputationGap Signal (Strictly when >= 2 valid competitor ratings exist)
    const validRatings = competitors
      .map(c => typeof c.rating === 'number' ? c.rating : null)
      .filter((r): r is number => r !== null && !isNaN(r));

    const validReviews = competitors
      .map(c => typeof c.userRatingCount === 'number' ? c.userRatingCount : typeof c.reviewCount === 'number' ? c.reviewCount : null)
      .filter((rv): rv is number => rv !== null && !isNaN(rv));

    if (validRatings.length >= 2) {
      const avgCompRating = validRatings.reduce((a, b) => a + b, 0) / validRatings.length;
      if (pRating === null || pRating < avgCompRating - 0.3) {
        gaps.push({
          id: 'gap_reputation_rating',
          type: 'RATING_GAP',
          title: isEn ? 'Local Reputation Gap' : 'Brecha de Reputación Local',
          description: isEn
            ? `Observed competitors average ${avgCompRating.toFixed(1)}★ across ${validRatings.length} verified ratings, vs ${pRating !== null ? pRating + '★' : 'unrated'}.`
            : `Los competidores observados promedian ${avgCompRating.toFixed(1)}★ en ${validRatings.length} calificaciones verificadas, frente a ${pRating !== null ? pRating + '★' : 'sin calificar'}.`,
          evidence: isEn ? `${validRatings.length} local ratings analyzed.` : `${validRatings.length} valoraciones locales analizadas.`,
          source: isEn ? 'Local Reputation Analysis' : 'Análisis de Reputación Local',
          geographicScope: 'SAME_CITY_SAME_RADIUS',
          confidence: 0.85,
          status: 'DERIVED'
        });
      }
    } else if (pRating === null && competitors.length > 0) {
      gaps.push({
        id: 'gap_reputation_insufficient',
        type: 'REPUTATION_OPPORTUNITY',
        title: isEn ? 'Public Reputation Index Not Available' : 'Índice de Reseñas Públicas No Disponible',
        description: isEn
          ? 'Insufficient public rating benchmarks available in the current map layer.'
          : 'No se dispone de suficientes reseñas públicas verificables en la capa actual para establecer un benchmark.',
        evidence: isEn ? '0-1 public rating benchmarks detected in scan radius.' : '0-1 valoraciones públicas detectadas en el radio.',
        source: sourceLabel,
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.5,
        status: 'INSUFFICIENT_DATA'
      });
    }

    if (validReviews.length >= 2) {
      const avgCompReviews = Math.round(validReviews.reduce((a, b) => a + b, 0) / validReviews.length);
      if (pReviews === null || pReviews < avgCompReviews * 0.5) {
        gaps.push({
          id: 'gap_review_volume',
          type: 'REVIEW_VOLUME_GAP',
          title: isEn ? 'Review Volume Gap' : 'Brecha en Volumen de Reseñas',
          description: isEn
            ? `Local competitors in ${city} average ${avgCompReviews} reviews, while your profile has ${pReviews !== null ? pReviews : 0}.`
            : `El promedio de reseñas de competidores locales en ${city} es de ${avgCompReviews}, mientras que tu perfil tiene ${pReviews !== null ? pReviews : 0}.`,
          evidence: isEn
            ? `Local competitive benchmark: ${validReviews.length} competitors analyzed.`
            : `Estudio competitivo local: ${validReviews.length} competidores analizados.`,
          source: sourceLabel,
          geographicScope: 'SAME_CITY_SAME_RADIUS',
          confidence: 0.85,
          status: 'DERIVED'
        });
      }
    }

    return gaps;
  }

  private static getQCEWReference(naics: string, state: string, county: string): { employment: MarketEstimate, payroll: MarketEstimate } | null {
    if (!naics || (!state && !county)) return null;
    const manifest = getDatasetManifest('qcew_2025_annual');
    if (!manifest || manifest.status !== 'LOCAL_INDEX') return null;

    const keysToTry = [`${naics}_${state}_${county}`, `${naics}_${state}`];
    for (const key of keysToTry) {
       const found = COMPACT_QCEW_INDEX[key];
       if (found) {
           return {
               employment: {
                   value: found.employment,
                   unit: 'EMPLOYMENT',
                   evidence: { sourceType: 'REFERENCE_DATA', sourceLabel: 'BLS QCEW 2025', evidenceStatus: 'BENCHMARK', confidence: 1.0, confidenceLevel: 'High', lastUpdated: new Date().toISOString() }
               },
               payroll: {
                   value: found.annual_payroll,
                   unit: 'PAYROLL',
                   evidence: { sourceType: 'REFERENCE_DATA', sourceLabel: 'BLS QCEW 2025', evidenceStatus: 'BENCHMARK', confidence: 1.0, confidenceLevel: 'High', lastUpdated: new Date().toISOString() }
               }
           };
       }
    }
    return null;
  }

  private static getOEWSReference(naics: string, state: string, msa: string): { wage: MarketEstimate } | null {
    if (!naics || (!state && !msa)) return null;
    const manifest = getDatasetManifest('oews_2025_national');
    if (!manifest || manifest.status !== 'LOCAL_INDEX') return null;

    const keysToTry = [`${naics}_${state}_${msa}`, `${naics}_${state}`];
    for (const key of keysToTry) {
        const found = COMPACT_OEWS_INDEX[key];
        if (found) {
             return {
                 wage: {
                     value: found.annual_mean_wage,
                     unit: 'WAGE',
                     evidence: { sourceType: 'REFERENCE_DATA', sourceLabel: 'BLS OEWS 2025', evidenceStatus: 'BENCHMARK', confidence: 1.0, confidenceLevel: 'High', lastUpdated: new Date().toISOString() }
                 }
             };
        }
    }
    return null;
  }

  private static getACSReference(state: string, county: string, city: string): { population: MarketEstimate, households: MarketEstimate } | null {
     if (!state) return null;
     const manifest = getDatasetManifest('acs_2023_5yr');
     if (!manifest || manifest.status !== 'LOCAL_INDEX') return null;

     const keysToTry = [`${state}_${county}_${city}`, `${state}_${county}`];
     for (const key of keysToTry) {
         const found = COMPACT_ACS_INDEX[key];
         if (found) {
             return {
                 population: {
                     value: found.population,
                     unit: 'POPULATION',
                     evidence: { sourceType: 'REFERENCE_DATA', sourceLabel: 'US Census ACS 2023', evidenceStatus: 'BENCHMARK', confidence: 1.0, confidenceLevel: 'High', lastUpdated: new Date().toISOString() }
                 },
                 households: {
                     value: found.households,
                     unit: 'HOUSEHOLDS',
                     evidence: { sourceType: 'REFERENCE_DATA', sourceLabel: 'US Census ACS 2023', evidenceStatus: 'BENCHMARK', confidence: 1.0, confidenceLevel: 'High', lastUpdated: new Date().toISOString() }
                 }
             };
         }
     }
     return null;
  }

  private static getBEAReference(state: string, msa: string): { gdp: MarketEstimate } | null {
     if (!state) return null;
     const manifest = getDatasetManifest('bea_gdp_2025');
     if (!manifest || manifest.status !== 'LOCAL_INDEX') return null;

     const keysToTry = [`${state}_${msa}`, state];
     for (const key of keysToTry) {
         const found = COMPACT_BEA_INDEX[key];
         if (found && found.gdp) {
             return {
                 gdp: {
                     value: found.gdp,
                     unit: 'INDEX',
                     evidence: { sourceType: 'REFERENCE_DATA', sourceLabel: 'BEA 2025', evidenceStatus: 'BENCHMARK', confidence: 1.0, confidenceLevel: 'High', lastUpdated: new Date().toISOString() }
                 }
             }
         }
     }
     return null;
  }

  /**
   * Computes the 5 priority local benchmarks strictly grounded in actual observed data.
   * Never fabricates numbers; falls back to INSUFFICIENT_DATA when insufficient observations exist.
   */
  static computeLocalBenchmarks(
    competitors: (MarketCompetitor | any)[] = [],
    geographicScope: GeographicScope = 'SAME_CITY_SAME_RADIUS',
    lang: 'es' | 'en' = 'es'
  ): LocalBenchmarkSet {
    const isEn = lang === 'en';
    const now = new Date().toISOString();
    const count = Array.isArray(competitors) ? competitors.length : 0;

    // Determine data provider attribution
    const hasGeoapify = competitors.some(c => (c.source || '').includes('geoapify'));
    const hasOsm = competitors.some(c => (c.source || '').includes('openstreetmap'));
    const primarySource = hasGeoapify && hasOsm 
      ? (isEn ? 'Geoapify & OpenStreetMap (Local Radar)' : 'Geoapify y OpenStreetMap (Radar Local)')
      : hasGeoapify 
        ? (isEn ? 'Geoapify Places API' : 'Geoapify Places API')
        : count > 0 
          ? (isEn ? 'OpenStreetMap Overpass Layer' : 'Capa OpenStreetMap Overpass')
          : (isEn ? 'Local Radar' : 'Radar Local');

    // 1. competitorCount (VERIFIED from direct map layer POI records)
    const competitorCount: LocalBenchmarkMetric<number> = {
      value: count,
      evidenceStatus: count > 0 ? 'VERIFIED' : 'INSUFFICIENT_DATA',
      source: primarySource,
      geographicScope,
      sampleSize: count,
      confidence: count > 0 ? 0.95 : 0.0,
      description: isEn 
        ? `${count} confirmed competitor establishments in local search boundary.`
        : `${count} establecimientos competidores confirmados en el radio de búsqueda local.`
    };

    // 2. competitorWebsiteRate (DERIVED mathematical percentage from observed POIs)
    let websiteRateMetric: LocalBenchmarkMetric<number | null>;
    if (count >= 2) {
      const withWeb = competitors.filter(c => Boolean(c.hasWebsite || (c.website && c.website !== 'NOT_AVAILABLE'))).length;
      const rate = Math.round((withWeb / count) * 100);
      websiteRateMetric = {
        value: rate,
        evidenceStatus: 'DERIVED',
        source: primarySource,
        geographicScope,
        sampleSize: count,
        confidence: 0.9,
        description: isEn
          ? `${rate}% (${withWeb}/${count}) of local competitors maintain an active registered website.`
          : `${rate}% (${withWeb}/${count}) de los competidores locales cuenta con sitio web registrado.`
      };
    } else {
      websiteRateMetric = {
        value: null,
        evidenceStatus: 'INSUFFICIENT_DATA',
        source: primarySource,
        geographicScope,
        sampleSize: count,
        confidence: 0.0,
        description: isEn
          ? 'Requires at least 2 mapped competitors in radius to compute website adoption rate.'
          : 'Se requieren al menos 2 competidores mapeados en el radio para calcular la tasa de adopción web.'
      };
    }

    // 3. competitorDensity (DERIVED category from count within 6 km)
    let densityMetric: LocalBenchmarkMetric<'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA'>;
    if (count >= 6) {
      densityMetric = {
        value: 'HIGH',
        evidenceStatus: 'DERIVED',
        source: primarySource,
        geographicScope,
        sampleSize: count,
        confidence: 0.9,
        description: isEn ? 'High competitor density (>= 6 POIs in 6 km radius).' : 'Alta densidad competitiva (>= 6 establecimientos en 6 km).'
      };
    } else if (count >= 3) {
      densityMetric = {
        value: 'MEDIUM',
        evidenceStatus: 'DERIVED',
        source: primarySource,
        geographicScope,
        sampleSize: count,
        confidence: 0.85,
        description: isEn ? 'Moderate competitor density (3-5 POIs in 6 km radius).' : 'Densidad competitiva moderada (3-5 establecimientos en 6 km).'
      };
    } else if (count >= 1) {
      densityMetric = {
        value: 'LOW',
        evidenceStatus: 'DERIVED',
        source: primarySource,
        geographicScope,
        sampleSize: count,
        confidence: 0.85,
        description: isEn ? 'Low competitor density (1-2 POIs in 6 km radius).' : 'Baja densidad competitiva (1-2 establecimientos en 6 km).'
      };
    } else {
      densityMetric = {
        value: 'INSUFFICIENT_DATA',
        evidenceStatus: 'INSUFFICIENT_DATA',
        source: primarySource,
        geographicScope,
        sampleSize: 0,
        confidence: 0.0,
        description: isEn ? 'Insufficient POI density data in active territory.' : 'Datos de densidad insuficientes en el territorio activo.'
      };
    }

    // 4. averageDistanceKm (DERIVED mean of observed coordinates / distances)
    const validDistances = competitors
      .map(c => typeof c.distanceKm === 'number' ? c.distanceKm : typeof c.distance === 'number' ? c.distance : null)
      .filter((d): d is number => d !== null && !isNaN(d) && d >= 0);

    let avgDistMetric: LocalBenchmarkMetric<number | null>;
    if (validDistances.length >= 1) {
      const avg = parseFloat((validDistances.reduce((a, b) => a + b, 0) / validDistances.length).toFixed(1));
      avgDistMetric = {
        value: avg,
        evidenceStatus: 'DERIVED',
        source: primarySource,
        geographicScope,
        sampleSize: validDistances.length,
        confidence: 0.9,
        description: isEn
          ? `Average distance of ${avg} km across ${validDistances.length} mapped competitors.`
          : `Distancia media de ${avg} km calculada sobre ${validDistances.length} competidores mapeados.`
      };
    } else {
      avgDistMetric = {
        value: null,
        evidenceStatus: 'INSUFFICIENT_DATA',
        source: primarySource,
        geographicScope,
        sampleSize: 0,
        confidence: 0.0,
        description: isEn ? 'Distance benchmarks unavailable without coordinate POIs.' : 'Benchmark de distancia no disponible sin coordenadas de competidores.'
      };
    }

    // 5. rating / review benchmarks (DERIVED strictly when >= 2 valid ratings / reviews exist)
    const validRatings = competitors
      .map(c => typeof c.rating === 'number' ? c.rating : null)
      .filter((r): r is number => r !== null && !isNaN(r) && r > 0);

    let ratingMetric: LocalBenchmarkMetric<number | null>;
    if (validRatings.length >= 2) {
      const avgRating = parseFloat((validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1));
      ratingMetric = {
        value: avgRating,
        evidenceStatus: 'DERIVED',
        source: isEn ? `${primarySource} (Ratings)` : `${primarySource} (Calificaciones)`,
        geographicScope,
        sampleSize: validRatings.length,
        confidence: 0.85,
        description: isEn
          ? `Average public rating of ${avgRating}★ across ${validRatings.length} competitors.`
          : `Calificación promedio de ${avgRating}★ calculada sobre ${validRatings.length} competidores.`
      };
    } else {
      ratingMetric = {
        value: null,
        evidenceStatus: 'INSUFFICIENT_DATA',
        source: primarySource,
        geographicScope,
        sampleSize: validRatings.length,
        confidence: 0.0,
        description: isEn ? 'Insufficient comparable ratings in local map layer.' : 'Calificaciones comparables insuficientes en la capa local.'
      };
    }

    const validReviews = competitors
      .map(c => typeof c.userRatingCount === 'number' ? c.userRatingCount : typeof c.reviewCount === 'number' ? c.reviewCount : null)
      .filter((rv): rv is number => rv !== null && !isNaN(rv) && rv >= 0);

    let reviewVolMetric: LocalBenchmarkMetric<number | null>;
    if (validReviews.length >= 2) {
      const avgReviews = Math.round(validReviews.reduce((a, b) => a + b, 0) / validReviews.length);
      reviewVolMetric = {
        value: avgReviews,
        evidenceStatus: 'DERIVED',
        source: isEn ? `${primarySource} (Reviews)` : `${primarySource} (Reseñas)`,
        geographicScope,
        sampleSize: validReviews.length,
        confidence: 0.85,
        description: isEn
          ? `Average review volume of ${avgReviews} reviews across ${validReviews.length} competitors.`
          : `Volumen promedio de ${avgReviews} reseñas calculado sobre ${validReviews.length} competidores.`
      };
    } else {
      reviewVolMetric = {
        value: null,
        evidenceStatus: 'INSUFFICIENT_DATA',
        source: primarySource,
        geographicScope,
        sampleSize: validReviews.length,
        confidence: 0.0,
        description: isEn ? 'Insufficient review counts in local map layer.' : 'Volumen de reseñas insuficiente en la capa local.'
      };
    }

    return {
      competitorCount,
      competitorWebsiteRate: websiteRateMetric,
      competitorDensity: densityMetric,
      averageDistanceKm: avgDistMetric,
      ratingBenchmark: ratingMetric,
      reviewVolumeBenchmark: reviewVolMetric,
      generatedAt: now
    };
  }

  static getBaselineEstablishments(naics: string, locationId: string): MarketEstimate {
    // 1. Check Manifest
    const cbpManifest = getDatasetManifest('cbp_2023_us');
    
    if (cbpManifest && cbpManifest.status === 'LOCAL_INDEX') {
      const searchKey = `${naics}_${locationId}`;
      const found = COMPACT_CBP_INDEX[searchKey];
      if (found) {
        return {
          value: found.establishments,
          unit: 'ESTABLISHMENTS',
          evidence: {
            sourceType: 'REFERENCE_DATA',
            sourceLabel: 'US Census Bureau (CBP 2023)',
            evidenceStatus: 'BENCHMARK',
            confidence: 1.0,
            confidenceLevel: 'High',
            lastUpdated: new Date().toISOString()
          }
        };
      }
    }

    // Fallback if data is not actively loaded
    return {
      value: "Unknown",
      unit: 'ESTABLISHMENTS',
      evidence: {
        sourceType: 'REFERENCE_DATA',
        sourceLabel: 'Local Reference Missing',
        evidenceStatus: 'INSUFFICIENT_DATA',
        confidence: 0,
        confidenceLevel: 'Low',
        lastUpdated: new Date().toISOString()
      }
    };
  }

  static estimateMarketOpportunity(naicsCandidates: string[], city: string): OpportunityEstimate {
    // Compatibility function for existing dashboard code
    return this.getMarketBenchmark(naicsCandidates[0], city, '', '', naicsCandidates, '').market_reference || {
      range: { min: 0, max: 0, unit: 'USD/month' },
      observableSignal: null,
      conversionRange: { min: 0, max: 0 },
      ticketReference: 0,
      formula: 'Missing Reference Data',
      assumptions: ['No reference data available'],
      evidence: {
        sourceType: 'BENCHMARK_MODEL',
        sourceLabel: 'Bvelt Local Market Model',
        evidenceStatus: 'INSUFFICIENT_DATA',
        confidence: 0,
        confidenceLevel: 'Low',
        lastUpdated: new Date().toISOString()
      }
    };
  }
}
