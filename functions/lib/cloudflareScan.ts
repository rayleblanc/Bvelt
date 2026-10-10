/**
 * Cloudflare Pages & Workers — Scan Maps & Business Scan Edge Handlers
 * 
 * 100% Edge runtime compatible.
 */

import { callGeminiApi, ACTIVE_MODELS } from "./cloudflareGemini.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

interface OverpassCacheEntry {
  timestamp: number;
  data: any;
}

interface ScanCacheEntry {
  timestamp: number;
  data: any;
}

const businessScanCache = new Map<string, ScanCacheEntry>();
const scanMapsCache = new Map<string, ScanCacheEntry>();
const overpassCache = new Map<string, OverpassCacheEntry>();
const OVERPASS_CACHE_TTL = 600000; // 10 minutos (600000 ms)
const SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas (86400000 ms)

/**
 * Resolves Geoapify Places category strings based on business niche.
 * Uses official Geoapify Places v2 categories.
 */
export function getGeoapifyCategories(nicheTerm: string): string {
  const cat = (nicheTerm || "").toLowerCase().trim();
  
  if (
    cat.includes("lawn") || 
    cat.includes("jardin") || 
    cat.includes("landscap") || 
    cat.includes("poda") || 
    cat.includes("cesped") || 
    cat.includes("mow") || 
    cat.includes("grass") || 
    cat.includes("tree") || 
    cat.includes("arbol") || 
    cat.includes("irrigation") || 
    cat.includes("riego") || 
    cat.includes("yard")
  ) {
    return "service.handyman,service,commercial.garden_centre,commercial,office,office.company";
  }
  
  if (
    cat.includes("restauran") || 
    cat.includes("comida") || 
    cat.includes("food") || 
    cat.includes("caf") || 
    cat.includes("pizz") || 
    cat.includes("bar") || 
    cat.includes("pub") || 
    cat.includes("bistr") || 
    cat.includes("bakery") || 
    cat.includes("panad")
  ) {
    return "catering.restaurant,catering.cafe,catering.fast_food,catering.bar";
  }
  
  if (
    cat.includes("shop") || 
    cat.includes("tienda") || 
    cat.includes("supermerca") || 
    cat.includes("retail") || 
    cat.includes("boutique") || 
    cat.includes("market") || 
    cat.includes("store") ||
    cat.includes("comercio")
  ) {
    return "commercial.supermarket,commercial.clothing,commercial.food_and_drink,commercial";
  }
  
  if (
    cat.includes("roof") || 
    cat.includes("tejad") || 
    cat.includes("techo") || 
    cat.includes("construc") || 
    cat.includes("refor") || 
    cat.includes("contract") || 
    cat.includes("builder")
  ) {
    return "service.handyman,building.construction,service,office";
  }
  
  if (
    cat.includes("plome") || 
    cat.includes("fonta") || 
    cat.includes("plumb")
  ) {
    return "service.handyman,service";
  }
  
  if (
    cat.includes("electr")
  ) {
    return "service.handyman,service";
  }
  
  if (
    cat.includes("hvac") || 
    cat.includes("climat") || 
    cat.includes("aire") || 
    cat.includes("calefacc")
  ) {
    return "service.handyman,service";
  }
  
  if (
    cat.includes("abog") || 
    cat.includes("law") || 
    cat.includes("legal") || 
    cat.includes("asesor")
  ) {
    return "office.lawyer,office.financial,office.consulting,office";
  }
  
  if (
    cat.includes("dent") || 
    cat.includes("clini") || 
    cat.includes("medic") || 
    cat.includes("salud") || 
    cat.includes("health") ||
    cat.includes("doctor")
  ) {
    return "healthcare.dentist,healthcare.clinic,healthcare.doctor";
  }
  
  if (
    cat.includes("pelu") || 
    cat.includes("barber") || 
    cat.includes("hair") || 
    cat.includes("esteti") || 
    cat.includes("beauty") || 
    cat.includes("salon") ||
    cat.includes("spa")
  ) {
    return "service.beauty,service.hairdresser,service";
  }
  
  if (
    cat.includes("auto") || 
    cat.includes("mecanic") || 
    cat.includes("taller") || 
    cat.includes("car") ||
    cat.includes("vehic")
  ) {
    return "service.vehicle,commercial.vehicle,service";
  }
  
  if (
    cat.includes("clean") || 
    cat.includes("limpie") || 
    cat.includes("maid")
  ) {
    return "service.cleaning,service.handyman,service";
  }
  
  return "commercial,service,office,catering";
}

/**
 * Builds Overpass QL query with robust filters and safety timeout
 */
