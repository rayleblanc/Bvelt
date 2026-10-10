/**
 * Cloudflare Pages & Workers — Google Business Profile (GMB) and Google OAuth Handlers.
 * 
 * 100% Edge runtime compatible (pure fetch, Web Crypto, REST APIs).
 * Zero Node.js native dependencies.
 */

import { getFirestoreDoc, setFirestoreDoc } from "./cloudflareFirestore.js";
import { callGeminiApi, ACTIVE_MODELS } from "./cloudflareGemini.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function getGoogleClientId(env: any): string {
  return env.GOOGLE_CLIENT_ID || "";
}

function getGoogleClientSecret(env: any): string {
  return env.GOOGLE_CLIENT_SECRET || "";
}

function getRedirectUri(request: Request, env: any): string {
  const configuredAppUrl = env.APP_URL || env.VITE_APP_URL;
  if (configuredAppUrl && configuredAppUrl.trim() !== "") {
    return `${configuredAppUrl.replace(/\/$/, '')}/api/auth/callback/google`;
  }
  const url = new URL(request.url);
  return `${url.origin}/api/auth/callback/google`;
}

/**
 * Validates and retrieves active OAuth access token for a user.
 * Automatically refreshes expired tokens using Google OAuth token endpoint.
 */
async function getEdgeAuthenticatedToken(env: any, userId: string): Promise<string> {
  const userTokensDoc = await getFirestoreDoc(env, "user_tokens", userId);
  if (!userTokensDoc || !userTokensDoc.google_tokens) {
    throw new Error("Google Business Profile no conectado.");
  }

  const tokens = userTokensDoc.google_tokens;
  const now = Date.now();
  const expiry = tokens.expiry_date ? Number(tokens.expiry_date) : 0;

  // If token is still valid with > 60s buffer, return it
  if (tokens.access_token && expiry > now + 60000) {
    return tokens.access_token;
  }

  // Token expired or expiring: refresh using refresh_token
  if (!tokens.refresh_token) {
    if (tokens.access_token) return tokens.access_token;
    throw new Error("Google Business Profile no conectado (sin refresh_token).");
  }

  const clientId = getGoogleClientId(env);
  const clientSecret = getGoogleClientSecret(env);

  const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token"
    })
  });

  if (!refreshResp.ok) {
    const errText = await refreshResp.text();
    console.error("[Cloudflare GMB] Token refresh failed:", errText);
    throw new Error("Google Business Profile sesión expirada. Por favor vuelva a conectar.");
  }

  const refreshData = (await refreshResp.json()) as any;
  const newAccessToken = refreshData.access_token;
  const newExpiry = now + ((refreshData.expires_in || 3600) * 1000);

  // Update in Firestore
  const updatedTokens = {
    ...tokens,
    access_token: newAccessToken,
    expiry_date: newExpiry
  };

  await setFirestoreDoc(env, "user_tokens", userId, {
    google_tokens: updatedTokens,
    updated_at: new Date().toISOString(),
    has_gmb_connected: true
  });

  return newAccessToken;
}

/**
 * GET /api/auth/google/config-status
 */
export function handleGoogleConfigStatus(request: Request, env: any): Response {
  const clientId = getGoogleClientId(env);
  const clientSecret = getGoogleClientSecret(env);
  const configured = Boolean(clientId && clientId !== "YOUR_CLIENT_ID" && clientSecret && clientSecret !== "YOUR_CLIENT_SECRET");
  return new Response(JSON.stringify({
    configured,
    clientIdPresent: Boolean(clientId && clientId !== "YOUR_CLIENT_ID"),
    hasSecret: Boolean(clientSecret && clientSecret !== "YOUR_CLIENT_SECRET")
  }), {
    status: 200,
    headers: CORS_HEADERS
  });
}

/**
 * GET /api/auth/google
 */
