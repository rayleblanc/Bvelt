import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radar, 
  Search, 
  MapPin, 
  Globe, 
  Phone, 
  Star, 
  Sparkles, 
  Plus, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  Compass, 
  SlidersHorizontal,
  ChevronRight,
  MessageCircle,
  Mail,
  UserCheck,
  FileText,
  Clock,
  Building2,
  CheckCircle2,
  X,
  Calculator,
  Bookmark,
  BookmarkCheck,
  Send,
  Database,
  ArrowRight,
  Layers
} from 'lucide-react';
import { 
  Prospect, 
  ProspectFilter, 
  ProspectOpportunityLevel, 
  ProspectOpportunity, 
  MarketContext, 
  ProspectingEngine 
} from '../knowledge/engine/prospectingEngine';
import { ExtendedLead } from './ClientAcquisitionLeadList';
import { EvidenceStatus, getEvidenceBadge } from '../lib/bveltEvidence';
import { CalculationModal, CalculationDetails } from './dashboard/CalculationModal';

interface ProspectingRadarProps {
  category: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  leads: ExtendedLead[];
  onAddLead: (lead: ExtendedLead) => void;
  onUpdateLeadStatus?: (leadId: string, status: string) => void;
  onNavigateTab?: (tabName: string, subRow?: number) => void;
  t?: (es: string, en?: string) => string;
}

