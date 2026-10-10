/**
 * BVELT MEMORY v1 (BEM) — Foundation Core Tests
 * 
 * Verifies core BEM invariants:
 * 1. Deterministic Entity ID generation & normalization
 * 2. Conservative identity resolution & collision prevention
 * 3. Epistemological AI non-promotion rule (AI_INTERPRETATION != VERIFIED)
 * 4. Category-based Freshness Evaluation (FRESH, STALE, MISSING, CONFLICTED)
 * 5. BEM Memory Context generation for Planner consumption
 */

import { 
  createEntityIdentity, 
  generateEntityId, 
  normalizeBusinessName, 
  normalizePhoneE164, 
  normalizeDomain, 
  compareIdentities 
} from './entityIdentity';

import { 
  createMemoryRecord, 
  getEntityMemoryContext,
  areValuesEquivalent,
  writeEntityEvidenceBatch,
  writeEvidenceRecord,
  persistBusinessScanToBem
} from './bemStore';

import { 
  evaluateRecordFreshness 
} from './freshnessEvaluator';

import { BemTelemetry } from './bemTelemetry';
import { DataAcquisitionPlanner, AcquisitionNeed } from '../planner/dataAcquisitionPlanner';
import { DataOrchestrator } from '../cache/dataOrchestrator';
import { DataCache } from '../cache/dataCache';

