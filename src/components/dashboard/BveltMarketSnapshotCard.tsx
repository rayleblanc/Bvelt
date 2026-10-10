import React, { useState } from 'react';
import { 
  Sparkles, Target, AlertTriangle, ArrowRight, ShieldCheck, 
  TrendingUp, Award, Zap, Compass, CheckCircle2, ChevronRight,
  Info, ExternalLink, RefreshCw, BarChart3, Users, Building2,
  Calendar, Flame, Eye, Lock, Clock, Check, Share2
} from 'lucide-react';
import { EvidenceStatus, getEvidenceBadge } from '../../lib/bveltEvidence';
import { BveltTrustLayer, TrustScore } from '../../lib/bveltTrustLayer';
import { MarketGap, MarketCompetitor } from '../../knowledge/engine/marketReferenceEngine';
import { NextBestAction } from '../../knowledge/engine/actionEngine';
import { CalculationDetails } from './CalculationModal';

import { executeShareSnapshot } from '../../utils/shareSnapshot';

interface BveltMarketSnapshotCardProps {
  businessName: string;
  location: string;
  niche: string;
  specialty?: string;
  trustScore: TrustScore;
  opportunities: any[];
  competitors: MarketCompetitor[];
  gaps: MarketGap[];
  recommendedActions: NextBestAction[];
  onExecuteAction: (action: any) => void;
  onOpenCalculationModal?: (details: CalculationDetails) => void;
  onOpenFreeMarketCheck?: () => void;
  userUid?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  t: (es: string, en: string) => string;
}

