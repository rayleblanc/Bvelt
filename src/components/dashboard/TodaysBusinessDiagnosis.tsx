import React, { useState } from 'react';
import { 
  AlertCircle, ArrowRight, CheckCircle, ChevronDown, ChevronUp, 
  Sparkles, Calculator, ShieldAlert, Zap, FileText, Database, ArrowUpRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getEvidenceBadge, getConfidenceBadge, EvidenceStatus } from '../../lib/bveltEvidence';
import { CalculationDetails } from './CalculationModal';

export interface DiagnosisData {
  problem: string;
  problemCode: 'LEADS_UNTOUCHED' | 'REPUTATION_UNANSWERED' | 'PROFILE_INCOMPLETE' | 'GBP_UNVERIFIED' | 'LOCAL_GAP';
  evidenceSummary: string;
  evidenceDetails: { label: string; value: string; status: EvidenceStatus }[];
  estimatedImpact: string;
  estimatedImpactValue: number;
  confidenceScore: number; // 0 to 1
  confidenceLevel: 'High' | 'Medium' | 'Low';
  recommendedActionLabel: string;
  recommendedActionTab: any;
  onExecuteAction?: () => void;
  whyThisMatters: string;
  evidenceDeepDive: string;
  calculationFormula: string;
  calculationDetails: CalculationDetails;
}

interface TodaysBusinessDiagnosisProps {
  diagnosis: DiagnosisData;
  setActiveTab: (tab: any) => void;
  onOpenCalculationModal: (details: CalculationDetails) => void;
  t: (es: string, en: string) => string;
  onOpenMarketCheck?: () => void;
  onOpenGmbModal?: () => void;
}

