import React from 'react';
import { Zap, Clock, ArrowRight, CheckCircle2, Sparkles, ChevronRight, MessageSquare, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { OutcomeLedgerService } from '../../knowledge/memory/outcomeLedgerService';

export interface CompactActionItem {
  id: string;
  title: string;
  action?: string;
  reason?: string;
  expectedBenefit?: string;
  whyNow?: string;
  actionLabel?: string;
  ctaLabel?: string;
  badge?: string;
  badgeColor?: string;
  estimatedTime?: string;
  targetTab?: string;
  targetSubRow?: number;
  payload?: any;
  destinationCode?: string;
  contextData?: any;
}

interface CompactRecommendedActionsProps {
  actions: CompactActionItem[];
  onExecuteAction: (action: CompactActionItem) => void;
  completedActionIds?: string[];
  t: (es: string, en: string) => string;
}

export const CompactRecommendedActions: React.FC<CompactRecommendedActionsProps> = ({
  actions,
  onExecuteAction,
  completedActionIds = [],
  t
}) => {
  if (!actions || actions.length === 0) return null;

  const top3 = actions.slice(0, 3);

  const handleQuickWhatsApp = (e: React.MouseEvent, item: CompactActionItem) => {
    e.stopPropagation();
    const url = item.contextData?.whatsappUrl;
    if (url) {
      // Record outcome in ledger as CONTACTED
      try {
        OutcomeLedgerService.recordExecution({
          businessId: 'active_business',
          toolId: 'draft_lead_follow_up',
          actionId: item.id,
          executionState: 'SUCCESS',
          outcomeState: 'DECLARED',
          outcomeType: 'CONTACTED',
          metricName: 'LEADS',
          description: `Dispatched quick WhatsApp to ${item.contextData?.leadName || 'lead'}`,
          value: 0
        });
      } catch (err) {
        console.error('Error logging outcome:', err);
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      onExecuteAction(item);
    }
  };

  return (
    <div className="w-full space-y-2.5 my-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Sparkles size={14} />
          </span>
          <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {t("3 Acciones Clave Recomendadas", "3 Key Recommended Actions")}
          </h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
          {t("Priorizadas para hoy", "Prioritized for today")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {top3.map((item, idx) => {
          const isCompleted = completedActionIds.includes(item.id);
          const isHero = idx === 0;
          const hasWhatsApp = Boolean(item.contextData?.whatsappUrl);

          const defaultBadge = idx === 0
            ? t("ACCIÓN #1 • CRÍTICA", "ACTION #1 • CRITICAL")
            : idx === 1
            ? t("ACCIÓN #2 • CRECIMIENTO", "ACTION #2 • GROWTH")
            : t("ACCIÓN #3 • CALIBRACIÓN", "ACTION #3 • CALIBRATION");

          return (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              className={`rounded-2xl p-3 sm:p-3.5 border transition-all flex flex-col justify-between gap-2.5 ${
                isCompleted
                  ? 'bg-slate-50/80 dark:bg-slate-950/40 border-emerald-500/30 text-slate-500 opacity-80'
                  : isHero
                  ? 'bg-gradient-to-br from-indigo-950/90 via-slate-900 to-indigo-900/90 border-indigo-500/40 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs hover:border-indigo-400/40'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : isHero
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                          ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isCompleted ? t("COMPLETADA", "COMPLETED") : (item.badge || defaultBadge)}
                    </span>

                    {item.contextData?.isSlaBreached && !isCompleted && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                        <span>⚡</span>
                        <span>{t("SLA > 15m", "SLA > 15m")}</span>
                      </span>
                    )}
                  </div>

                  <span className={`text-[10px] font-bold flex items-center gap-1 shrink-0 ${isHero ? 'text-indigo-200' : 'text-slate-400'}`}>
                    <Clock size={11} className={isHero ? "text-amber-300" : "text-indigo-500"} />
                    <span>{item.estimatedTime || (idx === 0 ? '2 min' : idx === 1 ? '3 min' : '4 min')}</span>
                  </span>
                </div>

                <h4 className={`text-xs sm:text-sm font-black leading-snug line-clamp-2 ${isHero ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {item.title || item.action}
                </h4>

                <p className={`text-[11px] leading-relaxed line-clamp-2 ${isHero ? 'text-indigo-200/90' : 'text-slate-500 dark:text-slate-400'}`}>
                  {item.reason || item.expectedBenefit || item.whyNow}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {hasWhatsApp && !isCompleted && (
                  <button
                    type="button"
                    onClick={(e) => handleQuickWhatsApp(e, item)}
                    title={t("Despachar por WhatsApp con 1 clic", "1-Click WhatsApp Dispatch")}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-xs flex items-center justify-center shrink-0 cursor-pointer active:scale-[0.96]"
                  >
                    <MessageSquare size={14} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onExecuteAction(item)}
                  disabled={isCompleted}
                  className={`w-full py-2 px-3 rounded-xl font-black text-xs transition flex items-center justify-between gap-2 cursor-pointer active:scale-[0.98] ${
                    isCompleted
                      ? 'bg-emerald-500/10 text-emerald-500 cursor-default'
                      : isHero
                      ? 'bg-white text-indigo-950 hover:bg-slate-100 shadow-sm'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Zap size={13} className={isHero ? "text-indigo-600 fill-indigo-600" : "text-white fill-white"} />
                    <span className="truncate">
                      {isCompleted ? t("Completado", "Completed") : (item.actionLabel || item.ctaLabel || t("Ejecutar", "Execute"))}
                    </span>
                  </div>
                  <ArrowRight size={12} className="shrink-0" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
