/**
 * Cloudflare Pages & Workers — Local Market Audit Handler
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

interface AuditCacheEntry {
  timestamp: number;
  data: any;
}

const auditEdgeCache = new Map<string, AuditCacheEntry>();
const AUDIT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function handleAudit(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { companyName, niche, cityState, forceRefresh, clientSnippet } = body || {};

    if (!companyName || !niche || !cityState) {
      return new Response(JSON.stringify({
        error: "Missing parameters",
        details: "companyName, niche, and cityState are required."
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    // 0. Cache Check (24h TTL per companyName + niche + cityState + YYYY-MM-DD)
    const todayStr = new Date().toISOString().split("T")[0];
    const cleanComp = String(companyName).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanNiche = String(niche).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanCity = String(cityState).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const auditCacheKey = `audit:${cleanComp}:${cleanNiche}:${cleanCity}:${todayStr}`;

    const now = Date.now();
    if (!forceRefresh) {
      const cachedAudit = auditEdgeCache.get(auditCacheKey);
      if (cachedAudit && (now - cachedAudit.timestamp < AUDIT_CACHE_TTL_MS)) {
        return new Response(JSON.stringify({
          ...cachedAudit.data,
          fromCache: true,
          cached: true
        }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }

      if (env && env.SCAN_CACHE_KV && typeof env.SCAN_CACHE_KV.get === "function") {
        try {
          const kvVal = await env.SCAN_CACHE_KV.get(auditCacheKey);
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

    let clientData: { name: string; rating: number | null; reviews: number | null; web: boolean; claimed: boolean } = {
      name: String(companyName).trim(),
      rating: null,
      reviews: null,
      web: false,
      claimed: false
    };

    let competitorData: { name: string | null; rating: number | null; reviews: number | null; years: string | null; web: boolean } = {
      name: null,
      rating: null,
      reviews: null,
      years: null,
      web: false
    };

    // 1. Deterministic / Public Source First (Nominatim Geocoding & Local Resolution)
    let competitorCoords: { lat: number; lng: number } | null = null;
    try {
      const geoQuery = encodeURIComponent(`${niche} in ${cityState}`);
      const nomResp = await fetch(`https://nominatim.openstreetmap.org/search?q=${geoQuery}&format=json&limit=1`, {
        headers: { "User-Agent": "BveltAppAuditEngine/1.0" }
      });
      if (nomResp.ok) {
        const nomData = (await nomResp.json()) as any;
        if (Array.isArray(nomData) && nomData.length > 0) {
          competitorCoords = { lat: parseFloat(nomData[0].lat), lng: parseFloat(nomData[0].lon) };
          if (!competitorData.name) {
            competitorData.name = nomData[0].display_name ? nomData[0].display_name.split(',')[0].trim() : null;
            competitorData.web = true;
          }
        }
      }
    } catch (e) {
      console.warn("[Cloudflare Audit] Nominatim deterministic lookup warning:", e);
    }

    // 2. Optional Enrichment via Tavily (Renewable Monthly)
    const tavilyKey = env.TAVILY_API_KEY;
    let enrichmentSource = "NONE";
    let enrichmentSuccess = false;
    const startTime = Date.now();

    // Check Tavily (RENEWABLE_MONTHLY)
    if (tavilyKey && tavilyKey.trim() !== "" && (!competitorData.name || competitorData.rating === null)) {
      try {
        const queryStr = `${niche} ${cityState} reviews rating`;
        const tavilyResp = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: queryStr,
            search_depth: "basic",
            max_results: 5
          })
        });

        if (tavilyResp.ok) {
          const tData = (await tavilyResp.json()) as any;
          const organic = tData.results || [];
          const companyLower = String(companyName).toLowerCase().trim();

          const clientMatch = organic.find((r: any) => 
            (r.title || "").toLowerCase().includes(companyLower) || 
            (r.content || "").toLowerCase().includes(companyLower)
          );
          if (clientMatch) {
            clientData.web = true;
            const textToMatch = `${clientMatch.title} ${clientMatch.content}`;
            const rMatch = textToMatch.match(/(\d(?:\.\d)?)\s*(?:stars|rating|★|\/5)/i);
            if (rMatch?.[1]) clientData.rating = parseFloat(rMatch[1]);
            const revMatch = textToMatch.match(/(\d+)\s*(?:reviews|reseñas)/i);
            if (revMatch?.[1]) clientData.reviews = parseInt(revMatch[1], 10);
          }

          const compMatch = organic.find((r: any) => !(r.title || "").toLowerCase().includes(companyLower));
          if (compMatch) {
            competitorData.name = (compMatch.title || "").replace(/\s*[-|–|:].*/, "").trim() || null;
            competitorData.web = true;
            const textToMatch = `${compMatch.title} ${compMatch.content}`;
            const rMatch = textToMatch.match(/(\d(?:\.\d)?)\s*(?:stars|rating|★|\/5)/i);
            if (rMatch?.[1]) competitorData.rating = parseFloat(rMatch[1]);
            const revMatch = textToMatch.match(/(\d+)\s*(?:reviews|reseñas)/i);
            if (revMatch?.[1]) competitorData.reviews = parseInt(revMatch[1], 10);
          }
          enrichmentSource = "TAVILY";
          enrichmentSuccess = true;
        }
      } catch (tavErr: any) {
        console.warn("[Cloudflare Audit] Tavily enrichment error:", tavErr.message || tavErr);
      }
    }

    const latency = Date.now() - startTime;
    console.log(`[Metrics] provider=${enrichmentSource} operation=search cache_hit=false latency=${latency}ms`);

    if (!competitorData.name) {
      competitorData = {
        name: null,
        rating: null,
        reviews: null,
        years: null,
        web: false
      };
    }

    // 3. Geocode Competitor with Nominatim if needed
    if (competitorData.name && !competitorCoords) {
      try {
        const geoQuery = encodeURIComponent(`${competitorData.name}, ${cityState}`);
        const nomResp = await fetch(`https://nominatim.openstreetmap.org/search?q=${geoQuery}&format=json&limit=1`, {
          headers: { "User-Agent": "BveltAppAuditEngine/1.0" }
        });
        if (nomResp.ok) {
          const nomData = (await nomResp.json()) as any;
          if (Array.isArray(nomData) && nomData.length > 0 && nomData[0].lat && nomData[0].lon) {
            competitorCoords = { lat: parseFloat(nomData[0].lat), lng: parseFloat(nomData[0].lon) };
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. AI Synthesis
    let bveltMoment = competitorData.name
      ? `Oportunidad detectada: Tu competidor principal (${competitorData.name}) lidera la visibilidad local en ${cityState}.`
      : `Oportunidad detectada: Mercado abierto en ${cityState} para consolidar liderazgo local en ${niche}.`;
    let summary = `Diagnóstico completado para ${companyName} (${niche}) en ${cityState}.`;
    const opportunities = [
      { id: '1', title: 'Optimización de Reseñas', description: 'Incrementar volumen de reseñas recientes para consolidar el perfil local.' },
      { id: '2', title: 'Presencia Web', description: 'Asegurar enlaces directos desde el perfil de Google Maps.' }
    ];

    let isAiDegraded = false;
    try {
      const synthPrompt = `Generate a concise local market diagnostic summary and "Bvelt Moment" for business "${companyName}", niche "${niche}" in location "${cityState}", comparing with top competitor "${competitorData.name}" (Rating: ${competitorData.rating}, Reviews: ${competitorData.reviews}). Return strict JSON with keys: bveltMoment (string), summary (string).`;
      const aiRespText = await callGeminiApi(env, synthPrompt, "You are a local market intelligence engine. Return JSON only.", ACTIVE_MODELS.GEMINI_PRIMARY);
      if (aiRespText) {
        const cleaned = aiRespText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.bveltMoment) bveltMoment = parsed.bveltMoment;
        if (parsed.summary) summary = parsed.summary;
      }
    } catch (e: any) {
      console.warn("[Cloudflare Audit] AI synthesis offline or rate limited, using deterministic summary:", e?.message || e);
      isAiDegraded = true;
      summary = `Diagnóstico basado en datos del registro local. Nota: Síntesis de IA en alta demanda temporal.`;
    }

    const responsePayload = {
      cached: false,
      fromCache: false,
      isDegraded: isAiDegraded,
      lastUpdated: new Date().toISOString(),
      client: clientData,
      competitor: {
        ...competitorData,
        coords: competitorCoords
      },
      mapOverlay: {
        competitorName: competitorData.name,
        competitorCoords: competitorCoords,
        niche: String(niche),
        location: String(cityState)
      },
      bveltMoment,
      summary,
      opportunities
    };

    // Save to memory and KV cache
    auditEdgeCache.set(auditCacheKey, { timestamp: now, data: responsePayload });
    if (env && env.SCAN_CACHE_KV && typeof env.SCAN_CACHE_KV.put === "function") {
      try {
        await env.SCAN_CACHE_KV.put(auditCacheKey, JSON.stringify(responsePayload), { expirationTtl: 86400 });
      } catch {}
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    console.error("[Cloudflare Audit] Error:", error);
    return new Response(JSON.stringify({ error: "Audit processing error", details: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
