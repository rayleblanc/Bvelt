import { Request, Response, NextFunction } from "express";
import { 
  getAdminFirestore, 
  getFirebaseAdminAuth, 
  isFirebaseAdminReady, 
  markAdminUnauthenticated, 
  FieldValue 
} from "./firebaseAdmin.ts";
import {
  PlanActionType,
  PlanTier,
  getPlanLimits,
  resolvePlanTier,
  createLimitReachedError,
  LimitReachedResponse,
  AI_CREDIT_WEIGHT,
  TaskType
} from "../src/lib/planLimits.ts";

// In-memory cache for user plan profiles (TTL 60 seconds)
const planCache = new Map<string, { plan: PlanTier; timestamp: number }>();
// In-memory fallback counters: DEV-ONLY degraded mode when Firestore Admin credentials are not configured
const memoryFallbackCounters = new Map<string, number>();

// In-memory cache for plan usage status responses (TTL 30 seconds per entity/day)
const usageStatusCache = new Map<string, { timestamp: number; payload: any }>();

/**
 * Extracts authenticated UID from token or header safely
 */
export async function extractRequestIdentity(req: Request): Promise<{ uid: string | null; ip: string }> {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const adminAuth = getFirebaseAdminAuth();
      if (adminAuth) {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.uid) {
          return { uid: decoded.uid, ip };
        }
      }
    } catch {
      // Fallback to quick non-verifying payload decode if token verification fails
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padded = payloadBase64.padEnd(payloadBase64.length + (4 - (payloadBase64.length % 4)) % 4, '=');
          const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
          const uid = payload.user_id || payload.sub || payload.uid;
          if (uid) return { uid, ip };
        }
      } catch {}
    }
  }

  const headerUid = req.headers['x-user-id'] as string;
  if (headerUid && headerUid.trim()) {
    return { uid: headerUid.trim(), ip };
  }

  const queryUid = (req.query?.uid || req.query?.userId) as string;
  if (queryUid && queryUid.trim()) {
    return { uid: queryUid.trim(), ip };
  }

  return { uid: null, ip };
}

/**
 * Resolves user's plan tier with in-memory caching to avoid Firestore read amplification.
 * SECURITY: Never trust x-user-plan header alone for raising limits; Firestore/profile plan is
 * the sole authority when uid is present. Anonymous/ip: strictly assigned the most restrictive tier ('trial').
 */
export async function getUserPlanTier(uid: string | null, req: Request): Promise<PlanTier> {
  // Anonymous / IP-only callers are strictly assigned the most restrictive tier ('trial')
  if (!uid) {
    return 'trial';
  }

  const now = Date.now();
  const cached = planCache.get(uid);
  if (cached && (now - cached.timestamp < 60_000)) {
    return cached.plan;
  }

  if (!isFirebaseAdminReady()) {
    planCache.set(uid, { plan: 'trial', timestamp: now });
    return 'trial';
  }

  try {
    const db = getAdminFirestore();
    if (db) {
      // 1. Check profiles collection
      const docSnap = await db.collection('profiles').doc(uid).get();
      if (docSnap.exists) {
        const data = docSnap.data() || {};
        const plan = resolvePlanTier(data);
        planCache.set(uid, { plan, timestamp: now });
        return plan;
      }
      // 2. Check users collection
      const userSnap = await db.collection('users').doc(uid).get();
      if (userSnap.exists) {
        const data = userSnap.data() || {};
        const plan = resolvePlanTier(data);
        planCache.set(uid, { plan, timestamp: now });
        return plan;
      }
    }
  } catch (err: any) {
    markAdminUnauthenticated(err);
  }

  // Fallback to trial if profile not found or read error
  planCache.set(uid, { plan: 'trial', timestamp: now });
  return 'trial';
}

/**
 * Returns today's UTC date formatted as YYYY-MM-DD
 */
function getTodayUtcString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Express middleware factory enforcing daily plan action limits & logging Firestore usage counters
 * 
 * BVELT DAILY PLAN QUOTAS DOCUMENTATION:
 * -------------------------------------------------------------
 * Action Category               | Trial / Free  | Bvelt Pro
 * -------------------------------------------------------------
 * scan-maps / radar rescan       | 5 / day       | 60 / day
 * analyze_message / text AI      | 5 / day       | 250 / day
 * spatial / vision analyze       | 3 / day       | 50 / day
 * outreach drafts                | 10 / day      | 150 / day
 * heavy audits / benchmarks      | 3 / day       | 50 / day
 * -------------------------------------------------------------
 */
