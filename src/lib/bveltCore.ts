/**
 * ============================================================================
 * BVELT FEATURE FREEZE — RELEASE CANDIDATE
 * ============================================================================
 * Core customer journey:
 * DETECT (Market Intelligence) -> DECIDE (Opportunities) -> EXECUTE (Next Best Action) -> MEASURE (Outcomes)
 * 
 * Rules for this build and future maintenance:
 * - NO unsolicited feature development or arbitrary sub-modules.
 * - Only fix: critical bugs, data integrity, security, conversion blockers,
 *   retention blockers, or proven customer feedback.
 * ============================================================================
 */

export interface BveltCoreData {
  version: string;
  updatedAt: string;
  profile: any;
  leads: any[];
  clients: any[];
  opportunities: any[];
  actions: any[];
  outcomes: any[];
  signals: any[];
  growthPlanState: any;
  activityHistory: Array<{
    id: string;
    type: string;
    timestamp: string;
    relatedEntityId?: string | null;
    description: string;
  }>;
}

export const STORAGE_KEY = 'bvelt_core_v1';

export function getScopedKey(baseKey: string, userId?: string | null): string {
  if (!userId || userId.trim() === '') return baseKey;
  return `${baseKey}_${userId.trim()}`;
}

export function loadBveltCore(userId?: string | null): BveltCoreData {
  const effectiveKey = getScopedKey(STORAGE_KEY, userId);
  try {
    const raw = localStorage.getItem(effectiveKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error loading bvelt_core_v1, attempting migration...", e);
  }

  // Migration from legacy keys
  let profile = null;
  let leads: any[] = [];
  let clients: any[] = [];
  let opportunities: any[] = [];
  let actions: any[] = [];
  let outcomes: any[] = [];
  let signals: any[] = [];
  let growthPlanState = {};
  let activityHistory: any[] = [];

  try {
    const p = localStorage.getItem(getScopedKey('lf_business_profile', userId)) || (!userId ? localStorage.getItem('lf_profile') : null);
    if (p) profile = JSON.parse(p);
  } catch (e) {}

  try {
    const l = localStorage.getItem(getScopedKey('lf_crm_leads', userId)) || (!userId ? localStorage.getItem('lf_leads') : null);
    if (l) leads = JSON.parse(l);
  } catch (e) {}

  try {
    const c = localStorage.getItem(getScopedKey('lf_crm_clients', userId)) || (!userId ? localStorage.getItem('lf_transactions') : null);
    if (c) clients = JSON.parse(c);
  } catch (e) {}

  try {
    const op = localStorage.getItem(getScopedKey('bvelt_opportunities_v1', userId));
    if (op) opportunities = JSON.parse(op);
  } catch (e) {}

  try {
    const act = localStorage.getItem(getScopedKey('lf_growth_actions_v1', userId));
    if (act) actions = JSON.parse(act);
  } catch (e) {}

  try {
    const out = localStorage.getItem(getScopedKey('bvelt_outcomes_v1', userId));
    if (out) outcomes = JSON.parse(out);
  } catch (e) {}

  const defaultCore: BveltCoreData = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    profile: profile || {},
    leads: leads.map(l => ({ leadId: l.id || 'lead_' + Math.random(), ...l })),
    clients: clients.map(c => ({ clientId: c.id || 'client_' + Math.random(), ...c })),
    opportunities: opportunities.map(o => ({ opportunityId: o.id || 'opp_' + Math.random(), ...o })),
    actions: actions.map(a => ({ actionId: a.id || 'act_' + Math.random(), ...a })),
    outcomes: outcomes.map(o => ({ outcomeId: o.id || 'out_' + Math.random(), ...o })),
    signals: [],
    growthPlanState: {},
    activityHistory: [
      {
        id: 'act_hist_' + Date.now(),
        type: 'SYSTEM_INIT',
        timestamp: new Date().toISOString(),
        description: 'Bvelt Core Data Layer 1.0 initialized and migrated successfully.'
      }
    ]
  };

  saveBveltCore(defaultCore, userId);
  return defaultCore;
}

export function saveBveltCore(data: BveltCoreData, userId?: string | null): void {
  const effectiveKey = getScopedKey(STORAGE_KEY, userId);
  try {
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(effectiveKey, JSON.stringify(data));
    
    // Also sync to legacy scoped keys for seamless backward compatibility
    if (data.leads) localStorage.setItem(getScopedKey('lf_crm_leads', userId), JSON.stringify(data.leads));
    if (data.clients) localStorage.setItem(getScopedKey('lf_crm_clients', userId), JSON.stringify(data.clients));
    if (data.opportunities) localStorage.setItem(getScopedKey('bvelt_opportunities_v1', userId), JSON.stringify(data.opportunities));
    if (data.actions) localStorage.setItem(getScopedKey('lf_growth_actions_v1', userId), JSON.stringify(data.actions));
    if (data.outcomes) localStorage.setItem(getScopedKey('bvelt_outcomes_v1', userId), JSON.stringify(data.outcomes));
    if (data.profile) localStorage.setItem(getScopedKey('lf_business_profile', userId), JSON.stringify(data.profile));
  } catch (e) {
    console.error("Failed to save Bvelt Core Data:", e);
  }
}

export function clearUserScopedData(userId?: string | null): void {
  if (!userId) return;
  try {
    const keysToRemove = [
      getScopedKey(STORAGE_KEY, userId),
      getScopedKey('lf_crm_leads', userId),
      getScopedKey('lf_crm_clients', userId),
      getScopedKey('bvelt_opportunities_v1', userId),
      getScopedKey('lf_growth_actions_v1', userId),
      getScopedKey('bvelt_outcomes_v1', userId),
      getScopedKey('lf_business_profile', userId),
      getScopedKey('lf_profile', userId),
      getScopedKey('lf_leads', userId),
      getScopedKey('lf_transactions', userId),
      getScopedKey('lf_tasks', userId),
      getScopedKey('lf_growth', userId),
      getScopedKey('lf_streak', userId),
    ];
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  } catch (e) {
    console.warn("Failed to clear scoped user data:", e);
  }
}

export function logBveltActivity(type: string, description: string, relatedEntityId?: string | null, userId?: string | null): void {
  try {
    const core = loadBveltCore(userId);
    const newActivity = {
      id: 'act_hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type,
      timestamp: new Date().toISOString(),
      relatedEntityId: relatedEntityId || null,
      description
    };
    core.activityHistory = [newActivity, ...(core.activityHistory || [])].slice(0, 100); // Keep last 100
    saveBveltCore(core, userId);
  } catch (e) {
    console.error("Failed to log Bvelt activity:", e);
  }
}

export function exportBveltDataJson(): string {
  const core = loadBveltCore();
  return JSON.stringify(core, null, 2);
}

export function importBveltDataJson(jsonString: string): { success: boolean; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || !parsed.version) {
      return { success: false, error: 'Invalid Bvelt Core backup structure. Missing version.' };
    }
    // Validate core arrays
    if (!Array.isArray(parsed.leads) || !Array.isArray(parsed.opportunities) || !Array.isArray(parsed.actions)) {
      return { success: false, error: 'Backup is missing required entity collections (leads, opportunities, actions).' };
    }
    saveBveltCore(parsed);
    logBveltActivity('DATA_RESTORED', 'Bvelt Core Data successfully restored from backup JSON.');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: 'JSON parsing failed: ' + (e?.message || 'Unknown error') };
  }
}
