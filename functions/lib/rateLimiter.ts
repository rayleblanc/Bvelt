/**
 * Cloudflare Workers Edge Rate Limiter
 * 
 * Protects Gemini and Groq API keys by limiting requests per user or session.
 */

// In-memory sliding window store for rapid sub-second lookups per Worker isolate
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function cleanupInMemoryStore() {
  const now = Date.now();
  for (const [key, record] of inMemoryStore.entries()) {
    if (now > record.resetAt) {
      inMemoryStore.delete(key);
    }
  }
}

/**
 * Extracts the user identifier from the request.
 * Priority:
 * 1) Firebase Auth userId from Authorization Bearer JWT
 * 2) userId or uid in URL params, headers, or JSON body
 * 3) Client IP (CF-Connecting-IP, x-real-ip, or x-forwarded-for)
 */
export async function extractUserIdentifier(request: Request): Promise<string> {
  // 1. Authorization header with JWT
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.substring(7).trim();
    const uid = parseUserIdFromJwt(token);
    if (uid) return `user:${uid}`;
  }

  // 2. Custom headers
  const headerUserId = request.headers.get("x-user-id") || request.headers.get("x-client-id");
  if (headerUserId && headerUserId.trim() !== "") {
    return `user:${headerUserId.trim()}`;
  }

  // 3. Query params
  try {
    const url = new URL(request.url);
    const queryUserId = url.searchParams.get("userId") || url.searchParams.get("uid");
    if (queryUserId && queryUserId.trim() !== "") {
      return `user:${queryUserId.trim()}`;
    }
  } catch {}

  // 4. Cloned JSON body peek (if POST/PUT)
  if (request.method === "POST" || request.method === "PUT") {
    try {
      const cloned = request.clone();
      const body = await cloned.json().catch(() => null) as any;
      if (body) {
        const bodyUid = body.userId || body.uid || body.user?.uid || body.user_id;
        if (bodyUid && typeof bodyUid === "string" && bodyUid.trim() !== "") {
          return `user:${bodyUid.trim()}`;
        }
      }
    } catch {}
  }

  // 5. Fallback to IP address
  const clientIp = request.headers.get("cf-connecting-ip") || 
                   request.headers.get("x-real-ip") || 
                   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   "unknown-ip";

  return `ip:${clientIp}`;
}

/**
 * Helper to parse sub/user_id from JWT payload without heavy signature verification (fast at edge)
 */
function parseUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = payloadBase64.padEnd(payloadBase64.length + (4 - (payloadBase64.length % 4)) % 4, "=");
      const json = atob(padded);
      const payload = JSON.parse(json);
      return payload.user_id || payload.sub || payload.uid || null;
    }
  } catch {}
  return null;
}

export type RateLimitCategory = 'scan' | 'ai' | 'outreach' | 'heavy_tool' | 'heavy_audit' | 'heavy' | 'ai_light' | 'public_r' | 'report_create' | 'verify_payment';

/**
 * Safely masks PII identifiers (IPs, emails, UIDs) for privacy-compliant logging.
 */
export function maskPiiIdentifier(id: string): string {
  if (!id) return 'unknown';
  if (id.startsWith('ip:')) {
    const rawIp = id.replace('ip:', '');
    const parts = rawIp.split('.');
    if (parts.length === 4) {
      return `ip:${parts[0]}.${parts[1]}.*.*`;
    }
    return `ip:${rawIp.slice(0, 4)}***`;
  }
  if (id.startsWith('user:')) {
    const uid = id.replace('user:', '');
    if (uid.length > 6) {
      return `user:${uid.slice(0, 3)}***${uid.slice(-3)}`;
    }
    return `user:***`;
  }
  return '***';
}

export interface TierLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface TieredRateLimitConfig {
  trial: TierLimitConfig;
  pro: TierLimitConfig;
}

