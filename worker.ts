/**
 * Cloudflare Workers Master Entrypoint for Bvelt
 *
 * Handles:
 * 1. Static Asset Serving (Vite build output from 'dist' directory via env.ASSETS with SPA routing)
 * 2. Edge API Routes (/api/*) compatible with Cloudflare Workers runtime
 * 3. Stripe Webhooks (/api/stripe-webhook, /stripe-webhook)
 * 4. AI Engine Proxies (Gemini, Groq) using server-side environment secrets
 * 5. Geolocation and Nominatim OSM proxy
 * 6. Automated Outreach & Email via Resend REST API
 * 7. Google OAuth & Business Profile (GMB) Edge Integration
 * 8. Audio Generation via Gemini Modality.AUDIO
 * 9. Meta WhatsApp Cloud API Integration
 * 10. Machine-Readable BEM Evidence API (/api/business/:id/*)
 * 11. AI Visibility & Local Presence Audit
 */

import { handleCreateCheckoutSession, handleVerifySession, handleStripeWebhook } from "./functions/lib/cloudflareStripe.js";
import { handleNominatim } from "./functions/lib/cloudflareNominatim.js";
import { handleGeminiGenerate } from "./functions/lib/cloudflareGemini.js";
import { handleBatchOutreachCloudflare } from "./functions/lib/cloudflareOutreach.js";
import { handleEvidenceApi } from "./functions/lib/cloudflareEvidence.js";
import {
  handleGoogleAuth,
  handleGoogleCallback,
  handleGoogleConfigStatus,
  handleGmbLocations,
  handleGmbReviews,
  handleGmbReply,
  handleGmbPerformance
} from "./functions/lib/cloudflareGmb.js";
import { handleGenerarAudio } from "./functions/lib/cloudflareAudio.js";
import { handleSendWhatsApp } from "./functions/lib/cloudflareWhatsApp.js";
import { 
  handleWhatsAppWebhook, 
  handleTelegramWebhook, 
  handleDispatchOutbound, 
  handleEvidenceFromMessage 
} from "./functions/lib/cloudflareMessaging.js";
import { handleAiRouter, handleGenerateLeadPitch } from "./functions/lib/cloudflareAiRouter.js";
import { handleAudit } from "./functions/lib/cloudflareAudit.js";
import { handleBusinessScan, handleScanMaps } from "./functions/lib/cloudflareScan.js";
import { handleAiVisibilityAudit, handleGetAiVisibility } from "./functions/lib/cloudflareAiVisibility.js";
import { handleCloudflarePlanUsage } from "./functions/lib/cloudflarePlanUsage.js";
import { updateFirestoreUserProfile, verifyFirebaseIdToken } from "./functions/lib/cloudflareFirestore.js";
import { checkRateLimit, createRateLimitResponse } from "./functions/lib/rateLimiter.js";
import { handleCreateUsdtOrder, handleVerifyUsdtPayment, handleGetUsdtOrderStatus } from "./functions/lib/cloudflareUsdt.js";
import { ACTIVE_MODELS } from "./api/ai-config.js";
import { checkHealthProviders } from "./api/healthProviders.js";

/**
 * CLOUDFLARE WORKER MANDATORY STRIPE ENVIRONMENT VARIABLES:
 * 1) STRIPE_SECRET_KEY: Live restricted or secret key (rk_live_... / sk_live_...) for session verification & checkout.
 * 2) STRIPE_WEBHOOK_SECRET: Webhook signing secret (whsec_...) for verifying incoming stripe-webhook events.
 * 3) STRIPE_PROD_PRICE_MONTHLY: Stripe Price ID (price_...) or Product ID (prod_...) for the $49/mo Pro plan.
 * 4) STRIPE_PROD_PRICE_ANNUAL: Stripe Price ID (price_...) or Product ID (prod_...) for the $390/yr VIP Annual plan.
 * 5) FIREBASE_SERVICE_ACCOUNT: JSON string of Google service account credentials for updating Firestore user profiles.
 */
export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  CACHE?: any;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PROD_PRICE_MONTHLY?: string;
  STRIPE_PROD_PRICE_ANNUAL?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  FIREBASE_PROJECT_ID?: string;
  CRON_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  RESEND_API_KEY?: string;
  GEOAPIFY_API_KEY?: string;
  LOCATIONIQ_API_KEY?: string;
  OPENCAGE_API_KEY?: string;
  OPENROUTESERVICE_API_KEY?: string;
  TAVILY_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  APP_URL?: string;
  SENTRY_DSN?: string;
  USDT_BEP20_RECEIVING_ADDRESS?: string;
  BSC_RPC_URL?: string;
  BSCSCAN_API_KEY?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, stripe-signature, x-gemini-api-key, x-cron-secret, x-hub-signature-256, x-telegram-bot-api-secret-token",
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Edge-compatible Groq AI handler with automatic Gemini fallback
 */
async function handleGroqAi(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const { prompt, systemInstruction } = body;
    const groqKey = env.GROQ_API_KEY;

    if (groqKey && groqKey.trim() !== "" && groqKey !== "YOUR_GROQ_API_KEY") {
      try {
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: ACTIVE_MODELS.GROQ_FAST,
            messages: [
              { role: "system", content: systemInstruction || "You are a professional business copywriter." },
              { role: "user", content: prompt || "" },
            ],
            temperature: 0.7,
            max_tokens: 400,
          }),
        });

        if (groqResp.ok) {
          const data = (await groqResp.json()) as any;
          const text = data.choices?.[0]?.message?.content || "";
          return jsonResponse({ text });
        }
      } catch (e) {
        console.warn("[Cloudflare Worker] Groq request failed, falling back to Gemini:", e);
      }
    }

    // Fallback to Gemini
    return handleGeminiGenerate(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ prompt, systemInstruction, model: ACTIVE_MODELS.GEMINI_PRIMARY }),
      }),
      env
    );
  } catch (err: any) {
    return jsonResponse({ error: "AI Handler Error", details: err.message || String(err) }, 500);
  }
}

/**
 * Edge-compatible Email sender using Resend REST API
 */
