import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Target, TrendingUp, AlertTriangle, Zap, ArrowRight, ShieldAlert, BarChart3, Star, MapPin, Loader2, Store } from 'lucide-react';
import { Skeleton, CardSkeleton, ListSkeleton } from './Skeleton';
import { auth } from '../lib/firebase';
import { getMarketData } from '../utils/marketMetrics';

interface MarketGrowthViewProps {
  location: string;
  niche: string;
  t: (es: string, en: string) => string;
  onSaveGrowthAnalysis?: (revenue: number) => void;
  onActivatePro?: () => void;
}

export const MarketGrowthView = React.memo(({ location, niche, t, onSaveGrowthAnalysis, onActivatePro }: MarketGrowthViewProps) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lostRevenue, setLostRevenue] = useState(0);

  const activeNiche = (niche && niche.trim() && niche !== 'undefined' && niche !== 'null') 
    ? niche 
    : 'General Services';
  const activeLocation = (location && location.trim() && location !== 'undefined' && location !== 'null') 
    ? location 
    : 'Local Market';

  const city = activeLocation.split(',')[0].trim() || 'Local Area';
  const market = getMarketData(activeNiche, activeLocation);
  const [realCompetitorCount, setRealCompetitorCount] = useState<number | null>(null);
  const [radarPlaces, setRadarPlaces] = useState<any[]>([]);
  const topComp = radarPlaces && radarPlaces[0] && radarPlaces[0].title ? radarPlaces[0].title : null;

  useEffect(() => {
    let isMounted = true;
    const fetchCompetitors = async (retries = 3, backoff = 1000) => {
      try {
        const queryStr = `${activeNiche} in ${activeLocation}`;

        const res = await fetch(`/api/nominatim?endpoint=search&format=json&q=${encodeURIComponent(queryStr)}&limit=50`);
        if (res.status === 429 && retries > 0) {
          console.warn(`Rate limit exceeded for competitors. Retrying in ${backoff}ms...`);
          setTimeout(() => {
            if (isMounted) fetchCompetitors(retries - 1, backoff * 2);
          }, backoff);
          return;
        }
        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : [];
          const count = items.length;
          const mappedPlaces = items.map((item: any, idx: number) => ({
            id: `osm-${item.place_id || idx}`,
            title: item.name || item.display_name?.split(',')[0] || `Competidor #${idx + 1}`,
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            rating: null,
            userRatingsTotal: null
          }));

          if (isMounted) {
            setRadarPlaces(mappedPlaces);
            setRealCompetitorCount(count > 0 ? count : null);
            if (count > 0) {
              localStorage.setItem('bvelt_growth_radar_places', JSON.stringify(mappedPlaces));
              localStorage.setItem('bvelt_growth_competitors_count', count.toString());
            }
          }
        } else {
          if (isMounted) {
            setRealCompetitorCount(null);
          }
        }
      } catch (err) {
        if (retries > 0) {
          setTimeout(() => {
            if (isMounted) fetchCompetitors(retries - 1, backoff * 2);
          }, backoff);
        } else {
          if (isMounted) {
            setRealCompetitorCount(null);
          }
        }
      }
    };
    fetchCompetitors();
    return () => { isMounted = false; };
  }, [activeLocation, activeNiche]);

  const runSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setShowResult(true);
      const calculatedRevenue = market.estimatedLostRevenue;
      setLostRevenue(calculatedRevenue);
      
      localStorage.setItem('bvelt_growth_scanned', 'true');
      localStorage.setItem('bvelt_growth_lost_revenue', calculatedRevenue.toString());
      
      // Market opportunity proportional to niche estimated lost revenue
      const opportunity = Math.round(market.estimatedLostRevenue * 1.5);
      localStorage.setItem('bvelt_growth_market_opportunity', opportunity.toString());
      
      const compCount = realCompetitorCount !== null ? realCompetitorCount : 0;
      localStorage.setItem('bvelt_growth_competitors_count', compCount.toString());
      
      if (onSaveGrowthAnalysis) onSaveGrowthAnalysis(calculatedRevenue);
    }, 2500);
  };

  const [competitorName, setCompetitorName] = useState('');
  const [counterPitchObj, setCounterPitchObj] = useState<{ headline: string, counterArgument: string, callToAction: string } | null>(null);
  const [analyzingCompetitor, setAnalyzingCompetitor] = useState(false);

  const getCounterPitch = async () => {
    if (!competitorName) return;
    setAnalyzingCompetitor(true);
    setCounterPitchObj(null);

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res;
      } catch (err) {
        if (retries <= 1) throw err;
        console.warn(`Fetch failed, retrying in ${backoff}ms...`, err);
        await delay(backoff);
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
    };

    try {
      const promptText = t(
        `Analiza al competidor "${competitorName}" en el nicho "${niche}" en ${location}. Dame un "Counter-Pitch" estratégico estructurado en formato JSON.
        Debes responder EXCLUSIVAMENTE con un objeto JSON válido con los siguientes campos:
        - "headline": Un titular corto, impactante de venta (máximo 1 frase).
        - "counterArgument": Un contraargumento persuasivo que resalte la atención al detalle, transparencia de presupuesto y compromiso de servicio personalizado de Bvelt frente a los puntos débiles de ${competitorName} (máximo 2 frases).
        - "callToAction": Un llamado a la acción persuasivo y directo para cerrar el trato.
        Es vital que uses el formato JSON solicitado.`,
        `Analyze competitor "${competitorName}" in the "${niche}" niche in ${location}. Give me a sales counter-pitch structured in JSON format.
        You must respond EXCLUSIVELY with a valid JSON object containing the following fields:
        - "headline": A short, high-impact sales headline (maximum 1 sentence).
        - "counterArgument": A strong counter-argument highlighting Bvelt's attention to detail, upfront budget transparency, and personalized service commitment vs ${competitorName}'s corporate weaknesses (maximum 2 sentences).
        - "callToAction": A persuasive and direct call-to-action to close the deal.
        It is vital that you return the requested JSON format.`
      );

      const resp = await fetchWithRetry('/api/ai/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          systemInstruction: "Eres un estratega de ventas premium, agresivo pero refinado. Tus respuestas siempre están en JSON válido siguiendo el esquema solicitado.",
          response_format: { type: "json_object" }
        })
      });

      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await resp.json().catch(() => null) as { text?: string; headline?: string; counterArgument?: string; callToAction?: string } | null;
        if (data && data.text) {
          try {
            const parsed = JSON.parse(data.text);
            if (parsed.headline && parsed.counterArgument && parsed.callToAction) {
              setCounterPitchObj(parsed);
              return;
            }
          } catch (e) {
            if (data.headline && data.counterArgument && data.callToAction) {
              setCounterPitchObj(data as { headline: string; counterArgument: string; callToAction: string });
              return;
            }
          }
        }
      }
      throw new Error("Respuesta de IA incompleta o inválida");
    } catch (e) {
      console.warn("Falla en counter pitch de IA, usando fallback local:", e);
      setCounterPitchObj({
        headline: t(
          `Supera a ${competitorName} con atención local y alta velocidad de respuesta`,
          `Outshine ${competitorName} with local focus and fastest response velocity`
        ),
        counterArgument: t(
          `A diferencia de ${competitorName}, nuestro trato no es impersonal. Ofrecemos presupuestos transparentes y sin sorpresas, respaldados por técnicos locales enfocados exclusivamente en tu satisfacción.`,
          `Unlike ${competitorName}, we don't treat you like a number. We offer upfront transparent pricing and direct lines to local specialists focused on your satisfaction.`
        ),
        callToAction: t(
          `Contáctanos ahora y agenda tu diagnóstico prioritario hoy mismo.`,
          `Contact us now and schedule your priority diagnostics today.`
        )
      });
    } finally {
      setAnalyzingCompetitor(false);
    }
  };

  if (!city) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800 p-6 sm:p-12 shadow-2xl relative overflow-hidden text-center">
        <Target className="mx-auto text-slate-700 dark:text-slate-500 mb-6" size={64} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("Esperando Datos de Sincronización...", "Awaiting Sync Data...")}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t("Por favor completa la configuración de tu perfil de negocio primero para simular tu mercado.", "Please complete your business profile setup first to simulate your market.")}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800 p-4 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-600/10 blur-[100px] pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
          <div className="space-y-2 w-full md:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest">
              <Zap size={12} /> {t("Análisis Competitivo Local", "Local Competitive Audit")}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {t("¿Quién está liderando en", "Who is leading in")} <span className="text-indigo-600 dark:text-indigo-400">{city}</span>?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed">
              {t("Compara los indicadores públicos de tu negocio frente a los competidores líderes de tu zona.", "Compare your public business profile signals against leading competitors in your area.")}
            </p>
          </div>
          {!showResult && !isSimulating && (
            <button 
              onClick={runSimulation}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <Target size={18} />
              {t("Ejecutar Análisis", "Run Market Analysis")}
            </button>
          )}
        </div>

        <div className={`relative ${showResult ? 'min-h-[400px] p-4 sm:p-8' : 'min-h-[280px] py-12 sm:py-16 flex items-center justify-center p-4 sm:p-6'} bg-white dark:bg-slate-950/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/50 overflow-hidden`}>
          {isSimulating ? (
            <div className="w-full space-y-8 p-4">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MapPin className="text-indigo-500 animate-pulse" size={24} />
                  </div>
                </div>
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">
                  {t("Analizando Señales Locales...", "Analyzing Local Signals...")}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Skeleton className="w-1/3 h-3" variant="text" />
                  <Skeleton className="w-full h-2" />
                  <Skeleton className="w-1/4 h-3" variant="text" />
                  <Skeleton className="w-full h-2" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-8 flex flex-col items-center gap-3">
                  <Skeleton className="w-12 h-12" variant="circle" />
                  <Skeleton className="w-2/3 h-6" variant="text" />
                  <Skeleton className="w-1/2 h-3" variant="text" />
                </div>
              </div>
            </div>
          ) : showResult ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full flex flex-col gap-6 sm:gap-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Local Ranking Comparison */}
                 <div className="space-y-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("Estado de Visibilidad", "Visibility Status")}</p>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("Líder del Sector", "Market Leader")}</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{t("ALTA VISIBILIDAD", "HIGH VISIBILITY")}</span>
                       </div>
                       <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: '90%' }} transition={{ duration: 1 }} className="h-full bg-emerald-500" />
                       </div>
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("Tu Negocio", "Your Business")}</span>
                          <span className="text-xs font-black text-rose-600 dark:text-rose-400">{t("BRECHA DETECTADA", "VISIBILITY GAP")}</span>
                       </div>
                       <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: '25%' }} transition={{ duration: 1 }} className="h-full bg-rose-500" />
                       </div>
                    </div>
                 </div>

                 {/* Financial Impact */}
                 <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-6 flex flex-col justify-center items-center text-center space-y-3">
                    <div className="bg-rose-500 text-white p-3 rounded-2xl shadow-lg shadow-rose-500/20">
                       <AlertTriangle size={24} />
                    </div>
                    <div>
                       <div className="flex items-center justify-center gap-1.5 mb-1">
                          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{t("Facturación Perdida Estimada / Mes", "Estimated Lost Revenue / Month")}</p>
                          <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase">
                             {t("Estimación", "Modeled")}
                          </span>
                       </div>
                       <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">${lostRevenue.toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 italic">
                      {t(`*Estimación modelada basada en volumen de búsqueda para ${activeNiche} en ${city}`, `*Modeled estimate based on search volume for ${activeNiche} in ${city}`)}
                    </p>
                 </div>
              </div>

              <div className="bg-indigo-600 p-6 rounded-[2rem] flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl shadow-indigo-600/40 border border-white/10 group">
                 <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-4">
                    <div className="bg-white/20 p-3 rounded-2xl">
                       <ShieldAlert className="text-white" size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-white leading-none mb-1">{t("¿Quieres cerrar la brecha de visibilidad?", "Want to close the visibility gap?")}</h3>
                       <p className="text-xs font-medium text-indigo-100">{t("Desbloquea el plan PRO para recuperar tu posición en 30 días.", "Unlock PRO to reclaim your position in 30 days.")}</p>
                    </div>
                 </div>
                 <button 
                   onClick={onActivatePro}
                   className="w-full lg:w-auto whitespace-nowrap bg-white text-indigo-600 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition active:scale-95 shadow-lg text-center"
                 >
                    {t("Activar Dominio Local", "Activate Local Domain")}
                 </button>
              </div>

              {/* Live Competitive Scout Section (Powered by Groq) */}
              <div className="mt-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-[2rem] p-6 border border-indigo-200 dark:border-indigo-900/30">
                 <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white">
                       <Target size={16} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{t("Explorador de Competencia En Vivo", "Live Competitive Scout")}</h3>
                       <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Powered by Groq Llama 3 (Ultra-Fast)</p>
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                       type="text"
                       placeholder={t("Nombre del competidor...", "Competitor name...")}
                       value={competitorName}
                       onChange={(e) => setCompetitorName(e.target.value)}
                       className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button 
                       onClick={getCounterPitch}
                       disabled={analyzingCompetitor || !competitorName}
                       className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2"
                    >
                       {analyzingCompetitor ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                       {t("Analizar Debilidad", "Analyze Weakness")}
                    </button>
                 </div>

                 {counterPitchObj && (
                    <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="mt-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-2.5"
                    >
                       <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                          <TrendingUp size={10} /> {t("Análisis y Counter-Pitch Sugerido", "Analysis & Suggested Counter-Pitch")}
                       </p>
                       <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          {counterPitchObj.headline}
                       </h4>
                       <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed italic">
                          "{counterPitchObj.counterArgument}"
                       </p>
                       <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                          <Zap size={10} />
                          <span>{counterPitchObj.callToAction}</span>
                       </div>
                    </motion.div>
                 )}
              </div>

              {/* Real Competitors List (Radar Data) */}
              {radarPlaces && radarPlaces.length > 0 && (
                <div className="mt-4 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] p-4 sm:p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin size={18} className="text-emerald-500" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{t("Top Local Pack (Tiempo Real)", "Top Local Pack (Real-Time)")}</h3>
                  </div>
                  <div className="space-y-3">
                    {radarPlaces.slice(0, 3).map((place: any, idx: number) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-500 font-black">#{idx + 1}</span>
                            {place.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{place.address}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          {place.rating ? (
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                                <span>{place.rating}</span>
                                <Star size={14} className="fill-amber-500" />
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {place.ratingCount ? `${place.ratingCount} ${t("reseñas", "reviews")}` : t("Sin reseñas", "No reviews")}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">{t("Sin rating", "No rating")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro Feature: Competitor Weakness Analysis */}
              <div className="mt-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-[2rem] p-4 sm:p-6 border border-slate-200 dark:border-slate-700/50">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                       <Zap size={18} className="text-amber-400" />
                       {t("Puntos Ciegos de la Competencia", "Competitor Blind Spots")}
                    </h3>
                    <span className="w-fit text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full">{t("ANÁLISIS PRO", "PRO ANALYSIS")}</span>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { 
                        title: t("Baja Frecuencia de Posts", "Low Post Frequency"), 
                        desc: topComp 
                          ? t(`El competidor líder "${topComp}" no ha publicado fotos nuevas recientemente. Sube un trabajo hoy para superarlo.`, `Top competitor "${topComp}" hasn't posted new photos recently. Upload a job today to outrank them.`)
                          : t(`Los competidores locales no actualizan fotos con frecuencia. Sube un trabajo hoy para ganar relevancia.`, `Local competitors infrequently update photos. Upload a job today to gain relevance.`),
                        stat: "14 " + t("días", "days")
                      },
                      { 
                        title: t("Reseñas sin Keyword", "No Keyword Reviews"), 
                        desc: topComp
                          ? t(`Las reseñas de "${topComp}" no mencionan barrios específicos en ${city}. Si pides reseñas citando localizaciones, Google te dará prioridad.`, `Reviews of "${topComp}" do not mention specific neighborhoods in ${city}. If you request reviews mentioning locations, Google prioritizes you.`)
                          : t(`Las fichas de la zona en ${city} carecen de palabras clave locales en reseñas. Pide reseñas citando zonas para que Google te priorice.`, `Local listings in ${city} lack area keywords in reviews. Request reviews mentioning neighborhoods to get priority.`),
                        stat: "0 " + t("localizaciones", "locations")
                      },
                      { 
                        title: t("Perfil Desactualizado", "Outdated Profile"), 
                        desc: topComp
                          ? t(`"${topComp}" no tiene horario de festivos configurado. Es tu oportunidad de captar leads en días libres.`, `"${topComp}" has no holiday hours set. Your chance to capture leads on off-days.`)
                          : t(`Muchos perfiles locales no configuran horarios festivos. Configúralos para captar leads en días libres.`, `Many local profiles lack holiday hours. Set yours to capture off-day leads.`),
                        stat: "SEO " + t("Incompleto", "Incomplete")
                      }
                    ].map((item, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/50 space-y-3">
                         <div className="flex justify-between items-start gap-2">
                            <p className="text-[11px] font-black text-indigo-400 uppercase tracking-tight">{item.title}</p>
                            <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{item.stat}</span>
                         </div>
                         <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                            {item.desc}
                          </p>
                      </div>
                    ))}
                 </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center space-y-4 opacity-50 my-auto">
               <BarChart3 size={48} className="mx-auto text-slate-700" />
               <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">{t("Esperando Datos de Análisis...", "Awaiting Analysis Data...")}</p>
            </div>
          )}
        </div>
        
        {/* Market Stats Bar */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
           {[
             { label: t("COMPETIDORES", "COMPETITORS"), value: realCompetitorCount === null ? t("N/D", "N/A") : realCompetitorCount.toString(), color: "text-slate-800 dark:text-slate-400" },
             { label: t("VOLUMEN MENSUAL", "MONTHLY VOLUME"), value: `${(market.monthlyDemand / 100).toFixed(1)}K`, color: "text-slate-800 dark:text-slate-400" },
             { label: t("DIFICULTAD", "DIFFICULTY"), value: market.difficulty, color: market.difficulty === 'ALTA' ? "text-rose-400" : "text-emerald-400" },
             { 
               label: t("TU POTENCIAL", "YOUR POTENTIAL"), 
               value: realCompetitorCount === null 
                 ? t("N/D", "N/A") 
                 : realCompetitorCount === 0 
                   ? t("INSUFFICIENT_DATA", "INSUFFICIENT_DATA")
                   : realCompetitorCount >= 3 
                     ? t("TOP 3 (Proyectado)", "TOP 3 (Projected)")
                     : `TOP ${realCompetitorCount} (${t("Proyectado", "Projected")})`, 
               color: "text-emerald-400" 
             }
           ].map((stat, i) => (
             <div key={i} className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
});
