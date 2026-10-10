import React, { useState, useMemo } from 'react';
import { 
  Zap, TrendingUp, MapPin, RotateCw, ExternalLink, Search, 
  Compass, Calculator, ArrowRight, Clock, Star, Sparkles, 
  Target, ShieldCheck, AlertCircle, Award, CheckCircle, ChevronDown, ChevronUp,
  Activity, Lightbulb, Users, Phone, Eye, DollarSign, Edit3, Mic, Share2
} from 'lucide-react';
import { executeShareSnapshot } from '../../utils/shareSnapshot';
import { AuditLeafletMap } from '../AuditLeafletMap';
import { TodaysBusinessDiagnosis } from './TodaysBusinessDiagnosis';
import { NextBestAction } from '../../knowledge/engine/actionEngine';
import { getEvidenceBadge, EvidenceStatus } from '../../lib/bveltEvidence';
import { TrustScore } from '../../lib/bveltTrustLayer';
import { getMarketData } from '../../utils/marketMetrics';
import { parseLocationString } from '../../utils/locationParser';
import { normalizeScanResult, NormalizedScanResult } from '../../services/scanResultNormalizer';
import { UnifiedActionService } from '../../lib/unifiedActionService';
import { navigateTo } from '../../lib/navigateTo';
import { isBusinessLead } from '../../lib/navigation/routeToAnswerLeads';

export interface GoldenPathSectionProps {
  t: (es: string, en: string) => string;
  profile: any;
  user?: any;
  trustScore?: TrustScore;
  mapCoords: { lat: number; lon: number } | null;
  radarRadius: number;
  setRadarRadius: React.Dispatch<React.SetStateAction<number>>;
  realCompetitors: any[];
  selectedBlipIndex: number | null;
  setSelectedBlipIndex: (idx: number | null) => void;
  isRadarScanning: boolean;
  handleRadarRescan: () => void;
  bveltRecommendedActions: NextBestAction[];
  growthActions?: any[];
  onExecuteAction?: (action: NextBestAction | any) => void;
  onToggleActionComplete?: (actionId: string) => void;
  handleActiveTab?: (tab: any) => void;
  handleToggleActionComplete?: (actionId: string) => void;
  completedActionIds?: string[];
  setActiveTab?: (tab: any) => void;
  primaryAction?: any;
  setGrowthActions?: any;
  handleOpenCalculationModal?: (details: any) => void;
  // Normalizer integration
  normalizedScan?: NormalizedScanResult;
  onRetryRadius?: (radius: number) => void;
  // Opportunity & Financial Model
  vistas_actuales?: number;
  progreso_bvelt?: number;
  conversion_rate?: number;
  avg_ticket_usd?: number;
  nicheDefined?: boolean;
  gmbConnected?: boolean;
  gmbLoading?: boolean;
  gmbMetrics?: any;
  gmbReviews?: any[];
  isVerifiedRank1?: boolean;
  leads?: any[];
  dateRange?: any;
  setDateRange?: any;
  displayReputationValue?: any;
  displayReputationSubtitle?: any;
  displayStreakValue?: any;
  displayStreakSubtitle?: any;
  displayLeadsValue?: any;
  displayImpactValue?: any;
  displayImpactSubtitle?: any;
  onStartVoice?: any;
  fetchGmbData?: any;
  handleAiReply?: any;
  handleConnectGmbClick?: any;
  marketForNiche?: any;
  onOpenCalculationModal?: (details: any) => void;
  onUpdateTicket?: (newTicket: number) => void;
  onUpdateProfile?: (updated: any) => void;
  todaysDiagnosis?: any;
  language?: string;
  gmbSearchUrl?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GoldenPathSection: React.FC<GoldenPathSectionProps> = ({
  t,
  profile,
  user,
  trustScore,
  mapCoords,
  radarRadius,
  setRadarRadius,
  realCompetitors = [],
  selectedBlipIndex,
  setSelectedBlipIndex,
  isRadarScanning,
  handleRadarRescan,
  bveltRecommendedActions = [],
  growthActions = [],
  onExecuteAction,
  onToggleActionComplete,
  handleActiveTab,
  handleToggleActionComplete,
  completedActionIds = [],
  setActiveTab,
  vistas_actuales = 0,
  conversion_rate = 0.05,
  avg_ticket_usd = 150,
  nicheDefined = true,
  gmbConnected = false,
  isVerifiedRank1 = false,
  leads = [],
  marketForNiche,
  onOpenCalculationModal,
  handleOpenCalculationModal,
  onUpdateTicket,
  onUpdateProfile,
  todaysDiagnosis,
  language = 'es',
  gmbSearchUrl = 'https://www.google.com/maps',
  onStartVoice,
  displayImpactValue,
  normalizedScan,
  onRetryRadius,
  showToast,
}) => {
  const [dateRange, setDateRange] = useState<'current_month' | 'last_3_months' | 'current_year'>('current_month');
  const [showDiagnosisDrawer, setShowDiagnosisDrawer] = useState(false);
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState<boolean>(true);
  const [showAllCompetitors, setShowAllCompetitors] = useState<boolean>(false);

  React.useEffect(() => {
    const handleExpandMap = () => {
      setIsAnalysisExpanded(true);
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => {
        const el = document.getElementById('section-market-intelligence') || document.getElementById('map-radar-container');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.dispatchEvent(new Event('resize'));
      }, 150);
    };
    window.addEventListener('bvelt_expand_map', handleExpandMap);
    return () => window.removeEventListener('bvelt_expand_map', handleExpandMap);
  }, []);