export const TIERED_RATE_LIMIT_CONFIGS: Record<string, TieredRateLimitConfig> = {
  // 1) Scan-maps / business-scan / audit / rescan:
  // Trial: max 5 / 24h (86400s) | Pro: max 60 / 24h (86400s)
  scan: {
    trial: { maxRequests: 5, windowSeconds: 86400 },
    pro: { maxRequests: 60, windowSeconds: 86400 },
  },
  // 2) analyze_message / text AI:
  // Trial: max 5 / 24h (86400s) | Pro: max 250 / 24h (86400s)
  ai: {
    trial: { maxRequests: 5, windowSeconds: 86400 },
    pro: { maxRequests: 250, windowSeconds: 86400 },
  },
  // 3) spatial / vision analyze:
  // Trial: max 3 / 24h (86400s) | Pro: max 50 / 24h (86400s)
  spatial: {
    trial: { maxRequests: 3, windowSeconds: 86400 },
    pro: { maxRequests: 50, windowSeconds: 86400 },
  },
  // 4) Outreach:
  // Trial: 10 / 24h (86400s) | Pro: 150 / 24h (86400s)
  outreach: {
    trial: { maxRequests: 10, windowSeconds: 86400 },
    pro: { maxRequests: 150, windowSeconds: 86400 },
  },
  // 5) Heavy audits / benchmarks:
  // Trial: 3 / day (86400s) | Pro: 50 / day (86400s)
  heavy_tool: {
    trial: { maxRequests: 3, windowSeconds: 86400 },
    pro: { maxRequests: 50, windowSeconds: 86400 },
  },
  heavy_audit: {
    trial: { maxRequests: 3, windowSeconds: 86400 },
    pro: { maxRequests: 50, windowSeconds: 86400 },
  },
  // 6) Public report routes /r/* (IP rate limit: 30 req/h = 3600s)
  public_r: {
    trial: { maxRequests: 30, windowSeconds: 3600 },
    pro: { maxRequests: 30, windowSeconds: 3600 },
  },
  // 7) Report creation (UID rate limit: 10 reports/day = 86400s)
  report_create: {
    trial: { maxRequests: 10, windowSeconds: 86400 },
    pro: { maxRequests: 50, windowSeconds: 86400 },
  },
  // 8) Verify payment rate limit (IP/UID: 15 req/h = 3600s)
  verify_payment: {
    trial: { maxRequests: 15, windowSeconds: 3600 },
    pro: { maxRequests: 30, windowSeconds: 3600 },
  },
  // Aliases for backward compatibility
  heavy: {
    trial: { maxRequests: 5, windowSeconds: 86400 },
    pro: { maxRequests: 60, windowSeconds: 86400 },
  },
  ai_light: {
    trial: { maxRequests: 5, windowSeconds: 86400 },
    pro: { maxRequests: 250, windowSeconds: 86400 },
  },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
  identifier: string;
  plan: 'pro' | 'trial';
  category?: RateLimitCategory;
}

/**
  * Extracts user subscription plan tier ('pro' vs 'trial').
  */
export function extractUserPlan(request: Request): 'pro' | 'trial' {
  // 1. Explicit headers
  const planHeader = request.headers.get("x-user-plan") || request.headers.get("X-User-Plan");
  if (planHeader && (planHeader.toLowerCase().trim() === "pro" || planHeader.toLowerCase().trim() === "active")) {
    return 'pro';
  }

  const subHeader = request.headers.get("x-subscription-status") || request.headers.get("X-Subscription-Status");
  if (subHeader && subHeader.toLowerCase().trim() === "active") {
    return 'pro';
  }

  // 2. Query parameter
  try {
    const url = new URL(request.url);
    const queryPlan = url.searchParams.get("plan") || url.searchParams.get("userPlan");
    if (queryPlan && (queryPlan.toLowerCase().trim() === "pro" || queryPlan.toLowerCase().trim() === "active")) {
      return 'pro';
    }
  } catch {}

  // 3. JWT token check (if present)
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.substring(7).trim();
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payloadBase64.padEnd(payloadBase64.length + (4 - (payloadBase64.length % 4)) % 4, "=");
        const json = JSON.parse(atob(padded));
        if (json.isPro === true || json.plan === 'pro' || json.stripe_status === 'active' || json.subscriptionStatus === 'active') {
          return 'pro';
        }
      }
    } catch {}
  }

  return 'trial';
}

