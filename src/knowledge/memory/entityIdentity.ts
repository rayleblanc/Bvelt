/**
 * BVELT MEMORY v1 (BEM) — Entity Identity Resolution
 * 
 * Provides deterministic entity key generation, normalization helpers,
 * and conservative identity resolution to prevent collision and fragmentation.
 */

import { EntityIdentity, EntitySourceIds, EntityType, IdentityStatus } from './bemTypes';

/**
 * Normalizes a business name by trimming, lowercasing, stripping legal suffixes,
 * and removing special characters.
 */
export function normalizeBusinessName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim().toLowerCase();
  
  // Remove common legal suffixes
  cleaned = cleaned.replace(/\b(llc|inc|corp|corporation|ltd|limited|co|company|group|services|p\.c\.|pllc)\b/gi, '');
  
  // Remove punctuation and special symbols
  cleaned = cleaned.replace(/[^a-z0-9\s]/gi, ' ');
  
  // Collapse whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes phone number to standard E.164-like string format (+1XXXXXXXXXX).
 */
export function normalizePhoneE164(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.length >= 7) {
    return `+${digits}`;
  }
  return null;
}

/**
 * Normalizes a website URL to a canonical domain (e.g. "joeshvac.com").
 */
export function normalizeDomain(url: string): string | null {
  if (!url) return null;
  let cleaned = url.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/^www\./i, '');
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx !== -1) {
    cleaned = cleaned.substring(0, slashIdx);
  }
  const portIdx = cleaned.indexOf(':');
  if (portIdx !== -1) {
    cleaned = cleaned.substring(0, portIdx);
  }
  return cleaned || null;
}

/**
 * Simple stable string hashing function yielding a positive hexadecimal string.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generates a deterministic Entity ID based on identity signals.
 * Priority:
 * 1. googlePlaceId -> `ent_biz_gplace_<hash>`
 * 2. domain + phone -> `ent_biz_domphone_<hash>`
 * 3. normalizedName + postalCode -> `ent_biz_composite_<hash>`
 */
