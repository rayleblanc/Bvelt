import React, { useState, useEffect } from 'react';
import { Zap, Clock, CheckCircle, ArrowRight, Play, SkipForward, AlertCircle, History, CheckSquare, Sparkles } from 'lucide-react';
import { getEvidenceBadge, EvidenceStatus } from '../lib/bveltEvidence';
import { logBveltActivity, loadBveltCore } from '../lib/bveltCore';
import { ActionEngine, ActionOutcomeType } from '../knowledge/engine/actionEngine';
import { OutcomeLedgerService } from '../knowledge/memory/outcomeLedgerService';
import { AutonomyPolicyEngine, ActionEngineToolId } from '../knowledge/engine/autonomyPolicy';
import { ActionResolutionModal } from './dashboard/ActionResolutionModal';
import { AgentReadinessChecklist } from './dashboard/AgentReadinessChecklist';
import { navigateTo } from '../lib/navigation/navigateTo';

interface BveltActionCenterProps {
  growthActions?: any[];
  setGrowthActions?: any;
  setActiveTab?: (tab: any) => void;
  setActiveSubRow?: (subRow: any) => void;
  leads?: any[];
  profile?: any;
  growthStats?: any;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenGmbModal?: () => void;
  onRunSeoAudit?: () => void;
  onExecuteAction?: (action: any) => void;
  t?: (es: string, en: string) => string;
}

// Helpers to map actions to canonical system schemas
const mapActionToToolId = (actionId: string, actionType?: string): ActionEngineToolId => {
  const idLower = actionId.toLowerCase();
  const typeLower = (actionType || '').toLowerCase();
  if (idLower.includes('lead') || typeLower.includes('outreach') || typeLower.includes('follow')) {
    return 'draft_lead_follow_up';
  }
  if (idLower.includes('review') || typeLower.includes('reply') || idLower.includes('response')) {
    return 'draft_review_response';
  }
  if (idLower.includes('estimate') || typeLower.includes('estimator') || idLower.includes('quote')) {
    return 'create_estimate_follow_up';
  }
  return 'request_review_after_completed_job';
};

const mapMeasureToOutcomeType = (type: string): ActionOutcomeType => {
  if (type === 'Call booked') return 'SCHEDULED';
  if (type === 'Client won') return 'WON';
  if (type === 'Revenue recorded') return 'WON';
  if (type === 'Response') return 'REPLIED';
  if (type === 'No response') return 'DISMISSED';
  return 'CONTACTED';
};

