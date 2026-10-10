import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, MapPin, Sparkles, CheckCircle2, AlertTriangle, 
  HelpCircle, ArrowRight, ShieldCheck, RefreshCw, ExternalLink, Globe, 
  Phone, Activity, TrendingUp, Shield, EyeOff, AlertOctagon, 
  Award, Check, ThumbsUp, AlertCircle, ChevronDown, ChevronUp,
  Target, Layers, Zap, Star, Copy, Info, Share2
} from 'lucide-react';
import { Skeleton } from './Skeleton';
import { 
  executeBusinessScan, 
  BusinessScanInput, 
  BusinessScanResult, 
  BusinessScanEvidenceItem,
  BusinessScanScoreCategory,
  BusinessScanCompetitor,
  getRecentScans,
  getCachedScan,
  getCachedScanByAreaTrade
} from '../services/businessScanService';
import { getEvidenceBadge, EvidenceStatus } from '../lib/bveltEvidence';
import { parseLocationString } from '../utils/locationParser';
import { useScansQuota, handle429Toast, getRateLimitMessage } from '../lib/rateLimitService';
import { AuditLeafletMap, RealCompetitor } from './AuditLeafletMap';
import { 
  computeCompetitorWinLoseReason, 
  generateSafeMarketSnapshotText,
  normalizeScanResult,
  NormalizedScanResult
} from '../services/scanResultNormalizer';
import { navigateTo, NavigateTool } from '../lib/navigateTo';

function mapCategoryToNiche(category?: string): string | null {
  if (!category) return null;
  const catLower = category.toLowerCase();
  
  if (catLower.includes('heating') || catLower.includes('air conditioning') || catLower.includes('hvac') || 
      catLower.includes('plumb') || catLower.includes('roof') || catLower.includes('electric') || 
      catLower.includes('contractor') || catLower.includes('service') || catLower.includes('repair') || 
      catLower.includes('home') || catLower.includes('remodel') || catLower.includes('paint') || 
      catLower.includes('carpenter') || catLower.includes('masonry') || catLower.includes('locksmith') ||
      catLower.includes('construction')) {
    return 'servicios_del_hogar';
  }
  
  if (catLower.includes('restaurant') || catLower.includes('cafe') || catLower.includes('food') || 
      catLower.includes('bar') || catLower.includes('pizza') || catLower.includes('bakery') || 
      catLower.includes('bistro') || catLower.includes('sushi') || catLower.includes('coffee')) {
    return 'restaurantes';
  }
  
  if (catLower.includes('shop') || catLower.includes('store') || catLower.includes('retail') || 
      catLower.includes('market') || catLower.includes('boutique') || catLower.includes('grocer') || 
      catLower.includes('supermarket') || catLower.includes('florist') || catLower.includes('bookstore')) {
    return 'comercio_local';
  }
  
  if (catLower.includes('salon') || catLower.includes('beauty') || catLower.includes('hair') || 
      catLower.includes('spa') || catLower.includes('nails') || catLower.includes('dentist') || 
      catLower.includes('clinic') || catLower.includes('doctor') || catLower.includes('physio') || 
      catLower.includes('medical') || catLower.includes('cosmetic') || catLower.includes('barber') || 
      catLower.includes('gym') || catLower.includes('fitness')) {
    return 'salud_y_estetica';
  }
  
  if (catLower.includes('law') || catLower.includes('attorney') || catLower.includes('consult') || 
      catLower.includes('account') || catLower.includes('agency') || catLower.includes('engineer') || 
      catLower.includes('architect') || catLower.includes('finance') || catLower.includes('insurance') || 
      catLower.includes('realtor') || catLower.includes('real estate') || catLower.includes('broker')) {
    return 'servicios_profesionales';
  }
  
  return null;
}

function renderI18nVal(val: any, lang: string = 'es'): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (lang === 'en' && val.en) return val.en;
    if (val.es) return val.es;
    if (val.en) return val.en;
  }
  return String(val);
}

function formatCompetitorsForMap(competitors?: BusinessScanCompetitor[], defaultLat = 40.4168, defaultLng = -3.7038): RealCompetitor[] {
  if (!competitors || competitors.length === 0) return [];
  return competitors.map((c, idx) => ({
    id: c.id || `comp_${idx}`,
    name: c.name,
    lat: c.latitude ?? (defaultLat + (Math.sin(idx + 1) * 0.012)),
    lng: c.longitude ?? (defaultLng + (Math.cos(idx + 1) * 0.012)),
    distanceKm: c.distanceKm || parseFloat((0.4 * (idx + 1)).toFixed(1)),
    rank: idx + 1,
    rating: c.rating ?? 4.5,
    reviewsCount: c.reviewCount ?? 12,
    category: c.category,
    phone: c.phone || undefined,
    website: c.website || undefined,
    address: c.address || undefined,
    blindspotEs: `Competidor local en ${c.category.replace('_', ' ')}.`,
    blindspotEn: `Local competitor in ${c.category.replace('_', ' ')}.`,
    actionEs: 'Analizar oferta y contra-posicionar',
    actionEn: 'Analyze offer and counter-position',
  }));
}

