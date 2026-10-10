import React, { useState, useMemo } from 'react';
import { Sparkles, MapPin, Star, Globe, Phone, ShieldCheck, AlertCircle, HelpCircle, ArrowRight, CheckCircle2, MessageSquare, Mail, Copy, Check, Send, Calculator } from 'lucide-react';
import { IndustryResolver } from '../knowledge/resolvers/industryResolver';
import { MarketReferenceEngine } from '../knowledge/engine/marketReferenceEngine';
import { recordBemOutcome } from '../knowledge/memory/outcomeLedgerService';

export interface LocalBusinessOpportunityData {
  id?: string;
  name: string;
  category?: string;
  address?: string;
  location?: string;
  rating?: number | string;
  reviews?: number | string;
  website?: string;
  phone?: string;
  email?: string;
  dataStatus?: 'Verified' | 'Pending' | 'N/D';
  opportunityData?: string[];
  source?: string;
  generatedPitch?: {
    shortMessage?: string;
    emailSubject?: string;
    emailBody?: string;
    callScript?: string;
  };
  leadStatus?: string;
  lastContact?: string | null;
  nextAction?: string;
}

interface ClientOpportunityCardProps {
  business: LocalBusinessOpportunityData;
  onGeneratePitch: (business: LocalBusinessOpportunityData) => void;
  onUpdateLeadStatus?: (leadId: string, newStatus: string, lastContactDate?: string) => void;
  isGenerating?: boolean;
  t?: (es: string, en?: string) => string;
  onOpenCalculationModal?: (details: any) => void;
}

