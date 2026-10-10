/**
 * BVELT MEMORY v1 (BEM) — Review Compliance Firewall Invariant Tests
 * 
 * Verifies all 13 compliance scenarios:
 * 1. Scenario 1: Neutral request to all customers without condition -> ALLOW.
 * 2. Scenario 2: Request conditional on positive rating (Review gating) -> BLOCK.
 * 3. Scenario 3: Request with mandatory 5-star instruction -> BLOCK.
 * 4. Scenario 4: Request with commercial/gift incentive -> BLOCK.
 * 5. Scenario 5: Outreach pack generation neutralizes star mandates & conditions -> NEUTRALIZED.
 * 6. Scenario 6: Customer list filtered by sentiment/satisfaction rating -> BLOCK.
 * 7. Scenario 7: NextBestAction REQUEST_REVIEW sanitized to neutral copy -> ALLOW / MODIFY.
 * 8. Scenario 8: Internal audit log records decision, ruleId, and timestamp -> AUDITED.
 * 9. Scenario 9: English & Spanish patterns detected with equal accuracy -> DETECTED.
 * 10. Scenario 10: Multi-channel compliance (WhatsApp, SMS, Email, Call Script) -> NEUTRAL.
 * 11. Scenario 11: Idempotency & Determinism (identical inputs yield identical results) -> DETERMINISTIC.
 * 12. Scenario 12: Zero Review Gating Guarantee on Reputation Shield -> ACCESSIBLE.
 * 13. Scenario 13: Edge cases with empty, malformed, or ambiguous messages -> SAFE FALLBACK.
 */

import { ReviewComplianceFirewall } from './reviewComplianceFirewall';
import { NextBestAction } from '../engine/actionEngine';

