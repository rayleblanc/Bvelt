export interface ApiProviderConfig {
  provider: string;
  dailyLimit: number;
  monthlyLimit?: number;
  resetTimeUtc: string; // '00:00', '12:00'
}

export interface ApiUsage {
  dailyUsage: number;
  monthlyUsage: number;
  lastReset: string;
}

const PROVIDERS: Record<string, ApiProviderConfig> = {
  geoapify: {
    provider: 'geoapify',
    dailyLimit: 2900, // Safe margin under 3000
    resetTimeUtc: '00:00'
  },
  tavily: {
    provider: 'tavily',
    dailyLimit: 30, // 1000/mo divided safely
    monthlyLimit: 950, 
    resetTimeUtc: '00:00'
  },
  you: {
    provider: 'you',
    dailyLimit: 100,
    resetTimeUtc: '00:00'
  },
  nominatim: {
    provider: 'nominatim',
    dailyLimit: 8000,
    resetTimeUtc: '00:00'
  },
  opencage: {
    provider: 'opencage',
    dailyLimit: 2500,
    resetTimeUtc: '00:00'
  },
  locationiq: {
    provider: 'locationiq',
    dailyLimit: 5000,
    resetTimeUtc: '00:00'
  },
  geocodio: {
    provider: 'geocodio',
    dailyLimit: 2500,
    resetTimeUtc: '00:00'
  },
  ocr_space: {
    provider: 'ocr_space',
    dailyLimit: 500,
    resetTimeUtc: '00:00'
  },
  goqr: {
    provider: 'goqr',
    dailyLimit: 10000,
    resetTimeUtc: '00:00'
  },
  short_io: {
    provider: 'short_io',
    dailyLimit: 50,
    monthlyLimit: 1000,
    resetTimeUtc: '00:00'
  },
  superflow: {
    provider: 'superflow',
    dailyLimit: 240,
    resetTimeUtc: '00:00'
  },
  agent_ready_mcp: {
    provider: 'agent_ready_mcp',
    dailyLimit: 1,
    monthlyLimit: 3,
    resetTimeUtc: '00:00'
  },
  textbee: {
    provider: 'textbee',
    dailyLimit: 50,
    monthlyLimit: 300,
    resetTimeUtc: '00:00'
  },
  bigdata_cloud: {
    provider: 'bigdata_cloud',
    dailyLimit: 10000,
    resetTimeUtc: '00:00'
  },
  freetsa: {
    provider: 'freetsa',
    dailyLimit: 10000,
    resetTimeUtc: '00:00'
  },
  brightdata: {
    provider: 'brightdata',
    dailyLimit: 150,
    monthlyLimit: 5000,
    resetTimeUtc: '00:00'
  }
};

const STORAGE_KEY = 'bvelt_api_usage_v1';

export class ApiBudgetGuard {
  private static getUsage(): Record<string, ApiUsage> {
    if (typeof window === 'undefined') return {}; // Prevent SSR issues
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Failed to read API usage from local storage.");
    }
    return {};
  }

  private static saveUsage(usage: Record<string, ApiUsage>) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    } catch (e) {
      console.warn("Failed to write API usage to local storage.");
    }
  }

  private static checkReset(provider: string, currentUsage: ApiUsage): ApiUsage {
    const today = new Date().toISOString().split('T')[0];
    if (currentUsage.lastReset !== today) {
      return {
        dailyUsage: 0,
        monthlyUsage: currentUsage.monthlyUsage, // Note: real monthly reset requires proper date math, keeping simple for now
        lastReset: today
      };
    }
    return currentUsage;
  }

  static canCall(provider: string): boolean {
    const config = PROVIDERS[provider];
    if (!config) return true; // Unmanaged provider, assume yes (or define default)

    const usageData = this.getUsage();
    let providerUsage = usageData[provider] || { dailyUsage: 0, monthlyUsage: 0, lastReset: new Date().toISOString().split('T')[0] };
    
    providerUsage = this.checkReset(provider, providerUsage);

    if (providerUsage.dailyUsage >= config.dailyLimit) {
      console.warn(`[BudgetGuard] Daily limit reached for ${provider}`);
      return false;
    }

    if (config.monthlyLimit && providerUsage.monthlyUsage >= config.monthlyLimit) {
      console.warn(`[BudgetGuard] Monthly limit reached for ${provider}`);
      return false;
    }

    return true;
  }

  static recordCall(provider: string, calls: number = 1) {
    const config = PROVIDERS[provider];
    if (!config) return;

    const usageData = this.getUsage();
    let providerUsage = usageData[provider] || { dailyUsage: 0, monthlyUsage: 0, lastReset: new Date().toISOString().split('T')[0] };
    
    providerUsage = this.checkReset(provider, providerUsage);
    providerUsage.dailyUsage += calls;
    providerUsage.monthlyUsage += calls;
    
    usageData[provider] = providerUsage;
    this.saveUsage(usageData);
  }
}
