/**
 * BVELT MEMORY v1 (BEM) — BLOCK 10.1: EVIDENCE INTEGRITY FOUNDATION
 * 
 * Provides:
 * 1. Deterministic canonical serialization of EvidenceEvent (excluding volatile system timestamps)
 * 2. SHA-256 hashing via Web Crypto API (Node, Cloudflare Workers, and Browser compatible)
 * 3. Individual event hash computation (eventHash)
 * 4. Deterministic batch digest computation (deterministicBatchDigest)
 */

import { EvidenceEvent } from '../bemTypes';

export interface CanonicalEvidencePayload {
  eventId: string;
  entityId: string;
  fieldKey: string;
  oldValue: any;
  newValue: any;
  sourceType: string;
  observationType: string;
  evidenceStatus: string;
  confidence: number;
  observedAt: string;
  producerVersion?: string;
  schemaVersion: number;
  relationship?: string;
  actionReference?: any;
  outcomeReference?: any;
  baselineReference?: any;
  windowStart?: string;
  windowEnd?: string;
}

/**
 * Produces a deterministic canonical object representation of an EvidenceEvent,
 * excluding volatile system processing timestamps (detectedAt, lastVerifiedAt, evaluatedAt)
 * and ensuring stable ordering of keys.
 */
export function getCanonicalEvidencePayload(event: EvidenceEvent): CanonicalEvidencePayload {
  return {
    eventId: event.eventId,
    entityId: event.entityId,
    fieldKey: event.fieldKey,
    oldValue: event.oldValue !== undefined ? event.oldValue : null,
    newValue: event.newValue !== undefined ? event.newValue : null,
    sourceType: event.sourceType,
    observationType: event.observationType,
    evidenceStatus: event.evidenceStatus,
    confidence: typeof event.confidence === 'number' ? event.confidence : 1.0,
    observedAt: event.observedAt,
    producerVersion: event.producerVersion,
    schemaVersion: typeof event.schemaVersion === 'number' ? event.schemaVersion : 1,
    relationship: event.relationship,
    actionReference: event.actionReference || undefined,
    outcomeReference: event.outcomeReference || undefined,
    baselineReference: event.baselineReference || undefined,
    windowStart: event.windowStart,
    windowEnd: event.windowEnd
  };
}

/**
 * Serializes an EvidenceEvent into a deterministic JSON string with sorted keys.
 */
export function canonicalizeEvidenceEvent(event: EvidenceEvent): string {
  const payload = getCanonicalEvidencePayload(event);
  
  // Deterministic key sorting function for JSON stringification
  function sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys);
    }
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      if (obj[key] !== undefined) {
        result[key] = sortObjectKeys(obj[key]);
      }
    }
    return result;
  }

  const sortedPayload = sortObjectKeys(payload);
  return JSON.stringify(sortedPayload);
}

/**
 * Computes SHA-256 hash using Web Crypto API (crypto.subtle),
 * 100% compatible with Node.js, Cloudflare Workers, and modern browsers.
 */
export async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  // Use global crypto.subtle
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes a deterministic SHA-256 eventHash for an EvidenceEvent.
 */
export async function computeEventHash(event: EvidenceEvent): Promise<string> {
  const canonicalString = canonicalizeEvidenceEvent(event);
  return await sha256Hex(canonicalString);
}

export interface DeterministicBatchDigestResult {
  batchDigest: string;
  eventHashes: string[];
  eventCount: number;
  evaluatedAt: string;
}

/**
 * Computes a deterministic batch digest from an array of EvidenceEvents.
 * 
 * Construction:
 * 1. Computes canonical eventHash for each event.
 * 2. Sorts the event hashes lexicographically (alphabetically) to guarantee input order independence.
 * 3. Concatenates the sorted hashes.
 * 4. Computes SHA-256 digest of the concatenation.
 */