export async function runReviewComplianceTests(): Promise<{ passed: boolean; results: string[] }> {
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

  // Clear audit log before testing
  ReviewComplianceFirewall.clearAuditLog();

  // Test 1: Neutral request to all customers without condition -> ALLOW
  const neutralMsg = "Hola Carlos, muchas gracias por confiar en Fontanería Pro. ¿Nos compartirías tu opinión en Google? [Link]";
  const eval1 = ReviewComplianceFirewall.evaluateMessage(neutralMsg, 'es');
  assert(eval1.decision === 'ALLOW', 'Scenario 1: Neutral request allowed without condition');

  // Test 2: Request conditional on positive rating (Review Gating) -> BLOCK
  const gatingMsg = "Si quedaste 100% satisfecho déjanos una reseña en Google, si tuviste algún problema llámanos directamente.";
  const eval2 = ReviewComplianceFirewall.evaluateMessage(gatingMsg, 'es');
  assert(eval2.decision === 'BLOCK' && eval2.ruleId === 'RULE_NO_REVIEW_GATING', 'Scenario 2: Review gating blocked');

  // Test 3: Request with mandatory 5-star instruction -> BLOCK
  const starMandateMsg = "Please leave us a 5-star review on Google Maps to help our team!";
  const eval3 = ReviewComplianceFirewall.evaluateMessage(starMandateMsg, 'en');
  assert(eval3.decision === 'BLOCK' && eval3.ruleId === 'RULE_NO_STAR_MANDATE', 'Scenario 3: Star mandate blocked');

  // Test 4: Request with commercial/gift incentive -> BLOCK
  const incentiveMsg = "Déjanos una reseña en Google y recibe un 15% de descuento en tu próximo servicio.";
  const eval4 = ReviewComplianceFirewall.evaluateMessage(incentiveMsg, 'es');
  assert(eval4.decision === 'BLOCK' && eval4.ruleId === 'RULE_NO_RATING_INCENTIVE', 'Scenario 4: Incentive/gift request blocked');

  // Test 5: Outreach pack generation neutralizes star mandates & conditions
  const packEs = ReviewComplianceFirewall.neutralizeMessage('María', 'Climafast', 'AC Repair', 'Miami', 'es');
  const packEvalEs = ReviewComplianceFirewall.evaluateMessage(packEs.whatsapp, 'es');
  const packEn = ReviewComplianceFirewall.neutralizeMessage('John', 'Climafast', 'AC Repair', 'Miami', 'en');
  const packEvalEn = ReviewComplianceFirewall.evaluateMessage(packEn.whatsapp, 'en');
  assert(packEvalEs.decision === 'ALLOW' && packEvalEn.decision === 'ALLOW', 'Scenario 5: Neutralized outreach pack is 100% compliant in ES and EN');

  // Test 6: Customer list filtered by sentiment / satisfaction rating -> BLOCK
  const selectivePayload = {
    targetAudience: 'ONLY_SATISFIED_CUSTOMERS',
    channel: 'WHATSAPP',
    message: 'Help us with a review',
    filterByRating: '>= 4 stars'
  };
  const eval6 = ReviewComplianceFirewall.evaluateAudienceFilter(selectivePayload);
  assert(eval6.decision === 'BLOCK' && eval6.ruleId === 'RULE_NO_SENTIMENT_FILTERING', 'Scenario 6: Selective sentiment filtering blocked');

  // Test 7: NextBestAction REQUEST_REVIEW sanitized to neutral copy
  const mockAction: NextBestAction = {
    id: 'nba_test_won',
    action: 'Request 5-Star Review from Carlos',
    title: 'Request 5-Star Review from Carlos',
    priority: 'HIGH',
    priorityScore: 80,
    reason: 'Target 5 stars to reinforce Google Maps 3-Pack placement.',
    expectedBenefit: 'Outrank competitors with 5-star reviews',
    whyNow: 'Job completed successfully.',
    evidence: 'Invoice confirmed paid.',
    evidenceLevel: 'VERIFIED',
    confidence: 'HIGH',
    estimatedTime: '2 min',
    ctaLabel: 'Request Review',
    destinationCode: 'REQUEST_REVIEW',
    destination: { tab: 'reputation', subRow: 0, section: 'reputation' }
  };
  const actionEval = ReviewComplianceFirewall.evaluateAction(mockAction, 'en');
  assert(
    actionEval.decision === 'MODIFY' && 
    actionEval.action !== undefined &&
    actionEval.action !== null &&
    !actionEval.action.title?.includes('5-Star') &&
    !actionEval.action.reason.includes('5 stars'),
    'Scenario 7: NextBestAction automatically sanitized to neutral compliance'
  );

  // Test 8: Internal audit log records decision, ruleId, and timestamp
  const auditLogs = ReviewComplianceFirewall.getAuditLog();
  assert(
    auditLogs.length >= 4 &&
    auditLogs.some(log => log.primaryRuleId === 'RULE_NO_REVIEW_GATING') &&
    auditLogs.some(log => log.primaryRuleId === 'RULE_NO_STAR_MANDATE'),
    'Scenario 8: Audit log records violations with rule IDs and timestamps'
  );

  // Test 9: English & Spanish patterns detected with equal accuracy
  const esGating = ReviewComplianceFirewall.evaluateMessage("Solo califícanos si tu experiencia fue positiva", 'es');
  const enGating = ReviewComplianceFirewall.evaluateMessage("Only review us if you had a positive experience", 'en');
  assert(esGating.decision === 'BLOCK' && enGating.decision === 'BLOCK', 'Scenario 9: Bilingual compliance detection parity');

  // Test 10: Multi-channel compliance (WhatsApp, SMS, Email, Call Script)
  const channels = [packEs.whatsapp, packEs.sms, packEs.emailBody, packEs.callScript];
  const allChannelsValid = channels.every(c => ReviewComplianceFirewall.evaluateMessage(c, 'es').decision === 'ALLOW');
  assert(allChannelsValid, 'Scenario 10: All outreach channels (WhatsApp, SMS, Email, Call) are compliant');

  // Test 11: Idempotency & Determinism (identical inputs yield identical results)
  const eval11A = ReviewComplianceFirewall.evaluateMessage("Free gift for 5 star review", 'en');
  const eval11B = ReviewComplianceFirewall.evaluateMessage("Free gift for 5 star review", 'en');
  assert(
    eval11A.decision === eval11B.decision &&
    eval11A.ruleId === eval11B.ruleId,
    'Scenario 11: Firewall is strictly deterministic and idempotent'
  );

  // Test 12: Zero Review Gating Guarantee on Reputation Shield
  const isZeroGating = ReviewComplianceFirewall.isZeroGatingCompliant({
    allowsPublicReviewOnNegative: true,
    hasNoIntermediaryFilter: true
  });
  assert(isZeroGating, 'Scenario 12: Zero gating verified on public reputation workflows');

  // Test 13: Edge cases with empty, malformed, or ambiguous messages
  const emptyEval = ReviewComplianceFirewall.evaluateMessage("", 'es');
  const nullishEval = ReviewComplianceFirewall.evaluateMessage("   ", 'en');
  assert(emptyEval.decision === 'ALLOW' && nullishEval.decision === 'ALLOW', 'Scenario 13: Edge cases handled safely without runtime errors');

  return {
    passed: allPassed,
    results: logs
  };
}
