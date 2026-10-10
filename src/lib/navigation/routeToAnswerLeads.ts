/**
 * RouteToAnswerLeads - Shared navigation and helper for all "Answer Leads", "Contact Leads",
 * and CRM priority actions across Bvelt.
 *
 * Guarantees that all CTAs, badges, and banners navigate to the exact actionable lead
 * or filtered CRM inbox with no divergence in behavior.
 */

export interface ActionableLead {
  id: string;
  businessName?: string;
  client?: string;
  name?: string;
  category?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  text?: string;
  inbound_message?: string;
  inboundMessage?: string;
  whatsapp?: string;
  whatsappChannelId?: string;
  status?: string;
  score?: number;
  source?: string;
  isDemo?: boolean;
  [key: string]: any;
}

/**
 * Normalizes text for lenient location/city comparisons
 */
function normalizeText(txt?: string | null): string {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Known distinct global metropolitan areas and regions to detect out-of-zone leads.
 */
const KNOWN_OUT_OF_ZONE_LOCATIONS = [
  'amsterdam', 'north holland', 'noord-holland', 'netherlands', 'holanda', 'nederland',
  'london', 'greater london', 'united kingdom', 'uk', 'england',
  'madrid', 'barcelona', 'valencia', 'sevilla', 'spain', 'españa',
  'paris', 'france', 'francia',
  'berlin', 'munich', 'hamburg', 'frankfurt', 'germany', 'alemania',
  'toronto', 'ontario', 'vancouver', 'british columbia', 'montreal', 'quebec', 'canada',
  'sydney', 'melbourne', 'brisbane', 'australia',
  'tokyo', 'japan', 'japon',
  'rome', 'milan', 'italy', 'italia',
  'mexico city', 'ciudad de mexico', 'cdmx', 'guadalajara', 'monterrey', 'mexico',
  'bogota', 'medellin', 'cali', 'colombia',
  'buenos aires', 'cordoba', 'rosario', 'argentina',
  'santiago', 'chile',
  'lima', 'peru'
];

/**
 * Checks if a lead is strictly within the user profile's business service area.
 * - Normalizes profile city, location, state, country.
 * - Compares with lead city, location, address, text, and excerpt.
 * - Detects explicit conflicting international or out-of-state/out-of-city locations.
 * - Demo leads or out-of-zone leads return false.
 */
export function isLeadInServiceArea(lead: ActionableLead | null | undefined, profile?: any): boolean {
  if (!lead) return false;

  const isDemo = Boolean(lead.isDemo || lead.id?.startsWith('dl-') || lead.id?.startsWith('demo-'));

  // Normalize profile location
  const profCity = normalizeText(profile?.city || profile?.location?.split(',')?.[0]);
  const profLoc = normalizeText(profile?.location);
  const profState = normalizeText(profile?.state);
  const profCountry = normalizeText(profile?.country || 'us');

  // If no profile or no profile location set, cannot confirm local
  if (!profCity && !profLoc && !profState) {
    return false;
  }

  // Extract lead location fields
  const leadCity = normalizeText(lead.city);
  const leadLoc = normalizeText(lead.location);
  const leadState = normalizeText(lead.state);
  const leadCountry = normalizeText(lead.country);
  const leadAddress = normalizeText(lead.address);
  const leadText = normalizeText(
    lead.text || 
    lead.rawText || 
    lead.inbound_message || 
    lead.inboundMessage || 
    lead.message || 
    lead.excerpt ||
    ''
  );

  const combinedLeadLocationText = `${leadCity} ${leadLoc} ${leadState} ${leadCountry} ${leadAddress} ${leadText}`;

  // Check 1: Explicit out-of-zone international / metropolitan conflicts
  for (const knownLoc of KNOWN_OUT_OF_ZONE_LOCATIONS) {
    if (combinedLeadLocationText.includes(knownLoc)) {
      // If profile itself does not match this location, lead is definitely out of zone
      const profileMatches = (profCity && profCity.includes(knownLoc)) ||
                             (profLoc && profLoc.includes(knownLoc)) ||
                             (profCountry && profCountry.includes(knownLoc));
      if (!profileMatches) {
        return false;
      }
    }
  }

  // Check 2: Demo leads never count as real in-service-area unless strictly in-zone and not hidden
  if (isDemo) {
    if (!profCity || !leadCity || !leadCity.includes(profCity)) {
      return false;
    }
  }

  // Check 3: Direct city match
  if (profCity && profCity.length >= 3) {
    if (leadCity && (leadCity.includes(profCity) || profCity.includes(leadCity))) return true;
    if (leadLoc && (leadLoc.includes(profCity) || profCity.includes(leadLoc))) return true;
    if (leadAddress && leadAddress.includes(profCity)) return true;
    if (leadText && leadText.includes(profCity)) return true;
  }

  // Check 4: Direct location string match (e.g. "Naples, FL")
  if (profLoc && profLoc.length >= 3) {
    const mainCity = profLoc.split(',')[0].trim();
    if (mainCity && mainCity.length >= 3) {
      if (leadCity && (leadCity.includes(mainCity) || mainCity.includes(leadCity))) return true;
      if (leadLoc && (leadLoc.includes(mainCity) || mainCity.includes(leadLoc))) return true;
      if (leadAddress && leadAddress.includes(mainCity)) return true;
      if (leadText && leadText.includes(mainCity)) return true;
    }
  }

  // Check 5: If lead has explicit location fields that did not match profile city/location
  if (leadCity || leadLoc || leadState) {
    return false;
  }

  // Check 6: If lead has needsLocationConfirm flag set during analyzeLead
  if (lead.needsLocationConfirm && !isDemo) {
    return true;
  }

  // Otherwise, if lead has no location metadata and didn't mention profile city, it is not local
  return false;
}

/**
 * Backward compatibility alias for isLeadInServiceArea
 */
export const isLeadInZone = isLeadInServiceArea;

/**
 * Helper to determine if a lead represents a genuine, actionable local business opportunity.
 * Returns false if:
 * - lead is null / undefined
 * - lead.isDemo === true OR id starts with 'dl-' or 'demo-'
 * - has DEMO tag / badge / status / category / source / text marker
 * - out of service area according to isLeadInServiceArea(lead, profile)
 */
export function isBusinessLead(lead: ActionableLead | null | undefined, profile?: any): boolean {
  if (!lead) return false;

  // 1. Explicit demo flags or demo id prefix
  const isDemo = Boolean(
    lead.isDemo === true ||
    lead.id?.startsWith('dl-') ||
    lead.id?.startsWith('demo-')
  );
  if (isDemo) return false;

  // 2. DEMO tag, category, source, or text markers
  const tagUpper = String(lead.tag || '').toUpperCase().trim();
  if (tagUpper === 'DEMO' || tagUpper.includes('DEMO')) return false;

  const sourceUpper = String(lead.source || '').toUpperCase().trim();
  if (sourceUpper === 'DEMO' || sourceUpper.includes('DEMO')) return false;

  const categoryUpper = String(lead.category || '').toUpperCase().trim();
  if (categoryUpper === 'DEMO') return false;

  if (Array.isArray(lead.tags)) {
    const hasDemoTag = lead.tags.some((t: any) => String(t).toUpperCase().includes('DEMO'));
    if (hasDemoTag) return false;
  }

  const rawTextUpper = String(lead.text || lead.name || lead.client || '').toUpperCase();
  if (rawTextUpper.includes('[DEMO]') || rawTextUpper.includes('(DEMO)')) {
    return false;
  }

  // 3. Service area validation
  let activeProfile = profile;
  if (!activeProfile && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('lf_profile') || localStorage.getItem('user_profile');
      if (raw) activeProfile = JSON.parse(raw);
    } catch {}
  }

  const hasProfileLocation = Boolean(
    activeProfile?.city || 
    activeProfile?.location || 
    activeProfile?.state
  );

  if (hasProfileLocation) {
    return isLeadInServiceArea(lead, activeProfile);
  }

  // If no profile location is set, verify lead does not conflict with known out-of-zone regions
  const leadCity = normalizeText(lead.city);
  const leadLoc = normalizeText(lead.location);
  const leadText = normalizeText(lead.text || lead.inbound_message || lead.inboundMessage || '');
  const combinedLeadText = `${leadCity} ${leadLoc} ${leadText}`;
  for (const knownLoc of KNOWN_OUT_OF_ZONE_LOCATIONS) {
    if (combinedLeadText.includes(knownLoc)) return false;
  }
  return true;
}