export const BveltActionCenter: React.FC<BveltActionCenterProps> = ({
  growthActions = [],
  setGrowthActions = (_actions: any) => {},
  setActiveTab = (_tab: string) => {},
  setActiveSubRow,
  leads = [],
  profile,
  growthStats,
  showToast,
  onOpenGmbModal,
  onRunSeoAudit,
  onExecuteAction,
  t = (es: string, en: string) => es
}) => {
  const [modalAction, setModalAction] = useState<any | null>(null);
  const [skipModalActionId, setSkipModalActionId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState<string>('Not relevant');
  const [measureModalActionId, setMeasureModalActionId] = useState<string | null>(null);
  const [measureOutcomeType, setMeasureOutcomeType] = useState<string>('Response');
  const [measureResultValue, setMeasureResultValue] = useState<string>('');
  const [measureEvidence, setMeasureEvidence] = useState<string>('VERIFIED_OUTCOME');
  const [showAgentReadiness, setShowAgentReadiness] = useState<boolean>(true);
  
  const [actionHistory, setActionHistory] = useState<any[]>(() => {
    try {
      const core = loadBveltCore();
      return core.activityHistory || [];
    } catch (e) {
      return [];
    }
  });

  // ActionEngine local state synchronization
  const [engineActions, setEngineActions] = useState<any[]>(() => {
    const stored = ActionEngine.getStoredActions();
    if (stored && stored.length > 0) {
      return stored;
    }
    
    // Fallback & Bootstrap initial state from legacy prop
    const legacy = Array.isArray(growthActions) ? growthActions : [];
    const converted = legacy.map(ga => ({
      id: ga.id,
      opportunityId: ga.opportunityId || ga.id,
      title: ga.title || ga.action,
      description: ga.description || '',
      category: ga.category || (ga.id.includes('profile') ? t('Perfil', 'Profile') : ga.id.includes('lead') ? t('CRM & Leads', 'CRM & Leads') : t('Reputación', 'Reputation')),
      whyThisMatters: ga.whyItMatters || ga.whyThisMatters || '',
      whyNow: ga.whyNow || '',
      actionType: ga.actionType || (ga.id.includes('lead') ? 'OUTREACH' : ga.id.includes('review') ? 'REVIEW_REQUEST' : 'PROFILE_OPTIMIZATION'),
      priority: ga.priority || 'MEDIUM',
      impactFormatted: ga.impact || 'MEDIUM',
      destination: { tab: ga.actionTab || 'leads' },
      status: ga.status === 'TODO' ? 'PENDING' : ga.status,
      context: {
        businessName: profile?.name || profile?.businessName || 'Local Business',
        category: profile?.category || 'General Services',
        location: profile?.location || profile?.city || 'Local Market',
      },
      outreach: ActionEngine.generateOutreach(
        ga.actionType || 'OUTREACH',
        {
          businessName: profile?.name || profile?.businessName || 'Local Business',
          category: profile?.category || 'General Services',
          location: profile?.location || profile?.city || 'Local Market',
        }
      ),
      createdAt: ga.createdAt || new Date().toISOString(),
      updatedAt: ga.updatedAt || new Date().toISOString()
    }));
    
    if (converted.length > 0) {
      ActionEngine.saveActions(converted);
    }
    return converted;
  });

  // Keep legacy/parent system synchronized
  const updateActionState = (updatedList: any[]) => {
    setEngineActions(updatedList);
    ActionEngine.saveActions(updatedList);
    
    if (setGrowthActions) {
      setGrowthActions(updatedList.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category || (a.id.includes('profile') ? t('Perfil', 'Profile') : a.id.includes('lead') ? t('CRM & Leads', 'CRM & Leads') : t('Reputación', 'Reputation')),
        priority: a.priority,
        impact: a.impactFormatted || 'HIGH',
        estimatedMinutes: a.estimatedMinutes || 5,
        source: a.source || 'ActionEngine',
        status: a.status === 'PENDING' ? 'TODO' : a.status,
        completedAt: a.updatedAt,
        whyItMatters: a.whyThisMatters,
        whyNow: a.whyNow,
        actionTab: a.destination?.tab || 'leads',
        measurementStatus: a.measurementStatus,
        resultType: a.resultType,
        resultValue: a.resultValue
      })));
    }
  };

  // Refresh history on mount or action changes
  useEffect(() => {
    try {
      const core = loadBveltCore();
      setActionHistory(core.activityHistory || []);
    } catch (e) {}
  }, [engineActions]);

  // Enhanced actions with deterministic priority & evidence
  const enhancedActions = engineActions.map((act) => {
    const isCompleted = act.status === 'COMPLETED' || act.completedAt;
    const isSkipped = act.status === 'SKIPPED';
    const status = isCompleted ? 'COMPLETED' : isSkipped ? 'SKIPPED' : act.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ACTIONABLE';
    
    // Evidence mapping based on category/source
    let evidenceStatus: EvidenceStatus = 'DERIVED';
    let source = act.source || 'Bvelt Engine';
    if (act.id.includes('profile') || act.category === t('Perfil', 'Profile')) {
      evidenceStatus = 'VERIFIED';
      source = 'Business Profile';
    } else if (act.id.includes('lead') || act.category === t('CRM & Leads', 'CRM & Leads')) {
      evidenceStatus = 'DERIVED';
      source = 'CRM Real Leads';
    } else if (act.id.includes('review') || act.category === t('Reputación', 'Reviews')) {
      evidenceStatus = 'ESTIMATED';
      source = 'Reputation Engine';
    } else {
      evidenceStatus = 'ESTIMATED';
      source = 'Growth Loop';
    }

    let priorityScore = act.priority === 'HIGH' ? 90 : act.priority === 'MEDIUM' ? 60 : 30;

    const titleLower = (act.title || act.recommendedAction || '').toLowerCase();
    const isWebsiteDone = Boolean(profile?.website || profile?.websitePublished || profile?.hasWebsite);
    const isReviewDone = Boolean(localStorage.getItem('bvelt_review_requested') === 'true' || profile?.hasReviewLink);

    if (isWebsiteDone && (titleLower.includes('website') || titleLower.includes('sitio web'))) {
      priorityScore -= 40;
    }
    if (isReviewDone && (titleLower.includes('review') || titleLower.includes('reseña') || titleLower.includes('qr'))) {
      priorityScore -= 30;
    }

    return {
      ...act,
      status,
      evidenceStatus,
      source,
      priorityScore,
      whyItMatters: act.whyThisMatters || act.whyItMatters || t(`Por qué importa: completar esta tarea fortalece la velocidad operativa y la salud de confianza local.`, `Why it matters: completing this task strengthens operational velocity and local trust health.`),
      whyNow: act.whyNow || t(`Por qué ahora: prioridad activa en cola y fricción no registrada en esta área.`, `Why now: active queue priority and unrecorded friction in this area.`),
      recommendedAction: act.recommendedAction || act.title
    };
  });

  const actionableList = enhancedActions.filter(a => a.status === 'ACTIONABLE' || a.status === 'IN_PROGRESS');
  actionableList.sort((a, b) => b.priorityScore - a.priorityScore);

  const topAction = actionableList[0] || null;
  const nextActions = actionableList.slice(1, 4);
  const upNextList = actionableList.slice(4);
  const completedList = enhancedActions.filter(a => a.status === 'COMPLETED').slice(-5).reverse();

  // Handlers
  const handleTakeAction = (action: any) => {
    const businessId = profile?.id || 'default_business';
    const toolId = mapActionToToolId(action.id, action.actionType);

    // 1. Evaluate Autonomy Policy before taking any execution action
    const policyDecision = AutonomyPolicyEngine.evaluate(businessId, toolId, {
      isExternal: true,
      operatorApproved: true
    });

    if (!policyDecision.permitted) {
      if (showToast) {
        showToast(t(`Acción bloqueada por Política de Autonomía: ${policyDecision.reason}`, `Action blocked by Autonomy Policy: ${policyDecision.reason}`), 'error');
      }
      
      // Record blocked action in Outcome Ledger
      OutcomeLedgerService.recordExecution({
        businessId,
        toolId,
        actionId: action.id,
        executionState: 'BLOCKED_BY_POLICY',
        outcomeState: 'UNKNOWN',
        metricName: action.id.includes('lead') ? 'LEADS' : action.id.includes('review') ? 'REVIEWS' : 'SYSTEM',
        outcomeType: 'ACTION_BLOCKED_BY_POLICY',
        description: `Action execution blocked: ${policyDecision.reason}`,
        providerCostUsd: 0.0,
        businessName: profile?.name || profile?.businessName,
        city: profile?.location || profile?.city,
        tenantUid: profile?.tenantUid
      });
      return;
    }

    // 2. Mark in progress via ActionEngine
    const updated = engineActions.map(a => a.id === action.id ? { ...a, status: 'IN_PROGRESS', updatedAt: new Date().toISOString() } : a);
    updateActionState(updated);
    
    logBveltActivity('ACTION_IN_PROGRESS', `Started working on action: ${action.title}`, action.id);

    const isReview = action.id?.toLowerCase().includes('review') || action.category === 'Reputación';
    const isQuote = action.id?.toLowerCase().includes('quote') || action.id?.toLowerCase().includes('estimate');
    const isLead = action.id?.toLowerCase().includes('lead') || action.category === 'CRM & Leads';
    const destinationCode = isReview ? 'REQUEST_REVIEW' : isQuote ? 'SEND_QUOTE' : 'CONTACT_LEAD';

    const normalizedAction = {
      id: action.id,
      action: action.title,
      whyNow: action.whyNow || action.description || t('Acción prioritaria para capturar clientes locales.', 'Priority action to capture local clients.'),
      expectedBenefit: action.expectedBenefit || t('+1 Oportunidad Comercial', '+1 Commercial Opportunity'),
      destinationCode: destinationCode,
      contextData: { 
        leadName: action.leadName || t('Cliente Potencial', 'Potential Client'), 
        phone: action.phone || '' 
      }
    };

    const actionText = (action.title || action.recommendedAction || action.action || '').toLowerCase();
    
    let destTab = 'dashboard';
    let destSubRow: number | undefined = undefined;

    if (actionText.includes('website') || actionText.includes('sitio web')) {
      destTab = 'website';
    } else if (actionText.includes('dormant') || actionText.includes('reactivat') || actionText.includes('inactivo') || actionText.includes('cliente anterior')) {
      destTab = 'leads';
      destSubRow = 5;
    } else if (actionText.includes('review') || actionText.includes('reseña') || actionText.includes('qr')) {
      destTab = 'reviews';
      destSubRow = 0;
    } else if (actionText.includes('estimate') || actionText.includes('cotiz') || actionText.includes('presupuesto')) {
      destTab = 'leads';
      destSubRow = 5;
    } else if (actionText.includes('rank') || actionText.includes('zonal') || actionText.includes('rango') || actionText.includes('competidor') || actionText.includes('mapa') || actionText.includes('radar') || actionText.includes('scan')) {
      destTab = 'business_scan';
    } else if (actionText.includes('lead') || actionText.includes('prospecto') || actionText.includes('cliente') || actionText.includes('analyze message') || actionText.includes('analizar mensaje')) {
      destTab = 'leads';
      destSubRow = 4;
    } else if (actionText.includes('profile') || actionText.includes('perfil') || actionText.includes('oficio') || actionText.includes('zona')) {
      destTab = 'profile';
    } else {
      const rawTab = action.destination?.tab || action.targetTab || action.actionTab;
      destTab = typeof rawTab === 'string' ? rawTab : (rawTab?.tab || 'action_center');
      destSubRow = action.destination?.subRow ?? action.targetSubRow;
    }

    const targetLeadId = action.leadId || action.contextData?.leadId;
    const targetRadius = action.payload?.targetRadius || action.radiusKm;

    navigateTo({
      tab: destTab,
      subRow: destSubRow,
      leadId: targetLeadId,
      radiusKm: targetRadius,
      tool: action.tool
    });

    if (setActiveTab) setActiveTab(destTab);
    if (setActiveSubRow && destSubRow !== undefined) setActiveSubRow(destSubRow);

    if (onExecuteAction) {
      onExecuteAction(normalizedAction);
    }
  };

  const handleCompleteAction = (actionId: string) => {
    const nowIso = new Date().toISOString();
    const action = engineActions.find(a => a.id === actionId);

    const updated = engineActions.map(a => a.id === actionId ? {
      ...a,
      status: 'COMPLETED',
      completedAt: nowIso,
      updatedAt: nowIso,
      measurementStatus: 'PENDING_MEASUREMENT'
    } : a);
    
    updateActionState(updated);

    if (action) {
      logBveltActivity('ACTION_COMPLETED', `Completed action: ${action.title}. Pending measurement.`, action.id);
      
      // Record completed action state in Outcome Ledger
      const businessId = profile?.id || 'default_business';
      const toolId = mapActionToToolId(action.id, action.actionType);
      
      OutcomeLedgerService.recordExecution({
        businessId,
        toolId,
        actionId: action.id,
        executionState: 'SUCCESS',
        outcomeState: 'ESTIMATED',
        metricName: action.id.includes('lead') ? 'LEADS' : action.id.includes('review') ? 'REVIEWS' : 'SYSTEM',
        outcomeType: 'ACTION_COMPLETED_PENDING_MEASUREMENT',
        description: `Action completed successfully, awaiting measurement: ${action.title}`,
        providerCostUsd: 0.0,
        businessName: profile?.name || profile?.businessName,
        city: profile?.location || profile?.city,
        tenantUid: profile?.tenantUid
      });
    }

    if (showToast) {
      showToast(t('¡Acción completada! Ahora puedes medir su impacto comercial.', 'Action completed! You can now measure its commercial impact.'), 'success');
    }
  };

  const handleOpenMeasureModal = (actionId: string) => {
    setMeasureModalActionId(actionId);
    setMeasureOutcomeType('Response');
    setMeasureResultValue('');
    setMeasureEvidence('VERIFIED_OUTCOME');
  };

  const handleConfirmMeasure = () => {
    if (!measureModalActionId) return;
    const nowIso = new Date().toISOString();
    const action = engineActions.find(a => a.id === measureModalActionId);

    if (!action) return;

    const mappedType = measureOutcomeType === 'Call booked' ? 'CALL_BOOKED' : measureOutcomeType === 'Client won' ? 'CLIENT_WON' : measureOutcomeType === 'Revenue recorded' ? 'REVENUE_RECORDED' : measureOutcomeType === 'Response' ? 'RESPONDED' : measureOutcomeType === 'No response' ? 'NO_RESPONSE' : 'OTHER';
    const outcomeTypeCanonical = mapMeasureToOutcomeType(measureOutcomeType);
    const revenueVal = (measureOutcomeType === 'Revenue recorded' || measureOutcomeType === 'Client won') && measureResultValue ? parseFloat(measureResultValue) : 0;

    // 1. Update in ActionEngine
    const updated = engineActions.map(a => a.id === measureModalActionId ? {
      ...a,
      measurementStatus: measureEvidence,
      resultType: measureOutcomeType,
      resultValue: measureResultValue,
      status: 'COMPLETED',
      updatedAt: nowIso,
      outcome: {
        outcomeType: outcomeTypeCanonical,
        revenueRecorded: revenueVal,
        contactMethod: 'whatsapp',
        notes: `Measured outcome: ${measureOutcomeType} with evidence ${measureEvidence}`,
        recordedAt: nowIso
      }
    } : a);
    
    updateActionState(updated);

    // 2. Log Bvelt Activity
    logBveltActivity('OUTCOME_MEASURED', `Measured outcome for: ${action.title} [Result: ${measureOutcomeType}]`, action.id);

    // 3. Persist to canonical Outcome Ledger using the OutcomeLedgerService
    const businessId = profile?.id || 'default_business';
    const toolId = mapActionToToolId(action.id, action.actionType);

    OutcomeLedgerService.recordExecution({
      businessId,
      toolId,
      actionId: action.id,
      executionState: 'SUCCESS',
      outcomeState: measureEvidence === 'VERIFIED_OUTCOME' ? 'MEASURED' : 'DECLARED',
      metricName: action.id.includes('lead') ? 'LEADS' : action.id.includes('review') ? 'REVIEWS' : 'SYSTEM',
      outcomeType: mappedType,
      description: `Business Outcome Measured: ${action.title} (${measureOutcomeType})`,
      value: revenueVal > 0 ? revenueVal : null,
      providerCostUsd: 0.0,
      businessName: profile?.name || profile?.businessName,
      city: profile?.location || profile?.city,
      tenantUid: profile?.tenantUid,
      metadata: {
        evidenceLevel: measureEvidence,
        resultType: measureOutcomeType,
        resultValue: measureResultValue
      }
    });

    setMeasureModalActionId(null);
    if (showToast) {
      showToast(t('¡Impacto comercial registrado y verificado!', 'Commercial impact measured and verified!'), 'success');
    }
  };

  const handleOpenSkipModal = (actionId: string) => {
    setSkipModalActionId(actionId);
    setSkipReason('Not relevant');
  };

  const handleConfirmSkip = () => {
    if (!skipModalActionId) return;
    const nowIso = new Date().toISOString();
    const action = engineActions.find(a => a.id === skipModalActionId);

    const updated = engineActions.map(a => a.id === skipModalActionId ? {
      ...a,
      status: 'SKIPPED',
      skippedAt: nowIso,
      updatedAt: nowIso,
      skipReason: skipReason
    } : a);
    
    updateActionState(updated);

    if (action) {
      logBveltActivity('ACTION_SKIPPED', `Skipped action: ${action.title} [Reason: ${skipReason}]`, action.id);
      
      // Record skip in Outcome Ledger
      const businessId = profile?.id || 'default_business';
      const toolId = mapActionToToolId(action.id, action.actionType);
      
      OutcomeLedgerService.recordExecution({
        businessId,
        toolId,
        actionId: action.id,
        executionState: 'SUCCESS',
        outcomeState: 'DECLARED',
        metricName: action.id.includes('lead') ? 'LEADS' : action.id.includes('review') ? 'REVIEWS' : 'SYSTEM',
        outcomeType: 'ACTION_SKIPPED',
        description: `Action skipped by operator: ${action.title}. Reason: ${skipReason}`,
        providerCostUsd: 0.0,
        businessName: profile?.name || profile?.businessName,
        city: profile?.location || profile?.city,
        tenantUid: profile?.tenantUid
      });
    }

    setSkipModalActionId(null);
    if (showToast) {
      showToast(t('Acción marcada como omitida.', 'Action marked as skipped.'), 'info');
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f172a]/90 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-indigo-500/30 p-6 md:p-8 shadow-xl space-y-8 mt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {t("Centro de Acción Bvelt", "Bvelt Action Center")}
            </h2>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t("Datos → Evidencia → Señal → Oportunidad → Acción → Resultado → Medición. Ejecuta al instante.", "Data → Evidence → Signal → Opportunity → Action → Outcome → Measure. Execute prioritized growth actions instantly.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAgentReadiness(!showAgentReadiness)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              showAgentReadiness
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>🤖 {t("Agent Readiness", "Agent Readiness")}</span>
          </button>
          <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5">
            <CheckSquare size={14} />
            <span>{enhancedActions.filter(a => a.status === 'COMPLETED').length} / {enhancedActions.length} {t("Completadas", "Completed")}</span>
          </div>
        </div>
      </div>

      {/* AGENT READINESS SECTION (Verifiable Checklist) */}
      {showAgentReadiness && (
        <div className="space-y-3">
          <AgentReadinessChecklist
            profile={profile}
            gmbConnected={Boolean(profile?.gmbConnected || profile?.gbpConnectionStatus === 'CONNECTED')}
            gmbReviews={profile?.gmbReviews || []}
            onNavigateTab={setActiveTab}
            onOpenGmbModal={onOpenGmbModal}
            t={t}
            showToast={showToast}
          />
        </div>
      )}

      {/* TODAY SECTION: Highest priority action + Next 3 recommended */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-500" />
            <span>{t("HOY • Prioridad Alta y Recomendaciones Inmediatas", "TODAY • Highest Priority & Immediate Recommendations")}</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-400">
            {actionableList.length} {t("acciones disponibles", "actionable items")}
          </span>
        </div>

        {topAction ? (
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 text-white rounded-2xl p-6 border border-indigo-500/40 shadow-xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-10">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase tracking-wider">
                  ⭐ {t("MAYOR PRIORIDAD HOY", "HIGHEST PRIORITY TODAY")}
                </span>
                {(() => {
                  const badge = getEvidenceBadge(topAction.evidenceStatus);
                  return (
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${badge.colorClass}`}>
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-300 font-medium">
                <span>⏱️ ~{topAction.estimatedMinutes || 5} min</span>
                <span>•</span>
                <span>{t("Fuente:", "Source:")} <strong className="text-indigo-300">{topAction.source}</strong></span>
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <h4 className="text-lg font-black tracking-tight text-white">
                {topAction.title}
              </h4>
              <p className="text-xs text-slate-300">
                {topAction.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl space-y-1">
                <span className="text-[9px] font-black uppercase text-indigo-300 tracking-wider block">
                  💡 {t("Por qué importa", "Why It Matters")}
                </span>
                <p className="text-[11px] text-slate-200 italic">
                  {topAction.whyItMatters}
                </p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl space-y-1">
                <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider block">
                  ⚡ {t("Por qué ahora", "Why Now")}
                </span>
                <p className="text-[11px] text-amber-200 font-medium">
                  {topAction.whyNow}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="text-xs font-bold text-indigo-200">
                {t("Recomendación:", "Recommended:")} {topAction.recommendedAction}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenSkipModal(topAction.id)}
                  className="bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  {t('Omitir', 'Skip')}
                </button>
                <button
                  onClick={() => handleCompleteAction(topAction.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl transition cursor-pointer shadow-lg flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  <span>{t('COMPLETAR', 'COMPLETE')}</span>
                </button>
                <button
                  onClick={() => handleTakeAction(topAction)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-5 py-2.5 rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <Play size={14} />
                  <span>{t('EJECUTAR ACCIÓN →', 'TAKE ACTION →')}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-center space-y-2">
            <p className="text-sm font-black text-slate-800 dark:text-slate-200">
              {t('¡Todas las acciones prioritarias de hoy están completadas!', 'All priority actions for today are completed!')}
            </p>
          </div>
        )}

        {/* Next 3 Recommended Actions */}
        {nextActions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {nextActions.map((act) => {
              const badge = getEvidenceBadge(act.evidenceStatus);
              return (
                <div key={act.id} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.colorClass}`}>
                        {badge.icon} {badge.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        ~{act.estimatedMinutes || 5} min
                      </span>
                    </div>
                    <h5 className="text-xs font-black text-slate-900 dark:text-white">
                      {act.title}
                    </h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                      {act.whyItMatters}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <button
                      onClick={() => handleCompleteAction(act.id)}
                      className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {t('Completar', 'Complete')}
                    </button>
                    <button
                      onClick={() => handleTakeAction(act)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <span>{t('Ejecutar acción', 'Take Action')}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UP NEXT SECTION */}
      {upNextList.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {t("PRÓXIMAMENTE • En cola", "UP NEXT • Upcoming Queue")}
          </h3>
          <div className="space-y-2">
            {upNextList.map((act) => {
              const badge = getEvidenceBadge(act.evidenceStatus);
              return (
                <div key={act.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.colorClass}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                        {act.category}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {act.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenSkipModal(act.id)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5"
                    >
                      {t('Omitir', 'Skip')}
                    </button>
                    <button
                      onClick={() => handleCompleteAction(act.id)}
                      className="bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      {t('Completar', 'Complete')}
                    </button>
                    <button
                      onClick={() => handleTakeAction(act)}
                      className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t('Ejecutar acción', 'Take Action')}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RECENTLY COMPLETED SECTION */}
      {completedList.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle size={14} />
            <span>{t("COMPLETADOS RECIENTEMENTE • Últimas 5 acciones", "RECENTLY COMPLETED • Last 5 Actions")}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {completedList.map((act) => (
              <div key={act.id} className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {t("COMPLETADO ✓", "COMPLETED ✓")}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {act.completedAt ? new Date(act.completedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white line-through">
                    {act.title}
                  </h4>
                  {act.measurementStatus === 'PENDING_MEASUREMENT' || !act.resultType ? (
                    <div className="mt-2">
                       <button onClick={() => handleOpenMeasureModal(act.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition shadow-sm w-full cursor-pointer">
                         {t('Medir Resultado Comercial', 'Measure Business Outcome')}
                       </button>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                         {act.measurementStatus === 'VERIFIED_OUTCOME' ? (
                           <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={12}/> {t('Resultado Verificado', 'Verified Outcome')}</span>
                         ) : (
                           <span className="text-amber-500 flex items-center gap-1"><AlertCircle size={12}/> {t('No Verificado', 'Unverified')}</span>
                         )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('Resultado:', 'Result:')} {act.resultType} {act.resultValue ? `(${act.resultValue})` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MEASUREMENT SECTION: Derived strictly from actually recorded actions & outcomes */}
      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Zap size={14} className="text-indigo-500" />
            <span>{t("Capa de Medición y Resultados de Bvelt", "Bvelt Action Measurement & Outcomes Layer")}</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-400">
            {t("Verificado desde logs de ejecución reales", "Verified from real execution logs")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t('Acciones Ejecutadas', 'Actions Executed')}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {enhancedActions.filter(a => a.status === 'COMPLETED').length} <span className="text-xs font-medium text-slate-400">/ {enhancedActions.length}</span>
            </div>
            <p className="text-[10px] text-slate-500">
              {t('Completadas vía Centro de Acción', 'Completed via Action Center')}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t('Resultados Registrados', 'Outcomes Logged')}
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {enhancedActions.filter(a => a.resultType).length}
            </div>
            <p className="text-[10px] text-slate-500">
              {t('Resultados comerciales registrados', 'Recorded commercial results')}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t('Ingresos Reales Registrados', 'Real Revenue Recorded')}
            </span>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              ${enhancedActions.reduce((sum, a) => sum + (parseFloat(a.resultValue) || 0), 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-500">
              {t('Ingresados explícitamente por el usuario', 'Explicitly entered by user')}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t('Estado de Evidencia', 'Evidence Status')}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>✓ {t("Verificado", "Verified")}</span>
              <span className="text-xs font-normal text-slate-400">({enhancedActions.filter(a => a.evidenceStatus === 'VERIFIED').length})</span>
            </div>
            <p className="text-[10px] text-slate-500">
              {t('Estricto estándar epistémico', 'Strict epistemic standard')}
            </p>
          </div>
        </div>
      </div>

      {/* ACTION HISTORY VIEW */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <History size={14} />
          <span>{t("Historial de Acciones y Actividades Bvelt", "Bvelt Action & Activity History")}</span>
        </h3>
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {actionHistory.slice(0, 10).map((hist, idx) => (
              <div key={idx} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-indigo-600 dark:text-indigo-400 uppercase text-[10px]">
                      {hist.type}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {new Date(hist.timestamp || Date.now()).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {hist.description}
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {t('Registrado', 'Logged')}
                </span>
              </div>
            ))}
            {actionHistory.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs font-medium">
                {t('No hay historial de actividad registrado aún.', 'No activity history recorded yet.')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MEASURE OUTCOME MODAL */}
      {measureModalActionId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Zap size={16} className="text-indigo-500" />
                {t('Medir Resultado Comercial', 'Measure Business Outcome')}
              </h3>
              <button
                onClick={() => setMeasureModalActionId(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t('Registra el resultado comercial real para mantener métricas verificadas.', 'Record the real commercial result to maintain verified metrics.')}
              </p>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                  {t('Resultado Comercial Real', 'Real Business Outcome')}
                </label>
                <select
                  value={measureOutcomeType}
                  onChange={(e) => setMeasureOutcomeType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="No response">{t("Sin respuesta", "No response")}</option>
                  <option value="Response">{t("Respuesta / Contactado", "Response / Replied")}</option>
                  <option value="Call booked">{t("Llamada agendada", "Call booked")}</option>
                  <option value="Opportunity advanced">{t("Oportunidad avanzada", "Opportunity advanced")}</option>
                  <option value="Client won">{t("Cliente ganado", "Client won")}</option>
                  <option value="Revenue recorded">{t("Ingresos registrados ($)", "Revenue recorded ($)")}</option>
                  <option value="Other">{t("Otro", "Other")}</option>
                </select>
              </div>

              {(measureOutcomeType === 'Revenue recorded' || measureOutcomeType === 'Client won') && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    {t('Valor de Ingreso Explícito ($)', 'Explicit Revenue Value ($)')}
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 250"
                    value={measureResultValue}
                    onChange={(e) => setMeasureResultValue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                  {t('Nivel de Evidencia', 'Evidence Level')}
                </label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 cursor-pointer">
                    <input
                      type="radio"
                      name="measureEvidence"
                      value="VERIFIED_OUTCOME"
                      checked={measureEvidence === 'VERIFIED_OUTCOME'}
                      onChange={(e) => setMeasureEvidence(e.target.value)}
                      className="text-emerald-600"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">{t('Resultado Verificado', 'Verified Outcome')}</span>
                      <span className="text-[10px] text-slate-500 block">{t('Confirmación real del CRM o comunicación explícita.', 'Real confirmation from CRM or explicit communication.')}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                    <input
                      type="radio"
                      name="measureEvidence"
                      value="UNVERIFIED"
                      checked={measureEvidence === 'UNVERIFIED'}
                      onChange={(e) => setMeasureEvidence(e.target.value)}
                      className="text-slate-600"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('No Verificado (Asumido)', 'Unverified (Assumed)')}</span>
                      <span className="text-[10px] text-slate-500 block">{t('Sin evidencia concreta disponible aún.', 'No hard evidence available yet.')}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setMeasureModalActionId(null)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition"
              >
                {t('Cancelar', 'Cancel')}
              </button>
              <button
                onClick={handleConfirmMeasure}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <Zap size={14} />
                <span>{t('Guardar Medición', 'Save Measurement')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SKIP MODAL WITH REASON */}
      {skipModalActionId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {t('Motivo de Omitir Acción', 'Skip Action Reason')}
              </h3>
              <button
                onClick={() => setSkipModalActionId(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t('Por favor selecciona una razón por la cual estás omitiendo esta acción:', 'Please select a reason for skipping this action:')}
              </p>

              <div className="space-y-2">
                {[
                  'Not relevant',
                  'Already handled',
                  'Waiting on client',
                  'Not enough information',
                  'Other'
                ].map((reason) => (
                  <label key={reason} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                    <input
                      type="radio"
                      name="skipReason"
                      value={reason}
                      checked={skipReason === reason}
                      onChange={(e) => setSkipReason(e.target.value)}
                      className="text-indigo-600"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{
                      reason === 'Not relevant' ? t('No es relevante', 'Not relevant') :
                      reason === 'Already handled' ? t('Ya fue gestionado', 'Already handled') :
                      reason === 'Waiting on client' ? t('Esperando al cliente', 'Waiting on client') :
                      reason === 'Not enough information' ? t('Falta información', 'Not enough information') :
                      t('Otro', 'Other')
                    }</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setSkipModalActionId(null)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition"
              >
                {t('Cancelar', 'Cancel')}
              </button>
              <button
                onClick={handleConfirmSkip}
                className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-black text-xs px-5 py-2.5 rounded-xl transition shadow-lg cursor-pointer"
              >
                {t('Confirmar Omitir', 'Confirm Skip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAction && (
        <ActionResolutionModal
          action={modalAction}
          isOpen={!!modalAction}
          onClose={() => setModalAction(null)}
          profile={profile}
          showToast={showToast}
          t={t}
          onActionCompleted={() => {
            handleCompleteAction(modalAction.id);
            setModalAction(null);
          }}
        />
      )}
    </div>
  );
};
