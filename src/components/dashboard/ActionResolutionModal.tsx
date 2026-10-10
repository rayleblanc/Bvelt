import React, { useState, useMemo } from 'react';
import { 
  X, MessageSquare, Phone, Mail, Copy, Check, 
  ExternalLink, Sparkles, CheckCircle2, ShieldAlert,
  ArrowRight, Landmark, DollarSign, Calendar, HelpCircle,
  Clock, Star, Send, Edit3, Eye, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ActionEngine, ActionOutcomeType } from '../../knowledge/engine/actionEngine';
import { OutcomeLedgerService, recordBemOutcome } from '../../knowledge/memory/outcomeLedgerService';
import { recordBveltEvent } from '../../knowledge/memory/bemStore';
import { UnifiedActionService } from '../../lib/unifiedActionService';
import { getTradePack } from '../../tradePacks';
import { getPlanLimits, resolvePlanTier, dispatchPlanLimitReached } from '../../lib/planLimits';

interface ActionResolutionModalProps {
  action: any | null; // Supports NextBestAction and legacy actions
  isOpen: boolean;
  onClose: () => void;
  onActionCompleted?: () => void;
  onNavigateTab?: (tab: string) => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  t: (es: string, en: string) => string;
  profile?: any;
}

export type PlaybookType = 'quote_followup' | 'review_recovery' | 'first_reply';

