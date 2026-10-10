import React from 'react';
import { Zap, Clock, ArrowRight, ShieldCheck, Database, Sparkles, Target, Lightbulb, Activity, TrendingUp } from 'lucide-react';
import { NextBestAction } from '../knowledge/engine/actionEngine';
import { getEvidenceBadge } from '../lib/bveltEvidence';

interface NextActionCardProps {
  nextAction: NextBestAction;
  onExecute: (action: NextBestAction) => void;
  t: (es: string, en: string) => string;
  isHero?: boolean;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  nextAction,
  onExecute,
  t,
  isHero = false,
}) => {
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

  const evBadge = getEvidenceBadge(nextAction.bveltMoment?.evidenceStatus || nextAction.evidenceLevel || 'DERIVED', t);

  const moment = nextAction.bveltMoment || {
    whatIsHappening: nextAction.whyNow,
    whyItMatters: nextAction.reason,
    opportunitySummary: nextAction.expectedBenefit,
    recommendedActionNow: nextAction.ctaLabel,
    evidenceStatus: nextAction.evidenceLevel,
    evidenceSource: nextAction.evidence,
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border-2 border-indigo-500/40 text-slate-900 dark:text-white p-6 sm:p-7 shadow-xl backdrop-blur-xl transition-all hover:border-indigo-500/60 ${
        isHero ? 'ring-2 ring-indigo-500/20' : ''
      }`}
    >
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 space-y-5">
        {/* Header Badge & Meta info */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" />
              <span>{t('OPORTUNIDAD PRIORITARIA DE HOY', "TODAY'S HIGHEST-IMPACT OPPORTUNITY")}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getPriorityBadgeClass(
                nextAction.priority
              )}`}
            >
              {nextAction.priority === 'VERY_HIGH'
                ? t('MUY ALTA', 'VERY HIGH')
                : nextAction.priority === 'HIGH'
                ? t('ALTA', 'HIGH')
                : nextAction.priority === 'MEDIUM'
                ? t('MEDIA', 'MEDIUM')
                : t('BAJA', 'LOW')}
            </span>

            {/* Data Trust Evidence Badge */}
            <span
              title={evBadge.description}
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${evBadge.colorClass}`}
            >
              <span>{evBadge.icon}</span>
              <span>{evBadge.label}</span>
            </span>
          </div>
        </div>

        {/* Main Action Title */}
        <div className="space-y-2 text-left">
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {nextAction.action}
          </h3>

          {/* Context lead tag if present */}
          {nextAction.contextData?.leadName && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
              <Sparkles size={12} />
              <span>
                {t('Cliente / Prospecto:', 'Client / Lead:')} {nextAction.contextData.leadName}
              </span>
            </div>
          )}
        </div>

        {/* 4 Cards synthesis breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* 1. Qué está pasando */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 block">
              <Activity size={12} className="text-indigo-500" />
              {t('Oportunidad de Mercado', 'What Is Happening')}
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
              {moment.whatIsHappening}
            </p>
          </div>

          {/* 2. Por qué importa */}
          <div className="p-3.5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-1 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1 block">
              <Lightbulb size={12} className="text-indigo-500" />
              {t('Por Qué Importa', 'Why It Matters')}
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
              {moment.whyItMatters}
            </p>
          </div>

          {/* 3. Qué oportunidad existe */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1 block">
              <TrendingUp size={12} className="text-emerald-500" />
              {t('Ganancia Esperada', 'Expected Business Revenue')}
            </span>
            <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 leading-snug">
              {moment.opportunitySummary}
            </p>
          </div>

          {/* 4. Qué hacer ahora */}
          <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-1 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1 block">
              <Target size={12} className="text-amber-500" />
              {t('Acción Inmediata', 'Recommended Action Right Now')}
            </span>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 leading-snug">
              {moment.recommendedActionNow}
            </p>
          </div>
        </div>

        {/* Footer info & CTA button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database size={13} className="text-indigo-500" />
              <span className="truncate max-w-[200px]" title={moment.evidenceSource || nextAction.evidence}>
                {moment.evidenceSource || nextAction.evidence}
              </span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <Clock size={13} className="text-emerald-500" />
              <span>{nextAction.estimatedTime}</span>
            </span>
          </div>

          <button
            onClick={() => onExecute(nextAction)}
            className="py-3 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-98 shrink-0"
          >
            <span>{nextAction.ctaLabel}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
