import { Request, Response } from "express";
import { getFirebaseAdminAuth } from "./firebaseAdmin.ts";
import { FieldValue } from "firebase-admin/firestore";
import { 
  validateEntityId, 
  PUBLIC_SAFE_FIELD_KEYS, 
  compilePublicSafeEntityEvidence,
  EXPERIMENT_ENTITIES 
} from "../src/knowledge/memory/publicEvidenceService.ts";
import { 
  computeChainedEventHash, 
  GENESIS_HASH 
} from "../src/knowledge/memory/integrity/evidenceIntegrity.ts";

/**
 * Express Handler: GET /api/business/:id/evidence
 * Retrieves certified, public-safe business evidence for an entity.
 */
export async function getBusinessEvidenceHandler(req: Request, res: Response, db: any): Promise<void> {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const entityId = req.params.id;
  const lang = (req.query.lang as 'es' | 'en') || 'es';

  if (!validateEntityId(entityId)) {
    res.status(400).json({ 
      status: "ERROR", 
      error: "Invalid entity ID format." 
    });
    return;
  }

  // Fast check for experiment & verification test entities
  if (EXPERIMENT_ENTITIES[entityId]) {
    res.status(200).json({
      status: "SUCCESS",
      data: EXPERIMENT_ENTITIES[entityId]
    });
    return;
  }

  if (!db) {
    res.status(404).json({ 
      status: "NOT_FOUND", 
      message: `Database connection unavailable and entity not found in verified registry: ${entityId}` 
    });
    return;
  }

  try {
    const docRef = db.collection('bem_entities').doc(entityId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({ 
        status: "NOT_FOUND", 
        message: `No verified evidence record found for entity ID: ${entityId}` 
      });
      return;
    }

    const docData = docSnap.data() || {};

    // Point read: fetch bounded active conflicts (up to 10)
    let conflicts: any[] = [];
    try {
      const confSnap = await db.collection('bem_entities').doc(entityId).collection('conflicts').limit(10).get();
      if (!confSnap.empty) {
        conflicts = confSnap.docs.map((d: any) => d.data());
      }
    } catch {
      // Non-blocking
    }

    // Point read: fetch bounded recent history (up to 15)
    let history: any[] = [];
    try {
      const histSnap = await db.collection('bem_entities').doc(entityId).collection('history').orderBy('observedAt', 'desc').limit(15).get();
      if (!histSnap.empty) {
        history = histSnap.docs.map((d: any) => d.data());
      }
    } catch {
      // Non-blocking
    }

    const publicEvidence = compilePublicSafeEntityEvidence(docData, entityId, lang, conflicts, history);

    res.status(200).json({
      status: "SUCCESS",
      data: publicEvidence
    });
  } catch (err: any) {
    console.error(`[Business Evidence API] Error fetching evidence for ${entityId}:`, err);
    res.status(500).json({ 
      status: "ERROR", 
      error: "Internal server error retrieving evidence record." 
    });
  }
}

/**
 * Express Handler: GET /api/business/:id/history
 * Bounded retrieval of public-safe historical evidence events.
 */
export async function getBusinessHistoryHandler(req: Request, res: Response, db: any): Promise<void> {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const entityId = req.params.id;
  const limitParam = parseInt(req.query.limit as string, 10);
  const boundedLimit = Math.min(Math.max(isNaN(limitParam) ? 20 : limitParam, 1), 50);

  if (!validateEntityId(entityId)) {
    res.status(400).json({ 
      status: "ERROR", 
      error: "Invalid entity ID format." 
    });
    return;
  }

  // Fast check for experiment & verification test entities
  if (EXPERIMENT_ENTITIES[entityId]) {
    const experimentData = EXPERIMENT_ENTITIES[entityId];
    const events = (experimentData.recentHistory || []).slice(0, boundedLimit);
    res.status(200).json({
      status: "SUCCESS",
      data: {
        entityId,
        totalEvents: events.length,
        events
      }
    });
    return;
  }

  if (!db) {
    res.status(200).json({
      status: "SUCCESS",
      data: {
        entityId,
        totalEvents: 0,
        events: []
      }
    });
    return;
  }

  try {
    const histSnap = await db.collection('bem_entities')
      .doc(entityId)
      .collection('history')
      .orderBy('observedAt', 'desc')
      .limit(boundedLimit)
      .get();

    const events: any[] = [];
    if (!histSnap.empty) {
      for (const d of histSnap.docs) {
        const raw = d.data();
        if (PUBLIC_SAFE_FIELD_KEYS.has(raw.fieldKey)) {
          events.push({
            eventId: raw.eventId || d.id,
            entityId,
            fieldKey: raw.fieldKey,
            oldValue: raw.oldValue,
            newValue: raw.newValue,
            sourceType: raw.sourceType,
            observationType: raw.observationType,
            evidenceStatus: raw.evidenceStatus,
            confidence: raw.confidence,
            observedAt: raw.observedAt,
            detectedAt: raw.detectedAt
          });
        }
      }
    }

    res.status(200).json({
      status: "SUCCESS",
      data: {
        entityId,
        totalEvents: events.length,
        events
      }
    });
  } catch (err: any) {
    console.error(`[Business History API] Error fetching history for ${entityId}:`, err);
    res.status(500).json({ 
      status: "ERROR", 
      error: "Internal server error retrieving history events." 
    });
  }
}

