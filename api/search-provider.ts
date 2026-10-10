import axios from "axios";
import * as cheerio from "cheerio";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export type ProviderStatus = 
  | 'SUCCESS' 
  | 'EMPTY' 
  | 'RATE_LIMITED' 
  | 'AUTH_ERROR' 
  | 'TIMEOUT' 
  | 'PROVIDER_ERROR' 
  | 'UNAVAILABLE';

export interface UnifiedSearchResponse {
  provider: 'tavily' | 'you' | 'duckduckgo' | 'none';
  status: ProviderStatus;
  results: SearchResultItem[];
  rawText: string;
  query: string;
  timestamp: number;
}

interface CircuitState {
  cooldownUntil: number;
  consecutiveFailures: number;
}

const circuitBreakers: Record<string, CircuitState> = {
  tavily: { cooldownUntil: 0, consecutiveFailures: 0 },
  you: { cooldownUntil: 0, consecutiveFailures: 0 },
  duckduckgo: { cooldownUntil: 0, consecutiveFailures: 0 }
};

const COOLDOWN_DURATION_MS = 5 * 60 * 1000; // 5 minutes on auth/rate-limit

function isCircuitOpen(provider: string): boolean {
  const state = circuitBreakers[provider];
  if (!state) return false;
  return Date.now() < state.cooldownUntil;
}

function triggerCircuit(provider: string, durationMs: number = COOLDOWN_DURATION_MS) {
  if (circuitBreakers[provider]) {
    circuitBreakers[provider].cooldownUntil = Date.now() + durationMs;
    circuitBreakers[provider].consecutiveFailures += 1;
    console.warn(`[CircuitBreaker] Provider '${provider}' cooling down for ${Math.round(durationMs / 1000)}s`);
  }
}

function resetCircuit(provider: string) {
  if (circuitBreakers[provider]) {
    circuitBreakers[provider].cooldownUntil = 0;
    circuitBreakers[provider].consecutiveFailures = 0;
  }
}

const searchCache = new Map<string, UnifiedSearchResponse>();
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Executes a Tavily Web Search (Primary Provider)
 */
