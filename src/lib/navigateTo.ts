/**
 * Unified Navigation Helper for Bvelt
 * Coordinates tab switching, subRow selection, lead focusing, scan triggers,
 * tool activation, and element scrolling across Dashboard, ActionCenter, Sticky CTA, and Service Worker.
 */

export type NavigateTool =
  | 'crm_inbox'
  | 'analyze_msg'
  | 'scan_area'
  | 'prospecting'
  | 'reviews'
  | 'profile'
  | 'estimator'
  | 'website'
  | 'business_scan'
  | 'reactivation'
  | 'estimate_followup'
  | 'quotes_followup';

export type NavigateTarget = {
  tab?: string;
  subRow?: number | string;
  leadId?: string;
  radiusKm?: number;
  scanRadius?: number; // alias for radiusKm
  scrollId?: string;
  tool?: NavigateTool;
  triggerScan?: boolean;
  focusFirstLead?: boolean;
  route?: string;
  [key: string]: any;
};

export interface NavigateSetters {
  setActiveTab?: (tab: any) => void;
  setActiveSubRow?: (subRow: any) => void;
  setSelectedMobileView?: (view: any) => void;
  setActiveSection?: (section: any) => void;
  setSelectedLeadId?: (id: string | null) => void;
  setScanRadiusKm?: (radius: number) => void;
  runScan?: (radius?: number) => void;
}

export interface ResolvedNavigation {
  targetTab: string;
  targetSubRow?: number;
  targetLeadId?: string;
  targetScanRadius?: number;
  targetScrollId?: string;
  targetTool?: NavigateTool;
  triggerScan?: boolean;
}

/**
 * Section mapping for active navigation section
 */
export function getSectionForTab(tab: string, subRow?: number): string {
  if (['business_scan', 'estimator'].includes(tab) || (tab === 'tools' && subRow === 0)) {
    return 'market';
  }
  if (tab === 'leads') {
    return 'leads';
  }
  if (['reviews', 'social', 'growth', 'action_center', 'website'].includes(tab)) {
    return 'growth';
  }
  if (['eod', 'pricing', 'plans', 'profile'].includes(tab) || (tab === 'tools' && subRow !== 0)) {
    return 'execute';
  }
  return 'market';
}

/**
 * MAPA Canonical Translation:
 * 1. Radar / Scan Area → leads (subRow 1) OR business_scan
 * 2. Retry radius (10km / 25km) → scan + run (radiusKm + triggerScan: true)
 * 3. Answer Leads / Contact Leads → leads (CRM Inbox subRow 4, tool: 'crm_inbox', with leadId focused)
 * 4. Analyze Message → leads (subRow 0, tool: 'analyze_msg') - NEVER default for Answer Leads
 * 5. Reviews / Generate QR → reviews (subRow 1, tool: 'reviews')
 * 6. Estimator / Quote → estimator (tool: 'estimator')
 * 7. Upgrade / Plans → plans
 * 8. Cuota / Profile / Review Business Profile → profile (tool: 'profile')
 * 9. Notification → tab + leadId + CRM Inbox
 */
