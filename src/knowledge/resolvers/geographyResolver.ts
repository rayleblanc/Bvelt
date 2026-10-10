import { ApiBudgetGuard } from '../cache/budgetManager';
import { BveltLocalCache } from '../cache/localCache';
import { getDatasetManifest } from '../manifest';
import { COMPACT_GEO_INDEX } from '../data/geo_index';

export interface GeoResolved {
  city: string;
  state?: string;
  stateCode?: string;
  county?: string;
  msa?: string;
  zip?: string;
  country?: string;
  latitude: number | null;
  longitude: number | null;
  source: 'REFERENCE' | 'CACHE' | 'LIVE_GEOCODING' | 'FALLBACK';
  confidence: number;
}

export class GeographyResolver {
  private static CACHE_PREFIX = 'bvelt_geo_';

  static resolveSync(city: string, state?: string, country: string = 'US', zip?: string): GeoResolved {
    const cacheKey = `${this.CACHE_PREFIX}${city}_${state || ''}_${zip || ''}_${country}`.toLowerCase().replace(/\s+/g, '_');
    
    // 1. CACHE
    const cached = BveltLocalCache.get<GeoResolved>(cacheKey);
    if (cached) {
      return { ...cached, stateCode: cached.stateCode || cached.state, source: 'CACHE' };
    }

    // 2. REFERENCE
    const placesManifest = getDatasetManifest('geo_places_2025');
    if (placesManifest && placesManifest.status === 'LOCAL_INDEX') {
      const searchKey = `${city.toLowerCase().replace(/\s+/g, '_')}_${state?.toLowerCase() || ''}`;
      const found = COMPACT_GEO_INDEX[searchKey];
      if (found) {
        const stateVal = found.stateCode || found.state;
        const result: GeoResolved = {
          city: found.city,
          state: stateVal,
          stateCode: stateVal,
          county: found.county,
          msa: found.cbsa,
          zip: zip,
          country: 'US',
          latitude: found.lat,
          longitude: found.lon,
          source: 'REFERENCE',
          confidence: 1.0
        };
        BveltLocalCache.set(cacheKey, result, 7 * 24 * 60 * 60 * 1000); // 7 days
        return result;
      }
    }

    return {
      city,
      state,
      stateCode: state,
      zip,
      country,
      latitude: null,
      longitude: null,
      source: 'FALLBACK',
      confidence: 0
    };
  }

  static async resolve(city: string, state?: string, country: string = 'US', zip?: string): Promise<GeoResolved> {
    return this.resolveSync(city, state, country, zip);
  }
}
