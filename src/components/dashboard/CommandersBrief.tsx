import React, { useState } from 'react';
import { 
  Zap, ArrowRight, CheckSquare, Mic, ShieldCheck, 
  Sparkles, ChevronRight, CheckCircle2, AlertTriangle, 
  XCircle, Clock, History, AlertCircle, Phone, 
  ExternalLink, Layers, Radio, TrendingUp, Building2
} from 'lucide-react';
import { motion } from 'motion/react';
import { ScanState, DegradedReason } from '../../services/scanResultNormalizer';
import { getTenantUsage, TenantDailyUsage } from '../../lib/rateLimitService';

export type NavigationTarget = 'home' | 'estimate_followup' | 'gbp_audit' | 'inbox_leads' | 'reputation_shield' | 'job_evidence';

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse ${className}`} />
);

export interface CommandersBriefMetric {
  id: string;
  label: string;
  value: string | number;
  sublabel?: string;
  onClick?: () => void;
}

export interface CommercialBucket {
  id: string;
  title: string;
  amount: number;
  label: 'REAL/VERIFIED' | 'MODELED' | 'BENCHMARK';
  description: string;
  currency?: string;
  onClick?: () => void;
}

export interface UrgentActionItem {
  id: string;
  title: string;
  reason: string;
  priority: 'URGENTE' | 'ALTA' | 'MEDIA';
  ctaLabel: string;
  targetScreenName: string;
  onClick: () => void;
}

export interface OpportunityItem {
  id: string;
  source: string;
  date: string;
  client: string;
  detail: string;
  estimatedValue?: number;
  valueTag: 'REAL/VERIFIED' | 'MODELED' | 'BENCHMARK' | 'DECLARADO';
  ctaLabel: string;
  onClick: () => void;
}

export interface WhileAwayEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type?: 'sync' | 'execution' | 'radar' | 'message';
}

export interface SystemHealthItem {
  key: 'google' | 'email' | 'maps' | 'ai' | 'payments';
  name: string;
  status: 'healthy' | 'warning' | 'error';
  statusChar: '✓' | '△' | '✗';
  detail: string;
  onClick?: () => void;
}

export interface CommandersBriefProps {
  businessName: string;
  category?: string;
  location?: string;
  planName: string;
  isPro?: boolean;
  trialDaysLeft?: number;
  scansLeft?: number;
  onUpgradeClick?: () => void;
  diagnosis: {
    line1: string;
    line2: string;
    line3: string;
    whyThisMatters?: string;
    evidenceBadge?: string;
    isScanning?: boolean;
    retryOptions?: number[];
    onRetryRadius?: (radius: number) => void;
    lastCalibrated?: string;
    scanState?: ScanState;
    degradedReason?: DegradedReason;
    userMessage?: string;
    isCached?: boolean;
    cacheAgeText?: string;
  };
  primaryCta: {
    label: string;
    sublabel?: string;
    buttonText?: string;
    onClick: () => void;
    disabled?: boolean;
    proofBullets?: string[];
  };
  metrics?: CommandersBriefMetric[];
  commercialBuckets?: CommercialBucket[];
  urgentActions?: UrgentActionItem[];
  urgentActionsEmptyReason?: string;
  opportunities?: OpportunityItem[];
  opportunitiesEmptyReason?: string;
  onNavigateToReactivation?: () => void;
  onNavigateToScan?: () => void;
  whileAwayEvents?: WhileAwayEvent[];
  systemHealth?: SystemHealthItem[];
  onStartVoice?: () => void;
  onOpenWeeklyReport?: () => void;
  onOpenFunnelGenerator?: () => void;
  isLoading?: boolean;
  t: (es: string, en: string) => string;
}

export const CommandersBrief: React.FC<CommandersBriefProps> = ({
  businessName,
  category,
  location,
  planName,
  isPro,
  trialDaysLeft,
  scansLeft,
  onUpgradeClick,
  diagnosis,
  primaryCta,
  metrics,
  commercialBuckets,
  urgentActions = [],
  urgentActionsEmptyReason,
  opportunities = [],
  opportunitiesEmptyReason,
  onNavigateToReactivation,
  onNavigateToScan,
  whileAwayEvents = [],
  systemHealth = [],
  onStartVoice,
  onOpenWeeklyReport,
  onOpenFunnelGenerator,
  isLoading = false,
  t
}) => {
  const tenantUsage: TenantDailyUsage = React.useMemo(() => {
    return getTenantUsage(isPro ? 'pro' : 'trial');
  }, [isPro]);

  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 space-y-4 shadow-sm animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5 w-1/2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="space-y-2 py-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-4/6" />
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3 pt-2">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full bg-white dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 md:p-6 shadow-sm relative overflow-hidden space-y-5"
    >
      {/* Subtle background ambient highlight */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header: Business Identity & Plan Status */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {businessName || t("Mi Negocio", "My Business")}
            </h1>
            {category && (
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate max-w-[140px]">
                {category}
              </span>
            )}
          </div>
          {location && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
              {location}
            </p>
          )}
        </div>

        {/* Plan status badge & voice trigger & weekly report */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenWeeklyReport && (
            <button
              onClick={onOpenWeeklyReport}
              title={t("Ver Informe Semanal", "View Weekly Report")}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black transition cursor-pointer flex items-center gap-1 hover:bg-indigo-100"
            >
              <span>📊</span>
              <span className="hidden sm:inline">{t("Informe Semanal", "Weekly Report")}</span>
            </button>
          )}

          {onOpenFunnelGenerator && (
            <button
              onClick={onOpenFunnelGenerator}
              title={t("Generar Enlace de Embudo (/r/:id)", "Generate Funnel Link (/r/:id)")}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black transition cursor-pointer flex items-center gap-1 hover:bg-emerald-100"
            >
              <span>🔗</span>
              <span className="hidden sm:inline">{t("Embudo /r/:id", "Funnel /r/:id")}</span>
            </button>
          )}

          {onStartVoice && (
            <button
              onClick={onStartVoice}
              title={t("Asistente por voz", "Voice Assistant")}
              className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              aria-label="Voice Assistant"
            >
              <Mic size={14} />
            </button>
          )}

          <button
            onClick={onUpgradeClick}
            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${
              isPro
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20'
            }`}
          >
            <Sparkles size={11} className={isPro ? "text-emerald-500" : "text-indigo-500"} />
            <span>
              {isPro
                ? (planName || 'Plan Pro')
                : trialDaysLeft !== undefined && trialDaysLeft > 0
                ? `${t("Prueba", "Trial")} (${trialDaysLeft}d)`
                : scansLeft !== undefined
                ? `${scansLeft} ${t("escaneos", "scans")}`
                : (planName || t("Gratis", "Free"))}
            </span>
            <ChevronRight size={11} className="opacity-60" />
          </button>
        </div>
      </div>

      {/* Proof Callout Banner: Before You Send Value Anchor ($49 Feel Cheap) */}
      <div 
        onClick={!isPro ? onUpgradeClick : undefined}
        className={`p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-slate-50 to-emerald-500/10 dark:from-indigo-950/40 dark:via-slate-900/40 dark:to-emerald-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between gap-2.5 text-xs ${!isPro ? 'cursor-pointer hover:border-indigo-400/80 transition shadow-2xs group' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
            <ShieldCheck size={14} />
          </span>
          <p className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
            {t(
              "Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.",
              "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send."
            )}
          </p>
        </div>
        {!isPro ? (
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>$49/mo</span>
            <ArrowRight size={11} />
          </span>
        ) : (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>{t("Verificado", "Verified")}</span>
          </span>
        )}
      </div>

      {/* BLOQUE E: SALUD DEL SISTEMA (Google / Correo / Mapas / IA / Pagos -> ✓ △ ✗) */}
      {systemHealth && systemHealth.length > 0 && (
        <div className="bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>⚡</span>
              <span>{t("Salud del Negocio y Canales", "Business & Channels Health")}</span>
            </span>
            <span className="text-[9px] font-bold text-slate-400">
              {t("Estado en tiempo real", "Real-time status")}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {systemHealth.map((item) => {
              const isHealthy = item.status === 'healthy';
              const isWarning = item.status === 'warning';
              
              const badgeBg = isHealthy
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                : isWarning
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300';

              const iconColor = isHealthy ? 'text-emerald-500' : isWarning ? 'text-amber-500' : 'text-rose-500';

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-1.5 text-left transition hover:scale-[1.02] cursor-pointer ${badgeBg}`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold block truncate opacity-80">{item.name}</span>
                    <span className="text-[11px] font-black block truncate">{item.detail}</span>
                  </div>
                  <span className={`text-xs font-black shrink-0 ${iconColor} px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-slate-900/70 border border-current`}>
                    {item.statusChar}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* BLOQUE A: 3 CUBOS COMERCIALES NUNCA SUMADOS (Recuperado | En juego | Detectado) */}
      {commercialBuckets && commercialBuckets.length >= 3 && (
        <div className="space-y-2 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-500" />
              <span>{t("Métricas Comerciales (3 Cubos Independientes)", "Commercial Metrics (3 Separate Buckets)")}</span>
            </span>
            <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {t("NUNCA se suman", "NEVER summed")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {commercialBuckets.map((bucket) => {
              const isReal = bucket.label === 'REAL/VERIFIED';
              const isModeled = bucket.label === 'MODELED';
              
              const borderTheme = isReal
                ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 to-transparent dark:from-emerald-950/20'
                : isModeled
                ? 'border-indigo-500/40 bg-gradient-to-b from-indigo-500/5 to-transparent dark:from-indigo-950/20'
                : 'border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent dark:from-amber-950/20';

              const badgeColor = isReal
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : isModeled
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';

              return (
                <div
                  key={bucket.id}
                  onClick={bucket.onClick}
                  className={`p-4 rounded-2xl border ${borderTheme} flex flex-col justify-between space-y-2 transition-all hover:shadow-sm ${bucket.onClick ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-600' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {bucket.title}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}>
                      {bucket.label}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none block">
                      ${bucket.amount.toLocaleString()}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
                    {bucket.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <span className="text-amber-500 font-bold shrink-0">ℹ️</span>
            <span>
              {t(
                "Aviso de transparencia: Prohibido inventar $ recuperado. Los 3 cubos tienen niveles de certeza distintos (Real auditado vs Modelado en pipeline vs Benchmark de zona) y jamás deben sumarse.",
                "Transparency notice: Never invent recovered $. The 3 buckets have distinct certainty levels (Verified audit vs Modeled pipeline vs Territory benchmark) and must never be summed."
              )}
            </span>
          </div>
        </div>
      )}

      {/* 2. Today's Diagnosis (Strict 3 Lines for Mobile Commander's Brief) */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 space-y-2 text-left">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t("Diagnóstico del Negocio de Hoy", "Today's Business Diagnosis")}
          </span>
          {diagnosis.evidenceBadge && (
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {diagnosis.evidenceBadge}
            </span>
          )}
        </div>

        {/* Scan Status Banner (fresh | cached | empty | degraded | action_required) */}
        {(diagnosis.userMessage || diagnosis.scanState) && (
          <div className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center justify-between gap-2 ${
            diagnosis.scanState === 'degraded'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
              : diagnosis.scanState === 'action_required'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
              : diagnosis.scanState === 'empty'
              ? 'bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300'
              : diagnosis.scanState === 'cached'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-800 dark:text-indigo-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">
                {diagnosis.scanState === 'degraded' ? '⚠️' : diagnosis.scanState === 'action_required' ? '🚨' : diagnosis.scanState === 'empty' ? '⚪' : diagnosis.scanState === 'cached' ? '🔵' : '🟢'}
              </span>
              <span className="truncate font-semibold">
                {diagnosis.userMessage || (diagnosis.scanState === 'cached' && diagnosis.cacheAgeText ? `Datos en caché (${diagnosis.cacheAgeText})` : `Estado: ${diagnosis.scanState}`)}
              </span>
            </div>
            {diagnosis.cacheAgeText && diagnosis.scanState === 'cached' && (
              <span className="text-[10px] font-black shrink-0 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                {diagnosis.cacheAgeText}
              </span>
            )}
          </div>
        )}

        {/* Line 1: Market Position / Territory Signal */}
        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug flex items-start gap-1.5">
          <span className="shrink-0 mt-0.5">📍</span>
          <span>{diagnosis.line1}</span>
        </p>

        {/* Line 2: Bottleneck / Gap */}
        <p className="text-xs text-slate-900 dark:text-white font-bold leading-snug flex items-start gap-1.5">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{diagnosis.line2}</span>
        </p>

        {/* Line 3: Prescribed Direct Action */}
        <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold leading-snug flex items-start gap-1.5">
          <span className="shrink-0 mt-0.5">🎯</span>
          <span>{diagnosis.line3}</span>
        </p>

        {/* Retry options if sparse / no competitors */}
        {diagnosis.retryOptions && diagnosis.retryOptions.length > 0 && diagnosis.onRetryRadius && (
          <div className="pt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {t("Reintentar con radio más amplio:", "Retry with wider radius:")}
            </span>
            {diagnosis.retryOptions.map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => diagnosis.onRetryRadius?.(km)}
                className="px-2 py-0.5 text-[11px] font-black bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1"
              >
                <span>⚡</span>
                <span>{t(`Reintentar a ${km} km`, `Retry at ${km} km`)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Why this matters one-liner */}
        {diagnosis.whyThisMatters && (
          <div className="pt-1.5 mt-1 border-t border-slate-200/60 dark:border-slate-800 flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-tight">
            <span className="text-amber-500 font-bold shrink-0">💡</span>
            <span>
              <strong className="text-slate-800 dark:text-slate-200">{t("Por qué importa:", "Why this matters:")}</strong> {diagnosis.whyThisMatters}
            </span>
          </div>
        )}

        {/* Last calibrated timestamp */}
        {diagnosis.lastCalibrated && (
          <div className="pt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>🕒</span>
            <span>{diagnosis.lastCalibrated}</span>
          </div>
        )}
      </div>

      {/* 3. Primary CTA Button (Single Hero Action per view) */}
      <div className="pt-1">
        <button
          onClick={primaryCta.onClick}
          disabled={primaryCta.disabled}
          className="w-full py-3 sm:py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] text-white font-black text-xs sm:text-sm tracking-wide transition-all shadow-md hover:shadow-indigo-500/25 flex items-center justify-between gap-3 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed border-none"
        >
          <div className="flex items-center gap-2 min-w-0 text-left">
            <span className="p-1.5 rounded-xl bg-white/20 text-white shrink-0 group-hover:scale-110 transition-transform">
              <Zap size={16} />
            </span>
            <div className="min-w-0">
              <span className="block truncate font-black">{primaryCta.label}</span>
              {primaryCta.sublabel && (
                <span className="block text-[10px] text-indigo-100 font-normal truncate opacity-90">
                  {primaryCta.sublabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-white/20 px-2.5 py-1 rounded-xl text-[11px] font-black group-hover:translate-x-0.5 transition-transform">
            <span>{primaryCta.buttonText || (primaryCta.label ? primaryCta.label : t("Ejecutar Acción", "Execute Action"))}</span>
            <ArrowRight size={13} />
          </div>
        </button>

        {/* Proof Panel */}
        {primaryCta.proofBullets && primaryCta.proofBullets.length > 0 && (
          <div className="mt-2.5 p-3 rounded-2xl bg-indigo-950/20 dark:bg-indigo-950/40 border border-indigo-500/20 text-left space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>{t("Por qué Bvelt recomienda esto (Basado en evidencias):", "Why Bvelt thinks this (Evidence-backed):")}</span>
            </div>
            <ul className="space-y-1 pt-1">
              {primaryCta.proofBullets.map((bullet, idx) => (
                <li key={idx} className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* BLOQUE B: MÁX 5 ACCIONES URGENTES (Cada CTA navega a la pantalla que resuelve ese problema) */}
      <div className="space-y-2.5 text-left border-t border-slate-100 dark:border-slate-800/80 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>🚨</span>
              <span>{t("Acciones Urgentes Requeridas", "Urgent Actions Required")}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {urgentActions.length}/5
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {t("Resolución directa por pantalla", "Direct screen resolution")}
          </span>
        </div>

        {urgentActions.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-center space-y-1">
            <span className="text-emerald-500 text-base">✓</span>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {urgentActionsEmptyReason || t("Todo al día: no hay acciones críticas desatendidas en este momento.", "All up to date: no unattended critical actions right now.")}
            </p>
            <p className="text-[10px] text-slate-400">
              {t("Tus canales de leads, presupuestos y reseñas están gestionados.", "Your leads, quotes, and reviews channels are managed.")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {urgentActions.slice(0, 5).map((action) => {
              const isUrgent = action.priority === 'URGENTE';
              const isHigh = action.priority === 'ALTA';
              const priorityBadge = isUrgent
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                : isHigh
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';

              return (
                <div
                  key={action.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-indigo-400/60"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${priorityBadge}`}>
                        {action.priority}
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                        {action.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      {action.reason}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={action.onClick}
                    className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
                  >
                    <span>{action.ctaLabel}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BLOQUE C: LISTA DE OPORTUNIDADES (Fuente, Fecha, Estimado etiquetado, CTA) */}
      <div className="space-y-2.5 text-left border-t border-slate-100 dark:border-slate-800/80 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>🎯</span>
              <span>{t("Centro de Oportunidades", "Opportunity Center")}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {opportunities.length}
            </span>
          </div>

          {/* BADGES DE CONTADORES VISIBLES POR TENANT/DÍA */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              title={t("Cuota diaria de escaneos de zona", "Daily zone scan quota")}
              className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                tenantUsage.scan.isLimitReached
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
              }`}
            >
              🔍 {tenantUsage.scan.label}
            </span>
            <span
              title={t("Cuota diaria de borradores IA", "Daily AI draft quota")}
              className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                tenantUsage.ai.isLimitReached
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
              }`}
            >
              ✍️ {tenantUsage.ai.label}
            </span>
            <span
              title={t("Cuota diaria de rescates de seguimiento", "Daily follow-up rescue quota")}
              className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                tenantUsage.outreach.isLimitReached
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              }`}
            >
              📩 {tenantUsage.outreach.label}
            </span>
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2.5">
            <span className="text-slate-400 text-sm">📂</span>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-md mx-auto">
              {opportunitiesEmptyReason || t(
                "No hay oportunidades en tu territorio todavía.",
                "No opportunities in your territory yet."
              )}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {onNavigateToReactivation && (
                <button
                  type="button"
                  onClick={onNavigateToReactivation}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <span>⚡</span>
                  <span>{t("Reactivar Clientes", "Reactivate Clients")}</span>
                </button>
              )}
              {onNavigateToScan && (
                <button
                  type="button"
                  onClick={onNavigateToScan}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <span>🔍</span>
                  <span>{t("Escanear Territorio", "Scan Territory")}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {opportunities.slice(0, 5).map((opp) => (
              <div
                key={opp.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-indigo-400/50 transition"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60">
                      {opp.source}
                    </span>
                    <span className="text-slate-400 font-medium">
                      🕒 {opp.date}
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                      {opp.estimatedValue ? `$${opp.estimatedValue.toLocaleString()} • ${opp.valueTag}` : opp.valueTag}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                    {opp.client}
                  </h4>
                  {opp.detail && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                      "{opp.detail}"
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={opp.onClick}
                  className="shrink-0 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
                >
                  <span>{opp.ctaLabel}</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BLOQUE D: “BVELT MIENTRAS NO MIRABAS” (Solo eventos reales o “sin actividad aún”) */}
      <div className="space-y-2.5 text-left border-t border-slate-100 dark:border-slate-800/80 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
            <History size={13} className="text-indigo-500" />
            <span>{t("Bvelt mientras no mirabas", "Bvelt while you were away")}</span>
          </span>
          <span className="text-[9px] font-bold text-slate-400">
            {t("Solo eventos reales comprobados", "Only verified real events")}
          </span>
        </div>

        {whileAwayEvents.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/70 text-left">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
              <span>
                {t(
                  "Sin actividad aún. Bvelt registrará aquí las acciones automáticas, respuestas y detecciones tan pronto ocurran.",
                  "No activity yet. Bvelt will log automated actions, replies, and detections here as soon as they occur."
                )}
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {whileAwayEvents.slice(0, 4).map((ev) => (
              <div
                key={ev.id}
                className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5 text-left text-xs"
              >
                <span className="mt-0.5 text-emerald-500 font-bold shrink-0">⚡</span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {ev.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {ev.timestamp}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {ev.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* METRIC CHIPS ADICIONALES (Clickable fast navigation) */}
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {metrics.slice(0, 3).map((metric) => (
            <button
              key={metric.id}
              onClick={metric.onClick}
              disabled={!metric.onClick}
              className={`p-2.5 sm:p-3 rounded-2xl bg-slate-50/70 hover:bg-indigo-50/50 dark:bg-slate-950/40 dark:hover:bg-slate-800/60 border border-slate-100 hover:border-indigo-200 dark:border-slate-800/60 dark:hover:border-indigo-900/60 transition-all text-center flex flex-col items-center justify-center ${
                metric.onClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider truncate w-full mb-0.5">
                {metric.label}
              </span>
              <span className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {metric.value}
              </span>
              {metric.sublabel && (
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate w-full mt-0.5">
                  {metric.sublabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
};