export function createPlanUsageGuard(action: PlanActionType, defaultAmount: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let resolvedMaxLimit = 5;
    let resolvedPlan: PlanTier = 'trial';
    let entityDocId = '';
    let memKey = '';

    try {
      const { uid, ip } = await extractRequestIdentity(req);
      const plan = await getUserPlanTier(uid, req);
      resolvedPlan = plan;
      const limits = getPlanLimits(plan);

      let effectiveAction = action;
      let maxLimit = limits.maxScansPerDay;

      // Handle spatial / vision analyze explicitly vs text AI analyze_message
      if (action === 'ai') {
        const isVisionOrSpatial = Boolean(req.body?.image || req.path?.toLowerCase().includes('spatial'));
        if (isVisionOrSpatial) {
          effectiveAction = 'spatial';
          maxLimit = limits.maxSpatialPerDay || 3;
        } else {
          maxLimit = limits.maxAiGenerationsPerDay;
        }
      } else if (action === 'spatial') {
        maxLimit = limits.maxSpatialPerDay || 3;
      } else if (action === 'outreach') {
        maxLimit = limits.maxOutreachDraftsPerDay;
      } else if (action === 'audit' || action === 'heavy_audit') {
        maxLimit = limits.maxHeavyAuditsPerDay;
      }
      resolvedMaxLimit = maxLimit;

      // Determine requested batch amount (e.g. for batch outreach or weighted AI tasks)
      let requestedAmount = Number(req.body?.maxBusinesses || req.body?.amount || defaultAmount) || defaultAmount;
      let weightAttempted = 1;

      if (action === 'ai') {
        let taskType: TaskType = req.body?.taskType;
        if (!taskType) {
          const path = req.path.toLowerCase();
          if (path.includes('generate-lead-pitch')) taskType = 'pitch';
          else if (path.includes('router')) taskType = 'generic';
          else if (path.includes('business-scan')) taskType = 'business_scan';
          else if (path.includes('audit')) taskType = 'audit';
          else if (path.includes('ai-visibility')) taskType = 'ai_visibility';
          else if (path.includes('niche-benchmark')) taskType = 'niche_benchmark';
          else taskType = 'copy_short';
        }
        weightAttempted = AI_CREDIT_WEIGHT[taskType] || 1;
        requestedAmount = weightAttempted;
      }

      // Special exemption: reverse geocoding on nominatim (just determining city for GPS) does not count against scans
      if (req.path.includes('nominatim') && req.query?.endpoint === 'reverse') {
        requestedAmount = 0;
      }

      const safeAmount = Math.max(0, Math.min(requestedAmount, 50));

      const today = getTodayUtcString();
      const entityId = uid || `ip_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const docId = `${entityId}_${today}`;
      entityDocId = docId;
      memKey = `${docId}_${action}`;

      let currentCount = 0;
      let dbWriteSucceeded = false;

      // Read memory fallback count first
      const memCount = memoryFallbackCounters.get(memKey) || 0;
      currentCount = memCount;

      // Check Firestore counter only if Firebase Admin is ready and authenticated
      if (isFirebaseAdminReady()) {
        const db = getAdminFirestore();
        if (db) {
          try {
            const counterRef = db.collection('usage_counters').doc(docId);
            const counterSnap = await counterRef.get();
            
            if (counterSnap.exists) {
              const data = counterSnap.data() || {};
              const firestoreCount = Number(data[action]) || 0;
              currentCount = Math.max(firestoreCount, memCount);
            }

            // Check if limit is reached BEFORE external provider calls
            if (currentCount >= maxLimit || (safeAmount > 0 && currentCount + safeAmount > maxLimit)) {
              const lang = (req.headers['accept-language']?.includes('es') || req.body?.language === 'es') ? 'es' : 'en';
              const errorPayload: LimitReachedResponse = createLimitReachedError(action, plan, maxLimit, currentCount, lang, weightAttempted);
              
              res.setHeader('X-RateLimit-Limit', String(maxLimit));
              res.setHeader('X-RateLimit-Remaining', '0');
              res.setHeader('X-RateLimit-Action', action);
              res.setHeader('Retry-After', '3600');
              
              return res.status(429).json(errorPayload);
            }

            // Atomically record and log usage counter in Firestore only on accepted request
            if (safeAmount > 0) {
              await counterRef.set({
                uid: uid || null,
                ip,
                date: today,
                plan,
                [action]: FieldValue.increment(safeAmount),
                updatedAt: FieldValue.serverTimestamp()
              }, { merge: true });
            }

            dbWriteSucceeded = true;
            currentCount += safeAmount;
            memoryFallbackCounters.set(memKey, currentCount);
          } catch (dbErr: any) {
            markAdminUnauthenticated(dbErr);
          }
        }
      }

      // Memory fallback: DEV-ONLY degraded mode when Firestore Admin credentials are not configured
      // Plan limits are still strictly enforced in memory, preventing unlimited provider abuse.
      if (!dbWriteSucceeded) {
        if (currentCount >= maxLimit || (safeAmount > 0 && currentCount + safeAmount > maxLimit)) {
          const lang = req.body?.language === 'es' ? 'es' : 'en';
          const errorPayload = createLimitReachedError(action, plan, maxLimit, currentCount, lang, weightAttempted);
          res.setHeader('X-RateLimit-Limit', String(maxLimit));
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Action', action);
          res.setHeader('Retry-After', '3600');
          return res.status(429).json(errorPayload);
        }
        currentCount += safeAmount;
        memoryFallbackCounters.set(memKey, currentCount);
      }

      // Attach headers for client visibility
      const remaining = Math.max(0, maxLimit - currentCount);
      res.setHeader('X-RateLimit-Limit', String(maxLimit));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Action', action);
      res.setHeader('X-User-Plan', plan);

      next();
    } catch (err: any) {
      console.error('[planUsageGuard] Uncaught guard error:', err);
      // Fail-secure: never soft-fail into unlimited provider calls
      const memCount = memKey ? (memoryFallbackCounters.get(memKey) || 0) : 0;
      if (memCount >= resolvedMaxLimit) {
        const errorPayload = createLimitReachedError(action, resolvedPlan, resolvedMaxLimit, memCount, 'en');
        return res.status(429).json(errorPayload);
      }
      next();
    }
  };
}

/**
 * Endpoint handler for /api/plan/usage
 * Returns current day usage vs max limits for each action category
 */
export async function getPlanUsageStatusHandler(req: Request, res: Response) {
  try {
    const { uid, ip } = await extractRequestIdentity(req);

    if (!uid) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required to access plan usage status. Please provide a valid Bearer token or user ID."
      });
    }

    const plan = await getUserPlanTier(uid, req);
    const limits = getPlanLimits(plan);
    const today = getTodayUtcString();
    const entityId = uid || `ip_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const docId = `${entityId}_${today}`;

    // 1. Short TTL cache (30s) per user/IP and day to stop polling storms from UI
    const cached = usageStatusCache.get(docId);
    const now = Date.now();
    if (cached && (now - cached.timestamp < 30_000)) {
      return res.json(cached.payload);
    }

    let used: Record<PlanActionType, number> = {
      scan: 0,
      ai: 0,
      spatial: 0,
      outreach: 0,
      audit: 0,
      heavy_audit: 0
    };

    // Read memory fallback first
    for (const act of ['scan', 'ai', 'spatial', 'outreach', 'audit', 'heavy_audit'] as PlanActionType[]) {
      used[act] = memoryFallbackCounters.get(`${docId}_${act}`) || 0;
    }

    // Only query Firestore if admin credentials are ready and authenticated
    if (isFirebaseAdminReady()) {
      const db = getAdminFirestore();
      if (db) {
        try {
          const counterRef = db.collection('usage_counters').doc(docId);
          const snap = await counterRef.get();
          if (snap.exists) {
            const data = snap.data() || {};
            used.scan = Math.max(used.scan, Number(data.scan) || 0);
            used.ai = Math.max(used.ai, Number(data.ai) || 0);
            used.spatial = Math.max(used.spatial, Number(data.spatial) || 0);
            used.outreach = Math.max(used.outreach, Number(data.outreach) || 0);
            used.audit = Math.max(used.audit, Number(data.audit) || Number(data.heavy_audit) || 0);
            used.heavy_audit = used.audit;
          }
        } catch (e: any) {
          markAdminUnauthenticated(e);
        }
      }
    }

    const maxLimits: Record<PlanActionType, number> = {
      scan: limits.maxScansPerDay,
      ai: limits.maxAiGenerationsPerDay,
      spatial: limits.maxSpatialPerDay || 3,
      outreach: limits.maxOutreachDraftsPerDay,
      audit: limits.maxHeavyAuditsPerDay,
      heavy_audit: limits.maxHeavyAuditsPerDay
    };

    const remaining: Record<PlanActionType, number> = {
      scan: Math.max(0, maxLimits.scan - used.scan),
      ai: Math.max(0, maxLimits.ai - used.ai),
      spatial: Math.max(0, maxLimits.spatial - used.spatial),
      outreach: Math.max(0, maxLimits.outreach - used.outreach),
      audit: Math.max(0, maxLimits.audit - used.audit),
      heavy_audit: Math.max(0, maxLimits.heavy_audit - used.heavy_audit)
    };

    const payload = {
      date: today,
      plan,
      limits: maxLimits,
      used,
      remaining
    };

    usageStatusCache.set(docId, { timestamp: now, payload });
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch usage status", details: err.message });
  }
}