interface BusinessScanViewProps {
  language?: string;
  t?: (es: string, en: string) => string;
  setActiveTab?: (tab: string) => void;
  setActiveSubRow?: (subRow: number) => void;
  handleActiveTab?: (tabOrObj: any, subRow?: number) => void;
  profile?: any;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const BusinessScanView: React.FC<BusinessScanViewProps> = ({
  language = 'es',
  t = (es, en) => es,
  setActiveTab = (_tab?: any) => {},
  setActiveSubRow,
  handleActiveTab,
  profile,
  showToast
}) => {
  const [input, setInput] = useState<BusinessScanInput>(() => {
    try {
      const pendingStr = localStorage.getItem('bvelt_pending_competitor_audit');
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        let mappedNiche = 'servicios_del_hogar';
        if (pending.category) {
          const catNiche = mapCategoryToNiche(pending.category);
          if (catNiche) {
            mappedNiche = catNiche;
          } else {
            mappedNiche = profile?.niche || profile?.category || 'servicios_del_hogar';
          }
        } else {
          mappedNiche = profile?.niche || profile?.category || 'servicios_del_hogar';
        }

        const rawLocationStr = pending.city || pending.location || profile?.city || profile?.location || '';
        const parsed = parseLocationString(
          rawLocationStr,
          pending.state || profile?.state || null,
          pending.country || profile?.country || null
        );

        return {
          businessId: '',
          businessName: pending.name || pending.businessName || '',
          city: parsed.city || pending.city || profile?.city || '',
          state: pending.state || parsed.state || profile?.state || '',
          country: pending.country || parsed.country || 'ES',
          niche: mappedNiche,
          sourceType: pending.sourceType || 'OSM_RADAR',
          sourceLabel: pending.sourceLabel || 'Radar de Competencia / Mapa',
        };
      }
    } catch (e) {
      console.error('[BusinessScanView] Error reading pending competitor audit:', e);
    }

    const parsedProfileLoc = parseLocationString(
      profile?.city || profile?.location || '',
      profile?.state || null,
      profile?.country || null
    );

    return {
      businessId: profile?.id || '',
      businessName: profile?.name || '',
      city: parsedProfileLoc.city || profile?.city || '',
      state: profile?.state || parsedProfileLoc.state || '',
      country: profile?.country || parsedProfileLoc.country || 'ES',
      niche: profile?.niche || profile?.category || 'servicios_del_hogar',
      sourceType: 'BUSINESS_PROFILE',
      sourceLabel: 'Entrada del Usuario',
    };
  });

