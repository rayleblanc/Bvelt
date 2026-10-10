/**
 * Bvelt Rate Limit & Trial Scans Quota Service
 * 
 * Centralizes trial quota tracking, rate limit header parsing, 
 * button cooldown timers, and human-friendly 429 error handling.
 */

import { useState, useEffect, useCallback } from 'react';
import { auth } from './firebase';
import { 
  getPlanLimits, 
  resolvePlanTier, 
  PlanTier, 
  dispatchPlanLimitReached,
  calculateTrialDaysRemaining 
} from './planLimits.ts';

export const RATE_LIMIT_MESSAGE_EN = "Daily limit reached for trial plan. Upgrade to Pro or come back tomorrow.";
export const RATE_LIMIT_MESSAGE_ES = "Límite diario del plan de prueba. Mejora a Pro o vuelve mañana.";

export function getRateLimitMessage(lang?: string): string {
  return lang === 'en' ? RATE_LIMIT_MESSAGE_EN : RATE_LIMIT_MESSAGE_ES;
}

export interface ScansQuotaState {
  remaining: number;
  total: number;
  isPro: boolean;
  date: string;
}

const STORAGE_KEY = 'bvelt_trial_scans';
const EVENT_QUOTA_UPDATED = 'bvelt_scans_quota_changed';

/**
 * Gets today's date string YYYY-MM-DD in UTC
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Reads the current scans quota from localStorage
 */
export function getScansQuota(planOrIsPro: PlanTier | boolean = false): ScansQuotaState {
  const plan: PlanTier = typeof planOrIsPro === 'string' ? planOrIsPro : (planOrIsPro ? 'pro' : 'trial');
  const limits = getPlanLimits(plan);
  const total = limits.maxScansPerDay;
  const today = getTodayDateString();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        const remaining = typeof parsed.remaining === 'number' 
          ? Math.max(0, parsed.remaining)
          : Math.max(0, total - (parsed.count || 0));
        return { remaining, total, isPro: plan === 'pro', date: today };
      }
    }
  } catch (e) {
    console.warn('[rateLimitService] Error parsing scans quota:', e);
  }

  // Default fresh day state
  return { remaining: total, total, isPro: plan === 'pro', date: today };
}

/**
 * Updates quota when the server returns remaining scans in response headers or payload
 */
export function updateQuotaFromServer(remaining: number, planOrIsPro: PlanTier | boolean = false): void {
  const plan: PlanTier = typeof planOrIsPro === 'string' ? planOrIsPro : (planOrIsPro ? 'pro' : 'trial');
  const limits = getPlanLimits(plan);
  const total = limits.maxScansPerDay;
  const today = getTodayDateString();
  const safeRemaining = Math.max(0, Math.min(total, remaining));
  const count = Math.max(0, total - safeRemaining);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: today,
      count,
      remaining: safeRemaining,
      updatedAt: Date.now()
    }));
    window.dispatchEvent(new CustomEvent(EVENT_QUOTA_UPDATED, { detail: { remaining: safeRemaining, total, isPro: plan === 'pro' } }));
  } catch (e) {
    console.warn('[rateLimitService] Error saving server quota:', e);
  }
}

/**
 * Records that a scan was initiated or completed locally
 */
export function recordScanConsumption(planOrIsPro: PlanTier | boolean = false): number {
  const quota = getScansQuota(planOrIsPro);
  const nextRemaining = Math.max(0, quota.remaining - 1);
  const nextCount = quota.total - nextRemaining;
  const today = getTodayDateString();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: today,
      count: nextCount,
      remaining: nextRemaining,
      updatedAt: Date.now()
    }));
    window.dispatchEvent(new CustomEvent(EVENT_QUOTA_UPDATED, { detail: { remaining: nextRemaining, total: quota.total, isPro: quota.isPro } }));
  } catch (e) {
    console.warn('[rateLimitService] Error recording scan consumption:', e);
  }

  return nextRemaining;
}