export function generateEntityId(input: {
  canonicalName: string;
  sourceIds?: EntitySourceIds;
  domain?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): { entityId: string; status: IdentityStatus } {
  const placeId = input.sourceIds?.googlePlaceId;
  const osmId = input.sourceIds?.osmId;
  const geoapifyId = input.sourceIds?.geoapifyId;
  const domain = normalizeDomain(input.domain || input.sourceIds?.domain || '');
  const phone = normalizePhoneE164(input.phone || '');
  const normName = normalizeBusinessName(input.canonicalName);
  const postal = (input.postalCode || '').trim();
  const city = (input.city || '').trim().toLowerCase();

  // Tier 1: Authoritative Global Spatial / Place ID Anchors
  if (placeId) {
    return {
      entityId: `ent_biz_gplace_${simpleHash(placeId)}`,
      status: 'RESOLVED'
    };
  }

  if (osmId) {
    return {
      entityId: `ent_biz_osm_${simpleHash(osmId)}`,
      status: 'RESOLVED'
    };
  }

  if (geoapifyId) {
    return {
      entityId: `ent_biz_gapify_${simpleHash(geoapifyId)}`,
      status: 'RESOLVED'
    };
  }

  // Tier 2: Domain + Phone Anchor
  if (domain && phone) {
    return {
      entityId: `ent_biz_domphone_${simpleHash(`${domain}|${phone}`)}`,
      status: 'RESOLVED'
    };
  }

  // Tier 3: Domain Alone (Strong digital anchor)
  if (domain) {
    return {
      entityId: `ent_biz_dom_${simpleHash(domain)}`,
      status: 'RESOLVED'
    };
  }

  // Tier 4: Name + Phone
  if (normName && phone) {
    return {
      entityId: `ent_biz_np_${simpleHash(`${normName}|${phone}`)}`,
      status: 'RESOLVED'
    };
  }

  // Tier 5: Composite Fallback Signal (Provisional)
  const compositeString = `${normName}|${postal || city}`;
  return {
    entityId: `ent_biz_comp_${simpleHash(compositeString)}`,
    status: 'PROVISIONAL'
  };
}

/**
 * Creates a fully initialized EntityIdentity instance.
 */
export function createEntityIdentity(params: {
  entityType?: EntityType;
  canonicalName: string;
  aliases?: string[];
  sourceIds?: EntitySourceIds;
  domain?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  naicsCode?: string | null;
  primaryCategory?: string | null;
}): EntityIdentity {
  const normName = normalizeBusinessName(params.canonicalName);
  const domain = normalizeDomain(params.domain || params.sourceIds?.domain || '');
  const phone = normalizePhoneE164(params.phone || '');
  
  const { entityId, status } = generateEntityId({
    canonicalName: params.canonicalName,
    sourceIds: params.sourceIds,
    domain,
    phone,
    postalCode: params.postalCode,
    city: params.city
  });

  const now = new Date().toISOString();

  return {
    entityType: params.entityType || 'BUSINESS',
    entityId,
    identityVersion: 1,
    canonicalName: params.canonicalName,
    normalizedName: normName,
    aliases: params.aliases || [],
    sourceIds: params.sourceIds || {},
    addressNormalized: params.address ? params.address.trim() : null,
    cityNormalized: params.city ? params.city.trim().toLowerCase() : null,
    stateCode: params.state ? params.state.trim().toUpperCase() : null,
    postalCode: params.postalCode ? params.postalCode.trim() : null,
    countryCode: params.countryCode ? params.countryCode.trim().toUpperCase() : 'US',
    coordinates: params.coordinates || null,
    phoneE164: phone,
    domainCanonical: domain,
    naicsCode: params.naicsCode || null,
    primaryCategory: params.primaryCategory || null,
    identityConfidence: status === 'RESOLVED' ? 0.95 : 0.70,
    identityStatus: status,
    createdAt: now,
    lastResolvedAt: now
  };
}

/**
 * Conservative Identity Comparison
 * Prevents aggressive merging when phone or domain conflict.
 */
export function compareIdentities(a: EntityIdentity, b: EntityIdentity): {
  isMatch: boolean;
  isConflict: boolean;
  reason: string;
} {
  // Direct Entity ID match
  if (a.entityId === b.entityId) {
    return { isMatch: true, isConflict: false, reason: 'Identical canonical entityId' };
  }

  // Google Place ID check
  if (a.sourceIds.googlePlaceId && b.sourceIds.googlePlaceId) {
    if (a.sourceIds.googlePlaceId === b.sourceIds.googlePlaceId) {
      return { isMatch: true, isConflict: false, reason: 'Matching googlePlaceId' };
    } else {
      return { isMatch: false, isConflict: true, reason: 'Conflicting googlePlaceIds' };
    }
  }

  // Domain conflict check
  if (a.domainCanonical && b.domainCanonical && a.domainCanonical !== b.domainCanonical) {
    // If names match but domains differ, treat as distinct or conflict
    if (a.normalizedName === b.normalizedName) {
      return { isMatch: false, isConflict: true, reason: 'Same name but different domains' };
    }
    return { isMatch: false, isConflict: false, reason: 'Different domains' };
  }

  // Phone conflict check
  if (a.phoneE164 && b.phoneE164 && a.phoneE164 !== b.phoneE164) {
    if (a.normalizedName === b.normalizedName && a.postalCode === b.postalCode) {
      return { isMatch: false, isConflict: true, reason: 'Matching name and postal code but different phone numbers' };
    }
    return { isMatch: false, isConflict: false, reason: 'Different phone numbers' };
  }

  // Domain & Name match
  if (a.domainCanonical && b.domainCanonical && a.domainCanonical === b.domainCanonical) {
    return { isMatch: true, isConflict: false, reason: 'Matching canonical domain' };
  }

  // Phone & Name match
  if (a.phoneE164 && b.phoneE164 && a.phoneE164 === b.phoneE164 && a.normalizedName === b.normalizedName) {
    return { isMatch: true, isConflict: false, reason: 'Matching phone and normalized name' };
  }

  return { isMatch: false, isConflict: false, reason: 'No definitive matching anchor' };
}
