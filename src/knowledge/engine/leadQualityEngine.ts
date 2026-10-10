/**
 * LeadQualityEngine for Bvelt
 * BLOCK 7: Lead Quality + Profitable Opportunity Foundation
 * 
 * Deterministic, explainable lead quality scoring and provenance tracking engine.
 * 
 * Master Matrix Principles:
 * - NO Isolated Features: Directly feeds ActionEngine, CommercialMetrics, and CRM workflows.
 * - Deterministic First: 100% executable without LLM/API dependencies.
 * - Data Provenance: Strictly enforces REAL, USER_PROVIDED, DERIVED, BENCHMARK, MODELED, INFERRED, UNKNOWN.
 * - Zero Mock Data: Missing contact/commercial data results in INSUFFICIENT_DATA or UNKNOWN, never fake numbers.
 * - Tenant Isolated: Lead records and private outcomes stored under TENANT_PRIVATE classification.
 */

import { ExtendedLead } from '../../components/ClientAcquisitionLeadList';
import { DataCache } from '../cache/dataCache';
import { createMemoryRecord, writeEvidenceRecord } from '../memory/bemStore';
import { createEntityIdentity } from '../memory/entityIdentity';
import { MemoryEvidenceRecord, DataClassification } from '../memory/bemTypes';

export type LeadQualityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export interface LeadQualityReason {
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  code: string;
  labelEs: string;
  labelEn: string;
  impact: number;
}

export type ProvenanceType = 
  | 'REAL' 
  | 'USER_PROVIDED' 
  | 'DERIVED' 
  | 'BENCHMARK' 
  | 'MODELED' 
  | 'INFERRED' 
  | 'UNKNOWN' 
  | 'INSUFFICIENT_DATA';

export interface LeadQualityProvenance {
  contactCompleteness: 'REAL' | 'USER_PROVIDED' | 'INSUFFICIENT_DATA';
  commercialValue: 'REAL' | 'USER_PROVIDED' | 'MODELED' | 'UNKNOWN';
  categoryMatch: 'REAL' | 'DERIVED' | 'UNKNOWN';
  overallClassification: ProvenanceType;
}

export interface LeadQualityEvaluation {
  leadId: string;
  businessName: string;
  qualityLevel: LeadQualityLevel;
  score: number; // Bounded 0 to 100
  reasons: LeadQualityReason[];
  provenance: LeadQualityProvenance;
  suggestedActionCode: 'CONTACT_IMMEDIATELY' | 'QUALIFY_DATA' | 'FOLLOW_UP_QUOTE' | 'RECORD_OUTCOME' | 'DEPRIORITIZE';
  effectiveValue: {
    amount: number | null;
    currency: string;
    provenance: 'REAL' | 'USER_PROVIDED' | 'MODELED' | 'UNKNOWN';
  };
  evaluatedAt: string;
}

const CACHE_NAMESPACE = 'LEAD_QUALITY';
const PRODUCER_VERSION = '7.0.0';