/**
 * Validates whether a lead has real actionable contact channels.
 * True if it has phone, valid email, inbound message text, or whatsapp ID.
 * False if it's an empty placeholder or marked as INSUFFICIENT_DATA.
 */
export function isLeadActionable(lead: ActionableLead | null | undefined): boolean {
  if (!lead) return false;
  
  const phone = (lead.phone || '').trim();
  const email = (lead.email || '').trim();
  const text = (lead.text || lead.inbound_message || lead.inboundMessage || '').trim();
  const whatsapp = (lead.whatsapp || lead.whatsappChannelId || '').trim();

  // If text is purely placeholder or insufficient data indicator, ignore
  const isTextMeaningful = text.length >= 4 && 
    !text.toLowerCase().includes('insufficient_data') && 
    text !== '...' &&
    !text.toLowerCase().includes('sin mensaje');

  const hasPhone = phone.replace(/[^0-9]/g, '').length >= 7;
  const hasEmail = email.includes('@') && email.includes('.') && email.length >= 6;
  const hasWhatsapp = whatsapp.replace(/[^0-9]/g, '').length >= 7;

  return hasPhone || hasEmail || isTextMeaningful || hasWhatsapp;
}

/**
 * Returns true if a lead is in a state awaiting reply (e.g., NEW, PENDING, NEEDS_REPLY, CONTACTED)
 * AND has actionable contact data.
 */
