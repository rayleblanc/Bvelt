/**
 * BVELT Autonomy Policy Engine
 * Mandatory policy gate for every execution in the Action Engine.
 * 
 * Levels:
 * 0 - OBSERVE: Passive market intelligence, zero automated execution or drafting.
 * 1 - DRAFT: Safe default. Tool outputs created as drafts only. Operator review required before external dispatch.
 * 2 - EXECUTE_WITH_RULES: Deterministic autonomous execution within strict rules, daily limits, quiet hours, and spend caps.
 * 3 - GOAL_SUPERVISED: Supervised autonomy against commercial milestones with active safety guardrails.
 */

export type AutonomyLevel = 0 | 1 | 2 | 3;

export const AUTONOMY_LEVEL_NAMES: Record<AutonomyLevel, { code: string; labelEn: string; labelEs: string; descriptionEn: string; descriptionEs: string }> = {
  0: {
    code: 'OBSERVE',
    labelEn: '0: Observe (Read-only)',
    labelEs: '0: Observar (Solo lectura)',
    descriptionEn: 'Passive market intelligence. Automated tools and draft dispatches are disabled.',
    descriptionEs: 'Inteligencia de mercado pasiva. Las herramientas y despachos automáticos están desactivados.'
  },
  1: {
    code: 'DRAFT',
    labelEn: '1: Draft (Safe Default)',
    labelEs: '1: Borrador (Por Defecto Seguro)',
    descriptionEn: 'Prepares reviewable drafts for operator approval. Sensitive external actions require explicit confirmation.',
    descriptionEs: 'Genera borradores para revisión del operador. Las acciones externas sensibles requieren confirmación explícita.'
  },
  2: {
    code: 'EXECUTE_WITH_RULES',
    labelEn: '2: Execute with Rules',
    labelEs: '2: Ejecutar con Reglas',
    descriptionEn: 'Executes permitted actions autonomously within strict daily quotas, quiet hours, and spend limits.',
    descriptionEs: 'Ejecuta acciones permitidas de forma autónoma dentro de cuotas diarias, horas de silencio y límites de gasto.'
  },
  3: {
    code: 'GOAL_SUPERVISED',
    labelEn: '3: Goal-Supervised',
    labelEs: '3: Supervisado por Metas',
    descriptionEn: 'Supervised execution aligned with target conversion and reputation goals, with fallback safety guards.',
    descriptionEs: 'Ejecución supervisada alineada con objetivos de conversión y reputación, con salvaguardas de seguridad.'
  }
};

export type ActionEngineToolId = 
  | 'draft_lead_follow_up'
  | 'request_review_after_completed_job'
  | 'draft_review_response'
  | 'create_estimate_follow_up';

export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number; // 24h format, e.g. 20 for 8:00 PM
  endHour: number;   // 24h format, e.g. 8 for 8:00 AM
}

export interface AutonomyPolicy {
  businessId: string;
  level: AutonomyLevel;
  allowedActions: ActionEngineToolId[];
  blockedActions: ActionEngineToolId[];
  approvalRequiredActions: ActionEngineToolId[];
  dailyLimits: Record<ActionEngineToolId, number>;
  dailyUsage: Record<ActionEngineToolId, { count: number; date: string }>;
  quietHours: QuietHoursConfig;
  maxSpendLimitUsd: number;
  currentSpendUsd: number;
  updatedAt: string;
}

export interface PolicyEvaluationContext {
  isExternal?: boolean;
  costUsd?: number;
  currentHour?: number;
  operatorApproved?: boolean;
  approvalExpiresAt?: string | number;
  approvalRequestedAt?: string | number;
  destinationChannel?: 'whatsapp' | 'sms' | 'email' | 'call' | 'gmb';
}

export interface PolicyDecision {
  permitted: boolean;
  executionMode: 'DRAFT_ONLY' | 'PERMIT_EXTERNAL' | 'BLOCKED' | 'REQUIRES_APPROVAL';
  reason: string;
  reasonEs: string;
  policyLevel: AutonomyLevel;
  policy: AutonomyPolicy;
}

const STORAGE_POLICY_PREFIX = 'bvelt_autonomy_policy_';
const IN_MEMORY_POLICIES = new Map<string, AutonomyPolicy>();