export class LeadQualityEngine {
  /**
   * Deterministically evaluates a single lead's commercial quality, explainability reasons,
   * and data provenance without requiring LLM dependencies.
   */
  static evaluateLead(
    lead: ExtendedLead | any,
    userProfile?: { category?: string; niche?: string; averageTicket?: number; location?: string } | null,
    lang: 'es' | 'en' = 'es'
  ): LeadQualityEvaluation {
    const isEn = lang === 'en';
    const leadId = lead.id || `lead_${Date.now()}`;
    const businessName = lead.client || lead.businessName || lead.name || (isEn ? 'Unnamed Lead' : 'Lead Sin Nombre');

    const cacheKey = `lead_qual_${leadId}_${lead.status || 'new'}_${lead.quoteAmount || 0}_${lead.actualRevenue || 0}`;
    const cached = DataCache.get<LeadQualityEvaluation>(cacheKey);
    if (cached) {
      return cached.data;
    }

    let score = 50; // Neutral starting base score
    const reasons: LeadQualityReason[] = [];

    // =========================================================================
    // 1. CONTACT COMPLETENESS CHECK (Max +30 / Min -20)
    // =========================================================================
    const hasPhone = Boolean(lead.phone && String(lead.phone).trim().length >= 7);
    const hasEmail = Boolean(lead.email && String(lead.email).includes('@'));
    const hasLocation = Boolean(lead.location || lead.city || lead.address);

    let contactCompleteness: 'REAL' | 'USER_PROVIDED' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';

    if (hasPhone && hasLocation) {
      score += 20;
      contactCompleteness = 'USER_PROVIDED';
      reasons.push({
        type: 'POSITIVE',
        code: 'CONTACT_COMPLETE_PHONE_LOCATION',
        labelEs: 'Contacto directo completo (Teléfono y Ubicación verificables)',
        labelEn: 'Complete direct contact details (Phone & Location available)',
        impact: 20
      });
    } else if (hasPhone || hasEmail) {
      score += 10;
      contactCompleteness = 'USER_PROVIDED';
      reasons.push({
        type: 'POSITIVE',
        code: 'CONTACT_CHANNEL_AVAILABLE',
        labelEs: 'Canal de comunicación directo disponible',
        labelEn: 'Direct communication channel available',
        impact: 10
      });
    } else {
      score -= 20;
      contactCompleteness = 'INSUFFICIENT_DATA';
      reasons.push({
        type: 'NEGATIVE',
        code: 'MISSING_CONTACT_CHANNEL',
        labelEs: 'Sin datos de contacto directos (Teléfono/Email ausentes)',
        labelEn: 'Missing direct contact channels (Phone/Email unavailable)',
        impact: -20
      });
    }

    // =========================================================================
    // 2. COMMERCIAL VALUE & CLARITY (Max +30 / Min -10)
    // =========================================================================
    let effectiveValueAmount: number | null = null;
    let commercialProvenance: 'REAL' | 'USER_PROVIDED' | 'MODELED' | 'UNKNOWN' = 'UNKNOWN';

    if (typeof lead.actualRevenue === 'number' && lead.actualRevenue > 0) {
      effectiveValueAmount = lead.actualRevenue;
      commercialProvenance = 'REAL';
      score += 25;
      reasons.push({
        type: 'POSITIVE',
        code: 'CONFIRMED_ACTUAL_REVENUE',
        labelEs: `Ingreso real confirmado ($${lead.actualRevenue.toLocaleString()})`,
        labelEn: `Confirmed actual revenue ($${lead.actualRevenue.toLocaleString()})`,
        impact: 25
      });
    } else if (typeof lead.quoteAmount === 'number' && lead.quoteAmount > 0) {
      effectiveValueAmount = lead.quoteAmount;
      commercialProvenance = 'USER_PROVIDED';
      score += 20;
      reasons.push({
        type: 'POSITIVE',
        code: 'FORMAL_QUOTE_SENT',
        labelEs: `Cotización formal emitida ($${lead.quoteAmount.toLocaleString()})`,
        labelEn: `Formal quote issued ($${lead.quoteAmount.toLocaleString()})`,
        impact: 20
      });
    } else if (typeof lead.estimatedValue === 'number' && lead.estimatedValue > 0) {
      effectiveValueAmount = lead.estimatedValue;
      commercialProvenance = 'MODELED';
      score += 10;
      reasons.push({
        type: 'NEUTRAL',
        code: 'MODELED_ESTIMATED_VALUE',
        labelEs: `Valor estimado del modelo ($${lead.estimatedValue.toLocaleString()})`,
        labelEn: `Model-estimated value ($${lead.estimatedValue.toLocaleString()})`,
        impact: 10
      });
    } else if (userProfile?.averageTicket && userProfile.averageTicket > 0) {
      effectiveValueAmount = userProfile.averageTicket;
      commercialProvenance = 'MODELED';
      score += 5;
      reasons.push({
        type: 'NEUTRAL',
        code: 'USER_TICKET_BENCHMARK',
        labelEs: `Basado en Ticket Promedio configurado ($${userProfile.averageTicket.toLocaleString()})`,
        labelEn: `Based on configured Average Ticket ($${userProfile.averageTicket.toLocaleString()})`,
        impact: 5
      });
    } else {
      score -= 5;
      commercialProvenance = 'UNKNOWN';
      reasons.push({
        type: 'NEGATIVE',
        code: 'COMMERCIAL_VALUE_UNKNOWN',
        labelEs: 'Valor económico del trabajo no especificado',
        labelEn: 'Commercial job value unstated',
        impact: -5
      });
    }

    // =========================================================================
    // 3. RECENCY & CRM STATUS INTENT (Max +20 / Min -15)
    // =========================================================================
    const statusUpper = String(lead.status || 'NEW').toUpperCase();

    if (statusUpper === 'RESPONDED' || statusUpper === 'QUALIFIED') {
      score += 20;
      reasons.push({
        type: 'POSITIVE',
        code: 'HIGH_BUYING_INTENT_STATUS',
        labelEs: 'Prospecto activo con respuesta o calificación confirmada',
        labelEn: 'Active prospect with confirmed response/qualification',
        impact: 20
      });
    } else if (statusUpper === 'QUOTE_SENT') {
      score += 15;
      reasons.push({
        type: 'POSITIVE',
        code: 'PENDING_QUOTE_DECISION',
        labelEs: 'Cotización en evaluación activa por el cliente',
        labelEn: 'Quote actively under evaluation by client',
        impact: 15
      });
    } else if (statusUpper === 'NEW' || statusUpper === 'NEW_LEAD') {
      score += 10;
      reasons.push({
        type: 'POSITIVE',
        code: 'NEW_UNCONTACTED_WINDOW',
        labelEs: 'Lead nuevo en ventana óptima de primer contacto',
        labelEn: 'New lead in optimal first-touchpoint window',
        impact: 10
      });
    } else if (statusUpper === 'LOST' || statusUpper === 'DISMISSED') {
      score -= 30;
      reasons.push({
        type: 'NEGATIVE',
        code: 'LEAD_CLOSED_LOST',
        labelEs: 'Prospecto descartado o no concretado',
        labelEn: 'Lead dismissed or lost',
        impact: -30
      });
    }

    // Check last contact freshness
    if (lead.lastContact) {
      const lastContactDate = new Date(lead.lastContact).getTime();
      const daysSince = (Date.now() - lastContactDate) / (1000 * 3600 * 24);
      if (daysSince > 7 && (statusUpper === 'NEW' || statusUpper === 'FOLLOW_UP')) {
        score -= 15;
        reasons.push({
          type: 'NEGATIVE',
          code: 'STALE_FOLLOWUP',
          labelEs: `Sin interacción en los últimos ${Math.round(daysSince)} días`,
          labelEn: `No touchpoint in the last ${Math.round(daysSince)} days`,
          impact: -15
        });
      }
    }

    // =========================================================================
    // 4. CATEGORY & MATCH ALIGNMENT (Max +10)
    // =========================================================================
    let categoryMatch: 'REAL' | 'DERIVED' | 'UNKNOWN' = 'UNKNOWN';
    if (lead.category && userProfile?.category) {
      const leadCat = String(lead.category).toLowerCase();
      const userCat = String(userProfile.category).toLowerCase();
      if (leadCat.includes(userCat) || userCat.includes(leadCat)) {
        score += 10;
        categoryMatch = 'REAL';
        reasons.push({
          type: 'POSITIVE',
          code: 'CATEGORY_EXACT_MATCH',
          labelEs: 'Alineación exacta con el nicho principal de tu negocio',
          labelEn: 'Exact match with your core business niche',
          impact: 10
        });
      } else {
        categoryMatch = 'DERIVED';
      }
    }

    // Bounded Score: 0 to 100
    const finalScore = Math.max(0, Math.min(100, score));

    // Determine Quality Level
    let qualityLevel: LeadQualityLevel = 'MEDIUM';
    if (!hasPhone && !hasEmail && !hasLocation) {
      qualityLevel = 'INSUFFICIENT_DATA';
    } else if (statusUpper === 'LOST' || statusUpper === 'DISMISSED' || finalScore < 35) {
      qualityLevel = 'LOW';
    } else if (finalScore >= 70) {
      qualityLevel = 'HIGH';
    } else if (finalScore >= 40) {
      qualityLevel = 'MEDIUM';
    } else {
      qualityLevel = 'LOW';
    }

    // Determine Overall Classification
    let overallClassification: ProvenanceType = 'USER_PROVIDED';
    if (commercialProvenance === 'REAL') {
      overallClassification = 'REAL';
    } else if (commercialProvenance === 'MODELED') {
      overallClassification = 'MODELED';
    } else if (contactCompleteness === 'INSUFFICIENT_DATA') {
      overallClassification = 'INSUFFICIENT_DATA';
    }

    // Suggested Next Action
    let suggestedActionCode: 'CONTACT_IMMEDIATELY' | 'QUALIFY_DATA' | 'FOLLOW_UP_QUOTE' | 'RECORD_OUTCOME' | 'DEPRIORITIZE' = 'QUALIFY_DATA';
    if (statusUpper === 'LOST' || statusUpper === 'DISMISSED' || qualityLevel === 'LOW') {
      suggestedActionCode = 'DEPRIORITIZE';
    } else if (statusUpper === 'WON') {
      suggestedActionCode = 'RECORD_OUTCOME';
    } else if (statusUpper === 'QUOTE_SENT') {
      suggestedActionCode = 'FOLLOW_UP_QUOTE';
    } else if (qualityLevel === 'HIGH' || statusUpper === 'NEW') {
      suggestedActionCode = 'CONTACT_IMMEDIATELY';
    } else if (qualityLevel === 'INSUFFICIENT_DATA') {
      suggestedActionCode = 'QUALIFY_DATA';
    }

    const evaluation: LeadQualityEvaluation = {
      leadId,
      businessName,
      qualityLevel,
      score: finalScore,
      reasons,
      provenance: {
        contactCompleteness,
        commercialValue: commercialProvenance,
        categoryMatch,
        overallClassification
      },
      suggestedActionCode,
      effectiveValue: {
        amount: effectiveValueAmount,
        currency: 'USD',
        provenance: commercialProvenance
      },
      evaluatedAt: new Date().toISOString()
    };

    DataCache.set(cacheKey, evaluation, 'LIVE_CLIENT_DATA', 'LeadQualityEngine', `lead_qual_${leadId}`, 15 * 60 * 1000);
    return evaluation;
  }

