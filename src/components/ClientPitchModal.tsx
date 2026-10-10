import React, { useState } from 'react';
import { Sparkles, MessageSquare, Mail, PhoneCall, Copy, Check, UserPlus, X, Globe, Star, MapPin, Link2, ExternalLink } from 'lucide-react';
import { LocalBusinessOpportunityData } from './ClientOpportunityCard';
import { generateSignalsFromOperatorInput, saveFunnelReport, buildFunnelShareUrl } from '../services/signalsGenerator';
import { BeforeYouSendPanel } from './BeforeYouSendPanel';

export interface GeneratedPitchData {
  shortMessage: string;
  emailSubject: string;
  emailBody: string;
  callScript: string;
  opportunities?: string[];
}

interface ClientPitchModalProps {
  open: boolean;
  onClose: () => void;
  business: LocalBusinessOpportunityData | null;
  pitch: GeneratedPitchData | null;
  isLoading: boolean;
  onSaveLead: (leadData: any) => void;
  isLeadSaved?: boolean;
  t?: (es: string, en?: string) => string;
}

export const ClientPitchModal: React.FC<ClientPitchModalProps> = ({
  open,
  onClose,
  business,
  pitch,
  isLoading,
  onSaveLead,
  isLeadSaved = false,
  t = (es: string, en?: string) => en || es,
}) => {
  const [activeTab, setActiveTab] = useState<'short' | 'email' | 'script'>('short');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!open || !business) return null;

  const hasPhone = Boolean(business.phone && business.phone !== 'N/D');
  const hasEmail = Boolean(business.email && business.email !== 'N/D');
  const hasWebsite = Boolean(business.website && business.website !== 'N/D' && business.website !== 'No website');
  const hasAnyChannel = hasPhone || hasEmail || hasWebsite;

  const registerContactedLead = () => {
    if (!business) return;
    const today = new Date().toLocaleDateString();
    const leadPayload = {
      id: business.id || `lead_${Date.now()}`,
      businessName: business.name,
      client: business.name,
      category: business.category || 'Servicios locales',
      location: business.address || business.location || 'Local',
      website: business.website || '',
      phone: business.phone || '',
      email: business.email || '',
      rating: business.rating || 'N/D',
      reviews: business.reviews || 'N/D',
      source: business.source || 'Client Acquisition Engine',
      date: today,
      timestamp: new Date().toISOString(),
      opportunityData: pitch?.opportunities || business.opportunityData || [],
      generatedPitch: pitch ? {
        shortMessage: pitch.shortMessage,
        emailSubject: pitch.emailSubject,
        emailBody: pitch.emailBody,
        callScript: pitch.callScript
      } : null,
      text: pitch?.shortMessage || `Oportunidad para ${business.name}`,
      urgency: 'Alta',
      status: 'CONTACTED',
      lastContact: today,
      nextAction: 'Follow up in 3 days'
    };
    onSaveLead(leadPayload);
  };

  const handleOutreachAction = (type: 'wa' | 'call' | 'email' | 'web' | 'copy') => {
    if (!business || !pitch) return;
    const shortMsg = pitch.shortMessage || `Hola, me contacto de Bvelt respecto a ${business.name}.`;

    if (type === 'wa' && hasPhone) {
      const phoneClean = business.phone!.replace(/[^0-9+]/g, '');
      window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(shortMsg)}`, '_blank');
    } else if (type === 'call' && hasPhone) {
      window.location.href = `tel:${business.phone}`;
    } else if (type === 'email' && hasEmail) {
      const subj = pitch.emailSubject || `Propuesta comercial para ${business.name}`;
      const body = pitch.emailBody || shortMsg;
      window.location.href = `mailto:${business.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    } else if (type === 'web' && hasWebsite) {
      const url = business.website!.startsWith('http') ? business.website! : `https://${business.website}`;
      window.open(url, '_blank');
    } else if (type === 'copy') {
      navigator.clipboard.writeText(shortMsg);
      setCopiedType('copy');
      setTimeout(() => setCopiedType(null), 2000);
    }

    registerContactedLead();
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
    registerContactedLead();
  };

  const handleMarkAsLead = () => {
    if (!business) return;
    const leadPayload = {
      id: business.id || `lead_${Date.now()}`,
      businessName: business.name,
      client: business.name,
      category: business.category || 'Servicios locales',
      location: business.address || business.location || 'Local',
      website: business.website || '',
      phone: business.phone || '',
      email: business.email || '',
      rating: business.rating || 'N/D',
      reviews: business.reviews || 'N/D',
      source: business.source || 'Client Acquisition Engine',
      date: new Date().toLocaleDateString(),
      timestamp: new Date().toISOString(),
      opportunityData: pitch?.opportunities || business.opportunityData || [],
      generatedPitch: pitch ? {
        shortMessage: pitch.shortMessage,
        emailSubject: pitch.emailSubject,
        emailBody: pitch.emailBody,
        callScript: pitch.callScript
      } : null,
      text: pitch?.shortMessage || `Oportunidad para ${business.name}`,
      urgency: 'Alta',
      status: 'NEW',
      lastContact: null,
      nextAction: 'Contact today'
    };
    onSaveLead(leadPayload);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 md:p-8 max-w-xl w-full shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="mb-6 flex items-start gap-4 pr-8">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full mb-1 border border-indigo-200 dark:border-indigo-800">
              {t("MOTOR DE PITCH PARA CLIENTES", "CLIENT PITCH ENGINE")}
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[340px]">
              {business.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {business.category || business.address ? `${business.category || ''} • ${business.address || ''}` : t('Propuesta comercial personalizada', 'Personalized pitch')}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-12 rounded-[2rem] text-center flex flex-col items-center justify-center gap-4 min-h-[260px]">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <div>
              <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest animate-pulse">
                {t("Generando Pitch Comercial...", "Generating Client Pitch...")}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {t("Redactando 3 versiones (Mensaje corto, Email y Guion de llamada) con datos reales...", "Crafting 3 versions (Short msg, Email & Call script) with real data...")}
              </p>
            </div>
          </div>
        ) : pitch ? (
          <div className="space-y-6">
            {/* Version Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black">
              <button
                onClick={() => setActiveTab('short')}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'short'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <MessageSquare size={13} />
                <span>{t('Mensaje', 'Short Msg')}</span>
              </button>

              <button
                onClick={() => setActiveTab('email')}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'email'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Mail size={13} />
                <span>{t('Correo', 'Email')}</span>
              </button>

              <button
                onClick={() => setActiveTab('script')}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'script'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <PhoneCall size={13} />
                <span>{t('Guion 30s', 'Call Script')}</span>
              </button>
            </div>

            {/* Active Content Box */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-[2rem] text-left shadow-inner space-y-3 min-h-[160px]">
              {activeTab === 'short' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                      A) {t('MENSAJE CORTO (SMS / WhatsApp)', 'SHORT MESSAGE (SMS / WhatsApp)')}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                    {pitch.shortMessage}
                  </p>
                </div>
              )}

              {activeTab === 'email' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                      B) {t('EMAIL COMERCIAL', 'SALES EMAIL')}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{t('Asunto:', 'Subject:')}</span>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{pitch.emailSubject}</p>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                    {pitch.emailBody}
                  </p>
                </div>
              )}

              {activeTab === 'script' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                      C) {t('GUION DE LLAMADA (~30 SEGUNDOS)', 'CALL SCRIPT (~30 SECONDS)')}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-medium italic bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    "{pitch.callScript}"
                  </p>
                </div>
              )}
            </div>

            {/* Before You Send Commercial Completeness Check */}
            <BeforeYouSendPanel
              trade={business.category || 'generic'}
              draftText={activeTab === 'short' ? pitch.shortMessage : activeTab === 'email' ? `${pitch.emailSubject}\n\n${pitch.emailBody}` : pitch.callScript}
              language={t('es', 'en') === 'es' ? 'es' : 'en'}
              t={(es, en) => t(es, en)}
              compact={true}
              onCopyWhatsApp={() => handleCopy(activeTab === 'short' ? pitch.shortMessage : pitch.emailBody, activeTab)}
            />

            {/* Direct One-Click Outreach & Copy Actions */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block text-left">
                {t('ACCIONES DE ALCANCE EN UN CLIC', 'ONE-CLICK OUTREACH ACTIONS')}
              </span>

              {hasAnyChannel ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {hasPhone && (
                    <button
                      onClick={() => handleOutreachAction('wa')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                    >
                      <MessageSquare size={14} />
                      <span>WhatsApp</span>
                    </button>
                  )}

                  {hasPhone && (
                    <button
                      onClick={() => handleOutreachAction('call')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      <PhoneCall size={14} />
                      <span>{t('Llamar', 'Call')}</span>
                    </button>
                  )}

                  {hasEmail && (
                    <button
                      onClick={() => handleOutreachAction('email')}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20"
                    >
                      <Mail size={14} />
                      <span>Email</span>
                    </button>
                  )}

                  {hasWebsite && (
                    <button
                      onClick={() => handleOutreachAction('web')}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                    >
                      <Globe size={14} />
                      <span>Website</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 p-2.5 rounded-xl text-center text-xs font-bold">
                  {t('No hay un canal de contacto verificado disponible', 'No verified contact channel available')}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => handleOutreachAction('copy')}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 col-span-1 sm:col-span-2"
                >
                  {copiedType === 'copy' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedType === 'copy' ? t('Pitch copiado', 'Pitch copied') : t('COPIAR PITCH', 'COPY PITCH')}</span>
                </button>

                <button
                  onClick={() => {
                    const report = generateSignalsFromOperatorInput({
                      businessName: business.name,
                      city: business.address || business.location,
                      category: business.category,
                      unrepliedReviewsCount: 3,
                      negativeReviewsCount: 2,
                      hasWeakCta: !hasWebsite || !hasPhone
                    });
                    saveFunnelReport(report);
                    const url = buildFunnelShareUrl(report);
                    navigator.clipboard.writeText(url);
                    setCopiedType('funnel_link');
                    setTimeout(() => setCopiedType(null), 2500);
                  }}
                  className="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-200 dark:border-indigo-800 col-span-1"
                >
                  {copiedType === 'funnel_link' ? <Check size={14} className="text-emerald-500" /> : <Link2 size={14} />}
                  <span>{copiedType === 'funnel_link' ? t('¡Enlace /r/:id copiado!', 'Funnel link copied!') : t('ENLACE /r/:id', 'FUNNEL /r/:id')}</span>
                </button>
              </div>

              {/* Primary CTA: MARK AS LEAD */}
              <button
                onClick={handleMarkAsLead}
                disabled={isLeadSaved}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                  isLeadSaved
                    ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-98'
                }`}
              >
                {isLeadSaved ? (
                  <>
                    <Check size={16} />
                    <span>{t('¡LEAD GUARDADO EN CRM!', 'LEAD SAVED TO CRM!')}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>{t('MARCAR COMO PROSPECTO', 'MARK AS LEAD')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            {t("No se pudo cargar el pitch comercial.", "Could not load client pitch.")}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPitchModal;
