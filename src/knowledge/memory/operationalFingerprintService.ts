/**
 * BVELT MEMORY v1 (BEM) — Operational Fingerprint & Behavioral Intelligence Service (Block 6)
 * 
 * Translates verified customer reviews, CRM outcomes, reputation shield feedback,
 * and business scan diagnosis into recurring operational behavioral patterns.
 * 
 * Epistemological Rules:
 * - 1-2 mentions -> OBSERVED_THEME (Low confidence, single observation)
 * - 3+ mentions -> DERIVED_PATTERN (High confidence, statistically derived)
 * - Benchmark / Diagnosis -> MODELED_INTERPRETATION
 * - No data -> INSUFFICIENT_DATA (No fabricated metrics)
 * 
 * Performance & Cost:
 * - Deterministic-first theme extraction (Spanish & English).
 * - Caches derived fingerprint in DataCache (L1/L2, 15m TTL).
 * - Bounded write-back to BEM History without write storms or polling.
 */

import { 
  OperationalTheme,
  OperationalThemeCategory,
  OperationalSentiment,
  OperationalTrend,
  OperationalEpistemicLevel,
  OperationalFingerprintSignal,
  OperationalFingerprintSummary,
  OperationalEvidenceRef,
  EvidenceEvent,
  DataClassification,
  EvidenceStatus
} from './bemTypes';
import { createEntityIdentity } from './entityIdentity';
import { createMemoryRecord, writeEntityEvidenceBatch, getEntityMemoryContext } from './bemStore';
import { DataCache } from '../cache/dataCache';
import { DataOrchestrator } from '../cache/dataOrchestrator';
import { NextBestAction } from '../engine/actionEngine';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const CACHE_NAMESPACE = 'LOCAL_BUSINESSES';
const OP_FINGERPRINT_TTL = 15 * 60 * 1000; // 15 minutes

export interface OperationalDataSourceInput {
  entityId: string;
  businessName: string;
  category?: string;
  location?: string;
  reviews?: Array<{
    id?: string;
    text?: string;
    rating?: number;
    authorName?: string;
    relativeTime?: string;
    createdAt?: string;
    hasResponse?: boolean;
  }>;
  crmLeads?: Array<{
    id?: string;
    text?: string;
    urgency?: string;
    strategy?: string;
    source?: string;
    date?: string;
    status?: string;
  }>;
  businessScanDiagnosis?: {
    strengths?: Array<{ title: string; desc: string }>;
    weaknesses?: Array<{ title: string; desc: string }>;
    blindSpots?: string[];
  };
  gmbConnected?: boolean;
  rating?: number | string;
  reviewCount?: number;
}

// Deterministic Thematic Keywords Dictionary (ES & EN)
interface ThemeKeywordMatcher {
  positiveKeywords: string[];
  negativeKeywords: string[];
  labelEs: string;
  labelEn: string;
  defaultActionEs: string;
  defaultActionEn: string;
  actionCode: string;
  actionTab: string;
}

