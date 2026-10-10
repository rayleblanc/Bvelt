import React, { useState, useMemo } from 'react';
import { Sparkles, Clock, CheckCircle, ArrowRight, Zap, Target, Award, Play, Users, DollarSign, Send, Calendar, TrendingUp, FileText, ChevronDown } from 'lucide-react';
import { NextActionCard } from '../NextActionCard';
import { ActionEngine, NextBestAction } from '../../knowledge/engine/actionEngine';
import { CommercialMetricsEngine } from '../../knowledge/engine/commercialMetrics';
import { MarketReferenceEngine } from '../../knowledge/engine/marketReferenceEngine';
import { getEvidenceBadge, EvidenceStatus } from '../../lib/bveltEvidence';
import { navigateTo } from '../../lib/navigateTo';

interface DashboardGrowthSectionProps {
  t: (es: string, en: string) => string;
  growthActions: any[];
  bveltRecommendedActions?: NextBestAction[];
  setGrowthActions: React.Dispatch<React.SetStateAction<any[]>>;
  handleToggleActionComplete: (id: string) => void;
  setActiveTab: (tab: string) => void;
  profile: any;
  growthStats: any;
  leads?: any[];
  clientTransactions?: any[];
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenGmbModal?: () => void;
  onRunSeoAudit?: () => void;
  // Bvelt Opportunities 2.0 props
  bveltOpportunities?: any[];
  oppFilter?: 'all' | 'high' | 'quick' | 'pending';
  setOppFilter?: (filter: 'all' | 'high' | 'quick' | 'pending') => void;
  handleExecuteOpportunity?: (opp: any) => void;
  handleMeasureOutcome?: (opp: any) => void;
  // Outcomes & Funnel props
  outcomesSummary?: any;
  conversionStages?: any[];
  funnelMetrics?: any;
  handleLogSaleModal?: () => void;
  onExecuteAction?: (action: any) => void;
}

