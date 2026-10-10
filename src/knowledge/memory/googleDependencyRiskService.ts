/**
 * BVELT MEMORY v1 (BEM) — Google Dependency Risk Service
 * 
 * Orchestrates evaluation, caching, BEM evidence write-back, and ActionEngine integration
 * for the Google Dependency Risk Score.
 * 
 * Invariants:
 * - Deterministic computation from existing memory and operating signals.
 * - Zero new external API calls, zero LLM calls, zero Firestore write storms.
 * - Tenant private classification (isolated per user/entity).
 * - Readily consumable by ActionEngine.
 */

import {
  GoogleDependencyRiskSummary,
  GoogleRiskComponent
} from './googleDependencyRiskTypes';
import {
  BusinessOperatingSignals,
  calculateGoogleDependencyRisk,
  createInsufficientDataRiskSummary,
  PRODUCER_VERSION
} from './googleDependencyRiskEvaluator';
import { createEntityIdentity } from './entityIdentity';
import { createMemoryRecord, writeEntityEvidenceBatch, getEntityMemoryContext } from './bemStore';
import { DataCache } from '../cache/dataCache';
import { NextBestAction } from '../engine/actionEngine';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CACHE_NAMESPACE = 'LOCAL_BUSINESSES';
const RISK_CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL in memory/localStorage

// In-Memory L1 Cache
const L1_RISK_CACHE = new Map<string, { summary: GoogleDependencyRiskSummary; timestamp: number }>();

// Write-back debounce map
const WRITE_BACK_TIMERS = new Map<string, NodeJS.Timeout>();

export class GoogleDependencyRiskService {
  /**
   * Retrieves or computes the Google Dependency Risk Score using available in-memory/operating signals.
   * Does NOT make external network requests.
   */
  static evaluateRisk(
    entityId: string,
    signals: BusinessOperatingSignals,
    options?: { forceRecalculate?: boolean }
  ): GoogleDependencyRiskSummary {
    const cacheKey = `bem_gdr_${entityId}`;

    // 1. Check L1 Memory Cache
    if (!options?.forceRecalculate) {
      const l1 = L1_RISK_CACHE.get(entityId);
      if (l1 && Date.now() - l1.timestamp < RISK_CACHE_TTL) {
        return l1.summary;
      }

      // 2. Check DataCache L2
      const l2 = DataCache.get<GoogleDependencyRiskSummary>(cacheKey);
      if (l2 && l2.data && !l2.isStale) {
        L1_RISK_CACHE.set(entityId, { summary: l2.data, timestamp: Date.now() });
        return l2.data;
      }
    }

    // 3. Compute Deterministically
    const enrichedSignals: BusinessOperatingSignals = {
      ...signals,
      entityId
    };

    const summary = calculateGoogleDependencyRisk(enrichedSignals);

    // 4. Save to L1 and L2
    L1_RISK_CACHE.set(entityId, { summary, timestamp: Date.now() });
    DataCache.set(cacheKey, summary, 'LOCAL_BUSINESSES', 'Google Dependency Risk Evaluator', entityId);

    // 5. Schedule Non-blocking BEM Write-Back
    this.scheduleBemWriteBack(entityId, summary, signals.businessName);

    return summary;
  }

  /**
   * Returns risk summary synchronously from memory/cache or fallback default.
   */
  static getRiskSummarySync(entityId: string): GoogleDependencyRiskSummary {
    const l1 = L1_RISK_CACHE.get(entityId);
    if (l1) return l1.summary;

    const l2 = DataCache.get<GoogleDependencyRiskSummary>(`bem_gdr_${entityId}`);
    if (l2 && l2.data) {
      L1_RISK_CACHE.set(entityId, { summary: l2.data, timestamp: Date.now() });
      return l2.data;
    }

    return createInsufficientDataRiskSummary(entityId);
  }

  /**
   * Schedules a debounced, non-blocking write-back to BEM evidence memory.
   */
  private static scheduleBemWriteBack(
    entityId: string,
    summary: GoogleDependencyRiskSummary,
    businessName?: string
  ) {
    if (WRITE_BACK_TIMERS.has(entityId)) {
      clearTimeout(WRITE_BACK_TIMERS.get(entityId)!);
    }

    const timer = setTimeout(async () => {
      WRITE_BACK_TIMERS.delete(entityId);
      try {
        await this.persistToBemStore(entityId, summary, businessName);
      } catch (err) {
        console.warn('[GoogleDependencyRiskService] BEM persistence warning:', err);
      }
    }, 2000);

    WRITE_BACK_TIMERS.set(entityId, timer);
  }

