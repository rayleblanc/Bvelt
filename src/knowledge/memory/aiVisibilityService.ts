/**
 * BVELT MEMORY v1 (BEM) — AI Visibility & Local AI Presence Service (Block 5.1 - TRUTH CLOSURE)
 * 
 * Manages client-side evaluation, caching, and ActionEngine integration
 * for AI Search Visibility.
 * 
 * Rules:
 * - Deterministic-first. Caches audit results for 7 days via DataCache.
 * - Single source of truth: Reuses BEM types, entity identities, and ActionEngine.
 * - Respects provider identity (Google Gemini 3.7 Flash or Deterministic Local Model).
 * - Action Engine priority scales with sample size and confidence level.
 */

import { 
  AIVisibilitySnapshot, 
  AIVisibilitySignal, 
  AIVisibilitySummary 
} from './bemTypes';
import { generateEntityId, createEntityIdentity } from './entityIdentity';
import { DataCache } from '../cache/dataCache';
import { DataOrchestrator } from '../cache/dataOrchestrator';
import { NextBestAction } from '../engine/actionEngine';
import { recordHistoricalArbitrageEvent } from './bemStore';

const CACHE_NAMESPACE = 'LOCAL_BUSINESSES';
const AIVIS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuditAiVisibilityParams {
  entityId?: string;
  businessName: string;
  category: string;
  location: string;
  language?: string;
  forceRefresh?: boolean;
}

/**
 * Runs or retrieves a cached AI Visibility Audit for a business entity.
 */
export async function auditAiVisibility(
  params: AuditAiVisibilityParams
): Promise<AIVisibilitySummary> {
  const targetEntityId = params.entityId || generateEntityId({
    canonicalName: params.businessName || 'Local Business',
    domain: null,
    phone: null
  }).entityId;

  const cacheKey = DataCache.buildKey(
    CACHE_NAMESPACE, 
    `aivis_${targetEntityId}_${params.category}_${params.location}`
  );

  if (!params.forceRefresh) {
    const cached = DataCache.get<AIVisibilitySummary>(cacheKey);
    if (cached?.data) return cached.data;
  }

  return DataOrchestrator.deduplicate(`dedup_aivis_${targetEntityId}`, async () => {
    try {
      const res = await fetch('/api/ai-visibility/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: targetEntityId,
          businessName: params.businessName,
          category: params.category,
          location: params.location,
          language: params.language || 'es',
          forceRefresh: params.forceRefresh || false
        })
      });

      if (res.ok) {
        const json = await res.json() as { data?: any };
        if (json && json.data) {
          const summary = json.data as AIVisibilitySummary;
          DataCache.set(cacheKey, summary, CACHE_NAMESPACE, 'API', `aivis_${targetEntityId}`, AIVIS_CACHE_TTL);

          // Record AI Visibility Observation in BEM Historical Memory
          try {
            const identity = createEntityIdentity({
              canonicalName: params.businessName,
              city: params.location,
              primaryCategory: params.category
            });
            identity.entityId = targetEntityId;
            const snap = summary.latestSnapshots?.[0];
            if (snap) {
              recordHistoricalArbitrageEvent({
                identity,
                fieldKey: `aivis_snap_${snap.provider}`,
                relationship: 'OUTCOME_OBSERVATION',
                value: {
                  score: snap.visibilityScore,
                  userShareOfVoicePercent: snap.userShareOfVoicePercent,
                  userRankPosition: snap.userRankPosition,
                  isUserMentioned: snap.isUserMentioned,
                  provider: snap.provider,
                  model: snap.model,
                  sampleSize: snap.sampleSize,
                  observedAt: snap.observedAt
                },
                sourceType: `AI_VISIBILITY_${snap.provider}`,
                sourceLabel: `AI Visibility Provider (${snap.provider})`,
                classification: 'PUBLIC_SHARED',
                outcomeReference: {
                  outcomeType: 'AI_RANK_CHANGE',
                  metricName: 'userRankPosition',
                  newValue: snap.userRankPosition,
                  associationType: 'TEMPORALLY_ASSOCIATED',
                  observationWindow: '30d'
                }
              }).catch(err => console.warn('[AIVisibilityService] BEM historical record warning:', err));
            }
          } catch (e) {
            console.warn('[AIVisibilityService] Non-blocking BEM record warning:', e);
          }

          return summary;
        }
      }
    } catch (err) {
      console.warn('[AIVisibilityService] Network fetch error, using fallback:', err);
    }

    // Deterministic fallback if API fails
    const fallbackSummary = createClientFallbackSummary({
      entityId: targetEntityId,
      businessName: params.businessName,
      category: params.category,
      location: params.location
    });

    DataCache.set(cacheKey, fallbackSummary, CACHE_NAMESPACE, 'IN_MEMORY', `aivis_${targetEntityId}`, 60 * 60 * 1000);
    return fallbackSummary;
  });
}