export const BveltMarketSnapshotCard: React.FC<BveltMarketSnapshotCardProps> = ({
  businessName,
  location,
  niche,
  specialty,
  trustScore,
  opportunities = [],
  competitors = [],
  gaps = [],
  recommendedActions = [],
  onExecuteAction,
  onOpenCalculationModal,
  onOpenFreeMarketCheck,
  userUid,
  showToast,
  t
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'next7days' | 'why_pay' | 'why_bvelt'>('overview');
  const [completedDayActions, setCompletedDayActions] = useState<Record<string, boolean>>({});
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShareSnapshot = () => {
    executeShareSnapshot({
      businessName,
      city: location,
      category: niche,
      score: Math.round(trustScore.score || 75),
      oppAmount: opportunities?.[0]?.impactValue || undefined,
      refCode: userUid,
      t
    }, showToast || ((msg) => console.log(msg)));
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 3000);
  };

  const topOpportunities = opportunities.slice(0, 3);
  const topGaps = gaps.slice(0, 3);
  const topActions = recommendedActions.slice(0, 4);
  const topCompetitors = competitors.slice(0, 3);

  // Derive "Your Biggest Opportunity"
  const biggestOpportunity = topActions.length > 0 ? topActions[0] : (topOpportunities.length > 0 ? {
    id: topOpportunities[0].id,
    action: topOpportunities[0].title,
    title: topOpportunities[0].title,
    reason: topOpportunities[0].whyItMatters,
    reasoning: topOpportunities[0].whyItMatters,
    expectedBenefit: topOpportunities[0].estimatedImpact || t('Mayor captación de demanda local directa', 'Higher direct local demand capture'),
    evidence: topOpportunities[0].evidenceSummary || t('Motor de Mercado Bvelt', 'Bvelt Market Engine'),
    evidenceLevel: 'DERIVED' as const,
    estimatedMinutes: 4,
    destination: { tab: 'client_acquisition' }
  } : null);

  const scoreBadge = getEvidenceBadge(trustScore.status, t);

  const toggleDayAction = (id: string) => {
    setCompletedDayActions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenScoreCalculation = () => {
    if (!onOpenCalculationModal) return;
    onOpenCalculationModal({
      title: t("Cálculo del Score de Oportunidad Bvelt", "Bvelt Market Opportunity Score Calculation"),
      metricName: t("Score de Oportunidad de Mercado", "Market Opportunity Score"),
      resultValue: trustScore.score !== null ? `${trustScore.score} / 100` : t("Sin Datos Suficientes", "Insufficient Data"),
      evidenceStatus: trustScore.status,
      confidence: trustScore.confidenceLevel,
      formula: t(
        "Score = Base (30) + Señal Web (+10 a +25) + Brecha Rating (+10 a +20) + Brecha Reseñas (+5 a +20)",
        "Score = Base (30) + Web Signal (+10 to +25) + Rating Gap (+10 to +20) + Review Gap (+5 to +20)"
      ),
      variables: trustScore.providedInputs.map(inp => ({
        name: inp.split(':')[0],
        value: inp.split(':')[1]?.trim() || inp,
        source: "Bvelt Market Intelligence",
        status: trustScore.status
      })),
      assumptions: [
        t("Ponderación basada en impacto directo en la captación de clientes locales.", "Weighting based on direct impact on local client acquisition."),
        t("Calibrado para el mercado y ciudad seleccionados.", "Calibrated for the selected market and city.")
      ],
      sources: [
        { name: "Bvelt Market Engine", type: t("Algoritmo Determinista", "Deterministic Algorithm") },
        { name: "Directorio & Fichas Públicas", type: t("Señales Verificadas", "Verified Signals") }
      ],
      explanation: trustScore.explanation
    });
  };

  return (
    <div id="bvelt-market-snapshot-card" className="bg-slate-900 border border-indigo-500/20 rounded-3xl p-5 sm:p-7 shadow-xl shadow-indigo-950/20 text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      {/* Header & Meta */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles size={12} className="text-indigo-400" />
              {t("Reporte de Oportunidades y Leads", "Local Lead & Opportunity Report")}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {location || t('Mercado Local', 'Local Market')}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {businessName || t('Tu Negocio Local', 'Your Local Business')}
          </h3>

          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-slate-300">
              <Building2 size={13} className="text-indigo-400" />
              <strong className="font-semibold text-white">{niche || t('Servicios Generales', 'General Services')}</strong>
            </span>
            {specialty && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-indigo-300 font-medium">{specialty}</span>
              </>
            )}
          </div>
        </div>

        {/* Opportunity Score Gauge & Share Button */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleShareSnapshot}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition cursor-pointer active:scale-95 shadow-sm"
            title={t("Compartir snapshot público sin datos privados de clientes", "Share public snapshot without private client data")}
          >
            <Share2 size={14} className="text-indigo-400" />
            <span>{copiedShare ? t("¡Copiado!", "Copied!") : t("Compartir Snapshot", "Share Snapshot")}</span>
          </button>

          <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl shrink-0">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('Oportunidad de Mercado', 'Market Opportunity')}
                </span>
                <button 
                  onClick={handleOpenScoreCalculation}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                  title={t('Ver fórmula y variables de cálculo', 'View calculation formula and variables')}
                >
                  <Info size={12} />
                </button>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${scoreBadge.colorClass}`}>
                  {scoreBadge.label}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {t('Confianza', 'Confidence')}: <strong className="text-slate-200">{trustScore.confidenceLevel}</strong>
                </span>
              </div>
            </div>

            <div 
              onClick={handleOpenScoreCalculation}
              className="w-14 h-14 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition"
            >
            {trustScore.score !== null ? (
              <>
                <span className="text-xl font-black text-indigo-300 leading-none">
                  {trustScore.score}
                </span>
                <span className="text-[9px] font-bold text-indigo-400/80 uppercase">/100</span>
              </>
            ) : (
              <span className="text-[10px] font-black text-slate-400 text-center leading-tight">
                {t("N/D", "N/A")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Nav Tabs for Detailed Breakdown */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pt-4 pb-2 text-xs font-bold overflow-x-auto relative z-10">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          {t('Panorama de Mercado', 'Market Overview')}
        </button>
        <button
          onClick={() => setActiveTab('next7days')}
          className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'next7days'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Calendar size={13} />
          {t('Tu Plan Siguientes 7 Días', 'Your Next 7 Days Plan')}
        </button>
        <button
          onClick={() => setActiveTab('why_pay')}
          className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'why_pay'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Flame size={13} className="text-amber-400" />
          {t('¿Por Qué Bvelt Pro? (Valor Recurrente)', 'Why Bvelt Pro? (Recurring Value)')}
        </button>
        <button
          onClick={() => setActiveTab('why_bvelt')}
          className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'why_bvelt'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck size={13} className="text-emerald-400" />
          {t('Pilares Bvelt (Evidencia vs Suposición)', 'Bvelt Pillars (Evidence vs Guesswork)')}
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6 mt-5 relative z-10">
          
          {/* YOUR BIGGEST OPPORTUNITY (FEATURED HIGHLIGHT) */}
          {biggestOpportunity && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-950/90 to-emerald-950/40 border border-indigo-500/40 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <Flame size={15} className="text-amber-400 animate-pulse" />
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                    {t('Tu Mayor Oportunidad en este Momento', 'Your Biggest Opportunity Right Now')}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
                  {t('Alto Impacto', 'High Impact')}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-black text-white leading-snug">
                {biggestOpportunity.title || biggestOpportunity.action}
              </h4>

              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {biggestOpportunity.reasoning || biggestOpportunity.reason}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-3.5 pt-3 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('Beneficio Estimado', 'Expected Benefit')}</span>
                  <span className="font-semibold text-emerald-400">{biggestOpportunity.expectedBenefit || t('Incremento en conversión de llamadas', 'Inbound call conversion increase')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('Nivel de Evidencia', 'Evidence Level')}</span>
                  <span className="font-semibold text-slate-200">
                    {biggestOpportunity.evidenceLevel || 'DERIVED'} ({biggestOpportunity.evidence || t('Señales de Territorio', 'Territory Signals')})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('Tiempo Requerido', 'Estimated Time')}</span>
                  <span className="font-semibold text-slate-200">⏱ {biggestOpportunity.estimatedMinutes || 3} min</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                  {t('Ejecutar esta acción cierra la brecha frente al líder de tu mercado.', 'Executing this action immediately narrows the gap with your market leader.')}
                </p>
                <button
                  onClick={() => onExecuteAction(biggestOpportunity)}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-2.5 px-5 rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <span>{t('Ejecutar Acción Ahora', 'Execute Action Now')}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* 3 Pillars of Bvelt Market Reality */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Pillar 1: Opportunities */}
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      <TrendingUp size={14} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      {t('1. Oportunidades Detectadas', '1. Detected Opportunities')}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {topOpportunities.length} {t('activas', 'active')}
                  </span>
                </div>

                <div className="space-y-3 mt-3">
                  {topOpportunities.length > 0 ? (
                    topOpportunities.map((opp, idx) => (
                      <div key={opp.id || idx} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-white leading-snug">
                            {opp.title}
                          </span>
                          {opp.estimatedImpact && (
                            <span className="shrink-0 text-[10px] font-black text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                              {opp.estimatedImpact}
                            </span>
                          )}
                        </div>
                        {opp.whyItMatters && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {opp.whyItMatters}
                          </p>
                        )}
                        <button
                          onClick={() => onExecuteAction(opp)}
                          className="mt-2 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition"
                        >
                          {t('Ver Oportunidad', 'View Opportunity')} <ChevronRight size={12} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {t('Conecta tu perfil para detectar oportunidades automáticas.', 'Connect your profile to detect automatic opportunities.')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pillar 2: Competitive Gaps */}
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      <AlertTriangle size={14} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      {t('2. Brechas vs Competidores', '2. Gaps vs Competitors')}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {topGaps.length} {t('críticas', 'critical')}
                  </span>
                </div>

                <div className="space-y-3 mt-3">
                  {topGaps.length > 0 ? (
                    topGaps.map((gap, idx) => (
                      <div key={gap.id || idx} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-300">
                            {gap.title}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            gap.severity === 'CRITICAL' ? 'bg-rose-950/40 text-rose-300 border-rose-800/40' :
                            gap.severity === 'HIGH' ? 'bg-amber-950/40 text-amber-300 border-amber-800/40' :
                            'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {gap.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {gap.explanation}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-300 font-medium">
                          🎯 <strong className="text-white">{t('Acción', 'Action')}:</strong> {gap.recommendedAction}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {t('No se detectaron brechas críticas en este radio.', 'No critical gaps detected in this radius.')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pillar 3: Prioritized Actions */}
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                      <Zap size={14} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      {t('3. Acciones Recomendadas', '3. Recommended Actions')}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-300">
                    {t('Plan Prioritario', 'Priority Plan')}
                  </span>
                </div>

                <div className="space-y-3 mt-3">
                  {topActions.length > 0 ? (
                    topActions.slice(0, 3).map((act, idx) => (
                      <div key={act.id || idx} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">
                            {idx + 1}. {act.title || act.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">
                            ⏱ {act.estimatedMinutes || 3}m
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {act.reasoning || act.reason}
                        </p>
                        <button
                          onClick={() => onExecuteAction(act)}
                          className="mt-2.5 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {t('Ejecutar Ahora', 'Execute Now')} <ArrowRight size={12} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {t('Completando diagnósticos en segundo plano...', 'Completing background diagnostics...')}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 2: YOUR NEXT 7 DAYS (Structured Action Cadence) */}
      {activeTab === 'next7days' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Calendar size={16} className="text-indigo-400" />
                {t('Plan de Ejecución Comercial Semanal', 'Weekly Commercial Execution Plan')}
              </h4>
              <span className="text-[11px] text-slate-400">
                {t('Optimizado para no saturar tu tiempo operativo (10-15 min/día)', 'Optimized for busy contractors (10-15 min/day)')}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t(
                'Cada bloque está ordenado por retorno económico inmediato para tu zona.',
                'Each block is ordered by immediate economic return for your specific territory.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Days 1-2: Immediate Win & Critical Fix */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                  {t('Días 1–2: Victoria Inmediata', 'Days 1–2: Immediate Win')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                  {t('Cierre Rápido', 'Quick Close')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('Reactivar cotizaciones pendientes y contactar leads calientes antes que la competencia.', 'Follow up on pending quotes & contact warm leads before competitors do.')}
              </p>

              <div className="space-y-2">
                {topActions.slice(0, 2).map((act, i) => (
                  <div key={i} className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-white text-[11px]">{act.title || act.action}</strong>
                      <button
                        onClick={() => toggleDayAction(`d12_${act.id || i}`)}
                        className={`p-1 rounded-md border transition cursor-pointer ${
                          completedDayActions[`d12_${act.id || i}`]
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Check size={11} />
                      </button>
                    </div>
                    <span className="text-[10px] text-emerald-400 block">{act.expectedBenefit}</span>
                    <button
                      onClick={() => onExecuteAction(act)}
                      className="w-full text-center py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold transition"
                    >
                      {t('Ejecutar', 'Execute')} (⏱ {act.estimatedMinutes || 3}m)
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Days 3-4: Authority & Conversion Boost */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                  {t('Días 3–4: Autoridad y Reseñas', 'Days 3–4: Authority & Reviews')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                  {t('Posicionamiento', 'Ranking')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('Solicitar reseñas a clientes satisfechos y optimizar fotos/categorías de Google.', 'Request reviews from completed jobs & boost Google Business profile visibility.')}
              </p>

              <div className="space-y-2">
                <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-white text-[11px]">
                      {t('Enviar 3 Enlaces de Reseña Inteligente', 'Send 3 Smart Review Requests')}
                    </strong>
                    <button
                      onClick={() => toggleDayAction('d34_reviews')}
                      className={`p-1 rounded-md border transition cursor-pointer ${
                        completedDayActions['d34_reviews']
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check size={11} />
                    </button>
                  </div>
                  <span className="text-[10px] text-emerald-400 block">
                    {t('Refuerzo directo de confianza y autoridad en búsquedas locales', 'Direct boost in local trust authority and rankings')}
                  </span>
                  <button
                    onClick={() => onExecuteAction({ 
                      id: 'd34_reviews',
                      action: t('Solicitar Reseñas a Clientes Recientes', 'Request Reviews from Recent Clients'),
                      whyNow: t('Refuerzo directo de confianza y autoridad en búsquedas locales.', 'Direct boost in local trust authority and rankings.'),
                      expectedBenefit: t('+1-3 Reseñas 5 Estrellas en Google Maps', '+1-3 Verified 5-Star Google Reviews'),
                      destinationCode: 'REQUEST_REVIEW',
                      contextData: {
                        leadName: t('Cliente Reciente', 'Recent Client'),
                        phone: ''
                      }
                    })}
                    className="w-full text-center py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold transition"
                  >
                    {t('Pedir Reseña Directa (wa.me)', 'Request Direct Review (wa.me)')} (⏱ 2m)
                  </button>
                </div>
              </div>
            </div>

            {/* Days 5-7: Territory Expansion & Radar */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  {t('Días 5–7: Escaneo Territorial', 'Days 5–7: Territory Expansion')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/40">
                  {t('Prospección', 'Prospecting')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('Escanear el radar territorial en un radio de 15km para detectar nuevos clientes desatendidos.', 'Scan local territory in 15km radius to capture newly unserved demand.')}
              </p>

              <div className="space-y-2">
                <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-white text-[11px]">
                      {t('Escanear Radar de Oportunidades', 'Scan Territory Opportunity Radar')}
                    </strong>
                    <button
                      onClick={() => toggleDayAction('d57_radar')}
                      className={`p-1 rounded-md border transition cursor-pointer ${
                        completedDayActions['d57_radar']
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check size={11} />
                    </button>
                  </div>
                  <span className="text-[10px] text-emerald-400 block">
                    {t('Capturar 3-5 leads frescos en tu código postal', 'Capture 3-5 fresh leads in your zip code')}
                  </span>
                  <button
                    onClick={() => onExecuteAction({ 
                      id: 'd57_radar',
                      action: t('Prospección Directa de Clientes en la Zona', 'Direct Local Customer Outreach'),
                      whyNow: t('Captura demanda local antes que los competidores cercanos.', 'Capture local demand before nearby competitors.'),
                      expectedBenefit: t('Capturar 3-5 leads frescos en tu código postal', 'Capture 3-5 fresh leads in your zip code'),
                      destinationCode: 'CONTACT_LEAD',
                      contextData: {
                        leadName: t('Prospecto Local', 'Local Prospect'),
                        phone: ''
                      }
                    })}
                    className="w-full text-center py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold transition"
                  >
                    {t('Contactar Clientes de la Zona', 'Contact Local Clients')} (⏱ 3m)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 3: WHY SHOULD I PAY? (Continuous Value Foundation) */}
      {activeTab === 'why_pay' && (
        <div className="mt-5 space-y-5 relative z-10">
          <div className="p-4 bg-slate-950/80 border border-indigo-500/30 rounded-2xl">
            <h4 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              {t('La Ecuación de Valor Bvelt ($49/mes o $390/año)', 'The Bvelt Value Equation ($49/mo or $390/yr)')}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t(
                'Bvelt no es un software pasivo ni un panel estático. Es tu sistema continuo de inteligencia de mercado que trabaja semana a semana para que no pierdas trabajos frente a la competencia.',
                'Bvelt is not a static dashboard. It is your continuous market intelligence system working week after week so you never lose jobs to local competitors.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* 1. What Bvelt Found */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-black uppercase text-[11px]">
                <Eye size={14} />
                <span>1. {t('Qué Detectó Bvelt', '1. What Bvelt Found')}</span>
              </div>
              <p className="text-slate-300">
                {t(
                  `En tu zona (${location || 'tu ciudad'}), los competidores top acumulan ventajas en volumen de reseñas y tiempos de respuesta, mientras que existen oportunidades desatendidas en cotización digital.`,
                  `In your area (${location || 'your city'}), top competitors hold review volume advantages, while unserved digital quote demand exists.`
                )}
              </p>
            </div>

            {/* 2. Why It Matters */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-black uppercase text-[11px]">
                <AlertTriangle size={14} />
                <span>2. {t('Por Qué Importa', '2. Why It Matters')}</span>
              </div>
              <p className="text-slate-300">
                {t(
                  'Los propietarios que buscan un servicio local contratan principalmente al negocio que responde con rapidez o al que cuenta con mayor autoridad de confianza en Maps. Cada semana con brechas sin corregir representa oportunidades locales perdidas.',
                  'Local homeowners looking for services prioritize contractors with fast response times and solid Google Maps trust signals. Leaving local gaps unaddressed leads to high-value lost jobs.'
                )}
              </p>
            </div>

            {/* 3. What To Do */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-black uppercase text-[11px]">
                <Zap size={14} />
                <span>3. {t('Qué Hacer Ahora', '3. What To Do')}</span>
              </div>
              <p className="text-slate-300">
                {t(
                  'Ejecuta las acciones prioritarias sugeridas: seguimiento de cotizaciones enviadas, solicitud de reseñas de trabajos finalizados y escaneo de radar para nuevos prospectos.',
                  'Execute the prioritized actions: follow up on sent quotes, request reviews from completed jobs, and scan radius for fresh leads.'
                )}
              </p>
            </div>

            {/* 4. What Bvelt Keeps Doing */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-black uppercase text-[11px]">
                <RefreshCw size={14} className="animate-spin" />
                <span>4. {t('Qué Sigue Haciendo Bvelt', '4. What Bvelt Keeps Doing')}</span>
              </div>
              <p className="text-slate-300">
                {t(
                  'Vigilancia continua de tu radio comercial, alertas de nuevos competidores, actualización semanal de brechas y recordatorios automáticos de seguimiento de clientes.',
                  'Continuous surveillance of your territory, new competitor alerts, weekly gap updates, and automated client follow-up sequences.'
                )}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Tab 4: WHY BVELT (Evidence vs Guesswork) */}
      {activeTab === 'why_bvelt' && (
        <div className="mt-5 space-y-4 relative z-10 text-xs">
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <h4 className="text-sm font-black text-white mb-1">
              {t('Los 3 Pilares del Enfoque Bvelt', 'The 3 Pillars of the Bvelt Engine')}
            </h4>
            <p className="text-slate-400">
              {t(
                'A diferencia de herramientas genéricas de IA que inventan respuestas, Bvelt opera con reglas de negocio claras, matemáticas transparentes y evidencia verificada.',
                'Unlike generic AI tools that invent guesses, Bvelt operates with strict business rules, transparent math, and verified evidence.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <ShieldCheck size={16} />
                <span>1. {t('Evidencia Honesta', '1. Honest Evidence')}</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {t(
                  'Cada dato está etiquetado como Verificado, Derivado o Estimado. Nunca inventamos reseñas falsas ni coordenadas sintéticas.',
                  'Every metric is labeled Verified, Derived, or Estimated. We never fabricate fake reviews or synthetic coordinates.'
                )}
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Compass size={16} />
                <span>2. {t('Contexto Territorial', '2. Local Context')}</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {t(
                  'No analizamos tu negocio en el vacío. Te evaluamos frente a los contratistas y proveedores reales que compiten por tus mismos clientes en tu código postal.',
                  'We never analyze in a vacuum. You are benchmarked against real competitors fighting for the same local customers.'
                )}
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Target size={16} />
                <span>3. {t('Acción Ejecutable', '3. Direct Action')}</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {t(
                  'No te damos informes teóricos de 30 páginas. Te damos el botón exacto con el mensaje, el presupuesto o el enlace listo para enviar en 2 minutos.',
                  'No 30-page theoretical reports. We provide the exact button, WhatsApp message, estimate, or link ready to send in 2 minutes.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Quick Action */}
      {onOpenFreeMarketCheck && (
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 relative z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-400 shrink-0" />
            <span>
              {t(
                'Datos calibrados con señales reales de mercado y fuentes oficiales ($0 coste).',
                'Calibrated with real market signals and official datasets ($0 cost).'
              )}
            </span>
          </div>
          <button
            onClick={onOpenFreeMarketCheck}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-4 cursor-pointer"
          >
            {t('Evaluar otro negocio o zona (Free Market Check)', 'Evaluate another business or area (Free Market Check)')}
          </button>
        </div>
      )}
    </div>
  );
};
