/**
 * BVELT PLAN LIMITS & ANTI-ABUSE CONFIGURATION
 * 
 * Documentation of Trial vs Pro Daily Quotas:
 * -------------------------------------------------------------
 * Action Category               | Trial / Free  | Bvelt Pro
 * -------------------------------------------------------------
 * scan-maps / radar rescan       | 5 / day       | 60 / day
 * analyze_message / text AI      | 5 / day       | 250 / day
 * spatial / vision analyze       | 3 / day       | 50 / day
 * outreach drafts                | 10 / day      | 150 / day
 * heavy audits / benchmarks      | 3 / day       | 50 / day
 * -------------------------------------------------------------
 * 
 * Centralized governance for trial duration, rate-limits, and daily action caps.
 * Enforced on both server-side API endpoints and reflected in client UI.
 */

export type PlanTier = 'trial' | 'solo' | 'pro';

export type PlanActionType = 'scan' | 'ai' | 'spatial' | 'outreach' | 'audit' | 'heavy_audit';

export interface PlanLimits {
  tier: PlanTier;
  labelEn: string;
  labelEs: string;
  durationDays: number;
  maxScansPerDay: number;
  maxAiGenerationsPerDay: number;
  maxSpatialPerDay: number;
  maxOutreachDraftsPerDay: number;
  maxHeavyAuditsPerDay: number;
  descriptionEn: string;
  descriptionEs: string;
  priceMonthlyUsd: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  trial: {
    tier: 'trial',
    labelEn: '7-Day Free Trial',
    labelEs: 'Prueba de 7 Días',
    durationDays: 7,
    maxScansPerDay: 5,            // scan-maps / radar rescan: max 5/day
    maxAiGenerationsPerDay: 5,     // analyze_message & text AI: max 5/day
    maxSpatialPerDay: 3,           // spatial / vision analyze: max 3/day
    maxOutreachDraftsPerDay: 10,  // outreach drafts: max 10/day
    maxHeavyAuditsPerDay: 3,       // heavy audit: max 3/day
    descriptionEn: 'Full local contractor features for 7 days to test in the truck.',
    descriptionEs: 'Acceso completo durante 7 días para probar directamente en el trabajo.',
    priceMonthlyUsd: 0,
  },
  solo: {
    tier: 'solo',
    labelEn: 'Solo Contractor',
    labelEs: 'Plan Contratista Solo',
    durationDays: 30,
    maxScansPerDay: 25,
    maxAiGenerationsPerDay: 80,
    maxSpatialPerDay: 15,
    maxOutreachDraftsPerDay: 50,
    maxHeavyAuditsPerDay: 15,
    descriptionEn: 'Designed for single-operator trades looking to dominate their local service area.',
    descriptionEs: 'Diseñado para profesionales independientes que buscan liderar su zona.',
    priceMonthlyUsd: 29,
  },
  pro: {
    tier: 'pro',
    labelEn: 'Bvelt Pro Suite',
    labelEs: 'Bvelt Pro Suite',
    durationDays: 30,
    maxScansPerDay: 60,            // scan-maps / radar rescan: max 60/day
    maxAiGenerationsPerDay: 250,   // analyze_message & text AI: max 250/day
    maxSpatialPerDay: 50,          // spatial / vision analyze: max 50/day
    maxOutreachDraftsPerDay: 150,  // outreach drafts: max 150/day
    maxHeavyAuditsPerDay: 50,      // heavy audit: max 50/day
    descriptionEn: 'Unlimited power for busy crews, multi-van fleets, and growth-focused businesses.',
    descriptionEs: 'Potencia ampliada para equipos de trabajo, cuadrillas y empresas en expansión.',
    priceMonthlyUsd: 49,
  }
};

/**
 * Resolves the active PlanTier from user profile or subscription metadata.
 */
