/**
 * BVELT MEMORY v1 (BEM) — Ghost Competitor & Longitudinal Market Intelligence Service
 * 
 * Tracks observable public competitor signals over time without polling or write storms.
 * Computes deterministic movement signals (review gains, rating shifts, digital presence changes)
 * and translates real competitor shifts into actionable Next Best Actions.
 * 
 * Rules:
 * - Deterministic first. No LLM dependency for computing movements.
 * - Zero fabricated data: If no prior observation exists, baseline is stored without claiming fake historical changes.
 * - Single source of truth: Reuses BEM EntityIdentity and EvidenceEvents.
 */

import { 
  CompetitorSnapshot, 
  CompetitorMovementSignal, 
  CompetitorMovementSummary,
  EvidenceEvent,
  MovementType
} from './bemTypes';
import { 
  createEntityIdentity, 
  generateEntityId 
} from './entityIdentity';
import { 
  persistCompetitorPoiToBem, 
  getEntityMemoryContext
} from './bemStore';
import { DataCache } from '../cache/dataCache';
import { DataOrchestrator } from '../cache/dataOrchestrator';
import { NextBestAction } from '../engine/actionEngine';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

export type { 
  CompetitorSnapshot, 
  CompetitorMovementSignal, 
  CompetitorMovementSummary,
  MovementType 
};

const CACHE_NAMESPACE = 'LOCAL_BUSINESSES';
const MOVEMENT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes in memory/L2

/**
 * Reads bounded longitudinal history (up to limitCount events) for a competitor entity.
 */
export async function getCompetitorEvidenceHistory(
  entityId: string, 
  limitCount = 10
): Promise<EvidenceEvent[]> {
  const cacheKey = DataCache.buildKey(CACHE_NAMESPACE, `ghost_hist_${entityId}_${limitCount}`);
  const cached = DataCache.get<EvidenceEvent[]>(cacheKey);
  if (cached?.data) return cached.data;

  return DataOrchestrator.deduplicate(`dedup_ghost_hist_${entityId}`, async () => {
    if (!db) return [];

    try {
      // Use the trusted server-side endpoint /api/business/:id/history to fetch public-safe history.
      // This completely avoids any Firestore Rules read permission errors on subcollections.
      const url = `/api/business/${encodeURIComponent(entityId)}/history?limit=${limitCount}`;
      const response = await fetch(url).catch(() => null);
      if (response && response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await response.json().catch(() => null);
          if (json && json.status === "SUCCESS" && json.data && Array.isArray(json.data.events)) {
            const events = json.data.events as EvidenceEvent[];
            DataCache.set(cacheKey, events, CACHE_NAMESPACE, 'FIRESTORE', `ghost_hist_${entityId}`, 10 * 60 * 1000);
            return events;
          }
        }
      }

      // If server API did not return data, only attempt client-side Firestore query if authenticated
      if (!auth?.currentUser) {
        return [];
      }

      const historyColRef = collection(db, 'bem_entities', entityId, 'history');
      const q = query(historyColRef, orderBy('detectedAt', 'desc'), limit(limitCount));
      const snap = await getDocs(q);

      const events: EvidenceEvent[] = [];
      snap.forEach(d => {
        events.push(d.data() as EvidenceEvent);
      });

      DataCache.set(cacheKey, events, CACHE_NAMESPACE, 'FIRESTORE', `ghost_hist_${entityId}`, 10 * 60 * 1000);
      return events;
    } catch (err: any) {
      if (err?.code !== 'permission-denied') {
        console.warn(`[GhostCompetitor] Error fetching history for ${entityId}:`, err);
      }
      return [];
    }
  });
}

/**
 * Evaluates whether a competitor has experienced a real, observable movement
 * between past evidence history and current snapshot.
 */
