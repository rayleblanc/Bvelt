import { ApiBudgetGuard } from './budgetManager';

export type ProviderRenewalType = 'RENEWABLE_DAILY' | 'RENEWABLE_MONTHLY' | 'FINITE_ONE_TIME';
export type ProviderStatus = 'HEALTHY' | 'DEGRADED';

export interface ProviderQuota {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

export interface ApiProvider {
  id: string;
  type: ProviderRenewalType;
  status: ProviderStatus;
  failureCount: number;
  execute<T>(action: () => Promise<T>, options?: { manualOverride?: boolean }): Promise<T>;
  getQuota(): ProviderQuota;
  getType(): ProviderRenewalType;
}

export class CircuitBreakerProvider implements ApiProvider {
  id: string;
  type: ProviderRenewalType;
  status: ProviderStatus = 'HEALTHY';
  failureCount: number = 0;
  private maxFailures: number = 3;

  constructor(id: string, type: ProviderRenewalType) {
    this.id = id;
    this.type = type;
  }

  getType(): ProviderRenewalType {
    return this.type;
  }

  getQuota(): ProviderQuota {
    // Read from state or budget guard
    const isCanCall = ApiBudgetGuard.canCall(this.id);
    return {
      dailyUsed: 0, // Simplified, budgetManager handles internal storage
      dailyLimit: isCanCall ? 100 : 0, 
      monthlyUsed: 0,
      monthlyLimit: 1000
    };
  }

  async execute<T>(action: () => Promise<T>, options?: { manualOverride?: boolean }): Promise<T> {
    // 1. Quota Check
    if (!ApiBudgetGuard.canCall(this.id)) {
      throw new Error(`[ProviderAbstraction] Quota exceeded for provider ${this.id}`);
    }

    // 2. Circuit Breaker Check
    if (this.status === 'DEGRADED') {
      console.warn(`[ProviderAbstraction] Circuit Breaker: Provider ${this.id} is DEGRADED. Attempting probe.`);
    }

    // 3. Finite One Time Check
    if (this.type === 'FINITE_ONE_TIME' && !options?.manualOverride) {
      throw new Error(`[ProviderAbstraction] Access blocked: Provider ${this.id} is FINITE_ONE_TIME and requires manualOverride: true`);
    }

    if (this.type === 'FINITE_ONE_TIME' && options?.manualOverride) {
      console.log(`[MANUAL_EMERGENCY] Using finite one-time provider ${this.id} with manualOverride.`);
    }

    try {
      const result = await action();
      // On success, reset circuit state
      this.failureCount = 0;
      this.status = 'HEALTHY';
      ApiBudgetGuard.recordCall(this.id);
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= this.maxFailures) {
        this.status = 'DEGRADED';
        console.error(`[ProviderAbstraction] Provider ${this.id} marked as DEGRADED due to ${this.failureCount} sequential failures.`);
      }
      throw error;
    }
  }
}

export class ProviderAbstractionLayer {
  private static providers: Record<string, ApiProvider> = {
    // Geocoding
    nominatim: new CircuitBreakerProvider('nominatim', 'RENEWABLE_DAILY'),
    geoapify: new CircuitBreakerProvider('geoapify', 'RENEWABLE_DAILY'),
    opencage: new CircuitBreakerProvider('opencage', 'RENEWABLE_DAILY'),
    locationiq: new CircuitBreakerProvider('locationiq', 'RENEWABLE_DAILY'),
    geocodio: new CircuitBreakerProvider('geocodio', 'RENEWABLE_DAILY'),
    
    // Search / Enrichment
    tavily: new CircuitBreakerProvider('tavily', 'RENEWABLE_MONTHLY'),
    you: new CircuitBreakerProvider('you', 'RENEWABLE_DAILY'),
  };

  static getProvider(id: string): ApiProvider {
    const prov = this.providers[id];
    if (!prov) {
      // Lazy init unmanaged as renewable daily
      this.providers[id] = new CircuitBreakerProvider(id, 'RENEWABLE_DAILY');
      return this.providers[id];
    }
    return prov;
  }

  /**
   * Execute with automatic fallback chaining.
   * Skip any provider that is DEGRADED, out of quota, or is FINITE_ONE_TIME (unless manualOverride is set).
   */
  static async executeWithFallback<T>(
    chain: string[],
    action: (providerId: string) => Promise<T>,
    options?: { manualOverride?: boolean }
  ): Promise<T> {
    let lastError: any = null;

    for (const providerId of chain) {
      const provider = this.getProvider(providerId);

      // Check state before calling
      if (provider.status === 'DEGRADED') {
        console.warn(`[ProviderAbstraction] Skipping degraded provider ${providerId}`);
        continue;
      }

      if (!ApiBudgetGuard.canCall(providerId)) {
        console.warn(`[ProviderAbstraction] Skipping provider ${providerId} due to quota exhaustion`);
        continue;
      }

      if (provider.getType() === 'FINITE_ONE_TIME' && !options?.manualOverride) {
        console.warn(`[ProviderAbstraction] Skipping provider ${providerId}: FINITE_ONE_TIME without manualOverride`);
        continue;
      }

      try {
        return await provider.execute(() => action(providerId), options);
      } catch (err) {
        console.error(`[ProviderAbstraction] Failed executing on ${providerId}:`, err);
        lastError = err;
        // Proceed to next in fallback chain
      }
    }

    throw new Error(`[ProviderAbstraction] All providers in the fallback chain failed or were skipped. Last error: ${lastError?.message || lastError}`);
  }
}
