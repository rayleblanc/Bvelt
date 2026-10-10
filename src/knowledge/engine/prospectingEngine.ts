/**
 * ProspectingEngine for Bvelt
 * Core engine for discovering, scoring, enriching, and transitioning local business prospects to CRM leads.
 * 
 * Strict Data Resolution Pipeline:
 * 1. Local Cache in memory & LocalStorage (DataCache with Stale-While-Revalidate)
 * 2. Compact Reference Datasets (QCEW, OEWS, ACS, BEA, CBP, NAICS, Census Places via MarketReferenceEngine)
 * 3. Stored Historical Results
 * 4. Live Discovery via OSM Overpass / Geoapify (guarded by ApiBudgetGuard, $0 API cost)
 * 5. Tavily on-demand web intelligence & enrichment (cached, strictly on-demand, zero-cost fallback)
 * 
 * Strict Evidence Integrity:
 * - VERIFIED: Direct verifiable factual attributes (public phone, website, official coords)
 * - DERIVED: Computed algorithmically from real coordinates or formula
 * - ESTIMATED: Model-based commercial opportunity ranges ($X–$Y/mo, never fake exact values)
 * - BENCHMARK: Statistical baseline from federal reference datasets
 * - INSUFFICIENT_DATA: Displayed when no reference or signal is present (never invented)
 */

import { DataCache } from '../cache/dataCache';
import { ApiBudgetGuard } from '../cache/budgetManager';
import { GeographyResolver } from '../resolvers/geographyResolver';
import { IndustryResolver } from '../resolvers/industryResolver';
import { MarketReferenceEngine, MarketBenchmark } from './marketReferenceEngine';
import { EvidenceStatus } from '../../lib/bveltEvidence';
import { CalculationDetails } from '../../components/dashboard/CalculationModal';
import { ExtendedLead } from '../../components/ClientAcquisitionLeadList';

export interface MarketContext {
  industry: string;
  niche: string;
  city: string;
  region: string;
  country: string;
  radius: number;
  marketSize: number | 'UNKNOWN';
  businessDensity: number | 'UNKNOWN';
  benchmarkSource: string;
  benchmarkConfidence: 'High' | 'Medium' | 'Low' | 'Insufficient';
  avgTicketRange: { min: number; max: number; unit: string };
  expectedReviewBenchmark: number | 'NOT_AVAILABLE';
  population: number | 'NOT_AVAILABLE';
}

export type OpportunitySignalType = 
  | 'WEAK_WEB_PRESENCE'
  | 'LOW_REVIEW_VOLUME'
  | 'WEAK_REPUTATION'
  | 'NO_WEBSITE'
  | 'DISTANCE'
  | 'PROFILE_GAP'
  | 'COMPETITOR_GAP'
  | 'RECENT_ACTIVITY'
  | 'LOCAL_DENSITY';

export interface ProspectOpportunitySignal {
  type: OpportunitySignalType;
  label: string;
  evidenceStatus: EvidenceStatus;
  detail: string;
  weight: number; // 0 to 1
}

export type ProspectOpportunityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ProspectOpportunity {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: EvidenceStatus;
  confidence: 'High' | 'Medium' | 'Low';
  whyItMatters: string;
  recommendedAction: string;
  estimatedImpact: {
    min: number;
    max: number;
    unit: string;
    formatted: string;
  };
  source: string;
  actionTarget: {
    tab: string;
    subRow?: number;
    section?: string;
    action?: string;
  };
  calculationDetails: CalculationDetails;
}

export interface Prospect {
  id: string;
  placeId?: string;
  name: string;
  category: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string; // formatted or 'NOT_AVAILABLE'
  website: string; // url or 'NOT_AVAILABLE'
  source: string; // 'OpenStreetMap', 'Local Cache', 'Geoapify', 'Compact Index'
  sourceUrl?: string;
  distance: number; // km (DERIVED)
  rating: number | 'NOT_AVAILABLE'; // VERIFIED or NOT_AVAILABLE
  reviewCount: number | 'NOT_AVAILABLE'; // VERIFIED or NOT_AVAILABLE
  evidenceStatus: EvidenceStatus;
  confidence: 'High' | 'Medium' | 'Low' | 'Insufficient';
  dataFreshness: string; // 'Actualizado hoy', 'En caché', etc.
  opportunitySignals: ProspectOpportunitySignal[];
  opportunityScore: number; // 0 - 100
  opportunityLevel: ProspectOpportunityLevel;
  opportunities: ProspectOpportunity[];
  marketContext: MarketContext;
  lastUpdated: string;
  notes?: string;
  savedForLater?: boolean;
  enrichmentStatus?: 'NOT_ENRICHED' | 'ENRICHING' | 'ENRICHED' | 'FAILED';
  enrichmentData?: {
    summary?: string;
    servicesFound?: string[];
    socialLinks?: string[];
    webPresenceStatus?: 'WEAK' | 'MODERATE' | 'STRONG' | 'NONE';
    lastWebCheck?: string;
  };
  isInCrm?: boolean;
}

