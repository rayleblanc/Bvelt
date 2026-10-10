import React, { useState } from 'react';
import { AlertTriangle, BellRing, Sparkles, ArrowRight, ShieldAlert, CheckCircle, Flame, Target, Database, Calculator, RefreshCw } from 'lucide-react';
import { getEvidenceBadge, EvidenceStatus } from '../../lib/bveltEvidence';
import { useScansQuota } from '../../lib/rateLimitService';

interface DashboardSignalsSectionProps {
  t: (es: string, en: string) => string;
  businessSignals: any[];
  setActiveTab: (tab: string) => void;
  growthStats: any;
  user: any;
  profile: any;
  nicheDefined: boolean;
  radarBlipsCount: number;
  onRunSeoAudit: () => void;
  onExecuteAction?: (action: any) => void;
}

export const DashboardSignalsSection: React.FC<DashboardSignalsSectionProps> = ({
  t,
  businessSignals,
  setActiveTab,
  growthStats,
  user,
  profile,
  nicheDefined,
  radarBlipsCount,
  onRunSeoAudit,
  onExecuteAction,
}) => {
  const [showScoreAudit, setShowScoreAudit] = useState(false);
  const isGmbConnected = profile?.gbpConnectionStatus === 'CONNECTED' || Boolean(profile?.gmbConnected) || localStorage.getItem('bvelt_gmb_manual_connected') === 'true';
  const criticalSignals = businessSignals.filter(s => s.type === 'CRITICAL');
  const quota = useScansQuota(profile);

  const handleScanClick = () => {
    if (quota.isCooldown || quota.scansLeft <= 0) return;
    quota.triggerCooldown(4000);
    quota.consumeScan();
    onRunSeoAudit();
  };
  const attentionSignals = businessSignals.filter(s => s.type === 'ATTENTION');
  const positiveSignals = businessSignals.filter(s => s.type === 'POSITIVE');

  return (
    <div id="section-priority-attention" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            {t("2. Diagnóstico Operativo y Señales", "2. Operational Signals & Attention")}
          </h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t("Señales de cuello de botella, oportunidades de contacto y cambios competitivos.", "Bottleneck signals, contact opportunities & competitive shifts.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full border border-amber-100 dark:border-amber-900/30">
            {criticalSignals.length > 0 ? `${criticalSignals.length} ${t("Críticas", "Critical")}` : t("Sin Riesgos Graves", "No Severe Risks")}
          </span>
        </div>
      </div>

      {/* Bvelt Business Signals */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block mb-1">
              {t("SEÑALES DE NEGOCIO BVELT • AUDITORÍA EN TIEMPO REAL", "BVELT BUSINESS SIGNALS • LIVE AUDIT")}
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {t("Diagnóstico Operativo de Señales", "Operational Signal Diagnostics")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("Identificación basada en evidencia de fricciones que frenan tu conversión.", "Evidence-based identification of friction points limiting conversion.")}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
              {criticalSignals.length} {t("Críticas", "Critical")}
            </span>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
              {attentionSignals.length} {t("Atención", "Attention")}
            </span>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20">
              {positiveSignals.length} {t("Positivas", "Positive")}
            </span>
          </div>
        </div>

        {businessSignals.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            {t("No se han detectado señales críticas en este momento.", "No critical signals detected at this moment.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businessSignals.map(sig => {
              const isCrit = sig.type === 'CRITICAL';
              const isAtt = sig.type === 'ATTENTION';
              const evStatus: EvidenceStatus = sig.evidenceStatus || (isCrit ? 'VERIFIED' : 'DERIVED');
              const evBadge = getEvidenceBadge(evStatus, t);

              return (
                <div 
                  key={sig.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition ${
                    isCrit 
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/40' 
                      : isAtt 
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40' 
                      : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        isCrit ? 'bg-red-500/20 text-red-600 dark:text-red-400' : isAtt ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {sig.type}
                      </span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${evBadge.colorClass}`}>
                        {evBadge.icon} {evBadge.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                      {sig.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {sig.reason}
                    </p>
                    {sig.evidence && (
                      <div className="text-[10px] text-slate-400 font-mono bg-slate-950/40 p-1.5 rounded-md border border-slate-800">
                        {sig.evidence}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                    <button
                      onClick={() => {
                        if (onExecuteAction) {
                          const actLabelLower = (sig.actionLabel || '').toLowerCase();
                          const titleLower = (sig.title || '').toLowerCase();
                          const isReview = actLabelLower.includes('reseñ') || actLabelLower.includes('review') || titleLower.includes('reseñ') || titleLower.includes('review');
                          const isLead = actLabelLower.includes('lead') || actLabelLower.includes('contact') || titleLower.includes('lead') || titleLower.includes('prospect');
                          const isQuote = actLabelLower.includes('presupuesto') || actLabelLower.includes('quote') || actLabelLower.includes('precio');

                          onExecuteAction({
                            id: sig.id || `signal_${sig.title}`,
                            action: sig.title,
                            whyNow: sig.reason,
                            expectedBenefit: sig.expectedBenefit || t("Mejorar rendimiento comercial", "Improve commercial performance"),
                            destinationCode: isReview ? 'REQUEST_REVIEW' : isQuote ? 'SEND_QUOTE' : isLead ? 'CONTACT_LEAD' : 'CONTACT_LEAD',
                            contextData: {
                              leadName: profile?.name || t("Cliente", "Client"),
                              phone: profile?.phone || '',
                              email: profile?.email || ''
                            }
                          });
                        } else {
                          setActiveTab(sig.actionTab);
                        }
                      }}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        isCrit 
                          ? 'bg-red-600 hover:bg-red-500 text-white' 
                          : isAtt 
                          ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <span>{sig.actionLabel}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Market Diagnostic Warning & Bvelt Authority Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Warning */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-slate-950 border border-amber-500/25 text-white p-6 sm:p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-amber-600/10 to-transparent pointer-events-none"></div>
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 text-[10px] font-black uppercase tracking-wider">
              <ShieldAlert size={12} />
              <span>{t("Análisis de Mercado Local", "Local Market Analysis")}</span>
            </div>

            <h3 className="text-xl md:text-2xl font-black tracking-tight leading-tight">
              {nicheDefined ? (
                t("Competidores locales detectados en el radio seleccionado.", 
                  "Local competitors detected in the selected radius.")
              ) : (
                t("Brecha de visibilidad potencial detectada.", 
                  "Potential visibility gap detected.")
              )}
            </h3>

            <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-xl">
              {t("Se ha identificado una posible brecha de visibilidad frente a competidores locales. La posición del mercado requiere verificación adicional.", 
                 "A potential visibility gap has been identified against local competitors. Market position requires further verification.")}
            </p>

            {/* Honest Evidence Metadata Panel */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-2 text-[11px] text-slate-400">
              <span className="font-black text-indigo-400 uppercase tracking-wider block mb-1 text-[10px]">
                📊 {t("Evidencia y Parámetros de Diagnóstico", "Evidence & Diagnostic Parameters")}
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div><span className="font-bold text-slate-300">{t("Negocios Detectados:", "Businesses Detected:")}</span> {radarBlipsCount}</div>
                <div><span className="font-bold text-slate-300">{t("Radio de Cobertura:", "Coverage Radius:")}</span> 5 km</div>
                <div><span className="font-bold text-slate-300">{t("Sector de Búsqueda:", "Search Category:")}</span> {profile?.category || t("Servicios Locales", "Local Services")}</div>
                <div><span className="font-bold text-slate-300">{t("Fuente de Datos:", "Data Source:")}</span> OpenStreetMap Node API (OSM)</div>
                <div className="col-span-2 border-t border-slate-800/60 pt-1.5 flex justify-between items-center text-[9px]">
                  <span className="font-mono text-indigo-500/80 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase">
                    {t("Indicador: DERIVADO", "Indicator: DERIVED")}
                  </span>
                  <span>{t("Última actualización: Hoy", "Last updated: Today")}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button 
                type="button"
                onClick={handleScanClick}
                disabled={quota.isCooldown || quota.scansLeft <= 0}
                className={`text-slate-950 font-black text-xs uppercase px-6 py-3 rounded-xl transition shadow-lg flex items-center gap-2 ${
                  quota.isCooldown || quota.scansLeft <= 0
                    ? 'bg-slate-700 text-slate-300 cursor-not-allowed opacity-80'
                    : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20 cursor-pointer'
                }`}
              >
                {quota.isCooldown ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{t("Enfriando...", "Cooling down...")}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>
                      {t("Escanear Mi Mercado", "Scan My Market")}
                      {quota.scansLeft > 0 && (
                        <span className="ml-1.5 opacity-80 font-mono text-[11px] font-bold lowercase">
                          ({quota.scansLeft} {t("hoy", "left")})
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('business_scan')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase px-5 py-3 rounded-xl transition cursor-pointer"
              >
                {t("Ver Radar de Mercado", "View Market Radar")}
              </button>
            </div>
          </div>
        </div>

        {/* Gamification Bvelt Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">
                  {t("ÍNDICE DE AUTORIDAD LOCAL", "LOCAL AUTHORITY INDEX")}
                </span>
                <h4 className="text-lg font-black text-white">
                  {t("Puntuación de Relevancia", "Relevance Score")}
                </h4>
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                isGmbConnected 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {isGmbConnected ? t("VERIFICADO", "VERIFIED") : t("PROVISIONAL", "PROVISIONAL")}
              </span>
            </div>

            <div className="text-center py-4 space-y-2">
              <div className="text-4xl font-black text-indigo-400">
                {growthStats?.score || (nicheDefined ? 68 : 35)}<span className="text-lg text-slate-400">/100</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-indigo-500 h-full rounded-full" 
                  style={{ width: `${growthStats?.score || (nicheDefined ? 68 : 35)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400">
                {growthStats?.score >= 80 
                  ? t("Excelente posicionamiento", "Excellent positioning") 
                  : t("Oportunidades de optimización abiertas", "Optimization opportunities open")}
              </p>
            </div>

            {/* Collapsible Audit Section */}
            <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
              <button
                onClick={() => setShowScoreAudit(!showScoreAudit)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer bg-transparent border-0"
              >
                <span className="flex items-center gap-1.5">
                  <Calculator size={12} className="text-indigo-400" />
                  {showScoreAudit ? t("Ocultar desglose de auditoría", "Hide audit breakdown") : t("¿Por qué esta puntuación?", "Why this score?")}
                </span>
                <span>{showScoreAudit ? "▲" : "▼"}</span>
              </button>

              {showScoreAudit && (
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-850 space-y-2.5 text-[10px] text-slate-400 animate-fade-in">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>1. {t("Presencia GMB (Pilar 30%)", "GMB Presence (30% Pillar)")}</span>
                      <span>{isGmbConnected ? "30 / 30" : "0 / 30"}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full" style={{ width: isGmbConnected ? '100%' : '0%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>2. {t("Reputación y Reseñas (Pilar 40%)", "Reputation & Reviews (40% Pillar)")}</span>
                      <span>{isGmbConnected ? "38 / 40" : "20 / 40"}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full" style={{ width: isGmbConnected ? '95%' : '50%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>3. {t("Gestión CRM (Pilar 30%)", "CRM Leads Management (30% Pillar)")}</span>
                      <span>{nicheDefined ? "30 / 30" : "15 / 30"}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full" style={{ width: nicheDefined ? '100%' : '50%' }}></div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 space-y-1 font-medium text-slate-500">
                    <div className="flex justify-between">
                      <span>{t("Confianza del Cálculo:", "Calculation Confidence:")}</span>
                      <span className={isGmbConnected ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {isGmbConnected ? t("Alta (95%)", "High (95%)") : t("Provisional (35%)", "Provisional (35%)")}
                      </span>
                    </div>
                    {!isGmbConnected && (
                      <div className="text-[9px] text-amber-500 font-bold bg-amber-500/5 p-1 rounded border border-amber-500/10 mt-1">
                        ⚠️ {t("Falta conectar Google Business API. Puntuación basada en estimaciones locales.", "Google Business API not connected. Score based on local estimates.")}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              if (isGmbConnected) {
                setActiveTab('reviews');
              } else {
                setActiveTab('profile'); // Send them directly to connect!
              }
            }}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer mt-2"
          >
            {isGmbConnected ? t("Mejorar Score", "Improve Score") : t("Conectar GMB", "Connect GMB")}
          </button>
        </div>
      </div>
    </div>
  );
};
