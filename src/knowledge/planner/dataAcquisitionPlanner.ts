import { ApiBudgetGuard } from '../cache/budgetManager';
import { EntityMemoryContext } from '../memory/bemTypes';
import { BemTelemetry } from '../memory/bemTelemetry';

export interface AcquisitionNeed {
  field: string;
  required: boolean;
  freshnessMaxAgeDays: number;
}

export interface AcquisitionPlan {
  availableLocally: string[]; // Fields available in Reference or Cache
  needsLiveEnrichment: string[]; // Fields that must be fetched from API
  liveSourcesApproved: string[]; // Providers allowed based on budget
}

export interface MemorySavingsMetrics {
  totalFieldsRequested: number;
  fieldsReusedFromMemory: number;
  fieldsReusedFromStatic: number;
  externalCallsAvoided: number;
  savingsRatioPercent: number;
}

export interface MemoryAwarePlan {
  availableLocally: string[];
  needsLiveEnrichment: string[];
  liveSourcesApproved: string[];
  conflictedFields: string[];
  reusedFieldValues: Record<string, any>;
  savings: MemorySavingsMetrics;
}

// Deterministic static knowledge fields that do not require external API calls
const STATIC_KNOWLEDGE_FIELDS = new Set([
  'naicsCode',
  'geography',
  'marketBenchmark',
  'demographics',
  'industryCategory'
]);

/**
 * The Data Acquisition Planner analyzes required information, local BEM memory context,
 * static knowledge, and API budget to execute measured targeted acquisitions.
 */
export class DataAcquisitionPlanner {
  /**
   * Plans execution of a Business Scan (legacy interface backward compatibility)
   */
  static planBusinessScan(needs: AcquisitionNeed[], localDataKeysAvailable: string[]): AcquisitionPlan {
    const availableLocally: string[] = [];
    const needsLiveEnrichment: string[] = [];
    
    for (const need of needs) {
      if (localDataKeysAvailable.includes(need.field)) {
        availableLocally.push(need.field);
      } else {
        needsLiveEnrichment.push(need.field);
      }
    }

    const liveSourcesApproved: string[] = [];
    
    if (needsLiveEnrichment.includes('location') || needsLiveEnrichment.includes('competitors')) {
      if (ApiBudgetGuard.canCall('geoapify')) {
        liveSourcesApproved.push('geoapify');
      } else {
        console.warn("[Planner] Geoapify budget exhausted. Will use fallback or fail gracefully.");
      }
    }

    if (needsLiveEnrichment.includes('web_presence')) {
      if (ApiBudgetGuard.canCall('tavily')) {
        liveSourcesApproved.push('tavily');
      } else if (ApiBudgetGuard.canCall('you')) {
        liveSourcesApproved.push('you');
      }
    }

    return {
      availableLocally,
      needsLiveEnrichment,
      liveSourcesApproved
    };
  }

