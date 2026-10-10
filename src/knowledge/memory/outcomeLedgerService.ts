/**
 * BVELT Outcome Ledger Integration Service
 * Records every Action Engine execution into the canonical Record V1 Outcome Ledger.
 * 
 * Master Data Contract:
 * Explicit Outcome States:
 * - MEASURED: Real, verified outcomes observed from customer interaction or verified platform state.
 * - DECLARED: Operator-provided or user-attested activity (e.g. operator confirmed sending draft).
 * - ESTIMATED: Modeled or projected business value before real evidence is observed.
 * - UNKNOWN: Failed, timed out, or unverified external execution.
 * 
 * Rules:
 * - Never claim revenue, conversions, or completed actions without evidence.
 * - Record businessId, tool/action, execution state, timestamp, and real provider cost ($0.00 if internal/draft).
 * - Reuses existing Record V1 ledger storage (`bvelt_outcomes_v1` and BEM Arbitrage Events).
 */

import { OutcomeState } from './bemTypes';
export type { OutcomeState };
import { recordHistoricalArbitrageEvent, recordBveltEvent } from './bemStore';
import { createEntityIdentity } from './entityIdentity';
import { EvidenceStatus } from '../../lib/bveltEvidence';
import { ActionEngineToolId } from '../engine/autonomyPolicy';
import { postTrustStackIntent } from '../../lib/trustStackService';
import { RecoveryFeeService } from '../../services/recoveryFeeService';

export interface TimelineItem {
  id: string;
  businessId: string;
  status: 'suggested' | 'executed' | 'measured' | 'won' | 'lost';
  stage: 'SUGGESTED' | 'EXECUTED' | 'MEASURED';
  title: string;
  description: string;
  timestamp: string;
  value?: number | null;
  metricName?: string;
  evidenceStatus: EvidenceStatus;
  rawEntry?: OutcomeLedgerEntry | OutcomeLedgerSuggestionEvent;
}

export type ActionExecutionState = 
  | 'SUCCESS' 
  | 'DRAFT_CREATED' 
  | 'QUEUED' 
  | 'UNAVAILABLE' 
  | 'BLOCKED_BY_POLICY' 
  | 'APPROVAL_REQUIRED';

export interface OutcomeLedgerEntry {
  id: string;
  businessId: string;
  actionId?: string;
  toolId: ActionEngineToolId | string;
  executionState: ActionExecutionState;
  outcomeState: OutcomeState;
  outcomeType: string;
  metricName: string;
  description: string;
  value: number | null; // ONLY when real confirmed revenue or ticket value is present
  providerCostUsd: number | null; // real API/provider cost, e.g. 0.00 for local drafts
  timestamp: string;
  sourceLabel: string;
  evidenceStatus: EvidenceStatus;
  metadata?: Record<string, any>;
}

export interface OutcomeLedgerSuggestionEvent {
  businessId: string;
  problem: string;
  recommendationId: string;
  actionType: string;
  status: 'suggested' | 'approved' | 'executed' | 'measured';
  evidenceRefs: string[];
  createdAt: string;
  resultCents?: number;
}

export interface RecordExecutionOutcomeParams {
  businessId: string;
  toolId: ActionEngineToolId | string;
  actionId?: string;
  executionState: ActionExecutionState;
  outcomeState: OutcomeState;
  metricName: 'LEADS' | 'REVIEWS' | 'ESTIMATES' | 'JOBS' | 'REPUTATION' | 'SYSTEM';
  outcomeType: string;
  description: string;
  value?: number | null;
  providerCostUsd?: number | null;
  businessName?: string;
  city?: string;
  tenantUid?: string | null;
  metadata?: Record<string, any>;
}

const STORAGE_OUTCOMES_V1_KEY = 'bvelt_outcomes_v1';

