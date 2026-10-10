// Note: Optional TenantOpportunityPort (src/services/tenantOpportunityPort.ts) can merge remote Radar tenant feed later when ENABLE_RADAR_TENANT=1
import { 
  OverpassNearbySource, 
  GeoapifyOrLocationIQNearbySource, 
  MiamiPermitsSource, 
  NoaaStormSource 
} from './jobFinderSources.ts';
import type { OpportunitySource, Opportunity } from './jobFinderModule.ts';
import { getTenantOpportunityPort } from './tenantOpportunityPort.ts';

export class JobFinderEngine {
  private sources: OpportunitySource[] = [
    new OverpassNearbySource(),
    new GeoapifyOrLocationIQNearbySource(),
    new MiamiPermitsSource(),
    new NoaaStormSource()
  ];

  async getOpportunities(params: {
    trade: string;
    city?: string;
    lat: number;
    lng: number;
    radiusMi: number;
    sinceDays: number;
    testMode?: boolean;
    tenantId?: string;
  }): Promise<{ opportunities: Opportunity[]; sourcesUsed: string[]; errors: string[] }> {
    let effectiveLat = params.lat;
    let effectiveLng = params.lng;
    if (params.city && params.city.toLowerCase().includes('naples') && (!effectiveLat || effectiveLat === 0 || effectiveLng === 0)) {
      effectiveLat = 26.1420;
      effectiveLng = -81.7948;
    }
    const queryParams = { ...params, lat: effectiveLat, lng: effectiveLng };

    const errors: string[] = [];
    const sourcesUsed: string[] = [];
    let allOpportunities: Opportunity[] = [];

    // Run all sources in parallel with individual timeout wrappers
    const sourcePromises = this.sources.map(async (src) => {
      try {
        const timeoutPromise = new Promise<Opportunity[]>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after 7s`)), 7000)
        );
        const results = await Promise.race([src.fetch(queryParams), timeoutPromise]);
        return { id: src.id, results };
      } catch (err: any) {
        return { id: src.id, error: err.message || String(err) };
      }
    });

    // Add Tenant Opportunity Port
    sourcePromises.push((async () => {
      try {
        const port = getTenantOpportunityPort();
        const results = await port.listOpportunities({ 
            tenantId: params.tenantId || 'default-tenant', 
            city: params.city, 
            trade: params.trade 
        });
        return { id: 'radar-tenant', results };
      } catch (err: any) {
        return { id: 'radar-tenant', results: [] };
      }
    })());

    const settled = await Promise.allSettled(sourcePromises);

    for (const res of settled) {
      if (res.status === 'fulfilled') {
        const val = res.value;
        if (val.error) {
          errors.push(`${val.id}: ${val.error}`);
        } else if (Array.isArray(val.results) && val.results.length > 0) {
          sourcesUsed.push(val.id);
          allOpportunities.push(...val.results);
        }
      } else {
        errors.push(`Source execution failed: ${res.reason?.message || res.reason}`);
      }
    }

    // Deduplicate by ID or Title + Approx Distance
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const deduped: Opportunity[] = [];

    for (const opp of allOpportunities) {
      if (seenIds.has(opp.id)) continue;
      
      const approxDist = opp.distanceMi !== undefined ? Math.round(opp.distanceMi * 5) / 5 : 0;
      const titleKey = `${(opp.title || '').toLowerCase().trim()}_${approxDist}`;
      if (seenTitles.has(titleKey)) continue;

      seenIds.add(opp.id);
      seenTitles.add(titleKey);
      deduped.push(opp);
    }

    // Sort by distanceMi ascending (closest first), then recency descending
    deduped.sort((a, b) => {
      const distA = a.distanceMi ?? 999;
      const distB = b.distanceMi ?? 999;
      if (distA !== distB) return distA - distB;
      return new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime();
    });

    // Cap at 20 results
    const finalResults = deduped.slice(0, 20);

    return {
      opportunities: finalResults,
      sourcesUsed,
      errors
    };
  }
}

export const jobFinderEngine = new JobFinderEngine();
