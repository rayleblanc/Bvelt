import React, { useState } from 'react';
import { 
  X, ArrowRight, MessageSquare, Phone, Mail, 
  Copy, Check, DollarSign, Calendar, AlertCircle, 
  ExternalLink, Sparkles, Send, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ActionDefinition, 
  ActionEngine, 
  ActionOutcomeType 
} from '../../knowledge/engine/actionEngine';
import { OpportunityEngine } from '../../knowledge/engine/opportunityEngine';
import { OutcomeLedgerService } from '../../knowledge/memory/outcomeLedgerService';
import { CalculationDetails } from './CalculationModal';
import { trackBveltEvent } from '../../lib/bveltObservability';

interface ActionExecutionDrawerProps {
  action: ActionDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDestination: (destination: any) => void;
  onOpenCalculationModal?: (details: CalculationDetails) => void;
  onActionUpdated?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  t: (es: string, en: string) => string;
  tenantUid?: string | null;
}

export const ActionExecutionDrawer: React.FC<ActionExecutionDrawerProps> = ({
  action,
  isOpen,
  onClose,
  onNavigateToDestination,
  onOpenCalculationModal,
  onActionUpdated,
  showToast,
  t,
  tenantUid
}) => {
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<ActionOutcomeType>('CONTACTED');
  const [revenueInput, setRevenueInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [contactMethod, setContactMethod] = useState<'whatsapp' | 'call' | 'email' | 'sms' | 'in_person'>('whatsapp');
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);

  if (!isOpen || !action) return null;

  const handleCopy = (text: string, channel: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(channel);
    setTimeout(() => setCopiedChannel(null), 2000);
    if (showToast) {
      showToast(t('Mensaje copiado al portapapeles', 'Message copied to clipboard'), 'success');
    }
  };

  const handleStartExecution = () => {
    ActionEngine.startAction(action.id, tenantUid);
    OpportunityEngine.updateOpportunityStatus(action.opportunityId, 'IN_PROGRESS');
    trackBveltEvent('first_action_executed', { actionId: action.id });
    if (showToast) {
      showToast(t('Acción marcada en progreso', 'Action marked in progress'), 'info');
    }
    if (onActionUpdated) onActionUpdated();
  };

  const handleRecordOutcome = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingOutcome(true);

    const revNum = parseFloat(revenueInput.replace(/[^0-9.]/g, '')) || 0;

    ActionEngine.completeAction(action.id, {
      outcomeType: selectedOutcome,
      revenueRecorded: revNum,
      contactMethod: contactMethod,
      notes: notesInput
    }, tenantUid);

    OpportunityEngine.updateOpportunityStatus(action.opportunityId, 'COMPLETED');

    try {
      const entry = OutcomeLedgerService.recordExecution({
        businessId: tenantUid || 'default_business',
        toolId: 'draft_lead_follow_up',
        actionId: action.id,
        executionState: 'SUCCESS',
        outcomeState: selectedOutcome === 'WON' ? 'MEASURED' : 'DECLARED',
        outcomeType: selectedOutcome,
        metricName: selectedOutcome === 'WON' ? 'JOBS' : 'LEADS',
        description: notesInput || `${action.title} completed with outcome ${selectedOutcome}`,
        value: revNum,
        tenantUid: tenantUid
      });
      console.log('[BEM Outcome Recorded from Drawer]', {
        actionId: action.id,
        outcomeType: selectedOutcome,
        value: revNum,
        timestamp: entry.timestamp
      });
    } catch (e) {
      console.warn('[ActionExecutionDrawer] Ledger record skipped:', e);
    }

    if (showToast) {
      if (selectedOutcome === 'WON') {
        showToast(
          t(`🎉 ¡Venta ganada registrada con éxito ($${revNum.toLocaleString()})!`, `🎉 Won sale recorded successfully ($${revNum.toLocaleString()})!`), 
          'success'
        );
      } else {
        showToast(
          t('Resultado comercial guardado en Business Memory', 'Commercial result saved in Business Memory'), 
          'success'
        );
      }
    }

    setIsSubmittingOutcome(false);
    if (onActionUpdated) onActionUpdated();
    onClose();
  };

  const handleDirectNavigation = () => {
    handleStartExecution();
    onNavigateToDestination(action.destination);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm">
        {/* Overlay dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-2xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col text-slate-900 dark:text-white overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {action.actionType}
                </span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  action.priority === 'HIGH' 
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                }`}>
                  {action.priority === 'HIGH' ? t('Prioridad Alta', 'High Priority') : t('Prioridad Media', 'Medium Priority')}
                </span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {action.impactFormatted}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                {action.title}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Description & Urgent Reason */}
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {action.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 block mb-1">
                    💡 {t('Por qué importa:', 'Why it matters:')}
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 leading-snug">
                    {action.whyThisMatters}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-300 block mb-1">
                    ⏱️ {t('Por qué ahora:', 'Why now:')}
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 leading-snug">
                    {action.whyNow}
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Multi-Channel Outreach Templates */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t('1. Canales de Contacto Directo', '1. Direct Outreach Channels')}
                </h3>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {t('Mensajes contextualizados', 'Context-aware scripts')}
                </span>
              </div>

              {/* WhatsApp Card */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <MessageSquare size={16} />
                    <span>WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(action.outreach.whatsappMessage, 'wa')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedChannel === 'wa' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedChannel === 'wa' ? t('Copiado', 'Copied') : t('Copiar', 'Copy')}</span>
                    </button>
                    <a
                      href={action.outreach.whatsappUrl || `https://wa.me/${(action.context.phone || '').replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(action.outreach.whatsappMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        handleStartExecution();
                        // Auto complete option
                        ActionEngine.completeAction(action.id, {
                          outcomeType: 'CONTACTED',
                          revenueRecorded: 0,
                          contactMethod: 'whatsapp',
                          notes: t('Abierto canal directo de WhatsApp desde el Drawer.', 'Opened direct WhatsApp channel from the Drawer.')
                        }, tenantUid);
                        try {
                          OutcomeLedgerService.recordExecution({
                            businessId: tenantUid || 'default_business',
                            toolId: 'draft_lead_follow_up',
                            actionId: action.id,
                            executionState: 'SUCCESS',
                            outcomeState: 'DECLARED',
                            outcomeType: 'CONTACTED',
                            metricName: 'LEADS',
                            description: t('Canal directo de WhatsApp abierto desde Drawer', 'Direct WhatsApp channel opened from Drawer'),
                            value: 0,
                            tenantUid: tenantUid
                          });
                        } catch (e) {
                          console.warn('[ActionExecutionDrawer] Ledger WhatsApp skipped:', e);
                        }
                        if (onActionUpdated) onActionUpdated();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t('Abrir WhatsApp', 'Open WhatsApp')}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-emerald-500/10 font-mono text-[11px] leading-relaxed">
                  {action.outreach.whatsappMessage}
                </p>
              </div>

              {/* Call Script Card */}
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    <Phone size={16} />
                    <span>{t('Guion Telefónico', 'Call Script')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(action.outreach.callScript, 'call')}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedChannel === 'call' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedChannel === 'call' ? t('Copiado', 'Copied') : t('Copiar', 'Copy')}</span>
                    </button>
                    {action.context.phone && (
                      <a
                        href={`tel:${action.context.phone}`}
                        onClick={() => {
                          handleStartExecution();
                          ActionEngine.completeAction(action.id, {
                            outcomeType: 'CONTACTED',
                            revenueRecorded: 0,
                            contactMethod: 'call',
                            notes: t('Abierto canal de llamada telefónica desde el Drawer.', 'Opened phone call channel from the Drawer.')
                          }, tenantUid);
                          try {
                            OutcomeLedgerService.recordExecution({
                              businessId: tenantUid || 'default_business',
                              toolId: 'draft_lead_follow_up',
                              actionId: action.id,
                              executionState: 'SUCCESS',
                              outcomeState: 'DECLARED',
                              outcomeType: 'CONTACTED',
                              metricName: 'LEADS',
                              description: t('Canal telefónico directo abierto desde Drawer', 'Direct phone call opened from Drawer'),
                              value: 0,
                              tenantUid: tenantUid
                            });
                          } catch (e) {
                            console.warn('[ActionExecutionDrawer] Ledger Call skipped:', e);
                          }
                          if (onActionUpdated) onActionUpdated();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>{t('Llamar', 'Call')}</span>
                        <Phone size={12} />
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-blue-500/10 italic text-[11px] leading-relaxed">
                  {action.outreach.callScript}
                </p>
              </div>

              {/* Email Template Card */}
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs">
                    <Mail size={16} />
                    <span>{t('Plantilla de Correo Electrónico', 'Email Template')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(`${action.outreach.emailSubject}\n\n${action.outreach.emailBody}`, 'email')}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedChannel === 'email' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedChannel === 'email' ? t('Copiado', 'Copied') : t('Copiar', 'Copy')}</span>
                    </button>
                    <a
                      href={action.outreach.emailUrl || `mailto:${action.context.email || ''}?subject=${encodeURIComponent(action.outreach.emailSubject)}&body=${encodeURIComponent(action.outreach.emailBody)}`}
                      onClick={() => {
                        handleStartExecution();
                        ActionEngine.completeAction(action.id, {
                          outcomeType: 'CONTACTED',
                          revenueRecorded: 0,
                          contactMethod: 'email',
                          notes: t('Abierto canal de correo electrónico desde el Drawer.', 'Opened email channel from the Drawer.')
                        }, tenantUid);
                        try {
                          OutcomeLedgerService.recordExecution({
                            businessId: tenantUid || 'default_business',
                            toolId: 'draft_lead_follow_up',
                            actionId: action.id,
                            executionState: 'SUCCESS',
                            outcomeState: 'DECLARED',
                            outcomeType: 'CONTACTED',
                            metricName: 'LEADS',
                            description: t('Canal de correo abierto desde Drawer', 'Email channel opened from Drawer'),
                            value: 0,
                            tenantUid: tenantUid
                          });
                        } catch (e) {
                          console.warn('[ActionExecutionDrawer] Ledger Email skipped:', e);
                        }
                        if (onActionUpdated) onActionUpdated();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t('Abrir Correo', 'Open Email')}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-purple-500/10 space-y-1.5 text-[11px]">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    <span className="text-slate-400">{t('Asunto:', 'Subject:')}</span> {action.outreach.emailSubject}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {action.outreach.emailBody}
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Tool Navigation CTA */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-slate-900 dark:text-white block">
                  {t('2. Ejecutar en Módulo Dedicado', '2. Execute in Dedicated Tool')}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(
                    `Ir a ${action.destination.tab} con los filtros y contexto pre-cargados`,
                    `Go directly to ${action.destination.tab} with pre-filtered context`
                  )}
                </span>
              </div>
              <button
                onClick={handleDirectNavigation}
                className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:bg-slate-800 dark:hover:bg-slate-100 transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
              >
                <span>{t('Abrir Módulo', 'Open Module')}</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Commercial Outcome Logger */}
            <form onSubmit={handleRecordOutcome} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t('3. Registrar Resultado Comercial', '3. Record Commercial Outcome')}
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  {t('Cierra el ciclo de conversión', 'Closes the conversion loop')}
                </span>
              </div>

              {/* Outcome Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CONTACTED', label: t('Contactado', 'Contacted'), col: 'hover:border-blue-500' },
                  { id: 'ESTIMATE_SENT', label: t('Presupuesto Enviado', 'Quote Sent'), col: 'hover:border-amber-500' },
                  { id: 'WON', label: t('🎉 Venta Ganada', '🎉 Won / Closed'), col: 'hover:border-emerald-500' },
                  { id: 'LOST', label: t('No interesado', 'Lost'), col: 'hover:border-rose-500' },
                ].map(opt => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setSelectedOutcome(opt.id as ActionOutcomeType)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                      selectedOutcome === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 ' + opt.col
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Revenue Input if WON or ESTIMATE_SENT */}
              {(selectedOutcome === 'WON' || selectedOutcome === 'ESTIMATE_SENT') && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    {selectedOutcome === 'WON' 
                      ? t('Ingresos Facturados / Ganados ($)', 'Revenue Invoiced / Won ($)')
                      : t('Monto del Presupuesto Cotizado ($)', 'Quoted Estimate Amount ($)')
                    }
                  </label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={revenueInput}
                      onChange={(e) => setRevenueInput(e.target.value)}
                      placeholder="Ej. 450"
                      className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Contact Method & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    {t('Canal Utilizado', 'Channel Used')}
                  </label>
                  <select
                    value={contactMethod}
                    onChange={(e: any) => setContactMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="call">{t('Llamada Telefónica', 'Phone Call')}</option>
                    <option value="email">{t('Correo Electrónico', 'Email')}</option>
                    <option value="sms">SMS</option>
                    <option value="in_person">{t('En Persona / Visita', 'In Person')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    {t('Nota Comercial (Opcional)', 'Commercial Notes (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder={t('Ej. Requiere instalación el jueves', 'E.g. Wants installation this Thursday')}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingOutcome}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-98"
              >
                <CheckCircle2 size={16} />
                <span>{t('Guardar Resultado Comercial & Cerrar', 'Save Commercial Result & Complete')}</span>
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
