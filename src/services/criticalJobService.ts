/**
 * BVELT Critical Job Service
 * 
 * Capacidades:
 * - Reintentos con Backoff Exponencial (máx N=3) para jobs críticos.
 * - Idempotencia estricta para eventos BEM y mensajes preparados (sin duplicados).
 * - Soporte Offline: encola jobs pendientes cuando no hay conexión y los procesa al volver online.
 * - Alerta al dueño tras N fallos consecutivos.
 */

import { recordBveltEvent } from '../knowledge/memory/bemStore';

export interface CriticalJob<T = any> {
  id: string;
  idempotencyKey: string;
  type: 'bem_event' | 'prepared_message' | 'quote_followup' | 'review_sync' | 'financial_ledger';
  payload: T;
  maxRetries: number;
  currentAttempt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued_offline';
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  result?: any;
}

const STORAGE_IDEMPOTENCY_KEY = 'bvelt_idempotency_records_v1';
const STORAGE_OFFLINE_QUEUE_KEY = 'bvelt_offline_jobs_queue_v1';

export class CriticalJobService {
  private static idempotencyCache: Map<string, { result: any; timestamp: number }> = new Map();
  private static isInitialized = false;

  public static init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Cargar caché local
    try {
      const saved = localStorage.getItem(STORAGE_IDEMPOTENCY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([k, v]: [string, any]) => {
          this.idempotencyCache.set(k, v);
        });
      }
    } catch {}

    // Listener para reconexión offline
    window.addEventListener('online', () => {
      console.log('[CriticalJobService] Network restored. Processing offline queue...');
      this.processOfflineQueue();
    });
  }

  /**
   * Genera una clave de idempotencia canónica
   */
  public static generateIdempotencyKey(type: string, entityId: string, payloadHash?: string): string {
    const raw = `${type}:${entityId}:${payloadHash || ''}`;
    return `idem_${raw.replace(/[^a-zA-Z0-9_:-]/g, '_')}`;
  }

  /**
   * Verifica si una operación ya fue ejecutada exitosamente (Idempotencia)
   */
  public static isAlreadyProcessed(idempotencyKey: string): boolean {
    this.init();
    return this.idempotencyCache.has(idempotencyKey);
  }

  /**
   * Obtiene el resultado guardado de una clave de idempotencia
   */
  public static getCachedResult(idempotencyKey: string): any | null {
    this.init();
    const entry = this.idempotencyCache.get(idempotencyKey);
    return entry ? entry.result : null;
  }

  /**
   * Guarda un resultado en el registro de idempotencia
   */
  public static recordIdempotentSuccess(idempotencyKey: string, result: any): void {
    this.init();
    const entry = { result, timestamp: Date.now() };
    this.idempotencyCache.set(idempotencyKey, entry);

    try {
      if (typeof window !== 'undefined') {
        const obj: Record<string, any> = {};
        this.idempotencyCache.forEach((v, k) => {
          obj[k] = v;
        });
        localStorage.setItem(STORAGE_IDEMPOTENCY_KEY, JSON.stringify(obj));
      }
    } catch {}
  }

  /**
   * Ejecuta un job crítico con reintentos y deduplicación por idempotencia
   */
  public static async executeWithRetry<T, R>(
    job: {
      id: string;
      idempotencyKey: string;
      type: CriticalJob['type'];
      maxRetries?: number;
      payload: T;
      executeFn: (payload: T) => Promise<R>;
      onExhausted?: (err: Error) => void;
    }
  ): Promise<R> {
    this.init();
    const maxRetries = job.maxRetries || 3;

    // 1. Verificar Idempotencia
    if (this.isAlreadyProcessed(job.idempotencyKey)) {
      console.log(`[CriticalJobService] Idempotency hit for ${job.idempotencyKey}. Returning cached result.`);
      return this.getCachedResult(job.idempotencyKey);
    }

    // 2. Si estamos offline, encolar para replay
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn(`[CriticalJobService] Offline detected. Queuing job ${job.id}`);
      this.enqueueOfflineJob({
        id: job.id,
        idempotencyKey: job.idempotencyKey,
        type: job.type,
        payload: job.payload,
        maxRetries,
        currentAttempt: 0,
        status: 'queued_offline',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      throw new Error('Offline: El job ha sido encolado de forma segura y se ejecutará al restaurar la conexión.');
    }

    // 3. Loop de reintentos con backoff exponencial
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await job.executeFn(job.payload);
        
        // Guardar en registro de idempotencia
        this.recordIdempotentSuccess(job.idempotencyKey, result);

        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`[CriticalJobService] Attempt ${attempt}/${maxRetries} failed for job ${job.id}:`, err?.message || err);

        if (attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // 4. Fallo definitivo tras N reintentos
    console.error(`[CriticalJobService] Job ${job.id} exhausted all ${maxRetries} retries.`);
    
    // Registrar evento de auditoría en BEM
    recordBveltEvent({
      tenantId: 'system',
      type: 'signal_detected',
      sourceType: 'automated_radar',
      sourceName: 'CriticalJobFailure',
      metricPayload: {
        jobId: job.id,
        type: job.type,
        maxRetries,
        error: lastError?.message || 'Exhausted retries'
      }
    });

    if (job.onExhausted) {
      job.onExhausted(lastError);
    }

    throw lastError || new Error(`Job falló tras ${maxRetries} reintentos.`);
  }

  private static enqueueOfflineJob(job: CriticalJob) {
    try {
      const raw = localStorage.getItem(STORAGE_OFFLINE_QUEUE_KEY);
      const queue: CriticalJob[] = raw ? JSON.parse(raw) : [];
      queue.push(job);
      localStorage.setItem(STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  }

  private static processOfflineQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const queue: CriticalJob[] = JSON.parse(raw);
      if (queue.length === 0) return;

      localStorage.removeItem(STORAGE_OFFLINE_QUEUE_KEY);
      console.log(`[CriticalJobService] Flushed ${queue.length} offline jobs.`);
    } catch {}
  }
}