async function searchTavily(query: string): Promise<UnifiedSearchResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || isCircuitOpen('tavily')) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        max_results: 5
      }),
      signal: controller.signal
    });

    if (res.status === 401 || res.status === 403) {
      console.warn("[Tavily] Auth error or invalid API key");
      triggerCircuit('tavily', COOLDOWN_DURATION_MS);
      return null;
    }

    if (res.status === 429) {
      console.warn("[Tavily] Rate limit exceeded");
      triggerCircuit('tavily', COOLDOWN_DURATION_MS);
      return null;
    }

    if (!res.ok) {
      console.warn(`[Tavily] Provider error HTTP ${res.status}`);
      triggerCircuit('tavily', 60000);
      return null;
    }

    const data = await res.json() as any;
    resetCircuit('tavily');

    const results: SearchResultItem[] = [];
    if (data && Array.isArray(data.results)) {
      for (const item of data.results) {
        if (item.title || item.content) {
          results.push({
            title: String(item.title || '').trim(),
            url: String(item.url || '').trim(),
            snippet: String(item.content || item.snippet || '').trim(),
            score: typeof item.score === 'number' ? item.score : undefined
          });
        }
      }
    }

    if (results.length === 0) {
      return {
        provider: 'tavily',
        status: 'EMPTY',
        results: [],
        rawText: '',
        query,
        timestamp: Date.now()
      };
    }

    const rawText = results.map(r => `${r.title}\n${r.snippet}`).join('\n\n');
    return {
      provider: 'tavily',
      status: 'SUCCESS',
      results,
      rawText,
      query,
      timestamp: Date.now()
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn("[Tavily] Search request timed out");
      triggerCircuit('tavily', 60000);
    } else {
      console.warn("[Tavily] Request error:", err?.message || err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes a You.com Web Search (Manual / Emergency Invocation Only)
 * Classified as FINITE_ONE_TIME. Strictly EXCLUDED from automatic fallback in executeUnifiedWebSearch().
 * Endpoint: POST https://api.ydc-index.io/v1/search
 * Header: X-API-Key
 */
async function searchYou(query: string): Promise<UnifiedSearchResponse | null> {
  const apiKey = process.env.YDC_API_KEY;
  if (!apiKey || isCircuitOpen('you')) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch("https://api.ydc-index.io/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });

    if (res.status === 401 || res.status === 403) {
      console.warn("[You.com] Auth error or invalid API key");
      triggerCircuit('you', COOLDOWN_DURATION_MS);
      return null;
    }

    if (res.status === 429) {
      console.warn("[You.com] Rate limit exceeded");
      triggerCircuit('you', COOLDOWN_DURATION_MS);
      return null;
    }

    if (!res.ok) {
      console.warn(`[You.com] Provider error HTTP ${res.status}`);
      triggerCircuit('you', 60000);
      return null;
    }

    const data = await res.json() as any;
    resetCircuit('you');

    const results: SearchResultItem[] = [];
    const hits = data?.hits || data?.results || data?.search_results || [];

    if (Array.isArray(hits)) {
      for (const item of hits) {
        const snippetText = Array.isArray(item.snippets) ? item.snippets.join(" ") : (item.snippet || item.description || "");
        if (item.title || snippetText) {
          results.push({
            title: String(item.title || '').trim(),
            url: String(item.url || '').trim(),
            snippet: String(snippetText).trim()
          });
        }
      }
    }

    if (results.length === 0) {
      return {
        provider: 'you',
        status: 'EMPTY',
        results: [],
        rawText: '',
        query,
        timestamp: Date.now()
      };
    }

    const rawText = results.map(r => `${r.title}\n${r.snippet}`).join('\n\n');
    return {
      provider: 'you',
      status: 'SUCCESS',
      results,
      rawText,
      query,
      timestamp: Date.now()
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn("[You.com] Search request timed out");
      triggerCircuit('you', 60000);
    } else {
      console.warn("[You.com] Request error:", err?.message || err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes a DuckDuckGo HTML Search (Tertiary/Fallback Provider)
 */
async function searchDuckDuckGo(query: string): Promise<UnifiedSearchResponse | null> {
  if (isCircuitOpen('duckduckgo')) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const searchQuery = encodeURIComponent(query);
    // Use DuckDuckGo HTML endpoint with fallback to Lite endpoint
    const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;
    const res = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
      },
      signal: controller.signal,
      timeout: 4500,
      validateStatus: (status) => status >= 200 && status < 400 // Accept 200, 202, 301, 302
    });

    const results: SearchResultItem[] = [];
    if (res.data && typeof res.data === "string") {
      const $ = cheerio.load(res.data);
      
      // Parse standard .result elements
      $(".result").each((_, el) => {
        const title = $(el).find(".result__title, .result__a").text()?.trim() || "";
        const snippet = $(el).find(".result__snippet").text()?.trim() || "";
        const url = $(el).find(".result__url, .result__a").attr("href") || $(el).find(".result__url").text()?.trim() || "";
        if (title || snippet) {
          results.push({ title, url, snippet });
        }
      });

      // Also parse lite table layout if returned
      if (results.length === 0) {
        $("tr").each((_, el) => {
          const title = $(el).find(".result-link").text()?.trim() || "";
          const snippet = $(el).find(".result-snippet").text()?.trim() || "";
          const url = $(el).find(".result-link").attr("href") || "";
          if (title || snippet) {
            results.push({ title, url, snippet });
          }
        });
      }
    }

    // If 202 or challenge page resulted in 0 results, check if Lite endpoint can resolve it
    if (results.length === 0 && (res.status === 202 || !res.data || (typeof res.data === "string" && res.data.length < 500))) {
      try {
        const liteRes = await axios.post(`https://lite.duckduckgo.com/lite/`, `q=${searchQuery}`, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          },
          timeout: 3000,
          validateStatus: (status) => status >= 200 && status < 400
        });
        if (liteRes.data && typeof liteRes.data === "string") {
          const $ = cheerio.load(liteRes.data);
          $(".result-link").each((_, el) => {
            const title = $(el).text()?.trim() || "";
            const url = $(el).attr("href") || "";
            const snippet = $(el).closest("tr").next().find(".result-snippet").text()?.trim() || "";
            if (title || snippet) {
              results.push({ title, url, snippet });
            }
          });
        }
      } catch (liteErr) {
        // Silently continue to empty response without throwing loop
      }
    }

    resetCircuit('duckduckgo');

    if (results.length === 0) {
      return {
        provider: 'duckduckgo',
        status: 'EMPTY',
        results: [],
        rawText: typeof res.data === 'string' ? res.data.substring(0, 500) : '',
        query,
        timestamp: Date.now()
      };
    }

    const rawText = results.map(r => `${r.title}\n${r.snippet}`).join('\n\n');
    return {
      provider: 'duckduckgo',
      status: 'SUCCESS',
      results,
      rawText: rawText || (typeof res.data === 'string' ? res.data : ''),
      query,
      timestamp: Date.now()
    };
  } catch (err: any) {
    if (axios.isAxiosError(err) && (err.response?.status === 202 || err.response?.status === 200)) {
      // 202 Accepted is not a network failure; do not punish circuit breaker
      return {
        provider: 'duckduckgo',
        status: 'EMPTY',
        results: [],
        rawText: '',
        query,
        timestamp: Date.now()
      };
    }
    console.warn("[DuckDuckGo] Search warning:", err?.message || err);
    triggerCircuit('duckduckgo', 45000);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Unified Search Runner
 * Executes in strict order:
 * 1. Tavily (Primary) (RENEWABLE_MONTHLY, automatic fallback allowed)
 * 2. DuckDuckGo (Secondary) (Free, HTML-based, safe automatic fallback)
 * 3. Last Resort (UNAVAILABLE / Empty result, never throws)
 * Note: You.com paid API (YDC_API_KEY) is classified as FINITE_ONE_TIME and is EXCLUDED from automatic fallback.
 * You.com free MCP is PLANNED / NOT INTEGRATED.
 */
export async function executeUnifiedWebSearch(query: string): Promise<UnifiedSearchResponse> {
  const cleanQuery = query.trim();
  const cacheKey = cleanQuery.toLowerCase();

  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached;
  }

  // 1. PRIMARY: Tavily
  const tavilyResult = await searchTavily(cleanQuery);
  if (tavilyResult && tavilyResult.status === 'SUCCESS' && tavilyResult.results.length > 0) {
    searchCache.set(cacheKey, tavilyResult);
    return tavilyResult;
  }

  // 2. SECONDARY: DuckDuckGo (Free)
  const ddgResult = await searchDuckDuckGo(cleanQuery);
  if (ddgResult && (ddgResult.status === 'SUCCESS' || ddgResult.results.length > 0)) {
    searchCache.set(cacheKey, ddgResult);
    return ddgResult;
  }

  // 3. LAST RESORT: INSUFFICIENT_DATA / UNAVAILABLE
  const fallbackResponse: UnifiedSearchResponse = {
    provider: 'none',
    status: 'UNAVAILABLE',
    results: [],
    rawText: '',
    query: cleanQuery,
    timestamp: Date.now()
  };

  searchCache.set(cacheKey, fallbackResponse);
  return fallbackResponse;
}
