import React, { useState } from 'react';
import { 
  FileText, Calendar, ShieldCheck, Mail, Share2, 
  Check, AlertTriangle, ArrowRight, Zap, RefreshCw, X, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateWeeklyMetrics, WeeklyMetricsReport } from '../../services/weeklyMetricsGenerator';
import { sendEmailWithResend } from '../../lib/resend';
import { OperationalScoreCard } from './OperationalScoreCard';

export interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads?: any[];
  userUid?: string;
  profile?: any;
  gmbConnected?: boolean;
  gmbReviews?: any[];
  mapCoords?: { lat: number; lng: number } | null;
  language?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  isOpen,
  onClose,
  leads = [],
  userUid,
  profile,
  gmbConnected = false,
  gmbReviews = [],
  mapCoords,
  language = 'es',
  showToast
}) => {
  const isEn = language === 'en';
  const t = (es: string, en: string) => (isEn ? en : es);

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const report: WeeklyMetricsReport = React.useMemo(() => {
    return generateWeeklyMetrics({
      leads,
      userUid,
      profile,
      gmbConnected,
      gmbReviews,
      mapCoords,
      language
    });
  }, [leads, userUid, profile, gmbConnected, gmbReviews, mapCoords, language]);

  if (!isOpen) return null;

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(report.summaryText);
      setCopiedSummary(true);
      if (showToast) {
        showToast(t("✓ Resumen semanal copiado al portapapeles.", "✓ Weekly summary copied to clipboard."), 'success');
      }
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      if (showToast) {
        showToast(t("Error al copiar al portapapeles.", "Error copying to clipboard."), 'error');
      }
    }
  };

  const handleSendEmailReport = async () => {
    const recipientEmail = profile?.email;
    if (!recipientEmail) {
      if (showToast) {
        showToast(t("No se encontró un correo configurado en tu perfil.", "No configured email found in your profile."), 'error');
      }
      return;
    }

    setIsSendingEmail(true);
    try {
      const subject = t(
        `Informe Semanal Bvelt: ${report.periodLabel}`,
        `Bvelt Weekly Report: ${report.periodLabel}`
      );

      const result = await sendEmailWithResend({
        to: recipientEmail,
        subject,
        textContent: report.summaryText,
        businessName: profile?.name || profile?.businessName || 'Bvelt',
        agentType: 'commercial'
      });

      if (result.skipped) {
        if (showToast) {
          showToast(
            t(
              "Servicio de correo en espera. Se copió el resumen para envío manual.",
              "Email service pending. Summary copied for manual dispatch."
            ),
            'info'
          );
        }
        await handleCopySummary();
      } else if (result.success) {
        if (showToast) {
          showToast(t(`✓ Informe enviado a ${recipientEmail}`, `✓ Report sent to ${recipientEmail}`), 'success');
        }
      } else {
        if (showToast) {
          showToast(t("No se pudo enviar el correo. Puedes copiar el resumen.", "Could not send email. You can copy the summary."), 'error');
        }
      }
    } catch {
      if (showToast) {
        showToast(t("Error enviando el informe.", "Error dispatching report."), 'error');
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-500/20 relative">
            <div className="space-y-1.5 z-10">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-400/30 flex items-center gap-1">
                  <Calendar size={12} /> {report.periodLabel}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1">
                  <ShieldCheck size={12} /> {t("Auditoría Real", "Real Audit")}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {t("Informe Semanal de Rendimiento Bvelt", "Bvelt Weekly Performance Report")}
              </h2>
              <p className="text-xs text-slate-300">
                {profile?.name || profile?.businessName || t("Tu Negocio Local", "Your Local Business")}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer self-end sm:self-auto z-10"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto font-sans text-slate-800 dark:text-slate-100">

            {/* Criterio de Semana Vacía Honesta */}
            {report.isEmptyWeek ? (
              <div className="p-5 bg-slate-50 dark:bg-slate-950/80 border border-amber-300/60 dark:border-amber-900/60 rounded-2xl space-y-2 text-left">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle size={16} />
                  <span className="uppercase tracking-wider font-black">
                    {t("Semana Vacía Honesta", "Honest Empty Week")}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {report.honestEmptyMessage}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 leading-relaxed">
                  {report.summaryText}
                </p>
              </div>
            )}

            {/* Operational Score Block (0–100) */}
            <OperationalScoreCard 
              tenantId={userUid} 
              t={t} 
              onNavigateAction={() => onClose()} 
            />

            {/* 5 Main Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* 1. Oportunidades */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {t("Oportunidades Semanales", "Weekly Opportunities")}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {report.opportunitiesCount}
                  </span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {report.opportunitiesValue > 0 ? `$${report.opportunitiesValue.toLocaleString()}` : '$0'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("Consultas y escaneos de mercado en los últimos 7 días.", "Inquiries and market scans in the past 7 days.")}
                </p>
              </div>

              {/* 2. Acciones Preparadas */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {t("Acciones Preparadas", "Prepared Actions")}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {report.preparedActionsCount}
                  </span>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    BEM Audit
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("Seguimientos, borradores e inicios de rescate preparados.", "Follow-ups, drafts, and dormant rescues queued.")}
                </p>
              </div>

              {/* 3. Respuestas de Clientes */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {t("Respuestas de Clientes", "Customer Replies")}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {report.repliesCount}
                  </span>
                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                    {t("Registradas", "Registered")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("Respuestas entrantes confirmadas de clientes en la semana.", "Confirmed incoming client responses this week.")}
                </p>
              </div>

              {/* 4. Recuperado (REAL/VERIFIED) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                    {t("Recuperado", "Recovered")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                    REAL/VERIFIED
                  </span>
                </div>
                <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100 block">
                  ${report.recoveredValue.toLocaleString()}
                </span>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  {t("Ingresos confirmados con respuesta o cita del dueño.", "Confirmed revenue with reply or owner timestamp.")}
                </p>
              </div>

              {/* 5. En Juego (MODELED) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300 block">
                    {t("En Juego", "In Play")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                    MODELED
                  </span>
                </div>
                <span className="text-2xl font-black text-indigo-950 dark:text-indigo-100 block">
                  ${report.inPlayValue.toLocaleString()}
                </span>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
                  {t("Valor de pipeline activo en negociación abierta.", "Active pipeline value in open negotiation.")}
                </p>
              </div>

              {/* 6. Salud de Integraciones */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {t("Salud de Integraciones", "Integrations Health")}
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-black">
                  <span className={`px-2 py-1 rounded-md border ${
                    report.integrationsHealth.google.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    GMB: {report.integrationsHealth.google.label}
                  </span>
                  <span className={`px-2 py-1 rounded-md border ${
                    report.integrationsHealth.email.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {t("Correo", "Email")}: {report.integrationsHealth.email.label}
                  </span>
                  <span className={`px-2 py-1 rounded-md border ${
                    report.integrationsHealth.maps.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {t("Mapas", "Maps")}: {report.integrationsHealth.maps.label}
                  </span>
                </div>
              </div>

            </div>

            {/* Event Breakdown Table */}
            {report.eventBreakdown.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  {t("Desglose de Registro de la Semana", "Weekly Event Log Breakdown")}
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                  {report.eventBreakdown.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{item.title}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.detail}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 block">{item.timestamp}</span>
                        {item.amount && (
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            +${item.amount}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopySummary}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedSummary ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedSummary ? t("¡Copiado!", "Copied!") : t("Copiar Resumen", "Copy Summary")}</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmailReport}
                disabled={isSendingEmail}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSendingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                <span>{t("Enviar Informe por Correo", "Send Report via Email")}</span>
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