export function isLeadAwaitingReply(lead: ActionableLead | null | undefined): boolean {
  if (!lead) return false;
  const st = (lead.status || 'NEW').toUpperCase().trim();
  const isAwaiting = ['NEW', 'NUEVO', 'PENDING', 'NEEDS_REPLY', 'AWAITING_REPLY', 'RESPONDED'].includes(st);
  return isAwaiting && isLeadActionable(lead);
}

/**
 * Sorts leads with priority to:
 * 1. In-zone real (non-demo) leads
 * 2. In-zone demo leads
 * 3. Out-of-zone real leads
 * 4. Out-of-zone demo leads
 * Then by status (awaiting reply first) and urgency / score.
 */
export function sortLeadsByZoneAndUrgency(leads: ActionableLead[] = [], profile?: any): ActionableLead[] {
  if (!Array.isArray(leads)) return [];
  return [...leads].sort((a, b) => {
    const aInZone = isLeadInZone(a, profile) ? 1 : 0;
    const bInZone = isLeadInZone(b, profile) ? 1 : 0;
    if (aInZone !== bInZone) {
      return bInZone - aInZone; // In-zone first
    }

    const aIsDemo = (a.isDemo || a.id?.startsWith('dl-') || a.id?.startsWith('demo-')) ? 1 : 0;
    const bIsDemo = (b.isDemo || b.id?.startsWith('dl-') || b.id?.startsWith('demo-')) ? 1 : 0;
    if (aIsDemo !== bIsDemo) {
      return aIsDemo - bIsDemo; // Real leads before demo
    }

    const aAwaiting = isLeadAwaitingReply(a) ? 1 : 0;
    const bAwaiting = isLeadAwaitingReply(b) ? 1 : 0;
    if (aAwaiting !== bAwaiting) {
      return bAwaiting - aAwaiting; // Awaiting reply first
    }

    const aScore = a.score || (a.urgency === 'Alta' ? 90 : a.urgency === 'Media' ? 60 : 30);
    const bScore = b.score || (b.urgency === 'Alta' ? 90 : b.urgency === 'Media' ? 60 : 30);
    return bScore - aScore;
  });
}

/**
 * Returns all real, actionable leads strictly within the user's service area awaiting reply.
 * Demo leads and out-of-zone leads are excluded from priority reply alerts.
 */
export function getActionableLeadsAwaitingReply(leads: ActionableLead[] = [], profile?: any): ActionableLead[] {
  if (!Array.isArray(leads)) return [];
  const awaiting = leads.filter(l => isBusinessLead(l, profile) && isLeadAwaitingReply(l));
  return sortLeadsByZoneAndUrgency(awaiting, profile);
}

/**
 * Returns all actionable leads awaiting reply across any zone, sorted by zone preference.
 */
export function getAllActionableLeads(leads: ActionableLead[] = [], profile?: any): ActionableLead[] {
  if (!Array.isArray(leads)) return [];
  const awaiting = leads.filter(isLeadAwaitingReply);
  return sortLeadsByZoneAndUrgency(awaiting, profile);
}

/**
 * Returns a clean, truthful business or client name.
 * Avoids showing fake generic names like "Unnam... Local" as if it were a real company.
 */
export function getLeadDisplayName(lead: ActionableLead | null | undefined, lang: 'es' | 'en' = 'en'): { name: string; isNeedsInfo: boolean } {
  if (!lead) {
    return { name: lang === 'es' ? 'Lead requiere información' : 'Lead needs info', isNeedsInfo: true };
  }

  const rawName = (lead.businessName || lead.client || lead.name || '').trim();
  const isGeneric = !rawName || 
    rawName.toLowerCase().includes('unnamed') || 
    rawName.toLowerCase().includes('sin nombre') ||
    rawName.toLowerCase() === 'local' ||
    rawName.toLowerCase() === 'unnamed / local' ||
    rawName.toLowerCase() === 'unnam... local' ||
    rawName.toLowerCase() === 'prospecto';

  if (isGeneric) {
    const source = lead.source ? ` (${lead.source})` : '';
    const fallback = lang === 'es' ? `Lead requiere info${source}` : `Lead needs info${source}`;
    return { name: fallback, isNeedsInfo: true };
  }

  return { name: rawName, isNeedsInfo: false };
}