export function resolvePlanTier(profileOrUser?: any): PlanTier {
  if (!profileOrUser) return 'trial';

  const plan = String(profileOrUser.plan || profileOrUser.planType || '').toLowerCase();
  const subStatus = String(profileOrUser.subscriptionStatus || profileOrUser.status || '').toLowerCase();
  const isProField = Boolean(profileOrUser.isPro);

  // Authoritative server-safe trial expiration check
  if (plan === 'trial' || subStatus === 'trialing' || (isProField && plan === 'trial')) {
    const startDate = profileOrUser.trialStartDate;
    // Check if they are legacy or have specific custom trial length, default is 7 days
    const durationDays = typeof profileOrUser.trialDurationDays === 'number' ? profileOrUser.trialDurationDays : 7;
    const remaining = calculateTrialDaysRemaining(startDate, durationDays);
    if (remaining <= 0) {
      // Expired trial! Treat as non-Pro, so return 'trial' (Free/Trial) tier limits.
      return 'trial';
    }
  }

  if (plan === 'pro' || isProField || subStatus === 'active' || plan === 'yearly' || plan === 'annual') {
    return 'pro';
  }

  if (plan === 'solo' || plan === 'starter' || plan === 'basic') {
    return 'solo';
  }

  return 'trial';
}

/**
 * Returns the limit configuration for a specific plan tier.
 */
export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier] || PLAN_LIMITS.trial;
}

/**
 * Calculates remaining trial days given a start date (supports ISO string, timestamp, or Firestore Timestamp)
 */
export function calculateTrialDaysRemaining(startDate: any, durationDays = 7): number {
  if (!startDate) return durationDays;

  let startMs = 0;
  if (typeof startDate === 'number') {
    startMs = startDate;
  } else if (typeof startDate?.toDate === 'function') {
    startMs = startDate.toDate().getTime();
  } else if (startDate?.seconds) {
    startMs = startDate.seconds * 1000;
  } else if (typeof startDate === 'string') {
    startMs = new Date(startDate).getTime();
  }

  if (!startMs || isNaN(startMs)) return durationDays;

  const nowMs = Date.now();
  const elapsedMs = nowMs - startMs;
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  return Math.max(0, durationDays - elapsedDays);
}

export type TaskType = 
  | 'copy_short'
  | 'pitch'
  | 'generic'
  | 'rank_actions'
  | 'diagnosis_rewrite'
  | 'scan_summary'
  | 'business_scan'
  | 'audit'
  | 'ai_visibility'
  | 'niche_benchmark';

export const AI_CREDIT_WEIGHT: Record<TaskType, number> = {
  copy_short: 1,
  pitch: 1,
  generic: 1,
  rank_actions: 1,
  diagnosis_rewrite: 1,
  scan_summary: 2,
  business_scan: 3,
  audit: 3,
  ai_visibility: 3,
  niche_benchmark: 2
};

export interface LimitReachedResponse {
  code: 'LIMIT_REACHED';
  error: string;
  message: string;
  upgrade: true;
  action: PlanActionType;
  limit: number;
  max: number;
  current: number;
  used: number;
  remaining: 0;
  weightAttempted?: number;
  plan: PlanTier;
  resetAt?: string;
}

/**
 * Builds standard structured JSON error conforming to TASK P0-2 requirements.
 */
export function createLimitReachedError(
  action: PlanActionType,
  plan: PlanTier,
  limit: number,
  current: number,
  lang: 'en' | 'es' = 'en',
  weightAttempted: number = 1
): LimitReachedResponse {
  const isEn = lang === 'en';

  const actionLabels: Record<PlanActionType, { en: string; es: string }> = {
    scan: { en: 'market scans', es: 'escaneos de mercado' },
    ai: { en: 'message analyses', es: 'análisis de mensajes' },
    spatial: { en: 'spatial damage analyses', es: 'análisis de daños espaciales' },
    outreach: { en: 'outreach messages', es: 'mensajes de prospección' },
    audit: { en: 'in-depth audits', es: 'auditorías avanzadas' },
    heavy_audit: { en: 'heavy audits & reports', es: 'auditorías avanzadas' },
  };

  const actionName = actionLabels[action] ? actionLabels[action][isEn ? 'en' : 'es'] : action;

  const message = isEn
    ? `Daily limit reached — upgrade to Pro ($49/mo) (${current}/${limit} ${actionName} used today).`
    : `Límite diario alcanzado — mejora a Pro ($49/mes) (${current}/${limit} ${actionName} usados hoy).`;

  // Reset timestamp for next UTC midnight
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);

  return {
    code: 'LIMIT_REACHED',
    error: 'quota',
    message,
    upgrade: true,
    action,
    limit,
    max: limit,
    current,
    used: current,
    remaining: 0,
    weightAttempted,
    plan,
    resetAt: tomorrow.toISOString(),
  };
}

