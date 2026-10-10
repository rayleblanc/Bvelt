import React from 'react';
import { ShieldAlert, Zap, ArrowRight, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { PlanActionType, PlanTier, PLAN_LIMITS } from '../../lib/planLimits.ts';

export interface PlanLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitInfo: {
    action?: PlanActionType;
    message?: string;
    limit?: number;
    current?: number;
    plan?: PlanTier;
  } | null;
  onUpgrade: () => Promise<void> | void;
  onViewPlans: () => void;
  checkoutLoading?: boolean;
  t: (es: string, en: string) => string;
}

export const PlanLimitModal: React.FC<PlanLimitModalProps> = ({
  isOpen,
  onClose,
  limitInfo,
  onUpgrade,
  onViewPlans,
  checkoutLoading = false,
  t,
}) => {
  if (!isOpen) return null;

  const action = limitInfo?.action || 'scan';
  const plan = limitInfo?.plan || 'trial';
  const current = limitInfo?.current ?? (limitInfo?.limit || 5);
  const limit = limitInfo?.limit || 5;

  const actionNames: Record<PlanActionType, { en: string; es: string }> = {
    scan: { en: 'Local Market Scans', es: 'Escaneos de Mercado Local' },
    ai: { en: 'AI Co-pilot Queries', es: 'Consultas de Asistente IA' },
    outreach: { en: 'Outreach Drafts', es: 'Borradores de Prospección' },
    spatial: { en: 'Spatial Vision Analyses', es: 'Análisis de Daños Espaciales' },
    audit: { en: 'Deep Radar Audits', es: 'Auditorías de Radar Avanzadas' },
    heavy_audit: { en: 'In-Depth Audits & Reports', es: 'Auditorías Avanzadas y Reportes' },
  };

  const currentActionLabel = actionNames[action] 
    ? t(actionNames[action].es, actionNames[action].en)
    : t('Acción', 'Action');

  const proLimits = PLAN_LIMITS.pro;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl transition-all"
      >
        {/* Header Ribbon */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                {t('Protección de Cuota Diaria', 'Daily Quota Protection')}
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t('Límite Diario Alcanzado', 'Daily Quota Limit Reached')}
              </h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Quota Progress Meter */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {currentActionLabel} ({t('Plan Prueba', 'Trial Tier')})
              </span>
              <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                {current} / {limit} {t('usados hoy', 'used today')}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full w-full rounded-full" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {limitInfo?.message || t(
                `Has alcanzado el límite diario de ${limit} ${currentActionLabel.toLowerCase()} de tu cuenta de prueba. Tu cuota se reinicia a medianoche UTC.`,
                `You have reached the daily limit of ${limit} ${currentActionLabel.toLowerCase()} on your trial account. Your quota resets at UTC midnight.`
              )}
            </p>
          </div>

          {/* Commercial Completeness Anchor */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
              {t(
                "Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.",
                "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send."
              )}
            </p>
          </div>

          {/* Pro Benefits Highlights */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {t('Desbloquea Capacidad Ampliada con Bvelt Pro', 'Unlock High-Volume Access with Bvelt Pro')}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-start gap-2 bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white">
                    {proLimits.maxScansPerDay} {t('Escaneos / Día', 'Scans / Day')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('vs 5 en cuenta de prueba', 'vs 5 on trial plan')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white">
                    {proLimits.maxAiGenerationsPerDay} {t('Consultas IA / Día', 'AI Queries / Day')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('vs 15 en cuenta de prueba (Auditorías usan 3 créditos)', 'vs 15 on trial plan (Heavy audits use 3 credits)')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white">
                    {proLimits.maxOutreachDraftsPerDay} {t('Borradores / Día', 'Outreach / Day')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('Prospección comercial activa', 'Active trade outreach')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white">
                    {t('Sin Contrato', 'Zero Lock-in')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('Cancela cuando quieras', 'Cancel anytime with 1 click')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={checkoutLoading}
              onClick={onUpgrade}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              {checkoutLoading ? (
                <span>{t('Conectando con Stripe...', 'Connecting to Stripe...')}</span>
              ) : (
                <>
                  <span>{t('Mejorar a Bvelt Pro ($49/mes)', 'Upgrade to Bvelt Pro ($49/mo)')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewPlans();
                }}
                className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold underline underline-offset-4 transition cursor-pointer"
              >
                {t('Comparar todos los planes y cuotas', 'Compare all plans and quotas')}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
              >
                {t('Cerrar', 'Close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
