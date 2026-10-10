/**
 * BVELT Offline Evidence Record Cache
 * Coordinates offline storage of Verified Records across IndexedDB and CacheStorage.
 */

import { offlineStore, CachedVerifiedRecord } from './offlineStore';

export const EVIDENCE_CACHE_NAME = 'bvelt-data-v1';

/**
 * Caches a Verified Record both in IndexedDB and in CacheStorage for instant offline access.
 */
export async function cacheVerifiedRecordOffline(entityId: string, record: any): Promise<void> {
  if (!entityId || !record) return;

  try {
    // 1. Save in IndexedDB
    await offlineStore.cacheVerifiedRecord(entityId, record, record.headHash, record.isValid !== false);

    // 2. Cache in CacheStorage for HTTP route matching
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(EVIDENCE_CACHE_NAME);
      const url = `/api/business/${encodeURIComponent(entityId)}/evidence`;
      const response = new Response(JSON.stringify({
        status: 'SUCCESS',
        data: record,
        _offlineCachedAt: Date.now()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Bvelt-Offline': 'true'
        }
      });
      await cache.put(url, response);
    }
  } catch (err) {
    console.debug('[OfflineEvidenceCache] Failed to cache verified record offline:', err);
  }
}

/**
 * Retrieves a Verified Record from offline cache (IndexedDB first, CacheStorage fallback).
 */
export async function getOfflineVerifiedRecord(entityId: string): Promise<any | null> {
  if (!entityId) return null;

  try {
    // 1. Check IndexedDB
    const cachedItem = await offlineStore.getCachedVerifiedRecord(entityId);
    if (cachedItem && cachedItem.recordData) {
      return cachedItem.recordData;
    }

    // 2. Check CacheStorage
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(EVIDENCE_CACHE_NAME);
      const url = `/api/business/${encodeURIComponent(entityId)}/evidence`;
      const match = await cache.match(url);
      if (match) {
        const json: any = await match.json();
        return json?.data || json;
      }
    }
  } catch (err) {
    console.debug('[OfflineEvidenceCache] Error reading offline verified record:', err);
  }

  return null;
}
