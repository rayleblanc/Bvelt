import React from 'react';
import { ArrowUpRight, Calculator } from 'lucide-react';
import { getEvidenceBadge, EvidenceStatus } from '../../lib/bveltEvidence';

export const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  subtitle: string; 
  color: 'indigo' | 'amber' | 'emerald';
  sourceBadge?: string;
  sourceType?: 'real' | 'calculated' | 'estimated' | 'benchmark' | 'pending';
  evidenceStatus?: EvidenceStatus;
  onClick?: () => void;
  onViewCalculation?: () => void;
  t: (es: string, en: string) => string;
}> = ({ title, value, subtitle, color, sourceBadge, sourceType, evidenceStatus, onClick, onViewCalculation, t }) => {
  const colorMap = {
    indigo: 'border-indigo-100/60 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20',
    amber: 'border-amber-100/60 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20',
    emerald: 'border-emerald-100/60 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20',
  };

  const isValueND = value === "N/D" || value === "N/A" || value === "0" || value === "0.0";
  
  // Resolve certainty status
  const resolvedStatus: EvidenceStatus = evidenceStatus || (
    sourceType === 'real' ? 'VERIFIED' :
    sourceType === 'calculated' ? 'DERIVED' :
    sourceType === 'estimated' || sourceType === 'benchmark' ? 'ESTIMATED' :
    'PENDING'
  );

  const badgeInfo = getEvidenceBadge(resolvedStatus, t);

  // Border style and backdrop based on evidence tier
  const tierContainerStyle = badgeInfo.tier === 1
    ? 'border-emerald-500/30 dark:border-emerald-500/30 shadow-xs'
    : badgeInfo.tier === 2
    ? 'border-indigo-500/25 dark:border-indigo-500/25'
    : badgeInfo.tier === 3
    ? 'border-dashed border-amber-400/40 dark:border-amber-600/30'
    : badgeInfo.tier === 4
    ? 'border-sky-400/30 dark:border-sky-600/30'
    : 'border-slate-200 dark:border-slate-800 opacity-90';

  return (
    <div 
      className={`p-5 rounded-3xl border bg-white/90 dark:bg-slate-900/80 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md ${tierContainerStyle} ${onClick ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500' : ''} ${colorMap[color]}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${badgeInfo.colorClass}`}>
              {badgeInfo.icon} {sourceBadge || badgeInfo.label}
            </span>
            {onViewCalculation && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewCalculation();
                }}
                className="text-slate-400 hover:text-indigo-400 p-0.5 transition cursor-pointer"
                title={t("Ver cálculo", "View calculation")}
              >
                <Calculator size={11} />
              </button>
            )}
          </div>
        </div>
        {onClick && (
          <button 
            type="button"
            onClick={onClick}
            className="text-[9px] font-black uppercase text-indigo-500 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            {t("Ver", "View")} <ArrowUpRight size={10} />
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h4>
        {isValueND && (
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {t("PENDIENTE", "PENDING")}
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{subtitle}</p>
    </div>
  );
};

export const ImpactMetric: React.FC<{
  label: string;
  before: number;
  after: number;
  unit: string;
  color: 'indigo' | 'emerald' | 'amber';
  isConnected?: boolean;
  evidenceStatus?: EvidenceStatus;
  onViewCalculation?: () => void;
  t: (es: string, en: string) => string;
}> = ({ label, before, after, unit, color, isConnected, evidenceStatus, onViewCalculation, t }) => {
  const percentChange = before > 0 ? Math.round(((after - before) / before) * 100) : (after === before ? 0 : null);
  const status: EvidenceStatus = evidenceStatus || (isConnected ? 'VERIFIED' : 'ESTIMATED');
  const badgeInfo = getEvidenceBadge(status, t);
  
  return (
    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-1.5">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${badgeInfo.colorClass}`}>
            {badgeInfo.icon} {badgeInfo.label}
          </span>
          {isConnected && percentChange !== null && percentChange > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              +{percentChange}%
            </span>
          )}
          {onViewCalculation && (
            <button
              onClick={onViewCalculation}
              className="text-slate-400 hover:text-indigo-400 p-0.5 transition cursor-pointer"
              title={t("Ver cálculo", "View calculation")}
            >
              <Calculator size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <div className="space-y-0.5">
          <p className="text-[9px] font-black uppercase text-slate-400">{t("Anterior (Base)", "Previous (Base)")}</p>
          <p className="text-sm font-bold text-slate-400 line-through">{isConnected && before > 0 ? before.toLocaleString() : t("N/D", "N/A")}</p>
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400">{t("Actual Bvelt", "Current Bvelt")}</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {isConnected && after > 0 ? `${after.toLocaleString()} ${unit}` : t("N/D (Pendiente)", "N/A (Pending)")}
          </p>
        </div>
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 p-5 rounded-3xl space-y-3 animate-pulse">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
      <div className="space-y-1 flex-1">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-2 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
    </div>
    <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
    <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
  </div>
);