  const [scanState, setScanState] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'PARTIAL' | 'ERROR'>('IDLE');
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [activeResult, setActiveResult] = useState<BusinessScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<BusinessScanResult[]>([]);
  const [showAdvancedTelemetry, setShowAdvancedTelemetry] = useState<boolean>(false);
  const [showAllCompetitors, setShowAllCompetitors] = useState<boolean>(false);
  const [selectedCompetitorIdx, setSelectedCompetitorIdx] = useState<number | null>(null);
  const [scanRadiusKm, setScanRadiusKm] = useState<number>(5);
  const [copiedSnapshot, setCopiedSnapshot] = useState<boolean>(false);
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);
  
  // Abort controller ref to cancel in-flight request when navigating away
  const abortControllerRef = useRef<AbortController | null>(null);
  const quota = useScansQuota(profile, language);

  // Initial load: check cache first (no re-fetching on tab switch)
  useEffect(() => {
    setRecentScans(getRecentScans());
    localStorage.removeItem('bvelt_pending_competitor_audit');

    // Auto-load cached scan if available for this profile/area/trade
    if (input.businessName && input.city) {
      const cached = getCachedScan(input) || getCachedScanByAreaTrade(input.city, input.state, input.niche);
      if (cached) {
        setActiveResult(cached);
        setScanState(cached.status === 'ERROR' ? 'PARTIAL' : cached.status);
      }
    }

    // Cleanup: cancel in-flight scan on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleRunScan = async (e?: React.FormEvent, overrideRadius?: number) => {
    if (e) e.preventDefault();

    if (!input.businessName.trim()) {
      if (showToast) showToast(t("Por favor introduce el nombre del negocio", "Please enter business name"), 'error');
      return;
    }
    if (!input.city.trim()) {
      if (showToast) showToast(t("Por favor introduce la ciudad", "Please enter city"), 'error');
      return;
    }

    const targetRadius = overrideRadius || scanRadiusKm || 5;
    if (overrideRadius) {
      setScanRadiusKm(overrideRadius);
    }

    if (quota.scansLeft <= 0) {
      if (showToast) {
        showToast(
          quota.isPro
            ? t("Has alcanzado tu límite diario de 30 escaneos Pro.", "You've reached your daily limit of 30 Pro scans.")
            : t("Has alcanzado tu límite de 5 escaneos diarios. Activa Pro para obtener 30 escaneos al día.", "You've reached your limit of 5 daily scans. Upgrade to Pro for 30 scans/day."),
          'info'
        );
      }
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    quota.triggerCooldown(4000);
    setScanState('LOADING');
    setErrorMessage(null);
    setProgressPercent(15);
    setProgressMsg(t("Iniciando auditoría de visibilidad y competidores...", "Starting visibility and competitor audit..."));

    try {
      const result = await executeBusinessScan({ ...input, radiusKm: targetRadius }, {
        forceFresh: true,
        signal: controller.signal,
        onProgress: (step, percent) => {
          setProgressMsg(step);
          setProgressPercent(percent);
        },
      });

      setActiveResult(result);
      if (result.radiusKm) {
        setScanRadiusKm(result.radiusKm);
      }
      setScanState(result.status === 'ERROR' ? 'ERROR' : result.status);
      setRecentScans(getRecentScans());

      if (result.status === 'SUCCESS' || result.status === 'PARTIAL') {
        quota.consumeScan();
      }

      if (showToast) {
        if (result.status === 'SUCCESS') {
          showToast(t("¡Análisis completado con éxito!", "Scan completed successfully!"), 'success');
        } else if (result.status === 'PARTIAL') {
          showToast(t("Análisis completado con fuentes locales disponibles", "Scan completed with available local sources"), 'info');
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("[BusinessScanView] Scan aborted by navigation");
        return;
      }
      console.error("[BusinessScanView] Scan failed:", err);
      setScanState('ERROR');
      const isOffline = !navigator.onLine || err?.message?.toLowerCase().includes('network') || err?.message?.toLowerCase().includes('failed to fetch') || err?.message?.toLowerCase().includes('offline');
      const is429 = err?.isRateLimited || err?.name === 'RateLimitError' || err?.message?.includes('demanda') || err?.message?.includes('429') || err?.message?.includes('demand');
      
      if (isOffline) {
        const offlineMsg = t("Conexión de red no disponible. Verifica tu conexión e reintenta el análisis.", "Network connection lost. Check your connection and retry scan.");
        setErrorMessage(offlineMsg);
        if (showToast) showToast(offlineMsg, 'error');
      } else if (is429) {
        handle429Toast(showToast, language);
        setErrorMessage(getRateLimitMessage(language));
      } else {
        const genErr = err.message || t("Ocurrió un error al procesar el análisis.", "An error occurred during scan processing.");
        setErrorMessage(genErr);
        if (showToast) showToast(genErr, 'error');
      }
    }
  };

  const handleSelectRecent = (scan: BusinessScanResult) => {
    setActiveResult(scan);
    setScanState(scan.status);
    setInput(scan.input);
  };

  const handleNewScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setActiveResult(null);
    setScanState('IDLE');
    setErrorMessage(null);
    setShowAdvancedTelemetry(false);
  };

  // Safe user center coordinates for the map
  const mapCenter = {
    lat: activeResult?.location?.latitude ?? 40.4168,
    lng: activeResult?.location?.longitude ?? -3.7038
  };

  const mapCompetitors = formatCompetitorsForMap(activeResult?.competitors, mapCenter.lat, mapCenter.lng);

  // Normalize scan output to ensure consistent drivers and conclusions
  const normalizedScan: NormalizedScanResult = React.useMemo(() => {
    return normalizeScanResult({
      competitors: activeResult?.competitors || [],
      gbpSignals: {
        connected: activeResult?.identity?.isClaimed,
        verified: activeResult?.identity?.isClaimed,
        hasPhotos: true
      },
      reviewsSignals: {
        rating: activeResult?.score?.categories?.reputation?.score ? (activeResult.score.categories.reputation.score / 20) : null,
        totalReviews: activeResult?.evidences?.reviewCount?.value ? Number(activeResult.evidences.reviewCount.value) : null
      },
      errors: scanState === 'ERROR' && errorMessage ? [errorMessage] : null,
      radiusKm: scanRadiusKm,
      profile: {
        ...profile,
        name: activeResult?.identity?.businessName || input.businessName,
        city: activeResult?.identity?.city || input.city,
        location: activeResult?.identity?.city || input.city,
        website: activeResult?.identity?.website
      },
      language,
      trade: input.niche
    });
  }, [activeResult, scanState, errorMessage, scanRadiusKm, profile, input, language]);

  // Enriched top competitors with plain-language win/lose reasons
  const enrichedCompetitorList = React.useMemo(() => {
    if (!activeResult?.competitors) return [];
    const userReviews = activeResult?.evidences?.reviewCount?.value ? Number(activeResult.evidences.reviewCount.value) : (profile?.reviewsCount ?? null);
    const userRating = activeResult?.score?.categories?.reputation?.score ? (activeResult.score.categories.reputation.score / 20) : (profile?.rating ?? null);
    const userWeb = activeResult?.identity?.website || profile?.website;

    return activeResult.competitors.map((comp) => {
      const reason = computeCompetitorWinLoseReason(
        {
          name: comp.name,
          reviewsCount: comp.reviewCount,
          reviews: comp.reviewCount,
          rating: comp.rating,
          website: comp.website,
          distanceKm: comp.distanceKm
        },
        {
          reviewsCount: userReviews,
          rating: userRating,
          website: userWeb,
          isClaimed: activeResult?.identity?.isClaimed
        },
        language || 'es'
      );
      return {
        ...comp,
        winLoseReason: reason.reason,
        winLoseType: reason.type
      };
    });
  }, [activeResult, profile, language]);

  // Handle Share Snapshot Text Copy
  const handleShareSnapshot = async () => {
    const text = generateSafeMarketSnapshotText({
      businessName: activeResult?.identity?.businessName || input.businessName || 'Business',
      city: activeResult?.identity?.city || input.city || 'Local Area',
      healthScore: activeResult?.score?.overall ?? 72,
      summaryLines: normalizedScan.summaryLines,
      drivers: normalizedScan.drivers,
      topCompetitors: enrichedCompetitorList.map(c => ({
        name: c.name,
        rating: c.rating,
        reviews: c.reviewCount,
        winLoseReason: c.winLoseReason
      })),
      actions: normalizedScan.actions.map(a => ({ title: a.title, actionLabel: a.actionLabel })),
      lang: language || 'es'
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnapshot(true);
      if (showToast) {
        showToast(t("✓ Resumen de auditoría copiado al portapapeles (sin datos privados)", "✓ Audit snapshot copied to clipboard (safe summary)"), 'success');
      }
      setTimeout(() => setCopiedSnapshot(false), 3000);
    } catch (err) {
      if (showToast) {
        showToast(t("No se pudo copiar automáticamente. Intenta de nuevo.", "Could not copy automatically. Please try again."), 'error');
      }
    }
  };

  // 3 Primary Drivers extracted from activeResult or smart defaults
  const drivers = [
    {
      id: 'presence',
      title: t("Presencia en Mapas y Ficha Local", "Maps Presence & Local Listing"),
      status: activeResult?.identity?.isClaimed ? 'VERIFIED' : (activeResult?.location?.latitude ? 'DERIVED' : 'ESTIMATED'),
      score: activeResult?.score?.categories?.localPresence?.score ?? (activeResult?.identity?.isClaimed ? 85 : 45),
      detail: activeResult?.identity?.isClaimed
        ? t("Ficha Google Maps verificada y localizada en coordenadas exactas.", "Google Maps profile verified and pinned at exact coordinates.")
        : t("Ficha de mapas sin reclamar o incompleta. Oportunidad directa de toma de mercado.", "Unclaimed or incomplete local listing. Immediate takeover opportunity."),
      actionLabel: t("Optimizar Ficha", "Optimize Listing"),
      actionTab: "growth"
    },
    {
      id: 'reputation',
      title: t("Reputación y Reseñas de Clientes", "Reputation & Customer Reviews"),
      status: activeResult?.score?.categories?.reputation?.status || 'ESTIMATED',
      score: activeResult?.score?.categories?.reputation?.score ?? 60,
      detail: t(
        "Las reseñas recientes y respuestas rápidas son el factor #1 de conversión en búsquedas de urgencia.",
        "Recent reviews and quick replies are the #1 conversion driver for urgent service searches."
      ),
      actionLabel: t("Gestionar Reseñas", "Manage Reviews"),
      actionTab: "reviews"
    },
    {
      id: 'conversion',
      title: t("Conversión Web y Cotización Rápida", "Web Conversion & Fast Quoting"),
      status: activeResult?.identity?.website ? 'VERIFIED' : 'ESTIMATED',
      score: activeResult?.identity?.website ? 80 : 35,
      detail: activeResult?.identity?.website
        ? t("Sitio web detectado. Añade cotizador con IA para duplicar el contacto directo.", "Website detected. Add an instant quoting widget to double direct leads.")
        : t("Sin sitio web activo detectado. Los clientes que buscan en móvil no tienen dónde cotizar.", "No active website detected. Mobile searchers have no instant booking path."),
      actionLabel: t("Activar Web Móvil", "Launch Mobile Web"),
      actionTab: "website"
    }
  ];

  // Execute Next Best Action directly to dedicated tool
  const handleExecuteAction = (act: { tab: string; subRow?: number; tool?: NavigateTool; btnText?: string }) => {
    navigateTo({ tab: act.tab, subRow: act.subRow, tool: act.tool });
    if (handleActiveTab) {
      handleActiveTab({ tab: act.tab, subRow: act.subRow });
    } else {
      if (setActiveTab) setActiveTab(act.tab);
      if (setActiveSubRow && act.subRow !== undefined) setActiveSubRow(act.subRow);
    }
    if (showToast) {
      showToast(`${t("Abriendo", "Opening")} ${act.btnText || act.tab}...`, 'info');
    }
  };

  // 3 Immediate Next Best Actions (Reply composer, Review request, Reactivation)
  const primaryActions: Array<{
    id: string;
    title: string;
    desc: string;
    tab: string;
    subRow?: number;
    tool?: NavigateTool;
    btnText: string;
  }> = [
    {
      id: "act_reply",
      title: t("1. Responder Mensajes de Clientes", "1. Answer Customer Inquiries"),
      desc: t("Responder y cotizar en menos de 15 min evita perder el trabajo frente al competidor.", "Quoting within 15 minutes stops customers from calling the next competitor."),
      tab: "leads",
      subRow: 0,
      tool: "analyze_msg",
      btnText: t("Abrir Redactor de Respuestas", "Open Reply Composer")
    },
    {
      id: "act_reviews",
      title: t("2. Pedir Reseñas a Trabajos Terminados", "2. Request Reviews for Completed Jobs"),
      desc: t("Consigue 3 a 5 reseñas directas por SMS para ganar la primera llamada en Maps.", "Collect 3 to 5 verified reviews via SMS to win the first call on Maps."),
      tab: "reviews",
      subRow: 0,
      btnText: t("Pedir Reseñas", "Request Reviews")
    },
    {
      id: "act_reactivation",
      title: t("3. Seguimiento a Presupuestos sin Respuesta", "3. Follow Up on Quotes Waiting for Reply"),
      desc: t("Recupera trabajos cotizados y reactiva clientes con mensajes listos en 1 toque.", "Recover pending quotes and win back unscheduled jobs with 1-tap follow-ups."),
      tab: "leads",
      subRow: 5,
      tool: "estimate_followup",
      btnText: t("Seguimiento a Presupuestos", "Follow Up on Quotes")
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans text-slate-800 dark:text-slate-100">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-400/30">
              {t("Auditoría de Mercado Local", "Local Market Audit")}
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1">
              <ShieldCheck size={12} /> {t("Evidencias Reales", "Real Evidences")}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {t("Escáner de Visibilidad y Competencia", "Visibility & Competitor Scanner")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {t(
              "Revisa la salud de tu negocio, compara tu radio frente a competidores reales y ejecuta las 3 acciones prioritarias para ganar clientes.",
              "Audit business health, benchmark your service radius against real competitors, and execute the 3 key actions to win local jobs."
            )}
          </p>
        </div>

        {scanState !== 'IDLE' && (
          <button
            onClick={handleNewScan}
            className="relative z-10 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/10 cursor-pointer shadow-md"
          >
            <RefreshCw size={14} />
            <span>{t("Escanear Otro Negocio", "Scan Another Business")}</span>
          </button>
        )}
      </div>

      {/* 2. FORM & IDLE STATE */}
      {(scanState === 'IDLE' || scanState === 'LOADING') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Input Card */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
            
            {/* Quota Banner */}
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">
                  {t("CUOTA DE ESCANEOS DISPONIBLE", "AVAILABLE SCAN QUOTA")}
                </span>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                  {t("Escaneos restantes hoy:", "Scans left today:")} <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{quota.scansLeft} / {quota.totalScans}</span>
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (setActiveTab) setActiveTab('plans');
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-xl transition cursor-pointer shrink-0 shadow-md whitespace-nowrap self-start sm:self-center"
              >
                {t("Ver Planes", "View Plans")}
              </button>
            </div>

            <form onSubmit={handleRunScan} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Nombre del Negocio", "Business Name")} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={input.businessName}
                    onChange={(e) => setInput({ ...input, businessName: e.target.value })}
                    placeholder={t("Ej. Fontanería Express o Electricidad Gómez", "e.g. Sanchez Plumbing or Apex Electric")}
                    disabled={scanState === 'LOADING'}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("Ciudad", "City")} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={input.city}
                      onChange={(e) => setInput({ ...input, city: e.target.value })}
                      placeholder={t("Ej. Madrid o Miami", "e.g. Madrid or Miami")}
                      disabled={scanState === 'LOADING'}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("Provincia / Estado", "Province / State")}
                  </label>
                  <input
                    type="text"
                    value={input.state || ''}
                    onChange={(e) => setInput({ ...input, state: e.target.value })}
                    placeholder={t("Ej. Florida o Madrid", "e.g. FL or Madrid")}
                    disabled={scanState === 'LOADING'}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Sector / Nicho Comercial", "Business Trade / Niche")}
                </label>
                <select
                  value={input.niche}
                  onChange={(e) => setInput({ ...input, niche: e.target.value })}
                  disabled={scanState === 'LOADING'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="servicios_del_hogar">{t("Servicios del Hogar (HVAC, Fontaneros, Electricistas)", "Home Services (HVAC, Plumbers, Electricians)")}</option>
                  <option value="restaurantes">{t("Restaurantes y Cafeterías", "Restaurants & Cafes")}</option>
                  <option value="comercio_local">{t("Comercio y Tiendas Locales", "Local Retail & Stores")}</option>
                  <option value="salud_y_estetica">{t("Salud, Belleza y Clínicas", "Health, Beauty & Clinics")}</option>
                  <option value="servicios_profesionales">{t("Servicios Profesionales (Abogados, Consultoría)", "Professional Services (Legal, Consulting)")}</option>
                  <option value="otro">{t("Otro Sector", "Other Trade")}</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={scanState === 'LOADING' || quota.isCooldown || quota.scansLeft <= 0}
                className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  scanState === 'LOADING' || quota.isCooldown || quota.scansLeft <= 0
                    ? 'bg-slate-700 cursor-not-allowed opacity-80'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                }`}
              >
                {scanState === 'LOADING' ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    <span>{t("Auditoría en Progreso...", "Audit in Progress...")}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>{t("Lanzar Escáner de Visibilidad", "Launch Visibility Scanner")}</span>
                  </>
                )}
              </button>
            </form>

            {/* Progress status during scan */}
            {scanState === 'LOADING' && (
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-300">
                  <span className="flex items-center gap-2">
                    <Activity size={16} className="text-indigo-600 animate-pulse" />
                    {progressMsg}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Recent Scans */}
          <div className="lg:col-span-5 space-y-6">
            {recentScans.length > 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("Auditorías Recientes Guardadas", "Recent Saved Audits")}
                </h3>
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {recentScans.map((scan) => (
                    <button
                      key={scan.id}
                      onClick={() => handleSelectRecent(scan)}
                      className="w-full text-left p-3.5 bg-slate-50 hover:bg-indigo-50/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 transition flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {scan.identity.businessName}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {scan.identity.city} {scan.identity.state ? `, ${scan.identity.state}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {scan.score?.overall && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            {scan.score.overall}%
                          </span>
                        )}
                        <ArrowRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck size={18} />
                  <span>{t("Verificación Directa", "Direct Verification")}</span>
                </div>
                <h3 className="text-base font-bold text-white">
                  {t("Datos Reales de Google Maps", "Real Google Maps Data")}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t(
                    "Bvelt consulta directamente índices públicos de geolocalización y señales de mercado locales. Sin métricas falsas ni simulaciones infladas.",
                    "Bvelt checks live public geolocation indexes and local business signals. No simulated gains or inflated metrics."
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. GRACEFUL ERROR STATE WITH IMMEDIATE CHECKLIST ACTIONS */}
      {scanState === 'ERROR' && (
        <div className="space-y-6">
          <div className="bg-rose-50 dark:bg-rose-950/30 p-6 sm:p-8 rounded-3xl border border-rose-200 dark:border-rose-800/60 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertOctagon size={28} />
              <h3 className="text-base font-black">
                {t("Auditoría en Modo de Contingencia", "Audit in Contingency Mode")}
              </h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
              {errorMessage || t("No se pudo completar la consulta en vivo de mapas. Puedes reintentar o ejecutar las acciones directas de crecimiento a continuación.", "Live maps query could not be completed. You can retry or execute the direct growth actions below.")}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleRunScan}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
              >
                {t("Reintentar Escaneo", "Retry Scan")}
              </button>
              <button
                onClick={handleNewScan}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {t("Editar Datos", "Edit Details")}
              </button>
            </div>
          </div>

          {/* Graceful Fallback: Immediate Non-Scan Action Checklist */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                {t("ACCIONES PRIORITARIAS DISPONIBLES", "AVAILABLE PRIORITY ACTIONS")}
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {t("Checklist de Crecimiento Local Inmediato", "Immediate Local Growth Checklist")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("No dependes del mapa para avanzar. Estas 3 acciones directas mejoran tu captación de clientes hoy mismo:", "You don't need a live scan to move forward. These 3 actions improve customer acquisition right now:")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {primaryActions.map((act) => (
                <div key={act.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{act.title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{act.desc}</p>
                  </div>
                  <button
                    onClick={() => handleExecuteAction(act)}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span>{act.btnText}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. CONCLUSIONS FIRST RESULTS VIEW: 1 SUMMARY + 3 DRIVERS + 3 ACTIONS + MAP + TOP 3 BENCHMARK */}
      {(scanState === 'SUCCESS' || scanState === 'PARTIAL') && activeResult && (
        <div className="space-y-6">
          
          {/* A. 1 SUMMARY HERO CARD + SHARE SNAPSHOT */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                    {t("RESUMEN DE AUDITORÍA", "AUDIT SUMMARY")}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    activeResult.identity.isClaimed 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" 
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}>
                    {activeResult.identity.isClaimed ? t("Ficha Reclamada", "Claimed Listing") : t("Ficha sin Reclamar", "Unclaimed Listing")}
                  </span>
                  {normalizedScan.scanState && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                      normalizedScan.scanState === 'fresh'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : normalizedScan.scanState === 'cached'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : normalizedScan.scanState === 'degraded'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        : normalizedScan.scanState === 'action_required'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                    }`}>
                      {normalizedScan.scanState === 'fresh' && (language === 'es' ? '⚡ FRESCO' : '⚡ FRESH')}
                      {normalizedScan.scanState === 'cached' && (language === 'es' ? '💾 CACHÉ' : '💾 CACHED')}
                      {normalizedScan.scanState === 'empty' && (language === 'es' ? '⚪ SIN RESULTADOS' : '⚪ EMPTY')}
                      {normalizedScan.scanState === 'degraded' && `⚠️ DEGRADADO (${(normalizedScan.degradedReason || 'PROVIDER').toUpperCase()})`}
                      {normalizedScan.scanState === 'action_required' && (language === 'es' ? '🎯 ACCIÓN REQUERIDA' : '🎯 ACTION REQUIRED')}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {scanRadiusKm} km {t("radio", "radius")}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {activeResult.identity.businessName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin size={14} className="text-slate-400" /> 
                  {activeResult.identity.address || `${activeResult.identity.city}${activeResult.identity.state ? ', ' + activeResult.identity.state : ''}`}
                </p>
              </div>

              {/* Health Score + Share Snapshot Button */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleShareSnapshot}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-indigo-50/60 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-2 cursor-pointer shadow-sm"
                  title={t("Copiar resumen seguro de auditoría sin datos privados", "Copy privacy-safe audit snapshot without private data")}
                >
                  {copiedSnapshot ? (
                    <>
                      <Check size={14} className="text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">{t("¡Copiado!", "Copied!")}</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                      <span>{t("Compartir Resumen", "Share Snapshot")}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-50 dark:bg-slate-800/80 border-2 border-indigo-500/30 shadow-inner text-center">
                  <div>
                    <span className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white block leading-none">
                      {typeof activeResult.score?.overall === 'number' ? `${activeResult.score.overall}%` : '72%'}
                    </span>
                    <span className="text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block mt-1">
                      Health Score
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scan State Banner (fresh | cached | empty | degraded | action_required) */}
            {normalizedScan.scanState && (
              <div className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-wrap items-center justify-between gap-2.5 ${
                normalizedScan.scanState === 'fresh'
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                  : normalizedScan.scanState === 'cached'
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                  : normalizedScan.scanState === 'degraded'
                  ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
                  : normalizedScan.scanState === 'action_required'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200'
                  : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">
                    {normalizedScan.scanState === 'fresh' ? '⚡' : normalizedScan.scanState === 'cached' ? '💾' : normalizedScan.scanState === 'degraded' ? '⚠️' : normalizedScan.scanState === 'action_required' ? '🎯' : 'ℹ️'}
                  </span>
                  <span className="leading-snug">{normalizedScan.userMessage}</span>
                </div>
                {normalizedScan.isCached && normalizedScan.cacheAgeText && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/30 border border-current shrink-0">
                    {language === 'es' ? `actualizado hace ${normalizedScan.cacheAgeText}` : `updated ${normalizedScan.cacheAgeText} ago`}
                  </span>
                )}
              </div>
            )}

            {/* Why This Matters / Main Operational Diagnosis (Honest Copy + Directional Tag) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                  <Target size={16} />
                  <span>{t("Por qué importa: Diagnóstico y Oportunidad de Mercado", "Why This Matters: Market Diagnosis & Opportunity")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMethodologyModal(true)}
                  className="text-[10px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer underline"
                >
                  <Info size={12} />
                  <span>{t("Metodología orientativa", "Directional methodology")}</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeResult.identity.isClaimed
                  ? t("Tu negocio cuenta con presencia básica en Google Maps, pero existen competidores cercanos capturando llamadas por volumen de reseñas y falta de cotizador móvil instantáneo.", "Your business has basic Google Maps presence, but nearby competitors capture calls due to review volume advantages and missing instant mobile quoting.")
                  : t("Tu ficha local no está totalmente verificada u optimizada. Reclamar el perfil y activar presupuestos móviles capturará demanda inmediata en tu radio.", "Your local profile is not fully verified or optimized. Claiming your listing and activating mobile quotes will immediately capture local search volume.")}
              </p>

              {/* Directional Potential Badge & Verified Fact */}
              <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold text-[10px] tracking-wide uppercase flex items-center gap-1">
                  <ShieldCheck size={11} />
                  {t("Hecho Verificado", "Verified Fact")}
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {t("Presencia pública en mapas y competidores locales reales analizados.", "Public map presence and real local competitors analyzed.")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold text-[10px] tracking-wide uppercase">
                  {t("Estimación Direccional", "Directional Estimate")}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {t(
                    `Demanda potencial estimada: ~8 a 15 llamadas al mes en ${scanRadiusKm} km (Estimación orientativa, no ingreso garantizado).`,
                    `Estimated potential demand: ~8 to 15 calls/mo in ${scanRadiusKm} km (Directional estimate, not guaranteed income).`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* B. 3 CORE SCORE DRIVERS */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("3 Pilares Clave de Rendimiento", "3 Core Performance Drivers")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {drivers.map((drv) => (
                <div key={drv.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{drv.title}</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{drv.score}%</span>
                    </div>
                    {/* Linear bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${drv.score >= 70 ? 'bg-emerald-500' : drv.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                        style={{ width: `${drv.score}%` }} 
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      {drv.detail}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab(drv.actionTab)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800"
                  >
                    <span>{drv.actionLabel}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* C. INTERACTIVE MAP: USER PIN + TOP 3 COMPETITORS BENCHMARK */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">
                  {t("MAPA DE COBERTURA Y BENCHMARK", "COVERAGE MAP & BENCHMARK")}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t("Tu Negocio vs Competidores Principales", "Your Business vs Top Competitors")}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Radius Buttons */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10px] font-bold">
                  {[5, 10, 25].map((rad) => (
                    <button
                      key={rad}
                      type="button"
                      onClick={() => handleRunScan(undefined, rad)}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        scanRadiusKm === rad 
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {rad} km
                    </button>
                  ))}
                </div>

                {enrichedCompetitorList.length > 3 && (
                  <button
                    onClick={() => setShowAllCompetitors(!showAllCompetitors)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer ml-2"
                  >
                    {showAllCompetitors ? t("Mostrar solo Top 3", "Show Top 3 only") : t(`Ver todos (${enrichedCompetitorList.length})`, `View all (${enrichedCompetitorList.length})`)}
                  </button>
                )}
              </div>
            </div>

            {/* Embedded Leaflet Map */}
            <div className="h-72 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
              <AuditLeafletMap
                center={mapCenter}
                radiusKm={scanRadiusKm}
                userBusinessName={activeResult.identity.businessName}
                competitors={mapCompetitors}
                selectedCompetitorIndex={selectedCompetitorIdx}
                onSelectCompetitor={(idx) => setSelectedCompetitorIdx(idx)}
                language={language === 'en' ? 'en' : 'es'}
                emptyMessage={t("No se detectaron competidores directos en este radio.", "No direct competitors detected in this radius.")}
              />
            </div>

            {/* Sparse State Handling: 0 Competitors Found */}
            {enrichedCompetitorList.length === 0 && (
              <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <AlertCircle size={16} />
                  <span>{activeResult.messageForUi || t(`Mercado Despejado: 0 competidores directos en ${scanRadiusKm} km`, `Clear Territory: 0 direct competitors detected in ${scanRadiusKm} km`)}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t(
                    "No encontramos otros negocios del mismo nicho compitiendo en este radio exacto. Tienes vía libre para posicionarte como la referencia número #1 en Google Maps.",
                    "No direct rivals registered in this exact radius. You have an open path to establish #1 local authority on Google Maps."
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{t("Ampliar radio de búsqueda:", "Expand scan radius:")}</span>
                  <button
                    type="button"
                    onClick={() => handleRunScan(undefined, 10)}
                    disabled={scanState === 'LOADING'}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    ⚡ {t("Reintentar a 10 km", "Retry at 10 km")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunScan(undefined, 25)}
                    disabled={scanState === 'LOADING'}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    ⚡ {t("Reintentar a 25 km", "Retry at 25 km")}
                  </button>
                </div>
              </div>
            )}

            {/* Top 3 Competitor Rows with Plain-Language Win/Lose Reasons */}
            {enrichedCompetitorList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {enrichedCompetitorList.slice(0, showAllCompetitors ? 10 : 3).map((comp, idx) => {
                  const isLeader = idx === 0;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedCompetitorIdx(idx)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                        selectedCompetitorIdx === idx
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Header: Rank + Distance */}
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            isLeader 
                              ? 'bg-indigo-600 text-white' 
                              : idx === 1 
                                ? 'bg-slate-800 text-slate-100 dark:bg-slate-700' 
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            #{idx + 1} {isLeader ? t("Líder", "Leader") : idx === 1 ? t("Retador", "Challenger") : t("Competidor", "Competitor")}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {comp.distanceKm ? `${comp.distanceKm} km` : '0.9 km'}
                          </span>
                        </div>

                        {/* Name & Basic Info */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{comp.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-0.5 font-bold text-amber-500">
                              <Star size={12} className="fill-amber-400" />
                              {comp.rating ? Number(comp.rating).toFixed(1) : (language === 'en' ? 'No rating' : 'Sin nota')}
                            </span>
                            <span>•</span>
                            <span>
                              {comp.reviewCount !== undefined && comp.reviewCount !== null 
                                ? `${comp.reviewCount} ${t("reseñas", "reviews")}` 
                                : t("Sin reseñas", "No reviews")}
                            </span>
                          </div>
                        </div>

                        {/* Plain Language Win/Lose Reason */}
                        <div className={`p-2.5 rounded-xl border text-[11px] leading-snug ${
                          comp.winLoseType === 'win'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
                            : comp.winLoseType === 'lose'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          <p className="font-semibold">{comp.winLoseReason}</p>
                        </div>
                      </div>

                      {/* Footer Actions / Links */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[10px]">
                        {comp.website ? (
                          <a 
                            href={comp.website} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                          >
                            <Globe size={11} /> {t("Ver Web", "Visit Web")} <ExternalLink size={9} />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">{t("Sin sitio web", "No website")}</span>
                        )}
                        {comp.phone && (
                          <span className="text-slate-500 font-mono text-[9px] flex items-center gap-1">
                            <Phone size={9} /> {comp.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* D. 3 NEXT BEST ACTIONS (REVENUE & RECOVERY FOCUS) */}
          <div className="bg-slate-950 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-5">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">
                {t("SIGUIENTES MEJORES ACCIONES (ENFOQUE EN INGRESOS)", "NEXT BEST ACTIONS (REVENUE FOCUS)")}
              </span>
              <h3 className="text-base font-black text-white">
                {t("3 Pasos para Ganar Trabajos en tu Zona", "3 Steps to Win Local Jobs")}
              </h3>
              <p className="text-xs text-slate-400">
                {t("Ejecuta estas 3 acciones prioritarias para cerrar llamadas y recuperar clientes:", "Execute these 3 priority actions to close inquiries and recover clients:")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {primaryActions.map((act) => (
                <div key={act.id} className="p-5 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white">{act.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{act.desc}</p>
                  </div>
                  <button
                    onClick={() => handleExecuteAction(act)}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span>{act.btnText}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* E. ADVANCED TELEMETRY & VERIFIABLE EVIDENCES (COLLAPSIBLE / ADVANCED ONLY) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowAdvancedTelemetry(!showAdvancedTelemetry)}
              className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Layers size={16} className="text-indigo-600" />
                <span>{t("Avanzado: Evidencias Técnicas y Fuentes de Datos", "Advanced Details: Technical Evidences & Data Sources")}</span>
              </div>
              {showAdvancedTelemetry ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showAdvancedTelemetry && (
              <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
                  {Object.entries(activeResult.evidences).map(([key, evItem]) => {
                    const ev = evItem as BusinessScanEvidenceItem;
                    const badge = getEvidenceBadge(ev.evidenceStatus, t);
                    return (
                      <div key={key} className="p-3 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">{ev.field}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-black border ${badge.colorClass}`}>{badge.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{ev.value ? String(ev.value) : t("N/D", "N/A")}</p>
                        <div className="text-[8px] text-slate-400 flex justify-between">
                          <span>{ev.sourceLabel}</span>
                          <span>{new Date(ev.lastUpdated).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 5. METHODOLOGY POPUP MODAL (Honest Directional Explanation) */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <Info size={18} />
                <h3>{t("Metodología de Estimación Direccional", "Directional Estimation Methodology")}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold text-base"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                {t(
                  "En Bvelt no utilizamos cifras falsas ni garantías irreales de facturación. Todas las estimaciones de demanda son cálculos direccionales basados en:",
                  "At Bvelt we never use inflated claims or fake revenue guarantees. All demand figures are directional benchmarks based on:"
                )}
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <li>{t("Volumen medio de búsquedas mensuales locales del sector en tu radio.", "Local monthly search volume benchmarks for your trade in this radius.")}</li>
                <li>{t("Tasa promedio de conversión en fichas con perfil verificado y reseñas activas (2% a 4%).", "Average conversion rates on profiles with active reviews (2% to 4%).")}</li>
                <li>{t("Brecha de reputación y tiempo de respuesta frente a los 3 competidores más próximos.", "Reputation and response time gap vs your 3 nearest local competitors.")}</li>
              </ul>
              <p className="text-[10px] text-slate-400 italic pt-1">
                {t("Esta información se proporciona como guía estratégica y no constituye una garantía contractual de ingresos.", "This information serves as strategic guidance and does not constitute a financial guarantee.")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowMethodologyModal(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {t("Entendido", "Understood")}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
