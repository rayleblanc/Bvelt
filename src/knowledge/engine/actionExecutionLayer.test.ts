/**
 * BVELT Execution Layer Comprehensive Test Suite
 * 
 * Verifies:
 * 1. Canonical Action Tool Catalog (draft_lead_follow_up, request_review_after_completed_job, draft_review_response, create_estimate_follow_up)
 * 2. Autonomy Policy Engine (Levels 0-3, quiet hours, daily quotas, spend limits, approval gate)
 * 3. Deep Reset / Resilient External Execution (timeout bounds, offline queue fallback, zero fake successes)
 * 4. Outcome Ledger Integration (explicit states: MEASURED, DECLARED, ESTIMATED, UNKNOWN, real provider cost)
 */

import {
  ActionEngine,
  AutonomyPolicyEngine,
  ActionToolCatalog,
  OutcomeLedgerService,
  ResilientExecutionEngine
} from './actionEngine';

// Node localStorage polyfill
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => store[k] || null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runExecutionLayerTests() {
  console.log('🧪 Starting BVELT Action Engine Execution Layer Test Suite...\n');
  const businessId = 'biz_test_plumbing_101';

  // TEST 1: Canonical Tool Catalog Availability
  console.log('--- TEST 1: Tool Catalog Verification ---');
  const catalog = ActionEngine.getToolCatalog();
  assert(catalog.length === 4, 'Catalog contains exactly 4 canonical tools');
  const toolIds = catalog.map(t => t.id);
  assert(toolIds.includes('draft_lead_follow_up'), 'Contains draft_lead_follow_up');
  assert(toolIds.includes('request_review_after_completed_job'), 'Contains request_review_after_completed_job');
  assert(toolIds.includes('draft_review_response'), 'Contains draft_review_response');
  assert(toolIds.includes('create_estimate_follow_up'), 'Contains create_estimate_follow_up');

  // TEST 2: Safe Default Autonomy Policy (Level 1 Draft)
  console.log('\n--- TEST 2: Safe Default Autonomy Policy ---');
  const policy = ActionEngine.getAutonomyPolicy(businessId);
  assert(policy.level === 1, 'Default autonomy policy level is 1 (Draft)');
  assert(policy.quietHours.enabled === true, 'Quiet hours enabled by default');
  assert(policy.quietHours.startHour === 20 && policy.quietHours.endHour === 8, 'Quiet hours set from 20:00 to 08:00');
  assert(policy.approvalRequiredActions.includes('request_review_after_completed_job'), 'Review requests require approval by default');

  // TEST 3: Tool 1 (draft_lead_follow_up) Execution & Outcome Ledger
  console.log('\n--- TEST 3: Tool 1 draft_lead_follow_up ---');
  const leadResult = await ActionEngine.executeCanonicalTool('draft_lead_follow_up', {
    businessId,
    leadId: 'lead_plumb_202',
    leadName: 'Carlos Mendoza',
    phone: '+15551234567',
    jobCategory: 'reparación de fuga',
    city: 'Zapopan',
    ticketValue: 150,
    daysSinceContact: 1,
    channel: 'whatsapp',
    lang: 'es'
  });

  assert(leadResult.success === true, 'Lead follow-up drafted successfully');
  assert(leadResult.executionState === 'DRAFT_CREATED', 'State is DRAFT_CREATED');
  assert(leadResult.outcomeState === 'DECLARED', 'Outcome state is DECLARED (honest draft, not fake measured conversion)');
  assert(leadResult.output?.status === 'DRAFT', 'Output status is strictly DRAFT');
  assert(leadResult.output?.whatsappUrl?.includes('wa.me'), 'Generates valid WhatsApp link');
  assert(leadResult.output?.content.includes('Carlos Mendoza'), 'Includes customer name');

  // TEST 4: Tool 3 (draft_review_response) Critical Review Handling
  console.log('\n--- TEST 4: Tool 3 draft_review_response ---');
  const revResult = await ActionEngine.executeCanonicalTool('draft_review_response', {
    businessId,
    reviewId: 'rev_999',
    reviewerName: 'Ana Gomez',
    rating: 1,
    reviewText: 'Llegaron 2 horas tarde.',
    serviceType: 'servicio de fontanería',
    lang: 'es'
  });

  assert(revResult.success === true, 'Review reply drafted');
  assert(revResult.output?.sentiment === 'CRITICAL', 'Detected CRITICAL sentiment for 1-star');
  assert(revResult.output?.draftText.includes('nos tomamos muy en serio'), 'Professional apology wording');
  assert(!revResult.output?.draftText.includes('5 estrellas'), 'Never mentions 5-star conditioning');

  // TEST 5: Autonomy Policy Gate Level 0 (Observe Mode Blocks Execution)
  console.log('\n--- TEST 5: Autonomy Policy Level 0 (Observe) ---');
  ActionEngine.setAutonomyLevel(businessId, 0);
  const blockedResult = await ActionEngine.executeCanonicalTool('draft_lead_follow_up', {
    businessId,
    leadId: 'lead_blocked_1',
    leadName: 'Roberto',
    jobCategory: 'plomería'
  });

  assert(blockedResult.success === false, 'Execution correctly blocked under Level 0');
  assert(blockedResult.executionState === 'BLOCKED_BY_POLICY', 'State is BLOCKED_BY_POLICY');
  assert(blockedResult.error?.includes('Level 0 (Observe)'), 'Explains Level 0 restriction');

  // Reset back to Level 1
  ActionEngine.setAutonomyLevel(businessId, 1);

  // TEST 6: Quiet Hours Gate for External Contact
  console.log('\n--- TEST 6: Quiet Hours Gate ---');
  // Evaluate review request during quiet hours (e.g. 23:00)
  const quietEval = AutonomyPolicyEngine.evaluate(businessId, 'request_review_after_completed_job', {
    isExternal: true,
    currentHour: 23,
    operatorApproved: true
  });
  assert(quietEval.permitted === false, 'External outreach blocked during quiet hours (23:00)');
  assert(quietEval.reason.includes('Quiet Hours'), 'Cites Quiet Hours rationale');

  // Evaluate during daytime (14:00)
  const dayEval = AutonomyPolicyEngine.evaluate(businessId, 'request_review_after_completed_job', {
    isExternal: true,
    currentHour: 14,
    operatorApproved: true
  });
  // Under level 1 with approval, permitted
  assert(dayEval.permitted === true, 'Daytime outreach allowed');

  // TEST 7: Tool 2 (request_review_after_completed_job) Anti-Gating Compliance & Resilient Dispatch
  console.log('\n--- TEST 7: Tool 2 Anti-Gating & Direct Dispatch ---');
  // Under Level 2 (Execute with Rules)
  ActionEngine.setAutonomyLevel(businessId, 2);

  const reviewReqResult = await ActionEngine.executeCanonicalTool(
    'request_review_after_completed_job',
    {
      businessId,
      jobId: 'job_404',
      customerName: 'Laura Torres',
      jobDescription: 'instalación de calentador solar',
      channel: 'whatsapp',
      directSendRequested: true,
      operatorApproved: true,
      lang: 'es'
    },
    {
      operatorApproved: true,
      currentHour: 14
    }
  );

  assert(reviewReqResult.success === true, 'Review request execution succeeded or queued');
  assert(reviewReqResult.output?.compliancePassed === true, 'Passed anti-gating compliance firewall');
  assert(!reviewReqResult.output?.messageText.includes('5 estrellas'), 'Review request does not condition 5 stars');

  // TEST 8: Resilient Execution Timeout / Offline Behavior (Deep Reset)
  console.log('\n--- TEST 8: Resilient Execution Timeout & Zero Fake Success ---');
  // Simulated hanging external call that exceeds timeout
  const timeoutResult = await ResilientExecutionEngine.executeWithTimeout(
    async () => {
      await new Promise(res => setTimeout(res, 500));
      return { ok: true };
    },
    {
      timeoutMs: 50, // Short timeout triggers abort
      businessId,
      payload: { action: 'test_hanging_call' }
    }
  );

  assert(timeoutResult.status === 'QUEUED' || timeoutResult.status === 'UNAVAILABLE', 'Timeout returns honest QUEUED or UNAVAILABLE');
  assert(timeoutResult.status !== 'EXECUTED', 'Never fabricates EXECUTED state on timeout');
  assert(timeoutResult.error?.includes('timeout'), 'Error specifies timeout');

  // TEST 9: Tool 4 (create_estimate_follow_up)
  console.log('\n--- TEST 9: Tool 4 create_estimate_follow_up ---');
  const estResult = await ActionEngine.executeCanonicalTool('create_estimate_follow_up', {
    businessId,
    estimateId: 'est_777',
    customerName: 'David Suarez',
    scopeOfWork: 'impermeabilización de techo',
    estimateTotalUsd: 1200,
    sentDaysAgo: 3,
    channel: 'whatsapp',
    lang: 'es'
  });

  assert(estResult.success === true, 'Estimate follow-up drafted');
  assert(estResult.output?.followUpMessage.includes('1,200'), 'Includes exact formatted estimate total');
  assert(estResult.output?.urgencyTrigger.length > 0, 'Includes commercial urgency trigger');

  // TEST 10: Outcome Ledger Audit
  console.log('\n--- TEST 10: Outcome Ledger Integrity & Provenance ---');
  const ledger = ActionEngine.getOutcomeLedger(businessId);
  assert(ledger.length > 0, 'Outcome ledger recorded all execution events');

  // Check that every entry has explicit states and real cost
  for (const entry of ledger) {
    assert(
      ['MEASURED', 'DECLARED', 'ESTIMATED', 'UNKNOWN'].includes(entry.outcomeState),
      `Valid outcome state on entry: ${entry.outcomeState}`
    );
    assert(
      ['SUCCESS', 'DRAFT_CREATED', 'QUEUED', 'UNAVAILABLE', 'BLOCKED_BY_POLICY', 'APPROVAL_REQUIRED'].includes(entry.executionState),
      `Valid execution state on entry: ${entry.executionState}`
    );
    assert(typeof entry.providerCostUsd === 'number', 'Provider cost is a real number (e.g. 0.00)');
    assert(entry.sourceLabel === 'BVELT_ACTION_ENGINE', 'Correct source label');
  }

  // TEST 11: Financial Attribution & ROI Rollup Loop (Phase 2)
  console.log('\n--- TEST 11: Financial Attribution & ROI Loop ---');
  // Record a won deal in the ledger
  OutcomeLedgerService.recordExecution({
    businessId,
    toolId: 'draft_lead_follow_up',
    executionState: 'SUCCESS',
    outcomeState: 'DECLARED',
    metricName: 'LEADS',
    outcomeType: 'WON',
    description: 'Contract signed after follow up',
    value: 2400
  });

  const attribution = OutcomeLedgerService.getFinancialAttribution(businessId);
  assert(attribution.wonRevenue >= 2400, 'Attribution accurately sums won revenue ($2,400+)');
  assert(attribution.roiMultiplier >= 20, 'Attribution calculates accurate ROI multiplier against standard plan cost');
  assert(attribution.totalExecutions > 0, 'Counts total executions');

  console.log('\n🎉 ALL EXECUTION LAYER TESTS PASSED SUCCESSFULLY!');
}

runExecutionLayerTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
