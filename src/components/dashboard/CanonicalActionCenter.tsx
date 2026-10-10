import React, { useState, useMemo } from 'react';
import { 
  Zap, Clock, CheckCircle, ArrowRight, Target, Sparkles, 
  TrendingUp, Activity, Lightbulb, Database, Filter, CheckSquare, 
  ChevronRight, Award, ShieldCheck, MessageSquare
} from 'lucide-react';
import { NextBestAction } from '../../knowledge/engine/actionEngine';
import { getEvidenceBadge } from '../../lib/bveltEvidence';
import { OutcomeLedgerService } from '../../knowledge/memory/outcomeLedgerService';
import { navigateTo } from '../../lib/navigation/navigateTo';
import { OperationalScoreCard } from './OperationalScoreCard';

export interface CanonicalActionCenterProps {
  actions: NextBestAction[];
  growthActions?: any[];
  legacyActions?: any[];
  onExecuteAction?: (action: NextBestAction | any) => void;
  onToggleComplete?: (actionId: string) => void;
  onToggleLegacyComplete?: (actionId: string) => void;
  completedActionIds?: string[];
  t: (es: string, en: string) => string;
  isCompact?: boolean;
}

export const CanonicalActionCenter: React.FC<CanonicalActionCenterProps> = ({
  actions = [],
  growthActions = [],
  legacyActions = [],
  onExecuteAction,
  onToggleComplete,
  onToggleLegacyComplete,
  completedActionIds = [],
  t,
  isCompact = false,
}) => {
  const [filter, setFilter] = useState<'all' | 'high_impact' | 'quick_wins' | 'completed'>('all');
  const effectiveGrowthActions = growthActions.length > 0 ? growthActions : legacyActions;
  const toggleHandler = onToggleComplete || onToggleLegacyComplete;

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'VERY_HIGH':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  const completedSet = useMemo(() => new Set(completedActionIds), [completedActionIds]);

  // Merge ActionEngine actions with growth actions if necessary, ensuring no duplicates
  const unifiedActions = useMemo(() => {
    const list: Array<NextBestAction & { isCompleted?: boolean }> = [];
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const seenLeadIds = new Set<string>();

    actions.forEach((act) => {
      const leadId = act.contextData?.leadId || (act as any).leadId || '';
      const rawTitle = (act.action || act.title || '').trim().toLowerCase();
      const idKey = act.id || `act_${rawTitle}`;

      if (!seenIds.has(idKey) && (!rawTitle || !seenTitles.has(rawTitle)) && (!leadId || !seenLeadIds.has(leadId))) {
        seenIds.add(idKey);
        if (rawTitle) seenTitles.add(rawTitle);
        if (leadId) seenLeadIds.add(leadId);
        list.push({
          ...act,
          isCompleted: completedSet.has(act.id)
        });
      }
    });

    // If growth actions have items not in actions, include them cleanly
    effectiveGrowthActions.forEach((ga) => {
      const gaId = ga.id || '';
      const rawTitle = (ga.title || ga.action || '').trim().toLowerCase();
      const leadId = ga.leadId || ga.contextData?.leadId || '';

      if ((!gaId || !seenIds.has(gaId)) && (!rawTitle || !seenTitles.has(rawTitle)) && (!leadId || !seenLeadIds.has(leadId))) {
        if (gaId) seenIds.add(gaId);
        if (rawTitle) seenTitles.add(rawTitle);
        if (leadId) seenLeadIds.add(leadId);

        const isDone = ga.status === 'COMPLETED' || completedSet.has(ga.id);
        
        let destCode: any = 'CONTACT_LEAD';
        let destObj: any = { tab: ga.actionTab || 'leads' };
        let ctaText = t('Ejecutar Acción', 'Execute Action');

        if (gaId === 'action_competitor_analysis' || (ga.title && ga.title.toLowerCase().includes('competidor'))) {
          destCode = 'VIEW_COMPETITOR';
          destObj = { tab: 'business_scan' };
          ctaText = t('Analizar Competidores', 'Analyze Competitors');
        } else if (gaId === 'action_run_audit' || (ga.title && (ga.title.toLowerCase().includes('auditoría') || ga.title.toLowerCase().includes('audit')))) {
          destCode = 'FIND_LOCAL_LEADS';
          destObj = { tab: 'business_scan' };
          ctaText = t('Escanear Zona', 'Scan Area');
        } else if (gaId === 'action_reviews_boost' || ga.actionTab === 'reviews') {
          destCode = 'REQUEST_REVIEW';
          destObj = { tab: 'reviews' };
          ctaText = t('Gestionar Reseñas', 'Manage Reviews');
        } else if (gaId === 'action_leads_followup' || ga.actionTab === 'leads') {
          destCode = 'CONTACT_LEAD';
          destObj = { tab: 'leads', subRow: 4, filter: 'NEW' };
          ctaText = t('Ver en CRM Inbox', 'View in CRM Inbox');
        } else if (ga.actionTab === 'profile') {
          destCode = 'COMPLETE_PROFILE';
          destObj = { tab: 'profile' };
          ctaText = t('Completar Perfil', 'Complete Profile');
        } else if (ga.actionTab === 'estimator' || ga.actionTab === 'pricing') {
          destCode = 'SEND_QUOTE';
          destObj = { tab: 'pricing', subRow: 0 };
          ctaText = t('Crear Presupuesto', 'Create Estimate');
        } else if (ga.actionTab === 'tools') {
          destCode = 'VIEW_COMPETITOR';
          destObj = { tab: 'business_scan' };
          ctaText = t('Escanear Radar', 'Scan Radar');
        }

        list.push({
          id: ga.id,
          action: ga.title,
          priority: (ga.priority === 'HIGH' ? 'HIGH' : ga.priority === 'MEDIUM' ? 'MEDIUM' : 'LOW') as any,
          priorityScore: ga.priority === 'HIGH' ? 80 : 50,
          reason: ga.description || '',
          expectedBenefit: ga.expectedBenefit || (ga.impact === 'HIGH' ? t('Alto impacto en visibilidad y conversión comercial', 'High impact on visibility and sales conversion') : t('Mejora continua del posicionamiento local', 'Continuous local positioning improvement')),
          whyNow: ga.whyNow || t('Prioridad activa en el plan de crecimiento de tu mercado', 'Active priority in your market growth plan'),
          evidence: ga.source || 'Bvelt Growth Engine',
          evidenceLevel: ga.evidenceStatus || 'DERIVED',
          confidence: 'HIGH',
          estimatedTime: ga.estimatedMinutes ? `${ga.estimatedMinutes} min` : '5 min',
          estimatedMinutes: ga.estimatedMinutes || 5,
          destinationCode: destCode,
          destination: destObj,
          ctaLabel: ctaText,
          isCompleted: isDone
        });
      }
    });

    // Sort: Non-completed first, then by priority score
    return list.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      return (b.priorityScore || 0) - (a.priorityScore || 0);
    });
  }, [actions, effectiveGrowthActions, completedSet, t]);

  const filteredActions = useMemo(() => {
    return unifiedActions.filter((act) => {
      if (filter === 'completed') {
        return act.isCompleted;
      }
      if (act.isCompleted) {
        return false; // Hide completed from active filters
      }
      if (filter === 'high_impact') {
        return act.priority === 'VERY_HIGH' || act.priority === 'HIGH';
      }
      if (filter === 'quick_wins') {
        const mins = act.estimatedMinutes || (parseInt(act.estimatedTime, 10) || 5);
        return mins <= 5;
      }
      return true;
    });
  }, [unifiedActions, filter]);

  const activeCount = unifiedActions.filter(a => !a.isCompleted).length;
  const completedCount = unifiedActions.filter(a => a.isCompleted).length;

  return (
    <div className="space-y-6">
      {!isCompact && (
        <OperationalScoreCard t={t} />
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Zap size={18} />
            </span>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{t("Plan de Acción Diario para Clientes", "Daily Client Acquisition Plan")}</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {activeCount} {t("Pendientes", "Pending")}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t("Acciones comerciales priorizadas para ganar clientes y superar a tu competencia local.", "Prioritized actions to win trade jobs, get 5-star Google reviews, and outrank local rivals.")}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[11px] font-bold overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              filter === 'all'
                ? 'bg-indigo-600 text-white font-black shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t("Todas", "All")} ({activeCount})
          </button>
          <button
            onClick={() => setFilter('high_impact')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              filter === 'high_impact'
                ? 'bg-indigo-600 text-white font-black shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🔥 {t("Alto Impacto", "High Impact")}
          </button>
          <button
            onClick={() => setFilter('quick_wins')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              filter === 'quick_wins'
                ? 'bg-indigo-600 text-white font-black shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ⚡ {t("Victorias Rápidas", "Quick Wins")} (&le;5m)
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              filter === 'completed'
                ? 'bg-emerald-600 text-white font-black shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ✓ {t("Completadas", "Done")} ({completedCount})
          </button>
        </div>
      </div>

      {/* Action List */}
      <div className="space-y-3">
        {filteredActions.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-3">
            <CheckCircle size={28} className="text-emerald-500 mx-auto" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {filter === 'completed'
                ? t("Aún no tienes tareas marcadas como completadas.", "No completed tasks recorded yet.")
                : t("No tienes tareas pendientes en este filtro — todo al día.", "No pending tasks in this filter — you are all caught up.")}
            </p>
            <button
              onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>{filter === 'completed' ? t("Ver todas las tareas", "View all tasks") : t("Ver historial completado", "View completed history")}</span>
            </button>
          </div>
        ) : (
          filteredActions.slice(0, isCompact ? 3 : 8).map((act, index) => {
            const evBadge = getEvidenceBadge(act.evidenceLevel || 'DERIVED', t);
            const isDone = act.isCompleted;

            return (
              <div
                key={act.id || index}
                className={`group rounded-2xl p-4 sm:p-5 border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isDone
                    ? 'bg-slate-50/60 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/40 opacity-75'
                    : 'bg-white dark:bg-slate-950/60 border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-md'
                }`}
              >
                {/* Left Side: Priority, Title & 4-Pill Summary */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(
                        act.priority
                      )}`}
                    >
                      {act.priority === 'VERY_HIGH'
                        ? t('MUY ALTA', 'VERY HIGH')
                        : act.priority === 'HIGH'
                        ? t('ALTA', 'HIGH')
                        : act.priority === 'MEDIUM'
                        ? t('MEDIA', 'MEDIUM')
                        : t('BAJA', 'LOW')}
                    </span>

                    <span
                      title={evBadge.description}
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${evBadge.colorClass}`}
                    >
                      <span>{evBadge.icon}</span>
                      <span>{evBadge.label}</span>
                    </span>

                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Clock size={11} className="text-emerald-500" />
                      <span>{act.estimatedTime}</span>
                    </span>

                    {act.contextData?.leadName && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60">
                        👤 {act.contextData.leadName}
                      </span>
                    )}

                    {act.contextData?.isSlaBreached && !isDone && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                        <span>⚡</span>
                        <span>{t("SLA Crítico > 15m", "Critical SLA > 15m")}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className={`text-sm sm:text-base font-black tracking-tight leading-snug ${
                      isDone ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                    }`}>
                      {act.action}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {act.reason}
                    </p>
                  </div>

                  {/* 3 Micro Insight Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 text-[10px]">
                      <span className="font-black text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                        <Activity size={10} className="text-indigo-500" />
                        {t("Qué ocurre", "What is happening")}
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold line-clamp-1">
                        {act.whyNow}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-900/40 text-[10px]">
                      <span className="font-black text-indigo-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                        <Lightbulb size={10} className="text-indigo-500" />
                        {t("Por qué importa", "Why it matters")}
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold line-clamp-1">
                        {act.reason}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100/80 dark:border-emerald-900/40 text-[10px]">
                      <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                        <TrendingUp size={10} className="text-emerald-500" />
                        {t("Beneficio", "Benefit")}
                      </span>
                      <p className="text-emerald-900 dark:text-emerald-300 font-semibold line-clamp-1">
                        {act.expectedBenefit}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Side: Execution CTA & Complete Toggle */}
                <div className="flex sm:flex-row md:flex-col items-center sm:items-center md:items-end justify-between gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {act.contextData?.whatsappUrl && !isDone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            OutcomeLedgerService.recordExecution({
                              businessId: 'active_business',
                              toolId: 'draft_lead_follow_up',
                              actionId: act.id,
                              executionState: 'SUCCESS',
                              outcomeState: 'DECLARED',
                              outcomeType: 'CONTACTED',
                              metricName: 'LEADS',
                              description: `Dispatched quick WhatsApp to ${act.contextData?.leadName || 'lead'}`,
                              value: 0
                            });
                          } catch (err) {
                            console.error('Error logging outcome:', err);
                          }
                          window.open(act.contextData.whatsappUrl, '_blank', 'noopener,noreferrer');
                        }}
                        title={t("Despachar por WhatsApp con 1 clic", "1-Click WhatsApp Dispatch")}
                        className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-xs flex items-center justify-center shrink-0 cursor-pointer active:scale-[0.96]"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const targetTab = act.destination?.tab || act.targetTab || act.actionTab;
                        const targetSubRow = act.destination?.subRow ?? act.targetSubRow;
                        const targetLeadId = act.contextData?.leadId || act.destination?.leadId || act.leadId;
                        const targetRadius = act.payload?.targetRadius || act.radiusKm;
                        
                        navigateTo({
                          tab: targetTab || (targetLeadId ? 'leads' : (act.id === 'task_actionable_leads' ? 'leads' : 'action_center')),
                          subRow: targetSubRow !== undefined ? targetSubRow : (targetTab === 'leads' ? 4 : undefined),
                          leadId: targetLeadId,
                          radiusKm: targetRadius,
                          tool: act.tool || (targetTab === 'leads' ? 'crm_inbox' : undefined)
                        });
                        onExecuteAction?.(act);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <span>{act.ctaLabel || (act.action ? `${t("Ejecutar", "Execute")}: ${act.action.slice(0, 24)}...` : t("Ejecutar Acción", "Execute Action"))}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  {toggleHandler && (
                    <button
                      onClick={() => toggleHandler(act.id)}
                      className={`text-[11px] font-bold flex items-center gap-1 px-3 py-1 rounded-lg transition cursor-pointer ${
                        isDone
                          ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <CheckSquare size={13} className={isDone ? 'text-emerald-500' : 'text-slate-400'} />
                      <span>{isDone ? t("Marcar pendiente", "Mark pending") : t("Marcar completada", "Mark completed")}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
    </div>
  );
};
