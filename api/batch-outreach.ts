import { Request, Response } from "express";
import { sendEmailWithResend, captureSentryError } from "../src/lib/resend.ts";
import { getFirebaseAdminDB, hasFirebaseAdminCredentials } from "./firebaseAdmin.ts";
import { fetchOverpassWithCache } from "./ai-config.ts";

function getAdminDb() {
  return getFirebaseAdminDB();
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
  'philadelphia': { lat: 39.9526, lng: -75.1652 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'valencia': { lat: 39.4699, lng: -0.3763 },
  'sevilla': { lat: 37.3891, lng: -5.9845 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 }
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];

async function resolveCoordinates(cityName: string): Promise<{ lat: number; lng: number } | null> {
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
      signal: AbortSignal.timeout(5000),
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

  return null;
}

function buildOverpassQuery(niche: string, lat: number, lng: number, radius = 8000): string {
  const cat = niche.toLowerCase();
  let subqueries: string[] = [];

  if (cat.includes('hvac') || cat.includes('aire') || cat.includes('clima')) {
    subqueries = [
      `node["craft"="hvac"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="hvac"](around:${radius}, ${lat}, ${lng});`,
      `node["shop"="air_conditioning"](around:${radius}, ${lat}, ${lng});`,
      `way["shop"="air_conditioning"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('plumb') || cat.includes('plome') || cat.includes('fonta')) {
    subqueries = [
      `node["craft"="plumber"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="plumber"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('roof') || cat.includes('techo')) {
    subqueries = [
      `node["craft"="roofer"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="roofer"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('electr')) {
    subqueries = [
      `node["craft"="electrician"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="electrician"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('landscap') || cat.includes('jardin')) {
    subqueries = [
      `node["craft"="gardener"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="gardener"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('paint') || cat.includes('pint')) {
    subqueries = [
      `node["craft"="painter"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="painter"](around:${radius}, ${lat}, ${lng});`
    ];
  } else if (cat.includes('clean') || cat.includes('limp')) {
    subqueries = [
      `node["craft"="cleaning"](around:${radius}, ${lat}, ${lng});`,
      `way["craft"="cleaning"](around:${radius}, ${lat}, ${lng});`
    ];
  } else {
    const cleanNiche = niche.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    subqueries = [
      `node["craft"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`,
      `way["craft"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`,
      `node["office"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`,
      `way["office"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`,
      `node["shop"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`,
      `way["shop"~"${cleanNiche}",i](around:${radius}, ${lat}, ${lng});`
    ];
  }

  // Fallback broad craft/office query if needed
  subqueries.push(`node["craft"](around:${radius}, ${lat}, ${lng});`);
  subqueries.push(`way["craft"](around:${radius}, ${lat}, ${lng});`);

  return `[out:json][timeout:20];
(
  ${subqueries.join('\n  ')}
);
out tags center;`;
}

export interface BatchOutreachParams {
  city?: string;
  niche?: string;
  maxBusinesses?: number;
}

export async function runBatchOutreach(params: BatchOutreachParams = {}) {
  if (!hasFirebaseAdminCredentials()) {
    console.warn("[Batch Outreach] ⚠️ Batch outreach skipped: missing Firebase Admin credentials");
    return {
      success: true,
      skipped: true,
      message: "Batch outreach skipped: missing Firebase Admin credentials",
      found: 0,
      with_email: 0,
      sent: 0
    };
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[Batch Outreach] ⚠️ Batch outreach skipped: missing RESEND_API_KEY");
    return {
      success: true,
      skipped: true,
      message: "Batch outreach skipped: missing RESEND_API_KEY environment variable",
      found: 0,
      with_email: 0,
      sent: 0
    };
  }

  const db = getAdminDb();
  let { city, niche, maxBusinesses = 90 } = params;

  // Enforce max limit of 90 per daily batch to respect Resend free tier (100/day)
  maxBusinesses = Math.min(Math.max(Number(maxBusinesses) || 50, 1), 90);

  // Auto-rotate targets if city or niche is missing
  if (!city || !niche) {
    try {
      const cursorRef = db.collection('outreach_log').doc('_cursor');
      const cursorSnap = await cursorRef.get();
      let currentIndex = 0;
      if (cursorSnap.exists) {
        currentIndex = Number(cursorSnap.data()?.index || 0);
      }

      const target = OUTREACH_TARGETS[currentIndex % OUTREACH_TARGETS.length];
      city = city || target.city;
      niche = niche || target.niche;

      await cursorRef.set({
        index: currentIndex + 1,
        lastCity: city,
        lastNiche: niche,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (cursorErr) {
      console.warn("[Batch Outreach] Cursor read/write error, using default Houston HVAC:", cursorErr);
      city = city || "Houston";
      niche = niche || "HVAC";
    }
  }

  console.log(`[Batch Outreach] Target selected: ${city} - ${niche} (Limit: ${maxBusinesses})`);

  // 1. Resolve coordinates & query Overpass API
  const coords = await resolveCoordinates(city);
  if (!coords) {
    console.warn(`[Batch Outreach] Could not resolve coordinates for ${city}`);
    return {
      success: false,
      message: `No se pudieron resolver coordenadas reales para ${city}`,
      businessesScanned: 0,
      emailsSent: 0
    };
  }
  const { lat, lng } = coords;
  const overpassQuery = buildOverpassQuery(niche, lat, lng, 10000);

  console.log(`[Batch Outreach Cache/Coalescing Check] Querying Overpass with deduplication for niche=${niche} around lat=${lat}, lng=${lng}`);
  const rawElements = await fetchOverpassWithCache(overpassQuery, async () => {
    let elements: any[] = [];
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        console.log(`[Batch Outreach] Querying Overpass endpoint: ${endpoint}`);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(overpassQuery)}`
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data && Array.isArray(data.elements)) {
            elements = data.elements;
            console.log(`[Batch Outreach] Fetched ${elements.length} OSM elements from ${endpoint}`);
            break;
          }
        }
      } catch (endpointErr: any) {
        console.warn(`[Batch Outreach] Failed endpoint ${endpoint}:`, endpointErr.message);
      }
    }
    return elements;
  });

  const totalFound = rawElements.length;

  // 2. Filter elements with email tags
  const leadsWithEmail: Array<{ name: string; email: string; phone?: string; website?: string }> = [];

  for (const el of rawElements) {
    const tags = el.tags || {};
    const name = tags.name || tags.brand || tags.operator || "";
    const email = tags.email || tags["contact:email"] || tags["email:contact"] || "";

    if (!name || !email) continue;

    // Basic email validation
    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) continue;

    const phone = tags.phone || tags["contact:phone"] || "";
    const website = tags.website || tags["contact:website"] || "";

    leadsWithEmail.push({
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? String(phone).trim() : undefined,
      website: website ? String(website).trim() : undefined
    });
  }

  const totalWithEmail = leadsWithEmail.length;
  console.log(`[Batch Outreach] Found ${totalWithEmail} leads with emails out of ${totalFound} raw elements.`);

  let sent = 0;
  let skipped_already_logged = 0;
  const errors: string[] = [];

    // 3. Process leads against Firestore outreach_log & send emails via Resend
  const executing = new Set<Promise<void>>();
  for (const lead of leadsWithEmail) {
    if (sent >= maxBusinesses) {
      console.log(`[Batch Outreach] Reached max target limit of ${maxBusinesses} emails for this batch.`);
      break;
    }

    const p = (async () => {
      if (sent >= maxBusinesses) return;
      const safeDocId = lead.email.replace(/[^a-z0-9]/g, '_');

      try {
        // Check if lead was already contacted
        if (db) {
          const logRef = db.collection('outreach_log').doc(safeDocId);
          const logSnap = await logRef.get();

          if (logSnap.exists) {
            skipped_already_logged++;
            return;
          }
        }

        const subject = `Estrategia de Visibilidad Local para ${lead.name} (${city})`;
        const textContent = `Hola equipo de ${lead.name},
Les escribo directamente tras revisar la presencia local de los negocios de ${niche} en ${city}. Actualmente, muchas empresas de la zona están perdiendo hasta un 40% de clientes potenciales en Google Maps por perfiles incompletos o falta de respuestas automatizadas a reseñas.
Hemos preparado un análisis gratuito de posicionamiento local para ${lead.name}. ¿Les interesaría revisar un resumen de 2 minutos sobre cómo mejorar su visibilidad y captar más clientes en ${city}?
Quedo atento a su respuesta.
Atentamente,
Equipo de Consultoría Local - Bvelt
contacto@bvelt.com
      `.trim();

        // Send email via Resend
        await sendEmailWithResend({
          to: lead.email,
          subject,
          textContent,
          agentType: 'b2b_outreach',
          businessName: 'Bvelt'
        });

        // Log sent status in Firestore if db available
        if (db) {
          const logRef = db.collection('outreach_log').doc(safeDocId);
          await logRef.set({
            email: lead.email,
            businessName: lead.name,
            city,
            niche,
            phone: lead.phone || null,
            website: lead.website || null,
            sentAt: new Date().toISOString(),
            status: 'sent'
          }, { merge: true });
        }

        sent++;
        console.log(`[Batch Outreach] (${sent}/${maxBusinesses}) Email sent to ${lead.email} (${lead.name})`);

        // 1-second delay between emails to adhere to rate limits
        await new Promise(r => setTimeout(r, 1000));
      } catch (leadErr: any) {
        console.error(`[Batch Outreach] Error sending to ${lead.email}:`, leadErr.message || leadErr);
        errors.push(`${lead.email}: ${leadErr.message || leadErr}`);
      }
    })();

    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= 5) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return {
    success: true,
    found: totalFound,
    with_email: totalWithEmail,
    sent,
    skipped_already_logged,
    city,
    niche,
    errors: errors.length > 0 ? errors : undefined
  };
}

export async function batchOutreachHandler(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Header check for CRON_SECRET verification
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers['x-cron-secret'] as string;
    const authHeader = req.headers.authorization as string;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    const isAuthorized = cronSecret && (headerSecret === cronSecret || bearerToken === cronSecret);

    if (!isAuthorized) {
      console.warn("[Batch Outreach] Unauthorized request attempt.");
      return res.status(401).json({
        error: "Unauthorized. Invalid CRON_SECRET header (x-cron-secret) or Bearer token."
      });
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const result = await runBatchOutreach(body);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Batch Outreach Handler Error]:", error);
    await captureSentryError(error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Internal server error during batch outreach execution."
    });
  }
}

export default batchOutreachHandler;
