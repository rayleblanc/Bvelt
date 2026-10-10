import React, { useState } from 'react';
import { 
  X, CheckCircle2, ShieldCheck, DollarSign, Calendar, MessageSquare, 
  Sparkles, CreditCard, ArrowRight, Zap, Check, Lock, AlertCircle 
} from 'lucide-react';
import { RecoveryFeeService, RecoveryFeeRecord, DEFAULT_RECOVERY_FEE } from '../services/recoveryFeeService';
import { recordBveltEvent } from '../knowledge/memory/bemStore';
import { auth } from '../lib/firebase';
import { UsdtPaymentModal } from './dashboard/UsdtPaymentModal';

export interface MarkRecoveredModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  clientName: string;
  initialEstimatedValue?: number;
  serviceCategory?: string;
  t: (es: string, en: string) => string;
  language: 'es' | 'en';
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onSuccess?: (record: RecoveryFeeRecord) => void;
}

export const MarkRecoveredModal: React.FC<MarkRecoveredModalProps> = ({
  isOpen,
  onClose,
  opportunityId,
  clientName,
  initialEstimatedValue = 350,
  serviceCategory = 'Servicios Locales',
  t,
  language,
  showToast,
  onSuccess
}) => {
  const [triggerType, setTriggerType] = useState<'customer_reply' | 'appointment_scheduled' | 'owner_marked'>('customer_reply');
  const [recoveredAmount, setRecoveredAmount] = useState<string>(initialEstimatedValue ? String(initialEstimatedValue) : '');
  const [notes, setNotes] = useState<string>('');
  const [step, setStep] = useState<'form' | 'fee_due_success'>('form');
  const [feeRecord, setFeeRecord] = useState<RecoveryFeeRecord | null>(null);
  const [showUsdtModal, setShowUsdtModal] = useState<boolean>(false);
  const [isProcessingStripe, setIsProcessingStripe] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentFee = DEFAULT_RECOVERY_FEE; // $19 fijo configurable

  const handleConfirmRecovery = () => {
    const numericAmount = parseFloat(recoveredAmount) || initialEstimatedValue || 350;
    const nowIso = new Date().toISOString();

    // 1. Confirmar en el motor de recovery fee
    const record = RecoveryFeeService.confirmRecovery({
      opportunityId,
      businessId: auth?.currentUser?.uid || 'default_business',
      trigger: triggerType,
      hasOwnerMarked: true,
      hasCustomerReply: triggerType === 'customer_reply',
      clientValue: numericAmount,
      ownerTimestamp: nowIso,
      notes: notes.trim() || `Recuperación confirmada vía ${triggerType} con monto de $${numericAmount}`
    });

    if (record) {
      setFeeRecord(record);
      setStep('fee_due_success');
      showToast(
        t('🎉 ¡Cliente marcado como recuperado con éxito!', '🎉 Lead successfully marked as recovered!'),
        'success'
      );
      if (onSuccess) {
        onSuccess(record);
      }
    } else {
      showToast(
        t('Error al confirmar la recuperación. Intenta nuevamente.', 'Error confirming recovery. Please try again.'),
        'error'
      );
    }
  };

  const handleStripePayment = async () => {
    setIsProcessingStripe(true);
    try {
      const user = auth?.currentUser;
      let token = '';
      if (user) {
        try {
          token = await user.getIdToken();
        } catch {}
      }

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          planType: 'recovery_fee',
          opportunityId,
          amount: currentFee,
          email: user?.email || 'owner@bvelt.app'
        })
      }).catch(() => null);

      if (res) {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        const errorMsg = data.details || data.error || t('Error al generar la sesión de pago de Stripe.', 'Error creating Stripe checkout session.');
        showToast(errorMsg, 'error');
        return;
      }

      showToast(
        t('No se pudo conectar con el servidor de pago. Puedes pagar vía USDT BEP-20.', 'Could not connect to payment server. You can pay via USDT BEP-20.'),
        'error'
      );
    } catch (err: any) {
      showToast(
        err?.message || t('No se pudo abrir el enlace de pago de Stripe.', 'Could not open Stripe checkout.'),
        'error'
      );
    } finally {
      setIsProcessingStripe(false);
    }
  };

  const handleUsdtSuccess = () => {
    RecoveryFeeService.markFeePaid(opportunityId, `usdt_bep20_${Date.now()}`);
    setShowUsdtModal(false);
    showToast(
      t('🎉 Pago de fee verificado en BNB Smart Chain.', '🎉 Recovery fee payment verified on BNB Smart Chain.'),
      'success'
    );
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100 relative my-6">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>

          {step === 'form' ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-xs">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                    {t('Marcar Oportunidad como Recuperada', 'Mark Lead as Recovered')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {clientName ? `${clientName} • ` : ''}{serviceCategory}
                  </p>
                </div>
              </div>

              {/* Confirmation Type Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('1. ¿Qué confirmó el dueño del negocio? *', '1. What did the business owner confirm? *')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTriggerType('customer_reply')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition cursor-pointer ${
                      triggerType === 'customer_reply'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <MessageSquare size={16} className={triggerType === 'customer_reply' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                      {triggerType === 'customer_reply' && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-black">{t('Respuesta', 'Customer Reply')}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('Cliente contestó', 'Lead answered')}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTriggerType('appointment_scheduled')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition cursor-pointer ${
                      triggerType === 'appointment_scheduled'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Calendar size={16} className={triggerType === 'appointment_scheduled' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                      {triggerType === 'appointment_scheduled' && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-black">{t('Cita Agendada', 'Appointment')}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('Visita programada', 'Visit scheduled')}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTriggerType('owner_marked')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition cursor-pointer ${
                      triggerType === 'owner_marked'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <CheckCircle2 size={16} className={triggerType === 'owner_marked' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                      {triggerType === 'owner_marked' && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-black">{t('Trabajo Ganado', 'Job Won')}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('Cobro realizado', 'Paid / closed')}</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Amount & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Monto del Trabajo (Opcional $)', 'Job Amount (Optional $)')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      value={recoveredAmount}
                      onChange={e => setRecoveredAmount(e.target.value)}
                      placeholder="350"
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Notas / Detalle (Opcional)', 'Notes / Details (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={t('Ej: Aceptó presupuesto ayer', 'Ex: Accepted quote yesterday')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Pay-After-Win Legal Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1 text-left">
                <div className="flex items-center gap-1.5 font-black text-xs text-amber-700 dark:text-amber-300">
                  <ShieldCheck size={15} />
                  <span>{t('Oferta Pay-After-Win Activa ($0 Upfront)', 'Pay-After-Win Active ($0 Upfront)')}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {t(
                    `El rescate inició a $0. Al confirmar la recuperación se aplica el fee fijo de éxito de $${currentFee}. Sin comisiones porcentuales del trabajo ni retención de tus cobros.`,
                    `Rescue started at $0. Upon confirming recovery, the fixed success fee of $${currentFee} is due. Zero % split and no merchant escrow.`
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  {t('Cancelar', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRecovery}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>{t('Confirmar Recuperación', 'Confirm Recovery')}</span>
                </button>
              </div>
            </>
          ) : (
            /* Step 2: fee_due status banner + payment rails */
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-2 py-2">
                <div className="w-14 h-14 rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl font-black shadow-inner">
                  🎉
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {t('¡Recuperación Confirmada!', 'Recovery Confirmed!')}
                </h3>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Zap size={13} />
                  <span>{t(`Fee de rescate $${currentFee} pendiente`, `Rescue fee $${currentFee} pending`)}</span>
                </div>
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200/90 bg-amber-500/10 dark:bg-amber-500/5 py-1.5 px-3 rounded-xl border border-amber-500/20 max-w-sm mx-auto">
                  {t(
                    'No es la mensualidad. Solo el fee de esta recuperación confirmada.',
                    'Not a subscription. Only the fee for this confirmed recovery.'
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {t(
                    `Se ha registrado el evento BEM owner_marked_recovered. Puedes liquidar el fee de éxito de $${currentFee} ahora mediante Stripe o USDT BEP-20.`,
                    `Event owner_marked_recovered logged. You can settle the $${currentFee} success fee now via Stripe or USDT BEP-20.`
                  )}
                </p>
              </div>

              {/* Payment Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStripePayment}
                  disabled={isProcessingStripe}
                  className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex flex-col items-start justify-between gap-2 text-left transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between w-full">
                    <CreditCard size={18} />
                    <span className="text-xs font-mono font-black">${currentFee} USD</span>
                  </div>
                  <div>
                    <p className="text-xs font-black">{t(`Pagar fee $${currentFee} (Stripe)`, `Pay fee $${currentFee} (Stripe)`)}</p>
                    <p className="text-[10px] text-indigo-200">{t('Checkout seguro con tarjeta', 'Instant secure card checkout')}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUsdtModal(true)}
                  className="p-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-emerald-400 border border-slate-700 rounded-2xl flex flex-col items-start justify-between gap-2 text-left transition cursor-pointer shadow-md active:scale-95"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-black text-sm">₮ BEP-20</span>
                    <span className="text-xs font-mono font-black">{currentFee} USDT</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{t(`Pagar fee $${currentFee} (USDT)`, `Pay fee $${currentFee} (USDT)`)}</p>
                    <p className="text-[10px] text-slate-400">{t('Red BSC on-chain directo', 'BSC chain on-chain verify')}</p>
                  </div>
                </button>
              </div>

              {/* Non-blocking v1 reassurance */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(
                    '💡 Puedes continuar usando la app con total libertad. El badge de fee pendiente permanecerá disponible.',
                    '💡 You can keep using the app with full freedom. The fee due badge will remain available.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                >
                  {t('Cerrar y Continuar', 'Close & Continue')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* USDT Payment Modal for Recovery Fee */}
      {showUsdtModal && (
        <UsdtPaymentModal
          isOpen={showUsdtModal}
          onClose={() => setShowUsdtModal(false)}
          onSuccess={handleUsdtSuccess}
          t={t}
          language={language}
          showToast={showToast}
          customAmount={currentFee}
          planTitle={t(`Fee de Éxito ($${currentFee} USDT)`, `Success Fee ($${currentFee} USDT)`)}
          planSubtitle={t("Pay-After-Win • Verificación On-Chain BSC", "Pay-After-Win • BSC On-Chain Verification")}
          planType="recovery_fee"
        />
      )}
    </>
  );
};
