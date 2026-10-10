/**
 * BVELT OBSERVABILITY & USAGE SAFETY
 * Zero-cost telemetry and Firestore usage tracking for 50-customer efficiency.
 * - Records customer value milestone events in memory & local ring buffer.
 * - Tracks Firestore query counts and detects high-frequency/redundant queries.
 * - Zero external API costs, zero PII, zero database writes.
 */

export type BveltEventName =
  | 'analysis_started'
  | 'analysis_completed'
  | 'first_insight_viewed'
  | 'action_started'
  | 'action_completed'
  | 'pricing_viewed'
  | 'upgrade_clicked'
  | 'free_market_check'
  | 'trial_activated'
  | 'first_value'
  | 'first_next_action'
  | 'first_action_executed'
  | 'user_return'
  | 'trial_end'
  | 'add_transaction'
  | 'onboarding_started'
  | 'onboarding_step_2_viewed'
  | 'onboarding_step_3_scan_started'
  | 'onboarding_completed'
  | 'paid'
  | 'view_step'
  | 'card_view'
  | 'card_click';

export interface BveltTelemetryEvent {
  event: BveltEventName;
  timestamp: string;
  niche?: string;
  location?: string;
  actionId?: string;
  source?: string;
  step?: string | number;
  card?: string;
  completedCount?: number;
}

export interface FirestoreMetricRecord {
  reads: number;
  writes: number;
  listeners: number;
  lastUpdated: string;
  recentQueries: Array<{
    type: 'read' | 'write' | 'listener';
    collection: string;
    timestamp: string;
    count: number;
  }>;
}

const MAX_BUFFER_EVENTS = 50;
const EVENTS_STORAGE_KEY = 'bvelt_telemetry_events';

// In-memory counters
const metrics: FirestoreMetricRecord = {
  reads: 0,
  writes: 0,
  listeners: 0,
  lastUpdated: new Date().toISOString(),
  recentQueries: []
};

/**
 * Tracks a key milestone in the customer conversion & execution journey.
 */
export function trackBveltEvent(
  event: BveltEventName,
  data?: {
    niche?: string;
    location?: string;
    actionId?: string;
    source?: string;
    step?: string | number;
    card?: string;
    completedCount?: number;
  }
): void {
  try {
    const payload: BveltTelemetryEvent = {
      event,
      timestamp: new Date().toISOString(),
      niche: data?.niche ? String(data.niche).substring(0, 50) : undefined,
      location: data?.location ? String(data.location).substring(0, 50) : undefined,
      actionId: data?.actionId ? String(data.actionId).substring(0, 50) : undefined,
      source: data?.source ? String(data.source).substring(0, 50) : undefined,
      step: data?.step,
      card: data?.card,
      completedCount: data?.completedCount
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Bvelt Observability] 📍 Event: ${event}`, payload);
    }

    // Persist in local ring-buffer
    const raw = sessionStorage.getItem(EVENTS_STORAGE_KEY) || localStorage.getItem(EVENTS_STORAGE_KEY);
    let list: BveltTelemetryEvent[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (_) {}
    }
    list.unshift(payload);
    if (list.length > MAX_BUFFER_EVENTS) {
      list = list.slice(0, MAX_BUFFER_EVENTS);
    }
    sessionStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Tracks Firestore operations to detect redundant reads/writes.
 */
export function recordFirestoreOp(
  type: 'read' | 'write' | 'listener',
  collectionName: string,
  docCount: number = 1
): void {
  if (type === 'read') metrics.reads += docCount;
  if (type === 'write') metrics.writes += docCount;
  if (type === 'listener') metrics.listeners += 1;
  metrics.lastUpdated = new Date().toISOString();

  // Keep last 20 queries for dev inspection
  metrics.recentQueries.unshift({
    type,
    collection: collectionName,
    timestamp: new Date().toISOString(),
    count: docCount
  });
  if (metrics.recentQueries.length > 20) {
    metrics.recentQueries.pop();
  }

  // Diagnostic warning in development if unexpected burst occurs
  if (process.env.NODE_ENV !== 'production' && metrics.reads > 100 && metrics.reads % 50 === 0) {
    console.warn(`[Firestore Usage Safety] Cumulative session reads: ${metrics.reads}. Check if collection listeners are bounded.`);
  }
}

/**
 * Retrieves observability metrics for developer inspection.
 */
export function getBveltMetrics(): {
  firestore: FirestoreMetricRecord;
  recentEvents: BveltTelemetryEvent[];
} {
  let events: BveltTelemetryEvent[] = [];
  try {
    const raw = sessionStorage.getItem(EVENTS_STORAGE_KEY) || localStorage.getItem(EVENTS_STORAGE_KEY);
    if (raw) events = JSON.parse(raw);
  } catch (_) {}

  return {
    firestore: { ...metrics },
    recentEvents: events
  };
}
