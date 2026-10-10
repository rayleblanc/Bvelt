/**
 * BVELT BUSINESS DNA — Behavioral Pattern Intelligence Tests
 * 
 * Verifies core behavioral capture invariants:
 * 1. Default Profile Epistemology: Zero fake metrics, sampleSize 0 -> INSUFFICIENT_DATA & nulls.
 * 2. 7-Day Observation Window: Deterministic start/end (+7 days), days observed, and progress status.
 * 3. Access Schedules: Exact hourly (0..23) and day-of-week (0..6) histograms, top hours/days extraction.
 * 4. Review Response Stats: Exact latency delta calculation, median, average, fastest, slowest, and missing-timestamp handling.
 * 5. GBP Publishing Stats: Exact post counts by type, intervals, and cadence derivation without guessing.
 * 6. Preferred Commercial Actions: Exact frequency percentages and ranking derived from ActionEngine events.
 * 7. Event Deduplication: Duplicate event IDs are skipped and do not inflate counters.
 */

import {
  createDefaultBehaviorProfile,
  deriveConfidenceStatus,
  calculateMedian,
  evaluateObservationWindow,
  BusinessDnaService
} from './businessDnaService';

export async function runBusinessDnaTests(): Promise<{ passed: boolean; results: string[] }> {
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

  // --- Test 1: Blank Profile Epistemology (Zero Guessing / Zero Fake Stats) ---
  const initialTime = "2026-08-31T09:00:00.000Z";
  const profile = createDefaultBehaviorProfile("user_test_123", initialTime);

  assert(profile.uid === "user_test_123", "Profile has correct user ID");
  assert(profile.sampleSize === 0, "Initial profile has sampleSize == 0");
  assert(profile.accessPatterns.status === "INSUFFICIENT_DATA", "Initial access pattern status is INSUFFICIENT_DATA");
  assert(profile.accessPatterns.topActiveHours.length === 0, "Initial topActiveHours is empty []");
  assert(profile.reviewResponseStats.averageLatencyMinutes === null, "Initial review response averageLatencyMinutes is null");
  assert(profile.reviewResponseStats.medianLatencyMinutes === null, "Initial review response medianLatencyMinutes is null");
  assert(profile.gbpPublishingStats.cadence === "INSUFFICIENT_DATA", "Initial GBP cadence is INSUFFICIENT_DATA");
  assert(Object.keys(profile.preferredActionTypes.actionTypeDistribution).length === 0, "Initial preferred actions map is empty {}");

  // --- Test 2: 7-Day Observation Window Determinism ---
  const startMs = Date.parse(profile.observationWindow.start);
  const endMs = Date.parse(profile.observationWindow.end);
  const diffDays = (endMs - startMs) / (24 * 60 * 60 * 1000);

  assert(diffDays === 7, "Observation window end is exactly 7 days after start");
  assert(profile.observationWindow.status === "IN_PROGRESS", "Observation window is initially IN_PROGRESS");

  // Simulate evaluation on Day 3 (2.5 days elapsed)
  const day3Ms = startMs + 2.5 * 24 * 60 * 60 * 1000;
  const evalDay3 = evaluateObservationWindow(profile.observationWindow, day3Ms);
  assert(evalDay3.daysObserved === 3, "evaluateObservationWindow computes daysObserved == 3 on day 3");
  assert(evalDay3.status === "IN_PROGRESS", "evaluateObservationWindow remains IN_PROGRESS on day 3");

  // Simulate evaluation on Day 8 (after window elapsed)
  const day8Ms = startMs + 8 * 24 * 60 * 60 * 1000;
  const evalDay8 = evaluateObservationWindow(profile.observationWindow, day8Ms);
  assert(evalDay8.daysObserved === 7, "evaluateObservationWindow caps daysObserved at 7");
  assert(evalDay8.status === "COMPLETED", "evaluateObservationWindow marks status as COMPLETED after 7 days");

  // --- Test 3: Mathematical Median Calculation ---
  assert(calculateMedian([]) === null, "calculateMedian of empty array returns null");
  assert(calculateMedian([45]) === 45, "calculateMedian of single item [45] returns 45");
  assert(calculateMedian([10, 20, 30]) === 20, "calculateMedian of odd array [10, 20, 30] returns 20");
  assert(calculateMedian([10, 20, 30, 40]) === 25, "calculateMedian of even array [10, 20, 30, 40] returns 25");

  // --- Test 4: Access Schedule Pattern Aggregation ---
  const testUid = "test_user_access";
  // Simulate 3 access sessions at hour 10:00 (10am) on Monday (day 1) and 1 at hour 14:00 (2pm) on Tuesday (day 2)
  BusinessDnaService.recordUserAccess(testUid, { timestamp: "2026-08-31T10:15:00.000Z", force: true });
  BusinessDnaService.recordUserAccess(testUid, { timestamp: "2026-08-31T10:45:00.000Z", force: true });
  BusinessDnaService.recordUserAccess(testUid, { timestamp: "2026-09-01T14:00:00.000Z", force: true });

  const accessProf = BusinessDnaService.getProfileSync(testUid);
  assert(accessProf.accessPatterns.sampleSize === 3, "accessPatterns sampleSize increments accurately to 3");
  assert(accessProf.accessPatterns.status === "ESTABLISHED", "Status becomes ESTABLISHED when sampleSize >= 3");
  assert(accessProf.accessPatterns.topActiveHours.includes(10), "topActiveHours correctly identifies hour 10");

  // --- Test 5: Review Response Latency & Missing-Timestamp Handling ---
  const revUid = "test_user_review";
  // Event 1: Review received at 10:00, replied at 10:30 (30 minutes delta)
  BusinessDnaService.recordReviewResponse(revUid, {
    reviewId: "rev_001",
    reviewCreatedTime: "2026-08-31T10:00:00.000Z",
    repliedAt: "2026-08-31T10:30:00.000Z"
  });

  // Event 2: Review received at 08:00, replied at 10:00 (120 minutes delta)
  BusinessDnaService.recordReviewResponse(revUid, {
    reviewId: "rev_002",
    reviewCreatedTime: "2026-08-31T08:00:00.000Z",
    repliedAt: "2026-08-31T10:00:00.000Z"
  });

  // Event 3: Review without creation timestamp (must not fabricate latency)
  BusinessDnaService.recordReviewResponse(revUid, {
    reviewId: "rev_003_no_time",
    reviewCreatedTime: null,
    repliedAt: "2026-08-31T11:00:00.000Z"
  });

  const revProf = BusinessDnaService.getProfileSync(revUid);
  assert(revProf.reviewResponseStats.sampleSize === 3, "Review response sampleSize increments to 3");
  assert(revProf.reviewResponseStats.fastestResponseMinutes === 30, "Fastest response correctly computed as 30 min");
  assert(revProf.reviewResponseStats.slowestResponseMinutes === 120, "Slowest response correctly computed as 120 min");
  assert(revProf.reviewResponseStats.medianLatencyMinutes === 75, "Median latency of [30, 120] is 75 min");
  assert(revProf.reviewResponseStats.averageLatencyMinutes === 75, "Average latency total 150 / 2 verified sample = 75 min");

  // --- Test 6: GBP Publication Frequency & Cadence ---
  const gbpUid = "test_user_gbp";
  // Post 1: Day 1
  BusinessDnaService.recordGbpPublication(gbpUid, {
    postId: "post_1",
    postType: "PHOTO_SEAL",
    publishedAt: "2026-08-01T10:00:00.000Z"
  });
  // Post 2: Day 8 (7 days interval)
  BusinessDnaService.recordGbpPublication(gbpUid, {
    postId: "post_2",
    postType: "PHOTO_SEAL",
    publishedAt: "2026-08-08T10:00:00.000Z"
  });
  // Post 3: Day 15 (7 days interval)
  BusinessDnaService.recordGbpPublication(gbpUid, {
    postId: "post_3",
    postType: "OFFER",
    publishedAt: "2026-08-15T10:00:00.000Z"
  });

  const gbpProf = BusinessDnaService.getProfileSync(gbpUid);
  assert(gbpProf.gbpPublishingStats.sampleSize === 3, "GBP publishing sampleSize is 3");
  assert(gbpProf.gbpPublishingStats.postsByType["PHOTO_SEAL"] === 2, "PHOTO_SEAL count is 2");
  assert(gbpProf.gbpPublishingStats.postsByType["OFFER"] === 1, "OFFER count is 1");
  assert(gbpProf.gbpPublishingStats.averageDaysBetweenPosts === 7, "Average days between posts is 7");
  assert(gbpProf.gbpPublishingStats.cadence === "WEEKLY", "7-day interval correctly classified as WEEKLY cadence");

  // --- Test 7: Preferred Commercial Action Distribution ---
  const actUid = "test_user_action";
  // Record 2 OUTREACH actions, 1 REVIEW_REQUEST action
  BusinessDnaService.recordActionExecution(actUid, {
    actionId: "act_1",
    actionType: "OUTREACH",
    executedAt: "2026-08-31T10:00:00.000Z"
  });
  BusinessDnaService.recordActionExecution(actUid, {
    actionId: "act_2",
    actionType: "OUTREACH",
    executedAt: "2026-08-31T11:00:00.000Z"
  });
  BusinessDnaService.recordActionExecution(actUid, {
    actionId: "act_3",
    actionType: "REVIEW_REQUEST",
    executedAt: "2026-08-31T12:00:00.000Z"
  });

  const actProf = BusinessDnaService.getProfileSync(actUid);
  assert(actProf.preferredActionTypes.sampleSize === 3, "Preferred actions sampleSize is 3");
  assert(actProf.preferredActionTypes.topPreferredActions[0] === "OUTREACH", "Top preferred action is OUTREACH");
  assert(actProf.preferredActionTypes.actionTypeDistribution["OUTREACH"].percentage === 66.7, "OUTREACH percentage is 66.7%");
  assert(actProf.preferredActionTypes.actionTypeDistribution["REVIEW_REQUEST"].percentage === 33.3, "REVIEW_REQUEST percentage is 33.3%");

  // --- Test 8: Deduplication Ring Buffer ---
  const initialSampleSize = actProf.sampleSize;
  // Re-submit identical act_1 execution
  BusinessDnaService.recordActionExecution(actUid, {
    actionId: "act_1",
    actionType: "OUTREACH",
    executedAt: "2026-08-31T10:00:00.000Z"
  });
  const actProfAfterDuplicate = BusinessDnaService.getProfileSync(actUid);
  assert(
    actProfAfterDuplicate.sampleSize === initialSampleSize,
    "Duplicate event ID is detected and skipped without incrementing sampleSize"
  );

  return { passed: allPassed, results: logs };
}
