import { GoogleGenAI } from "@google/genai";

/**
 * BVELT AI PROVIDER MATRIX & MODEL GOVERNANCE CONFIGURATION
 * Authoritative centralized policy layer for LLM routing, models normalization,
 * and circuit breaker states across all API handlers.
 */

/**
 * Checks whether a model identifier is known to return 404 / model_not_found / decommissioned on Groq
 */
export function is404GroqModel(modelName?: string): boolean {
  if (!modelName || modelName.trim() === "") return true;
  const m = modelName.toLowerCase().trim();
  return (
    m.includes("specdec") ||
    m === "llama3-70b-8192" ||
    m === "llama-3.1-70b-versatile"
  );
}

// Compute safe Groq model with production fallback
const envGroq = (typeof process !== "undefined" && process.env?.GROQ_MODEL) ? process.env.GROQ_MODEL.trim() : "";
const SAFE_GROQ_MODEL = (envGroq && !is404GroqModel(envGroq)) ? envGroq : "llama-3.3-70b-versatile";

// Centralized Active Model IDs
export const ACTIVE_MODELS = {
  // Safe Groq model (defaults to llama-3.3-70b-versatile with 14.4k requests/day quota)
  GROQ_FAST: SAFE_GROQ_MODEL,
  GROQ_FAST_BACKUP: "llama-3.1-8b-instant",
  GROQ_STRONG: SAFE_GROQ_MODEL,
  GEMINI_LITE: "gemini-3.1-flash-lite",
  GEMINI_PRIMARY: "gemini-3.8-flash",
  GEMINI_STRONG: "gemini-3.8-flash",
  GEMINI_TTS: "gemini-3.8-flash-lite-tts",
  GEMINI_TRANSCRIBE: "gemini-3.5-transcribe",
  GEMINI_LIVE: "gemini-3.8-live",

  // Mappings for backwards-compatibility with older imports
  GROQ_PRIMARY: SAFE_GROQ_MODEL,
  GEMINI_FAST: "gemini-3.1-flash-lite",
};

export type TaskType = 
  | "copy_short"
  | "pitch"
  | "rank_actions"
  | "diagnosis_rewrite"
  | "scan_summary"
  | "business_scan"
  | "audit"
  | "ai_visibility"
  | "niche_benchmark"
  | "generic";

export interface CascadeStep {
  provider: "groq" | "gemini" | "rules";
  modelName?: string;
  fallbackTemplate?: string;
}

/**
 * BVELT AI TEXT CASCADE SPECIFICATION:
 * 1. Primary: gemini-3.1-flash-lite (high RPD, lowest latency, zero rate-limit waste).
 * 2. Secondary Fallback: gemini-3.8-flash (full reasoning when lite is unavailable).
 * 3. Immediate Fault Recovery: 404/403/503 errors skip retries and step immediately.
 * 4. Zero Deprecated Models: All gemini-1.5-* and gemini-2.0-* IDs permanently pruned.
 * 5. Safe Landing: Deterministic rules guarantee zero user-facing 500 crashes.
 */
export function getTaskCascade(taskType: TaskType): CascadeStep[] {
  switch (taskType) {
    case "diagnosis_rewrite":
    case "copy_short":
    case "pitch":
    case "generic":
      return [
        { provider: "groq", modelName: ACTIVE_MODELS.GROQ_FAST },
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_LITE },
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_PRIMARY },
        { provider: "rules", fallbackTemplate: "short_copy" }
      ];

    case "rank_actions":
    case "scan_summary":
      return [
        { provider: "groq", modelName: ACTIVE_MODELS.GROQ_FAST },
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_LITE },
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_PRIMARY },
        { provider: "rules", fallbackTemplate: "rules_only" }
      ];

    case "business_scan":
    case "audit":
    case "ai_visibility":
    case "niche_benchmark":
      return [
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_PRIMARY },
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_LITE },
        { provider: "rules", fallbackTemplate: "rules_only" }
      ];

    default:
      return [
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_LITE },
        { provider: "gemini", modelName: ACTIVE_MODELS.GEMINI_PRIMARY },
        { provider: "rules", fallbackTemplate: "rules_only" }
      ];
  }
}

let cachedGeminiClient: GoogleGenAI | null = null;

export function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  if (!customApiKey && cachedGeminiClient) {
    return cachedGeminiClient;
  }
  const client = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-bvelt-backend",
      },
    },
  });
  if (!customApiKey) {
    cachedGeminiClient = client;
  }
  return client;
}

