/**
 * BVELT BUSINESS DNA — Behavioral Pattern Types & Observational Models
 * 
 * Captures passive behavior patterns during onboarding and the first 7-day observation window:
 * 1. Access Schedule / Temporal Presence Patterns
 * 2. Customer Review Response Latencies & Stats
 * 3. Google Business Profile (GBP) Publishing Frequencies & Types
 * 4. Preferred Commercial Action Types (from ActionEngine / BusinessMemory)
 * 
 * Epistemological Rules:
 * - Deterministic aggregation ONLY (No AI hallucination/guessing).
 * - Zero fake default metrics: If data is missing -> INSUFFICIENT_DATA / sampleSize: 0 / null.
 * - Single isolated profile per authenticated user: "user_behavior_profile/{uid}".
 */

export type BehaviorConfidenceStatus = 'INSUFFICIENT_DATA' | 'EMERGING_PATTERN' | 'ESTABLISHED';

export interface ObservationWindow {
  /** ISO timestamp when the observation began (onboarding / first session) */
  start: string;
  /** ISO timestamp exactly 7 days after observation start */
  end: string;
  /** Whether the 7-day observation window is actively in progress or completed */
  status: 'IN_PROGRESS' | 'COMPLETED';
  /** Number of unique calendar days observed within the window (1 to 7) */
  daysObserved: number;
  /** Total count of discrete business events recorded */
  totalEventsRecorded: number;
}

export interface AccessSchedulePatterns {
  sampleSize: number;
  /** Histogram of access frequencies by hour of day (0..23) */
  hourlyDistribution: Record<number, number>;
  /** Histogram of access frequencies by day of week (0..6, where 0=Sunday, 1=Monday... 6=Saturday) */
  dayOfWeekDistribution: Record<number, number>;
  /** Array of hours with the highest access frequency (e.g. [9, 14, 18]) */
  topActiveHours: number[];
  /** Array of day-of-week indexes with highest access frequency */
  topActiveDays: number[];
  /** Confidence classification based on sample size */
  status: BehaviorConfidenceStatus;
  /** ISO timestamp of most recent access session */
  lastAccessAt: string | null;
}

export interface ReviewResponseBehaviorStats {
  sampleSize: number;
  /** Total accumulated response latency in minutes across observed reviews */
  totalLatencyMinutes: number;
  /** Mean response time in minutes (null if sampleSize == 0) */
  averageLatencyMinutes: number | null;
  /** Median response time in minutes (null if sampleSize == 0) */
  medianLatencyMinutes: number | null;
  /** Shortest verified response time in minutes */
  fastestResponseMinutes: number | null;
  /** Longest verified response time in minutes */
  slowestResponseMinutes: number | null;
  /** Evidence reliability based on real verified review interactions */
  evidenceLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  /** Confidence classification */
  status: BehaviorConfidenceStatus;
  /** ISO timestamp of the last review response */
  lastResponseAt: string | null;
  /** Bounded sliding window of raw latencies (max 20) for accurate median calculation */
  recentLatencies?: number[];
}

export interface GbpPublishingBehaviorStats {
  sampleSize: number;
  /** Count of publications indexed by post category (e.g. PHOTO_SEAL, OFFER, UPDATE) */
  postsByType: Record<string, number>;
  /** Cadence classification derived from average interval between real publications */
  cadence: 'INSUFFICIENT_DATA' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'IRREGULAR';
  /** Average days elapsed between consecutive publications */
  averageDaysBetweenPosts: number | null;
  /** Confidence status */
  status: BehaviorConfidenceStatus;
  /** ISO timestamp of most recent publication */
  lastPublishedAt: string | null;
  /** Bounded sliding window of timestamps (max 10) for interval delta derivation */
  recentPublishTimestamps?: string[];
}

export interface PreferredActionTypesStats {
  sampleSize: number;
  /** Relative distribution and count per commercial action type */
  actionTypeDistribution: Record<string, { count: number; percentage: number }>;
  /** Top action types sorted by frequency */
  topPreferredActions: string[];
  /** Confidence classification */
  status: BehaviorConfidenceStatus;
  /** ISO timestamp of most recent action executed */
  lastActionAt: string | null;
}

export interface UserBehaviorProfile {
  /** Authenticated user ID */
  uid: string;
  /** ISO timestamp when the user profile was initialized */
  firstSeenAt: string;
  /** ISO timestamp of most recent event/access */
  lastSeenAt: string;
  /** ISO timestamp of last profile calculation */
  updatedAt: string;
  /** 7-day observation window metadata */
  observationWindow: ObservationWindow;
  /** 1. Access schedule and temporal presence */
  accessPatterns: AccessSchedulePatterns;
  /** 2. Customer review response speed & metrics */
  reviewResponseStats: ReviewResponseBehaviorStats;
  /** 3. Google Business Profile publishing cadence */
  gbpPublishingStats: GbpPublishingBehaviorStats;
  /** 4. Preferred commercial actions */
  preferredActionTypes: PreferredActionTypesStats;
  /** Total events across all dimensions */
  sampleSize: number;
  /** Deduplication ring buffer of recent event IDs (max 50) */
  recentProcessedEventIds: string[];
  /** Quiet Learning: Scan summary metadata */
  lastScanAt?: string | null;
  lastScanStatus?: 'ok' | 'sparse' | 'failed';
  lastScanCompetitorsCount?: number;
  /** Versioning */
  schemaVersion: number;
}