export class AutonomyPolicyEngine {
  /**
   * Returns default safe policy (Level 1 Draft)
   */
  static getDefaultPolicy(businessId: string): AutonomyPolicy {
    return {
      businessId,
      level: 1, // Safe default: Level 1 Draft
      allowedActions: [
        'draft_lead_follow_up',
        'draft_review_response',
        'create_estimate_follow_up',
        'request_review_after_completed_job'
      ],
      blockedActions: [],
      approvalRequiredActions: [
        'request_review_after_completed_job',
        'create_estimate_follow_up'
      ],
      dailyLimits: {
        draft_lead_follow_up: 50,
        draft_review_response: 50,
        create_estimate_follow_up: 20,
        request_review_after_completed_job: 20
      },
      dailyUsage: {
        draft_lead_follow_up: { count: 0, date: new Date().toISOString().split('T')[0] },
        draft_review_response: { count: 0, date: new Date().toISOString().split('T')[0] },
        create_estimate_follow_up: { count: 0, date: new Date().toISOString().split('T')[0] },
        request_review_after_completed_job: { count: 0, date: new Date().toISOString().split('T')[0] }
      },
      quietHours: {
        enabled: true,
        startHour: 20, // 8:00 PM
        endHour: 8     // 8:00 AM
      },
      maxSpendLimitUsd: 0.00,
      currentSpendUsd: 0.00,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Loads canonical policy for a business (falls back to default safe policy)
   */
  static getPolicy(businessId: string): AutonomyPolicy {
    if (IN_MEMORY_POLICIES.has(businessId)) {
      return IN_MEMORY_POLICIES.get(businessId)!;
    }
    if (typeof localStorage === 'undefined') {
      const def = this.getDefaultPolicy(businessId);
      IN_MEMORY_POLICIES.set(businessId, def);
      return def;
    }
    try {
      const raw = localStorage.getItem(`${STORAGE_POLICY_PREFIX}${businessId}`);
      if (!raw) {
        const defaultPolicy = this.getDefaultPolicy(businessId);
        this.savePolicy(defaultPolicy);
        return defaultPolicy;
      }
      const parsed = JSON.parse(raw);
      // Merge with default schema to ensure all keys exist
      const defaults = this.getDefaultPolicy(businessId);
      const merged: AutonomyPolicy = {
        ...defaults,
        ...parsed,
        dailyLimits: { ...defaults.dailyLimits, ...(parsed.dailyLimits || {}) },
        dailyUsage: { ...defaults.dailyUsage, ...(parsed.dailyUsage || {}) },
        quietHours: { ...defaults.quietHours, ...(parsed.quietHours || {}) }
      };
      IN_MEMORY_POLICIES.set(businessId, merged);
      return merged;
    } catch {
      const def = this.getDefaultPolicy(businessId);
      IN_MEMORY_POLICIES.set(businessId, def);
      return def;
    }
  }

  /**
   * Saves updated policy for a business
   */
  static savePolicy(policy: AutonomyPolicy): void {
    policy.updatedAt = new Date().toISOString();
    IN_MEMORY_POLICIES.set(policy.businessId, policy);
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_POLICY_PREFIX}${policy.businessId}`, JSON.stringify(policy));
    } catch (e) {
      console.warn('[AutonomyPolicy] Failed to save policy:', e);
    }
  }

  /**
   * Updates autonomy level for a business
   */
  static setAutonomyLevel(businessId: string, level: AutonomyLevel): AutonomyPolicy {
    const policy = this.getPolicy(businessId);
    policy.level = level;
    this.savePolicy(policy);
    return policy;
  }

  /**
   * Evaluates if an execution is permitted under current business autonomy policy
   */
  static evaluate(
    businessId: string,
    toolId: ActionEngineToolId,
    context: PolicyEvaluationContext = {}
  ): PolicyDecision {
    const policy = this.getPolicy(businessId);
    const today = new Date().toISOString().split('T')[0];
    const currentHour = context.currentHour ?? new Date().getHours();

    // 0. Fail-Closed Check on Expired Approval Deadlines
    if (context.approvalExpiresAt) {
      const expiryTime = typeof context.approvalExpiresAt === 'number' 
        ? context.approvalExpiresAt 
        : new Date(context.approvalExpiresAt).getTime();
      
      if (Date.now() > expiryTime && !context.operatorApproved) {
        return {
          permitted: false,
          executionMode: 'BLOCKED',
          reason: `Approval deadline expired at ${new Date(expiryTime).toISOString()} (Fail-Closed). Action automatically denied by safety policy.`,
          reasonEs: `El plazo de aprobación venció a las ${new Date(expiryTime).toLocaleTimeString()} (Fail-Closed). Acción denegada automáticamente por política de seguridad.`,
          policyLevel: policy.level,
          policy
        };
      }
    }

    // 1. Level 0: Observe Mode
    if (policy.level === 0) {
      return {
        permitted: false,
        executionMode: 'BLOCKED',
        reason: 'Autonomy Level 0 (Observe): System is in passive observation mode. All automated actions and draft dispatches are disabled.',
        reasonEs: 'Nivel de Autonomía 0 (Observar): El sistema está en modo observación pasiva. Todas las acciones automatizadas y borradores están deshabilitados.',
        policyLevel: policy.level,
        policy
      };
    }

    // 2. Explicitly Blocked Action Check
    if (policy.blockedActions.includes(toolId)) {
      return {
        permitted: false,
        executionMode: 'BLOCKED',
        reason: `Tool [${toolId}] is explicitly blocked in business autonomy policy.`,
        reasonEs: `La herramienta [${toolId}] está explícitamente bloqueada en la política de autonomía del negocio.`,
        policyLevel: policy.level,
        policy
      };
    }

    // 3. Quiet Hours Check for External Operations
    if (context.isExternal && policy.quietHours.enabled) {
      const { startHour, endHour } = policy.quietHours;
      const isQuietTime = startHour > endHour 
        ? (currentHour >= startHour || currentHour < endHour) // e.g. 20 to 8
        : (currentHour >= startHour && currentHour < endHour);

      if (isQuietTime) {
        return {
          permitted: false,
          executionMode: 'BLOCKED',
          reason: `External customer contact blocked during Quiet Hours (${startHour}:00 - ${endHour}:00) to protect customer communication standards.`,
          reasonEs: `Contacto externo con clientes bloqueado durante Horas de Silencio (${startHour}:00 - ${endHour}:00) para proteger la experiencia del cliente.`,
          policyLevel: policy.level,
          policy
        };
      }
    }

    // 4. Daily Usage & Quota Check
    const usageObj = policy.dailyUsage[toolId] || { count: 0, date: today };
    const currentCount = usageObj.date === today ? usageObj.count : 0;
    const dailyLimit = policy.dailyLimits[toolId] ?? 50;

    if (currentCount >= dailyLimit) {
      return {
        permitted: false,
        executionMode: 'BLOCKED',
        reason: `Tool [${toolId}] has reached its daily quota limit (${dailyLimit} actions/day).`,
        reasonEs: `La herramienta [${toolId}] ha alcanzado su límite diario (${dailyLimit} acciones/día).`,
        policyLevel: policy.level,
        policy
      };
    }

    // 5. Spend Limit Check
    if (context.costUsd && context.costUsd > 0) {
      if (policy.currentSpendUsd + context.costUsd > policy.maxSpendLimitUsd) {
        return {
          permitted: false,
          executionMode: 'BLOCKED',
          reason: `Execution cost ($${context.costUsd.toFixed(2)}) exceeds business spend limit ($${policy.maxSpendLimitUsd.toFixed(2)}).`,
          reasonEs: `El costo de ejecución ($${context.costUsd.toFixed(2)}) supera el límite de gasto del negocio ($${policy.maxSpendLimitUsd.toFixed(2)}).`,
          policyLevel: policy.level,
          policy
        };
      }
    }

    // 6. Level 1 (Draft Mode) - Safe Default Gate
    if (policy.level === 1) {
      if (context.isExternal && !context.operatorApproved) {
        return {
          permitted: true,
          executionMode: 'DRAFT_ONLY',
          reason: 'Autonomy Level 1 (Draft): Direct external execution is prohibited. Action will generate a verified draft for operator review.',
          reasonEs: 'Nivel de Autonomía 1 (Borrador): La ejecución externa directa está prohibida. La acción generará un borrador verificado para revisión del operador.',
          policyLevel: policy.level,
          policy
        };
      }
      return {
        permitted: true,
        executionMode: 'DRAFT_ONLY',
        reason: 'Autonomy Level 1 (Draft): Creating draft output for operator review.',
        reasonEs: 'Nivel de Autonomía 1 (Borrador): Creando borrador para revisión del operador.',
        policyLevel: policy.level,
        policy
      };
    }

    // 7. Level 2 (Execute with Rules) & Level 3 (Goal-Supervised)
    // Check if tool requires approval
    if (context.isExternal && policy.approvalRequiredActions.includes(toolId) && !context.operatorApproved) {
      return {
        permitted: false,
        executionMode: 'REQUIRES_APPROVAL',
        reason: `Tool [${toolId}] requires explicit operator confirmation prior to external dispatch.`,
        reasonEs: `La herramienta [${toolId}] requiere confirmación explícita del operador antes del despacho externo.`,
        policyLevel: policy.level,
        policy
      };
    }

    return {
      permitted: true,
      executionMode: context.isExternal ? 'PERMIT_EXTERNAL' : 'DRAFT_ONLY',
      reason: `Execution permitted under Autonomy Policy Level ${policy.level} (${AUTONOMY_LEVEL_NAMES[policy.level].code}).`,
      reasonEs: `Ejecución permitida bajo Política de Autonomía Nivel ${policy.level} (${AUTONOMY_LEVEL_NAMES[policy.level].code}).`,
      policyLevel: policy.level,
      policy
    };
  }

  /**
   * Records usage counter increment upon execution
   */
  static recordUsage(businessId: string, toolId: ActionEngineToolId, costUsd: number = 0): void {
    const policy = this.getPolicy(businessId);
    const today = new Date().toISOString().split('T')[0];

    const current = policy.dailyUsage[toolId];
    if (current && current.date === today) {
      current.count += 1;
    } else {
      policy.dailyUsage[toolId] = { count: 1, date: today };
    }

    if (costUsd > 0) {
      policy.currentSpendUsd += costUsd;
    }

    this.savePolicy(policy);
  }
}
