/**
 * Cloudflare-native Gemini & Groq AI proxy handler.
 * Multi-stage resilience layer: Groq FAST -> Gemini PRIMARY -> Gemini FAST
 * 
 * CIRCUIT BREAKER & ISOLATION ARCHITECTURE NOTE (Cloudflare Workers):
 * In Cloudflare Workers/Pages Functions, global variable state (e.g. geminiCooldownUntil) is retained 
 * per worker isolate. Different edge locations or concurrent isolates operate independently.
 * 
 * SHARED CIRCUIT BREAKER IMPLEMENTATION CHOICE: Cloudflare KV vs Durable Objects (DO)
 * 1. Why KV was selected:
 *    - KV is extremely lightweight, requires zero additional pricing plan upgrades, and does not need
 *      wrangler migration tables or active schema alterations.
 *    - Eventual consistency is perfectly fine for rate limit and circuit breaker protection: if an isolate
 *      gets rate-limited, it propagates the cooldown globally via KV with a minimum 60s TTL.
 *    - Ultra-fast responses: Local in-memory caches are updated immediately when a KV flag is retrieved,
 *      ensuring subsequents requests within the same isolate have 0ms lookup latency.
 * 
 * 2. Limitations of KV over Durable Objects:
 *    - Eventual Consistency: KV writes can take up to 60 seconds to propagate globally to all locations.
 *      This means concurrent isolates in different continents might make a few redundant requests before
 *      knowing a cooldown is active. DOs are strongly consistent and prevent this instantly.
 *    - Lack of Atomic Locks: KV does not support locking or compare-and-swap operations for complex locks.
 *      For Bvelt's circuit breaker, simple TTL expirations on "circuit:gemini" and "circuit:groq" are 100%
 *      sufficient and atomic enough.
 * 
 * In 1.5c, this KV shared circuit breaker gracefully prevents hammering Gemini/Groq worldwide, falling back
 * perfectly to in-memory isolation if no KV namespaces are bound to the worker context.
 */

import { ACTIVE_MODELS, getTaskCascade, TaskType, is404GroqModel } from "../../api/ai-config.js";

export { ACTIVE_MODELS };

// In-memory circuit breaker state (per isolate) for ultra-fast checks
let geminiCooldownUntil = 0;
let groqCooldownUntil = 0;

// Shared KV Keys
const KV_KEY_GEMINI = "circuit:gemini";
const KV_KEY_GROQ = "circuit:groq";

function getKVNamespace(env: any) {
  if (env) {
    if (env.CIRCUIT_BREAKER_KV && typeof env.CIRCUIT_BREAKER_KV.get === "function") return env.CIRCUIT_BREAKER_KV;
    if (env.RATE_LIMIT_KV && typeof env.RATE_LIMIT_KV.get === "function") return env.RATE_LIMIT_KV;
    if (env.SCAN_CACHE_KV && typeof env.SCAN_CACHE_KV.get === "function") return env.SCAN_CACHE_KV;
  }
  return null;
}

export function isGeminiInCooldown(): boolean {
  return Date.now() < geminiCooldownUntil;
}

export function isGroqInCooldown(): boolean {
  return Date.now() < groqCooldownUntil;
}

export function triggerGeminiCooldown(seconds: number = 60) {
  geminiCooldownUntil = Date.now() + (seconds * 1000);
}

export function triggerGroqCooldown(seconds: number = 60) {
  groqCooldownUntil = Date.now() + (seconds * 1000);
}

export async function isGeminiInCooldownShared(env: any): Promise<boolean> {
  // 1. Check local isolate memory state (instant)
  if (Date.now() < geminiCooldownUntil) return true;

  // 2. Check KV for global/isolate synchronization
  const kv = getKVNamespace(env);
  if (kv) {
    try {
      const val = await kv.get(KV_KEY_GEMINI);
      if (val) {
        const until = parseInt(val, 10);
        if (Date.now() < until) {
          // Sync local state to avoid hitting KV on subsequent requests in the same isolate
          geminiCooldownUntil = Math.max(geminiCooldownUntil, until);
          return true;
        }
      }
    } catch (e) {
      console.warn("[CircuitBreaker] KV Gemini check failed, falling back to memory:", e);
    }
  }
  return false;
}

