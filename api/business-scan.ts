import { Request, Response } from "express";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import { ACTIVE_MODELS, isProviderAvailable, setGeminiCooldown, fetchOverpassWithCache, callNodeAiText } from "./ai-config.ts";
import { persistBusinessScanToBem, persistCompetitorPoiToBem } from "../src/knowledge/memory/index.ts";
import { resolveGeocode, findLocalCompetitors } from "./geo-providers.ts";

// TTLLRUCache implementation for server-side scan results caching
class TTLLRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxEntries: number;
  private ttl: number;

  constructor(maxEntries: number, ttl: number) {
    this.maxEntries = maxEntries;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    // Refresh for LRU eviction
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }
}

const businessScanCache = new TTLLRUCache<string, any>(100, 24 * 60 * 60 * 1000);

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getOverpassQuery(nicheTerm: string, latitude: number, longitude: number, radius = 5000): string {
  const cat = nicheTerm.toLowerCase();
  let subqueries: string[] = [];

  if (
    cat.includes('lawn') || 
    cat.includes('jardin') || 
    cat.includes('landscap') || 
    cat.includes('poda') || 
    cat.includes('cesped') || 
    cat.includes('mow') || 
    cat.includes('tree') || 
    cat.includes('yard')
  ) {
    subqueries = [
      `nwr["craft"~"gardener|landscaper|landscaping|lawn_mower|tree_surgeon|gardening"](around:${radius}, ${latitude}, ${longitude});`,
      `nwr["shop"~"garden_centre|trade"](around:${radius}, ${latitude}, ${longitude});`,
      `nwr["office"~"company|contractor"]["name"~"lawn|landscap|jardin|tree|green|turf|mow|yard",i](around:${radius}, ${latitude}, ${longitude});`,
      `nwr["name"~"lawn|landscaping|landscaper|tree service|turf",i]["craft"](around:${radius}, ${latitude}, ${longitude});`,
      `nwr["name"~"lawn|landscaping|landscaper|tree service|turf",i]["shop"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else if (
    cat.includes('restauran') || 
    cat.includes('comida') || 
    cat.includes('food') || 
    cat.includes('caf') || 
    cat.includes('pizz') || 
    cat.includes('bar') || 
    cat.includes('pub') || 
    cat.includes('bistr') || 
    cat.includes('bakery') || 
    cat.includes('panad')
  ) {
    subqueries = [
      `node["amenity"="restaurant"](around:${radius}, ${latitude}, ${longitude});`,
      `way["amenity"="restaurant"](around:${radius}, ${latitude}, ${longitude});`,
      `node["amenity"="cafe"](around:${radius}, ${latitude}, ${longitude});`,
      `way["amenity"="cafe"](around:${radius}, ${latitude}, ${longitude});`,
      `node["amenity"="fast_food"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else if (
    cat.includes('shop') || 
    cat.includes('tienda') || 
    cat.includes('supermerca') || 
    cat.includes('retail') || 
    cat.includes('boutique') || 
    cat.includes('market') || 
    cat.includes('store') ||
    cat.includes('comercio')
  ) {
    subqueries = [
      `node["shop"](around:${radius}, ${latitude}, ${longitude});`,
      `way["shop"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else if (
    cat.includes('construc') || 
    cat.includes('refor') || 
    cat.includes('contract') || 
    cat.includes('roof') || 
    cat.includes('builder')
  ) {
    subqueries = [
      `node["craft"="builder"](around:${radius}, ${latitude}, ${longitude});`,
      `way["craft"="builder"](around:${radius}, ${latitude}, ${longitude});`,
      `node["office"="construction"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else if (
    cat.includes('plome') || 
    cat.includes('fonta') || 
    cat.includes('plumb')
  ) {
    subqueries = [
      `node["craft"="plumber"](around:${radius}, ${latitude}, ${longitude});`,
      `way["craft"="plumber"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else if (
    cat.includes('abog') || 
    cat.includes('law') || 
    cat.includes('legal') || 
    cat.includes('asesor')
  ) {
    subqueries = [
      `node["office"="lawyer"](around:${radius}, ${latitude}, ${longitude});`,
      `way["office"="lawyer"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else if (
    cat.includes('dent') || 
    cat.includes('clini') || 
    cat.includes('medic') || 
    cat.includes('salud') || 
    cat.includes('health')
  ) {
    subqueries = [
      `node["amenity"="dentist"](around:${radius}, ${latitude}, ${longitude});`,
      `node["amenity"="clinic"](around:${radius}, ${latitude}, ${longitude});`,
      `node["amenity"="doctors"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else if (
    cat.includes('pelu') || 
    cat.includes('barber') || 
    cat.includes('hair') || 
    cat.includes('esteti') || 
    cat.includes('beauty') || 
    cat.includes('salon')
  ) {
    subqueries = [
      `node["shop"="hairdresser"](around:${radius}, ${latitude}, ${longitude});`,
      `node["shop"="beauty"](around:${radius}, ${latitude}, ${longitude});`
    ];
  } else {
    subqueries = [
      `node["shop"](around:${radius}, ${latitude}, ${longitude});`,
      `node["amenity"="restaurant"](around:${radius}, ${latitude}, ${longitude});`,
      `node["office"](around:${radius}, ${latitude}, ${longitude});`,
      `node["craft"](around:${radius}, ${latitude}, ${longitude});`
    ];
  }

  return `[out:json][timeout:15];(
    ${subqueries.join('\n    ')}
  );out body;>;out skel qt;`;
}

function getGeoapifyCategories(nicheTerm: string): string {
  const cat = nicheTerm.toLowerCase();
  if (
    cat.includes('lawn') || 
    cat.includes('jardin') || 
    cat.includes('landscap') || 
    cat.includes('poda') || 
    cat.includes('cesped') || 
    cat.includes('mow') || 
    cat.includes('tree') || 
    cat.includes('yard')
  ) {
    return 'service.handyman,service,commercial.garden_centre,commercial,office';
  } else if (
    cat.includes('restauran') || 
    cat.includes('comida') || 
    cat.includes('food') || 
    cat.includes('caf') || 
    cat.includes('pizz') || 
    cat.includes('bar') || 
    cat.includes('pub') || 
    cat.includes('bistr') || 
    cat.includes('bakery') || 
    cat.includes('panad')
  ) {
    return 'catering.restaurant,catering.cafe,catering.fast_food,catering.bar';
  } else if (
    cat.includes('shop') || 
    cat.includes('tienda') || 
    cat.includes('supermerca') || 
    cat.includes('retail') || 
    cat.includes('boutique') || 
    cat.includes('market') || 
    cat.includes('store') ||
    cat.includes('comercio')
  ) {
    return 'commercial.supermarket,commercial.clothing,commercial.food_and_drink,commercial';
  } else if (
    cat.includes('construc') || 
    cat.includes('refor') || 
    cat.includes('contract') || 
    cat.includes('roof') || 
    cat.includes('builder')
  ) {
    return 'service.handyman,building.construction,office';
  } else if (
    cat.includes('plome') || 
    cat.includes('fonta') || 
    cat.includes('plumb')
  ) {
    return 'service.handyman,service';
  } else if (
    cat.includes('abog') || 
    cat.includes('law') || 
    cat.includes('legal') || 
    cat.includes('asesor')
  ) {
    return 'office.lawyer,office.financial,office.consulting,office';
  } else if (
    cat.includes('dent') || 
    cat.includes('clini') || 
    cat.includes('medic') || 
    cat.includes('salud') || 
    cat.includes('health')
  ) {
    return 'healthcare.dentist,healthcare.clinic,healthcare.doctor';
  } else if (
    cat.includes('pelu') || 
    cat.includes('barber') || 
    cat.includes('hair') || 
    cat.includes('esteti') || 
    cat.includes('beauty') || 
    cat.includes('salon')
  ) {
    return 'service.beauty,service.hairdresser,service';
  } else if (
    cat.includes('auto') || 
    cat.includes('mecanic') || 
    cat.includes('taller') || 
    cat.includes('car')
  ) {
    return 'service.vehicle,commercial.vehicle';
  }
  return 'commercial,service,office,catering';
}

function deduplicateCompetitors(candidates: any[], selfName: string): any[] {
  const cleanSelf = selfName.toLowerCase().trim();
  // 1. Exclude self
  const filtered = candidates.filter((c) => {
    if (!c.name || typeof c.name !== 'string') return false;
    const cLow = c.name.toLowerCase().trim();
    if (cLow === cleanSelf) return false;
    if (cleanSelf.length > 3 && (cLow.includes(cleanSelf) || cleanSelf.includes(cLow))) return false;
    return true;
  });

  const deduplicated: any[] = [];

  for (const cand of filtered) {
    const normName = cand.name.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
    
    // Check if already matched with an existing item in deduplicated
    const existingIdx = deduplicated.findIndex((existing) => {
      // Exact place id match
      if (cand.id && existing.id && cand.id === existing.id) return true;
      
      // Proximity + name match
      const distBetween = haversineDistance(cand.latitude, cand.longitude, existing.latitude, existing.longitude);
      const existingNorm = existing.name.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
      
      // Close distance (<80m) and matching or containing names
      if (distBetween < 0.08) {
        if (normName === existingNorm || normName.includes(existingNorm) || existingNorm.includes(normName)) {
          return true;
        }
      }
      // Exact normalized name within 500m
      if (distBetween < 0.5 && normName.length >= 4 && normName === existingNorm) {
        return true;
      }
      return false;
    });

    if (existingIdx >= 0) {
      // Merge non-null fields
      const ex = deduplicated[existingIdx];
      if (!ex.phone && cand.phone) ex.phone = cand.phone;
      if (!ex.website && cand.website) ex.website = cand.website;
      if (!ex.address && cand.address) ex.address = cand.address;
      if (ex.source !== cand.source && !ex.source.includes(cand.source)) {
        ex.source = `${ex.source}, ${cand.source}`;
      }
    } else {
      deduplicated.push({ ...cand });
    }
  }

  // Sort by distance (nearest first)
  deduplicated.sort((a, b) => a.distanceKm - b.distanceKm);

  // Bounded to 10 results
  return deduplicated.slice(0, 10);
}

export async function businessScanHandler(req: Request, res: Response): Promise<void> {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const { businessName, city, state = "", country = "ES", niche = "", isCompetitorAudit, sourceType, sourceLabel } = req.body || {};

    if (!businessName || typeof businessName !== "string" || !businessName.trim()) {
      res.status(400).json({
        status: "ERROR",
        errors: ["El nombre del negocio es obligatorio para realizar el análisis."],
      });
      return;
    }

    if (!city || typeof city !== "string" || !city.trim()) {
      res.status(400).json({
        status: "ERROR",
        errors: ["La ciudad es obligatoria para realizar el análisis."],
      });
      return;
    }

    const cleanBusinessName = businessName.trim();
    const cleanCity = city.trim();
    const cleanState = typeof state === "string" ? state.trim() : "";
    const cleanCountry = typeof country === "string" ? country.trim() : "ES";
    const isRadarSource = Boolean(isCompetitorAudit || sourceType === "RADAR" || sourceType === "OSM_RADAR" || sourceType === "COMPETITOR_GAP");
    const effectiveSourceType = isRadarSource ? "OSM_RADAR" : (typeof sourceType === "string" && sourceType.trim() ? sourceType.trim() : "BUSINESS_PROFILE");
    const inputSourceLabel = typeof sourceLabel === "string" && sourceLabel.trim() 
      ? sourceLabel.trim() 
      : (isRadarSource ? "Radar de Competencia / Mapa" : "Entrada del Usuario");
    
    // Knowledge Layer: Utilize Industry Resolver if provided
    const cleanNiche = req.body?._resolvedIndustry?.canonicalIndustry || (typeof niche === "string" ? niche.trim() : "");
    const liveSourcesApproved = req.body?._acquisitionPlan?.liveSourcesApproved || ['geoapify', 'tavily', 'you'];
    const needsLiveEnrichment = req.body?._acquisitionPlan?.needsLiveEnrichment || ['location', 'competitors', 'web_presence'];

    const todayDate = new Date().toISOString().split("T")[0];
    const cacheKey = `${cleanBusinessName.toLowerCase()}_${cleanCity.toLowerCase()}_${cleanState.toLowerCase()}_${todayDate}`;
    const cachedResult = businessScanCache.get(cacheKey);

    if (cachedResult) {
      res.status(200).json({
        ...cachedResult,
        isCached: true,
        fromCache: true
      });
      return;
    }

    const sourcesUsed: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const nowIso = new Date().toISOString();

    // 1. Identity & Location Resolution Pipeline
    let locationData = {
      latitude: null as number | null,
      longitude: null as number | null,
      formattedAddress: null as string | null,
      confidence: 0,
      provider: "unverified" as "geoapify" | "nominatim" | "unverified",
    };

    let geoVerified = false;

    // Geoapify (Server-side API Key check)
    const geoapifyKey = process.env.GEOAPIFY_API_KEY;
    if (geoapifyKey && liveSourcesApproved.includes('geoapify')) {
      try {
        const queryText = `${cleanBusinessName}, ${cleanCity}${cleanState ? " " + cleanState : ""}`;
        const geoapifyUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
          queryText
        )}&apiKey=${geoapifyKey}`;

        const geoRes = await axios.get(geoapifyUrl, { timeout: 5000 });
        if (geoRes.data && geoRes.data.features && geoRes.data.features.length > 0) {
          const firstHit = geoRes.data.features[0];
          const coords = firstHit.geometry?.coordinates; // [lon, lat]
          const props = firstHit.properties || {};

          if (coords && coords.length >= 2) {
            locationData = {
              latitude: Number(coords[1]),
              longitude: Number(coords[0]),
              formattedAddress: props.formatted || `${cleanBusinessName}, ${cleanCity}, ${cleanState}`,
              confidence: props.rank?.confidence || 0.9,
              provider: "geoapify",
            };
            geoVerified = true;
            sourcesUsed.push("Geoapify Geocoding API");
          }
        }
      } catch (geoErr) {
        console.warn("[BusinessScan] Geoapify resolution failed, attempting fallback:", (geoErr as any)?.message);
        warnings.push("No se pudo conectar con la fuente Geoapify; utilizando geocodificador secundario.");
      }
    }

    // Multi-provider Geocoding fallback (LocationIQ -> OpenCage -> ORS -> Nominatim)
    if (!geoVerified) {
      try {
        const queryText = `${cleanBusinessName}, ${cleanCity}${cleanState ? " " + cleanState : ""}`;
        const geoRes = await resolveGeocode(queryText);
        if (geoRes && typeof geoRes.lat === "number" && typeof geoRes.lng === "number") {
          locationData = {
            latitude: geoRes.lat,
            longitude: geoRes.lng,
            formattedAddress: geoRes.formattedAddress || `${cleanBusinessName}, ${cleanCity}, ${cleanState}`,
            confidence: geoRes.confidence || 0.85,
            provider: (geoRes.provider.toLowerCase().includes("geoapify") ? "geoapify" : "nominatim") as any,
          };
          geoVerified = true;
          sourcesUsed.push(`${geoRes.provider} Geocoding`);
        }
      } catch (rErr) {
        // Fallback to OSM direct
      }
    }

    // Fallback to Nominatim OSM if still not verified
    if (!geoVerified) {
      try {
        const nomQuery = `${cleanBusinessName} ${cleanCity} ${cleanState}`;
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          nomQuery
        )}&limit=1`;

        const nomRes = await axios.get(nomUrl, {
          headers: { "User-Agent": "BveltBusinessScan/1.0 (contacto@bvelt.com)" },
          timeout: 5000,
        });

        if (Array.isArray(nomRes.data) && nomRes.data.length > 0) {
          const nomHit = nomRes.data[0];
          locationData = {
            latitude: parseFloat(nomHit.lat),
            longitude: parseFloat(nomHit.lon),
            formattedAddress: nomHit.display_name || `${cleanBusinessName}, ${cleanCity}, ${cleanState}`,
            confidence: 0.8,
            provider: "nominatim",
          };
          geoVerified = true;
          sourcesUsed.push("OpenStreetMap Nominatim");
        } else {
          // Fallback to city center
          const cityQuery = `${cleanCity} ${cleanState}`;
          const cityNomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            cityQuery
          )}&limit=1`;
          const cityRes = await axios.get(cityNomUrl, {
            headers: { "User-Agent": "BveltBusinessScan/1.0 (contacto@bvelt.com)" },
            timeout: 4000,
          });

          if (Array.isArray(cityRes.data) && cityRes.data.length > 0) {
            const cityHit = cityRes.data[0];
            locationData = {
              latitude: parseFloat(cityHit.lat),
              longitude: parseFloat(cityHit.lon),
              formattedAddress: `${cleanCity}, ${cleanState} (Centro aproximado)`,
              confidence: 0.5,
              provider: "nominatim",
            };
            sourcesUsed.push("OpenStreetMap Nominatim (City Level)");
          }
        }
      } catch (nomErr) {
        console.warn("[BusinessScan] Nominatim fallback failed:", (nomErr as any)?.message);
        warnings.push("Geocodificación aproximada por restricciones de red.");
      }
    }

    // 2. Real Competitor Scanning via Geoapify Places & OpenStreetMap Overpass with auto-expansion
    let competitors: any[] = [];
    const requestedRadiusKm = typeof req.body?.radiusKm === "number" && req.body.radiusKm > 0 
      ? req.body.radiusKm 
      : (typeof req.body?.radiusMeters === "number" && req.body.radiusMeters > 0 ? Math.round(req.body.radiusMeters / 1000) : 5);
    let effectiveRadiusKm = requestedRadiusKm;

    if (locationData.latitude && locationData.longitude && needsLiveEnrichment.includes('competitors')) {
      const fetchAtRadius = async (rKm: number): Promise<any[]> => {
        const candidateList: any[] = [];
        const radiusMeters = rKm * 1000;

        // 2a. Geoapify Places API (Bounded live competitor discovery)
        if (geoapifyKey && liveSourcesApproved.includes('geoapify')) {
          try {
            const geoCategories = getGeoapifyCategories(cleanNiche);
            const geoPlacesUrl = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(
              geoCategories
            )}&filter=circle:${locationData.longitude},${locationData.latitude},${radiusMeters}&bias=proximity:${locationData.longitude},${locationData.latitude}&limit=15&apiKey=${geoapifyKey}`;

            const geoPlacesRes = await axios.get(geoPlacesUrl, { timeout: 5000 });
            if (geoPlacesRes.data && Array.isArray(geoPlacesRes.data.features)) {
              const geoHits = geoPlacesRes.data.features;
              for (const hit of geoHits) {
                const props = hit.properties || {};
                const coords = hit.geometry?.coordinates;
                const lat = typeof props.lat === 'number' ? props.lat : (coords && coords.length >= 2 ? coords[1] : null);
                const lon = typeof props.lon === 'number' ? props.lon : (coords && coords.length >= 2 ? coords[0] : null);
                if (!props.name || lat === null || lon === null) continue;

                const dist = typeof props.distance === 'number' 
                  ? Number((props.distance / 1000).toFixed(2)) 
                  : Number(haversineDistance(locationData.latitude!, locationData.longitude!, lat, lon).toFixed(2));

                candidateList.push({
                  id: props.place_id || null,
                  name: props.name,
                  latitude: lat,
                  longitude: lon,
                  distanceKm: dist,
                  category: props.categories?.[0] || cleanNiche || "Local Business",
                  phone: props.contact?.phone || props.phone || null,
                  website: props.contact?.website || props.website || null,
                  address: props.formatted || (props.street ? `${props.street} ${props.housenumber || ""}`.trim() : null),
                  source: "geoapify",
                  retrievedAt: nowIso,
                  evidenceStatus: "VERIFIED",
                });
              }

              if (candidateList.length > 0 && !sourcesUsed.includes("Geoapify Places API")) {
                sourcesUsed.push("Geoapify Places API");
              }
            }
          } catch (geoPlacesErr: any) {
            console.warn("[BusinessScan] Geoapify Places competitor fetching failed:", geoPlacesErr.message || geoPlacesErr);
          }
        }

        // 2b. OpenStreetMap Overpass API (Community Map Layer)
        if (candidateList.length === 0) {
          try {
            const overpassQuery = getOverpassQuery(cleanNiche, locationData.latitude!, locationData.longitude!, radiusMeters);
            const rawElements = await fetchOverpassWithCache(overpassQuery, async () => {
              let overpassData: any = null;
              let overpassAttempts = 0;
              for (const endpoint of OVERPASS_ENDPOINTS) {
                if (overpassAttempts >= 2) break;
                overpassAttempts++;
                try {
                  const overpassRes = await axios.post(endpoint, `data=${encodeURIComponent(overpassQuery)}`, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    timeout: 5000,
                  });
                  if (overpassRes.status === 200 && overpassRes.data) {
                    overpassData = overpassRes.data;
                    if (!sourcesUsed.some(s => s.includes("Overpass"))) {
                      sourcesUsed.push(`Overpass OSM Engine (${new URL(endpoint).hostname})`);
                    }
                    break;
                  }
                } catch (e) {
                  console.warn(`[Overpass] Endpoint ${endpoint} failed, trying next.`);
                }
              }
              return overpassData?.elements || [];
            });

            if (Array.isArray(rawElements)) {
              const filteredElements = rawElements.filter((el: any) => el.type === "node" || el.type === "way");
              for (const el of filteredElements) {
                const tags = el.tags || {};
                const lat = el.lat || (el.center ? el.center.lat : locationData.latitude);
                const lng = el.lon || (el.center ? el.center.lon : locationData.longitude);
                const dist = haversineDistance(locationData.latitude!, locationData.longitude!, lat, lng);

                candidateList.push({
                  id: el.id ? `osm_${el.type}_${el.id}` : null,
                  name: tags.name || tags.operator || "Competidor Local",
                  latitude: lat,
                  longitude: lng,
                  distanceKm: Number(dist.toFixed(2)),
                  category: tags.amenity || tags.shop || tags.craft || tags.office || "Local Business",
                  phone: tags.phone || tags["contact:phone"] || null,
                  website: tags.website || tags["contact:website"] || null,
                  address: tags["addr:street"] ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}`.trim() : null,
                  source: "openstreetmap",
                  retrievedAt: nowIso,
                  evidenceStatus: "VERIFIED",
                });
              }
            }
          } catch (overpassErr: any) {
            console.warn("[BusinessScan] Overpass competitor fetching failed non-blockingly:", overpassErr.message || overpassErr);
          }
        }

        // 2c. Fallback to LocationIQ Nearby / Provider Matrix
        if (candidateList.length === 0) {
          try {
            const backupList = await findLocalCompetitors({
              niche: cleanNiche || "commercial",
              lat: locationData.latitude!,
              lng: locationData.longitude!,
              radiusMeters,
              excludeName: cleanBusinessName
            });
            if (backupList.length > 0) {
              for (const c of backupList) {
                candidateList.push({
                  name: c.name,
                  category: c.category,
                  distanceKm: c.distanceKm,
                  latitude: c.lat,
                  longitude: c.lng,
                  phone: c.phone || null,
                  website: c.website || null,
                  address: c.address,
                  source: c.source,
                  retrievedAt: nowIso,
                  evidenceStatus: "VERIFIED"
                });
              }
              if (!sourcesUsed.includes("Places Matrix (LocationIQ/Overpass)")) {
                sourcesUsed.push("Places Matrix (LocationIQ/Overpass)");
              }
            }
          } catch (mErr) {
            // ignore
          }
        }

        return deduplicateCompetitors(candidateList, cleanBusinessName);
      };

      // Step 1: Initial search
      competitors = await fetchAtRadius(requestedRadiusKm);

      // Step 2: Auto-expansion to 10km if 0 results
      if (competitors.length === 0 && requestedRadiusKm < 10) {
        effectiveRadiusKm = 10;
        competitors = await fetchAtRadius(10);
      }

      // Step 3: Auto-expansion to 25km if still 0 results
      if (competitors.length === 0 && effectiveRadiusKm < 25) {
        effectiveRadiusKm = 25;
        competitors = await fetchAtRadius(25);
      }
    }

    const messageForUi = competitors.length > 0
      ? `Se detectaron ${competitors.length} competidores locales en un radio de ${effectiveRadiusKm} km.`
      : `0 competidores directos detectados para "${cleanNiche || 'servicios'}" en ${cleanCity} en un radio de ${effectiveRadiusKm} km.`;

    const suggestedRadii = [10, 25];
    const nextActions = competitors.length > 0
      ? [
          {
            id: "act_view_map",
            action: "view_map",
            title: { es: "Ver en Mapa de Cobertura", en: "View on Coverage Map" },
            targetTab: "growth",
            actionLabel: { es: "Ver Mapa", en: "View Map" }
          },
          {
            id: "act_outrank_competitors",
            action: "navigate",
            title: { es: "Superar Competidores con SEO Local", en: "Outrank Competitors with Local SEO" },
            targetTab: "growth",
            actionLabel: { es: "Optimizar SEO", en: "Optimize SEO" }
          }
        ]
      : [
          {
            id: "retry_10km",
            action: "expand_radius",
            radiusKm: 10,
            title: { es: "Reintentar a 10 km", en: "Retry at 10 km" },
            targetTab: "scan",
            actionLabel: { es: "⚡ Reintentar a 10 km", en: "⚡ Retry at 10 km" }
          },
          {
            id: "retry_25km",
            action: "expand_radius",
            radiusKm: 25,
            title: { es: "Reintentar a 25 km", en: "Retry at 25 km" },
            targetTab: "scan",
            actionLabel: { es: "⚡ Reintentar a 25 km", en: "⚡ Retry at 25 km" }
          },
          {
            id: "act_claim_gmb",
            action: "navigate",
            title: { es: "Reclamar y Asegurar Monopolio Local", en: "Claim & Secure Local Monopoly" },
            targetTab: "growth",
            actionLabel: { es: "Reclamar Ficha", en: "Claim Profile" }
          }
        ];

    // 3. Web Presence and Reputation via Google Search Grounded Gemini API (Zero Synthetics!)
    let webDetails = {
      phone: null as string | null,
      website: null as string | null,
      googleMapsUrl: null as string | null,
      rating: null as number | null,
      reviewCount: null as number | null,
      isClaimed: null as boolean | null,
      facebookUrl: null as string | null,
      instagramUrl: null as string | null,
      strengths: [] as string[],
      weaknesses: [] as string[],
      opportunities: [] as string[],
    };

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && needsLiveEnrichment.includes('web_presence')) {
      try {
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const prompt = `Realiza una búsqueda real sobre el negocio local "${cleanBusinessName}" en "${cleanCity}, ${cleanState}".
Determina de forma verídica y sin inventar datos:
1. Su número de teléfono público.
2. Su sitio web oficial.
3. Si está verificado en Google Maps o si existe su ficha de perfil de negocio (GMB/Google Maps URL).
4. Su valoración real (rating de 1.0 a 5.0) y cantidad de reseñas (reviewCount) en Google Maps u otra plataforma principal. Si no tiene reseñas confirmadas o la información es privada, establece "rating" y "reviewCount" como null.
5. Enlaces a su Facebook o Instagram.
6. Si la ficha está reclamada ("isClaimed": true o false o null si es desconocido).
7. Identifica 3 fortalezas (strengths), 3 debilidades (weaknesses) y 3 oportunidades (opportunities) específicas de su marketing digital actual.

Debes responder estrictamente con un objeto JSON válido que cumpla con el siguiente esquema exacto de TypeScript:
{
  "phone": string | null,
  "website": string | null,
  "googleMapsUrl": string | null,
  "rating": number | null,
  "reviewCount": number | null,
  "isClaimed": boolean | null,
  "facebookUrl": string | null,
  "instagramUrl": string | null,
  "strengths": string[],
  "weaknesses": string[],
  "opportunities": string[]
}`;

        let geminiResText: string | null = null;
        try {
          const aiResult = await callNodeAiText({
            taskType: "business_scan",
            prompt,
            jsonMode: true
          });
          geminiResText = aiResult.text;
        } catch (mErr: any) {
          console.warn("[BusinessScan] Central AI cascade failed. Falling back to deterministic analytical scan.", mErr?.message || mErr);
        }

        if (geminiResText) {
          let cleanText = geminiResText.trim();
          if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
          }
          const parsed = JSON.parse(cleanText);
          webDetails = {
            phone: parsed.phone || null,
            website: parsed.website || null,
            googleMapsUrl: parsed.googleMapsUrl || null,
            rating: typeof parsed.rating === "number" ? parsed.rating : null,
            reviewCount: typeof parsed.reviewCount === "number" ? parsed.reviewCount : null,
            isClaimed: typeof parsed.isClaimed === "boolean" ? parsed.isClaimed : null,
            facebookUrl: parsed.facebookUrl || null,
            instagramUrl: parsed.instagramUrl || null,
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
            opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
          };
          sourcesUsed.push("Gemini Search Grounding (Live GMB Index)");
        }
      } catch (err: any) {
        console.warn("[BusinessScan] Gemini grounded lookup failed:", err.message || err);
        warnings.push("No se pudo completar la auditoría mediante IA en tiempo real. Utilizando fallback analítico.");
      }
    }

    // 4. Mathematical Score & Taxonomy Computations (Business Health Score)
    // Pillars setup
    let scoreLocal: number | null = null;
    let statusLocal: any = "INSUFFICIENT_DATA";
    if (locationData.provider !== "unverified" && locationData.latitude !== null) {
      scoreLocal = 65;
      statusLocal = "DERIVED";
      if (webDetails.googleMapsUrl) {
        scoreLocal = webDetails.isClaimed ? 95 : 75;
        statusLocal = "VERIFIED";
      }
    }

    let scoreReputation: number | null = null;
    let statusReputation: any = "INSUFFICIENT_DATA";
    if (webDetails.rating !== null) {
      statusReputation = "VERIFIED";
      const ratingWeight = webDetails.rating >= 4.5 ? 60 : webDetails.rating >= 4.0 ? 50 : 35;
      const reviewsWeight = (webDetails.reviewCount || 0) > 50 ? 40 : (webDetails.reviewCount || 0) > 10 ? 30 : 15;
      scoreReputation = ratingWeight + reviewsWeight;
    }

    let scoreWebsite: number | null = null;
    let statusWebsite: any = "INSUFFICIENT_DATA";
    if (webDetails.website) {
      scoreWebsite = 85;
      statusWebsite = "VERIFIED";
      if (webDetails.facebookUrl || webDetails.instagramUrl) {
        scoreWebsite = 100;
      }
    } else if (webDetails.facebookUrl || webDetails.instagramUrl) {
      scoreWebsite = 50;
      statusWebsite = "DERIVED";
    }

    let scoreMarketPosition: number | null = null;
    let statusMarketPosition: any = "INSUFFICIENT_DATA";
    if (webDetails.website || webDetails.phone) {
      scoreMarketPosition = webDetails.website && webDetails.phone ? 80 : webDetails.website ? 60 : 35;
      statusMarketPosition = webDetails.website ? "DERIVED" : "UNVERIFIED";
    }

    const compCount = competitors.length;
    let scoreCompetition: number | null = null;
    let statusCompetition: any = "INSUFFICIENT_DATA";
    if (locationData.latitude !== null && compCount > 0) {
      scoreCompetition = compCount <= 2 ? 85 : compCount <= 5 ? 65 : 45;
      statusCompetition = "DERIVED";
    }

    // Opportunity Index: Inversely proportional to optimization. If they have no website/reputation/claim, opportunity to grow is massive (100).
    let scoreOpportunity: number | null = null;
    let statusOpportunity: any = "INSUFFICIENT_DATA";
    const optScores = [scoreLocal, scoreWebsite, scoreReputation].filter((s): s is number => s !== null);
    if (optScores.length > 0) {
      const currentOptimization = optScores.reduce((a, b) => a + b, 0) / optScores.length;
      scoreOpportunity = Math.round(100 - currentOptimization);
      statusOpportunity = "DERIVED";
    }

    const catLocalPresence = {
      score: scoreLocal,
      status: statusLocal,
      weight: 0.25,
      reason: {
        es: scoreLocal !== null ? `Coordenadas y metadatos locales verificados. Score: ${scoreLocal}/100.` : "Sin evidencias de ubicación física verificables.",
        en: scoreLocal !== null ? `Verified local coordinates and metadata. Score: ${scoreLocal}/100.` : "No verifiable physical location evidence found."
      },
      howToImprove: {
        es: webDetails.isClaimed ? "Mantener la información de horarios e imágenes al día." : "Reclamar y verificar la propiedad de la ficha en Google Maps.",
        en: webDetails.isClaimed ? "Keep operating hours and photos updated." : "Claim and verify business profile ownership on Google Maps."
      }
    };

    const catReputation = {
      score: scoreReputation,
      status: statusReputation,
      weight: 0.15,
      reason: {
        es: scoreReputation !== null ? `Basado en ${webDetails.reviewCount || 0} reseñas con promedio de ${webDetails.rating || 0} estrellas.` : "No se detectaron opiniones o valoraciones públicas.",
        en: scoreReputation !== null ? `Based on ${webDetails.reviewCount || 0} reviews with an average of ${webDetails.rating || 0} stars.` : "No public reviews or ratings detected."
      },
      howToImprove: {
        es: "Lanzar campaña de solicitud de reseñas a clientes recientes.",
        en: "Launch a review request campaign targeting recent customers."
      }
    };

    const catWebsite = {
      score: scoreWebsite,
      status: statusWebsite,
      weight: 0.25,
      reason: {
        es: scoreWebsite !== null ? (webDetails.website ? "Sitio web oficial detectado." : "Presencia limitada a redes sociales.") : "Sin sitio web o presencia digital verificada.",
        en: scoreWebsite !== null ? (webDetails.website ? "Official website detected." : "Presence limited to social media.") : "No verified website or digital presence."
      },
      howToImprove: {
        es: "Crear o conectar un sitio web responsivo con cotizador instantáneo.",
        en: "Build or connect a responsive website with instant quoting."
      }
    };

    const catMarketPosition = {
      score: scoreMarketPosition,
      status: statusMarketPosition,
      weight: 0.15,
      reason: {
        es: scoreMarketPosition !== null ? "Canales de contacto y listado comercial activos." : "Datos insuficientes para determinar posicionamiento de mercado.",
        en: scoreMarketPosition !== null ? "Active contact channels and business listing found." : "Insufficient data to determine market positioning."
      },
      howToImprove: {
        es: "Asegurar congruencia de datos de contacto (NAP) en la web y directorios.",
        en: "Ensure NAP (Name, Address, Phone) data consistency across web directories."
      }
    };

    const catCompetition = {
      score: scoreCompetition,
      status: statusCompetition,
      weight: 0.10,
      reason: {
        es: compCount > 0 ? `Se detectaron ${compCount} competidores directos en la zona.` : "No se detectaron competidores verificados en el radio de búsqueda.",
        en: compCount > 0 ? `Detected ${compCount} direct competitors in the area.` : "No verified competitors detected within search radius."
      },
      howToImprove: {
        es: compCount > 0 ? "Monitorear palabras clave y ofertas de competidores cercanos." : "Aprovechar la baja presión competitiva para dominar búsquedas locales.",
        en: compCount > 0 ? "Monitor keywords and offerings from nearby competitors." : "Leverage low competition to dominate local search."
      }
    };

    const catMarketOpp = {
      score: scoreOpportunity,
      status: statusOpportunity,
      weight: 0.10,
      reason: {
        es: scoreOpportunity !== null ? `Índice de oportunidad de crecimiento digital del ${scoreOpportunity}%.` : "Datos insuficientes para calcular brecha de oportunidad.",
        en: scoreOpportunity !== null ? `Digital growth opportunity index of ${scoreOpportunity}%.` : "Insufficient data to calculate opportunity gap."
      },
      howToImprove: {
        es: "Ejecutar las acciones recomendadas para capturar demanda no atendida.",
        en: "Execute recommended actions to capture unserved market demand."
      }
    };

    let rawOverall = 0;
    let weightSum = 0;

    const allCategories = [
      catLocalPresence,
      catReputation,
      catWebsite,
      catMarketPosition,
      catCompetition,
      catMarketOpp,
    ];

    for (const item of allCategories) {
      if (item.score !== null) {
        rawOverall += item.score * item.weight;
        weightSum += item.weight;
      }
    }

    const overallScore = weightSum > 0 ? Math.round(rawOverall / weightSum) : null;
    const overallStatusTaxonomy: any = overallScore !== null ? "DERIVED" : "INSUFFICIENT_DATA";

    const mathExplanation = overallScore !== null 
      ? {
          es: `Score de Salud Comercial del ${overallScore}% calculado sobre un modelo ponderado basado únicamente en dimensiones con evidencia verificable (${Math.round(weightSum * 100)}% de peso ponderado evaluado).`,
          en: `Commercial Health Score of ${overallScore}% calculated using a weighted model based strictly on dimensions with verifiable evidence (${Math.round(weightSum * 100)}% evaluated weight).`
        }
      : {
          es: "El Score de Salud Comercial no se puede calcular debido a la falta de evidencias verificables suficientes para el negocio en la ubicación indicada.",
          en: "Commercial Health Score cannot be calculated due to insufficient verifiable evidence for the business in the specified location."
        };

    // 5. Assemble Structured Diagnostics (Strengths, Weaknesses, Opportunities, Blind spots, Risks)
    const diagnosisStrengths = webDetails.strengths.length > 0 
      ? webDetails.strengths.map((str, idx) => ({ 
          title: { es: `Fortaleza #${idx + 1}`, en: `Strength #${idx + 1}` }, 
          desc: { es: str, en: str } 
        }))
      : [
          { 
            title: { es: "Nombre Comercial Registrado", en: "Registered Business Name" }, 
            desc: { es: "El negocio tiene presencia y reconocimiento nominal local.", en: "The business has local presence and brand name recognition." } 
          },
          webDetails.phone ? { 
            title: { es: "Contacto Telefónico Visible", en: "Visible Phone Contact" }, 
            desc: { es: "El número de teléfono está expuesto, facilitando llamadas directas.", en: "Phone number is publicly visible, facilitating direct calls." } 
          } : null,
          locationData.latitude ? { 
            title: { es: "Coordenadas Geolocalizadas", en: "Geolocated Coordinates" }, 
            desc: { es: "El negocio está físicamente ubicado en el mapa de coordenadas.", en: "The business is physically located on the map coordinates." } 
          } : null
        ].filter(Boolean) as any[];

    const diagnosisWeaknesses = webDetails.weaknesses.length > 0
      ? webDetails.weaknesses.map((wk, idx) => ({ 
          title: { es: `Debilidad #${idx + 1}`, en: `Weakness #${idx + 1}` }, 
          desc: { es: wk, en: wk } 
        }))
      : [
          !webDetails.website ? { 
            title: { es: "Sitio Web Oficial Inexistente", en: "Missing Official Website" }, 
            desc: { es: "No se detectó un canal digital propio, lo que genera desconfianza y pérdida de leads.", en: "No dedicated digital channel detected, leading to lost leads and lower credibility." } 
          } : null,
          !webDetails.phone ? { 
            title: { es: "Canal de Contacto Directo Ausente", en: "Missing Direct Contact Channel" }, 
            desc: { es: "No se visualiza número telefónico, dificultando la conversión inmediata.", en: "No phone number visible, hindering immediate conversion." } 
          } : null,
          webDetails.isClaimed === false ? { 
            title: { es: "Ficha de Mapas sin Reclamar", en: "Unclaimed Maps Listing" }, 
            desc: { es: "El perfil local de mapas está vulnerable a ser modificado por terceros.", en: "The local maps profile is vulnerable to unauthorized third-party edits." } 
          } : null,
          webDetails.rating === null ? { 
            title: { es: "Sin Reputación Pública de Reseñas", en: "No Public Review Reputation" }, 
            desc: { es: "No cuenta con valoraciones visibles, reduciendo la credibilidad online.", en: "No public ratings visible, reducing online credibility." } 
          } : null
        ].filter(Boolean) as any[];

    const diagnosisOpportunities = webDetails.opportunities.length > 0
      ? webDetails.opportunities.map((op, idx) => ({ 
          title: { es: `Oportunidad #${idx + 1}`, en: `Opportunity #${idx + 1}` }, 
          desc: { es: op, en: op }, 
          status: "INSUFFICIENT_DATA",
          formulaExplanation: { es: "Datos directos insuficientes para estimación monetaria.", en: "Insufficient direct data for monetary estimation." }
        }))
      : [
          !webDetails.website ? { 
            title: { es: "Crear Sitio Web de Conversión", en: "Build High-Converting Website" }, 
            desc: { es: "Implementar un sitio web moderno con cotizador interactivo de Bvelt para capturar leads 24/7.", en: "Deploy a modern website with Bvelt instant quote widget to capture leads 24/7." }, 
            status: "INSUFFICIENT_DATA", 
            formulaExplanation: { es: "Sin datos de tráfico web. Estimación no disponible.", en: "No web traffic data. Estimation unavailable." } 
          } : null,
          webDetails.isClaimed === false ? { 
            title: { es: "Reclamar y Optimizar Perfil de Google", en: "Claim & Optimize Google Profile" }, 
            desc: { es: "Tomar el control de la ficha local y posicionar palabras clave del sector.", en: "Take ownership of local listing and optimize industry keywords." }, 
            status: "ESTIMATED", 
            projectedGainUsd: { es: "Oportunidad potencial", en: "Potential Opportunity" },
            formulaExplanation: { es: "Visibilidad × Tasa Media de Conversión. Requiere analítica conectada.", en: "Visibility × Avg Conversion Rate. Requires connected analytics." } 
          } : null,
          !webDetails.phone ? { 
            title: { es: "Vincular Teléfono Inteligente en Bvelt CRM", en: "Link Smart Phone in Bvelt CRM" }, 
            desc: { es: "Habilitar llamadas automáticas e IA de seguimiento de contactos.", en: "Enable automated calls and AI follow-ups for inbound contacts." }, 
            status: "INFERRED",
            formulaExplanation: { es: "No es posible calcular el impacto de llamadas perdidas sin datos históricos.", en: "Cannot calculate lost call impact without historical data." } 
          } : null
        ].filter(Boolean) as any[];

    const diagnosisBlindSpots = [
      {
        es: "No es posible verificar el volumen de tráfico mensual que ingresa directamente al local físico sin integración de sensores.",
        en: "Unable to verify monthly foot traffic directly to physical location without sensor integration."
      },
      webDetails.isClaimed === null 
        ? { es: "Estado de verificación de marca ambiguo por falta de metadatos públicos.", en: "Brand verification status ambiguous due to missing public metadata." } 
        : { es: "No se puede auditar la velocidad de respuesta real del equipo comercial a las llamadas entrantes.", en: "Unable to audit real response speed of sales team to inbound calls." }
    ];

    const diagnosisRisks = competitors.length > 6 
      ? [{ es: "Densidad de competencia extremadamente alta en el sector local, amenazando la cuota de mercado.", en: "Extremely high local competitor density threatening market share." }]
      : [{ es: "La falta de presencia web estructurada permite que los competidores locales capturen la demanda en buscadores.", en: "Lack of structured web presence allows local competitors to capture search demand." }];

    // 6. Build Actionable Recommended CTAs (Mapped exactly to Bvelt Modules)
    const recommendedActions = [];
    if (!webDetails.website) {
      recommendedActions.push({
        id: "act_create_website",
        title: { es: "Crear Sitio Web Comercial Inteligente", en: "Create Smart Business Website" },
        description: { es: "El negocio no tiene un sitio oficial. Diseña una página web responsiva con Cotizador Instantáneo de Bvelt para generar clientes.", en: "Business lacks an official website. Build a responsive website with Bvelt Instant Estimator to generate leads." },
        targetTab: "website",
        actionLabel: { es: "Ir a Creador de Web", en: "Go to Website Builder" },
      });
    } else {
      recommendedActions.push({
        id: "act_optimize_website",
        title: { es: "Integrar Cotizador y CRM a Web Existente", en: "Integrate Quoter & CRM into Existing Web" },
        description: { es: "Potencia el sitio web actual vinculando los widgets de estimaciones rápidas de Bvelt.", en: "Enhance current website by embedding Bvelt quick estimation widgets." },
        targetTab: "website",
        actionLabel: { es: "Ver Configuración Web", en: "View Web Settings" },
      });
    }

    if (!webDetails.googleMapsUrl || !webDetails.isClaimed) {
      recommendedActions.push({
        id: "act_claim_gmb",
        title: { es: "Sincronizar y Reclamar Posicionamiento Local", en: "Sync and Claim Local Profile" },
        description: { es: "Vulnerabilidad en Google Maps. Usa el módulo de Crecimiento para optimizar la ficha y vencer a los competidores más cercanos.", en: "Google Maps vulnerability. Use Growth module to optimize listing and outrank competitors." },
        targetTab: "growth",
        actionLabel: { es: "Ir a SEO Local", en: "Go to Local SEO" },
      });
    } else {
      recommendedActions.push({
        id: "act_optimize_growth",
        title: { es: "Superar Competidores con Campañas SEO", en: "Outrank Competitors with SEO Campaigns" },
        description: { es: "Compara tu posición con los competidores locales detectados y optimiza tus palabras clave.", en: "Compare ranking against detected local competitors and optimize keywords." },
        targetTab: "growth",
        actionLabel: { es: "Ver Análisis SEO", en: "View SEO Analysis" },
      });
    }

    if (webDetails.rating === null || (webDetails.reviewCount || 0) < 5) {
      recommendedActions.push({
        id: "act_request_reviews",
        title: { es: "Iniciar Campaña de Captura de Reseñas", en: "Launch Review Generation Campaign" },
        description: { es: "La reputación está ausente o baja. Envía enlaces directos por SMS/Email a tus clientes para conseguir reviews positivas.", en: "Low or missing reputation. Send direct review links via SMS/Email to collect positive feedback." },
        targetTab: "reviews",
        actionLabel: { es: "Ir a Reseñas", en: "Go to Reviews" },
      });
    } else {
      recommendedActions.push({
        id: "act_monitor_reviews",
        title: { es: "Automatizar Respuestas de Reseñas con IA", en: "Automate AI Review Responses" },
        description: { es: "Responde de inmediato a las valoraciones públicas usando las plantillas automáticas.", en: "Respond instantly to public customer reviews using automated templates." },
        targetTab: "reviews",
        actionLabel: { es: "Ver Gestión de Reseñas", en: "View Review Management" },
      });
    }

    recommendedActions.push({
      id: "act_lead_creation",
      title: { es: "Habilitar Embudo de Captación de Leads", en: "Enable Lead Capture Funnel" },
      description: { es: "Organiza a todos los prospectos interesados que llamen o visiten el sitio en el CRM integrado.", en: "Organize all inbound leads calling or visiting the site into integrated CRM." },
      targetTab: "leads",
      actionLabel: { es: "Ir a CRM Leads", en: "Go to Leads CRM" },
    });

    recommendedActions.push({
      id: "act_configure_estimator",
      title: { es: "Configurar Tablas de Precios y Cotizaciones", en: "Configure Price Tables & Quotes" },
      description: { es: "Establece las tarifas de tus servicios para enviar cotizaciones inmediatas en PDF.", en: "Set up service rates to generate and send instant PDF estimates." },
      targetTab: "estimator",
      actionLabel: { es: "Configurar Tarifas", en: "Configure Rates" },
    });

    const evidences: Record<string, any> = {
      identity_business_name: {
        id: "ev_biz_name",
        field: "Nombre Comercial",
        value: cleanBusinessName,
        sourceType: effectiveSourceType,
        sourceLabel: inputSourceLabel,
        evidenceStatus: "VERIFIED",
        confidence: 1.0,
        lastUpdated: nowIso,
      },
      identity_city: {
        id: "ev_city",
        field: "Ciudad",
        value: cleanCity,
        sourceType: effectiveSourceType,
        sourceLabel: inputSourceLabel,
        evidenceStatus: "VERIFIED",
        confidence: 1.0,
        lastUpdated: nowIso,
      },
      location_coordinates: {
        id: "ev_coords",
        field: "Coordenadas Geográficas",
        value:
          locationData.latitude && locationData.longitude
            ? `${locationData.latitude.toFixed(5)}, ${locationData.longitude.toFixed(5)}`
            : null,
        sourceType: "SYSTEM",
        sourceLabel: locationData.provider === "geoapify" ? "Geoapify API" : "OpenStreetMap Nominatim",
        evidenceStatus: locationData.latitude ? "VERIFIED" : "UNVERIFIED",
        confidence: locationData.confidence,
        lastUpdated: nowIso,
        notes: locationData.formattedAddress || "Ubicación sin verificar",
      },
      website_url: {
        id: "ev_website",
        field: "Sitio Web Oficial",
        value: webDetails.website,
        sourceType: "REPUTATION",
        sourceLabel: geminiKey ? "Gemini Search Grounding" : "Direct Search",
        evidenceStatus: statusWebsite,
        confidence: webDetails.website ? 0.95 : 0.0,
        lastUpdated: nowIso,
        notes: webDetails.website ? `Sitio web detectado: ${webDetails.website}` : "No se encontró sitio web confirmado",
      },
      phone_number: {
        id: "ev_phone",
        field: "Teléfono de Contacto",
        value: webDetails.phone,
        sourceType: "BUSINESS_PROFILE",
        sourceLabel: "Registro Público",
        evidenceStatus: webDetails.phone ? "VERIFIED" : "UNVERIFIED",
        confidence: webDetails.phone ? 0.90 : 0.0,
        lastUpdated: nowIso,
        notes: webDetails.phone ? `Teléfono verificado: ${webDetails.phone}` : "Teléfono no disponible públicamente",
      },
      google_maps_claim: {
        id: "ev_gmb_claim",
        field: "Ficha de Maps Reclamada",
        value: webDetails.isClaimed === null ? "Desconocido" : (webDetails.isClaimed ? "Sí" : "No"),
        sourceType: "LOCAL_PRESENCE",
        sourceLabel: "Google Business Profile",
        evidenceStatus: webDetails.isClaimed !== null ? "VERIFIED" : "UNVERIFIED",
        confidence: webDetails.isClaimed !== null ? 0.85 : 0.0,
        lastUpdated: nowIso,
        notes: webDetails.isClaimed === null ? "No disponible públicamente" : (webDetails.isClaimed ? "Perfil local verificado" : "Ficha sin reclamar"),
      },
      rating_stars: {
        id: "ev_rating",
        field: "Puntuación de Reseñas",
        value: webDetails.rating !== null ? `${webDetails.rating}★` : "No disponible",
        sourceType: "REPUTATION",
        sourceLabel: "Google Maps Reviews Index",
        evidenceStatus: statusReputation,
        confidence: webDetails.rating !== null ? 0.90 : 0.0,
        lastUpdated: nowIso,
        notes: webDetails.rating !== null ? `Valoración promedio con ${webDetails.reviewCount} opiniones` : "Sin valoraciones públicas verificadas",
      }
    };

    const resultPayload = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowIso,
      status: (overallScore !== null && overallScore > 0) ? "SUCCESS" : "PARTIAL",
      input: {
        businessName: cleanBusinessName,
        city: cleanCity,
        state: cleanState,
        country: cleanCountry,
        niche: cleanNiche,
      },
      identity: {
        businessName: cleanBusinessName,
        city: cleanCity,
        state: cleanState,
        country: cleanCountry,
        formattedName: `${cleanBusinessName} (${cleanCity}${cleanState ? ", " + cleanState : ""})`,
        address: locationData.formattedAddress,
        phone: webDetails.phone,
        website: webDetails.website,
        googleMapsUrl: webDetails.googleMapsUrl,
        isClaimed: webDetails.isClaimed,
      },
      location: locationData,
      evidences,
      competitors,
      diagnosis: {
        strengths: diagnosisStrengths,
        weaknesses: diagnosisWeaknesses,
        opportunities: diagnosisOpportunities,
        blindSpots: diagnosisBlindSpots,
        risks: diagnosisRisks,
      },
      score: {
        overall: overallScore,
        status: overallStatusTaxonomy,
        mathExplanation,
        categories: {
          localPresence: { score: scoreLocal, status: statusLocal, weight: 0.25, reason: "Ubicación geográfica de la marca y estado de la ficha local", howToImprove: "Vincular y reclamar la propiedad del Perfil en Google Maps" },
          reputation: { score: scoreReputation, status: statusReputation, weight: 0.15, reason: "Volumen y puntuación de opiniones de usuarios", howToImprove: "Lanzar una campaña automatizada de captura de reseñas de Bvelt" },
          website: { score: scoreWebsite, status: statusWebsite, weight: 0.25, reason: "Disponibilidad de sitio web responsivo y enlaces de conversión", howToImprove: "Habilitar tu propio sitio web con cotizador instantáneo con Bvelt" },
          marketPosition: { score: scoreMarketPosition, status: statusMarketPosition, weight: 0.15, reason: "Presencia digital cruzada y visibilidad orgánica", howToImprove: "Unificar canales de contacto digital y optimizar posicionamiento local" },
          competition: { score: scoreCompetition, status: statusCompetition, weight: 0.10, reason: "Presencia de competidores del mismo sector en cercanía física", howToImprove: "Analizar el radar de competencia local para descubrir debilidades de rivales" },
          marketOpportunity: { score: scoreOpportunity, status: statusOpportunity, weight: 0.10, reason: "Brecha u oportunidades digitales pendientes por capturar", howToImprove: "Implementar las cotizaciones automáticas en PDF y seguimiento de CRM" },
        },
      },
      recommendedActions,
      sourcesUsed,
      messageForUi,
      nextActions,
      suggestedRadii,
      radiusKm: effectiveRadiusKm,
      warnings,
      errors,
    };

    // Store in TTLLRUCache
    businessScanCache.set(cacheKey, resultPayload);

    // Asynchronous non-blocking BEM write-back for public business evidence
    persistBusinessScanToBem({
      businessName: cleanBusinessName,
      city: cleanCity,
      state: cleanState,
      country: cleanCountry,
      address: locationData.formattedAddress,
      phone: webDetails.phone,
      website: webDetails.website,
      isClaimed: webDetails.isClaimed,
      rating: webDetails.rating,
      reviewCount: webDetails.reviewCount,
      coordinates: (locationData.latitude && locationData.longitude) ? { lat: locationData.latitude, lng: locationData.longitude } : null,
      competitorsSummary: {
        totalFound: competitors.length,
        topCompetitors: competitors.slice(0, 5).map(c => c.name)
      }
    }).catch(err => console.warn('[BusinessScan BEM Writeback Error]:', err?.message || err));

    if (competitors && competitors.length > 0) {
      const topCompetitors = competitors.slice(0, 10);
      Promise.all(topCompetitors.map(c => persistCompetitorPoiToBem({
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
        category: c.category || cleanNiche || 'Business',
        phone: c.phone,
        website: c.website,
        address: c.address,
        rating: c.rating,
        reviewCount: c.reviewCount
      }).catch(err => console.warn('[BusinessScan BEM Competitor Error]:', err?.message || err))))
      .catch(() => {});
    }

    res.status(200).json(resultPayload);
  } catch (err: any) {
    console.error("[BusinessScan] Unexpected handler error:", err);
    res.status(500).json({
      status: "ERROR",
      errors: ["Ocurrió un error inesperado al procesar el análisis. Inténtelo nuevamente."],
    });
  }
}