const THEME_DICTIONARY: Record<OperationalTheme, ThemeKeywordMatcher> = {
  RESPONSE_SPEED: {
    positiveKeywords: [
      'respondió rápido', 'respuesta rápida', 'respuesta inmediata', 'atención rápida', 
      'en menos de una hora', 'muy rápido', 'atendieron enseguida', 'rapidez',
      'fast response', 'quick reply', 'answered immediately', 'prompt response', 
      'speedy', 'quick turnaround', 'very fast'
    ],
    negativeKeywords: [
      'tardó en responder', 'no contesta', 'lento para responder', 'nunca respondió', 
      'demoró días', 'no atienden el teléfono', 'esperé horas', 'lento',
      'slow response', 'never replied', 'unresponsive', 'took days to answer', 
      'hard to reach', 'no answer', 'delayed reply'
    ],
    labelEs: 'Velocidad de Respuesta',
    labelEn: 'Response Speed',
    defaultActionEs: 'Activar respuestas automáticas para responder en menos de 15 minutos.',
    defaultActionEn: 'Activate automated response templates to reply under 15 minutes.',
    actionCode: 'CONTACT_LEAD',
    actionTab: 'leads'
  },
  PROFESSIONALISM: {
    positiveKeywords: [
      'muy profesional', 'gran profesionalismo', 'excelente trato', 'educados', 
      'respetuosos', 'serios', 'profesionales', 'ética',
      'very professional', 'courteous', 'polite', 'respectful', 'top notch team', 
      'professionalism', 'gentleman'
    ],
    negativeKeywords: [
      'poco profesional', 'grosero', 'maleducado', 'falta de respeto', 
      'arrogante', 'informales', 'desagradable',
      'unprofessional', 'rude', 'disrespectful', 'bad attitude', 'arrogant', 
      'impolite', 'unfriendly'
    ],
    labelEs: 'Profesionalismo y Trato',
    labelEn: 'Professionalism & Conduct',
    defaultActionEs: 'Destacar testimonios de profesionalismo en tu ficha de Google.',
    defaultActionEn: 'Highlight verified professionalism testimonials on your Google Profile.',
    actionCode: 'COMPLETE_PROFILE',
    actionTab: 'profile'
  },
  COMMUNICATION: {
    positiveKeywords: [
      'buena comunicación', 'explicó todo', 'mantuvo informado', 'claro y transparente', 
      'explicación clara', 'comunicación constante', 'notificó',
      'great communication', 'kept us updated', 'clear explanation', 'informative', 
      'transparent', 'well communicated', 'kept in the loop'
    ],
    negativeKeywords: [
      'mala comunicación', 'no explican', 'no avisaron', 'falta de información', 
      'no contestan dudas', 'desinformado', 'confuso',
      'poor communication', 'kept in the dark', 'no updates', 'misinformed', 
      'lack of communication', 'unclear'
    ],
    labelEs: 'Claridad en Comunicación',
    labelEn: 'Communication Clarity',
    defaultActionEs: 'Implementar notas y actualizaciones por WhatsApp durante cada trabajo.',
    defaultActionEn: 'Send structured status updates via WhatsApp during active jobs.',
    actionCode: 'FOLLOW_UP',
    actionTab: 'leads'
  },
  CLEANLINESS: {
    positiveKeywords: [
      'limpio', 'dejaron todo impecable', 'ordenado', 'limpieza total', 
      'recogieron todo', 'pulcro', 'sin desorden',
      'spotless', 'clean work', 'tidy', 'cleaned up after', 'left it clean', 
      'neat and clean', 'very clean'
    ],
    negativeKeywords: [
      'sucio', 'dejaron un desastre', 'basura', 'desordenado', 'mancharon', 
      'no limpiaron', 'suciedad',
      'dirty', 'messy', 'left a mess', 'unclean', 'trash everywhere', 
      'sloppy', 'stained'
    ],
    labelEs: 'Limpieza y Orden',
    labelEn: 'Cleanliness & Site Care',
    defaultActionEs: 'Promover la garantía de limpieza impecable como diferenciador local.',
    defaultActionEn: 'Promote spotless cleanup guarantee as a key local differentiator.',
    actionCode: 'COMPLETE_PROFILE',
    actionTab: 'profile'
  },
  QUALITY: {
    positiveKeywords: [
      'trabajo impecable', 'alta calidad', 'excelente acabado', 'materiales de primera', 
      'gran calidad', 'duradero', 'perfección', '10/10',
      'high quality', 'flawless work', 'craftsmanship', 'great quality', 
      'top quality', 'perfect job', 'superior quality'
    ],
    negativeKeywords: [
      'mala calidad', 'chapuza', 'mal acabado', 'defectuoso', 'materiales baratos', 
      'se rompió', 'falló', 'pésimo trabajo',
      'poor quality', 'shoddy work', 'flawed', 'cheap materials', 'broke immediately', 
      'defective', 'subpar'
    ],
    labelEs: 'Calidad de Ejecución',
    labelEn: 'Execution Quality',
    defaultActionEs: 'Compartir fotos de antes y después de trabajos de alta calidad en Google Maps.',
    defaultActionEn: 'Publish before/after high quality project photos to Google Maps.',
    actionCode: 'COMPLETE_PROFILE',
    actionTab: 'growth'
  },
  PUNCTUALITY: {
    positiveKeywords: [
      'puntual', 'llegaron a tiempo', 'a la hora acordada', 'cumplieron horario', 
      'puntualidad', 'exacto en la hora',
      'on time', 'punctual', 'arrived on schedule', 'prompt arrival', 
      'punctuality', 'right on time'
    ],
    negativeKeywords: [
      'llegó tarde', 'retraso', 'no llegaron a la hora', 'esperé horas', 
      'impuntual', 'retrasaron la cita',
      'late', 'delayed', 'missed appointment', 'hours late', 'unpunctual', 
      'never showed up on time'
    ],
    labelEs: 'Puntualidad en Citas',
    labelEn: 'Punctuality & Schedule',
    defaultActionEs: 'Ajustar la ventana de llegada y enviar recordatorio 30 minutos antes.',
    defaultActionEn: 'Tighten arrival windows and send 30-min advance arrival alerts.',
    actionCode: 'CONTACT_LEAD',
    actionTab: 'leads'
  },
  RELIABILITY: {
    positiveKeywords: [
      'confiable', 'de confianza', 'cumplen lo que prometen', '100% recomendado', 
      'palabra', 'responsable', 'honesto',
      'reliable', 'trustworthy', 'dependable', 'did what they promised', 
      'honest', 'responsible', 'recommend 100%'
    ],
    negativeKeywords: [
      'no confiable', 'no cumplieron', 'quedaron mal', 'no apareció', 
      'irresponsable', 'mentira', 'no recomendado',
      'unreliable', 'broke promise', "didn't show up", 'flaked', 
      'untrustworthy', 'dishonest', 'do not recommend'
    ],
    labelEs: 'Fiabilidad y Confianza',
    labelEn: 'Reliability & Trust',
    defaultActionEs: 'Solicitar más reseñas a clientes recientes para afianzar tu reputación de confianza.',
    defaultActionEn: 'Request verified reviews from recent satisfied clients to strengthen trust signals.',
    actionCode: 'REQUEST_REVIEW',
    actionTab: 'reviews'
  },
  PRICING_TRANSPARENCY: {
    positiveKeywords: [
      'precio justo', 'precio claro', 'sin sorpresas', 'sin cobros ocultos', 
      'presupuesto exacto', 'buen precio', 'tarifa transparente',
      'fair price', 'transparent pricing', 'no hidden fees', 'honest quote', 
      'good value', 'reasonable price', 'clear estimate'
    ],
    negativeKeywords: [
      'cobró de más', 'precio abusivo', 'cobros ocultos', 'sorpresa en la factura', 
      'muy caro', 'estafa', 'cambió el precio',
      'overcharged', 'hidden fees', 'bait and switch', 'price gouging', 
      'unexpected charge', 'way overpriced'
    ],
    labelEs: 'Transparencia de Tarifas',
    labelEn: 'Pricing Transparency',
    defaultActionEs: 'Publicar estimaciones claras y rangos de precio en tu perfil.',
    defaultActionEn: 'Publish transparent pricing ranges and diagnostic fees on your profile.',
    actionCode: 'COMPLETE_PROFILE',
    actionTab: 'pricing'
  },
  FOLLOW_THROUGH: {
    positiveKeywords: [
      'seguimiento impecable', 'terminaron todo', 'garantía cumplida', 'revisaron después', 
      'hasta el final', 'compromiso total',
      'followed through', 'finished the job', 'honored warranty', 'post-service follow-up', 
      'completed everything', 'great warranty'
    ],
    negativeKeywords: [
      'dejaron a medias', 'no terminaron', 'no volvieron a llamar', 'incompleto', 
      'abandonaron', 'no responden por la garantía',
      'unfinished job', 'left incomplete', 'no follow up', 'ghosted after', 
      'did not honor warranty', 'walked away'
    ],
    labelEs: 'Seguimiento y Garantía',
    labelEn: 'Follow-Through & Warranty',
    defaultActionEs: 'Establecer protocolo de llamada de control a las 48h de finalizar el trabajo.',
    defaultActionEn: 'Schedule a mandatory 48-hour follow-up check-in call after service.',
    actionCode: 'FOLLOW_UP',
    actionTab: 'leads'
  },
  CUSTOMER_SERVICE: {
    positiveKeywords: [
      'atención al cliente excelente', 'amables', 'dispuestos a ayudar', 'gran servicio', 
      'cordialidad', 'atención de primera',
      'great customer service', 'friendly', 'helpful', 'caring staff', 
      'excellent service', 'attentive', 'kind'
    ],
    negativeKeywords: [
      'pésima atención', 'mala actitud', 'no les importa el cliente', 'mal servicio', 
      'atención deficiente', 'burlones',
      'terrible customer service', 'bad service', 'uncaring', 'dismissive', 
      'poor customer care', 'bad experience'
    ],
    labelEs: 'Servicio al Cliente',
    labelEn: 'Customer Service',
    defaultActionEs: 'Capacitar al equipo en atención cordial y resolución proactiva de dudas.',
    defaultActionEn: 'Coach frontline staff on courteous engagement and active listening.',
    actionCode: 'COMPLETE_PROFILE',
    actionTab: 'profile'
  }
};