export async function isGroqInCooldownShared(env: any): Promise<boolean> {
  // 1. Check local isolate memory state (instant)
  if (Date.now() < groqCooldownUntil) return true;

  // 2. Check KV for global/isolate synchronization
  const kv = getKVNamespace(env);
  if (kv) {
    try {
      const val = await kv.get(KV_KEY_GROQ);
      if (val) {
        const until = parseInt(val, 10);
        if (Date.now() < until) {
          // Sync local state
          groqCooldownUntil = Math.max(groqCooldownUntil, until);
          return true;
        }
      }
    } catch (e) {
      console.warn("[CircuitBreaker] KV Groq check failed, falling back to memory:", e);
    }
  }
  return false;
}

export async function triggerGeminiCooldownShared(env: any, seconds: number = 60): Promise<void> {
  const until = Date.now() + (seconds * 1000);
  geminiCooldownUntil = Math.max(geminiCooldownUntil, until);

  const kv = getKVNamespace(env);
  if (kv) {
    try {
      await kv.put(KV_KEY_GEMINI, String(until), { expirationTtl: Math.max(60, seconds) });
      console.log(`[CircuitBreaker] KV Gemini cooldown set until ${until}`);
    } catch (e) {
      console.warn("[CircuitBreaker] KV Gemini write failed:", e);
    }
  }
}

export async function triggerGroqCooldownShared(env: any, seconds: number = 60): Promise<void> {
  const until = Date.now() + (seconds * 1000);
  groqCooldownUntil = Math.max(groqCooldownUntil, until);

  const kv = getKVNamespace(env);
  if (kv) {
    try {
      await kv.put(KV_KEY_GROQ, String(until), { expirationTtl: Math.max(60, seconds) });
      console.log(`[CircuitBreaker] KV Groq cooldown set until ${until}`);
    } catch (e) {
      console.warn("[CircuitBreaker] KV Groq write failed:", e);
    }
  }
}

function getTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function extractPromptText(body: any): string {
  if (typeof body?.prompt === "string" && body.prompt.trim()) {
    return body.prompt;
  }
  if (Array.isArray(body?.contents)) {
    const partsText: string[] = [];
    for (const c of body.contents) {
      if (typeof c === "string") {
        partsText.push(c);
      } else if (c?.parts && Array.isArray(c.parts)) {
        for (const p of c.parts) {
          if (typeof p === "string") partsText.push(p);
          else if (p?.text) partsText.push(p.text);
        }
      }
    }
    if (partsText.length > 0) return partsText.join("\n");
  }
  return "";
}

/**
 * Helper to call Groq API directly on Cloudflare Edge with 8s timeout
 */
