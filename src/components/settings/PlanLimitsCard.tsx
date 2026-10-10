import React, { useState } from 'react';
import { ShieldCheck, Zap, ArrowRight, Clock, Check, BarChart2, RefreshCw, Activity } from 'lucide-react';
import { PLAN_LIMITS, resolvePlanTier, PlanTier } from '../../lib/planLimits.ts';
import { useScansQuota, usePlanUsage } from '../../lib/rateLimitService.ts';
import { ApiHealthDiagnosticModal } from './ApiHealthDiagnosticModal.tsx';

interface PlanLimitsCardProps {
  profile: any;
  userSubscription: any;
  t: (es: string, en: string) => string;
  language: string;
  onUpgrade: () => void;
  onViewPlans: () => void;
}

export const PlanLimitsCard: React.FC<PlanLimitsCardProps> = ({
  profile,
  userSubscription,
  t,
  language,
  onUpgrade,
  onViewPlans,
}) => {
  const currentPlanTier: PlanTier = resolvePlanTier(profile || userSubscription);
  const isEn = language === 'en';
  const { trialDaysLeft, isTrialActive } = useScansQuota(profile, language);
  const usage = usePlanUsage(profile, language);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  const activeLimits = PLAN_LIMITS[currentPlanTier];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <BarChart2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                {t('Cuotas de Uso y Límites de Plan', 'Usage Quotas & Plan Limits')}
              </h3>
              <button
                type="button"
                onClick={() => usage.refresh()}
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
                title={t('Actualizar cuotas', 'Refresh quotas')}
              >
                <RefreshCw size={14} className={usage.loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('Gobernanza transparente de consumo diario para proteger recursos y costos.', 'Transparent daily usage limits protecting resources and preventing abuse.')}
            </p>
          </div>
        </div>

        {/* Current Plan Badge & Diagnostic Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDiagnosticModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title={t('Verificar estado de APIs y proveedores', 'Check status of APIs and providers')}
          >
            <Activity size={12} className="text-indigo-500" />
            <span>{t('Diagnóstico APIs', 'API Diagnostics')}</span>
          </button>

          <span className={`text-xs font-black px-3 py-1 rounded-full border ${
            currentPlanTier === 'pro'
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
              : currentPlanTier === 'solo'
                ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          }`}>
            {isEn ? activeLimits.labelEn : activeLimits.labelEs}
          </span>
          {isTrialActive && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              <Clock size={12} />
              {trialDaysLeft} {t('días restantes', 'days left')}
            </span>
          )}
        </div>
      </div>

      {/* Active Daily Usage Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Scans Quota */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('Escaneos de Mercado', 'Market Scans')}
              </span>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                {usage.used.scan} / {usage.limits.scan}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (usage.used.scan / Math.max(1, usage.limits.scan)) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{t('Restantes hoy:', 'Left today:')}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{usage.remaining.scan}</span>
          </div>
        </div>

        {/* AI Co-Pilot Quota */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('Consultas IA / Co-pilot', 'AI Generations')}
              </span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {usage.used.ai} / {usage.limits.ai}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (usage.used.ai / Math.max(1, usage.limits.ai)) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{t('Restantes hoy (Auditorías = 3 cr.):', 'Left today (Audits = 3 cr.):')}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{usage.remaining.ai}</span>
          </div>
        </div>

        {/* Outreach Drafts Quota */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('Borradores Prospección', 'Outreach Drafts')}
              </span>
              <span className="text-xs font-black text-cyan-600 dark:text-cyan-400">
                {usage.used.outreach} / {usage.limits.outreach}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (usage.used.outreach / Math.max(1, usage.limits.outreach)) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{t('Restantes hoy:', 'Left today:')}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{usage.remaining.outreach}</span>
          </div>
        </div>

        {/* Heavy Audits Quota */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('Auditorías Avanzadas', 'In-Depth Audits')}
              </span>
              <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                {usage.used.audit} / {usage.limits.audit}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-purple-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (usage.used.audit / Math.max(1, usage.limits.audit)) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{t('Restantes hoy:', 'Left today:')}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{usage.remaining.audit}</span>
          </div>
        </div>
      </div>

      {/* Jobber Positioning Banner */}
      <div className="p-3.5 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
        <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
        <span>
          <strong className="text-slate-900 dark:text-white">
            {t("Bvelt funciona junto a Jobber, Housecall Pro y ServiceTitan:", "Bvelt works beside Jobber, Housecall Pro & ServiceTitan:")}
          </strong>{" "}
          {t("Impulsa la captación de clientes y visibilidad local en Google Maps — no reemplaza tu agenda o despacho.", "Drives client acquisition & Google Maps local visibility — does not replace scheduling.")}
        </span>
      </div>

      {/* Plan Tier Comparison Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {t('Comparativa Oficial de Niveles (Solo vs Pro)', 'Official Tier Comparison (Solo vs Pro)')}
          </span>
          <span className="text-[11px] text-slate-500">
            {t('Reinicio diario a las 00:00 UTC', 'Daily reset at 00:00 UTC')}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {(['trial', 'solo', 'pro'] as PlanTier[]).map((tierKey) => {
            const plan = PLAN_LIMITS[tierKey];
            const isCurrent = currentPlanTier === tierKey;

            return (
              <div 
                key={tierKey}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCurrent ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white">
                      {isEn ? plan.labelEn : plan.labelEs}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-600 text-white">
                        {t('Tu Plan Actual', 'Current')}
                      </span>
                    )}
                    <span className="text-slate-400">
                      {plan.priceMonthlyUsd === 0 ? t('Gratis', 'Free') : `$${plan.priceMonthlyUsd}/mo`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isEn ? plan.descriptionEn : plan.descriptionEs}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{plan.maxScansPerDay} {t('escaneos/día', 'scans/day')}</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{plan.maxAiGenerationsPerDay} {t('IA/día', 'AI/day')}</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{plan.maxOutreachDraftsPerDay} {t('outreach/día', 'outreach/day')}</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{plan.maxHeavyAuditsPerDay} {t('auditorías/día', 'audits/day')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Callout Footer */}
      {currentPlanTier !== 'pro' && (
        <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 border border-indigo-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Zap className="text-amber-500 shrink-0" size={18} />
            <p className="text-xs text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">
                {t('¿Necesitas más escaneos para tu flota?', 'Need higher scan limits for your crew?')}
              </strong>{' '}
              {t('El Plan Pro eleva tus cuotas a 60 escaneos y 250 peticiones de IA al día.', 'Pro elevates your limits to 60 scans and 250 AI requests per day.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewPlans}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
          >
            <span>{t('Ver Planes & Precios', 'View Plans & Pricing')}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* API Health Diagnostics Modal */}
      <ApiHealthDiagnosticModal
        isOpen={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        t={t}
        language={language}
      />
    </div>
  );
};