/**
 * Historical evidence loader for operational fingerprint events.
 */
export async function getOperationalEvidenceHistory(
  entityId: string, 
  limitCount = 20
): Promise<EvidenceEvent[]> {
  const cacheKey = DataCache.buildKey(CACHE_NAMESPACE, `opfp_hist_${entityId}_${limitCount}`);
  const cached = DataCache.get<EvidenceEvent[]>(cacheKey);
  if (cached?.data) return cached.data;

  return DataOrchestrator.deduplicate(`dedup_opfp_hist_${entityId}`, async () => {
    if (!db || !auth?.currentUser) return [];
    try {
      const historyColRef = collection(db, 'bem_entities', entityId, 'history');
      const q = query(historyColRef, orderBy('detectedAt', 'desc'), limit(limitCount));
      const snap = await getDocs(q);

      const events: EvidenceEvent[] = [];
      snap.forEach(d => {
        const ev = d.data() as EvidenceEvent;
        if (ev.fieldKey?.startsWith('op_theme_') || ev.fieldKey?.startsWith('operationalFingerprint')) {
          events.push(ev);
        }
      });

      DataCache.set(cacheKey, events, CACHE_NAMESPACE, 'FIRESTORE', `opfp_hist_${entityId}`, OP_FINGERPRINT_TTL);
      return events;
    } catch {
      return [];
    }
  });
}

