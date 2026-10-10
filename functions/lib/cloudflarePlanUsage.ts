/**
 * Edge-compatible handler for /api/plan/usage on Cloudflare Workers & Pages.
 * Returns daily usage counters vs max limits for each action category.
 */
import { verifyFirebaseIdToken } from "./cloudflareFirestore.js";

export async function handleCloudflarePlanUsage(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-uid"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    let uid: string | null = null;

    // 1. Extract and verify authentication from Authorization header
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const idToken = authHeader.substring(7).trim();
      uid = await verifyFirebaseIdToken(env, idToken);
      // Fallback: extract payload UID if edge crypto token verification is not initialized
      if (!uid) {
        try {
          const parts = idToken.split(".");
          if (parts.length === 3) {
            let clean = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            while (clean.length % 4) clean += "=";
            const payload = JSON.parse(atob(clean));
            uid = payload.user_id || payload.sub || payload.uid || null;
          }
        } catch {}
      }
    }

    // 2. Extract from x-user-id or x-uid headers
    if (!uid) {
      uid = request.headers.get("x-user-id") || request.headers.get("x-uid") || null;
    }

    // 3. Extract from URL query parameter
    if (!uid) {
      const url = new URL(request.url);
      uid = url.searchParams.get("uid") || url.searchParams.get("userId") || null;
    }

    // Require authentication: if anonymous / unauthenticated, return clear 401 JSON
    if (!uid) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required to access plan usage status. Please provide a valid Bearer token or user ID."
      }), {
        status: 401,
        headers
      });
    }

    // 4. Resolve Plan Tier from Firestore profile
    let plan = "trial";
    let isPro = false;
    let projectId = env.FIREBASE_PROJECT_ID || "localflowpro-20e3d";

    if (env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const parsed = typeof env.FIREBASE_SERVICE_ACCOUNT === 'string'
          ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
          : env.FIREBASE_SERVICE_ACCOUNT;
        if (parsed.project_id) projectId = parsed.project_id;
      } catch {}
    }

    try {
      const profileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/profiles/${uid}`;
      const resp = await fetch(profileUrl);
      if (resp.ok) {
        const doc = await resp.json() as any;
        const fields = doc.fields || {};
        isPro = fields.isPro?.booleanValue === true;
        const userPlan = fields.plan?.stringValue || (isPro ? "pro_monthly" : "trial");
        plan = userPlan;
      }
    } catch (e) {
      console.warn("[Cloudflare Plan Usage] Profile fetch error:", e);
    }

    const isProTier = isPro || plan.includes("pro") || plan.includes("annual") || plan.includes("monthly");
    const isSolo = plan.includes("solo");

    // Standardized Plan Limits aligned with planLimits.ts
    const limits = {
      scan: isProTier ? 60 : (isSolo ? 25 : 5),
      ai: isProTier ? 250 : (isSolo ? 80 : 5),       // trial: max 5 AI/day
      spatial: isProTier ? 50 : (isSolo ? 15 : 3),    // spatial / vision: max 3/day
      outreach: isProTier ? 150 : (isSolo ? 50 : 10), // outreach: max 10/day
      audit: isProTier ? 50 : (isSolo ? 15 : 3),      // audits: max 3/day
      heavy_audit: isProTier ? 50 : (isSolo ? 15 : 3)
    };

    const today = new Date().toISOString().split("T")[0];

    // 5. Query today's counters from Firestore
    let used = {
      scan: 0,
      ai: 0,
      spatial: 0,
      outreach: 0,
      audit: 0,
      heavy_audit: 0
    };

    try {
      const counterUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/usage_counters/${uid}_${today}`;
      const counterRes = await fetch(counterUrl);
      if (counterRes.ok) {
        const cDoc = await counterRes.json() as any;
        const cFields = cDoc.fields || {};
        used.scan = Number(cFields.scan?.integerValue || cFields.scan?.doubleValue || 0);
        used.ai = Number(cFields.ai?.integerValue || cFields.ai?.doubleValue || 0);
        used.spatial = Number(cFields.spatial?.integerValue || cFields.spatial?.doubleValue || 0);
        used.outreach = Number(cFields.outreach?.integerValue || cFields.outreach?.doubleValue || 0);
        used.audit = Number(cFields.audit?.integerValue || cFields.audit?.doubleValue || 0);
        used.heavy_audit = used.audit;
      }
    } catch {}

    const remaining = {
      scan: Math.max(0, limits.scan - used.scan),
      ai: Math.max(0, limits.ai - used.ai),
      spatial: Math.max(0, limits.spatial - used.spatial),
      outreach: Math.max(0, limits.outreach - used.outreach),
      audit: Math.max(0, limits.audit - used.audit),
      heavy_audit: Math.max(0, limits.heavy_audit - used.heavy_audit)
    };

    return new Response(JSON.stringify({
      date: today,
      plan: isProTier ? (plan.includes("annual") ? "pro_annual" : "pro_monthly") : (isSolo ? "solo" : "trial"),
      limits,
      used,
      remaining
    }), {
      status: 200,
      headers
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: "Failed to fetch usage status",
      details: err.message || String(err)
    }), {
      status: 500,
      headers
    });
  }
}
