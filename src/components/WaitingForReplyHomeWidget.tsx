import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, MessageSquare, Check, Sparkles, DollarSign, AlertTriangle } from 'lucide-react';
import { getSavedEstimates, EstimateRecord } from '../services/estimateFollowUpService';
import { evaluateQuoteCompleteness } from '../services/beforeYouSendService';
import { navigateTo } from '../lib/navigateTo';

export interface WaitingForReplyHomeWidgetProps {
  t: (es: string, en: string) => string;
  language: 'es' | 'en';
  onNavigateToFollowUp: () => void;
}

export function WaitingForReplyHomeWidget({
  t,
  language,
  onNavigateToFollowUp
}: WaitingForReplyHomeWidgetProps) {
  const [waitingEstimates, setWaitingEstimates] = useState<EstimateRecord[]>([]);

  useEffect(() => {
    const all = getSavedEstimates(language);
    const waiting = all.filter(e => e.status === 'waiting');
    setWaitingEstimates(waiting);
  }, [language]);

  if (waitingEstimates.length === 0) {
    return null;
  }

  const weakOrBlocked = waitingEstimates.filter(est => {
    const evalResult = evaluateQuoteCompleteness({
      trade: est.jobType || 'lawn_care',
      draftText: est.followUpDraft || est.notes || est.jobType || '',
      amount: typeof est.amount === 'number' ? est.amount : undefined,
      language
    });
    return evalResult.status === 'weak' || evalResult.status === 'blocked';
  });

  const topTwo = waitingEstimates.slice(0, 2);

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-slate-50 to-indigo-500/10 dark:from-amber-950/30 dark:via-slate-900 dark:to-indigo-950/30 border border-amber-300/60 dark:border-amber-700/50 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Before You Send Warning Card if any quote is weak/blocked */}
      {weakOrBlocked.length > 0 && (
        <div 
          onClick={onNavigateToFollowUp}
          className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-amber-500/20 transition group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="font-black text-amber-900 dark:text-amber-100 block truncate">
                {t("Presupuesto a punto de enviarse débil — corrige antes de enviar", "Quote about to go out weak — fix before send")}
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-300 block truncate">
                {t(`${weakOrBlocked.length} presupuesto(s) con faltantes comerciales clave.`, `${weakOrBlocked.length} quote(s) missing key commercial elements.`)}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-black text-amber-800 dark:text-amber-200 flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
            <span>{t("Corregir", "Fix")}</span>
            <ArrowRight size={12} />
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/50 dark:border-amber-800/40 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock size={15} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t('Presupuestos Esperando Respuesta', 'Quotes Waiting for Reply')}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                {waitingEstimates.length} {t('pendientes', 'pending')}
              </span>
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToFollowUp}
          className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer self-start sm:self-auto group"
        >
          <span>{t('Abrir Seguimiento', 'Open Follow-up')}</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {topTwo.map((est) => (
          <div
            key={est.id}
            onClick={onNavigateToFollowUp}
            className="p-3 bg-white dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 cursor-pointer hover:border-indigo-400/60 transition shadow-2xs group"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {est.customerName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {est.jobType} {est.amount ? `• $${est.amount}` : ''}
              </p>
            </div>
            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 flex items-center gap-1">
              <Sparkles size={11} className="text-amber-500" />
              <span>{t('Redactar', 'Write')}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