export async function analyzeCompetitorMovement(
  snapshot: CompetitorSnapshot
): Promise<CompetitorMovementSignal | null> {
  const { entityId } = generateEntityId({
    canonicalName: snapshot.name,
    domain: snapshot.website,
    phone: snapshot.phone,
    sourceIds: {
      googlePlaceId: snapshot.placeId || undefined,
      osmId: snapshot.osmId || undefined
    }
  });

  const cacheKey = DataCache.buildKey(CACHE_NAMESPACE, `ghost_move_${entityId}`);
  const cached = DataCache.get<CompetitorMovementSignal | null>(cacheKey);
  if (cached && cached.data !== undefined) return cached.data;

  // 1. Fetch recent history for this competitor
  const historyEvents = await getCompetitorEvidenceHistory(entityId, 15);

  if (!historyEvents || historyEvents.length === 0) {
    // First observation baseline established. No past movement recorded yet.
    return null;
  }

  // 2. Check for review count shifts in history
  const reviewCountEvents = historyEvents.filter(e => e.fieldKey === 'reviewCount');
  if (reviewCountEvents.length > 0) {
    const latestEvent = reviewCountEvents[0];
    const pastVal = typeof latestEvent.oldValue === 'number' ? latestEvent.oldValue : null;
    const currentVal = typeof latestEvent.newValue === 'number' ? latestEvent.newValue : (snapshot.reviewCount ?? null);

    if (pastVal !== null && currentVal !== null && currentVal !== pastVal) {
      const delta = currentVal - pastVal;
      const detectedDate = new Date(latestEvent.detectedAt || latestEvent.observedAt);
      const daysAgo = Math.max(1, Math.round((Date.now() - detectedDate.getTime()) / (1000 * 60 * 60 * 24)));

      const isIncrease = delta > 0;
      const movementType: MovementType = isIncrease ? 'REVIEW_COUNT_INCREASE' : 'REVIEW_COUNT_DECREASE';

      const signal: CompetitorMovementSignal = {
        id: `move_rev_${entityId}_${latestEvent.eventId}`,
        entityId,
        competitorName: snapshot.name,
        movementType,
        fieldKey: 'reviewCount',
        oldValue: pastVal,
        newValue: currentVal,
        deltaNumber: delta,
        deltaFormatted: `${isIncrease ? '+' : ''}${delta}`,
        periodDays: daysAgo,
        firstObservedAt: latestEvent.observedAt,
        lastObservedAt: latestEvent.detectedAt,
        confidence: latestEvent.confidence || 0.9,
        whyItMattersEs: isIncrease
          ? `${snapshot.name} aumentó ${delta} reseñas verificadas en ${daysAgo} días (${pastVal} → ${currentVal}), elevando su ventaja de volumen en búsquedas locales.`
          : `${snapshot.name} redujo su conteo de reseñas visibles (${pastVal} → ${currentVal}).`,
        whyItMattersEn: isIncrease
          ? `${snapshot.name} gained ${delta} verified reviews over ${daysAgo} days (${pastVal} → ${currentVal}), expanding their local search volume advantage.`
          : `${snapshot.name} saw a drop in visible reviews (${pastVal} → ${currentVal}).`,
        nextActionEs: 'Acelera tu ritmo de captación solicitando reseñas a clientes satisfechos recientes vía WhatsApp.',
        nextActionEn: 'Accelerate your review velocity by requesting reviews from recent satisfied clients via WhatsApp.',
        actionCode: 'REQUEST_REVIEW',
        actionDestinationTab: 'reputation'
      };

      DataCache.set(cacheKey, signal, CACHE_NAMESPACE, 'DERIVED', `ghost_move_${entityId}`, MOVEMENT_CACHE_TTL);
      return signal;
    }
  }

  // 3. Check for rating shifts in history
  const ratingEvents = historyEvents.filter(e => e.fieldKey === 'rating');
  if (ratingEvents.length > 0) {
    const latestEvent = ratingEvents[0];
    const pastVal = typeof latestEvent.oldValue === 'number' ? latestEvent.oldValue : null;
    const currentVal = typeof latestEvent.newValue === 'number' ? latestEvent.newValue : (snapshot.rating ?? null);

    if (pastVal !== null && currentVal !== null && currentVal !== pastVal) {
      const delta = +(currentVal - pastVal).toFixed(1);
      const detectedDate = new Date(latestEvent.detectedAt || latestEvent.observedAt);
      const daysAgo = Math.max(1, Math.round((Date.now() - detectedDate.getTime()) / (1000 * 60 * 60 * 24)));

      const isIncrease = delta > 0;
      const movementType: MovementType = isIncrease ? 'RATING_INCREASE' : 'RATING_DECREASE';

      const signal: CompetitorMovementSignal = {
        id: `move_rat_${entityId}_${latestEvent.eventId}`,
        entityId,
        competitorName: snapshot.name,
        movementType,
        fieldKey: 'rating',
        oldValue: pastVal,
        newValue: currentVal,
        deltaNumber: delta,
        deltaFormatted: `${isIncrease ? '+' : ''}${delta}⭐`,
        periodDays: daysAgo,
        firstObservedAt: latestEvent.observedAt,
        lastObservedAt: latestEvent.detectedAt,
        confidence: latestEvent.confidence || 0.9,
        whyItMattersEs: isIncrease
          ? `${snapshot.name} mejoró su calificación promedio de ${pastVal} a ${currentVal}⭐ en los últimos ${daysAgo} días.`
          : `${snapshot.name} bajó su calificación de ${pastVal} a ${currentVal}⭐, abriendo una oportunidad de captura de clientes insatisfechos.`,
        whyItMattersEn: isIncrease
          ? `${snapshot.name} improved their average rating from ${pastVal} to ${currentVal}⭐ over the last ${daysAgo} days.`
          : `${snapshot.name} saw their rating drop from ${pastVal} to ${currentVal}⭐, opening an opportunity to win dissatisfied customers.`,
        nextActionEs: isIncrease
          ? 'Responde a reseñas pendientes para mantener un estándar de atención superior.'
          : 'Refuerza tu propuesta de valor y garantía para captar prospectos que buscan mayor calidad.',
        nextActionEn: isIncrease
          ? 'Respond to pending reviews to maintain superior service standards.'
          : 'Highlight your quality guarantee to attract prospects looking for reliable service.',
        actionCode: isIncrease ? 'REPLY_REVIEWS' : 'OUTREACH',
        actionDestinationTab: isIncrease ? 'reputation' : 'client_acquisition'
      };

      DataCache.set(cacheKey, signal, CACHE_NAMESPACE, 'DERIVED', `ghost_move_${entityId}`, MOVEMENT_CACHE_TTL);
      return signal;
    }
  }

  // 4. Check for website/digital presence update
  const websiteEvents = historyEvents.filter(e => e.fieldKey === 'website');
  if (websiteEvents.length > 0) {
    const latestEvent = websiteEvents[0];
    if (!latestEvent.oldValue && latestEvent.newValue) {
      const signal: CompetitorMovementSignal = {
        id: `move_web_${entityId}_${latestEvent.eventId}`,
        entityId,
        competitorName: snapshot.name,
        movementType: 'WEBSITE_ADDED',
        fieldKey: 'website',
        oldValue: null,
        newValue: latestEvent.newValue,
        periodDays: 30,
        firstObservedAt: latestEvent.observedAt,
        lastObservedAt: latestEvent.detectedAt,
        confidence: 0.95,
        whyItMattersEs: `${snapshot.name} ha publicado o verificado su sitio web digital (${latestEvent.newValue}), incrementando su visibilidad orgánica.`,
        whyItMattersEn: `${snapshot.name} published or verified their website (${latestEvent.newValue}), increasing organic visibility.`,
        nextActionEs: 'Verifica y optimiza tu perfil digital y velocidad de respuesta a cotizaciones.',
        nextActionEn: 'Verify and optimize your digital presence and quote response speed.',
        actionCode: 'COMPLETE_PROFILE',
        actionDestinationTab: 'settings'
      };

      DataCache.set(cacheKey, signal, CACHE_NAMESPACE, 'DERIVED', `ghost_move_${entityId}`, MOVEMENT_CACHE_TTL);
      return signal;
    }
  }

  return null;
}

