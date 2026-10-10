import React from 'react';
import { ShieldCheck, TrendingUp, Compass, AlertCircle, Info } from 'lucide-react';

interface CommercialMetricsProps {
  recoveredReal: number; // REAL / VERIFIED
  inPlayModeled: number; // MODELED
  detectedBenchmark: number; // BENCHMARK
}

export const CommercialMetrics: React.FC<CommercialMetricsProps> = ({
  recoveredReal,
  inPlayModeled,
  detectedBenchmark
}) => {
  return (
    <div className="space-y-3">
      {/* Aviso de Rigor Financiero */}
      <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg">
        <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span>
          <strong>Rigor financiero Bvelt:</strong> 3 cubos independientes. Prohibido sumar proyecciones con dinero efectivamente cobrado.
        </span>
      </div>

      {/* 3 Cubos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cubo 1: Recuperado */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Dinero Recuperado</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              REAL / VERIFIED
            </span>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            ${recoveredReal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {recoveredReal > 0 
                ? 'Pagos confirmados vía Stripe o transferencias verificadas.' 
                : 'Sin ingresos confirmados aún ($0.00 verificado). No inventamos cifras.'}
            </span>
          </p>
        </div>

        {/* Cubo 2: En Juego */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">En Juego</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
              MODELED
            </span>
          </div>
          <div className="text-3xl font-black text-amber-300 tracking-tight">
            ${inPlayModeled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Presupuestos enviados pendientes de confirmación o cierre.</span>
          </p>
        </div>

        {/* Cubo 3: Detectado */}
        <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Detectado</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 uppercase tracking-wider">
              BENCHMARK
            </span>
          </div>
          <div className="text-3xl font-black text-sky-300 tracking-tight">
            ${detectedBenchmark.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center space-x-1">
            <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Demanda local no capturada y huecos de servicio en tu zona.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
