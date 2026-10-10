import React, { useState, useEffect, useMemo } from 'react';
import { 
  OutcomeLedgerService, 
  TimelineItem, 
  OutcomeLedgerEntry 
} from '../../knowledge/memory/outcomeLedgerService';
import { RecoveryFeeService, RecoveryFeeRecord } from '../../services/recoveryFeeService';
import { EvidenceBadge } from '../EvidenceBadge';
import { 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  Zap, 
  Lightbulb, 
  Filter, 
  Plus, 
  Download, 
  Calendar, 
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Building2,
  FileSpreadsheet
} from 'lucide-react';

interface OutcomeLedgerScreenProps {
  businessId?: string;
  businessName?: string;
  city?: string;
  t: (es: string, en: string) => string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onClose?: () => void;
}

export const OutcomeLedgerScreen: React.FC<OutcomeLedgerScreenProps> = ({
  businessId = 'default_biz',
  businessName = 'Local Business',
  city = '',
  t,
  showToast,
  onClose
}) => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'suggested' | 'executed' | 'measured' | 'won' | 'lost'>('all');
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [selectedItemForMark, setSelectedItemForMark] = useState<TimelineItem | null>(null);

  // Form State for Manual Result Mark
  const [markStatus, setMarkStatus] = useState<'won' | 'lost'>('won');
  const [markAmount, setMarkAmount] = useState<string>('');
  const [markNotes, setMarkNotes] = useState<string>('');
  const [markMetric, setMarkMetric] = useState<'LEADS' | 'REVIEWS' | 'ESTIMATES' | 'JOBS'>('LEADS');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTimeline = () => {
    const items = OutcomeLedgerService.getTimelineForBusiness(businessId);
    setTimeline(items);
  };

  useEffect(() => {
    loadTimeline();
  }, [businessId]);

  const attribution = useMemo(() => {
    return OutcomeLedgerService.getFinancialAttribution(businessId);
  }, [timeline, businessId]);

  const recoverySummary = useMemo(() => {
    return RecoveryFeeService.getSummary(businessId);
  }, [timeline, businessId]);

  const filteredTimeline = useMemo(() => {
    if (filterStatus === 'all') return timeline;
    if (filterStatus === 'suggested') return timeline.filter(i => i.stage === 'SUGGESTED');
    if (filterStatus === 'executed') return timeline.filter(i => i.status === 'executed');
    if (filterStatus === 'measured') return timeline.filter(i => i.stage === 'MEASURED');
    if (filterStatus === 'won') return timeline.filter(i => i.status === 'won');
    if (filterStatus === 'lost') return timeline.filter(i => i.status === 'lost');
    return timeline;
  }, [timeline, filterStatus]);

  const handleOpenMarkResult = (item?: TimelineItem) => {
    setSelectedItemForMark(item || null);
    setMarkStatus('won');
    setMarkAmount(item?.value ? String(item.value) : '');
    setMarkNotes(item ? `Resultado para: ${item.title}` : '');
    setIsMarkModalOpen(true);
  };

  const handleSaveMarkResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedAmount = markStatus === 'won' && markAmount ? parseFloat(markAmount) : null;
      await OutcomeLedgerService.markManualResult({
        businessId,
        actionId: selectedItemForMark?.id,
        recommendationId: selectedItemForMark?.rawEntry && 'recommendationId' in selectedItemForMark.rawEntry ? (selectedItemForMark.rawEntry as any).recommendationId : undefined,
        status: markStatus,
        value: parsedAmount,
        notes: markNotes.trim() || undefined,
        businessName,
        city,
        metricName: markMetric
      });

      showToast?.(
        markStatus === 'won'
          ? t(`¡Resultado guardado! +$${(parsedAmount || 0).toLocaleString()} registrados en el Ledger.`, `Outcome saved! +$${(parsedAmount || 0).toLocaleString()} logged to Ledger.`)
          : t('Resultado registrado como no cerrado / perdido.', 'Result logged as lost / unclosed.'),
        'success'
      );

      setIsMarkModalOpen(false);
      setSelectedItemForMark(null);
      setMarkAmount('');
      setMarkNotes('');
      loadTimeline();
    } catch (err) {
      showToast?.(t('Error al registrar resultado en el ledger.', 'Error logging outcome to ledger.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportJson = () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        businessId,
        businessName,
        city,
        summary: attribution,
        timelineEventsCount: timeline.length,
        evidenceCount: attribution.measuredCount + attribution.declaredCount,
        isEvidenceBacked: (attribution.measuredCount + attribution.declaredCount) >= 3,
        timeline
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bvelt_outcome_ledger_${businessId || 'business'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast?.(t('Ledger exportado en formato JSON machine-readable.', 'Ledger exported in machine-readable JSON format.'), 'success');
    } catch {
      showToast?.(t('No se pudo generar la exportación JSON.', 'Could not generate JSON export.'), 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-3 md:py-6 animate-fade-in text-slate-900 dark:text-white">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 md:p-6 rounded-3xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {t("REGISTRO AUDITABLE • RECORD V1", "AUDITABLE LEDGER • RECORD V1")}
            </span>
            <EvidenceBadge 
              count={attribution.measuredCount + attribution.declaredCount} 
              threshold={3} 
              t={t} 
              size="xs" 
            />
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
            <Building2 size={22} className="text-indigo-500" />
            <span>{businessName}</span>
            {city && <span className="text-xs text-slate-400 font-normal">({city})</span>}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              "Historial longitudinal de acciones: sugeridas → ejecutadas → medidas.",
              "Longitudinal action sequence: suggested → executed → measured."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer border border-slate-200 dark:border-slate-700"
            title={t("Exportar JSON legible por máquina", "Export machine-readable JSON")}
          >
            <Download size={14} />
            <span>{t("Exportar JSON", "Export JSON")}</span>
          </button>

          <button
            onClick={() => handleOpenMarkResult()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer active:scale-95"
          >
            <Plus size={15} />
            <span>{t("Marcar Resultado", "Mark Result")}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Won Revenue */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
            <span>{t("Ingresos Ganados", "Won Revenue")}</span>
            <DollarSign size={14} />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            ${attribution.wonRevenue.toLocaleString()}
          </p>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
            {t("Medido sin sincronización bancaria", "Measured without bank sync")}
          </p>
        </div>

        {/* 2. Measured Outcomes */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
            <span>{t("Resultados Medidos", "Measured Outcomes")}</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {attribution.measuredCount}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {t("Evidencia T1/T2 verificada", "Verified T1/T2 evidence")}
          </p>
        </div>

        {/* 3. Executions */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
            <span>{t("Acciones Ejecutadas", "Executed Actions")}</span>
            <Zap size={14} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {attribution.totalExecutions}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {t("Enviadas por canales comerciales", "Sent via commercial channels")}
          </p>
        </div>

        {/* 4. Total Sequence */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
            <span>{t("Eventos Registrados", "Recorded Events")}</span>
            <Lightbulb size={14} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            {timeline.length}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {t("Ciclo completo sugerir→medir", "Full suggest→measure cycle")}
          </p>
        </div>
      </div>

      {/* Flujo de Estados de Rescate: pending -> confirmed -> fee_due */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 text-white text-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Modelo Rescate $0
            </span>
            <span className="font-bold text-slate-200">
              {t("Estado de Liquidación: pending → confirmed → fee_due", "Settlement State: pending → confirmed → fee_due")}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-amber-400">
              <strong>{recoverySummary.pendingCount}</strong> {t("en rescate ($0)", "in rescue ($0)")}
            </span>
            <span>•</span>
            <span className="text-emerald-400">
              <strong>{recoverySummary.feeDueCount}</strong> {t("confirmados (Regla 1)", "confirmed (Rule 1)")}
            </span>
            <span>•</span>
            <span className="text-indigo-300 font-bold">
              ${recoverySummary.totalFeeDue} {t("fee debido", "fee due")}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t(
            "Sin custodia de fondos: Bvelt nunca retiene dinero de los clientes finales. Cobras el 100% de tus trabajos directamente. El fee fijo ($19) solo se genera cuando confirmas el trabajo o se verifica la respuesta.",
            "No money transmitter: Bvelt never holds or custody funds from end clients. You collect 100% directly. The fixed fee ($19) is due only when you confirm the job or a client response is verified."
          )}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          {t("Todos", "All")} ({timeline.length})
        </button>
        <button
          onClick={() => setFilterStatus('suggested')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            filterStatus === 'suggested'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          💡 {t("Sugeridos", "Suggested")}
        </button>
        <button
          onClick={() => setFilterStatus('executed')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            filterStatus === 'executed'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          ⚡ {t("Ejecutados", "Executed")}
        </button>
        <button
          onClick={() => setFilterStatus('measured')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            filterStatus === 'measured'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          ✓ {t("Medidos", "Measured")}
        </button>
        <button
          onClick={() => setFilterStatus('won')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            filterStatus === 'won'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          💰 {t("Ganados", "Won")}
        </button>
        <button
          onClick={() => setFilterStatus('lost')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            filterStatus === 'lost'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          ✕ {t("Perdidos", "Lost")}
        </button>
      </div>

      {/* Timeline Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        {filteredTimeline.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <FileSpreadsheet size={22} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                {t("Sin eventos en esta vista", "No events in this view")}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t(
                  "Puedes registrar un resultado manual para empezar a alimentar el historial de evidencia de tu negocio.",
                  "You can mark a manual result to start building your business evidence history."
                )}
              </p>
            </div>
            <button
              onClick={() => handleOpenMarkResult()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition"
            >
              <Plus size={14} />
              <span>{t("Registrar Primer Resultado", "Record First Result")}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {filteredTimeline.map((item) => {
              const isSuggested = item.stage === 'SUGGESTED';
              const isExecuted = item.stage === 'EXECUTED';
              const isMeasured = item.stage === 'MEASURED';
              const isWon = item.status === 'won';
              const isLost = item.status === 'lost';

              return (
                <div
                  key={item.id}
                  className="relative pl-10 group transition-all"
                >
                  {/* Timeline Dot */}
                  <div className={`absolute left-2.5 top-3 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 transition-all ${
                    isWon ? 'bg-emerald-500 ring-4 ring-emerald-500/20' :
                    isLost ? 'bg-rose-500 ring-4 ring-rose-500/20' :
                    isMeasured ? 'bg-emerald-500' :
                    isExecuted ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} />

                  {/* Card Content */}
                  <div className="p-4 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-950/60 dark:hover:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80 transition space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Stage Pill */}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          isSuggested ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20' :
                          isExecuted ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' :
                          isWon ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                          isLost ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' :
                          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                        }`}>
                          {item.stage} • {item.status.toUpperCase()}
                        </span>

                        <EvidenceBadge status={item.evidenceStatus} t={t} size="xs" />
                      </div>

                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                      <div>
                        {typeof item.value === 'number' && item.value > 0 ? (
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            +${item.value.toLocaleString()} {t("Medido", "Measured")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            {isSuggested ? t("Recomendación de crecimiento", "Growth recommendation") : t("Sin valor $ asignado", "No $ assigned")}
                          </span>
                        )}
                      </div>

                      {/* Action to Mark Result on incomplete items */}
                      {!isWon && !isLost && (
                        <button
                          onClick={() => handleOpenMarkResult(item)}
                          className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          <span>{t("Marcar Resultado", "Mark Result")}</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mark Result Modal */}
      {isMarkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                  {t("ATRIBUCIÓN DIRECTA", "DIRECT ATTRIBUTION")}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {t("Registrar Resultado Manual", "Mark Manual Outcome")}
                </h3>
              </div>
              <button
                onClick={() => setIsMarkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(
                "Permite registrar acuerdos ganados o cerrados sin necesidad de sincronización bancaria directa.",
                "Allows recording won or lost deals without requiring bank sync."
              )}
            </p>

            <form onSubmit={handleSaveMarkResult} className="space-y-4">
              {/* Status Selector: Won vs Lost */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMarkStatus('won')}
                  className={`p-3 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
                    markStatus === 'won'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span>{t("Ganado / Cerrado", "Won / Closed")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMarkStatus('lost')}
                  className={`p-3 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
                    markStatus === 'lost'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <XCircle size={16} className="text-rose-500" />
                  <span>{t("Perdido / No Cerrado", "Lost / Unclosed")}</span>
                </button>
              </div>

              {/* Amount (if Won) */}
              {markStatus === 'won' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>{t("Valor del Acuerdo ($ USD)", "Deal Value ($ USD)")}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({t("Opcional", "Optional")})</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="450"
                      value={markAmount}
                      onChange={(e) => setMarkAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Metric Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Categoría Comercial", "Commercial Category")}
                </label>
                <select
                  value={markMetric}
                  onChange={(e) => setMarkMetric(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="LEADS">{t("Lead / Contacto Comercial", "Lead / Commercial Contact")}</option>
                  <option value="ESTIMATES">{t("Presupuesto / Cotización", "Quote / Estimate")}</option>
                  <option value="REVIEWS">{t("Reseña / Reputación", "Review / Reputation")}</option>
                  <option value="JOBS">{t("Trabajo Finalizado", "Completed Job")}</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Notas / Detalles del Resultado", "Notes / Outcome Details")}
                </label>
                <textarea
                  rows={2}
                  placeholder={t("ej. Cliente aceptó mantenimiento mensual tras seguimiento", "e.g. Client accepted monthly mowing after follow-up")}
                  value={markNotes}
                  onChange={(e) => setMarkNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMarkModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                >
                  {t("Cancelar", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("Guardando...", "Saving...") : t("Confirmar Resultado", "Confirm Outcome")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