  /**
   * Batch evaluate multiple leads with memory caching
   */
  static evaluateLeadsBatch(
    leads: any[] = [],
    userProfile?: { category?: string; niche?: string; averageTicket?: number; location?: string } | null,
    lang: 'es' | 'en' = 'es'
  ): Record<string, LeadQualityEvaluation> {
    const result: Record<string, LeadQualityEvaluation> = {};
    if (!Array.isArray(leads)) return result;

    for (const lead of leads) {
      if (lead && (lead.id || lead.client || lead.businessName)) {
        const id = lead.id || lead.client || lead.businessName;
        result[id] = this.evaluateLead(lead, userProfile, lang);
      }
    }

    return result;
  }

  /**
   * Records a lead outcome state change as TENANT_PRIVATE BEM Evidence in history.
   * Guarantees producerVersion is set to '7.0.0' so Firestore batch writes never fail with undefined.
   */
  static async recordLeadOutcomeInBem(
    lead: ExtendedLead | any,
    tenantUid?: string | null
  ): Promise<void> {
    if (!lead || !lead.id) return;

    try {
      const identity = createEntityIdentity({
        canonicalName: lead.client || lead.businessName || 'Lead',
        city: lead.location || lead.city || 'Unknown'
      });

      const classification: DataClassification = 'TENANT_PRIVATE';
      const now = new Date().toISOString();

      const record = createMemoryRecord({
        entityId: identity.entityId,
        fieldKey: `lead_status_${lead.id}`,
        value: {
          leadId: lead.id,
          status: lead.status || 'NEW',
          quoteAmount: lead.quoteAmount || null,
          actualRevenue: lead.actualRevenue || null,
          wonDate: lead.wonDate || (lead.status === 'WON' ? now : null),
          lastContact: lead.lastContact || now,
          source: lead.source || 'CRM'
        },
        sourceType: 'BVELT_CRM_LEAD_QUALITY',
        sourceLabel: 'Bvelt CRM Lead Quality Engine',
        observationType: 'USER_PROVIDED',
        evidenceStatus: 'VERIFIED',
        confidence: 1.0,
        classification,
        producerVersion: PRODUCER_VERSION
      });

      await writeEvidenceRecord(identity, record, tenantUid);
    } catch (err) {
      console.warn('[LeadQualityEngine] Non-blocking lead outcome BEM recording warning:', err);
    }
  }
}
