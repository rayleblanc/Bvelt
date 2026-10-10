import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { offlineSyncEngine, SyncState } from '../../lib/pwa/offlineSync';
import { offlineStore } from '../../lib/pwa/offlineStore';

interface OfflineIndicatorBannerProps {
  lang?: 'es' | 'en';
}

export const OfflineIndicatorBanner: React.FC<OfflineIndicatorBannerProps> = ({ lang = 'es' }) => {
  const [syncState, setSyncState] = useState<SyncState>(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  useEffect(() => {
    const unsubscribe = offlineSyncEngine.subscribe((state, count) => {
      setSyncState(state);
      setPendingCount(count);
    });

    const handleQueueChange = (e: any) => {
      if (e.detail?.count !== undefined) {
        setPendingCount(e.detail.count);
      }
    };

    window.addEventListener('bvelt-offline-queue-changed', handleQueueChange);

    return () => {
      unsubscribe();
      window.removeEventListener('bvelt-offline-queue-changed', handleQueueChange);
    };
  }, []);

  const handleManualSync = async () => {
    setIsRetrying(true);
    try {
      await offlineSyncEngine.syncAll();
    } finally {
      setIsRetrying(false);
    }
  };

  // If online and zero pending mutations, no persistent banner needed
  if (syncState === 'synced' && pendingCount === 0) {
    return null;
  }

  const isOffline = syncState === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine);

  return (
    <div
      id="bvelt-offline-status-banner"
      className={`px-4 py-2 text-xs border-b transition-colors ${
        isOffline
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : syncState === 'syncing'
          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          ) : syncState === 'syncing' ? (
            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          ) : (
            <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          )}

          <div>
            <span className="font-bold">
              {isOffline
                ? t('MODO SIN CONEXIÓN', 'OFFLINE MODE')
                : syncState === 'syncing'
                ? t('SINCRONIZANDO DATOS...', 'SYNCING DATA...')
                : t('COLA LOCAL SINCRONIZADA', 'LOCAL QUEUE SYNCED')}
            </span>
            <span className="mx-1.5 opacity-60">•</span>
            <span className="opacity-90">
              {isOffline
                ? t(
                    'Visualizando datos cacheados. Las modificaciones se guardarán en tu dispositivo y se reconciliarán automáticamente al reconectar.',
                    'Viewing cached snapshot. Offline modifications are saved securely on device and will reconcile automatically once back online.'
                  )
                : t(
                    `Reconciliación de datos completada mediante reglas Last-Write-Wins.`,
                    `Data reconciliation completed using Last-Write-Wins rules.`
                  )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold">
              {pendingCount} {t('pendiente(s)', 'pending')}
            </span>
          )}

          {!isOffline && (
            <button
              onClick={handleManualSync}
              disabled={isRetrying || syncState === 'syncing'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying || syncState === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{t('Sincronizar ahora', 'Sync now')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