export function handleGoogleAuth(request: Request, env: any): Response {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || "";
  const clientId = getGoogleClientId(env);

  if (!clientId || clientId === "YOUR_CLIENT_ID" || clientId.trim() === "") {
    return new Response(JSON.stringify({
      error: "Google OAuth no configurado",
      message: "Se requiere un GOOGLE_CLIENT_ID válido en las variables de entorno para autenticar con Google."
    }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  const redirectUri = getRedirectUri(request, env);
  const scopes = [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email"
  ].join(" ");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", userId);

  return Response.redirect(authUrl.toString(), 302);
}

/**
 * GET /api/auth/callback/google
 */
export async function handleGoogleCallback(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state") || "";

  if (!code) {
    return new Response("No se proporcionó el código de autorización.", { status: 400 });
  }

  const clientId = getGoogleClientId(env);
  const clientSecret = getGoogleClientSecret(env);
  const redirectUri = getRedirectUri(request, env);

  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error("[Cloudflare GMB] Token exchange failed:", errText);
      return new Response(`Error de autenticación: ${errText}`, { status: 500 });
    }

    const tokenData = (await tokenResp.json()) as any;
    const now = Date.now();
    const expiryDate = now + ((tokenData.expires_in || 3600) * 1000);

    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope,
      token_type: tokenData.token_type || "Bearer",
      expiry_date: expiryDate
    };

    if (userId && userId !== "anonymous") {
      await setFirestoreDoc(env, "user_tokens", userId, {
        google_tokens: tokens,
        updated_at: new Date().toISOString(),
        has_gmb_connected: true
      });
      console.log(`[Cloudflare GMB] Google tokens saved for user: ${userId}`);
    }

    const redirectTarget = new URL("/", request.url);
    redirectTarget.searchParams.set("auth_success", "true");
    return Response.redirect(redirectTarget.toString(), 302);
  } catch (error: any) {
    console.error("[Cloudflare GMB] Callback error:", error);
    return new Response(`Error de autenticación: ${error.message}`, { status: 500 });
  }
}

/**
 * GET /api/gmb/locations
 */
