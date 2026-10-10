/**
 * Third-Party API Health Check Diagnostic Service
 * READ-ONLY checks for Gemini, Groq, Geoapify, LocationIQ, OpenCage, OpenRouteService, Tavily, Stripe, and Resend.
 */

import { is404GroqModel } from "./ai-config.ts";

export interface ProviderHealthResult {
  name: string;
  status: 'ok' | 'fail' | 'missing_key' | 'timeout';
  ms: number;
  statusCode?: number | null;
  detail: string;
}

export interface HealthResponse {
  ok: boolean;
  checkedAt: string;
  providers: ProviderHealthResult[];
}

function sanitizeError(err: any): string {
  if (!err) return 'Unknown error';
  const msg = typeof err === 'string' ? err : err.message || String(err);
  return msg
    .replace(/(key=)[A-Za-z0-9_-]{15,}/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9_-]{15,}/gi, '$1[REDACTED]')
    .replace(/gsk_[A-Za-z0-9_-]{20,}/gi, '[REDACTED_GROQ_KEY]')
    .replace(/AIzaSy[A-Za-z0-9_-]{33}/gi, '[REDACTED_GEMINI_KEY]')
    .replace(/sk_[live|test]_[A-Za-z0-9_-]{20,}/gi, '[REDACTED_STRIPE_KEY]')
    .replace(/re_[A-Za-z0-9_-]{20,}/gi, '[REDACTED_RESEND_KEY]')
    .slice(0, 200);
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkHealthProviders(env?: Record<string, any>): Promise<HealthResponse> {
  const getEnv = (key: string): string => {
    if (env && Object.prototype.hasOwnProperty.call(env, key)) {
      return env[key] || '';
    }
    return (env && env[key]) || (typeof process !== 'undefined' && process?.env && process.env[key]) || '';
  };

  const tasks: Promise<ProviderHealthResult>[] = [
    // 1. GEMINI
    (async (): Promise<ProviderHealthResult> => {
      const name = 'gemini';
      const key = getEnv('GEMINI_API_KEY') || getEnv('VITE_GEMINI_API_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'GEMINI_API_KEY missing' };

      const start = Date.now();
      try {
        const model = 'gemini-3.8-flash';
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
          },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'Gemini 3.8 Flash responsive' };
        } else {
          const body: any = await res.json().catch(() => ({}));
          const errDetail = body?.error?.message ? sanitizeError(body.error.message) : `HTTP ${res.status}`;
          return { name, status: 'fail', ms, statusCode: res.status, detail: errDetail };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 2. GROQ (Optional secondary AI provider)
    (async (): Promise<ProviderHealthResult> => {
      const name = 'groq';
      const key = getEnv('GROQ_API_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'GROQ_API_KEY missing (optional, Gemini-first active)' };

      const rawModel = getEnv('GROQ_MODEL');
      if (!rawModel || is404GroqModel(rawModel)) {
        return { name, status: 'fail', ms: 0, statusCode: null, detail: rawModel ? `Groq model invalid or decommissioned: ${rawModel}` : 'GROQ_MODEL not configured (app running Gemini-first)' };
      }

      const model = rawModel;
      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 5
            })
          },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: `Groq chat ok (${model})` };
        } else {
          const body: any = await res.json().catch(() => ({}));
          const errMsg = body?.error?.message || '';
          const errCode = body?.error?.code || '';
          if (errCode === 'model_not_found' || errMsg.toLowerCase().includes('model') && (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('decommissioned'))) {
            return { name, status: 'fail', ms, statusCode: res.status, detail: `Model not found: ${model}` };
          }
          return { name, status: 'fail', ms, statusCode: res.status, detail: sanitizeError(errMsg || `HTTP ${res.status}`) };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 3. GEOAPIFY
    (async (): Promise<ProviderHealthResult> => {
      const name = 'geoapify';
      const key = getEnv('GEOAPIFY_API_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'GEOAPIFY_API_KEY missing' };

      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          `https://api.geoapify.com/v1/geocode/search?text=Naples+FL&apiKey=${key}&limit=1`,
          { method: 'GET' },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'Geocoded Naples FL successfully' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}: ${res.statusText}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 4. LOCATIONIQ
    (async (): Promise<ProviderHealthResult> => {
      const name = 'locationiq';
      const key = getEnv('LOCATIONIQ_API_KEY') || getEnv('LOCATIONIQ_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'LOCATIONIQ_API_KEY missing' };

      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          `https://us1.locationiq.com/v1/search.php?key=${key}&q=Naples+FL&format=json&limit=1`,
          { method: 'GET' },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'LocationIQ search ok' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 5. OPENCAGE
    (async (): Promise<ProviderHealthResult> => {
      const name = 'opencage';
      const key = getEnv('OPENCAGE_API_KEY') || getEnv('OPENCAGE_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'OPENCAGE_API_KEY missing' };

      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          `https://api.opencagedata.com/geocode/v1/json?q=Naples+FL&key=${key}&limit=1`,
          { method: 'GET' },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'OpenCage geocode ok' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 6. OPENROUTESERVICE
    (async (): Promise<ProviderHealthResult> => {
      const name = 'openrouteservice';
      const key = getEnv('OPENROUTESERVICE_API_KEY') || getEnv('OPENROUTE_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'OPENROUTESERVICE_API_KEY missing' };

      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          `https://api.openrouteservice.org/geocode/search?api_key=${key}&text=Naples+FL&size=1`,
          { method: 'GET' },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'OpenRouteService geocode ok' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 7. OVERPASS
    (async (): Promise<ProviderHealthResult> => {
      const name = 'overpass';
      const start = Date.now();
      try {
        const overpassQuery = '[out:json][timeout:5];node(around:500,26.142,-81.794);out 1;';
        const res = await fetchWithTimeout(
          'https://overpass-api.de/api/interpreter',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(overpassQuery)}`
          },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'Overpass OSM interpreter responsive' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 8. TAVILY
    (async (): Promise<ProviderHealthResult> => {
      const name = 'tavily';
      const key = getEnv('TAVILY_API_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'TAVILY_API_KEY missing' };

      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          'https://api.tavily.com/search',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key, query: 'Naples FL', max_results: 1 })
          },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'Tavily search ok' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 9. STRIPE
    (async (): Promise<ProviderHealthResult> => {
      const name = 'stripe';
      const key = getEnv('STRIPE_SECRET_KEY') || getEnv('STRIPE_PROD_SECRET_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'STRIPE_SECRET_KEY missing' };

      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          'https://api.stripe.com/v1/prices?limit=1',
          {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
          },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'Stripe prices listed successfully' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })(),

    // 10. RESEND
    (async (): Promise<ProviderHealthResult> => {
      const name = 'resend';
      const key = getEnv('RESEND_API_KEY');
      if (!key) return { name, status: 'missing_key', ms: 0, statusCode: null, detail: 'RESEND_API_KEY missing' };

      const start = Date.now();
      try {
        const res = await fetchWithTimeout(
          'https://api.resend.com/api-keys',
          {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
          },
          8000
        );
        const ms = Date.now() - start;
        if (res.ok || res.status === 201) {
          return { name, status: 'ok', ms, statusCode: res.status, detail: 'Resend API ok' };
        } else {
          return { name, status: 'fail', ms, statusCode: res.status, detail: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { name, status: 'timeout', ms, statusCode: null, detail: 'Request timed out after 8s' };
        }
        return { name, status: 'fail', ms, statusCode: null, detail: sanitizeError(err) };
      }
    })()
  ];

  const results = await Promise.all(tasks);
  // Gemini is the critical primary AI provider; Groq missing/fail does not break overall system health
  const isAllOk = !results.some(r => r.name === 'gemini' && (r.status === 'fail' || r.status === 'timeout'));

  return {
    ok: isAllOk,
    checkedAt: new Date().toISOString(),
    providers: results
  };
}
