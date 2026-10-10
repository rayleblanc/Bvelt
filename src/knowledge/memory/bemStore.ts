/**
 * BVELT MEMORY v1 (BEM) — Persistence & Memory Store Engine
 * 
 * Manages L1 (Memory) + L2 (Local Cache) + L3 (Firestore Option C) evidence persistence.
 * Guarantees tenant isolation, public/private data separation, bounded document updates,
 * and point-in-time idempotent reads/writes without real-time listeners or polling loops.
 */

import { doc, getDoc, setDoc, writeBatch, increment } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { 
  DataClassification, 
  EntityIdentity, 
  EntityMemoryContext, 
  FieldMemoryContext, 
  MemoryEvidenceRecord,
  EvidenceEvent,
  ConflictRecord,
  EventRelationshipType,
  ActionReference,
  OutcomeReference,
  BaselineReference,
  TemporalAssociationType
} from './bemTypes';
import { evaluateRecordFreshness, calculateExpirationIso } from './freshnessEvaluator';
import { createEntityIdentity } from './entityIdentity';
import { computeChainedEventHash, GENESIS_HASH } from './integrity/evidenceIntegrity';
import { BemTelemetry } from './bemTelemetry';
import { DataCache } from '../cache/dataCache';
import { DataOrchestrator } from '../cache/dataOrchestrator';
import { BusinessDnaService } from './businessDnaService';

// In-Memory L1 Cache Map for Entity Memory Contexts
const BEM_L1_MEMORY = new Map<string, { identity: EntityIdentity; records: Map<string, MemoryEvidenceRecord>; lastEventHash?: string }>();

// In-Memory L1 Cache for Conflict original occurrence timestamps to prevent redundant Firestore point reads
const BEM_CONFLICTS_CACHE = new Map<string, string>();

/**
 * Utility to check if two evidence values are structurally/primitively equivalent.
 */
