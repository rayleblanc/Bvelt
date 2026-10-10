import React, { useState } from 'react';
import { 
  X, Link2, Copy, Check, ExternalLink, Sparkles, AlertTriangle, 
  Building2, MapPin, Tag, RefreshCw, Eye
} from 'lucide-react';
import { 
  generateSignalsFromOperatorInput, 
  saveFunnelReport, 
  buildFunnelShareUrl, 
  ModeledOpportunityReport 
} from '../../services/signalsGenerator';

export interface FunnelLinkGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBusinessName?: string;
  initialCity?: string;
  initialCategory?: string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const FunnelLinkGeneratorModal: React.FC<FunnelLinkGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialBusinessName = '',
  initialCity = '',
  initialCategory = '',
  showToast
}) => {
  const [businessName, setBusinessName] = useState(initialBusinessName || '');
  const [city, setCity] = useState(initialCity || '');
  const [category, setCategory] = useState(initialCategory || '');
  const [pastedText, setPastedText] = useState('');
  const [unrepliedCount, setUnrepliedCount] = useState<number>(3);
  const [negativeCount, setNegativeCount] = useState<number>(2);
  const [hasWeakCta, setHasWeakCta] = useState(true);

  const [generatedReport, setGeneratedReport] = useState<ModeledOpportunityReport | null>(() => {
    if (initialBusinessName) {
      return generateSignalsFromOperatorInput({
        businessName: initialBusinessName,
        city: initialCity,
        category: initialCategory,
        unrepliedReviewsCount: 3,
        negativeReviewsCount: 2,
        hasWeakCta: true
      });
    }
    return null;
  });

  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!businessName.trim()) {
      if (showToast) showToast('Ingresa el nombre del negocio', 'error');
      return;
    }

    const report = generateSignalsFromOperatorInput({
      businessName,
      city,
      category,
      pastedPublicText: pastedText,
      unrepliedReviewsCount: unrepliedCount,
      negativeReviewsCount: negativeCount,
      hasWeakCta
    });

    saveFunnelReport(report);
    setGeneratedReport(report);
    if (showToast) showToast('✓ Señales y enlace de embudo generados con éxito', 'success');
  };

  const handleCopyUrl = async () => {
    if (!generatedReport) return;
    const url = buildFunnelShareUrl(generatedReport);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      if (showToast) showToast('✓ Enlace móvil /r/:id copiado al portapapeles', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      if (showToast) showToast('Error al copiar el enlace', 'error');
    }
  };

  const shareUrl = generatedReport ? buildFunnelShareUrl(generatedReport) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">
                Generador de Enlaces de Embudo (/r/:id)
              </h3>
              <p className="text-xs text-slate-400">
                Crea una página móvil de alta conversión a partir de datos públicos mínimos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-slate-800 dark:text-slate-100 font-sans">
          
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Nombre del Negocio *
                </label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Fontanería García"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ciudad / Área
                </label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ej. Valencia, ES"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sector / Categoría
                </label>
                <div className="relative">
                  <Tag size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ej. Fontanería"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Paste Public Google Maps Data / Raw Notes */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Pegar Datos Públicos de Ficha / Reseñas (Opcional)</span>
                <span className="text-[10px] text-indigo-500 font-semibold">Detección automática</span>
              </label>
              <textarea
                rows={3}
                placeholder="Pega aquí el texto que copiaste de Google Maps (reseñas recientes, calificación, quejas o ausencia de WhatsApp)..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-indigo-500 font-mono"
              />
            </div>

            {/* Quick Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWeakCta}
                  onChange={e => setHasWeakCta(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>CTA Débil / Sin WhatsApp</span>
              </label>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-600 dark:text-slate-300">Reseñas sin responder:</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={unrepliedCount}
                  onChange={e => setUnrepliedCount(parseInt(e.target.value) || 0)}
                  className="w-12 text-center text-xs font-bold rounded bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-600 dark:text-slate-300">Negativas sin atender:</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={negativeCount}
                  onChange={e => setNegativeCount(parseInt(e.target.value) || 0)}
                  className="w-12 text-center text-xs font-bold rounded bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md"
            >
              <RefreshCw size={14} />
              <span>Generar Señales y Enlace de Embudo</span>
            </button>
          </form>

          {/* Generated Result Preview */}
          {generatedReport && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Oportunidad Proyectada ({generatedReport.modeledBadge})
                  </span>
                  <div className="text-xl font-black text-indigo-950 dark:text-indigo-200">
                    {generatedReport.modeledMonthlyRange.formatted}
                  </div>
                </div>
                <span className="px-2 py-1 rounded-md text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {generatedReport.signals.length} Señales Clave
                </span>
              </div>

              {/* Signals preview list */}
              <div className="space-y-2">
                {generatedReport.signals.map((sig, i) => (
                  <div key={sig.id || i} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {sig.title}
                      </span>
                      <span className="text-[9px] font-black uppercase text-indigo-500">
                        {sig.source}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {sig.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Copy & View Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md"
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace Móvil /r/:id'}</span>
                </button>

                <a
                  href={`/r/${generatedReport.id}?name=${encodeURIComponent(generatedReport.businessName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Eye size={14} />
                  <span>Ver Página Móvil</span>
                </a>
              </div>

              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono break-all bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                {shareUrl}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