/**
 * Batch processes an array of competitors, persisting snapshots to BEM
 * and computing aggregated movement summary across the local market.
 */
export async function detectAllCompetitorMovements(
  competitors: CompetitorSnapshot[]
): Promise<CompetitorMovementSummary> {
  if (!competitors || competitors.length === 0) {
    return {
      totalCompetitorsTracked: 0,
      competitorsWithMovement: 0,
      latestMovementSignals: [],
      fastestGrowingCompetitor: null,
      highestRatedCompetitor: null,
      lastCalculatedAt: new Date().toISOString()
    };
  }

  // 1. Asynchronously persist snapshots into BEM without blocking
  Promise.all(competitors.map(c => persistCompetitorPoiToBem(c))).catch(err => {
    console.warn('[GhostCompetitor] Non-blocking snapshot write warning:', err);
  });

  // 2. Analyze movements for all competitors
  const signals: CompetitorMovementSignal[] = [];
  let fastestGrowing: { name: string; reviewsGained: number; periodDays: number } | null = null;
  let maxGained = 0;

  for (const comp of competitors) {
    const signal = await analyzeCompetitorMovement(comp);
    if (signal) {
      signals.push(signal);
      if (signal.movementType === 'REVIEW_COUNT_INCREASE' && (signal.deltaNumber || 0) > maxGained) {
        maxGained = signal.deltaNumber || 0;
        fastestGrowing = {
          name: signal.competitorName,
          reviewsGained: maxGained,
          periodDays: signal.periodDays
        };
      }
    }
  }

  // 3. Identify highest rated competitor with real data
  let highestRated: { name: string; rating: number; reviewCount: number } | null = null;
  let topRating = 0;
  let topReviews = 0;

  for (const comp of competitors) {
    const rating = typeof comp.rating === 'number' ? comp.rating : 0;
    const revs = typeof comp.reviewCount === 'number' ? comp.reviewCount : 0;
    if (rating > topRating || (rating === topRating && revs > topReviews)) {
      topRating = rating;
      topReviews = revs;
      highestRated = {
        name: comp.name,
        rating,
        reviewCount: revs
      };
    }
  }

  return {
    totalCompetitorsTracked: competitors.length,
    competitorsWithMovement: signals.length,
    latestMovementSignals: signals,
    fastestGrowingCompetitor: fastestGrowing,
    highestRatedCompetitor: highestRated,
    lastCalculatedAt: new Date().toISOString()
  };
}