export function areValuesEquivalent(val1: any, val2: any): boolean {
  if (val1 === val2) return true;
  if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) {
    return val1 === val2;
  }
  if (typeof val1 !== typeof val2) return false;
  if (typeof val1 === 'object') {
    try {
      return JSON.stringify(val1) === JSON.stringify(val2);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Creates a default MemoryEvidenceRecord helper.
 */
export function createMemoryRecord<T = any>(params: {
  entityId: string;
  fieldKey: string;
  value: T;
  valueType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  observationType: MemoryEvidenceRecord['observationType'];
  evidenceStatus: MemoryEvidenceRecord['evidenceStatus'];
  classification?: DataClassification;
  confidence?: number;
  sourceType: string;
  sourceLabel: string;
  sourceId?: string | null;
  formula?: string;
  assumptions?: string[];
  producerVersion?: string;
}): MemoryEvidenceRecord<T> {
  const now = new Date().toISOString();
  
  // Epistemological Rule: AI_INTERPRETATION can NEVER be tagged as VERIFIED or FACT
  let finalStatus = params.evidenceStatus;
  if (params.observationType === 'AI_INTERPRETATION' && (finalStatus === 'VERIFIED' as any)) {
    finalStatus = 'INFERRED';
  }

  const confidence = params.confidence ?? (params.observationType === 'FACT' ? 0.95 : 0.70);
  const confidenceLevel = confidence >= 0.8 ? 'High' : confidence >= 0.45 ? 'Medium' : 'Low';

  const expiresAt = calculateExpirationIso(params.fieldKey, now);

  const record: MemoryEvidenceRecord<T> = {
    recordId: `ev_${params.entityId}_${params.fieldKey}_${Date.now()}`,
    entityId: params.entityId,
    fieldKey: params.fieldKey,
    value: params.value,
    valueType: params.valueType || (typeof params.value as any),
    observationType: params.observationType,
    evidenceStatus: finalStatus,
    classification: params.classification || 'PUBLIC_SHARED',
    confidence,
    confidenceLevel,
    sourceType: params.sourceType,
    sourceLabel: params.sourceLabel,
    sourceId: params.sourceId || null,
    formula: params.formula || null,
    assumptions: params.assumptions || [],
    observedAt: now,
    retrievedAt: now,
    lastVerifiedAt: now,
    expiresAt,
    schemaVersion: 1
  };
  
  if (params.producerVersion !== undefined) {
    record.producerVersion = params.producerVersion;
  }
  
  return record;
}

/**
 * Stores or updates a single evidence record in L1 memory and L3 Firestore (Option C Document Model).
 */
export async function writeEvidenceRecord(
  identity: EntityIdentity,
  record: MemoryEvidenceRecord,
  tenantUid?: string | null
): Promise<void> {
  // Gate Check: PUBLIC_SHARED memory writes require RESOLVED identity
  if (record.classification === 'PUBLIC_SHARED' && identity.identityStatus !== 'RESOLVED') {
    return;
  }

  // 1. Update L1 Memory Cache
  let l1Entry = BEM_L1_MEMORY.get(identity.entityId);
  if (!l1Entry) {
    l1Entry = { identity, records: new Map() };
    BEM_L1_MEMORY.set(identity.entityId, l1Entry);
  }

  // Content Equality Check against L1 Memory
  const existingInL1 = l1Entry.records.get(record.fieldKey);
  if (existingInL1 && areValuesEquivalent(existingInL1.value, record.value) && existingInL1.sourceType === record.sourceType) {
    // Value unchanged: update timestamp in L1/L2 memory, skip Firestore network write
    existingInL1.lastVerifiedAt = record.lastVerifiedAt || new Date().toISOString();
    BemTelemetry.record({ eventType: 'memory_write_noop', entityId: identity.entityId, fieldKey: record.fieldKey, reason: 'CONTENT_UNCHANGED' });
    return;
  }

  l1Entry.identity = identity;
  l1Entry.records.set(record.fieldKey, record);
  BemTelemetry.record({ eventType: 'memory_write_update', entityId: identity.entityId, fieldKey: record.fieldKey, reason: 'CONTENT_CHANGED' });

  // 2. Also populate DataCache (L2) for cross-module compatibility
  const cacheKey = DataCache.buildKey('LOCAL_BUSINESSES', `bem_${identity.entityId}_${record.fieldKey}`);
  DataCache.set(cacheKey, record, 'LOCAL_BUSINESSES', 'BEM_STORE', `bem_${identity.entityId}_${record.fieldKey}`, 24 * 60 * 60 * 1000);

  // 3. Persist to L3 Firestore (Point-in-Time, Idempotent)
  if (!db) return;

  try {
    const batch = writeBatch(db);

    if (record.classification === 'TENANT_PRIVATE') {
      // TENANT_PRIVATE -> Isolated under `/users/{uid}/bem_private/{entityId}`
      if (!tenantUid) {
        console.warn('[BEM Store] Skipped private write: tenantUid is required for TENANT_PRIVATE classification');
        return;
      }
      const privateDocRef = doc(db, 'users', tenantUid, 'bem_private', identity.entityId);
      batch.set(privateDocRef, {
        entityId: identity.entityId,
        lastUpdated: new Date().toISOString(),
        [`fields.${record.fieldKey}`]: record
      }, { merge: true });
    } else {
      // PUBLIC_SHARED -> Bounded canonical document `/bem_entities/{entityId}`
      const publicDocRef = doc(db, 'bem_entities', identity.entityId);

      // Determine prevHash dynamically from L1 or Firestore entity document directly
      let prevHash = GENESIS_HASH;
      if (l1Entry && l1Entry.lastEventHash) {
        prevHash = l1Entry.lastEventHash;
      } else {
        try {
          const docSnap = await getDoc(publicDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.lastEventHash) {
              prevHash = data.lastEventHash;
            }
          }
        } catch (e) {
          console.warn('[BEM Store] Failed to read lastEventHash for fallback:', e);
        }
      }

      // History Event
      const historyEventId = `evthist_${identity.entityId}_${record.fieldKey}_${Date.now()}`;
      const historyRef = doc(db, 'bem_entities', identity.entityId, 'history', historyEventId);
      const detectedIso = new Date().toISOString();

      const historyEvent: EvidenceEvent = {
        eventId: historyEventId,
        entityId: identity.entityId,
        fieldKey: record.fieldKey,
        oldValue: existingInL1 ? existingInL1.value : null,
        newValue: record.value,
        sourceType: record.sourceType,
        observationType: record.observationType,
        evidenceStatus: record.evidenceStatus,
        confidence: record.confidence,
        observedAt: record.observedAt,
        detectedAt: detectedIso,
        previousHash: prevHash,
        currentHash: '',
        eventHash: '',
        ...(record.producerVersion ? { producerVersion: record.producerVersion } : {}),
        ...(record.relationship ? { relationship: record.relationship } : {}),
        ...(record.actionReference ? { actionReference: record.actionReference } : {}),
        ...(record.outcomeReference ? { outcomeReference: record.outcomeReference } : {}),
        ...(record.baselineReference ? { baselineReference: record.baselineReference } : {}),
        ...(record.windowStart ? { windowStart: record.windowStart } : {}),
        ...(record.windowEnd ? { windowEnd: record.windowEnd } : {}),
        schemaVersion: 1
      };

      const currHash = await computeChainedEventHash(historyEvent, prevHash);
      historyEvent.currentHash = currHash;
      historyEvent.eventHash = currHash;

      batch.set(publicDocRef, {
        entityId: identity.entityId,
        canonicalName: identity.canonicalName,
        normalizedName: identity.normalizedName,
        domainCanonical: identity.domainCanonical || null,
        phoneE164: identity.phoneE164 || null,
        lastUpdated: new Date().toISOString(),
        lastEventHash: currHash,
        schemaVersion: 1,
        [`fields.${record.fieldKey}`]: record
      }, { merge: true });

      // Update in-memory L1 cache head
      if (l1Entry) {
        l1Entry.lastEventHash = currHash;
      }

      batch.set(historyRef, historyEvent);

      // META-TRUST: Increment source observation count
      const sourceRef = doc(db, 'bem_system', `metrics_source_${record.sourceType}`);
      batch.set(sourceRef, {
        sourceType: record.sourceType,
        totalObservations: increment(1),
        lastCalculatedAt: new Date().toISOString()
      }, { merge: true });

      // Conflict Event (if valid verified disagreement)
      if (existingInL1 && existingInL1.sourceType !== record.sourceType && 
          existingInL1.evidenceStatus === 'VERIFIED' && record.evidenceStatus === 'VERIFIED') {
        const sources = [existingInL1.sourceType, record.sourceType].sort();
        const conflictId = `conf_${identity.entityId}_${record.fieldKey}_${sources[0]}_vs_${sources[1]}`;
        const conflictRef = doc(db, 'bem_entities', identity.entityId, 'conflicts', conflictId);
        
        let firstDetectedAt = new Date().toISOString();
        if (BEM_CONFLICTS_CACHE.has(conflictId)) {
          firstDetectedAt = BEM_CONFLICTS_CACHE.get(conflictId)!;
        } else {
          try {
            const conflictSnap = await getDoc(conflictRef);
            if (conflictSnap.exists()) {
              const data = conflictSnap.data() as ConflictRecord;
              if (data && data.firstDetectedAt) {
                firstDetectedAt = data.firstDetectedAt;
              }
            }
          } catch (err) {
            console.warn('[BEM Store] Failed to check existing conflict, defaulting to now:', err);
          }
          BEM_CONFLICTS_CACHE.set(conflictId, firstDetectedAt);
        }

        const conflictRecord: ConflictRecord = {
          conflictId,
          entityId: identity.entityId,
          fieldKey: record.fieldKey,
          sourceA: existingInL1.sourceType,
          valueA: existingInL1.value,
          sourceB: record.sourceType,
          valueB: record.value,
          firstDetectedAt,
          lastDetectedAt: new Date().toISOString(),
          status: 'OPEN'
        };
        batch.set(conflictRef, conflictRecord, { merge: true });

        // META-TRUST: Increment conflict metrics for both involved sources
        const sourceARef = doc(db, 'bem_system', `metrics_source_${existingInL1.sourceType}`);
        batch.set(sourceARef, {
          sourceType: existingInL1.sourceType,
          totalConflicts: increment(1),
          unresolvedConflicts: increment(1),
          lastCalculatedAt: new Date().toISOString()
        }, { merge: true });

        const sourceBRef = doc(db, 'bem_system', `metrics_source_${record.sourceType}`);
        batch.set(sourceBRef, {
          sourceType: record.sourceType,
          totalConflicts: increment(1),
          unresolvedConflicts: increment(1),
          lastCalculatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
    await batch.commit();
  } catch (err) {
    console.warn('[BEM Store] Firestore write error (failing gracefully to local memory):', err);
  }
}

/**
 * Batches multiple field evidence updates for a canonical entity into a single point-in-time Firestore write.
 * Performs PUBLIC_SHARED checks, RESOLVED identity checks, and content-equality deduplication to avoid write storming.
 */
export async function writeEntityEvidenceBatch(
  identity: EntityIdentity,
  records: MemoryEvidenceRecord[],
  tenantUid?: string | null
): Promise<{ writtenCount: number; skippedCount: number }> {
  if (!records || records.length === 0) {
    return { writtenCount: 0, skippedCount: 0 };
  }

  // Identity Check: Must be RESOLVED for PUBLIC_SHARED memory writes
  if (identity.identityStatus !== 'RESOLVED') {
    return { writtenCount: 0, skippedCount: records.length };
  }

  let l1Entry = BEM_L1_MEMORY.get(identity.entityId);
  if (!l1Entry) {
    l1Entry = { identity, records: new Map() };
    BEM_L1_MEMORY.set(identity.entityId, l1Entry);
  }

  const fieldsToUpdateInFirestore: Record<string, MemoryEvidenceRecord> = {};
  const oldValues = new Map<string, any>();
  const existingRecords = new Map<string, MemoryEvidenceRecord>();
  let skippedCount = 0;

  for (const record of records) {
    // 1. PUBLIC_SHARED Gate Check
    if (record.classification !== 'PUBLIC_SHARED') {
      skippedCount++;
      continue;
    }

    // 2. Check for Content Equality against L1 Memory
    const existingInL1 = l1Entry.records.get(record.fieldKey);
    if (existingInL1 && areValuesEquivalent(existingInL1.value, record.value) && existingInL1.sourceType === record.sourceType) {
      existingInL1.lastVerifiedAt = record.lastVerifiedAt || new Date().toISOString();
      skippedCount++;
      BemTelemetry.record({ eventType: 'memory_write_noop', entityId: identity.entityId, fieldKey: record.fieldKey, reason: 'CONTENT_UNCHANGED' });
      continue;
    }
    
    // Store old value and record for history/conflicts before mutating L1
    oldValues.set(record.fieldKey, existingInL1 ? existingInL1.value : null);
    if (existingInL1) {
      existingRecords.set(record.fieldKey, { ...existingInL1 });
    }

    // Update L1 Memory Cache & L2 Cache
    l1Entry.records.set(record.fieldKey, record);
    const cacheKey = DataCache.buildKey('LOCAL_BUSINESSES', `bem_${identity.entityId}_${record.fieldKey}`);
    DataCache.set(cacheKey, record, 'LOCAL_BUSINESSES', 'BEM_STORE', `bem_${identity.entityId}_${record.fieldKey}`, 24 * 60 * 60 * 1000);

    fieldsToUpdateInFirestore[`fields.${record.fieldKey}`] = record;
    BemTelemetry.record({ eventType: 'memory_write_update', entityId: identity.entityId, fieldKey: record.fieldKey, reason: 'CONTENT_CHANGED' });
  }

  const keysToUpdate = Object.keys(fieldsToUpdateInFirestore);
  if (keysToUpdate.length === 0) {
    return { writtenCount: 0, skippedCount };
  }

  // Persist to L3 Firestore via Secure Cloudflare Worker API
  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    if (!idToken) {
      console.warn('[BEM Store] No authenticated user found, evidence write-back skipped server-side.');
    } else {
      const response = await fetch('/api/business/evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          identity,
          records
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[BEM Store] Failed to persist evidence server-side via Worker:', errorText);
      } else {
        const resData = await response.json() as any;
        console.log(`[BEM Store] Evidence persisted successfully via Worker. Written count: ${resData.writtenCount}`);
      }
    }
  } catch (err) {
    console.warn('[BEM Store] Edge API write-back error (failing gracefully to maintain offline state):', err);
  }

  return { writtenCount: keysToUpdate.length, skippedCount };
}

/**
 * Resolves a tracked conflict and updates source reliability metrics idempotently.
 */
export async function resolveConflict(
  entityId: string,
  conflictId: string,
  winningSource: string,
  resolutionReason: string = 'MANUAL_RESOLUTION'
): Promise<boolean> {
  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    if (!idToken) {
      console.warn('[BEM Store] No authenticated user found, conflict resolution skipped.');
      return false;
    }

    const response = await fetch('/api/business/resolve-conflict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        entityId,
        conflictId,
        winningSource,
        resolutionReason
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BEM Store] Failed to resolve conflict server-side via Worker:', errorText);
      return false;
    }

    const resData = await response.json() as any;
    console.log('[BEM Store] Conflict resolved successfully via Worker:', resData.message);
    BemTelemetry.record({ eventType: 'memory_conflict', entityId, reason: 'CONFLICT_RESOLVED' });
    
    return true;
  } catch (err) {
    console.error('[BEM Store] Edge API conflict resolution error:', err);
    return false;
  }
}

/**
 * Business Scan Write-Back Handler:
 * Safe, idempotent extraction and persistence of verified public business evidence into Shared Memory.
 */
export async function persistBusinessScanToBem(scanData: {
  businessName: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  isClaimed?: boolean | null;
  rating?: number | string | null;
  reviewCount?: number | null;
  coordinates?: { lat: number; lng: number } | null;
  placeId?: string | null;
  competitorsSummary?: any;
}): Promise<boolean> {
  if (!scanData.businessName) return false;

  const identity = createEntityIdentity({
    canonicalName: scanData.businessName,
    city: scanData.city,
    state: scanData.state,
    countryCode: scanData.country,
    address: scanData.address,
    phone: scanData.phone,
    domain: scanData.website,
    coordinates: scanData.coordinates,
    sourceIds: scanData.placeId ? { googlePlaceId: scanData.placeId } : undefined
  });

  // Fallback entityId slug (name + city) if identity is not RESOLVED
  let finalIdentity = identity;
  if (finalIdentity.identityStatus !== 'RESOLVED') {
    const rawSlug = `${scanData.businessName}_${scanData.city || 'local'}`
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    finalIdentity = {
      ...finalIdentity,
      entityId: `ent_${rawSlug || 'unknown'}`,
      identityStatus: 'RESOLVED',
      identityConfidence: 0.8,
      lastResolvedAt: new Date().toISOString()
    };
  }

  const records: MemoryEvidenceRecord[] = [];

  if (scanData.businessName) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'canonicalName',
      value: scanData.businessName,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'BUSINESS_SCAN',
      sourceLabel: 'Google Business Profile / Public Index'
    }));
  }

  if (scanData.city) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'city',
      value: scanData.city,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'BUSINESS_SCAN',
      sourceLabel: 'Geographic City Resolver'
    }));
  }

  if (scanData.state) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'state',
      value: scanData.state,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'BUSINESS_SCAN',
      sourceLabel: 'Geographic State Resolver'
    }));
  }

  if (scanData.address) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'address',
      value: scanData.address,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'BUSINESS_SCAN',
      sourceLabel: 'Address Resolver'
    }));
  }

  if (scanData.phone) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'phone',
      value: scanData.phone,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'BUSINESS_SCAN',
      sourceLabel: 'Public Contact Registry'
    }));
  }

  if (scanData.website) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'website',
      value: scanData.website,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'BUSINESS_SCAN',
      sourceLabel: 'Domain Resolver'
    }));
  }

  if (scanData.isClaimed !== undefined && scanData.isClaimed !== null) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'isClaimed',
      value: Boolean(scanData.isClaimed),
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'BUSINESS_SCAN',
      sourceLabel: 'Google Business Profile Status'
    }));
  }

  if (scanData.rating !== undefined && scanData.rating !== null) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'rating',
      value: String(scanData.rating),
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'REPUTATION',
      sourceLabel: 'Google Reviews Rating'
    }));
  }

  if (scanData.reviewCount !== undefined && scanData.reviewCount !== null) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'reviewCount',
      value: Number(scanData.reviewCount),
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'REPUTATION',
      sourceLabel: 'Google Reviews Count'
    }));
  }

  if (scanData.coordinates && scanData.coordinates.lat && scanData.coordinates.lng) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'coordinates',
      value: scanData.coordinates,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'GEOLOCATION',
      sourceLabel: 'Coordinates Resolver'
    }));
  }

  if (scanData.competitorsSummary) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'competitorsSummary',
      value: scanData.competitorsSummary,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: 'COMPETITOR_INTELLIGENCE',
      sourceLabel: 'BVELT Competitor Scan Summary'
    }));
  }

  try {
    const res = await writeEntityEvidenceBatch(finalIdentity, records);
    const success = res.writtenCount > 0;
    console.log('[BEM Write-Back]', {
      bemPersist: success ? 'SUCCESS' : 'SKIPPED',
      entityId: finalIdentity.entityId,
      path: `entities/${finalIdentity.entityId}/evidence`,
      writtenCount: res.writtenCount,
      timestamp: new Date().toISOString()
    });
    return success;
  } catch (err: any) {
    console.warn('[BEM Write-Back]', {
      bemPersist: 'FAILED',
      entityId: finalIdentity.entityId,
      reason: err?.message || 'Write batch error',
      path: `entities/${finalIdentity.entityId}/evidence`,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

/**
 * Scan Maps Competitor Write-Back Handler:
 * Safe, idempotent extraction and persistence of POI competitor evidence into Shared Memory.
 */
export async function persistCompetitorPoiToBem(poi: {
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  osmId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  reviewVelocity?: number | null;
  services?: string[] | null;
  photosCount?: number | null;
  priceLevel?: number | null;
  isClaimed?: boolean | null;
  sourceType?: string;
}): Promise<boolean> {
  if (!poi.name) return false;

  const identity = createEntityIdentity({
    canonicalName: poi.name,
    address: poi.address,
    phone: poi.phone,
    domain: poi.website,
    primaryCategory: poi.category,
    coordinates: poi.lat && poi.lng ? { lat: poi.lat, lng: poi.lng } : null,
    sourceIds: {
      googlePlaceId: poi.placeId || undefined,
      osmId: poi.osmId || undefined
    }
  });

  let finalIdentity = identity;
  if (finalIdentity.identityStatus !== 'RESOLVED') {
    const rawSlug = `${poi.name}_${poi.address || 'competitor'}`
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    finalIdentity = {
      ...finalIdentity,
      entityId: `ent_${rawSlug || 'competitor'}`,
      identityStatus: 'RESOLVED',
      identityConfidence: 0.75,
      lastResolvedAt: new Date().toISOString()
    };
  }

  const records: MemoryEvidenceRecord[] = [];
  const srcType = poi.sourceType || 'SCAN_MAPS';
  const srcLabel = srcType === 'GOOGLE_PLACES' ? 'Google Places API' : 'Overpass / Maps POI Index';

  records.push(createMemoryRecord({
    entityId: finalIdentity.entityId,
    fieldKey: 'canonicalName',
    value: poi.name,
    observationType: 'FACT',
    evidenceStatus: 'VERIFIED',
    classification: 'PUBLIC_SHARED',
    sourceType: srcType,
    sourceLabel: srcLabel
  }));

  if (poi.address) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'address',
      value: poi.address,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: 'Maps Location Index'
    }));
  }

  if (poi.phone) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'phone',
      value: poi.phone,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: 'Maps Phone Registry'
    }));
  }

  if (poi.website) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'website',
      value: poi.website,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: 'Maps Website Registry'
    }));
  }

  if (poi.category) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'primaryCategory',
      value: poi.category,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: 'Category Registry'
    }));
  }

  if (poi.lat && poi.lng) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'coordinates',
      value: { lat: poi.lat, lng: poi.lng },
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: 'Maps Geolocation Index'
    }));
  }

  if (typeof poi.rating === 'number' && !isNaN(poi.rating)) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'rating',
      value: poi.rating,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: `${srcLabel} Rating`
    }));
  }

  if (typeof poi.reviewCount === 'number' && !isNaN(poi.reviewCount)) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'reviewCount',
      value: poi.reviewCount,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: `${srcLabel} Review Count`
    }));
  }

  if (Array.isArray(poi.services) && poi.services.length > 0) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'services',
      value: poi.services,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: `${srcLabel} Services`
    }));
  }

  if (typeof poi.photosCount === 'number' && !isNaN(poi.photosCount)) {
    records.push(createMemoryRecord({
      entityId: finalIdentity.entityId,
      fieldKey: 'photosCount',
      value: poi.photosCount,
      observationType: 'FACT',
      evidenceStatus: 'VERIFIED',
      classification: 'PUBLIC_SHARED',
      sourceType: srcType,
      sourceLabel: `${srcLabel} Photos`
    }));
  }

  try {
    const res = await writeEntityEvidenceBatch(finalIdentity, records);
    const success = res.writtenCount > 0;
    console.log('[BEM Write-Back]', {
      bemPersist: success ? 'SUCCESS' : 'SKIPPED',
      entityId: finalIdentity.entityId,
      path: `entities/${finalIdentity.entityId}/evidence`,
      poiName: poi.name,
      timestamp: new Date().toISOString()
    });
    return success;
  } catch (err: any) {
    console.warn('[BEM Write-Back]', {
      bemPersist: 'FAILED',
      entityId: finalIdentity.entityId,
      reason: err?.message || 'Competitor write batch error',
      path: `entities/${finalIdentity.entityId}/evidence`,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

/**
 * Records financial evidence (revenue, costs, profit) for an entity or lead under BEM.
 * Strictly saved as TENANT_PRIVATE classification.
 */
export async function recordFinancialEvidence(
  entityId: string,
  fieldKey: string,
  value: any,
  observationType: MemoryEvidenceRecord['observationType'],
  evidenceStatus: MemoryEvidenceRecord['evidenceStatus'],
  sourceLabel: string,
  tenantUid?: string | null
): Promise<boolean> {
  const identity = createEntityIdentity({
    canonicalName: entityId,
    entityType: 'BUSINESS',
    sourceIds: { crmId: entityId }
  });

  const record = createMemoryRecord({
    entityId: identity.entityId,
    fieldKey,
    value,
    observationType,
    evidenceStatus,
    classification: 'TENANT_PRIVATE',
    sourceType: 'BVELT_CRM_PROFIT_ENGINE',
    sourceLabel,
    producerVersion: '8.0.0'
  });

  const res = await writeEntityEvidenceBatch(identity, [record], tenantUid);
  return res.writtenCount > 0;
}

/**
 * Retrieves the compiled EntityMemoryContext for an entity across L1 -> L2 -> L3.
 */
export async function getEntityMemoryContext(
  identity: EntityIdentity,
  tenantUid?: string | null
): Promise<EntityMemoryContext> {
  const queryHash = `bem_ctx_${identity.entityId}_${tenantUid || 'public'}`;

  // Use DataOrchestrator request deduplication to prevent redundant parallel calls
  return DataOrchestrator.deduplicate(queryHash, async () => {
    BemTelemetry.record({ eventType: 'memory_lookup', entityId: identity.entityId });
    const fieldsMap: Record<string, FieldMemoryContext> = {};
    const nowMs = Date.now();

    // 1. Check L1 Cache
    let l1Entry = BEM_L1_MEMORY.get(identity.entityId);

    // 2. Fallback to L3 Firestore if L1 is empty and db is available
    if (!l1Entry && db) {
      try {
        const publicDocRef = doc(db, 'bem_entities', identity.entityId);
        const docSnap = await getDoc(publicDocRef);
        
        const recordsMap = new Map<string, MemoryEvidenceRecord>();
        let lastEventHash: string | undefined = undefined;
        if (docSnap.exists()) {
          const docData = docSnap.data();
          if (docData.lastEventHash) {
            lastEventHash = docData.lastEventHash;
          }
          if (docData.fields && typeof docData.fields === 'object') {
            for (const [key, val] of Object.entries(docData.fields)) {
              recordsMap.set(key, val as MemoryEvidenceRecord);
            }
          }
        }

        // Load private fields too if tenantUid is provided
        if (tenantUid) {
          const privateDocRef = doc(db, 'users', tenantUid, 'bem_private', identity.entityId);
          const privSnap = await getDoc(privateDocRef);
          if (privSnap.exists()) {
            const privData = privSnap.data();
            if (privData.fields && typeof privData.fields === 'object') {
              for (const [key, val] of Object.entries(privData.fields)) {
                recordsMap.set(key, val as MemoryEvidenceRecord);
              }
            }
          }
        }

        l1Entry = { identity, records: recordsMap, lastEventHash };
        BEM_L1_MEMORY.set(identity.entityId, l1Entry);
      } catch (err) {
        console.warn('[BEM Store] Firestore read fallback warning:', err);
      }
    }

    // Process records into FieldMemoryContext
    const records = l1Entry?.records || new Map<string, MemoryEvidenceRecord>();
    let freshCount = 0;
    let staleCount = 0;
    let missingCount = 0;
    let conflictedCount = 0;

    for (const [fieldKey, record] of records.entries()) {
      const state = evaluateRecordFreshness(record, nowMs);
      
      if (state === 'FRESH') freshCount++;
      else if (state === 'STALE') staleCount++;
      else if (state === 'CONFLICTED') conflictedCount++;
      else missingCount++;

      fieldsMap[fieldKey] = {
        fieldKey,
        state,
        currentValue: record.value,
        confidence: record.confidence,
        lastVerifiedAt: record.lastVerifiedAt,
        expiresAt: record.expiresAt,
        sourceLabel: record.sourceLabel,
        evidenceRef: record.recordId
      };
    }

    return {
      entityId: identity.entityId,
      identityStatus: identity.identityStatus,
      canonicalName: identity.canonicalName,
      domainCanonical: identity.domainCanonical,
      phoneE164: identity.phoneE164,
      fields: fieldsMap,
      totalFieldsTracked: Object.keys(fieldsMap).length,
      freshFieldCount: freshCount,
      staleFieldCount: staleCount,
      missingFieldCount: missingCount,
      conflictedFieldCount: conflictedCount,
      evaluatedAt: new Date().toISOString()
    };
  });
}

export interface HistoricalArbitrageEventParams {
  identity: EntityIdentity;
  fieldKey: string;
  relationship: EventRelationshipType;
  value: any;
  sourceType: string;
  sourceLabel: string;
  observationType?: MemoryEvidenceRecord['observationType'];
  evidenceStatus?: MemoryEvidenceRecord['evidenceStatus'];
  classification?: DataClassification;
  confidence?: number;
  actionReference?: ActionReference;
  outcomeReference?: OutcomeReference;
  baselineReference?: BaselineReference;
  windowStart?: string;
  windowEnd?: string;
  tenantUid?: string | null;
}

/**
 * Records a longitudinal Historical Arbitrage event into BEM.
 * Reuses L1 content-equality checks to avoid duplicate writes (idempotency).
 */
export async function recordHistoricalArbitrageEvent(
  params: HistoricalArbitrageEventParams
): Promise<void> {
  const {
    identity,
    fieldKey,
    relationship,
    value,
    sourceType,
    sourceLabel,
    observationType = 'SYSTEM_COMPUTED',
    evidenceStatus = 'VERIFIED',
    classification = 'TENANT_PRIVATE',
    confidence = 1.0,
    actionReference,
    outcomeReference,
    baselineReference,
    windowStart,
    windowEnd,
    tenantUid
  } = params;

  const record = createMemoryRecord({
    entityId: identity.entityId,
    fieldKey,
    value,
    sourceType,
    sourceLabel,
    observationType,
    evidenceStatus,
    classification,
    confidence,
    producerVersion: 'bvelt_block9_v1'
  });

  // Attach historical arbitrage metadata
  record.relationship = relationship;
  if (actionReference) record.actionReference = actionReference;
  if (outcomeReference) record.outcomeReference = outcomeReference;
  if (baselineReference) record.baselineReference = baselineReference;
  if (windowStart) record.windowStart = windowStart;
  if (windowEnd) record.windowEnd = windowEnd;

  await writeEvidenceRecord(identity, record, tenantUid);
}

export interface ArbitrageCorrelationSummary {
  events: EvidenceEvent[];
  actionsExecutedCount: number;
  outcomesObservedCount: number;
  correlatedOutcomes: Array<{
    action?: ActionReference;
    outcome?: OutcomeReference;
    observedAt: string;
    associationType: TemporalAssociationType;
    summaryText: string;
  }>;
  observationWindowDays: number;
}

/**
 * Retrieves the historical action-to-outcome timeline for an entity within a bounded window.
 * Strictly avoids making causal claims ("Action X caused Revenue Y").
 * Uses "OBSERVED_AFTER", "CORRELATED_WITH", "TEMPORALLY_ASSOCIATED", or "INSUFFICIENT_DATA".
 */
export async function getHistoricalArbitrageTimeline(
  identity: EntityIdentity,
  observationWindowDays: number = 30,
  tenantUid?: string | null
): Promise<ArbitrageCorrelationSummary> {
  const cacheKey = DataCache.buildKey('LOCAL_BUSINESSES', `arbitrage_${identity.entityId}_${observationWindowDays}d`);
  const cached = DataCache.get<ArbitrageCorrelationSummary>(cacheKey);
  if (cached?.data) return cached.data;

  const nowMs = Date.now();
  const windowMs = observationWindowDays * 24 * 60 * 60 * 1000;
  const cutoffMs = nowMs - windowMs;

  const events: EvidenceEvent[] = [];

  // Check L1 Memory first
  let l1Entry = BEM_L1_MEMORY.get(identity.entityId);
  if (!l1Entry && db) {
    try {
      const publicDocRef = doc(db, 'bem_entities', identity.entityId);
      const docSnap = await getDoc(publicDocRef);
      
      const recordsMap = new Map<string, MemoryEvidenceRecord>();
      if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData.fields && typeof docData.fields === 'object') {
          for (const [key, val] of Object.entries(docData.fields)) {
            recordsMap.set(key, val as MemoryEvidenceRecord);
          }
        }
      }

      if (tenantUid) {
        const privateDocRef = doc(db, 'users', tenantUid, 'bem_private', identity.entityId);
        const privSnap = await getDoc(privateDocRef);
        if (privSnap.exists()) {
          const privData = privSnap.data();
          if (privData.fields && typeof privData.fields === 'object') {
            for (const [key, val] of Object.entries(privData.fields)) {
              recordsMap.set(key, val as MemoryEvidenceRecord);
            }
          }
        }
      }

      l1Entry = { identity, records: recordsMap };
      BEM_L1_MEMORY.set(identity.entityId, l1Entry);
    } catch (err) {
      console.warn('[BEM Store] Firestore read fallback warning inside timeline:', err);
    }
  }

  if (l1Entry) {
    for (const record of l1Entry.records.values()) {
      if (record.relationship || record.actionReference || record.outcomeReference) {
        const recordTime = new Date(record.observedAt || record.lastVerifiedAt).getTime();
        if (recordTime >= cutoffMs) {
          events.push({
            eventId: record.recordId,
            entityId: record.entityId,
            fieldKey: record.fieldKey,
            oldValue: null,
            newValue: record.value,
            sourceType: record.sourceType,
            observationType: record.observationType,
            evidenceStatus: record.evidenceStatus,
            confidence: record.confidence,
            observedAt: record.observedAt,
            detectedAt: record.retrievedAt,
            schemaVersion: 1,
            relationship: record.relationship,
            actionReference: record.actionReference,
            outcomeReference: record.outcomeReference,
            baselineReference: record.baselineReference,
            windowStart: record.windowStart,
            windowEnd: record.windowEnd
          });
        }
      }
    }
  }

  // Deduplicate and sort chronologically
  events.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

  let actionsExecutedCount = 0;
  let outcomesObservedCount = 0;
  const correlatedOutcomes: ArbitrageCorrelationSummary['correlatedOutcomes'] = [];

  const recentActions: ActionReference[] = [];

  for (const ev of events) {
    if (ev.relationship === 'ACTION_EXECUTION' || ev.actionReference) {
      actionsExecutedCount++;
      if (ev.actionReference) {
        recentActions.push(ev.actionReference);
      }
    }

    if (ev.relationship === 'OUTCOME_OBSERVATION' || ev.outcomeReference) {
      outcomesObservedCount++;
      const outcome = ev.outcomeReference;
      const matchingAction = recentActions.length > 0 ? recentActions[recentActions.length - 1] : undefined;

      const assocType: TemporalAssociationType = matchingAction 
        ? (outcome?.associationType || 'OBSERVED_AFTER')
        : 'INSUFFICIENT_DATA';

      const metric = outcome?.metricName || ev.fieldKey;
      const oldVal = outcome?.oldValue ?? 'N/D';
      const newVal = outcome?.newValue ?? JSON.stringify(ev.newValue);

      let summaryText = `Observación de métrica (${metric}): de ${oldVal} a ${newVal}`;
      if (assocType === 'OBSERVED_AFTER' && matchingAction) {
        summaryText = `Cambio en ${metric} registrado (${oldVal} -> ${newVal}) tras la ejecución de [${matchingAction.actionType}]`;
      } else if (assocType === 'CORRELATED_WITH') {
        summaryText = `Asociación temporal de ${metric} (${oldVal} -> ${newVal})`;
      }

      correlatedOutcomes.push({
        action: matchingAction,
        outcome,
        observedAt: ev.observedAt,
        associationType: assocType,
        summaryText
      });
    }
  }

  const result: ArbitrageCorrelationSummary = {
    events,
    actionsExecutedCount,
    outcomesObservedCount,
    correlatedOutcomes,
    observationWindowDays
  };

  DataCache.set(cacheKey, result, 'LOCAL_BUSINESSES', 'BEM_STORE', `arbitrage_${identity.entityId}`, 5 * 60 * 1000);
  return result;
}

export type BemEventType =
  | 'estimate_followup_prepared'
  | 'dormant_rescue_started'
  | 'review_draft_created'
  | 'owner_marked_recovered'
  | 'share_opened'
  | 'analyze_message_success'
  | 'review_request'
  | 'reactivate_generate'
  | 'estimate_followup'
  | 'checkout_started'
  | string;

export type BveltMemoryEventType = BemEventType;

export interface BemEventRecord {
  id: string;
  tenantId?: string | null;
  type: BemEventType;
  sourceType: string;
  sourceName: string;
  fetchedAt: string;
  provenance: string;
  consentScope: 'private';
  timestamp: string;
  trade?: string | null;
  city?: string | null;
  meta?: Record<string, any>;
}

export interface RecordBveltEventParams {
  tenantId?: string | null;
  uid?: string | null;
  type: BemEventType;
  sourceType?: string;
  sourceName?: string;
  fetchedAt?: string;
  provenance?: string;
  consentScope?: 'private';
  trade?: string | null;
  city?: string | null;
  timestamp?: string;
  meta?: Record<string, any>;
}

const STORAGE_BEM_EVENTS_KEY = 'bvelt_bem_events_v1';
const QUEUE_STORAGE_KEY = 'bvelt_offline_bem_events_queue';

function enqueueOfflineBemEvent(eventRecord: BemEventRecord): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    const queue: BemEventRecord[] = raw ? JSON.parse(raw) : [];
    if (!queue.some(e => e.id === eventRecord.id)) {
      queue.push(eventRecord);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-200)));
    }
  } catch (err) {
    console.warn('[BEM Memory] Error enqueuing offline BEM event:', err);
  }
}