export function getOverpassQueryForNiche(nicheTerm: string, lat: number, lon: number, radiusMeters: number): string {
  const cat = (nicheTerm || "").toLowerCase().trim();
  let filters: string[] = [];

  if (
    cat.includes("lawn") || 
    cat.includes("jardin") || 
    cat.includes("landscap") || 
    cat.includes("poda") || 
    cat.includes("cesped") || 
    cat.includes("mow") || 
    cat.includes("tree") || 
    cat.includes("yard")
  ) {
    filters = [
      `node["craft"="gardener"](around:${radiusMeters},${lat},${lon});`,
      `way["craft"="gardener"](around:${radiusMeters},${lat},${lon});`,
      `node["craft"="landscaper"](around:${radiusMeters},${lat},${lon});`,
      `way["craft"="landscaper"](around:${radiusMeters},${lat},${lon});`,
      `node["shop"="garden_centre"](around:${radiusMeters},${lat},${lon});`,
      `way["shop"="garden_centre"](around:${radiusMeters},${lat},${lon});`,
      `node["leisure"="garden"](around:${radiusMeters},${lat},${lon});`,
      `node["craft"="handyman"](around:${radiusMeters},${lat},${lon});`,
      `node["office"="company"](around:${radiusMeters},${lat},${lon});`,
      `node["craft"="gardening"](around:${radiusMeters},${lat},${lon});`,
      `way["craft"="gardening"](around:${radiusMeters},${lat},${lon});`,
      `node["service"="gardener"](around:${radiusMeters},${lat},${lon});`,
      `node["service"="landscaping"](around:${radiusMeters},${lat},${lon});`,
      `node["craft"](around:${radiusMeters},${lat},${lon});`
    ];
  } else if (
    cat.includes("restauran") || 
    cat.includes("comida") || 
    cat.includes("food") || 
    cat.includes("caf") || 
    cat.includes("pizz") || 
    cat.includes("bar")
  ) {
    filters = [
      `node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});`,
      `node["amenity"="cafe"](around:${radiusMeters},${lat},${lon});`,
      `node["amenity"="fast_food"](around:${radiusMeters},${lat},${lon});`,
      `node["amenity"="bar"](around:${radiusMeters},${lat},${lon});`
    ];
  } else if (cat.includes("plumb") || cat.includes("fontan") || cat.includes("plome")) {
    filters = [
      `node["craft"="plumber"](around:${radiusMeters},${lat},${lon});`,
      `node["craft"="handyman"](around:${radiusMeters},${lat},${lon});`
    ];
  } else if (cat.includes("electr")) {
    filters = [
      `node["craft"="electrician"](around:${radiusMeters},${lat},${lon});`
    ];
  } else if (cat.includes("roof") || cat.includes("tejad") || cat.includes("techo") || cat.includes("construc") || cat.includes("builder")) {
    filters = [
      `node["craft"="roofer"](around:${radiusMeters},${lat},${lon});`,
      `node["craft"="builder"](around:${radiusMeters},${lat},${lon});`,
      `node["office"="construction"](around:${radiusMeters},${lat},${lon});`
    ];
  } else if (cat.includes("dent") || cat.includes("clini") || cat.includes("medic") || cat.includes("doctor")) {
    filters = [
      `node["amenity"="dentist"](around:${radiusMeters},${lat},${lon});`,
      `node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});`,
      `node["amenity"="doctors"](around:${radiusMeters},${lat},${lon});`
    ];
  } else if (cat.includes("law") || cat.includes("abog") || cat.includes("legal")) {
    filters = [
      `node["office"="lawyer"](around:${radiusMeters},${lat},${lon});`,
      `node["office"="legal"](around:${radiusMeters},${lat},${lon});`
    ];
  } else if (cat.includes("pelu") || cat.includes("barber") || cat.includes("hair") || cat.includes("beauty") || cat.includes("salon")) {
    filters = [
      `node["shop"="hairdresser"](around:${radiusMeters},${lat},${lon});`,
      `node["shop"="beauty"](around:${radiusMeters},${lat},${lon});`
    ];
  } else {
    filters = [
      `node["shop"](around:${radiusMeters},${lat},${lon});`,
      `node["craft"](around:${radiusMeters},${lat},${lon});`,
      `node["office"](around:${radiusMeters},${lat},${lon});`,
      `node["amenity"](around:${radiusMeters},${lat},${lon});`
    ];
  }

  return `[out:json][timeout:8];(\n    ${filters.join("\n    ")}\n  );out center 25;`;
}

/**
 * Executes a single radius search through the Geoapify -> Overpass -> LocationIQ cascade.
 */
