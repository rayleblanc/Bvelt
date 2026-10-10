import React, { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, TrendingUp, DollarSign, ArrowRight, ShieldCheck, Activity, Target, Clock, GitCommit, Info, Loader2, BookOpen } from 'lucide-react';
import { ActionEngine } from '../../knowledge/engine/actionEngine';
import { getHistoricalArbitrageTimeline } from '../../knowledge/memory/bemStore';
import { createEntityIdentity } from '../../knowledge/memory/entityIdentity';

interface DashboardResultsSummaryCardProps {
  growthActionsCount?: { completed: number; total: number };
  onOpenActionCenter: () => void;
  onOpenLedger?: () => void;
  t: (es: string, en: string) => string;
  tenantUid?: string | null;
  profile?: any;
}

export const DashboardResultsSummaryCard: React.FC<DashboardResultsSummaryCardProps> = ({
  growthActionsCount,
  onOpenActionCenter,
  onOpenLedger,
  t,
  tenantUid,
  profile
}) => {
  const [windowDays, setWindowDays] = useState<30 | 90 | 180>(30);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    const fetchTimeline = async () => {
      setIsLoading(true);
      try {
        const identity = createEntityIdentity({
          canonicalName: profile.name || profile.businessName || 'Local Business',
          phone: profile.phone,
          city: profile.location || profile.city,
          primaryCategory: profile.category
        });
        const data = await getHistoricalArbitrageTimeline(identity, windowDays, tenantUid);
        if (active) {
          setTimelineData(data);
        }
      } catch (err) {
        console.error('Error fetching longitudinal timeline:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchTimeline();
    return () => {
      active = false;
    };
  }, [profile, windowDays, tenantUid]);

  const metrics = useMemo(() => {
    return ActionEngine.getConversionMetrics();
  }, []);

  const storedOutcomes = useMemo(() => {
    try {
      const outcomes = JSON.parse(localStorage.getItem('bvelt_outcomes_v1') || '[]');
      const conversions = JSON.parse(localStorage.getItem('bvelt_conversion_records_v1') || '[]');
      return [...conversions, ...outcomes];
    } catch {
      return [];
    }
  }, []);

  const completedActions = growthActionsCount?.completed ?? metrics.actionsExecuted;
  const loggedOutcomes = Math.max(storedOutcomes.length, metrics.contactsMade);
  const recordedRevenue = metrics.revenueRecorded;

  return (
    <div id="dashboard-results-summary" className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-7 shadow-sm text-slate-900 dark:text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
              {t("ARBITRAJE HISTÓRICO Y MEDIACIÓN", "HISTORICAL ARBITRAGE & MEASUREMENT")}
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {t("Resultados e Inteligencia Longitudinal", "Results & Longitudinal Intelligence")}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Window selection */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setWindowDays(30)}
              className={`px-2.5 py-1 rounded-lg transition ${windowDays === 30 ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}`}
            >
              30d
            </button>
            <button
              onClick={() => setWindowDays(90)}
              className={`px-2.5 py-1 rounded-lg transition ${windowDays === 90 ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}`}
            >
              90d
            </button>
            <button
              onClick={() => setWindowDays(180)}
              className={`px-2.5 py-1 rounded-lg transition ${windowDays === 180 ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}`}
            >
              180d
            </button>
          </div>

          {onOpenLedger && (
            <button
              onClick={onOpenLedger}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 text-xs font-black uppercase tracking-wider transition border border-emerald-200/60 dark:border-emerald-800/60 cursor-pointer"
            >
              <BookOpen size={13} />
              <span>{t("Outcome Ledger", "Outcome Ledger")}</span>
            </button>
          )}

          <button
            onClick={onOpenActionCenter}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-300 text-xs font-black uppercase tracking-wider transition border border-indigo-200/60 dark:border-indigo-800/60 cursor-pointer"
          >
            <span>{t("Ver Centro de Acción", "Open Action Center")}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 4 Pillars of Results: Actions Completed, Outcomes Logged, Revenue Recorded, Key Change */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* 1. Actions Completed */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t("Acciones Completadas", "Actions Completed")}
            </span>
            <Target size={14} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {completedActions}
          </p>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {t("Ejecutadas en ventana", "Executed in window")}
            </span>
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ✓ {t("HISTORIAL", "LOG")}
            </span>
          </div>
        </div>

        {/* 2. Outcomes Logged */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t("Impactos Medidos", "Outcomes Logged")}
            </span>
            <Activity size={14} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {loggedOutcomes}
          </p>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {t("Registros BEM", "BEM Records")}
            </span>
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ✓ {t("EVENTOS", "EVENTS")}
            </span>
          </div>
        </div>

        {/* 3. Revenue Recorded (Real Closed CRM Revenue) */}
        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 p-4 rounded-2xl space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
              {t("Ingreso Confirmado", "Recorded Revenue")}
            </span>
            <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            ${recordedRevenue.toLocaleString()}
          </p>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-semibold">
              {t("Ventas cerradas", "Closed sales")}
            </span>
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
              ✓ {t("REAL • CRM", "ACTUAL • CRM")}
            </span>
          </div>
        </div>

        {/* 4. Key Change / Velocity (Derived calculation) */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t("Cambio Principal", "Key Progress")}
            </span>
            <TrendingUp size={14} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {metrics.contactsMade === 0 || metrics.conversionRate === null ? t('N/A', 'N/A') : (metrics.conversionRate > 0 ? `${metrics.conversionRate}%` : (completedActions > 0 ? t('Activo', 'Active') : '0%'))}
          </p>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {metrics.contactsMade === 0 || metrics.conversionRate === null ? t("Sin leads", "No leads") : (metrics.conversionRate > 0 ? t("Tasa de conversión", "Conversion rate") : t("Pipeline activo", "Pipeline active"))}
            </span>
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              ↗ {t("DERIVADO", "DERIVED")}
            </span>
          </div>
        </div>
      </div>

      {/* Historical Correlation Timeline (Recomendación -> Ejecución -> Resultado Observado) */}
      <div className="bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 md:p-5 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
            <GitCommit size={15} className="text-indigo-500" />
            <span>{t("Secuencia Longitudinal Observada", "Observed Longitudinal Sequence")}</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            {windowDays}d {t("Ventana", "Window")}
          </span>
        </div>

        {/* Cause/Correlation Disclaimer */}
        <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-xl">
          <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            {t(
              "Las mediciones registran asociaciones temporales observadas (OBSERVED_AFTER). Bvelt no presupone relación causal sin evidencia explícita.",
              "Metrics track observed temporal associations (OBSERVED_AFTER). Bvelt does not claim causality without explicit evidence."
            )}
          </span>
        </div>

        {/* Timeline Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-xs text-indigo-600 dark:text-indigo-400 gap-2">
            <Loader2 className="animate-spin" size={16} />
            <span>{t("Cargando historial BEM...", "Loading BEM history...")}</span>
          </div>
        ) : (!timelineData || timelineData.events.length === 0) && storedOutcomes.length === 0 && completedActions === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400 italic">
            {t("Sin eventos de ejecución registrados en esta ventana.", "No execution events logged in this window.")}
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {timelineData?.correlatedOutcomes && timelineData.correlatedOutcomes.length > 0 ? (
              timelineData.correlatedOutcomes.slice(-5).reverse().map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 text-xs gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">
                        {item.summaryText}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {item.observedAt ? new Date(item.observedAt).toLocaleDateString() : 'Observed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                      {item.associationType}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              storedOutcomes.slice(-3).reverse().map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">
                        {item.title || item.outcomeType || t("Acción Comercial Ejecutada", "Executed Commercial Action")}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Observed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                      OBSERVED_AFTER
                    </span>
                    {item.revenue > 0 && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono whitespace-nowrap">
                        +${item.revenue.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