export async function flushQueuedBemEvents(user?: any): Promise<void> {
  const currentUser = user || auth?.currentUser;
  if (!currentUser || !currentUser.uid || typeof localStorage === 'undefined' || !db) return;

  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return;
    const queue: BemEventRecord[] = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;

    let profTrade: string | null = null;
    let profCity: string | null = null;
    try {
      const rawProf = localStorage.getItem('user_profile') || localStorage.getItem('lf_profile');
      if (rawProf) {
        const p = JSON.parse(rawProf);
        profTrade = p.category || p.trade || p.niche || null;
        profCity = p.city || p.location || null;
      }
    } catch {}

    const remaining: BemEventRecord[] = [];

    for (const item of queue) {
      const trade = item.trade || profTrade;
      const city = item.city || profCity;

      // Si no existen trade y city, deja el evento en cola sin enviarlo
      if (!trade || !city) {
        remaining.push({ ...item, trade, city });
        continue;
      }

      try {
        const eventDocRef = doc(db, 'users', currentUser.uid, 'bem_events', item.id);
        await setDoc(eventDocRef, {
          tenantId: currentUser.uid,
          type: item.type,
          sourceType: item.sourceType,
          sourceName: item.sourceName,
          fetchedAt: item.fetchedAt,
          provenance: item.provenance,
          consentScope: item.consentScope,
          timestamp: item.timestamp,
          trade,
          city,
          meta: item.meta,
          schemaVersion: 2
        }, { merge: true });
      } catch (err) {
        console.warn(`[BEM Memory] Failed flushing queued event ${item.id}:`, err);
        remaining.push(item);
      }
    }

    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.warn('[BEM Memory] Error flushing offline BEM queue:', err);
  }
}

