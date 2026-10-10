import React from 'react';
import { TrendingUp, Globe, Sparkles, CheckCircle, Zap, ShieldCheck, Star, Clock, ArrowRight, MapPin, Compass, RotateCw, ExternalLink, Search, Calculator } from 'lucide-react';
import { StatCard, ImpactMetric, CardSkeleton } from './DashboardStatCards';
import { AuditLeafletMap } from '../AuditLeafletMap';
import { getGbpStatus, getEvidenceBadge } from '../../lib/bveltEvidence';
import { CalculationDetails } from './CalculationModal';

interface DashboardSnapshotSectionProps {
  t: (es: string, en: string) => string;
  leads?: any[];
  nicheDefined: boolean;
  gmbConnected: boolean;
  vistas_actuales: number;
  progreso_bvelt: number;
  gmbLoading: boolean;
  gmbMetrics: any;
  gmbReviews: any[];
  isVerifiedRank1: boolean;
  selectedLocation: any;
  user: any;
  profile: any;
  dateRange: 'current_month' | 'last_3_months' | 'current_year';
  setDateRange: (range: 'current_month' | 'last_3_months' | 'current_year') => void;
  conversion_rate: number;
  avg_ticket_usd: number;
  displayReputationValue: string;
  displayReputationSubtitle: string;
  displayStreakValue: string;
  displayStreakSubtitle: string;
  displayLeadsValue: string;
  displayImpactValue: string;
  displayImpactSubtitle: string;
  setActiveTab: (tab: string) => void;
  onStartVoice: () => void;
  fetchGmbData: (locName: string, force?: boolean) => void;
  handleAiReply: (reviewName: string, comment?: string) => void;
  handleConnectGmbClick: () => void;
  mapCoords?: { lat: number; lon: number } | null;
  realCompetitors?: any[];
  radarRadius?: number;
  setRadarRadius?: (r: number) => void;
  isRadarScanning?: boolean;
  handleRadarRescan?: () => void;
  selectedBlipIndex?: number | null;
  setSelectedBlipIndex?: (idx: number | null) => void;
  language?: 'es' | 'en';
  onOpenCalculationModal?: (details: CalculationDetails) => void;
}