/**
 * Interfaces & storage keys for Tenant Daily Quotas (Scans, AI Drafts, Follow-up Rescues)
 */
export interface ActionUsageDetail {
  used: number;
  max: number;
  remaining: number;
  label: string;
  isLimitReached: boolean;
}

export interface TenantDailyUsage {
  date: string;
  scan: ActionUsageDetail;
  ai: ActionUsageDetail;
  outreach: ActionUsageDetail;
}

const STORAGE_TENANT_USAGE_KEY = 'bvelt_tenant_usage_v1';

export function getTenantUsage(profileOrPlan?: any, lang = 'es'): TenantDailyUsage {
  const isEn = lang === 'en';
  const plan: PlanTier = typeof profileOrPlan === 'string' ? (profileOrPlan as PlanTier) : resolvePlanTier(profileOrPlan);
  const limits = getPlanLimits(plan);
  const today = getTodayDateString();

  let scanUsed = 0;
  let aiUsed = 0;
  let outreachUsed = 0;

  // Sync scan count with localStorage scan quota
  try {
    const rawScans = localStorage.getItem(STORAGE_KEY);
    if (rawScans) {
      const parsed = JSON.parse(rawScans);
      if (parsed.date === today) {
        scanUsed = typeof parsed.count === 'number' ? parsed.count : Math.max(0, limits.maxScansPerDay - (parsed.remaining ?? limits.maxScansPerDay));
      }
    }
  } catch {}

  try {
    const raw = localStorage.getItem(STORAGE_TENANT_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        if (typeof parsed.scanUsed === 'number') scanUsed = Math.max(scanUsed, parsed.scanUsed);
        if (typeof parsed.aiUsed === 'number') aiUsed = parsed.aiUsed;
        if (typeof parsed.outreachUsed === 'number') outreachUsed = parsed.outreachUsed;
      }
    }
  } catch {}

  const scanMax = limits.maxScansPerDay;
  const aiMax = limits.maxAiGenerationsPerDay;
  const outreachMax = limits.maxOutreachDraftsPerDay;

  const scanRemaining = Math.max(0, scanMax - scanUsed);
  const aiRemaining = Math.max(0, aiMax - aiUsed);
  const outreachRemaining = Math.max(0, outreachMax - outreachUsed);

  return {
    date: today,
    scan: {
      used: scanUsed,
      max: scanMax,
      remaining: scanRemaining,
      label: isEn
        ? `${scanUsed}/${scanMax} scans today · resets tomorrow`
        : `${scanUsed}/${scanMax} escaneos hoy · reinicia mañana`,
      isLimitReached: scanUsed >= scanMax
    },
    ai: {
      used: aiUsed,
      max: aiMax,
      remaining: aiRemaining,
      label: isEn
        ? `${aiUsed}/${aiMax} AI drafts today · resets tomorrow`
        : `${aiUsed}/${aiMax} borradores IA hoy · reinicia mañana`,
      isLimitReached: aiUsed >= aiMax
    },
    outreach: {
      used: outreachUsed,
      max: outreachMax,
      remaining: outreachRemaining,
      label: isEn
        ? `${outreachUsed}/${outreachMax} follow-ups today · resets tomorrow`
        : `${outreachUsed}/${outreachMax} rescates seguimiento hoy · reinicia mañana`,
      isLimitReached: outreachUsed >= outreachMax
    }
  };
}

/**
  Checks quota before execution.
  If limit reached: BLOCKS execution, displays Toast/Modal message (NO SILENT FAILURE!), and returns false.
 */
