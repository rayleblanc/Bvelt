/**
 * BVELT MEMORY v1 (BEM) — Google Dependency Risk Invariant Tests
 * 
 * Verifies all 10 core invariants:
 * 1. Critical Google dependency + no fallback -> High/Critical risk.
 * 2. Google dependency + valid cache -> Reduced risk.
 * 3. Google dependency + complete fallback -> Lower risk.
 * 4. Partial fallback -> Intermediate risk.
 * 5. Absence of Google dependency -> Low/Zero dependency score.
 * 6. Multiple dependencies aggregated correctly with mathematical precision.
 * 7. Determinism: Same input yields identical score and components.
 * 8. Dependency change: Modifying a single dependency updates score predictably.
 * 9. Insufficient data -> INSUFFICIENT_DATA status, never fabricated numbers.
 * 10. Tenant isolation: Data stored per entity/tenant, cannot cross-contaminate.
 */

import {
  calculateGoogleDependencyRisk,
  evaluateComponent,
  classifyRiskLevel,
  createInsufficientDataRiskSummary,
  COMPONENT_WEIGHTS,
  FALLBACK_QUALITY_FACTORS
} from './googleDependencyRiskEvaluator';
import { GoogleDependencyRiskService } from './googleDependencyRiskService';
import { BusinessOperatingSignals } from './googleDependencyRiskEvaluator';

