import React, { useState, useEffect } from 'react';
import { 
  X, Copy, CheckCircle2, ShieldCheck, ArrowRight, RefreshCw, 
  AlertCircle, ExternalLink, QrCode, Lock, Check, Zap, DollarSign
} from 'lucide-react';
import { UsdtPaymentService, CreateUsdtOrderResponse, VerifyUsdtPaymentResponse } from '../../services/usdtPaymentService';

export interface UsdtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receipt: VerifyUsdtPaymentResponse['receipt']) => void;
  t?: (es: string, en: string) => string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  language?: 'es' | 'en';
  customAmount?: number;
  planTitle?: string;
  planSubtitle?: string;
  planType?: 'monthly' | 'recovery_fee';
}

export const UsdtPaymentModal: React.FC<UsdtPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  t = (es: string, en: string) => es,
  showToast,
  language = 'es',
  customAmount = 49,
  planTitle,
  planSubtitle,
  planType = 'monthly'
}) => {
  const [order, setOrder] = useState<CreateUsdtOrderResponse['order'] | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(false);
  const [txHashInput, setTxHashInput] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedOrderId, setCopiedOrderId] = useState<boolean>(false);
  const [statusState, setStatusState] = useState<'pending' | 'verifying' | 'provisioned'>('pending');
  const [receiptData, setReceiptData] = useState<VerifyUsdtPaymentResponse['receipt'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayAmount = customAmount || 49;

  // Initialize or fetch order on open
  useEffect(() => {
    if (isOpen) {
      setLoadingOrder(true);
      setErrorMessage(null);
      setStatusState('pending');
      setReceiptData(null);
      setTxHashInput('');

      UsdtPaymentService.createOrder(planType, displayAmount)
        .then((createdOrder) => {
          setOrder(createdOrder);
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Error al generar la orden de pago en USDT.');
        })
        .finally(() => {
          setLoadingOrder(false);
        });
    }
  }, [isOpen, planType, displayAmount]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, type: 'address' | 'orderId') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'address') {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedOrderId(true);
        setTimeout(() => setCopiedOrderId(false), 2000);
      }
      if (showToast) {
        showToast(t("Copiado al portapapeles", "Copied to clipboard"), "success");
      }
    } catch {}
  };

  const handleVerify = async () => {
    if (!order) return;
    if (!txHashInput || txHashInput.trim().length < 10) {
      setErrorMessage(t("Por favor introduce el Hash de la transacción (TxHash).", "Please enter the Transaction Hash (TxHash)."));
      return;
    }

    setVerifying(true);
    setErrorMessage(null);
    setStatusState('verifying');

    try {
      const response = await UsdtPaymentService.verifyPayment(order.orderId, txHashInput.trim());
      if (response.success && response.receipt) {
        setReceiptData(response.receipt);
        setStatusState('provisioned');
        if (showToast) {
          showToast(t("¡Pago verificado y Plan Pro mensual activado!", "Payment verified & Pro Monthly plan activated!"), "success");
        }
        onSuccess(response.receipt);
      }
    } catch (err: any) {
      setStatusState('pending');
      setErrorMessage(err.message || t("No se pudo verificar la transacción. Revisa que el hash sea correcto y esté confirmado.", "Could not verify transaction. Ensure the hash is correct and confirmed on-chain."));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 text-slate-100 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg shadow-inner">
            ₮
          </div>
          <div>
            <h3 className="text-lg font-black text-white">
              {planTitle || t("Pagar con USDT (BEP-20)", "Pay with USDT (BEP-20)")}
            </h3>
            <p className="text-xs text-slate-400">
              {planSubtitle || t("Plan Mensual Pro • Red BNB Smart Chain (BSC)", "Pro Monthly Plan • BNB Smart Chain (BSC) Network")}
            </p>
          </div>
        </div>

        {/* Status Lifecycle Indicator: pending -> paid -> provisioned */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-wider">
          <div className={`p-2 rounded-xl border flex items-center justify-center gap-1 ${
            statusState === 'pending' || statusState === 'verifying' || statusState === 'provisioned'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              : 'bg-slate-950/40 border-slate-800 text-slate-500'
          }`}>
            <span>1. {t("Depósito", "Deposit")}</span>
          </div>
          <div className={`p-2 rounded-xl border flex items-center justify-center gap-1 ${
            statusState === 'verifying' || statusState === 'provisioned'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-slate-950/40 border-slate-800 text-slate-500'
          }`}>
            <span>2. {t("Verificación", "Verification")}</span>
          </div>
          <div className={`p-2 rounded-xl border flex items-center justify-center gap-1 ${
            statusState === 'provisioned'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-950/40 border-slate-800 text-slate-500'
          }`}>
            <span>3. {t("Aprovisionado", "Provisioned")}</span>
          </div>
        </div>

        {loadingOrder ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-slate-400">{t("Generando orden de pago única...", "Generating unique payment order...")}</p>
          </div>
        ) : statusState === 'provisioned' && receiptData ? (
          /* RECEIPT VIEW */
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-base font-black text-white">
                {t("¡Plan Pro Aprovisionado Exitosamente!", "Pro Plan Successfully Provisioned!")}
              </h4>
              <p className="text-xs text-emerald-300/90">
                {t("Tu suscripción mensual Pro ha sido activada mediante confirmación on-chain.", "Your Pro Monthly subscription is now active via on-chain confirmation.")}
              </p>
            </div>

            {/* Official Receipt Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">{t("ID de Orden:", "Order ID:")}</span>
                <span className="font-mono font-bold text-white text-[11px]">{receiptData.orderId}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">{t("Monto:", "Amount:")}</span>
                <span className="font-bold text-emerald-400">{receiptData.amount} {receiptData.currency}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">{t("Red Blockchain:", "Blockchain Network:")}</span>
                <span className="font-bold text-slate-200">BEP-20 (BNB Smart Chain)</span>
              </div>
              <div className="flex flex-col gap-1 pb-1">
                <span className="text-slate-400">{t("TxHash Verificado:", "Verified TxHash:")}</span>
                <span className="font-mono text-[10px] text-indigo-300 break-all bg-slate-900 p-2 rounded-lg border border-slate-800">
                  {receiptData.txHash}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <span>{t("Continuar a Bvelt Pro", "Continue to Bvelt Pro")}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : order ? (
          /* DEPOSIT & VERIFY VIEW */
          <div className="space-y-4">
            {/* Amount and Network Highlight */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t("Total a transferir", "Total to transfer")}
                </span>
                <div className="text-2xl font-black text-emerald-400">
                  {order.amount || displayAmount} USDT
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t("Red Única", "Single Network")}
                </span>
                <div className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20 mt-0.5">
                  BEP-20 (BNB Smart Chain)
                </div>
              </div>
            </div>

            {/* Receiving Address & Order ID */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>{t("Dirección de Recepción (BEP-20):", "Receiving Address (BEP-20):")}</span>
                  {copiedAddress && <span className="text-emerald-400 text-[10px]">✓ {t("Copiado", "Copied")}</span>}
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="font-mono text-xs text-slate-200 break-all flex-1 select-all">
                    {order.receivingAddress}
                  </span>
                  <button
                    onClick={() => handleCopy(order.receivingAddress, 'address')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition shrink-0 cursor-pointer"
                    title={t("Copiar dirección", "Copy address")}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>{t("ID de Orden:", "Order ID:")} <strong className="font-mono text-slate-300">{order.orderId}</strong></span>
                <button
                  onClick={() => handleCopy(order.orderId, 'orderId')}
                  className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-semibold"
                >
                  {copiedOrderId ? t("Copiado ✓", "Copied ✓") : t("Copiar ID", "Copy ID")}
                </button>
              </div>
            </div>

            {/* QR Code Quick View */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3 flex items-center justify-center gap-3 text-xs text-slate-400">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(order.receivingAddress)}`}
                alt="USDT BSC Deposit QR"
                className="w-20 h-20 rounded-xl bg-white p-1.5 border border-slate-700"
              />
              <div className="space-y-1 text-left">
                <div className="font-bold text-slate-200 flex items-center gap-1 text-[11px]">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  {t("Solo USDT en red BSC (BEP-20)", "Only USDT on BSC (BEP-20)")}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {t(`Transfiere exactamente ${order.amount || displayAmount} USDT. Tras enviar, pega el Hash de la transacción abajo para verificación inmediata.`, `Transfer exactly ${order.amount || displayAmount} USDT. Once sent, paste the Transaction Hash below for instant verification.`)}
                </p>
              </div>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs text-rose-300 animate-fade-in">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Transaction Hash Input */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>{t("Hash de la Transacción (TxHash):", "Transaction Hash (TxHash):")}</span>
                <span className="text-[10px] text-amber-400 font-semibold">{t("(Verificación on-chain)", "(On-chain verification)")}</span>
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              <p className="text-[10px] text-slate-400">
                {t("El hash no es reutilizable y se valida directamente en la red BNB Smart Chain.", "The transaction hash is strictly non-reusable and verified directly on the BNB Smart Chain.")}
              </p>
            </div>

            {/* Verify Button */}
            <button
              disabled={verifying || !txHashInput.trim()}
              onClick={handleVerify}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-98"
            >
              {verifying ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>{t("Verificando bloque en BNB Smart Chain...", "Verifying on BNB Smart Chain block...")}</span>
                </>
              ) : (
                <>
                  <span>{t("Verificar Pago y Aprovisionar Plan Pro", "Verify Payment & Provision Pro Plan")}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
