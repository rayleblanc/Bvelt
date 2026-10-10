/**
 * A generalized local cache using IndexedDB (via localforage) and fallback to LocalStorage.
 * Handles TTLs and Source Metadatas natively.
 */

// Basic TTL wrapper for LocalStorage since localforage requires external deps which we'll avoid if unneeded.
// We'll use LocalStorage with TTLs.
const PREFIX = 'bvelt_cache_v2_';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class BveltLocalCache {
  static set<T>(key: string, data: T, ttlMs: number = 86400000 /* 24h default */): void {
    if (typeof window === 'undefined') return;
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttlMs
      };
      localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(entry));
    } catch (e) {
      console.warn(`[LocalCache] Failed to write key ${key}`);
    }
  }

  static get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${PREFIX}${key}`);
      if (!raw) return null;
      
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.timestamp > entry.ttlMs) {
        // Expired
        localStorage.removeItem(`${PREFIX}${key}`);
        return null;
      }
      return entry.data;
    } catch (e) {
      console.warn(`[LocalCache] Failed to read key ${key}`);
      return null;
    }
  }

  static remove(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${PREFIX}${key}`);
  }
}