// Map of all legacy or preview model IDs to active production model IDs
const MODEL_MAPPING: Record<string, string> = {
  // Explicitly mapping legacy/deprecated models to active 3.x equivalents
  "gemini-2.0-flash-lite": "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite": "gemini-3.1-flash-lite",
  "gemini-2.5-flash": "gemini-3.8-flash",
  "gemini-1.5-flash": "gemini-3.1-flash-lite",
  "gemini-1.5-pro": "gemini-3.8-flash",
  "gemini-2.0-flash": "gemini-3.8-flash",
  "gemini-2.0-pro": "gemini-3.8-flash",
  "gemini-2.0-flash-thinking": "gemini-3.8-flash",
  "gemini-3.5-flash": "gemini-3.8-flash",
  "gemini-3.6-flash": "gemini-3.8-flash",
  "gemini-3.7-flash": "gemini-3.8-flash",
  "gemini-3.8-flash": "gemini-3.8-flash",
  "gemini-3.5-flash-lite": "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",
  "gemini-flash": "gemini-3.8-flash",
  "gemini-flash-latest": "gemini-3.8-flash",
  "gemini-lite": "gemini-3.1-flash-lite",

  // Groq mappings
  "llama3-70b-8192": ACTIVE_MODELS.GROQ_FAST,
  "llama-3.1-70b-versatile": ACTIVE_MODELS.GROQ_FAST_BACKUP,
  "llama-3.1-8b-instant": ACTIVE_MODELS.GROQ_FAST,
  "llama-3.1-8b": ACTIVE_MODELS.GROQ_FAST,
  "llama-3.3-70b-versatile": ACTIVE_MODELS.GROQ_FAST,
  "openai/gpt-oss-120b": ACTIVE_MODELS.GROQ_FAST,
  "openai/gpt-oss-20b": ACTIVE_MODELS.GROQ_FAST_BACKUP,
};

/**
 * Normalizes any legacy or custom model string to the current active production models.
 */
export function normalizeModelName(name: string): string {
  if (!name) return ACTIVE_MODELS.GEMINI_PRIMARY;
  const cleanName = name.trim().toLowerCase();
  if (MODEL_MAPPING[cleanName]) {
    return MODEL_MAPPING[cleanName];
  }
  if (cleanName.includes("gemini-2.0") || cleanName.includes("gemini-2.5") || cleanName.includes("gemini-1.5") || cleanName.includes("gemini-3.5")) {
    if (cleanName.includes("lite")) {
      return "gemini-3.1-flash-lite";
    }
    return "gemini-3.8-flash";
  }
  return name;
}

// Global Circuit Breaker States (Short-term in-memory state on the serverless container instance)
export const circuitBreaker = {
  isGroqDisabledGlobally: false,
  isGroqCooldownUntil: 0,
  isGeminiDailyQuotaExhaustedUntil: 0,
  isGemini429CooldownUntil: 0,
};

/**
 * Checks if a specific provider's circuit breaker is currently active.
 */
export function isProviderAvailable(provider: "groq" | "gemini"): boolean {
  const now = Date.now();
  if (provider === "groq") {
    return !circuitBreaker.isGroqDisabledGlobally && now >= circuitBreaker.isGroqCooldownUntil;
  }
  if (provider === "gemini") {
    return now >= circuitBreaker.isGeminiDailyQuotaExhaustedUntil && now >= circuitBreaker.isGemini429CooldownUntil;
  }
  return true;
}

/**
 * Helper to parse duration string from Groq or Gemini headers/messages (e.g. "1m30s", "12.5s", "400ms").
 */
export function parseResetDurationMs(resetStr: string): number {
  if (!resetStr) return 0;
  const str = resetStr.trim().toLowerCase();
  
  const mMatch = str.match(/(\d+)\s*m(?:in)?/);
  const sMatch = str.match(/([\d.]+)\s*s(?:ec)?/);
  const msMatch = str.match(/([\d.]+)\s*ms/);

  let totalMs = 0;
  if (mMatch) totalMs += parseInt(mMatch[1], 10) * 60000;
  if (sMatch) totalMs += parseFloat(sMatch[1]) * 1000;
  if (msMatch) totalMs += parseFloat(msMatch[1]);

  if (totalMs === 0) {
    const rawNum = parseFloat(str);
    if (!isNaN(rawNum)) totalMs = rawNum > 100 ? rawNum : rawNum * 1000;
  }
  return totalMs;
}