export const ClientOpportunityCard: React.FC<ClientOpportunityCardProps> = ({
  business,
  onGeneratePitch,
  onUpdateLeadStatus,
  isGenerating = false,
  t = (es: string, en?: string) => en || es,
  onOpenCalculationModal,
}) => {
  const [copied, setCopied] = useState(false);

  const ratingVal = business.rating !== undefined && business.rating !== null && business.rating !== 'N/D'
    ? (typeof business.rating === 'string' ? business.rating.replace('★', '').trim() : business.rating)
    : 'N/D';

  const reviewsVal = business.reviews !== undefined && business.reviews !== null && business.reviews !== 'N/D'
    ? business.reviews
    : 'N/D';

  const status = business.dataStatus || (business.name ? 'Verified' : 'Pending');

  // Real contact channel detection
  const hasPhone = Boolean(business.phone && business.phone !== 'N/D');
  const hasEmail = Boolean(business.email && business.email !== 'N/D');
  const hasWebsite = Boolean(business.website && business.website !== 'N/D' && business.website !== 'No website');
  const hasAnyChannel = hasPhone || hasEmail || hasWebsite;

  // Real detected opportunities
  const realOpportunities: string[] = [];
  if (business.opportunityData && business.opportunityData.length > 0) {
    realOpportunities.push(...business.opportunityData);
  } else {
    if (!hasWebsite) {
      realOpportunities.push(t('Sin sitio web profesional detectado', 'No professional website detected'));
    } else {
      realOpportunities.push(t('Sitio web registrado', 'Website registered'));
    }

    if (ratingVal !== 'N/D') {
      const numR = parseFloat(String(ratingVal));
      if (!isNaN(numR) && numR < 4.2) {
        realOpportunities.push(t(`Calificación de ${numR}★ en Google Maps (oportunidad de mejora)`, `Google rating of ${numR}★ (reputation gap)`));
      } else if (!isNaN(numR) && numR >= 4.2) {
        realOpportunities.push(t(`Buena calificación (${numR}★) - Oportunidad de automatizar reseñas`, `High rating (${numR}★) - Review automation potential`));
      }
    }

    if (reviewsVal !== 'N/D') {
      const numRev = parseInt(String(reviewsVal));
      if (!isNaN(numRev) && numRev < 20) {
        realOpportunities.push(t(`Bajo volumen de reseñas (${numRev} reseñas)`, `Low review count (${numRev} reviews)`));
      }
    }

    if (!hasPhone) {
      realOpportunities.push(t('Teléfono directo pendiente de verificación', 'Direct phone pending verification'));
    }
  }

  const pitchText = business.generatedPitch?.shortMessage || `Hola, me contacto sobre ${business.name} respecto a su presencia en Google.`;

  const handleOutreachAction = (channel: 'wa' | 'call' | 'email' | 'web' | 'copy') => {
    const today = new Date().toLocaleDateString();
    
    if (channel === 'wa' && hasPhone) {
      const cleanPhone = business.phone!.replace(/[^0-9+]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(pitchText)}`, '_blank');
    } else if (channel === 'call' && hasPhone) {
      window.location.href = `tel:${business.phone}`;
    } else if (channel === 'email' && hasEmail) {
      const subj = business.generatedPitch?.emailSubject || `Propuesta comercial para ${business.name}`;
      const body = business.generatedPitch?.emailBody || pitchText;
      window.location.href = `mailto:${business.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    } else if (channel === 'web' && hasWebsite) {
      const url = business.website!.startsWith('http') ? business.website! : `https://${business.website}`;
      window.open(url, '_blank');
    } else if (channel === 'copy') {
      navigator.clipboard.writeText(pitchText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }

    if (business.id && onUpdateLeadStatus) {
      onUpdateLeadStatus(business.id, 'CONTACTED', today);
    }

    // Record BEM outcome non-blockingly (Phase F3)
    try {
      recordBemOutcome({
        businessId: business.id || 'lead_target',
        businessName: business.name,
        city: business.location || business.address,
        actionId: `act_outreach_${business.id || Date.now()}`,
        toolId: 'lead_opportunity_outreach',
        actionType: 'CONTACT_LEAD',
        channel: channel === 'wa' ? 'whatsapp' : channel === 'web' ? 'direct' : channel,
        executionState: 'SUCCESS',
        outcomeState: 'DECLARED',
        metricName: 'LEADS',
        description: `Direct outreach to ${business.name} via ${channel.toUpperCase()}`,
        value: 0,
        metadata: { businessName: business.name, category: business.category }
      });
    } catch (bemErr) {
      console.warn('[BEM] Opportunity outreach record skipped:', bemErr);
    }
  };

  // Resolve benchmark
  const marketBenchmark = useMemo(() => {
    if (!business.category) return null;
    const resolved = IndustryResolver.resolve(business.category);
    const location = business.location || business.address || "US";
    return MarketReferenceEngine.estimateMarketOpportunity(resolved.naicsCandidates, location);
  }, [business.category, business.location, business.address]);

  const oppMin = marketBenchmark?.range?.min || 0;
  const oppMax = marketBenchmark?.range?.max || 0;
  const formattedOpp = oppMin > 0 ? `+$${oppMin.toLocaleString()} - $${oppMax.toLocaleString()}/mo` : 'Pending Data';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-indigo-500/50 space-y-5">
      {/* Top Banner & Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
            {t('OPORTUNIDAD COMERCIAL DETECTADA', 'COMMERCIAL OPPORTUNITY DETECTED')}
          </span>
        </div>

        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
          status === 'Verified' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : status === 'Pending' 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
            : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
        }`}>
          {status === 'Verified' && <ShieldCheck size={12} />}
          {status === 'Pending' && <AlertCircle size={12} />}
          {status === 'N/D' && <HelpCircle size={12} />}
          {status}
        </span>
      </div>

      {/* 1. BUSINESS */}
      <div className="space-y-2">
        <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider block">{t('NEGOCIO', 'BUSINESS')}</span>
        <h3 className="text-xl font-black tracking-tight text-white line-clamp-1">
          {business.name || t('Negocio Local', 'Local Business')}
        </h3>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300">
          {business.category && (
            <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[11px] font-semibold text-indigo-300 border border-slate-700">
              {business.category}
            </span>
          )}

          {(business.address || business.location) && (
            <span className="flex items-center gap-1 text-slate-400 truncate max-w-[220px]">
              <MapPin size={13} className="text-indigo-400 shrink-0" />
              <span className="truncate">{business.address || business.location}</span>
            </span>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl">
          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">{t('Calificación', 'Rating')}</span>
          <div className="flex items-center gap-1 font-extrabold text-sm text-amber-400">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span>{ratingVal !== 'N/D' ? `${ratingVal} ★` : 'N/D'}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl">
          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">{t('Reseñas', 'Reviews')}</span>
          <span className="font-extrabold text-sm text-white">{reviewsVal}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl">
          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">{t('Sitio Web', 'Website')}</span>
          <span className="font-semibold text-xs text-slate-300 truncate block flex items-center gap-1">
            <Globe size={11} className={hasWebsite ? "text-emerald-400" : "text-slate-500"} />
            <span className="truncate">{hasWebsite ? 'Registrado' : 'N/D'}</span>
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl">
          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">{t('Teléfono', 'Phone')}</span>
          <span className="font-semibold text-xs text-slate-300 truncate block flex items-center gap-1">
            <Phone size={11} className={hasPhone ? "text-indigo-400" : "text-slate-500"} />
            <span className="truncate">{hasPhone ? business.phone : 'N/D'}</span>
          </span>
        </div>
      </div>

      {/* 2. WHY THIS BUSINESS / OPPORTUNITY */}
      <div className="bg-slate-900/90 border border-indigo-500/20 p-3.5 rounded-2xl space-y-2">
        <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1.5">
          <Sparkles size={12} className="text-amber-400" /> {t('POR QUÉ ESTE NEGOCIO / OPORTUNIDAD', 'WHY THIS BUSINESS / OPPORTUNITY')}
        </span>
        <ul className="space-y-1.5 text-xs text-slate-300">
          {realOpportunities.map((opp, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="text-indigo-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{opp}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* MODELED ESTIMATE SECTION */}
      <div className="bg-slate-950/50 border border-indigo-500/20 p-4 rounded-2xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            {t('Oportunidad Estimada', 'Estimated Opportunity')}
          </span>
          {onOpenCalculationModal && (
            <button
              onClick={() => onOpenCalculationModal({
                title: t("Modelo de Oportunidad para " + (business.name || ""), "Opportunity Model for " + (business.name || "")),
                metricName: t("Incremento de Facturación Estimado", "Estimated Billing Increase"),
                resultValue: formattedOpp,
                evidenceStatus: marketBenchmark?.evidence?.evidenceStatus || 'UNVERIFIED',
                confidence: marketBenchmark?.evidence?.confidenceLevel || 'Low',
                formula: marketBenchmark?.formula || "N/A",
                variables: [
                  { name: t("Mercado Local (Establecimientos)", "Local Market (Establishments)"), value: marketBenchmark?.observableSignal ? `${marketBenchmark.observableSignal}` : "0", source: "CBP/NAICS", status: marketBenchmark?.evidence?.evidenceStatus || 'UNVERIFIED' },
                  { name: t("Tasa de Conversión", "Conversion Rate"), value: `${marketBenchmark?.conversionRange?.max || 0}`, source: "Bvelt Benchmark", status: 'DERIVED' }
                ],
                assumptions: marketBenchmark?.assumptions || [t("Sin datos suficientes.", "Not enough data.")],
                sources: [{ name: "Market Reference Engine", type: "Oficial" }],
                explanation: t("Cálculo dinámico basado en benchmarks de mercado local.", "Dynamic calculation based on local market benchmarks.")
              })}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer flex items-center gap-1 bg-transparent border-none outline-none"
            >
              <Calculator size={11} />
              <span>{t("Ver cálculo", "View calculation")}</span>
            </button>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black text-emerald-400 tracking-tight">{formattedOpp}</span>
          <p className="text-[9px] text-slate-400 font-semibold italic mt-0.5">
            {t("Estimación modelada dinámica — no son ingresos reales", "Dynamic modelled estimate — not measured revenue")}
          </p>
        </div>
      </div>

      {/* 3. CONTACT & OUTREACH */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1">
            <Send size={12} className="text-emerald-400" /> {t('CONTACTAR CLIENTE / MOTOR DE ALCANCE', 'CONTACT CLIENT / OUTREACH ENGINE')}
          </span>
          {business.leadStatus && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
              {business.leadStatus === 'CONTACTED' ? t('CONTACTADO', 'CONTACTED') : business.leadStatus}
            </span>
          )}
        </div>

        {/* Primary CONTACT CLIENT Button */}
        <button
          onClick={() => onGeneratePitch(business)}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black py-3.5 px-6 rounded-2xl transition duration-200 shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer active:scale-98 disabled:opacity-50"
        >
          <Sparkles size={16} className={isGenerating ? "animate-spin text-amber-300" : "text-amber-300"} />
          <span>{isGenerating ? t('Generando Pitch...', 'Generating Pitch...') : t('CONTACTAR CLIENTE', 'CONTACT CLIENT')}</span>
          {!isGenerating && <ArrowRight size={16} />}
        </button>

        {/* Quick Contact Actions if Channels Available */}
        {hasAnyChannel ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {hasPhone && (
              <button
                onClick={() => handleOutreachAction('wa')}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-extrabold p-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <MessageSquare size={13} />
                <span>WhatsApp</span>
              </button>
            )}

            {hasPhone && (
              <button
                onClick={() => handleOutreachAction('call')}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-extrabold p-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Phone size={13} />
                <span>{t('Llamar', 'Call')}</span>
              </button>
            )}

            {hasEmail && (
              <button
                onClick={() => handleOutreachAction('email')}
                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-extrabold p-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Mail size={13} />
                <span>Email</span>
              </button>
            )}

            {hasWebsite && (
              <button
                onClick={() => handleOutreachAction('web')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-extrabold p-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Globe size={13} />
                <span>Website</span>
              </button>
            )}

            <button
              onClick={() => handleOutreachAction('copy')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-extrabold p-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer col-span-2 sm:col-span-1"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? t('Pitch copiado', 'Pitch copied') : t('COPIAR PITCH', 'COPY PITCH')}</span>
            </button>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl text-center text-[11px] text-amber-400 font-medium">
            {t('No hay un canal de contacto verificado disponible', 'No verified contact channel available')}
          </div>
        )}
      </div>

      {/* 4. NEXT ACTION */}
      <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs">
        <span className="text-slate-400 font-bold uppercase text-[10px]">{t('PRÓXIMA ACCIÓN:', 'NEXT ACTION:')}</span>
        <span className="font-extrabold text-indigo-300">
          {business.leadStatus === 'CONTACTED' 
            ? t('Seguimiento en 3 días', 'Follow up in 3 days')
            : business.nextAction || t('Contactar hoy', 'Contact today')}
        </span>
      </div>
    </div>
  );
};

export default ClientOpportunityCard;
