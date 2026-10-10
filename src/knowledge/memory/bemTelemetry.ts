/**
 * BVELT MEMORY v1 (BEM) — Telemetry & Observability
 * 
 * Lightweight in-memory telemetry tracer for tracking memory lookups, hits, misses,
 * freshness transitions, write noops, and acquisition savings.
 * Zero external dependencies, zero PII, zero extra database tables.
 */

export type BemTelemetryEventType =
  | 'memory_lookup'
  | 'memory_hit'
  | 'memory_miss'
  | 'memory_stale'
  | 'memory_conflict'
  | 'memory_reused_field'
  | 'memory_refresh_requested'
  | 'memory_write'
  | 'memory_write_noop'
  | 'memory_write_update'
  | 'acquisition_requested'
  | 'acquisition_skipped'
  | 'acquisition_executed';

export interface BemTelemetryEvent {
  eventType: BemTelemetryEventType;
  entityId?: string;
  fieldKey?: string;
  source?: string;
  reason?: string;
  timestamp: string;
}

export class BemTelemetry {
  private static events: BemTelemetryEvent[] = [];
  private static MAX_EVENTS = 1000;

  /**
   * Records a single BEM telemetry event.
   */
  static record(event: Omit<BemTelemetryEvent, 'timestamp'>): void {
    const entry: BemTelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    this.events.push(entry);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
  }

  /**
   * Returns recorded events, optionally filtered by event type or entityId.
   */
  static getEvents(filterType?: BemTelemetryEventType, entityId?: string): BemTelemetryEvent[] {
    return this.events.filter(e => {
      if (filterType && e.eventType !== filterType) return false;
      if (entityId && e.entityId !== entityId) return false;
      return true;
    });
  }

  /**
   * Returns a breakdown count of all recorded telemetry events.
   */
  static getStats(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.events) {
      counts[e.eventType] = (counts[e.eventType] || 0) + 1;
    }
    return counts;
  }

  /**
   * Clears the telemetry log (useful between unit tests).
   */
  static clear(): void {
    this.events = [];
  }
}
