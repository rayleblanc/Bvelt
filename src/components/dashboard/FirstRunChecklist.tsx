import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Circle, Sparkles, ArrowRight, Zap, 
  Search, FileText, Check, Target, Share2, TrendingUp, X
} from 'lucide-react';
import { navigateTo } from '../../lib/navigateTo';
import { recordBveltEvent } from '../../knowledge/memory/bemStore';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface FirstRunChecklistProps {
  t: (es: string, en: string) => string;
  language: 'es' | 'en';
  profile?: any;
  onUpdateProfile?: (updated: any) => void;
  onNavigateTab?: (tab: string, subRow?: number) => void;
}

interface ChecklistStep {
  id: 'step_profile' | 'step_opportunity_center' | 'step_prepare_message' | 'step_connect_gbp';
  titleEs: string;
  titleEn: string;
  descEs: string;
  descEn: string;
  actionTextEs: string;
  actionTextEn: string;
  icon: React.ReactNode;
  tab: string;
  subRow?: number;
}

const STORAGE_KEY = 'bvelt_first_run_checklist_v4';

export function FirstRunChecklist({
  t,
  language,
  profile,
  onUpdateProfile,
  onNavigateTab
}: FirstRunChecklistProps) {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bvelt_first_run_dismissed_v4') === 'true';
    } catch {
      return false;
    }
  });

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      if (profile?.firstRunChecklist && typeof profile.firstRunChecklist === 'object') {
        return profile.firstRunChecklist;
      }
    } catch (e) {
      console.warn('[FirstRunChecklist] Error reading saved progress:', e);
    }
    return {
      step_profile: Boolean(profile?.category || profile?.niche || profile?.location),
      step_opportunity_center: false,
      step_prepare_message: false,
      step_connect_gbp: Boolean(profile?.gmbLink)
    };
  });

  // Auto-detect if steps were already performed in app state/localStorage
  useEffect(() => {
    const hasProfile = Boolean(profile?.category || profile?.niche || profile?.location);
    const hasOppView = Boolean(
      localStorage.getItem('bvelt_recent_scans') || 
      localStorage.getItem('bvelt_last_scan_cache')
    );
    const hasPrepMsg = Boolean(
      localStorage.getItem('bvelt_quotes_sent') ||
      localStorage.getItem('bvelt_active_drafts')
    );
    const hasConnectGbp = Boolean(profile?.gmbLink);

    setCompletedSteps(prev => {
      const updated = {
        step_profile: prev.step_profile || hasProfile,
        step_opportunity_center: prev.step_opportunity_center || hasOppView,
        step_prepare_message: prev.step_prepare_message || hasPrepMsg,
        step_connect_gbp: prev.step_connect_gbp || hasConnectGbp
      };

      if (
        updated.step_profile !== prev.step_profile ||
        updated.step_opportunity_center !== prev.step_opportunity_center ||
        updated.step_prepare_message !== prev.step_prepare_message ||
        updated.step_connect_gbp !== prev.step_connect_gbp
      ) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });
  }, [profile]);

  const saveProgress = (nextState: Record<string, boolean>) => {
    setCompletedSteps(nextState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {}

    if (onUpdateProfile) {
      onUpdateProfile({ firstRunChecklist: nextState });
    }

    if (auth?.currentUser?.uid && db) {
      try {
        const uid = auth.currentUser.uid;
        const userRef = doc(db, 'profiles', uid);
        const checklistRef = doc(db, 'profiles', uid, 'checklist', 'first_run');
        const payload = { firstRunChecklist: nextState, updatedAt: new Date().toISOString() };
        
        Promise.allSettled([
          setDoc(userRef, payload, { merge: true }),
          setDoc(checklistRef, { ...nextState, updatedAt: new Date().toISOString() }, { merge: true })
        ]).catch(() => {});
      } catch {}
    }
  };

  const handleToggleStep = (stepId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextVal = !completedSteps[stepId];
    const nextState = { ...completedSteps, [stepId]: nextVal };
    saveProgress(nextState);

    if (nextVal) {
      recordBveltEvent({
        tenantId: auth?.currentUser?.uid || profile?.id || 'default_business',
        type: 'checklist_step_completed',
        sourceType: 'first_run_checklist',
        sourceName: stepId,
        fetchedAt: new Date().toISOString(),
        provenance: 'USER_ACTION_INTENT',
        consentScope: 'private',
        meta: {
          stepId,
          completedCount: Object.values(nextState).filter(Boolean).length,
          totalSteps: 4
        }
      });
    }
  };

  const handleExecuteStep = (step: ChecklistStep) => {
    if (onNavigateTab) {
      onNavigateTab(step.tab, step.subRow);
    }
    navigateTo({
      tab: step.tab,
      subRow: step.subRow
    });
  };

  const handleConsciousDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('bvelt_first_run_dismissed_v4', 'true');
    } catch {}

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid || profile?.id || 'default_business',
      type: 'checklist_dismissed_consciously',
      sourceType: 'first_run_checklist',
      sourceName: 'Conscious Dismiss',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_ACTION_INTENT',
      consentScope: 'private',
      meta: {
        completedCount: Object.values(completedSteps).filter(Boolean).length,
        totalSteps: 4
      }
    });
  };

  const steps: ChecklistStep[] = [
    {
      id: 'step_profile',
      titleEs: '1. Establecer zona de servicio',
      titleEn: '1. Set service area',
      descEs: 'Define tu zona comercial y código postal.',
      descEn: 'Define your business operating area and postal code.',
      actionTextEs: 'Definir Zona',
      actionTextEn: 'Set Area',
      icon: <Search size={15} className="text-indigo-400" />,
      tab: 'profile',
      subRow: 0
    },
    {
      id: 'step_opportunity_center',
      titleEs: '2. Escanear territorio',
      titleEn: '2. Scan territory',
      descEs: 'Busca señales en el mapa y prospectos de negocios.',
      descEn: 'Fetch map signals and explore local business leads.',
      actionTextEs: 'Escanear',
      actionTextEn: 'Scan Now',
      icon: <Target size={15} className="text-amber-400" />,
      tab: 'action_center'
    },
    {
      id: 'step_prepare_message',
      titleEs: '3. Revisar 1 acción',
      titleEn: '3. Review 1 action',
      descEs: 'Revisa y ejecuta una de las recomendaciones sugeridas.',
      descEn: 'Inspect and perform one of the suggested actions.',
      actionTextEs: 'Revisar Acción',
      actionTextEn: 'Review Action',
      icon: <FileText size={15} className="text-emerald-400" />,
      tab: 'action_center',
      subRow: 1
    },
    {
      id: 'step_connect_gbp',
      titleEs: '4. Conectar GBP (Opcional)',
      titleEn: '4. Connect GBP (Optional)',
      descEs: 'Vincula tu Perfil de Google Business para ver reseñas reales.',
      descEn: 'Link your Google Business Profile to view real reviews.',
      actionTextEs: 'Conectar Google',
      actionTextEn: 'Connect Google',
      icon: <TrendingUp size={15} className="text-purple-400" />,
      tab: 'profile',
      subRow: 2
    }
  ];

  const totalCompleted = Object.values(completedSteps).filter(Boolean).length;
  const isAllCompleted = totalCompleted === steps.length;

  if (isAllCompleted || isDismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/40 border-2 border-indigo-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md space-y-4 text-left animate-fade-in my-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Zap size={14} className="fill-current" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
              {t("Checklist de Inicio — Primeros Pasos Bvelt", "First-Week Activation Checklist")}
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {t("Guía rápida de 4 pasos para activar la recuperación de ingresos en tu zona:", "4-step guided path to jumpstart revenue recovery in your area:")}
          </p>
        </div>

        {/* Progress badge & Conscious Dismiss */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {totalCompleted} / {steps.length} {t("completados", "completed")}
          </span>

          <button
            type="button"
            onClick={handleConsciousDismiss}
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/80 transition cursor-pointer flex items-center gap-1"
            title={t("Ocultar checklist conscientemente", "Dismiss checklist consciously")}
          >
            <X size={12} />
            <span>{t("Ocultar", "Dismiss")}</span>
          </button>
        </div>
      </div>

      {/* 4 Step Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step) => {
          const isDone = Boolean(completedSteps[step.id]);
          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                isDone
                  ? 'bg-emerald-950/20 border-emerald-500/30 opacity-85'
                  : 'bg-white/5 border-white/10 hover:border-indigo-500/40'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/10 rounded-lg shrink-0">
                      {step.icon}
                    </div>
                    <span className="text-xs font-bold text-white leading-tight">
                      {language === 'es' ? step.titleEs : step.titleEn}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleToggleStep(step.id, e)}
                    className="cursor-pointer text-slate-400 hover:text-white transition p-1"
                    title={isDone ? t("Marcar como pendiente", "Mark as pending") : t("Marcar como hecho", "Mark as done")}
                  >
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-emerald-400 fill-emerald-400/20" />
                    ) : (
                      <Circle size={18} className="text-slate-500 hover:text-slate-300" />
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {language === 'es' ? step.descEs : step.descEn}
                </p>
              </div>

              <div className="pt-1">
                {isDone ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 py-1">
                    <Check size={13} className="stroke-[3]" />
                    <span>{t("Completado", "Completed")}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleExecuteStep(step)}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>{language === 'es' ? step.actionTextEs : step.actionTextEn}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
