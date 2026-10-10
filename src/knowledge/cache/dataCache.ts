/**
 * Central Data Cache Manager for Bvelt
 * Features:
 * - TTL-based expiration per data category
 * - Query fingerprinting & hashing
 * - Cache metadata with versioning, evidence source, and status
 * - Fallback to LocalStorage with memory tier
 */

export type DataCategory = 
  | 'REFERENCE_DATA'
  | 'CITY_INDUSTRY_BENCHMARK'
  | 'LOCAL_BUSINESSES'
  | 'COMPETITOR_DATA'
  | 'WEB_ENRICHMENT'
  | 'LIVE_CLIENT_DATA';

export interface DataCacheEntry<T = any> {
  key: string;
  source: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  version: string;
  queryHash: string;
  category: DataCategory;
}

const CATEGORY_TTLS: Record<DataCategory, number> = {
  REFERENCE_DATA: 7 * 24 * 60 * 60 * 1000,          // 7 days
  CITY_INDUSTRY_BENCHMARK: 24 * 60 * 60 * 1000,     // 24 hours
  LOCAL_BUSINESSES: 6 * 60 * 60 * 1000,             // 6 hours
  COMPETITOR_DATA: 60 * 60 * 1000,                  // 1 hour
  WEB_ENRICHMENT: 2 * 60 * 60 * 1000,               // 2 hours
  LIVE_CLIENT_DATA: 15 * 60 * 1000                  // 15 minutes
};

const STORAGE_PREFIX = 'bvelt_dcache_v1_';
const MEMORY_CACHE = new Map<string, DataCacheEntry>();

export class DataCache {
  /**
   * Generates a stable deterministic query hash
   */
  static generateQueryHash(query: Record<string, any>): string {
    const keys = Object.keys(query).sort();
    const sortedObj: Record<string, any> = {};
    for (const k of keys) {
      if (query[k] !== undefined && query[k] !== null) {
        sortedObj[k] = typeof query[k] === 'string' ? query[k].trim().toLowerCase() : query[k];
      }
    }
    const str = JSON.stringify(sortedObj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `qh_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Builds a uniform cache key
   */
  static buildKey(category: DataCategory, queryHash: string): string {
    return `${category}_${queryHash}`;
  }

  /**
   * Gets an entry with staleness detection (supports Stale-While-Revalidate)
   */
  static get<T = any>(key: string): { data: T; isStale: boolean; entry: DataCacheEntry<T> } | null {
    const now = Date.now();

    // 1. Check memory cache
    let entry = MEMORY_CACHE.get(key) as DataCacheEntry<T> | undefined;

    // 2. Check localStorage if not in memory
    if (!entry && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (raw) {
          entry = JSON.parse(raw) as DataCacheEntry<T>;
          if (entry) {
            MEMORY_CACHE.set(key, entry);
          }
        }
      } catch (err) {
        console.warn(`[DataCache] Error reading key ${key}:`, err);
      }
    }

    if (!entry) {
      return null;
    }

    const isStale = now > entry.expiresAt;
    return {
      data: entry.data,
      isStale,
      entry
    };
  }

  /**
   * Saves an entry into memory and localStorage
   */
  static set<T = any>(
    key: string,
    data: T,
    category: DataCategory,
    source: string,
    queryHash: string = '',
    customTtlMs?: number,
    version: string = '1.0.0'
  ): DataCacheEntry<T> {
    const now = Date.now();
    const ttl = customTtlMs ?? CATEGORY_TTLS[category] ?? 60 * 60 * 1000;
    
    const entry: DataCacheEntry<T> = {
      key,
      source,
      data,
      createdAt: now,
      expiresAt: now + ttl,
      version,
      queryHash: queryHash || key,
      category
    };

    MEMORY_CACHE.set(key, entry);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
      } catch (err) {
        // Handle quota full by clearing oldest entries
        console.warn(`[DataCache] Storage full or write error for ${key}. Pruning...`);
        this.pruneOldEntries();
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
        } catch {
          // Ignore secondary write failures
        }
      }
    }

    return entry;
  }

  /**
   * Removes a specific key
   */
  static remove(key: string): void {
    MEMORY_CACHE.delete(key);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    }
  }

  /**
   * Prunes expired or older entries from localStorage
   */
  static pruneOldEntries(): void {
    if (typeof window === 'undefined') return;
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed: DataCacheEntry = JSON.parse(raw);
              if (parsed.expiresAt < now) {
                keysToRemove.push(k);
              }
            }
          } catch {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[DataCache] Prune failed:', e);
    }
  }
}
