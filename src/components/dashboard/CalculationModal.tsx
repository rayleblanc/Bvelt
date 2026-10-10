import React, { useState, useEffect } from 'react';
import { X, Calculator, HelpCircle, CheckCircle, ExternalLink, ArrowRight, ShieldCheck, Database, Sliders, Edit3, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getEvidenceBadge, getConfidenceBadge, EvidenceStatus } from '../../lib/bveltEvidence';

export interface CalculationDetails {
  title: string;
  metricName: string;
  resultValue: string;
  evidenceStatus: EvidenceStatus;
  confidence: number | 'High' | 'Medium' | 'Low';
  formula: string;
  variables: { name: string; value: string; source: string; status: EvidenceStatus }[];
  assumptions: string[];
  sources: { name: string; type: string; date?: string }[];
  explanation: string;
  isCustomizable?: boolean;
}

interface CalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: CalculationDetails | null;
  t: (es: string, en: string) => string;
  onUpdateTicket?: (newTicket: number) => void;
  initialTicket?: number;
  isUserCalibratedTicket?: boolean;
  category?: string;
}

export const CalculationModal: React.FC<CalculationModalProps> = ({
  isOpen,
  onClose,
  details,
  t,
  onUpdateTicket,
  initialTicket = 150,
  isUserCalibratedTicket = false,
  category = 'General'
}) => {
  const [customTicket, setCustomTicket] = useState<number>(initialTicket);
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [ticketInputVal, setTicketInputVal] = useState(String(initialTicket));

  useEffect(() => {
    if (initialTicket && initialTicket > 0) {
      setCustomTicket(initialTicket);
      setTicketInputVal(String(initialTicket));
    }
  }, [initialTicket, isOpen]);

  if (!isOpen || !details) return null;

  // Category presets for quick calibration
  const getPresetsForCategory = (cat: string) => {
    const clean = (cat || '').toLowerCase();
    if (clean.includes('roof') || clean.includes('techo') || clean.includes('solar') || clean.includes('construc')) {
      return [
        { label: t('Reparación ($1,500)', 'Repair ($1,500)'), val: 1500 },
        { label: t('Techo Parcial ($5,500)', 'Partial Roof ($5,500)'), val: 5500 },
        { label: t('Reemplazo Total ($9,500)', 'Full Replacement ($9,500)'), val: 9500 }
      ];
    }
    if (clean.includes('hvac') || clean.includes('clima') || clean.includes('aire') || clean.includes('cooling')) {
      return [
        { label: t('Mantenimiento ($150)', 'Maintenance ($150)'), val: 150 },
        { label: t('Reparación ($450)', 'Repair ($450)'), val: 450 },
        { label: t('Instalación ($3,500)', 'Installation ($3,500)'), val: 3500 }
      ];
    }
    if (clean.includes('plumb') || clean.includes('plomer') || clean.includes('electr')) {
      return [
        { label: t('Servicio Rápido ($150)', 'Quick Service ($150)'), val: 150 },
        { label: t('Reparación Mayor ($450)', 'Major Repair ($450)'), val: 450 },
        { label: t('Proyecto Completo ($1,200)', 'Full Project ($1,200)'), val: 1200 }
      ];
    }
    if (clean.includes('dent') || clean.includes('salud') || clean.includes('health') || clean.includes('abog') || clean.includes('law')) {
      return [
        { label: t('Consulta Base ($150)', 'Base Consultation ($150)'), val: 150 },
        { label: t('Tratamiento ($550)', 'Treatment ($550)'), val: 550 },
        { label: t('Procedimiento ($1,500)', 'Procedure ($1,500)'), val: 1500 }
      ];
    }
    if (clean.includes('barber') || clean.includes('restaur') || clean.includes('clean') || clean.includes('limp')) {
      return [
        { label: t('Servicio Base ($35)', 'Base Service ($35)'), val: 35 },
        { label: t('Servicio Completo ($75)', 'Full Service ($75)'), val: 75 },
        { label: t('Paquete Mensual ($180)', 'Monthly Pack ($180)'), val: 180 }
      ];
    }
    return [
      { label: t('Estándar ($150)', 'Standard ($150)'), val: 150 },
      { label: t('Medio ($450)', 'Medium ($450)'), val: 450 },
      { label: t('Alto ($1,200)', 'High ($1,200)'), val: 1200 }
    ];
  };

  const handleApplyPreset = (val: number) => {
    setCustomTicket(val);
    setTicketInputVal(String(val));
    if (onUpdateTicket) {
      onUpdateTicket(val);
    }
  };

  const handleManualTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(ticketInputVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setCustomTicket(parsed);
      if (onUpdateTicket) {
        onUpdateTicket(parsed);
      }
      setIsEditingTicket(false);
    }
  };

  // Determine current effective evidence status
  const currentEvidenceStatus: EvidenceStatus = isUserCalibratedTicket || customTicket !== initialTicket
    ? 'DERIVED'
    : details.evidenceStatus;

  const evBadge = getEvidenceBadge(currentEvidenceStatus, t);
  const confBadge = getConfidenceBadge(details.confidence, t);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl overflow-hidden space-y-6 max-h-[90vh] overflow-y-auto text-left"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="space-y-2 pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${evBadge.colorClass}`}>
                {evBadge.icon} {evBadge.label}
              </span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${confBadge.colorClass}`}>
                {confBadge.label}
              </span>
              {isUserCalibratedTicket && (
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span>👤</span>
                  <span>{t('TICKET PERSONALIZADO', 'CUSTOM TICKET')}</span>
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <Calculator size={22} className="text-indigo-600 dark:text-indigo-400" />
              <span>{details.title}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {details.explanation}
            </p>
          </div>

          {/* Result Highlight */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block mb-0.5">
                {details.metricName}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {details.resultValue}
              </span>
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{t('Clasificación Epistémica', 'Epistemic Classification')}</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{evBadge.description}</span>
            </div>
          </div>

          {/* Inline Ticket Calibrator Widget */}
          {onUpdateTicket && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200 tracking-wider">
                    {t('Calibrar Ticket Promedio de tu Negocio', 'Calibrate Your Business Average Ticket')}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  {t('Valor actual: ', 'Current: ')}<span className="font-mono font-black">${customTicket}</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                {t(
                  'El cálculo financiero se ajusta a lo que cobras por trabajo o cliente. Ajusta este número para personalizar el modelo a tu realidad.',
                  'The financial model adjusts to what you actually charge per job or client. Change this number to calibrate the model to your reality.'
                )}
              </p>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">{t('Presets rápidos:', 'Quick presets:')}</span>
                {getPresetsForCategory(category).map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(preset.val)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      customTicket === preset.val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Number Input */}
              <form onSubmit={handleManualTicketSubmit} className="flex items-center gap-2 pt-1">
                <div className="relative flex-1 max-w-[200px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={ticketInputVal}
                    onChange={(e) => setTicketInputVal(e.target.value)}
                    placeholder="Ej. 350"
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  {t('Guardar Ticket', 'Save Ticket')}
                </button>
              </form>
            </div>
          )}

          {/* Formula Display */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
              <Calculator size={14} />
              <span>{t('Fórmula Matemática Transparente', 'Transparent Mathematical Formula')}</span>
            </h4>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900/40 rounded-xl font-mono text-xs text-indigo-700 dark:text-indigo-300 overflow-x-auto">
              {details.formula}
            </div>
          </div>

          {/* Variables & Data Provenance */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
              <Database size={14} />
              <span>{t('Variables y Origen de Datos (Auditabilidad)', 'Variables & Data Provenance (Auditability)')}</span>
            </h4>
            <div className="space-y-2">
              {details.variables.map((v, i) => {
                const isTicketVar = v.name.toLowerCase().includes('ticket') || v.name.toLowerCase().includes('precio');
                const effectiveStatus: EvidenceStatus = isTicketVar && isUserCalibratedTicket ? 'USER_PROVIDED' : v.status;
                const effectiveValue = isTicketVar && customTicket ? `$${customTicket}` : v.value;
                const effectiveSource = isTicketVar && isUserCalibratedTicket 
                  ? t('Configurado por ti en perfil', 'Configured by you in profile')
                  : v.source;
                const varBadge = getEvidenceBadge(effectiveStatus, t);

                return (
                  <div key={i} className="p-3 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-150 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 text-left">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{v.name}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('Fuente:', 'Source:')} {effectiveSource}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 dark:text-white">{effectiveValue}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${varBadge.colorClass}`}>
                        {varBadge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Model Assumptions */}
          {details.assumptions && details.assumptions.length > 0 && (
            <div className="space-y-2 text-left">
              <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                <HelpCircle size={14} />
                <span>{t('Supuestos del Modelo', 'Model Assumptions')}</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {details.assumptions.map((ass, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{ass}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Epistemic Trust Statement */}
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>{t('Compromiso de Verdad Comercial Bvelt', 'Bvelt Commercial Truth Commitment')}</span>
            </div>
            <p>
              {t(
                'Bvelt nunca presenta estimaciones como facturación real. Las proyecciones modeladas son estimaciones probabilísticas orientadas a dimensionar la oportunidad de visibilidad local.',
                'Bvelt never presents estimates as actual revenue. Modeled projections are probabilistic estimates intended to size local search visibility opportunity.'
              )}
            </p>
          </div>

          {/* Sources */}
          {details.sources && details.sources.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-500 dark:text-indigo-400" />
                <span>{t('Transparencia Algorítmica Bvelt Core', 'Bvelt Core Algorithmic Transparency')}</span>
              </div>
              <div className="flex items-center gap-2">
                {details.sources.map((s, idx) => (
                  <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-medium">
                    {s.name} ({s.type})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Close Action */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-xs"
            >
              {t('Entendido y Cerrar', 'Understood & Close')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