export async function handleGmbLocations(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId || userId === "undefined") {
    return new Response(JSON.stringify({ error: "userId requerido para sincronizar con Google" }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  try {
    const accessToken = await getEdgeAuthenticatedToken(env, userId);

    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (!accountsRes.ok) {
      const errData = await accountsRes.json().catch(() => ({}));
      if (accountsRes.status === 401 || accountsRes.status === 403) {
        return new Response(JSON.stringify({
          accounts: [],
          locations: [],
          connected: false,
          requiresAuth: true
        }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }
      return new Response(JSON.stringify({
        error: "Error consultando cuentas GMB",
        details: errData,
        locations: [],
        connected: false
      }), {
        status: accountsRes.status,
        headers: CORS_HEADERS
      });
    }

    const accountsData = (await accountsRes.json()) as any;
    const accounts = accountsData.accounts || [];

    if (accounts.length === 0) {
      return new Response(JSON.stringify({ accounts: [], locations: [] }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const accountName = accounts[0].name;
    const locUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,categories,serviceArea`;
    const locRes = await fetch(locUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (!locRes.ok) {
      return new Response(JSON.stringify({
        accounts,
        locations: [],
        connected: true
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const locData = (await locRes.json()) as any;
    return new Response(JSON.stringify({
      accounts,
      locations: locData.locations || []
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("no conectado") || msg.includes("sesión expirada")) {
      return new Response(JSON.stringify({
        accounts: [],
        locations: [],
        connected: false,
        requiresAuth: true
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }
    return new Response(JSON.stringify({
      error: msg,
      locations: [],
      connected: false
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

/**
 * GET /api/gmb/reviews
 */
export async function handleGmbReviews(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const locationName = url.searchParams.get("locationName");

  if (!userId || !locationName) {
    return new Response(JSON.stringify({ error: "userId y locationName requeridos", reviews: [] }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  try {
    const accessToken = await getEdgeAuthenticatedToken(env, userId);
    const reviewsUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}/reviews`;
    const reviewsRes = await fetch(reviewsUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (!reviewsRes.ok) {
      if (reviewsRes.status === 401 || reviewsRes.status === 403) {
        return new Response(JSON.stringify({ reviews: [], connected: false }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }
      const data = await reviewsRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: "Error al obtener reseñas", details: data, reviews: [] }), {
        status: reviewsRes.status,
        headers: CORS_HEADERS
      });
    }

    const reviewsData = (await reviewsRes.json()) as any;
    return new Response(JSON.stringify({ reviews: reviewsData.reviews || [] }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    if (error.message.includes("no conectado")) {
      return new Response(JSON.stringify({ reviews: [], connected: false }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }
    return new Response(JSON.stringify({ error: error.message, reviews: [] }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

/**
 * POST /api/gmb/reviews/reply
 */
export async function handleGmbReply(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { userId, reviewName, comment, language = "es" } = body || {};

    if (!userId || !reviewName || !comment) {
      return new Response(JSON.stringify({ error: "Datos incompletos: se requieren userId, reviewName y comment." }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    let accessToken = "";
    let isConnected = true;
    try {
      accessToken = await getEdgeAuthenticatedToken(env, userId);
    } catch (e: any) {
      isConnected = false;
    }

    const prompt = `Analiza el idioma de la siguiente reseña de usuario. Tu tarea es generar una respuesta profesional, amable y concisa dirigida al cliente. Debes responder OBLIGATORIAMENTE en el mismo idioma en el que está escrita la reseña (si la reseña está en inglés, responde en inglés; si está en español, responde en español, etc.). No traduzcas la reseña ni uses el idioma de la configuración del sistema.

Reseña de usuario: "${comment}"

Escribe una respuesta profesional, amigable, optimizada para SEO local, dirigida al cliente y con un máximo de 3 oraciones. Solo devuelve el texto de la respuesta, sin saludos del sistema ni introducciones adicionales.`;

    const systemInstruction = "Eres un experto en relaciones públicas y SEO local para contratistas y servicios locales. Tu objetivo es responder reseñas de clientes de manera educada, empática, corta y sumamente natural.";

    let aiReply = "";
    try {
      aiReply = await callGeminiApi(env, prompt, systemInstruction, ACTIVE_MODELS.GEMINI_FAST);
    } catch (gemErr) {
      console.warn("[Cloudflare GMB] Gemini reply generation failed, using fallback:", gemErr);
    }

    if (!aiReply) {
      aiReply = language === "en" || language === "en-US"
        ? "Thank you very much for your feedback and support. We are committed to providing the highest quality local service."
        : "Muchas gracias por tu valoración y comentario. Nos comprometemos a seguir ofreciendo la mejor calidad en nuestro servicio local.";
    }

    const isMockReview = reviewName.startsWith("rev") || reviewName.startsWith("mock");

    if (isConnected && accessToken && !isMockReview) {
      const putUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${reviewName}/reply`;
      await fetch(putUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ comment: aiReply })
      });
    }

    return new Response(JSON.stringify({ success: true, reply: aiReply }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    console.error("[Cloudflare GMB] Reply error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

/**
 * GET /api/gmb/performance
 */
export async function handleGmbPerformance(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const locationName = url.searchParams.get("locationName");

  if (!userId || !locationName) {
    return new Response(JSON.stringify({ error: "userId y locationName requeridos", multiDailyMetricTimeSeries: [] }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  try {
    const accessToken = await getEdgeAuthenticatedToken(env, userId);

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const perfUrl = new URL(`https://businessprofileperformance.googleapis.com/v1/${locationName}/fetchMultiDailyMetricsTimeSeries`);
    perfUrl.searchParams.append("dailyMetrics", "BUSINESS_IMPRESSIONS_DESKTOP_MAPS");
    perfUrl.searchParams.append("dailyMetrics", "BUSINESS_IMPRESSIONS_MOBILE_MAPS");
    perfUrl.searchParams.append("dailyMetrics", "CALL_CLICKS");
    perfUrl.searchParams.append("dailyMetrics", "WEBSITE_CLICKS");
    perfUrl.searchParams.set("dailyRange.startDate.year", String(thirtyDaysAgo.getFullYear()));
    perfUrl.searchParams.set("dailyRange.startDate.month", String(thirtyDaysAgo.getMonth() + 1));
    perfUrl.searchParams.set("dailyRange.startDate.day", String(thirtyDaysAgo.getDate()));
    perfUrl.searchParams.set("dailyRange.endDate.year", String(now.getFullYear()));
    perfUrl.searchParams.set("dailyRange.endDate.month", String(now.getMonth() + 1));
    perfUrl.searchParams.set("dailyRange.endDate.day", String(now.getDate()));

    const perfResp = await fetch(perfUrl.toString(), {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (!perfResp.ok) {
      return new Response(JSON.stringify({ multiDailyMetricTimeSeries: [] }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const perfData = await perfResp.json();
    return new Response(JSON.stringify(perfData || { multiDailyMetricTimeSeries: [] }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, multiDailyMetricTimeSeries: [] }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