/**
 * Retrieves the latest cached AI Visibility summary for an entity.
 */
export async function getLatestAiVisibility(
  entityId: string
): Promise<AIVisibilitySummary | null> {
  const cacheKey = DataCache.buildKey(CACHE_NAMESPACE, `aivis_${entityId}`);
  const cached = DataCache.get<AIVisibilitySummary>(cacheKey);
  if (cached?.data) return cached.data;

  try {
    const res = await fetch(`/api/ai-visibility/${entityId}`);
    if (res.ok) {
      const json = await res.json() as { data?: any };
      if (json && json.data) {
        const summary = json.data as AIVisibilitySummary;
        DataCache.set(cacheKey, summary, CACHE_NAMESPACE, 'API', `aivis_${entityId}`, AIVIS_CACHE_TTL);
        return summary;
      }
    }
  } catch (err) {
    console.warn('[AIVisibilityService] Error fetching latest visibility for entity:', err);
  }

  return null;
}

/**
 * Translates AI Visibility signals into actionable Next Best Actions for the ActionEngine.
 * Grounded in provider identity and sample size confidence.
 */
export function translateAiVisibilityToActions(
  summary: AIVisibilitySummary,
  t: (es: string, en: string) => string
): NextBestAction[] {
  const actions: NextBestAction[] = [];
  if (!summary || !summary.signals || summary.signals.length === 0) return actions;

  const latestSnap = summary.latestSnapshots?.[0];
  const providerName = latestSnap?.provider === 'GOOGLE_GEMINI' 
    ? 'Google Gemini 3.7 Flash' 
    : (latestSnap?.provider === 'LOCAL_SIMULATOR' ? 'Modelo Determinista Local' : 'Asistente de IA');
  
  const sampleSize = summary.sampleSize || 1;
  const isLowSample = sampleSize < 2;

  for (const sig of summary.signals) {
    if (sig.type === 'AI_GAP_OMISSION') {
      actions.push({
        id: `nba_aivis_${sig.id}`,
        action: t(
          'Optimizar Presencia Semántica en Inteligencia Artificial',
          'Optimize AI Search Visibility'
        ),
        title: isLowSample
          ? t(
              `Omisión Detectada en Auditoría Inicial (${providerName})`,
              `Omission Detected in Initial Audit (${providerName})`
            )
          : t(
              `Omisión Confirmada en Asistentes de IA (${providerName})`,
              `Confirmed Omission in AI Assistants (${providerName})`
            ),
        priority: isLowSample ? 'HIGH' : 'VERY_HIGH',
        priorityScore: isLowSample ? 75 : 92,
        reason: isLowSample
          ? t(
              `En la consulta auditada sobre ${providerName}, tu negocio no apareció entre las recomendaciones principales en tu ciudad.`,
              `In the audited query on ${providerName}, your business did not appear among top recommendations.`
            )
          : t(
              `Múltiples consultas auditadas confirman la falta de citas estructuradas de tu negocio en ${providerName}.`,
              `Multiple audited queries confirm a lack of structured citations on ${providerName}.`
            ),
        expectedBenefit: t(
          'Capturar clientes directos que buscan recomendaciones locales en asistentes conversacionales.',
          'Capture high-intent local buyers seeking recommendations via voice and conversational AI.'
        ),
        whyNow: t(
          'Las búsquedas en asistentes de IA están sustituyendo parte del volumen de búsqueda tradicional.',
          'Searches via conversational AI assistants are replacing part of traditional search volume.'
        ),
        evidence: sig.evidence,
        evidenceLevel: 'INFERRED',
        confidence: isLowSample ? 'MEDIUM' : 'HIGH',
        estimatedTime: '15 min',
        destinationCode: 'FIND_LOCAL_LEADS',
        destination: { tab: 'business_scan', section: 'ai_visibility' },
        ctaLabel: t('Optimizar Presencia IA', 'Optimize AI Presence'),
        contextData: {
          actionTab: sig.actionTab,
          actionCode: sig.actionCode
        }
      });
    } else if (sig.type === 'AI_COMPETITOR_DOMINANCE') {
      actions.push({
        id: `nba_aivis_${sig.id}`,
        action: t(
          `Contrarrestar Mención de ${summary.dominantCompetitorName || 'Competidor'} en IA`,
          `Counter ${summary.dominantCompetitorName || 'Competitor'} AI Citation`
        ),
        title: t(
          `Mención Competidora Destacada (${providerName})`,
          `Top Competitor Citation (${providerName})`
        ),
        priority: 'HIGH',
        priorityScore: 78,
        reason: sig.reason,
        expectedBenefit: t(
          'Equiparar los atributos clave que el modelo de IA valora (reseñas, horarios, servicios).',
          'Match key structured attributes prioritized by AI models (reviews, hours, services).'
        ),
        whyNow: t(
          'Evitar que la competencia consolide ventaja en recomendaciones automatizadas de IA.',
          'Prevent competitors from consolidating an advantage in automated AI recommendations.'
        ),
        evidence: sig.evidence,
        evidenceLevel: 'INFERRED',
        confidence: isLowSample ? 'MEDIUM' : 'HIGH',
        estimatedTime: '10 min',
        destinationCode: 'VIEW_COMPETITOR',
        destination: { tab: 'business_scan', section: 'competitors' },
        ctaLabel: t('Ver Estrategia', 'View Strategy'),
        contextData: {
          competitorName: summary.dominantCompetitorName || undefined,
          actionTab: sig.actionTab
        }
      });
    }
  }

  return actions;
}