export async function computeDeterministicBatchDigest(events: EvidenceEvent[]): Promise<DeterministicBatchDigestResult> {
  const evaluatedAt = new Date().toISOString();
  if (!events || events.length === 0) {
    const emptyDigest = await sha256Hex('bvelt_empty_batch_' + evaluatedAt);
    return {
      batchDigest: emptyDigest,
      eventHashes: [],
      eventCount: 0,
      evaluatedAt
    };
  }

  const eventHashes: string[] = [];
  for (const event of events) {
    const hash = event.eventHash || (await computeEventHash(event));
    eventHashes.push(hash);
  }

  // Sort lexicographically to guarantee order independence
  const sortedHashes = [...eventHashes].sort();
  const concatenated = sortedHashes.join('');
  const batchDigest = await sha256Hex(concatenated);

  return {
    batchDigest,
    eventHashes: sortedHashes,
    eventCount: events.length,
    evaluatedAt
  };
}

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes the chained hash of an EvidenceEvent:
 * currentHash = SHA-256(previousHash + canonicalJson + timestamp + observationType)
 */
export async function computeChainedEventHash(event: EvidenceEvent, previousHash: string = GENESIS_HASH): Promise<string> {
  const canonicalString = canonicalizeEvidenceEvent(event);
  const timestamp = event.detectedAt || event.observedAt || '';
  const observationType = event.observationType || '';
  const chainedPayload = `${previousHash}|${canonicalString}|${timestamp}|${observationType}`;
  return await sha256Hex(chainedPayload);
}

/**
 * Chains an array of EvidenceEvents chronologically, calculating previousHash and currentHash.
 */
export async function chainEvidenceEvents(
  events: EvidenceEvent[],
  initialPreviousHash: string = GENESIS_HASH
): Promise<EvidenceEvent[]> {
  let lastHash = initialPreviousHash;
  const chained: EvidenceEvent[] = [];

  for (const ev of events) {
    const prev = lastHash;
    const curr = await computeChainedEventHash(ev, prev);
    lastHash = curr;
    chained.push({
      ...ev,
      previousHash: prev,
      currentHash: curr,
      eventHash: curr
    });
  }

  return chained;
}

export interface EvidenceChainVerificationResult {
  isValid: boolean;
  totalEvents: number;
  brokenAtIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  headHash?: string;
  details?: string;
}

/**
 * Verifies the uninterrupted cryptographic integrity of an EvidenceEvent chain.
 * Iterates from genesis to head, re-computing each currentHash and asserting
 * that events[i].previousHash === events[i-1].currentHash.
 */
export async function verifyEvidenceChain(
  events: EvidenceEvent[],
  initialPreviousHash: string = GENESIS_HASH
): Promise<EvidenceChainVerificationResult> {
  if (!events || events.length === 0) {
    return {
      isValid: true,
      totalEvents: 0,
      headHash: initialPreviousHash,
      details: 'Empty chain is trivially valid.'
    };
  }

  let runningPreviousHash = initialPreviousHash;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // 1. Verify previousHash link
    if (event.previousHash && event.previousHash !== runningPreviousHash) {
      return {
        isValid: false,
        totalEvents: events.length,
        brokenAtIndex: i,
        expectedHash: runningPreviousHash,
        actualHash: event.previousHash,
        details: `Chain broken at index ${i}: previousHash mismatch.`
      };
    }

    // 2. Compute expected currentHash
    const expectedCurrentHash = await computeChainedEventHash(event, runningPreviousHash);
    
    // If event has currentHash or eventHash, verify equality
    const recordedCurrentHash = event.currentHash || event.eventHash;
    if (recordedCurrentHash && recordedCurrentHash !== expectedCurrentHash) {
      return {
        isValid: false,
        totalEvents: events.length,
        brokenAtIndex: i,
        expectedHash: expectedCurrentHash,
        actualHash: recordedCurrentHash,
        details: `Integrity broken at index ${i}: payload or hash mismatch.`
      };
    }

    runningPreviousHash = expectedCurrentHash;
  }

  return {
    isValid: true,
    totalEvents: events.length,
    headHash: runningPreviousHash,
    details: `Chain verified: all ${events.length} cryptographic links unbroken.`
  };
}

/**
 * Abstract interface for optional external anchoring adapters (e.g. OpenTimestamps).
 * Not invoked in Block 10.1.
 */
export interface EvidenceIntegrityAnchorAdapter {
  providerName: string;
  anchor(rootHash: string): Promise<{ anchorId: string; status: 'SUBMITTED' | 'PENDING' | 'CONFIRMED' | 'FAILED' }>;
  getStatus(anchorId: string): Promise<'SUBMITTED' | 'PENDING' | 'CONFIRMED' | 'FAILED'>;
}