/**
 * Transforms detected competitor movements into prioritized NextBestAction items.
 */
export function generateGhostCompetitorActions(
  movements: CompetitorMovementSignal[],
  userBusinessName = 'Tu Negocio',
  lang: 'es' | 'en' = 'es'
): NextBestAction[] {
  if (!movements || movements.length === 0) return [];

  const actions: NextBestAction[] = [];

  for (const move of movements) {
    if (move.movementType === 'REVIEW_COUNT_INCREASE') {
      actions.push({
        id: `act_ghost_${move.id}`,
        action: lang === 'es' 
          ? `Cerrar brecha de velocidad frente a ${move.competitorName}` 
          : `Close review velocity gap against ${move.competitorName}`,
        title: lang === 'es'
          ? `Movimiento de Competidor: ${move.competitorName} sumó ${move.deltaFormatted} reseñas`
          : `Competitor Movement: ${move.competitorName} gained ${move.deltaFormatted} reviews`,
        priority: 'HIGH',
        priorityScore: 88,
        reason: lang === 'es' ? move.whyItMattersEs : move.whyItMattersEn,
        expectedBenefit: lang === 'es'
          ? 'Mantener tu posición en el top local de búsqueda y proteger tu cuota de clientes'
          : 'Maintain top local search ranking and protect your customer share',
        whyNow: lang === 'es'
          ? `${move.competitorName} está captando reseñas activamente en tu zona.`
          : `${move.competitorName} is actively gaining reviews in your service area.`,
        evidence: `${move.competitorName}: ${move.oldValue} → ${move.newValue} (${move.deltaFormatted})`,
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '5 min',
        estimatedMinutes: 5,
        destinationCode: 'REQUEST_REVIEW',
        destination: {
          tab: 'reputation',
          actionType: 'REVIEW_REQUEST'
        },
        ctaLabel: lang === 'es' ? 'Enviar Solicitud de Reseña' : 'Send Review Request',
        bveltMoment: {
          whatIsHappening: lang === 'es'
            ? `Tu competidor directo ${move.competitorName} incrementó ${move.deltaFormatted} reseñas en ${move.periodDays} días.`
            : `Your competitor ${move.competitorName} added ${move.deltaFormatted} reviews over ${move.periodDays} days.`,
          whyItMatters: lang === 'es' ? move.whyItMattersEs : move.whyItMattersEn,
          opportunitySummary: lang === 'es'
            ? 'Los clientes que buscan proveedores en tu zona eligen negocios con reseñas recientes y constantes.'
            : 'Clients in your area choose businesses with active, recent review velocity.',
          recommendedActionNow: lang === 'es' ? move.nextActionEs : move.nextActionEn,
          evidenceStatus: 'VERIFIED',
          evidenceSource: 'BEM Longitudinal POI History'
        }
      });
    } else if (move.movementType === 'RATING_DECREASE') {
      actions.push({
        id: `act_ghost_${move.id}`,
        action: lang === 'es'
          ? `Capitalizar caída de satisfacción de ${move.competitorName}`
          : `Capitalize on satisfaction drop from ${move.competitorName}`,
        title: lang === 'es'
          ? `Oportunidad de Mercado: ${move.competitorName} bajó a ${move.newValue}⭐`
          : `Market Opportunity: ${move.competitorName} dropped to ${move.newValue}⭐`,
        priority: 'MEDIUM',
        priorityScore: 75,
        reason: lang === 'es' ? move.whyItMattersEs : move.whyItMattersEn,
        expectedBenefit: lang === 'es'
          ? 'Captar clientes insatisfechos resaltando tu fiabilidad y garantías'
          : 'Win dissatisfied clients by highlighting your reliability and guarantee',
        whyNow: lang === 'es'
          ? 'Prospectos locales están buscando alternativas más confiables.'
          : 'Local prospects are actively looking for more reliable alternatives.',
        evidence: `${move.competitorName} rating: ${move.oldValue} → ${move.newValue}`,
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '3 min',
        estimatedMinutes: 3,
        destinationCode: 'FIND_LOCAL_LEADS',
        destination: {
          tab: 'client_acquisition',
          actionType: 'OUTREACH'
        },
        ctaLabel: lang === 'es' ? 'Ver Oportunidades de Captación' : 'View Acquisition Opportunities',
        bveltMoment: {
          whatIsHappening: lang === 'es'
            ? `${move.competitorName} bajó su calificación a ${move.newValue}⭐.`
            : `${move.competitorName} rating decreased to ${move.newValue}⭐.`,
          whyItMatters: lang === 'es' ? move.whyItMattersEs : move.whyItMattersEn,
          opportunitySummary: lang === 'es'
            ? 'Una caída en la reputación de la competencia crea una ventana de captación directa.'
            : 'A drop in competitor reputation creates a window for direct customer acquisition.',
          recommendedActionNow: lang === 'es' ? move.nextActionEs : move.nextActionEn,
          evidenceStatus: 'VERIFIED',
          evidenceSource: 'BEM Longitudinal POI History'
        }
      });
    }
  }

  return actions;
}