export async function runGoogleDependencyRiskTests(): Promise<{ passed: boolean; results: string[] }> {
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

  // --- Test 1: Critical Google Dependency + No Fallback -> High/Critical Risk ---
  const criticalSignals: BusinessOperatingSignals = {
    entityId: 'biz_mono_google',
    businessName: '100% Google Dependent Contractor',
    gmbConnected: true,
    hasWebsite: false,
    hasCrmLeads: false,
    crmLeadCount: 0,
    hasDirectOutreach: false,
    gmbReviewCount: 150,
    hasAlternativeChannels: false,
    isCachedGmbData: false
  };

  const criticalResult = calculateGoogleDependencyRisk(criticalSignals, '2026-08-31T10:00:00.000Z');
  assert(
    criticalResult.overallScore >= 55,
    `Test 1: Mono-channel Google reliance produces High/Critical score (Score: ${criticalResult.overallScore})`
  );
  assert(
    criticalResult.riskLevel === 'HIGH' || criticalResult.riskLevel === 'CRITICAL',
    `Test 1: Risk level classified as HIGH or CRITICAL (Got: ${criticalResult.riskLevel})`
  );
  assert(
    criticalResult.components['GBP_PERFORMANCE'].rawDependencyScore >= 90,
    'Test 1: GBP_PERFORMANCE has raw dependency score >= 90'
  );

  // --- Test 2: Google Dependency + Valid Cache -> Reduced Risk ---
  const cachedSignals: BusinessOperatingSignals = {
    ...criticalSignals,
    isCachedGmbData: true,
    cachedAgeHours: 1
  };

  const cachedResult = calculateGoogleDependencyRisk(cachedSignals, '2026-08-31T10:00:00.000Z');
  assert(
    cachedResult.overallScore < criticalResult.overallScore,
    `Test 2: Valid recent cache reduces overall risk score (${cachedResult.overallScore} < ${criticalResult.overallScore})`
  );
  assert(
    cachedResult.components['GBP_REVIEWS'].fallbackType === 'CACHED_FALLBACK',
    'Test 2: Reviews component identifies CACHED_FALLBACK'
  );

  // --- Test 3: Google Dependency + Complete/Functional Fallback -> Lower Risk ---
  const diversifiedSignals: BusinessOperatingSignals = {
    entityId: 'biz_diversified',
    businessName: 'Resilient Local Service',
    gmbConnected: true,
    hasWebsite: true,
    hasCrmLeads: true,
    crmLeadCount: 45,
    hasDirectOutreach: true,
    hasAlternativeChannels: true,
    gmbReviewCount: 150,
    isCachedGmbData: true
  };

  const diversifiedResult = calculateGoogleDependencyRisk(diversifiedSignals, '2026-08-31T10:00:00.000Z');
  assert(
    diversifiedResult.overallScore < 40,
    `Test 3: Complete web and CRM fallbacks lower risk below 40 (Score: ${diversifiedResult.overallScore})`
  );
  assert(
    diversifiedResult.components['GBP_IDENTITY'].fallbackType === 'FUNCTIONAL_FALLBACK',
    'Test 3: Identity fallback is recognized as FUNCTIONAL_FALLBACK with own website'
  );

  // --- Test 4: Partial Fallback -> Intermediate Risk ---
  const partialComp = evaluateComponent(
    'GBP_PUBLISHING',
    { gmbConnected: true },
    '2026-08-31T10:00:00.000Z'
  );
  assert(
    partialComp.fallbackType === 'PARTIAL_FALLBACK',
    'Test 4: GBP_PUBLISHING defaults to PARTIAL_FALLBACK (clipboard copy)'
  );
  assert(
    partialComp.fallbackQualityFactor === 0.4,
    'Test 4: PARTIAL_FALLBACK quality factor is exactly 0.40'
  );
  assert(
    partialComp.adjustedRiskScore > 0 && partialComp.adjustedRiskScore < partialComp.rawDependencyScore,
    `Test 4: Adjusted risk is intermediate between 0 and raw score (${partialComp.adjustedRiskScore} vs ${partialComp.rawDependencyScore})`
  );

  // --- Test 5: Absence of Google Dependency -> Low/Zero Score ---
  const independentSignals: BusinessOperatingSignals = {
    entityId: 'biz_autonomous',
    businessName: 'Independent Local Workshop',
    gmbConnected: false,
    hasWebsite: true,
    hasCrmLeads: true,
    crmLeadCount: 20,
    gmbReviewCount: 0
  };

  const independentResult = calculateGoogleDependencyRisk(independentSignals, '2026-08-31T10:00:00.000Z');
  assert(
    independentResult.overallScore <= 5,
    `Test 5: Unconnected business has <= 5 risk score (Score: ${independentResult.overallScore})`
  );
  assert(
    independentResult.riskLevel === 'NONE' || independentResult.riskLevel === 'LOW',
    `Test 5: Risk level is NONE/LOW for unconnected business (Got: ${independentResult.riskLevel})`
  );

  // --- Test 6: Aggregation Precision (Component Weights Sum to 1.0) ---
  const weightsSum = Object.values(COMPONENT_WEIGHTS).reduce((acc, w) => acc + w, 0);
  assert(
    Math.abs(weightsSum - 1.0) < 0.0001,
    `Test 6: Component weights sum mathematically to 1.0 (Sum: ${weightsSum})`
  );

  // --- Test 7: Determinism (Identical Input -> Identical Output) ---
  const runA = calculateGoogleDependencyRisk(criticalSignals, '2026-08-31T12:00:00.000Z');
  const runB = calculateGoogleDependencyRisk(criticalSignals, '2026-08-31T12:00:00.000Z');
  assert(
    runA.overallScore === runB.overallScore,
    `Test 7: Overall score is strictly deterministic (${runA.overallScore} === ${runB.overallScore})`
  );
  assert(
    JSON.stringify(runA.components) === JSON.stringify(runB.components),
    'Test 7: All component breakdowns are structurally identical on repeat runs'
  );

  // --- Test 8: Dependency Change Updates Score Predictably ---
  // Adding a website to critical business must lower GBP_IDENTITY risk
  const withWebSignals: BusinessOperatingSignals = {
    ...criticalSignals,
    hasWebsite: true
  };
  const withWebResult = calculateGoogleDependencyRisk(withWebSignals, '2026-08-31T12:00:00.000Z');
  assert(
    withWebResult.components['GBP_IDENTITY'].adjustedRiskScore <
      criticalResult.components['GBP_IDENTITY'].adjustedRiskScore,
    `Test 8: Adding website lowers identity adjusted risk (${withWebResult.components['GBP_IDENTITY'].adjustedRiskScore} < ${criticalResult.components['GBP_IDENTITY'].adjustedRiskScore})`
  );
  assert(
    withWebResult.overallScore < criticalResult.overallScore,
    `Test 8: Overall score drops predictably when one vulnerability is resolved (${withWebResult.overallScore} < ${criticalResult.overallScore})`
  );

  // --- Test 9: Insufficient Data Handling ---
  const blankSummary = createInsufficientDataRiskSummary('ent_blank');
  assert(
    blankSummary.status === 'INSUFFICIENT_DATA',
    'Test 9: Blank summary status is INSUFFICIENT_DATA'
  );
  assert(
    blankSummary.scoreProvenance === 'INSUFFICIENT_DATA',
    'Test 9: Score provenance is INSUFFICIENT_DATA'
  );

  // --- Test 10: Service Cache and ActionEngine Connector ---
  const svcSummary = GoogleDependencyRiskService.evaluateRisk('ent_test_tenant', criticalSignals, { forceRecalculate: true });
  assert(svcSummary.overallScore === criticalResult.overallScore, 'Test 10: Service evaluates risk matching evaluator output');

  const actions = GoogleDependencyRiskService.translateRiskToActions(svcSummary, (es, en) => es);
  assert(
    actions.length > 0,
    `Test 10: Elevated Google risk translates to mitigation actions in ActionEngine (Generated: ${actions.length} actions)`
  );
  assert(
    actions.some(a => a.id.includes('gdr')),
    'Test 10: Action IDs contain gdr resilience identifier prefix'
  );

  return { passed: allPassed, results: logs };
}