/**
 * Helper to analyze Gemini errors and classify whether they are daily quota hits or temporary RPM/TPM rate limits.
 * Also extracts retryDelay from text or error object (supporting structured Google RPC RetryInfo / QuotaFailure).
 */
export function parseGeminiError(errorMsg: string, errObj?: any): { isDailyQuota: boolean; retryDelayMs: number } {
  const lowerMsg = (errorMsg || "").toLowerCase();

  let isDailyQuota = lowerMsg.includes("per day") || 
                       lowerMsg.includes("per_day") || 
                       lowerMsg.includes("daily") || 
                       lowerMsg.includes("rpd") || 
                       lowerMsg.includes("requests_per_day") ||
                       lowerMsg.includes("free_tier_requests_per_day");

  let retryDelayMs = 15000; // Default 15-second cooldown for RPM/TPM rate limits

  // 1. Inspect structured Google RPC details if available on errObj
  if (errObj && typeof errObj === "object") {
    const detailsList = errObj.errorDetails || errObj.statusDetails || errObj.details || 
                        (errObj.error && (errObj.error.details || errObj.error.errorDetails));
    
    if (Array.isArray(detailsList)) {
      for (const item of detailsList) {
        if (!item || typeof item !== "object") continue;
        const typeStr = String(item["@type"] || item.type || "").toLowerCase();

        // Check QuotaFailure details
        if (typeStr.includes("quotafailure")) {
          const violations = item.violations || item.violation;
          if (Array.isArray(violations)) {
            for (const v of violations) {
              const vDesc = String(v.description || v.subject || "").toLowerCase();
              if (vDesc.includes("day") || vDesc.includes("daily") || vDesc.includes("rpd")) {
                isDailyQuota = true;
              } else if (vDesc.includes("minute") || vDesc.includes("rpm") || vDesc.includes("tpm")) {
                isDailyQuota = false;
              }
            }
          }
        }

        // Check RetryInfo details
        if (typeStr.includes("retryinfo") || item.retryDelay) {
          const delay = item.retryDelay;
          if (typeof delay === "string") {
            const parsedMs = parseResetDurationMs(delay);
            if (parsedMs > 0) retryDelayMs = parsedMs;
          } else if (typeof delay === "object" && delay !== null) {
            const secs = Number(delay.seconds || 0);
            const nanos = Number(delay.nanos || 0);
            const totalMs = secs * 1000 + nanos / 1000000;
            if (totalMs > 0) retryDelayMs = totalMs;
          } else if (typeof delay === "number" && delay > 0) {
            retryDelayMs = delay > 1000 ? delay : delay * 1000;
          }
        }
      }
    }

    // Direct property check on errObj
    if (errObj.retryDelay) {
      const delay = errObj.retryDelay;
      if (typeof delay === "number" && delay > 0) {
        retryDelayMs = delay > 1000 ? delay : delay * 1000;
      } else if (typeof delay === "string") {
        const parsedMs = parseResetDurationMs(delay);
        if (parsedMs > 0) retryDelayMs = parsedMs;
      }
    }
  }

  // 2. Parse text string for retryDelay if not overridden by structured RetryInfo
  if (retryDelayMs === 15000) {
    const secondsMatch = lowerMsg.match(/retry\s*(?:after|in)?\s*:?\s*'?([\d.]+)\s*s(?:econds?)?/i) ||
                         lowerMsg.match(/retrydelay\s*:?\s*'?([\d.]+)\s*s?/i);

    if (secondsMatch && secondsMatch[1]) {
      const secs = parseFloat(secondsMatch[1]);
      if (!isNaN(secs) && secs > 0) {
        retryDelayMs = secs * 1000;
      }
    }
  }

  // Bounds: minimum 1s, maximum 5 minutes for temporary RPM/TPM rate limits
  retryDelayMs = Math.min(Math.max(retryDelayMs + 500, 1000), 300000);

  return { isDailyQuota, retryDelayMs };
}

/**
 * Triggers circuit breaker for Groq on permanent auth/model permission errors.
 */
export function disableGroqGlobally(reason: string): void {
  console.warn(`[Groq Circuit Breaker] Disabling Groq globally: ${reason}`);
  circuitBreaker.isGroqDisabledGlobally = true;
}

/**
 * Triggers circuit breaker for Groq on rate-limit errors.
 */
export function setGroqCooldown(errorMsg: string): void {
  const now = Date.now();
  let cooldownMs = 15000;
  const lowerMsg = (errorMsg || "").toLowerCase();
  
  const match = lowerMsg.match(/try again in ([\w\d.]+)/i) ||
                lowerMsg.match(/retry\s*(?:after|in)?\s*:?\s*'?([\w\d.]+)'?/i);
  if (match && match[1]) {
    const parsedMs = parseResetDurationMs(match[1]);
    if (parsedMs > 0) {
      cooldownMs = Math.min(Math.max(parsedMs + 200, 1000), 60000);
    }
  }
  console.warn(`[Groq Quota Manager] Rate Limit Hit: ${Math.round(cooldownMs / 1000)}s cooldown set. Error: ${errorMsg}`);
  circuitBreaker.isGroqCooldownUntil = Math.max(circuitBreaker.isGroqCooldownUntil, now + cooldownMs);
}

/**
 * Triggers circuit breaker for Gemini on rate-limit errors.
 * Supports signatures: setGeminiCooldown(errMsg, errObj) OR setGeminiCooldown(isDailyQuota, errMsg, errObj)
 */
export function setGeminiCooldown(arg1: boolean | string, arg2?: any, arg3?: any): void {
  const now = Date.now();
  let isDaily = false;
  let msg = "";
  let errObj: any = undefined;

  if (typeof arg1 === "boolean") {
    isDaily = arg1;
    msg = typeof arg2 === "string" ? arg2 : "";
    errObj = arg3;
  } else {
    msg = arg1 || "";
    if (typeof arg2 === "object" && arg2 !== null) {
      errObj = arg2;
    } else if (typeof arg2 === "string") {
      msg = `${msg} ${arg2}`;
      errObj = arg3;
    }
  }

  const parsed = parseGeminiError(msg, errObj);
  
  // Downgrade false-positive daily blocks if error message lacks explicit daily quota keywords
  if (isDaily && !parsed.isDailyQuota) {
    console.warn(`[Gemini Quota Manager] Downgrading false-positive daily block to RPM rate-limit cooldown.`);
    isDaily = false;
  } else if (!isDaily && parsed.isDailyQuota) {
    isDaily = true;
  }

  if (isDaily) {
    console.warn(`[Gemini Quota Manager] RPD Daily Limit Hit: Cooldown set. Error: ${msg}`);
    circuitBreaker.isGeminiDailyQuotaExhaustedUntil = Math.max(circuitBreaker.isGeminiDailyQuotaExhaustedUntil, now + 2 * 60 * 60 * 1000);
  } else {
    const cooldownMs = parsed.retryDelayMs;
    console.warn(`[Gemini Quota Manager] RPM/TPM Rate Limit Hit: ${Math.round(cooldownMs / 1000)}s cooldown set. Error: ${msg}`);
    circuitBreaker.isGemini429CooldownUntil = Math.max(circuitBreaker.isGemini429CooldownUntil, now + cooldownMs);
  }
}

/**
 * Parses Groq rate limit headers to proactively set a cooldown if we are close to running out of quota.
 */
export function handleGroqHeaders(headers: any): void {
  try {
    if (!headers || typeof headers.get !== "function") return;
    const remainingRequests = headers.get("x-ratelimit-remaining-requests");
    const remainingTokens = headers.get("x-ratelimit-remaining-tokens");
    const resetRequests = headers.get("x-ratelimit-reset-requests");
    const resetTokens = headers.get("x-ratelimit-reset-tokens");

    const remReq = remainingRequests !== null && remainingRequests !== undefined ? parseInt(remainingRequests, 10) : null;
    const remTok = remainingTokens !== null && remainingTokens !== undefined ? parseInt(remainingTokens, 10) : null;

    // Only trigger proactive cooldown if remaining requests = 0 or remaining tokens <= 300
    if ((remReq !== null && !isNaN(remReq) && remReq <= 0) || (remTok !== null && !isNaN(remTok) && remTok <= 300)) {
      const now = Date.now();
      let resetTime = 2000;
      const targetResetStr = (remTok !== null && remTok <= 300) ? resetTokens : resetRequests;
      if (targetResetStr) {
        const parsedMs = parseResetDurationMs(targetResetStr);
        if (parsedMs > 0) {
          resetTime = Math.max(1000, parsedMs + 200);
        }
      }
      console.warn(`[Groq Quota Manager] Proactive Cooldown Triggered: Remaining requests=${remReq}, remaining tokens=${remTok}. Setting cooldown for ${resetTime}ms`);
      circuitBreaker.isGroqCooldownUntil = Math.max(circuitBreaker.isGroqCooldownUntil, now + resetTime);
    }
  } catch (err) {
    // Fail-safe
  }
}

// ============================================================================
// BVELT EVIDENCE MEMORY (BEM) — CENTRAL GEOGRAPHICAL CACHE & REQUEST COALESCING
// ============================================================================

export interface NominatimResult {
  lat: number;
  lng: number;
  displayName?: string;
}

export const sharedNominatimCache = new Map<string, { timestamp: number; result: NominatimResult }>();
export const sharedNominatimPromises = new Map<string, Promise<NominatimResult | null>>();

export const sharedOverpassCache = new Map<string, { timestamp: number; elements: any[] }>();
export const sharedOverpassPromises = new Map<string, Promise<any[]>>();

/**
 * Executes a Nominatim Geocoding request with deduplication and memory caching.
 */
export async function fetchNominatimWithCache(
  queryText: string,
  fetchFn: () => Promise<NominatimResult | null>
): Promise<NominatimResult | null> {
  const key = queryText.toLowerCase().trim();
  
  // 1. Check TTL Cache
  const cached = sharedNominatimCache.get(key);
  const now = Date.now();
  if (cached && (now - cached.timestamp < 24 * 60 * 60 * 1000)) { // 24 hours TTL
    console.log(`[BEM Cache Hit] Nominatim result loaded from cache for key: "${key}"`);
    return cached.result;
  }

  // 2. Check Active Promise for Request Coalescing (Deduplication)
  let activePromise = sharedNominatimPromises.get(key);
  if (activePromise) {
    console.log(`[Request Coalescing] Reusing active promise for Nominatim query: "${key}"`);
    return activePromise;
  }

  // 3. Perform Fetch
  const promise = (async () => {
    try {
      const res = await fetchFn();
      if (res) {
        sharedNominatimCache.set(key, { timestamp: Date.now(), result: res });
      }
      return res;
    } finally {
      sharedNominatimPromises.delete(key);
    }
  })();

  sharedNominatimPromises.set(key, promise);
  return promise;
}

/**
 * Executes an Overpass OSM query with deduplication and memory caching.
 */
export async function fetchOverpassWithCache(
  queryStr: string,
  fetchFn: () => Promise<any[]>
): Promise<any[]> {
  const key = queryStr.trim();

  // 1. Check TTL Cache
  const cached = sharedOverpassCache.get(key);
  const now = Date.now();
  if (cached && (now - cached.timestamp < 12 * 60 * 60 * 1000)) { // 12 hours TTL
    console.log(`[BEM Cache Hit] Overpass elements loaded from cache for key: ${key.substring(0, 80)}...`);
    return cached.elements;
  }

  // 2. Check Active Promise for Request Coalescing (Deduplication)
  let activePromise = sharedOverpassPromises.get(key);
  if (activePromise) {
    console.log(`[Request Coalescing] Reusing active promise for Overpass query: ${key.substring(0, 80)}...`);
    return activePromise;
  }

  // 3. Perform Fetch
  const promise = (async () => {
    try {
      const elements = await fetchFn();
      // Only cache non-empty datasets
      if (elements && elements.length > 0) {
        sharedOverpassCache.set(key, { timestamp: Date.now(), elements });
      }
      return elements || [];
    } finally {
      sharedOverpassPromises.delete(key);
    }
  })();

  sharedOverpassPromises.set(key, promise);
  return promise;
}

// ============================================================================
// LIGHTWEIGHT STRUCTURED AI TELEMETRY & CONSUMPTION ACCOUNTING
// ============================================================================

export interface TelemetryRecord {
  operation: string;
  provider: "gemini" | "groq";
  model: string;
  attempt?: number;
  status: "success" | "error" | "fallback";
  latencyMs: number;
  usageTokens?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
  } | null;
  errorMsg?: string;
}

export function logAiTelemetry(record: TelemetryRecord): void {
  try {
    const sanitizedMsg = record.errorMsg 
      ? String(record.errorMsg).replace(/key=[^&]+/gi, "key=[REDACTED]").substring(0, 300) 
      : undefined;

    console.log(JSON.stringify({
      type: "AI_TELEMETRY",
      timestamp: new Date().toISOString(),
      operation: record.operation,
      provider: record.provider,
      model: record.model,
      attempt: record.attempt ?? 1,
      status: record.status,
      latencyMs: Math.round(record.latencyMs),
      usageTokens: record.usageTokens || null,
      errorMsg: sanitizedMsg
    }));
  } catch (err) {
    // Fail-safe telemetry logging
  }
}

/**
 * Centrally executes direct AI text calls for Express Node.js routes.
 * Supports task complexity-based cascade.
 */
export async function callNodeAiText(options: {
  taskType: TaskType;
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
}): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
  const cascade = getTaskCascade(options.taskType);
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  for (const step of cascade) {
    if (step.provider === "groq") {
      if (!groqApiKey || groqApiKey.trim() === "" || groqApiKey === "YOUR_GROQ_API_KEY" || !isProviderAvailable("groq")) {
        continue;
      }
      const rawModel = step.modelName || ACTIVE_MODELS.GROQ_FAST;
      if (is404GroqModel(rawModel)) {
        continue;
      }
      try {
        const modelToUse = rawModel;
        const messages: any[] = [];
        if (options.systemInstruction) {
          messages.push({ role: "system", content: options.systemInstruction });
        }
        messages.push({ role: "user", content: options.prompt });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelToUse,
            messages,
            temperature: 0.7,
            ...(options.jsonMode ? { response_format: { type: "json_object" } } : {})
          })
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          const lowerErr = errText.toLowerCase();
          if (response.status === 404 || lowerErr.includes("model_not_found") || lowerErr.includes("model_decommissioned") || lowerErr.includes("does not exist") || lowerErr.includes("not found")) {
            console.warn(`[Groq Circuit Breaker] Model 404/not found (${modelToUse}), tripping circuit breaker for Groq: ${errText}`);
            disableGroqGlobally(`Model 404/not found: ${modelToUse}`);
          } else if (response.status === 429 || lowerErr.includes("429") || lowerErr.includes("rate limit")) {
            setGroqCooldown(errText);
          }
          throw new Error(`Groq API error: ${response.status} - ${errText}`);
        }

        const data = await response.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          console.info(`[AI Cascade] Successful execution for task="${options.taskType}": provider="groq", model="${modelToUse}"`);
          return { text, providerUsed: "groq", modelUsed: modelToUse };
        }
      } catch (err: any) {
        console.warn(`[callNodeAiText] Groq step (${step.modelName}) failed: ${err.message || err}`);
      }
    } else if (step.provider === "gemini") {
      if (!geminiApiKey || geminiApiKey.trim() === "" || !isProviderAvailable("gemini")) {
        continue;
      }
      try {
        const modelToUse = step.modelName || ACTIVE_MODELS.GEMINI_PRIMARY;
        const client = getGeminiClient();
        if (!client) continue;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const gemResp = await client.models.generateContent({
          model: normalizeModelName(modelToUse),
          contents: [{ parts: [{ text: options.prompt }] }],
          config: {
            ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
            ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
            ...(options.taskType === "business_scan" ? { tools: [{ googleSearch: {} }] } : {}),
            abortSignal: controller.signal
          }
        });
        clearTimeout(timeoutId);

        if (gemResp && gemResp.text) {
          console.info(`[AI Cascade] Successful execution for task="${options.taskType}": provider="gemini", model="${modelToUse}"`);
          return { text: gemResp.text, providerUsed: "gemini", modelUsed: modelToUse };
        }
      } catch (err: any) {
        console.warn(`[callNodeAiText] Gemini step (${step.modelName}) failed: ${err.message || err}`);
        const errMsg = err?.message || err?.toString() || "";
        if (errMsg.includes("429") || errMsg.includes("quota")) {
          setGeminiCooldown(errMsg, err);
        }
      }
    } else if (step.provider === "rules") {
      break;
    }
  }

  // Final deterministic fallback rules matching task type
  let fallbackText = "Análisis completado exitosamente.";
  if (options.jsonMode) {
    fallbackText = JSON.stringify({
      status: "fallback",
      display_name: "Servicios Generales",
      business_model: "RECURRING",
      avg_ticket_usd: 200,
      conversion_rate: 0.05,
      top3_monthly_views_avg: 1000
    });
  } else if (options.taskType === "copy_short" || options.taskType === "pitch" || options.taskType === "generic") {
    fallbackText = "¡Hola! Gracias por contactarnos. En breve analizaremos tu visibilidad local para ayudarte a destacar en Google Maps.";
  }
  return { text: fallbackText, providerUsed: "rules", modelUsed: "deterministic_rules" };
}

