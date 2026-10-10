/**
 * BVELT MEMORY v1 (BEM) — Google Dependency Risk Evaluator
 * 
 * Pure deterministic calculation engine for assessing Google Dependency Risk.
 * Strictly free of AI/LLM hallucinations, external calls, and non-deterministic heuristics.
 */

import {
  GoogleDependencyLevel,
  GoogleFallbackType,
  GoogleServiceCategory,
  GoogleRiskComponent,
  GoogleDependencyRiskSummary
} from './googleDependencyRiskTypes';
import { EvidenceStatus } from './bemTypes';

export const PRODUCER_VERSION = 'bvelt-gdr-v1.0';

/**
 * Weights assigned to each service category (Sum = 1.0)
 */
export const COMPONENT_WEIGHTS: Record<GoogleServiceCategory, number> = {
  GBP_REVIEWS: 0.30,
  GBP_PERFORMANCE: 0.25,
  GBP_IDENTITY: 0.15,
  GBP_PUBLISHING: 0.15,
  GOOGLE_AUTH: 0.10,
  MAPS_DISCOVERY: 0.05,
  AI_INFERENCE: 0.00 // AI inference uses Groq/deterministic templates; zero direct runtime Google dependency risk
};

/**
 * Multiplier factors representing how effectively a fallback mitigates raw dependency risk
 */
export const FALLBACK_QUALITY_FACTORS: Record<GoogleFallbackType, number> = {
  COMPLETE_INDEPENDENT: 1.0,
  FUNCTIONAL_FALLBACK: 0.85,
  CACHED_FALLBACK: 0.70,
  PARTIAL_FALLBACK: 0.40,
  DEGRADED_FALLBACK: 0.20,
  NO_FALLBACK: 0.0
};

export interface BusinessOperatingSignals {
  entityId?: string;
  businessName?: string;
  gmbConnected?: boolean;
  hasWebsite?: boolean;
  hasCrmLeads?: boolean;
  crmLeadCount?: number;
  hasDirectOutreach?: boolean;
  gmbReviewCount?: number;
  totalReviewCount?: number;
  hasUnansweredGmbReviews?: boolean;
  isCachedGmbData?: boolean;
  cachedAgeHours?: number;
  hasGmbTokens?: boolean;
  hasAlternativeChannels?: boolean; // WhatsApp, social, email, referral
}

/**
 * Maps a numeric score (0..100) to a deterministic risk level.
 */
