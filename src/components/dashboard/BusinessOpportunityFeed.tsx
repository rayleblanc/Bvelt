import React, { useState, useEffect, useCallback } from 'react';
import { jobFinderEngine } from '../../services/jobFinderEngine';
import { Opportunity } from '../../services/jobFinderModule';
import { 
  DollarSign, 
  MapPin, 
  CheckCircle2, 
  MessageSquare, 
  AlertCircle, 
  RefreshCw, 
  ChevronRight, 
  Copy, 
  ExternalLink, 
  Phone,
  Radar
} from 'lucide-react';

export interface BusinessOpportunityFeedProps {
  trade?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusMi?: number;
  testMode?: boolean;
  onboardingData?: {
    trade?: string;
    zone?: string;
    name?: string;
    dataSource?: string;
  };
  opportunities?: Opportunity[];
  onOpportunitiesLoaded?: (opps: Opportunity[]) => void;
  onSelectOpportunity?: (opp: any) => void;
  onOpenCalculationModal?: () => void;
  onTriggerScan?: () => void;
  showToast?: (msg: string, type?: string) => void;
  t?: (es: string, en: string) => string;
}

export const BusinessOpportunityFeed: React.FC<BusinessOpportunityFeedProps> = ({
  trade,
  city,
  lat,
  lng,
  radiusMi = 15,
  testMode = false,
  onboardingData,
  opportunities: propOpportunities,
  onOpportunitiesLoaded,
  onTriggerScan,
  showToast,
  t
}) => {
  const [realOpportunities, setRealOpportunities] = useState<Opportunity[]>(propOpportunities || []);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [engineErrors, setEngineErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(!propOpportunities && typeof lat === 'number' && typeof lng === 'number');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Validate coordinates - DO NOT default to Tampa if missing
  const hasValidCoords = typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng) && lat !== 0 && lng !== 0;

  const effectiveTrade = trade || onboardingData?.trade || 'lawn_care';
  const effectiveCity = city || onboardingData?.zone || 'Local Area';
  const effectiveRadius = radiusMi || 15;
  const effectiveTestMode = Boolean(testMode);

  const translate = useCallback((en: string, es: string) => {
    if (t) return t(es, en);
    return en; // Default to EN primary
  }, [t]);

  const getTradeName = (tStr: string) => {
    switch (tStr.toLowerCase()) {
      case 'jardineria':
      case 'lawn_care': return 'Lawn Care & Landscaping';
      case 'plomeria':
      case 'plumbing': return 'Plumbing Services';
      case 'hvac': return 'HVAC & Climate Control';
      case 'electricidad':
      case 'electrical': return 'Electrical Services';
      case 'construccion':
      case 'construction': return 'Construction & Repairs';
      case 'limpieza':
      case 'cleaning': return 'Professional Cleaning';
      default: return tStr || 'Local Services';
    }
  };

  const tradeTitle = getTradeName(effectiveTrade);

  const fetchOpportunities = useCallback(async () => {
    if (!hasValidCoords) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await jobFinderEngine.getOpportunities({
        trade: effectiveTrade,
        city: effectiveCity,
        lat: lat as number,
        lng: lng as number,
        radiusMi: effectiveRadius,
        sinceDays: 30,
        testMode: effectiveTestMode,
        tenantId: undefined // TODO: Pass actual tenantId if available
      });
      const fetched = res.opportunities || [];
      setRealOpportunities(fetched);
      setSourcesUsed(res.sourcesUsed || []);
      setEngineErrors(res.errors || []);
      if (onOpportunitiesLoaded) {
        onOpportunitiesLoaded(fetched);
      }
    } catch (err: any) {
      console.warn('[BusinessOpportunityFeed] Error fetching opportunities from engine:', err);
      setEngineErrors([err?.message || String(err)]);
      setRealOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [hasValidCoords, effectiveTrade, effectiveCity, lat, lng, effectiveRadius, effectiveTestMode, onOpportunitiesLoaded]);

  useEffect(() => {
    if (propOpportunities && Array.isArray(propOpportunities) && propOpportunities.length > 0) {
      setRealOpportunities(propOpportunities);
      setLoading(false);
      return;
    }
    fetchOpportunities();
  }, [propOpportunities, fetchOpportunities]);

  const formatSourceBadge = (source: string) => {
    const s = source || '';
    const isTestMode = s.includes('(TestMode)');
    let label = 'Map Signal';
    let color = 'bg-slate-800 text-slate-300 border-slate-700';

    if (s.includes('OpenStreetMap') || s.includes('OSM') || s.includes('overpass')) {
      label = 'OpenStreetMap POI Signals';
      color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    } else if (s.includes('Geoapify')) {
      label = 'Geoapify Places';
      color = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    } else if (s.includes('LocationIQ')) {
      label = 'LocationIQ Nearby';
      color = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    } else if (s.includes('Miami-Dade') || s.includes('Permits')) {
      label = 'Miami-Dade Open Data Permits';
      color = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    } else if (s.includes('NOAA') || s.includes('Weather')) {
      label = 'NOAA Weather Signals';
      color = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    } else if (s.includes('Places API') || s.includes('Local Business Places')) {
      label = 'Google / Places API';
      color = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    }

    return { label, color, isTestMode };
  };

  const handleCopyOutreachDraft = (opp: Opportunity) => {
    const draft = `Hi ${opp.title}, I noticed your local business listing in ${opp.address || effectiveCity}. I'm reaching out from ${tradeTitle} in ${effectiveCity}. We provide direct local coverage and fast service. Let us know if you'd like to connect!`;
    navigator.clipboard.writeText(draft);
    setCopiedId(opp.id);
    if (showToast) {
      showToast(translate('Outreach draft copied to clipboard', 'Borrador de contacto copiado al portapapeles'), 'success');
    }
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Missing Coords State - Honest prompt
  if (!hasValidCoords && (!propOpportunities || propOpportunities.length === 0)) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
        <div className="p-3 bg-indigo-500/10 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto text-indigo-400">
          <MapPin className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h4 className="text-sm font-bold text-white">
            {translate('Set your service area or allow location access', 'Establece tu zona de servicio o permite el acceso a tu ubicación')}
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            {translate(
              'To discover live territory signals and competitor gaps in your area, please set your city or coordinates in your profile settings.',
              'Para descubrir señales de territorio en tiempo real y brechas de competidores, establece tu ciudad o coordenadas en tu perfil.'
            )}
          </p>
        </div>
        {onTriggerScan && (
          <button
            onClick={onTriggerScan}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95 inline-flex items-center space-x-2"
          >
            <MapPin className="w-4 h-4" />
            <span>{translate('Set Service Area & Scan', 'Establecer zona y escanear')}</span>
          </button>
        )}
      </div>
    );
  }

  // Limit display to maximum 8 opportunities
  const displayedOpportunities = realOpportunities.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Banner de Estado Real */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold">
            <Radar className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white flex items-center space-x-2">
              <span>{translate('Territory & Competitor Signals', 'Señales de Territorio y Competidores')}</span>
              {effectiveTestMode && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px]">
                  testMode
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>{tradeTitle} • {effectiveCity} ({effectiveRadius} mi)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchOpportunities}
            disabled={loading || !hasValidCoords}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center space-x-1.5 transition-all border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{translate('Refresh', 'Actualizar')}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-300">
            {translate('Scanning local territory via OSM, Geoapify & regional sources...', 'Escaneando territorio local vía fuentes OSM, Geoapify y regionales...')}
          </p>
          <p className="text-xs text-slate-500">
            {effectiveCity} • {tradeTitle}
          </p>
        </div>
      )}

      {/* Real Opportunities Feed */}
      {!loading && displayedOpportunities.length > 0 && (
        <div className="space-y-4">
          {displayedOpportunities.map((opp) => {
            const badge = formatSourceBadge(opp.source);
            const isCopied = copiedId === opp.id;

            return (
              <div 
                key={opp.id} 
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all space-y-3"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badge.color}`}>
                      {badge.label}
                    </span>
                    {badge.isTestMode && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                        TestMode
                      </span>
                    )}
                    {opp.distanceMi !== undefined && (
                      <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                        {opp.distanceMi} mi
                      </span>
                    )}
                  </div>
                  {opp.valueRange && (
                    <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      ${opp.valueRange.min} - ${opp.valueRange.max} USD
                    </div>
                  )}
                </div>

                {/* Body Content */}
                <div>
                  <h4 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>{opp.title}</span>
                  </h4>
                  {(opp.address || opp.zone) && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{opp.address || opp.zone}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    {opp.why}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
                  <button
                    onClick={() => handleCopyOutreachDraft(opp)}
                    className="py-2 px-3.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center space-x-1.5 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isCopied ? translate('Draft Copied!', '¡Borrador Copiado!') : translate('Copy outreach draft', 'Copiar borrador de contacto')}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {opp.website && (
                      <a
                        href={opp.website.startsWith('http') ? opp.website : `https://${opp.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1 border border-slate-700 transition-all"
                        title={translate('Visit website', 'Visitar sitio web')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {opp.phone && (
                      <a
                        href={`tel:${opp.phone}`}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1 border border-slate-700 transition-all"
                        title={translate('Call', 'Llamar')}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Honest Empty State */}
      {!loading && hasValidCoords && displayedOpportunities.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="p-3 bg-slate-800 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto text-slate-400">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-white">
              {translate('No map signals in range yet', 'Sin señales de mapa en rango por ahora')}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {translate(
                'No competitor gaps or map signals detected in this range yet. Expand your search radius or run a fresh territory scan.',
                'No se detectaron brechas de competidores en esta ubicación con el radio actual. Amplía el radio de búsqueda o ejecuta un nuevo escaneo de territorio.'
              )}
            </p>
          </div>
          {onTriggerScan && (
            <button
              onClick={onTriggerScan}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95 inline-flex items-center space-x-2"
            >
              <Radar className="w-4 h-4" />
              <span>{translate('Scan Territory', 'Escanear Territorio')}</span>
            </button>
          )}
        </div>
      )}

      {/* Collapsible Source Diagnostic Log */}
      {engineErrors.length > 0 && (
        <details className="text-xs border border-slate-800 rounded-xl bg-slate-950/60 p-3 text-slate-400">
          <summary className="cursor-pointer hover:text-slate-300 font-medium flex items-center space-x-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {translate(`Source diagnostic log (${engineErrors.length})`, `Registro de diagnóstico de fuentes (${engineErrors.length})`)}
            </span>
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-500 pl-4 list-disc">
            {engineErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
