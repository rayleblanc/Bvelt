import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, Circle, Calendar, ArrowRight, ShieldCheck, 
  Sparkles, X, Zap, MessageSquare, Phone, Star, TrendingUp, Trophy, ChevronDown, ChevronUp 
} from 'lucide-react';
import { recordBemOutcome } from '../../knowledge/memory/outcomeLedgerService';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getVerticalConfig, VerticalChecklistItem } from '../../knowledge/verticals';
import { UnifiedActionService, ActionRecord } from '../../lib/unifiedActionService';

interface FirstWeekChecklistBannerProps {
  t: (es: string, en: string) => string;
  onExecuteAction?: (action: any) => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onRunSeoAudit?: () => void;
  setActiveTab?: (tab: string) => void;
  profile?: any;
  onChecklistChange?: (items: VerticalChecklistItem[]) => void;
  defaultCollapsed?: boolean;
}

export const FirstWeekChecklistBanner: React.FC<FirstWeekChecklistBannerProps> = ({
  t,
  onExecuteAction,
  showToast,
  onRunSeoAudit,
  setActiveTab,
  profile,
  onChecklistChange,
  defaultCollapsed = true
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bvelt_first_week_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const verticalConfig = getVerticalConfig(profile?.category || profile?.niche || profile?.name);

  const [items, setItems] = useState<VerticalChecklistItem[]>(() => {
    const defaultList: VerticalChecklistItem[] = verticalConfig.checklist;

    try {
      const saved = localStorage.getItem('bvelt_first_week_checklist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return defaultList.map(def => {
            const found = parsed.find(p => p.id === def.id);
            const isUnifiedDone = UnifiedActionService.isActionDone(def.id) || 
                                  UnifiedActionService.isActionDone(`checklist_${def.id}`) ||
                                  UnifiedActionService.isActionDone(`checklist_${def.actionType}_p1`);
            return { ...def, completed: isUnifiedDone || Boolean(found?.completed) };
          });
        }
      }
    } catch {}

    // Merge profile/Firestore prefs if available
    if (profile?.firstWeekChecklist && typeof profile.firstWeekChecklist === 'object') {
      return defaultList.map(def => {
        const isUnifiedDone = UnifiedActionService.isActionDone(def.id) || 
                              UnifiedActionService.isActionDone(`checklist_${def.id}`);
        return {
          ...def,
          completed: isUnifiedDone || Boolean(profile.firstWeekChecklist[def.id] ?? def.completed)
        };
      });
    }

    return defaultList.map(def => ({
      ...def,
      completed: UnifiedActionService.isActionDone(def.id) || UnifiedActionService.isActionDone(`checklist_${def.id}`) || Boolean(def.completed)
    }));
  });

  // Subscribe to UnifiedActionService updates
  useEffect(() => {
    const syncWithUnifiedService = (records: ActionRecord[]) => {
      setItems(prevItems => {
        let changed = false;
        const updated = prevItems.map(item => {
          const isDone = UnifiedActionService.isActionDone(item.id) || 
                         UnifiedActionService.isActionDone(`checklist_${item.id}`) ||
                         UnifiedActionService.isActionDone(`checklist_${item.actionType}_p1`);
          if (isDone !== item.completed) {
            changed = true;
            return { ...item, completed: isDone };
          }
          return item;
        });
        return changed ? updated : prevItems;
      });
    };

    const unsubscribe = UnifiedActionService.subscribe(syncWithUnifiedService);
    return () => unsubscribe();
  }, []);

  // Re-sync checklist if vertical category changed
  useEffect(() => {
    const vConfig = getVerticalConfig(profile?.category || profile?.niche || profile?.name);
    setItems(prev => {
      return vConfig.checklist.map(def => {
        const existing = prev.find(p => p.id === def.id);
        const profileVal = profile?.firstWeekChecklist?.[def.id];
        const isUnifiedDone = UnifiedActionService.isActionDone(def.id) || 
                              UnifiedActionService.isActionDone(`checklist_${def.id}`) ||
                              UnifiedActionService.isActionDone(`checklist_${def.actionType}_p1`);
        return {
          ...def,
          completed: isUnifiedDone || (profileVal !== undefined ? Boolean(profileVal) : Boolean(existing?.completed))
        };
      });
    });
  }, [profile?.category, profile?.niche, profile?.name]);

  const prevItemsJsonRef = useRef<string>('');
  const hasWarnedFirestoreRef = useRef<boolean>(false);
  const onChecklistChangeRef = useRef(onChecklistChange);
  useEffect(() => {
    onChecklistChangeRef.current = onChecklistChange;
  }, [onChecklistChange]);

  useEffect(() => {
    const json = JSON.stringify(items);
    if (json === prevItemsJsonRef.current) return;
    prevItemsJsonRef.current = json;

    try {
      localStorage.setItem('bvelt_first_week_checklist', json);
    } catch {}

    if (onChecklistChangeRef.current) {
      onChecklistChangeRef.current(items);
    }

    // Sync to Firestore for authenticated users only on genuine state changes
    try {
      const uid = auth?.currentUser?.uid;
      if (uid && db) {
        const checklistMap: Record<string, boolean> = {};
        items.forEach(i => { checklistMap[i.id] = i.completed; });
        const userRef = doc(db, 'profiles', uid);
        const checklistSubRef = doc(db, 'profiles', uid, 'checklist', 'first_week');

        Promise.allSettled([
          setDoc(userRef, { firstWeekChecklist: checklistMap, updatedAt: new Date().toISOString() }, { merge: true }),
          setDoc(checklistSubRef, { items: checklistMap, updatedAt: new Date().toISOString() }, { merge: true })
        ]).then((results) => {
          results.forEach((res) => {
            if (res.status === 'rejected') {
              const err = res.reason;
              if (!hasWarnedFirestoreRef.current) {
                hasWarnedFirestoreRef.current = true;
                if (err?.code === 'permission-denied' || String(err?.message).includes('permission')) {
                  console.warn('[FirstWeekChecklist] Firestore sync notice: stored locally.');
                }
              }
            }
          });
        });
      }
    } catch (fsErr) {}
  }, [items]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('bvelt_first_week_dismissed', 'true');
    } catch {}
    if (showToast) showToast(t('Checklist ocultado. Puedes volver a consultarlo en Ajustes.', 'Checklist hidden. You can view it again in Settings.'), 'info');
  };

  const handleToggleItem = (item: VerticalChecklistItem) => {
    const isNowCompleted = !item.completed;
    
    // Toggle in UnifiedActionService
    UnifiedActionService.toggleActionDone(item.id, item.actionType || 'FIRST_WEEK_MILESTONE', {
      day: item.day,
      titleEs: item.titleEs,
      titleEn: item.titleEn
    });
    // Also toggle the checklist_ prefixed alias
    UnifiedActionService.toggleActionDone(`checklist_${item.id}`, item.actionType || 'FIRST_WEEK_MILESTONE');

    const updated = items.map(i => i.id === item.id ? { ...i, completed: isNowCompleted } : i);
    setItems(updated);

    if (isNowCompleted) {
      // Log BEM outcome ledger
      try {
        recordBemOutcome({
          businessId: 'default_business',
          toolId: 'first_week_checklist',
          actionId: item.id,
          actionType: item.actionType || 'FIRST_WEEK_MILESTONE',
          channel: 'checklist',
          executionState: 'SUCCESS',
          outcomeState: 'DECLARED',
          metricName: 'SYSTEM',
          description: `Completed milestone: ${item.titleEn} (${item.day})`,
          value: 0,
          metadata: { day: item.day, titleEs: item.titleEs, titleEn: item.titleEn }
        });
      } catch (err) {
        console.warn('[BEM] Checklist outcome record warning:', err);
      }
      if (showToast) showToast(t(`¡Hito completado: ${item.titleEs}!`, `Milestone completed: ${item.titleEn}!`), 'success');
    }
  };

  const handleExecuteItemAction = (item: VerticalChecklistItem) => {
    // Check if vertical actionPayload is defined
    if (item.actionPayload) {
      if (item.actionType === 'audit') {
        if (onRunSeoAudit) onRunSeoAudit();
        if (setActiveTab) setActiveTab('overview');
        return;
      }
      if (item.actionType === 'upgrade') {
        if (setActiveTab) setActiveTab('plans');
        return;
      }
      if (onExecuteAction) {
        onExecuteAction({
          id: `checklist_${item.id}`,
          action: t(item.actionPayload.actionEs, item.actionPayload.actionEn),
          whyNow: t(item.actionPayload.whyNowEs, item.actionPayload.whyNowEn),
          expectedBenefit: t(item.actionPayload.expectedBenefitEs, item.actionPayload.expectedBenefitEn),
          destinationCode: item.actionPayload.destinationCode,
          contextData: item.actionPayload.contextData || { leadName: t('Cliente', 'Client') }
        });
        return;
      }
    }

    // Default fallback routing
    if (item.actionType === 'audit') {
      if (onRunSeoAudit) onRunSeoAudit();
      if (setActiveTab) setActiveTab('overview');
    } else if (item.actionType === 'actions') {
      if (onExecuteAction) {
        onExecuteAction({
          id: 'checklist_actions_p1',
          action: t('Contactar Prospecto Caliente por WhatsApp', 'Contact High-Intent Lead via WhatsApp'),
          whyNow: t('Acción clave Día 1-2: Conectar directamente con un lead para asegurar el trabajo.', 'Key Day 1-2 action: Connect directly with a local lead to lock in the job.'),
          expectedBenefit: t('Cerrar trabajo pagado esta semana', 'Close paying job this week'),
          destinationCode: 'CONTACT_LEAD',
          contextData: { leadName: t('Cliente Potencial', 'Priority Lead'), phone: '' }
        });
      } else if (setActiveTab) {
        setActiveTab('growth');
      }
    } else if (item.actionType === 'review') {
      if (onExecuteAction) {
        onExecuteAction({
          id: 'checklist_review_p1',
          action: t('Solicitar Reseña en Google Maps', 'Request Google Maps Review'),
          whyNow: t('Acción recomendada del Día 3 de tu primera semana.', 'Recommended Day 3 action of your first week.'),
          expectedBenefit: '+1 Reseña de 5 Estrellas',
          destinationCode: 'REQUEST_REVIEW',
          contextData: { leadName: t('Cliente Reciente', 'Recent Client'), phone: '' }
        });
      }
    } else if (item.actionType === 'competitor') {
      if (onExecuteAction) {
        onExecuteAction({
          id: 'checklist_competitor_p1',
          action: t('Oferta de Atención Rápida vs Competidores Lentos', 'Fast Response Offer vs Slow Local Competitors'),
          whyNow: t('Acción Día 4-5: Varios competidores cercanos tardan más de 24h en responder; asegura el cliente con respuesta inmediata.', 'Day 4-5 action: Nearby competitors take >24h to answer; win the customer with immediate reply.'),
          expectedBenefit: t('Cerrar trabajo por velocidad de respuesta', 'Win customer through rapid response'),
          destinationCode: 'CONTACT_LEAD',
          contextData: { leadName: t('Cliente de la Zona', 'Local Prospect'), phone: '' }
        });
      } else if (setActiveTab) {
        setActiveTab('growth');
      }
    } else if (item.actionType === 'upgrade') {
      if (setActiveTab) setActiveTab('plans');
    }
  };

  if (isDismissed) return null;

  const completedCount = items.filter(i => i.completed).length;
  const progressPct = Math.round((completedCount / items.length) * 100);
  const nextIncomplete = items.find(i => !i.completed);

  // Compact / Collapsed Mode
  if (isCollapsed) {
    return (
      <div id="first-week-checklist" className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:p-4 shadow-md border border-indigo-500/30 my-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-amber-400 flex items-center justify-center shadow-sm text-slate-950 shrink-0">
              <Trophy size={16} className="text-slate-950" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {t('Plan Primera Semana', 'First-Week Plan')}
                </span>
                <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full text-[9px] font-bold border border-indigo-400/30">
                  {completedCount}/{items.length} ({progressPct}%)
                </span>
              </div>

              {/* Compact Progress Bar */}
              <div className="w-full max-w-xs h-1.5 bg-indigo-950 rounded-full overflow-hidden border border-indigo-800/60">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-amber-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Next Action & Expand Toggle */}
          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-between sm:justify-end">
            {nextIncomplete ? (
              <button
                type="button"
                onClick={() => handleExecuteItemAction(nextIncomplete)}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer truncate max-w-[210px]"
                title={t(nextIncomplete.titleEs, nextIncomplete.titleEn)}
              >
                <span className="text-[9px] font-black uppercase bg-slate-950/20 px-1 py-0.2 rounded">
                  {nextIncomplete.day}
                </span>
                <span className="truncate">{t(nextIncomplete.titleEs, nextIncomplete.titleEn)}</span>
                <ArrowRight size={12} className="shrink-0" />
              </button>
            ) : (
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={14} />
                <span>{t('¡Completado!', 'Completed!')}</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-indigo-200 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
              title={t('Ver todos los hitos', 'View all milestones')}
            >
              <span>{t('Ver 5 hitos', 'View 5')}</span>
              <ChevronDown size={14} />
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              title={t('Ocultar', 'Hide')}
              className="text-indigo-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full Expanded View
  return (
    <div id="first-week-checklist" className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-6 shadow-xl border border-indigo-500/30 my-4">
      {/* Ambient background blur */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 space-y-4">
        {/* Header & Dismiss */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-amber-400 flex items-center justify-center shadow-lg text-slate-950 shrink-0">
              <Trophy size={20} className="text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-amber-300">
                  {t('PLAN DE ARRANQUE — PRIMERA SEMANA', 'FIRST-WEEK LAUNCH PLAN')}
                </span>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-bold border border-indigo-400/30">
                  {completedCount} / {items.length} {t('Completados', 'Completed')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                {t('Tu ruta hacia tus primeros trabajos y clientes con Bvelt', 'Your roadmap to your first jobs & clients with Bvelt')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="text-xs text-indigo-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition flex items-center gap-1 cursor-pointer"
            >
              <span>{t('Colapsar', 'Collapse')}</span>
              <ChevronUp size={14} />
            </button>
            <button
              onClick={handleDismiss}
              title={t('Ocultar banner', 'Hide banner')}
              className="text-indigo-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold text-indigo-200">
            <span>{t('Progreso de la Primera Semana', 'First Week Progress')}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-indigo-950 rounded-full overflow-hidden border border-indigo-800/60">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-amber-400 transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>
        </div>

        {/* Checklist Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
          {items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => handleToggleItem(item)}
              className={`rounded-2xl p-3.5 border transition flex flex-col justify-between space-y-2.5 cursor-pointer group ${
                item.completed 
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    item.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'
                  }`}>
                    {item.day}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleItem(item);
                    }}
                    className="text-indigo-300 hover:text-white transition"
                  >
                    {item.completed ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <Circle size={16} className="text-indigo-400 group-hover:text-amber-300" />
                    )}
                  </button>
                </div>

                <h4 className="text-xs font-bold leading-snug line-clamp-2">
                  {t(item.titleEs, item.titleEn)}
                </h4>
                <p className="text-[11px] text-indigo-200/80 line-clamp-2 leading-relaxed">
                  {t(item.descEs, item.descEn)}
                </p>
              </div>

              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  handleExecuteItemAction(item);
                }}
                className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px] font-black text-amber-300 hover:underline"
              >
                <span>{t('Ejecutar P1 →', 'Execute P1 →')}</span>
                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
