/**
 * BVELT Deep Reset & Resilient External Execution Engine
 * Enforces short timeouts (~2-3s) on external calls, catches failures gracefully,
 * returns explicit UNAVAILABLE or QUEUED states rather than blocking the UI,
 * enqueues work into the existing offline sync queue, and strictly prevents
 * fabricating successful outcomes.
 */

import { offlineStore, OfflineAction } from '../../lib/pwa/offlineStore';

export type ExternalExecutionStatus = 
  | 'EXECUTED' 
  | 'QUEUED' 
  | 'UNAVAILABLE' 
  | 'FAILED';

export interface ResilientExecutionResult<T = any> {
  status: ExternalExecutionStatus;
  data?: T;
  queuedOffline: boolean;
  queueId?: string;
  error?: string;
  durationMs: number;
}

export interface ResilientExecutionOptions {
  timeoutMs?: number; // default: 2500ms
  actionType?: 'LEAD_STATUS_UPDATE' | 'REVIEW_RESPONSE' | 'ACTION_STEP_COMPLETE' | 'GBP_POST_QUEUE' | 'OPPORTUNITY_ACTION' | 'MESSAGING_OUTBOUND';
  businessId?: string;
  payload?: any;
}

export class ResilientExecutionEngine {
  /**
   * Executes an external operation with a bounded timeout (2.5s default).
   * On timeout, network disconnect, or provider failure:
   * - Never throws an unhandled error to block UI.
   * - Never fabricates success.
   * - Enqueues action in offline store if businessId & payload provided.
   * - Returns explicit UNAVAILABLE or QUEUED state.
   */
  static async executeWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: ResilientExecutionOptions = {}
  ): Promise<ResilientExecutionResult<T>> {
    const timeoutMs = options.timeoutMs ?? 2500;
    const startTime = Date.now();
    const controller = new AbortController();
    let timeoutTimer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        controller.abort();
        reject(new Error(`External provider timeout (> ${timeoutMs}ms)`));
      }, timeoutMs);
    });

    try {
      const data = await Promise.race([
        operation(controller.signal),
        timeoutPromise
      ]);
      clearTimeout(timeoutTimer);
      return {
        status: 'EXECUTED',
        data,
        queuedOffline: false,
        durationMs: Date.now() - startTime
      };
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const isTimeout = err?.name === 'AbortError' || err?.message?.toLowerCase().includes('timeout') || controller.signal.aborted;
      const errorMsg = isTimeout 
        ? `External provider timeout (> ${timeoutMs}ms)` 
        : (err?.message || 'External provider unavailable');

      return this.handleFailure<T>(errorMsg, options, Date.now() - startTime);
    }
  }

  /**
   * Enqueues retryable work into existing offline sync mechanism
   */
  private static async handleFailure<T>(
    errorMessage: string,
    options: ResilientExecutionOptions,
    durationMs: number
  ): Promise<ResilientExecutionResult<T>> {
    let queuedOffline = false;
    let queueId: string | undefined = undefined;

    // Queue retryable work if businessId and payload are available
    if (options.payload) {
      try {
        if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
          const queued: OfflineAction = await offlineStore.queueOfflineAction({
            actionType: options.actionType || 'OPPORTUNITY_ACTION',
            payload: {
              ...options.payload,
              queuedDueTo: errorMessage,
              queuedAt: new Date().toISOString()
            },
            businessId: options.businessId
          });
          queuedOffline = true;
          queueId = queued.id;
        } else if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('bvelt_offline_actions_queue') || '[]';
          const queue = JSON.parse(raw);
          const id = `off_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          queue.push({
            id,
            actionType: options.actionType || 'OPPORTUNITY_ACTION',
            payload: {
              ...options.payload,
              queuedDueTo: errorMessage,
              queuedAt: new Date().toISOString()
            },
            businessId: options.businessId,
            status: 'QUEUED_OFFLINE'
          });
          localStorage.setItem('bvelt_offline_actions_queue', JSON.stringify(queue));
          queuedOffline = true;
          queueId = id;
        }
      } catch (queueErr) {
        console.warn('[ResilientExecution] Offline queue storage failed:', queueErr);
      }
    }

    return {
      status: queuedOffline ? 'QUEUED' : 'UNAVAILABLE',
      queuedOffline,
      queueId,
      error: errorMessage,
      durationMs
    };
  }
}
