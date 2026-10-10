/**
 * BVELT MEMORY v1 (BEM) — Freshness Evaluator
 * 
 * Computes field-level availability states ('FRESH', 'STALE', 'MISSING', 'CONFLICTED')
 * using category-specific TTLs and Stale-While-Revalidate (SWR) windows.
 */

import { FieldAvailabilityState, MemoryEvidenceRecord } from './bemTypes';

export const BEM_CATEGORY_TTLS_MS: Record<string, { ttlMs: number; swrWindowMs: number }> = {
  // Identity, Phone, Address, Website (Low volatility)
  IDENTITY_CONTACT: {
    ttlMs: 30 * 24 * 60 * 60 * 1000,       // 30 Days
    swrWindowMs: 30 * 24 * 60 * 60 * 1000 // 30 Days SWR
  },
  // Rating & Review Count (Medium volatility)
  RATING_REVIEWS: {
    ttlMs: 7 * 24 * 60 * 60 * 1000,        // 7 Days
    swrWindowMs: 7 * 24 * 60 * 60 * 1000  // 7 Days SWR
  },
  // Map grids, competitor scans (High volatility)
  COMPETITOR_SCAN: {
    ttlMs: 3 * 24 * 60 * 60 * 1000,        // 3 Days
    swrWindowMs: 4 * 24 * 60 * 60 * 1000  // 4 Days SWR
  },
  // Static Reference & Census datasets
  STATIC_REFERENCE: {
    ttlMs: 365 * 24 * 60 * 60 * 1000,      // 365 Days
    swrWindowMs: 365 * 24 * 60 * 60 * 1000
  },
  // Default fallback category
  DEFAULT: {
    ttlMs: 7 * 24 * 60 * 60 * 1000,        // 7 Days
    swrWindowMs: 7 * 24 * 60 * 60 * 1000
  }
};

/**
 * Maps a fieldKey to its BEM Category Policy.
 */
export function getCategoryPolicyForField(fieldKey: string): { ttlMs: number; swrWindowMs: number } {
  const key = fieldKey.toLowerCase();
  
  if (['name', 'address', 'phone', 'website', 'domain', 'city', 'state', 'postalcode', 'googleplaceid'].some(k => key.includes(k))) {
    return BEM_CATEGORY_TTLS_MS.IDENTITY_CONTACT;
  }
  
  if (['rating', 'reviews', 'reviewcount', 'reputation'].some(k => key.includes(k))) {
    return BEM_CATEGORY_TTLS_MS.RATING_REVIEWS;
  }
  
  if (['competitor', 'scan', 'mapgrid', 'grid', 'radar'].some(k => key.includes(k))) {
    return BEM_CATEGORY_TTLS_MS.COMPETITOR_SCAN;
  }
  
  if (['naics', 'census', 'benchmark', 'reference'].some(k => key.includes(k))) {
    return BEM_CATEGORY_TTLS_MS.STATIC_REFERENCE;
  }
  
  return BEM_CATEGORY_TTLS_MS.DEFAULT;
}

/**
 * Evaluates the freshness state of a specific MemoryEvidenceRecord.
 */
export function evaluateRecordFreshness(
  record?: MemoryEvidenceRecord | null,
  nowMs: number = Date.now()
): FieldAvailabilityState {
  if (!record || record.value === undefined || record.value === null) {
    return 'MISSING';
  }

  // Check if explicit conflict status
  if (record.evidenceStatus === 'UNVERIFIED' && record.confidence < 0.2) {
    return 'CONFLICTED';
  }

  const retrievedTime = new Date(record.retrievedAt || record.observedAt).getTime();
  if (isNaN(retrievedTime)) {
    return 'STALE';
  }

  const policy = getCategoryPolicyForField(record.fieldKey);
  const expirationTime = record.expiresAt ? new Date(record.expiresAt).getTime() : (retrievedTime + policy.ttlMs);
  const swrExpirationTime = expirationTime + policy.swrWindowMs;

  if (nowMs <= expirationTime) {
    return 'FRESH';
  } else if (nowMs <= swrExpirationTime) {
    return 'STALE';
  } else {
    return 'MISSING'; // Expired past SWR window
  }
}

/**
 * Calculates the expiration date ISO string for a given field key.
 */
export function calculateExpirationIso(fieldKey: string, baseTimeIso?: string): string {
  const baseTime = baseTimeIso ? new Date(baseTimeIso).getTime() : Date.now();
  const policy = getCategoryPolicyForField(fieldKey);
  return new Date(baseTime + policy.ttlMs).toISOString();
}