/**
 * Express Handler: GET /api/business/:id/conflicts
 * Bounded retrieval of public-safe conflict records.
 */
export async function getBusinessConflictsHandler(req: Request, res: Response, db: any): Promise<void> {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const entityId = req.params.id;
  const limitParam = parseInt(req.query.limit as string, 10);
  const boundedLimit = Math.min(Math.max(isNaN(limitParam) ? 20 : limitParam, 1), 50);

  if (!validateEntityId(entityId)) {
    res.status(400).json({ 
      status: "ERROR", 
      error: "Invalid entity ID format." 
    });
    return;
  }

  // Fast check for experiment & verification test entities
  if (EXPERIMENT_ENTITIES[entityId]) {
    const experimentData = EXPERIMENT_ENTITIES[entityId];
    const conflicts = (experimentData.activeConflicts || []).slice(0, boundedLimit);
    res.status(200).json({
      status: "SUCCESS",
      data: {
        entityId,
        totalConflicts: conflicts.length,
        conflicts
      }
    });
    return;
  }

  if (!db) {
    res.status(200).json({
      status: "SUCCESS",
      data: {
        entityId,
        totalConflicts: 0,
        conflicts: []
      }
    });
    return;
  }

  try {
    const confSnap = await db.collection('bem_entities')
      .doc(entityId)
      .collection('conflicts')
      .limit(boundedLimit)
      .get();

    const conflicts: any[] = [];
    if (!confSnap.empty) {
      for (const d of confSnap.docs) {
        const raw = d.data();
        if (PUBLIC_SAFE_FIELD_KEYS.has(raw.fieldKey)) {
          conflicts.push({
            conflictId: raw.conflictId || d.id,
            entityId,
            fieldKey: raw.fieldKey,
            sourceA: raw.sourceA,
            valueA: raw.valueA,
            sourceB: raw.sourceB,
            valueB: raw.valueB,
            firstDetectedAt: raw.firstDetectedAt,
            lastDetectedAt: raw.lastDetectedAt,
            status: raw.status || 'OPEN',
            resolutionSource: raw.resolutionSource || null,
            resolutionAt: raw.resolutionAt || null,
            resolutionReason: raw.resolutionReason || null
          });
        }
      }
    }

    res.status(200).json({
      status: "SUCCESS",
      data: {
        entityId,
        totalConflicts: conflicts.length,
        conflicts
      }
    });
  } catch (err: any) {
    console.error(`[Business Conflicts API] Error fetching conflicts for ${entityId}:`, err);
    res.status(500).json({ 
      status: "ERROR", 
      error: "Internal server error retrieving conflict records." 
    });
  }
}

/**
 * Express Handler: POST /api/business/evidence
 * Secure authenticated server-side write for BEM evidence.
 */
