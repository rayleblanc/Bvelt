import React, { useState } from 'react';
import { 
  Share2, Copy, CheckCircle2, Gift, DollarSign, 
  Calendar, ExternalLink, MessageSquare, ArrowRight, ShieldCheck, Sparkles 
} from 'lucide-react';
import { ReferralRewardService } from '../../services/referralRewardService';

export interface ReferralInviteCardProps {
  tenantId?: string;
  customCode?: string;
  t?: (es: string, en: string) => string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReferralInviteCard: React.FC<ReferralInviteCardProps> = ({
  tenantId,
  customCode,
  t = (es, en) => es,
  showToast
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'en' | 'es'>('en');

  const referralCode = ReferralRewardService.getReferralCode(tenantId, customCode);
  const referralLink = ReferralRewardService.getReferralLink(referralCode);
  const shareTextEn = ReferralRewardService.getShareTextEn(referralCode);
  const shareTextEs = ReferralRewardService.getShareTextEs(referralCode);

  const stats = ReferralRewardService.getReferrerCreditBalance(referralCode);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      if (showToast) showToast(t('✓ Enlace de referido copiado al portapapeles', '✓ Referral link copied to clipboard'), 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      if (showToast) showToast('Error al copiar enlace', 'error');
    }
  };

  const handleCopyPitch = async () => {
    const textToCopy = selectedLang === 'en' ? shareTextEn : shareTextEs;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      if (showToast) showToast(t('✓ Texto copiado listo para enviar', '✓ Pitch text copied to clipboard'), 'success');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      if (showToast) showToast('Error al copiar texto', 'error');
    }
  };

  const handleShareWhatsApp = () => {
    const text = selectedLang === 'en' ? shareTextEn : shareTextEs;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareSms = () => {
    const text = selectedLang === 'en' ? shareTextEn : shareTextEs;
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 text-left text-white relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-md">
              <Gift size={18} />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
              {t("Invita a otro negocio y gana créditos", "Invite another business & earn credits")}
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {t(
              "Gana 1 mes gratis o $20 de crédito en fee cuando tu referido pague su primera suscripción o rescate.",
              "Earn 1 free month or $20 fee credit when your referred business completes their 1st payment."
            )}
          </p>
        </div>

        {/* Reward Stats */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950/80 px-3 py-1.5 rounded-2xl border border-slate-800">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {t("Tus Créditos", "Your Credits")}
            </span>
            <span className="text-xs font-black text-emerald-400">
              {stats.freeMonths > 0 ? `${stats.freeMonths} mo free ` : ''}
              {stats.feeCreditUsd > 0 ? `+$${stats.feeCreditUsd} fee credit` : (stats.freeMonths === 0 ? '$0 crédito' : '')}
            </span>
          </div>
        </div>
      </div>

      {/* Referral Link Field */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>{t("Tu enlace de invitación único", "Your unique invite link")}</span>
          <span className="text-indigo-400 font-mono text-xs">CODE: {referralCode}</span>
        </label>
        
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-indigo-300 truncate select-all">
            {referralLink}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-2xl transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
          >
            {copiedLink ? <CheckCircle2 size={14} className="text-emerald-300" /> : <Copy size={14} />}
            <span>{copiedLink ? t("¡Copiado!", "Copied!") : t("Copiar Link", "Copy Link")}</span>
          </button>
        </div>
      </div>

      {/* Ready-to-Send Share Text Box */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {t("Texto listo para enviar (Copia y pega)", "Ready-to-share message")}
          </span>

          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setSelectedLang('en')}
              className={`px-2 py-0.5 rounded-lg transition ${selectedLang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              EN (US Market)
            </button>
            <button
              type="button"
              onClick={() => setSelectedLang('es')}
              className={`px-2 py-0.5 rounded-lg transition ${selectedLang === 'es' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ES
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans relative group">
          <p className="pr-16 select-all">
            {selectedLang === 'en' ? shareTextEn : shareTextEs}
          </p>

          <button
            type="button"
            onClick={handleCopyPitch}
            className="absolute top-3 right-3 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-xl border border-slate-700 transition flex items-center gap-1 cursor-pointer"
          >
            {copiedText ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copiedText ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Direct Sharing Buttons */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <MessageSquare size={14} />
            <span>{t("Compartir por WhatsApp", "Share via WhatsApp")}</span>
          </button>

          <button
            type="button"
            onClick={handleShareSms}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <span>{t("Enviar por SMS", "Send SMS")}</span>
          </button>
        </div>
      </div>

      {/* Anti-Fraud Notice */}
      <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
        <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
        <p>
          <strong>{t("Regla de transparencia:", "Clear Policy:")}</strong> {t(
            "1 crédito otorgado por cada nuevo cliente referido al completar su 1er pago (Stripe Pro o Pay-After-Win Fee). Sin límites multinivel.",
            "1 reward issued per referred customer upon completing their 1st payment (Stripe Pro or Pay-After-Win Fee). Simple 1:1 attribution, no MLM."
          )}
        </p>
      </div>
    </div>
  );
};