export function checkAndConsumeTenantUsage(
  actionCategory: 'scan' | 'ai' | 'outreach',
  profileOrPlan?: any,
  lang = 'es',
  showToast?: (msg: string, type: 'error' | 'info' | 'success') => void
): boolean {
  const isEn = lang === 'en';
  const plan: PlanTier = typeof profileOrPlan === 'string' ? (profileOrPlan as PlanTier) : resolvePlanTier(profileOrPlan);
  const currentUsage = getTenantUsage(plan, lang);
  const target = currentUsage[actionCategory];

  if (target.used >= target.max || target.remaining <= 0) {
    const actionNames = {
      scan: isEn ? 'zone scans' : 'escaneos de zona',
      ai: isEn ? 'AI drafts' : 'borradores de IA',
      outreach: isEn ? 'follow-up rescues' : 'rescates de seguimiento'
    };

    const actionName = actionNames[actionCategory];
    const message = isEn
      ? `Daily limit reached for ${actionName} (${target.used}/${target.max} today · resets tomorrow). Upgrade to Bvelt Pro for extended limits.`
      : `Límite diario alcanzado para ${actionName} (${target.used}/${target.max} hoy · reinicia mañana). Mejora a Bvelt Pro para un límite extendido.`;

    if (showToast) {
      showToast(message, 'info');
    }

    dispatchPlanLimitReached({
      action: actionCategory === 'scan' ? 'scan' : actionCategory === 'ai' ? 'ai' : 'outreach',
      message,
      limit: target.max,
      current: target.used,
      plan
    });

    return false; // BLOCKED! No silent failure.
  }

  // Increment usage count
  const today = getTodayDateString();
  const nextUsed = target.used + 1;

  try {
    const raw = localStorage.getItem(STORAGE_TENANT_USAGE_KEY);
    const prevData = raw ? JSON.parse(raw) : { date: today, scanUsed: 0, aiUsed: 0, outreachUsed: 0 };
    const nextData = {
      date: today,
      scanUsed: actionCategory === 'scan' ? nextUsed : (prevData.date === today ? prevData.scanUsed || 0 : 0),
      aiUsed: actionCategory === 'ai' ? nextUsed : (prevData.date === today ? prevData.aiUsed || 0 : 0),
      outreachUsed: actionCategory === 'outreach' ? nextUsed : (prevData.date === today ? prevData.outreachUsed || 0 : 0),
      updatedAt: Date.now()
    };
    localStorage.setItem(STORAGE_TENANT_USAGE_KEY, JSON.stringify(nextData));

    if (actionCategory === 'scan') {
      recordScanConsumption(plan);
    } else {
      window.dispatchEvent(new CustomEvent(EVENT_QUOTA_UPDATED, { detail: nextData }));
    }
  } catch (e) {
    console.warn('[rateLimitService] Error updating tenant usage:', e);
  }

  return true; // ALLOWED!
}

/**
 * Parses rate limit headers from fetch response and synchronizes state
 */
export function parseRateLimitHeaders(response: Response, planOrIsPro: PlanTier | boolean = false): { remaining: number | null; retryAfter: number | null } {
  let remaining: number | null = null;
  let retryAfter: number | null = null;

  const remHeader = response.headers.get('x-ratelimit-remaining') || response.headers.get('ratelimit-remaining');
  if (remHeader !== null) {
    const parsed = parseInt(remHeader, 10);
    if (!isNaN(parsed)) {
      remaining = parsed;
      updateQuotaFromServer(parsed, planOrIsPro);
    }
  }

  const retryHeader = response.headers.get('retry-after');
  if (retryHeader !== null) {
    const parsed = parseInt(retryHeader, 10);
    if (!isNaN(parsed)) {
      retryAfter = parsed;
    }
  }

  return { remaining, retryAfter };
}

/**
 * Global handler for 429 HTTP status - triggers upgrade modal
 */
export function handle429Toast(
  showToast?: (msg: string, type: 'error' | 'info' | 'success') => void,
  lang = 'es',
  action: 'scan' | 'ai' | 'outreach' | 'audit' = 'scan'
): void {
  // When 429 happens, ensure remaining is 0
  updateQuotaFromServer(0);
  const message = getRateLimitMessage(lang);
  if (showToast) {
    showToast(message, 'info');
  }

  // Trigger modal for immediate upgrade path
  dispatchPlanLimitReached({
    action,
    message,
    limit: 5,
    plan: 'trial'
  });
}

