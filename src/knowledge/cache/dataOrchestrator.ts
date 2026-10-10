/**
 * DataOrchestrator for Bvelt
 * Coordinates data acquisition across priority tiers:
 * 1. Local reference data (CBP, QCEW, OEWS, ACS, BEA compact datasets)
 * 2. Local cache (DataCache with SWR)
 * 3. Client state & local storage
 * 4. Firebase persisted store
 * 5. Geoapify (places/geocoding with budget guard)
 * 6. Tavily (web intelligence with budget guard)
 * 7. Live fallbacks with graceful degradation
 */

import { DataCache, DataCategory } from './dataCache';
import { ApiBudgetGuard } from './budgetManager';
import { MarketReferenceEngine, MarketBenchmark } from '../engine/marketReferenceEngine';
import { IndustryResolver } from '../resolvers/industryResolver';
import { GeographyResolver } from '../resolvers/geographyResolver';
import { EvidenceStatus } from '../../lib/bveltEvidence';

export interface OrchestratedResult<T> {
  data: T;
  source: string;
  evidenceStatus: EvidenceStatus;
  isCached: boolean;
  isStale: boolean;
  confidence: 'High' | 'Medium' | 'Low';
  timestamp: number;
}

// In-flight request deduplication map
const IN_FLIGHT_PROMISES = new Map<string, Promise<any>>();

export class DataOrchestrator {

  /**
   * Request Deduplication wrapper
   */
  static async deduplicate<T>(queryHash: string, fetcher: () => Promise<T>): Promise<T> {
    if (IN_FLIGHT_PROMISES.has(queryHash)) {
      return IN_FLIGHT_PROMISES.get(queryHash) as Promise<T>;
    }

    const promise = fetcher().finally(() => {
      IN_FLIGHT_PROMISES.delete(queryHash);
    });

    IN_FLIGHT_PROMISES.set(queryHash, promise);
    return promise;
  }

  /**
   * Orchestrates Market Benchmark resolution using Local Reference first, then Cache, without paid APIs
   */
  static getMarketBenchmark(params: {
    category: string;
    city: string;
    state?: string;
    county?: string;
    msa?: string;
  }): OrchestratedResult<MarketBenchmark> {
    const { category, city, state, county, msa } = params;
    const queryHash = DataCache.generateQueryHash({ category, city, state, county, msa });
    const cacheKey = DataCache.buildKey('CITY_INDUSTRY_BENCHMARK', queryHash);

    // 1. Check Local Cache first
    const cached = DataCache.get<MarketBenchmark>(cacheKey);
    if (cached && !cached.isStale) {
      return {
        data: cached.data,
        source: 'Local Benchmark Cache',
        evidenceStatus: 'DERIVED',
        isCached: true,
        isStale: false,
        confidence: 'High',
        timestamp: cached.entry.createdAt
      };
    }

    // 2. Resolve via Local Reference Engine (Compact Indices)
    const resolvedIndustry = IndustryResolver.resolve(category);
    const resolvedGeo = GeographyResolver.resolveSync(city, state);

    const targetState = state || resolvedGeo.stateCode || '';
    const targetCounty = county || resolvedGeo.county || '';
    const targetMsa = msa || resolvedGeo.msa || '';

    const benchmark = MarketReferenceEngine.getMarketBenchmark(
      category,
      city,
      targetState,
      targetCounty,
      resolvedIndustry.naicsCandidates,
      targetMsa
    );

    // 3. Save into DataCache
    DataCache.set(
      cacheKey,
      benchmark,
      'CITY_INDUSTRY_BENCHMARK',
      'Compact Reference Datasets (CBP/QCEW/ACS)',
      queryHash
    );

    return {
      data: benchmark,
      source: 'CBP/QCEW/OEWS/ACS Compact Index',
      evidenceStatus: benchmark.summaryStatus === 'REFERENCE DATA AVAILABLE' ? 'DERIVED' : 'ESTIMATED',
      isCached: false,
      isStale: false,
      confidence: benchmark.summaryStatus === 'REFERENCE DATA AVAILABLE' ? 'High' : 'Medium',
      timestamp: Date.now()
    };
  }