export async function postBusinessEvidenceHandler(req: Request, res: Response, db: any): Promise<void> {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  
  if (!bearerToken) {
    res.status(401).json({ status: "ERROR", error: "Missing or invalid Authorization token." });
    return;
  }

  let userId: string;
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    res.status(503).json({ status: "ERROR", error: "Server authentication service unavailable.", code: "ADMIN_AUTH_UNAVAILABLE" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(bearerToken);
    userId = decoded.uid;
  } catch (err) {
    res.status(401).json({ status: "ERROR", error: "Unauthorized. Invalid Firebase ID Token." });
    return;
  }

  const { identity, records } = req.body || {};
  if (!identity || !Array.isArray(records)) {
    res.status(400).json({ status: "ERROR", error: "Invalid request payload. Must provide 'identity' and 'records' array." });
    return;
  }

  const entityId = identity.entityId;
  if (!validateEntityId(entityId)) {
    res.status(400).json({ status: "ERROR", error: "Invalid entity ID format." });
    return;
  }

  try {
    const docRef = db.collection('bem_entities').doc(entityId);
    const result = await db.runTransaction(async (transaction: any) => {
      const docSnap = await transaction.get(docRef);
      const existingFields = docSnap.exists ? (docSnap.data()?.fields || {}) : {};
      let prevHash = (docSnap.exists && docSnap.data()?.lastEventHash) || GENESIS_HASH;

      const fieldsToUpdate: Record<string, any> = {};
      let hasUpdates = false;

      const historyWrites: { ref: any, data: any }[] = [];
      const conflictWrites: { ref: any, data: any }[] = [];
      const metricUpdates: Record<string, { totalObservations: number, totalConflicts: number, unresolvedConflicts: number }> = {};

      for (const record of records) {
        if (!PUBLIC_SAFE_FIELD_KEYS.has(record.fieldKey)) {
          console.warn(`[postBusinessEvidenceHandler] Rejected un-whitelisted field write: ${record.fieldKey}`);
          continue;
        }
        
        if (record.classification !== "PUBLIC_SHARED") {
          console.warn(`[postBusinessEvidenceHandler] Rejected non-PUBLIC_SHARED write classification: ${record.classification}`);
          continue;
        }

        const existingRecord = existingFields[record.fieldKey];
        if (existingRecord && existingRecord.value === record.value && existingRecord.sourceType === record.sourceType) {
          continue;
        }

        hasUpdates = true;
        fieldsToUpdate[record.fieldKey] = record;

        // Use random suffix to avoid collision within the same millisecond timestamp during a batch
        const historyEventId = `evhist_${entityId}_${record.fieldKey}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const historyRef = db.collection('bem_entities').doc(entityId).collection('history').doc(historyEventId);
        
        const historyEvent: any = {
          eventId: historyEventId,
          entityId: entityId,
          fieldKey: record.fieldKey,
          oldValue: existingRecord ? existingRecord.value : null,
          newValue: record.value,
          sourceType: record.sourceType,
          observationType: record.observationType,
          evidenceStatus: record.evidenceStatus,
          confidence: record.confidence ?? 0.95,
          observedAt: record.observedAt || new Date().toISOString(),
          detectedAt: new Date().toISOString(),
          producerVersion: record.producerVersion || "8.0.0",
          schemaVersion: 1,
          previousHash: prevHash,
          currentHash: "",
          eventHash: "",
          ...(record.relationship ? { relationship: record.relationship } : {}),
          ...(record.actionReference ? { actionReference: record.actionReference } : {}),
          ...(record.outcomeReference ? { outcomeReference: record.outcomeReference } : {}),
          ...(record.baselineReference ? { baselineReference: record.baselineReference } : {}),
          ...(record.windowStart ? { windowStart: record.windowStart } : {}),
          ...(record.windowEnd ? { windowEnd: record.windowEnd } : {})
        };

        const currHash = await computeChainedEventHash(historyEvent, prevHash);
        historyEvent.currentHash = currHash;
        historyEvent.eventHash = currHash;
        prevHash = currHash;

        historyWrites.push({ ref: historyRef, data: historyEvent });

        if (!metricUpdates[record.sourceType]) {
          metricUpdates[record.sourceType] = { totalObservations: 0, totalConflicts: 0, unresolvedConflicts: 0 };
        }
        metricUpdates[record.sourceType].totalObservations += 1;

        if (existingRecord && existingRecord.sourceType !== record.sourceType && 
             existingRecord.evidenceStatus === 'VERIFIED' && record.evidenceStatus === 'VERIFIED') {
          
          const sources = [existingRecord.sourceType, record.sourceType].sort();
          const conflictId = `conf_${entityId}_${record.fieldKey}_${sources[0]}_vs_${sources[1]}`;
          const conflictRef = db.collection('bem_entities').doc(entityId).collection('conflicts').doc(conflictId);
          
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
          
          conflictWrites.push({ ref: conflictRef, data: conflictRecord });

          for (const src of sources) {
            if (!metricUpdates[src]) {
              metricUpdates[src] = { totalObservations: 0, totalConflicts: 0, unresolvedConflicts: 0 };
            }
            metricUpdates[src].totalConflicts += 1;
            metricUpdates[src].unresolvedConflicts += 1;
          }
        }
      }

      if (!hasUpdates) {
        return { hasUpdates: false, writtenCount: 0 };
      }

      const entityUpdateBody: any = {
        entityId: entityId,
        canonicalName: identity.canonicalName,
        normalizedName: identity.normalizedName,
        domainCanonical: identity.domainCanonical || null,
        phoneE164: identity.phoneE164 || null,
        lastUpdated: new Date().toISOString(),
        lastEventHash: prevHash,
        schemaVersion: 1
      };

      for (const [fKey, rec] of Object.entries(fieldsToUpdate)) {
        entityUpdateBody[`fields.${fKey}`] = rec;
      }

      transaction.set(docRef, entityUpdateBody, { merge: true });

      for (const hw of historyWrites) {
        transaction.set(hw.ref, hw.data);
      }
      for (const cw of conflictWrites) {
        transaction.set(cw.ref, cw.data, { merge: true });
      }

      for (const [src, metrics] of Object.entries(metricUpdates)) {
        const metricRef = db.collection('bem_system').doc(`metrics_source_${src}`);
        const updateData: any = {
          sourceType: src,
          lastCalculatedAt: new Date().toISOString()
        };
        if (metrics.totalObservations > 0) updateData.totalObservations = FieldValue.increment(metrics.totalObservations);
        if (metrics.totalConflicts > 0) updateData.totalConflicts = FieldValue.increment(metrics.totalConflicts);
        if (metrics.unresolvedConflicts > 0) updateData.unresolvedConflicts = FieldValue.increment(metrics.unresolvedConflicts);
        
        transaction.set(metricRef, updateData, { merge: true });
      }

      return { hasUpdates: true, writtenCount: Object.keys(fieldsToUpdate).length };
    });

    if (!result.hasUpdates) {
      res.status(200).json({ status: "SUCCESS", message: "No updates detected; content is unchanged.", writtenCount: 0 });
      return;
    }

    res.status(200).json({ 
      status: "SUCCESS", 
      message: "Successfully persisted BEM evidence.", 
      writtenCount: result.writtenCount 
    });
  } catch (err: any) {
    console.error("[postBusinessEvidenceHandler] Error processing evidence update:", err);
    res.status(500).json({ status: "ERROR", error: err.message || String(err) });
  }
}

/**
 * Express Handler: POST /api/business/resolve-conflict
 * Secure authenticated server-side conflict resolution for BEM.
 */
export async function postResolveConflictHandler(req: Request, res: Response, db: any): Promise<void> {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  
  if (!bearerToken) {
    res.status(401).json({ status: "ERROR", error: "Missing or invalid Authorization token." });
    return;
  }

  let userId: string;
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    res.status(503).json({ status: "ERROR", error: "Server authentication service unavailable.", code: "ADMIN_AUTH_UNAVAILABLE" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(bearerToken);
    userId = decoded.uid;
  } catch (err) {
    res.status(401).json({ status: "ERROR", error: "Unauthorized. Invalid Firebase ID Token." });
    return;
  }

  const { entityId, conflictId, winningSource, resolutionReason = "MANUAL_RESOLUTION" } = req.body || {};
  if (!entityId || !conflictId || !winningSource) {
    res.status(400).json({ status: "ERROR", error: "Invalid payload. Must provide entityId, conflictId, and winningSource." });
    return;
  }

  if (!validateEntityId(entityId)) {
    res.status(400).json({ status: "ERROR", error: "Invalid entity ID format." });
    return;
  }

  try {
    const conflictRef = db.collection('bem_entities').doc(entityId).collection('conflicts').doc(conflictId);
    const confSnap = await conflictRef.get();

    if (!confSnap.exists) {
      res.status(404).json({ status: "ERROR", error: "Conflict document not found." });
      return;
    }

    const conflictData = confSnap.data();

    if (conflictData.status === "RESOLVED") {
      res.status(200).json({ status: "SUCCESS", message: "Conflict already resolved.", alreadyResolved: true });
      return;
    }

    const losingSource = conflictData.sourceA === winningSource ? conflictData.sourceB : conflictData.sourceA;

    const batch = db.batch();
    const nowIso = new Date().toISOString();

    const updatedConflict = {
      status: "RESOLVED",
      resolutionSource: winningSource,
      resolutionAt: nowIso,
      resolutionReason
    };

    batch.set(conflictRef, updatedConflict, { merge: true });

    const winnerMetricRef = db.collection('bem_system').doc(`metrics_source_${winningSource}`);
    batch.set(winnerMetricRef, {
      unresolvedConflicts: FieldValue.increment(-1),
      resolutionsWon: FieldValue.increment(1),
      lastCalculatedAt: new Date().toISOString()
    }, { merge: true });

    if (losingSource && losingSource !== winningSource) {
      const loserMetricRef = db.collection('bem_system').doc(`metrics_source_${losingSource}`);
      batch.set(loserMetricRef, {
        unresolvedConflicts: FieldValue.increment(-1),
        resolutionsLost: FieldValue.increment(1),
        lastCalculatedAt: new Date().toISOString()
      }, { merge: true });
    }

    await batch.commit();

    res.status(200).json({ status: "SUCCESS", message: "Conflict resolved successfully." });

  } catch (err: any) {
    console.error("[postResolveConflictHandler] Error resolving conflict:", err);
    res.status(500).json({ status: "ERROR", error: err.message || String(err) });
  }
}