/**
 * Custom React hook for tracking scans quota, 7-day trial status, and click cooldown
 */
export function useScansQuota(profile?: any, lang = 'es') {
  const plan = resolvePlanTier(profile);
  const isPro = plan === 'pro';
  const limits = getPlanLimits(plan);
  const [quota, setQuota] = useState<ScansQuotaState>(() => getScansQuota(plan));
  const [isCooldown, setIsCooldown] = useState(false);

  // Sync with storage and custom events
  useEffect(() => {
    const sync = () => setQuota(getScansQuota(plan));
    sync();

    window.addEventListener(EVENT_QUOTA_UPDATED, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_QUOTA_UPDATED, sync);
      window.removeEventListener('storage', sync);
    };
  }, [plan]);

  // Cooldown helper for scan buttons (3-5s disable)
  const triggerCooldown = useCallback((durationMs = 4000) => {
    setIsCooldown(true);
    setTimeout(() => {
      setIsCooldown(false);
    }, durationMs);
  }, []);

  // Compute 7-day trial status
  const trialDuration = 7;
  let trialStartDate: any = profile?.trialStartDate || localStorage.getItem('lf_trial_start');
  const trialDaysRemaining = calculateTrialDaysRemaining(trialStartDate, trialDuration);
  const trialDay = Math.min(trialDuration, Math.max(1, trialDuration - trialDaysRemaining + 1));

  const isTrialActive = !isPro && Boolean(
    profile?.plan === 'trial' || 
    profile?.hasUsedTrial || 
    profile?.trialStartDate || 
    localStorage.getItem('lf_trial_start')
  );

  // Label formatted for UI badge
  const badgeLabel = isPro
    ? (lang === 'en' ? `Pro Plan · ${quota.remaining}/${limits.maxScansPerDay} scans left` : `Plan Pro · Te quedan: ${quota.remaining}/${limits.maxScansPerDay} análisis`)
    : isTrialActive
      ? (lang === 'en' ? `Trial (${trialDaysRemaining}d left) · ${quota.remaining}/${limits.maxScansPerDay} scans left` : `Prueba (${trialDaysRemaining}d restantes) · ${quota.remaining}/${limits.maxScansPerDay} análisis`)
      : (lang === 'en' ? `Trial · ${quota.remaining}/${limits.maxScansPerDay} scans left` : `Prueba · Te quedan ${quota.remaining}/${limits.maxScansPerDay} análisis`);

  return {
    scansLeft: quota.remaining,
    totalScans: limits.maxScansPerDay,
    isPro,
    plan,
    trialDay,
    trialDaysLeft: trialDaysRemaining,
    isTrialActive,
    badgeLabel,
    isCooldown,
    triggerCooldown,
    consumeScan: () => recordScanConsumption(plan),
    syncServerRemaining: (rem: number) => updateQuotaFromServer(rem, plan)
  };
}

export interface PlanUsageMetrics {
  scan: number;
  ai: number;
  outreach: number;
  audit: number;
}