async function queryCompetitorsAtRadius(
  targetLat: number,
  targetLon: number,
  radiusMeters: number,
  niche: string,
  city: string,
  businessName: string,
  env: any,
  sourcesUsed: string[]
): Promise<any[]> {
  const competitors: any[] = [];
  const cleanSelf = businessName.toLowerCase().trim();

  // 1. Geoapify Places (Primary)
  const geoapifyKey = env.GEOAPIFY_API_KEY;
  if (geoapifyKey && geoapifyKey.trim() !== "") {
    try {
      const geoCategories = getGeoapifyCategories(niche);
      const geoPlacesUrl = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(
        geoCategories
      )}&filter=circle:${targetLon},${targetLat},${radiusMeters}&bias=proximity:${targetLon},${targetLat}&limit=15&apiKey=${geoapifyKey}`;

      const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(6000)
        : (() => { const c = new AbortController(); setTimeout(() => c.abort(), 6000); return c.signal; })();

      const geoPlacesRes = await fetch(geoPlacesUrl, { signal: timeoutSignal });
      if (geoPlacesRes.ok) {
        const geoPlacesData = await geoPlacesRes.json() as any;
        if (geoPlacesData && Array.isArray(geoPlacesData.features)) {
          for (const hit of geoPlacesData.features) {
            const props = hit.properties;
            if (!props || !props.name) continue;
            const cLow = props.name.toLowerCase().trim();
            if (cLow === cleanSelf || (cleanSelf.length > 3 && (cLow.includes(cleanSelf) || cleanSelf.includes(cLow)))) continue;

            const coords = hit.geometry?.coordinates;
            const lat = typeof props.lat === "number" ? props.lat : (coords && coords.length >= 2 ? coords[1] : targetLat);
            const lon = typeof props.lon === "number" ? props.lon : (coords && coords.length >= 2 ? coords[0] : targetLon);
            const dist = typeof props.distance === "number"
              ? Math.round((props.distance / 1000) * 100) / 100
              : calculateDistanceKm(targetLat, targetLon, lat, lon);

            competitors.push({
              name: props.name,
              category: props.categories?.[0] || niche || "Local Business",
              address: props.formatted || (props.street ? `${props.street} ${props.housenumber || ""}`.trim() : city),
              phone: props.contact?.phone || props.phone || null,
              website: props.contact?.website || props.website || null,
              coordinates: { lat, lng: lon },
              distanceKm: dist,
              rating: null,
              reviewsCount: null,
              source: "Geoapify Places"
            });
          }
          if (competitors.length > 0 && !sourcesUsed.includes("Geoapify Places API")) {
            sourcesUsed.push("Geoapify Places API");
          }
        }
      }
    } catch (geoPlacesErr: any) {
      console.warn("[Cloudflare BusinessScan] Geoapify Places error:", geoPlacesErr?.message || geoPlacesErr);
    }
  }

  // 2. Overpass API (Layer 2) - wrapped safely to prevent scan failures
  if (competitors.length === 0) {
    const overpassEndpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter"
    ];
    const overpassQuery = getOverpassQueryForNiche(niche, targetLat, targetLon, radiusMeters);

    for (const ep of overpassEndpoints) {
      try {
        const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(6000)
          : (() => { const c = new AbortController(); setTimeout(() => c.abort(), 6000); return c.signal; })();

        const opResp = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: timeoutSignal
        });

        if (opResp.ok) {
          const opData = (await opResp.json()) as any;
          if (opData.elements && Array.isArray(opData.elements)) {
            for (const el of opData.elements) {
              if (!el.tags || !(el.tags.name || el.tags["name:es"] || el.tags["name:en"])) continue;
              const name = el.tags.name || el.tags["name:es"] || el.tags["name:en"];
              const cLow = name.toLowerCase().trim();
              if (cLow === cleanSelf || (cleanSelf.length > 3 && (cLow.includes(cleanSelf) || cleanSelf.includes(cLow)))) continue;

              const cLat = el.lat || el.center?.lat || targetLat;
              const cLon = el.lon || el.center?.lon || targetLon;
              const dist = calculateDistanceKm(targetLat, targetLon, cLat, cLon);

              competitors.push({
                name,
                category: el.tags.craft || el.tags.shop || el.tags.office || el.tags.amenity || niche || "Comercio Local",
                address: el.tags["addr:street"] ? `${el.tags["addr:street"]} ${el.tags["addr:housenumber"] || ""}`.trim() : city,
                phone: el.tags.phone || el.tags["contact:phone"] || null,
                website: el.tags.website || el.tags["contact:website"] || null,
                coordinates: { lat: cLat, lng: cLon },
                distanceKm: dist,
                rating: null,
                reviewsCount: null,
                source: "OpenStreetMap Overpass"
              });
            }
            if (competitors.length > 0 && !sourcesUsed.includes("OpenStreetMap Overpass API")) {
              sourcesUsed.push("OpenStreetMap Overpass API");
            }
            break;
          }
        }
      } catch (e: any) {
        console.warn(`[Cloudflare BusinessScan] Overpass endpoint ${ep} failed non-blockingly:`, e?.message || e);
      }
    }
  }

  // 3. LocationIQ Nearby API (Layer 3)
  const locationIqKey = env.LOCATIONIQ_API_KEY;
  if (competitors.length === 0 && locationIqKey && locationIqKey.trim() !== "") {
    try {
      const tag = niche.toLowerCase().includes("lawn") ? "gardener" : "shop";
      const liqNearbyUrl = `https://us1.locationiq.com/v1/nearby?key=${locationIqKey}&lat=${targetLat}&lon=${targetLon}&tag=${tag}&radius=${radiusMeters}&format=json`;
      const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(5000)
        : (() => { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })();

      const liqRes = await fetch(liqNearbyUrl, { signal: timeoutSignal });
      if (liqRes.ok) {
        const liqData = await liqRes.json() as any;
        if (Array.isArray(liqData) && liqData.length > 0) {
          for (const item of liqData) {
            if (!item.name) continue;
            const cLow = item.name.toLowerCase().trim();
            if (cLow === cleanSelf || (cleanSelf.length > 3 && (cLow.includes(cleanSelf) || cleanSelf.includes(cLow)))) continue;

            const cLat = parseFloat(item.lat);
            const cLon = parseFloat(item.lon);
            const dist = calculateDistanceKm(targetLat, targetLon, cLat, cLon);

            competitors.push({
              name: item.name,
              category: item.type || niche || "Comercio Local",
              address: item.display_name || city,
              phone: null,
              website: null,
              coordinates: { lat: cLat, lng: cLon },
              distanceKm: dist,
              rating: null,
              reviewsCount: null,
              source: "LocationIQ Nearby"
            });
          }
          if (competitors.length > 0 && !sourcesUsed.includes("LocationIQ Nearby POI API")) {
            sourcesUsed.push("LocationIQ Nearby POI API");
          }
        }
      }
    } catch (liqErr: any) {
      console.warn("[Cloudflare BusinessScan] LocationIQ Nearby POI error:", liqErr?.message || liqErr);
    }
  }

  // Deduplicate and sort by distance
  const uniqueList: any[] = [];
  for (const c of competitors) {
    const isDup = uniqueList.some(u => 
      u.name.toLowerCase() === c.name.toLowerCase() ||
      (calculateDistanceKm(u.coordinates.lat, u.coordinates.lng, c.coordinates.lat, c.coordinates.lng) < 0.08)
    );
    if (!isDup) uniqueList.push(c);
  }
  uniqueList.sort((a, b) => a.distanceKm - b.distanceKm);

  return uniqueList;
}