async function handleSendEmail(request: Request, env: Env): Promise<Response> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "RESEND_API_KEY no configurada en Cloudflare" }, 500);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const { to, subject, html, text, from } = body;

    if (!to || (!html && !text)) {
      return jsonResponse({ error: "Parámetros 'to' y 'html'/'text' son requeridos" }, 400);
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from || env.RESEND_FROM_EMAIL || "Bvelt <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject: subject || "Notificación de Bvelt",
        html: html || undefined,
        text: text || undefined,
      }),
    });

    const data = await resendResp.json();
    return jsonResponse(data, resendResp.status);
  } catch (err: any) {
    return jsonResponse({ error: "Error enviando email", details: err.message || String(err) }, 500);
  }
}

/**
 * Enviar resumen semanal "Tu semana en Bvelt" los lunes vía Resend
 */
async function handleWeeklySummaryEmails(request: Request, env: Env): Promise<Response> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "RESEND_API_KEY no configurada en Cloudflare" }, 500);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const { clients, email, name, newJobs = 0, preparedMessages = 0, recoveredAmount = 0 } = body;

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((now.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
    const weekKey = `w_${now.getFullYear()}_${weekNum}`;

    const clientList = Array.isArray(clients) && clients.length > 0
      ? clients
      : (email ? [{ email, name: name || 'Cliente', newJobs, preparedMessages, recoveredAmount }] : []);

    if (clientList.length === 0) {
      return jsonResponse({ message: "No active clients to process for weekly summary", processed: 0 });
    }

    const results = [];

    for (const c of clientList) {
      if (!c.email) continue;
      const dedupeKey = `weekly_summary_sent:${c.email}:${weekKey}`;

      if (env.CACHE) {
        const alreadySent = await env.CACHE.get(dedupeKey);
        if (alreadySent) {
          results.push({ email: c.email, status: 'skipped_already_sent' });
          continue;
        }
      }

      const totalActivity = (c.newJobs || 0) + (c.preparedMessages || 0) + (c.recoveredAmount || 0);
      const subject = "Tu semana en Bvelt";
      let htmlContent = '';
      let textContent = '';

      if (totalActivity === 0) {
        textContent = `Hola ${c.name || ''},\n\nEsta semana no hubo actividad; ¿cargamos tus presupuestos?\n\nEntra a Bvelt: https://bvelt.app/?tab=leads\n\nBvelt te costó $49 este mes`;
        htmlContent = `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
            <h2 style="color: #6366f1; margin-bottom: 16px;">Tu semana en Bvelt</h2>
            <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">Esta semana no hubo actividad; ¿cargamos tus presupuestos?</p>
            <div style="margin: 28px 0;">
              <a href="https://bvelt.app/?tab=leads" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-weight: bold; text-decoration: none; font-size: 14px;">Cargar mis presupuestos</a>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px;">Bvelt te costó $49 este mes</p>
          </div>
        `;
      } else {
        textContent = `Hola ${c.name || ''},\n\nTu semana en Bvelt:\n- Trabajos nuevos: ${c.newJobs || 0}\n- Mensajes preparados: ${c.preparedMessages || 0}\n- Recuperado: $${c.recoveredAmount || 0}\n\nBvelt te costó $49 este mes\n\nEntra a Bvelt: https://bvelt.app`;
        htmlContent = `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
            <h2 style="color: #6366f1; margin-bottom: 16px;">Tu semana en Bvelt</h2>
            <div style="background: #1e293b; padding: 16px; border-radius: 12px; margin: 16px 0;">
              <p style="margin: 8px 0; font-size: 14px;"><strong>Trabajos nuevos:</strong> ${c.newJobs || 0}</p>
              <p style="margin: 8px 0; font-size: 14px;"><strong>Mensajes preparados:</strong> ${c.preparedMessages || 0}</p>
              <p style="margin: 8px 0; font-size: 14px; color: #10b981;"><strong>Recuperado:</strong> $${c.recoveredAmount || 0}</p>
            </div>
            <p style="font-size: 14px; font-weight: bold; color: #94a3b8; margin: 20px 0;">Bvelt te costó $49 este mes</p>
            <div style="margin: 24px 0;">
              <a href="https://bvelt.app" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-weight: bold; text-decoration: none; font-size: 14px;">Ir al Panel de Bvelt</a>
            </div>
          </div>
        `;
      }

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL || "Bvelt <onboarding@resend.dev>",
          to: [c.email],
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (resendResp.ok) {
        if (env.CACHE) {
          await env.CACHE.put(dedupeKey, new Date().toISOString(), { expirationTtl: 14 * 86400 });
        }
        results.push({ email: c.email, status: 'sent' });
      } else {
        const errJson = await resendResp.json().catch(() => ({}));
        results.push({ email: c.email, status: 'error', details: errJson });
      }
    }

    return jsonResponse({ status: "ok", week: weekKey, results });
  } catch (err: any) {
    return jsonResponse({ error: "Error en resumen semanal", details: err.message || String(err) }, 500);
  }
}

/**
 * Edge-compatible Pro Trial Activation
 */