  /**
   * Memory-aware acquisition planning with static knowledge priority, stale governance,
   * targeted verification, and telemetry savings measurement.
   */
  static planAcquisitionWithMemory(
    needs: AcquisitionNeed[],
    memoryContext?: EntityMemoryContext | null,
    providerBudgetPreference?: string
  ): MemoryAwarePlan {
    const availableLocally: string[] = [];
    const needsLiveEnrichment: string[] = [];
    const conflictedFields: string[] = [];
    const reusedFieldValues: Record<string, any> = {};

    let fieldsReusedFromMemory = 0;
    let fieldsReusedFromStatic = 0;

    const entityId = memoryContext?.entityId;

    for (const need of needs) {
      const fieldKey = need.field;

      // 1. Check STATIC KNOWLEDGE PRIORITY first (BEM -> STATIC KNOWLEDGE -> EXTERNAL API)
      if (STATIC_KNOWLEDGE_FIELDS.has(fieldKey)) {
        availableLocally.push(fieldKey);
        fieldsReusedFromStatic++;
        BemTelemetry.record({
          eventType: 'acquisition_skipped',
          entityId,
          fieldKey,
          reason: 'SATISFIED_BY_STATIC_KNOWLEDGE'
        });
        continue;
      }

      // 2. Check BEM Memory Context
      const fieldCtx = memoryContext?.fields?.[fieldKey];

      if (fieldCtx) {
        if (fieldCtx.state === 'FRESH') {
          // MEMORY HIT: Reuse fresh memory evidence, skip live acquisition
          availableLocally.push(fieldKey);
          reusedFieldValues[fieldKey] = fieldCtx.currentValue;
          fieldsReusedFromMemory++;

          BemTelemetry.record({ eventType: 'memory_hit', entityId, fieldKey });
          BemTelemetry.record({ eventType: 'memory_reused_field', entityId, fieldKey });
          BemTelemetry.record({ eventType: 'acquisition_skipped', entityId, fieldKey, reason: 'FRESH_IN_BEM' });
          continue;
        }

        if (fieldCtx.state === 'STALE') {
          BemTelemetry.record({ eventType: 'memory_stale', entityId, fieldKey });

          // STALE GOVERNANCE: Optional fields or budget constraints reuse stale context without mandatory refresh
          if (!need.required) {
            availableLocally.push(fieldKey);
            reusedFieldValues[fieldKey] = fieldCtx.currentValue;
            fieldsReusedFromMemory++;
            BemTelemetry.record({ eventType: 'acquisition_skipped', entityId, fieldKey, reason: 'STALE_CONTEXT_REUSED_OPTIONAL' });
            continue;
          }

          // Strictly required fields trigger targeted refresh if budget is available
          needsLiveEnrichment.push(fieldKey);
          BemTelemetry.record({ eventType: 'memory_refresh_requested', entityId, fieldKey });
          BemTelemetry.record({ eventType: 'acquisition_requested', entityId, fieldKey, reason: 'STALE_REQUIRED' });
          continue;
        }

        if (fieldCtx.state === 'CONFLICTED') {
          // CONFLICT GOVERNANCE: Flag for targeted verification path without LLM arbitration
          conflictedFields.push(fieldKey);
          needsLiveEnrichment.push(fieldKey);
          BemTelemetry.record({ eventType: 'memory_conflict', entityId, fieldKey });
          BemTelemetry.record({ eventType: 'acquisition_requested', entityId, fieldKey, reason: 'TARGETED_CONFLICT_VERIFICATION' });
          continue;
        }
      }

      // 3. MEMORY MISS: No usable evidence available
      BemTelemetry.record({ eventType: 'memory_miss', entityId, fieldKey });

      if (need.required) {
        needsLiveEnrichment.push(fieldKey);
        BemTelemetry.record({ eventType: 'acquisition_requested', entityId, fieldKey, reason: 'MISSING_REQUIRED' });
      } else {
        BemTelemetry.record({ eventType: 'acquisition_skipped', entityId, fieldKey, reason: 'MISSING_OPTIONAL' });
      }
    }

    // Evaluate live budget for required external enrichments
    const liveSourcesApproved: string[] = [];

    if (needsLiveEnrichment.length > 0) {
      if (ApiBudgetGuard.canCall('geoapify')) {
        liveSourcesApproved.push('geoapify');
        BemTelemetry.record({ eventType: 'acquisition_executed', entityId, source: 'geoapify' });
      }
      if (ApiBudgetGuard.canCall('tavily')) {
        liveSourcesApproved.push('tavily');
        BemTelemetry.record({ eventType: 'acquisition_executed', entityId, source: 'tavily' });
      }
    }

    const totalFieldsRequested = needs.length;
    const externalCallsAvoided = fieldsReusedFromMemory + fieldsReusedFromStatic;
    const savingsRatioPercent = totalFieldsRequested > 0 
      ? Math.round((externalCallsAvoided / totalFieldsRequested) * 100) 
      : 0;

    return {
      availableLocally,
      needsLiveEnrichment,
      liveSourcesApproved,
      conflictedFields,
      reusedFieldValues,
      savings: {
        totalFieldsRequested,
        fieldsReusedFromMemory,
        fieldsReusedFromStatic,
        externalCallsAvoided,
        savingsRatioPercent
      }
    };
  }
}
