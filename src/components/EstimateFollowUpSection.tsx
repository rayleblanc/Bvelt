import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Sparkles, Copy, MessageCircle, Check, Trash2, 
  Clock, DollarSign, Calendar, User, Briefcase, Phone, HeartHandshake,
  AlertCircle, ChevronDown, ChevronUp, CheckCircle, XCircle
} from 'lucide-react';
import { 
  EstimateRecord, 
  EstimateStatus, 
  getSavedEstimates, 
  addEstimate, 
  updateEstimateStatus, 
  deleteEstimate,
  generateFollowUpMessage 
} from '../services/estimateFollowUpService';
import { recordBveltEvent } from '../knowledge/memory/bemStore';
import { auth } from '../lib/firebase';
import { MarkRecoveredModal } from './MarkRecoveredModal';
import { RecoveryFeeService, RecoveryFeeRecord, DEFAULT_RECOVERY_FEE } from '../services/recoveryFeeService';
import { BeforeYouSendPanel } from './BeforeYouSendPanel';
import { recordQuoteOutcomeToBem } from '../services/beforeYouSendService';

export interface EstimateFollowUpSectionProps {
  t: (es: string, en: string) => string;
  language: 'es' | 'en';
  businessName?: string;
  businessCategory?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onEstimateCountChange?: (count: number) => void;
}

