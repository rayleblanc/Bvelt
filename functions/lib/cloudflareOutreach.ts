/**
 * Cloudflare Edge-compatible Batch Outreach Service.
 * Leverages direct fetch calls to the Resend REST API and Google Cloud Firestore REST API.
 */

import { buildAgentEmailHtml } from "../../src/lib/resend.ts";

interface ServiceAccountKey {
  project_id: string;
  private_key: string;
  client_email: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function pemToBinary(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(cleanPem);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buffer[i] = raw.charCodeAt(i);
  }
  return buffer.buffer;
}

async function getGoogleOAuthToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encClaim = btoa(JSON.stringify(claimSet)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedJwt = `${encHeader}.${encClaim}`;

  const binaryKey = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const encSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signedJwt = `${unsignedJwt}.${encSignature}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt
    })
  });

  if (!tokenResp.ok) {
    const errorText = await tokenResp.text();
    throw new Error(`Failed to obtain Google OAuth token: ${errorText}`);
  }

  const tokenData = (await tokenResp.json()) as any;
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600)
  };

  return tokenData.access_token;
}

// REST Firestore Get Document
async function getFirestoreDoc(token: string, projectId: string, collection: string, docId: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    console.error(`[Firestore REST] Failed to get ${collection}/${docId}:`, await resp.text());
    return null;
  }
  return await resp.json();
}

// REST Firestore Set Document
async function setFirestoreDoc(token: string, projectId: string, collection: string, docId: string, fields: any): Promise<boolean> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });
  if (!resp.ok) {
    console.error(`[Firestore REST] Failed to patch ${collection}/${docId}:`, await resp.text());
    return false;
  }
  return true;
}

const OUTREACH_TARGETS = [
  { city: "Houston", niche: "HVAC" },
  { city: "Miami", niche: "Plumbing" },
  { city: "Orlando", niche: "Roofing" },
  { city: "Dallas", niche: "Electrician" },
  { city: "Phoenix", niche: "Landscaping" },
  { city: "Tampa", niche: "Painting" },
  { city: "Austin", niche: "Pest Control" },
  { city: "San Antonio", niche: "Garage Doors" },
  { city: "Atlanta", niche: "Carpet Cleaning" },
  { city: "Charlotte", niche: "Pressure Washing" },
  { city: "Denver", niche: "Roofing" },
  { city: "Las Vegas", niche: "HVAC" },
  { city: "San Diego", niche: "Plumbing" },
  { city: "Chicago", niche: "Electrician" },
  { city: "Philadelphia", niche: "Cleaning" }
];

const CITY_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  'houston': { lat: 29.7604, lng: -95.3698 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'orlando': { lat: 28.5384, lng: -81.3792 },
  'dallas': { lat: 32.7767, lng: -96.7970 },
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'tampa': { lat: 27.9506, lng: -82.4572 },
  'austin': { lat: 30.2672, lng: -97.7431 },
  'san antonio': { lat: 29.4241, lng: -98.4936 },
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'charlotte': { lat: 35.2271, lng: -80.8431 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'san diego': { lat: 32.7157, lng: -117.1611 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'philadelphia': { lat: 39.9526, lng: -75.1652 }
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

async function resolveCoordinates(cityName: string): Promise<{ lat: number; lng: number }> {
  const normalized = cityName.toLowerCase().trim();
  if (CITY_COORDINATES[normalized]) {
    return CITY_COORDINATES[normalized];
  }
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`, {
      headers: { 'User-Agent': 'Bvelt-Outreach/1.0 (contacto@bvelt.com)' }
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.length > 0 && data[0].lat && data[0].lon) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
  } catch (e: any) {
    console.warn("[Batch Outreach] Geocoding fallback failed:", e.message);
  }
  return { lat: 29.7604, lng: -95.3698 }; // Fallback Houston
}

