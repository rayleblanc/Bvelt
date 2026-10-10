/**
 * BVELT BUSINESS DNA — Behavioral Pattern Intelligence Service
 * 
 * Passively aggregates real user actions during onboarding and the 7-day observation window:
 * - Access Schedules (hour/day distributions)
 * - Review Response Times (actual verified delta)
 * - GBP Publication Cadence (real posts)
 * - Preferred Commercial Action Categories (ActionEngine integration)
 * 
 * Epistemological Grounding:
 * - Zero fabricated metrics.
 * - Strict determinism (averages, medians, histograms).
 * - Coalesced debounced writes to "user_behavior_profile/{uid}".
 * - In-memory L1 + LocalStorage L2 + Firestore L3 storage.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import {
  UserBehaviorProfile,
  ObservationWindow,
  AccessSchedulePatterns,
  ReviewResponseBehaviorStats,
  GbpPublishingBehaviorStats,
  PreferredActionTypesStats,
  BehaviorConfidenceStatus
} from './businessDnaTypes';

const STORAGE_PREFIX = 'bvelt_user_behavior_profile_';
const MAX_DEDUPE_ENTRIES = 50;
const MAX_LATENCY_HISTORY = 20;
const MAX_PUBLISH_HISTORY = 10;
const OBSERVATION_WINDOW_DAYS = 7;
const OBSERVATION_WINDOW_MS = OBSERVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const DEBOUNCE_FLUSH_MS = 2000;

// L1 In-Memory Cache
const BEHAVIOR_PROFILES_L1 = new Map<string, UserBehaviorProfile>();

// Debounce timer map for coalesced Firestore writes
const PENDING_FLUSH_TIMERS = new Map<string, any>();

// In-memory session access debounce tracker to avoid recording access on every React render
const RECENT_ACCESS_SESSIONS = new Map<string, number>();
let hasWarnedBusinessDna = false;

/**
 * Initializes a blank, epistemologically honest UserBehaviorProfile with 0 sample size.
 */
export function createDefaultBehaviorProfile(uid: string, initialTimestamp?: string): UserBehaviorProfile {
  const start = initialTimestamp || new Date().toISOString();
  const startTimeMs = Date.parse(start);
  const end = new Date(startTimeMs + OBSERVATION_WINDOW_MS).toISOString();

  const hourlyDistribution: Record<number, number> = {};
  for (let i = 0; i < 24; i++) hourlyDistribution[i] = 0;

  const dayOfWeekDistribution: Record<number, number> = {};
  for (let i = 0; i < 7; i++) dayOfWeekDistribution[i] = 0;

  const observationWindow: ObservationWindow = {
    start,
    end,
    status: 'IN_PROGRESS',
    daysObserved: 1,
    totalEventsRecorded: 0
  };

  const accessPatterns: AccessSchedulePatterns = {
    sampleSize: 0,
    hourlyDistribution,
    dayOfWeekDistribution,
    topActiveHours: [],
    topActiveDays: [],
    status: 'INSUFFICIENT_DATA',
    lastAccessAt: null
  };

  const reviewResponseStats: ReviewResponseBehaviorStats = {
    sampleSize: 0,
    totalLatencyMinutes: 0,
    averageLatencyMinutes: null,
    medianLatencyMinutes: null,
    fastestResponseMinutes: null,
    slowestResponseMinutes: null,
    evidenceLevel: 'NONE',
    status: 'INSUFFICIENT_DATA',
    lastResponseAt: null,
    recentLatencies: []
  };

  const gbpPublishingStats: GbpPublishingBehaviorStats = {
    sampleSize: 0,
    postsByType: {},
    cadence: 'INSUFFICIENT_DATA',
    averageDaysBetweenPosts: null,
    status: 'INSUFFICIENT_DATA',
    lastPublishedAt: null,
    recentPublishTimestamps: []
  };

  const preferredActionTypes: PreferredActionTypesStats = {
    sampleSize: 0,
    actionTypeDistribution: {},
    topPreferredActions: [],
    status: 'INSUFFICIENT_DATA',
    lastActionAt: null
  };

  return {
    uid,
    firstSeenAt: start,
    lastSeenAt: start,
    updatedAt: start,
    observationWindow,
    accessPatterns,
    reviewResponseStats,
    gbpPublishingStats,
    preferredActionTypes,
    sampleSize: 0,
    recentProcessedEventIds: [],
    schemaVersion: 1
  };
}

/**
 * Derives statistical confidence status based on sample size.
 */