/**
 * Analyzes operational evidence sources deterministically to produce an OperationalFingerprintSummary.
 */
export async function compileOperationalFingerprint(
  input: OperationalDataSourceInput,
  options?: { forceRefresh?: boolean }
): Promise<OperationalFingerprintSummary> {
  const entityId = input?.entityId || 'entity_local_active';
  const cacheKey = DataCache.buildKey(CACHE_NAMESPACE, `opfp_summary_${entityId}`);

  if (!options?.forceRefresh) {
    try {
      const cached = DataCache.get<OperationalFingerprintSummary>(cacheKey);
      if (cached?.data) return cached.data;
    } catch {}
  }

  try {
    return await DataOrchestrator.deduplicate(`dedup_opfp_summary_${entityId}`, async () => {
    const now = new Date().toISOString();
    let historyEvents: EvidenceEvent[] = [];
    try {
      historyEvents = await getOperationalEvidenceHistory(entityId, 30);
    } catch {
      historyEvents = [];
    }

    // Accumulators per theme
    const themeObservations: Record<OperationalTheme, {
      positiveCount: number;
      negativeCount: number;
      evidenceRefs: OperationalEvidenceRef[];
      keywordsMatched: string[];
      sourceTypes: Set<string>;
    }> = {
      RESPONSE_SPEED: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      PROFESSIONALISM: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      COMMUNICATION: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      CLEANLINESS: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      QUALITY: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      PUNCTUALITY: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      RELIABILITY: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      PRICING_TRANSPARENCY: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      FOLLOW_THROUGH: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() },
      CUSTOMER_SERVICE: { positiveCount: 0, negativeCount: 0, evidenceRefs: [], keywordsMatched: [], sourceTypes: new Set() }
    };

    let totalRawSources = 0;

    // 1. Process Google / GBP Reviews
    if (Array.isArray(input.reviews) && input.reviews.length > 0) {
      for (const rev of input.reviews) {
        if (!rev.text) continue;
        totalRawSources++;
        const textLower = rev.text.toLowerCase();
        const revRating = typeof rev.rating === 'number' ? rev.rating : 5;

        for (const [themeKey, matcher] of Object.entries(THEME_DICTIONARY) as [OperationalTheme, ThemeKeywordMatcher][]) {
          let matchedPositive = false;
          let matchedNegative = false;

          for (const kw of matcher.positiveKeywords) {
            if (textLower.includes(kw)) {
              themeObservations[themeKey].positiveCount++;
              themeObservations[themeKey].keywordsMatched.push(kw);
              matchedPositive = true;
              break;
            }
          }

          for (const kw of matcher.negativeKeywords) {
            if (textLower.includes(kw)) {
              themeObservations[themeKey].negativeCount++;
              themeObservations[themeKey].keywordsMatched.push(kw);
              matchedNegative = true;
              break;
            }
          }

          // If review is 1-2 stars and text mentions general issues, tag negative sentiment
          if (revRating <= 2 && matchedNegative) {
            themeObservations[themeKey].sourceTypes.add('GOOGLE_REVIEWS_NEGATIVE');
          } else if (matchedPositive) {
            themeObservations[themeKey].sourceTypes.add('GOOGLE_REVIEWS_POSITIVE');
          }

          if (matchedPositive || matchedNegative) {
            themeObservations[themeKey].evidenceRefs.push({
              evidenceId: rev.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sourceType: 'GOOGLE_REVIEWS',
              observedAt: rev.createdAt || rev.relativeTime || now,
              snippet: rev.text.length > 120 ? `${rev.text.substring(0, 117)}...` : rev.text,
              sentiment: matchedNegative ? 'NEGATIVE' : 'POSITIVE'
            });
          }
        }
      }
    }

    // 2. Process CRM Leads & Reputation Shield crisis intercepts
    if (Array.isArray(input.crmLeads) && input.crmLeads.length > 0) {
      for (const lead of input.crmLeads) {
        if (!lead.text) continue;
        totalRawSources++;
        const textLower = lead.text.toLowerCase();
        const isCrisis = textLower.includes('crisis filtrada') || lead.source === 'reputation_shield_negative';

        for (const [themeKey, matcher] of Object.entries(THEME_DICTIONARY) as [OperationalTheme, ThemeKeywordMatcher][]) {
          let matched = false;
          for (const kw of matcher.negativeKeywords) {
            if (textLower.includes(kw)) {
              themeObservations[themeKey].negativeCount += (isCrisis ? 2 : 1);
              themeObservations[themeKey].keywordsMatched.push(kw);
              themeObservations[themeKey].sourceTypes.add(isCrisis ? 'REPUTATION_SHIELD_INTERCEPT' : 'CRM_LEAD_FEEDBACK');
              matched = true;
              break;
            }
          }

          if (matched) {
            themeObservations[themeKey].evidenceRefs.push({
              evidenceId: lead.id || `crm_${Date.now()}`,
              sourceType: isCrisis ? 'REPUTATION_SHIELD' : 'CRM_FEEDBACK',
              observedAt: lead.date || now,
              snippet: lead.text.length > 120 ? `${lead.text.substring(0, 117)}...` : lead.text,
              sentiment: 'NEGATIVE'
            });
          }
        }
      }
    }

    // 3. Process Business Scan Diagnosis if available
    if (input.businessScanDiagnosis) {
      if (Array.isArray(input.businessScanDiagnosis.strengths)) {
        for (const str of input.businessScanDiagnosis.strengths) {
          const strText = `${str.title} ${str.desc}`.toLowerCase();
          for (const [themeKey, matcher] of Object.entries(THEME_DICTIONARY) as [OperationalTheme, ThemeKeywordMatcher][]) {
            if (matcher.positiveKeywords.some(kw => strText.includes(kw)) || strText.includes(matcher.labelEs.toLowerCase()) || strText.includes(matcher.labelEn.toLowerCase())) {
              themeObservations[themeKey].positiveCount++;
              themeObservations[themeKey].sourceTypes.add('BUSINESS_SCAN_DIAGNOSIS');
            }
          }
        }
      }

      if (Array.isArray(input.businessScanDiagnosis.weaknesses)) {
        for (const wk of input.businessScanDiagnosis.weaknesses) {
          const wkText = `${wk.title} ${wk.desc}`.toLowerCase();
          for (const [themeKey, matcher] of Object.entries(THEME_DICTIONARY) as [OperationalTheme, ThemeKeywordMatcher][]) {
            if (matcher.negativeKeywords.some(kw => wkText.includes(kw)) || wkText.includes(matcher.labelEs.toLowerCase()) || wkText.includes(matcher.labelEn.toLowerCase())) {
              themeObservations[themeKey].negativeCount++;
              themeObservations[themeKey].sourceTypes.add('BUSINESS_SCAN_DIAGNOSIS');
            }
          }
        }
      }
    }

    // 4. Transform observations into typed OperationalFingerprintSignals
    const signals: OperationalFingerprintSignal[] = [];
    const strengths: OperationalFingerprintSignal[] = [];
    const weaknesses: OperationalFingerprintSignal[] = [];
    const neutralOrOpportunities: OperationalFingerprintSignal[] = [];

    let totalObservationCount = 0;
    let improvingCount = 0;
    let decliningCount = 0;
    let stableCount = 0;
    let insufficientTrendCount = 0;

    for (const [themeKey, obs] of Object.entries(themeObservations) as [OperationalTheme, typeof themeObservations[OperationalTheme]][]) {
      const matcher = THEME_DICTIONARY[themeKey];
      const obsCount = obs.positiveCount + obs.negativeCount;
      totalObservationCount += obsCount;

      // Epistemological Rule Evaluation
      let epistemicLevel: OperationalEpistemicLevel = 'INSUFFICIENT_DATA';
      let confidence = 0.30;
      let confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      let evidenceStatus: EvidenceStatus = 'INSUFFICIENT_DATA';

      if (obsCount === 0) {
        epistemicLevel = 'INSUFFICIENT_DATA';
        confidence = 0.20;
        confidenceLevel = 'LOW';
        evidenceStatus = 'INSUFFICIENT_DATA';
      } else if (obsCount < 3) {
        epistemicLevel = 'OBSERVED_THEME';
        confidence = 0.55;
        confidenceLevel = 'LOW';
        evidenceStatus = 'INFERRED';
      } else {
        epistemicLevel = 'DERIVED_PATTERN';
        confidence = 0.85;
        confidenceLevel = 'HIGH';
        evidenceStatus = 'DERIVED';
      }

      // Sentiment & Category Determination
      const positiveRatio = obsCount > 0 ? obs.positiveCount / obsCount : 0.5;
      const negativeRatio = obsCount > 0 ? obs.negativeCount / obsCount : 0.0;

      let sentiment: OperationalSentiment = 'NEUTRAL';
      let themeCategory: OperationalThemeCategory = 'NEUTRAL';

      if (obsCount === 0) {
        sentiment = 'NEUTRAL';
        themeCategory = 'OPPORTUNITY';
      } else if (positiveRatio >= 0.70 && obs.positiveCount >= 1) {
        sentiment = 'POSITIVE';
        themeCategory = 'STRENGTH';
      } else if (negativeRatio >= 0.35 && obs.negativeCount >= 1) {
        sentiment = 'NEGATIVE';
        themeCategory = 'WEAKNESS';
      } else {
        sentiment = 'NEUTRAL';
        themeCategory = 'OPPORTUNITY';
      }

      // Trend Detection via Longitudinal History
      let trend: OperationalTrend = 'INSUFFICIENT_DATA';
      const pastEvents = historyEvents.filter(e => e.fieldKey === `op_theme_${themeKey}`);

      if (pastEvents.length >= 2) {
        const latestVal = pastEvents[0].newValue as any;
        const pastVal = pastEvents[pastEvents.length - 1].newValue as any;

        const latestPosRatio = latestVal?.positiveRatio ?? positiveRatio;
        const pastPosRatio = pastVal?.positiveRatio ?? 0.5;

        if (latestPosRatio - pastPosRatio >= 0.15) {
          trend = 'IMPROVING';
          improvingCount++;
        } else if (pastPosRatio - latestPosRatio >= 0.15) {
          trend = 'DECLINING';
          decliningCount++;
        } else {
          trend = 'STABLE';
          stableCount++;
        }
      } else if (pastEvents.length === 1 && obsCount > 0) {
        trend = 'STABLE';
        stableCount++;
      } else {
        trend = 'INSUFFICIENT_DATA';
        insufficientTrendCount++;
      }

      const signal: OperationalFingerprintSignal = {
        fingerprintId: `opfp_${entityId}_${themeKey}`,
        entityId,
        theme: themeKey,
        themeCategory,
        sentiment,
        observationCount: obsCount,
        supportingEvidenceCount: obs.evidenceRefs.length,
        supportingEvidenceIds: obs.evidenceRefs.map(r => r.evidenceId),
        evidenceReferences: obs.evidenceRefs.slice(0, 5), // Keep top 5 to prevent bloat
        firstObservedAt: obs.evidenceRefs[0]?.observedAt || now,
        lastObservedAt: now,
        confidence,
        confidenceLevel,
        evidenceStatus,
        epistemicLevel,
        sourceTypes: Array.from(obs.sourceTypes),
        trend,
        sampleSize: obsCount,
        producerVersion: 'bvelt-opfp-v1.0',
        schemaVersion: '1.0.0',
        summaryEs: obsCount === 0
          ? `Sin menciones registradas sobre ${matcher.labelEs.toLowerCase()}.`
          : (epistemicLevel === 'OBSERVED_THEME'
              ? `Mención aislada (${obsCount}) sobre ${matcher.labelEs.toLowerCase()}.`
              : `Patrón recurrente (${obsCount} observaciones) con tendencia ${trend === 'IMPROVING' ? 'favorable' : trend === 'DECLINING' ? 'a la baja' : 'estable'}.`),
        summaryEn: obsCount === 0
          ? `No recorded observations on ${matcher.labelEn.toLowerCase()}.`
          : (epistemicLevel === 'OBSERVED_THEME'
              ? `Isolated observation (${obsCount}) on ${matcher.labelEn.toLowerCase()}.`
              : `Recurring pattern (${obsCount} observations) with ${trend.toLowerCase()} trend.`),
        impactOnConversion: themeCategory === 'WEAKNESS' ? 'HIGH' : themeCategory === 'STRENGTH' ? 'HIGH' : 'MEDIUM',
        suggestedActionEs: matcher.defaultActionEs,
        suggestedActionEn: matcher.defaultActionEn,
        actionCode: matcher.actionCode,
        actionTab: matcher.actionTab,
        metadata: {
          positiveRatio,
          negativeRatio,
          keywordsMatched: Array.from(new Set(obs.keywordsMatched)).slice(0, 6)
        }
      };

      signals.push(signal);

      if (themeCategory === 'STRENGTH') {
        strengths.push(signal);
      } else if (themeCategory === 'WEAKNESS') {
        weaknesses.push(signal);
      } else {
        neutralOrOpportunities.push(signal);
      }
    }

    // Sort strengths by confidence and count
    strengths.sort((a, b) => b.observationCount - a.observationCount);
    weaknesses.sort((a, b) => b.observationCount - a.observationCount);

    const primaryDifferentiator = strengths.length > 0 ? strengths[0] : null;
    const primaryRisk = weaknesses.length > 0 ? weaknesses[0] : null;

    // Overall Health Score calculation (0-100)
    let overallHealthScore = 70; // baseline
    let scoreProvenance: 'MODELED' | 'DERIVED' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';

    if (totalObservationCount >= 5) {
      const totalStrengthsCount = strengths.reduce((acc, s) => acc + s.observationCount, 0);
      const totalWeaknessCount = weaknesses.reduce((acc, w) => acc + w.observationCount, 0);
      const netRatio = (totalStrengthsCount - totalWeaknessCount * 1.5) / totalObservationCount;
      overallHealthScore = Math.min(100, Math.max(20, Math.round(70 + netRatio * 30)));
      scoreProvenance = 'DERIVED';
    } else if (totalObservationCount > 0) {
      overallHealthScore = 65;
      scoreProvenance = 'MODELED';
    }

    const summary: OperationalFingerprintSummary = {
      entityId,
      overallHealthScore,
      scoreProvenance,
      totalObservations: totalObservationCount,
      sampleSize: totalObservationCount,
      strengths,
      weaknesses,
      neutralOrOpportunities,
      signals,
      primaryDifferentiator,
      primaryRisk,
      lastAuditedAt: now,
      producerVersion: 'bvelt-opfp-v1.0',
      historicalTrendSummary: {
        improvingThemesCount: improvingCount,
        decliningThemesCount: decliningCount,
        stableThemesCount: stableCount,
        insufficientDataCount: insufficientTrendCount
      }
    };

    // Store in L1/L2 cache
    DataCache.set(cacheKey, summary, CACHE_NAMESPACE, 'MEMORY', `opfp_${entityId}`, OP_FINGERPRINT_TTL);

    // 5. Bounded Write-Back to BEM History if meaningful patterns exist
    if (totalObservationCount >= 2 && db && auth?.currentUser) {
      persistFingerprintToBemHistory(input, summary).catch(() => {
        // Silently skip if write not allowed
      });
    }

    return summary;
  });
  } catch (outerErr) {
    console.warn("[OperationalFingerprint] Error compiling fingerprint, using safe fallback:", outerErr);
    const now = new Date().toISOString();
    return {
      entityId,
      overallHealthScore: 70,
      scoreProvenance: 'INSUFFICIENT_DATA',
      totalObservations: 0,
      sampleSize: 0,
      strengths: [],
      weaknesses: [],
      neutralOrOpportunities: [],
      signals: [],
      primaryDifferentiator: null,
      primaryRisk: null,
      lastAuditedAt: now,
      producerVersion: 'bvelt-opfp-v1.0',
      historicalTrendSummary: {
        improvingThemesCount: 0,
        decliningThemesCount: 0,
        stableThemesCount: 0,
        insufficientDataCount: 0
      }
    };
  }
}

