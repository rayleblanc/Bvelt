import React from 'react';
import { 
  Activity, ArrowRight, TrendingUp, AlertTriangle, ShieldCheck, 
  MessageSquare, FileText, Star, Users, CheckCircle, RefreshCw
} from 'lucide-react';
import { 
  OperationalScoreService, 
  OperationalScoreReport 
} from '../../services/operationalScoreService';
import { navigateTo } from '../../lib/navigation/navigateTo';

export interface OperationalScoreCardProps {
  tenantId?: string;
  t: (es: string, en: string) => string;
  onNavigateAction?: (destinationTab: string) => void;
}

export const OperationalScoreCard: React.FC<OperationalScoreCardProps> = ({
  tenantId,
  t,
  onNavigateAction
}) => {
  const report: OperationalScoreReport = React.useMemo(() => {
    return OperationalScoreService.calculateScore(tenantId);
  }, [tenantId]);

  const handleCtaClick = () => {
    if (onNavigateAction) {
      onNavigateAction(report.biggestLeak.destinationTab);
    } else {
      navigateTo({ tab: report.biggestLeak.destinationTab });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 60) return 'text-indigo-500 border-indigo-500/30 bg-indigo-500/10';
    if (score >= 40) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5 text-left">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Activity size={16} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {t("SCORE OPERATIVO BVELT", "BVELT OPERATIONAL SCORE")}
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
              0–100 pts
            </span>
          </div>
          <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            {t("Eficiencia Comercial y Retención", "Sales Efficiency & Retention")}
          </h3>
        </div>

        {/* Global Score Number */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className={`px-4 py-2 rounded-2xl border flex items-baseline gap-1.5 ${getScoreColor(report.totalScore)}`}>
            <span className="text-3xl font-black font-mono leading-none">
              {report.totalScore}
            </span>
            <span className="text-xs font-bold opacity-75">/100</span>
          </div>
          <div className="text-left text-[11px] text-slate-500 dark:text-slate-400">
            <div className="font-bold text-slate-700 dark:text-slate-200">
              {report.historicalComparison.comparisonText}
            </div>
            <div className="text-[10px] opacity-80">
              {t("Medido desde eventos BEM reales", "Computed from real BEM events")}
            </div>
          </div>
        </div>
      </div>

      {/* HIGHLIGHT: Tu Mayor Fuga Actual */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            {t("TU MAYOR FUGA ACTUAL", "YOUR BIGGEST LEAK RIGHT NOW")}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
            -{report.biggestLeak.lostPoints} pts de potencial
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-black text-slate-900 dark:text-white">
              {report.biggestLeak.leakText}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              {report.biggestLeak.recommendedAction}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCtaClick}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-98"
          >
            <span>{report.biggestLeak.ctaLabel}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 5 Pillars Grid (Each 0–20 pts) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
        {/* 1. Lead response */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span>{t("Lead Response", "Lead Response")}</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {report.pillars.leadResponse.score}/20
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(report.pillars.leadResponse.score / 20) * 100}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 truncate">
            {t("Velocidad de contacto", "Outreach speed")}
          </p>
        </div>

        {/* 2. Quote follow-up */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span>{t("Quote Follow-up", "Quote Follow-up")}</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {report.pillars.quoteFollowup.score}/20
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(report.pillars.quoteFollowup.score / 20) * 100}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 truncate">
            {t("Recordatorio a 48h", "48h reminders")}
          </p>
        </div>

        {/* 3. Reputation */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span>{t("Reputation", "Reputation")}</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {report.pillars.reputation.score}/20
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(report.pillars.reputation.score / 20) * 100}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 truncate">
            {t("Reseñas y réplicas", "Reviews & replies")}
          </p>
        </div>

        {/* 4. Customer recovery */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span>{t("Customer Recovery", "Customer Recovery")}</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {report.pillars.customerRecovery.score}/20
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(report.pillars.customerRecovery.score / 20) * 100}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 truncate">
            {t("Rescate de inactivos", "Dormant rescue")}
          </p>
        </div>

        {/* 5. Reliability */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span>{t("Reliability", "Reliability")}</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {report.pillars.reliability.score}/20
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(report.pillars.reliability.score / 20) * 100}%` }}
            />
          </div>
          <p className="text-[9px] text-slate-400 truncate">
            {t("Evidencia auditable", "Audited evidence")}
          </p>
        </div>
      </div>

      {/* Benchmark de Nicho Transparente (Sin datos inventados) */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
        <ShieldCheck size={14} className="text-indigo-500 shrink-0" />
        <span>
          {report.nicheBenchmark.benchmarkText}
        </span>
      </div>
    </div>
  );
};