export function resolveNavigation(target: NavigateTarget = { tab: 'dashboard' }): ResolvedNavigation {
  const rawTab = (target.tab || '').toLowerCase().trim();
  const radius = target.radiusKm !== undefined ? target.radiusKm : target.scanRadius;
  const tool = target.tool;

  // 1. Tool-explicit routing overrides
  if (tool === 'crm_inbox') {
    return {
      targetTab: 'leads',
      targetSubRow: 4,
      targetLeadId: target.leadId,
      targetScrollId: target.scrollId,
      targetTool: 'crm_inbox'
    };
  }

  if (tool === 'analyze_msg') {
    return {
      targetTab: 'leads',
      targetSubRow: 0,
      targetLeadId: target.leadId,
      targetScrollId: target.scrollId,
      targetTool: 'analyze_msg'
    };
  }

  if (tool === 'reactivation' || (tool as any) === 'retention') {
    return {
      targetTab: 'leads',
      targetSubRow: 5,
      targetLeadId: target.leadId,
      targetScrollId: target.scrollId,
      targetTool: 'reactivation'
    };
  }

  if (tool === 'estimate_followup' || tool === 'quotes_followup') {
    return {
      targetTab: 'leads',
      targetSubRow: 5,
      targetLeadId: target.leadId,
      targetScrollId: target.scrollId || 'estimate-followup-section',
      targetTool: 'estimate_followup'
    };
  }

  if (tool === 'scan_area' || tool === 'prospecting') {
    return {
      targetTab: 'leads',
      targetSubRow: 1,
      targetScanRadius: radius,
      targetScrollId: target.scrollId,
      targetTool: tool,
      triggerScan: target.triggerScan
    };
  }

  if (tool === 'reviews') {
    return {
      targetTab: 'reviews',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId,
      targetTool: 'reviews'
    };
  }

  if (tool === 'profile') {
    return {
      targetTab: 'profile',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId,
      targetTool: 'profile'
    };
  }

  if (tool === 'estimator') {
    return {
      targetTab: 'estimator',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId,
      targetTool: 'estimator'
    };
  }

  if (tool === 'business_scan') {
    return {
      targetTab: 'business_scan',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScanRadius: radius,
      targetScrollId: target.scrollId,
      targetTool: 'business_scan',
      triggerScan: target.triggerScan
    };
  }

  if (tool === 'website') {
    return {
      targetTab: 'website',
      targetScrollId: target.scrollId,
      targetTool: 'website'
    };
  }

  // 2. Tab name canonical translations
  // A. Radar / Prospecting
  if (['radar', 'market-radar', 'market_radar', 'prospecting', 'prospecting_radar', 'scan_area'].includes(rawTab)) {
    return {
      targetTab: 'leads',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 1,
      targetScanRadius: radius,
      targetScrollId: target.scrollId,
      targetTool: 'scan_area',
      triggerScan: target.triggerScan
    };
  }

  // B. Retry radius (10km, 25km)
  if (radius !== undefined || rawTab === 'retry_radius' || rawTab === 'retry-radius') {
    const destTab = rawTab === 'business_scan' ? 'business_scan' : 'dashboard';
    return {
      targetTab: destTab,
      targetScanRadius: radius !== undefined ? radius : 10,
      triggerScan: true,
      targetScrollId: target.scrollId || 'section-market-intelligence'
    };
  }

  // C. Answer Leads / Contact Leads (Always maps to CRM Inbox subRow 4, NEVER Analyze MSG)
  if (target.leadId || rawTab === 'answer_leads' || rawTab === 'answer-leads' || rawTab === 'contact_leads' || rawTab === 'client_acquisition') {
    return {
      targetTab: 'leads',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 4,
      targetLeadId: target.leadId,
      targetScrollId: target.scrollId,
      targetTool: 'crm_inbox'
    };
  }

  // D. Analyze message (explicit only)
  if (rawTab === 'analyze_msg' || rawTab === 'analyze-msg' || rawTab === 'analyze_message') {
    return {
      targetTab: 'leads',
      targetSubRow: 0,
      targetScrollId: target.scrollId,
      targetTool: 'analyze_msg'
    };
  }

  // Reactivation / Past clients retention (SubRow 5 in Leads)
  if (['reactivation', 'reactivation_crm', 'dormant', 'retention'].includes(rawTab)) {
    return {
      targetTab: 'leads',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 5,
      targetScrollId: target.scrollId,
      targetTool: 'reactivation'
    };
  }

  // Estimate Follow-up / Quotes follow-up (SubRow 5 in Leads, estimate-followup-section)
  if (['estimate_followup', 'estimates_followup', 'quotes_followup', 'quote_followup', 'follow_up_quotes', 'follow-up-quotes', 'estimates', 'estimates_crm'].includes(rawTab)) {
    return {
      targetTab: 'leads',
      targetSubRow: 5,
      targetScrollId: target.scrollId || 'estimate-followup-section',
      targetTool: 'estimate_followup'
    };
  }

  // E. Reviews / QR
  if (rawTab === 'reviews' || rawTab === 'review' || rawTab === 'review_qr' || rawTab === 'reviews_qr') {
    return {
      targetTab: 'reviews',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId,
      targetTool: 'reviews'
    };
  }

  // F. Estimator / Quotes
  if (rawTab === 'estimator' || rawTab === 'visual_estimator' || rawTab === 'quotes' || rawTab === 'quote') {
    return {
      targetTab: 'estimator',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId,
      targetTool: 'estimator'
    };
  }

  // G. Upgrade / Plans
  if (rawTab === 'upgrade' || rawTab === 'plans' || rawTab === 'pricing' || rawTab === 'pro') {
    return {
      targetTab: 'plans',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId
    };
  }

  // H. Cuota / Profile / Review Business Profile / Settings
  if (['cuota', 'quota', 'profile', 'account', 'business_profile', 'settings', 'config', 'configuracion'].includes(rawTab)) {
    return {
      targetTab: 'profile',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId,
      targetTool: 'profile'
    };
  }

  // Website builder
  if (rawTab === 'website' || rawTab === 'site' || rawTab === 'landing' || rawTab === 'web') {
    return {
      targetTab: 'website',
      targetSubRow: target.subRow !== undefined ? Number(target.subRow) : 0,
      targetScrollId: target.scrollId,
      targetTool: 'website'
    };
  }

  // I. Notifications
  if (rawTab === 'notification') {
    const destTab = target.leadId ? 'leads' : 'dashboard';
    return {
      targetTab: destTab,
      targetSubRow: target.leadId ? 4 : (target.subRow !== undefined ? Number(target.subRow) : undefined),
      targetLeadId: target.leadId,
      targetScrollId: target.scrollId,
      targetTool: target.leadId ? 'crm_inbox' : undefined
    };
  }

  // Default passthrough
  return {
    targetTab: target.tab || 'dashboard',
    targetSubRow: target.subRow !== undefined ? Number(target.subRow) : (rawTab === 'leads' ? 4 : undefined),
    targetLeadId: target.leadId,
    targetScanRadius: radius,
    targetScrollId: target.scrollId,
    targetTool: tool,
    triggerScan: target.triggerScan
  };
}

