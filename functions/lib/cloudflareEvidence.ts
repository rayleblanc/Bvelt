/**
 * Cloudflare Pages Functions — Machine-Readable BEM Evidence API
 * 
 * Implements edge endpoints:
 * - GET /api/business/:id/evidence
 * - GET /api/business/:id/history
 * - GET /api/business/:id/conflicts
 * - POST /api/business/evidence (secure server-side BEM write)
 * - POST /api/business/resolve-conflict (secure server-side BEM conflict resolution)
 * 
 * 100% compatible with Cloudflare Workers/Pages runtime (Edge, fetch, Web Crypto).
 * Fully adheres to the BEM Public Evidence Contract and public/private isolation.
 */

import {
  verifyFirebaseIdToken,
  commitFirestoreBatch,
  jsToFirestoreValue,
  getGoogleOAuthToken
} from "./cloudflareFirestore.js";
import { EXPERIMENT_ENTITIES } from "../../src/knowledge/memory/publicEvidenceService.js";

// Whitelist of public-safe field keys
const PUBLIC_SAFE_FIELD_KEYS = new Set([
  'canonicalName',
  'name',
  'address',
  'addressNormalized',
  'city',
  'state',
  'postalCode',
  'country',
  'phone',
  'phoneE164',
  'website',
  'domain',
  'domainCanonical',
  'primaryCategory',
  'category',
  'coordinates',
  'rating',
  'reviewCount',
  'isClaimed',
  'googlePlaceId',
  'businessHours',
  'services'
]);

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeChainedEventHash(eventObj: any, previousHash: string = GENESIS_HASH): Promise<string> {
  const payload = `${previousHash}|${eventObj.fieldKey || ''}|${JSON.stringify(eventObj.newValue !== undefined ? eventObj.newValue : null)}|${eventObj.detectedAt || ''}|${eventObj.observationType || ''}|${eventObj.sourceType || ''}`;
  return await sha256Hex(payload);
}

