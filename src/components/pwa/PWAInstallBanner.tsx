import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Zap, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../../lib/pwa/usePWAInstall';
import { PWAInstallButton } from './PWAInstallButton';

interface PWAInstallBannerProps {
  lang?: 'es' | 'en';
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ lang = 'es' }) => {
  const { isInstallable, isInstalled, isStandalone, isIOS } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem('bvelt_pwa_banner_dismissed') === 'true';
      setDismissed(isDismissed);
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('bvelt_pwa_banner_dismissed', 'true');
    } catch {}
  };

  if (isStandalone || isInstalled || dismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  return (
    <div
      id="pwa-install-banner"
      className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-y border-indigo-500/30 px-4 py-2.5 shadow-lg relative z-30"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>{t('Instala BVELT en tu móvil o escritorio', 'Install BVELT on Mobile or Desktop')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {t('OFFLINE READY', 'OFFLINE READY')}
              </span>
            </p>
            <p className="text-[11px] text-slate-400">
              {t(
                'Acceso instantáneo a brechas locales, fotos con evidencia GPS y registro seguro sin conexión.',
                'Instant access to local market gaps, GPS photo proof, and offline verified records.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton lang={lang} variant="primary" />
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title={t('Cerrar aviso', 'Dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