export interface PlanUsageState {
  date: string;
  plan: PlanTier;
  limits: PlanUsageMetrics;
  used: PlanUsageMetrics;
  remaining: PlanUsageMetrics;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Custom React hook tracking all action quotas (scans, ai, outreach, audit)
 * Syncs directly with /api/plan/usage for live numbers
 */
let hasWarnedPlanUsage401 = false;
let lastPlanUsageFetchTime = 0;

export function usePlanUsage(profile?: any, lang = 'es'): PlanUsageState {
  const plan = resolvePlanTier(profile);
  const limits = getPlanLimits(plan);
  const today = getTodayDateString();

  const defaultLimits: PlanUsageMetrics = {
    scan: limits.maxScansPerDay,
    ai: limits.maxAiGenerationsPerDay,
    outreach: limits.maxOutreachDraftsPerDay,
    audit: limits.maxHeavyAuditsPerDay,
  };

  const [usageState, setUsageState] = useState<{
    date: string;
    plan: PlanTier;
    limits: PlanUsageMetrics;
    used: PlanUsageMetrics;
    remaining: PlanUsageMetrics;
    loading: boolean;
  }>({
    date: today,
    plan,
    limits: defaultLimits,
    used: { scan: 0, ai: 0, outreach: 0, audit: 0 },
    remaining: defaultLimits,
    loading: true,
  });

  const fetchUsage = useCallback(async () => {
    // 1. If user is unauthenticated, do not call backend to avoid 401 spam; use local limits
    const currentUser = auth?.currentUser;
    const uid = currentUser?.uid || profile?.uid;

    if (!currentUser || !uid) {
      const currentScans = getScansQuota(plan);
      const scansUsed = Math.max(0, currentScans.total - currentScans.remaining);
      setUsageState(prev => ({
        ...prev,
        limits: defaultLimits,
        plan,
        used: { scan: scansUsed, ai: 0, outreach: 0, audit: 0 },
        remaining: { ...defaultLimits, scan: currentScans.remaining },
        loading: false,
      }));
      return;
    }

    // 2. Throttle calls to /api/plan/usage to at most once every 3 seconds
    const now = Date.now();
    if (now - lastPlanUsageFetchTime < 3000) {
      return;
    }
    lastPlanUsageFetchTime = now;

    try {
      const headers: Record<string, string> = {
        'x-user-id': uid
      };

      try {
        const idToken = await currentUser.getIdToken(true);
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      } catch (tokenErr) {
        if (!hasWarnedPlanUsage401) {
          console.warn('[PlanUsage] Failed to retrieve Firebase ID token:', tokenErr);
        }
      }

      const res = await fetch('/api/plan/usage', { headers });
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.limits && data.used && data.remaining) {
          setUsageState({
            date: data.date || today,
            plan: data.plan || plan,
            limits: {
              scan: data.limits.scan ?? defaultLimits.scan,
              ai: data.limits.ai ?? defaultLimits.ai,
              outreach: data.limits.outreach ?? defaultLimits.outreach,
              audit: data.limits.audit ?? defaultLimits.audit,
            },
            used: {
              scan: data.used.scan ?? 0,
              ai: data.used.ai ?? 0,
              outreach: data.used.outreach ?? 0,
              audit: data.used.audit ?? 0,
            },
            remaining: {
              scan: data.remaining.scan ?? defaultLimits.scan,
              ai: data.remaining.ai ?? defaultLimits.ai,
              outreach: data.remaining.outreach ?? defaultLimits.outreach,
              audit: data.remaining.audit ?? defaultLimits.audit,
            },
            loading: false,
          });
          return;
        }
      } else if (res.status === 401) {
        // Fail-soft on 401: log once per session and assume trial limits locally without breaking UI
        if (!hasWarnedPlanUsage401) {
          hasWarnedPlanUsage401 = true;
          console.warn('[PlanUsage] 401 from backend. Falling back cleanly to local trial limits.');
        }
      }
    } catch {
      // Fallback if offline or network error
    }

    // Fail-soft fallback: estimate from local storage
    const currentScans = getScansQuota(plan);
    const scansUsed = Math.max(0, currentScans.total - currentScans.remaining);
    setUsageState(prev => ({
      ...prev,
      limits: defaultLimits,
      plan,
      used: { ...prev.used, scan: scansUsed },
      remaining: { ...prev.remaining, scan: currentScans.remaining },
      loading: false,
    }));
  }, [plan, profile?.uid, today]);

  useEffect(() => {
    fetchUsage();
    window.addEventListener(EVENT_QUOTA_UPDATED, fetchUsage);
    return () => window.removeEventListener(EVENT_QUOTA_UPDATED, fetchUsage);
  }, [fetchUsage]);

  return {
    ...usageState,
    refresh: fetchUsage,
  };
}