async function tryGroqApi(
  env: any,
  promptText: string,
  systemInstruction?: string,
  modelName: string = ACTIVE_MODELS.GROQ_FAST
): Promise<string> {
  if (await isGroqInCooldownShared(env)) {
    throw new Error("Groq API is in temporary circuit breaker cooldown.");
  }

  const apiKey = env.GROQ_API_KEY || "";
  if (!apiKey || !apiKey.trim()) {
    throw new Error("GROQ_API_KEY is not configured on server.");
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: promptText });

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.7
    }),
    signal: getTimeoutSignal(8000)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const lowerErr = errText.toLowerCase();
    if (resp.status === 404 || lowerErr.includes("model_not_found") || lowerErr.includes("model_decommissioned") || lowerErr.includes("does not exist") || lowerErr.includes("not found")) {
      console.warn(`[CircuitBreaker] Groq 404 on ${modelName}, triggering cooldown and tripping circuit: ${errText}`);
      await triggerGroqCooldownShared(env, 300);
    } else if (resp.status === 429 || lowerErr.includes("429") || lowerErr.includes("rate limit") || lowerErr.includes("resource_exhausted")) {
      await triggerGroqCooldownShared(env, 60);
    }
    throw new Error(`Groq API error (${modelName}, status ${resp.status}): ${errText}`);
  }

  const data = (await resp.json()) as any;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Groq API (${modelName}) returned an empty response.`);
  }
  return text;
}

/**
 * Helper to call Gemini API directly on Cloudflare Edge with 8s timeout
 */
async function tryGeminiApi(
  env: any,
  apiKey: string,
  modelName: string,
  promptText: string,
  systemInstruction?: string,
  image?: string,
  rawContents?: any
): Promise<string> {
  if (await isGeminiInCooldownShared(env)) {
    throw new Error("Gemini API is in temporary circuit breaker cooldown due to prior 429 rate limits.");
  }

  if (!apiKey || !apiKey.trim()) {
    throw new Error("GEMINI_API_KEY is not configured on server.");
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;

  let contents: any[] = [];
  if (rawContents && Array.isArray(rawContents) && rawContents.length > 0) {
    contents = rawContents;
  } else if (image) {
    let mimeType = "image/jpeg";
    let base64Data = image;
    if (image.startsWith("data:")) {
      const parts = image.split(";base64,");
      mimeType = parts[0].replace("data:", "");
      base64Data = parts[1] || "";
    }
    contents = [
      {
        role: "user",
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]
      }
    ];
  } else {
    contents = [
      {
        role: "user",
        parts: [{ text: promptText }]
      }
    ];
  }

  const reqBody: any = { contents };
  if (systemInstruction) {
    reqBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
    signal: getTimeoutSignal(8000)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429 || errText.includes("429") || errText.includes("RESOURCE_EXHAUSTED") || errText.includes("Quota exceeded") || errText.includes("rate limit")) {
      await triggerGeminiCooldownShared(env, 60);
    }
    throw new Error(`Gemini API error (${modelName}, status ${resp.status}): ${errText}`);
  }

  const data = (await resp.json()) as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini API (${modelName}) returned an empty response.`);
  }
  return text;
}

/**
 * Central Cloudflare AI execution runner adhering to task complexity cascades.
 */
export async function callCloudflareAiText(options: {
  env: any;
  prompt: string;
  systemInstruction?: string;
  taskType?: TaskType;
  image?: string;
  contents?: any;
  clientKey?: string;
}): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
  const taskType: TaskType = options.taskType || "generic";
  const cascade = getTaskCascade(taskType);

  const customKey = options.clientKey;
  const geminiKey = (customKey && typeof customKey === "string" && customKey.trim())
    ? customKey.trim()
    : (options.env?.GEMINI_API_KEY || "");

  const groqKey = options.env?.GROQ_API_KEY || "";

  for (const step of cascade) {
    if (step.provider === "groq") {
      if (!groqKey || groqKey.trim() === "" || groqKey === "YOUR_GROQ_API_KEY" || (await isGroqInCooldownShared(options.env))) {
        continue;
      }
      const rawModel = step.modelName || ACTIVE_MODELS.GROQ_FAST;
      if (is404GroqModel(rawModel)) {
        continue;
      }
      try {
        const modelToUse = rawModel;
        const text = await tryGroqApi(options.env, options.prompt, options.systemInstruction, modelToUse);
        console.info(`[AI Cascade Cloudflare] Successful execution task="${taskType}": provider="groq", model="${modelToUse}"`);
        return { text, providerUsed: "groq", modelUsed: modelToUse };
      } catch (groqErr: any) {
        console.warn(`[callCloudflareAiText] Groq step (${step.modelName}) failed: ${groqErr.message || groqErr}`);
      }
    } else if (step.provider === "gemini") {
      if (!geminiKey || geminiKey.trim() === "" || (await isGeminiInCooldownShared(options.env))) {
        continue;
      }
      try {
        const modelToUse = step.modelName || ACTIVE_MODELS.GEMINI_PRIMARY;
        const text = await tryGeminiApi(options.env, geminiKey, modelToUse, options.prompt, options.systemInstruction, options.image, options.contents);
        console.info(`[AI Cascade Cloudflare] Successful execution task="${taskType}": provider="gemini", model="${modelToUse}"`);
        return { text, providerUsed: "gemini", modelUsed: modelToUse };
      } catch (geminiErr: any) {
        console.warn(`[callCloudflareAiText] Gemini step (${step.modelName}) failed: ${geminiErr.message || geminiErr}`);
      }
    } else if (step.provider === "rules") {
      break;
    }
  }

  const defaultText = getFallbackRulesTemplate(taskType, options.prompt, options.systemInstruction);
  console.info(`[AI Cascade Cloudflare] Fallback rules executed task="${taskType}": provider="rules", model="deterministic_rules"`);
  return { text: defaultText, providerUsed: "rules", modelUsed: "deterministic_rules" };
}

