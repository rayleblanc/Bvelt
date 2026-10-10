import React, { useState, useEffect } from 'react';
import { 
  Send, Copy, Check, ExternalLink, Plus, Filter, 
  Trash2, MessageSquare, Mail, AlertCircle, Sparkles, 
  TrendingUp, ShieldCheck, CheckCircle2, Phone, MapPin, 
  Layers, RefreshCw, ChevronRight, UserCheck, ArrowUpRight
} from 'lucide-react';
import { 
  ModeledOpportunityReport, 
  generateSignalsFromOperatorInput, 
  saveFunnelReport, 
  buildFunnelShareUrl,
  OpportunitySignal 
} from '../../services/signalsGenerator';

export type ProspectFunnelStatus = 'creado' | 'enviado' | 'respondio' | 'activo';

export interface FunnelProspectItem {
  id: string;
  slug: string;
  businessName: string;
  city: string;
  trade: string;
  signalsCount: number;
  minEstimate?: number;
  maxEstimate?: number;
  formattedEstimate: string;
  status: ProspectFunnelStatus;
  shareUrl: string;
  reportData: ModeledOpportunityReport;
  createdAt: string;
  notes?: string;
}

interface OperatorProspectFunnelProps {
  t?: (es: string, en?: string) => string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateReport?: (reportId: string) => void;
}

const STORAGE_PROSPECTS_KEY = 'bvelt_operator_funnel_prospects';