export async function runBemFoundationTests(): Promise<{ passed: boolean; results: string[] }> {
  const logs: string[] = [];
  let allPassed = true;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      logs.push(`[PASS] ${testName}`);
    } else {
      logs.push(`[FAIL] ${testName}`);
      allPassed = false;
    }
  }

  // Clear telemetry log before starting test run
  BemTelemetry.clear();

  // Test 1: Business Name Normalization
  assert(
    normalizeBusinessName("Joe's HVAC & Heating, LLC!") === "joe s hvac heating",
    "normalizeBusinessName strips legal suffixes and punctuation"
  );

  // Test 2: Phone E164 Normalization
  assert(
    normalizePhoneE164("(555) 123-4567") === "+15551234567",
    "normalizePhoneE164 converts US 10-digit phone to E.164"
  );

  // Test 3: Domain Canonicalization
  assert(
    normalizeDomain("https://www.JoesHvac.com/about?src=1") === "joeshvac.com",
    "normalizeDomain strips protocol, www, port, and subpaths"
  );

  // Test 4: Deterministic Entity Key Anchor
  const id1 = generateEntityId({ canonicalName: "Joe's HVAC", domain: "joeshvac.com", phone: "5551234567" });
  const id2 = generateEntityId({ canonicalName: "Joes HVAC LLC", domain: "https://www.joeshvac.com", phone: "(555) 123-4567" });
  assert(
    id1.entityId === id2.entityId && id1.status === 'RESOLVED',
    "generateEntityId yields identical key for matching domain+phone anchors"
  );

  // Test 5: Conservative Conflict Prevention (Name match but differing phone)
  const entA = createEntityIdentity({ canonicalName: "Joe's HVAC", phone: "5551112222", postalCode: "33101" });
  const entB = createEntityIdentity({ canonicalName: "Joe's HVAC", phone: "5559998888", postalCode: "33101" });
  const cmp = compareIdentities(entA, entB);
  assert(
    !cmp.isMatch && cmp.isConflict,
    "compareIdentities prevents merging entities with matching name but conflicting phone numbers"
  );

  // Test 6: AI Interpretation Non-Promotion Rule
  const aiRecord = createMemoryRecord({
    entityId: "ent_biz_test",
    fieldKey: "reputationSummary",
    value: "High sentiment review summary",
    observationType: "AI_INTERPRETATION",
    evidenceStatus: "VERIFIED" as any, // Attempting to pass VERIFIED
    sourceType: "LIVE_SEARCH",
    sourceLabel: "Gemini 3.6 Flash"
  });
  assert(
    aiRecord.evidenceStatus !== ("VERIFIED" as any) && aiRecord.evidenceStatus === "INFERRED",
    "createMemoryRecord demotes AI_INTERPRETATION from VERIFIED to INFERRED"
  );

  // Test 7: Freshness Evaluation
  const freshRecord = createMemoryRecord({
    entityId: "ent_biz_test",
    fieldKey: "phone",
    value: "+15551234567",
    observationType: "FACT",
    evidenceStatus: "VERIFIED",
    sourceType: "CRM",
    sourceLabel: "User Input"
  });
  assert(
    evaluateRecordFreshness(freshRecord) === 'FRESH',
    "evaluateRecordFreshness returns FRESH for newly created record"
  );

  const staleRecord = { ...freshRecord, expiresAt: new Date(Date.now() - 1000).toISOString() };
  assert(
    evaluateRecordFreshness(staleRecord) === 'STALE',
    "evaluateRecordFreshness returns STALE for expired record within SWR window"
  );

  // Test 8: Value Equivalence Checker
  assert(
    areValuesEquivalent({ lat: 25.76, lng: -80.19 }, { lat: 25.76, lng: -80.19 }) &&
    !areValuesEquivalent({ lat: 25.76, lng: -80.19 }, { lat: 25.77, lng: -80.19 }),
    "areValuesEquivalent correctly compares primitive and structured evidence values"
  );

  // Test 9: Batch Write Deduplication & Content Equality
  const resolvedIdentity = createEntityIdentity({ canonicalName: "Apex Plumbing", domain: "apexplumbing.com", phone: "5551239999" });
  const recordA = createMemoryRecord({
    entityId: resolvedIdentity.entityId,
    fieldKey: "website",
    value: "apexplumbing.com",
    observationType: "FACT",
    evidenceStatus: "VERIFIED",
    sourceType: "BUSINESS_SCAN",
    sourceLabel: "Domain Resolver"
  });

  const batch1 = await writeEntityEvidenceBatch(resolvedIdentity, [recordA]);
  const batch2 = await writeEntityEvidenceBatch(resolvedIdentity, [recordA]); // Duplicate record
  assert(
    batch1.writtenCount === 1 && batch2.writtenCount === 0 && batch2.skippedCount === 1,
    "writeEntityEvidenceBatch suppresses duplicate writes when evidence content is unchanged"
  );

  // Test 10: Provisional Identity Gate
  const provisionalIdentity = createEntityIdentity({ canonicalName: "Unknown Local Spot" }); // No domain, no phone, no placeId -> PROVISIONAL
  const provRecord = createMemoryRecord({
    entityId: provisionalIdentity.entityId,
    fieldKey: "canonicalName",
    value: "Unknown Local Spot",
    observationType: "FACT",
    evidenceStatus: "UNVERIFIED",
    sourceType: "USER",
    sourceLabel: "Input"
  });
  const provBatch = await writeEntityEvidenceBatch(provisionalIdentity, [provRecord]);
  assert(
    provBatch.writtenCount === 0 && provBatch.skippedCount === 1,
    "writeEntityEvidenceBatch blocks Shared Memory persistence for PROVISIONAL identities"
  );

  // Test 11: Business Scan Safe Write-Back
  const scanSuccess = await persistBusinessScanToBem({
    businessName: "Elite Dentistry",
    phone: "5559876543",
    website: "elitedentistry.com",
    rating: 4.9,
    reviewCount: 120,
    address: "100 Main St, Miami, FL"
  });
  assert(
    scanSuccess,
    "persistBusinessScanToBem successfully processes and writes public evidence to BEM"
  );

  // ==========================================
  // PHASE 7: MEASURED MEMORY & GOVERNANCE TESTS
  // ==========================================

  // Setup entity memory context for Phase 7 testing
  const testEntity = createEntityIdentity({ canonicalName: "Acme Logistics", domain: "acmelogistics.com", phone: "5550001111" });
  const freshPhoneRec = createMemoryRecord({
    entityId: testEntity.entityId,
    fieldKey: "phone",
    value: "+15550001111",
    observationType: "FACT",
    evidenceStatus: "VERIFIED",
    sourceType: "CRM",
    sourceLabel: "Phone Index"
  });
  const staleRatingRec = createMemoryRecord({
    entityId: testEntity.entityId,
    fieldKey: "rating",
    value: 4.8,
    observationType: "FACT",
    evidenceStatus: "VERIFIED",
    sourceType: "SCAN_MAPS",
    sourceLabel: "Maps Review"
  });
  staleRatingRec.expiresAt = new Date(Date.now() - 5000).toISOString(); // Stale

  await writeEntityEvidenceBatch(testEntity, [freshPhoneRec, staleRatingRec]);
  const memCtx = await getEntityMemoryContext(testEntity);

  // TEST A: FRESH field -> no acquisition
  const needsA: AcquisitionNeed[] = [{ field: "phone", required: true, freshnessMaxAgeDays: 30 }];
  const planA = DataAcquisitionPlanner.planAcquisitionWithMemory(needsA, memCtx);
  assert(
    planA.availableLocally.includes("phone") && !planA.needsLiveEnrichment.includes("phone") && planA.savings.savingsRatioPercent === 100,
    "TEST A: FRESH field in BEM skips external acquisition and yields 100% savings"
  );

  // TEST B: STALE field -> context reuse without mandatory refresh (for optional needs)
  const needsB: AcquisitionNeed[] = [{ field: "rating", required: false, freshnessMaxAgeDays: 7 }];
  const planB = DataAcquisitionPlanner.planAcquisitionWithMemory(needsB, memCtx);
  assert(
    planB.availableLocally.includes("rating") && !planB.needsLiveEnrichment.includes("rating"),
    "TEST B: STALE optional field reuses context without forcing mandatory refresh"
  );

  // TEST C: MISSING required field -> acquisition allowed
  const needsC: AcquisitionNeed[] = [{ field: "web_presence", required: true, freshnessMaxAgeDays: 7 }];
  const planC = DataAcquisitionPlanner.planAcquisitionWithMemory(needsC, memCtx);
  assert(
    planC.needsLiveEnrichment.includes("web_presence"),
    "TEST C: MISSING required field correctly triggers live acquisition"
  );

  // TEST D: MISSING optional field -> no unnecessary acquisition
  const needsD: AcquisitionNeed[] = [{ field: "faxNumber", required: false, freshnessMaxAgeDays: 30 }];
  const planD = DataAcquisitionPlanner.planAcquisitionWithMemory(needsD, memCtx);
  assert(
    !planD.needsLiveEnrichment.includes("faxNumber"),
    "TEST D: MISSING optional field avoids unnecessary live acquisition"
  );

  // TEST E: CONFLICTED field -> targeted verification path
  const memCtxWithConflict = {
    ...memCtx,
    fields: {
      ...memCtx.fields,
      address: {
        fieldKey: "address",
        state: "CONFLICTED" as const,
        currentValue: "Conflict Address",
        confidence: 0.5
      }
    }
  };
  const needsE: AcquisitionNeed[] = [{ field: "address", required: true, freshnessMaxAgeDays: 30 }];
  const planE = DataAcquisitionPlanner.planAcquisitionWithMemory(needsE, memCtxWithConflict);
  assert(
    planE.conflictedFields.includes("address") && planE.needsLiveEnrichment.includes("address"),
    "TEST E: CONFLICTED field triggers targeted verification path"
  );

  // TEST F: Same entity concurrent requests -> no duplicate acquisition (Inflight Coalescing)
  let fetchCallCount = 0;
  const mockFetcher = async () => {
    fetchCallCount++;
    await new Promise(r => setTimeout(r, 10));
    return "test_data";
  };
  const promise1 = DataOrchestrator.deduplicate("hash_concurrent_test", mockFetcher);
  const promise2 = DataOrchestrator.deduplicate("hash_concurrent_test", mockFetcher);
  const [res1, res2] = await Promise.all([promise1, promise2]);
  assert(
    res1 === "test_data" && res2 === "test_data" && fetchCallCount === 1,
    "TEST F: DataOrchestrator.deduplicate coalesces concurrent parallel requests to single execution"
  );

  // TEST G: Same entity, same evidence -> write noop
  const recSame = createMemoryRecord({
    entityId: testEntity.entityId,
    fieldKey: "phone",
    value: "+15550001111", // Unchanged
    observationType: "FACT",
    evidenceStatus: "VERIFIED",
    sourceType: "CRM",
    sourceLabel: "Phone Index"
  });
  const batchG = await writeEntityEvidenceBatch(testEntity, [recSame]);
  assert(
    batchG.writtenCount === 0 && batchG.skippedCount === 1,
    "TEST G: Same evidence record results in write noop"
  );

  // TEST H: Same entity, changed evidence -> one update
  const recChanged = createMemoryRecord({
    entityId: testEntity.entityId,
    fieldKey: "phone",
    value: "+15559990000", // Changed
    observationType: "FACT",
    evidenceStatus: "VERIFIED",
    sourceType: "CRM",
    sourceLabel: "Phone Index"
  });
  const batchH = await writeEntityEvidenceBatch(testEntity, [recChanged]);
  assert(
    batchH.writtenCount === 1 && batchH.skippedCount === 0,
    "TEST H: Changed evidence record triggers single write update"
  );

  // TEST I: Public evidence reused across tenants
  const tenant1Ctx = await getEntityMemoryContext(testEntity, "tenant_111");
  const tenant2Ctx = await getEntityMemoryContext(testEntity, "tenant_222");
  assert(
    tenant1Ctx.fields.phone?.currentValue === "+15559990000" &&
    tenant2Ctx.fields.phone?.currentValue === "+15559990000",
    "TEST I: PUBLIC_SHARED evidence is accessible and reused across multiple tenants"
  );

  // TEST J: Private evidence never reaches shared memory
  const privateRec = createMemoryRecord({
    entityId: testEntity.entityId,
    fieldKey: "privateNotes",
    value: "Secret notes",
    observationType: "USER_PROVIDED",
    evidenceStatus: "VERIFIED",
    classification: "TENANT_PRIVATE",
    sourceType: "USER",
    sourceLabel: "User Note"
  });
  const batchJ = await writeEntityEvidenceBatch(testEntity, [privateRec]);
  assert(
    batchJ.writtenCount === 0 && batchJ.skippedCount === 1,
    "TEST J: TENANT_PRIVATE classification is blocked from shared BEM batch persistence"
  );

  // TEST K: Static dataset prevents external API call
  const needsK: AcquisitionNeed[] = [{ field: "geography", required: true, freshnessMaxAgeDays: 30 }];
  const planK = DataAcquisitionPlanner.planAcquisitionWithMemory(needsK, null);
  assert(
    planK.availableLocally.includes("geography") && planK.savings.fieldsReusedFromStatic === 1,
    "TEST K: Static Knowledge satisfies geography field without calling external API"
  );

  // TEST L: DataCache hit prevents Firestore lookup where applicable
  const cacheKeyL = DataCache.buildKey("CITY_INDUSTRY_BENCHMARK", "test_query_hash");
  DataCache.set(cacheKeyL, { benchmarkVal: 100 }, "CITY_INDUSTRY_BENCHMARK", "TEST", "hash_l", 60000);
  const cachedL = DataCache.get(cacheKeyL);
  assert(
    cachedL !== null && cachedL.data.benchmarkVal === 100 && !cachedL.isStale,
    "TEST L: DataCache hit serves fresh data locally without database network queries"
  );

  // Property Invariant 1: FRESH => acquisition count = 0
  const inv1Needs: AcquisitionNeed[] = [
    { field: "phone", required: true, freshnessMaxAgeDays: 30 }
  ];
  const inv1Plan = DataAcquisitionPlanner.planAcquisitionWithMemory(inv1Needs, memCtx);
  assert(
    inv1Plan.needsLiveEnrichment.length === 0,
    "INVARIANT: FRESH field implies zero live acquisitions required"
  );

  // Property Invariant 2: Private data => shared persistence forbidden
  assert(
    privateRec.classification === "TENANT_PRIVATE" &&
    (await writeEntityEvidenceBatch(testEntity, [privateRec])).writtenCount === 0,
    "INVARIANT: Private classification strictly forbids shared BEM persistence"
  );

  return { passed: allPassed, results: logs };
}