/**
 * Helper to call Gemini API directly on Cloudflare Edge with text response
 */
export async function callGeminiApi(
  env: any,
  prompt: string,
  systemInstruction?: string,
  modelNameOrTaskType: string = ACTIVE_MODELS.GEMINI_PRIMARY
): Promise<string> {
  let taskType: TaskType = "generic";
  if (modelNameOrTaskType) {
    if (["copy_short", "pitch", "rank_actions", "diagnosis_rewrite", "scan_summary", "business_scan", "audit", "ai_visibility", "niche_benchmark", "generic"].includes(modelNameOrTaskType)) {
      taskType = modelNameOrTaskType as TaskType;
    } else if (systemInstruction?.toLowerCase().includes("visibilidad") || systemInstruction?.toLowerCase().includes("visibility")) {
      taskType = "ai_visibility";
    } else if (systemInstruction?.toLowerCase().includes("audit") || systemInstruction?.toLowerCase().includes("intelligence")) {
      taskType = "audit";
    } else if (systemInstruction?.toLowerCase().includes("scan")) {
      taskType = "business_scan";
    } else if (systemInstruction?.toLowerCase().includes("pitch") || systemInstruction?.toLowerCase().includes("prospección")) {
      taskType = "pitch";
    }
  }
  const result = await callCloudflareAiText({ env, prompt, systemInstruction, taskType });
  return result.text;
}

function getFallbackRulesTemplate(taskType: string, promptText: string, systemInstruction?: string): string {
  // Deterministic rule-based template fallback. Never throws.
  if (taskType === "copy_short" || taskType === "pitch" || taskType === "generic") {
    return "¡Hola! Gracias por contactarnos. En breve analizaremos tu visibilidad local para ayudarte a destacar en Google Maps.";
  }
  return "Análisis de visibilidad local completado exitosamente de acuerdo con las reglas locales del negocio.";
}

export async function handleGeminiGenerate(request: Request, env: any): Promise<Response> {
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const { systemInstruction, image, contents } = body;
    const promptText = extractPromptText(body);
    const taskType: TaskType = body.taskType || "generic";
    const customKey = request.headers.get("x-gemini-api-key") || body.clientKey;

    const result = await callCloudflareAiText({
      env,
      prompt: promptText,
      systemInstruction,
      taskType,
      image,
      contents,
      clientKey: customKey
    });

    return new Response(JSON.stringify({ text: result.text, providerUsed: result.providerUsed, modelUsed: result.modelUsed }), {
      status: 200,
      headers: jsonHeaders
    });

  } catch (err: any) {
    console.warn(`[handleGeminiGenerate] Unexpected error: ${err.message || String(err)}`);
    return new Response(JSON.stringify({
      error: "Service unavailable",
      message: "Alta demanda en el servicio de IA. Inténtalo de nuevo en un par de minutos.",
      text: "Alta demanda en el servicio de IA. Inténtalo de nuevo en un par de minutos."
    }), {
      status: 429,
      headers: jsonHeaders
    });
  }
}