/**
 * Triggers global client-side modal event when a server or client limit is encountered.
 */
import { Sentry } from '../sentry';

export const EVENT_LIMIT_REACHED = 'bvelt_limit_reached';

export function dispatchPlanLimitReached(detail: {
  action: PlanActionType;
  message?: string;
  limit: number;
  current?: number;
  plan?: PlanTier;
  uid?: string;
}): void {
  try {
    const currentUid = detail.uid || (typeof window !== 'undefined' ? (localStorage.getItem('bvelt_user_uid') || 'anonymous') : 'anonymous');
    Sentry.setUser({ id: currentUid });
    Sentry.setTag('uid', currentUid);
    Sentry.setTag('limitAction', detail.action);
    Sentry.captureMessage(`[Plan Limit Guard] Limit reached for action: ${detail.action} (tier: ${detail.plan || 'trial'})`, {
      level: 'warning',
      extra: {
        action: detail.action,
        limit: detail.limit,
        current: detail.current,
        tier: detail.plan
      }
    });
  } catch {
    // Silent catch if Sentry isn't initialized
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_LIMIT_REACHED, { detail }));
  }
}

let interceptorInstalled = false;

// Attach unpatched native fetch singleton to global window to avoid recursion across dynamic chunks
function getNativeFetch(): typeof fetch {
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (!win.__BVELT_ORIGINAL_NATIVE_FETCH__) {
      win.__BVELT_ORIGINAL_NATIVE_FETCH__ = window.fetch.bind(window);
    }
    return win.__BVELT_ORIGINAL_NATIVE_FETCH__;
  }
  return typeof fetch === 'function' ? fetch : (() => Promise.reject(new Error('No fetch implementation available'))) as any;
}

/**
 * Safe wrapper around standard fetch that catches LIMIT_REACHED rate limit errors.
 */
export async function bveltFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const runner = getNativeFetch();
  if (!runner) {
    throw new Error('No fetch implementation available');
  }

  const response = await runner(input, init);

  if (response.status === 429 || response.status === 403) {
    try {
      const cloned = response.clone();
      const data: any = await cloned.json();
      if (data && (data.code === 'LIMIT_REACHED' || data.error === 'LIMIT_REACHED')) {
        dispatchPlanLimitReached({
          action: (data.action as PlanActionType) || 'scan',
          message: data.message,
          limit: data.limit || 5,
          current: data.current || data.limit || 5,
          plan: data.plan || 'trial',
        });
      }
    } catch {
      // Not a JSON response or failed clone, ignore
    }
  }

  return response;
}

/**
 * Safely installs transparent global fetch listener if window.fetch property allows modification.
 */
export function installGlobalFetchLimitInterceptor(): void {
  if (typeof window === 'undefined') return;
  const win = window as any;
  if (win.__BVELT_FETCH_INTERCEPTED__ || interceptorInstalled) return;

  // Capture the native fetch before replacing window.fetch
  getNativeFetch();

  win.__BVELT_FETCH_INTERCEPTED__ = true;
  interceptorInstalled = true;

  try {
    const desc =
      Object.getOwnPropertyDescriptor(window, 'fetch') ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');

    // Skip monkey-patching if window.fetch is getter-only / non-writable
    if (desc && desc.writable === false && !desc.set) {
      return;
    }

    window.fetch = async function bveltGlobalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      return bveltFetch(input, init);
    };
  } catch (err) {
    // Non-blocking environment safety net
  }
}
