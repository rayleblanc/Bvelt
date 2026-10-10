import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, 
  Sparkles, Copy, MessageCircle, ArrowRight, CornerDownRight, Check,
  HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  evaluateQuoteCompleteness, 
  QuoteCompletenessOutput, 
  CompletenessMissingItem,
  recordQuoteOutcomeToBem
} from '../services/beforeYouSendService';
import { recordBveltEvent } from '../knowledge/memory/bemStore';
import { auth } from '../lib/firebase';

export interface BeforeYouSendPanelProps {
  trade: string;
  draftText: string;
  amount?: number;
  estimateId?: string;
  customerName?: string;
  businessId?: string;
  language: 'es' | 'en';
  t: (es: string, en: string) => string;
  onApplyCloseLine?: (closeLine: string) => void;
  onCopyWhatsApp?: () => void;
  onMarkSentAnyway?: () => void;
  onSendPrimary?: () => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  compact?: boolean;
}

export function BeforeYouSendPanel({
  trade,
  draftText,
  amount,
  estimateId,
  customerName,
  businessId,
  language,
  t,
  onApplyCloseLine,
  onCopyWhatsApp,
  onMarkSentAnyway,
  onSendPrimary,
  showToast,
  compact = false
}: BeforeYouSendPanelProps) {
  const [copiedCloseLine, setCopiedCloseLine] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const lastRecordedCheckRef = useRef<string>('');

  // Evaluate completeness on the fly
  const evaluation: QuoteCompletenessOutput = evaluateQuoteCompleteness({
    trade,
    draftText,
    amount,
    language
  });

  const { status, score, missing, suggestedCloseLine, tradeResolved } = evaluation;

  // Log quote_checked once per draftText change / mount
  useEffect(() => {
    const checkKey = `${trade}:${status}:${missing.map(m => m.id).join(',')}:${draftText.slice(0, 30)}`;
    if (lastRecordedCheckRef.current !== checkKey) {
      lastRecordedCheckRef.current = checkKey;
      recordQuoteOutcomeToBem({
        event: 'quote_checked',
        trade: tradeResolved,
        status,
        missingIds: missing.map(m => m.id),
        businessId: businessId || auth?.currentUser?.uid,
        amount,
        estimateId,
        customerName
      });
    }
  }, [trade, draftText, status]);

  const logSentEvent = (event: 'quote_sent_ready' | 'quote_sent_weak' | 'quote_sent_blocked_override') => {
    recordQuoteOutcomeToBem({
      event,
      trade: tradeResolved,
      status,
      missingIds: missing.map(m => m.id),
      businessId: businessId || auth?.currentUser?.uid,
      amount,
      estimateId,
      customerName
    });
  };

  const handleApplyCloseLine = () => {
    if (!suggestedCloseLine || !onApplyCloseLine) return;
    onApplyCloseLine(suggestedCloseLine);
    setCopiedCloseLine(true);
    showToast?.(
      t('✅ Cierre comercial aplicado al presupuesto.', '✅ Commercial close line added to quote.'),
      'success'
    );
    setTimeout(() => setCopiedCloseLine(false), 2500);
  };

  const handleCopyWhatsApp = () => {
    if (onCopyWhatsApp) {
      onCopyWhatsApp();
    } else if (draftText) {
      navigator.clipboard.writeText(draftText);
    }
    setCopiedWhatsApp(true);
    showToast?.(
      t('✅ Mensaje copiado listo para WhatsApp.', '✅ Message copied for WhatsApp.'),
      'success'
    );
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleSentAnywayClick = () => {
    if (status === 'blocked') {
      logSentEvent('quote_sent_blocked_override');
    } else if (status === 'weak') {
      logSentEvent('quote_sent_weak');
    } else {
      logSentEvent('quote_sent_ready');
    }
    onMarkSentAnyway?.();
    showToast?.(
      t('Presupuesto marcado como enviado (registrado en BEM).', 'Quote marked as sent (logged in BEM).'),
      'info'
    );
  };

  const handlePrimaryCtaClick = () => {
    if (status === 'blocked') {
      const confirmOverride = window.confirm(
        t(
          '⚠️ Este presupuesto tiene elementos obligatorios pendientes (ej. precio o alcance). ¿Deseas enviarlo de todos modos?',
          '⚠️ This quote has mandatory items missing (e.g. price or scope). Do you want to send anyway?'
        )
      );
      if (confirmOverride) {
        logSentEvent('quote_sent_blocked_override');
        onSendPrimary?.();
      } else {
        setIsExpanded(true);
      }
    } else {
      if (status === 'weak') {
        logSentEvent('quote_sent_weak');
      } else {
        logSentEvent('quote_sent_ready');
      }
      onSendPrimary?.();
    }
  };

  // Traffic light styling
  const config = {
    ready: {
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
      dotColor: 'bg-emerald-500',
      title: t('Listo para enviar', 'Ready to send'),
      desc: t('Cumple con todos los estándares comerciales clave.', 'Meets all key commercial standards.'),
      border: 'border-emerald-500/30 dark:border-emerald-500/20',
      cardBg: 'bg-emerald-50/40 dark:bg-emerald-950/20'
    },
    weak: {
      badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
      dotColor: 'bg-amber-500 animate-pulse',
      title: t('Presupuesto débil', 'Weak estimate'),
      desc: t('Faltan detalles recomendados que protegen tus márgenes y cierre.', 'Missing recommended details to protect margin & closing rate.'),
      border: 'border-amber-500/40 dark:border-amber-500/30',
      cardBg: 'bg-amber-50/40 dark:bg-amber-950/20'
    },
    blocked: {
      badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300',
      dotColor: 'bg-rose-500',
      title: t('No enviar aún', "Don't send yet"),
      desc: t('Faltan elementos obligatorios para evitar disputas o pérdida del trabajo.', 'Missing mandatory elements needed to prevent disputes or lost jobs.'),
      border: 'border-rose-500/40 dark:border-rose-500/30',
      cardBg: 'bg-rose-50/40 dark:bg-rose-950/20'
    }
  }[status];

  return (
    <div className={`rounded-2xl border ${config.border} ${config.cardBg} p-3.5 sm:p-4 space-y-3 transition-all`}>
      {/* Header: Traffic Light Badge & Completeness Score */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${config.badgeBg}`}>
            <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
            <span>{config.title}</span>
          </span>

          <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
            {t('Completitud:', 'Completeness:')} <strong className="text-slate-800 dark:text-slate-200">{score}%</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
        >
          <span>{isExpanded ? t('Ocultar checklist', 'Hide checklist') : t('Ver checklist', 'View checklist')}</span>
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Expanded Checklist details */}
      {isExpanded && (
        <div className="space-y-2.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            {config.desc}
          </p>

          {/* Missing items list */}
          {missing.length > 0 ? (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t('Elementos pendientes:', 'Pending items:')}
              </span>
              <div className="space-y-1.5">
                {missing.map((item: CompletenessMissingItem) => (
                  <div 
                    key={item.id}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs flex flex-col gap-0.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                        item.severity === 'must'
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {item.severity === 'must' ? t('OBLIGATORIO', 'MUST HAVE') : t('RECOMENDADO', 'RECOMMENDED')}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-0.5 leading-tight">
                      💡 {item.fixHint}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{t('¡Excelente! Este presupuesto incluye alcance, precio y llamado comercial.', 'Excellent! This quote includes clear scope, price, and commercial call-to-action.')}</span>
            </div>
          )}

          {/* Suggested Close Line Box */}
          {suggestedCloseLine && (
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/40 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>{t('Cierre comercial sugerido', 'Suggested Close Line')}</span>
                </span>
                {onApplyCloseLine && (
                  <button
                    type="button"
                    onClick={handleApplyCloseLine}
                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCloseLine ? <Check size={11} /> : <CornerDownRight size={11} />}
                    <span>{copiedCloseLine ? t('Aplicado', 'Applied') : t('Insertar al texto', 'Insert into draft')}</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 italic font-mono bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/60">
                "{suggestedCloseLine}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Control Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Primary CTA: "Complete required items" if blocked, else standard send */}
        {onSendPrimary && (
          <button
            type="button"
            onClick={handlePrimaryCtaClick}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 ${
              status === 'blocked'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : status === 'weak'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {status === 'blocked' ? (
              <>
                <AlertTriangle size={13} />
                <span>{t('Completar elementos requeridos', 'Complete required items')}</span>
              </>
            ) : (
              <>
                <MessageCircle size={13} />
                <span>{t('Enviar por WhatsApp', 'Send via WhatsApp')}</span>
              </>
            )}
          </button>
        )}

        {/* Apply Close Line Action Button */}
        {suggestedCloseLine && onApplyCloseLine && (
          <button
            type="button"
            onClick={handleApplyCloseLine}
            className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 transition cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles size={12} className="text-amber-500" />
            <span>{t('Aplicar cierre sugerido', 'Apply suggested close line')}</span>
          </button>
        )}

        {/* Copy for WhatsApp */}
        <button
          type="button"
          onClick={handleCopyWhatsApp}
          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5"
        >
          {copiedWhatsApp ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          <span>{t('Copiar para WhatsApp', 'Copy for WhatsApp')}</span>
        </button>

        {/* Mark as Sent Anyway (allowed for weak or blocked with explicit logging) */}
        {onMarkSentAnyway && (
          <button
            type="button"
            onClick={handleSentAnywayClick}
            className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-bold rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition cursor-pointer ml-auto"
            title={t('Registra el envío en memoria BEM aún con advertencias', 'Logs the dispatch in BEM memory even with warnings')}
          >
            <span>{t('Marcar como enviado de todos modos', 'Mark as sent anyway')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