  /**
   * Persists the computed risk score to BEM Memory Store as a formal MemoryEvidenceRecord.
   */
  static async persistToBemStore(
    entityId: string,
    summary: GoogleDependencyRiskSummary,
    businessName?: string
  ): Promise<void> {
    const identity = createEntityIdentity({
      canonicalName: businessName || entityId
    });
    identity.entityId = entityId;

    const record = createMemoryRecord<GoogleDependencyRiskSummary>({
      entityId,
      fieldKey: 'google_dependency_risk',
      value: summary,
      valueType: 'object',
      observationType: 'SYSTEM_COMPUTED',
      evidenceStatus: summary.evidenceStatus,
      classification: 'TENANT_PRIVATE',
      confidence: 0.95,
      sourceType: 'GOOGLE_DEPENDENCY_RISK_ENGINE',
      sourceLabel: 'Bvelt Resilience & Risk Engine',
      producerVersion: PRODUCER_VERSION,
      formula: 'Sum(ComponentRisk_i * Weight_i)',
      assumptions: [
        'Deterministic weighting across 6 Google service categories',
        'Fallback quality factor mitigates up to 75% of raw single-point failure exposure',
        'Zero external API cost incurred during risk derivation'
      ]
    });

    await writeEntityEvidenceBatch(identity, [record], null);
  }

  /**
   * Generates actionable NextBestActions for ActionEngine based on dependency vulnerabilities.
   */
  static translateRiskToActions(
    summary: GoogleDependencyRiskSummary,
    t: (es: string, en: string) => string
  ): NextBestAction[] {
    const actions: NextBestAction[] = [];
    if (!summary || summary.status === 'INSUFFICIENT_DATA' || summary.overallScore < 35) {
      return actions;
    }

    // High Review Dependency Risk Mitigation
    const reviewComp = summary.components['GBP_REVIEWS'];
    if (reviewComp && reviewComp.adjustedRiskScore >= 50) {
      actions.push({
        id: 'nba_gdr_diversify_reviews',
        action: t(
          'Blindar Reputación contra Fallos de Google',
          'Shield Reputation Against Google Outages'
        ),
        title: t(
          'Riesgo de Dependencia Crítica en Google Reviews',
          'Critical Dependency Risk on Google Reviews'
        ),
        priority: reviewComp.adjustedRiskScore >= 70 ? 'VERY_HIGH' : 'HIGH',
        priorityScore: Math.min(95, 75 + Math.round(reviewComp.adjustedRiskScore * 0.2)),
        reason: t(
          `Tu reputación depende en un ${Math.round(reviewComp.adjustedRiskScore)}% de Google. Si una reseña es bloqueada o el servicio falla, pierdes tracción.`,
          `Your reputation is ${Math.round(reviewComp.adjustedRiskScore)}% reliant on Google. If a review is suspended or service fails, traction is lost.`
        ),
        expectedBenefit: t(
          'Capturar testimonios verificados propios en Bvelt y asegurar retención independiente de clientes.',
          'Capture proprietary verified testimonials in Bvelt and secure independent customer retention.'
        ),
        whyNow: t(
          'La resiliencia multicanal protege tus ventas locales ante cambios en políticas de Google.',
          'Multi-channel resilience shields local revenue against Google policy shifts.'
        ),
        evidence: reviewComp.fallbackDescriptionEs,
        evidenceLevel: 'DERIVED',
        confidence: 'HIGH',
        estimatedTime: '5 min',
        destinationCode: 'REPUTATION_SHIELD' as any,
        destination: { tab: 'reputation' },
        ctaLabel: t('Activar Escudo de Reseñas', 'Activate Reputation Shield')
      });
    }

    // High Traffic/Acquisition Dependency Risk Mitigation
    const perfComp = summary.components['GBP_PERFORMANCE'];
    if (perfComp && perfComp.adjustedRiskScore >= 50) {
      actions.push({
        id: 'nba_gdr_diversify_traffic',
        action: t(
          'Diversificar Captación de Clientes Fuera de Maps',
          'Diversify Customer Acquisition Outside Maps'
        ),
        title: t(
          'Concentración de Tráfico en Ficha de Maps',
          'Traffic Concentration on Maps Listing'
        ),
        priority: 'HIGH',
        priorityScore: 82,
        reason: t(
          'El 90% de tus llamadas y consultas provienen de Google Maps sin canal directo de prospección.',
          '90% of your incoming calls originate from Google Maps without direct outreach channels.'
        ),
        expectedBenefit: t(
          'Generar flujo predecible de contactos mediante prospección comercial directa B2B y WhatsApp.',
          'Generate predictable deal flow via direct B2B outreach and WhatsApp pipeline.'
        ),
        whyNow: t(
          'Diversificar canales reduce el coste de adquisición y protege tus ingresos.',
          'Diversifying channels reduces CAC and protects recurring revenue.'
        ),
        evidence: perfComp.fallbackDescriptionEs,
        evidenceLevel: 'DERIVED',
        confidence: 'HIGH',
        estimatedTime: '10 min',
        destinationCode: 'PROSPECTING' as any,
        destination: { tab: 'prospecting' },
        ctaLabel: t('Explorar Prospectos B2B', 'Explore B2B Prospects')
      });
    }


    return actions;
  }
}