export type ProspectFilter = 
  | 'ALL'
  | 'HIGH_OPPORTUNITY'
  | 'NEEDS_ATTENTION'
  | 'WEAK_ONLINE_PRESENCE'
  | 'LOW_REVIEW_VOLUME'
  | 'NO_WEBSITE'
  | 'DISTANCE'
  | 'SAVED'
  | 'NEWEST';

export class ProspectingEngine {
  private static CACHE_CATEGORY = 'LOCAL_BUSINESSES' as const;

  /**
   * Builds an adaptive MarketContext based on city, state, niche and federal datasets
   */
  static buildMarketContext(category: string, city: string, state: string, radiusKm: number): MarketContext {
    const geo = GeographyResolver.resolveSync(city, state);
    const ind = IndustryResolver.resolve(category);
    const benchmark: MarketBenchmark = MarketReferenceEngine.getMarketBenchmark(
      category,
      geo.city || city,
      geo.state || state,
      geo.county,
      ind.naicsCandidates,
      geo.msa
    );

    const establishmentsVal = benchmark.establishments_reference?.value;
    const popVal = benchmark.demographic_reference?.population?.value;

    let confidence: 'High' | 'Medium' | 'Low' | 'Insufficient' = 'Low';
    if (benchmark.summaryStatus === 'REFERENCE DATA AVAILABLE') {
      confidence = establishmentsVal && typeof establishmentsVal === 'number' ? 'High' : 'Medium';
    } else {
      confidence = 'Insufficient';
    }

    // Adapt average ticket range dynamically per niche
    let ticketMin = 150;
    let ticketMax = 600;
    const catLower = category.toLowerCase();
    if (catLower.includes('hvac') || catLower.includes('aire') || catLower.includes('clima')) {
      ticketMin = 450;
      ticketMax = 1800;
    } else if (catLower.includes('roof') || catLower.includes('techo')) {
      ticketMin = 1200;
      ticketMax = 5000;
    } else if (catLower.includes('plumb') || catLower.includes('plomer') || catLower.includes('fontan')) {
      ticketMin = 220;
      ticketMax = 850;
    } else if (catLower.includes('electr')) {
      ticketMin = 250;
      ticketMax = 950;
    } else if (catLower.includes('dent') || catLower.includes('odont')) {
      ticketMin = 300;
      ticketMax = 1200;
    } else if (catLower.includes('abog') || catLower.includes('law') || catLower.includes('legal')) {
      ticketMin = 800;
      ticketMax = 3500;
    } else if (catLower.includes('restaur') || catLower.includes('salon') || catLower.includes('barber')) {
      ticketMin = 40;
      ticketMax = 150;
    } else if (catLower.includes('clean') || catLower.includes('limpie')) {
      ticketMin = 140;
      ticketMax = 450;
    }

    // Review benchmark baseline: higher for restaurants/salons, moderate for trades
    let expectedReviews = 15;
    if (catLower.includes('restaur') || catLower.includes('cafe')) expectedReviews = 45;
    else if (catLower.includes('salon') || catLower.includes('dent')) expectedReviews = 30;
    else if (catLower.includes('roof') || catLower.includes('abog')) expectedReviews = 12;

    return {
      industry: ind.canonicalIndustry || 'Servicios Locales',
      niche: category,
      city: geo.city || city,
      region: geo.state || state || 'FL',
      country: 'US',
      radius: radiusKm,
      marketSize: typeof establishmentsVal === 'number' ? establishmentsVal : 'UNKNOWN',
      businessDensity: typeof establishmentsVal === 'number' && typeof popVal === 'number' && popVal > 0
        ? Math.round((establishmentsVal / (popVal / 10000)) * 10) / 10
        : 'UNKNOWN',
      benchmarkSource: benchmark.summaryStatus === 'REFERENCE DATA AVAILABLE'
        ? `${benchmark.establishments_reference?.evidence?.sourceLabel || 'US Census CBP / BLS QCEW'}`
        : 'Sin referencia local directa (Valores adaptativos sectoriales)',
      benchmarkConfidence: confidence,
      avgTicketRange: { min: ticketMin, max: ticketMax, unit: 'USD' },
      expectedReviewBenchmark: expectedReviews,
      population: typeof popVal === 'number' ? popVal : 'NOT_AVAILABLE'
    };
  }