export function classifyRiskLevel(score: number): GoogleDependencyLevel {
  if (score < 10) return 'NONE';
  if (score < 30) return 'LOW';
  if (score < 55) return 'MODERATE';
  if (score < 80) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Evaluates individual risk components based on verified operating signals.
 */
export function evaluateComponent(
  category: GoogleServiceCategory,
  signals: BusinessOperatingSignals,
  observedAt: string
): GoogleRiskComponent {
  const weight = COMPONENT_WEIGHTS[category] || 0;
  const isGmbConnected = !!signals.gmbConnected;
  const hasWebsite = !!signals.hasWebsite;
  const crmCount = signals.crmLeadCount || 0;
  const isCached = !!signals.isCachedGmbData;
  const cacheAgeHours = signals.cachedAgeHours ?? (isCached ? 2 : undefined);

  let nameEs = '';
  let nameEn = '';
  let googleService = '';
  let googleEndpoint = '';
  let affectedFeature = '';
  let rawDependencyScore = 0;
  let fallbackType: GoogleFallbackType = 'COMPLETE_INDEPENDENT';
  let fallbackProvider = '';
  let fallbackDescriptionEs = '';
  let fallbackDescriptionEn = '';
  let ruleUsed = '';

  switch (category) {
    case 'GBP_IDENTITY':
      nameEs = 'Identidad y Perfil de Negocio';
      nameEn = 'Business Identity & Profile';
      googleService = 'Google My Business / Business Information API';
      googleEndpoint = 'mybusinessbusinessinformation.googleapis.com/v1/locations';
      affectedFeature = 'Sincronización de nombre, dirección comercial y categorías';

      if (!isGmbConnected) {
        rawDependencyScore = 0;
        fallbackType = 'COMPLETE_INDEPENDENT';
        fallbackProvider = 'Perfil Nativo Bvelt / Firestore';
        fallbackDescriptionEs = 'Identidad gestionada directamente en el perfil Bvelt sin dependencia de Google.';
        fallbackDescriptionEn = 'Identity managed directly in Bvelt profile without Google dependency.';
        ruleUsed = 'RULE_IDENTITY_UNCONNECTED';
      } else if (hasWebsite) {
        rawDependencyScore = 35;
        fallbackType = 'FUNCTIONAL_FALLBACK';
        fallbackProvider = 'Sitio Web Propio + Perfil Local Bvelt';
        fallbackDescriptionEs = 'El negocio dispone de web propia y perfil local independiente.';
        fallbackDescriptionEn = 'Business possesses proprietary website and independent local profile.';
        ruleUsed = 'RULE_IDENTITY_CONNECTED_WITH_WEB';
      } else {
        rawDependencyScore = 80;
        fallbackType = isCached ? 'CACHED_FALLBACK' : 'NO_FALLBACK';
        fallbackProvider = isCached ? 'Caché Local BEM' : 'Sin presencia web independiente';
        fallbackDescriptionEs = 'El perfil depende principalmente de Google sin presencia web independiente.';
        fallbackDescriptionEn = 'Profile depends primarily on Google with no independent web presence.';
        ruleUsed = 'RULE_IDENTITY_CONNECTED_NO_WEB';
      }
      break;

    case 'GBP_REVIEWS':
      nameEs = 'Reputación y Reseñas de Clientes';
      nameEn = 'Customer Reviews & Reputation';
      googleService = 'Google My Business Account Management API';
      googleEndpoint = 'mybusinessaccountmanagement.googleapis.com/v1/locations/reviews';
      affectedFeature = 'Monitorización de reseñas, alertas de reputación y respuesta';

      if (!isGmbConnected || (signals.gmbReviewCount ?? 0) === 0) {
        rawDependencyScore = 0;
        fallbackType = 'COMPLETE_INDEPENDENT';
        fallbackProvider = 'Reputation Shield / Testimonios Locales';
        fallbackDescriptionEs = 'El negocio no utiliza ni depende de reseñas de Google para operar.';
        fallbackDescriptionEn = 'Business does not use or depend on Google reviews for operation.';
        ruleUsed = 'RULE_REVIEWS_UNCONNECTED';
      } else if (crmCount > 5 || signals.hasAlternativeChannels) {
        rawDependencyScore = 45;
        fallbackType = isCached ? 'CACHED_FALLBACK' : 'FUNCTIONAL_FALLBACK';
        fallbackProvider = 'Caché BEM + Feedback Multicanal (CRM/WhatsApp)';
        fallbackDescriptionEs = 'Reseñas de Google activas pero complementadas con canales de feedback directo y CRM.';
        fallbackDescriptionEn = 'Active Google reviews complemented by direct feedback and CRM channels.';
        ruleUsed = 'RULE_REVIEWS_DIVERSIFIED';
      } else {
        rawDependencyScore = 95;
        fallbackType = isCached ? 'CACHED_FALLBACK' : 'NO_FALLBACK';
        fallbackProvider = isCached ? 'Caché Local L1/L2' : 'Sin canal alternativo de reseñas';
        fallbackDescriptionEs = 'La reputación del negocio depende exclusivamente de Google Reviews.';
        fallbackDescriptionEn = 'Business reputation relies exclusively on Google Reviews.';
        ruleUsed = 'RULE_REVIEWS_SOLE_DEPENDENCY';
      }
      break;

    case 'GBP_PUBLISHING':
      nameEs = 'Publicación y Respuesta a Reseñas';
      nameEn = 'Review Response & Content Publishing';
      googleService = 'Google My Business Account Management API (Reply)';
      googleEndpoint = 'mybusinessaccountmanagement.googleapis.com/v1/reviews/reply';
      affectedFeature = 'Envío automático de respuestas y publicaciones GBP';

      if (!isGmbConnected) {
        rawDependencyScore = 0;
        fallbackType = 'COMPLETE_INDEPENDENT';
        fallbackProvider = 'Publicación Manual / Multicanal';
        fallbackDescriptionEs = 'Sin automatización directa vinculada a Google.';
        fallbackDescriptionEn = 'No direct automation tied to Google.';
        ruleUsed = 'RULE_PUBLISHING_UNCONNECTED';
      } else {
        rawDependencyScore = 60;
        fallbackType = 'PARTIAL_FALLBACK';
        fallbackProvider = 'Copia al portapapeles + Enlace directo Maps';
        fallbackDescriptionEs = 'En caso de fallo de API, Bvelt permite copiar la respuesta redactada con 1 clic para publicación manual.';
        fallbackDescriptionEn = 'On API failure, Bvelt allows 1-click clipboard copy for manual publishing.';
        ruleUsed = 'RULE_PUBLISHING_CLIPBOARD_FALLBACK';
      }
      break;

    case 'GBP_PERFORMANCE':
      nameEs = 'Adquisición de Tráfico y Métricas';
      nameEn = 'Traffic Acquisition & Performance';
      googleService = 'Business Profile Performance API';
      googleEndpoint = 'businessprofileperformance.googleapis.com/v1/locations/fetchMultiDailyMetricsTimeSeries';
      affectedFeature = 'Métricas de llamadas, clics a web y visualizaciones en Maps';

      if (!isGmbConnected) {
        rawDependencyScore = 0;
        fallbackType = 'COMPLETE_INDEPENDENT';
        fallbackProvider = 'Modelos de Referencia BEM / Métricas CRM';
        fallbackDescriptionEs = 'Adquisición independiente sin reporte de Google Maps.';
        fallbackDescriptionEn = 'Independent acquisition without Google Maps reporting.';
        ruleUsed = 'RULE_PERFORMANCE_UNCONNECTED';
      } else if (crmCount > 10 || signals.hasAlternativeChannels) {
        rawDependencyScore = 40;
        fallbackType = 'FUNCTIONAL_FALLBACK';
        fallbackProvider = 'Métricas Comerciales Bvelt + Pipeline CRM';
        fallbackDescriptionEs = 'Tráfico diversificado con pipeline de clientes en Bvelt.';
        fallbackDescriptionEn = 'Diversified traffic with customer pipeline in Bvelt.';
        ruleUsed = 'RULE_PERFORMANCE_DIVERSIFIED';
      } else {
        rawDependencyScore = 95;
        fallbackType = isCached ? 'CACHED_FALLBACK' : 'NO_FALLBACK';
        fallbackProvider = isCached ? 'Caché Histórico BEM' : 'Sin canal alternativo de captación';
        fallbackDescriptionEs = 'Casi todo el tráfico y llamadas provienen de visibilidad en Google Maps.';
        fallbackDescriptionEn = 'Almost all traffic and calls originate from Google Maps visibility.';
        ruleUsed = 'RULE_PERFORMANCE_MONO_CHANNEL';
      }

      break;

    case 'GOOGLE_AUTH':
      nameEs = 'Autenticación y Credenciales OAuth';
      nameEn = 'Authentication & OAuth Credentials';
      googleService = 'Google Identity & OAuth 2.0';
      googleEndpoint = 'accounts.google.com/o/oauth2/v2/auth';
      affectedFeature = 'Renovación de tokens de acceso para servicios Google';

      if (!isGmbConnected && !signals.hasGmbTokens) {
        rawDependencyScore = 0;
        fallbackType = 'COMPLETE_INDEPENDENT';
        fallbackProvider = 'Auth Nativa / Firebase Auth';
        fallbackDescriptionEs = 'Acceso a la plataforma completamente desacoplado de Google OAuth.';
        fallbackDescriptionEn = 'Platform access completely decoupled from Google OAuth.';
        ruleUsed = 'RULE_AUTH_UNCONNECTED';
      } else {
        rawDependencyScore = 40;
        fallbackType = 'FUNCTIONAL_FALLBACK';
        fallbackProvider = 'Modo Autónomo Bvelt';
        fallbackDescriptionEs = 'Si los tokens de Google expiran, la suite Bvelt continúa operativa en modo desacoplado.';
        fallbackDescriptionEn = 'If Google tokens expire, Bvelt suite continues operating in decoupled mode.';
        ruleUsed = 'RULE_AUTH_GRACEFUL_DEGRADATION';
      }
      break;

    case 'MAPS_DISCOVERY':
      nameEs = 'Descubrimiento Local y Competencia';
      nameEn = 'Local Discovery & Competitor Scanning';
      googleService = 'Google Maps Web Links';
      googleEndpoint = 'www.google.com/maps/search';
      affectedFeature = 'Enlaces de conveniencia a mapas externos';

      rawDependencyScore = 15;
      fallbackType = 'COMPLETE_INDEPENDENT';
      fallbackProvider = 'OpenStreetMap (Overpass API) + Nominatim';
      fallbackDescriptionEs = 'El escaneo de competidores y geolocalización en Bvelt opera de forma nativa sobre OpenStreetMap sin coste ni dependencia de Google Places API.';
      fallbackDescriptionEn = 'Competitor scanning and geolocation in Bvelt operates natively on OpenStreetMap without cost or dependency on Google Places API.';
      ruleUsed = 'RULE_DISCOVERY_OSM_NATIVE';
      break;

    default:
      nameEs = 'Servicios de Inferencia';
      nameEn = 'Inference Services';
      googleService = 'Google GenAI';
      googleEndpoint = 'generativelanguage.googleapis.com';
      affectedFeature = 'Generación de borradores de texto';
      rawDependencyScore = 10;
      fallbackType = 'COMPLETE_INDEPENDENT';
      fallbackProvider = 'Plantillas Expertas Deterministas Bvelt';
      fallbackDescriptionEs = 'Bvelt cuenta con plantillas deterministas de alta calidad que garantizan servicio sin llamadas LLM.';
      fallbackDescriptionEn = 'Bvelt provides deterministic expert templates ensuring service without LLM calls.';
      ruleUsed = 'RULE_INFERENCE_TEMPLATE_FALLBACK';
      break;
  }

  const fallbackQualityFactor = FALLBACK_QUALITY_FACTORS[fallbackType];
  // Deterministic formula: adjustedRisk = rawDependency * (1 - 0.75 * fallbackQualityFactor)
  const adjustedRiskScore = Math.round(rawDependencyScore * (1 - 0.75 * fallbackQualityFactor) * 10) / 10;
  const effectiveContribution = Math.round(adjustedRiskScore * weight * 10) / 10;

  const evidenceStatus: EvidenceStatus = 'DERIVED';

  return {
    componentId: category,
    nameEs,
    nameEn,
    weight,
    googleService,
    googleEndpoint,
    affectedFeature,
    dependencyLevel: classifyRiskLevel(rawDependencyScore),
    rawDependencyScore,
    fallbackType,
    fallbackQualityFactor,
    fallbackProvider,
    fallbackDescriptionEs,
    fallbackDescriptionEn,
    isCached,
    cacheAgeMs: cacheAgeHours !== undefined ? cacheAgeHours * 3600 * 1000 : undefined,
    adjustedRiskScore,
    effectiveContribution,
    evidenceStatus,
    observedAt,
    ruleUsed
  };
}

/**
 * Computes the complete Google Dependency Risk Summary.
 */
export function calculateGoogleDependencyRisk(
  signals: BusinessOperatingSignals,
  calculationTime: string = new Date().toISOString()
): GoogleDependencyRiskSummary {
  const entityId = signals.entityId || 'ent_current_business';

  const categories: GoogleServiceCategory[] = [
    'GBP_REVIEWS',
    'GBP_PERFORMANCE',
    'GBP_IDENTITY',
    'GBP_PUBLISHING',
    'GOOGLE_AUTH',
    'MAPS_DISCOVERY'
  ];

  const components: Partial<Record<GoogleServiceCategory, GoogleRiskComponent>> = {};
  const componentList: GoogleRiskComponent[] = [];

  let weightedScoreSum = 0;
  let totalFunctionalFallbacks = 0;

  for (const cat of categories) {
    const comp = evaluateComponent(cat, signals, calculationTime);
    components[cat] = comp;
    componentList.push(comp);
    weightedScoreSum += comp.effectiveContribution;

    if (
      comp.fallbackType === 'COMPLETE_INDEPENDENT' ||
      comp.fallbackType === 'FUNCTIONAL_FALLBACK' ||
      comp.fallbackType === 'CACHED_FALLBACK'
    ) {
      totalFunctionalFallbacks++;
    }
  }

  // Ensure overallScore is strictly within [0, 100]
  const overallScore = Math.min(100, Math.max(0, Math.round(weightedScoreSum)));
  const riskLevel = classifyRiskLevel(overallScore);
  const fallbackCoveragePercent = Math.round((totalFunctionalFallbacks / categories.length) * 100);

  // Identify highest and lowest risk components
  const sortedByRisk = [...componentList].sort((a, b) => b.adjustedRiskScore - a.adjustedRiskScore);
  const highestRiskComponent = sortedByRisk[0] || null;
  const lowestRiskComponent = sortedByRisk[sortedByRisk.length - 1] || null;

  // Formulate vulnerability and mitigation text
  let primaryVulnerabilityEs = 'El negocio opera con alta independencia de plataformas externas.';
  let primaryVulnerabilityEn = 'The business operates with high independence from external platforms.';
  let mitigationStrategyEs = 'Mantener la diversificación y consolidar la base de datos propia de clientes.';
  let mitigationStrategyEn = 'Maintain diversification and consolidate proprietary customer database.';

  if (highestRiskComponent && highestRiskComponent.adjustedRiskScore >= 40) {
    if (highestRiskComponent.componentId === 'GBP_REVIEWS') {
      primaryVulnerabilityEs = 'Concentración excesiva de reputación en Google Reviews sin captura de testimonios directos en CRM.';
      primaryVulnerabilityEn = 'Excessive reputation concentration on Google Reviews without direct CRM testimonial capture.';
      mitigationStrategyEs = 'Activar Reputation Shield para capturar feedback y testimonios privados en la base de datos de Bvelt.';
      mitigationStrategyEn = 'Activate Reputation Shield to capture private feedback and testimonials in Bvelt database.';
    } else if (highestRiskComponent.componentId === 'GBP_PERFORMANCE') {
      primaryVulnerabilityEs = 'La captación de llamadas y tráfico depende prioritariamente de la ficha de Google Maps.';
      primaryVulnerabilityEn = 'Call and traffic acquisition depends primarily on Google Maps listing.';
      mitigationStrategyEs = 'Impulsar captación multicanal mediante prospección directa B2B, WhatsApp y web propia.';
      mitigationStrategyEn = 'Drive multi-channel acquisition via direct B2B prospecting, WhatsApp, and proprietary website.';
    } else {
      primaryVulnerabilityEs = `Riesgo de dependencia identificado en ${highestRiskComponent.nameEs}.`;
      primaryVulnerabilityEn = `Dependency risk identified in ${highestRiskComponent.nameEn}.`;
      mitigationStrategyEs = `Aprovechar los mecanismos de respaldo de Bvelt en ${highestRiskComponent.fallbackProvider}.`;
      mitigationStrategyEn = `Leverage Bvelt fallback mechanisms in ${highestRiskComponent.fallbackProvider}.`;
    }
  }

  return {
    entityId,
    overallScore,
    riskLevel,
    status: 'ESTABLISHED',
    components: components as Record<GoogleServiceCategory, GoogleRiskComponent>,
    componentList,
    fallbackCoveragePercent,
    highestRiskComponent,
    lowestRiskComponent,
    primaryVulnerabilityEs,
    primaryVulnerabilityEn,
    mitigationStrategyEs,
    mitigationStrategyEn,
    totalServicesAudited: categories.length,
    calculatedAt: calculationTime,
    scoreProvenance: 'DERIVED',
    producerVersion: PRODUCER_VERSION,
    evidenceStatus: 'DERIVED',
    dataClassification: 'TENANT_PRIVATE'
  };
}

/**
 * Returns an un-modeled summary for cases where zero operating data is present.
 */
export function createInsufficientDataRiskSummary(
  entityId: string = 'ent_unknown',
  observedAt: string = new Date().toISOString()
): GoogleDependencyRiskSummary {
  const blankSignals: BusinessOperatingSignals = {
    entityId,
    gmbConnected: false
  };
  const summary = calculateGoogleDependencyRisk(blankSignals, observedAt);
  summary.status = 'INSUFFICIENT_DATA';
  summary.scoreProvenance = 'INSUFFICIENT_DATA';
  return summary;
}