function buildOverpassQuery(niche: string, lat: number, lng: number, radius = 8000): string {
  const cat = niche.toLowerCase();
  let subqueries: string[] = [];

  if (cat.includes('hvac') || cat.includes('aire') || cat.includes('clima')) {
    subqueries = [
      `node["craft"="hvac"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="hvac"](around:${radius}, ${lat}, ${lng});`,
      `node["shop"="air_conditioning"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('plumb') || cat.includes('plome') || cat.includes('fonta')) {
    subqueries = [
      `node["craft"="plumber"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="plumber"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('roof') || cat.includes('techo')) {
    subqueries = [
      `node["craft"="roofer"](around:${radius}, ${lat}, ${lng});`
    ];
  } else {
    const cleanNiche = niche.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    subqueries = [
      `node["craft"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`,
      `way["craft"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`
    ];
  }

  subqueries.push(`node["craft"](around:${radius}, ${lat}, ${lng});`);

  return `[out:json][timeout:20];
(
  ${subqueries.join('\n  ')}
);
out tags center;`;
}

export async function handleBatchOutreachCloudflare(request: Request, env: any): Promise<Response> {
  try {
    // 1. Cron Secret Verification
    const cronSecret = env.CRON_SECRET;
    const headerSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    const isAuthorized = cronSecret && (headerSecret === cronSecret || bearerToken === cronSecret);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized. Invalid CRON_SECRET." }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const body = (await request.json().catch(() => ({}))) as any;
    let { city, niche, maxBusinesses = 90 } = body;

    maxBusinesses = Math.min(Math.max(Number(maxBusinesses) || 50, 1), 90);

    // 2. Fetch Firebase access token
    const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
    if (!credsStr) {
      return new Response(JSON.stringify({ error: "Firebase credentials binding missing in Cloudflare" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
    const projectId = env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'localflowpro-20e3d';
    const dbToken = await getGoogleOAuthToken(serviceAccount);

    // Auto-rotate targets using cursor
    if (!city || !niche) {
      const cursorDoc = await getFirestoreDoc(dbToken, projectId, 'outreach_log', '_cursor');
      let currentIndex = 0;
      if (cursorDoc && cursorDoc.fields?.index?.integerValue) {
        currentIndex = parseInt(cursorDoc.fields.index.integerValue);
      }

      const target = OUTREACH_TARGETS[currentIndex % OUTREACH_TARGETS.length];
      city = city || target.city;
      niche = niche || target.niche;

      await setFirestoreDoc(dbToken, projectId, 'outreach_log', '_cursor', {
        index: { integerValue: (currentIndex + 1).toString() },
        lastCity: { stringValue: city },
        lastNiche: { stringValue: niche },
        updatedAt: { stringValue: new Date().toISOString() }
      });
    }

    // 3. Resolve Coordinates & Query Overpass
    const { lat, lng } = await resolveCoordinates(city);
    const overpassQuery = buildOverpassQuery(niche, lat, lng, 10000);

    let rawElements: any[] = [];
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(overpassQuery)}`
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data && Array.isArray(data.elements)) {
            rawElements = data.elements;
            break;
          }
        }
      } catch (err) {
        // Fallback to next endpoint
      }
    }

    const totalFound = rawElements.length;
    const leadsWithEmail: Array<{ name: string; email: string; phone?: string; website?: string }> = [];

    for (const el of rawElements) {
      const tags = el.tags || {};
      const name = tags.name || tags.brand || "";
      const email = tags.email || tags["contact:email"] || "";

      if (!name || !email) continue;
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail.includes('@')) continue;

      leadsWithEmail.push({
        name: name.trim(),
        email: cleanEmail,
        phone: tags.phone || undefined,
        website: tags.website || undefined
      });
    }

    let sent = 0;
    let skipped_already_logged = 0;

    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY binding missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    for (const lead of leadsWithEmail) {
      if (sent >= maxBusinesses) break;

      const safeDocId = lead.email.replace(/[^a-z0-9]/g, '_');
      const existingDoc = await getFirestoreDoc(dbToken, projectId, 'outreach_log', safeDocId);

      if (existingDoc) {
        skipped_already_logged++;
        continue;
      }

      const subject = `Estrategia de Visibilidad Local para ${lead.name} (${city})`;
      const textContent = `
Hola equipo de ${lead.name},

Les escribo directamente tras revisar la presencia local de los negocios de ${niche} en ${city}. 

Hemos preparado un análisis gratuito de posicionamiento local para ${lead.name}. ¿Les interesaría revisar un resumen de 2 minutos?

Atentamente,
Equipo de Consultoría Local - Bvelt
      `.trim();

      const htmlContent = buildAgentEmailHtml({
        subject,
        textContent,
        agentType: 'b2b_outreach',
        businessName: 'Bvelt'
      });

      // Direct Resend REST API fetch
      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL || "Bvelt <onboarding@resend.dev>",
          to: [lead.email],
          subject,
          html: htmlContent,
          text: textContent
        })
      });

      if (resendResp.ok) {
        await setFirestoreDoc(dbToken, projectId, 'outreach_log', safeDocId, {
          email: { stringValue: lead.email },
          businessName: { stringValue: lead.name },
          city: { stringValue: city },
          niche: { stringValue: niche },
          sentAt: { stringValue: new Date().toISOString() },
          status: { stringValue: 'sent' }
        });
        sent++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      found: totalFound,
      with_email: leadsWithEmail.length,
      sent,
      skipped_already_logged,
      city,
      niche
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Outreach Error", details: err.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