export class OutcomeLedgerService {
  /**
   * Records an execution event into the canonical Record V1 Outcome Ledger
   */
  static recordExecution(params: RecordExecutionOutcomeParams): OutcomeLedgerEntry {
    // Idempotency check to prevent duplicate ledger entries on job retries
    if (params.metadata?.idempotencyKey) {
      const existing = this.getStoredEntries().find(
        e => e.metadata?.idempotencyKey === params.metadata?.idempotencyKey
      );
      if (existing) {
        return existing;
      }
    }

    const now = new Date().toISOString();
    const id = `out_ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Map evidence status honestly
    let evidenceStatus: EvidenceStatus = 'DERIVED';
    if (params.outcomeState === 'MEASURED') {
      evidenceStatus = 'VERIFIED';
    } else if (params.outcomeState === 'DECLARED') {
      evidenceStatus = 'USER_PROVIDED';
    } else if (params.outcomeState === 'ESTIMATED') {
      evidenceStatus = 'MODELED';
    } else {
      evidenceStatus = 'DERIVED';
    }

    const entry: OutcomeLedgerEntry = {
      id,
      businessId: params.businessId,
      actionId: params.actionId,
      toolId: params.toolId,
      executionState: params.executionState,
      outcomeState: params.outcomeState,
      outcomeType: params.outcomeType,
      metricName: params.metricName,
      description: params.description,
      value: typeof params.value === 'number' && !isNaN(params.value) ? params.value : null,
      providerCostUsd: typeof params.providerCostUsd === 'number' ? params.providerCostUsd : 0,
      timestamp: now,
      sourceLabel: 'BVELT_ACTION_ENGINE',
      evidenceStatus,
      metadata: params.metadata
    };

    // 1. Persist to existing localStorage `bvelt_outcomes_v1`
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_OUTCOMES_V1_KEY);
        const existing = raw ? JSON.parse(raw) : [];
        // Keep in sync with legacy BveltActionCenter structure while adding full canonical typed fields
        const legacyCompatible = {
          ...entry,
          type: params.outcomeType,
          date: now,
          verified: params.outcomeState === 'MEASURED'
        };
        const updated = [legacyCompatible, ...existing].slice(0, 300);
        localStorage.setItem(STORAGE_OUTCOMES_V1_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('[OutcomeLedgerService] Failed to persist to localStorage:', e);
      }
    }

    // 2. Persist to BEM Memory Arbitrage Event (Block 9 & Verified Record V1)
    try {
      const identity = createEntityIdentity({
        canonicalName: params.businessName || 'Local Business',
        city: params.city
      });

      const entityPath = `entities/${identity.entityId}/events/${entry.id}`;

      recordHistoricalArbitrageEvent({
        identity,
        fieldKey: `outcome_exec_${entry.id}`,
        relationship: 'OUTCOME_OBSERVATION',
        value: {
          executionId: entry.id,
          toolId: entry.toolId,
          executionState: entry.executionState,
          outcomeState: entry.outcomeState,
          metricName: entry.metricName,
          value: entry.value,
          providerCostUsd: entry.providerCostUsd,
          description: entry.description,
          recordedAt: now
        },
        sourceType: 'BVELT_ACTION_ENGINE',
        sourceLabel: 'Bvelt ActionEngine Execution',
        classification: 'TENANT_PRIVATE',
        evidenceStatus,
        actionReference: {
          actionId: params.actionId || entry.id,
          actionType: entry.toolId,
          status: params.executionState === 'SUCCESS' ? 'COMPLETED' : params.executionState === 'DRAFT_CREATED' ? 'RECOMMENDED' : 'EXECUTED',
          executedAt: now
        },
        outcomeReference: {
          outcomeType: entry.outcomeType,
          metricName: entry.metricName,
          newValue: entry.value ?? entry.outcomeState,
          associationType: params.outcomeState === 'UNKNOWN' ? 'INSUFFICIENT_DATA' : 'OBSERVED_AFTER'
        },
        tenantUid: params.tenantUid
      })
        .then(() => {
          console.log('[BEM Write-Back]', {
            bemPersist: 'SUCCESS',
            entityId: identity.entityId,
            reason: 'OUTCOME_RECORDED',
            path: entityPath
          });
        })
        .catch(err => {
          console.warn('[BEM Write-Back]', {
            bemPersist: 'FAILED',
            entityId: identity.entityId,
            reason: err?.message || 'Ledger event persistence warning',
            path: entityPath
          });
        });
    } catch (e: any) {
      console.warn('[BEM Write-Back]', {
        bemPersist: 'FAILED',
        entityId: params.businessId,
        reason: e?.message || 'Non-blocking execution error',
        path: `entities/${params.businessId}/events`
      });
    }

    return entry;
  }

  /**
   * Appends a 'suggested' recommendation event into the outcome ledger event log
   */
  static recordSuggestion(params: {
    businessId: string;
    problem: string;
    recommendationId: string;
    actionType: string;
    evidenceRefs?: string[];
    resultCents?: number;
  }): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const now = new Date().toISOString();
      const event: OutcomeLedgerSuggestionEvent = {
        businessId: params.businessId || 'default_biz',
        problem: params.problem || 'Revenue Leakage Detected',
        recommendationId: params.recommendationId || 'nba_top_action',
        actionType: params.actionType || 'RECOMMENDATION',
        status: 'suggested',
        evidenceRefs: params.evidenceRefs || [],
        createdAt: now,
        resultCents: params.resultCents
      };

      const raw = localStorage.getItem('bvelt_outcome_events_v1') || '[]';
      const events: OutcomeLedgerSuggestionEvent[] = JSON.parse(raw);
      // Non-duplicating throttle for recent same suggestion
      const isDuplicate = events.some(
        e => e.recommendationId === event.recommendationId && 
             e.businessId === event.businessId && 
             e.status === 'suggested' && 
             (Date.now() - new Date(e.createdAt).getTime()) < 300000
      );
      if (!isDuplicate) {
        events.unshift(event);
        localStorage.setItem('bvelt_outcome_events_v1', JSON.stringify(events.slice(0, 200)));
      }
    } catch (e) {
      console.warn('[OutcomeLedgerService] Non-blocking suggestion event write warning:', e);
    }
  }

  /**
   * Retrieves suggestion events from storage
   */
  static getSuggestionEvents(businessId?: string): OutcomeLedgerSuggestionEvent[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem('bvelt_outcome_events_v1') || '[]';
      const list: OutcomeLedgerSuggestionEvent[] = JSON.parse(raw);
      if (!businessId) return list;
      return list.filter(item => !item.businessId || item.businessId === businessId);
    } catch {
      return [];
    }
  }

  /**
   * Manual "Mark Result" (Won / Lost + optional $) so outcomes exist without bank sync.
   * Also triggers non-blocking TrustStack intent notification if TRUSTSTACK_URL is configured.
   */
  static async markManualResult(params: {
    businessId: string;
    actionId?: string;
    recommendationId?: string;
    status: 'won' | 'lost';
    value?: number | null;
    notes?: string;
    businessName?: string;
    city?: string;
    metricName?: 'LEADS' | 'REVIEWS' | 'ESTIMATES' | 'JOBS' | 'REPUTATION' | 'SYSTEM';
  }): Promise<OutcomeLedgerEntry> {
    const isWon = params.status === 'won';
    const amountVal = isWon && typeof params.value === 'number' && !isNaN(params.value) ? Math.max(0, params.value) : 0;
    const amountCents = Math.round(amountVal * 100);

    // Non-blocking TrustStack intent notification
    try {
      await postTrustStackIntent({
        actionId: params.actionId || params.recommendationId || `res_${Date.now()}`,
        actionType: isWon ? 'DEAL_WON_MEASURED' : 'DEAL_LOST_MEASURED',
        businessId: params.businessId,
        riskLevel: isWon && amountVal > 1000 ? 'HIGH' : 'MEDIUM',
        amountCents,
        metadata: {
          status: params.status,
          notes: params.notes,
          businessName: params.businessName
        }
      });
    } catch (e) {
      console.warn('[OutcomeLedgerService] Non-blocking TrustStack hook error:', e);
    }

    // 1. Record execution as MEASURED outcome
    const nowIso = new Date().toISOString();
    const entry = this.recordExecution({
      businessId: params.businessId,
      actionId: params.actionId || params.recommendationId,
      toolId: isWon ? 'manual_mark_won' : 'manual_mark_lost',
      executionState: 'SUCCESS',
      outcomeState: 'MEASURED',
      metricName: params.metricName || 'LEADS',
      outcomeType: isWon ? 'OWNER_MARKED_RECOVERED' : 'LOST',
      description: params.notes || (isWon ? `Resultado confirmado: Ganado ($${amountVal.toLocaleString()})` : 'Resultado confirmado: No cerrado / Perdido'),
      value: isWon ? amountVal : null,
      providerCostUsd: 0,
      businessName: params.businessName,
      city: params.city,
      metadata: {
        manualMark: true,
        resultStatus: params.status,
        ownerMarkedAt: nowIso,
        notes: params.notes
      }
    });

    // Record BEM Event for longitudinal business memory
    if (isWon) {
      recordBveltEvent({
        tenantId: params.businessId,
        type: 'owner_marked_recovered',
        sourceType: 'manual_owner',
        sourceName: 'Owner Verification',
        fetchedAt: nowIso,
        provenance: 'USER_OWNER_CONFIRMATION',
        consentScope: 'private',
        meta: {
          value: amountVal,
          ownerMarkedAt: nowIso,
          actionId: params.actionId,
          notes: params.notes
        }
      });

      // Record recovery fee transition: pending -> confirmed -> fee_due
      try {
        RecoveryFeeService.confirmRecovery({
          opportunityId: params.actionId || params.recommendationId,
          businessId: params.businessId,
          trigger: 'owner_marked',
          hasOwnerMarked: true,
          clientValue: amountVal,
          ownerTimestamp: nowIso,
          notes: params.notes
        });
      } catch (err) {
        console.warn('[OutcomeLedgerService] RecoveryFee confirmation error:', err);
      }
    }

    // 2. Mark any related suggestion event as measured
    if (typeof localStorage !== 'undefined' && params.recommendationId) {
      try {
        const raw = localStorage.getItem('bvelt_outcome_events_v1') || '[]';
        const events: OutcomeLedgerSuggestionEvent[] = JSON.parse(raw);
        let updated = false;
        for (const ev of events) {
          if (ev.recommendationId === params.recommendationId || ev.businessId === params.businessId) {
            ev.status = 'measured';
            ev.resultCents = amountCents;
            updated = true;
            break;
          }
        }
        if (updated) {
          localStorage.setItem('bvelt_outcome_events_v1', JSON.stringify(events));
        }
      } catch (e) {
        console.warn('[OutcomeLedgerService] Could not update suggestion status:', e);
      }
    }

    return entry;
  }

  /**
   * Retrieves unified chronological timeline per business: suggested -> executed -> measured
   */
  static getTimelineForBusiness(businessId?: string): TimelineItem[] {
    const executions = this.getEntries(businessId);
    const suggestions = this.getSuggestionEvents(businessId);
    const timeline: TimelineItem[] = [];

    // 1. Map suggestions
    for (const sug of suggestions) {
      timeline.push({
        id: `sug_${sug.recommendationId}_${new Date(sug.createdAt).getTime()}`,
        businessId: sug.businessId,
        status: (sug.status === 'approved' ? 'executed' : sug.status) as any,
        stage: 'SUGGESTED',
        title: sug.problem || 'Oportunidad de Crecimiento Sugerida',
        description: `Acción recomendada: ${sug.actionType}`,
        timestamp: sug.createdAt,
        value: sug.resultCents ? sug.resultCents / 100 : null,
        evidenceStatus: 'DERIVED',
        rawEntry: sug
      });
    }

    // 2. Map executions and outcomes
    for (const exec of executions) {
      const typeUpper = (exec.outcomeType || '').toUpperCase();
      let status: 'executed' | 'measured' | 'won' | 'lost' = 'executed';
      let stage: 'EXECUTED' | 'MEASURED' = 'EXECUTED';

      if (typeUpper === 'WON' || (exec.outcomeState === 'MEASURED' && (exec.value ?? 0) > 0)) {
        status = 'won';
        stage = 'MEASURED';
      } else if (typeUpper === 'LOST') {
        status = 'lost';
        stage = 'MEASURED';
      } else if (exec.outcomeState === 'MEASURED') {
        status = 'measured';
        stage = 'MEASURED';
      } else {
        status = 'executed';
        stage = 'EXECUTED';
      }

      timeline.push({
        id: exec.id,
        businessId: exec.businessId,
        status,
        stage,
        title: exec.description || `Acción ${exec.toolId}`,
        description: `Canal: ${exec.outcomeType} • Métrica: ${exec.metricName}`,
        timestamp: exec.timestamp,
        value: exec.value,
        metricName: exec.metricName,
        evidenceStatus: exec.evidenceStatus,
        rawEntry: exec
      });
    }

    // Sort newest first
    return timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Retrieves outcome ledger entries from storage
   */
  static getEntries(businessId?: string): OutcomeLedgerEntry[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_OUTCOMES_V1_KEY);
      if (!raw) return [];
      const list: OutcomeLedgerEntry[] = JSON.parse(raw);
      if (!businessId) return list;
      return list.filter(item => !item.businessId || item.businessId === businessId);
    } catch {
      return [];
    }
  }

  /**
   * Aggregates confirmed and declared financial ROI attribution from the ledger.
   * Feeds the Dashboard ROI Loop with verified dollars and execution counts.
   */
  static getFinancialAttribution(businessId?: string): {
    wonRevenue: number;
    pipelineValue: number;
    totalExecutions: number;
    measuredCount: number;
    declaredCount: number;
    leadsContactedCount: number;
    reviewsRequestedCount: number;
    estimatesSentCount: number;
    roiMultiplier: number;
  } {
    const entries = this.getEntries(businessId);
    let wonRevenue = 0;
    let pipelineValue = 0;
    let measuredCount = 0;
    let declaredCount = 0;
    let leadsContactedCount = 0;
    let reviewsRequestedCount = 0;
    let estimatesSentCount = 0;

    for (const item of entries) {
      const val = typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0;
      const typeUpper = (item.outcomeType || '').toUpperCase();
      const metric = (item.metricName || '').toUpperCase();

      if (item.outcomeState === 'MEASURED') measuredCount++;
      if (item.outcomeState === 'DECLARED') declaredCount++;

      // REGULATED REVENUE ATTRIBUTION (Rule 1 & 3):
      // Recuperado SOLO si: respuesta del cliente registrada O dueño marca cita/trabajo (timestamp).
      // share_opened NO cuenta NUNCA.
      const isShareOpened = typeUpper === 'SHARE_OPENED' || item.metadata?.type === 'share_opened' || item.metadata?.action === 'share_opened';

      const hasCustomerReply = Boolean(
        item.metadata?.customerRepliedAt ||
        item.metadata?.hasCustomerReply ||
        item.metadata?.customerReplyTimestamp ||
        typeUpper === 'CUSTOMER_REPLIED' ||
        typeUpper === 'CUSTOMER_REPLY_REGISTERED'
      );

      const hasOwnerMarked = Boolean(
        typeUpper === 'OWNER_MARKED_RECOVERED' ||
        item.metadata?.ownerMarkedAt ||
        item.metadata?.appointmentScheduledAt ||
        item.metadata?.jobScheduledAt ||
        item.metadata?.scheduledAt ||
        item.metadata?.wonAt ||
        item.metadata?.closedAt ||
        (item.metadata?.manualMark && Boolean(item.metadata?.ownerMarkedAt || item.timestamp))
      );

      const isEligibleRecovered = !isShareOpened && (hasCustomerReply || hasOwnerMarked);

      if (isEligibleRecovered && (typeUpper === 'WON' || typeUpper === 'ACCEPTED' || typeUpper.includes('WON') || typeUpper === 'OWNER_MARKED_RECOVERED')) {
        wonRevenue += val;
      } else if (val > 0) {
        pipelineValue += val;
      }

      if (metric === 'LEADS' || typeUpper.includes('LEAD') || typeUpper.includes('WHATSAPP') || typeUpper.includes('CALL')) {
        leadsContactedCount++;
      }
      if (metric === 'REVIEWS' || typeUpper.includes('REVIEW')) {
        reviewsRequestedCount++;
      }
      if (metric === 'ESTIMATES' || typeUpper.includes('ESTIMATE') || typeUpper.includes('QUOTE')) {
        estimatesSentCount++;
      }
    }

    return {
      wonRevenue,
      pipelineValue,
      totalExecutions: entries.length,
      measuredCount,
      declaredCount,
      leadsContactedCount,
      reviewsRequestedCount,
      estimatesSentCount,
      roiMultiplier: wonRevenue > 0 ? Number((wonRevenue / 97).toFixed(1)) : 0
    };
  }
}

export interface BemOutcomePayload {
  businessId?: string;
  businessName?: string;
  city?: string;
  actionId?: string;
  toolId?: string;
  channel: 'whatsapp' | 'call' | 'email' | 'gmb' | 'copy' | 'checklist' | 'direct' | string;
  actionType?: string;
  executionState?: ActionExecutionState;
  outcomeState?: OutcomeState;
  metricName?: 'LEADS' | 'REVIEWS' | 'ESTIMATES' | 'JOBS' | 'REPUTATION' | 'SYSTEM';
  description?: string;
  value?: number | null;
  providerCostUsd?: number | null;
  tenantUid?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Unified Canonical Helper for recording user-action outcomes into BEM / Outcome Ledger.
 * Non-blocking, handles defaults, outputs standardized logs.
 */
export function recordBemOutcome(payload: BemOutcomePayload): OutcomeLedgerEntry {
  const businessId = payload.businessId || 'default_business';
  const toolId = payload.toolId || payload.actionType || 'bvelt_action';
  const executionState = payload.executionState || 'SUCCESS';
  const outcomeState = payload.outcomeState || 'DECLARED';
  
  let metricName: 'LEADS' | 'REVIEWS' | 'ESTIMATES' | 'JOBS' | 'REPUTATION' | 'SYSTEM' = payload.metricName || 'LEADS';
  if (!payload.metricName) {
    const tLower = toolId.toLowerCase();
    if (tLower.includes('review') || tLower.includes('reseña')) {
      metricName = 'REVIEWS';
    } else if (tLower.includes('estimate') || tLower.includes('quote') || tLower.includes('presupuesto')) {
      metricName = 'ESTIMATES';
    } else if (tLower.includes('checklist') || tLower.includes('audit')) {
      metricName = 'SYSTEM';
    }
  }

  const entry = OutcomeLedgerService.recordExecution({
    businessId,
    toolId,
    actionId: payload.actionId,
    executionState,
    outcomeState,
    metricName,
    outcomeType: payload.channel.toUpperCase(),
    description: payload.description || `Action executed via ${payload.channel}`,
    value: payload.value ?? 0,
    providerCostUsd: payload.providerCostUsd ?? 0,
    businessName: payload.businessName,
    city: payload.city,
    tenantUid: payload.tenantUid,
    metadata: {
      channel: payload.channel,
      actionType: payload.actionType || toolId,
      ...payload.metadata
    }
  });

  console.log('[BEM Outcome Recorded]', {
    actionId: payload.actionId || entry.id,
    toolId: entry.toolId,
    actionType: payload.actionType || toolId,
    outcomeState: entry.outcomeState,
    channel: payload.channel,
    businessId: entry.businessId,
    timestamp: entry.timestamp
  });

  return entry;
}
