import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Sparkles, 
  Building2, 
  MapPin, 
  Briefcase, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Target,
  Zap,
  Globe,
  Info,
  ChevronRight,
  Phone,
  Clock,
  ExternalLink
} from 'lucide-react';
import { IndustryResolver } from '../../knowledge/resolvers/industryResolver';
import { MarketReferenceEngine, MarketGap } from '../../knowledge/engine/marketReferenceEngine';
import { BveltTrustLayer, TrustScore } from '../../lib/bveltTrustLayer';
import { ActionEngine } from '../../knowledge/engine/actionEngine';
import { getEvidenceBadge } from '../../lib/bveltEvidence';
import { trackBveltEvent } from '../../lib/bveltObservability';
import { executeBusinessScan } from '../../services/businessScanService';
import { TypeaheadInput } from '../ui/TypeaheadInput';
import { getTradeSuggestions, getCitySuggestions } from '../../lib/typeaheadSuggestions';

interface FreeMarketCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (es: string, en: string) => string;
  language?: 'es' | 'en';
  onApplyToBusiness?: (data: { businessName: string; city: string; niche: string }) => void;
  onGoToPlans?: () => void;
  initialBusinessName?: string;
  initialCity?: string;
  initialNiche?: string;
}

export const FreeMarketCheckModal: React.FC<FreeMarketCheckModalProps> = ({
  isOpen,
  onClose,
  t,
  language = 'en',
  onApplyToBusiness,
  onGoToPlans,
  initialBusinessName = '',
  initialCity = '',
  initialNiche = ''
}) => {
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [city, setCity] = useState(initialCity);
  const [niche, setNiche] = useState(initialNiche);
  const [isScanning, setIsScanning] = useState(false);
  const [noData, setNoData] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [resultSnapshot, setResultSnapshot] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialBusinessName) setBusinessName(initialBusinessName);
      if (initialCity) setCity(initialCity);
      if (initialNiche) setNiche(initialNiche);
    }
  }, [isOpen, initialBusinessName, initialCity, initialNiche]);

  if (!isOpen) return null;

  const handleRunCheck = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!city || !niche) return;

    setIsScanning(true);
    setNoData(false);
    setResultSnapshot(null);
    setReportSent(false);

    executeBusinessScan({
      businessName: businessName || 'Negocio Local',
      city,
      niche
    }).then((scanResult) => {
      const realCompetitors = scanResult.competitors || [];
      if (realCompetitors.length === 0 && !scanResult.identity?.address) {
        setNoData(true);
        setIsScanning(false);
        return;
      }

      const resolvedNiche = IndustryResolver.resolve(niche);
      const commercialContext = IndustryResolver.buildCommercialContext({
        businessName: businessName || 'Negocio Local',
        category: niche,
        city
      });

      const trustScore = BveltTrustLayer.calculateMarketOpportunityScore({
        hasWebsite: Boolean(scanResult.identity?.website),
        rating: scanResult.identity?.rating || null,
        reviewCount: scanResult.identity?.reviewCount || null,
        competitorCount: realCompetitors.length > 0 ? realCompetitors.length : null,
        city,
        niche
      });

      const gaps = MarketReferenceEngine.detectMarketGaps(
        {
          businessName: businessName || 'Negocio Local',
          niche,
          city,
          rating: scanResult.identity?.rating ?? undefined,
          reviewCount: scanResult.identity?.reviewCount ?? undefined,
          website: scanResult.identity?.website || undefined,
          hasWebsite: Boolean(scanResult.identity?.website)
        },
        realCompetitors,
        language === 'en' ? 'en' : 'es'
      );

      const actions = ActionEngine.computeNextBestActions({
        leads: [],
        opportunities: [],
        marketContext: {
          industry: niche,
          niche,
          city,
          marketGaps: gaps
        },
        profile: {
          businessName: businessName || 'Negocio Local',
          category: niche,
          location: city,
          rating: scanResult.identity?.rating || null,
          reviewsCount: scanResult.identity?.reviewCount || null
        },
        lang: language === 'en' ? 'en' : 'es'
      });

      setResultSnapshot({
        scanResult,
        trustScore,
        gaps,
        actions,
        commercialContext,
        competitors: realCompetitors,
        source: scanResult.sourcesUsed?.join(', ') || 'OpenStreetMap / Cascading Geocoder',
        timestamp: scanResult.timestamp ? new Date(scanResult.timestamp).toLocaleDateString() : new Date().toLocaleDateString()
      });
      trackBveltEvent('free_market_check', { niche, location: city });
      setIsScanning(false);
    }).catch((err) => {
      console.warn("Scan failed:", err);
      setNoData(true);
      setIsScanning(false);
    });
  };

  const handleApply = () => {
    if (onApplyToBusiness && (businessName || niche || city)) {
      onApplyToBusiness({
        businessName: businessName || 'Negocio Local',
        city: city || 'Ciudad Local',
        niche: niche || 'Servicios'
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl text-white overflow-hidden shadow-2xl my-8 relative"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {t('Free Market Check — Bvelt', 'Free Market Check — Bvelt')}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  $0 Cost
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t('Diagnóstico de mercado local basado en evidencia y cascada de geolocalización.', 'Evidence-based local market diagnosis via geolocation cascade.')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {noData ? (
            <div className="p-6 bg-slate-950 border border-amber-500/30 rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h4 className="text-base font-black text-white">
                {t("No hay datos suficientes todavía", "Insufficient data available yet")}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t("No encontramos suficientes registros públicos en la zona para este oficio. Déjanos tu correo y te enviaremos el informe completo en cuanto esté disponible.", "We couldn't find enough public records in this area for this trade. Leave your email and we'll send you the complete report as soon as available.")}
              </p>
              {reportSent ? (
                <p className="text-xs text-emerald-400 font-bold">
                  {t("¡Informe en camino! Te avisaremos por correo.", "Report on the way! We'll notify you by email.")}
                </p>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!reportEmail) return;
                  setReportSent(true);
                }} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                  <input
                    type="email"
                    required
                    value={reportEmail}
                    onChange={(e) => setReportEmail(e.target.value)}
                    placeholder={t("Tu correo electrónico", "Your email address")}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {t("Enviar informe", "Send Report")}
                  </button>
                </form>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setNoData(false)}
                  className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer"
                >
                  {t("← Volver a intentar", "← Try again")}
                </button>
              </div>
            </div>
          ) : !resultSnapshot ? (
            <form onSubmit={handleRunCheck} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t('Nombre del Negocio (Opcional)', 'Business Name (Optional)')}
                </label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t('Ej: Miami Precision Plumbing', 'Ex: Miami Precision Plumbing')}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TypeaheadInput
                  label={t('Ciudad o Zona Local *', 'City or Local Area *')}
                  value={city}
                  onChange={setCity}
                  suggestions={getCitySuggestions(city)}
                  placeholder={t('Ej: Miami, FL / Austin, TX', 'Ex: Miami, FL / Austin, TX')}
                  icon={<MapPin size={16} />}
                />

                <TypeaheadInput
                  label={t('Sector o Servicio *', 'Sector or Service *')}
                  value={niche}
                  onChange={setNiche}
                  suggestions={getTradeSuggestions(niche)}
                  placeholder={t('Ej: Climatización HVAC, Fontanería, Techos', 'Ex: HVAC, Plumbing, Roofing')}
                  icon={<Briefcase size={16} />}
                />
              </div>

              <button
                type="submit"
                disabled={isScanning || !city || !niche}
                className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black py-3.5 px-4 rounded-xl transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isScanning ? (
                  <span>{t('Buscando con cascada de geolocalización...', 'Searching via geoloc cascade...')}</span>
                ) : (
                  <>
                    <Zap size={16} className="text-amber-300" />
                    <span>{t('Buscar Negocio y Mercado', 'Search Business & Market')}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Snapshot Result Header with Source and Date */}
              <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <h4 className="text-base font-black text-white">
                    {businessName || resultSnapshot.scanResult?.identity?.formattedName || t('Negocio Local', 'Local Business')}
                  </h4>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    {niche} • {city}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                    <span className="flex items-center gap-1">
                      <Globe size={12} className="text-indigo-400" />
                      <span>{t('Fuente:', 'Source:')} {resultSnapshot.source}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-emerald-400" />
                      <span>{t('Fecha:', 'Date:')} {resultSnapshot.timestamp}</span>
                    </span>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black border border-emerald-500/20">
                    <CheckCircle size={14} /> {t("Negocio Verificado", "Verified Business")}
                  </span>
                </div>
              </div>

              {/* THREE REQUIRED BLOCKS */}
              <div className="space-y-4">
                
                {/* BLOCK 1: Comparison with 3 real competitors */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                  <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Target size={15} className="text-indigo-400" />
                    <span>{t("1. Comparación con 3 Competidores Reales", "1. Comparison with 3 Real Competitors")}</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(resultSnapshot.competitors || []).slice(0, 3).map((comp: any, idx: number) => (
                      <div key={comp.id || idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white">#{idx + 1}</span>
                          <span className="text-slate-400">{comp.distanceKm ? `${comp.distanceKm.toFixed(1)} km` : ''}</span>
                        </div>
                        <p className="text-xs font-black text-white truncate">{comp.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{comp.address || city}</p>
                      </div>
                    ))}
                    {(!resultSnapshot.competitors || resultSnapshot.competitors.length === 0) && (
                      <p className="text-xs text-slate-400 col-span-3 py-2 text-center">
                        {t("No se registraron competidores cercanos directos en el radio actual.", "No direct nearby competitors found in current radius.")}
                      </p>
                    )}
                  </div>
                </div>

                {/* BLOCK 2: Checklist: "¿Puede la IA de Google llamarte y obtener precio y disponibilidad?" */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                  <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={15} className="text-amber-400" />
                    <span>{t("2. ¿Puede la IA de Google llamarte y obtener precio y disponibilidad?", "2. Can Google AI call you and get price and availability?")}</span>
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-300 font-medium">{t("Teléfono verificado para llamadas automáticas", "Verified phone for automated calls")}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${resultSnapshot.scanResult?.identity?.phone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {resultSnapshot.scanResult?.identity?.phone ? (language === 'es' ? '✓ Sí (Listo)' : '✓ Yes (Ready)') : (language === 'es' ? 'Pendiente' : 'Pending')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-300 font-medium">{t("Horarios y disponibilidad expuestos en web", "Hours & availability exposed online")}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${resultSnapshot.scanResult?.identity?.website ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {resultSnapshot.scanResult?.identity?.website ? (language === 'es' ? '✓ Sincronizado' : '✓ Synced') : (language === 'es' ? 'No detectado' : 'Not Detected')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-300 font-medium">{t("Agente de voz IA preparado para presupuestar", "AI voice agent ready for instant quoting")}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${resultSnapshot.scanResult?.identity?.phone && resultSnapshot.scanResult?.identity?.website ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                        {resultSnapshot.scanResult?.identity?.phone && resultSnapshot.scanResult?.identity?.website ? (language === 'es' ? '⚡ Activo' : '⚡ Active') : (language === 'es' ? '⚡ Requiere Integración' : '⚡ Setup Required')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BLOCK 3: Link to open jobs */}
                <div className="p-4 bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Briefcase size={15} className="text-indigo-400" />
                      <span>{t("3. Trabajos Abiertos Disponibles", "3. Available Open Jobs")}</span>
                    </h5>
                    <p className="text-xs text-slate-300">
                      {t("Explora la bolsa de trabajos y leads activos en tu zona para este sector.", "Explore active jobs and leads in your local area for this trade.")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleApply();
                    }}
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-2 shrink-0 shadow-lg shadow-indigo-600/30"
                  >
                    <span>{t("Ver Trabajos Abiertos", "View Open Jobs")}</span>
                    <ExternalLink size={14} />
                  </button>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResultSnapshot(null)}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {t('Modificar Búsqueda', 'Modify Search')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleApply();
                    if (onGoToPlans) onGoToPlans();
                  }}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <Zap size={14} className="fill-current text-slate-950 group-hover:scale-110 transition-transform" />
                  <span>{t('Activar Bvelt Pro (7 Días Sin Riesgo) — $49/mes', 'Activate Bvelt Pro (7-Day Trial) — $49/mo')}</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-400 font-medium pt-1">
                {t(
                  "Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.",
                  "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send."
                )}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