export interface RouteToAnswerLeadsOptions {
  setActiveTab: (tab: any) => void;
  setActiveSubRow?: (subRow: number) => void;
  setSelectedMobileView?: (view: 'tab' | 'menu') => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  lang?: 'es' | 'en';
  profile?: any;
  targetLeadId?: string;
  focusFirstLead?: boolean;
}

/**
 * Central router for "Answer Leads", "Contact Leads", and CRM notifications.
 *
 * Rules:
 * 1. If explicit targetLeadId: opens CRM inbox and focuses that exact lead.
 * 2. If 0 actionable leads: opens CRM inbox filtered to ALL.
 * 3. If 1 actionable lead (or focusFirstLead): navigates to CRM Inbox and auto-opens reply/detail for the top in-zone lead.
 * 4. If >= 2 actionable leads without focusFirstLead: navigates to CRM Inbox with filter=NEW pre-applied.
 */
export function routeToAnswerLeads(
  leads: ActionableLead[] = [],
  options: RouteToAnswerLeadsOptions
): void {
  const { 
    setActiveTab, 
    setActiveSubRow, 
    setSelectedMobileView, 
    showToast, 
    lang = 'en',
    profile,
    targetLeadId,
    focusFirstLead
  } = options;

  // Direct specific lead routing
  if (targetLeadId) {
    const specificLead = leads.find(l => l.id === targetLeadId);
    try {
      localStorage.setItem('crm_lead_filter', 'ALL');
      localStorage.setItem('crm_open_lead_id', targetLeadId);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('bvelt_open_lead', { detail: { leadId: targetLeadId } }));
    } catch (e) {
      // storage safety
    }

    setActiveTab('leads');
    if (setActiveSubRow) setActiveSubRow(4); // 4 = CRM Inbox
    if (setSelectedMobileView) setSelectedMobileView('tab');

    if (showToast && specificLead) {
      const nameObj = getLeadDisplayName(specificLead, lang);
      showToast(
        lang === 'es'
          ? `Abriendo lead: ${nameObj.name}`
          : `Opening lead: ${nameObj.name}`,
        'info'
      );
    }
    return;
  }

  const actionableAwaiting = getActionableLeadsAwaitingReply(leads, profile);

  if (actionableAwaiting.length === 0) {
    // Navigate to general CRM Inbox
    try {
      localStorage.setItem('crm_lead_filter', 'ALL');
      localStorage.removeItem('crm_open_lead_id');
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      // storage safety
    }

    setActiveTab('leads');
    if (setActiveSubRow) setActiveSubRow(4); // 4 = CRM Inbox
    if (setSelectedMobileView) setSelectedMobileView('tab');

    if (showToast) {
      showToast(
        lang === 'es'
          ? 'No hay leads pendientes de respuesta urgente.'
          : 'No pending leads awaiting reply.',
        'info'
      );
    }
    return;
  }

  if (actionableAwaiting.length === 1 || focusFirstLead) {
    const targetLead = actionableAwaiting[0];
    try {
      localStorage.setItem('crm_lead_filter', 'NEW');
      localStorage.setItem('crm_open_lead_id', targetLead.id);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('bvelt_open_lead', { detail: { leadId: targetLead.id } }));
    } catch (e) {
      // storage safety
    }

    setActiveTab('leads');
    if (setActiveSubRow) setActiveSubRow(4);
    if (setSelectedMobileView) setSelectedMobileView('tab');

    if (showToast) {
      const nameObj = getLeadDisplayName(targetLead, lang);
      showToast(
        lang === 'es'
          ? `Abriendo lead: ${nameObj.name}`
          : `Opening lead: ${nameObj.name}`,
        'info'
      );
    }
    return;
  }

  // Case: >= 2 actionable leads (without explicit focus)
  try {
    localStorage.setItem('crm_lead_filter', 'NEW');
    localStorage.removeItem('crm_open_lead_id');
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    // storage safety
  }

  setActiveTab('leads');
  if (setActiveSubRow) setActiveSubRow(4);
  if (setSelectedMobileView) setSelectedMobileView('tab');

  if (showToast) {
    showToast(
      lang === 'es'
        ? `Mostrando ${actionableAwaiting.length} leads nuevos por responder`
        : `Showing ${actionableAwaiting.length} new leads awaiting reply`,
      'info'
    );
  }
}
