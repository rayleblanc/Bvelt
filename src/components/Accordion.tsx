import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Copy, Check, Mail, Send, Loader2, X } from 'lucide-react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  contentToCopy: string;
  t: (es: string, en: string) => string;
  agentType?: string;
  emailSubject?: string;
  businessName?: string;
  allowEmailSend?: boolean;
}

export const Accordion = ({
  title,
  children,
  contentToCopy,
  t,
  agentType,
  emailSubject,
  businessName,
  allowEmailSend = false,
}: AccordionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customSubject, setCustomSubject] = useState(emailSubject || title);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.trim()) return;

    setSendingEmail(true);
    setSendStatus(null);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipientEmail.trim(),
          subject: customSubject || title,
          textContent: contentToCopy,
          agentType: agentType || 'commercial',
          businessName: businessName || 'Bvelt',
        }),
      });

      const ct = response.headers.get('content-type') || '';
      if (!response.ok || !ct.includes('application/json')) {
        let errText = '';
        if (ct.includes('application/json')) {
          try {
            const errData = await response.json() as { error?: string };
            errText = errData.error || '';
          } catch (_) {}
        }
        throw new Error(errText || t('Error al enviar el correo', 'Error sending email'));
      }

      const data = await response.json().catch(() => ({ success: false })) as { success?: boolean; error?: string };

      if (response.ok && data.success) {
        setSendStatus({
          type: 'success',
          message: t('¡Correo enviado exitosamente vía Resend!', 'Email sent successfully via Resend!'),
        });
        setTimeout(() => {
          setShowEmailModal(false);
          setSendStatus(null);
          setRecipientEmail('');
        }, 2200);
      } else {
        throw new Error(data.error || t('Error al enviar el correo', 'Error sending email'));
      }
    } catch (err: any) {
      setSendStatus({
        type: 'error',
        message: err.message || t('Ocurrió un fallo en el servidor de correo.', 'Server mail error occurred.'),
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left font-bold text-slate-800 dark:text-slate-200"
      >
        <span>{title}</span>
        <ChevronDown size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 text-slate-600 dark:text-slate-400 text-xs leading-relaxed border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-end items-center gap-2 mb-3 pt-2">
                {allowEmailSend && (
                  <button
                    onClick={() => {
                      setCustomSubject(emailSubject || title);
                      setShowEmailModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition text-[11px] font-extrabold cursor-pointer"
                  >
                    <Mail size={13} />
                    {t('Enviar por Correo', 'Send via Email')}
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  title={t('Copiar texto', 'Copy text')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition text-[11px] font-bold cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? t('¡Copiado!', 'Copied!') : t('Copiar', 'Copy')}</span>
                </button>
              </div>

              {children}

              {/* Email Modal / Modal Inclinado */}
              {showEmailModal && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">
                      <Mail size={14} />
                      <span>{t('Enviar con Resend', 'Send with Resend')}</span>
                    </div>
                    <button
                      onClick={() => setShowEmailModal(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <form onSubmit={handleSendEmail} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                        {t('Correo del Destinatario (Cliente):', 'Recipient Email:')}
                      </label>
                      <input
                        type="email"
                        required
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="cliente@ejemplo.com"
                        className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                        {t('Asunto del Correo:', 'Email Subject:')}
                      </label>
                      <input
                        type="text"
                        required
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {sendStatus && (
                      <div
                        className={`p-2.5 rounded-lg text-[11px] font-bold ${
                          sendStatus.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {sendStatus.message}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowEmailModal(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                      >
                        {t('Cancelar', 'Cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={sendingEmail}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        {sendingEmail ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            {t('Enviando...', 'Sending...')}
                          </>
                        ) : (
                          <>
                            <Send size={13} />
                            {t('Enviar Correo', 'Send Email')}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