  const scoreBadge = getEvidenceBadge(trustScore?.status || (realCompetitors.length > 0 ? 'DERIVED' : 'INSUFFICIENT_DATA'), t);

  const effectiveScan: NormalizedScanResult = useMemo(() => {
    if (normalizedScan) return normalizedScan;
    return normalizeScanResult({
      competitors: realCompetitors,
      gbpSignals: { connected: gmbConnected, verified: isVerifiedRank1 },
      reviewsSignals: {
        totalReviews: 0,
        unansweredCount: 0
      },
      radiusKm: radarRadius,
      profile,
      language,
      userCoords: mapCoords,
      trade: profile?.category || profile?.niche,
      uid: user?.uid
    });
  }, [normalizedScan, realCompetitors, gmbConnected, isVerifiedRank1, radarRadius, profile, language, mapCoords, user?.uid]);

  const safeSetActiveTab = (tab: any) => {
    if (handleActiveTab) {
      handleActiveTab(tab);
    } else if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  const safeExecuteAction = (action: NextBestAction | any) => {
    if (!action) return;

    if (action.id === 'sparse_expand_radius') {
      if (onRetryRadius) {
        onRetryRadius(action.payload?.targetRadius || 10);
      } else {
        setRadarRadius(action.payload?.targetRadius || 10);
        if (handleRadarRescan) handleRadarRescan();
      }
      return;
    }

    if (action.targetTab) {
      safeSetActiveTab(action.targetTab);
      return;
    }

    // Handle special fallback actions gracefully
    if (action.id === 'nba_expand_radius' || action.destinationCode === 'EXPAND_RADIUS') {
      const nextRadius = radarRadius < 10 ? 10 : radarRadius < 20 ? 20 : 5;
      setRadarRadius(nextRadius);
      if (handleRadarRescan) {
        handleRadarRescan();
      }
      setIsAnalysisExpanded(true);
      return;
    }

    if (action.id === 'nba_rescan_market' || action.destinationCode === 'RESCAN_MARKET') {
      if (handleRadarRescan) {
        handleRadarRescan();
      }
      setIsAnalysisExpanded(true);
      return;
    }

    if (action.id === 'nba_complete_profile' || action.destinationCode === 'COMPLETE_PROFILE') {
      safeSetActiveTab('profile');
      return;
    }

    // Always prefer direct modal action resolution (WhatsApp / Call / Email / GMB)
    if (onExecuteAction) {
      if (action.id === 'nba_gmb_post') {
        onExecuteAction({
          ...action,
          destinationCode: 'REQUEST_REVIEW'
        });
        return;
      }
      if (action.id === 'nba_contact_lead') {
        onExecuteAction({
          ...action,
          destinationCode: 'CONTACT_LEAD',
          contextData: {
            leadName: leads?.[0]?.name || (language === 'en' ? 'Active Lead' : 'Cliente Potencial'),
            phone: leads?.[0]?.phone || leads?.[0]?.telefono || '',
            email: leads?.[0]?.email || ''
          }
        });
        return;
      }
      onExecuteAction(action);
      return;
    }

    // Legacy fallback only if onExecuteAction is absent
    if (action.id === 'nba_whatsapp_pitch') {
      const text = encodeURIComponent(action.whatsappText || "");
      window.open(`https://wa.me/?text=${text}`, '_blank');
      return;
    }

    if (action.id === 'nba_gmb_post') {
      safeSetActiveTab('reviews');
      return;
    }

    if (action.id === 'nba_contact_lead') {
      safeSetActiveTab('leads');
      return;
    }

    if (handleActiveTab) {
      handleActiveTab(action?.destination || action);
    } else if (setActiveTab) {
      setActiveTab(action?.destination?.tab || action?.destination || 'reputation');
    }
  };

  const safeToggleActionComplete = (actionId: string) => {
    if (onToggleActionComplete) {
      onToggleActionComplete(actionId);
    } else if (handleToggleActionComplete) {
      handleToggleActionComplete(actionId);
    }
  };

  const isUserCalibratedTicket = Boolean(
    (profile?.avgTicket && Number(profile.avgTicket) > 0) ||
    (profile?.avgTicketUsd && Number(profile.avgTicketUsd) > 0) ||
    (profile?.ticketPromedio && Number(profile.ticketPromedio) > 0)
  );

  // Compute exactly 3 High-Impact prioritized actions from scan normalizer (never empty shells!)
  const top3Actions = useMemo(() => {
    return effectiveScan.actions.map((act, index) => ({
      id: act.id,
      action: act.title,
      title: act.title,
      reason: act.description,
      expectedBenefit: act.description,
      ctaLabel: act.actionLabel,
      targetTab: act.targetTab,
      targetSubRow: act.targetSubRow,
      badge: act.badge,
      badgeColor: act.badgeColor,
      isOfflineCapable: act.isOfflineCapable,
      payload: act.payload,
      estimatedTime: index === 0 ? '2 min' : index === 1 ? '3 min' : '4 min'
    }));
  }, [effectiveScan]);

  const heroAction = top3Actions[0] || null;

  // Selected competitor details if user clicked a map pin
  const selectedCompetitor = useMemo(() => {
    if (selectedBlipIndex !== null && realCompetitors[selectedBlipIndex]) {
      return realCompetitors[selectedBlipIndex];
    }
    return null;
  }, [selectedBlipIndex, realCompetitors]);

  // Opportunity Calculation
  const multiplier = dateRange === 'current_month' ? 1 : dateRange === 'last_3_months' ? 3 : 12;

  const effectiveViews = (vistas_actuales > 0) ? vistas_actuales : (marketForNiche?.top3Views || 250);
  const effectiveConv = (conversion_rate > 0) ? conversion_rate : (marketForNiche?.conversionRate || 0.05);
  const effectiveTicket = (avg_ticket_usd > 0) ? avg_ticket_usd : (marketForNiche?.avgTicket || (profile?.category ? getMarketData(profile.category, profile.location || '').avgTicket : 150));

  const modeledOpportunity = useMemo(() => {
    if (realCompetitors.length === 0 && !gmbConnected && vistas_actuales === 0) {
      return 0;
    }
    return Math.round(effectiveViews * effectiveConv * effectiveTicket * multiplier);
  }, [effectiveViews, effectiveConv, effectiveTicket, multiplier, realCompetitors.length, gmbConnected, vistas_actuales]);

  const handleOpenOpportunityAudit = () => {
    if (!onOpenCalculationModal) return;
    const isRealViews = gmbConnected && vistas_actuales > 0;
    const isRealTicket = isUserCalibratedTicket;
    
    onOpenCalculationModal({
      title: t("Auditoría de Oportunidad Estimada Bvelt", "Bvelt Estimated Opportunity Audit"),
      metricName: t("Oportunidad de Búsqueda Local", "Local Search Opportunity"),
      resultValue: `+$${modeledOpportunity.toLocaleString()} / ${dateRange === 'current_month' ? t('mes', 'mo') : dateRange === 'last_3_months' ? t('3 meses', '3 mos') : t('año', 'yr')}`,
      evidenceStatus: isRealTicket && isRealViews ? 'DERIVED' : 'ESTIMATED',
      confidence: isRealViews && isRealTicket ? 'High' : isRealTicket || isRealViews ? 'Medium' : 'Low',
      formula: `Oportunidad = Vistas (${effectiveViews.toLocaleString()}) × Conversión (${(effectiveConv * 100).toFixed(1)}%) × Ticket ($${effectiveTicket}) × ${multiplier}`,
      variables: [
        { 
          name: t("Vistas Base", "Base Views"), 
          value: `${effectiveViews.toLocaleString()}`, 
          source: isRealViews ? "Google Business Profile API" : `OpenStreetMap + ${t("Densidad de búsqueda", "Search density")}`, 
          status: isRealViews ? 'VERIFIED' : 'ESTIMATED' 
        },
        { 
          name: t("Tasa de Conversión Estimada", "Estimated Conversion Rate"), 
          value: `${(effectiveConv * 100).toFixed(1)}%`, 
          source: t("Estándar del Sector (5.0% - 7.0%)", "Industry Sector Standard (5.0% - 7.0%)"), 
          status: 'BENCHMARK' 
        },
        { 
          name: t("Ticket Promedio por Trabajo", "Average Ticket per Job"), 
          value: `$${effectiveTicket}`, 
          source: isRealTicket 
            ? t("Configurado directamente por ti en perfil", "Directly configured by you in profile") 
            : `${t("Referencia de categoría", "Category benchmark")} (${profile?.category || 'Servicios'})`, 
          status: isRealTicket ? 'USER_PROVIDED' : 'BENCHMARK' 
        }
      ],
      assumptions: [
        t("La visibilidad de búsqueda local capta demanda activa en el radio geográfico seleccionado.", "Local search visibility captures active demand in the selected geographic radius."),
        t("La tasa de conversión modela la proporción de búsquedas que se transforman en consultas o llamadas.", "Standard conversion rate models the share of local searches that turn into inquiries/calls."),
        t("El ticket promedio refleja el valor económico de un cliente ganado según tu nicho o configuración propia.", "Average ticket reflects the economic value of an acquired customer based on your niche or custom setup.")
      ],
      sources: [
        { name: isRealViews ? "Google My Business API" : "OpenStreetMap Overpass API", type: isRealViews ? "Verified Record" : "Geographic Data" },
        { name: "Bvelt Core Financial Model", type: "Formula Engine" },
        { name: isRealTicket ? "User Business Profile" : "Niche Sector Catalog", type: isRealTicket ? "User Input" : "Benchmark Data" }
      ],
      explanation: t(
        "Este cálculo estima el valor económico que tu negocio puede captar mejorando su visibilidad y reputación en el radio local. Es un modelo proyectado para dimensionar la oportunidad, no una garantía de facturación contable.",
        "This calculation estimates the economic value your business can capture by improving its local visibility and reputation in the immediate radius. It is a projected model to size opportunity, not a guarantee of accounting revenue."
      )
    });
  };

  // Honest 1-2 sentence summary calculation
  const summarySentence = useMemo(() => {
    const locName = profile?.location || profile?.city || (language === 'es' ? 'tu zona' : 'your area');
    if (realCompetitors.length > 0) {
      return language === 'es'
        ? `Detectamos ${realCompetitors.length} ${realCompetitors.length === 1 ? 'competidor' : 'competidores'} en tu radio de ${radarRadius} km en ${locName}. Tienes una ventana directa para captar demanda desatendida y posicionarte como la opción preferida.`
        : `We detected ${realCompetitors.length} ${realCompetitors.length === 1 ? 'competitor' : 'competitors'} within ${radarRadius} km in ${locName}. Your business has a direct window to capture unserved demand and lead the local market.`;
    }
    return language === 'es'
      ? `Sin competidores directos detectados en el radio actual de ${radarRadius} km en ${locName}. Amplía el radio de búsqueda o completa tu perfil para calibrar el mapa comercial y activar el diagnóstico completo.`
      : `No direct competitors detected in the current ${radarRadius} km radius in ${locName}. Expand your search radius or complete your profile to calibrate the commercial map and unlock full diagnostics.`;
  }, [realCompetitors.length, radarRadius, profile?.location, profile?.city, language]);

  return (
    <div className="space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. RESUMEN 1-2 FRASES (HONESTO, CLARO Y DIRECTO)                         */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Activity size={18} />
            </span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                {t("Resumen de Auditoría Local", "Local Audit Summary")}
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {realCompetitors.length > 0 
                  ? t("Oportunidad Comercial Detectada", "Commercial Opportunity Detected") 
                  : t("Calibración Territorial en Curso", "Territory Calibration in Progress")}
              </h2>
            </div>
          </div>

          {/* Actions & Provenance */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                executeShareSnapshot({
                  businessName: profile?.name || profile?.businessName || '',
                  city: profile?.location || profile?.city || '',
                  category: profile?.category || profile?.niche || '',
                  score: Math.round(trustScore?.score || 76),
                  oppAmount: displayImpactValue ? parseInt(String(displayImpactValue).replace(/[^0-9]/g, ''), 10) : undefined,
                  refCode: user?.uid || profile?.referralCode || profile?.referred_by,
                  t
                }, showToast || ((msg) => console.log(msg)));
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
              title={t("Compartir Diagnóstico de Visibilidad (Sin PII de clientes)", "Share Visibility Snapshot (No customer PII)")}
            >
              <Share2 size={13} />
              <span>{t("Compartir Diagnóstico", "Share Snapshot")}</span>
            </button>

            {onStartVoice && (
              <button
                onClick={onStartVoice}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Mic size={14} className="animate-pulse text-rose-300" />
                <span>{t("Voz", "Voice")}</span>
              </button>
            )}

            {/* Provenance Pills & Scan State Badge */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
              {effectiveScan.scanState && (
                <span className={`px-2.5 py-1 rounded-full border uppercase tracking-wider font-black ${
                  effectiveScan.scanState === 'fresh'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : effectiveScan.scanState === 'cached'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : effectiveScan.scanState === 'degraded'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    : effectiveScan.scanState === 'action_required'
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                }`}>
                  {effectiveScan.scanState === 'fresh' && (language === 'es' ? '⚡ FRESCO' : '⚡ FRESH')}
                  {effectiveScan.scanState === 'cached' && (language === 'es' ? '💾 CACHÉ' : '💾 CACHED')}
                  {effectiveScan.scanState === 'empty' && (language === 'es' ? '⚪ SIN RESULTADOS' : '⚪ EMPTY')}
                  {effectiveScan.scanState === 'degraded' && `⚠️ DEGRADADO (${(effectiveScan.degradedReason || 'PROVIDER').toUpperCase()})`}
                  {effectiveScan.scanState === 'action_required' && (language === 'es' ? '🎯 ACCIÓN REQUERIDA' : '🎯 ACTION REQUIRED')}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                📍 {radarRadius} km {t("Radio", "Radius")}
              </span>
              <span className={`px-2.5 py-1 rounded-full border ${
                realCompetitors.length > 0 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                {realCompetitors.length} {realCompetitors.length === 1 ? t("Competidor", "Competitor") : t("Competidores", "Competitors")}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {scoreBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* State Banner with clear user message and cache age if present */}
        {effectiveScan.scanState && (
          <div className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-wrap items-center justify-between gap-2.5 ${
            effectiveScan.scanState === 'fresh'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : effectiveScan.scanState === 'cached'
              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
              : effectiveScan.scanState === 'degraded'
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
              : effectiveScan.scanState === 'action_required'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200'
              : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">
                {effectiveScan.scanState === 'fresh' ? '⚡' : effectiveScan.scanState === 'cached' ? '💾' : effectiveScan.scanState === 'degraded' ? '⚠️' : effectiveScan.scanState === 'action_required' ? '🎯' : 'ℹ️'}
              </span>
              <span className="leading-snug">{effectiveScan.userMessage}</span>
            </div>
            {effectiveScan.isCached && effectiveScan.cacheAgeText && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/30 border border-current shrink-0">
                {language === 'es' ? `actualizado hace ${effectiveScan.cacheAgeText}` : `updated ${effectiveScan.cacheAgeText} ago`}
              </span>
            )}
          </div>
        )}

        {/* The 3-line core diagnosis message & action guidance */}
        <div className="space-y-2 pt-1 text-left">
          <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed flex items-start gap-2">
            <span className="shrink-0 mt-0.5">📍</span>
            <span>{effectiveScan.summaryLines[0]}</span>
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{effectiveScan.summaryLines[1]}</span>
          </p>
          <p className="text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-400 leading-relaxed flex items-start gap-2">
            <span className="shrink-0 mt-0.5">🎯</span>
            <span>{effectiveScan.summaryLines[2]}</span>
          </p>

          {/* Auto-offer one-tap "Retry at 10 km" and "Retry at 25 km" if sparse */}
          {effectiveScan.status === 'sparse' && (
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t("Reintentar con radio más amplio:", "Retry with wider radius:")}
              </span>
              <button
                type="button"
                onClick={() => onRetryRadius ? onRetryRadius(10) : (setRadarRadius(10), handleRadarRescan())}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>{t("Reintentar a 10 km", "Retry at 10 km")}</span>
              </button>
              <button
                type="button"
                onClick={() => onRetryRadius ? onRetryRadius(25) : (setRadarRadius(25), handleRadarRescan())}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>{t("Reintentar a 25 km", "Retry at 25 km")}</span>
              </button>
            </div>
          )}

          {effectiveScan.lastCalibrated && (
            <div className="pt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span>🕒</span>
              <span>{effectiveScan.lastCalibrated}</span>
            </div>
          )}
        </div>

        {/* Minimal Progress / Quick Info Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-[10px]">
              {completedActionIds.length}/{top3Actions.length}
            </div>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {completedActionIds.length > 0 
                ? `${completedActionIds.length} ${t("acciones completadas hoy", "actions completed today")}` 
                : t("3 acciones prioritarias listas para ejecutar", "3 priority actions ready to execute")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
              ⚡ {profile?.streakDays || 1} {t("días racha", "day streak")}
            </span>
          </div>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* 3. "VER ANÁLISIS COMPLETO" COLAPSADO (MAPA + DIAGNÓSTICO + OPORTUNIDAD)   */}
      {/* ========================================================================= */}
      <div className="pt-2">
        <button
          onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
          className="w-full py-4 px-6 rounded-3xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 font-black text-xs sm:text-sm transition flex items-center justify-between gap-3 cursor-pointer shadow-xs group"
        >
          <div className="flex items-center gap-2.5">
            <Compass size={18} className="text-indigo-600 dark:text-indigo-400 group-hover:rotate-45 transition-transform" />
            <span className="text-left">
              {isAnalysisExpanded
                ? t("Ocultar análisis completo (Mapa, Diagnóstico y Oportunidad)", "Hide full analysis (Map, Diagnosis & Opportunity)")
                : t("Ver análisis completo (Mapa, Diagnóstico y Oportunidad)", "View full analysis (Map, Diagnosis & Opportunity)")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
            <span>{isAnalysisExpanded ? t("Colapsar", "Collapse") : t("Expandir", "Expand")}</span>
            {isAnalysisExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
      </div>

      {/* FULL ANALYSIS EXPANDABLE CONTAINER */}
      {isAnalysisExpanded && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* PRO MODE FULL GRID (MAP + OPPORTUNITY) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: INTERACTIVE MARKET RADAR MAP (7 COLUMNS) */}
            <div id="section-market-intelligence" className="lg:col-span-7 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
              {/* Map Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <MapPin size={18} />
                    </span>
                    <div>
                      <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span>{t("Radar del Mercado Local", "Local Market Radar")}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {realCompetitors.length} {t("Nodos", "Nodes")}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {profile?.location ? `${profile.location} • ${radarRadius}km` : t("Cobertura local en OpenStreetMap", "Local coverage in OpenStreetMap")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Radius Selector */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[11px] font-bold">
                    {[2, 5, 10, 20].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRadarRadius(r)}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          radarRadius === r
                            ? 'bg-indigo-600 text-white font-black shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {r}km
                      </button>
                    ))}
                  </div>

                  {/* Rescan Button */}
                  <button
                    onClick={handleRadarRescan}
                    disabled={isRadarScanning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw size={13} className={isRadarScanning ? "animate-spin text-indigo-500" : ""} />
                    <span>{isRadarScanning ? t("Escaneando...", "Scanning...") : t("Escanear", "Rescan")}</span>
                  </button>

                  {/* Deep Link to Business Scan */}
                  <button
                    onClick={() => safeSetActiveTab('business_scan')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs shadow-indigo-600/20"
                  >
                    <Search size={12} />
                    <span>{t("Escanear Competidores", "Scan Competitors")}</span>
                  </button>
                </div>
              </div>

              {/* REAL LEAFLET MAP CONTAINER */}
              <div className="relative w-full h-[340px] sm:h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
                <AuditLeafletMap
                  center={mapCoords ? { lat: mapCoords.lat, lng: mapCoords.lon } : { lat: 25.7617, lng: -80.1918 }}
                  radiusKm={radarRadius}
                  userBusinessName={profile?.businessName || profile?.companyName || 'Tu Negocio'}
                  competitors={realCompetitors}
                  selectedCompetitorIndex={selectedBlipIndex}
                  onSelectCompetitor={setSelectedBlipIndex}
                  isScanning={isRadarScanning}
                  language={(profile?.language as any) || 'es'}
                  onRetryRadius={(r) => {
                    setRadarRadius(r);
                    if (onRetryRadius) {
                      onRetryRadius(r);
                    } else {
                      handleRadarRescan();
                    }
                  }}
                />
              </div>

              {/* Selected Competitor Dynamic Insight Box */}
              {selectedCompetitor && (
                <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                        📍 {t("Competidor Seleccionado", "Selected Competitor")}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {selectedCompetitor.distanceKm ? `${selectedCompetitor.distanceKm.toFixed(1)} km` : t("En radio", "In radius")}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {selectedCompetitor.name}
                    </h4>
                    <p className="text-xs text-indigo-900 dark:text-indigo-300 font-medium">
                      {language === 'es' ? selectedCompetitor.blindspotEs : selectedCompetitor.blindspotEn}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedCompetitor) {
                        const parsedLoc = parseLocationString(
                          selectedCompetitor.address || profile?.location || profile?.city || '',
                          profile?.state || null,
                          profile?.country || null
                        );
                        const compContext = {
                          name: selectedCompetitor.name,
                          city: parsedLoc.city || profile?.city || '',
                          state: parsedLoc.state || profile?.state || '',
                          country: parsedLoc.country || profile?.country || 'US',
                          category: selectedCompetitor.category || '',
                          sourceType: 'OSM_RADAR',
                          sourceLabel: 'Radar de Competencia / Mapa',
                          timestamp: Date.now(),
                        };
                        localStorage.setItem('bvelt_pending_competitor_audit', JSON.stringify(compContext));
                      }
                      safeSetActiveTab('business_scan');
                    }}
                    className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1"
                  >
                    <span>{t("Auditar Brecha", "Audit Gap")}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Top 3 Competitors Default + Collapsed Advanced List */}
              {effectiveScan.status === 'ok' && effectiveScan.topCompetitors.length > 0 && (
                <div className="space-y-2 pt-1 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800 dark:text-slate-200">
                      {t("Top 3 Competidores en Radar", "Top 3 Competitors on Radar")}
                    </span>
                    {effectiveScan.remainingCompetitors.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllCompetitors(prev => !prev)}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>{showAllCompetitors 
                          ? t("Colapsar lista", "Collapse list") 
                          : t(`Ver ${effectiveScan.remainingCompetitors.length} adicionales`, `View ${effectiveScan.remainingCompetitors.length} more`)}</span>
                        {showAllCompetitors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {effectiveScan.topCompetitors.map((comp: any, idx: number) => (
                      <div
                        key={comp.id || idx}
                        onClick={() => setSelectedBlipIndex(idx)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                          selectedBlipIndex === idx
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                            : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black">
                            #{idx + 1}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {comp.distanceKm ? `${comp.distanceKm.toFixed(1)} km` : ''}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate mt-1">
                          {comp.name}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Collapsed Advanced Competitors List */}
                  {showAllCompetitors && effectiveScan.remainingCompetitors.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
                      {effectiveScan.remainingCompetitors.map((comp: any, idx: number) => {
                        const actualIndex = idx + 3;
                        return (
                          <div
                            key={comp.id || actualIndex}
                            onClick={() => setSelectedBlipIndex(actualIndex)}
                            className={`p-2 rounded-xl border text-left cursor-pointer transition ${
                              selectedBlipIndex === actualIndex
                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                                : 'border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400 font-bold">#{actualIndex + 1}</span>
                              <span className="text-slate-500">{comp.distanceKm ? `${comp.distanceKm.toFixed(1)} km` : ''}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{comp.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* If Sparse: One-Tap Retry Card below map */}
              {effectiveScan.status === 'sparse' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                      {t("Zona de baja densidad de competidores", "Low competitor density zone")}
                    </p>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                      {t(`Sin competidores detectados en ${radarRadius} km. Prueba ampliar tu radio de escaneo.`, `No competitors detected in ${radarRadius} km. Try expanding your scan radius.`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRetryRadius ? onRetryRadius(10) : (setRadarRadius(10), handleRadarRescan())}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                    >
                      {t("10 km", "10 km")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRetryRadius ? onRetryRadius(25) : (setRadarRadius(25), handleRadarRescan())}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      {t("25 km", "25 km")}
                    </button>
                  </div>
                </div>
              )}

              {/* Map Provenance Footer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-slate-400">{t("Origen Coordenadas", "Location Source")}</p>
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {profile?.locationSource === 'DEVICE' ? t('GPS Dispositivo', 'Device GPS') :
                     profile?.locationSource === 'BROWSER_NETWORK' ? t('Red / IP', 'Network / IP') :
                     profile?.locationSource === 'USER_ENTERED' ? t('Manual', 'Manual') :
                     t('Automático', 'Automatic')}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-slate-400">{t("Radio Activo", "Active Radius")}</p>
                  <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{radarRadius} km</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-slate-400">{t("Nodos Mapeados", "Mapped Nodes")}</p>
                  <p className="text-xs font-black text-slate-900 dark:text-white">{realCompetitors.length} {t("negocios", "businesses")}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-slate-400">{t("Cartografía", "Cartography")}</p>
                  <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">OSM / CartoDB</p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ESTIMATED OPPORTUNITY (5 COLUMNS) */}
            <div className="lg:col-span-5 flex flex-col gap-6">

              {/* CARD A: MODELED REVENUE OPPORTUNITY */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <TrendingUp size={18} />
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                        {t("Oportunidad de Ingresos Estimada", "Estimated Revenue Opportunity")}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isUserCalibratedTicket ? (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {t("TICKET PROPIO • MODELO PERSONALIZADO", "OWN TICKET • PERSONALIZED MODEL")}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            {t("ESTIMADO • BENCHMARK ", "ESTIMATED • BENCHMARK ")}{(profile?.category || "LOCAL").toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date Filter */}
                  <div className="bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg flex items-center text-[10px] font-bold">
                    <button
                      onClick={() => setDateRange('current_month')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        dateRange === 'current_month' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black' : 'text-slate-500'
                      }`}
                    >
                      {t("Mes", "Mo")}
                    </button>
                    <button
                      onClick={() => setDateRange('last_3_months')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        dateRange === 'last_3_months' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black' : 'text-slate-500'
                      }`}
                    >
                      {t("3M", "3M")}
                    </button>
                    <button
                      onClick={() => setDateRange('current_year')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        dateRange === 'current_year' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black' : 'text-slate-500'
                      }`}
                    >
                      {t("Año", "Yr")}
                    </button>
                  </div>
                </div>

                {/* Bvelt Opportunity Score Header */}
                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {t("Score de Oportunidad Bvelt", "Bvelt Opportunity Score")}
                    </span>
                    {trustScore && trustScore.score !== null && trustScore.isCalculable && realCompetitors.length > 0 ? (
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                          {trustScore.score}<span className="text-xs font-bold text-slate-400">/100</span>
                        </span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {trustScore.status}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {t("DATOS INSUFICIENTES (0 POIs)", "INSUFFICIENT DATA (0 POIs)")}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium max-w-[210px] text-right line-clamp-2 leading-tight">
                    {realCompetitors.length === 0 
                      ? t("Sin fichas abiertas en mapas; usa mensaje o web.", "No open map profiles found; use message or website.")
                      : (trustScore?.explanation || t("Se requieren señales verificables para un cálculo responsable.", "Verifiable signals required for responsible calculation."))}
                  </p>
                </div>

                {/* Money Display */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                        +${modeledOpportunity.toLocaleString()}
                      </p>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        {t("Estimación referencial", "Estimate only")}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic leading-tight">
                      {realCompetitors.length === 0
                        ? t(
                            "*Sin fichas en mapas; enfócate en mensajes directos y web para capturar demanda.",
                            "*No map profiles found; focus on direct messages and website to capture demand."
                          )
                        : t(
                            "*Estimación direccional basada en ticket promedio y volumen local. No constituye garantía de ingresos contables.",
                            "*Directional estimate based on average ticket size and local search volume. Does not constitute guaranteed accounting revenue."
                          )}
                    </p>
                  </div>

                  {onOpenCalculationModal && (
                    <button
                      onClick={handleOpenOpportunityAudit}
                      title={t("Ver desglose metodológico y variables", "View methodological breakdown and variables")}
                      className="px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black hover:bg-emerald-50 dark:hover:bg-emerald-950 transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs self-start sm:self-auto"
                    >
                      <Calculator size={13} />
                      <span>{t("Ver cálculo", "View calculation")}</span>
                    </button>
                  )}
                </div>

                {/* Formula micro breakdown with provenance indicators & inline calibration */}
                <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">{t("Vistas Base", "Base Views")}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(vistas_actuales || 250).toLocaleString()}</span>
                    </div>
                    <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-1 block">
                      {gmbConnected && vistas_actuales > 0 ? t("✓ Google Real", "✓ Google Actual") : t("≈ Modelo Local", "≈ Local Model")}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">{t("Conversión", "Conv. Rate")}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(conversion_rate * 100).toFixed(1)}%</span>
                    </div>
                    <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-1 block">
                      {t("📊 Estándar 5%", "📊 5% Standard")}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="block text-[9px] font-black uppercase text-slate-400">{t("Ticket Prom.", "Avg Ticket")}</span>
                        {onOpenCalculationModal && (
                          <button
                            onClick={handleOpenOpportunityAudit}
                            title={t("Calibrar ticket promedio de tu negocio", "Calibrate average ticket for your business")}
                            className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <Edit3 size={10} />
                            <span>{t("Ajustar", "Edit")}</span>
                          </button>
                        )}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">${avg_ticket_usd}</span>
                    </div>
                    <span className="text-[9px] font-medium mt-1 block">
                      {isUserCalibratedTicket ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t("👤 Tuyo", "👤 Custom")}</span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">{t("📊 Sector", "📊 Sector")}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION STREAM SUMMARY CARD */}
              <div className="bg-gradient-to-br from-indigo-500/5 via-transparent to-indigo-600/5 border border-indigo-500/20 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Zap size={18} />
                    </span>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block">
                        {t("CENTRO DE ACCIONES", "ACTION CENTER")}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {t("Flujo de Tareas Comerciales", "Commercial Task Flow")}
                      </h4>
                    </div>
                  </div>
                  <button
                    onClick={() => safeSetActiveTab('action_center')}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>{t("Ver Todas", "View All")}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white/60 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">{t("Pendientes", "Pending")}</span>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                      {bveltRecommendedActions.length}
                    </span>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">{t("Completadas", "Completed")}</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                      {completedActionIds.length}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* BUSINESS DIAGNOSIS DEEP DIVE (EXPANDABLE DRAWER) */}
          {todaysDiagnosis && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Activity size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                      {t("Diagnóstico Operativo y Evidencia", "Operational Diagnosis & Evidence")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {t("Transparencia total de datos, fuentes verificadas y fórmula matemática.", "Complete data transparency, verified sources, and mathematical formula.")}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowDiagnosisDrawer(!showDiagnosisDrawer)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
                >
                  <span>{showDiagnosisDrawer ? t("Ocultar", "Hide") : t("Ver Detalle", "View Details")}</span>
                  {showDiagnosisDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showDiagnosisDrawer && (
                <TodaysBusinessDiagnosis
                  diagnosis={todaysDiagnosis}
                  onOpenCalculationModal={onOpenCalculationModal || handleOpenCalculationModal || (() => {})}
                  setActiveTab={safeSetActiveTab}
                  t={t}
                />
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