export const DashboardGrowthSection: React.FC<DashboardGrowthSectionProps> = ({
  t,
  growthActions = [],
  bveltRecommendedActions = [],
  setGrowthActions,
  handleToggleActionComplete,
  setActiveTab,
  profile,
  growthStats,
  leads = [],
  clientTransactions = [],
  showToast,
  onOpenGmbModal,
  onRunSeoAudit,
  bveltOpportunities,
  oppFilter,
  setOppFilter,
  handleExecuteOpportunity,
  handleMeasureOutcome,
  outcomesSummary,
  conversionStages,
  funnelMetrics,
  handleLogSaleModal,
  onExecuteAction,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const commercialSummary = useMemo(() => {
    const safeLeads = Array.isArray(leads) ? leads : [];
    const storedQuotes = ActionEngine.getStoredQuotes();
    return CommercialMetricsEngine.computeSummary(safeLeads, storedQuotes);
  }, [leads]);

  const profitSummary = useMemo(() => {
    const safeLeads = Array.isArray(leads) ? leads : [];
    const storedQuotes = ActionEngine.getStoredQuotes();
    return CommercialMetricsEngine.computeProfitSummary(safeLeads, storedQuotes, clientTransactions, profile?.category);
  }, [leads, clientTransactions, profile?.category]);
  const topPriorityAction = growthActions.find(a => a.status !== 'COMPLETED') || growthActions[0] || {
    id: 'default_act',
    title: t('Completa tu perfil comercial', 'Complete your business profile'),
    description: t('Añade detalles para calibrar tus recomendaciones.', 'Add details to calibrate recommendations.'),
    priority: 'HIGH',
    impact: 'HIGH',
    status: 'TODO',
    estimatedMinutes: 3,
    actionTab: 'profile'
  };
  const [outcomeInput, setOutcomeInput] = useState('');
  const [showOutcomeBox, setShowOutcomeBox] = useState(false);
  const [internalOppFilter, setInternalOppFilter] = useState<'all' | 'high' | 'quick' | 'pending'>('all');
  const activeOppFilter = oppFilter || internalOppFilter;
  const onSetOppFilter = setOppFilter || setInternalOppFilter;

  const activeOpportunities = bveltOpportunities || [];

  const topNextBestAction = bveltRecommendedActions[0];

  const handleExecuteNextBestAction = (nba: any) => {
    if (nba.id === 'action_connect_gmb' && onOpenGmbModal) {
      onOpenGmbModal();
      return;
    }
    if (nba.id === 'action_market_scan') {
      if (onRunSeoAudit) onRunSeoAudit();
      setActiveTab('business_scan');
      return;
    }
    if (nba.id === 'action_log_lead') {
      setActiveTab({ tab: 'leads', subRow: 4, section: 'clients' });
      return;
    }
    if (nba.destination?.tab) {
      setActiveTab(nba.destination);
      return;
    }
    if (onExecuteAction) {
      onExecuteAction(nba);
    } else {
      setActiveTab({ tab: 'leads', subRow: 4 });
    }
  };

  const filteredOpportunities = activeOpportunities.filter(opp => {
    if (activeOppFilter === 'all') return true;
    if (activeOppFilter === 'high') return opp.estimatedImpact?.includes('+') || opp.category === t('Visibilidad', 'Visibility');
    if (activeOppFilter === 'quick') return (opp.timeEstimateMinutes || 5) <= 3;
    return true;
  });

  const onExecuteOpp = (opp: any) => {
    if (onExecuteAction) {
      onExecuteAction({
        id: opp.id || `opp_${Date.now()}`,
        action: opp.title,
        whyNow: opp.whyNow || opp.description || t('Oportunidad prioritaria detectada en tu mercado.', 'High-priority opportunity detected in your market.'),
        expectedBenefit: opp.estimatedImpact || opp.benefit || t('Captar clientes locales', 'Acquire local clients'),
        destinationCode: (opp.category || '').toLowerCase().includes('lead') ? 'CONTACT_LEAD' : (opp.category || '').toLowerCase().includes('reseñ') || (opp.category || '').toLowerCase().includes('review') ? 'REQUEST_REVIEW' : 'SEND_QUOTE',
        contextData: {
          leadName: leads?.[0]?.name || t("Cliente Potencial", "Lead"),
          phone: leads?.[0]?.phone || leads?.[0]?.telefono || '',
          email: leads?.[0]?.email || ''
        }
      });
      return;
    }
    if (handleExecuteOpportunity) {
      handleExecuteOpportunity(opp);
    } else if (opp.actionTab) {
      setActiveTab(opp.actionTab);
    } else if (onRunSeoAudit) {
      onRunSeoAudit();
    }
  };

  const onMeasureOpp = (opp: any) => {
    if (handleMeasureOutcome) {
      handleMeasureOutcome(opp);
    } else if (showToast) {
      showToast(t(`Medición registrada para: ${opp.title}`, `Measurement logged for: ${opp.title}`), 'info');
    }
  };

  const realConversionStages = useMemo(() => {
    const visits = growthStats?.views || 0;
    const leadsCount = commercialSummary.totalLeadsCount;
    const quotes = commercialSummary.quotesSent;
    const won = commercialSummary.wonDeals;
    const calcRate = (num: number, den: number): number | null => {
      if (den === null || den === undefined || isNaN(den) || den <= 0) return null;
      if (num === null || num === undefined || isNaN(num) || num < 0) return null;
      return Math.min(100, Math.round((num / den) * 100));
    };

    return [
      { stage: 'VISITS', label: t('Visitas Maps', 'Maps Visits'), count: visits, conversionRate: calcRate(leadsCount, visits) },
      { stage: 'LEADS', label: t('Contactos / Leads', 'Contacts / Leads'), count: leadsCount, conversionRate: calcRate(quotes, leadsCount) },
      { stage: 'QUOTES', label: t('Presupuestos', 'Quotes Sent'), count: quotes, conversionRate: calcRate(won, quotes) },
      { stage: 'WON', label: t('Ventas Ganadas', 'Won Sales'), count: won, conversionRate: calcRate(won, quotes > 0 ? quotes : leadsCount) }
    ];
  }, [growthStats?.views, commercialSummary, t]);

  const activeConversionStages = conversionStages || realConversionStages;

  // 30-day growth plan states
  const [planStart, setPlanStart] = useState<string | null>(() => {
    try { return localStorage.getItem('lf_30day_start_date'); } catch (e) { return null; }
  });
  const [openWeeks, setOpenWeeks] = useState<{ [week: number]: boolean }>({ 1: true, 2: false, 3: false, 4: false });
  const [showFullAnalysis, setShowFullAnalysis] = useState<boolean>(false);

  const handleStartPlan = () => {
    const todayStr = new Date().toISOString();
    localStorage.setItem('lf_30day_start_date', todayStr);
    setPlanStart(todayStr);
    if (showToast) showToast(t('¡Plan de 30 días iniciado!', '30-day growth plan started!'), 'success');
  };

  const currentPlanDay = planStart ? Math.min(30, Math.max(1, Math.floor((Date.now() - new Date(planStart).getTime()) / (1000 * 60 * 60 * 24)) + 1)) : 1;
  const totalActionsCount = Math.max(1, growthActions.length);
  const completedActionsCount = growthActions.filter(a => a.status === 'COMPLETED').length;
  const progressPercent = Math.round((completedActionsCount / totalActionsCount) * 100);

  const week1Actions = growthActions.filter(a => ['Perfil', 'Profile'].includes(a.category) || a.id.includes('profile') || a.id.includes('audit'));
  const week2Actions = growthActions.filter(a => ['Reputación', 'Reviews'].includes(a.category) || a.id.includes('reviews'));
  const week3Actions = growthActions.filter(a => ['Estrategia', 'Strategy', 'Auditoría', 'Audit'].includes(a.category) && !week1Actions.includes(a));
  const week4Actions = growthActions.filter(a => ['CRM & Leads'].includes(a.category) || a.id.includes('leads') || (!week1Actions.includes(a) && !week2Actions.includes(a) && !week3Actions.includes(a)));

  const weeks = [
    { weekNum: 1, title: t('SEMANA 1 — FUNDACIÓN', 'WEEK 1 — FOUNDATION'), subtitle: t('Fundación y Perfil de Negocio', 'Foundation & Business Profile'), acts: week1Actions },
    { weekNum: 2, title: t('SEMANA 2 — REPUTACIÓN', 'WEEK 2 — REPUTATION'), subtitle: t('Impulso de Reputación y Reseñas', 'Reputation & Reviews Boost'), acts: week2Actions },
    { weekNum: 3, title: t('SEMANA 3 — VISIBILIDAD', 'WEEK 3 — VISIBILITY'), subtitle: t('Visibilidad Local y Estrategia de Competidores', 'Local Visibility & Competitor Strategy'), acts: week3Actions },
    { weekNum: 4, title: t('SEMANA 4 — CONVERSIÓN', 'WEEK 4 — CONVERSION'), subtitle: t('CRM, Prospectos y Embudo de Conversión', 'CRM, Leads & Conversion Pipeline'), acts: week4Actions },
  ];

  return (
    <div id="section-growth-actions" className="space-y-8">
      {/* PHASE P4: 60-Second WOW Post-Login Hero Block */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-500/30 relative overflow-hidden space-y-6">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-400/30 text-xs font-black uppercase tracking-wider">
            <Clock size={14} className="text-amber-400" />
            {t(`Día ${currentPlanDay} de 3 — Escaneos restantes: 4 / 5`, `Day ${currentPlanDay} of 3 — Scans left: 4 / 5`)}
          </div>
          <span className="text-xs text-indigo-200 font-medium">
            {t("Diagnóstico inmediato de mercado", "Immediate market diagnostic")}
          </span>
        </div>

        {/* Tradesman Language 1-Sentence Diagnostic */}
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white leading-snug">
            {t(
              "Tus competidores locales están capturando llamadas en tu zona. Ejecuta estas 3 acciones inmediatas para retener esos contratos.",
              "Your local competitors are capturing calls in your area. Execute these 3 immediate actions to secure those contracts."
            )}
          </h1>
          <p className="text-xs md:text-sm text-indigo-200/90 font-medium max-w-2xl">
            {t(
              "Sin rodeos ni teoría SEO: abre WhatsApp o llama directamente a estos prospectos y clientes para asegurar trabajo esta semana.",
              "No fluff or SEO theory: open WhatsApp or call these prospects and clients directly to lock in work this week."
            )}
          </p>
        </div>

        {/* Top 3 Executable Action Cards */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <Zap size={14} />
              {t("Top 3 Acciones para Ejecutar Ahora Mismo", "Top 3 Actions to Execute Right Now")}
            </h3>
            <span className="text-[10px] text-indigo-300">
              {t("Clic para abrir canal directo", "Click to open direct channel")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(bveltRecommendedActions.length > 0 ? bveltRecommendedActions.slice(0, 3) : (
              (leads && leads.length > 0) ? [
                {
                  id: `real_lead_${leads[0].id || '0'}`,
                  title: t(`Atender Lead: ${leads[0].name || leads[0].client || t('Nuevo Contacto', 'New Inquiry')}`, `Follow-up: ${leads[0].name || leads[0].client || 'New Inquiry'}`),
                  description: leads[0].text ? leads[0].text.slice(0, 90) + '...' : t('Responde al último cliente interesado para asegurar el trabajo.', 'Reply to the latest interested client to secure the job.'),
                  impactEstimate: t('Lead Activo', 'Active Lead'),
                  actionType: 'whatsapp',
                  primaryContactPhone: leads[0].phone || leads[0].telefono || '',
                  primaryContactName: leads[0].name || leads[0].client || t('Cliente', 'Client'),
                  destination: { tab: 'leads', subRow: 4, section: 'clients' }
                },
                {
                  id: 'action_connect_gmb',
                  title: t('Conectar Google Business Profile', 'Connect Google Business Profile'),
                  description: t('Sincroniza tus datos de Google Maps para recibir llamadas directas y reseñas.', 'Sync your Google Maps data to capture direct calls and customer reviews.'),
                  impactEstimate: '+40% Visibilidad',
                  actionType: 'gmb',
                  destination: { tab: 'profile', subRow: 0 }
                },
                {
                  id: 'action_market_scan',
                  title: t('Escanear Radar de Competencia', 'Scan Local Market Radar'),
                  description: t('Descubre competidores y demanda activa en tu código postal.', 'Discover competitors and live customer demand in your zip code.'),
                  impactEstimate: t('Auditoría', 'Market Audit'),
                  actionType: 'scan',
                  destination: { tab: 'business_scan' }
                }
              ] : [
                {
                  id: 'action_connect_gmb',
                  title: t('Conectar Google Business Profile', 'Connect Google Business Profile'),
                  description: t('Sincroniza tus datos de Google Maps para recibir llamadas directas y reseñas verificadas.', 'Sync your Google Maps profile to capture direct phone calls and verified reviews.'),
                  impactEstimate: '+40% Tráfico',
                  actionType: 'gmb',
                  destination: { tab: 'profile', subRow: 0 }
                },
                {
                  id: 'action_market_scan',
                  title: t('Escanear Radar de Competencia', 'Scan Local Market Radar'),
                  description: t('Descubre competidores y demanda activa en tu código postal.', 'Discover competitors and live customer demand in your zip code.'),
                  impactEstimate: t('Auditoría Local', 'Local Audit'),
                  actionType: 'scan',
                  destination: { tab: 'business_scan' }
                },
                {
                  id: 'action_log_lead',
                  title: t('Bandeja CRM & Nuevos Clientes', 'CRM Inbox & Inbound Leads'),
                  description: t('Registra o analiza mensajes de clientes para presupuestar y cerrar servicios.', 'Log and analyze customer inquiries to draft estimates and close jobs.'),
                  impactEstimate: t('Conversión', 'Conversion'),
                  actionType: 'crm',
                  destination: { tab: 'leads', subRow: 4, section: 'clients' }
                }
              ]
            )).map((nba: any, idx: number) => (
              <div 
                key={nba.id || idx}
                onClick={() => handleExecuteNextBestAction(nba)}
                className="bg-white/10 dark:bg-slate-900/80 border border-white/20 hover:border-amber-400/60 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition cursor-pointer group hover:bg-white/15"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md">
                      {nba.impactEstimate || t('Alta Prioridad', 'High Priority')}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {nba.title}
                  </h4>
                  <p className="text-xs text-indigo-200/80 line-clamp-2">
                    {nba.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-black text-amber-300">
                  <span>{t("Ejecutar Acción →", "Execute Action →")}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collapsible Full Analysis Toggle */}
        <div className="pt-4 border-t border-indigo-800/60 flex justify-center">
          <button
            onClick={() => setShowFullAnalysis(!showFullAnalysis)}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer border border-indigo-400/40"
          >
            <span>{showFullAnalysis ? t("Ocultar Análisis Completo", "Hide Full Analysis") : t("Ver Análisis Completo y Métricas Detalladas ↓", "See Full Analysis & Detailed Metrics ↓")}</span>
            <ChevronDown size={16} className={`transition-transform duration-300 ${showFullAnalysis ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE FULL ANALYSIS SECTION */}
      <div className={`space-y-8 transition-all duration-300 ${showFullAnalysis ? 'block animate-fadeIn' : 'hidden'}`}>
        {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                {t("3. Acciones de Crecimiento y Oportunidades", "3. Growth Actions & Opportunities")}
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {t("¿Qué puedo hacer ahora para crecer? Plan diario, oportunidades calculadas y embudo de conversión.", "¿What can I do right now to grow? Daily plan, calculated opportunities & conversion funnel.")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                {completedActionsCount} / {growthActions.length} {t("Completadas", "Done")}
              </span>
            </div>
          </div>

      {/* NEXT BEST ACTION BLOCK (Requirement 10) - Displays Action #1 */}
      {topNextBestAction && (
        <div className="space-y-3">
          <NextActionCard
            nextAction={topNextBestAction}
            onExecute={handleExecuteNextBestAction}
            t={t}
            isHero={true}
          />

          <div className="flex justify-center pt-1">
            <button
              onClick={() => {
                const el = document.getElementById('bvelt-opportunities-catalog');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="py-2 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider transition border border-slate-200 dark:border-slate-700 flex items-center gap-2 cursor-pointer"
            >
              <span>{t("VER TODAS LAS OPORTUNIDADES ↓", "VIEW ALL OPPORTUNITIES ↓")}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Commercial Summary KPI Bar (Requirement 9) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" />
            <span>{t("Resumen Comercial Real", "Real Commercial Summary")}</span>
          </h3>
          <button
            onClick={() => navigateTo({ tab: 'leads', tool: 'crm_inbox' })}
            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 underline cursor-pointer"
          >
            {t("Ir al CRM de Leads →", "Go to Leads CRM →")}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Open Opportunities */}
          <div 
            onClick={() => navigateTo({ tab: 'leads', tool: 'crm_inbox' })}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-indigo-500/40 hover:shadow-md transition cursor-pointer group"
          >
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
              <Sparkles size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("Oportunidades", "Open Opps")}
            </span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {commercialSummary.openOpps}
            </p>
            <span className="text-[9px] font-bold text-indigo-500">
              {t("En pipeline", "In pipeline")}
            </span>
          </div>

          {/* 2. Leads to Contact */}
          <div 
            onClick={() => {
              if (onExecuteAction) {
                onExecuteAction({
                  id: 'kpi_contact_leads',
                  action: t("Contactar Leads Pendientes", "Contact Pending Leads"),
                  whyNow: t(`Tienes ${commercialSummary.leadsToContact} prospectos sin contactar. Enviar mensaje ahora duplica la tasa de cierre.`, `You have ${commercialSummary.leadsToContact} uncontacted leads. Sending a message now doubles close rate.`),
                  expectedBenefit: t("Cerrar trabajo pagado", "Close paying job"),
                  destinationCode: 'CONTACT_LEAD',
                  contextData: {
                    leadName: leads?.[0]?.name || t("Cliente Potencial", "Lead"),
                    phone: leads?.[0]?.phone || leads?.[0]?.telefono || '',
                    email: leads?.[0]?.email || ''
                  }
                });
              } else {
                navigateTo({ tab: 'leads', tool: 'crm_inbox' });
              }
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-amber-500/40 hover:shadow-md transition cursor-pointer group"
          >
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
              <Users size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("Sin Contactar", "To Contact")}
            </span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {commercialSummary.leadsToContact}
            </p>
            <span className="text-[9px] font-bold text-amber-500">
              {t("Nuevos leads", "New leads")}
            </span>
          </div>

          {/* 3. Follow-ups Due */}
          <div 
            onClick={() => {
              if (onExecuteAction) {
                onExecuteAction({
                  id: 'kpi_followup_due',
                  action: t("Seguimiento de Presupuesto", "Estimate Follow-Up"),
                  whyNow: t(`Tienes ${commercialSummary.followUpsDue} seguimientos pendientes. Los clientes agradecen la proactividad.`, `You have ${commercialSummary.followUpsDue} follow-ups due. Clients appreciate proactive outreach.`),
                  expectedBenefit: t("Confirmar fecha de trabajo", "Confirm job start date"),
                  destinationCode: 'SEND_QUOTE',
                  contextData: {
                    leadName: t("Cliente", "Client"),
                    amount: profile?.avgTicketUsd || profile?.avgTicket || '450'
                  }
                });
              } else {
                navigateTo({ tab: 'leads', tool: 'crm_inbox' });
              }
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-cyan-500/40 hover:shadow-md transition cursor-pointer group"
          >
            <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl group-hover:scale-110 transition-transform">
              <Calendar size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("Seguimiento", "Follow-ups Due")}
            </span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {commercialSummary.followUpsDue}
            </p>
            <span className="text-[9px] font-bold text-cyan-500">
              {t("Pendientes", "Pending")}
            </span>
          </div>

          {/* 4. Quotes Sent */}
          <div 
            onClick={() => {
              if (onExecuteAction) {
                onExecuteAction({
                  id: 'kpi_quotes_sent',
                  action: t("Enviar Presupuesto Rápido", "Send Fast Estimate"),
                  whyNow: t("Envía el presupuesto por WhatsApp con desglose claro para cerrar el trato.", "Send estimate via WhatsApp with clear pricing to close the deal."),
                  expectedBenefit: t("Cerrar trabajo esta semana", "Close job this week"),
                  destinationCode: 'SEND_QUOTE',
                  contextData: {
                    leadName: t("Cliente Potencial", "Lead"),
                    amount: profile?.avgTicketUsd || profile?.avgTicket || '450'
                  }
                });
              } else {
                navigateTo({ tab: 'leads', tool: 'crm_inbox' });
              }
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-purple-500/40 hover:shadow-md transition cursor-pointer group"
          >
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
              <FileText size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("Cotizados", "Quotes Sent")}
            </span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {commercialSummary.quotesSent}
            </p>
            <span className="text-[9px] font-bold text-purple-500">
              {t("Presupuestos", "Proposals")}
            </span>
          </div>

          {/* 5. Won */}
          <div 
            onClick={() => navigateTo({ tab: 'leads', tool: 'crm_inbox' })}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-emerald-500/40 hover:shadow-md transition cursor-pointer group"
          >
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
              <Award size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("Ganados", "Won Deals")}
            </span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {commercialSummary.wonDeals}
            </p>
            <span className="text-[9px] font-bold text-emerald-500">
              {t("Clientes", "Clients")}
            </span>
          </div>

          {/* 6. Real Revenue */}
          <div 
            onClick={() => navigateTo({ tab: 'leads', tool: 'crm_inbox' })}
            className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-300/60 dark:border-emerald-800/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-emerald-500 hover:shadow-md transition cursor-pointer group shadow-xs"
          >
            <div className="p-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              {t("Ingreso Real", "Real Revenue")}
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono truncate max-w-[110px]" title={`$${commercialSummary.realRevenue.toLocaleString()}`}>
              ${commercialSummary.realRevenue.toLocaleString()}
            </p>
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              ✓ {t("REAL • CRM", "ACTUAL • CRM")}
            </span>
          </div>
        </div>

        {/* Profit Visibility Foundation Card */}
        <div className="mt-4 bg-slate-900/40 dark:bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <DollarSign size={14} />
                {t("PROFIT VISIBILITY FOUNDATION", "PROFIT VISIBILITY FOUNDATION")}
              </span>
              <h4 className="text-base font-black text-white tracking-tight">
                {t("Calidad Económica y Margen Real vs. Modelado", "Economic Quality & Real vs Modeled Margin")}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                profitSummary.provenance === 'REAL' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                profitSummary.provenance === 'USER_PROVIDED' ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' :
                profitSummary.provenance === 'MODELED' ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' :
                'bg-slate-500/15 border-slate-500/30 text-slate-400'
              }`}>
                {profitSummary.provenance === 'REAL' ? t('✓ GANANCIA REAL (CONFIRMADA)', '✓ REAL PROFIT (CONFIRMED)') :
                 profitSummary.provenance === 'USER_PROVIDED' ? t('✎ ESTIMACIÓN COSTO USUARIO', '✎ USER COST ESTIMATE') :
                 profitSummary.provenance === 'MODELED' ? t('⚡ MARGEN MODELADO SECTOR', '⚡ SECTOR MODELED MARGIN') :
                 t('N/D SIN DATOS SUFICIENTES', 'N/A INSUFFICIENT DATA')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">{t("Ingresos Reales Ganados", "Real Revenue Won")}</span>
              <span className="text-lg font-black text-emerald-400 font-mono">
                ${profitSummary.totalRealRevenue.toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-500 block">
                {profitSummary.wonDealsCount} {t("clientes cerrados", "closed deals")}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">{t("Costos Directos", "Direct Costs")}</span>
              <span className="text-lg font-black text-slate-300 font-mono">
                ${(profitSummary.totalActualDirectCosts > 0 ? profitSummary.totalActualDirectCosts : profitSummary.totalModeledDirectCosts).toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-500 block">
                {profitSummary.totalActualDirectCosts > 0 ? t("Ingresado por usuario", "User entered") : `${t("Modelo sectorial", "Sector model")} (${profitSummary.sectorCategory})`}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">{t("Ganancia Neta Calculada", "Net Profit Calculated")}</span>
              <span className="text-lg font-black text-white font-mono">
                {profitSummary.actualNetProfit !== null 
                  ? `$${profitSummary.actualNetProfit.toLocaleString()}`
                  : (profitSummary.modeledNetProfit !== null ? `$${profitSummary.modeledNetProfit.toLocaleString()}` : 'N/D')}
              </span>
              <span className="text-[9px] text-slate-500 block">
                {profitSummary.actualNetProfit !== null ? t("Real", "Actual") : t("Modelado", "Modeled")}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">{t("Margen %", "Margin %")}</span>
              <span className="text-lg font-black text-cyan-400 font-mono">
                {profitSummary.actualMarginPercent !== null 
                  ? `${profitSummary.actualMarginPercent}%`
                  : (profitSummary.modeledMarginPercent !== null ? `${profitSummary.modeledMarginPercent}%` : 'N/D')}
              </span>
              <span className="text-[9px] text-slate-500 block">
                {profitSummary.actualMarginPercent !== null ? t("Margen Real", "Real Margin") : t("Margen Modelado", "Modeled Margin")}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">
              🛡️ <strong className="text-slate-300">{t("Garantía de Integridad Bvelt:", "Bvelt Integrity Guarantee:")}</strong> {t("Nunca simulamos contabilidad fiscal. Los ingresos reales se confirman vía CRM y los costos no registrados se modelan con benchmarks sectoriales explícitos.", "We never simulate accounting software. Real revenues are confirmed via CRM and unrecorded costs are modeled with explicit sector benchmarks.")}
            </p>
            <button
              onClick={() => navigateTo({ tab: 'leads', tool: 'crm_inbox' })}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs whitespace-nowrap transition cursor-pointer self-end sm:self-auto"
            >
              {t("Gestionar Costos en CRM →", "Manage Costs in CRM →")}
            </button>
          </div>
        </div>
      </div>

      {/* Canonical Unified Action Center Summary & Deep Link */}
      <div className="bg-gradient-to-br from-indigo-500/5 via-transparent to-indigo-600/5 border border-indigo-500/20 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Zap size={22} className="animate-pulse" />
            </span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block mb-0.5">
                {t("CENTRO DE ACCIONES RECOMENDADAS", "RECOMMENDED ACTIONS CENTER")}
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {t("Acciones de Crecimiento Priorizadas", "Prioritized Growth Actions")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-lg">
                {t("Tienes acciones críticas pendientes para capturar clientes potenciales y optimizar tu autoridad local.", "You have critical pending actions to capture potential leads and optimize your local authority.")}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (setActiveTab) setActiveTab('action_center');
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-xs hover:shadow-md flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <span>{t("Ver todas las acciones pendientes →", "View all pending actions →")}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-white/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-805 p-4 rounded-2xl flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{t("Alta Prioridad", "High Priority")}</span>
            <span className="text-sm font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20">
              {bveltRecommendedActions.filter((a: any) => a.priority === 'VERY_HIGH' || a.priority === 'HIGH').length}
            </span>
          </div>
          <div className="bg-white/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{t("Victorias Rápidas", "Quick Wins")}</span>
            <span className="text-sm font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
              {bveltRecommendedActions.filter((a: any) => {
                const mins = a.estimatedMinutes || (parseInt(a.estimatedTime, 10) || 5);
                return mins <= 5;
              }).length}
            </span>
          </div>
          <div className="bg-white/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{t("Total Pendientes", "Total Pending")}</span>
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20">
              {bveltRecommendedActions.length + (growthActions?.filter((act: any) => act.status !== 'COMPLETED')?.length || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Bvelt Outcomes & Conversion Funnel */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 block mb-1">
              {t("MEDICIÓN DE IMPACTO Y CONVERSIÓN", "IMPACT & CONVERSION TRACKING")}
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {t("Resultados y Embudo de Conversión Bvelt", "Bvelt Outcomes & Conversion Funnel")}
            </h3>
          </div>
          {handleLogSaleModal && (
            <button
              onClick={handleLogSaleModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl transition cursor-pointer"
            >
              + {t("Registrar Venta", "Log Sale")}
            </button>
          )}
        </div>

        {/* Funnel Stage Progress */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {activeConversionStages.map(stg => {
            const evStatus: EvidenceStatus = stg.stage === 'VISITS' ? (profile?.gmbConnected ? 'VERIFIED' : 'ESTIMATED') : 'VERIFIED';
            const badge = getEvidenceBadge(evStatus, t);
            return (
              <div key={stg.stage} className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-slate-400">{stg.label}</span>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${badge.colorClass}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {typeof stg.count === 'number' ? stg.count.toLocaleString() : (stg.count || t("N/D", "N/A"))}
                </p>
                <p className="text-[10px] font-bold text-indigo-500">
                  {stg.conversionRate !== null && stg.conversionRate !== undefined ? `${stg.conversionRate}% conv.` : t('N/A conv.', 'N/A conv.')}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 30-Day Growth Plan Accordion */}
      <div className="bg-white dark:bg-[#0f172a]/85 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-indigo-500/30 p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t("Plan de Crecimiento a 30 Días", "30-Day Growth Plan")}
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {t("Tu mapa de ruta estructurado en 4 semanas para dominar tu mercado local.", "Your 4-week structured roadmap to dominate your local market.")}
            </p>
          </div>
          {planStart ? (
            <div className="text-right">
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                {t(`Día ${currentPlanDay} de 30`, `Day ${currentPlanDay} of 30`)}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {completedActionsCount} / {growthActions.length} {t('acciones completadas', 'actions completed')}
              </span>
            </div>
          ) : (
            <button
              onClick={handleStartPlan}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              {t("INICIAR PLAN", "START PLAN")}
            </button>
          )}
        </div>

        {planStart && (
          <div className="space-y-6">
            {/* Progress bar */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{t("Progreso General", "Overall Progress")}</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Weeks Accordion */}
            <div className="space-y-3">
              {weeks.map(wk => {
                const isOpen = openWeeks[wk.weekNum];
                const wkActs = wk.acts ?? [];
                const wkCompleted = wkActs.filter(a => a.status === 'COMPLETED').length;
                const wkTotal = wkActs.length;

                return (
                  <div key={wk.weekNum} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 transition">
                    <button
                      onClick={() => setOpenWeeks(prev => ({ ...prev, [wk.weekNum]: !prev[wk.weekNum] }))}
                      className="w-full p-4 flex items-center justify-between text-left bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                          {wk.title}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {wk.subtitle}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                          {wkCompleted} / {wkTotal} {t('completado', 'completed')}
                        </span>
                        <ArrowRight size={16} className={`text-slate-400 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/30 dark:bg-slate-950/20">
                        {wkActs.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2 text-center">
                            {t('No hay acciones específicas asignadas a esta semana todavía.', 'No specific actions assigned to this week yet.')}
                          </p>
                        ) : (
                          wkActs.map(act => {
                            const isDone = act.status === 'COMPLETED';
                            return (
                              <div key={act.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${isDone ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
                                <div className="flex items-center gap-3 flex-1">
                                  <button
                                    onClick={() => handleToggleActionComplete(act.id)}
                                    className={`w-5 h-5 rounded flex items-center justify-center transition cursor-pointer flex-shrink-0 ${isDone ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 dark:border-slate-700 bg-transparent'}`}
                                  >
                                    {isDone && <CheckCircle size={12} className="fill-current" />}
                                  </button>
                                  <div className="space-y-0.5">
                                    <p className={`text-xs font-bold ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                      {act.title}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                      {act.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleActionComplete(act.id)}
                                    className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition cursor-pointer ${isDone ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                  >
                                    {isDone ? t('Completado', 'Completed') : t('Completar', 'Complete')}
                                  </button>
                                  {act.actionTab && (
                                    <button
                                      onClick={() => {
                                        if (onExecuteAction) {
                                          onExecuteAction({
                                            id: act.id,
                                            action: act.title,
                                            whyNow: act.description,
                                            expectedBenefit: t("Completar objetivo del roadmap", "Complete roadmap objective"),
                                            destinationCode: (act.title || '').toLowerCase().includes('reseñ') || (act.title || '').toLowerCase().includes('review') ? 'REQUEST_REVIEW' : (act.title || '').toLowerCase().includes('lead') || (act.title || '').toLowerCase().includes('contact') ? 'CONTACT_LEAD' : 'SEND_QUOTE',
                                            contextData: {
                                              leadName: leads?.[0]?.name || t("Cliente", "Client"),
                                              phone: leads?.[0]?.phone || leads?.[0]?.telefono || ''
                                            }
                                          });
                                        } else {
                                          setActiveTab(act.actionTab);
                                        }
                                      }}
                                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                                      title={t("Ejecutar acción", "Execute action")}
                                    >
                                      <ArrowRight size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
};