export const ProspectingRadar: React.FC<ProspectingRadarProps> = ({
  category,
  location,
  latitude,
  longitude,
  leads,
  onAddLead,
  onUpdateLeadStatus,
  onNavigateTab,
  t = (es: string, en?: string) => en || es
}) => {
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [selectedFilter, setSelectedFilter] = useState<ProspectFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<string>('Caché Local Inteligente ($0 Costo)');
  const [dataFreshness, setDataFreshness] = useState<string>('Actualizado hoy');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [contactModalOpen, setContactModalOpen] = useState<boolean>(false);
  const [activeContactProspect, setActiveContactProspect] = useState<Prospect | null>(null);
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [addedProspectId, setAddedProspectId] = useState<string | null>(null);
  const [savedProspectIds, setSavedProspectIds] = useState<Set<string>>(new Set());
  
  // Calculation modal state
  const [activeCalcDetails, setActiveCalcDetails] = useState<CalculationDetails | null>(null);
  const [calcModalOpen, setCalcModalOpen] = useState<boolean>(false);

  // Load saved prospects from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bvelt_saved_prospect_ids');
      if (saved) {
        setSavedProspectIds(new Set(JSON.parse(saved)));
      }
    } catch {}
  }, []);

  const toggleSaveProspect = (prospectId: string) => {
    setSavedProspectIds(prev => {
      const next = new Set(prev);
      if (next.has(prospectId)) {
        next.delete(prospectId);
      } else {
        next.add(prospectId);
      }
      try {
        localStorage.setItem('bvelt_saved_prospect_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Initial and reactive scan
  const handleScan = async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    try {
      const result = await ProspectingEngine.discoverProspects({
        category: category || 'Servicios Generales',
        location: location || '',
        latitude,
        longitude,
        radiusKm,
        existingLeads: leads,
        forceRefresh
      });
      setProspects(result.prospects);
      setMarketContext(result.marketContext);
      setDataSource(result.source);
      setDataFreshness(result.dataFreshness);
    } catch (err) {
      console.warn('[ProspectingRadar] Discovery error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleScan();
  }, [category, location, radiusKm]);

  // Sync CRM state with prospects
  const syncedProspects = useMemo(() => {
    return prospects.map(p => ({
      ...p,
      isInCrm: ProspectingEngine.isProspectInCrm(p, leads),
      savedForLater: savedProspectIds.has(p.id)
    }));
  }, [prospects, leads, savedProspectIds]);

  // Filtered prospects
  const filteredProspects = useMemo(() => {
    return syncedProspects.filter(p => {
      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchAddress = p.address.toLowerCase().includes(q);
        const matchCategory = p.category.toLowerCase().includes(q);
        if (!matchName && !matchAddress && !matchCategory) return false;
      }

      // Filter category
      switch (selectedFilter) {
        case 'HIGH_OPPORTUNITY':
          return p.opportunityLevel === 'HIGH' || p.opportunityScore >= 70;
        case 'NEEDS_ATTENTION':
          return p.opportunitySignals.some(s => s.type === 'WEAK_REPUTATION' || s.type === 'LOW_REVIEW_VOLUME');
        case 'WEAK_ONLINE_PRESENCE':
          return p.opportunitySignals.some(s => s.type === 'WEAK_WEB_PRESENCE' || s.type === 'NO_WEBSITE');
        case 'LOW_REVIEW_VOLUME':
          return p.opportunitySignals.some(s => s.type === 'LOW_REVIEW_VOLUME');
        case 'NO_WEBSITE':
          return p.website === 'NOT_AVAILABLE' || p.opportunitySignals.some(s => s.type === 'NO_WEBSITE');
        case 'DISTANCE':
          return p.distance <= 8;
        case 'SAVED':
          return p.savedForLater;
        case 'NEWEST':
        case 'ALL':
        default:
          return true;
      }
    }).sort((a, b) => {
      if (selectedFilter === 'DISTANCE') {
        return a.distance - b.distance;
      }
      return b.opportunityScore - a.opportunityScore;
    });
  }, [syncedProspects, searchQuery, selectedFilter]);

  // Handle Add to CRM
  const handleAddToLeads = (prospect: Prospect) => {
    if (prospect.isInCrm) return;
    const newLead = ProspectingEngine.convertProspectToLead(prospect);
    onAddLead(newLead);
    setAddedProspectId(prospect.id);
    setActiveContactProspect(prospect);
    
    // Auto clear feedback banner after 4 seconds
    setTimeout(() => {
      setAddedProspectId(null);
    }, 4000);
  };

  // Handle Web Research Enrichment (Tavily)
  const handleEnrichWebsite = async (prospect: Prospect) => {
    setEnrichingId(prospect.id);
    try {
      const enriched = await ProspectingEngine.enrichProspectWithWebData(prospect);
      setProspects(prev => prev.map(item => item.id === prospect.id ? enriched : item));
      if (selectedProspect && selectedProspect.id === prospect.id) {
        setSelectedProspect(enriched);
      }
    } catch (e) {
      console.warn('Enrichment failed:', e);
    } finally {
      setEnrichingId(null);
    }
  };

  const getOpportunityBadge = (level: ProspectOpportunityLevel, score: number) => {
    switch (level) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            {t('Alta Oportunidad', 'High Opportunity')} ({score})
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t('Oportunidad Media', 'Medium Opportunity')} ({score})
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-500/10 border border-slate-500/30 text-slate-600 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {t('Estable', 'Stable')} ({score})
          </span>
        );
    }
  };

  const renderEvidenceTag = (status: EvidenceStatus) => {
    const badge = getEvidenceBadge(status, t);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${badge.colorClass}`} title={badge.description}>
        <span>{badge.icon}</span> {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Adaptive Market Context Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                <Radar size={18} className="animate-pulse" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                {t('Radar de Prospección Comercial', 'Commercial Prospecting Radar')}
              </h3>
              <span className="bg-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-indigo-500/20">
                Live & Cached
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(
                `Escaneo de prospectos locales en ${location || 'tu área'} para el nicho "${category || 'Servicios'}" con cálculo contextual de impacto comercial.`,
                `Local business prospecting scan in ${location || 'your area'} for "${category || 'Services'}" with contextual commercial impact models.`
              )}
            </p>
          </div>

          {/* Quick Stats / Cost Control */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-black text-slate-900 dark:text-white">{filteredProspects.length}</span> {t('prospectos', 'prospects')}
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5" title="Consultas cacheadas y OpenStreetMap sin cobro">
              <ShieldCheck size={13} /> {t('$0 Costo API', '$0 API Cost')}
            </div>

            <button
              onClick={() => handleScan(true)}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer disabled:opacity-50"
              title={t('Forzar actualización de escaneo', 'Force scan refresh')}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Adaptive Market Context Pill */}
        {marketContext && (
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap text-slate-700 dark:text-slate-300">
              <span className="font-black text-slate-900 dark:text-white flex items-center gap-1">
                <Database size={13} className="text-indigo-500" />
                {t('Contexto de Mercado:', 'Market Context:')}
              </span>
              <span>{marketContext.city}, {marketContext.region}</span>
              <span>•</span>
              <span className="text-slate-500 dark:text-slate-400">
                {marketContext.marketSize !== 'UNKNOWN' ? t(`${marketContext.marketSize} negocios en registro oficial`, `${marketContext.marketSize} businesses in official registry`) : t('Registro sectorial adaptativo', 'Adaptive sector registry')}
              </span>
              <span>•</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {t(`Ticket ${marketContext.niche}: $${marketContext.avgTicketRange.min}–$${marketContext.avgTicketRange.max} USD`, `${marketContext.niche} Ticket: $${marketContext.avgTicketRange.min}–$${marketContext.avgTicketRange.max} USD`)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <span>{marketContext.benchmarkSource}</span>
            </div>
          </div>
        )}

        {/* Controls: Search & Radius Selector */}
        <div className="pt-2 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Buscar por nombre, dirección o rubro...', 'Search by name, address or niche...')}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Radius Selector */}
          <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 px-2 flex items-center gap-1">
              <Compass size={12} /> {t('Radio:', 'Radius:')}
            </span>
            {[5, 10, 20, 30].map(r => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                  radiusKm === r
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Provenance & Freshness Bar */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> {t('Origen:', 'Source:')} {dataSource}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} /> {dataFreshness}
          </span>
        </div>
      </div>

      {/* 2. Commercial Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'ALL', label: t('Todos', 'All') },
          { id: 'HIGH_OPPORTUNITY', label: t('Alta Oportunidad', 'High Opportunity') },
          { id: 'NEEDS_ATTENTION', label: t('Reputación / Reseñas', 'Needs Attention') },
          { id: 'WEAK_ONLINE_PRESENCE', label: t('Presencia Web Débil', 'Weak Web Presence') },
          { id: 'NO_WEBSITE', label: t('Sin Sitio Web', 'No Website') },
          { id: 'DISTANCE', label: t('Más Cercanos (< 8 km)', 'Closest (< 8 km)') },
          { id: 'SAVED', label: t('Guardados', 'Saved') }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id as ProspectFilter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              selectedFilter === filter.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {filter.id === 'SAVED' && <Bookmark size={11} />}
            {filter.label}
            {filter.id === 'SAVED' && savedProspectIds.size > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {savedProspectIds.size}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 3. Sync CRM Feedback Alert Banner */}
      {activeContactProspect && addedProspectId && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {t(`"${activeContactProspect.name}" fue incorporado con éxito al CRM de Leads.`, `"${activeContactProspect.name}" was successfully added to your CRM.`)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('¿Qué acción deseas tomar a continuación con este prospecto?', 'What action would you like to take next with this prospect?')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={() => {
                setContactModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1 cursor-pointer"
            >
              <MessageCircle size={13} /> {t('Contactar Ahora', 'Contact Today')}
            </button>
            <a
              href={ProspectingEngine.buildGoogleMapsUrl(activeContactProspect)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition flex items-center gap-1"
            >
              <ExternalLink size={12} /> {t('Abrir en Google Maps', 'Open in Google Maps')}
            </a>
          </div>
        </div>
      )}

      {/* 4. Prospects Grid List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-16 bg-slate-50 dark:bg-slate-950 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : filteredProspects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Building2 size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
          <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">
            {t('No se encontraron prospectos con este filtro', 'No prospects found with this filter')}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {t('No hay negocios comerciales mapeados que coincidan con los criterios en este radio.', 'No mapped commercial businesses match the selected criteria in this radius.')}
          </p>
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg mx-auto text-left space-y-1">
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{t('Radio activo:', 'Active radius:')} <strong className="text-slate-700 dark:text-slate-200">{radiusKm} km</strong></span>
              <span>{t('Categoría:', 'Category:')} <strong className="text-slate-700 dark:text-slate-200">{category}</strong></span>
            </p>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{t('Búsqueda:', 'Search query:')} <strong className="text-slate-700 dark:text-slate-200">{searchQuery || t('Ninguna', 'None')}</strong></span>
              <span>{t('Filtro:', 'Filter:')} <strong className="text-slate-700 dark:text-slate-200">{selectedFilter}</strong></span>
            </p>
            {dataFreshness && (
              <p className="text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                {t('Estado del escaneo OSM:', 'OSM Scan status:')} {dataFreshness}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setRadiusKm(prev => Math.min(25, prev + 5));
                handleScan(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer transition"
            >
              {t('Ampliar Radio (+5 km)', 'Expand Radius (+5 km)')}
            </button>
            <button
              onClick={() => {
                setSelectedFilter('ALL');
                setSearchQuery('');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer transition"
            >
              {t('Limpiar Filtros', 'Clear Filters')}
            </button>
            <button
              onClick={() => handleScan(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer transition flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              <span>{t('Re-escanear', 'Re-scan')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProspects.map(prospect => (
            <div
              key={prospect.id}
              className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 hover:shadow-md ${
                prospect.isInCrm
                  ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                  : prospect.opportunityLevel === 'HIGH'
                  ? 'border-rose-500/20 hover:border-rose-500/40'
                  : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/30'
              }`}
            >
              {/* Top Row: Name, Category, Evidence Tag & Opportunity Level */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate" title={prospect.name}>
                        {prospect.name}
                      </h4>
                      {renderEvidenceTag(prospect.evidenceStatus)}
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {t('Confianza', 'Confidence')}: {prospect.confidence || 'Medium'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 min-w-0 truncate">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{prospect.address}, {prospect.city}</span>
                      </span>
                      <span>•</span>
                      <span className="font-bold text-indigo-500 whitespace-nowrap">{prospect.distance} km</span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-slate-400" title={t('Coordenadas exactas', 'Exact coordinates')}>
                        {prospect.latitude && prospect.longitude ? `${prospect.latitude.toFixed(3)}, ${prospect.longitude.toFixed(3)}` : 'UNVERIFIED'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleSaveProspect(prospect.id)}
                      className={`p-1.5 rounded-xl border transition cursor-pointer ${
                        prospect.savedForLater
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                      title={prospect.savedForLater ? t('Guardado', 'Saved') : t('Guardar para después', 'Save for later')}
                    >
                      {prospect.savedForLater ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    </button>
                    {getOpportunityBadge(prospect.opportunityLevel, prospect.opportunityScore)}
                  </div>
                </div>

                {/* Contact & Rating Strip */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {prospect.rating !== 'NOT_AVAILABLE' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      {Number(prospect.rating).toFixed(1)}
                      <span className="text-slate-400 font-normal">
                        ({prospect.reviewCount !== 'NOT_AVAILABLE' ? prospect.reviewCount : t('N/D', 'N/A')})
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      {t('Sin rating público', 'No public rating')}
                    </span>
                  )}

                  {prospect.phone !== 'NOT_AVAILABLE' ? (
                    <a
                      href={`tel:${prospect.phone.replace(/[^0-9+]/g, '')}`}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-indigo-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg transition"
                      title={t('Llamar', 'Call')}
                    >
                      <Phone size={10} className="text-indigo-400" /> {prospect.phone}
                    </a>
                  ) : (
                    <span className="text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
                      {t('Sin teléfono', 'No phone')}
                    </span>
                  )}

                  {prospect.website !== 'NOT_AVAILABLE' ? (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 truncate max-w-[130px]"
                    >
                      <Globe size={10} /> {prospect.website.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  ) : (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      {t('Sin web pública', 'No public website')}
                    </span>
                  )}
                </div>

                {/* Detected Signals / Opportunities Box */}
                <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-500" /> {t('Oportunidades & Señales Detectadas', 'Detected Opportunities')}
                    </span>
                    <span>{(prospect.opportunities?.length ?? 0) || (prospect.opportunitySignals?.length ?? 0)} {t('detectadas', 'detected')}</span>
                  </div>

                  <div className="space-y-1.5">
                    {(prospect.opportunities ?? []).slice(0, 2).map((opp) => (
                      <div key={opp.id} className="flex items-start justify-between gap-2 text-xs">
                        <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300 min-w-0">
                          <span className="text-indigo-500 mt-0.5">•</span>
                          <span className="font-bold truncate">{opp.title}</span>
                        </div>
                        <span className="font-mono text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {opp.estimatedImpact?.formatted ?? ''}
                        </span>
                      </div>
                    ))}

                    {(prospect.opportunities?.length ?? 0) === 0 && (prospect.opportunitySignals ?? []).slice(0, 2).map((sig, sidx) => (
                      <div key={sidx} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span className="font-bold">{sig.label}:</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate">{sig.detail}</span>
                      </div>
                    ))}

                    {(prospect.opportunities?.length ?? 0) > 2 && (
                      <button
                        onClick={() => {
                          setSelectedProspect(prospect);
                          setDetailModalOpen(true);
                        }}
                        className="text-[10px] font-bold text-indigo-500 hover:underline pl-3 block cursor-pointer"
                      >
                        +{(prospect.opportunities?.length ?? 0) - 2} {t('oportunidades más en diagnóstico...', 'more opportunities in diagnostic...')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setSelectedProspect(prospect);
                    setDetailModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  <FileText size={13} /> {t('Ficha y Diagnóstico', 'Profile & Diagnostic')}
                </button>

                <div className="flex items-center gap-1.5">
                  <a
                    href={ProspectingEngine.buildGoogleMapsUrl(prospect)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl text-slate-500 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                    title={t('Abrir ubicación exacta en Google Maps', 'Open exact location in Google Maps')}
                  >
                    <ExternalLink size={13} />
                  </a>

                  {prospect.isInCrm ? (
                    <button
                      onClick={() => {
                        setActiveContactProspect(prospect);
                        setContactModalOpen(true);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck size={13} /> {t('En CRM (Contactar)', 'In CRM (Contact)')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddToLeads(prospect)}
                      className="px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={13} /> {t('Añadir a Leads', 'Add to Leads')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Rich Contextual Prospect Profile Modal */}
      {detailModalOpen && selectedProspect && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar">
            {/* Header with Name, Evidence Tag & Close */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedProspect.name}</h3>
                  {renderEvidenceTag(selectedProspect.evidenceStatus)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedProspect.category} • {selectedProspect.address}, {selectedProspect.city}, {selectedProspect.state} ({selectedProspect.distance} km)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSaveProspect(selectedProspect.id)}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    savedProspectIds.has(selectedProspect.id)
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                      : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-600'
                  }`}
                  title={savedProspectIds.has(selectedProspect.id) ? t('Guardado', 'Saved') : t('Guardar', 'Save')}
                >
                  {savedProspectIds.has(selectedProspect.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                </button>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Score & Market Context Summary Banner */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400">{t('Score de Oportunidad Comercial', 'Commercial Opportunity Score')}</span>
                {getOpportunityBadge(selectedProspect.opportunityLevel, selectedProspect.opportunityScore)}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-150 dark:border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">{t('Reseñas Públicas', 'Public Reviews')}</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedProspect.rating !== 'NOT_AVAILABLE' ? `★ ${selectedProspect.rating} (${selectedProspect.reviewCount})` : 'Sin reseñas'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">{t('Presencia Web', 'Web Presence')}</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {selectedProspect.website !== 'NOT_AVAILABLE' ? 'Activa' : 'No detectada'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">{t('Proximidad', 'Proximity')}</span>
                  <p className="font-bold text-indigo-500">{selectedProspect.distance} km</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">{t('CRM Status', 'CRM Status')}</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedProspect.isInCrm ? 'Sincronizado' : 'Disponible'}
                  </p>
                </div>
              </div>
            </div>

            {/* Detected Opportunities with Calculation Modal Buttons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  {t('Diagnóstico & Oportunidades Identificadas', 'Diagnostic & Identified Opportunities')}
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  {selectedProspect.opportunities?.length ?? 0} {t('oportunidades cuantificadas', 'quantified opportunities')}
                </span>
              </div>

              <div className="space-y-3">
                {(selectedProspect.opportunities ?? []).map((opp) => (
                  <div key={opp.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{opp.title}</span>
                          {renderEvidenceTag(opp.evidence)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{opp.whyItMatters}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-black text-slate-400 block">{t('Impacto Estimado', 'Estimated Impact')}</span>
                        <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {opp.estimatedImpact.formatted}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <ArrowRight size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{t('Acción Recomendada:', 'Recommended Action:')} </span>
                        <span>{opp.recommendedAction}</span>
                      </div>
                    </div>

                    {/* Button to open Calculation details modal */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400 font-mono">{opp.source}</span>
                      <button
                        onClick={() => {
                          setActiveCalcDetails(opp.calculationDetails);
                          setCalcModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Calculator size={12} /> {t('Ver Fórmula y Supuestos', 'View Formula & Assumptions')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tavily Web Intelligence Section */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-indigo-500" />
                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                    {t('Inteligencia Web & Enriquecimiento de Datos', 'Web Intelligence & Data Enrichment')}
                  </span>
                </div>

                <button
                  onClick={() => handleEnrichWebsite(selectedProspect)}
                  disabled={enrichingId === selectedProspect.id}
                  className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-500 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={12} className={enrichingId === selectedProspect.id ? 'animate-spin' : ''} />
                  {enrichingId === selectedProspect.id ? t('Investigando...', 'Researching...') : t('Investigar Web', 'Research Web')}
                </button>
              </div>

              {selectedProspect.enrichmentData ? (
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <p className="italic">"{selectedProspect.enrichmentData.summary}"</p>
                  {selectedProspect.enrichmentData.servicesFound && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedProspect.enrichmentData.servicesFound.map((srv, idx) => (
                        <span key={idx} className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                          {srv}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('Pulsa "Investigar Web" para enriquecer los servicios detectados y presencia digital mediante consulta web controlada y cacheada a $0 coste reiterado.', 'Click "Research Web" to verify detected services and web signals with cached on-demand research.')}
                </p>
              )}
            </div>

            {/* Direct Contextual Action Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <a
                  href={ProspectingEngine.buildGoogleMapsUrl(selectedProspect)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
                >
                  <ExternalLink size={13} /> {t('Google Maps', 'Google Maps')}
                </a>

                {selectedProspect.website !== 'NOT_AVAILABLE' && (
                  <a
                    href={selectedProspect.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition flex items-center gap-1.5"
                  >
                    <Globe size={13} /> {t('Sitio Web', 'Website')}
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!selectedProspect.isInCrm ? (
                  <button
                    onClick={() => {
                      handleAddToLeads(selectedProspect);
                      setDetailModalOpen(false);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> {t('Añadir al CRM de Leads', 'Add to CRM Leads')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setDetailModalOpen(false);
                      setActiveContactProspect(selectedProspect);
                      setContactModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle size={14} /> {t('Contactar Ahora', 'Contact Today')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Contextual Action / Contact Modal */}
      {contactModalOpen && activeContactProspect && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('Acción Comercial Inmediata', 'Immediate Commercial Action')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeContactProspect.name} ({activeContactProspect.category})
                </p>
              </div>
              <button
                onClick={() => setContactModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Generated Script */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">{t('Mensaje de Contacto Listo:', 'Ready Outreach Pitch:')}</span>
                <button
                  onClick={() => {
                    const text = `Hola ${activeContactProspect.name}, estuve revisando su presencia en ${activeContactProspect.city} y detectamos oportunidades concretas para optimizar su captación de clientes en ${activeContactProspect.category}. ¿Tienen 5 minutos para revisar un diagnóstico breve?`;
                    navigator.clipboard.writeText(text);
                    setCopiedPitch(true);
                    setTimeout(() => setCopiedPitch(false), 2500);
                  }}
                  className="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedPitch ? <Check size={11} className="text-emerald-500" /> : null}
                  {copiedPitch ? t('¡Copiado!', 'Copied!') : t('Copiar texto', 'Copy text')}
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 italic leading-relaxed">
                "Hola {activeContactProspect.name}, estuve revisando su presencia en {activeContactProspect.city} y detectamos oportunidades concretas para optimizar su captación de clientes en {activeContactProspect.category}. ¿Tienen 5 minutos para revisar un diagnóstico breve?"
              </div>
            </div>

            {/* Direct Contact CTAs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {activeContactProspect.phone !== 'NOT_AVAILABLE' ? (
                <a
                  href={`tel:${activeContactProspect.phone.replace(/[^0-9+]/g, '')}`}
                  className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/20"
                >
                  <Phone size={14} /> {t('Llamar Ahora', 'Call Now')}
                </a>
              ) : (
                <button disabled className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                  <Phone size={14} /> {t('Sin Teléfono', 'No Phone')}
                </button>
              )}

              <a
                href={`https://wa.me/${activeContactProspect.phone !== 'NOT_AVAILABLE' ? activeContactProspect.phone.replace(/[^0-9]/g, '') : ''}?text=${encodeURIComponent(`Hola ${activeContactProspect.name}, estuve revisando su presencia en ${activeContactProspect.city} y detectamos oportunidades concretas para captar más clientes en ${activeContactProspect.category}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
              >
                <MessageCircle size={14} /> {t('WhatsApp', 'WhatsApp')}
              </a>

              <a
                href={`mailto:?subject=${encodeURIComponent(`Oportunidad de crecimiento para ${activeContactProspect.name}`)}&body=${encodeURIComponent(`Hola equipo de ${activeContactProspect.name},\n\nEstuvimos evaluando negocios del sector ${activeContactProspect.category} en ${activeContactProspect.city} y detectamos puntos específicos para optimizar su captación de clientes.\n\n¿Tendrían 5 minutos para revisar un diagnóstico breve?\n\nSaludos cordiales,\nEquipo Bvelt`)}`}
                className="p-3 rounded-2xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm"
              >
                <Mail size={14} /> {t('Correo Email', 'Email')}
              </a>
            </div>

            {/* Contextual CRM transition buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {onNavigateTab && (
                  <button
                    onClick={() => {
                      onNavigateTab('leads');
                      setContactModalOpen(false);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer"
                  >
                    <UserCheck size={13} /> {t('Ver en CRM', 'View in CRM')}
                  </button>
                )}

                <button
                  onClick={() => {
                    if (onNavigateTab) {
                      onNavigateTab('pricing');
                    }
                    setContactModalOpen(false);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={13} /> {t('Crear Cotización', 'Create Quote')}
                </button>
              </div>

              <button
                onClick={() => {
                  if (onUpdateLeadStatus) {
                    onUpdateLeadStatus(activeContactProspect.id, 'CONTACTED');
                  }
                  setContactModalOpen(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition flex items-center gap-1 cursor-pointer"
              >
                <UserCheck size={13} /> {t('Marcar como Contactado', 'Mark as Contacted')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Calculation Details Modal for Transparent Math and Formulas */}
      <CalculationModal
        isOpen={calcModalOpen}
        onClose={() => {
          setCalcModalOpen(false);
          setActiveCalcDetails(null);
        }}
        details={activeCalcDetails}
        t={t}
      />
    </div>
  );
};