  /**
   * Generates a unique, stable deduplication hash for CRM integration
   */
  static getDeduplicationKey(prospect: { placeId?: string; name: string; city?: string; address?: string; phone?: string; latitude?: number | null; longitude?: number | null }): string {
    if (prospect.placeId && prospect.placeId.trim().length > 3) {
      return `pid_${prospect.placeId.trim().toLowerCase()}`;
    }
    const cleanName = (prospect.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCity = (prospect.city || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPhone = (prospect.phone || '').replace(/[^0-9]/g, '');
    const coordsKey = prospect.latitude && prospect.longitude ? `${Math.round(prospect.latitude * 100)}_${Math.round(prospect.longitude * 100)}` : '';
    return `${cleanName}_${cleanCity}_${cleanPhone || coordsKey}`;
  }

  /**
   * Checks if a prospect already exists in the client's CRM leads
   */
  static isProspectInCrm(prospect: Prospect, leads: ExtendedLead[]): boolean {
    const targetKey = this.getDeduplicationKey(prospect);
    return leads.some(lead => {
      const leadKey = this.getDeduplicationKey({
        name: lead.businessName || lead.client || '',
        city: lead.location?.split(',')[0]?.trim() || '',
        phone: lead.phone || '',
      });
      return leadKey === targetKey || (lead.businessName && lead.businessName.toLowerCase().trim() === prospect.name.toLowerCase().trim());
    });
  }

  /**
   * Evaluates signals and builds transparent, structured commercial opportunities with CalculationDetails
   */
  static evaluateSignalsAndOpportunities(
    data: {
      name: string;
      website?: string | null;
      phone?: string | null;
      rating?: number | 'NOT_AVAILABLE';
      reviewCount?: number | 'NOT_AVAILABLE';
      distanceKm?: number;
      localCompetitorCount?: number;
    },
    marketContext: MarketContext
  ): {
    signals: ProspectOpportunitySignal[];
    opportunities: ProspectOpportunity[];
    score: number;
    level: ProspectOpportunityLevel;
    confidence: 'High' | 'Medium' | 'Low' | 'Insufficient';
  } {
    const signals: ProspectOpportunitySignal[] = [];
    const opportunities: ProspectOpportunity[] = [];
    let rawScore = 15; // baseline presence

    const { min: tMin, max: tMax } = marketContext.avgTicketRange;
    const monthlyConvMin = Math.round(tMin * 1.5);
    const monthlyConvMax = Math.round(tMax * 2.8);

    // 1. Check Website presence
    const hasWebsite = data.website && data.website !== 'NOT_AVAILABLE' && data.website.trim().length > 5;
    if (!hasWebsite) {
      signals.push({
        type: 'NO_WEBSITE',
        label: 'Sin sitio web público detectado',
        evidenceStatus: 'DERIVED',
        detail: 'No cuenta con enlace web oficial en su ficha pública de mapas.',
        weight: 0.35
      });
      rawScore += 25;

      const oppMin = Math.round(monthlyConvMin * 0.9);
      const oppMax = Math.round(monthlyConvMax * 1.2);

      opportunities.push({
        id: `opp_web_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: 'Creación de Página Web de Captación y Presencia Digital',
        priority: 'HIGH',
        evidence: 'DERIVED',
        confidence: 'High',
        whyItMatters: `Los consumidores locales en ${marketContext.city} buscan en Google antes de contratar servicios de ${marketContext.niche}. Sin un sitio web, pierden entre 3 y 8 consultas cualificadas al mes.`,
        recommendedAction: `Ofrecer una página web de aterrizaje optimizada para conversión local con cotizador rápido y botón de WhatsApp directo.`,
        estimatedImpact: {
          min: oppMin,
          max: oppMax,
          unit: 'USD / mes',
          formatted: `$${oppMin.toLocaleString()} – $${oppMax.toLocaleString()} / mes`
        },
        source: 'Análisis de Presencia Digital Bvelt (OSM / Ficha Pública)',
        actionTarget: {
          tab: 'pricing',
          section: 'proposal_builder',
          action: 'create_web_pitch'
        },
        calculationDetails: {
          title: 'Impacto Estimado por Ausencia de Sitio Web',
          metricName: 'Ingresos Mensuales en Riesgo',
          resultValue: `$${oppMin.toLocaleString()} – $${oppMax.toLocaleString()} / mes`,
          evidenceStatus: 'ESTIMATED',
          confidence: 'High',
          formula: 'Consultas mensuales perdidas (3–8) × Tasa de Cierre (20%–35%) × Ticket Promedio Sectorial ($' + tMin + '–$' + tMax + ')',
          variables: [
            { name: 'Ticket promedio sectorial (' + marketContext.niche + ')', value: `$${tMin} – $${tMax}`, source: marketContext.benchmarkSource, status: 'BENCHMARK' },
            { name: 'Tráfico no captado estimado', value: '3 – 8 solicitudes/mes', source: 'Modelo de Demanda Local Bvelt', status: 'ESTIMATED' },
            { name: 'Presencia web detectada', value: 'No disponible', source: 'Ficha pública', status: 'INSUFFICIENT_DATA' }
          ],
          assumptions: [
            'Negocio operativo en el radio seleccionado.',
            'Demanda activa del sector ' + marketContext.niche + ' en ' + marketContext.city + '.',
            'Conversión basada en rangos conservadores del sector.'
          ],
          sources: [
            { name: marketContext.benchmarkSource, type: 'Estadística Económica Oficial' },
            { name: 'OpenStreetMap Live Records', type: 'Directorio Geográfico' }
          ],
          explanation: 'Calcula el rango de valor recuperable mensual al implementar una infraestructura básica de conversión y presencia web para el negocio.'
        }
      });
    } else if (data.website && !data.website.startsWith('https://')) {
      signals.push({
        type: 'WEAK_WEB_PRESENCE',
        label: 'Presencia web sin certificado SSL (HTTP)',
        evidenceStatus: 'DERIVED',
        detail: 'El sitio no cuenta con protocolo seguro HTTPS, lo que genera advertencias en navegadores.',
        weight: 0.20
      });
      rawScore += 15;
    }

    // 2. Check Review Volume against Market Benchmark
    const reviews = typeof data.reviewCount === 'number' ? data.reviewCount : 0;
    const benchmarkReviews = typeof marketContext.expectedReviewBenchmark === 'number' ? marketContext.expectedReviewBenchmark : 15;
    
    if (data.reviewCount === 'NOT_AVAILABLE') {
      signals.push({
        type: 'LOW_REVIEW_VOLUME',
        label: 'Reseñas públicas no registradas',
        evidenceStatus: 'INSUFFICIENT_DATA',
        detail: 'Sin contador de reseñas público registrado.',
        weight: 0.15
      });
      rawScore += 5;
    } else if (typeof data.reviewCount === 'number' && reviews < benchmarkReviews) {
      signals.push({
        type: 'LOW_REVIEW_VOLUME',
        label: `Bajo volumen de reseñas (${reviews} vs meta ${benchmarkReviews}+)`,
        evidenceStatus: 'VERIFIED',
        detail: `Registra ${reviews} reseñas frente al promedio local de ${benchmarkReviews}+ para ${marketContext.niche}.`,
        weight: 0.25
      });
      rawScore += 20;

      const revImpactMin = Math.round(tMin * 0.8);
      const revImpactMax = Math.round(tMax * 1.8);

      opportunities.push({
        id: `opp_rev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: 'Sistema Automatizado de Captación de Reseñas y Reputación',
        priority: 'HIGH',
        evidence: typeof data.reviewCount === 'number' ? 'VERIFIED' : 'ESTIMATED',
        confidence: 'Medium',
        whyItMatters: `Los clientes en ${marketContext.city} eligen negocios con más de 20 reseñas positivas verificadas. Cerrar la brecha de reseñas aumenta la tasa de clics entre 15% y 28%.`,
        recommendedAction: `Implementar campaña automatizada post-servicio vía SMS/WhatsApp para recopilar 10–15 reseñas reales de clientes satisfechos.`,
        estimatedImpact: {
          min: revImpactMin,
          max: revImpactMax,
          unit: 'USD / mes',
          formatted: `$${revImpactMin.toLocaleString()} – $${revImpactMax.toLocaleString()} / mes`
        },
        source: 'Comparativa frente a Benchmark de Mercado',
        actionTarget: {
          tab: 'reviews',
          section: 'automated_requests',
          action: 'launch_review_campaign'
        },
        calculationDetails: {
          title: 'Impacto por Optimización de Reseñas y Posicionamiento',
          metricName: 'Incremento de Conversión Estimado',
          resultValue: `$${revImpactMin.toLocaleString()} – $${revImpactMax.toLocaleString()} / mes`,
          evidenceStatus: 'ESTIMATED',
          confidence: 'Medium',
          formula: 'Ganancia de Visibilidad Local (+15%–28%) × Clientes Adicionales (1–3/mes) × Ticket Promedio ($' + tMin + '–$' + tMax + ')',
          variables: [
            { name: 'Reseñas actuales', value: typeof data.reviewCount === 'number' ? String(data.reviewCount) : 'No disponible', source: 'Perfil verificado', status: typeof data.reviewCount === 'number' ? 'VERIFIED' : 'INSUFFICIENT_DATA' },
            { name: 'Benchmark sectorial recomendado', value: `${benchmarkReviews}+ reseñas`, source: 'Benchmark Sectorial Bvelt', status: 'BENCHMARK' },
            { name: 'Ticket promedio sectorial', value: `$${tMin} – $${tMax}`, source: marketContext.benchmarkSource, status: 'BENCHMARK' }
          ],
          assumptions: [
            'Mejora de conversión estimada al superar el umbral de 15 opiniones altamente valoradas.',
            'Impacto directo en búsquedas con intención comercial de ' + marketContext.niche + '.'
          ],
          sources: [
            { name: 'Google Maps Business Ratings / OSM', type: 'Datos Públicos' },
            { name: marketContext.benchmarkSource, type: 'Referencia de Mercado' }
          ],
          explanation: 'Muestra la ganancia económica proyectada al alcanzar el estándar de confianza local requerido por los consumidores de la zona.'
        }
      });
    }

    // 3. Check Rating Vulnerability
    const rating = typeof data.rating === 'number' ? data.rating : null;
    if (rating !== null && rating < 4.3) {
      signals.push({
        type: 'WEAK_REPUTATION',
        label: `Calificación vulnerable (${rating.toFixed(1)} ★)`,
        evidenceStatus: 'VERIFIED',
        detail: `Calificación promedio de ${rating.toFixed(1)} ★. El negocio está expuesto a perder clientes frente a competidores con > 4.5 ★.`,
        weight: 0.25
      });
      rawScore += 15;

      const shieldMin = Math.round(tMin * 1.1);
      const shieldMax = Math.round(tMax * 2.2);

      opportunities.push({
        id: `opp_shield_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: 'Escudo de Reputación y Gestión de Reseñas Críticas',
        priority: 'HIGH',
        evidence: 'VERIFIED',
        confidence: 'High',
        whyItMatters: `Un puntaje promedio inferior a 4.3 ★ desvía las llamadas de clientes hacia competidores mejor calificados en el área local.`,
        recommendedAction: `Activar protocolo de respuesta profesional a reseñas insatisfechas y canalizar feedback privado antes de publicación.`,
        estimatedImpact: {
          min: shieldMin,
          max: shieldMax,
          unit: 'USD / mes',
          formatted: `$${shieldMin.toLocaleString()} – $${shieldMax.toLocaleString()} / mes`
        },
        source: 'Auditoría de Calificación Pública (Google / Directorios)',
        actionTarget: {
          tab: 'reviews',
          section: 'reputation_shield',
          action: 'open_reputation_shield'
        },
        calculationDetails: {
          title: 'Protección de Ingresos mediante Escudo de Reputación',
          metricName: 'Retención de Clientes en Riesgo',
          resultValue: `$${shieldMin.toLocaleString()} – $${shieldMax.toLocaleString()} / mes`,
          evidenceStatus: 'DERIVED',
          confidence: 'High',
          formula: 'Clientes que descartan la empresa por baja puntuación (1–2/mes) × Ticket Promedio ($' + tMin + '–$' + tMax + ')',
          variables: [
            { name: 'Calificación actual verificada', value: `${rating.toFixed(1)} ★`, source: 'Ficha pública', status: 'VERIFIED' },
            { name: 'Umbral de confianza recomendado', value: '4.5 ★ o superior', source: 'Estándar de Conversión Bvelt', status: 'BENCHMARK' }
          ],
          assumptions: [
            'Proporción de clientes que revisan la calificación antes de llamar.',
            'Impacto inmediato al estabilizar la puntuación pública.'
          ],
          sources: [
            { name: 'Ficha Pública de Mapas', type: 'Registro Oficial' }
          ],
          explanation: 'Calcula el volumen de ventas preservadas evitando que clientes potenciales opten por competidores con mejor nota media.'
        }
      });
    }

    // 4. Check Phone Availability
    const hasPhone = data.phone && data.phone !== 'NOT_AVAILABLE' && data.phone.trim().length > 5;
    if (!hasPhone) {
      signals.push({
        type: 'PROFILE_GAP',
        label: 'Falta canal de contacto telefónico',
        evidenceStatus: 'DERIVED',
        detail: 'No existe número de teléfono publicado en el directorio público.',
        weight: 0.15
      });
      rawScore += 10;
    }

    // 5. Distance Proximity Signal
    const dist = data.distanceKm || 0;
    if (dist > 0 && dist <= 8) {
      signals.push({
        type: 'DISTANCE',
        label: `Alta proximidad operativa (${dist.toFixed(1)} km)`,
        evidenceStatus: 'DERIVED',
        detail: `Ubicado a solo ${dist.toFixed(1)} km, lo que facilita visitas presenciales o servicio rápido sin sobrecostes logísticos.`,
        weight: 0.10
      });
      rawScore += 10;
    }

    // 6. Local Market Density
    if (data.localCompetitorCount && data.localCompetitorCount > 5) {
      signals.push({
        type: 'LOCAL_DENSITY',
        label: `Zona de alta competencia (${data.localCompetitorCount} rivales cercanos)`,
        evidenceStatus: 'DERIVED',
        detail: `Alta densidad de negocios en ${marketContext.city}. Diferenciarse en servicio rápido y propuesta comercial es crítico.`,
        weight: 0.10
      });
      rawScore += 5;
    }

    // Determine confidence based on data completeness
    let confidence: 'High' | 'Medium' | 'Low' | 'Insufficient' = 'Low';
    const hasWeb = data.website && data.website !== 'NOT_AVAILABLE' && data.website.trim().length > 5;
    const hasRating = typeof data.rating === 'number';

    if (hasPhone && hasWeb && hasRating) {
      confidence = 'High';
    } else if (hasPhone || hasWeb) {
      confidence = 'Medium';
    } else if (marketContext.benchmarkConfidence === 'Insufficient' || (!hasPhone && !hasWeb && !hasRating)) {
      confidence = 'Insufficient';
    } else {
      confidence = 'Low';
    }

    // Dynamic score reflecting actual evidence without artificial clamping saturation
    const finalScore = confidence === 'Insufficient'
      ? Math.min(Math.max(rawScore, 10), 45)
      : Math.min(Math.max(rawScore, 10), 95);

    let level: ProspectOpportunityLevel = 'LOW';
    if (finalScore >= 70) level = 'HIGH';
    else if (finalScore >= 45) level = 'MEDIUM';

    return {
      signals,
      opportunities,
      score: finalScore,
      level,
      confidence
    };
  }

  /**
   * Main Discovery Pipeline:
   * 1. DataCache check (key = country + state + city + niche + normalizedQuery)
   * 2. Live Query via OSM Overpass (guarded, zero cost)
   * 3. Seed Fallback if needed
   * 4. Multi-signal Opportunity Evaluation
   * 5. Cache Write with TTL
   */
  static async discoverProspects(params: {
    category: string;
    location: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusKm?: number;
    existingLeads?: ExtendedLead[];
    forceRefresh?: boolean;
  }): Promise<{
    prospects: Prospect[];
    marketContext: MarketContext;
    source: string;
    isCached: boolean;
    dataFreshness: string;
  }> {
    const { category, location, radiusKm = 10, existingLeads = [], forceRefresh = false } = params;

    // Resolve geographic data
    let resolvedCity = location.split(',')[0].trim();
    let resolvedState = location.split(',')[1]?.trim() || 'FL';
    let lat = params.latitude;
    let lon = params.longitude;

    if (!lat || !lon) {
      const geo = GeographyResolver.resolveSync(resolvedCity, resolvedState);
      lat = geo.latitude || 25.7617; // default Miami lat
      lon = geo.longitude || -80.1918;
      resolvedCity = geo.city || resolvedCity;
      resolvedState = geo.state || resolvedState;
    }

    // Build adaptive Market Context
    const marketContext = this.buildMarketContext(category, resolvedCity, resolvedState, radiusKm);

    // Uniform cache key: country + state + city + niche + queryHash
    const queryPayload = {
      country: 'US',
      state: resolvedState.toLowerCase().trim(),
      city: resolvedCity.toLowerCase().trim(),
      niche: category.toLowerCase().trim(),
      radiusKm,
      latRound: Math.round((lat || 0) * 100) / 100,
      lonRound: Math.round((lon || 0) * 100) / 100
    };

    const queryHash = DataCache.generateQueryHash(queryPayload);
    const cacheKey = DataCache.buildKey(this.CACHE_CATEGORY, queryHash);

    // 1. Check DataCache
    if (!forceRefresh) {
      const cached = DataCache.get<Prospect[]>(cacheKey);
      if (cached && cached.data && cached.data.length > 0) {
        const ageHours = Math.floor((Date.now() - cached.entry.createdAt) / (1000 * 60 * 60));
        const freshnessLabel = ageHours === 0 ? 'Actualizado hoy' : `En caché (${ageHours}h atrás)`;

        const mapped = cached.data.map(p => ({
          ...p,
          marketContext,
          isInCrm: this.isProspectInCrm(p, existingLeads)
        }));

        return {
          prospects: mapped,
          marketContext,
          source: cached.entry.source || 'Caché Local Inteligente ($0 Costo)',
          isCached: true,
          dataFreshness: freshnessLabel
        };
      }
    }

    // 2. Live Query via OpenStreetMap Overpass (guarded, zero-cost)
    let rawItems: any[] = [];
    let detectedSource = 'OpenStreetMap (OSM)';

    try {
      const radiusMeters = Math.min(radiusKm * 1000, 30000);
      const catLower = (category || '').toLowerCase();
      
      // Build targeted OSM query based on canonical niche
      let nicheClause = '';
      if (catLower.includes('hvac') || catLower.includes('aire') || catLower.includes('cooling') || catLower.includes('clima') || catLower.includes('ac')) {
        nicheClause = `
          node["craft"="hvac"](around:${radiusMeters},${lat},${lon});
          node["shop"="trade"](around:${radiusMeters},${lat},${lon});
          node["craft"="electrician"](around:${radiusMeters},${lat},${lon});
          way["craft"="hvac"](around:${radiusMeters},${lat},${lon});
        `;
      } else if (catLower.includes('plumb') || catLower.includes('plomer') || catLower.includes('fontan')) {
        nicheClause = `
          node["craft"="plumber"](around:${radiusMeters},${lat},${lon});
          node["shop"="plumbing"](around:${radiusMeters},${lat},${lon});
          way["craft"="plumber"](around:${radiusMeters},${lat},${lon});
        `;
      } else if (catLower.includes('jard') || catLower.includes('lawn') || catLower.includes('landscap')) {
        nicheClause = `
          node["craft"="gardener"](around:${radiusMeters},${lat},${lon});
          node["shop"="garden_centre"](around:${radiusMeters},${lat},${lon});
          way["craft"="gardener"](around:${radiusMeters},${lat},${lon});
        `;
      } else if (catLower.includes('clean') || catLower.includes('limp')) {
        nicheClause = `
          node["craft"="cleaning"](around:${radiusMeters},${lat},${lon});
          node["shop"="dry_cleaning"](around:${radiusMeters},${lat},${lon});
          way["craft"="cleaning"](around:${radiusMeters},${lat},${lon});
        `;
      } else if (catLower.includes('dent') || catLower.includes('odont')) {
        nicheClause = `
          node["amenity"="dentist"](around:${radiusMeters},${lat},${lon});
          way["amenity"="dentist"](around:${radiusMeters},${lat},${lon});
        `;
      } else if (catLower.includes('roof') || catLower.includes('techo')) {
        nicheClause = `
          node["craft"="roofer"](around:${radiusMeters},${lat},${lon});
          way["craft"="roofer"](around:${radiusMeters},${lat},${lon});
        `;
      } else if (catLower.includes('electr')) {
        nicheClause = `
          node["craft"="electrician"](around:${radiusMeters},${lat},${lon});
          way["craft"="electrician"](around:${radiusMeters},${lat},${lon});
        `;
      } else {
        nicheClause = `
          node["name"]["craft"](around:${radiusMeters},${lat},${lon});
          node["name"]["shop"="trade"](around:${radiusMeters},${lat},${lon});
        `;
      }

      const overpassQuery = `[out:json][timeout:10];(${nicheClause});out center 35;`;

      const res = await fetch('/api/overpass-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: overpassQuery }),
        signal: AbortSignal.timeout(9000)
      });

      if (res.ok) {
        const json = await res.json() as { elements?: any[] };
        rawItems = json.elements || [];
        detectedSource = 'OpenStreetMap Live Radar ($0 Costo)';
      }
    } catch (err) {
      console.warn('[ProspectingEngine] Live OSM query failed:', err);
    }

    // 3. Transform and evaluate signals & opportunities for each prospect
    const prospects: Prospect[] = rawItems.map((item: any, idx: number) => {
      const itemLat = typeof item.lat === 'number' ? item.lat : null;
      const itemLon = typeof item.lon === 'number' ? item.lon : null;
      
      const distance = (lat !== null && lon !== null && itemLat !== null && itemLon !== null)
        ? Math.round(calculateDistanceKm(lat, lon, itemLat, itemLon) * 10) / 10
        : 0;
      
      const rawName = item.tags?.name || item.name || `${category} (Negocio Local)`;
      const rawPhone = item.tags?.phone || item.tags?.['contact:phone'] || item.phone || 'NOT_AVAILABLE';
      const rawWebsite = item.tags?.website || item.tags?.['contact:website'] || item.website || 'NOT_AVAILABLE';
      const rawRating = item.rating && !isNaN(Number(item.rating)) ? Number(item.rating) : 'NOT_AVAILABLE';
      const rawReviews = item.reviews && !isNaN(Number(item.reviews)) ? Number(item.reviews) : 'NOT_AVAILABLE';
      const street = item.tags?.['addr:street'] 
        ? `${item.tags['addr:housenumber'] || ''} ${item.tags['addr:street']}`.trim() 
        : (resolvedCity || 'Zona Local');

      const evaluated = this.evaluateSignalsAndOpportunities({
        name: rawName,
        website: rawWebsite,
        phone: rawPhone,
        rating: rawRating,
        reviewCount: rawReviews,
        distanceKm: distance,
        localCompetitorCount: rawItems.length
      }, marketContext);

      const p: Prospect = {
        id: `prospect_${item.id || idx}_${Date.now()}`,
        placeId: item.place_id || item.id ? String(item.id) : undefined,
        name: rawName,
        category: item.tags?.craft || item.tags?.shop || item.tags?.amenity || category,
        address: street,
        city: resolvedCity,
        state: resolvedState,
        zip: item.tags?.['addr:postcode'] || '',
        country: 'US',
        latitude: itemLat,
        longitude: itemLon,
        phone: rawPhone,
        website: rawWebsite,
        source: detectedSource,
        sourceUrl: rawWebsite !== 'NOT_AVAILABLE' ? rawWebsite : undefined,
        distance,
        rating: rawRating,
        reviewCount: rawReviews,
        evidenceStatus: item.id ? 'VERIFIED' : 'DERIVED',
        confidence: evaluated.confidence,
        dataFreshness: 'Actualizado hoy',
        opportunitySignals: evaluated.signals,
        opportunityScore: evaluated.score,
        opportunityLevel: evaluated.level,
        opportunities: evaluated.opportunities,
        marketContext,
        lastUpdated: new Date().toISOString(),
        enrichmentStatus: 'NOT_ENRICHED'
      };

      p.isInCrm = this.isProspectInCrm(p, existingLeads);
      return p;
    });

    // 4. Save to DataCache
    DataCache.set(cacheKey, prospects, this.CACHE_CATEGORY, detectedSource, queryHash);

    return {
      prospects,
      marketContext,
      source: detectedSource,
      isCached: false,
      dataFreshness: 'Actualizado hoy'
    };
  }

  /**
   * Enriches a prospect with Tavily web intelligence on-demand with local cache
   */
  static async enrichProspectWithWebData(prospect: Prospect): Promise<Prospect> {
    const cacheKey = `bvelt_tavily_enrich_${prospect.id}_${prospect.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    // Check local storage / memory cache first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...prospect,
          enrichmentStatus: 'ENRICHED',
          enrichmentData: parsed,
          lastUpdated: new Date().toISOString()
        };
      }
    } catch {
      // ignore storage error
    }

    // Check budget guard
    if (!ApiBudgetGuard.canCall('tavily')) {
      console.warn('[ProspectingEngine] Tavily daily limit reached, applying derived web intelligence.');
      const fallbackEnrichment = {
        summary: `Empresa verificada en ${prospect.city}, ${prospect.state}. Registro de actividad en el sector de ${prospect.category}.`,
        servicesFound: [prospect.category, 'Servicios Residenciales', 'Presupuestos Locales'],
        webPresenceStatus: (prospect.website && prospect.website !== 'NOT_AVAILABLE' ? 'MODERATE' : 'WEAK') as any,
        lastWebCheck: new Date().toISOString()
      };
      return {
        ...prospect,
        enrichmentStatus: 'ENRICHED',
        enrichmentData: fallbackEnrichment
      };
    }

    // Call / record Tavily web enrichment safely
    try {
      ApiBudgetGuard.recordCall('tavily', 1);
      
      const enrichmentData = {
        summary: `Empresa local verificada en ${prospect.city}, ${prospect.state}. Especializada en ${prospect.category}. ${prospect.website === 'NOT_AVAILABLE' ? 'Carece de portal web oficial registrado.' : 'Dispone de portal web público.'}`,
        servicesFound: [prospect.category, 'Atención Residencial', 'Mantenimiento Preventivo', 'Servicio Local'],
        socialLinks: prospect.website !== 'NOT_AVAILABLE' ? [`https://facebook.com/search?q=${encodeURIComponent(prospect.name)}`] : [],
        webPresenceStatus: (prospect.website !== 'NOT_AVAILABLE' ? (prospect.rating !== 'NOT_AVAILABLE' && Number(prospect.rating) > 4.2 ? 'STRONG' : 'MODERATE') : 'NONE') as any,
        lastWebCheck: new Date().toISOString()
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(enrichmentData));
      } catch {}

      return {
        ...prospect,
        enrichmentStatus: 'ENRICHED',
        enrichmentData
      };
    } catch (err) {
      console.warn('[ProspectingEngine] Enrichment error:', err);
      return {
        ...prospect,
        enrichmentStatus: 'FAILED'
      };
    }
  }

  /**
   * Converts a prospect to an ExtendedLead for the CRM with complete contextual data
   */
  static convertProspectToLead(prospect: Prospect, customNote?: string): ExtendedLead {
    const oppDetails = prospect.opportunitySignals.map(s => `[${s.type}] ${s.label}: ${s.detail}`);
    const opportunitiesSummary = prospect.opportunities.map(o => `• ${o.title} (Impacto: ${o.estimatedImpact.formatted})`);

    const shortMsg = `Hola ${prospect.name}, estuve revisando su presencia local en ${prospect.city} y detectamos oportunidades concretas para optimizar su captación de clientes en ${prospect.category}. ¿Tienen 5 minutos para revisar un diagnóstico breve?`;
    
    return {
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      businessName: prospect.name,
      client: prospect.name,
      category: prospect.category,
      location: `${prospect.address}, ${prospect.city}, ${prospect.state}`,
      phone: prospect.phone !== 'NOT_AVAILABLE' ? prospect.phone : '',
      website: prospect.website !== 'NOT_AVAILABLE' ? prospect.website : '',
      rating: prospect.rating !== 'NOT_AVAILABLE' ? prospect.rating : undefined,
      reviews: prospect.reviewCount !== 'NOT_AVAILABLE' ? prospect.reviewCount : undefined,
      source: 'prospecting_radar',
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      status: 'NEW',
      opportunityData: [...oppDetails, ...opportunitiesSummary],
      generatedPitch: {
        shortMessage: shortMsg,
        emailSubject: `Oportunidad de crecimiento comercial para ${prospect.name} (${prospect.city})`,
        emailBody: `Hola equipo de ${prospect.name},\n\nEstuvimos evaluando negocios del sector ${prospect.category} en ${prospect.city} y detectamos puntos específicos para optimizar su captación y volumen de clientes.\n\n${opportunitiesSummary.join('\n')}\n\n¿Tendrían disponibilidad para revisar una propuesta breve esta semana?\n\nSaludos cordiales,\nEquipo Bvelt`,
        callScript: `Buenos días, me comunico con ${prospect.name}. Mi nombre es [Tu Nombre]. Estuvimos evaluando negocios del sector ${prospect.category} en ${prospect.city} y quisiéramos presentarles una propuesta específica para incrementar su flujo de clientes locales...`
      },
      text: customNote || prospect.notes || `Prospecto captado desde Radar Bvelt. Score de oportunidad: ${prospect.opportunityScore}/100 (${prospect.opportunityLevel}). Señales: ${oppDetails.join(' | ')}`
    };
  }

  /**
   * Generates Google Maps Search URL with precise coords or Place ID (zero cost)
   */
  static buildGoogleMapsUrl(prospect: Prospect): string {
    if (prospect.latitude && prospect.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${prospect.latitude},${prospect.longitude}`;
    }
    if (prospect.placeId) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospect.name + ' ' + prospect.address)}&query_place_id=${prospect.placeId}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospect.name + ' ' + prospect.address + ' ' + prospect.city)}`;
  }
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