/**
 * Persists snapshot events to BEM history without duplicate write storms.
 */
async function persistFingerprintToBemHistory(
  input: OperationalDataSourceInput,
  summary: OperationalFingerprintSummary
): Promise<void> {
  const records: any[] = [];
  const entityId = input.entityId || 'entity_local_active';

  for (const sig of summary.signals) {
    if (sig.observationCount >= 2) {
      records.push(createMemoryRecord({
        entityId,
        fieldKey: `op_theme_${sig.theme}`,
        value: {
          themeCategory: sig.themeCategory,
          sentiment: sig.sentiment,
          observationCount: sig.observationCount,
          positiveRatio: sig.metadata?.positiveRatio,
          epistemicLevel: sig.epistemicLevel,
          trend: sig.trend
        },
        observationType: 'STATISTICAL_INFERENCE' as any,
        evidenceStatus: 'DERIVED',
        classification: 'SYSTEM_ONLY' as any,
        confidence: sig.confidence,
        sourceType: 'OPERATIONAL_FINGERPRINT_ENGINE',
        sourceLabel: 'Bvelt Operational Fingerprint Engine',
        producerVersion: summary.producerVersion || 'bvelt-opfp-v1.0'
      }));
    }
  }

  if (records.length > 0) {
    const identity = createEntityIdentity({
      canonicalName: input.businessName,
      city: input.location
    });
    // Force the entityId to match what was requested
    identity.entityId = entityId;
    
    await writeEntityEvidenceBatch(identity, records, null);
  }
}