/**
 * POST /api/overpass-proxy
 * Edge proxy for Overpass API with in-memory caching and mirror fallback.
 */
export async function handleOverpassProxy(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const query = body?.query;

    if (!query || typeof query !== "string" || !query.trim() || query.length > 4000) {
      return new Response(JSON.stringify({ error: "Query inválida" }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const trimmedQuery = query.trim();

    // Check in-memory cache
    const cached = overpassCache.get(trimmedQuery);
    if (cached && (Date.now() - cached.timestamp < OVERPASS_CACHE_TTL)) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    // Endpoints to try in order (resilient mirrors)
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
    ];

    for (const endpoint of endpoints) {
      try {
        const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(6000)
          : (() => {
              const controller = new AbortController();
              setTimeout(() => controller.abort(), 6000);
              return controller.signal;
            })();

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "BveltRadarBot/2.0 (https://bvelt.com; info@bvelt.com)"
          },
          body: `data=${encodeURIComponent(trimmedQuery)}`,
          signal: timeoutSignal
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = (await res.json()) as any;
            if (data && Array.isArray(data.elements)) {
              const result = { ok: true, elements: data.elements };
              // Store in cache
              overpassCache.set(trimmedQuery, {
                timestamp: Date.now(),
                data: result
              });

              return new Response(JSON.stringify(result), {
                status: 200,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
              });
            }
          }
        }
      } catch (err: any) {
        console.warn(`[handleOverpassProxy] Endpoint ${endpoint} failed:`, err?.message || err);
      }
    }

    // All endpoints failed
    return new Response(JSON.stringify({ ok: false, error: "Overpass no disponible", reason: "provider", elements: [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.warn("[handleOverpassProxy] Unexpected error:", err?.message || err);
    return new Response(JSON.stringify({ ok: false, error: "Overpass no disponible", reason: "provider", elements: [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
}

/**
 * POST /api/business-scan
 */
export async function handleBusinessScan(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { 
      businessName, 
      city, 
      state = "", 
      country = "ES", 
      niche = "",
      radiusKm: inputRadiusKm,
      radiusMeters: inputRadiusMeters
    } = body || {};

    if (!businessName || typeof businessName !== "string" || !businessName.trim()) {
      return new Response(JSON.stringify({
        status: "ERROR",
        errors: ["El nombre del negocio es obligatorio para realizar el análisis."]
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    if (!city || typeof city !== "string" || !city.trim()) {
      return new Response(JSON.stringify({
        status: "ERROR",
        errors: ["La ciudad es obligatoria para realizar el análisis."]
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const isForceRescan = Boolean(body?.forceRescan || body?.forceFresh || body?.forceRefresh || body?.force);
    const requestedRadiusKm = typeof inputRadiusKm === "number" && inputRadiusKm > 0
      ? inputRadiusKm
      : (typeof inputRadiusMeters === "number" && inputRadiusMeters > 0 ? Math.round(inputRadiusMeters / 1000) : 5);

    const todayStr = new Date().toISOString().split("T")[0];
    const cleanName = String(businessName).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanCity = String(city).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanState = String(state).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanNiche = String(niche).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const bizCacheKey = `bizscan:${cleanName}:${cleanCity}:${cleanState}:${cleanNiche}:${requestedRadiusKm}km:${todayStr}`;

    const now = Date.now();
    if (!isForceRescan) {
      const cachedBiz = businessScanCache.get(bizCacheKey);
      if (cachedBiz && (now - cachedBiz.timestamp < SCAN_CACHE_TTL_MS)) {
        return new Response(JSON.stringify({
          ...cachedBiz.data,
          fromCache: true,
          cached: true
        }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }

      if (env && env.SCAN_CACHE_KV && typeof env.SCAN_CACHE_KV.get === "function") {
        try {
          const kvVal = await env.SCAN_CACHE_KV.get(bizCacheKey);
          if (kvVal) {
            const parsed = JSON.parse(kvVal);
            return new Response(JSON.stringify({
              ...parsed,
              fromCache: true,
              cached: true
            }), {
              status: 200,
              headers: CORS_HEADERS
            });
          }
        } catch {}
      }
    }

    // 1. Geocode with Geoapify (Primary) -> LocationIQ -> OpenCage -> Nominatim
    let targetLat: number | null = null;
    let targetLon: number | null = null;
    let resolvedAddress = `${city}, ${country}`;
    let geoVerified = false;
    let sourcesUsed: string[] = [];

    const geoapifyKey = env.GEOAPIFY_API_KEY;
    if (geoapifyKey && geoapifyKey.trim() !== "") {
      try {
        const queryText = `${businessName}, ${city}${state ? " " + state : ""}, ${country}`;
        const geoapifyUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(queryText)}&apiKey=${geoapifyKey}`;
        const geoRes = await fetch(geoapifyUrl);
        if (geoRes.ok) {
          const geoData = await geoRes.json() as any;
          if (geoData && geoData.features && geoData.features.length > 0) {
            const firstHit = geoData.features[0];
            const coords = firstHit.geometry?.coordinates; // [lon, lat]
            const props = firstHit.properties || {};
            if (coords && coords.length >= 2) {
              targetLat = Number(coords[1]);
              targetLon = Number(coords[0]);
              resolvedAddress = props.formatted || `${businessName}, ${city}, ${country}`;
              geoVerified = true;
              sourcesUsed.push("Geoapify Geocoding API");
            }
          }
        }
      } catch (geoErr: any) {
        console.warn("[Cloudflare BusinessScan] Geoapify geocoding failed, attempting fallback:", geoErr.message || geoErr);
      }
    }

    // 1b. Geocode fallback to LocationIQ API
    const locationIqKey = env.LOCATIONIQ_API_KEY;
    if (!geoVerified && locationIqKey && locationIqKey.trim() !== "") {
      try {
        const queryText = `${businessName}, ${city}${state ? " " + state : ""}, ${country}`;
        const liqUrl = `https://us1.locationiq.com/v1/search?key=${locationIqKey}&q=${encodeURIComponent(queryText)}&format=json&limit=1`;
        const liqRes = await fetch(liqUrl);
        if (liqRes.ok) {
          const liqData = await liqRes.json() as any;
          if (Array.isArray(liqData) && liqData.length > 0) {
            targetLat = parseFloat(liqData[0].lat);
            targetLon = parseFloat(liqData[0].lon);
            resolvedAddress = liqData[0].display_name || resolvedAddress;
            geoVerified = true;
            sourcesUsed.push("LocationIQ Geocoding API");
          }
        }
      } catch (liqErr: any) {
        console.warn("[Cloudflare BusinessScan] LocationIQ geocoding fallback warning:", liqErr?.message || liqErr);
      }
    }

    // 1c. Geocode fallback to OpenCage Data API
    const openCageKey = env.OPENCAGE_API_KEY;
    if (!geoVerified && openCageKey && openCageKey.trim() !== "") {
      try {
        const queryText = `${businessName}, ${city}${state ? " " + state : ""}, ${country}`;
        const ocUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(queryText)}&key=${openCageKey}&limit=1`;
        const ocRes = await fetch(ocUrl);
        if (ocRes.ok) {
          const ocData = await ocRes.json() as any;
          if (ocData && ocData.results && ocData.results.length > 0) {
            targetLat = ocData.results[0].geometry.lat;
            targetLon = ocData.results[0].geometry.lng;
            resolvedAddress = ocData.results[0].formatted || resolvedAddress;
            geoVerified = true;
            sourcesUsed.push("OpenCage Geocoding API");
          }
        }
      } catch (ocErr: any) {
        console.warn("[Cloudflare BusinessScan] OpenCage geocoding fallback warning:", ocErr?.message || ocErr);
      }
    }

    // Fallback to Nominatim if Geoapify, LocationIQ, and OpenCage are not configured or fail
    if (!geoVerified) {
      try {
        const geoQuery = encodeURIComponent(`${city}, ${state ? state + ', ' : ''}${country}`);
        const nomResp = await fetch(`https://nominatim.openstreetmap.org/search?q=${geoQuery}&format=json&limit=1`, {
          headers: { "User-Agent": "BveltBusinessScan/1.0" }
        });
        if (nomResp.ok) {
          const nomData = (await nomResp.json()) as any;
          if (Array.isArray(nomData) && nomData.length > 0) {
            targetLat = parseFloat(nomData[0].lat);
            targetLon = parseFloat(nomData[0].lon);
            resolvedAddress = nomData[0].display_name || resolvedAddress;
            geoVerified = true;
            sourcesUsed.push("OpenStreetMap Nominatim");
          }
        }
      } catch (e) {
        console.warn("[Cloudflare BusinessScan] Geocoding warning:", e);
      }
    }

    // 2. Cascade: Geoapify Places -> Overpass API -> LocationIQ with automatic radius expansion (up to 25km)
    let competitors: any[] = [];
    let effectiveRadiusKm = requestedRadiusKm;

    if (targetLat !== null && targetLon !== null) {
      // Step 1: Query at initial requested radius (e.g. 5km)
      const initialRadiusMeters = requestedRadiusKm * 1000;
      competitors = await queryCompetitorsAtRadius(
        targetLat,
        targetLon,
        initialRadiusMeters,
        niche,
        city,
        businessName,
        env,
        sourcesUsed
      );

      // Step 2: If 0 competitors and initial radius was < 10km, auto-expand to 10km (Retry 1)
      if (competitors.length === 0 && requestedRadiusKm < 10) {
        effectiveRadiusKm = 10;
        competitors = await queryCompetitorsAtRadius(
          targetLat,
          targetLon,
          10000,
          niche,
          city,
          businessName,
          env,
          sourcesUsed
        );
      }

      // Step 3: If still 0 competitors and radius was < 25km, auto-expand to 25km (Retry 2)
      if (competitors.length === 0 && effectiveRadiusKm < 25) {
        effectiveRadiusKm = 25;
        competitors = await queryCompetitorsAtRadius(
          targetLat,
          targetLon,
          25000,
          niche,
          city,
          businessName,
          env,
          sourcesUsed
        );
      }
    }

    const topCompetitors = competitors.slice(0, 10);

    // Formulate honest UI message and actionable next actions
    let messageForUi = "";
    let nextActions: any[] = [];
    const suggestedRadii = [10, 25];
    const lang = body?.language === "en" || request.headers.get("accept-language")?.includes("en") ? "en" : "es";

    if (topCompetitors.length > 0) {
      messageForUi = lang === "en"
        ? `Detected ${topCompetitors.length} local competitors within a ${effectiveRadiusKm} km radius.`
        : `Se detectaron ${topCompetitors.length} competidores locales en un radio de ${effectiveRadiusKm} km.`;
      nextActions = [
        {
          id: "act_view_map",
          action: "view_map",
          title: { es: "Ver en Mapa de Cobertura", en: "View on Coverage Map" },
          description: { es: "Compara tu posición frente a los competidores más cercanos.", en: "Compare your position against nearby competitors." },
          targetTab: "growth",
          actionLabel: { es: "Ver Mapa", en: "View Map" }
        },
        {
          id: "act_outrank_competitors",
          action: "navigate",
          title: { es: "Superar Competidores con SEO Local", en: "Outrank Competitors with Local SEO" },
          description: { es: "Optimiza tu ficha de Google Maps para superar a los competidores en búsquedas.", en: "Optimize your Google Maps profile to outrank competitors." },
          targetTab: "growth",
          actionLabel: { es: "Optimizar SEO", en: "Optimize SEO" }
        }
      ];
    } else {
      messageForUi = lang === "en"
        ? `0 competitors detected in OpenStreetMap/Geoapify for "${niche || 'services'}" in ${city} (radius ${effectiveRadiusKm} km). There are no recorded local competitors nearby.`
        : `0 competidores detectados en OSM/Geoapify para "${niche || 'servicios'}" en ${city} (radio ${effectiveRadiusKm} km). Sin datos de competidores registrados.`;
      nextActions = [
        {
          id: "retry_10km",
          action: "expand_radius",
          radiusKm: 10,
          title: { es: "Reintentar a 10 km", en: "Retry at 10 km" },
          description: { es: "Re-ejecutar consulta en cascada Geoapify → Overpass → LocationIQ a 10 km.", en: "Re-execute cascade query Geoapify → Overpass → LocationIQ at 10 km." },
          targetTab: "scan",
          actionLabel: { es: "⚡ Reintentar a 10 km", en: "⚡ Retry at 10 km" }
        },
        {
          id: "retry_25km",
          action: "expand_radius",
          radiusKm: 25,
          title: { es: "Reintentar a 25 km", en: "Retry at 25 km" },
          description: { es: "Re-ejecutar consulta a 25 km para cubrir toda la zona metropolitana.", en: "Re-execute cascade query at 25 km covering metro area." },
          targetTab: "scan",
          actionLabel: { es: "⚡ Reintentar a 25 km", en: "⚡ Retry at 25 km" }
        },
        {
          id: "act_verify_category",
          action: "navigate",
          title: { es: "Verificar Categoría y Perfil", en: "Verify Trade Category & Profile" },
          description: { es: "Confirma la categoría de negocio principal para asegurar búsquedas precisas en mapas.", en: "Confirm primary business category to ensure accurate map searches." },
          targetTab: "profile",
          actionLabel: { es: "Revisar Categoría", en: "Review Category" }
        }
      ];
    }

    // 3. AI Market Intelligence Synthesis
    let marketDifficulty: "Baja" | "Media" | "Alta" = topCompetitors.length > 5 ? "Alta" : topCompetitors.length > 0 ? "Media" : "Baja";
    let marketSummary = (targetLat !== null && targetLon !== null)
      ? (topCompetitors.length > 0 
          ? `Análisis completado para ${businessName} en ${city}. Se detectaron ${topCompetitors.length} competidores directos en un radio de ${effectiveRadiusKm} km.`
          : `Análisis completado para ${businessName} en ${city}. Mercado despejado sin competidores directos registrados en ${effectiveRadiusKm} km. Oportunidad ideal para liderar búsquedas locales.`)
      : `Análisis parcial completado para ${businessName} en ${city}. No se pudieron determinar competidores directos debido a la falta de coordenadas geográficas.`;
    let keyOpportunities = [
      "Optimizar ficha de Google Maps para búsquedas de alta intención.",
      "Aumentar volumen de reseñas auténticas con palabras clave del sector.",
      "Asegurar consistencia de datos NAP (Nombre, Dirección, Teléfono) en directorios locales."
    ];

    let isAiDegraded = false;
    try {
      const prompt = `Analiza la posición competitiva de "${businessName}" (${niche || 'Servicios Locales'}) en ${city}. 
Competidores detectados en la zona (${effectiveRadiusKm}km): ${topCompetitors.map(c => `${c.name} (${c.category})`).join(', ') || 'Ninguno en el radio exacto'}.
Devuelve un JSON estricto con:
- marketDifficulty: "Baja" | "Media" | "Alta"
- marketSummary: resumen ejecutivo de 2 oraciones
- keyOpportunities: array de 3 oportunidades estratégicas accionables`;

      const aiText = await callGeminiApi(env, prompt, "Eres un analista de inteligencia de mercado local. Devuelve solo JSON válido.", ACTIVE_MODELS.GEMINI_PRIMARY);
      if (aiText) {
        const cleaned = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.marketDifficulty) marketDifficulty = parsed.marketDifficulty;
        if (parsed.marketSummary) marketSummary = parsed.marketSummary;
        if (Array.isArray(parsed.keyOpportunities)) keyOpportunities = parsed.keyOpportunities;
      }
    } catch (e: any) {
      console.warn("[Cloudflare BusinessScan] AI synthesis rate limited or offline. Using map analysis fallback:", e?.message || e);
      isAiDegraded = true;
      marketSummary = (targetLat !== null && targetLon !== null)
        ? `Análisis de mercado basado en geolocalización directa (${topCompetitors.length} competidores en ${effectiveRadiusKm}km).`
        : `Análisis parcial basado en registros locales.`;
    }

    const scanStatus = (targetLat !== null && targetLon !== null) ? "SUCCESS" : "PARTIAL";

    const responsePayload = {
      status: scanStatus,
      data: {
        business: {
          name: businessName,
          city,
          state,
          country,
          niche: niche || "Servicios Locales",
          resolvedAddress,
          coordinates: { lat: targetLat, lng: targetLon }
        },
        marketAnalysis: {
          difficulty: marketDifficulty,
          competitorCount: topCompetitors.length,
          summary: marketSummary,
          opportunities: keyOpportunities
        },
        competitors: topCompetitors,
        sourcesUsed,
        messageForUi,
        nextActions,
        suggestedRadii,
        radiusKm: effectiveRadiusKm,
        scannedAt: new Date().toISOString()
      },
      competitors: topCompetitors,
      sourcesUsed,
      messageForUi,
      nextActions,
      suggestedRadii,
      radiusKm: effectiveRadiusKm,
      fromCache: false,
      cached: false,
      isDegraded: isAiDegraded
    };

    // Save to memory cache
    businessScanCache.set(bizCacheKey, { timestamp: now, data: responsePayload });
    if (env && env.SCAN_CACHE_KV && typeof env.SCAN_CACHE_KV.put === "function") {
      try {
        await env.SCAN_CACHE_KV.put(bizCacheKey, JSON.stringify(responsePayload), { expirationTtl: 86400 });
      } catch {}
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    console.error("[Cloudflare BusinessScan] Error:", error);
    return new Response(JSON.stringify({
      status: "ERROR",
      errors: [error.message || "Error al procesar el escaneo de mercado."]
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

/**
 * POST /api/scan-maps & /api/reparar-perfil
 */
export async function handleScanMaps(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { dataMaps = {}, datosProyecto = {}, location = "Madrid", niche = "Servicios Locales" } = body || {};

    const nombreNegocio = dataMaps.name || datosProyecto.businessName || null;
    const direccion = dataMaps.address || datosProyecto.address || location;
    const calificacion = dataMaps.rating !== undefined ? dataMaps.rating : null;
    const totalResenas = dataMaps.reviews !== undefined ? dataMaps.reviews : null;
    const tieneWeb = Boolean(dataMaps.website || datosProyecto.website);

    // 0. Cache Check (24h TTL)
    const isForceRescan = Boolean(body?.forceRescan || body?.forceFresh || body?.forceRefresh || body?.force);
    const todayStr = new Date().toISOString().split("T")[0];
    const cleanName = String(nombreNegocio || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanAddr = String(direccion || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanNiche = String(niche || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const mapsCacheKey = `scanmaps:${cleanName}:${cleanAddr}:${cleanNiche}:${todayStr}`;

    const now = Date.now();
    if (!isForceRescan) {
      const cachedMap = scanMapsCache.get(mapsCacheKey);
      if (cachedMap && (now - cachedMap.timestamp < SCAN_CACHE_TTL_MS)) {
        return new Response(JSON.stringify({
          ...cachedMap.data,
          fromCache: true,
          cached: true
        }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }

      if (env && env.SCAN_CACHE_KV && typeof env.SCAN_CACHE_KV.get === "function") {
        try {
          const kvVal = await env.SCAN_CACHE_KV.get(mapsCacheKey);
          if (kvVal) {
            const parsed = JSON.parse(kvVal);
            return new Response(JSON.stringify({
              ...parsed,
              fromCache: true,
              cached: true
            }), {
              status: 200,
              headers: CORS_HEADERS
            });
          }
        } catch {}
      }
    }

    // Micro-agent synthesis prompt
    const agentPrompt = `Analiza la ficha de Google Maps para el siguiente negocio local:
- Nombre: ${nombreNegocio || "No especificado"}
- Ubicación: ${direccion}
- Calificación: ${calificacion !== null ? calificacion + ' estrellas' : 'No disponible'} (${totalResenas !== null ? totalResenas + ' reseñas' : 'Sin datos de reseñas'})
- Web registrada: ${tieneWeb ? 'Sí' : 'No'}
- Categoría: ${niche}

Genera 3 diagnósticos estructurados:
1. Agente 1 (Gap Analysis): Estimación de pérdida de ingresos mensual (o null si falta evidencia) y 3 puntos críticos a corregir.
2. Agente 2 (Plan de Acción): 3 pasos inmediatos prioritarios.
3. Agente 3 (Diferenciación Competitiva): Propuesta de posicionamiento único.

Devuelve estrictamente un JSON con las claves:
{
  "agente1": { "loss_estimate": number | null, "critical_gaps": string[], "market_difficulty": "Low" | "Medium" | "High" },
  "agente2": { "action_plan": string[], "priority": "Urgent" | "Standard" },
  "agente3": { "positioning_statement": string, "competitive_advantage": string }
}`;

    let result: any = {
      agente1: {
        loss_estimate: (calificacion !== null && totalResenas !== null) ? (tieneWeb ? 450 : 1200) : null,
        critical_gaps: [
          !tieneWeb ? "Sin sitio web conectado en Google Maps." : "Frecuencia de respuesta a reseñas inferior al promedio local.",
          (calificacion !== null && calificacion < 4.5) ? "Calificación por debajo del umbral de conversión óptimo (4.5★)." : "Volumen de reseñas requiere verificación de evidencia.",
          "Falta de catálogo de servicios optimizado para SEO local."
        ],
        market_difficulty: "Medium"
      },
      agente2: {
        action_plan: [
          "Reclamar y verificar la ficha completa con fotos reales actualizadas.",
          "Implementar embudo de solicitud de reseñas por WhatsApp o SMS.",
          "Vincular un enlace web optimizado para conversión."
        ],
        priority: "Urgent"
      },
      agente3: {
        positioning_statement: `Líder en servicio personalizado y respuesta rápida en ${location}.`,
        competitive_advantage: "Atención directa sin intermediarios con garantía de servicio."
      }
    };

    let isAiDegraded = false;
    try {
      const aiText = await callGeminiApi(env, agentPrompt, "Eres un sistema multi-agente de optimización de Google Maps. Devuelve JSON exclusivamente.", ACTIVE_MODELS.GEMINI_PRIMARY);
      if (aiText) {
        const cleaned = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.agente1 && parsed.agente2 && parsed.agente3) {
          result = parsed;
        }
      }
    } catch (e: any) {
      console.warn("[Cloudflare ScanMaps] AI agent synthesis offline or rate limited, using deterministic diagnostics:", e?.message || e);
      isAiDegraded = true;
    }

    const mapResponsePayload = {
      success: true,
      ...result,
      business: {
        name: nombreNegocio,
        address: direccion,
        rating: calificacion,
        reviews: totalResenas,
        hasWebsite: tieneWeb
      },
      timestamp: new Date().toISOString(),
      fromCache: false,
      cached: false,
      isDegraded: isAiDegraded
    };

    // Save to memory and KV cache
    scanMapsCache.set(mapsCacheKey, { timestamp: now, data: mapResponsePayload });
    if (env && env.SCAN_CACHE_KV && typeof env.SCAN_CACHE_KV.put === "function") {
      try {
        await env.SCAN_CACHE_KV.put(mapsCacheKey, JSON.stringify(mapResponsePayload), { expirationTtl: 86400 });
      } catch {}
    }

    return new Response(JSON.stringify(mapResponsePayload), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    console.error("[Cloudflare ScanMaps] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Error al procesar el escaneo de mapa."
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