export const OperatorProspectFunnel: React.FC<OperatorProspectFunnelProps> = ({
  t = (es, en) => es,
  showToast = () => {},
  onNavigateReport
}) => {
  // Form State
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [trade, setTrade] = useState('HVAC & Climatización');
  const [pastedSignalsText, setPastedSignalsText] = useState('');
  const [customMin, setCustomMin] = useState<string>('');
  const [customMax, setCustomMax] = useState<string>('');
  
  // Prospects State
  const [prospects, setProspects] = useState<FunnelProspectItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProspect, setSelectedProspect] = useState<FunnelProspectItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'url' | 'wa_es' | 'wa_en' | 'mail_es' | 'mail_en' | null>(null);
  const [templateLang, setTemplateLang] = useState<'es' | 'en'>('es');

  // Load prospects
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PROSPECTS_KEY);
      if (stored) {
        setProspects(JSON.parse(stored));
      } else {
        // Seed with 1 illustrative prospect
        const demoReport = generateSignalsFromOperatorInput({
          businessName: 'Apex Air HVAC',
          city: 'Austin, TX',
          category: 'HVAC & Cooling',
          unrepliedReviewsCount: 4,
          negativeReviewsCount: 2,
          hasWeakCta: true
        });
        saveFunnelReport(demoReport);
        const demoProspect: FunnelProspectItem = {
          id: 'demo_apex_air',
          slug: demoReport.id,
          businessName: 'Apex Air HVAC',
          city: 'Austin, TX',
          trade: 'HVAC & Cooling',
          signalsCount: demoReport.signals.length,
          formattedEstimate: demoReport.modeledMonthlyRange.formatted,
          status: 'creado',
          shareUrl: buildFunnelShareUrl(demoReport),
          reportData: demoReport,
          createdAt: new Date().toISOString()
        };
        setProspects([demoProspect]);
        localStorage.setItem(STORAGE_PROSPECTS_KEY, JSON.stringify([demoProspect]));
      }
    } catch (e) {
      console.error('Error loading prospects:', e);
    }
  }, []);

  const saveProspectsToStorage = (updated: FunnelProspectItem[]) => {
    setProspects(updated);
    try {
      localStorage.setItem(STORAGE_PROSPECTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving prospects:', e);
    }
  };

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      showToast('Por favor introduce el nombre del negocio', 'error');
      return;
    }

    // 1. Generate signals report strictly between 3 and 7 signals
    const report = generateSignalsFromOperatorInput({
      businessName: businessName.trim(),
      city: city.trim() || 'Área local',
      category: trade.trim() || 'Servicios profesionales',
      pastedPublicText: pastedSignalsText.trim()
    });

    // Override custom min-max if specified
    const minNum = parseFloat(customMin);
    const maxNum = parseFloat(customMax);
    if (!isNaN(minNum) && !isNaN(maxNum) && maxNum > minNum) {
      report.modeledMonthlyRange = {
        min: minNum,
        max: maxNum,
        currency: '$',
        formatted: `$${minNum.toLocaleString()} – $${maxNum.toLocaleString()}/mes`
      };
    }

    // Save to public report storage
    saveFunnelReport(report);

    const newProspect: FunnelProspectItem = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      slug: report.id,
      businessName: report.businessName,
      city: report.city || 'Área local',
      trade: report.category || trade,
      signalsCount: report.signals.length,
      minEstimate: report.modeledMonthlyRange.min,
      maxEstimate: report.modeledMonthlyRange.max,
      formattedEstimate: report.modeledMonthlyRange.formatted,
      status: 'creado',
      shareUrl: buildFunnelShareUrl(report),
      reportData: report,
      createdAt: new Date().toISOString()
    };

    const updated = [newProspect, ...prospects];
    saveProspectsToStorage(updated);
    setSelectedProspect(newProspect);

    // Reset Form
    setBusinessName('');
    setCity('');
    setPastedSignalsText('');
    setCustomMin('');
    setCustomMax('');

    showToast(`✓ Informe público generado: /r/${report.id}`, 'success');
  };

  const handleUpdateStatus = (id: string, newStatus: ProspectFunnelStatus) => {
    const updated = prospects.map(p => p.id === id ? { ...p, status: newStatus } : p);
    saveProspectsToStorage(updated);
    if (selectedProspect?.id === id) {
      setSelectedProspect({ ...selectedProspect, status: newStatus });
    }
    showToast(`Estado actualizado a: ${getStatusLabel(newStatus)}`, 'info');
  };

  const handleDeleteProspect = (id: string) => {
    const updated = prospects.filter(p => p.id !== id);
    saveProspectsToStorage(updated);
    if (selectedProspect?.id === id) setSelectedProspect(null);
    showToast('Prospecto eliminado', 'info');
  };

  const getStatusLabel = (status: ProspectFunnelStatus): string => {
    switch (status) {
      case 'creado': return '1. Creado';
      case 'enviado': return '2. Enviado';
      case 'respondio': return '3. Respondió';
      case 'activo': return '4. Activó (Pay-After-Win)';
    }
  };

  const getStatusBadge = (status: ProspectFunnelStatus) => {
    switch (status) {
      case 'creado':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">Creado</span>;
      case 'enviado':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">Enviado</span>;
      case 'respondio':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">Respondió</span>;
      case 'activo':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Activó</span>;
    }
  };

  // Plantillas de mensaje con enlace y cero afirmaciones de pérdida como hecho
  const generateOutreachMessages = (p: FunnelProspectItem) => {
    const link = p.shareUrl || `${window.location.origin}/r/${p.slug}`;
    
    // Español
    const waEs = `Hola ${p.businessName}, revisé tu ficha en ${p.city} y modelé ${p.signalsCount} puntos de oportunidad comercial donde podrías captar más clientes (${p.formattedEstimate} potencial según señales públicas).

Te preparé este informe sin costo para que lo revises con tu equipo:
${link}

Si quieres activar la recuperación con Bvelt, solo pagas si recuperas clientes (Pay-After-Win). ¿Te parece útil?`;

    const mailEs = `Asunto: Diagnóstico de oportunidades y llamadas para ${p.businessName}

Hola equipo de ${p.businessName},

Analizamos la presencia comercial y reseñas públicas de su negocio en ${p.city}. Identificamos ${p.signalsCount} señales clave donde se están perdiendo contactos directos de clientes listos para contratar.

Modelamos una oportunidad recuperable estimada en ${p.formattedEstimate} (sin costo inicial):
👉 Ver informe completo: ${link}

Bvelt trabaja con modelo Pay-After-Win: activación en 2 minutos y solo se factura sobre clientes y oportunidades recuperadas.

Quedo atento si desean revisarlo juntos.

Saludos,
Equipo Bvelt`;

    // English
    const waEn = `Hi ${p.businessName}, I looked at your local presence in ${p.city} and modeled ${p.signalsCount} commercial opportunities to capture more high-ticket calls (${p.formattedEstimate} modeled potential based on public signals).

Here is the private report:
${link}

With Bvelt Pay-After-Win, you only pay if you recover paying clients. Let me know what you think!`;

    const mailEn = `Subject: Modeled revenue opportunities report for ${p.businessName}

Hi ${p.businessName} team,

We reviewed your public local presence and Google profile in ${p.city}. We detected ${p.signalsCount} actionable friction points where direct customer inquiries are slipping through.

We modeled an estimated recoverable potential of ${p.formattedEstimate}:
👉 View report: ${link}

Bvelt operates on Pay-After-Win: 2-minute activation, and you only pay when verified revenue is recovered.

Best regards,
Bvelt Growth Team`;

    return { waEs, mailEs, waEn, mailEn, link };
  };

  const handleCopyText = async (text: string, type: 'url' | 'wa_es' | 'wa_en' | 'mail_es' | 'mail_en', id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopiedType(type);
      showToast('✓ Texto copiado al portapapeles', 'success');
      setTimeout(() => {
        setCopiedId(null);
        setCopiedType(null);
      }, 2000);
    } catch {
      showToast('Error al copiar al portapapeles', 'error');
    }
  };

  const filteredProspects = prospects.filter(p => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest">
              <Sparkles size={12} />
              <span>Embudo Comercial Interno</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Operador de Prospección & Creación de Informes /r/:slug
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Crea diagnósticos públicos modelados (<span className="text-indigo-300 font-bold">MODELED</span>) con 3–7 señales verificables y envía mensajes de prospección con enlace directo y CTA Pay-After-Win.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-center">
              <div className="text-xl font-black text-white">{prospects.length}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Prospectos</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-center">
              <div className="text-xl font-black text-emerald-400">
                {prospects.filter(p => p.status === 'activo').length}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Activados</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulario Creador de Reporte (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Plus size={18} className="text-indigo-400" />
                1. Crear Nuevo Informe Público
              </h3>
              <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-500/30">
                Ruta /r/:id
              </span>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nombre del Negocio *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej. Apex Air Solutions"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Ciudad / Ubicación
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. Austin, TX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Oficio / Categoría
                  </label>
                  <select
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="HVAC & Climatización">HVAC & Cooling</option>
                    <option value="Fontanería / Plumbing">Plumbing</option>
                    <option value="Electricistas">Electrical</option>
                    <option value="Techados / Roofing">Roofing</option>
                    <option value="Jardinería / Landscaping">Landscaping</option>
                    <option value="Contratista General">General Contracting</option>
                    <option value="Servicios Profesionales">Other Professional</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Señales Observadas (Pegar Texto o Notas)
                  </label>
                  <span className="text-[10px] text-slate-500">Genera 3 a 7 señales</span>
                </div>
                <textarea
                  rows={3}
                  value={pastedSignalsText}
                  onChange={(e) => setPastedSignalsText(e.target.value)}
                  placeholder="Ej: 3 reseñas sin responder hace 2 meses, 1 queja de demora, no tiene botón directo de WhatsApp ni tarifas en su perfil..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Estimado Mensual Personalizado (Opcional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    placeholder="Mínimo (Ej. 450)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    value={customMax}
                    onChange={(e) => setCustomMax(e.target.value)}
                    placeholder="Máximo (Ej. 1200)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  * Etiquetado como MODELED. Prohibido afirmar pérdida real de dinero como hecho.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} />
                <span>Generar Informe /r/:slug y Guardar Prospecto</span>
              </button>
            </form>
          </div>
        </div>

        {/* Lista de Prospectos & Acciones de Mensajería (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-400" />
                  2. Lista de Prospectos y Estados
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Seguimiento de ciclo: Creado → Enviado → Respondió → Activó</p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                {(['all', 'creado', 'enviado', 'respondio', 'activo'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition capitalize cursor-pointer ${
                      statusFilter === st ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'Todos' : st}
                  </button>
                ))}
              </div>
            </div>

            {filteredProspects.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No hay prospectos en esta categoría. Crea uno nuevo con el formulario.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProspects.map((p) => {
                  const isSelected = selectedProspect?.id === p.id;
                  const msgs = generateOutreachMessages(p);

                  return (
                    <div
                      key={p.id}
                      className={`bg-slate-950/90 border rounded-2xl p-5 transition space-y-4 ${
                        isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/40' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Header Card */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm text-white">{p.businessName}</h4>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MapPin size={10} /> {p.city}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                              {p.trade}
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-400 font-mono mt-0.5 font-bold">
                            {p.formattedEstimate} <span className="text-[9px] text-slate-500 font-sans uppercase font-bold">(MODELED)</span> • {p.signalsCount} señales
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(p.status)}

                          {/* State Selector Dropdown */}
                          <select
                            value={p.status}
                            onChange={(e) => handleUpdateStatus(p.id, e.target.value as ProspectFunnelStatus)}
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="creado">1. Creado</option>
                            <option value="enviado">2. Enviado</option>
                            <option value="respondio">3. Respondió</option>
                            <option value="activo">4. Activó</option>
                          </select>

                          <button
                            onClick={() => handleDeleteProspect(p.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Public Link Pill & Action */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2 overflow-hidden text-indigo-300 font-mono text-[11px]">
                          <span className="text-slate-500 font-sans text-[10px] font-bold uppercase">URL:</span>
                          <span className="truncate">/r/{p.slug}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCopyText(msgs.link, 'url', p.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === p.id && copiedType === 'url' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span>Copiar Link</span>
                          </button>
                          
                          <a
                            href={`/r/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition flex items-center gap-1"
                          >
                            <span>Ver Informe</span>
                            <ArrowUpRight size={12} />
                          </a>
                        </div>
                      </div>

                      {/* Outreach Templates (WhatsApp / Email) */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-300 flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-indigo-400" />
                            Mensajes de Contacto con Enlace:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setTemplateLang('es')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${templateLang === 'es' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                              ES
                            </button>
                            <button
                              onClick={() => setTemplateLang('en')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${templateLang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                              EN
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              const text = templateLang === 'es' ? msgs.waEs : msgs.waEn;
                              handleCopyText(text, templateLang === 'es' ? 'wa_es' : 'wa_en', p.id);
                            }}
                            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 text-left transition space-y-1 group cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-[11px] font-black text-emerald-400">
                              <span className="flex items-center gap-1">
                                <MessageSquare size={12} /> WhatsApp ({templateLang.toUpperCase()})
                              </span>
                              {copiedId === p.id && (copiedType === 'wa_es' || copiedType === 'wa_en') ? (
                                <span className="text-emerald-400 text-[10px] flex items-center gap-0.5 font-bold">
                                  <Check size={11} /> Copiado
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px] group-hover:text-slate-300 font-bold">Copiar</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2">
                              {templateLang === 'es' ? msgs.waEs : msgs.waEn}
                            </p>
                          </button>

                          <button
                            onClick={() => {
                              const text = templateLang === 'es' ? msgs.mailEs : msgs.mailEn;
                              handleCopyText(text, templateLang === 'es' ? 'mail_es' : 'mail_en', p.id);
                            }}
                            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 text-left transition space-y-1 group cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-[11px] font-black text-indigo-400">
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> Correo ({templateLang.toUpperCase()})
                              </span>
                              {copiedId === p.id && (copiedType === 'mail_es' || copiedType === 'mail_en') ? (
                                <span className="text-emerald-400 text-[10px] flex items-center gap-0.5 font-bold">
                                  <Check size={11} /> Copiado
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px] group-hover:text-slate-300 font-bold">Copiar</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2">
                              {templateLang === 'es' ? msgs.mailEs : msgs.mailEn}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