  /**
   * Orchestrates Competitor / Local Businesses data with SWR and Budget Guards
   */
  static async getLocalCompetitors(params: {
    keyword: string;
    lat: number;
    lon: number;
    radiusKm: number;
  }): Promise<OrchestratedResult<any[]>> {
    const { keyword, lat, lon, radiusKm } = params;
    // Round coords to 2 decimals for grouping
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const queryHash = DataCache.generateQueryHash({ keyword, roundedLat, roundedLon, radiusKm });
    const cacheKey = DataCache.buildKey('LOCAL_BUSINESSES', queryHash);

    // 1. Check Cache (SWR)
    const cached = DataCache.get<any[]>(cacheKey);
    if (cached) {
      if (cached.isStale) {
        // Trigger background refresh if budget permits
        this.refreshCompetitorsInBackground(params, cacheKey, queryHash);
      }
      return {
        data: cached.data,
        source: 'Local Cache (OSM/Radar)',
        evidenceStatus: 'VERIFIED',
        isCached: true,
        isStale: cached.isStale,
        confidence: 'High',
        timestamp: cached.entry.createdAt
      };
    }

    // 2. Fetch using Deduplication
    return this.deduplicate(queryHash, async () => {
      try {
        // Check budget
        if (!ApiBudgetGuard.canCall('geoapify')) {
          console.warn('[DataOrchestrator] Geoapify budget reached, using fallback.');
          return {
            data: [],
            source: 'Budget Guard Fallback',
            evidenceStatus: 'UNVERIFIED',
            isCached: false,
            isStale: false,
            confidence: 'Low',
            timestamp: Date.now()
          };
        }

        // Use Overpass / OSM free query
        const radiusMeters = Math.min(radiusKm * 1000, 25000);
        const overpassQuery = `[out:json][timeout:10];(node["name"]["amenity"](around:${radiusMeters},${lat},${lon});node["name"]["shop"](around:${radiusMeters},${lat},${lon});node["name"]["craft"](around:${radiusMeters},${lat},${lon}););out center 25;`;
        
        const res = await fetch('/api/overpass-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: overpassQuery }),
          signal: AbortSignal.timeout(9000)
        });

        if (!res.ok) {
          throw new Error(`Overpass error ${res.status}`);
        }

        const json = await res.json() as { elements?: any[] };
        const items = (json.elements || []).map((el: any) => ({
          id: String(el.id),
          name: el.tags?.name || 'Local Business',
          lat: el.lat,
          lon: el.lon,
          category: el.tags?.craft || el.tags?.shop || el.tags?.amenity || keyword,
          phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
          website: el.tags?.website || el.tags?.['contact:website'] || null,
          source: 'OpenStreetMap'
        }));

        DataCache.set(cacheKey, items, 'LOCAL_BUSINESSES', 'OpenStreetMap Overpass API', queryHash);
        ApiBudgetGuard.recordCall('geoapify', 1);

        return {
          data: items,
          source: 'OpenStreetMap Live Data',
          evidenceStatus: 'VERIFIED',
          isCached: false,
          isStale: false,
          confidence: 'High',
          timestamp: Date.now()
        };
      } catch (err) {
        console.warn('[DataOrchestrator] Competitors live fetch failed:', err);
        return {
          data: [],
          source: 'Live Query Fallback',
          evidenceStatus: 'UNVERIFIED',
          isCached: false,
          isStale: false,
          confidence: 'Low',
          timestamp: Date.now()
        };
      }
    });
  }

  private static async refreshCompetitorsInBackground(
    params: { keyword: string; lat: number; lon: number; radiusKm: number },
    cacheKey: string,
    queryHash: string
  ) {
    if (!ApiBudgetGuard.canCall('geoapify')) return;
    try {
      const radiusMeters = Math.min(params.radiusKm * 1000, 25000);
      const overpassQuery = `[out:json][timeout:10];(node["name"]["amenity"](around:${radiusMeters},${params.lat},${params.lon}););out center 20;`;
      const res = await fetch('/api/overpass-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: overpassQuery }),
        signal: AbortSignal.timeout(9000)
      });
      if (res.ok) {
        const json = await res.json() as { elements?: any[] };
        const items = (json.elements || []).map((el: any) => ({
          id: String(el.id),
          name: el.tags?.name || 'Local Business',
          lat: el.lat,
          lon: el.lon,
          category: el.tags?.craft || el.tags?.shop || el.tags?.amenity || params.keyword,
          phone: el.tags?.phone || null,
          website: el.tags?.website || null,
          source: 'OpenStreetMap'
        }));
        DataCache.set(cacheKey, items, 'LOCAL_BUSINESSES', 'OpenStreetMap Overpass API', queryHash);
      }
    } catch {
      // SWR background refresh failure is non-blocking
    }
  }
}
