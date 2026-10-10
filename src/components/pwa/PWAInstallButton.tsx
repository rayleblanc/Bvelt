import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../../lib/pwa/usePWAInstall';

interface PWAInstallButtonProps {
  lang?: 'es' | 'en';
  className?: string;
  variant?: 'primary' | 'outline' | 'minimal';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang = 'es',
  className = '',
  variant = 'primary'
}) => {
  const { isInstallable, isInstalled, isStandalone, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  // If already installed in standalone mode, hide the button
  if (isStandalone || isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop direct install
  if (isInstallable) {
    let buttonStyle = "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ";
    if (variant === 'primary') {
      buttonStyle += "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20";
    } else if (variant === 'outline') {
      buttonStyle += "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20";
    } else {
      buttonStyle += "text-slate-300 hover:text-white hover:bg-slate-800";
    }

    return (
      <button
        id="btn-pwa-install-app"
        onClick={install}
        className={`${buttonStyle} ${className}`}
        title={t('Instalar aplicación BVELT en tu dispositivo', 'Install BVELT App on your device')}
      >
        <Download className="w-4 h-4" />
        <span>{t('Instalar App', 'Install App')}</span>
      </button>
    );
  }

  // iOS Safari Flow
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          onClick={() => setShowIOSModal(true)}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition ${className}`}
          title={t('Instalar BVELT en iPhone/iPad', 'Install BVELT on iPhone/iPad')}
        >
          <Smartphone className="w-4 h-4" />
          <span>{t('Instalar en iOS', 'Install on iOS')}</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowIOSModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                <Smartphone className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-slate-100">
                {t('Instalar BVELT en tu iPhone o iPad', 'Install BVELT on iPhone / iPad')}
              </h3>

              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {t(
                  'Ten acceso instantáneo a tu radar de oportunidades y registro verificado sin conexión:',
                  'Get instant offline access to your opportunity radar and verified record:'
                )}
              </p>

              <div className="mt-4 space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-slate-200 shrink-0">1</span>
                  <div className="flex items-center gap-1.5">
                    <span>{t('Toca el botón', 'Tap the')}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-semibold border border-slate-700">
                      <Share className="w-3.5 h-3.5" /> {t('Compartir', 'Share')}
                    </span>
                    <span>{t('en Safari', 'in Safari')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-slate-200 shrink-0">2</span>
                  <div className="flex items-center gap-1.5">
                    <span>{t('Selecciona', 'Select')}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-semibold border border-slate-700">
                      <PlusSquare className="w-3.5 h-3.5" /> {t('Añadir a pantalla de inicio', 'Add to Home Screen')}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-5 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold text-white transition shadow-lg shadow-indigo-600/20"
              >
                {t('Entendido', 'Got it')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