/**
 * Evaluates rate limiting for a request.
 * Uses in-memory windowing and optionally KV namespace if available in env.RATE_LIMIT_KV.
 */
export async function checkRateLimit(
  request: Request,
  category: RateLimitCategory,
  env: any
): Promise<RateLimitResult> {
  const plan = extractUserPlan(request);
  const tieredConfig = TIERED_RATE_LIMIT_CONFIGS[category] || TIERED_RATE_LIMIT_CONFIGS.ai;
  const config = tieredConfig[plan];
  
  const identifier = await extractUserIdentifier(request);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // Cleanup old in-memory entries randomly (~1% chance)
  if (Math.random() < 0.01) {
    cleanupInMemoryStore();
  }

  const key = `rl:${category}:${identifier}`;

  // 1. Check Cloudflare KV if configured in environment
  if (env && env.RATE_LIMIT_KV && typeof env.RATE_LIMIT_KV.get === "function") {
    try {
      const kvVal = await env.RATE_LIMIT_KV.get(key);
      const count = kvVal ? parseInt(kvVal, 10) : 0;
      if (count >= config.maxRequests) {
        return {
          allowed: false,
          limit: config.maxRequests,
          remaining: 0,
          resetInSeconds: config.windowSeconds,
          identifier,
          plan,
          category,
        };
      }
      await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: config.windowSeconds });
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - (count + 1)),
        resetInSeconds: config.windowSeconds,
        identifier,
        plan,
        category,
      };
    } catch (kvErr) {
      console.warn("[RateLimiter] KV error, falling back to in-memory store:", kvErr);
    }
  }

  // 2. In-Memory Store Fallback / Primary
  let record = inMemoryStore.get(key);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    inMemoryStore.set(key, record);
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetInSeconds: config.windowSeconds,
      identifier,
      plan,
      category,
    };
  }

  if (record.count >= config.maxRequests) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetInSeconds,
      identifier,
      plan,
      category,
    };
  }

  record.count += 1;
  const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - record.count,
    resetInSeconds,
    identifier,
    plan,
    category,
  };
}

/**
 * Builds standard HTTP 429 JSON response matching createLimitReachedError
 */
export function createRateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
  const action = result.category || 'scan';
  const maskedId = maskPiiIdentifier(result.identifier);

  console.warn(`[RateLimiter 429] Action: ${action} | Identifier: ${maskedId} | ResetIn: ${result.resetInSeconds}s`);

  const humanMsg = action === 'public_r'
    ? 'Too many public report requests from this IP (limit: 30/h). Please try again later. / Límite de peticiones alcanzado (30 req/h).'
    : action === 'report_create'
    ? 'Daily report creation limit reached (10/day per user). / Límite diario de creación de reportes alcanzado (10/día).'
    : action === 'verify_payment'
    ? 'Too many payment verification requests. Please wait before retrying. / Límite de verificaciones de pago alcanzado.'
    : `Límite diario del plan de prueba alcanzado. (${result.limit}/${result.limit} usados).`;

  return new Response(
    JSON.stringify({
      code: "LIMIT_REACHED",
      error: "rate_limit_exceeded",
      message: humanMsg,
      upgrade: result.plan === 'trial',
      remaining: 0,
      limit: result.limit,
      current: result.limit,
      action: action,
      plan: result.plan,
      retryAfterSeconds: result.resetInSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": String(result.resetInSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Action": action,
        "X-RateLimit-Reset": String(result.resetInSeconds),
        ...corsHeaders,
      },
    }
  );
}