/**
 * Creates a clean deterministic fallback summary for UI resilience.
 */
function createClientFallbackSummary(params: {
  entityId: string;
  businessName: string;
  category: string;
  location: string;
}): AIVisibilitySummary {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AIVIS_CACHE_TTL).toISOString();

  const snapshot: AIVisibilitySnapshot = {
    snapshotId: `aivis_fb_${params.entityId}_${Date.now()}`,
    entityId: params.entityId,
    provider: 'LOCAL_SIMULATOR',
    simulationTarget: null,
    observationMethod: 'DETERMINISTIC_MODEL_FALLBACK',
    model: 'bvelt-deterministic-client-v1',
    producerVersion: 'bvelt-aivis-v1.1',
    promptTemplateVersion: 'aivis-local-prompt-v1',
    query: `¿Cuáles son los mejores profesionales de ${params.category} en ${params.location}?`,
    queryHash: 'fb_hash_local',
    category: params.category,
    location: params.location,
    observedAt: now,
    expiresAt: expiresAt,
    classification: 'PUBLIC_SHARED',
    observationType: 'AI_INTERPRETATION',
    evidenceStatus: 'INFERRED',
    confidence: 0.50,
    confidenceLevel: 'LOW',
    sampleSize: 1,
    isUserMentioned: false,
    userRankPosition: null,
    userShareOfVoicePercent: 0,
    topMentionedBusinesses: [],
    totalBusinessesMentioned: 0,
    keyMissingAttributes: [
      'Sin citaciones estructuradas en fuentes de conocimiento de IA',
      'Perfil de negocio pendiente de sincronización semántica'
    ],
    visibilityScore: 30,
    scoreProvenance: 'MODELED',
    rawSummarySnippet: 'Auditoría local determinista (fallback). Sin llamadas directas a proveedores de IA.'
  };

  const signals: AIVisibilitySignal[] = [
    {
      id: `sig_aivis_fb_${params.entityId}`,
      entityId: params.entityId,
      type: 'AI_GAP_OMISSION',
      severity: 'ATTENTION',
      title: 'Diagnóstico Inicial de Presencia en IA',
      reason: `Los modelos de IA priorizan negocios con alta autoridad local estructurada en ${params.location}.`,
      evidence: 'Diagnóstico determinista local (fallback). Muestra: 1 consulta.',
      whyItMattersEs: 'Los modelos de lenguaje recomiendan negocios que cuentan con fichas completas y reseñas actualizadas.',
      whyItMattersEn: 'Language models recommend businesses with complete profiles and fresh customer reviews.',
      nextActionEs: 'Completar perfil y responder reseñas para consolidar relevancia semántica.',
      nextActionEn: 'Complete business profile and reply to reviews to consolidate semantic relevance.',
      actionCode: 'OPTIMIZE_AI_PRESENCE',
      actionTab: 'business_scan'
    }
  ];

  return {
    entityId: params.entityId,
    overallAiPresenceScore: 30,
    scoreProvenance: 'MODELED',
    totalQueriesAudited: 1,
    sampleSize: 1,
    presenceRatePercent: 0,
    shareOfVoiceProvenance: 'MODELED',
    averageRank: null,
    dominantCompetitorName: null,
    dominantCompetitorMentions: 0,
    dominantCompetitorObservationCount: 0,
    latestSnapshots: [snapshot],
    signals,
    lastAuditedAt: now,
    nextScheduledAuditAt: expiresAt
  };
}