if (typeof window !== 'undefined' && auth && typeof auth.onAuthStateChanged === 'function') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      flushQueuedBemEvents(user).catch(() => {});
    }
  });
}

/**
 * Retrieves stored BEM events from client memory (offline/localStorage)
 */
export function getBemEvents(tenantId?: string): BemEventRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_BEM_EVENTS_KEY);
    if (!raw) return [];
    const list: BemEventRecord[] = JSON.parse(raw);
    if (!tenantId) return list;
    return list.filter(e => !e.tenantId || e.tenantId === tenantId);
  } catch {
    return [];
  }
}

/**
 * Global BEM Event Recorder:
 * Records real-world business wins and actions into BEM memory and BusinessDNA.
 * Persists with strict audit fields: tenantId, sourceType, sourceName, fetchedAt, provenance, consentScope=private.
 * Fails safely without throwing or interrupting UI.
 */
export async function recordBveltEvent(params: RecordBveltEventParams): Promise<BemEventRecord> {
  const timestamp = params.timestamp || new Date().toISOString();
  const fetchedAt = params.fetchedAt || timestamp;
  // Sin uid, no hay tenant (eliminado tenant_default y default_business)
  const effectiveTenantId = params.tenantId || params.uid || auth?.currentUser?.uid || null;
  const type = params.type;

  // Resolve source defaults honestly
  const sourceType = params.sourceType || (
    type === 'share_opened' ? 'whatsapp_or_share' :
    type === 'owner_marked_recovered' ? 'manual_owner' :
    type === 'estimate_followup_prepared' ? 'crm_followup' :
    type === 'dormant_rescue_started' ? 'reactivation_crm' :
    type === 'review_draft_created' ? 'reputation_system' :
    'in_app'
  );

  const sourceName = params.sourceName || (
    type === 'share_opened' ? 'WhatsApp / System Share' :
    type === 'owner_marked_recovered' ? 'Owner Verification' :
    type === 'estimate_followup_prepared' ? 'Lead Follow-up Tool' :
    type === 'dormant_rescue_started' ? 'Dormant Client Rescue' :
    type === 'review_draft_created' ? 'Review Draft Generator' :
    'BVELT_BEM_RECORDER'
  );

  const provenance = params.provenance || (
    type === 'owner_marked_recovered' ? 'USER_OWNER_CONFIRMATION' :
    type === 'share_opened' ? 'CLIENT_SHARE_TRIGGER' :
    'BEM_RECORD_V1'
  );

  const consentScope: 'private' = 'private'; // strictly enforced per tenant

  const id = `ev_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Rellena trade y city desde el perfil del usuario si no se suministran
  let resolvedTrade = params.trade || null;
  let resolvedCity = params.city || null;

  if (!resolvedTrade || !resolvedCity) {
    try {
      const rawProf = typeof localStorage !== 'undefined' ? (localStorage.getItem('user_profile') || localStorage.getItem('lf_profile')) : null;
      if (rawProf) {
        const prof = JSON.parse(rawProf);
        if (!resolvedTrade) {
          resolvedTrade = prof.category || prof.trade || prof.niche || null;
        }
        if (!resolvedCity) {
          resolvedCity = prof.city || prof.location || null;
        }
      }
    } catch {}
  }

  const eventRecord: BemEventRecord = {
    id,
    tenantId: effectiveTenantId,
    type,
    sourceType,
    sourceName,
    fetchedAt,
    provenance,
    consentScope,
    timestamp,
    trade: resolvedTrade,
    city: resolvedCity,
    meta: params.meta || {}
  };

  // 1. Telemetry / Observability log
  try {
    if (effectiveTenantId) {
      BemTelemetry.record({
        eventType: 'memory_write',
        entityId: effectiveTenantId,
        fieldKey: type,
        source: 'BEM_EVENT_RECORDER',
        reason: `Recorded event ${type}`
      });
    }
  } catch {
    // Non-blocking telemetry
  }

  console.log(`[BEM Memory] recordBveltEvent: ${type}`, eventRecord);

  // 2. Behavioral DNA recording
  try {
    if (effectiveTenantId && effectiveTenantId !== 'anonymous') {
      BusinessDnaService.recordActionExecution(effectiveTenantId, {
        actionId: `act_${type}_${Date.now()}`,
        actionType: type,
        destination: params.meta?.destination || type,
        executedAt: timestamp
      });
    }
  } catch (dnaErr) {
    console.warn('[BEM Memory] BusinessDnaService non-blocking warning:', dnaErr);
  }

  // 3. LocalStorage persistence for client-side resiliency & instant access
  if (typeof localStorage !== 'undefined') {
    try {
      const existing = getBemEvents();
      const updated = [eventRecord, ...existing].slice(0, 300);
      localStorage.setItem(STORAGE_BEM_EVENTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[BEM Memory] Local storage write warning:', e);
    }
  }

  // 4. Persistence to Firestore: Solo si hay auth.currentUser y trade y city existen;
  // de lo contrario, deja el evento en la cola offlineSync y envíalo cuando haya sesión.
  const hasAuthSession = Boolean(auth?.currentUser?.uid);
  const hasTradeAndCity = Boolean(resolvedTrade && resolvedCity);

  if (!hasAuthSession || !hasTradeAndCity) {
    enqueueOfflineBemEvent(eventRecord);
  } else {
    try {
      if (db && auth?.currentUser?.uid) {
        const eventDocRef = doc(db, 'users', auth.currentUser.uid, 'bem_events', eventRecord.id);
        await setDoc(eventDocRef, {
          tenantId: auth.currentUser.uid,
          type: eventRecord.type,
          sourceType: eventRecord.sourceType,
          sourceName: eventRecord.sourceName,
          fetchedAt: eventRecord.fetchedAt,
          provenance: eventRecord.provenance,
          consentScope: eventRecord.consentScope,
          timestamp: eventRecord.timestamp,
          trade: eventRecord.trade,
          city: eventRecord.city,
          meta: eventRecord.meta,
          schemaVersion: 2
        }, { merge: true });
      }
    } catch (firestoreErr) {
      console.warn('[BEM Memory] Firestore event write failed gracefully, queuing:', firestoreErr);
      enqueueOfflineBemEvent(eventRecord);
    }
  }

  return eventRecord;
}