async function handleActivateTrial(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!idToken) {
      return jsonResponse({ error: "No autorizado. Token de autenticación ausente." }, 401);
    }

    const verifiedUid = await verifyFirebaseIdToken(env, idToken);
    if (!verifiedUid) {
      return jsonResponse({ error: "Token de autenticación inválido o expirado." }, 401);
    }

    // Check if user has already used trial via Firestore REST API point read
    let projectId = "localflowpro-20e3d";
    const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
    if (credsStr) {
      try {
        const parsed = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
        if (parsed.project_id) projectId = parsed.project_id;
      } catch {}
    }

    const profileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/profiles/${verifiedUid}`;
    const profileResp = await fetch(profileUrl);
    if (profileResp.ok) {
      const profileDoc = await profileResp.json() as any;
      const fields = profileDoc.fields || {};
      if (fields.hasUsedTrial?.booleanValue === true) {
        return jsonResponse({ error: "Ya has utilizado tu período de prueba de 7 días." }, 400);
      }
    }

    // Update firestore profile
    const success = await updateFirestoreUserProfile(env, verifiedUid, {
      isPro: true,
      plan: "trial",
      stripeCustomerId: "",
      subscriptionStatus: "trialing",
      hasUsedTrial: true,
    });

    if (success) {
      return jsonResponse({ success: true, message: "Prueba Pro activada con éxito." });
    }
    return jsonResponse({ error: "No se pudo actualizar el perfil en Firestore" }, 500);
  } catch (err: any) {
    return jsonResponse({ error: "Error activando prueba", details: err.message || String(err) }, 500);
  }
}

/**
 * Edge-compatible Niche Benchmark calculator (Returns UNAVAILABLE when real empirical data is absent)
 */
function handleNicheBenchmark(request: Request): Response {
  return jsonResponse({
    status: "UNAVAILABLE",
    data: null,
    message: "No empirical benchmark database available for this query. Synthetic benchmarks are prohibited by the Trust Layer."
  });
}

/**
 * Edge-compatible Service Area / Isochrone calculation (OpenRouteService + Geometric Fallback)
 */
async function handleServiceArea(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get("lat") || "");
    const lng = parseFloat(url.searchParams.get("lng") || "");
    const rawIntervals = url.searchParams.get("intervals") || "15,30";
    const intervals = rawIntervals.split(",").map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x) && x > 0);

    if (isNaN(lat) || isNaN(lng)) {
      return jsonResponse({ error: "Valid 'lat' and 'lng' parameters are required" }, 400);
    }

    const intervalsMinutes = intervals.length > 0 ? intervals : [15, 30];
    const orsKey = env.OPENROUTESERVICE_API_KEY;

    if (orsKey && orsKey.trim() !== "") {
      try {
        const rangeSeconds = intervalsMinutes.map(m => m * 60);
        const orsUrl = "https://api.openrouteservice.org/v2/isochrones/driving-car";
        const orsRes = await fetch(orsUrl, {
          method: "POST",
          headers: {
            "Authorization": orsKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            locations: [[lng, lat]],
            range: rangeSeconds,
            range_type: "time",
            units: "km"
          })
        });

        if (orsRes.ok) {
          const geojson = await orsRes.json();
          return jsonResponse({
            provider: "OpenRouteService",
            center: [lng, lat],
            intervalsMinutes,
            geojson
          });
        }
      } catch (err: any) {
        console.warn("[Cloudflare ServiceArea] ORS failed, using geometric fallback:", err.message || err);
      }
    }

    // Geometric fallback (36-gon)
    const kmPerMinuteDrive = 0.8;
    const features = intervalsMinutes.map(min => {
      const radiusKm = min * kmPerMinuteDrive;
      const points: [number, number][] = [];
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const angle = (i * 360) / steps;
        const rad = (angle * Math.PI) / 180;
        const dLat = (radiusKm / 111) * Math.cos(rad);
        const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad);
        points.push([lng + dLng, lat + dLat]);
      }
      return {
        type: "Feature",
        properties: { value: min * 60, minutes: min },
        geometry: { type: "Polygon", coordinates: [points] }
      };
    });

    return jsonResponse({
      provider: "GeometricEstimator",
      center: [lng, lat],
      intervalsMinutes,
      geojson: { type: "FeatureCollection", features }
    });
  } catch (err: any) {
    return jsonResponse({ error: "Failed to compute service area", details: err.message || String(err) }, 500);
  }
}

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Edge Overpass API Proxy with Multi-Mirror Fallback and KV Caching (14 days)
 */
async function handleWorkerOverpassProxy(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const body = (await request.json().catch(() => ({}))) as any;
  const query = body?.query;

  if (!query || typeof query !== "string" || !query.trim()) {
    return jsonResponse({ error: "Query inválida", elements: [], diagnostics: [] }, 400);
  }

  const trimmedQuery = query.trim();

  // Si existe env.CACHE (KV), busca con clave "ovp:"+hash SHA-256 y devuélvela antes de llamar a los espejos
  let cacheKey = "";
  if (env.CACHE) {
    try {
      const hash = await sha256(trimmedQuery);
      cacheKey = `ovp:${hash}`;
      const cached = await env.CACHE.get(cacheKey, "json");
      if (cached && Array.isArray(cached.elements)) {
        return jsonResponse(cached, 200);
      }
    } catch (cacheErr) {
      console.warn("[Worker Overpass] Error reading KV cache:", cacheErr);
    }
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];

  interface MirrorDiagnostic {
    mirror: string;
    status: number | string;
    ms: number;
    remark?: string | null;
  }
  const diagnostics: MirrorDiagnostic[] = [];

  const globalController = new AbortController();
  const globalTimeout = setTimeout(() => globalController.abort(), 25000);

  for (const endpoint of endpoints) {
    if (globalController.signal.aborted) {
      break;
    }
    const startMs = Date.now();
    let status: number | string = "error";
    let remark: string | null = null;

    try {
      const mirrorSignal = AbortSignal.timeout(6000);
      const combinedSignal = AbortSignal.any([globalController.signal, mirrorSignal]);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "BveltRadarBot/2.0 (https://bvelt.com; info@bvelt.com)"
        },
        body: `data=${encodeURIComponent(trimmedQuery)}`,
        signal: combinedSignal
      });

      const elapsed = Date.now() - startMs;
      status = response.status;

      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        const data = (await response.json()) as any;
        const respRemark = typeof data?.remark === "string" ? data.remark : null;

        if (respRemark || !Array.isArray(data?.elements)) {
          remark = respRemark || "Sin array elements";
          diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark });
          console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
          continue;
        }

        diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark: null });
        console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
        clearTimeout(globalTimeout);

        const result = { ok: true, elements: data.elements, diagnostics };

        // Si existe env.CACHE (KV), guarda la respuesta exitosa 14 días
        if (env.CACHE && cacheKey) {
          try {
            await env.CACHE.put(cacheKey, JSON.stringify(result), {
              expirationTtl: 14 * 24 * 60 * 60 // 14 días en segundos
            });
          } catch (putErr) {
            console.warn("[Worker Overpass] Error writing KV cache:", putErr);
          }
        }

        return jsonResponse(result, 200);
      } else {
        remark = !response.ok ? `HTTP ${response.status}` : `Content-Type: ${contentType}`;
        diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark });
        console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
      }
    } catch (err: any) {
      const elapsed = Date.now() - startMs;
      status = err?.name === "TimeoutError" ? "timeout" : (err?.name === "AbortError" ? "timeout" : "error");
      remark = err?.message || String(err);
      diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark });
      console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
    }
  }

  clearTimeout(globalTimeout);

  const hasQuota = diagnostics.some(d => d.status === 429 || String(d.remark).includes('quota') || String(d.remark).includes('rate limit'));
  const allTimeout = diagnostics.length > 0 && diagnostics.every(d => d.status === 'timeout' || d.status === 504 || d.status === 408 || String(d.remark).includes('timed out'));
  const degradedReason = hasQuota ? 'quota' : ((allTimeout || globalController.signal.aborted) ? 'timeout' : 'provider');

  return jsonResponse({
    ok: false,
    error: "Overpass API unavailable",
    reason: degradedReason,
    elements: [],
    diagnostics
  }, 200);
}

/**
 * Multi-provider Geocoding endpoint on Worker Edge
 */
async function handleWorkerGeocode(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return jsonResponse({ error: "Missing query parameter 'q'", results: [] }, 400);
  }

  // Provider 1: LocationIQ
  if (env.LOCATIONIQ_API_KEY) {
    try {
      const res = await fetch(`https://us1.locationiq.com/v1/search?key=${env.LOCATIONIQ_API_KEY}&q=${encodeURIComponent(q)}&format=json&limit=1`);
      console.log(`[Geocode LocationIQ] status: ${res.status}`);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (Array.isArray(data) && data.length > 0) {
          const item = data[0];
          return jsonResponse({
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            formattedAddress: item.display_name,
            confidence: 0.95,
            provider: "locationiq"
          });
        }
      }
    } catch (e: any) {
      console.log(`[Geocode LocationIQ] error: ${e?.message || e}`);
    }
  }

  // Provider 2: OpenCage
  if (env.OPENCAGE_API_KEY) {
    try {
      const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?key=${env.OPENCAGE_API_KEY}&q=${encodeURIComponent(q)}&limit=1&no_annotations=1`);
      console.log(`[Geocode OpenCage] status: ${res.status}`);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.results && data.results.length > 0) {
          const item = data.results[0];
          return jsonResponse({
            lat: item.geometry.lat,
            lng: item.geometry.lng,
            formattedAddress: item.formatted,
            confidence: 0.9,
            provider: "opencage"
          });
        }
      }
    } catch (e: any) {
      console.log(`[Geocode OpenCage] error: ${e?.message || e}`);
    }
  }

  // Provider 3: Geoapify
  if (env.GEOAPIFY_API_KEY) {
    try {
      const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&apiKey=${env.GEOAPIFY_API_KEY}&limit=1`);
      console.log(`[Geocode Geoapify] status: ${res.status}`);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.features && data.features.length > 0) {
          const item = data.features[0];
          return jsonResponse({
            lat: item.geometry.coordinates[1],
            lng: item.geometry.coordinates[0],
            formattedAddress: item.properties.formatted,
            confidence: 0.88,
            provider: "geoapify"
          });
        }
      }
    } catch (e: any) {
      console.log(`[Geocode Geoapify] error: ${e?.message || e}`);
    }
  }

  // Provider 4: Nominatim
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`, {
      headers: { "User-Agent": "BveltRadar/2.0 (contact@bvelt.com)" }
    });
    console.log(`[Geocode Nominatim] status: ${res.status}`);
    if (res.ok) {
      const data = (await res.json()) as any;
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        return jsonResponse({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          formattedAddress: item.display_name,
          confidence: 0.8,
          provider: "nominatim"
        });
      }
    }
  } catch (e: any) {
    console.log(`[Geocode Nominatim] error: ${e?.message || e}`);
  }

  return jsonResponse({ results: [], error: "All geocoding providers failed" }, 502);
}

/**
 * Multi-provider Local Competitors & Places endpoint on Worker Edge
 */
async function handleWorkerPlaces(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const niche = (url.searchParams.get("niche") || "commercial").trim();
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const radius = parseInt(url.searchParams.get("radius") || "5000", 10);
  const exclude = (url.searchParams.get("exclude") || "").trim().toLowerCase();

  if (isNaN(lat) || isNaN(lng)) {
    return jsonResponse({ error: "Valid 'lat' and 'lng' parameters are required", results: [] }, 400);
  }

  const competitors: any[] = [];
  let anyProviderResponded = false;

  // Layer 1: Overpass OSM Places
  try {
    const query = `[out:json][timeout:5];(node["amenity"](around:${radius},${lat},${lng});node["shop"](around:${radius},${lat},${lng});node["craft"](around:${radius},${lat},${lng}););out body 25;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`
    });
    console.log(`[Places Overpass] status: ${res.status}`);
    if (res.ok) {
      anyProviderResponded = true;
      const data = (await res.json()) as any;
      if (Array.isArray(data.elements)) {
        for (const el of data.elements) {
          const name = el.tags?.name;
          if (name && (!exclude || !name.toLowerCase().includes(exclude))) {
            competitors.push({
              id: `osm-${el.id}`,
              name,
              category: el.tags?.craft || el.tags?.shop || el.tags?.amenity || niche,
              address: el.tags?.["addr:street"] ? `${el.tags["addr:street"]} ${el.tags["addr:housenumber"] || ""}` : "",
              phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
              website: el.tags?.website || el.tags?.["contact:website"] || null,
              lat: el.lat,
              lng: el.lon,
              distanceKm: 0,
              rating: null,
              reviewsCount: null,
              source: "osm"
            });
          }
        }
      }
    }
  } catch (e: any) {
    console.log(`[Places Overpass] error: ${e?.message || e}`);
  }

  // Layer 2: Geoapify Places (if fewer than 3 competitors)
  if (competitors.length < 3 && env.GEOAPIFY_API_KEY) {
    try {
      const res = await fetch(`https://api.geoapify.com/v2/places?categories=commercial,service&filter=circle:${lng},${lat},${radius}&limit=20&apiKey=${env.GEOAPIFY_API_KEY}`);
      console.log(`[Places Geoapify] status: ${res.status}`);
      if (res.ok) {
        anyProviderResponded = true;
        const data = (await res.json()) as any;
        if (Array.isArray(data.features)) {
          for (const f of data.features) {
            const props = f.properties || {};
            const name = props.name;
            if (name && (!exclude || !name.toLowerCase().includes(exclude)) && !competitors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
              competitors.push({
                id: `geoapify-${props.place_id || Math.random().toString(36).substring(2, 9)}`,
                name,
                category: props.categories?.[0] || niche,
                address: props.formatted || props.address_line2 || "",
                phone: props.contact?.phone || null,
                website: props.contact?.website || null,
                lat: f.geometry?.coordinates?.[1] || lat,
                lng: f.geometry?.coordinates?.[0] || lng,
                distanceKm: (props.distance || 0) / 1000,
                rating: null,
                reviewsCount: null,
                source: "geoapify"
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.log(`[Places Geoapify] error: ${e?.message || e}`);
    }
  }

  // Layer 3: LocationIQ Nearby (if fewer than 3 competitors)
  if (competitors.length < 3 && env.LOCATIONIQ_API_KEY) {
    try {
      const res = await fetch(`https://us1.locationiq.com/v1/nearby?key=${env.LOCATIONIQ_API_KEY}&lat=${lat}&lon=${lng}&tag=shop,amenity,craft&radius=${radius}&format=json`);
      console.log(`[Places LocationIQ] status: ${res.status}`);
      if (res.ok) {
        anyProviderResponded = true;
        const data = (await res.json()) as any;
        if (Array.isArray(data)) {
          for (const item of data) {
            const name = item.display_name?.split(",")?.[0] || item.name;
            if (name && (!exclude || !name.toLowerCase().includes(exclude)) && !competitors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
              competitors.push({
                id: `locationiq-${item.place_id || Math.random().toString(36).substring(2, 9)}`,
                name,
                category: item.type || niche,
                address: item.display_name || "",
                phone: null,
                website: null,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                distanceKm: (item.distance || 0) / 1000,
                rating: null,
                reviewsCount: null,
                source: "locationiq"
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.log(`[Places LocationIQ] error: ${e?.message || e}`);
    }
  }

  if (!anyProviderResponded && competitors.length === 0) {
    return jsonResponse({ results: [], error: "All places providers failed" }, 502);
  }

  return jsonResponse({
    niche,
    center: { lat, lng },
    radiusMeters: radius,
    count: competitors.length,
    competitors
  });
}

/**
 * Edge-compatible Save Onboarding Profile Handler
 */
async function handleWorkerSaveOnboarding(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!idToken) {
      return jsonResponse({ error: "No autorizado. Token de autenticación ausente." }, 401);
    }

    const verifiedUid = await verifyFirebaseIdToken(env, idToken);
    if (!verifiedUid) {
      return jsonResponse({ error: "Token de autenticación inválido o expirado." }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const {
      businessName,
      name,
      category,
      niche,
      subNiche,
      address,
      city,
      state,
      country,
      phone,
      email,
      gmbLink,
      lat,
      lng,
      marketRadius
    } = body;

    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return jsonResponse({
        error: "El correo electrónico es obligatorio para completar el onboarding de Bvelt.",
        field: "email"
      }, 400);
    }

    const finalName = (businessName || name || "").trim();
    if (!finalName) {
      return jsonResponse({
        error: "El nombre del negocio es obligatorio.",
        field: "businessName"
      }, 400);
    }

    const profileData: any = {
      name: finalName,
      businessName: finalName,
      category: (category || niche || "Servicios Generales").trim(),
      niche: (niche || category || "Servicios Generales").trim(),
      subNiche: (subNiche || "").trim(),
      address: (address || "").trim(),
      city: (city || "").trim(),
      state: (state || "").trim(),
      country: (country || "US").trim(),
      phone: (phone || "").trim(),
      email: cleanEmail,
      gmbLink: (gmbLink || "").trim(),
      location: (city ? `${city}${state ? `, ${state}` : ""}` : "").trim(),
      onboardingCompleted: true,
      updatedAt: new Date().toISOString()
    };

    if (typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)) {
      profileData.lat = lat;
      profileData.lng = lng;
    }
    if (typeof marketRadius === "number" && !isNaN(marketRadius)) {
      profileData.marketRadius = marketRadius;
    }

    const success = await updateFirestoreUserProfile(env, verifiedUid, profileData);
    if (success) {
      return jsonResponse({
        success: true,
        message: "Perfil de onboarding guardado con éxito.",
        profile: profileData
      });
    }

    return jsonResponse({ error: "No se pudo actualizar el perfil en Firestore" }, 500);
  } catch (err: any) {
    console.log(`[Save Onboarding] Error: ${err?.message || err}`);
    return jsonResponse({ error: "Error guardando perfil de onboarding", details: err?.message || String(err) }, 500);
  }
}

/**
 * Publicar configuración del sitio en KV con protección de token de Firebase
 */
async function handlePublishSite(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!idToken) {
      return jsonResponse({ error: "No autorizado. Token de autenticación ausente." }, 401);
    }

    const verifiedUid = await verifyFirebaseIdToken(env, idToken);
    if (!verifiedUid) {
      return jsonResponse({ error: "Token de autenticación inválido o expirado." }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as any;
    let {
      slug,
      name,
      category,
      city,
      phone,
      description,
      heroTitle,
      heroSubtitle,
      features,
      themeColor,
      gmbLink,
      published,
      services,
      hours,
      faq,
      photos,
      showReviews
    } = body;

    // Validate slug: minúsculas, números y guiones, 3-60 caracteres
    slug = (slug || '').toLowerCase().trim();
    if (!slug || slug.length < 3 || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug)) {
      return jsonResponse({ error: "Slug inválido. Debe tener entre 3 y 60 caracteres (minúsculas, números y guiones)." }, 400);
    }

    // Sanitize string helper (max 500 chars)
    const sanitizeText = (str?: string): string => {
      if (!str || typeof str !== 'string') return '';
      return str.trim().slice(0, 500);
    };

    // Validate http(s) URL
    const isValidUrl = (url?: string): boolean => {
      if (!url || typeof url !== 'string') return false;
      return /^https?:\/\//i.test(url.trim());
    };

    if (gmbLink && !isValidUrl(gmbLink)) {
      return jsonResponse({ error: "El enlace gmbLink debe iniciar con http:// o https://" }, 400);
    }

    const cleanServices = Array.isArray(services) 
      ? services.slice(0, 8).map(s => sanitizeText(s)).filter(Boolean)
      : [];

    const cleanFaq = Array.isArray(faq)
      ? faq.slice(0, 4).map((item: any) => ({
          question: sanitizeText(item?.question),
          answer: sanitizeText(item?.answer)
        })).filter((item: any) => item.question && item.answer)
      : [];

    const cleanPhotos = Array.isArray(photos)
      ? photos.slice(0, 6).map(p => (typeof p === 'string' ? p.trim() : '')).filter(p => isValidUrl(p))
      : [];

    const cleanFeatures = Array.isArray(features)
      ? features.slice(0, 10).map(f => typeof f === 'string' ? sanitizeText(f) : sanitizeText(f?.title || f?.name)).filter(Boolean)
      : [];

    const sitePayload = {
      slug,
      name: sanitizeText(name),
      category: sanitizeText(category),
      city: sanitizeText(city),
      phone: sanitizeText(phone),
      description: sanitizeText(description),
      heroTitle: sanitizeText(heroTitle),
      heroSubtitle: sanitizeText(heroSubtitle),
      features: cleanFeatures,
      themeColor: sanitizeText(themeColor) || '#4f46e5',
      gmbLink: isValidUrl(gmbLink) ? gmbLink.trim() : '',
      published: Boolean(published),
      services: cleanServices,
      hours: sanitizeText(hours),
      faq: cleanFaq,
      photos: cleanPhotos,
      showReviews: Boolean(showReviews),
      updatedAt: new Date().toISOString()
    };

    if (env.CACHE) {
      // Check existing owner
      const existingOwnerRaw = await env.CACHE.get(`owner:${slug}`);
      if (existingOwnerRaw) {
        try {
          const existingOwner = typeof existingOwnerRaw === 'string' ? JSON.parse(existingOwnerRaw) : existingOwnerRaw;
          if (existingOwner.uid && existingOwner.uid !== verifiedUid) {
            return jsonResponse({ error: "Este slug ya está ocupado por otro usuario." }, 409);
          }
        } catch {}
      }

      // Save site and owner
      await env.CACHE.put(`site:${slug}`, JSON.stringify(sitePayload));
      await env.CACHE.put(`owner:${slug}`, JSON.stringify({ uid: verifiedUid, email: body.email || '' }));
    }

    return jsonResponse({ status: "ok", slug, site: sitePayload });
  } catch (err: any) {
    return jsonResponse({ error: "Error publicando sitio", details: err.message || String(err) }, 500);
  }
}

/**
 * Notificación de nuevos prospectos por email al dueño vía Resend
 */
async function handleLeadNotify(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const { slug, name, contact, message } = body;

    const cleanSlug = (slug || '').toLowerCase().trim();
    if (!cleanSlug) {
      return new Response(null, { status: 204 });
    }

    let ownerEmail = '';
    let ownerUid = '';

    if (env.CACHE) {
      const ownerRaw = await env.CACHE.get(`owner:${cleanSlug}`);
      if (!ownerRaw) {
        return new Response(null, { status: 204 });
      }
      try {
        const parsed = typeof ownerRaw === 'string' ? JSON.parse(ownerRaw) : ownerRaw;
        ownerEmail = parsed.email || '';
        ownerUid = parsed.uid || '';
      } catch {}

      // Rate limit: max 5 requests per IP per hour & max 30 per slug per day
      const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown_ip";
      const now = new Date();
      const hourKey = `${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}_${now.getUTCHours()}`;
      const dayKey = `${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}`;

      const ipKey = `lead_ip:${clientIp}:${hourKey}`;
      const slugKey = `lead_slug:${cleanSlug}:${dayKey}`;

      const ipCountStr = await env.CACHE.get(ipKey);
      const ipCount = ipCountStr ? parseInt(ipCountStr) : 0;
      if (ipCount >= 5) {
        return jsonResponse({ error: "Límite de solicitudes por hora excedido." }, 429);
      }

      const slugCountStr = await env.CACHE.get(slugKey);
      const slugCount = slugCountStr ? parseInt(slugCountStr) : 0;
      if (slugCount >= 30) {
        return jsonResponse({ error: "Límite diario de solicitudes para este negocio excedido." }, 429);
      }

      await env.CACHE.put(ipKey, String(ipCount + 1), { expirationTtl: 3600 });
      await env.CACHE.put(slugKey, String(slugCount + 1), { expirationTtl: 86400 });
    }

    // Sanitize texts (max 300 chars, no HTML)
    const stripHtml = (str?: string) => {
      if (!str || typeof str !== 'string') return '';
      return str.replace(/<[^>]*>/g, '').trim().slice(0, 300);
    };

    const sanitizedName = stripHtml(name) || 'Prospecto Web';
    const sanitizedContact = stripHtml(contact);
    const sanitizedMsg = stripHtml(message);

    const isEmail = sanitizedContact.includes('@');
    const cleanPhone = sanitizedContact.replace(/[^0-9+]/g, '');

    const apiKey = env.RESEND_API_KEY;
    if (!apiKey || !ownerEmail) {
      return new Response(null, { status: 204 });
    }

    let linksHtml = '';
    let linksText = '';

    if (isEmail) {
      linksHtml = `<p style="margin: 16px 0;"><a href="mailto:${sanitizedContact}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Responder por Correo</a></p>`;
      linksText = `Responder por Correo: mailto:${sanitizedContact}`;
    } else {
      const telLink = `tel:${cleanPhone}`;
      const smsLink = `sms:${cleanPhone}`;
      const waPhone = cleanPhone.replace(/\D/g, '');
      const waLink = `https://wa.me/${waPhone}`;

      linksHtml = `
        <div style="margin: 20px 0;">
          <a href="${telLink}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 8px;">Llamar (${cleanPhone})</a>
          <a href="${smsLink}" style="display: inline-block; background: #0284c7; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 8px;">Enviar SMS</a>
          <a href="${waLink}" style="display: inline-block; background: #10b981; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: bold;">WhatsApp</a>
        </div>
      `;
      linksText = `Llamar: ${telLink}\nSMS: ${smsLink}\nWhatsApp: ${waLink}`;
    }

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
        <h2 style="color: #6366f1; margin-bottom: 16px;">Nuevo trabajo: ${sanitizedName}</h2>
        <div style="background: #1e293b; padding: 16px; border-radius: 12px; margin: 16px 0;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Cliente:</strong> ${sanitizedName}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Contacto:</strong> ${sanitizedContact}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Mensaje:</strong> "${sanitizedMsg}"</p>
        </div>
        ${linksHtml}
        <p style="font-size: 11px; color: #64748b; margin-top: 24px;">Enviado automáticamente desde tu página web en Bvelt.</p>
      </div>
    `;

    const emailText = `Nuevo trabajo: ${sanitizedName}\n\nCliente: ${sanitizedName}\nContacto: ${sanitizedContact}\nMensaje: ${sanitizedMsg}\n\n${linksText}`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || "Bvelt <onboarding@resend.dev>",
        to: [ownerEmail],
        subject: `Nuevo trabajo: ${sanitizedName}`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!resendResp.ok) {
      console.log(`[lead-notify] Resend email failed with status: ${resendResp.status}`);
      return new Response(null, { status: 204 });
    }

    return jsonResponse({ status: "ok" });
  } catch (err: any) {
    console.log(`[lead-notify] Error handling notification: ${err?.message || err}`);
    return new Response(null, { status: 204 });
  }
}

/**
 * Servir página web pública /web/:slug usando HTMLRewriter e index.html de ASSETS
 */
async function handleWebSlug(request: Request, env: Env, slug: string): Promise<Response> {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    return new Response("ASSETS binding missing", { status: 500 });
  }

  const cleanSlug = slug.toLowerCase().trim();
  let siteData: any = null;

  if (env.CACHE) {
    const raw = await env.CACHE.get(`site:${cleanSlug}`);
    if (raw) {
      try {
        siteData = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
    }
  }

  // Fetch /index.html from env.ASSETS
  const indexReq = new Request(new URL("/", request.url).toString(), {
    headers: request.headers
  });
  const assetRes = await env.ASSETS.fetch(indexReq);
  if (!assetRes.ok) {
    return assetRes;
  }

  const title = siteData?.name || siteData?.heroTitle || 'Bvelt';
  const description = siteData?.description || siteData?.heroSubtitle || '';
  const pageUrl = `https://bvelt.app/web/${cleanSlug}`;
  const isPublished = siteData?.published === true;

  // LocalBusiness structured data (no incluir datos que el dueño no escribió)
  const localBusiness: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": title,
    "url": pageUrl
  };
  if (description) localBusiness.description = description;
  if (siteData?.phone) localBusiness.telephone = siteData.phone;
  if (siteData?.city) {
    localBusiness.address = {
      "@type": "PostalAddress",
      "addressLocality": siteData.city
    };
  }
  if (siteData?.gmbLink) {
    localBusiness.sameAs = [siteData.gmbLink];
  }

  const escapedJsonLd = JSON.stringify(localBusiness).replace(/<\//g, '<\\/');

  const noscriptHtml = `
    <noscript>
      <h1>${title}</h1>
      ${description ? `<p>${description}</p>` : ''}
      ${siteData?.phone ? `<p>${siteData.phone}</p>` : ''}
    </noscript>
  `;

  const rewriter = new HTMLRewriter()
    .on('title', {
      element(e) {
        e.setInnerContent(title);
      }
    })
    .on('meta[name="description"]', {
      element(e) {
        e.setAttribute('content', description);
      }
    })
    .on('meta[property="og:title"]', {
      element(e) {
        e.setAttribute('content', title);
      }
    })
    .on('meta[property="og:description"]', {
      element(e) {
        e.setAttribute('content', description);
      }
    })
    .on('meta[property="og:type"]', {
      element(e) {
        e.setAttribute('content', 'website');
      }
    })
    .on('meta[property="og:url"]', {
      element(e) {
        e.setAttribute('content', pageUrl);
      }
    })
    .on('link[rel="canonical"]', {
      element(e) {
        e.setAttribute('href', pageUrl);
      }
    })
    .on('head', {
      element(e) {
        if (!isPublished) {
          e.append('<meta name="robots" content="noindex">', { html: true });
        } else {
          e.append(`<script type="application/ld+json">${escapedJsonLd}</script>`, { html: true });
        }
      }
    })
    .on('body', {
      element(e) {
        e.append(noscriptHtml, { html: true });
      }
    });

  const transformedRes = rewriter.transform(assetRes);
  const headers = new Headers(transformedRes.headers);
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('Content-Type', 'text/html; charset=utf-8');

  return new Response(transformedRes.body, {
    status: 200,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

    // 1. Handle CORS Preflight Options
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 2. Handle Stripe Webhook (Root and /api endpoints)
    if (normalizedPath === "/api/stripe-webhook" || normalizedPath === "/stripe-webhook" || normalizedPath === "/api/webhooks/stripe") {
      return handleStripeWebhook(request, env);
    }

    // 2.1 Handle /support or /apoyar redirect to /about#support
    if (normalizedPath === "/support" || normalizedPath === "/apoyar") {
      const redirectUrl = new URL("/about#support", request.url);
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // 2.2 Rate limit public report routes /r/* (IP rate limit: 30 req/h)
    if (normalizedPath.startsWith("/r/") || normalizedPath === "/r" || normalizedPath.startsWith("/api/r/")) {
      const rl = await checkRateLimit(request, 'public_r', env);
      if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
    }

    // 3. API Routing
    if (normalizedPath.startsWith("/api/") || normalizedPath === "/plan/usage" || normalizedPath === "/plan-usage" || normalizedPath === "/verify-session") {
      // Dynamic route matching
      if (normalizedPath.startsWith("/api/business/") || normalizedPath === "/api/business") {
        return handleEvidenceApi(request, env);
      }
      if (normalizedPath.startsWith("/api/verify/")) {
        const entityId = normalizedPath.split("/")[3];
        const newUrl = new URL(request.url);
        newUrl.pathname = `/api/business/${entityId}/evidence`;
        return handleEvidenceApi(new Request(newUrl, request), env);
      }
      if (normalizedPath.startsWith("/api/ai-visibility")) {
        if (normalizedPath === "/api/ai-visibility/audit") {
          const rl = await checkRateLimit(request, 'heavy', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleAiVisibilityAudit(request, env);
        }
        return handleGetAiVisibility(request, env);
      }

      switch (normalizedPath) {
        case "/api/health/providers": {
          const result = await checkHealthProviders(env);
          return jsonResponse(result);
        }

        case "/api/health":
          return jsonResponse({ status: "ok", runtime: "cloudflare-workers", timestamp: new Date().toISOString() });

        case "/api/server-time":
          return jsonResponse({ time: Date.now() });

        case "/api/webhooks/whatsapp":
        case "/webhooks/whatsapp":
          return handleWhatsAppWebhook(request, env);

        case "/api/webhooks/telegram":
        case "/webhooks/telegram":
          return handleTelegramWebhook(request, env);

        case "/api/messaging/send": {
          const rl = await checkRateLimit(request, 'outreach', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleDispatchOutbound(request, env);
        }

        case "/api/messaging/evidence":
          return handleEvidenceFromMessage(request, env);

        case "/api/create-checkout-session":
          return handleCreateCheckoutSession(request, env);

        case "/api/verify-session":
        case "/verify-session":
          return handleVerifySession(request, env);

        case "/api/usdt/create-order":
        case "/api/usdt-create-order":
          return handleCreateUsdtOrder(request, env);

        case "/api/usdt/verify-payment":
        case "/api/usdt-verify-payment": {
          const rl = await checkRateLimit(request, 'verify_payment', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleVerifyUsdtPayment(request, env);
        }

        case "/api/usdt/order-status":
        case "/api/usdt-order-status":
          return handleGetUsdtOrderStatus(request, env);

        case "/api/reports/create":
        case "/api/report/create": {
          const rl = await checkRateLimit(request, 'report_create', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return jsonResponse({ status: "ok", message: "Report creation endpoint" });
        }

        case "/api/plan/usage":
        case "/api/plan-usage":
        case "/plan/usage":
        case "/plan-usage":
          return handleCloudflarePlanUsage(request, env);

        case "/api/geolocalizar":
        case "/api/nominatim":
          return handleNominatim(request);

        case "/api/geocode":
          return handleWorkerGeocode(request, env);

        case "/api/places":
          return handleWorkerPlaces(request, env);

        case "/api/profile/save-onboarding":
        case "/api/profile/onboarding":
          return handleWorkerSaveOnboarding(request, env);

        case "/api/overpass-proxy":
          return handleWorkerOverpassProxy(request, env);

        case "/api/ai/groq": {
          const rl = await checkRateLimit(request, 'ai_light', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleGroqAi(request, env);
        }

        case "/api/ai/generate": {
          const rl = await checkRateLimit(request, 'ai_light', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleGeminiGenerate(request, env);
        }

        case "/api/ai/router": {
          const rl = await checkRateLimit(request, 'ai_light', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleAiRouter(request, env);
        }

        case "/api/generate-lead-pitch": {
          const rl = await checkRateLimit(request, 'ai_light', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleGenerateLeadPitch(request, env);
        }

        case "/api/audit":
        case "/audit": {
          const rl = await checkRateLimit(request, 'heavy', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleAudit(request, env);
        }

        case "/api/business-scan":
        case "/business-scan": {
          const rl = await checkRateLimit(request, 'heavy', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleBusinessScan(request, env);
        }

        case "/api/scan-maps":
        case "/scan-maps":
        case "/api/reparar-perfil":
        case "/reparar-perfil": {
          const rl = await checkRateLimit(request, 'heavy', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleScanMaps(request, env);
        }

        case "/api/generar-audio":
        case "/generar-audio": {
          const rl = await checkRateLimit(request, 'ai_light', env);
          if (!rl.allowed) return createRateLimitResponse(rl, CORS_HEADERS);
          return handleGenerarAudio(request, env);
        }

        case "/api/send-whatsapp":
        case "/send-whatsapp":
          return handleSendWhatsApp(request, env);

        case "/api/auth/google":
          return handleGoogleAuth(request, env);

        case "/api/auth/callback/google":
          return handleGoogleCallback(request, env);

        case "/api/auth/google/config-status":
          return handleGoogleConfigStatus(request, env);

        case "/api/gmb/locations":
          return handleGmbLocations(request, env);

        case "/api/gmb/reviews":
          return handleGmbReviews(request, env);

        case "/api/gmb/reviews/reply":
          return handleGmbReply(request, env);

        case "/api/gmb/performance":
          return handleGmbPerformance(request, env);

        case "/api/batch-outreach":
        case "/batch-outreach":
          return handleBatchOutreachCloudflare(request, env);

        case "/api/monthly-seo-cron":
        case "/monthly-seo-cron":
        case "/api/cron/monthly-seo-reports":
        case "/cron/monthly-seo-reports":
          return jsonResponse({ status: "ok", message: "Monthly SEO cron registered" });

        case "/api/send-email":
        case "/send-email":
          return handleSendEmail(request, env);

        case "/api/send-weekly-summary":
        case "/send-weekly-summary":
        case "/api/cron/weekly-summary":
        case "/cron/weekly-summary":
          return handleWeeklySummaryEmails(request, env);

        case "/api/service-area":
        case "/service-area":
          return handleServiceArea(request, env);

        case "/api/activate-trial":
          return handleActivateTrial(request, env);

        case "/api/niche-benchmark":
          return handleNicheBenchmark(request);

        default:
          return jsonResponse({ error: "Route not found", path: pathname }, 404);
      }
    }

    // Direct root redirects/aliases for legacy health & Service Worker
    if (pathname === "/health") {
      return jsonResponse({ status: "ok", runtime: "cloudflare-workers" });
    }

    if (pathname === "/sw.js") {
      if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
        try {
          const swResponse = await env.ASSETS.fetch(request);
          if (swResponse.ok) {
            const headers = new Headers(swResponse.headers);
            headers.set("Content-Type", "application/javascript; charset=utf-8");
            headers.set("Service-Worker-Allowed", "/");
            headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
            return new Response(swResponse.body, {
              status: swResponse.status,
              headers
            });
          }
        } catch (swErr) {
          console.warn("[Cloudflare Worker] Error fetching /sw.js asset:", swErr);
        }
      }
    }

    // 4. Static Asset & SPA Fallback via Cloudflare Workers Static Assets
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      // If a specific asset (/assets/...) is requested, ensure that if missing, it returns 404 rather than HTML index.html
      if (normalizedPath.startsWith("/assets/")) {
        const assetRes = await env.ASSETS.fetch(request);
        const contentType = assetRes.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          return new Response("/* Chunk unavailable or stale */", {
            status: 404,
            statusText: "Not Found",
            headers: {
              "Content-Type": "application/javascript",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              ...CORS_HEADERS
            }
          });
        }
        return assetRes;
      }
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    const cron = event.cron;
    console.log(`[Cloudflare Cron Triggered] Schedule: ${cron}`);

    if (cron === "0 8 * * *") {
      // Daily Batch Outreach (8:00 AM UTC)
      const outreachReq = new Request("https://bvelt.app/api/batch-outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": env.CRON_SECRET || "",
        },
      });
      ctx.waitUntil(handleBatchOutreachCloudflare(outreachReq, env));
    }

    // Every Monday (e.g. 9:00 AM UTC or day === 1)
    if (cron === "0 9 * * 1" || new Date().getUTCDay() === 1) {
      const summaryReq = new Request("https://bvelt.app/api/cron/weekly-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": env.CRON_SECRET || "",
        },
      });
      ctx.waitUntil(handleWeeklySummaryEmails(summaryReq, env));
    }
  },
};