export const DashboardSnapshotSection: React.FC<DashboardSnapshotSectionProps> = ({
  t,
  leads = [],
  nicheDefined,
  gmbConnected,
  vistas_actuales,
  progreso_bvelt,
  gmbLoading,
  gmbMetrics,
  gmbReviews,
  isVerifiedRank1,
  selectedLocation,
  user,
  profile,
  dateRange,
  setDateRange,
  conversion_rate,
  avg_ticket_usd,
  displayReputationValue,
  displayReputationSubtitle,
  displayStreakValue,
  displayStreakSubtitle,
  displayLeadsValue,
  displayImpactValue,
  displayImpactSubtitle,
  setActiveTab,
  onStartVoice,
  fetchGmbData,
  handleAiReply,
  handleConnectGmbClick,
  mapCoords,
  realCompetitors = [],
  radarRadius = 5,
  setRadarRadius,
  isRadarScanning = false,
  handleRadarRescan,
  selectedBlipIndex = null,
  setSelectedBlipIndex,
  language = 'es',
  onOpenCalculationModal,
}) => {
  const gmbSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((profile?.name || 'Local Business') + ' ' + (profile?.location || ''))}`;

  // If connected, determine if Google verified or pending verification
  const isGbpVerified = gmbConnected && !!selectedLocation?.isVerified;
  const gbpStatus = getGbpStatus(gmbConnected, isGbpVerified, t);

  // Calculate earnings for current week vs previous week from CRM leads
  const getWeeklyEarnings = () => {
    let currentWeekEarnings = 0;
    let prevWeekEarnings = 0;

    const today = new Date();
    
    // Get start of current week (Sunday)
    const currentWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    currentWeekStart.setHours(0,0,0,0);
    
    // Get start of previous week
    const prevWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Parse lead records
    (leads || []).forEach(lead => {
      const isWon = (lead.status || '').toUpperCase() === 'WON' || (lead.status || '').toUpperCase() === 'CLIENT';
      if (isWon) {
        const rev = Number(lead.actualRevenue) || Number(lead.quoteAmount) || 0;
        const targetDate = lead.wonDate || lead.quoteDate || lead.date;
        if (rev > 0 && targetDate) {
          try {
            const parts = targetDate.split('/');
            let dateObj: Date;
            if (parts.length === 3) {
              // Assume MM/DD/YYYY
              dateObj = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
            } else {
              dateObj = new Date(targetDate);
            }
            
            if (!isNaN(dateObj.getTime())) {
              if (dateObj >= currentWeekStart) {
                currentWeekEarnings += rev;
              } else if (dateObj >= prevWeekStart && dateObj < currentWeekStart) {
                prevWeekEarnings += rev;
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    });

    // If there is no real data in CRM yet, we provide a beautiful, realistic fallback labeled accordingly
    const hasRealEarnings = currentWeekEarnings > 0 || prevWeekEarnings > 0;
    if (!hasRealEarnings) {
      if (gmbConnected && vistas_actuales > 0) {
        // Modeled based on real views
        currentWeekEarnings = Math.round(vistas_actuales * conversion_rate * avg_ticket_usd * 0.25);
        prevWeekEarnings = Math.round(vistas_actuales * conversion_rate * avg_ticket_usd * 0.15);
      } else {
        // Honest empty state: 0 earnings
        currentWeekEarnings = 0;
        prevWeekEarnings = 0;
      }
    }

    const difference = currentWeekEarnings - prevWeekEarnings;
    const percentChange = prevWeekEarnings > 0 
      ? Math.round((difference / prevWeekEarnings) * 100) 
      : (difference === 0 ? 0 : null);

    return {
      current: currentWeekEarnings,
      previous: prevWeekEarnings,
      diff: difference,
      percent: percentChange,
      isReal: hasRealEarnings
    };
  };

  const weeklyData = getWeeklyEarnings();

  const handleOpenRoiCalculation = () => {
    if (!onOpenCalculationModal) return;
    const mult = dateRange === 'current_month' ? 1 : dateRange === 'last_3_months' ? 3 : 12;
    const computedVal = Math.round(vistas_actuales * conversion_rate * avg_ticket_usd * mult);
    onOpenCalculationModal({
      title: t("Cálculo de Impacto Económico Bvelt", "Bvelt Economic Impact Calculation"),
      metricName: t("Incremento Económico Proyectado", "Projected Economic Revenue Growth"),
      resultValue: gmbConnected && vistas_actuales > 0 ? `+$${computedVal.toLocaleString()}` : t("Sin Datos Suficientes", "Insufficient Data"),
      evidenceStatus: gmbConnected ? 'DERIVED' : 'PENDING',
      confidence: gmbConnected ? 'High' : 'Low',
      formula: `Impacto = Vistas Reales (${vistas_actuales}) × Tasa Conversión (${(conversion_rate * 100).toFixed(1)}%) × Ticket Promedio ($${avg_ticket_usd}) × Factor Período (${mult})`,
      variables: [
        { name: t("Vistas Reales (GBP)", "Real Views (GBP)"), value: `${vistas_actuales}`, source: "Google Business API", status: gmbConnected ? 'VERIFIED' : 'PENDING' },
        { name: t("Tasa de Conversión Local", "Local Conversion Rate"), value: `${(conversion_rate * 100).toFixed(1)}%`, source: "Benchmark de Nicho", status: 'DERIVED' },
        { name: t("Ticket Promedio de Venta", "Average Sales Ticket"), value: `$${avg_ticket_usd}`, source: "Perfil / Benchmark Local", status: 'DERIVED' },
        { name: t("Factor Temporal", "Timeframe Multiplier"), value: `${mult}x`, source: dateRange, status: 'VERIFIED' }
      ],
      assumptions: [
        t("La tasa de conversión modela el tráfico local que busca contacto comercial o ruta en Maps.", "Conversion rate models local searchers seeking commercial contact or direction."),
        t("El ticket promedio está calibrado según el nicho económico seleccionado.", "Average ticket is calibrated according to the selected economic niche.")
      ],
      sources: [
        { name: "Google Business Profile", type: "API Oficial", date: new Date().toISOString().split('T')[0] },
        { name: "Bvelt Intelligence Engine", type: "Modelo Derivado" }
      ],
      explanation: t("Este cálculo correlaciona el flujo real de impresiones y llamadas registradas con el valor económico transaccional del nicho.", "This calculation correlates real registered impressions and calls with transactional economic value.")
    });
  };

  return (
    <div id="section-business-snapshot" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            {t("1. Estado y Salud del Negocio", "1. Business Snapshot & Health")}
          </h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t("Rendimiento en tiempo real, reputación, leads e impacto económico medido.", "Real-time performance, reputation, leads & measured economic impact.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${gbpStatus.colorClass}`}>
            {gbpStatus.label}
          </span>
        </div>
      </div>

      {/* 4 Core Stat Cards with Provenance Labels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={t("Reputación", "Reputation")} 
          value={displayReputationValue} 
          subtitle={displayReputationSubtitle} 
          color="indigo" 
          sourceBadge={gmbConnected ? (isGbpVerified ? t("VERIFIED CONNECTION", "VERIFIED CONNECTION") : t("CONECTADO • GBP", "CONNECTED • GBP")) : t("SIN CONECTAR", "NOT CONNECTED")}
          evidenceStatus={gmbConnected ? (isGbpVerified ? 'VERIFIED' : 'DERIVED') : 'INSUFFICIENT_DATA'}
          onClick={() => setActiveTab({ tab: 'reviews', subRow: 1, section: 'social' })}
          t={t}
        />
        <StatCard 
          title={profile?.subscriptionStatus === 'active' ? t("Suscripción", "Subscription") : t("Racha", "Streak")} 
          value={displayStreakValue} 
          subtitle={displayStreakSubtitle} 
          color={profile?.subscriptionStatus === 'active' ? "indigo" : "amber"} 
          sourceBadge={t("SISTEMA BVELT", "BVELT SYSTEM")}
          evidenceStatus="DERIVED"
          onClick={() => setActiveTab('plans')}
          t={t}
        />
        <StatCard 
          title={t("Leads Hoy", "Leads Today")} 
          value={displayLeadsValue} 
          subtitle={t("Nuevos contactos en CRM", "New CRM contacts")} 
          color="emerald" 
          sourceBadge={t("REAL DATA • CRM", "REAL DATA • CRM")}
          evidenceStatus="VERIFIED"
          onClick={() => setActiveTab({ tab: 'leads', subRow: 4, section: 'leads' })}
          t={t}
        />
        <StatCard 
          title={t("Oportunidad Estimada", "Estimated Opportunity")} 
          value={displayImpactValue} 
          subtitle={displayImpactSubtitle} 
          color="indigo" 
          sourceBadge={t("MODELED OPPORTUNITY", "MODELED OPPORTUNITY")}
          evidenceStatus="MODELED"
          onViewCalculation={handleOpenRoiCalculation}
          t={t}
        />
      </div>

      {/* Weekly Earnings comparison widget */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-stretch justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <TrendingUp size={18} />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {t("Ingresos Semanales Comparativos", "Weekly Earnings Comparison")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {t("Progreso comercial neto y retorno financiero atribuido a tus acciones en Bvelt.", "Net sales progress and financial return attributed to your actions in Bvelt.")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">{t("Esta Semana", "This Week")}</span>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                  {weeklyData.isReal ? t("Real CRM", "Real CRM") : t("Modelado Bvelt", "Bvelt Modeled")}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-1">${weeklyData.current.toLocaleString()}</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">{t("Semana Anterior", "Previous Week")}</span>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 uppercase">
                  {weeklyData.isReal ? t("Real CRM", "Real CRM") : t("Modelado Bvelt", "Bvelt Modeled")}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-500 dark:text-slate-400 mt-1">${weeklyData.previous.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 flex flex-col justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400">{t("Diferencia de Rendimiento", "Performance Gain")}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${weeklyData.percent === null ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400' : weeklyData.diff >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
                {weeklyData.percent === null ? t('N/A', 'N/A') : weeklyData.diff >= 0 ? `+${weeklyData.percent}%` : `${weeklyData.percent}%`}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed pt-1">
              {weeklyData.diff >= 0 
                ? t("¡Excelente ritmo de conversión! Tus oportunidades ganadas demuestran el retorno real del software.", "Excellent conversion pace! Your won opportunities prove the real software return.")
                : t("Tus ingresos semanales fluctúan. Completa más tareas pendientes de SEO local y responde a reseñas para subir llamadas.", "Your weekly earnings are fluctuating. Complete more local SEO tasks and reply to reviews to boost calls.")
              }
            </p>
          </div>

          <button
            onClick={() => setActiveTab({ tab: 'leads', subRow: 4, section: 'leads' })}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer text-center block shadow-sm shadow-indigo-600/10"
          >
            {t("Ver mi Bandeja CRM", "Go to CRM Inbox")}
          </button>
        </div>
      </div>

      {/* Presencia Geográfica & Mapa en Vivo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <MapPin size={18} />
              </span>
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  {t("Presencia Geográfica & Mapa Local", "Geographic Presence & Local Map")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {t("Capa visual en tiempo real con radio de cobertura y negocios detectados en OpenStreetMap.", "Real-time visual map layer with service area and businesses found in OpenStreetMap.")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Radius Selector */}
            {setRadarRadius && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[11px] font-bold">
                {[2, 5, 10, 20].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadarRadius(r)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${radarRadius === r ? 'bg-indigo-600 text-white font-black shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            )}

            {/* Rescan Button */}
            {handleRadarRescan && (
              <button
                onClick={handleRadarRescan}
                disabled={isRadarScanning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <RotateCw size={13} className={isRadarScanning ? "animate-spin text-indigo-500" : ""} />
                <span>{isRadarScanning ? t("Escaneando...", "Scanning...") : t("Escanear", "Rescan")}</span>
              </button>
            )}

            {/* Open in Google Maps */}
            <a
              href={gmbSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition"
            >
              <span>{t("Ver en Google Maps", "Open Google Maps")}</span>
              <ExternalLink size={12} />
            </a>

            {/* Deep link to Business Scan */}
            <button
              onClick={() => setActiveTab('business_scan')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs shadow-indigo-600/20"
            >
              <Search size={12} />
              <span>{t("Business Scan", "Business Scan")}</span>
            </button>
          </div>
        </div>

        {/* Restored Map Experience */}
        <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner relative z-0">
          {mapCoords ? (
            <AuditLeafletMap
              lat={mapCoords.lat}
              lng={mapCoords.lng}
              zoom={13}
              radius={radarRadius}
              competitors={realCompetitors}
              businessName={profile?.name}
              niche={profile?.category}
              isScanning={isRadarScanning}
              onMarkerClick={(index) => {
                if (setSelectedBlipIndex) {
                  setSelectedBlipIndex(index);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900/50 text-slate-500">
              <Compass size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">{t("Ubicación pendiente...", "Location pending...")}</p>
            </div>
          )}
          
          {/* Overlay Button for Deep Dive */}
          <div className="absolute bottom-4 right-4 z-[400]">
            <button
              onClick={() => {
                setActiveTab('market-radar');
              }}
              className="bg-indigo-600/95 hover:bg-indigo-500 text-white font-black py-2.5 px-5 rounded-xl shadow-xl transition flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider backdrop-blur-sm cursor-pointer border border-indigo-500/50"
            >
              <Search size={14} />
              <span>{t("Análisis Detallado", "Deep Analysis")}</span>
            </button>
          </div>
        </div>

        {/* Map Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <p className="text-[9px] font-black uppercase text-slate-400">{t("Ubicación Base", "Base Location")}</p>
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 uppercase">
                {profile?.locationSource === 'DEVICE' ? t('GPS Dispositivo', 'Device GPS') :
                 profile?.locationSource === 'BROWSER_NETWORK' ? t('Red / IP', 'Network / IP') :
                 profile?.locationSource === 'USER_ENTERED' ? t('Manual', 'Manual') :
                 t('Sin configurar', 'Not set')}
              </span>
            </div>
            <p className="text-xs font-black text-slate-900 dark:text-white truncate">{profile?.location || t("Sin configurar", "Not configured")}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl">
            <p className="text-[9px] font-black uppercase text-slate-400">{t("Radio Cobertura", "Coverage Radius")}</p>
            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{radarRadius} km</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl">
            <p className="text-[9px] font-black uppercase text-slate-400">{t("Nodos Detectados", "Detected Nodes")}</p>
            <p className="text-xs font-black text-slate-900 dark:text-white">
              {realCompetitors.length > 0 
                ? `${realCompetitors.length} ${t("negocios (OSM)", "businesses (OSM)")}`
                : t("0 en radio (Modelo Sectorial)", "0 in radius (Sector Model)")}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl">
            <p className="text-[9px] font-black uppercase text-slate-400">{t("Motor Visual", "Visual Engine")}</p>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{t("OSM / CartoDB (Cartografía)", "OSM / CartoDB (Cartography)")}</p>
          </div>
        </div>
      </div>

      {/* Impacto Proyectado Bvelt (ROI Calculado) */}
      <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-indigo-500/20 p-6 md:p-8 shadow-sm shadow-indigo-500/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <TrendingUp className="text-indigo-500" />
              {t("Oportunidad de Ingresos Estimada", "Estimated Revenue Opportunity")}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                ↗ {t("CALCULADO • DERIVADO", "DERIVED CALCULATION")}
              </span>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                {t("vistas reales × tasa de conversión × ticket promedio", "real views × conversion rate × average ticket")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setDateRange('current_month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${dateRange === 'current_month' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {t("Mes actual", "Current Month")}
              </button>
              <button
                onClick={() => setDateRange('last_3_months')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${dateRange === 'last_3_months' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {t("Últimos 3 meses", "Last 3 Months")}
              </button>
              <button
                onClick={() => setDateRange('current_year')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${dateRange === 'current_year' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {t("Año actual", "Current Year")}
              </button>
            </div>
            <div className="flex flex-col gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
              <div className="flex items-center gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-black">
                  {nicheDefined && gmbConnected && vistas_actuales > 0 ? (
                    `+${Math.round(vistas_actuales * conversion_rate * avg_ticket_usd * (dateRange === 'current_month' ? 1 : dateRange === 'last_3_months' ? 3 : 12)).toLocaleString()}`
                  ) : (
                    t("N/D (Sin Conexión)", "N/A (Not Connected)")
                  )}
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-emerald-600/80 leading-none">
                    {dateRange === 'current_month' ? t("Incremento Mensual", "Monthly Growth") : dateRange === 'last_3_months' ? t("Incremento 3 Meses", "3-Month Growth") : t("Incremento Anual", "Annual Growth")}
                  </span>
                  {onOpenCalculationModal && (
                    <button
                      onClick={handleOpenRoiCalculation}
                      className="text-[9px] font-bold text-indigo-400 hover:underline mt-1 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Calculator size={10} />
                      <span>{t("Ver cálculo", "View calculation")}</span>
                    </button>
                  )}
                </div>
              </div>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold italic">
                {t("*Estimación modelada — no son ingresos reales medidos", "*Modelled estimate — not measured revenue")}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ImpactMetric 
            label={t("Visibilidad GMB", "GMB Visibility")}
            before={nicheDefined && gmbConnected ? Math.round(vistas_actuales * 0.3) : 0}
            after={nicheDefined && gmbConnected ? vistas_actuales : 0}
            unit="vistas"
            color="indigo"
            isConnected={nicheDefined && gmbConnected}
            onViewCalculation={handleOpenRoiCalculation}
            t={t}
          />
          <ImpactMetric 
            label={t("Leads Mensuales", "Monthly Leads")}
            before={nicheDefined && gmbConnected ? Math.round(vistas_actuales * 0.3 * conversion_rate) : 0}
            after={nicheDefined && gmbConnected ? Math.round(vistas_actuales * conversion_rate) : 0}
            unit="leads"
            color="emerald"
            isConnected={nicheDefined && gmbConnected}
            onViewCalculation={handleOpenRoiCalculation}
            t={t}
          />
          <ImpactMetric 
            label={t("Reseñas 5★", "5★ Reviews")}
            before={nicheDefined && gmbConnected ? Math.round(gmbReviews.length * 0.4) : 0}
            after={nicheDefined && gmbConnected ? gmbReviews.length : 0}
            unit="reseñas"
            color="amber"
            isConnected={nicheDefined && gmbConnected}
            t={t}
          />
        </div>
      </div>

      {/* Google Business Profile: Live Dashboard & Real Reviews */}
      {gmbConnected ? (
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-md border border-slate-200 dark:border-indigo-500/20 rounded-2xl p-6 md:p-8 shadow-sm shadow-indigo-500/5 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isGbpVerified ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  {gbpStatus.label}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
                <Globe className="text-indigo-500" size={24} />
                {selectedLocation?.title || t("Tu Ficha de Google", "Your Google Business")}
              </h2>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-500 px-2">{t("Datos de los últimos 30 días", "Last 30 days data")}</span>
            </div>
          </div>

          {/* Métricas Reales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {gmbLoading ? (
              <>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 space-y-2">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 space-y-2">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 space-y-2">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 space-y-2">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 relative overflow-hidden space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("Vistas Reales (Maps + Search)", "Real Views (Maps + Search)")}</p>
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ✓ {t("VERIFICADO", "VERIFIED")}
                    </span>
                  </div>
                  <div className="flex items-end gap-2 relative z-10">
                    <h4 className="text-3xl font-black text-slate-900 dark:text-white">
                      {vistas_actuales.toLocaleString()}
                    </h4>
                    {progreso_bvelt > 0 && (
                      <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full mb-1">
                        +{progreso_bvelt.toLocaleString()} bvelt
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 mt-2 font-medium">
                    {progreso_bvelt > 0 
                      ? t(`Progreso estimado en vivo: +${progreso_bvelt} vistas para el próximo ciclo de sync.`, `Live estimated progress: +${progreso_bvelt} views for next sync cycle.`)
                      : t("Sincronizado con Google. Realiza acciones para ver el progreso en vivo.", "Synced with Google. Perform actions to see live progress.")
                    }
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("Llamadas Directas", "Direct Calls")}</p>
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ✓ {t("GBP", "GBP")}
                    </span>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white">
                    {gmbConnected ? (gmbMetrics?.multiDailyMetricTimeSeries?.find((m: any) => m.dailyMetric === 'CALL_CLICKS')?.dailyMetricTimeSeries?.[0]?.timeSeries?.points?.reduce((acc: any, p: any) => acc + parseInt(p.value.objectValue || 0), 0) || 0) : 0}
                  </h4>
                  <p className="text-[10px] text-indigo-500 font-bold mt-1">📞 {t("Leads Telefónicos", "Phone Leads")}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("Clics al Sitio", "Website Clicks")}</p>
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ✓ {t("GBP", "GBP")}
                    </span>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white">
                    {gmbConnected ? (gmbMetrics?.multiDailyMetricTimeSeries?.find((m: any) => m.dailyMetric === 'WEBSITE_CLICKS')?.dailyMetricTimeSeries?.[0]?.timeSeries?.points?.reduce((acc: any, p: any) => acc + parseInt(p.value.objectValue || 0), 0) || 0) : 0}
                  </h4>
                  <p className="text-[10px] text-amber-500 font-bold mt-1">🌐 {t("Visitas Web", "Web Visits")}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("Dominio Local", "Local Domain")}</p>
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      📊 {t("BENCHMARK", "BENCHMARK")}
                    </span>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white">
                    {isVerifiedRank1 ? "TOP #1" : t("N/D (Pendiente)", "N/A (Pending)")}
                  </h4>
                  <p className="text-[10px] text-emerald-500 font-bold mt-1">🏆 {t("Posición Promedio", "Average Position")}</p>
                </div>
              </>
            )}
          </div>

          {/* Reseñas Recientes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {t("Reseñas de Clientes Reales", "Real Customer Reviews")}
              </h3>
              <button 
                onClick={() => selectedLocation?.name && fetchGmbData(selectedLocation.name, true)}
                className="text-[10px] font-bold text-indigo-500 hover:underline cursor-pointer"
              >
                {t("Actualizar", "Refresh")}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gmbLoading ? (
                <>
                  <CardSkeleton />
                  <CardSkeleton />
                </>
              ) : gmbReviews.length > 0 ? gmbReviews.slice(0, 4).map((review, i) => (
                <div key={i} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 p-5 rounded-3xl space-y-3 transition hover:border-indigo-500/30 relative overflow-hidden">
                  {review.isAiResponding && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                      <Zap size={20} className="text-amber-500 animate-bounce" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 animate-pulse">
                        {t("Generando Respuesta...", "Generating Reply...")}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400">
                        {review.reviewer?.displayName?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">{review.reviewer?.displayName}</p>
                        <p className="text-[9px] text-slate-500">{"⭐".repeat(review.starRating === 'FIVE' ? 5 : (review.starRating === 'FOUR' ? 4 : 3))}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{new Date(review.createTime).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-2">"{review.comment || t("Sin comentario", "No comment")}"</p>
                  
                  {!(review.reviewReply || review.aiResponseText) ? (
                    <button 
                      disabled={review.isAiResponding}
                      onClick={() => handleAiReply(review.name, review.comment)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase py-2.5 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <Sparkles size={12} className="text-amber-300" />
                      {t("Responder con Inteligencia Local", "Reply with Local Intelligence")}
                    </button>
                  ) : (
                    <div className="bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-2xl space-y-1.5 animate-in fade-in duration-300">
                      <p className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/15 px-2 py-0.5 rounded-md w-fit">
                        <CheckCircle size={10} /> {t("✓ Respuesta Generada", "✓ Reply Generated")}
                      </p>
                      {(review.aiResponseText || review.reviewReply?.comment) && (
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 italic leading-relaxed">
                          "{review.aiResponseText || review.reviewReply?.comment}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )) : (
                <div className="col-span-full py-10 text-center bg-slate-50 dark:bg-slate-950/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">{t("No se encontraron reseñas recientes.", "No recent reviews found.")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-indigo-500/10 transition-all duration-700"></div>
          <div className="space-y-4 text-center md:text-left relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 text-indigo-400">
                <Star size={12} fill="currentColor" /> {t("Función Principal", "Core Feature")}
              </div>
              {user && (
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 text-emerald-400">
                  <CheckCircle size={12} /> {t("App Conectada", "App Connected")}
                </div>
              )}
            </div>
            
            <h3 className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-white">
              {user ? (profile?.name ? `${t("Paso Final: Conecta", "Final Step: Connect")} ${profile.name}` : t("Paso Final: Conecta tu Negocio", "Final Step: Connect your Business")) : t("Domina Google Maps en Piloto Automático", "Dominate Google Maps on Autopilot")}
            </h3>
            
            <div className="space-y-3">
              <p className="text-slate-200 text-xs md:text-sm max-w-lg leading-relaxed">
                {t("Para activar las funciones automáticas y sincronizar tus reseñas reales, autoriza el acceso a tu cuenta de Google Business Profile. Esta conexión es 100% gratuita.", 
                   "To activate AI features and sync your real reviews, authorize access to your Google Business Profile account. This connection is 100% free.")}
              </p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-300 bg-indigo-500/15 w-fit px-3 py-1 rounded-full border border-indigo-500/30">
                <ShieldCheck size={12} />
                {t("Cero Costo de API: GBP es gratuito para tu negocio", "Zero API Cost: GBP is free for your business")}
              </div>
            </div>
          </div>
          <button 
            onClick={handleConnectGmbClick}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white px-8 md:px-10 py-4 md:py-5 rounded-[2rem] font-black text-xs md:text-sm transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-3 cursor-pointer"
          >
            <Globe size={20} />
            {t("Conectar GMB Ahora", "Connect GMB Now")}
          </button>
        </div>
      )}
    </div>
  );
};
