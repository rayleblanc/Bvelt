/**
 * PriorityQueueService - Single data-driven priority queue for Bvelt
 *
 * Ranks items by urgency:
 * 1. Actionable leads awaiting reply (real count > 0)
 * 2. First incomplete First-Week launch checklist item
 * 3. Recommended Next Best Action #1 (from ActionEngine or Profile completion)
 *
 * Supports single-day dismissal persistence with automatic re-appearance on new data.
 */

import { ActionableLead, getActionableLeadsAwaitingReply } from '../lib/navigation/routeToAnswerLeads';
import { getVerticalConfig } from '../knowledge/verticals';

export interface PriorityItem {
  id: string;
  dismissKey: string;
  badge?: string;
  badgeColor?: string;
  title: string;
  desc: string;
  actionLabel: string;
  tab: string;
  subRow?: number;
  icon: 'leads' | 'checklist' | 'zap' | 'profile';
  rank: 1 | 2 | 3 | 4;
  leadId?: string;
  itemData?: any;
}

/**
 * Checks if a specific priority key was dismissed for today (YYYY-MM-DD).
 */
export function isPriorityDismissed(dismissKey: string): boolean {
  try {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem(`bvelt_dismissed_priority_${dismissKey}`);
    return saved === today;
  } catch (e) {
    return false;
  }
}

/**
 * Marks a priority key as dismissed for the current day.
 */
export function dismissPriority(dismissKey: string): void {
  try {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`bvelt_dismissed_priority_${dismissKey}`, today);
  } catch (e) {
    // storage safety
  }
}

/**
 * Resolves the top active priority item from real application data.
 */