/**
 * Translates Operational Fingerprint signals into actionable NextBestActions for ActionEngine.
 */
export function translateOperationalFingerprintToActions(
  summary: OperationalFingerprintSummary,
  t: (es: string, en: string) => string
): NextBestAction[] {
  const actions: NextBestAction[] = [];
  if (!summary || !summary.signals || summary.signals.length === 0) return actions;

  // 1. Address Critical Operational Risks (Weaknesses)
  if (summary.weaknesses.length > 0) {
    const primaryWeakness = summary.weaknesses[0];
    const isLowConfidence = primaryWeakness.epistemicLevel === 'OBSERVED_THEME';

    actions.push({
      id: `nba_opfp_${primaryWeakness.theme.toLowerCase()}`,
      action: t(
        `Corregir Fricción Operativa: ${THEME_DICTIONARY[primaryWeakness.theme].labelEs}`,
        `Resolve Operational Friction: ${THEME_DICTIONARY[primaryWeakness.theme].labelEn}`
      ),
      title: isLowConfidence
        ? t(
            `Alerta Temprana en ${THEME_DICTIONARY[primaryWeakness.theme].labelEs} (1-2 menciones)`,
            `Early Warning in ${THEME_DICTIONARY[primaryWeakness.theme].labelEn} (1-2 mentions)`
          )
        : t(
            `Patrón Recurrente Detectado en ${THEME_DICTIONARY[primaryWeakness.theme].labelEs}`,
            `Recurring Friction in ${THEME_DICTIONARY[primaryWeakness.theme].labelEn}`
          ),
      priority: isLowConfidence ? 'HIGH' : 'VERY_HIGH',
      priorityScore: isLowConfidence ? 76 : 89,
      reason: isLowConfidence
        ? t(
            `Se han detectado comentarios sobre ${THEME_DICTIONARY[primaryWeakness.theme].labelEs.toLowerCase()} que pueden afectar conversiones futuras.`,
            `Detected feedback on ${THEME_DICTIONARY[primaryWeakness.theme].labelEn.toLowerCase()} that may impact future customer conversions.`
          )
        : t(
            `Múltiples clientes (${primaryWeakness.observationCount}) señalan fricciones en ${THEME_DICTIONARY[primaryWeakness.theme].labelEs.toLowerCase()}.`,
            `Multiple customers (${primaryWeakness.observationCount}) report friction in ${THEME_DICTIONARY[primaryWeakness.theme].labelEn.toLowerCase()}.`
          ),
      expectedBenefit: t(
        'Evitar pérdida de clientes potenciales y proteger la tasa de retención y conversión local.',
        'Prevent loss of prospective leads and protect local conversion and retention rates.'
      ),
      whyNow: t(
        'Los patrones de fricción no resueltos reducen la velocidad de cierre comercial.',
        'Unresolved operational friction directly reduces sales velocity and customer trust.'
      ),
      evidence: primaryWeakness.summaryEs,
      evidenceLevel: primaryWeakness.evidenceStatus,
      confidence: primaryWeakness.confidenceLevel,
      estimatedTime: '10 min',
      destinationCode: primaryWeakness.actionCode as any || 'FOLLOW_UP',
      destination: { tab: primaryWeakness.actionTab || 'leads' },
      ctaLabel: t('Resolver Ahora', 'Resolve Now')
    });
  }

  // 2. Leverage Primary Differentiator (Strengths)
  if (summary.strengths.length > 0) {
    const primaryStrength = summary.strengths[0];

    actions.push({
      id: `nba_opfp_str_${primaryStrength.theme.toLowerCase()}`,
      action: t(
        `Monetizar Diferenciador: ${THEME_DICTIONARY[primaryStrength.theme].labelEs}`,
        `Leverage Operational Strength: ${THEME_DICTIONARY[primaryStrength.theme].labelEn}`
      ),
      title: t(
        `Ventaja Competitiva en ${THEME_DICTIONARY[primaryStrength.theme].labelEs}`,
        `Competitive Edge in ${THEME_DICTIONARY[primaryStrength.theme].labelEn}`
      ),
      priority: 'HIGH',
      priorityScore: 82,
      reason: t(
        `Tus clientes elogian repetidamente tu ${THEME_DICTIONARY[primaryStrength.theme].labelEs.toLowerCase()} (${primaryStrength.observationCount} menciones).`,
        `Customers consistently praise your ${THEME_DICTIONARY[primaryStrength.theme].labelEn.toLowerCase()} (${primaryStrength.observationCount} mentions).`
      ),
      expectedBenefit: t(
        'Aumentar la tasa de cierre destacando este punto fuerte en tus propuestas y perfil.',
        'Increase win rates by highlighting this proven operational strength in pitches and profiles.'
      ),
      whyNow: t(
        'Los clientes locales buscan garantías concretas de servicio antes de contratar.',
        'Local buyers demand concrete proof of service quality before choosing a provider.'
      ),
      evidence: primaryStrength.summaryEs,
      evidenceLevel: primaryStrength.evidenceStatus,
      confidence: primaryStrength.confidenceLevel,
      estimatedTime: '5 min',
      destinationCode: 'COMPLETE_PROFILE',
      destination: { tab: primaryStrength.actionTab || 'profile' },
      ctaLabel: t('Destacar en Perfil', 'Highlight in Profile')
    });
  }

  return actions;
}
