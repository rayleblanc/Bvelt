import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, X, CheckCircle, AlertTriangle, Key, Clock, ShieldCheck } from 'lucide-react';

interface ProviderHealthResult {
  name: string;
  status: 'ok' | 'fail' | 'missing_key' | 'timeout';
  ms: number;
  statusCode?: number | null;
  detail: string;
}

interface HealthResponse {
  ok: boolean;
  checkedAt: string;
  providers: ProviderHealthResult[];
}

interface ApiHealthDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (es: string, en: string) => string;
  language: string;
}

export const ApiHealthDiagnosticModal: React.FC<ApiHealthDiagnosticModalProps> = ({
  isOpen,
  onClose,
  t,
  language
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEn = language === 'en';

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health/providers', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json: HealthResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Error executing health check');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostic();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const renderStatusBadge = (p: ProviderHealthResult) => {
    const { status, statusCode } = p;
    switch (status) {
      case 'ok':
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle size={10} />
              {statusCode ? `HTTP ${statusCode}` : 'OK'}
            </span>
          </div>
        );
      case 'fail':
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <AlertTriangle size={10} />
              {statusCode ? `HTTP ${statusCode}` : 'FAIL'}
            </span>
          </div>
        );
      case 'timeout':
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs shadow-amber-500/50" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock size={10} />
              {statusCode ? `HTTP ${statusCode}` : 'TIMEOUT'}
            </span>
          </div>
        );
      case 'missing_key':
      default:
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
              <Key size={10} />
              {isEn ? 'NO KEY' : 'SIN CLAVE'}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {t('Diagnóstico de APIs y Proveedores', 'API & Provider Diagnostics')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('Verificación en vivo de conectividad y credenciales de servicios integrados.', 'Live connectivity and credentials check for integrated third-party services.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action & Status Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className={data?.ok ? 'text-emerald-500' : 'text-amber-500'} />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {loading ? (
                t('Probando proveedores...', 'Checking providers...')
              ) : data ? (
                data.ok 
                  ? t('✅ Todos los proveedores configurados están operativos', '✅ All configured providers are operational')
                  : t('⚠️ Se detectaron fallos o timeouts en algunos proveedores', '⚠️ Failures or timeouts detected in some providers')
              ) : (
                t('Listo para verificar', 'Ready to test')
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={runDiagnostic}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? t('Verificando...', 'Testing...') : t('Ejecutar Prueba', 'Run Recheck')}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 font-bold">
            {error}
          </div>
        )}

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">{t('Proveedor', 'Provider')}</th>
                <th className="pb-3">{t('Estado', 'Status')}</th>
                <th className="pb-3">{t('Latencia', 'Latency')}</th>
                <th className="pb-3 pr-2">{t('Detalles', 'Details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading && !data ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    {t('Consultando endpoints de salud...', 'Querying health check endpoints...')}
                  </td>
                </tr>
              ) : data?.providers ? (
                data.providers.map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pl-2 font-black text-slate-900 dark:text-white capitalize">
                      {p.name}
                    </td>
                    <td className="py-3">
                      {renderStatusBadge(p)}
                    </td>
                    <td className="py-3 font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {p.status === 'missing_key' ? '-' : `${p.ms} ms`}
                    </td>
                    <td className="py-3 pr-2 text-slate-600 dark:text-slate-300 font-medium max-w-xs truncate" title={p.detail}>
                      {p.detail}
                    </td>
                  </tr>
                ))
              ) : null}
            </tbody>
          </table>
        </div>

        {data?.checkedAt && (
          <div className="text-right text-[10px] text-slate-400 font-mono">
            {t('Última verificación:', 'Last checked:')} {new Date(data.checkedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};