export const ActionResolutionModal: React.FC<ActionResolutionModalProps> = ({
  action,
  isOpen,
  onClose,
  onActionCompleted,
  onNavigateTab,
  showToast,
  t,
  profile
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<ActionOutcomeType>('CONTACTED');
  const [revenueValue, setRevenueValue] = useState<string>('');
  const [notesValue, setNotesValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [selectedStaleLeadId, setSelectedStaleLeadId] = useState<string | null>(null);

  // Stale leads / quotes from CRM if present
  const staleQuotesAndLeads = useMemo(() => {
    try {
      const raw = localStorage.getItem('lf_leads');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 5);
        }
      }
    } catch {}
    return [];
  }, []);

  // Determine initial playbook
  const initialPlaybook: PlaybookType = useMemo(() => {
    if (!action) return 'first_reply';
    const idStr = String(action.id || '').toLowerCase();
    const titleStr = String(action.action || action.title || '').toLowerCase();
    const destCode = String(action.destinationCode || '').toUpperCase();

    if (idStr.includes('review') || destCode === 'REQUEST_REVIEW' || titleStr.includes('reseña') || titleStr.includes('review')) {
      return 'review_recovery';
    }
    if (idStr.includes('estimate') || destCode === 'SEND_QUOTE' || titleStr.includes('presupuesto') || titleStr.includes('quote') || idStr.includes('quote') || titleStr.includes('cotiz')) {
      return 'quote_followup';
    }
    return 'first_reply';
  }, [action]);

  const [activePlaybook, setActivePlaybook] = useState<PlaybookType>(initialPlaybook);

  // Sync activePlaybook when action changes
  React.useEffect(() => {
    setActivePlaybook(initialPlaybook);
    setIsEditingMessage(false);
    setCustomMessage('');
  }, [initialPlaybook, action]);

  if (!isOpen || !action) return null;

  // Plan limits guard (cap AI/outreach generations per trial/day)
  const plan = resolvePlanTier(profile);
  const limits = getPlanLimits(plan);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [dailyOutreachCount, setDailyOutreachCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('bvelt_daily_outreach_tracker');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.date === todayStr) return parsed.count || 0;
      }
    } catch {}
    return 0;
  });

  const isOverLimit = useMemo(() => {
    return dailyOutreachCount >= limits.maxOutreachDraftsPerDay;
  }, [dailyOutreachCount, limits.maxOutreachDraftsPerDay]);

  const id = action.id || `act_${Date.now()}`;
  const title = action.action || action.title || t('Acción comercial', 'Business action');
  const reason = action.whyNow || action.reason || action.whyThisMatters || t('Prioridad activa en tu mercado', 'Active priority in your market');
  
  // Extract context parameters
  const context = action.contextData || action.context || {};
  
  // If user selected a specific stale lead from the list, use that lead's data
  const chosenStaleLead = staleQuotesAndLeads.find((l: any) => l.id === selectedStaleLeadId);
  const leadName = chosenStaleLead?.name || chosenStaleLead?.client || context.leadName || context.contactName || t('Cliente potencial', 'Lead');
  const rawPhone = chosenStaleLead?.phone || context.phone || '';
  const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
  const email = chosenStaleLead?.email || context.email || '';
  const amount = chosenStaleLead?.amount || context.amount || '450';
  
  const businessName = profile?.businessName || profile?.name || t('Tu Negocio', 'Your Business');
  const niche = profile?.category || profile?.niche || t('Servicio Local', 'Local Service');
  const city = profile?.location || profile?.city || t('Tu Zona', 'Your Zone');
  const destinationCode = action.destinationCode || '';

  const unifiedActionType = activePlaybook === 'review_recovery' 
    ? 'review_request' 
    : activePlaybook === 'quote_followup' 
    ? 'quote_followup' 
    : 'lead_contact';

  const reviewLink = profile?.gmbReviewLink || profile?.gmbLink || (profile?.placeId ? `https://search.google.com/local/writereview?placeid=${profile.placeId}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessName + ' ' + city)}`);

  // Compute Playbook Messages
  let playbookMessage = '';
  let emailSubject = '';
  let emailBody = '';

  if (activePlaybook === 'quote_followup') {
    playbookMessage = t(
      `Hola ${leadName}, te escribo de ${businessName} para consultar si tuviste oportunidad de revisar el presupuesto de $${amount} que preparamos para tu servicio de ${niche} en ${city}. ¡Cualquier duda podemos ajustar materiales o fechas para agendarlo esta semana!`,
      `Hi ${leadName}, reaching out from ${businessName} to check if you had a chance to review the $${amount} estimate we sent for your ${niche} job in ${city}. Let me know if you have any questions or if you would like to secure a start date this week!`
    );
    emailSubject = t(`Seguimiento de presupuesto de ${niche} — ${businessName}`, `Follow-up on your ${niche} estimate — ${businessName}`);
    emailBody = t(
      `Hola ${leadName},\n\nEspero que todo vaya bien. Te escribo para dar seguimiento al presupuesto de $${amount} para ${niche} en ${city}.\n\n¿Tienes alguna consulta o prefieres que agendemos la fecha de inicio?\n\nSaludos cordiales,\n${businessName}`,
      `Hi ${leadName},\n\nI hope all is well. I'm following up on our $${amount} estimate for ${niche} in ${city}.\n\nDo you have any questions or would you like to schedule the project?\n\nBest regards,\n${businessName}`
    );
  } else if (activePlaybook === 'review_recovery') {
    playbookMessage = t(
      `Hola ${leadName}, ¡muchas gracias por confiar en ${businessName}! Nos ayudaría muchísimo si pudieras dejarnos una opinión de 5 estrellas en Google aquí: ${reviewLink}. ¡Solo toma 20 segundos y nos apoya como negocio local!`,
      `Hi ${leadName}, thanks so much for choosing ${businessName}! If you were happy with our work, could you take 20 seconds to leave us a quick 5-star review on Google? Here is the direct link: ${reviewLink}. Thank you!`
    );
    emailSubject = t(`¿Qué tal fue tu experiencia con ${businessName}?`, `How was your experience with ${businessName}?`);
    emailBody = t(
      `Hola ${leadName},\n\nQueremos darte las gracias por elegirnos para tu servicio de ${niche}.\n\nTu opinión es clave para nosotros. ¿Podrías dejarnos una reseña rápida en Google?\n\nEnlace directo: ${reviewLink}\n\n¡Muchas gracias!\n${businessName}`,
      `Hi ${leadName},\n\nThank you for choosing ${businessName} for your ${niche} needs.\n\nYour feedback helps our local business. Would you mind leaving us a quick Google review?\n\nDirect link: ${reviewLink}\n\nThank you!\n${businessName}`
    );
  } else {
    // Fast first reply for new leads
    playbookMessage = t(
      `Hola ${leadName}, soy de ${businessName}. Recibí tu consulta sobre servicios de ${niche} en ${city}. ¿Cuándo te viene bien una llamada rápida de 2 minutos o visita técnica para coordinar tu trabajo?`,
      `Hi ${leadName}, this is from ${businessName}. I received your inquiry for ${niche} services in ${city}. When is a good time for a quick 2-minute call or inspection to get this scheduled for you?`
    );
    emailSubject = t(`Respuesta rápida de ${businessName} — Solicitud de ${niche}`, `Quick reply from ${businessName} — ${niche} Request`);
    emailBody = t(
      `Hola ${leadName},\n\nGracias por comunicarte con ${businessName}.\n\nEstamos disponibles para atender tu solicitud de ${niche} en ${city}.\n\n¿Qué horario te queda más cómodo para llamarte?\n\nAtentamente,\n${businessName}`,
      `Hi ${leadName},\n\nThank you for contacting ${businessName}.\n\nWe are ready to handle your ${niche} project in ${city}.\n\nWhat time works best for a quick phone confirmation?\n\nBest regards,\n${businessName}`
    );
  }

  const activeMessage = customMessage || playbookMessage;
  const waEncoded = encodeURIComponent(activeMessage);
  const finalWhatsappUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${waEncoded}` 
    : `https://wa.me/?text=${waEncoded}`;
    
  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const smsUrl = cleanPhone 
    ? (isIos ? `sms:${cleanPhone}&body=${waEncoded}` : `sms:${cleanPhone}?body=${waEncoded}`)
    : (isIos ? `sms:&body=${waEncoded}` : `sms:?body=${waEncoded}`);

  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  // Record execution to Ledger
  const recordExecutionToLedger = (channel: string) => {
    try {
      const toolId = activePlaybook === 'quote_followup' 
        ? 'create_estimate_follow_up' 
        : activePlaybook === 'review_recovery' 
        ? 'draft_review_response' 
        : 'draft_lead_follow_up';

      const metricName = activePlaybook === 'quote_followup' 
        ? 'ESTIMATES' 
        : activePlaybook === 'review_recovery' 
        ? 'REVIEWS' 
        : 'LEADS';

      OutcomeLedgerService.recordExecution({
        businessId: profile?.id || 'default_business',
        businessName,
        city,
        actionId: id,
        toolId,
        executionState: 'SUCCESS',
        outcomeState: 'DECLARED',
        metricName,
        outcomeType: activePlaybook.toUpperCase(),
        description: t(
          `Playbook [${activePlaybook.toUpperCase()}] ejecutado vía ${channel.toUpperCase()} para ${leadName}.`,
          `Playbook [${activePlaybook.toUpperCase()}] executed via ${channel.toUpperCase()} for ${leadName}.`
        ),
        value: activePlaybook === 'quote_followup' ? parseFloat(amount) || 450 : null,
        providerCostUsd: 0,
        tenantUid: profile?.tenantUid,
        metadata: {
          leadName,
          channel,
          playbook: activePlaybook
        }
      });

      // Mark completed in UnifiedActionService
      UnifiedActionService.markActionDone(id, unifiedActionType, {
        leadName,
        channel,
        title,
        destinationCode
      });

      // Mark completed in ActionEngine
      ActionEngine.completeAction(id, {
        outcomeType: 'CONTACTED',
        revenueRecorded: activePlaybook === 'quote_followup' ? parseFloat(amount) || 450 : 0,
        contactMethod: (['email', 'whatsapp', 'call', 'sms', 'in_person'].includes(channel) ? channel : 'other') as any,
        notes: `Executed via ${channel} in One-Tap Sheet`
      }, profile?.tenantUid);

      // Persist completed action ID in localStorage
      const saved = localStorage.getItem('bvelt_completed_actions_ids');
      const ids: string[] = saved ? JSON.parse(saved) : [];
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem('bvelt_completed_actions_ids', JSON.stringify(ids));
      }
      window.dispatchEvent(new CustomEvent('bvelt_action_completed', { detail: { actionId: id } }));
    } catch (e) {
      console.warn('[ActionResolutionModal] Ledger execution write skipped:', e);
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    if (isOverLimit) {
      if (showToast) {
        showToast(
          plan === 'trial'
            ? t(`Límite diario de prueba alcanzado (${limits.maxOutreachDraftsPerDay}/día). Mejora a Pro para envíos ilimitados.`, `Daily trial limit reached (${limits.maxOutreachDraftsPerDay}/day). Upgrade to Pro for unlimited actions.`)
            : t("Límite diario alcanzado.", "Daily limit reached."),
          'error'
        );
      }
      dispatchPlanLimitReached({
        action: 'outreach',
        limit: limits.maxOutreachDraftsPerDay,
        current: dailyOutreachCount,
        plan
      });
      return;
    }

    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
    recordExecutionToLedger(`copy_${fieldName}`);

    const nextCount = dailyOutreachCount + 1;
    setDailyOutreachCount(nextCount);
    try {
      localStorage.setItem('bvelt_daily_outreach_tracker', JSON.stringify({ date: todayStr, count: nextCount }));
    } catch {}

    if (showToast) {
      showToast(t('✓ ¡Mensaje copiado y registrado en el Ledger!', '✓ Message copied and logged to Ledger!'), 'success');
    }
  };

  const handleLaunchExternalStep = (url: string, methodUsed: 'whatsapp' | 'sms' | 'email') => {
    if (isOverLimit) {
      if (showToast) {
        showToast(
          plan === 'trial'
            ? t(`Límite diario de prueba alcanzado (${limits.maxOutreachDraftsPerDay}/día). Mejora a Pro para envíos ilimitados.`, `Daily trial limit reached (${limits.maxOutreachDraftsPerDay}/day). Upgrade to Pro for unlimited actions.`)
            : t("Límite diario alcanzado.", "Daily limit reached."),
          'error'
        );
      }
      dispatchPlanLimitReached({
        action: 'outreach',
        limit: limits.maxOutreachDraftsPerDay,
        current: dailyOutreachCount,
        plan
      });
      return;
    }

    recordExecutionToLedger(methodUsed);

    const nextCount = dailyOutreachCount + 1;
    setDailyOutreachCount(nextCount);
    try {
      localStorage.setItem('bvelt_daily_outreach_tracker', JSON.stringify({ date: todayStr, count: nextCount }));
    } catch {}

    if (methodUsed === 'email' || methodUsed === 'sms') {
      window.location.href = url;
    } else {
      try {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        window.location.href = url;
      }
    }

    if (showToast) {
      showToast(t(`✓ Enviado por ${methodUsed.toUpperCase()} y registrado en el Ledger.`, `✓ Sent via ${methodUsed.toUpperCase()} and logged to Ledger.`), 'success');
    }

    if (onActionCompleted) {
      onActionCompleted();
    }
    setTimeout(() => onClose(), 600);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col text-left max-h-[92vh] sm:max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/70 flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  ⚡ {t("PLAYBOOK DE EJECUCIÓN", "EXECUTION PLAYBOOK")}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {t("One-Tap Sheet", "One-Tap Sheet")}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
                {title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shrink-0"
              title={t("Cerrar", "Close")}
            >
              <X size={16} />
            </button>
          </div>

          {/* Three Playbook Tabs */}
          <div className="grid grid-cols-3 gap-1 p-2 bg-slate-100 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setActivePlaybook('quote_followup');
                setIsEditingMessage(false);
                setCustomMessage('');
              }}
              className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activePlaybook === 'quote_followup'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <DollarSign size={13} className="shrink-0" />
              <span className="truncate">{t("Cotizaciones", "Quote Follow-up")}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePlaybook('review_recovery');
                setIsEditingMessage(false);
                setCustomMessage('');
              }}
              className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activePlaybook === 'review_recovery'
                  ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Star size={13} className="shrink-0" />
              <span className="truncate">{t("Reseñas", "Reviews")}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePlaybook('first_reply');
                setIsEditingMessage(false);
                setCustomMessage('');
              }}
              className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activePlaybook === 'first_reply'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Zap size={13} className="shrink-0" />
              <span className="truncate">{t("Respuesta Rápida", "Fast Reply")}</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 max-h-[58vh]">
            
            {/* If Playbook is Quote Follow-up and we have stale leads, show quick picker */}
            {activePlaybook === 'quote_followup' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    {staleQuotesAndLeads.length > 0 
                      ? t("Presupuestos Pendientes / Stale Items", "Stale Quotes / Inactive Leads")
                      : t("Fuga Detectada en Escaneo (Sin Leads en CRM)", "Scan-Derived Leak (No CRM Leads)")}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {staleQuotesAndLeads.length > 0 ? `${staleQuotesAndLeads.length} disponibles` : `$${amount} USD`}
                  </span>
                </div>

                {staleQuotesAndLeads.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5 max-h-28 overflow-y-auto">
                    {staleQuotesAndLeads.map((staleLead: any) => (
                      <button
                        key={staleLead.id || staleLead.text}
                        type="button"
                        onClick={() => {
                          setSelectedStaleLeadId(selectedStaleLeadId === staleLead.id ? null : staleLead.id);
                          setCustomMessage('');
                        }}
                        className={`p-2 rounded-xl border text-xs text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                          selectedStaleLeadId === staleLead.id
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-bold'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{staleLead.name || staleLead.client || staleLead.text}</p>
                          <p className="text-[10px] text-slate-400 truncate">{staleLead.phone || staleLead.date || city}</p>
                        </div>
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                          ${staleLead.amount || amount}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>{t(`Presupuesto derivado del ticket de ${niche} en ${city}`, `Derived from ${niche} benchmark in ${city}`)}</span>
                    <strong className="text-emerald-500 font-black">${amount}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Message Card: Preview & Inline Edit */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-indigo-500" />
                  {activePlaybook === 'quote_followup'
                    ? t("Mensaje de Seguimiento", "Quote Follow-up Message")
                    : activePlaybook === 'review_recovery'
                    ? t("Solicitud de Reseña en Google", "Google Review Request")
                    : t("Respuesta Rápida a Cliente", "Fast First Reply Template")}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEditingMessage && !customMessage) {
                        setCustomMessage(playbookMessage);
                      }
                      setIsEditingMessage(!isEditingMessage);
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {isEditingMessage ? <Eye size={12} /> : <Edit3 size={12} />}
                    <span>{isEditingMessage ? t("Vista Previa", "Preview") : t("Editar", "Edit")}</span>
                  </button>
                </div>
              </div>

              {isEditingMessage ? (
                <textarea
                  value={customMessage || playbookMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-500/40 font-mono text-[11px] leading-relaxed text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono text-[11px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {activeMessage}
                </div>
              )}
            </div>
          </div>

          {/* Mobile-first One-Tap Sheet Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-2.5">
            {isOverLimit && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span className="font-bold">
                    {t(
                      `Límite diario alcanzado: ${dailyOutreachCount}/${limits.maxOutreachDraftsPerDay} acciones usadas hoy. Mejora a Pro para envíos ilimitados.`,
                      `Daily limit reached: ${dailyOutreachCount}/${limits.maxOutreachDraftsPerDay} actions used today. Upgrade to Pro for unlimited actions.`
                    )}
                  </span>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTab('profile');
                    }}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg shrink-0 cursor-pointer"
                  >
                    {t("Mejorar", "Upgrade")}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Primary WhatsApp One-Tap Button */}
              <button
                type="button"
                disabled={isOverLimit}
                onClick={() => handleLaunchExternalStep(finalWhatsappUrl, 'whatsapp')}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-98"
              >
                <Send size={14} />
                <span>{t("Compartir en WhatsApp (wa.me)", "Send via WhatsApp (wa.me)")}</span>
              </button>

              {/* Copy Message Button */}
              <button
                type="button"
                disabled={isOverLimit}
                onClick={() => handleCopy(activeMessage, 'wa')}
                className="py-3 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 active:scale-98"
                title={t("Copiar mensaje", "Copy message")}
              >
                {copiedField === 'wa' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedField === 'wa' ? t("Copiado ✓", "Copied ✓") : t("Copiar", "Copy")}</span>
              </button>
            </div>

            {/* Secondary Channel & Cancel Row */}
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleLaunchExternalStep(smsUrl, 'sms')}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer flex items-center gap-1"
                >
                  <MessageSquare size={12} />
                  <span>SMS</span>
                </button>
                {email && (
                  <button
                    type="button"
                    onClick={() => handleLaunchExternalStep(mailtoUrl, 'email')}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <Mail size={12} />
                    <span>Email</span>
                  </button>
                )}
              </div>

              {/* Clean One-Tap Cancel Button */}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer"
              >
                {t("Cancelar", "Cancel")}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
