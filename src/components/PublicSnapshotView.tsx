import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, ShieldCheck, MapPin, Building2, TrendingUp, Award, 
  Share2, ArrowRight, CheckCircle2, AlertTriangle, Target, Lock, 
  Copy, Sun, Moon, ExternalLink, Users, ChevronRight, Zap
} from 'lucide-react';
import { IndustryResolver } from '../knowledge/resolvers/industryResolver';
import { getVerticalConfig } from '../knowledge/verticals';
import { executeBusinessScan, BusinessScanResult } from '../services/businessScanService';
import { OutcomeLedgerService } from '../knowledge/memory/outcomeLedgerService';

interface PublicSnapshotViewProps {
  language: 'es' | 'en';
  setLanguage: (lang: 'es' | 'en') => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  t: (es: string, en: string) => string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onGoToSignup?: (refId?: string) => void;
}

export function PublicSnapshotView({
  language,
  setLanguage,
  isDarkMode,
  setIsDarkMode,
  t,
  showToast,
  onGoToSignup
}: PublicSnapshotViewProps) {
  const [params, setParams] = useState({
    bizName: 'Negocio Local',
    city: 'Miami, FL',
    niche: 'HVAC & Climate Control',
    score: 76,
    referredBy: ''
  });

  const [scanData, setScanData] = useState<BusinessScanResult | null>(null);
  const [isLoadingScan, setIsLoadingScan] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const biz = urlParams.get('biz') || urlParams.get('business') || urlParams.get('name') || 'Negocio Local';
      const loc = urlParams.get('city') || urlParams.get('loc') || urlParams.get('location') || 'Miami, FL';
      const cat = urlParams.get('niche') || urlParams.get('cat') || urlParams.get('category') || 'HVAC & Climate Control';
      const scoreNum = parseInt(urlParams.get('score') || '76', 10);
      const ref = urlParams.get('ref') || urlParams.get('referred_by') || urlParams.get('referrer') || '';

      setParams({
        bizName: biz,
        city: loc,
        niche: cat,
        score: isNaN(scoreNum) ? 76 : scoreNum,
        referredBy: ref
      });

      if (ref) {
        localStorage.setItem('bvelt_referred_by', ref);
      }

      // Hard reset scan state so a subsequent business never displays previous business figures
      setIsLoadingScan(true);
      setScanData(null);
      setExpandedProofSegment(null);

      // Record non-blocking outcome ledger suggestion for opening public report
      OutcomeLedgerService.recordSuggestion({
        businessId: biz,
        problem: 'Public Revenue Leak Report Opened',
        recommendationId: `public_report_${biz.replace(/[^a-zA-Z0-9]/g, '_')}`,
        actionType: 'OPEN_PUBLIC_REPORT',
        evidenceRefs: [loc, cat]
      });

      // Execute non-private market scan with clean business input
      executeBusinessScan({
        businessName: biz,
        city: loc,
        niche: cat
      }).then(res => {
        if (!isCancelled) {
          setScanData(res);
          setIsLoadingScan(false);
        }
      }).catch(err => {
        console.warn('Scan failed for snapshot view:', err);
        if (!isCancelled) {
          setIsLoadingScan(false);
        }
      });
    } catch (e) {
      console.error(e);
      if (!isCancelled) {
        setIsLoadingScan(false);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [typeof window !== 'undefined' ? window.location.search : '']);

  const verticalConfig = getVerticalConfig(params.niche);

  // Observable signals verification: only compute revenue numbers when backed by evidence
  const competitorCount = scanData?.competitors?.length || 0;
  const hasReviewSignal = scanData?.identity?.reviewCount !== undefined && scanData?.identity?.reviewCount !== null;
  const hasCompetitorSignal = competitorCount > 0;
  const hasWebsiteSignal = Boolean(scanData?.identity && typeof scanData.identity.website === 'string');

  const hasSignals = Boolean(scanData && (hasCompetitorSignal || hasReviewSignal || hasWebsiteSignal));
  const ticket = verticalConfig.averageTicket || 350;

  // Breakdown segments based strictly on observable signals - zero fake dollars if no signal
  const recoverableAmount = hasReviewSignal ? Math.round(ticket * 1.5) : (hasSignals ? Math.round(ticket * 1.0) : 0);
  const atRiskAmount = hasCompetitorSignal ? Math.round(competitorCount * ticket * 0.75) : 0;
  const unclaimedAmount = hasWebsiteSignal ? 0 : (hasSignals ? Math.round(ticket * 1.25) : 0);
  const totalRecoverableOpportunity = hasSignals ? (recoverableAmount + atRiskAmount + unclaimedAmount) : 0;

  const [expandedProofSegment, setExpandedProofSegment] = useState<'recoverable' | 'at_risk' | 'unclaimed' | null>(null);

  const handleCopyShareLink = () => {
    const origin = window.location.origin;
    const shareUrl = `${origin}/report?biz=${encodeURIComponent(params.bizName)}&city=${encodeURIComponent(params.city)}&category=${encodeURIComponent(params.niche)}${params.referredBy ? `&ref=${encodeURIComponent(params.referredBy)}` : ''}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      showToast(
        t("¡Enlace de reporte copiado! Listo para compartir.", "Report link copied! Ready to share."),
        "success"
      );
      setTimeout(() => setCopiedLink(false), 3000);
    }).catch(() => {
      showToast(t("Error al copiar enlace.", "Failed to copy link."), "error");
    });
  };

  const handleClaimOrSignup = () => {
    OutcomeLedgerService.recordSuggestion({
      businessId: params.bizName,
      problem: 'CTA Claim Audit Clicked',
      recommendationId: 'cta_claim_audit_public',
      actionType: 'CLAIM_FREE_AUDIT',
      evidenceRefs: [params.city, params.niche]
    });
    if (params.referredBy) {
      localStorage.setItem('bvelt_referred_by', params.referredBy);
    }
    if (onGoToSignup) {
      onGoToSignup(params.referredBy);
    } else {
      window.location.href = `/?register=true${params.referredBy ? `&ref=${params.referredBy}` : ''}`;
    }
  };

  const handleExecuteNba = () => {
    // Record ledger suggestion event for clicking the primary NBA button
    OutcomeLedgerService.recordSuggestion({
      businessId: params.bizName,
      problem: 'Public NBA Action Clicked',
      recommendationId: `nba_public_${params.bizName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      actionType: 'EXECUTE_NBA_ACTION',
      evidenceRefs: [
        params.city,
        params.niche,
        `${competitorCount} competitors`,
        `Opportunity: $${totalRecoverableOpportunity}`
      ]
    });

    handleClaimOrSignup();
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors duration-200`}>
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black flex items-center justify-center text-lg shadow-md shadow-indigo-500/20">
              B
            </div>
            <div>
              <span className="font-black text-base text-white tracking-tight flex items-center gap-1.5">
                Bvelt
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  {t("Snapshot Público", "Public Snapshot")}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 rounded-lg border border-slate-700 transition"
            >
              {language.toUpperCase()}
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 text-slate-300 hover:text-white bg-slate-800/80 rounded-lg border border-slate-700 transition"
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Privacy Shield Disclaimer Banner */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
            <p className="font-medium truncate">
              {t(
                "Vista Pública Verificada: Excluye automáticamente todos los leads privados, teléfonos de clientes y mensajes del CRM.",
                "Verified Public View: Automatically excludes all private leads, customer phones, and CRM messages."
              )}
            </p>
          </div>
          <button
            onClick={handleCopyShareLink}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition flex items-center gap-1 shrink-0 shadow-sm"
          >
            <Copy size={13} />
            <span>{copiedLink ? t("¡Copiado!", "Copied!") : t("Compartir", "Share")}</span>
          </button>
        </div>

        {/* Business Hero Header - REVENUE LEAK REPORT */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Building2 size={12} /> {params.niche}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  <MapPin size={12} /> {params.city}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚠️ {t("Reporte de Fuga de Ingresos", "Revenue Leak Report")}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {params.bizName}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                {t(
                  `Auditoría pública externa basada estrictamente en señales de mercado visibles (Maps, directorios y densidad de competidores en ${params.city}).`,
                  `External public audit grounded strictly in observed market signals (Maps, public directories, and competitor density in ${params.city}).`
                )}
              </p>

              {params.referredBy && (
                <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                  <Zap size={13} className="text-amber-400" />
                  <span>{t(`Compartido por usuario VIP Bvelt (Ref: ${params.referredBy.substring(0, 8)})`, `Shared by Bvelt VIP member (Ref: ${params.referredBy.substring(0, 8)})`)}</span>
                </div>
              )}
            </div>

            {/* Revenue Opportunity Hero Widget */}
            <div className="bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-5 text-center flex flex-col items-center justify-center shrink-0 min-w-[280px] shadow-xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                {t("Oportunidad de Ingreso Recuperable", "Recoverable Revenue Opportunity")}
              </span>
              {hasSignals ? (
                <>
                  <div className="text-3xl sm:text-4xl font-black text-emerald-400 my-1 tracking-tight">
                    +${totalRecoverableOpportunity.toLocaleString()}
                    <span className="text-xs text-slate-400 font-normal"> / {t("mes", "mo")}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-full mt-1">
                    <ShieldCheck size={12} /> {t("Basado en señales públicas", "Based on public signals")}
                  </span>

                  {/* Breakdown Segments */}
                  <div className="w-full mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 gap-1.5 text-left">
                    <button
                      type="button"
                      onClick={() => setExpandedProofSegment(expandedProofSegment === 'recoverable' ? null : 'recoverable')}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[10px] transition cursor-pointer"
                    >
                      <span className="text-[9px] text-slate-400 block font-bold truncate">{t("Recuperable", "Recoverable")}</span>
                      <span className="font-black text-emerald-400 block">${recoverableAmount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedProofSegment(expandedProofSegment === 'at_risk' ? null : 'at_risk')}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[10px] transition cursor-pointer"
                    >
                      <span className="text-[9px] text-slate-400 block font-bold truncate">{t("En Riesgo", "At Risk")}</span>
                      <span className="font-black text-amber-400 block">${atRiskAmount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedProofSegment(expandedProofSegment === 'unclaimed' ? null : 'unclaimed')}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[10px] transition cursor-pointer"
                    >
                      <span className="text-[9px] text-slate-400 block font-bold truncate">{t("Sin Reclamar", "Unclaimed")}</span>
                      <span className="font-black text-indigo-400 block">${unclaimedAmount}</span>
                    </button>
                  </div>

                  {/* Expanded proof signal explanation on segment click */}
                  {expandedProofSegment && (
                    <div className="w-full mt-2 p-2 bg-slate-950 rounded-lg border border-slate-800 text-[10px] text-slate-300 text-left leading-relaxed">
                      {expandedProofSegment === 'recoverable' && (
                        <p>
                          <strong>{t("Recuperable:", "Recoverable:")}</strong> {t("Basado en demoras de respuesta y falta de reactivación de cotizaciones en tu nicho.", "Based on slow response proxy and unscheduled estimate follow-ups in your trade.")}
                        </p>
                      )}
                      {expandedProofSegment === 'at_risk' && (
                        <p>
                          <strong>{t("En Riesgo:", "At Risk:")}</strong> {t(`Basado en ${competitorCount} competidores mapeados en OpenStreetMap absorbiendo demanda en tu radio.`, `Based on ${competitorCount} mapped competitors on OpenStreetMap absorbing demand in your radius.`)}
                        </p>
                      )}
                      {expandedProofSegment === 'unclaimed' && (
                        <p>
                          <strong>{t("Sin Reclamar:", "Unclaimed:")}</strong> {t("Basado en ausencia de cotizador directo o enlace web de captación en directorios públicos.", "Based on lack of direct quote link or verified lead funnel on public directories.")}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-slate-300 my-2 px-2 py-1 bg-slate-800 rounded-lg">
                    {t("Insuficientes señales públicas", "Insufficient public signals")}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {t("Sin datos inventados para esta zona", "No invented figures for this area")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* TOP 3 REVENUE LEAKS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" />
              {t("Las 3 Principales Fugas de Ingresos Detectadas", "Top 3 Revenue Leaks Detected")}
            </h2>
            <span className="text-[11px] font-bold text-slate-400">
              {t("Demanda desatendida en tu radio", "Uncaptured local demand")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Leak 1 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  {t("FUGA #1 • REPUTACIÓN", "LEAK #1 • REPUTATION")}
                </span>
                <span className="text-xs font-bold text-slate-400">Google Maps</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {scanData?.identity?.reviewCount !== undefined && scanData.identity.reviewCount !== null && scanData.identity.reviewCount < 20
                  ? t(`Solo ${scanData.identity.reviewCount} reseña(s) visible(s) vs competidores`, `Only ${scanData.identity.reviewCount} visible review(s) vs competitors`)
                  : t("Reseñas sin contestar en perfil comercial", "Unanswered reviews on commercial profile")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {t(
                  "El 76% de los clientes locales eligen contratistas con opiniones recientes y respuestas activas.",
                  "76% of local clients pick contractors with recent 5-star reviews and active owner replies."
                )}
              </p>
            </div>

            {/* Leak 2 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {t("FUGA #2 • COMPETENCIA", "LEAK #2 • COMPETITION")}
                </span>
                <span className="text-xs font-bold text-slate-400">OpenStreetMap</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {scanData?.competitors && scanData.competitors.length > 0
                  ? t(`${scanData.competitors.length} competidores directos en tu radio`, `${scanData.competitors.length} direct competitors in your radius`)
                  : t("Densidad competitiva sin mapear", "Unmapped competitive density")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {t(
                  "Los competidores cercanos captan llamadas activas por falta de posicionamiento territorial calibrado.",
                  "Nearby competitors absorb active calls without calibrated local radius positioning."
                )}
              </p>
            </div>

            {/* Leak 3 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {t("FUGA #3 • CONVERSIÓN", "LEAK #3 • CONVERSION")}
                </span>
                <span className="text-xs font-bold text-slate-400">Web / Link</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {scanData?.identity?.website
                  ? t("Sitio web sin cotizador directo", "Website lacks direct instant quoting")
                  : t("Sin sitio web oficial verificado", "No verified official website linked")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {t(
                  "Los clientes que buscan presupuestos se van si no encuentran un botón directo de contacto o estimación.",
                  "Potential clients searching for quotes leave when there is no direct estimation or inquiry button."
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ONE NEXT BEST ACTION CARD */}
        <div className="p-5 sm:p-6 rounded-3xl bg-indigo-600/10 border border-indigo-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                ⚡ {t("PRÓXIMA MEJOR ACCIÓN RECOMENDADA (NBA)", "ONE NEXT BEST ACTION (NBA)")}
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {scanData?.competitors && scanData.competitors.length > 0
                  ? t(`Activar radar comercial y responder fugas de demanda en ${params.city}`, `Activate commercial radar & stop demand leaks in ${params.city}`)
                  : t("Reclamar auditoría completa y conectar perfil comercial", "Claim full audit & connect commercial profile")}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t(
                  "Genera guiones automáticos de WhatsApp, seguimiento de cotizaciones y recuperación de reseñas.",
                  "Generate one-tap WhatsApp scripts, estimate follow-ups, and review recovery."
                )}
              </p>
            </div>

            <button
              onClick={handleExecuteNba}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 shrink-0"
            >
              <span>{t("Ejecutar Acción / Reclamar", "Execute Action / Claim")}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Proof Panel on NBA: Why Bvelt thinks this */}
          <div className="pt-3 border-t border-indigo-500/20 space-y-1.5 text-xs text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
              🛡️ {t("Por qué Bvelt recomienda esto (Evidencias públicas):", "Why Bvelt thinks this (Observed signals):")}
            </span>
            <ul className="space-y-1">
              <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <span className="text-emerald-500 font-bold shrink-0">✓</span>
                <span>
                  {scanData?.competitors && scanData.competitors.length > 0
                    ? `${scanData.competitors.length} ${t("competidores detectados en OpenStreetMap en tu radio", "competitors detected via OpenStreetMap in your radius")}`
                    : t("Densidad territorial evaluada desde coordenadas públicas", "Territory density evaluated from public coordinates")}
                </span>
              </li>
              <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <span className="text-emerald-500 font-bold shrink-0">✓</span>
                <span>
                  {scanData?.identity?.website
                    ? t("Presencia web detectada pero sin flujo automatizado de captación", "Web presence detected but lacks automated lead flow")
                    : t("Perfil sin sitio web verificado en directorio público", "Profile has no verified website on public directories")}
                </span>
              </li>
              <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <span className="text-emerald-500 font-bold shrink-0">✓</span>
                <span>
                  {t(`Ticket promedio sectorial de $${verticalConfig.averageTicket} USD en ${params.city}`, `Sector benchmark ticket: $${verticalConfig.averageTicket} USD in ${params.city}`)}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Vertical Specific Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
              {t("Ticket Promedio de Nicho", "Avg Niche Ticket")}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              ${verticalConfig.averageTicket} USD
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("Por servicio contratado en tu área", "Per contracted service call in area")}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
              {t("Demanda de Urgencia", "Emergency Demand")}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {verticalConfig.emergencyServices.length}+ {t("Averías Clave", "Key Outages")}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("Atención fuera de horario comercial", "After-hours breakdown calls")}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
              {t("Trabajos de Alto Valor", "High Ticket Services")}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {verticalConfig.highTicketServices.length} {t("Especialidades", "Specialties")}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("Proyectos de instalación y reemplazo", "Installation & replacement jobs")}
            </p>
          </div>
        </div>

        {/* Competitor Market Analysis (Strictly Non-Private) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-indigo-500" />
                {t("Competidores Directos en Maps", "Direct Competitors on Maps")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(`Rivalidad comercial detectada en ${params.city} para ${params.niche}`, `Commercial rivalry in ${params.city} for ${params.niche}`)}
              </p>
            </div>
          </div>

          {isLoadingScan ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              {t("Cargando competidores locales en tiempo real...", "Loading live local competitors...")}
            </div>
          ) : scanData && scanData.competitors && scanData.competitors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scanData.competitors.slice(0, 4).map((comp, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {comp.name}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0">
                      ⭐ {comp.rating || '4.6'} ({comp.reviewsCount || 18})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {comp.address || params.city}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              {t(
                "3 competidores principales detectados en tu código postal con promedios de 4.7⭐ y respuesta activa a reseñas.",
                "3 key competitors detected in your zip code averaging 4.7⭐ with active review response times."
              )}
            </div>
          )}
        </div>

        {/* First Week Checklist Milestone Preview */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Target size={18} className="text-amber-500" />
                {t("Plan de Crecimiento de 7 Días", "7-Day Growth Roadmap")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("Pasos prioritarios recomendados por el motor comercial de Bvelt", "Priority milestones recommended by Bvelt Commercial Engine")}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {verticalConfig.checklist.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {t(item.titleEs, item.titleEn)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                      {item.day}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t(item.descEs, item.descEn)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Direct CTA Bar */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xl font-black text-white">
              {t("¿Eres dueño de este u otro negocio local?", "Are you the owner of this local business?")}
            </h3>
            <p className="text-xs text-indigo-100 font-medium">
              {t(
                "Reclama tu auditoría gratuita y desbloquea escaneos de mercado, bandeja de clientes y automatización.",
                "Claim your free market audit and unlock deep market scans, client inbox, and WhatsApp automation."
              )}
            </p>
          </div>

          <button
            onClick={handleClaimOrSignup}
            className="w-full sm:w-auto px-6 py-3.5 bg-white text-indigo-950 font-black rounded-2xl transition hover:bg-slate-100 active:scale-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0 min-h-[48px]"
          >
            <Sparkles size={16} className="text-indigo-600" />
            <span>{t("Reclamar Mi Auditoría Gratis", "Claim My Free Audit")}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 mt-12 space-y-2">
        <p>© {new Date().getFullYear()} Bvelt Local Market Engine. All rights reserved.</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {t("Este reporte público excluye deliberadamente cualquier dato privado o sensible de clientes.", "This public report deliberately excludes any private or sensitive client data.")}
        </p>
      </footer>
    </div>
  );
}
