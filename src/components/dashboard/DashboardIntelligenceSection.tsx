import React, { useState, useEffect } from 'react';
import { Zap, Sparkles, RefreshCw, Map as MapIcon, Target, AlertTriangle, Star, X, ArrowRight, Award, Globe, AlertCircle, ExternalLink, Bot, ShieldCheck, Activity, HelpCircle, Clock, MessageSquare, Heart, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import { AuditScannerCard } from '../AuditScannerCard';
import { AuditLeafletMap, RealCompetitor } from '../AuditLeafletMap';
import { IndustryResolver } from '../../knowledge/resolvers/industryResolver';
import { MarketReferenceEngine } from '../../knowledge/engine/marketReferenceEngine';
import { 
  detectAllCompetitorMovements, 
  CompetitorMovementSummary, 
  CompetitorMovementSignal 
} from '../../knowledge/memory/ghostCompetitorService';
import { 
  auditAiVisibility, 
  AIVisibilitySummary, 
  AIVisibilitySnapshot,
  compileOperationalFingerprint,
  OperationalFingerprintSummary,
  OperationalFingerprintSignal
} from '../../knowledge/memory';
import { CompetitorSnapshot } from '../../knowledge/memory/bemTypes';
import { parseLocationString } from '../../utils/locationParser';
import { useScansQuota } from '../../lib/rateLimitService';
import { navigateTo } from '../../lib/navigateTo';

interface DashboardIntelligenceSectionProps {
  t: (es: string, en: string) => string;
  profile: any;
  growthStats: any;
  setActiveTab: (tab: string) => void;
  onGeneratePitch?: (lead: any) => void;
  onAddLead?: (comp: any) => void;
  setRealCompetitors: React.Dispatch<React.SetStateAction<any[]>>;
  mapCoords: { lat: number; lon: number } | null;
  calculateDistanceKm: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  radarRadius: number;
  setRadarRadius: React.Dispatch<React.SetStateAction<number>>;
  radarKeyword: string;
  setRadarKeyword: React.Dispatch<React.SetStateAction<string>>;
  setRadarRescanTrigger: React.Dispatch<React.SetStateAction<number>>;
  mapMode: 'leaflet' | 'radar';
  setMapMode: (mode: 'leaflet' | 'radar') => void;
  handleRadarRescan: () => void;
  isRadarScanning: boolean;
  hasNoCompetitorsInRadius: boolean;
  realCompetitors: any[];
  radarBlips: any[];
  selectedBlipIndex: number | null;
  setSelectedBlipIndex: (idx: number | null) => void;
  playCoinSound: () => void;
  language: string;
  isVerifiedRank1: boolean;
  gmbConnected: boolean;
  nicheDefined: boolean;
  Ps: number;
  marketForNiche: any;
  getCalculatedBenchmark: (cat: string, loc: string) => { avgTicket: number; top3Views: number };
  handleConnectGmbClick: () => void;
  onOpenCalculationModal?: (details: any) => void;
}

export const DashboardIntelligenceSection: React.FC<DashboardIntelligenceSectionProps> = ({
  t,
  profile,
  growthStats,
  setActiveTab,
  onGeneratePitch,
  onAddLead,
  setRealCompetitors,
  mapCoords,
  calculateDistanceKm,
  radarRadius,
  setRadarRadius,
  radarKeyword,
  setRadarKeyword,
  setRadarRescanTrigger,
  mapMode,
  setMapMode,
  handleRadarRescan,
  isRadarScanning,
  hasNoCompetitorsInRadius,
  realCompetitors,
  radarBlips,
  selectedBlipIndex,
  setSelectedBlipIndex,
  playCoinSound,
  language,
  isVerifiedRank1,
  gmbConnected,
  nicheDefined,
  Ps,
  marketForNiche,
  getCalculatedBenchmark,
  handleConnectGmbClick,
  onOpenCalculationModal,
}) => {
  const quota = useScansQuota(profile, language);

  const [showSecondaryMap, setShowSecondaryMap] = React.useState(false);
  const [movementSummary, setMovementSummary] = React.useState<CompetitorMovementSummary | null>(null);
  const [aiVisibilitySummary, setAiVisibilitySummary] = React.useState<AIVisibilitySummary | null>(null);
  const [isAiAuditing, setIsAiAuditing] = React.useState<boolean>(false);
  const [operationalSummary, setOperationalSummary] = React.useState<OperationalFingerprintSummary | null>(null);
  const [isOpFingerprintLoading, setIsOpFingerprintLoading] = React.useState<boolean>(false);
  const [activeOpTab, setActiveOpTab] = React.useState<'strengths' | 'weaknesses' | 'opportunities'>('strengths');

  // Trigger or load cached Operational Fingerprint
  const handleRunOperationalFingerprint = React.useCallback(async (forceRefresh = false) => {
    if (!profile) return;
    setIsOpFingerprintLoading(true);
    try {
      const summary = await compileOperationalFingerprint({
        entityId: profile?.id || 'ent_default',
        businessName: profile?.businessName || profile?.name || 'Mi Negocio',
        category: profile?.category || 'Servicios Locales',
        location: profile?.location || 'España',
        reviews: profile?.reviews || [],
        gmbConnected: Boolean(gmbConnected),
        rating: profile?.rating,
        reviewCount: profile?.reviewCount
      }, { forceRefresh });
      setOperationalSummary(summary);
    } catch (e) {
      console.warn('[DashboardIntelligence] Error compiling operational fingerprint:', e);
    } finally {
      setIsOpFingerprintLoading(false);
    }
  }, [profile, gmbConnected]);

  // Trigger or load cached AI Visibility Audit
  const handleRunAiAudit = React.useCallback(async (forceRefresh = false) => {
    if (!profile?.location || !profile?.category) return;
    setIsAiAuditing(true);
    try {
      const summary = await auditAiVisibility({
        entityId: profile?.id || 'ent_default',
        businessName: profile?.businessName || profile?.name || 'Mi Negocio',
        category: profile?.category || 'Servicios Locales',
        location: profile?.location || 'España',
        language: language === 'en' ? 'en' : 'es',
        forceRefresh
      });
      setAiVisibilitySummary(summary);
    } catch (e) {
      console.warn('[DashboardIntelligence] Error executing AI audit:', e);
    } finally {
      setIsAiAuditing(false);
    }
  }, [profile?.id, profile?.businessName, profile?.name, profile?.category, profile?.location, language]);

  React.useEffect(() => {
    let isMounted = true;
    if (profile?.location && profile?.category && !aiVisibilitySummary && !isAiAuditing) {
      handleRunAiAudit(false);
    }
    if (profile && !operationalSummary && !isOpFingerprintLoading) {
      handleRunOperationalFingerprint(false);
    }
    return () => {
      isMounted = false;
    };
  }, [profile?.location, profile?.category, profile?.reviews]);

  React.useEffect(() => {
    let isMounted = true;
    if (realCompetitors && realCompetitors.length > 0) {
      const snapshots: CompetitorSnapshot[] = realCompetitors.map(c => ({
        name: c.name,
        address: c.address || c.vicinity,
        phone: c.phone,
        website: c.website,
        category: c.category,
        lat: c.lat,
        lng: c.lng,
        placeId: c.placeId,
        osmId: c.osmId || (typeof c.id === 'string' && c.id.startsWith('ov-') ? c.id.replace('ov-', '') : undefined),
        rating: typeof c.rating === 'number' ? c.rating : undefined,
        reviewCount: typeof c.reviewsCount === 'number' ? c.reviewsCount : (typeof c.reviewCount === 'number' ? c.reviewCount : undefined),
        sourceType: c.source || 'SCAN_MAPS'
      }));

      detectAllCompetitorMovements(snapshots).then(summary => {
        if (isMounted) {
          setMovementSummary(summary);
        }
      }).catch(err => {
        console.warn('[DashboardIntelligence] Error analyzing competitor movements:', err);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [realCompetitors]);

  // Enrich realCompetitors with movement signals for the Leaflet Map
  const enrichedCompetitors: RealCompetitor[] = React.useMemo(() => {
    const list = realCompetitors ?? [];
    if (list.length === 0) return [];
    if (!movementSummary || (movementSummary?.latestMovementSignals ?? []).length === 0) {
      return list;
    }

    const signalMap = new Map<string, CompetitorMovementSignal>();
    (movementSummary?.latestMovementSignals ?? []).forEach(s => {
      if (s?.competitorName) {
        signalMap.set(s.competitorName.toLowerCase(), s);
      }
    });

    return list.map(comp => {
      const signal = comp?.name ? signalMap.get(comp.name.toLowerCase()) : undefined;
      if (signal) {
        return {
          ...comp,
          hasMovement: true,
          movementLabel: signal.deltaFormatted || (language === 'es' ? 'Movimiento' : 'Movement')
        };
      }
      return comp;
    });
  }, [realCompetitors, movementSummary, language]);

  const marketReference = React.useMemo(() => {
    if (profile?.category && profile?.location) {
      const resolved = IndustryResolver.resolve(profile.category);
      return MarketReferenceEngine.estimateMarketOpportunity(resolved.naicsCandidates, profile.location);
    }
    return null;
  }, [profile?.category, profile?.location]);

  const localBenchmarks = React.useMemo(() => {
    return MarketReferenceEngine.computeLocalBenchmarks(
      realCompetitors ?? [],
      'SAME_CITY_SAME_RADIUS',
      language === 'en' ? 'en' : 'es'
    );
  }, [realCompetitors, language]);

  return (
    <div id="section-market-intelligence" className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            {t("4. Radar de Mercado y Oportunidades", "4. Market Radar & Opportunities")}
          </h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t("Radar local OSM, mapa interactivo de competidores y llamadas perdidas en tu zona.", "OSM local radar, interactive competitor map & local call opportunities in your area.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-900/30">
            {(realCompetitors ?? []).length} {t("Competidores en Radar", "Competitors on Radar")}
          </span>
        </div>
      </div>

      {/* VIP Access Banner: 3-in-1 Automatic Client Generator */}
      <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-100/50 dark:from-slate-900 dark:via-indigo-950/60 dark:to-slate-950 border-2 border-indigo-100 dark:border-indigo-500/30 rounded-[2.5rem] p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 text-center md:text-left relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase border border-indigo-200 dark:border-indigo-500/20">
            <span>{t("HERRAMIENTA 3-EN-1 DE CRECIMIENTO INSTANTÁNEO", "INSTANT 3-IN-1 GROWTH TOOL")}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t("Generador Automático de Clientes y Reputación Google Maps", "Automatic Google Maps Client & Reputation Generator")}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {t("Analiza en 5 segundos las brechas de visibilidad frente a competidores en tu zona y genera al instante tu anuncio para redes sociales y respuestas para captar más demanda local.", "Analyze in 5 seconds your visibility gaps against local competitors and instantly generate your social media ads and review replies to capture local demand.")}
          </p>
        </div>
        <button
          onClick={() => setActiveTab('growth')}
          className="w-full md:w-auto bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-indigo-600/20 transition hover:scale-105 active:scale-95 flex items-center justify-center gap-3 cursor-pointer text-sm whitespace-nowrap relative z-10"
        >
          <Zap size={18} />
          <span>{t("✨ Abrir Generador Automático", "✨ Open Automatic Generator")}</span>
        </button>
      </div>

      {/* Real-Time Audit Scanner Engine */}
      <AuditScannerCard 
        profile={profile}
        t={t}
        setActiveTab={setActiveTab}
        growthStats={growthStats}
        onGeneratePitch={onGeneratePitch}
        onOpenCalculationModal={onOpenCalculationModal}
        onCompetitorExtracted={(comp) => {
          if (comp && comp.name) {
            setRealCompetitors(prev => {
              const exists = prev.some(c => c.name.toLowerCase() === comp.name.toLowerCase());
              if (exists) return prev;

              const compLat = comp.coords?.lat ?? comp.lat;
              const compLng = comp.coords?.lng ?? comp.lng;

              const dist = mapCoords?.lat && mapCoords?.lon && typeof compLat === 'number' && typeof compLng === 'number'
                ? calculateDistanceKm(mapCoords.lat, mapCoords.lon, compLat, compLng)
                : undefined;

              const newComp: any = {
                name: comp.name,
                lat: compLat,
                lng: compLng,
                distanceKm: dist ? parseFloat(dist.toFixed(1)) : undefined,
                rank: 0,
                trend: 'stable',
                blindspotEs: comp.years ? `Años en negocio: ${comp.years}` : 'Análisis de oportunidad pendiente de auditoría directa',
                blindspotEn: comp.years ? `Years in business: ${comp.years}` : 'Opportunity analysis pending direct audit',
                actionEs: '(Recomendación) Realizar seguimiento comercial o auditoría directa',
                actionEn: '(Recommendation) Conduct direct outreach or audit'
              };
              return [newComp, ...prev];
            });
          }
        }}
      />

      {/* Market Potential Hook Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 text-white rounded-[2rem] p-6 md:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-indigo-500/30">
            <Sparkles size={12} /> {t("Análisis de Demanda Local", "Local Demand Analysis")}
          </div>
          <h3 className="text-xl md:text-2xl font-black tracking-tight">
            {t(`Potencial Estimado de Mercado en ${profile?.location || 'Tu Ciudad'}`, `Estimated Market Potential in ${profile?.location || 'Your City'}`)}
          </h3>
          <p className="text-xs text-slate-300 max-w-xl">
            {nicheDefined 
              ? t(`Basado en tu nicho (${profile?.category}) y zona geográfica, estimamos un ticket promedio de $${getCalculatedBenchmark(profile?.category || 'otro', profile?.location || '').avgTicket.toLocaleString()} y una demanda local activa de más de ${getCalculatedBenchmark(profile?.category || 'otro', profile?.location || '').top3Views.toLocaleString()} búsquedas mensuales.`,
                  `Based on your niche (${profile?.category}) and location, we estimate an average ticket of $${getCalculatedBenchmark(profile?.category || 'otro', profile?.location || '').avgTicket.toLocaleString()} and active local demand exceeding ${getCalculatedBenchmark(profile?.category || 'otro', profile?.location || '').top3Views.toLocaleString()} monthly searches.`)
              : t("Configura tu nicho y ciudad en tu perfil para calcular el potencial de mercado en tiempo real.", "Configure your niche and city in your profile to calculate real-time market potential.")}
          </p>
        </div>
        <div className="flex items-center gap-4 relative z-10 shrink-0">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
            <p className="text-[9px] font-bold text-slate-300 uppercase">{t("Ticket Promedio", "Avg Ticket")}</p>
            <p className="text-lg font-black text-emerald-400">{nicheDefined ? `$${getCalculatedBenchmark(profile?.category || 'otro', profile?.location || '').avgTicket.toLocaleString()}` : t("N/D", "N/A")}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
            <p className="text-[9px] font-bold text-slate-300 uppercase">{t("Demanda Estimada", "Est. Demand")}</p>
            <p className="text-lg font-black text-indigo-400">{nicheDefined ? `${getCalculatedBenchmark(profile?.category || 'otro', profile?.location || '').top3Views.toLocaleString()} v/m` : t("N/D", "N/A")}</p>
          </div>
        </div>
      </div>

      {/* AI Visibility & Local AI Presence (Block 5.1 — Provider Integrity) */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Bot size={18} />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {t("Presencia en Motores de Inteligencia Artificial (AI Search)", "AI Search Visibility & Assistant Presence")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("Auditoría directa de recomendaciones locales cuando clientes potenciales preguntan a asistentes de IA.", "Direct audit of local recommendations when prospective customers ask AI assistants.")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold uppercase px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
              {aiVisibilitySummary?.latestSnapshots?.[0]?.provider === 'GOOGLE_GEMINI'
                ? `PROVENANCE: GEMINI_3.7_FLASH (n=${aiVisibilitySummary.sampleSize || 1})`
                : `PROVENANCE: MODELED_FALLBACK (n=${aiVisibilitySummary?.sampleSize || 1})`
              }
            </span>
            <button
              onClick={() => handleRunAiAudit(true)}
              disabled={isAiAuditing}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isAiAuditing ? "animate-spin text-indigo-500" : ""} />
              <span>{isAiAuditing ? t("Auditando...", "Auditing...") : t("Re-auditar IA", "Re-audit AI")}</span>
            </button>
          </div>
        </div>

        {/* AI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("Puntuación de Presencia IA", "AI Presence Score")}
            </p>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black ${
                (aiVisibilitySummary?.overallAiPresenceScore || 0) >= 70 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-amber-600 dark:text-amber-400"
              }`}>
                {aiVisibilitySummary?.overallAiPresenceScore ?? 35}/100
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {(aiVisibilitySummary?.overallAiPresenceScore || 0) >= 70 ? t("Alta Autoridad", "High Authority") : t("Brecha Detectada", "Gap Detected")}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("Mención en IA", "AI Share of Voice")}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {aiVisibilitySummary?.presenceRatePercent ?? 0}%
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {aiVisibilitySummary?.averageRank ? `#${aiVisibilitySummary.averageRank} rank` : t("Sin mención directa", "No direct citation")}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("Competidor Líder en IA", "Dominant AI Competitor")}
            </p>
            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 truncate">
              {aiVisibilitySummary?.dominantCompetitorName || t("Ninguno detectado", "None detected")}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {aiVisibilitySummary?.dominantCompetitorMentions 
                ? t(`Acapara recomendaciones locales`, `Capturing local recommendations`)
                : t("Mercado fragmentado", "Fragmented market")}
            </p>
          </div>
        </div>

        {/* Actionable Signals from AI Audit */}
        {aiVisibilitySummary && aiVisibilitySummary.signals.length > 0 && (
          <div className="space-y-3">
            {aiVisibilitySummary.signals.map((sig) => (
              <div 
                key={sig.id} 
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  sig.severity === 'CRITICAL'
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40 text-rose-900 dark:text-rose-100'
                    : sig.severity === 'POSITIVE'
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-100'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-100'
                }`}
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/70 dark:bg-black/30">
                      {sig.type}
                    </span>
                    <h4 className="text-sm font-bold">{sig.title}</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {language === 'es' ? sig.whyItMattersEs : sig.whyItMattersEn}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    {t("Evidencia:", "Evidence:")} {sig.evidence}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab(sig.actionTab || 'business_scan')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-black rounded-xl transition cursor-pointer shrink-0 shadow-sm"
                >
                  {t("Resolver en 1 Clic", "Fix in 1-Click")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BVELT BLOCK 6: OPERATIONAL FINGERPRINT & BEHAVIORAL INTELLIGENCE          */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <Activity size={18} />
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t("Huella Operativa & Patrones de Servicio", "Operational Fingerprint & Service Patterns")}
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t(
                "Patrones recurrentes de ejecución extraídos determinísticamente de reseñas y evidencia real de clientes.",
                "Recurring execution patterns extracted deterministically from real customer reviews and evidence."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Epistemic Provenance Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                {operationalSummary?.scoreProvenance === 'DERIVED'
                  ? t(`PATRÓN DERIVADO (n=${operationalSummary.sampleSize})`, `DERIVED PATTERN (n=${operationalSummary.sampleSize})`)
                  : operationalSummary?.scoreProvenance === 'MODELED'
                  ? t(`MODELO INICIAL (n=${operationalSummary.sampleSize})`, `INITIAL MODEL (n=${operationalSummary.sampleSize})`)
                  : t('SIN OBSERVACIONES SUFICIENTES', 'INSUFFICIENT OBSERVATIONS')}
              </span>
            </div>

            {operationalSummary && (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-200 dark:border-emerald-800">
                <span>{t("Índice Operativo:", "Health Score:")}</span>
                <span className="text-sm font-black">{operationalSummary.overallHealthScore}/100</span>
              </div>
            )}

            <button
              onClick={() => handleRunOperationalFingerprint(true)}
              disabled={isOpFingerprintLoading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-900 dark:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <RefreshCw size={12} className={isOpFingerprintLoading ? "animate-spin text-emerald-500" : ""} />
              {isOpFingerprintLoading ? t("Analizando...", "Auditing...") : t("Re-analizar", "Re-audit")}
            </button>
          </div>
        </div>

        {/* Tab switcher: Strengths, Weaknesses, Opportunities */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveOpTab('strengths')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeOpTab === 'strengths'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{t("Fortalezas Comprobadas", "Proven Strengths")}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeOpTab === 'strengths' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {operationalSummary?.strengths?.length ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveOpTab('weaknesses')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeOpTab === 'weaknesses'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldAlert size={14} />
            <span>{t("Fricciones a Corregir", "Friction to Fix")}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeOpTab === 'weaknesses' ? 'bg-rose-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {operationalSummary?.weaknesses?.length ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveOpTab('opportunities')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeOpTab === 'opportunities'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles size={14} />
            <span>{t("Oportunidades de Diferenciación", "Differentiation Gaps")}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeOpTab === 'opportunities' ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {operationalSummary?.neutralOrOpportunities?.length ?? 0}
            </span>
          </button>
        </div>

        {/* Signals List for Active Tab */}
        {operationalSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {((activeOpTab === 'strengths'
              ? operationalSummary?.strengths
              : activeOpTab === 'weaknesses'
              ? operationalSummary?.weaknesses
              : operationalSummary?.neutralOrOpportunities
            ) ?? []).map((sig) => {
              const themeName = sig.theme === 'RESPONSE_SPEED' ? t('Velocidad de Respuesta', 'Response Speed')
                : sig.theme === 'PROFESSIONALISM' ? t('Profesionalismo y Trato', 'Professionalism & Conduct')
                : sig.theme === 'COMMUNICATION' ? t('Claridad en Comunicación', 'Communication Clarity')
                : sig.theme === 'CLEANLINESS' ? t('Limpieza y Cuidado', 'Cleanliness & Site Care')
                : sig.theme === 'QUALITY' ? t('Calidad de Ejecución', 'Execution Quality')
                : sig.theme === 'PUNCTUALITY' ? t('Puntualidad en Citas', 'Punctuality & Schedule')
                : sig.theme === 'RELIABILITY' ? t('Fiabilidad y Confianza', 'Reliability & Trust')
                : sig.theme === 'PRICING_TRANSPARENCY' ? t('Transparencia de Tarifas', 'Pricing Transparency')
                : sig.theme === 'FOLLOW_THROUGH' ? t('Seguimiento y Garantía', 'Follow-Through & Warranty')
                : t('Servicio al Cliente', 'Customer Service');

              const isStrength = sig.themeCategory === 'STRENGTH';
              const isWeakness = sig.themeCategory === 'WEAKNESS';

              return (
                <div
                  key={sig.fingerprintId}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                    isWeakness
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'
                      : isStrength
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg text-xs font-black ${
                          isWeakness ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' :
                          isStrength ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' :
                          'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {sig.theme === 'RESPONSE_SPEED' ? <Zap size={14} /> :
                           sig.theme === 'CLEANLINESS' ? <Sparkles size={14} /> :
                           sig.theme === 'QUALITY' ? <Star size={14} /> :
                           sig.theme === 'PUNCTUALITY' ? <Clock size={14} /> :
                           sig.theme === 'COMMUNICATION' ? <MessageSquare size={14} /> :
                           sig.theme === 'RELIABILITY' ? <ShieldCheck size={14} /> :
                           <Award size={14} />}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {themeName}
                        </h4>
                      </div>

                      {/* Epistemic Level Pill */}
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        sig.epistemicLevel === 'DERIVED_PATTERN'
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                          : sig.epistemicLevel === 'OBSERVED_THEME'
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {sig.epistemicLevel === 'DERIVED_PATTERN' ? t('Patrón Derivado', 'Derived Pattern')
                          : sig.epistemicLevel === 'OBSERVED_THEME' ? t('Tema Observado', 'Observed Theme')
                          : t('Sin Datos', 'No Data')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {language === 'es' ? sig.summaryEs : sig.summaryEn}
                    </p>

                    {/* Trend & Sample Size */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1 font-bold">
                        {sig.trend === 'IMPROVING' ? <TrendingUp size={12} className="text-emerald-500" /> :
                         sig.trend === 'DECLINING' ? <TrendingDown size={12} className="text-rose-500" /> :
                         <Minus size={12} className="text-slate-400" />}
                        <span>
                          {sig.trend === 'IMPROVING' ? t('Tendencia al alza', 'Improving trend') :
                           sig.trend === 'DECLINING' ? t('Tendencia a la baja', 'Declining trend') :
                           sig.trend === 'STABLE' ? t('Tendencia estable', 'Stable trend') :
                           t('Muestra insuficiente', 'Insufficient baseline')}
                        </span>
                      </span>
                      <span>•</span>
                      <span>{sig.observationCount} {t("menciones registradas", "logged mentions")}</span>
                    </div>

                    {/* Supporting snippet if any */}
                    {sig.evidenceReferences && sig.evidenceReferences.length > 0 && sig.evidenceReferences[0].snippet && (
                      <div className="text-[11px] italic bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300">
                        "{sig.evidenceReferences[0].snippet}"
                      </div>
                    )}
                  </div>

                  {/* Suggested Action CTA */}
                  {sig.suggestedActionEs && (
                    <div className="pt-2 border-t border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                        {language === 'es' ? sig.suggestedActionEs : sig.suggestedActionEn}
                      </span>
                      <button
                        onClick={() => setActiveTab(sig.actionTab || 'leads')}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-black rounded-lg transition cursor-pointer shrink-0 shadow-sm"
                      >
                        {t("Actuar", "Take Action")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Local Authority Radar & Leaflet Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl overflow-hidden relative group flex flex-col justify-between">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="mb-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                    <Zap className="text-indigo-400" size={20} />
                    {t("Radar de Autoridad Local & Mapa CartoDB", "Local Authority Radar & CartoDB Map")}
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {t(`Negocios detectados en OpenStreetMap • Radio: ${radarRadius}km alrededor de tu ubicación`, `OSM-sourced businesses • Radius: ${radarRadius}km around your business`)}
                    </p>
                    {marketReference && marketReference.observableSignal !== null && (
                      <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800 cursor-pointer hover:bg-indigo-100" onClick={() => onOpenCalculationModal?.(marketReference)}>
                        {t("Base Local:", "Local Base:")} {marketReference.observableSignal} {t("Establecimientos (Estimación)", "Establishments (Estimate)")}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1">
                    <button
                      onClick={() => setMapMode('leaflet')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${mapMode === 'leaflet' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <MapIcon size={12} />
                      <span>Leaflet CartoDB</span>
                    </button>
                    <button
                      onClick={() => setMapMode('radar')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${mapMode === 'radar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <Target size={12} />
                      <span>Polar Radar</span>
                    </button>
                  </div>

                  <button
                    onClick={handleRadarRescan}
                    disabled={isRadarScanning || quota.isCooldown || quota.scansLeft <= 0}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-900 dark:text-white font-black text-xs rounded-xl flex items-center gap-2 transition cursor-pointer border border-slate-200 dark:border-slate-700/50 shadow-sm"
                  >
                    <RefreshCw size={12} className={isRadarScanning || quota.isCooldown ? "animate-spin text-indigo-400" : ""} />
                    {isRadarScanning
                      ? t("Escaneando...", "Scanning...")
                      : quota.isCooldown
                        ? t("Enfriando...", "Cooling down...")
                        : quota.scansLeft > 0
                          ? (language === 'en' ? `Rescan (${quota.scansLeft} left today)` : `Re-escanear (${quota.scansLeft} hoy)`)
                          : t("Límite alcanzado", "Limit reached")}
                  </button>
                </div>
              </div>

              {/* Search Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">{t("Palabra Clave", "Search Keyword")}</label>
                    <button
                      onClick={() => {
                        const cat = profile?.category || 'Servicios Locales';
                        let keyword = cat;
                        if (cat === 'jardineria') keyword = t('Cuidado de Césped', 'Lawn Care & Landscaping');
                        else if (cat === 'limpieza') keyword = t('Limpieza de Casas', 'House Cleaning');
                        else if (cat === 'plomeria') keyword = t('Servicios de Plomería', 'Plumbing Services');
                        else if (cat === 'aire_acondicionado' || cat === 'HVAC') keyword = t('Instalación de Aire Acondicionado', 'HVAC & AC Services');
                        else if (cat === 'construccion') keyword = t('Reformas y Construcción', 'Remodeling & Construction');
                        else keyword = profile?.category || t('Servicios Locales', 'Local Services');
                        setRadarKeyword(keyword);
                        setRadarRescanTrigger(prev => prev + 1);
                      }}
                      className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={10} />
                      {t("Usar mi nicho", "Use my niche")}
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={radarKeyword}
                    onChange={(e) => setRadarKeyword(e.target.value)}
                    placeholder={t("Ej. Plomero", "Ex. Plumber")}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">{t("Radio de Escaneo", "Scan Radius")}</label>
                    <span className="text-[10px] font-black text-indigo-400">{radarRadius} km</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="15" 
                    value={radarRadius}
                    onChange={(e) => setRadarRadius(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            {hasNoCompetitorsInRadius && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-300 text-xs my-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                  <span className="font-semibold">
                    {t(
                      "No se detectaron competidores registrados en este radio exacto en OpenStreetMap.",
                      "No registered competitors detected in this exact radius on OpenStreetMap."
                    )}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const nextRadius = Math.min(radarRadius + 5, 25);
                    setRadarRadius(nextRadius);
                    setRadarRescanTrigger(prev => prev + 1);
                    handleRadarRescan();
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer whitespace-nowrap shadow-md active:scale-95"
                >
                  {t("Ampliar Radio a " + Math.min(radarRadius + 5, 25) + " km", "Expand Radius to " + Math.min(radarRadius + 5, 25) + " km")}
                </button>
              </div>
            )}

            {/* Interactive Map Canvas directly visible */}
            <div className="relative flex-1 min-h-[380px] h-[380px] my-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#0b0f19]">
                {mapMode === 'leaflet' ? (
                  <AuditLeafletMap
                    center={mapCoords ? { lat: mapCoords.lat, lng: mapCoords.lon } : { lat: 25.7617, lng: -80.1918 }}
                    radiusKm={radarRadius}
                    userBusinessName={profile?.name || (language === 'es' ? 'Tu Negocio' : 'Your Business')}
                    competitors={enrichedCompetitors}
                    selectedCompetitorIndex={selectedBlipIndex}
                    onSelectCompetitor={(idx) => {
                      setSelectedBlipIndex(idx);
                      playCoinSound();
                    }}
                    isScanning={isRadarScanning}
                    language={language === 'en' ? 'en' : 'es'}
                  />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {mapCoords ? (
                      <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden opacity-90 dark:opacity-60 pointer-events-none transition-all duration-1000 border border-slate-200 dark:border-slate-800 shadow-inner relative bg-[#F2EFE9] dark:bg-[#1c2230]">
                        <iframe
                          title="Radar Map Background"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          marginHeight={0}
                          marginWidth={0}
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lon - (0.04 * radarRadius/5)},${mapCoords.lat - (0.03 * radarRadius/5)},${mapCoords.lon + (0.04 * radarRadius/5)},${mapCoords.lat + (0.03 * radarRadius/5)}&layer=mapnik`}
                          className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%] border-0 saturate-[1.3] brightness-105 contrast-[1.05] dark:saturate-[.6] pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 w-full h-full rounded-2xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"></div>
                    )}

                    <div className="absolute inset-0 m-auto w-12 h-12 flex items-center justify-center bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.5)] border-2 border-white/30 z-20">
                      <Star size={22} fill="currentColor" className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    </div>

                    {radarBlips.map((blip, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isRadarScanning ? [1, 0, 1] : 1 }}
                        transition={{ delay: i * 0.1, duration: isRadarScanning ? 0.5 : 0.3 }}
                        onClick={() => {
                          if (!isRadarScanning) {
                            setSelectedBlipIndex(selectedBlipIndex === i ? null : i);
                            playCoinSound();
                          }
                        }}
                        className="absolute inset-0 m-auto w-6 h-6 z-40 flex flex-col items-center justify-center cursor-pointer group/blip"
                        style={{
                          transform: `rotate(${blip.angle}deg) translateY(-${blip.dist * 135}px) rotate(-${blip.angle}deg)`
                        }}
                      >
                        <div className={`w-6 h-6 rounded-full shadow-lg transition-all flex items-center justify-center relative bg-indigo-600 shadow-indigo-600/50 ${selectedBlipIndex === i ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}>
                          <div className="absolute inset-0 rounded-full animate-ping opacity-75 bg-inherit border border-white/50" />
                          <span className="text-[10px]">📍</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

            {/* Always visible competitor list results when no blip is selected */}
            {selectedBlipIndex === null && realCompetitors && realCompetitors.length > 0 && (
              <div className="space-y-2.5 my-3 text-xs">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t(`Competidores Detectados en OpenStreetMap (${realCompetitors.length})`, `Detected Competitors on OpenStreetMap (${realCompetitors.length})`)}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
                    {t("Toca un competidor para ver ficha", "Tap a competitor for details")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {realCompetitors.slice(0, 6).map((comp: any, idx: number) => {
                    const compName = comp.name || (comp.nameEs ? t(comp.nameEs, comp.nameEn) : 'Competidor Local');
                    return (
                      <div
                        key={comp.id || idx}
                        onClick={() => {
                          setSelectedBlipIndex(idx);
                          playCoinSound();
                        }}
                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-xs transition cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{compName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {comp.distanceKm !== undefined ? `${comp.distanceKm} km • ` : ''}{comp.category || profile?.category || t("Servicios", "Services")}
                          </p>
                        </div>
                        <span className="text-[11px] font-black text-indigo-500 shrink-0">
                          {comp.rating ? `★ ${comp.rating}` : 'Sin dato de reseñas'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected Business Detailed Card (Honest Business Profile & Data Transparency) */}
            {selectedBlipIndex !== null && (realCompetitors[selectedBlipIndex] || radarBlips[selectedBlipIndex]) && (() => {
              const comp = realCompetitors[selectedBlipIndex] || radarBlips[selectedBlipIndex];
              const compName = comp.name || (comp.nameEs ? t(comp.nameEs, comp.nameEn) : 'Local Business');
              const gmapsSearchUrl = (() => {
                if (comp.placeId) {
                  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compName)}&query_place_id=${encodeURIComponent(comp.placeId)}`;
                }
                if (typeof comp.lat === 'number' && typeof comp.lng === 'number' && !isNaN(comp.lat) && !isNaN(comp.lng)) {
                  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compName)}&query=${comp.lat},${comp.lng}`;
                }
                if (comp.address || comp.vicinity) {
                  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compName + ' ' + (comp.address || comp.vicinity))}`;
                }
                return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compName + ' ' + (profile?.location || ''))}`;
              })();

              return (
                <div className="bg-white dark:bg-slate-950 border border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-2xl relative animate-fade-in text-xs">
                  <button 
                    onClick={() => setSelectedBlipIndex(null)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl"
                  >
                    <X size={14} />
                  </button>

                  <div className="flex items-start justify-between pr-8">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {comp.evidenceStatus || 'DERIVED'} • {comp.source || 'OpenStreetMap'}
                        </span>
                        {comp.opportunityScore && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Opportunity Score: {comp.opportunityScore}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">
                        {compName}
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("Categoría / Nicho", "Category / Niche")}</p>
                      <p className="font-extrabold text-slate-800 dark:text-slate-200">{comp.category || profile?.category || t("Servicios Locales", "Local Services")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("Distancia respecto a ti", "Distance from you")}</p>
                      <p className="font-extrabold text-indigo-600 dark:text-indigo-400">{comp.distanceKm !== undefined ? `${comp.distanceKm} km` : t("No disponible", "Not available")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("Dirección oficial", "Official Address")}</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{comp.address || comp.vicinity || profile?.location || t("No disponible (Consultar Mapa)", "Not available (Check Map)")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("Teléfono de Contacto", "Contact Phone")}</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{comp.phone || t("No disponible", "Not available")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("Sitio Web", "Website")}</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{comp.website ? <a href={comp.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">{comp.website}</a> : t("No disponible", "Not available")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("Coordenadas GPS", "GPS Coordinates")}</p>
                      <p className="font-mono text-[10px] text-slate-500">{comp.lat && comp.lng ? `${comp.lat.toFixed(4)}, ${comp.lng.toFixed(4)}` : t("No disponible", "Not available")}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("Calificación y Reseñas (Fuente: OSM / Estimado)", "Rating & Reviews (Source: OSM / Estimated)")}</p>
                      <p className="font-extrabold text-amber-500">
                        {comp.rating && comp.reviewsCount !== null && comp.reviewsCount !== undefined 
                          ? `★ ${comp.rating} (${comp.reviewsCount} ${t("reseñas", "reviews")})` 
                          : "Sin dato de reseñas"}
                      </p>
                    </div>
                  </div>

                  {/* Ghost Competitor — Longitudinal Memory & Movement Insights */}
                  {(() => {
                    const signal = movementSummary?.latestMovementSignals.find(
                      s => s.competitorName.toLowerCase() === compName.toLowerCase()
                    );

                    if (signal) {
                      return (
                        <div className="p-3 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase tracking-wider">
                              <Zap size={13} />
                              <span>{t("Movimiento Longitudinal Verificado (BEM)", "Verified Longitudinal Movement (BEM)")}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded font-black text-[9px]">
                              {signal.deltaFormatted} • {signal.periodDays}d
                            </span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-200 text-xs font-medium leading-relaxed">
                            {language === 'es' ? signal.whyItMattersEs : signal.whyItMattersEn}
                          </p>
                          <div className="pt-1 flex items-center justify-between border-t border-amber-500/20 text-[10px]">
                            <span className="text-slate-500 dark:text-slate-400">
                              {t("Acción sugerida:", "Suggested action:")} <strong className="text-slate-800 dark:text-slate-100">{language === 'es' ? signal.nextActionEs : signal.nextActionEn}</strong>
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span>{t("Monitoreo Longitudinal BEM: Referencia Base Registrada", "BEM Longitudinal Tracking: Baseline Registered")}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">Sin fluctuaciones en este ciclo</span>
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        const parsedLoc = parseLocationString(
                          comp.address || comp.vicinity || profile?.location || profile?.city || '',
                          profile?.state || null,
                          profile?.country || null
                        );
                        const compContext = {
                          name: compName,
                          city: parsedLoc.city || profile?.city || '',
                          state: parsedLoc.state || profile?.state || '',
                          country: parsedLoc.country || profile?.country || 'US',
                          category: comp.category || profile?.category || '',
                          sourceType: 'OSM_RADAR',
                          sourceLabel: 'Radar de Competencia / Mapa',
                          timestamp: Date.now(),
                        };
                        localStorage.setItem('bvelt_pending_competitor_audit', JSON.stringify(compContext));
                        setActiveTab('business_scan');
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-md shadow-indigo-600/20"
                    >
                      <span>{t("Auditar Brecha", "Audit Gap")}</span>
                      <ArrowRight size={12} />
                    </button>

                    <button
                      onClick={() => {
                        let targetLeadId = comp.id;
                        if (onAddLead) {
                          const createdOrExisting = onAddLead(comp);
                          if (createdOrExisting && createdOrExisting.id) {
                            targetLeadId = createdOrExisting.id;
                          }
                        }
                        if (targetLeadId) {
                          navigateTo({ tab: 'leads', tool: 'crm_inbox', leadId: String(targetLeadId) });
                        } else {
                          navigateTo({ tab: 'leads', tool: 'crm_inbox' });
                        }
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"
                    >
                      <span>{t("View Business Details", "View Business Details")}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (onAddLead) {
                          onAddLead(comp);
                        }
                      }}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer text-xs"
                    >
                      <span>{t("Add to Leads", "Add to Leads")}</span>
                    </button>

                    <a
                      href={gmapsSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-1.5 text-xs shadow-md"
                    >
                      <span>{t("Open in Google Maps", "Open in Google Maps")}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Battle Card / Opportunity Loss */}
        {isVerifiedRank1 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-855 text-slate-900 dark:text-white rounded-[3rem] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-500">
                  <Award size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-emerald-500">{t("MÁXIMA VISIBILIDAD LOCAL 🏆", "PEAK LOCAL VISIBILITY 🏆")}</p>
                  <h4 className="text-2xl font-black tracking-tight leading-tight">{t("¡Excelente posicionamiento en tu zona local!", "Excellent positioning in your local market!")}</h4>
                </div>
              </div>

              <div className="bg-emerald-500/10 dark:bg-emerald-500/5 rounded-[2rem] p-6 border border-emerald-500/20 space-y-2">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tight text-emerald-500">$0</span>
                  <span className="text-[10px] font-bold uppercase text-emerald-500/80 pb-2">{t("BRECHA DE OPORTUNIDAD", "OPPORTUNITY GAP")}</span>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  {nicheDefined 
                    ? t("¡Excelente! Tus acciones locales de optimización han minimizado las brechas de visibilidad.", "Excellent! Your local optimization actions have minimized visibility gaps.")
                    : t("Define un nicho de negocio para iniciar el monitoreo de visibilidad.", "Define a business niche to start visibility monitoring.")}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                  {t("*Estimación direccional basada en ticket promedio y volumen local. No constituye garantía de ingresos contables.", "*Directional estimate based on average ticket size and local search volume. Does not constitute guaranteed accounting revenue.")}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setActiveTab('tools')}
              className="relative z-10 mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.02] transition active:scale-[0.98] py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 cursor-pointer border-0"
            >
              {t("Ver Simulador de Crecimiento", "View Growth Simulator")}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : !gmbConnected ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 text-slate-900 dark:text-white rounded-[3rem] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/10 p-3 rounded-2xl text-indigo-500">
                  <Globe size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-indigo-500">{t("SEÑAL DE OPORTUNIDAD LOCAL ⚠️", "LOCAL OPPORTUNITY SIGNAL ⚠️")}</p>
                  <h4 className="text-2xl font-black tracking-tight leading-tight">{t("Auditoría de Posicionamiento Pendiente", "Positioning Audit Pending")}</h4>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/45 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                    {t("AUDITORÍA DE POSICIONAMIENTO", "POSITIONING AUDIT")}
                  </span>
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
                    ○ {t("PENDIENTE DE CONEXIÓN", "CONNECTION PENDING")}
                  </span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tight text-rose-500 dark:text-rose-400">
                    {t("N/D", "N/A")}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 pb-2">
                    {t("BRECHA DE OPORTUNIDAD", "OPPORTUNITY GAP")}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed text-left">
                  {t(
                    `Ejecuta un Escaneo de Crecimiento o conecta Google Business Profile para dimensionar tu brecha de visibilidad en ${profile?.location || 'tu ciudad'}.`, 
                    `Run a Growth Scan or connect Google Business Profile to dimension your visibility gap in ${profile?.location || 'your city'}.`
                  )}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                  {t("*Estimación direccional basada en ticket promedio y volumen local. No constituye garantía de ingresos contables.", "*Directional estimate based on average ticket size and local search volume. Does not constitute guaranteed accounting revenue.")}
                </p>
              </div>
            </div>

            <button 
              onClick={handleConnectGmbClick}
              className="relative z-10 mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] transition active:scale-[0.98] py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 cursor-pointer border-0"
            >
              {t("Conectar Google Business Profile", "Connect Google Business Profile")}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 text-slate-900 dark:text-white rounded-[3rem] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-rose-500/10 p-3 rounded-2xl text-rose-500">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-rose-500">{t("BRECHA DE VISIBILIDAD", "VISIBILITY GAP")}</p>
                  <h4 className="text-2xl font-black tracking-tight leading-tight">{t("Señales de Oportunidad Detectadas", "Opportunity Signals Detected")}</h4>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/45 rounded-[2rem] p-6 border border-dashed border-purple-400/40 dark:border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                    {t("BRECHA DE VISIBILIDAD / MES", "VISIBILITY GAP / MONTH")}
                  </span>
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    ◈ {realCompetitors.length > 0 ? t("PROYECCIÓN MODELADA", "MODELED PROJECTION") : t("SIN DATOS EN RADIO", "NO DATA IN RADIUS")}
                  </span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tight text-indigo-500 dark:text-indigo-400">
                    {realCompetitors.length > 0 ? `$${Math.round(Ps || marketForNiche?.estimatedLostRevenue || 1200).toLocaleString()}+` : "$0"}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed text-left">
                  {realCompetitors.length > 0 ? (
                    <>
                      {t("Competidores locales visibles en el mapa: ", "Visible local competitors on map: ")} 
                      <span className="font-extrabold text-slate-950 dark:text-white">{realCompetitors.length} {t("negocios detectados en", "businesses detected in")} {profile.location || t("tu zona", "your area")}</span>.
                    </>
                  ) : (
                    <span className="text-amber-500 font-semibold">
                      {t("No se detectaron competidores en este radio. Amplía el radio de búsqueda o reintenta en otra zona para obtener métricas comparativas.", "No competitors detected in this radius. Expand the search radius or retry in another area to obtain comparative metrics.")}
                    </span>
                  )}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                  {t("*Estimación direccional basada en ticket promedio y volumen local. No constituye garantía de ingresos contables.", "*Directional estimate based on average ticket size and local search volume. Does not constitute guaranteed accounting revenue.")}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setActiveTab('tools')}
              className="relative z-10 mt-6 w-full bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 hover:scale-[1.02] transition active:scale-[0.98] py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {t("Ejecutar Simulador de Crecimiento", "Run Growth Simulator")}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
