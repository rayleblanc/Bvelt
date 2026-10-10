import React, { useState, useMemo } from 'react';
import { 
  Zap, Check, ShieldCheck, Star, Sparkles, ArrowRight, 
  Lock, RefreshCw, AlertCircle, FileSpreadsheet, TrendingUp,
  Target, Send, Share2, HelpCircle, DollarSign, Award
} from 'lucide-react';
import { RecoveryFeeService, DEFAULT_RECOVERY_FEE } from '../services/recoveryFeeService';
import { UsdtPaymentModal } from './dashboard/UsdtPaymentModal';
import { CreditCard } from 'lucide-react';
import { recordBveltEvent } from '../knowledge/memory/bemStore';
import { auth } from '../lib/firebase';

interface PlansViewProps {
  t: (es: string, en: string) => string;
  handleCheckout: (priceIdOrPlan?: string, planType?: string) => Promise<void>;
  checkoutLoading: string | null;
  priceProMonthly: string;
  priceProYearly: string;
  hasActivatedTrial?: boolean;
  hasUsedTrial?: boolean;
  trialDaysRemaining?: number;
  onActivateTrial?: () => void;
  profile?: any;
}

export const PlansView: React.FC<PlansViewProps> = ({
  t,
  handleCheckout,
  checkoutLoading,
  priceProMonthly,
  priceProYearly,
  hasActivatedTrial = false,
  hasUsedTrial = false,
  trialDaysRemaining = 0,
  onActivateTrial,
  profile
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'usdt'>('card');
  const [showUsdtModal, setShowUsdtModal] = useState<boolean>(false);

  // Founding Member Seats (Máximo 20 cupos)
  const MAX_FOUNDING_SEATS = 20;
  const [claimedSeats, setClaimedSeats] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bvelt_founding_seats_claimed_v1');
        if (saved) return Math.min(MAX_FOUNDING_SEATS, parseInt(saved, 10));
      }
    } catch {}
    return 17; // 17 de 20 activados por defecto (quedan 3 cupos)
  });
  const [acceptedCaseStudy, setAcceptedCaseStudy] = useState<boolean>(false);

  const handleClaimFoundingSeat = () => {
    if (!acceptedCaseStudy) return;

    const newCount = Math.min(MAX_FOUNDING_SEATS, claimedSeats + 1);
    setClaimedSeats(newCount);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bvelt_founding_seats_claimed_v1', String(newCount));
      } catch {}
    }

    // Emite evento BEM: founding_activated
    recordBveltEvent({
      tenantId: auth?.currentUser?.uid || profile?.id || 'default_business',
      type: 'founding_activated',
      sourceType: 'founding_seat_engine',
      sourceName: 'Founding Member Seat',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_ACTION_INTENT',
      consentScope: 'private',
      meta: {
        plan: 'founding_seat',
        monthlyPrice: 49,
        rateLocked: true,
        caseStudyAgreed: true,
        seatsClaimed: newCount,
        maxSeats: MAX_FOUNDING_SEATS
      }
    });

    if (paymentMethod === 'usdt') {
      setShowUsdtModal(true);
    } else if (canActivateTrialDirectly && onActivateTrial) {
      onActivateTrial();
    } else {
      handleCheckout(priceProMonthly, 'monthly');
    }
  };

  const canActivateTrialDirectly = !hasActivatedTrial && !hasUsedTrial && Boolean(onActivateTrial);

  // Detect if opportunity computed $0 from public signals in code
  const detectedOpportunityAmount = useMemo(() => {
    try {
      if (profile?.latestOpportunityAmount !== undefined) {
        return Number(profile.latestOpportunityAmount);
      }
      const raw = localStorage.getItem('bvelt_latest_business_scan');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.evidences?.financial_opportunity?.value !== undefined) {
          return Number(parsed.evidences.financial_opportunity.value);
        }
        if (parsed?.recoverableOpportunity !== undefined) {
          return Number(parsed.recoverableOpportunity);
        }
      }
    } catch {}
    return null;
  }, [profile]);

  const isZeroOpportunity = detectedOpportunityAmount !== null && detectedOpportunityAmount === 0;

  return (
    <section className="space-y-8 max-w-5xl mx-auto py-2 animate-fade-in">
      {/* Header Banner - Revenue Recovery Focused (Not SEO Tools) */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20 text-xs font-black uppercase tracking-wider">
          <Sparkles size={14} className="text-amber-400" />
          {t("Sistema Operativo de Recuperación de Ingresos", "The Revenue Recovery Operating System")}
        </div>
        
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {t(
            "¿Cuánto dinero estás dejando sobre la mesa cada mes? Recupera tus ingresos perdidos con Bvelt.",
            "How much revenue are you leaving on the table every month? Stop revenue leaks and recover lost jobs with Bvelt."
          )}
        </h1>
        
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed max-w-2xl mx-auto">
          {t(
            "Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.",
            "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send."
          )}
        </p>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
          {t(
            "Identifica demanda local, ejecuta la siguiente mejor acción comercial en 1 toque y audita resultados con evidencias.",
            "Find local demand, execute the next best commercial action in 1 tap, and prove verified outcomes."
          )}
        </p>

        {/* 6 Core Revenue Recovery Features List */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-w-3xl mx-auto pt-2 text-left">
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
              <TrendingUp size={15} />
              <span>{t("Revenue Opportunity", "Revenue Opportunity")}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              {t("Cálculo transparente de fugas comerciales.", "Transparent leakage & revenue gap math.")}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <Target size={15} />
              <span>{t("Next Best Action", "Next Best Action")}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              {t("Priorización diaria con mayor ROI esperado.", "Daily top-priority action with highest ROI.")}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <Send size={15} />
              <span>{t("Execute Follow-ups", "Execute Follow-ups")}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              {t("Seguimiento en 1 toque por WhatsApp/SMS.", "1-tap dispatch for stale quotes & leads.")}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs">
              <ShieldCheck size={15} />
              <span>{t("Proof & Evidence", "Proof & Evidence")}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              {t("Validación T1/T2 sin números inventados.", "Audited proof with zero fake statistics.")}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
              <Share2 size={15} />
              <span>{t("Shareable Report", "Shareable Report")}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              {t("Reporte diagnóstico con enlace público.", "Shareable web audit report for partners.")}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
              <FileSpreadsheet size={15} />
              <span>{t("Outcome History", "Outcome History")}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              {t("Ledger auditable: Sugerido → Medido.", "Auditable ledger: Suggested → Measured.")}
            </p>
          </div>
        </div>

        {/* Operational Co-existence Callout */}
        <div className="p-3.5 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-left max-w-2xl mx-auto flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
          <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
          <p className="font-medium">
            <strong className="text-slate-900 dark:text-slate-100">
              {t("Coexiste con tus herramientas actuales (Jobber, Housecall, ServiceTitan):", "Coexists with your current tools (Jobber, Housecall, ServiceTitan):")}
            </strong>{" "}
            {t("Bvelt actúa como el motor de captación y recuperación de ingresos. No reemplaza tu sistema de facturación o calendario.", "Bvelt acts as your revenue recovery engine. It does not replace your billing or dispatch software.")}
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 gap-1 mt-4">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t("Plan Mensual", "Monthly Plan")}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{t("Plan Anual VIP", "VIP Annual Plan")}</span>
            <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-full">
              {t("Ahorra $198", "Save $198")}
            </span>
          </button>
        </div>

        {/* Payment Method Selector: Pagar con tarjeta | Pagar con USDT */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CreditCard size={14} />
              <span>{t("Pagar con tarjeta", "Pay with card")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('usdt')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                paymentMethod === 'usdt'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="font-mono font-bold text-xs">₮</span>
              <span>{t("Pagar con USDT", "Pay with USDT")}</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-950/40 text-emerald-200 font-extrabold border border-emerald-400/30">BEP-20</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trial Status Notice if Active */}
      {hasActivatedTrial && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-700 dark:text-amber-300 text-left">
          <div className="flex items-center gap-2 font-bold">
            <Zap size={16} className="text-amber-500 shrink-0" />
            <div>
              <p>
                {t(`Tienes una prueba activa (${trialDaysRemaining} días restantes).`, `You have an active trial (${trialDaysRemaining} days remaining).`)}
              </p>
              <p className="text-[11px] font-normal text-amber-800 dark:text-amber-200">
                {t("Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.", "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send.")}
              </p>
            </div>
          </div>
          <span className="font-extrabold uppercase text-[10px] shrink-0 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">{t("Prueba Activa", "Active Trial")}</span>
        </div>
      )}

      {/* OPORTUNIDAD FOUNDING SEAT (MÁX 20 CUPOS) */}
      {claimedSeats < MAX_FOUNDING_SEATS && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-950/60 via-slate-900 to-indigo-950/60 border-2 border-amber-500/50 shadow-2xl space-y-4 text-left relative overflow-hidden animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Award size={12} />
                  {t("Oficial Founding Seat", "Official Founding Seat")}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {t(`${MAX_FOUNDING_SEATS - claimedSeats} de ${MAX_FOUNDING_SEATS} cupos restantes`, `${MAX_FOUNDING_SEATS - claimedSeats} of ${MAX_FOUNDING_SEATS} seats remaining`)}
                </span>
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">
                {t("🔥 Miembro Fundador — $49/mes Congelado de Por Vida", "🔥 Founding Member Seat — $49/mo Rate Lock")}
              </h3>
            </div>

            <div className="text-right shrink-0">
              <div className="text-2xl font-black text-amber-400">
                $49 <span className="text-xs font-semibold text-slate-300">/{t("mes", "mo")}</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                {t("Tarifa protegida de por vida", "Locked rate while active")}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {t(
              "Tu tarifa pública de $49/mes queda congelada de por vida mientras tu cuenta permanezca activa. Sin subidas de precio ni sorpresas futuras.",
              "Your public rate of $49/mo is locked for life as long as your account remains active. Zero price hikes or future surprises."
            )}
          </p>

          {/* Requisito UI obligatorio: Checkbox caso de estudio */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-amber-500/30 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="foundingCaseStudyCheckbox"
              checked={acceptedCaseStudy}
              onChange={e => setAcceptedCaseStudy(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="foundingCaseStudyCheckbox" className="text-xs text-slate-200 font-semibold cursor-pointer leading-snug">
              {t(
                "Acepto ser caso de estudio anónimo o con permiso para Bvelt.",
                "I agree to be an anonymous or permitted case study for Bvelt."
              )}
            </label>
          </div>

          {/* Action button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-400">
              {t(`Activos: ${claimedSeats} de ${MAX_FOUNDING_SEATS} asientos`, `Claimed: ${claimedSeats} of ${MAX_FOUNDING_SEATS} seats`)}
            </span>
            <button
              type="button"
              disabled={!acceptedCaseStudy}
              onClick={handleClaimFoundingSeat}
              className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{t("Reclamar Asiento Fundador ($49/mes Congelado)", "Claim Founding Seat ($49/mo Locked)")}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* SECUNDARIO CHECKOUT: RESCATE DE OPORTUNIDAD INDIVIDUAL ($0 HOY - FEE FIJO $19) */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border-2 border-emerald-500/40 shadow-xl space-y-4 text-left relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {t("Modelo Rescate Individual", "Single Opportunity Rescue")}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {t("Sin Mensualidad", "No Monthly Retainer")}
              </span>
            </div>
            <h3 className="text-xl font-black text-white">
              {t("Rescata 1 Oportunidad — $0 para Empezar", "Rescue 1 Opportunity — $0 to Start")}
            </h3>
          </div>

          <div className="text-right sm:text-right">
            <div className="text-2xl font-black text-emerald-400">
              $0 <span className="text-xs font-semibold text-slate-300">{t("hoy", "today")}</span>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {t(`Fee fijo $${DEFAULT_RECOVERY_FEE} solo si confirmas`, `Fixed fee $${DEFAULT_RECOVERY_FEE} only if confirmed`)}
            </span>
          </div>
        </div>

        {/* UI Clara: No pagas mensualidad por este rescate. Si recuperamos y lo confirmas, fee $X */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <p className="text-xs font-bold text-emerald-300 leading-relaxed">
            {t(
              `“No pagas mensualidad por este rescate. Si recuperamos y lo confirmas, fee fijo de $${DEFAULT_RECOVERY_FEE}.”`,
              `“You don't pay a monthly subscription for this rescue. If we recover and you confirm it, fixed fee $${DEFAULT_RECOVERY_FEE}.”`
            )}
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {t(
              "Sin money transmitter: Bvelt nunca custodia ni retiene dinero de tu cliente final. Cobras el 100% de tu trabajo directamente. El fee fijo de software se liquida únicamente cuando marcas el trabajo ganado o se verifica la respuesta.",
              "No money transmitter: Bvelt never holds or custody funds from your end clients. You collect 100% of your job directly. The fixed software fee is due only when you mark the job won or a client reply is verified."
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-4 text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Check size={14} /> {t("Redacción de rescate en WhatsApp", "WhatsApp recovery drafting")}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Check size={14} /> {t("Verificación estricta (Regla 1)", "Strict Rule 1 verification")}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Check size={14} /> {t("Si no hay resultado, $0", "If zero result, $0")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              RecoveryFeeService.startRecovery({
                opportunityId: `opp_rescue_${Date.now()}`,
                businessId: profile?.id || 'default_business',
                clientName: profile?.name || 'Cliente Local',
                estimatedValue: 450,
                fixedFee: DEFAULT_RECOVERY_FEE
              });
              if (onActivateTrial) {
                onActivateTrial();
              } else {
                window.location.href = '/?tab=execute';
              }
            }}
            className="w-full sm:w-auto py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-98"
          >
            <span>{t(`Activar Rescate de 1 Oportunidad ($0 Hoy)`, `Start 1 Opportunity Rescue ($0 Today)`)}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid (Stripe Suscripción $49/mes Sigue Disponible) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MONTHLY PLAN CARD */}
        <div className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-6 ${
          billingCycle === 'monthly'
            ? 'bg-white dark:bg-slate-900/90 border-indigo-500 shadow-xl ring-2 ring-indigo-500/30'
            : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-90'
        }`}>
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {t("Plan Flex", "Flex Plan")}
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {t("Mensual Pro", "Pro Monthly")}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                {t("Sin Compromiso", "No Contract")}
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-slate-900 dark:text-white">$49</span>
              <span className="text-xs font-bold text-slate-500">/{t("mes", "month")}</span>
            </div>

            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t("Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.", "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send.")}
            </p>

            <ul className="space-y-2.5 pt-2 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                <Check size={14} className="text-indigo-500 shrink-0" />
                <span>{t("Before You Send: Verificación de completitud comercial en cotizaciones", "Before You Send: Commercial completeness checks on every quote")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-indigo-500 shrink-0" />
                <span>{t("60 Escaneos de Competencia y Zona / Día", "60 Competitor & Local Scans / Day")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-indigo-500 shrink-0" />
                <span>{t("250 Generaciones y Respuestas IA / Día", "250 AI Co-Pilot Generations / Day")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-indigo-500 shrink-0" />
                <span>{t("150 Borradores de Seguimiento Comercial / Día", "150 Commercial Outreach Drafts / Day")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-indigo-500 shrink-0" />
                <span>{t("50 Auditorías Profundas / Día", "50 Deep In-Depth Audits / Day")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-indigo-500 shrink-0" />
                <span>{t("Historial Longitudinal y Ledger de Resultados", "Outcome History & Result Ledger")}</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={checkoutLoading === 'monthly'}
            onClick={() => {
              if (paymentMethod === 'usdt') {
                setShowUsdtModal(true);
              } else if (canActivateTrialDirectly && onActivateTrial) {
                onActivateTrial();
              } else {
                handleCheckout(priceProMonthly, 'monthly');
              }
            }}
            className={`w-full py-3.5 px-4 font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              paymentMethod === 'usdt'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-98'
                : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white'
            }`}
          >
            {checkoutLoading === 'monthly' ? (
              <span>{t("Procesando pago seguro...", "Processing secure payment...")}</span>
            ) : paymentMethod === 'usdt' ? (
              <>
                <span>{t("Pagar $49 USDT (BEP-20) — Activar Inmediato", "Pay $49 USDT (BEP-20) — Instant Activation")}</span>
                <ArrowRight size={14} />
              </>
            ) : canActivateTrialDirectly ? (
              <>
                <span>{t("Activar Prueba Gratis de 7 Días — $49/mes", "Start 7-Day Free Trial — $49/mo")}</span>
                <ArrowRight size={14} />
              </>
            ) : (
              <>
                <span>{t("Suscribirse al Plan Mensual — $49/mes", "Subscribe to Monthly Plan — $49/mo")}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>

        {/* YEARLY PLAN CARD (FEATURED) */}
        <div className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-6 relative overflow-hidden ${
          billingCycle === 'yearly'
            ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border-indigo-500 shadow-2xl ring-2 ring-indigo-500/50 text-white'
            : 'bg-white dark:bg-slate-900 border-indigo-500/50'
        }`}>
          <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-md">
            {t("RECOMENDADO VIP", "RECOMMENDED VIP")}
          </div>

          <div className="space-y-4 pt-1">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Star size={12} className="fill-current" />
                  {t("Mejor Valor Comercial", "Best Commercial Value")}
                </span>
                <h3 className="text-xl font-black text-white mt-1">
                  {t("Anual Pro VIP", "Pro VIP Annual")}
                </h3>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">$390</span>
              <span className="text-xs font-bold text-indigo-300">/{t("año", "year")}</span>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                {t("$32.50/mes", "$32.50/mo")}
              </span>
            </div>

            <p className="text-xs text-indigo-200">
              {t("Ahorro directo de $198 frente al plan mensual. Incluye soporte prioritario por WhatsApp y monitoreo continuo.", "Direct $198 savings vs monthly. Includes priority WhatsApp support and continuous monitoring.")}
            </p>

            <ul className="space-y-2.5 pt-2 text-xs text-slate-200">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-amber-400 shrink-0" />
                <span><strong>{t("Todo lo del Plan Mensual", "Everything in Monthly Plan")}</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-amber-400 shrink-0" />
                <span>{t("Historial Continuo de Evidencia y Registro V1", "Continuous Evidence History & Record V1")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-amber-400 shrink-0" />
                <span>{t("Soporte Prioritario VIP vía WhatsApp", "VIP Priority Support via WhatsApp")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-amber-400 shrink-0" />
                <span>{t("Capacidad ampliada para flotas y múltiples rutas", "Expanded capacity for fleets and multiple routes")}</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={checkoutLoading === 'yearly'}
            onClick={() => {
              if (canActivateTrialDirectly && onActivateTrial) {
                onActivateTrial();
              } else {
                handleCheckout(priceProYearly, 'yearly');
              }
            }}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {checkoutLoading === 'yearly' ? (
              <span>{t("Procesando pago seguro...", "Processing secure payment...")}</span>
            ) : canActivateTrialDirectly ? (
              <>
                <Zap size={16} className="fill-current text-slate-950" />
                <span>{t("Iniciar Prueba Gratis de 7 Días — $390/año", "Start 7-Day Free Trial — $390/yr")}</span>
                <ArrowRight size={14} />
              </>
            ) : (
              <>
                <Zap size={16} className="fill-current text-slate-950" />
                <span>{t("Suscribirse al Plan Anual VIP — $390/año", "Subscribe to VIP Annual Plan — $390/yr")}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Honest Guarantee Callout (Code-Supported: conditional on detected $0 vs normal) */}
      {isZeroOpportunity ? (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-3xl space-y-2 text-left">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-black text-sm">
            <AlertCircle size={18} className="text-amber-500 shrink-0" />
            <span>{t("Garantía Bvelt de Oportunidad ($0 en fugas detectadas)", "Bvelt Opportunity Guarantee ($0 leaks detected)")}</span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            {t(
              "Tus señales públicas actuales no muestran fugas de ingresos recuperables ($0 detectados). Si no encontramos oportunidades claras para tu oficio en tu zona, puedes solicitar una extensión gratuita de prueba o soporte técnico directo antes de cualquier cargo.",
              "Your current public signals show $0 in detected recoverable leaks. If we do not uncover clear opportunities for your trade in your zip code, request a free trial extension or direct technical review before any charge."
            )}
          </p>
        </div>
      ) : (
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl space-y-2 text-left">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
            <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
            <span>{t("Garantía de Recuperación de Ingresos (7 Días Sin Riesgo)", "Revenue Recovery Guarantee (7-Day Risk-Free)")}</span>
          </div>
          <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
            {t(
              "Si en tu primera semana no identificas oportunidades de ingresos claras para cerrar tu próximo trabajo de servicios, puedes cancelar con 1 solo clic antes de que termine el periodo de prueba sin coste alguno.",
              "If you do not discover clear revenue opportunities to close your next trade job in your first week, cancel with 1 click before your trial ends with zero fees."
            )}
          </p>
        </div>
      )}

      {/* Trust & Guarantee Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-center">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <ShieldCheck size={20} className="text-emerald-500 mx-auto" />
          <h4 className="text-xs font-black text-slate-900 dark:text-white">{t("7 Días Sin Riesgo", "7-Day Risk-Free Trial")}</h4>
          <p className="text-[11px] text-slate-500">{t("Cancela fácilmente antes de los 7 días si no estás 100% satisfecho.", "Cancel easily within 7 days if not 100% satisfied.")}</p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <Lock size={20} className="text-indigo-500 mx-auto" />
          <h4 className="text-xs font-black text-slate-900 dark:text-white">{t("Procesamiento Seguro Stripe", "Secure Stripe Processing")}</h4>
          <p className="text-[11px] text-slate-500">{t("Encriptación bancaria SSL de 256 bits. Tus datos financieros nunca tocan Bvelt.", "256-bit bank SSL encryption. Financial data never touches Bvelt.")}</p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <RefreshCw size={20} className="text-amber-500 mx-auto" />
          <h4 className="text-xs font-black text-slate-900 dark:text-white">{t("Límites Diarios de Prueba Protegidos", "Protected Daily Trial Limits")}</h4>
          <p className="text-[11px] text-slate-500">{t("Acceso protegido contra bucles infinitos con cuotas diarias claras.", "Hardened against infinite loops with clear daily action quotas.")}</p>
        </div>
      </div>

      {/* USDT BEP-20 Payment Modal */}
      <UsdtPaymentModal
        isOpen={showUsdtModal}
        onClose={() => setShowUsdtModal(false)}
        onSuccess={(_receipt) => {
          if (onActivateTrial) {
            onActivateTrial();
          } else {
            window.location.reload();
          }
        }}
        t={t}
      />
    </section>
  );
};