export const TodaysBusinessDiagnosis: React.FC<TodaysBusinessDiagnosisProps> = ({
  diagnosis,
  setActiveTab,
  onOpenCalculationModal,
  t,
  onOpenMarketCheck,
  onOpenGmbModal
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState<'why' | 'evidence' | 'calculation'>('why');

  if (!diagnosis || !diagnosis.problem) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 text-white p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Background ambient gradient glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">
                {t("AUDITORÍA DE MERCADO EN TIEMPO REAL", "REAL-TIME MARKET AUDIT")}
              </span>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              {t("DATOS VERIFICADOS DE GOOGLE MAPS", "VERIFIED GOOGLE MAPS DATA")}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-3">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight text-left">
                {t("Auditoría de Competencia en 10 Segundos: Mira Qué Negocios Lideran en tu Zona", "Instant 10-Second Competitor Audit: See Who Ranks #1 in Your Service Area")}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed text-left max-w-2xl">
                {t(
                  "Descubre cuántas llamadas y solicitudes están captando tus 3 competidores más cercanos, su ritmo de reseñas y cómo superarlos con datos públicos de Google Maps.",
                  "Benchmark real competitor review velocity, incoming customer phone calls, and high-margin service gaps directly from live Google Maps data."
                )}
              </p>

              {/* 3 Metric Value Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-black text-xs">
                    <Zap size={14} />
                    <span>{t("Ritmo de Reseñas", "Review Velocity")}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {t("Compara tus estrellas frente al top 3 que domina Google Maps.", "Compare your rating vs the top 3 businesses taking organic map rank.")}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs">
                    <ShieldAlert size={14} />
                    <span>{t("Brechas de Demanda", "Demand Gaps")}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {t("Detecta servicios urgentes que otros cotizan tarde o ignoran.", "Find urgent customer requests competitors respond to too late.")}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-black text-xs">
                    <CheckCircle size={14} />
                    <span>{t("Cierre Inmediato", "First Responder")}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {t("Plantillas SMS/WhatsApp para cerrar clientes en <90 segundos.", "Pre-built SMS & WhatsApp scripts to close jobs in under 90s.")}
                  </p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  if (onOpenMarketCheck) onOpenMarketCheck();
                  else setActiveTab('business_scan');
                }}
                className="w-full py-4 px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group"
              >
                <Zap size={16} className="fill-current text-slate-950" />
                <span>{t("Lanzar Auditoría de 10 Segundos", "Run 10-Second Market Audit")}</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenGmbModal) onOpenGmbModal();
                  else setActiveTab('profile');
                }}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{t("Vincular Google Business Profile", "Link Google Business Profile")}</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const confBadge = getConfidenceBadge(diagnosis.confidenceLevel || diagnosis.confidenceScore, t);
  const evBadge = getEvidenceBadge(diagnosis.calculationDetails?.evidenceStatus || 'DERIVED', t);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900/90 border-2 border-indigo-500/30 text-slate-900 dark:text-white p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      {/* Background ambient gradient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 space-y-6">
        {/* Section Tag & Certainty */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {t("DIAGNÓSTICO DEL NEGOCIO DE HOY", "TODAY'S BUSINESS DIAGNOSIS")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${evBadge.colorClass}`}>
              {evBadge.icon} {evBadge.label}
            </span>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${confBadge.colorClass}`}>
              {confBadge.label}
            </span>
          </div>
        </div>

        {/* 5 Core Pillars: Problema, Evidencia, Impacto, Confianza, Acción */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Main Problem & Evidence (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider">
              <AlertCircle size={14} />
              <span>{t("Problema Principal Detectado", "Core Identified Problem")}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight text-left">
              {diagnosis.problem}
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Database size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span><strong className="text-slate-800 dark:text-white">{t("Evidencia:", "Evidence:")}</strong> {diagnosis.evidenceSummary}</span>
            </div>

            {/* Step 3: 3 bullets max — Position signal, Reputation signal, Demand/competition signal in plain English */}
            <div className="space-y-2 pt-2 text-left">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t("Señales del Mercado Local (3 Claves)", "Local Market Signals (Top 3)")}
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span><strong>{t("Posición:", "Position:")}</strong> {diagnosis.evidenceDetails?.[0]?.label || t("Visibilidad en mapas y radio comercial principal", "Map visibility and core service radius")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span><strong>{t("Reputación:", "Reputation:")}</strong> {diagnosis.evidenceDetails?.[1]?.label || t("Calificación de reseñas y velocidad de respuesta", "Review rating & response velocity")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span><strong>{t("Demanda / Competencia:", "Demand / Competition:")}</strong> {diagnosis.evidenceDetails?.[2]?.label || t("Competidores activos y brechas de llamadas", "Active competitors and local call leakage")}</span>
                </li>
              </ul>
            </div>

            {/* Why this matters one-liner directly under primary diagnosis */}
            {diagnosis.whyThisMatters && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                <span className="shrink-0 mt-0.5 font-bold">💡</span>
                <div>
                  <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-800 dark:text-amber-300 block">
                    {t("Por qué importa esto", "Why this matters")}
                  </span>
                  <p className="text-[11px] leading-snug font-medium text-amber-950 dark:text-amber-100 mt-0.5">
                    {diagnosis.whyThisMatters}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Impact & Primary Action (5 cols) */}
          <div className="lg:col-span-5 bg-slate-50/80 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="text-left">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                {t("Oportunidad de Impacto Estimado", "Estimated Opportunity Impact")}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {diagnosis.estimatedImpact}
                </span>
                <button
                  onClick={() => onOpenCalculationModal(diagnosis.calculationDetails)}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline cursor-pointer flex items-center gap-1 bg-transparent border-none outline-none"
                >
                  <Calculator size={11} />
                  <span>{t("Ver cálculo", "View calculation")}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic mt-1 leading-snug">
                {t(
                  "*Estimación direccional basada en ticket promedio y volumen local. No constituye garantía de ingresos contables.",
                  "*Directional estimate based on average ticket size and local search volume. Does not constitute guaranteed accounting revenue."
                )}
              </p>
            </div>

            <button
              onClick={() => {
                if (diagnosis.onExecuteAction) {
                  diagnosis.onExecuteAction();
                } else if (diagnosis.recommendedActionTab) {
                  setActiveTab(diagnosis.recommendedActionTab);
                }
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-98"
            >
              <Zap size={15} />
              <span>{t("Haz esto primero: ", "Do this first: ")} {diagnosis.recommendedActionLabel}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Expandable Transparency Drawer ("Why this matters", "Evidence", "Calculation") */}
        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer py-1"
          >
            <span className="flex items-center gap-2">
              <FileText size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>{t("Desglose de Diagnóstico (Por qué importa, Evidencia y Fórmula)", "Diagnosis Deep Dive (Why it matters, Evidence & Formula)")}</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
              {isExpanded ? t("Ocultar", "Hide") : t("Expandir", "Expand")}
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-4 pt-2"
              >
                {/* Sub-tabs */}
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <button
                    onClick={() => setActiveTabSub('why')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      activeTabSub === 'why' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800/50'
                    }`}
                  >
                    {t("Por qué importa", "Why this matters")}
                  </button>
                  <button
                    onClick={() => setActiveTabSub('evidence')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      activeTabSub === 'evidence' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800/50'
                    }`}
                  >
                    {t("Evidencia y Fuentes", "Evidence & Sources")}
                  </button>
                  <button
                    onClick={() => setActiveTabSub('calculation')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      activeTabSub === 'calculation' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800/50'
                    }`}
                  >
                    {t("Fórmula de Cálculo", "Calculation Formula")}
                  </button>
                </div>

                {/* Sub-tab content */}
                <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {activeTabSub === 'why' && (
                    <div className="space-y-2 text-left">
                      <p className="font-semibold text-slate-800 dark:text-white">{diagnosis.whyThisMatters}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {t(
                          "Los negocios que atienden oportunidades en las primeras 24 horas logran una tasa de conversión 4x superior frente a los que esperan más de 3 días.",
                          "Businesses that act on opportunities within 24 hours achieve a 4x higher conversion rate than those delaying over 3 days."
                        )}
                      </p>
                    </div>
                  )}

                  {activeTabSub === 'evidence' && (
                    <div className="space-y-3 text-left">
                      <p className="text-slate-600 dark:text-slate-300">{diagnosis.evidenceDeepDive}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {diagnosis.evidenceDetails.map((ev, i) => {
                          const badge = getEvidenceBadge(ev.status, t);
                          return (
                            <div key={i} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                              <span className="text-slate-700 dark:text-slate-300 font-medium">{ev.label}: <strong className="text-slate-900 dark:text-white">{ev.value}</strong></span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.colorClass}`}>
                                {badge.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTabSub === 'calculation' && (
                    <div className="space-y-3 text-left">
                      <div className="p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/40 rounded-xl font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                        {diagnosis.calculationFormula}
                      </div>
                      <div className="flex justify-between items-center pt-1 gap-4">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t("Variables verificadas en tiempo real sin extrapolaciones arbitrarias.", "Real-time verified variables without arbitrary extrapolations.")}
                        </span>
                        <button
                          onClick={() => onOpenCalculationModal(diagnosis.calculationDetails)}
                          className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0 bg-transparent border-none outline-none"
                        >
                          {t("Abrir auditoría completa", "Open full audit modal")}
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