export function EstimateFollowUpSection({
  t,
  language,
  businessName = '',
  businessCategory = '',
  showToast,
  onEstimateCountChange
}: EstimateFollowUpSectionProps) {
  const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<EstimateStatus | 'all'>('waiting');
  
  // New estimate form toggle & fields
  const [isAdding, setIsAdding] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formJob, setFormJob] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDraft, setFormDraft] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<EstimateStatus>('waiting');

  // Tone for follow-up generation
  const [selectedTone, setSelectedTone] = useState<'amigable' | 'directo' | 'urgente'>('amigable');

  // Active generated drafts mapped by estimate ID
  const [activeDrafts, setActiveDrafts] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dispatched tracking and interactive response confirmation state
  const [dispatchedEstIds, setDispatchedEstIds] = useState<Record<string, boolean>>({});
  const [wonAmounts, setWonAmounts] = useState<Record<string, string>>({});

  // Recovery Modal & Fee records state
  const [selectedEstimateForRecovery, setSelectedEstimateForRecovery] = useState<EstimateRecord | null>(null);
  const [recoveryFees, setRecoveryFees] = useState<RecoveryFeeRecord[]>([]);

  // Load estimates on mount
  useEffect(() => {
    const data = getSavedEstimates(language);
    setEstimates(data);
    setRecoveryFees(RecoveryFeeService.getAllRecords());
    if (onEstimateCountChange) {
      const waitingCount = data.filter(e => e.status === 'waiting').length;
      onEstimateCountChange(waitingCount);
    }
  }, [language]);

  // Listen for voice intent 'add closing line'
  useEffect(() => {
    const handleVoiceCloseLine = (e: any) => {
      const closeLine = e.detail?.closeLine;
      if (!closeLine) return;

      // If adding form has draft, append there
      setFormDraft(prev => {
        if (prev) {
          return prev.includes(closeLine) ? prev : `${prev.trim()}\n\n${closeLine}`;
        }
        return prev;
      });

      // Also append to the first waiting estimate draft
      setActiveDrafts(prev => {
        const waitingEst = estimates.find(est => est.status === 'waiting') || estimates[0];
        if (!waitingEst) return prev;
        const cur = prev[waitingEst.id] || '';
        if (cur.includes(closeLine)) return prev;
        return {
          ...prev,
          [waitingEst.id]: cur ? `${cur.trim()}\n\n${closeLine}` : closeLine
        };
      });

      showToast(t('✅ Cierre comercial aplicado por voz al presupuesto.', '✅ Commercial close line applied via voice to quote.'), 'success');
    };

    window.addEventListener('bvelt_apply_suggested_close_line', handleVoiceCloseLine);
    return () => window.removeEventListener('bvelt_apply_suggested_close_line', handleVoiceCloseLine);
  }, [estimates, t, showToast]);

  const refreshList = () => {
    const data = getSavedEstimates(language);
    setEstimates(data);
    setRecoveryFees(RecoveryFeeService.getAllRecords());
    if (onEstimateCountChange) {
      const waitingCount = data.filter(e => e.status === 'waiting').length;
      onEstimateCountChange(waitingCount);
    }
  };

  const handleCreateEstimate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formJob.trim()) {
      showToast(t('Por favor introduce el nombre del cliente y el tipo de trabajo.', 'Please enter the customer name and job type.'), 'info');
      return;
    }

    const cleanAmount = formAmount ? parseFloat(formAmount.replace(/[^0-9.]/g, '')) : undefined;

    const newRecord = addEstimate({
      customerName: formName.trim(),
      phone: formPhone.trim() || undefined,
      jobType: formJob.trim(),
      amount: cleanAmount,
      dateSent: formDate || new Date().toISOString().split('T')[0],
      status: formStatus
    });

    // Automatically generate initial follow-up draft for instant convenience or use custom draft
    const initialDraft = formDraft.trim() || generateFollowUpMessage({
      customerName: formName.trim(),
      jobType: formJob.trim(),
      amount: cleanAmount,
      businessName,
      tone: selectedTone,
      language
    });
    setActiveDrafts(prev => ({ ...prev, [newRecord.id]: initialDraft }));

    // Reset form
    setFormName('');
    setFormPhone('');
    setFormJob('');
    setFormAmount('');
    setFormDraft('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormStatus('waiting');
    setIsAdding(false);

    refreshList();
    showToast(t('✅ Presupuesto guardado en seguimiento.', '✅ Quote saved to follow-up list.'), 'success');

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'estimate_followup_prepared',
      sourceType: 'crm_followup',
      sourceName: 'Lead Follow-up Tool',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_ACTION_INTENT',
      consentScope: 'private',
      trade: businessCategory,
      meta: { jobType: formJob, hasAmount: Boolean(cleanAmount) }
    });
  };

  const handleStatusChange = (id: string, newStatus: EstimateStatus) => {
    const updated = updateEstimateStatus(id, newStatus);
    setEstimates(updated);
    if (onEstimateCountChange) {
      const waitingCount = updated.filter(e => e.status === 'waiting').length;
      onEstimateCountChange(waitingCount);
    }

    const targetEst = estimates.find(e => e.id === id);
    const cleanAmount = targetEst ? (typeof targetEst.amount === 'number' ? targetEst.amount : (targetEst.amount ? parseFloat(String(targetEst.amount).replace(/[^0-9.]/g, '')) : undefined)) : undefined;

    if (newStatus === 'won') {
      const nowIso = new Date().toISOString();
      recordBveltEvent({
        tenantId: auth?.currentUser?.uid,
        type: 'owner_marked_recovered',
        sourceType: 'manual_owner',
        sourceName: 'Owner Verification',
        fetchedAt: nowIso,
        provenance: 'USER_OWNER_CONFIRMATION',
        consentScope: 'private',
        trade: businessCategory,
        meta: {
          estimateId: id,
          ownerMarkedAt: nowIso,
          status: newStatus
        }
      });

      recordQuoteOutcomeToBem({
        event: 'quote_won',
        trade: targetEst?.jobType || businessCategory || 'lawn_care',
        status: 'won',
        amount: cleanAmount,
        estimateId: id,
        customerName: targetEst?.customerName,
        businessId: auth?.currentUser?.uid
      });
    } else if (newStatus === 'lost') {
      recordQuoteOutcomeToBem({
        event: 'quote_lost',
        trade: targetEst?.jobType || businessCategory || 'lawn_care',
        status: 'lost',
        amount: cleanAmount,
        estimateId: id,
        customerName: targetEst?.customerName,
        businessId: auth?.currentUser?.uid
      });
    }

    showToast(t('Estado del presupuesto actualizado.', 'Quote status updated.'), 'info');
  };

  const handleDelete = (id: string) => {
    const updated = deleteEstimate(id);
    setEstimates(updated);
    if (onEstimateCountChange) {
      const waitingCount = updated.filter(e => e.status === 'waiting').length;
      onEstimateCountChange(waitingCount);
    }
    showToast(t('Presupuesto eliminado del seguimiento.', 'Quote removed from follow-up.'), 'info');
  };

  const handleGenerateMessage = (est: EstimateRecord, toneOverride?: 'amigable' | 'directo' | 'urgente') => {
    const tone = toneOverride || selectedTone;
    const msg = generateFollowUpMessage({
      customerName: est.customerName,
      jobType: est.jobType,
      amount: est.amount,
      dateSent: est.dateSent,
      businessName,
      tone,
      language
    });

    setActiveDrafts(prev => ({ ...prev, [est.id]: msg }));
    showToast(t('Mensaje de seguimiento redactado.', 'Follow-up message written.'), 'success');

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'estimate_followup_prepared',
      sourceType: 'crm_followup',
      sourceName: 'Lead Follow-up Tool',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_ACTION_INTENT',
      consentScope: 'private',
      trade: businessCategory,
      meta: {
        customerName: est.customerName,
        jobType: est.jobType,
        amount: est.amount,
        tone
      }
    });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(t('¡Mensaje copiado al portapapeles!', 'Message copied to clipboard!'), 'success');
    setTimeout(() => {
      setCopiedId(prev => (prev === id ? null : prev));
    }, 2000);
  };

  const checkQuietHours = () => {
    const currentHour = new Date().getHours();
    const isQuiet = currentHour >= 20 || currentHour < 8;
    if (isQuiet) {
      showToast(t('⚠️ Horas de Silencio (20:00 - 08:00). Respeta el descanso del cliente.', '⚠️ Quiet Hours (20:00 - 08:00). Respect customer quiet hours.'), 'info');
    }
  };

  const handleSendWhatsApp = (est: EstimateRecord, messageText: string) => {
    checkQuietHours();
    const cleanPhone = (est.phone || '').replace(/\D/g, '');
    let url = '';
    if (cleanPhone.length >= 7) {
      const finalPhone = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;
      url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(messageText)}`;
    } else {
      url = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setDispatchedEstIds(prev => ({ ...prev, [est.id]: true }));

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'share_opened',
      sourceType: 'whatsapp_web',
      sourceName: 'WhatsApp Follow-up',
      fetchedAt: new Date().toISOString(),
      provenance: 'CLIENT_SHARE_TRIGGER',
      consentScope: 'private',
      trade: businessCategory,
      meta: {
        customerName: est.customerName,
        phone: est.phone,
        hasText: Boolean(messageText)
      }
    });
  };

  const handleSendSms = (est: EstimateRecord, messageText: string) => {
    checkQuietHours();
    const cleanPhone = (est.phone || '').replace(/[^0-9+]/g, '');
    const url = `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`;
    window.location.href = url;
    setDispatchedEstIds(prev => ({ ...prev, [est.id]: true }));

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'share_opened',
      sourceType: 'sms_followup',
      sourceName: 'SMS Follow-up',
      fetchedAt: new Date().toISOString(),
      provenance: 'CLIENT_SHARE_TRIGGER',
      consentScope: 'private',
      trade: businessCategory,
      meta: {
        customerName: est.customerName,
        phone: est.phone,
        channel: 'sms'
      }
    });
  };

  const handleSendEmail = (est: EstimateRecord, messageText: string) => {
    checkQuietHours();
    const subject = encodeURIComponent(`Presupuesto - ${businessName || est.jobType}`);
    const url = `mailto:?subject=${subject}&body=${encodeURIComponent(messageText)}`;
    window.location.href = url;
    setDispatchedEstIds(prev => ({ ...prev, [est.id]: true }));

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'share_opened',
      sourceType: 'email_followup',
      sourceName: 'Email Follow-up',
      fetchedAt: new Date().toISOString(),
      provenance: 'CLIENT_SHARE_TRIGGER',
      consentScope: 'private',
      trade: businessCategory,
      meta: {
        customerName: est.customerName,
        jobType: est.jobType,
        channel: 'email'
      }
    });
  };

  const handleConfirmWonOneTouch = (est: EstimateRecord, amountStr?: string) => {
    const rawVal = amountStr !== undefined && amountStr !== '' ? parseFloat(amountStr.replace(/[^0-9.]/g, '')) : (est.amount || 0);
    const finalAmount = !isNaN(rawVal) && rawVal > 0 ? rawVal : (est.amount || 0);
    const nowIso = new Date().toISOString();

    handleStatusChange(est.id, 'won');

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'owner_marked_recovered',
      sourceType: 'manual_owner',
      sourceName: 'Owner Follow-up Confirmation',
      fetchedAt: nowIso,
      provenance: 'USER_PROVIDED',
      consentScope: 'private',
      trade: businessCategory,
      meta: {
        estimateId: est.id,
        customerName: est.customerName,
        jobType: est.jobType,
        recoveredAmount: finalAmount,
        ownerMarkedAt: nowIso,
        status: 'won'
      }
    });

    RecoveryFeeService.recordRecovery({
      opportunityId: `est_${est.id}`,
      opportunityTitle: `${est.customerName} - ${est.jobType}`,
      recoveredRevenue: finalAmount,
      opportunityType: 'estimate_followup'
    });

    showToast(t(`🏆 ¡Recuperado confirmado por $${finalAmount}! Guardado como dato confirmado.`, `🏆 Recovered confirmed for $${finalAmount}! Saved as confirmed data.`), 'success');
    refreshList();
  };

  const filteredEstimates = estimates.filter(est => {
    if (filterStatus === 'all') return true;
    return est.status === filterStatus;
  });

  const waitingCount = estimates.filter(e => e.status === 'waiting').length;

  return (
    <div id="estimate-followup-section" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-sm space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {t('Seguimiento de Presupuestos', 'Quote & Estimate Follow-up')}
                </h2>
                {waitingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {waitingCount} {t('sin respuesta', 'waiting')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'Recupera cotizaciones enviadas que no tuvieron respuesta antes de que se pierdan.',
                  'Follow up on sent quotes that got no reply and win back lost jobs.'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="self-start sm:self-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>{isAdding ? t('Cerrar Formulario', 'Close Form') : t('Nuevo Presupuesto', 'Add Quote')}</span>
          </button>
        </div>
      </div>

      {/* Add New Estimate Form (Collapsible) */}
      {isAdding && (
        <form onSubmit={handleCreateEstimate} className="bg-slate-50 dark:bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
            <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-500" />
              {t('Registrar Presupuesto Enviado', 'Log Sent Quote / Estimate')}
            </span>
            <span className="text-[10px] text-slate-500">{t('Campos clave', 'Key fields')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('Nombre del Cliente *', 'Customer Name *')}
              </label>
              <div className="relative">
                <User size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder={t('Ej. Roberto Gómez', 'e.g. Robert Smith')}
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('Tipo de Trabajo / Servicio *', 'Job Type / Service *')}
              </label>
              <div className="relative">
                <Briefcase size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder={t('Ej. Reparación de compresor o Pintura sala', 'e.g. Compressor repair or Interior painting')}
                  value={formJob}
                  onChange={e => setFormJob(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('Monto Cotizado (Opcional)', 'Quote Amount (Optional)')}
              </label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('Ej. 450', 'e.g. 450')}
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('Teléfono / WhatsApp (Opcional)', 'Phone / WhatsApp (Optional)')}
              </label>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('Ej. 239-555-0142', 'e.g. 239-555-0142')}
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('Fecha de Envío', 'Date Sent')}
              </label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('Estado Inicial', 'Initial Status')}
              </label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as EstimateStatus)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="waiting">⏳ {t('Esperando respuesta', 'Waiting for reply')}</option>
                <option value="replied">💬 {t('Respondido / En negociación', 'Replied')}</option>
                <option value="won">🏆 {t('Ganado / Aprobado', 'Won / Booked')}</option>
                <option value="lost">❌ {t('Perdido / Rechazado', 'Lost')}</option>
              </select>
            </div>
          </div>

          {/* Quote Draft Text & Live Before You Send Check */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
              {t('Texto / Detalle del Presupuesto (Opcional — Verificación Comercial)', 'Quote Text / Details (Optional — Commercial Completeness Check)')}
            </label>
            <textarea
              value={formDraft}
              onChange={e => setFormDraft(e.target.value)}
              rows={3}
              placeholder={t('Ej. Corte y orillado de césped patio delantero y trasero cada dos semanas por $75. Excluye retiro de ramas. Responde APRUEBO para agendar este jueves.', 'e.g. Bi-weekly front and back yard mowing & edging for $75. Excludes branch removal. Reply APPROVE to reserve this Thursday.')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500 font-sans"
            />
            {formDraft.trim() && (
              <BeforeYouSendPanel
                trade={formJob || businessCategory || 'lawn_care'}
                draftText={formDraft}
                amount={formAmount ? parseFloat(formAmount.replace(/[^0-9.]/g, '')) : undefined}
                language={language}
                t={t}
                showToast={showToast}
                compact={true}
                onApplyCloseLine={closeLine => {
                  setFormDraft(prev => prev.includes(closeLine) ? prev : `${prev.trim()}\n\n${closeLine}`);
                }}
                onCopyWhatsApp={() => {
                  if (formDraft) {
                    navigator.clipboard.writeText(formDraft);
                    showToast(t('✅ Copiado para WhatsApp', '✅ Copied for WhatsApp'), 'success');
                  }
                }}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
            >
              {t('Cancelar', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Check size={14} />
              <span>{t('Guardar y Redactar Seguimiento', 'Save & Draft Follow-up')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tone Preference Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs font-black text-slate-800 dark:text-slate-200">
            {t('Estilo de seguimiento:', 'Follow-up Style:')}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(['amigable', 'directo', 'urgente'] as const).map(tone => {
            const isSelected = selectedTone === tone;
            const labels = {
              amigable: t('Amigable', 'Friendly'),
              directo: t('Directo', 'Direct'),
              urgente: t('Urgente', 'Urgent')
            };
            return (
              <button
                key={tone}
                type="button"
                onClick={() => setSelectedTone(tone)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {labels[tone]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setFilterStatus('waiting')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterStatus === 'waiting'
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>⏳ {t('Esperando Respuesta', 'Waiting for Reply')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black">
            {estimates.filter(e => e.status === 'waiting').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('replied')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterStatus === 'replied'
              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>💬 {t('Respondidos', 'Replied')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black">
            {estimates.filter(e => e.status === 'replied').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('won')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterStatus === 'won'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>🏆 {t('Ganados', 'Won')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black">
            {estimates.filter(e => e.status === 'won').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('lost')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterStatus === 'lost'
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>❌ {t('Perdidos', 'Lost')}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black">
            {estimates.filter(e => e.status === 'lost').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto ${
            filterStatus === 'all'
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {t('Ver Todos', 'View All')} ({estimates.length})
        </button>
      </div>

      {/* Estimates List */}
      <div className="space-y-3.5">
        {filteredEstimates.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <FileText size={24} className="mx-auto text-slate-400" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {filterStatus === 'waiting'
                ? t('No tienes presupuestos pendientes esperando respuesta.', 'No quotes currently waiting for reply.')
                : t('No hay presupuestos en esta categoría.', 'No quotes found in this category.')}
            </p>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              + {t('Agregar un presupuesto enviado', 'Add a sent quote')}
            </button>
          </div>
        ) : (
          filteredEstimates.map((est) => {
            const draft = activeDrafts[est.id];
            return (
              <div
                key={est.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
                  est.status === 'waiting'
                    ? 'bg-amber-50/30 dark:bg-amber-950/15 border-amber-200/70 dark:border-amber-900/40'
                    : est.status === 'won'
                      ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-200/70 dark:border-emerald-900/40'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {est.customerName}
                      </span>
                      {est.amount && (
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          ${est.amount}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{est.jobType}</span>
                      <span>•</span>
                      <span>{t('Enviado:', 'Sent:')} {est.dateSent}</span>
                      {est.phone && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{est.phone}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Selector & Delete */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <select
                      value={est.status}
                      onChange={e => {
                        const nextStatus = e.target.value as EstimateStatus;
                        if (nextStatus === 'won') {
                          setSelectedEstimateForRecovery(est);
                        } else {
                          handleStatusChange(est.id, nextStatus);
                        }
                      }}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer ${
                        est.status === 'waiting'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                          : est.status === 'replied'
                            ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                            : est.status === 'won'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <option value="waiting">⏳ {t('Esperando respuesta', 'Waiting')}</option>
                      <option value="replied">💬 {t('Respondido', 'Replied')}</option>
                      <option value="won">🏆 {t('Ganado / Recuperado', 'Won / Recovered')}</option>
                      <option value="lost">❌ {t('Perdido', 'Lost')}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDelete(est.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                      title={t('Eliminar', 'Delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Fee Due / Recovery Badge if applicable */}
                {(() => {
                  const feeRec = recoveryFees.find(r => r.opportunityId === est.id || r.opportunityId === `est_${est.id}`);
                  if (feeRec && feeRec.status === 'fee_due') {
                    return (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>{t(`Fee de rescate $${feeRec.fixedFee} pendiente`, `Rescue fee $${feeRec.fixedFee} pending`)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedEstimateForRecovery(est)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs"
                        >
                          {t(`Pagar fee $${feeRec.fixedFee}`, `Pay fee $${feeRec.fixedFee}`)}
                        </button>
                      </div>
                    );
                  }
                  if (feeRec && feeRec.status === 'paid') {
                    return (
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Check size={13} />
                        <span>{t(`Fee de éxito pagado ($${feeRec.fixedFee})`, `Success fee paid ($${feeRec.fixedFee})`)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Draft Message Body (or generate button) */}
                {draft ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                        <span>{t('Mensaje de Presupuesto / Seguimiento', 'Quote / Follow-up Message')}</span>
                      </div>
                      <textarea
                        value={draft}
                        onChange={e => setActiveDrafts(prev => ({ ...prev, [est.id]: e.target.value }))}
                        rows={3}
                        className="w-full p-3 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed outline-none focus:border-indigo-500 font-sans resize-y"
                        placeholder={t('Edita el texto del presupuesto...', 'Edit quote message...')}
                      />
                    </div>

                    {/* Before You Send Commercial Completeness Guard */}
                    <BeforeYouSendPanel
                      trade={est.jobType || businessCategory || 'lawn_care'}
                      draftText={draft}
                      amount={typeof est.amount === 'number' ? est.amount : (est.amount ? parseFloat(String(est.amount).replace(/[^0-9.]/g, '')) : undefined)}
                      estimateId={est.id}
                      customerName={est.customerName}
                      language={language}
                      t={t}
                      showToast={showToast}
                      onApplyCloseLine={closeLine => {
                        setActiveDrafts(prev => {
                          const currentText = prev[est.id] || draft || '';
                          return {
                            ...prev,
                            [est.id]: currentText.includes(closeLine) ? currentText : `${currentText.trim()}\n\n${closeLine}`
                          };
                        });
                      }}
                      onCopyWhatsApp={() => handleCopy(draft, est.id)}
                      onSendPrimary={() => handleSendWhatsApp(est, draft)}
                      onMarkSentAnyway={() => {
                        handleStatusChange(est.id, 'waiting');
                        setDispatchedEstIds(prev => ({ ...prev, [est.id]: true }));
                      }}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Texto (SMS) */}
                      <button
                        type="button"
                        onClick={() => handleSendSms(est, draft)}
                        className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                      >
                        <span>📱 {t('Texto', 'Text')}</span>
                      </button>

                      {/* WhatsApp */}
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(est, draft)}
                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                      >
                        <MessageCircle size={13} />
                        <span>WhatsApp</span>
                      </button>

                      {/* Correo (Email) */}
                      <button
                        type="button"
                        onClick={() => handleSendEmail(est, draft)}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                      >
                        <span>✉️ {t('Correo', 'Email')}</span>
                      </button>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(draft, est.id)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                      >
                        {copiedId === est.id ? (
                          <>
                            <Check size={13} />
                            <span>{t('¡Copiado!', 'Copied!')}</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>{t('Copiar', 'Copy')}</span>
                          </>
                        )}
                      </button>

                      {/* Regenerar */}
                      <button
                        type="button"
                        onClick={() => handleGenerateMessage(est)}
                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ml-auto transition cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles size={12} className="text-amber-500" />
                        <span>{t('Regenerar', 'Regenerate')}</span>
                      </button>
                    </div>

                    {/* Interactive Response Bar: ¿Respondió? y ¿Ganado? $___ */}
                    {est.status !== 'won' && (
                      <div className="mt-3 p-3 bg-slate-100/80 dark:bg-slate-950/90 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-700 dark:text-slate-300">
                            {t('¿Respondió?', 'Did they reply?')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(est.id, 'replied')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                              est.status === 'replied'
                                ? 'bg-sky-500 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {t('Sí', 'Yes')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(est.id, 'waiting')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                              est.status === 'waiting'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {t('Aún no', 'Not yet')}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="font-black text-emerald-600 dark:text-emerald-400">
                            {t('¿Ganado? $', 'Won? $')}
                          </span>
                          <input
                            type="number"
                            placeholder={est.amount ? String(est.amount) : '0'}
                            value={wonAmounts[est.id] !== undefined ? wonAmounts[est.id] : (est.amount ? String(est.amount) : '')}
                            onChange={(e) => setWonAmounts({ ...wonAmounts, [est.id]: e.target.value })}
                            className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmWonOneTouch(est, wonAmounts[est.id])}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg transition cursor-pointer shadow-xs active:scale-95"
                          >
                            <span>🏆 {t('Guardar Ganado', 'Save Won')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        {t('¿Sin respuesta aún? Redacta un mensaje amable para reanudar el contacto.', 'No reply yet? Write a polite follow-up to restart the conversation.')}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleGenerateMessage(est)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0 active:scale-95"
                      >
                        <Sparkles size={13} className="text-amber-300" />
                        <span>{t('Escribir mensaje', 'Write message')}</span>
                      </button>
                    </div>

                    {/* Interactive Response Bar: ¿Respondió? y ¿Ganado? $___ */}
                    {est.status !== 'won' && (
                      <div className="p-3 bg-slate-100/80 dark:bg-slate-950/90 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-700 dark:text-slate-300">
                            {t('¿Respondió?', 'Did they reply?')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(est.id, 'replied')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                              est.status === 'replied'
                                ? 'bg-sky-500 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {t('Sí', 'Yes')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(est.id, 'waiting')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                              est.status === 'waiting'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {t('Aún no', 'Not yet')}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="font-black text-emerald-600 dark:text-emerald-400">
                            {t('¿Ganado? $', 'Won? $')}
                          </span>
                          <input
                            type="number"
                            placeholder={est.amount ? String(est.amount) : '0'}
                            value={wonAmounts[est.id] !== undefined ? wonAmounts[est.id] : (est.amount ? String(est.amount) : '')}
                            onChange={(e) => setWonAmounts({ ...wonAmounts, [est.id]: e.target.value })}
                            className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmWonOneTouch(est, wonAmounts[est.id])}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg transition cursor-pointer shadow-xs active:scale-95"
                          >
                            <span>🏆 {t('Guardar Ganado', 'Save Won')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Notice / Limits disclaimer */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
          <HeartHandshake size={16} />
        </div>
        <div className="space-y-0.5 text-left">
          <p className="text-xs font-black text-indigo-950 dark:text-indigo-200">
            {t('You send the messages. Bvelt prepares them.', 'You send the messages. Bvelt prepares them.')}
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
            {t(
              'Tú tienes el 100% del control. Bvelt genera los mensajes personalizados de seguimiento para que tú los envíes directamente por WhatsApp, SMS o llamada sin spam ni bots automatizados.',
              'You maintain 100% control. Bvelt crafts personalized follow-up messages for you to send directly via WhatsApp, SMS, or phone with zero spam bots.'
            )}
          </p>
        </div>
      </div>

      {/* Mark Recovered Modal */}
      {selectedEstimateForRecovery && (
        <MarkRecoveredModal
          isOpen={Boolean(selectedEstimateForRecovery)}
          onClose={() => setSelectedEstimateForRecovery(null)}
          opportunityId={selectedEstimateForRecovery.id}
          clientName={selectedEstimateForRecovery.customerName}
          initialEstimatedValue={selectedEstimateForRecovery.amount || 350}
          serviceCategory={selectedEstimateForRecovery.jobType || businessCategory}
          t={t}
          language={language}
          showToast={showToast}
          onSuccess={(rec) => {
            handleStatusChange(selectedEstimateForRecovery.id, 'won');
            refreshList();
          }}
        />
      )}
    </div>
  );
}