function validateEntityId(entityId: string): boolean {
  if (!entityId || typeof entityId !== 'string') return false;
  const trimmed = entityId.trim();
  if (trimmed.length < 5 || trimmed.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Converts a Firestore REST API field value to a plain JavaScript value.
 */
function parseFirestoreValue(fieldObj: any): any {
  if (!fieldObj || typeof fieldObj !== 'object') return null;
  if ('stringValue' in fieldObj) return fieldObj.stringValue;
  if ('integerValue' in fieldObj) return parseInt(fieldObj.integerValue, 10);
  if ('doubleValue' in fieldObj) return parseFloat(fieldObj.doubleValue);
  if ('booleanValue' in fieldObj) return fieldObj.booleanValue;
  if ('timestampValue' in fieldObj) return fieldObj.timestampValue;
  if ('nullValue' in fieldObj) return null;
  if ('geoPointValue' in fieldObj) {
    return { lat: fieldObj.geoPointValue.latitude, lng: fieldObj.geoPointValue.longitude };
  }
  if ('arrayValue' in fieldObj) {
    const values = fieldObj.arrayValue.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in fieldObj) {
    const res: Record<string, any> = {};
    const fields = fieldObj.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = parseFirestoreValue(v);
    }
    return res;
  }
  return null;
}

function parseFirestoreDocument(docData: any): Record<string, any> {
  const result: Record<string, any> = {};
  const fields = docData.fields || {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = parseFirestoreValue(v);
  }
  return result;
}

function getProjectId(env: any): string {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (credsStr) {
    try {
      const parsed = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
      if (parsed.project_id) return parsed.project_id;
    } catch {}
  }
  return 'localflowpro-20e3d';
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

async function handlePostEvidence(request: Request, env: any): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!bearerToken) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Missing or invalid Authorization token." }), {
      status: 401,
      headers: CORS_HEADERS
    });
  }

  const userId = await verifyFirebaseIdToken(env, bearerToken);
  if (!userId) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Unauthorized. Invalid Firebase ID Token." }), {
      status: 401,
      headers: CORS_HEADERS
    });
  }

  const body = await request.json().catch(() => null) as any;
  if (!body || !body.identity || !Array.isArray(body.records)) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Invalid request payload. Must provide 'identity' and 'records' array." }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  const { identity, records } = body;
  const entityId = identity.entityId;

  if (!validateEntityId(entityId)) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Invalid entity ID format." }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  const projectId = getProjectId(env);

  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}`;
    const docResp = await fetch(docUrl);
    let existingDoc: any = null;
    if (docResp.ok) {
      existingDoc = await docResp.json();
    }
    
    const parsedDoc = existingDoc ? parseFirestoreDocument(existingDoc) : null;
    const existingFields = parsedDoc?.fields || {};

    const writes: any[] = [];
    const fieldsToUpdate: Record<string, any> = {};
    const fieldPaths: string[] = ["entityId", "canonicalName", "normalizedName", "domainCanonical", "phoneE164", "lastUpdated", "schemaVersion"];

    let hasUpdates = false;

    for (const record of records) {
      if (!PUBLIC_SAFE_FIELD_KEYS.has(record.fieldKey)) {
        console.warn(`[handlePostEvidence] Rejected un-whitelisted field write: ${record.fieldKey}`);
        continue;
      }
      
      if (record.classification !== "PUBLIC_SHARED") {
        console.warn(`[handlePostEvidence] Rejected non-PUBLIC_SHARED write classification: ${record.classification}`);
        continue;
      }

      const existingRecord = existingFields[record.fieldKey];
      if (existingRecord && existingRecord.value === record.value && existingRecord.sourceType === record.sourceType) {
        continue;
      }

      hasUpdates = true;
      fieldsToUpdate[record.fieldKey] = record;
      fieldPaths.push(`fields.${record.fieldKey}`);

      const historyEventId = `evhist_${entityId}_${record.fieldKey}_${Date.now()}`;
      const historyName = `projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}/history/${historyEventId}`;
      
      const prevHash = (existingRecord && existingRecord.currentHash) ? existingRecord.currentHash : GENESIS_HASH;
      const detectedIso = new Date().toISOString();

      const rawHist = {
        fieldKey: record.fieldKey,
        newValue: record.value,
        detectedAt: detectedIso,
        observationType: record.observationType,
        sourceType: record.sourceType
      };
      const currHash = await computeChainedEventHash(rawHist, prevHash);

      const historyEvent = {
        eventId: historyEventId,
        entityId: entityId,
        fieldKey: record.fieldKey,
        oldValue: existingRecord ? existingRecord.value : null,
        newValue: record.value,
        sourceType: record.sourceType,
        observationType: record.observationType,
        evidenceStatus: record.evidenceStatus,
        confidence: record.confidence ?? 0.95,
        observedAt: record.observedAt || detectedIso,
        detectedAt: detectedIso,
        producerVersion: record.producerVersion || "8.0.0",
        schemaVersion: 1,
        previousHash: prevHash,
        currentHash: currHash,
        eventHash: currHash,
        ...(record.relationship ? { relationship: record.relationship } : {}),
        ...(record.actionReference ? { actionReference: record.actionReference } : {}),
        ...(record.outcomeReference ? { outcomeReference: record.outcomeReference } : {}),
        ...(record.baselineReference ? { baselineReference: record.baselineReference } : {}),
        ...(record.windowStart ? { windowStart: record.windowStart } : {}),
        ...(record.windowEnd ? { windowEnd: record.windowEnd } : {})
      };

      // Also attach hash to the field record for instant linking
      record.currentHash = currHash;

      writes.push({
        update: {
          name: historyName,
          fields: jsToFirestoreValue(historyEvent).mapValue.fields
        }
      });

      const systemMetricName = `projects/${projectId}/databases/(default)/documents/bem_system/metrics_source_${record.sourceType}`;
      writes.push({
        transform: {
          document: systemMetricName,
          fieldTransforms: [
            {
              fieldPath: "totalObservations",
              increment: { integerValue: "1" }
            },
            {
              fieldPath: "lastCalculatedAt",
              setToServerValue: "REQUEST_TIME"
            }
          ]
        }
      });

      if (existingRecord && existingRecord.sourceType !== record.sourceType && 
          existingRecord.evidenceStatus === 'VERIFIED' && record.evidenceStatus === 'VERIFIED') {
        
        const sources = [existingRecord.sourceType, record.sourceType].sort();
        const conflictId = `conf_${entityId}_${record.fieldKey}_${sources[0]}_vs_${sources[1]}`;
        const conflictName = `projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}/conflicts/${conflictId}`;
        
        const conflictRecord = {
          conflictId,
          entityId,
          fieldKey: record.fieldKey,
          sourceA: existingRecord.sourceType,
          valueA: existingRecord.value,
          sourceB: record.sourceType,
          valueB: record.value,
          firstDetectedAt: new Date().toISOString(),
          lastDetectedAt: new Date().toISOString(),
          status: "OPEN"
        };

        writes.push({
          update: {
            name: conflictName,
            fields: jsToFirestoreValue(conflictRecord).mapValue.fields
          },
          updateMask: {
            fieldPaths: ["conflictId", "entityId", "fieldKey", "sourceA", "valueA", "sourceB", "valueB", "firstDetectedAt", "lastDetectedAt", "status"]
          }
        });

        for (const src of sources) {
          const conflictMetricName = `projects/${projectId}/databases/(default)/documents/bem_system/metrics_source_${src}`;
          writes.push({
            transform: {
              document: conflictMetricName,
              fieldTransforms: [
                {
                  fieldPath: "totalConflicts",
                  increment: { integerValue: "1" }
                },
                {
                  fieldPath: "unresolvedConflicts",
                  increment: { integerValue: "1" }
                },
                {
                  fieldPath: "lastCalculatedAt",
                  setToServerValue: "REQUEST_TIME"
                }
              ]
            }
          });
        }
      }
    }

    if (!hasUpdates) {
      return new Response(JSON.stringify({ status: "SUCCESS", message: "No updates detected; content is unchanged.", writtenCount: 0 }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const entityUpdateBody = {
      entityId: entityId,
      canonicalName: identity.canonicalName,
      normalizedName: identity.normalizedName,
      domainCanonical: identity.domainCanonical || null,
      phoneE164: identity.phoneE164 || null,
      lastUpdated: new Date().toISOString(),
      schemaVersion: 1,
      fields: fieldsToUpdate
    };

    const mainEntityDocName = `projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}`;
    
    writes.unshift({
      update: {
        name: mainEntityDocName,
        fields: jsToFirestoreValue(entityUpdateBody).mapValue.fields
      },
      updateMask: {
        fieldPaths: fieldPaths
      }
    });

    const commitSuccess = await commitFirestoreBatch(env, writes);
    if (!commitSuccess) {
      return new Response(JSON.stringify({ status: "ERROR", error: "Failed to commit evidence transaction to Firestore." }), {
        status: 502,
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({ 
      status: "SUCCESS", 
      message: "Successfully persisted BEM evidence.", 
      writtenCount: Object.keys(fieldsToUpdate).length 
    }), {
      status: 200,
      headers: CORS_HEADERS
    });

  } catch (err: any) {
    console.error("[handlePostEvidence] Error processing evidence update:", err);
    return new Response(JSON.stringify({ status: "ERROR", error: err.message || String(err) }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

async function handlePostResolveConflict(request: Request, env: any): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!bearerToken) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Missing or invalid Authorization token." }), {
      status: 401,
      headers: CORS_HEADERS
    });
  }

  const userId = await verifyFirebaseIdToken(env, bearerToken);
  if (!userId) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Unauthorized. Invalid Firebase ID Token." }), {
      status: 401,
      headers: CORS_HEADERS
    });
  }

  const body = await request.json().catch(() => null) as any;
  if (!body || !body.entityId || !body.conflictId || !body.winningSource) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Invalid payload. Must provide entityId, conflictId, and winningSource." }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  const { entityId, conflictId, winningSource, resolutionReason = "MANUAL_RESOLUTION" } = body;

  if (!validateEntityId(entityId)) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Invalid entity ID format." }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  const projectId = getProjectId(env);

  try {
    const conflictDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}/conflicts/${conflictId}`;
    const getResp = await fetch(conflictDocUrl);
    if (!getResp.ok) {
      if (getResp.status === 404) {
        return new Response(JSON.stringify({ status: "ERROR", error: "Conflict document not found." }), {
          status: 404,
          headers: CORS_HEADERS
        });
      }
      return new Response(JSON.stringify({ status: "ERROR", error: "Failed to inspect conflict document." }), {
        status: 502,
        headers: CORS_HEADERS
      });
    }

    const rawConflict = await getResp.json();
    const conflictData = parseFirestoreDocument(rawConflict);

    if (conflictData.status === "RESOLVED") {
      return new Response(JSON.stringify({ status: "SUCCESS", message: "Conflict already resolved.", alreadyResolved: true }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    const losingSource = conflictData.sourceA === winningSource ? conflictData.sourceB : conflictData.sourceA;

    const writes: any[] = [];
    const nowIso = new Date().toISOString();

    const updatedConflict = {
      status: "RESOLVED",
      resolutionSource: winningSource,
      resolutionAt: nowIso,
      resolutionReason
    };

    writes.push({
      update: {
        name: conflictDocUrl,
        fields: jsToFirestoreValue(updatedConflict).mapValue.fields
      },
      updateMask: {
        fieldPaths: ["status", "resolutionSource", "resolutionAt", "resolutionReason"]
      }
    });

    const winnerMetricName = `projects/${projectId}/databases/(default)/documents/bem_system/metrics_source_${winningSource}`;
    writes.push({
      transform: {
        document: winnerMetricName,
        fieldTransforms: [
          {
            fieldPath: "unresolvedConflicts",
            increment: { integerValue: "-1" }
          },
          {
            fieldPath: "resolutionsWon",
            increment: { integerValue: "1" }
          },
          {
            fieldPath: "lastCalculatedAt",
            setToServerValue: "REQUEST_TIME"
          }
        ]
      }
    });

    if (losingSource && losingSource !== winningSource) {
      const loserMetricName = `projects/${projectId}/databases/(default)/documents/bem_system/metrics_source_${losingSource}`;
      writes.push({
        transform: {
          document: loserMetricName,
          fieldTransforms: [
            {
              fieldPath: "unresolvedConflicts",
              increment: { integerValue: "-1" }
            },
            {
              fieldPath: "resolutionsLost",
              increment: { integerValue: "1" }
            },
            {
              fieldPath: "lastCalculatedAt",
              setToServerValue: "REQUEST_TIME"
            }
          ]
        }
      });
    }

    const commitSuccess = await commitFirestoreBatch(env, writes);
    if (!commitSuccess) {
      return new Response(JSON.stringify({ status: "ERROR", error: "Failed to commit resolution transaction to Firestore." }), {
        status: 502,
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({ status: "SUCCESS", message: "Conflict resolved successfully." }), {
      status: 200,
      headers: CORS_HEADERS
    });

  } catch (err: any) {
    console.error("[handlePostResolveConflict] Error resolving conflict:", err);
    return new Response(JSON.stringify({ status: "ERROR", error: err.message || String(err) }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

export async function handleEvidenceApi(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'api' || parts[1] !== 'business') {
    return new Response(JSON.stringify({ status: "ERROR", error: "Invalid API route structure" }), {
      status: 404,
      headers: CORS_HEADERS
    });
  }

  if (request.method === "POST") {
    if (parts[2] === "evidence") {
      return handlePostEvidence(request, env);
    }
    if (parts[2] === "resolve-conflict") {
      return handlePostResolveConflict(request, env);
    }
    return new Response(JSON.stringify({ status: "ERROR", error: "POST endpoint not found" }), {
      status: 404,
      headers: CORS_HEADERS
    });
  }

  const entityId = parts[2];
  const endpoint = parts[3] || 'evidence';

  if (!validateEntityId(entityId)) {
    return new Response(JSON.stringify({ status: "ERROR", error: "Invalid entity ID format." }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  // Fast-path: experiment & certified verification test entities
  if (EXPERIMENT_ENTITIES[entityId]) {
    const experimentData = EXPERIMENT_ENTITIES[entityId];

    if (endpoint === 'evidence') {
      return new Response(JSON.stringify({
        status: "SUCCESS",
        data: experimentData
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    if (endpoint === 'history') {
      const events = experimentData.recentHistory || [];
      return new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          entityId,
          totalEvents: events.length,
          events
        }
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    if (endpoint === 'conflicts') {
      const conflicts = experimentData.activeConflicts || [];
      return new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          entityId,
          totalConflicts: conflicts.length,
          conflicts
        }
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    if (endpoint === 'verify-chain') {
      const events = [...(experimentData.recentHistory || [])];
      events.sort((a, b) => new Date(a.detectedAt || a.observedAt || 0).getTime() - new Date(b.detectedAt || b.observedAt || 0).getTime());

      let runningPreviousHash = GENESIS_HASH;
      let chainValid = true;
      let brokenIndex: number | null = null;
      let failureReason: string | null = null;

      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.previousHash && ev.previousHash !== runningPreviousHash) {
          chainValid = false;
          brokenIndex = i;
          failureReason = `Previous hash mismatch at index ${i}. Expected: ${runningPreviousHash}, Found: ${ev.previousHash}`;
          break;
        }

        const rawHist = {
          fieldKey: ev.fieldKey,
          newValue: ev.newValue,
          detectedAt: ev.detectedAt,
          observationType: ev.observationType,
          sourceType: ev.sourceType
        };
        const expectedHash = await computeChainedEventHash(rawHist, runningPreviousHash);
        
        if (ev.currentHash && ev.currentHash !== expectedHash) {
          chainValid = false;
          brokenIndex = i;
          failureReason = `Current hash payload mismatch at index ${i}. Expected: ${expectedHash}, Found: ${ev.currentHash}`;
          break;
        }

        runningPreviousHash = ev.currentHash || expectedHash;
      }

      return new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          entityId,
          totalEvents: events.length,
          isValid: chainValid,
          headHash: runningPreviousHash,
          brokenIndex,
          failureReason: failureReason || (chainValid ? "Chain integrity verified: all cryptographic links intact." : "Unknown verification failure.")
        }
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }
  }

  const projectId = getProjectId(env);
  let token = "";
  const saStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (saStr) {
    try {
      const sa = typeof saStr === "string" ? JSON.parse(saStr) : saStr;
      token = await getGoogleOAuthToken(sa);
    } catch (e) {
      console.warn("[Cloudflare Evidence API] Failed to obtain oauth token:", e);
    }
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    if (endpoint === 'evidence') {
      const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}`;
      const docResp = await fetch(docUrl, { headers });

      if (!docResp.ok) {
        if (docResp.status === 404) {
          return new Response(JSON.stringify({ 
            status: "NOT_FOUND", 
            message: `No verified evidence record found for entity ID: ${entityId}` 
          }), {
            status: 404,
            headers: CORS_HEADERS
          });
        }
        return new Response(JSON.stringify({ status: "ERROR", error: "Failed to read evidence record from data store." }), {
          status: 502,
          headers: CORS_HEADERS
        });
      }

      const rawDoc = await docResp.json();
      const parsed = parseFirestoreDocument(rawDoc);

      const fieldsMap: Record<string, any> = {};
      const distinctSources = new Set<string>();
      let verifiedCount = 0;

      if (parsed.fields && typeof parsed.fields === 'object') {
        for (const [key, rawRec] of Object.entries(parsed.fields as Record<string, any>)) {
          if (!PUBLIC_SAFE_FIELD_KEYS.has(key)) continue;
          if (rawRec && rawRec.classification && rawRec.classification !== 'PUBLIC_SHARED') continue;
          if (rawRec && rawRec.value !== undefined && rawRec.value !== null) {
            fieldsMap[key] = {
              fieldKey: key,
              value: rawRec.value,
              observationType: rawRec.observationType || 'FACT',
              evidenceStatus: rawRec.evidenceStatus || 'VERIFIED',
              classification: 'PUBLIC_SHARED',
              confidence: rawRec.confidence ?? 0.95,
              confidenceLevel: rawRec.confidenceLevel || 'High',
              sourceLabel: rawRec.sourceLabel || 'Bvelt Public Index',
              sourceType: rawRec.sourceType || 'PUBLIC_RECORD',
              observedAt: rawRec.observedAt || new Date().toISOString(),
              lastVerifiedAt: rawRec.lastVerifiedAt || new Date().toISOString()
            };
            if (rawRec.sourceLabel) distinctSources.add(rawRec.sourceLabel);
            if (rawRec.evidenceStatus === 'VERIFIED') verifiedCount++;
          }
        }
      }

      const entityData = {
        entityId,
        canonicalName: parsed.canonicalName || fieldsMap.canonicalName?.value || 'Verified Local Business',
        primaryCategory: parsed.primaryCategory || fieldsMap.primaryCategory?.value || null,
        addressNormalized: parsed.addressNormalized || fieldsMap.address?.value || null,
        cityNormalized: parsed.cityNormalized || fieldsMap.city?.value || null,
        stateCode: parsed.stateCode || fieldsMap.state?.value || null,
        countryCode: parsed.countryCode || 'US',
        postalCode: parsed.postalCode || fieldsMap.postalCode?.value || null,
        coordinates: parsed.coordinates || fieldsMap.coordinates?.value || null,
        phoneE164: parsed.phoneE164 || fieldsMap.phone?.value || null,
        domainCanonical: parsed.domainCanonical || fieldsMap.website?.value || null,
        identityStatus: parsed.identityStatus || 'RESOLVED',
        identityConfidence: parsed.identityConfidence ?? 0.95,
        lastVerifiedAt: parsed.lastUpdated || new Date().toISOString()
      };

      const responsePayload = {
        status: "SUCCESS",
        data: {
          entity: entityData,
          fields: fieldsMap,
          provenanceSummary: {
            totalPublicFields: Object.keys(fieldsMap).length,
            verifiedFieldsCount: verifiedCount,
            distinctSourceLabels: Array.from(distinctSources),
            hasConflicts: false,
            activeConflictCount: 0
          },
          generatedAt: new Date().toISOString()
        }
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    if (endpoint === 'history') {
      const historyUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}/history?pageSize=20`;
      const historyResp = await fetch(historyUrl, { headers });

      let events: any[] = [];
      if (historyResp.ok) {
        const histData = (await historyResp.json()) as any;
        if (histData.documents && Array.isArray(histData.documents)) {
          events = histData.documents.map((d: any) => {
            const parsed = parseFirestoreDocument(d);
            return {
              eventId: parsed.eventId || d.name?.split('/').pop(),
              entityId,
              fieldKey: parsed.fieldKey,
              oldValue: parsed.oldValue,
              newValue: parsed.newValue,
              sourceType: parsed.sourceType,
              observationType: parsed.observationType,
              evidenceStatus: parsed.evidenceStatus,
              confidence: parsed.confidence,
              observedAt: parsed.observedAt,
              detectedAt: parsed.detectedAt
            };
          });
        }
      }

      return new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          entityId,
          totalEvents: events.length,
          events
        }
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    if (endpoint === 'verify-chain') {
      const historyUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}/history?pageSize=100`;
      const historyResp = await fetch(historyUrl, { headers });

      let events: any[] = [];
      if (historyResp.ok) {
        const histData = (await historyResp.json()) as any;
        if (histData.documents && Array.isArray(histData.documents)) {
          events = histData.documents.map((d: any) => parseFirestoreDocument(d));
        }
      }

      // Sort events chronologically by detectedAt / observedAt
      events.sort((a, b) => new Date(a.detectedAt || a.observedAt || 0).getTime() - new Date(b.detectedAt || b.observedAt || 0).getTime());

      let runningPreviousHash = GENESIS_HASH;
      let chainValid = true;
      let brokenIndex: number | null = null;
      let failureReason: string | null = null;

      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.previousHash && ev.previousHash !== runningPreviousHash) {
          chainValid = false;
          brokenIndex = i;
          failureReason = `Previous hash mismatch at index ${i}. Expected: ${runningPreviousHash}, Found: ${ev.previousHash}`;
          break;
        }

        const rawHist = {
          fieldKey: ev.fieldKey,
          newValue: ev.newValue,
          detectedAt: ev.detectedAt,
          observationType: ev.observationType,
          sourceType: ev.sourceType
        };
        const expectedHash = await computeChainedEventHash(rawHist, runningPreviousHash);
        
        if (ev.currentHash && ev.currentHash !== expectedHash) {
          chainValid = false;
          brokenIndex = i;
          failureReason = `Current hash payload mismatch at index ${i}. Expected: ${expectedHash}, Found: ${ev.currentHash}`;
          break;
        }

        runningPreviousHash = ev.currentHash || expectedHash;
      }

      return new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          entityId,
          totalEvents: events.length,
          isValid: chainValid,
          headHash: runningPreviousHash,
          brokenIndex,
          failureReason: failureReason || (chainValid ? "Chain integrity verified: all cryptographic links intact." : "Unknown verification failure.")
        }
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    if (endpoint === 'conflicts') {
      const conflictsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bem_entities/${entityId}/conflicts?pageSize=20`;
      const conflictsResp = await fetch(conflictsUrl, { headers });

      let conflicts: any[] = [];
      if (conflictsResp.ok) {
        const confData = (await conflictsResp.json()) as any;
        if (confData.documents && Array.isArray(confData.documents)) {
          conflicts = confData.documents.map((d: any) => {
            const parsed = parseFirestoreDocument(d);
            return {
              conflictId: parsed.conflictId || d.name?.split('/').pop(),
              entityId,
              fieldKey: parsed.fieldKey,
              sourceA: parsed.sourceA,
              valueA: parsed.valueA,
              sourceB: parsed.sourceB,
              valueB: parsed.valueB,
              firstDetectedAt: parsed.firstDetectedAt,
              lastDetectedAt: parsed.lastDetectedAt,
              status: parsed.status || 'OPEN',
              resolutionSource: parsed.resolutionSource || null,
              resolutionAt: parsed.resolutionAt || null,
              resolutionReason: parsed.resolutionReason || null
            };
          });
        }
      }

      return new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          entityId,
          totalConflicts: conflicts.length,
          conflicts
        }
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({ status: "ERROR", error: "Endpoint not supported" }), {
      status: 404,
      headers: CORS_HEADERS
    });
  } catch (err: any) {
    console.error("[Cloudflare Evidence API] Handler error:", err);
    return new Response(JSON.stringify({ status: "ERROR", error: err.message || "Internal server error" }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