/**
 * Unified navigateTo implementation:
 * Supports both signatures:
 * 1) navigateTo(setters, target)
 * 2) navigateTo(target)
 */
export function navigateTo(
  settersOrTarget?: NavigateSetters | NavigateTarget,
  maybeTarget?: NavigateTarget
): ResolvedNavigation {
  let setters: NavigateSetters | undefined;
  let target: NavigateTarget;

  if (maybeTarget !== undefined) {
    setters = settersOrTarget as NavigateSetters;
    target = maybeTarget;
  } else if (settersOrTarget && ('tab' in settersOrTarget || 'tool' in settersOrTarget || 'leadId' in settersOrTarget || 'radiusKm' in settersOrTarget || 'scanRadius' in settersOrTarget)) {
    target = settersOrTarget as NavigateTarget;
  } else {
    target = (settersOrTarget as NavigateTarget) || { tab: 'dashboard' };
  }

  const resolved = resolveNavigation(target);

  // 1. Apply provided setters directly if available
  if (setters) {
    if (setters.setActiveTab && resolved.targetTab) {
      setters.setActiveTab(resolved.targetTab);
    }
    if (setters.setActiveSubRow && resolved.targetSubRow !== undefined) {
      setters.setActiveSubRow(resolved.targetSubRow);
    }
    if (setters.setSelectedMobileView) {
      setters.setSelectedMobileView('tab');
    }
    if (setters.setActiveSection && resolved.targetTab) {
      setters.setActiveSection(getSectionForTab(resolved.targetTab, resolved.targetSubRow));
    }
    if (setters.setSelectedLeadId && resolved.targetLeadId) {
      setters.setSelectedLeadId(resolved.targetLeadId);
    }
    if (setters.setScanRadiusKm && resolved.targetScanRadius !== undefined) {
      setters.setScanRadiusKm(resolved.targetScanRadius);
    }
    if (setters.runScan && resolved.triggerScan) {
      setters.runScan(resolved.targetScanRadius);
    }
  }

  // 2. Handle browser globals, localStorage, and events
  if (typeof window !== 'undefined') {
    // If leadId is present, persist and notify CRM listeners
    if (resolved.targetLeadId) {
      try {
        localStorage.setItem('crm_open_lead_id', resolved.targetLeadId);
        localStorage.setItem('crm_lead_filter', 'ALL');
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('bvelt_open_lead', { detail: { leadId: resolved.targetLeadId } }));
      } catch (e) {
        console.warn('Error setting CRM open lead:', e);
      }
    }

    // If scanRadius is present, update radius and trigger scan
    if (resolved.targetScanRadius !== undefined) {
      try {
        localStorage.setItem('bvelt_scan_radius', String(resolved.targetScanRadius));
        if (resolved.triggerScan) {
          localStorage.setItem('bvelt_trigger_scan', String(Date.now()));
          window.dispatchEvent(new CustomEvent('bvelt_trigger_scan', { detail: { radius: resolved.targetScanRadius } }));
        }
      } catch (e) {
        console.warn('Error setting scan radius:', e);
      }
    }

    // Dispatch global navigation event (caught by App.tsx)
    window.dispatchEvent(new CustomEvent('bvelt_navigate', { detail: resolved }));

    // Smooth scroll if scrollId is specified (after 150ms)
    if (resolved.targetScrollId) {
      setTimeout(() => {
        const el = document.getElementById(resolved.targetScrollId!);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }

  return resolved;
}