export function deriveConfidenceStatus(sampleSize: number): BehaviorConfidenceStatus {
  if (sampleSize <= 0) return 'INSUFFICIENT_DATA';
  if (sampleSize < 3) return 'EMERGING_PATTERN';
  return 'ESTABLISHED';
}

/**
 * Calculates median value deterministically from an array of numbers.
 */
export function calculateMedian(numbers: number[]): number | null {
  if (!numbers || numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return Math.round(sorted[mid] * 10) / 10;
}

/**
 * Evaluates the 7-day observation window progress deterministically.
 */
export function evaluateObservationWindow(window: ObservationWindow, nowMs: number): ObservationWindow {
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  const diffDays = Math.min(
    OBSERVATION_WINDOW_DAYS,
    Math.max(1, Math.ceil((nowMs - startMs) / (24 * 60 * 60 * 1000)))
  );

  return {
    ...window,
    daysObserved: diffDays,
    status: nowMs >= endMs ? 'COMPLETED' : 'IN_PROGRESS'
  };
}

export class BusinessDnaService {
  /**
   * Loads the current behavior profile from L1 Memory -> L2 LocalStorage -> L3 Firestore.
   */
  static async getProfile(uid: string): Promise<UserBehaviorProfile> {
    if (!uid) {
      return createDefaultBehaviorProfile('anonymous');
    }

    // 1. Check L1 Memory Cache
    if (BEHAVIOR_PROFILES_L1.has(uid)) {
      return BEHAVIOR_PROFILES_L1.get(uid)!;
    }

    // 2. Check L2 LocalStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
        if (raw) {
          const parsed: UserBehaviorProfile = JSON.parse(raw);
          BEHAVIOR_PROFILES_L1.set(uid, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('[BusinessDNA] Failed to read L2 cache:', e);
      }
    }

    // 3. Fallback to L3 Firestore Point Read
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'user_behavior_profile', uid));
        if (snap.exists()) {
          const remote = snap.data() as UserBehaviorProfile;
          BEHAVIOR_PROFILES_L1.set(uid, remote);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(remote));
            } catch {}
          }
          return remote;
        }
      } catch (e) {
        if (!hasWarnedBusinessDna) {
          hasWarnedBusinessDna = true;
          console.warn('[BusinessDNA] Firestore point read skipped/failed (local fallback active):', e);
        }
      }
    }

    // 4. Initialize clean default profile
    const fresh = createDefaultBehaviorProfile(uid);
    BEHAVIOR_PROFILES_L1.set(uid, fresh);
    this.saveProfile(fresh);
    return fresh;
  }

  /**
   * Synchronously retrieves current profile from L1 / L2 without awaiting Firestore.
   */
  static getProfileSync(uid: string): UserBehaviorProfile {
    if (!uid) return createDefaultBehaviorProfile('anonymous');
    if (BEHAVIOR_PROFILES_L1.has(uid)) {
      return BEHAVIOR_PROFILES_L1.get(uid)!;
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          BEHAVIOR_PROFILES_L1.set(uid, parsed);
          return parsed;
        }
      } catch {}
    }
    const fresh = createDefaultBehaviorProfile(uid);
    BEHAVIOR_PROFILES_L1.set(uid, fresh);
    return fresh;
  }

  /**
   * Saves profile to L1 Memory + L2 LocalStorage immediately, and queues a debounced L3 Firestore write.
   */
  static saveProfile(profile: UserBehaviorProfile, immediate = false): void {
    if (!profile || !profile.uid) return;

    profile.updatedAt = new Date().toISOString();
    BEHAVIOR_PROFILES_L1.set(profile.uid, profile);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${profile.uid}`, JSON.stringify(profile));
      } catch (e) {
        console.warn('[BusinessDNA] Failed to write L2 cache:', e);
      }
    }

    // Queue Debounced Firestore write to control costs
    if (immediate) {
      this.flushToFirestore(profile.uid);
    } else {
      if (PENDING_FLUSH_TIMERS.has(profile.uid)) {
        clearTimeout(PENDING_FLUSH_TIMERS.get(profile.uid));
      }
      const timer = setTimeout(() => {
        this.flushToFirestore(profile.uid);
        PENDING_FLUSH_TIMERS.delete(profile.uid);
      }, DEBOUNCE_FLUSH_MS);
      PENDING_FLUSH_TIMERS.set(profile.uid, timer);
    }
  }

  /**
   * Flushes current in-memory profile to Firestore Option C document model.
   */
  static async flushToFirestore(uid: string): Promise<void> {
    const profile = BEHAVIOR_PROFILES_L1.get(uid);
    if (!profile || !db) return;

    // Only write if authenticated user matches profile uid
    const currentUser = auth?.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      return;
    }

    try {
      await setDoc(doc(db, 'user_behavior_profile', uid), profile, { merge: true });
    } catch (e) {
      if (!hasWarnedBusinessDna) {
        hasWarnedBusinessDna = true;
        console.warn('[BusinessDNA] Firestore write coalescing note (local memory preserved):', e);
      }
    }
  }

  /**
   * 1. ACCESS SCHEDULES & PRESENCE
   * Passive capture on session load. Throttled to at most 1 access recording per 15 minutes per session.
   */
  static recordUserAccess(uid: string, options?: { timestamp?: string; force?: boolean }): UserBehaviorProfile {
    const nowIso = options?.timestamp || new Date().toISOString();
    const nowMs = Date.parse(nowIso);
    const lastSessionTime = RECENT_ACCESS_SESSIONS.get(uid) || 0;

    // Throttle duplicate renders within 15 minutes unless forced
    if (!options?.force && nowMs - lastSessionTime < 15 * 60 * 1000) {
      return this.getProfileSync(uid);
    }
    RECENT_ACCESS_SESSIONS.set(uid, nowMs);

    const profile = this.getProfileSync(uid);
    const dateObj = new Date(nowMs);
    const hour = dateObj.getHours();
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon...

    const eventId = `ev_access_${dateObj.toISOString().slice(0, 16)}`;
    if (profile.recentProcessedEventIds.includes(eventId)) {
      return profile;
    }

    // Update hourly & day-of-week histograms
    const newHourly = { ...profile.accessPatterns.hourlyDistribution };
    newHourly[hour] = (newHourly[hour] || 0) + 1;

    const newDayOfWeek = { ...profile.accessPatterns.dayOfWeekDistribution };
    newDayOfWeek[dayOfWeek] = (newDayOfWeek[dayOfWeek] || 0) + 1;

    const sampleSize = profile.accessPatterns.sampleSize + 1;

    // Derive top active hours
    const topActiveHours = Object.entries(newHourly)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => Number(h));

    // Derive top active days
    const topActiveDays = Object.entries(newDayOfWeek)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => Number(d));

    profile.accessPatterns = {
      sampleSize,
      hourlyDistribution: newHourly,
      dayOfWeekDistribution: newDayOfWeek,
      topActiveHours,
      topActiveDays,
      status: deriveConfidenceStatus(sampleSize),
      lastAccessAt: nowIso
    };

    profile.lastSeenAt = nowIso;
    profile.sampleSize += 1;
    profile.observationWindow = evaluateObservationWindow(
      {
        ...profile.observationWindow,
        totalEventsRecorded: profile.observationWindow.totalEventsRecorded + 1
      },
      nowMs
    );

    this.appendDedupeId(profile, eventId);
    this.saveProfile(profile);
    return profile;
  }

  /**
   * 2. REVIEW RESPONSE SPEED
   * Captures actual time delta when user responds to a review.
   * If either timestamp is missing, does NOT fabricate latency.
   */
  static recordReviewResponse(
    uid: string,
    params: {
      reviewId: string;
      reviewCreatedTime: string | null | undefined;
      repliedAt?: string;
    }
  ): UserBehaviorProfile {
    const profile = this.getProfileSync(uid);
    const repliedAtIso = params.repliedAt || new Date().toISOString();
    const repliedAtMs = Date.parse(repliedAtIso);
    const eventId = `ev_rev_${params.reviewId}_${repliedAtIso.slice(0, 16)}`;

    if (profile.recentProcessedEventIds.includes(eventId)) {
      return profile;
    }

    let calculatedLatencyMinutes: number | null = null;
    if (params.reviewCreatedTime) {
      const reviewCreatedMs = Date.parse(params.reviewCreatedTime);
      if (!isNaN(reviewCreatedMs) && repliedAtMs >= reviewCreatedMs) {
        calculatedLatencyMinutes = Math.max(0, Math.round(((repliedAtMs - reviewCreatedMs) / (60 * 1000)) * 10) / 10);
      }
    }

    const currentStats = profile.reviewResponseStats;
    const newSampleSize = currentStats.sampleSize + 1;

    let updatedRecentLatencies = [...(currentStats.recentLatencies || [])];
    let totalLatency = currentStats.totalLatencyMinutes;
    let avgLatency = currentStats.averageLatencyMinutes;
    let medianLatency = currentStats.medianLatencyMinutes;
    let fastest = currentStats.fastestResponseMinutes;
    let slowest = currentStats.slowestResponseMinutes;

    if (calculatedLatencyMinutes !== null) {
      updatedRecentLatencies.push(calculatedLatencyMinutes);
      if (updatedRecentLatencies.length > MAX_LATENCY_HISTORY) {
        updatedRecentLatencies.shift();
      }

      totalLatency += calculatedLatencyMinutes;
      avgLatency = Math.round((totalLatency / updatedRecentLatencies.length) * 10) / 10;
      medianLatency = calculateMedian(updatedRecentLatencies);
      fastest = fastest === null ? calculatedLatencyMinutes : Math.min(fastest, calculatedLatencyMinutes);
      slowest = slowest === null ? calculatedLatencyMinutes : Math.max(slowest, calculatedLatencyMinutes);
    }

    const evidenceLevel =
      newSampleSize >= 5 ? 'HIGH' : newSampleSize >= 3 ? 'MEDIUM' : newSampleSize >= 1 ? 'LOW' : 'NONE';

    profile.reviewResponseStats = {
      sampleSize: newSampleSize,
      totalLatencyMinutes: totalLatency,
      averageLatencyMinutes: avgLatency,
      medianLatencyMinutes: medianLatency,
      fastestResponseMinutes: fastest,
      slowestResponseMinutes: slowest,
      evidenceLevel,
      status: deriveConfidenceStatus(newSampleSize),
      lastResponseAt: repliedAtIso,
      recentLatencies: updatedRecentLatencies
    };

    profile.lastSeenAt = repliedAtIso;
    profile.sampleSize += 1;
    profile.observationWindow = evaluateObservationWindow(
      {
        ...profile.observationWindow,
        totalEventsRecorded: profile.observationWindow.totalEventsRecorded + 1
      },
      repliedAtMs
    );

    this.appendDedupeId(profile, eventId);
    this.saveProfile(profile);
    return profile;
  }

  /**
   * 3. GOOGLE BUSINESS PROFILE (GBP) PUBLISHING STATS
   * Registers verified publication event and updates cadence intervals.
   */
  static recordGbpPublication(
    uid: string,
    params: {
      postId?: string;
      postType: string;
      publishedAt?: string;
    }
  ): UserBehaviorProfile {
    const profile = this.getProfileSync(uid);
    const publishedAtIso = params.publishedAt || new Date().toISOString();
    const publishedAtMs = Date.parse(publishedAtIso);
    const postType = params.postType || 'STANDARD_POST';
    const eventId = `ev_gbp_${params.postId || postType}_${publishedAtIso.slice(0, 16)}`;

    if (profile.recentProcessedEventIds.includes(eventId)) {
      return profile;
    }

    const currentStats = profile.gbpPublishingStats;
    const newSampleSize = currentStats.sampleSize + 1;

    const postsByType = { ...currentStats.postsByType };
    postsByType[postType] = (postsByType[postType] || 0) + 1;

    const recentPublishTimestamps = [...(currentStats.recentPublishTimestamps || []), publishedAtIso].slice(
      -MAX_PUBLISH_HISTORY
    );

    let cadence: GbpPublishingBehaviorStats['cadence'] = 'INSUFFICIENT_DATA';
    let averageDaysBetweenPosts: number | null = null;

    if (recentPublishTimestamps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < recentPublishTimestamps.length; i++) {
        const prev = Date.parse(recentPublishTimestamps[i - 1]);
        const curr = Date.parse(recentPublishTimestamps[i]);
        const diffDays = Math.max(0, (curr - prev) / (24 * 60 * 60 * 1000));
        intervals.push(diffDays);
      }
      const sum = intervals.reduce((a, b) => a + b, 0);
      averageDaysBetweenPosts = Math.round((sum / intervals.length) * 10) / 10;

      if (averageDaysBetweenPosts <= 1.5) cadence = 'DAILY';
      else if (averageDaysBetweenPosts <= 8) cadence = 'WEEKLY';
      else if (averageDaysBetweenPosts <= 16) cadence = 'BIWEEKLY';
      else if (averageDaysBetweenPosts <= 35) cadence = 'MONTHLY';
      else cadence = 'IRREGULAR';
    }

    profile.gbpPublishingStats = {
      sampleSize: newSampleSize,
      postsByType,
      cadence,
      averageDaysBetweenPosts,
      status: deriveConfidenceStatus(newSampleSize),
      lastPublishedAt: publishedAtIso,
      recentPublishTimestamps
    };

    profile.lastSeenAt = publishedAtIso;
    profile.sampleSize += 1;
    profile.observationWindow = evaluateObservationWindow(
      {
        ...profile.observationWindow,
        totalEventsRecorded: profile.observationWindow.totalEventsRecorded + 1
      },
      publishedAtMs
    );

    this.appendDedupeId(profile, eventId);
    this.saveProfile(profile);
    return profile;
  }

  /**
   * 4. PREFERRED COMMERCIAL ACTION TYPES (ActionEngine Integration)
   * Captures commercial actions executed to derive preferred categories.
   */
  static recordActionExecution(
    uid: string,
    params: {
      actionId?: string;
      actionType: string;
      destination?: string;
      executedAt?: string;
    }
  ): UserBehaviorProfile {
    const profile = this.getProfileSync(uid);
    const executedAtIso = params.executedAt || new Date().toISOString();
    const executedAtMs = Date.parse(executedAtIso);
    const actionKey = params.actionType || params.destination || 'COMMERCIAL_ACTION';
    const eventId = `ev_act_${params.actionId || actionKey}_${executedAtIso.slice(0, 16)}`;

    if (profile.recentProcessedEventIds.includes(eventId)) {
      return profile;
    }

    const currentStats = profile.preferredActionTypes;
    const newSampleSize = currentStats.sampleSize + 1;

    // Increment count for this action type
    const rawCounts: Record<string, number> = {};
    for (const [key, val] of Object.entries(currentStats.actionTypeDistribution)) {
      rawCounts[key] = val.count;
    }
    rawCounts[actionKey] = (rawCounts[actionKey] || 0) + 1;

    // Recalculate percentage distributions
    const actionTypeDistribution: Record<string, { count: number; percentage: number }> = {};
    for (const [key, count] of Object.entries(rawCounts)) {
      actionTypeDistribution[key] = {
        count,
        percentage: Math.round((count / newSampleSize) * 1000) / 10 // e.g. 33.3%
      };
    }

    // Sort top preferred actions by frequency
    const topPreferredActions = Object.entries(actionTypeDistribution)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([key]) => key);

    profile.preferredActionTypes = {
      sampleSize: newSampleSize,
      actionTypeDistribution,
      topPreferredActions,
      status: deriveConfidenceStatus(newSampleSize),
      lastActionAt: executedAtIso
    };

    profile.lastSeenAt = executedAtIso;
    profile.sampleSize += 1;
    profile.observationWindow = evaluateObservationWindow(
      {
        ...profile.observationWindow,
        totalEventsRecorded: profile.observationWindow.totalEventsRecorded + 1
      },
      executedAtMs
    );

    this.appendDedupeId(profile, eventId);
    this.saveProfile(profile);
    return profile;
  }

  /**
   * QUIET LEARNING: Records normalized scan summary into memory structure.
   * Failures are caught silently and never block UI.
   */
  static recordScanSummary(
    uid: string,
    summary: {
      status: 'ok' | 'sparse' | 'failed';
      competitorsCount: number;
      radiusKm: number;
      trade?: string;
      timestamp?: string;
    }
  ): UserBehaviorProfile | null {
    try {
      const profile = this.getProfileSync(uid);
      const iso = summary.timestamp || new Date().toISOString();
      const eventId = `ev_scan_${summary.radiusKm}k_${iso.slice(0, 16)}`;

      if (profile.recentProcessedEventIds?.includes(eventId)) {
        return profile;
      }

      profile.lastScanAt = iso;
      profile.lastScanStatus = summary.status;
      profile.lastScanCompetitorsCount = summary.competitorsCount;
      profile.sampleSize = (profile.sampleSize || 0) + 1;

      this.appendDedupeId(profile, eventId);
      this.saveProfile(profile);
      return profile;
    } catch (e) {
      console.warn('[BusinessDNA Quiet Learning] Scan summary skipped:', e);
      return null;
    }
  }

  /**
   * Helper to maintain bounded deduplication ring buffer.
   */
  private static appendDedupeId(profile: UserBehaviorProfile, eventId: string): void {
    if (!profile.recentProcessedEventIds) {
      profile.recentProcessedEventIds = [];
    }
    profile.recentProcessedEventIds.push(eventId);
    if (profile.recentProcessedEventIds.length > MAX_DEDUPE_ENTRIES) {
      profile.recentProcessedEventIds = profile.recentProcessedEventIds.slice(-MAX_DEDUPE_ENTRIES);
    }
  }
}
