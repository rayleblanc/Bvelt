import { Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import {
  normalizeModelName,
  isProviderAvailable,
  setGeminiCooldown,
  ACTIVE_MODELS,
  callNodeAiText
} from "./ai-config.ts";
import { executeUnifiedWebSearch } from "./search-provider.ts";

interface AuditCacheItem {
  timestamp: number;
  data: any;
}

// Custom TTLLRUCache implementation to prevent memory leaks and ensure automatic eviction
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
    // Refresh for LRU eviction logic
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (the first key in the map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const auditCache = new TTLLRUCache<string, AuditCacheItem>(100, CACHE_TTL_MS);
const coordCache = new TTLLRUCache<string, { lat: number; lng: number } | null>(200, CACHE_TTL_MS);

export async function auditHandler(req: Request | any, res: Response | any) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        // Secure Deserialization: check if result is a non-null object that is not an array
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          body = parsed;
        } else {
          body = {};
        }
      } catch (e) {
        body = {};
      }
    } else if (body === null || typeof body !== "object" || Array.isArray(body)) {
      body = {};
    }

    const { companyName, niche, cityState, forceRefresh, clientSnippet } = body;

    if (!companyName || !niche || !cityState) {
      return res.status(400).json({
        error: "Missing parameters",
        details: "companyName, niche, and cityState are required."
      });
    }

    // Cache key based on [companyName + niche + cityState + YYYY-MM-DD]
    const todayDate = new Date().toISOString().split("T")[0];
    const cleanComp = String(companyName || "").toLowerCase().trim();
    const cleanNiche = String(niche || "").toLowerCase().trim();
    const cleanCity = String(cityState || "").toLowerCase().trim();
    const cacheKey = `audit_${cleanComp}_${cleanNiche}_${cleanCity}_${todayDate}`;
    const now = Date.now();

    if (!forceRefresh && auditCache.has(cacheKey)) {
      const cachedItem = auditCache.get(cacheKey);
      if (cachedItem && cachedItem.data && (now - cachedItem.timestamp < CACHE_TTL_MS)) {
        return res.json({
          ...cachedItem.data,
          cached: true,
          fromCache: true
        });
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

    let scrapedText = clientSnippet || "";

    if (!scrapedText) {
      try {
        const queryStr = `${niche} ${cityState} reviews rating`;
        const searchRes = await executeUnifiedWebSearch(queryStr);
        if (searchRes.rawText) {
          scrapedText = searchRes.rawText;
        }

        if (searchRes.results && searchRes.results.length > 0) {
          const companyLower = String(companyName).toLowerCase().trim();
          const clientMatch = searchRes.results.find(r => r.title.toLowerCase().includes(companyLower));
          if (clientMatch) {
            clientData.web = true;
            const rMatch = clientMatch.snippet.match(/(\d(?:\.\d)?)\s*(?:stars|rating|★|\/5)/i);
            if (rMatch?.[1]) clientData.rating = parseFloat(rMatch[1]);
            const revMatch = clientMatch.snippet.match(/(\d+)\s*(?:reviews|reseñas)/i);
            if (revMatch?.[1]) clientData.reviews = parseInt(revMatch[1], 10);
          }

          const compMatch = searchRes.results.find(r => !r.title.toLowerCase().includes(companyLower));
          if (compMatch) {
            competitorData.name = compMatch.title.replace(/\s*[-|–|:].*/, "").trim() || null;
            competitorData.web = true;
            const rMatch = compMatch.snippet.match(/(\d(?:\.\d)?)\s*(?:stars|rating|★|\/5)/i);
            if (rMatch?.[1]) competitorData.rating = parseFloat(rMatch[1]);
            const revMatch = compMatch.snippet.match(/(\d+)\s*(?:reviews|reseñas)/i);
            if (revMatch?.[1]) competitorData.reviews = parseInt(revMatch[1], 10);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Fallback if competitor unverified
    if (!competitorData.name) {
      competitorData = {
        name: null,
        rating: null,
        reviews: null,
        years: null,
        web: false
      };
    }

    let competitorCoords: { lat: number; lng: number } | null = null;
    if (competitorData.name) {
      const geoQueryKey = `${competitorData.name}, ${cityState}`.toLowerCase().trim();
      if (coordCache.has(geoQueryKey)) {
        competitorCoords = coordCache.get(geoQueryKey) || null;
      } else {
        const osmController = new AbortController();
        const osmTimeoutId = setTimeout(() => osmController.abort(), 3000);
        try {
          const geoQuery = encodeURIComponent(`${competitorData.name}, ${cityState}`);
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${geoQuery}&format=json&limit=1`;
          const geoRes = await axios.get(nominatimUrl, {
            headers: { "User-Agent": "BveltAppAuditEngine/1.0" },
            signal: osmController.signal,
            timeout: 3000,
            validateStatus: (status) => status === 200
          });
          if (Array.isArray(geoRes.data) && geoRes.data.length > 0) {
            const first = geoRes.data[0];
            if (first.lat && first.lon) {
              competitorCoords = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
            }
          }
          coordCache.set(geoQueryKey, competitorCoords);
        } catch (e) {
          // ignore
        } finally {
          clearTimeout(osmTimeoutId);
        }
      }
    }

    // ONE OPTIONAL AI SYNTHESIS CALL (For Bvelt Moment / Summary only - Zero extraction LLM usage)
    let bveltMoment = competitorData.name
      ? `Oportunidad detectada: Tu competidor principal (${competitorData.name}) lidera la visibilidad local en ${cityState}.`
      : `Oportunidad detectada: Mercado abierto en ${cityState} para consolidar liderazgo local en ${niche}.`;
    let summary = `Diagnóstico completado para ${companyName} (${niche}) en ${cityState}.`;
    let opportunities = [
      { id: '1', title: 'Optimización de Reseñas', description: 'Incrementar volumen de reseñas recientes para consolidar el perfil local.' },
      { id: '2', title: 'Presencia Web', description: 'Asegurar enlaces directos desde el perfil de Google Maps.' }
    ];

    try {
      const synthPrompt = `Generate a concise local market diagnostic summary and "Bvelt Moment" for business "${companyName}", niche "${niche}" in location "${cityState}", comparing with top competitor "${competitorData.name}" (Rating: ${competitorData.rating}, Reviews: ${competitorData.reviews}). Return strict JSON with keys: bveltMoment (string), summary (string).`;
      const aiResult = await callNodeAiText({
        taskType: "audit",
        prompt: synthPrompt,
        jsonMode: true
      });
      if (aiResult.text) {
        const parsedSynth = JSON.parse(aiResult.text);
        if (parsedSynth.bveltMoment) bveltMoment = parsedSynth.bveltMoment;
        if (parsedSynth.summary) summary = parsedSynth.summary;
      }
    } catch (e: any) {
      console.warn("Central AI synthesis call failed, using deterministic fallback:", e?.message || e);
    }

    const responsePayload = {
      cached: false,
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

    auditCache.set(cacheKey, {
      timestamp: now,
      data: responsePayload
    });

    return res.json(responsePayload);
  } catch (error: any) {
    console.error("[Audit API Error]:", error);
    return res.status(500).json({ error: "Audit processing error", details: error.message });
  }
}

export default auditHandler;