export function getTopPriorityItem(params: {
  leads: ActionableLead[];
  profile: any;
  lang?: 'es' | 'en';
  topAction?: any;
}): PriorityItem | null {
  const { leads = [], profile = {}, lang = 'en', topAction = null } = params;
  const isEn = lang === 'en';

  // 1. RANK 1: Actionable leads awaiting reply (prioritizing user's local zone)
  const actionableLeads = getActionableLeadsAwaitingReply(leads, profile);
  const actionableCount = actionableLeads.length;

  if (actionableCount > 0) {
    const topLead = actionableLeads[0];
    const dismissKey = `leads_awaiting_${actionableCount}`;
    if (!isPriorityDismissed(dismissKey)) {
      return {
        id: 'task_actionable_leads',
        dismissKey,
        rank: 1,
        badge: `${actionableCount}`,
        badgeColor: 'bg-rose-500',
        title: isEn
          ? `${actionableCount} New lead${actionableCount > 1 ? 's' : ''} awaiting reply`
          : `${actionableCount} Lead${actionableCount > 1 ? 's' : ''} nuevo${actionableCount > 1 ? 's' : ''} por responder`,
        desc: isEn
          ? 'Fast replies win the job before competitors answer'
          : 'Responde rápido para asegurar el trabajo antes de tu competencia',
        actionLabel: isEn ? 'Answer Leads' : 'Atender Leads',
        tab: 'leads',
        subRow: 4, // CRM Inbox
        icon: 'leads',
        leadId: topLead?.id,
        itemData: { actionableCount, actionableLeads, topLeadId: topLead?.id },
      };
    }
  }

  // 2. RANK 2: First incomplete launch checklist item / Direct Demand Capture on Day 1
  const category = profile?.category || profile?.niche || 'general';
  const verticalConfig = getVerticalConfig(category);
  const checklistDef = verticalConfig.checklist || [];

  let savedChecklist: any[] = [];
  try {
    const raw = localStorage.getItem('bvelt_first_week_checklist');
    if (raw) savedChecklist = JSON.parse(raw);
  } catch (e) {
    savedChecklist = [];
  }

  const firstIncomplete = checklistDef.find((item) => {
    const fromStorage = savedChecklist.find((s) => s.id === item.id);
    const fromProfile = profile?.firstWeekChecklist?.[item.id];
    const isCompleted = Boolean(fromProfile ?? fromStorage?.completed ?? item.completed);
    return !isCompleted;
  });

  if (firstIncomplete) {
    const dismissKey = `first_week_${firstIncomplete.id}`;
    if (!isPriorityDismissed(dismissKey)) {
      let itemTitle = isEn ? firstIncomplete.titleEn : firstIncomplete.titleEs;
      let itemDesc = isEn ? firstIncomplete.descEn : firstIncomplete.descEs;
      let actionLabel = isEn ? 'Start Step' : 'Iniciar Paso';
      let targetTab = 'action_center';
      let targetSubRow: number | undefined = 0;

      // When 0 actionable business leads exist, prioritize direct demand capture (Analyze Message or Website) over pure map audit
      if (firstIncomplete.actionType === 'audit' || firstIncomplete.id === 'day_1') {
        if (actionableCount === 0) {
          itemTitle = isEn ? 'Day 1: Capture Inbound Demand (Analyze Message)' : 'Día 1: Captar Demanda Directa (Analizar Mensaje)';
          itemDesc = isEn ? 'Paste customer WhatsApp or message to estimate price and capture direct job' : 'Pega un WhatsApp o correo para cotizar precio y captar el trabajo de inmediato';
          actionLabel = isEn ? 'Analyze Message' : 'Analizar Mensaje';
          targetTab = 'leads';
          targetSubRow = 0;
        } else {
          targetTab = 'business_scan';
          targetSubRow = undefined;
        }
      } else if (firstIncomplete.actionType === 'actions') {
        targetTab = 'action_center';
      } else if (firstIncomplete.actionType === 'review') {
        targetTab = 'reviews';
        targetSubRow = undefined;
      } else if (firstIncomplete.actionType === 'competitor') {
        targetTab = 'radar';
        targetSubRow = 0;
      }

      return {
        id: `task_first_week_${firstIncomplete.id}`,
        dismissKey,
        rank: 2,
        badge: isEn ? 'DAY 1' : 'DÍA 1',
        badgeColor: 'bg-indigo-600',
        title: itemTitle,
        desc: itemDesc,
        actionLabel,
        tab: targetTab,
        subRow: targetSubRow,
        icon: 'checklist',
        itemData: firstIncomplete,
      };
    }
  }

  // 3. RANK 3 (Order c): Recommended action #1 from diagnosis
  if (topAction) {
    const dismissKey = `nba_${topAction.id || 'top'}`;
    if (!isPriorityDismissed(dismissKey)) {
      return {
        id: `task_nba_${topAction.id || 'top'}`,
        dismissKey,
        rank: 3,
        badge: '1',
        badgeColor: 'bg-indigo-500',
        title: topAction.title || (isEn ? 'Priority Growth Action' : 'Acción Prioritaria de Crecimiento'),
        desc: topAction.reason || topAction.description || (isEn ? 'Boost your local visibility' : 'Potencia tu visibilidad local'),
        actionLabel: topAction.actionLabel || topAction.ctaLabel || (isEn ? 'Execute Action' : 'Ejecutar Acción'),
        tab: topAction.targetTab || 'action_center',
        subRow: topAction.targetSubRow,
        icon: 'zap',
        itemData: topAction,
      };
    }
  }

  // 4. RANK 4 (Order d): Start Quick Onboarding if profile incomplete
  const missingProfile = !profile?.isOnboarded || !profile?.name || profile?.name === 'Local Business' || !profile?.phone || !profile?.location || !profile?.category || profile?.category === 'otro';
  if (missingProfile) {
    const dismissKey = 'profile_completion';
    if (!isPriorityDismissed(dismissKey)) {
      return {
        id: 'task_profile',
        dismissKey,
        rank: 4,
        badge: '1',
        badgeColor: 'bg-amber-500',
        title: isEn ? 'Start Quick Onboarding' : 'Iniciar Onboarding Rápido',
        desc: isEn ? 'Location and trade category required for local market radar' : 'Ubicación y categoría requeridas para calibrar el radar local',
        actionLabel: isEn ? 'Start' : 'Iniciar',
        tab: 'onboarding',
        icon: 'profile',
      };
    }
  }

  return null;
}
