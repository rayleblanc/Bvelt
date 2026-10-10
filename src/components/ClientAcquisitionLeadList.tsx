import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Mail, Globe, MessageSquare, Copy, Check, Clock, Calendar, 
  ArrowRight, UserCheck, AlertCircle, Send, CheckCircle, FileText, 
  DollarSign, Sparkles, MapPin, Star, Trophy, XCircle, Edit3, Eye, EyeOff
} from 'lucide-react';
import { ActionEngine, NextBestActionRecommendation } from '../knowledge/engine/actionEngine';
import { CommercialMetricsEngine } from '../knowledge/engine/commercialMetrics';
import { LeadQualityEngine, LeadQualityEvaluation } from '../knowledge/engine/leadQualityEngine';
import { recordFinancialEvidence } from '../knowledge/memory/bemStore';
import { isLeadActionable, getLeadDisplayName, ActionableLead, isLeadInServiceArea, isLeadInZone, sortLeadsByZoneAndUrgency, isBusinessLead } from '../lib/navigation/routeToAnswerLeads';

export type LeadStatusType = 
  | 'NEW' 
  | 'CONTACTED' 
  | 'RESPONDED' 
  | 'QUOTE_SENT' 
  | 'FOLLOW_UP' 
  | 'WON' 
  | 'CLIENT' 
  | 'LOST' 
  | 'DISMISSED';

export interface ExtendedLead {
  id: string;
  businessName?: string;
  client?: string;
  category?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  website?: string;
  phone?: string;
  rating?: number | string;
  reviews?: number | string;
  source?: string;
  date?: string;
  timestamp?: string;
  opportunityData?: string[];
  generatedPitch?: {
    shortMessage?: string;
    emailSubject?: string;
    emailBody?: string;
    callScript?: string;
  };
  text?: string;
  status?: LeadStatusType | string;
  lastContact?: string | null;
  nextAction?: string;
  nextActionDate?: string;
  nextActionPriority?: 'HIGH' | 'MEDIUM' | 'LOW';
  nextActionReason?: string;
  quoteAmount?: number;
  quoteDate?: string;
  actualRevenue?: number;
  laborCost?: number;
  materialsCost?: number;
  directCost?: number;
  costProvenance?: 'USER_PROVIDED' | 'MODELED' | 'INSUFFICIENT_DATA';
  wonDate?: string;
  notes?: string;
  score?: number;
  confidence?: string;
  evidence?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  isDemo?: boolean;
}

interface ClientAcquisitionLeadListProps {
  leads: ExtendedLead[];
  profile?: any;
  onUpdateStatus: (leadId: string, newStatus: LeadStatusType, lastContactDate?: string, extraData?: any) => void;
  onDeleteLead?: (leadId: string) => void;
  onNavigateToEstimator?: (leadContext?: any) => void;
  t?: (es: string, en?: string) => string;
  tenantUid?: string | null;
}

export const ClientAcquisitionLeadList: React.FC<ClientAcquisitionLeadListProps> = ({
  leads,
  profile,
  onUpdateStatus,
  onDeleteLead,
  onNavigateToEstimator,
  t = (es: string, en?: string) => en || es,
  tenantUid = null,
}) => {
  const lang: 'es' | 'en' = t('es', 'en') === 'en' ? 'en' : 'es';
  const [activeContactLead, setActiveContactLead] = useState<ExtendedLead | null>(null);
  const [activeDetailLead, setActiveDetailLead] = useState<ExtendedLead | null>(null);
  const [activeFollowUpLead, setActiveFollowUpLead] = useState<ExtendedLead | null>(null);
  const [activeQuoteLead, setActiveQuoteLead] = useState<ExtendedLead | null>(null);
  const [activeWonLead, setActiveWonLead] = useState<ExtendedLead | null>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);

  // Toggle for hiding demo/synthetic leads
  const [hideDemoLeads, setHideDemoLeads] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bvelt_hide_demo_leads') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [customFollowUpDate, setCustomFollowUpDate] = useState<string>('');
  const [inputQuoteAmount, setInputQuoteAmount] = useState<string>('');
  const [inputRevenueAmount, setInputRevenueAmount] = useState<string>('');
  const [inputLaborCost, setInputLaborCost] = useState<string>('');
  const [inputMaterialsCost, setInputMaterialsCost] = useState<string>('');
  const [leadNoteInput, setLeadNoteInput] = useState<string>('');

  // Sync filter status with deep links via localStorage
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return localStorage.getItem('crm_lead_filter') || 'ALL';
  });
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  const scrollToLeadRow = (leadId: string) => {
    setHighlightedLeadId(leadId);
    setTimeout(() => {
      const el = document.getElementById(`lead-row-${leadId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    setTimeout(() => {
      setHighlightedLeadId(prev => (prev === leadId ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const savedFilter = localStorage.getItem('crm_lead_filter');
      if (savedFilter) {
        setStatusFilter(savedFilter);
      }
      const savedHideDemo = localStorage.getItem('bvelt_hide_demo_leads');
      if (savedHideDemo !== null) {
        setHideDemoLeads(savedHideDemo === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const resolveOpenLead = () => {
      const targetLeadId = localStorage.getItem('crm_open_lead_id');
      const savedFilter = localStorage.getItem('crm_lead_filter');
      if (savedFilter) {
        setStatusFilter(savedFilter);
      }
      if (targetLeadId) {
        const foundLead = leads.find(l => l.id === targetLeadId);
        if (foundLead) {
          const isDemo = foundLead.isDemo || foundLead.id?.startsWith('dl-') || foundLead.id?.startsWith('demo-');
          if (isDemo && hideDemoLeads) {
            setHideDemoLeads(false);
            try { localStorage.setItem('bvelt_hide_demo_leads', 'false'); } catch (e) {}
          }
          if (isLeadActionable(foundLead)) {
            setActiveContactLead(foundLead);
          } else {
            setActiveDetailLead(foundLead);
            setLeadNoteInput(foundLead.notes || '');
          }
          scrollToLeadRow(targetLeadId);
          localStorage.removeItem('crm_open_lead_id');
        } else if (leads.length > 0) {
          setActiveDetailLead(null);
          localStorage.removeItem('crm_open_lead_id');
        }
      }
    };

    resolveOpenLead();

    const handleStorage = (e?: StorageEvent) => {
      if (!e || e.key === 'crm_open_lead_id' || e.key === 'crm_lead_filter' || e.key === null) {
        resolveOpenLead();
      }
    };
    const handleCustomOpen = (e: any) => {
      const savedFilter = localStorage.getItem('crm_lead_filter');
      if (savedFilter) {
        setStatusFilter(savedFilter);
      }
      const leadId = e?.detail?.leadId;
      if (leadId) {
        const found = leads.find(l => l.id === leadId);
        if (found) {
          const isDemo = found.isDemo || found.id?.startsWith('dl-') || found.id?.startsWith('demo-');
          if (isDemo && hideDemoLeads) {
            setHideDemoLeads(false);
            try { localStorage.setItem('bvelt_hide_demo_leads', 'false'); } catch (err) {}
          }
          if (isLeadActionable(found)) {
            setActiveContactLead(found);
          } else {
            setActiveDetailLead(found);
            setLeadNoteInput(found.notes || '');
          }
          scrollToLeadRow(leadId);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('bvelt_open_lead', handleCustomOpen as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bvelt_open_lead', handleCustomOpen as EventListener);
    };
  }, [leads, hideDemoLeads]);

  const userCity = profile?.city || profile?.location?.split(',')?.[0]?.trim() || '';

  const filteredLeads = sortLeadsByZoneAndUrgency(
    leads.filter(lead => {
      const isDemo = Boolean(lead.isDemo || lead.id?.startsWith('dl-') || lead.id?.startsWith('demo-'));
      
      // Hide Demo filter
      if (hideDemoLeads && isDemo && highlightedLeadId !== lead.id) {
        return false;
      }

      // Status / Zone Filter
      let matchStatus = true;
      if (statusFilter !== 'ALL') {
        const leadSt = (lead.status || '').toUpperCase();
        if (statusFilter === 'LOCAL') {
          matchStatus = isLeadInServiceArea(lead, profile);
        } else if (statusFilter === 'OTHER_ZONES') {
          matchStatus = !isLeadInServiceArea(lead, profile);
        } else if (statusFilter === 'NEW') {
          matchStatus = isBusinessLead(lead, profile) && (['NEW', 'NUEVO', 'PENDING', 'NEEDS_REPLY', 'AWAITING_REPLY'].includes(leadSt) || !leadSt);
        } else if (statusFilter === 'WON') {
          matchStatus = leadSt === 'WON' || leadSt === 'CLIENT';
        } else if (statusFilter === 'LOST') {
          matchStatus = leadSt === 'LOST' || leadSt === 'DISMISSED';
        } else if (statusFilter === 'NEEDS_INFO') {
          const nameInfo = getLeadDisplayName(lead, lang);
          matchStatus = nameInfo.isNeedsInfo || !isLeadActionable(lead);
        } else {
          matchStatus = leadSt === statusFilter;
        }
      }

      // Tag Filter
      let matchTag = true;
      if (tagFilter !== 'ALL') {
        matchTag = (lead.tags || []).includes(tagFilter);
      }

      return matchStatus && matchTag;
    }),
    profile
  );

  const getStatusBadgeClass = (st?: string) => {
    const s = (st || 'NEW').toUpperCase();
    switch (s) {
      case 'NEW':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400';
      case 'CONTACTED':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400';
      case 'RESPONDED':
        return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500 dark:text-indigo-400';
      case 'QUOTE_SENT':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-500 dark:text-purple-400';
      case 'FOLLOW_UP':
        return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500 dark:text-cyan-400';
      case 'WON':
      case 'CLIENT':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400';
      case 'LOST':
      case 'DISMISSED':
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-500 dark:text-slate-400';
    }
  };

  const handleContactAction = (lead: ExtendedLead) => {
    setActiveContactLead(lead);
  };

  const executeContact = (type: 'wa' | 'call' | 'email' | 'copy', lead: ExtendedLead) => {
    const pitch = lead.generatedPitch;
    const shortMsg = pitch?.shortMessage || lead.text || `Hola, me contacto de Bvelt respecto a ${lead.businessName || lead.client || 'tu negocio'}. Detectamos oportunidades directas para potenciar tu presencia y clientes locales.`;
    
    if (type === 'wa') {
      const phoneClean = lead.phone ? lead.phone.replace(/[^0-9+]/g, '') : '';
      const waUrl = phoneClean 
        ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(shortMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(shortMsg)}`;
      window.open(waUrl, '_blank');
    } else if (type === 'call') {
      if (lead.phone) {
        window.location.href = `tel:${lead.phone}`;
      }
    } else if (type === 'email') {
      const subj = pitch?.emailSubject || `Propuesta Comercial Bvelt para ${lead.businessName || lead.client || 'tu negocio'}`;
      const body = pitch?.emailBody || shortMsg;
      window.location.href = `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    } else if (type === 'copy') {
      navigator.clipboard.writeText(shortMsg);
      setCopiedType('msg');
      setTimeout(() => setCopiedType(null), 2000);
    }

    // Auto update status to CONTACTED with current contact date
    const today = new Date().toLocaleDateString();
    onUpdateStatus(lead.id, 'CONTACTED', today, {
      nextAction: 'Follow up in 3 days',
      nextActionDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
    });
    setActiveContactLead(prev => prev ? { 
      ...prev, 
      status: 'CONTACTED', 
      lastContact: today, 
      nextAction: 'Follow up in 3 days',
      nextActionDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
    } : null);
  };

  const setFollowUpPreset = (daysOffset: number, lead: ExtendedLead) => {
    const dateObj = new Date(Date.now() + daysOffset * 86400000);
    const dateStr = dateObj.toISOString().split('T')[0];
    const label = daysOffset === 0 ? t('Hoy', 'Today') : daysOffset === 1 ? t('Mañana', 'Tomorrow') : t(`En ${daysOffset} días`, `In ${daysOffset} days`);
    
    onUpdateStatus(lead.id, 'FOLLOW_UP', lead.lastContact || new Date().toLocaleDateString(), {
      nextAction: `${t('Seguimiento programado para', 'Scheduled follow-up for')} ${label}`,
      nextActionDate: dateStr,
      nextActionPriority: daysOffset <= 1 ? 'HIGH' : 'MEDIUM'
    });

    if (activeDetailLead?.id === lead.id) {
      setActiveDetailLead(prev => prev ? {
        ...prev,
        status: 'FOLLOW_UP',
        nextAction: `${t('Seguimiento programado para', 'Scheduled follow-up for')} ${label}`,
        nextActionDate: dateStr
      } : null);
    }
    setActiveFollowUpLead(null);
  };

  const handleCustomFollowUpSubmit = (lead: ExtendedLead) => {
    if (!customFollowUpDate) return;
    onUpdateStatus(lead.id, 'FOLLOW_UP', lead.lastContact || new Date().toLocaleDateString(), {
      nextAction: `${t('Seguimiento para el', 'Follow-up on')} ${customFollowUpDate}`,
      nextActionDate: customFollowUpDate,
      nextActionPriority: 'MEDIUM'
    });

    if (activeDetailLead?.id === lead.id) {
      setActiveDetailLead(prev => prev ? {
        ...prev,
        status: 'FOLLOW_UP',
        nextAction: `${t('Seguimiento para el', 'Follow-up on')} ${customFollowUpDate}`,
        nextActionDate: customFollowUpDate
      } : null);
    }
    setActiveFollowUpLead(null);
  };

  const handleSaveQuoteSubmit = (lead: ExtendedLead) => {
    const val = parseFloat(inputQuoteAmount);
    if (isNaN(val) || val <= 0) return;
    const today = new Date().toLocaleDateString();

    onUpdateStatus(lead.id, 'QUOTE_SENT', today, {
      quoteAmount: val,
      quoteDate: today,
      nextAction: `${t('Seguimiento de Cotización ($', 'Quote Follow-up ($')}${val.toLocaleString()})`,
      nextActionDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      nextActionPriority: 'HIGH'
    });

    if (activeDetailLead?.id === lead.id) {
      setActiveDetailLead(prev => prev ? {
        ...prev,
        status: 'QUOTE_SENT',
        quoteAmount: val,
        quoteDate: today,
        nextAction: `${t('Seguimiento de Cotización ($', 'Quote Follow-up ($')}${val.toLocaleString()})`
      } : null);
    }
    setActiveQuoteLead(null);
  };

  const handleSaveWonSubmit = (lead: ExtendedLead) => {
    const val = parseFloat(inputRevenueAmount);
    const rev = !isNaN(val) && val >= 0 ? val : (lead.quoteAmount || 350);
    const labor = parseFloat(inputLaborCost);
    const materials = parseFloat(inputMaterialsCost);
    const hasLabor = !isNaN(labor) && labor >= 0;
    const hasMaterials = !isNaN(materials) && materials >= 0;
    const directCost = (hasLabor ? labor : 0) + (hasMaterials ? materials : 0);
    const hasDirectCost = hasLabor || hasMaterials;
    const today = new Date().toLocaleDateString();

    const extraData: any = {
      actualRevenue: rev,
      wonDate: today,
      nextAction: t('Cliente ganado & servicio activo', 'Deal won & service active'),
      nextActionPriority: 'LOW'
    };

    if (hasLabor) extraData.laborCost = labor;
    if (hasMaterials) extraData.materialsCost = materials;
    if (hasDirectCost) {
      extraData.directCost = directCost;
      extraData.costProvenance = 'USER_PROVIDED';
    }

    onUpdateStatus(lead.id, 'WON', today, extraData);

    // Record BEM financial evidence under TENANT_PRIVATE classification
    try {
      recordFinancialEvidence(
        lead.id,
        'deal_won_outcome',
        { revenue: rev, laborCost: labor, materialsCost: materials, directCost, date: today },
        'FACT',
        'VERIFIED',
        'Client CRM Deal Closure',
        tenantUid
      );
    } catch (e) {
      // Non-blocking BEM evidence logging
    }

    if (activeDetailLead?.id === lead.id) {
      setActiveDetailLead(prev => prev ? {
        ...prev,
        status: 'WON',
        ...extraData
      } : null);
    }
    setActiveWonLead(null);
  };

  const handleSaveNotes = (lead: ExtendedLead) => {
    onUpdateStatus(lead.id, (lead.status as LeadStatusType) || 'NEW', lead.lastContact || undefined, {
      notes: leadNoteInput
    });
    if (activeDetailLead?.id === lead.id) {
      setActiveDetailLead(prev => prev ? { ...prev, notes: leadNoteInput } : null);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 space-y-3">
        <UserCheck size={32} className="mx-auto text-indigo-400/50" />
        <p className="text-xs font-bold text-slate-300">
          {t('No tienes leads comerciales guardados aún.', 'No saved commercial leads yet.')}
        </p>
        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
          {t('Analiza un negocio local con el escáner o mapa, genera un pitch comercial y pulsa "MARCAR COMO LEAD" para agregar tu primera oportunidad aquí.', 'Analyze a local business, generate a pitch, and click "MARK AS LEAD" to add your first opportunity here.')}
        </p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const commSummary = CommercialMetricsEngine.computeSummary(leads, ActionEngine.getStoredQuotes(), [], profile);

  return (
    <div className="space-y-4">
      {/* FILTER TABS WITH UNIFIED METRICS */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          {(() => {
            const visibleLeads = leads.filter(l => !hideDemoLeads || !(l.isDemo || l.id?.startsWith('dl-') || l.id?.startsWith('demo-')));
            const localLeadsCount = visibleLeads.filter(l => isLeadInServiceArea(l, profile)).length;
            const otherZonesCount = visibleLeads.filter(l => !isLeadInServiceArea(l, profile)).length;

            return ([
              { code: 'ALL', label: t('Todos', 'All'), count: visibleLeads.length },
              ...(userCity ? [{
                code: 'LOCAL',
                label: `${t('📍 Mi Zona', '📍 My Area')} (${userCity})`,
                count: localLeadsCount
              }] : []),
              ...(otherZonesCount > 0 ? [{
                code: 'OTHER_ZONES',
                label: t('🌐 Otras Zonas', '🌐 Other Zones'),
                count: otherZonesCount
              }] : []),
              { code: 'NEW', label: t('Nuevos', 'New'), count: visibleLeads.filter(l => isBusinessLead(l, profile) && (['NEW', 'NUEVO', 'PENDING', 'NEEDS_REPLY', 'AWAITING_REPLY'].includes((l.status || '').toUpperCase()) || !l.status)).length },
              { code: 'CONTACTED', label: t('Contactados', 'Contacted'), count: visibleLeads.filter(l => (l.status || '').toUpperCase() === 'CONTACTED').length },
              { code: 'RESPONDED', label: t('Respondieron', 'Responded'), count: visibleLeads.filter(l => (l.status || '').toUpperCase() === 'RESPONDED').length },
              { code: 'QUOTE_SENT', label: t('Cotización Enviada', 'Quote Sent'), count: visibleLeads.filter(l => (l.status || '').toUpperCase() === 'QUOTE_SENT').length },
              { code: 'FOLLOW_UP', label: t('Seguimiento', 'Follow Up'), count: visibleLeads.filter(l => (l.status || '').toUpperCase() === 'FOLLOW_UP').length },
              { code: 'WON', label: t('Ganados', 'Won Deals'), count: visibleLeads.filter(l => ['WON', 'CLIENT'].includes((l.status || '').toUpperCase())).length },
              { code: 'LOST', label: t('Perdidos', 'Lost'), count: visibleLeads.filter(l => ['LOST', 'DISMISSED'].includes((l.status || '').toUpperCase())).length },
              { code: 'NEEDS_INFO', label: t('Requiere Info', 'Needs Info'), count: visibleLeads.filter(l => getLeadDisplayName(l, lang).isNeedsInfo || !isLeadActionable(l)).length }
            ]).map(f => (
              <button
                key={f.code}
                onClick={() => {
                  setStatusFilter(f.code);
                  localStorage.setItem('crm_lead_filter', f.code);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-150 cursor-pointer border flex items-center gap-1.5 ${
                  statusFilter === f.code
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{f.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === f.code
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  {f.count}
                </span>
              </button>
            ));
          })()}
        </div>

        {/* Hide/Show Demo Leads Toggle */}
        <button
          onClick={() => {
            const nextVal = !hideDemoLeads;
            setHideDemoLeads(nextVal);
            try {
              localStorage.setItem('bvelt_hide_demo_leads', nextVal ? 'true' : 'false');
            } catch (e) {}
          }}
          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 border transition cursor-pointer ${
            hideDemoLeads
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
          title={hideDemoLeads ? t('Mostrar leads de demostración', 'Show demo leads') : t('Ocultar leads de demostración', 'Hide demo leads')}
        >
          {hideDemoLeads ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>{hideDemoLeads ? t('Demo Ocultos', 'Demo Hidden') : t('Ocultar Demo', 'Hide Demo')}</span>
        </button>
      </div>

      {/* TAG FILTER */}
      <div className="flex flex-wrap items-center gap-2 pb-2 text-xs">
        <span className="text-slate-400 font-extrabold">{t('Filtrar por etiqueta:', 'Filter by tag:')}</span>
        <div className="flex flex-wrap gap-1">
          {['ALL', 'Follow-up Needed', 'Quote Sent', 'High Priority'].map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all duration-150 cursor-pointer border ${
                tagFilter === tag
                  ? 'bg-slate-800 dark:bg-slate-100 border-slate-800 dark:border-slate-100 text-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tag === 'ALL' ? t('Todas', 'All') :
               tag === 'Follow-up Needed' ? t('Seguimiento Necesario 🕒', 'Follow-up Needed 🕒') :
               tag === 'Quote Sent' ? t('Cotizado 📄', 'Quote Sent 📄') :
               t('Prioridad Alta ⚡', 'High Priority ⚡')}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] bg-slate-50 dark:bg-slate-950/60">
              <th className="py-3.5 px-4">{t('Negocio', 'Business')}</th>
              <th className="py-3.5 px-4">{t('Estado', 'Status')}</th>
              <th className="py-3.5 px-4">{t('Prioridad', 'Priority')}</th>
              <th className="py-3.5 px-4">{t('Siguiente Acción', 'Next Action')}</th>
              <th className="py-3.5 px-4">{t('Fecha Seguimiento', 'Follow-up Date')}</th>
              <th className="py-3.5 px-4">{t('Monto', 'Amount')}</th>
              <th className="py-3.5 px-4 text-right">{t('Acción Directa', 'Direct Action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 font-medium space-y-2">
                  <p>{t('No hay prospectos que coincidan con este filtro.', 'No prospects match this filter.')}</p>
                  <button 
                    onClick={() => {
                      setStatusFilter('ALL');
                      localStorage.setItem('crm_lead_filter', 'ALL');
                    }}
                    className="text-xs font-bold text-indigo-500 hover:text-indigo-600 underline cursor-pointer bg-transparent border-none outline-none"
                  >
                    {t('Mostrar todos los leads', 'Show all leads')}
                  </button>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const nameObj = getLeadDisplayName(lead, lang);
                const name = nameObj.name;
                const isActionable = isLeadActionable(lead);
                const isDemo = Boolean(lead.isDemo || lead.id?.startsWith('dl-') || lead.id?.startsWith('demo-'));
                const isInUserZone = isLeadInZone(lead, profile);
                const status: LeadStatusType = (lead.status as LeadStatusType) || 'NEW';
                const nba = ActionEngine.getNextBestActionForLead(lead, 'es');
                const leadQual = LeadQualityEngine.evaluateLead(lead, { category: lead.category, location: lead.location }, lang);
                const isDueToday = lead.nextActionDate && lead.nextActionDate <= todayStr && status !== 'WON' && status !== 'LOST';
                const isHighlighted = highlightedLeadId === lead.id;

              return (
                <tr 
                  key={lead.id} 
                  id={`lead-row-${lead.id}`}
                  className={`transition-all duration-300 ${
                    isHighlighted 
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500 dark:ring-indigo-400 z-10 shadow-lg' 
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  {/* Business info */}
                  <td className="py-3.5 px-4 cursor-pointer" onClick={() => { setActiveDetailLead(lead); setLeadNoteInput(lead.notes || ''); }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-extrabold line-clamp-1 max-w-[180px] ${nameObj.isNeedsInfo ? 'text-amber-500 dark:text-amber-400 italic' : 'text-slate-900 dark:text-white'}`} title={name}>
                        {name}
                      </span>
                      {isDemo && (
                        <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                          DEMO
                        </span>
                      )}
                      {isInUserZone ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                          <MapPin size={8} /> {lead.city || lead.location || userCity || t('Local', 'Local')}
                        </span>
                      ) : (
                        <span className="text-[8px] font-medium px-1.5 py-0.2 rounded bg-slate-500/10 border border-slate-500/20 text-slate-400 inline-flex items-center gap-0.5">
                          <Globe size={8} /> {lead.city || lead.location || t('Fuera de zona', 'Out of zone')}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">
                      {lead.category || lead.location || (isActionable ? 'Local' : t('Sin canal de contacto', 'Missing contact channel'))}
                    </div>
                    {lead.tags && lead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lead.tags.map(tag => (
                          <span key={tag} className={`text-[8px] font-black px-1.5 py-0.2 rounded-md ${
                            tag === 'High Priority' ? 'bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400' :
                            tag === 'Quote Sent' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-500 dark:text-purple-400' :
                            'bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400'
                          }`}>
                            {tag === 'Follow-up Needed' ? t('Seguimiento', 'Follow-up') :
                             tag === 'Quote Sent' ? t('Cotizado', 'Quote Sent') :
                             t('Prioritario', 'High Priority')}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Status Selector */}
                  <td className="py-3.5 px-4">
                    <select
                      value={status}
                      onChange={(e) => onUpdateStatus(lead.id, e.target.value as LeadStatusType)}
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border outline-none cursor-pointer ${getStatusBadgeClass(status)}`}
                    >
                      <option value="NEW" className="bg-slate-900 text-amber-400">NEW</option>
                      <option value="CONTACTED" className="bg-slate-900 text-blue-400">CONTACTED</option>
                      <option value="RESPONDED" className="bg-slate-900 text-indigo-400">RESPONDED</option>
                      <option value="QUOTE_SENT" className="bg-slate-900 text-purple-400">QUOTE_SENT</option>
                      <option value="FOLLOW_UP" className="bg-slate-900 text-cyan-400">FOLLOW_UP</option>
                      <option value="WON" className="bg-slate-900 text-emerald-400">WON (CLIENT)</option>
                      <option value="LOST" className="bg-slate-900 text-slate-400">LOST</option>
                      <option value="DISMISSED" className="bg-slate-900 text-slate-500">DISMISSED</option>
                    </select>
                  </td>

                  {/* Quality & Priority Badge */}
                  <td className="py-3.5 px-4 cursor-pointer" onClick={() => { setActiveDetailLead(lead); setLeadNoteInput(lead.notes || ''); }}>
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold border w-fit ${
                        leadQual.qualityLevel === 'HIGH' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                        leadQual.qualityLevel === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' :
                        leadQual.qualityLevel === 'LOW' ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' :
                        'bg-slate-500/10 border-slate-500/30 text-slate-400'
                      }`}>
                        <Sparkles size={9} />
                        <span>{leadQual.qualityLevel} ({leadQual.score} pts)</span>
                      </span>

                      <span className="text-[8px] font-mono px-1.5 py-0.2 rounded border bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 w-fit">
                        {leadQual.provenance.overallClassification}
                      </span>
                    </div>
                  </td>

                  {/* Next Action */}
                  <td className="py-3.5 px-4 cursor-pointer" onClick={() => { setActiveDetailLead(lead); setLeadNoteInput(lead.notes || ''); }}>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 max-w-[180px]" title={nba.reason}>
                      {lead.nextAction || nba.label}
                    </span>
                  </td>

                  {/* Follow-up Date */}
                  <td className="py-3.5 px-4 cursor-pointer" onClick={() => { setActiveDetailLead(lead); setLeadNoteInput(lead.notes || ''); }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                        {lead.nextActionDate || todayStr}
                      </span>
                      {isDueToday && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 border border-rose-500/30 text-rose-500 animate-pulse">
                          🚨 HOY
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Quote / Revenue */}
                  <td className="py-3.5 px-4 text-xs font-mono cursor-pointer" onClick={() => { setActiveDetailLead(lead); setLeadNoteInput(lead.notes || ''); }}>
                    {lead.actualRevenue ? (
                      <span className="font-extrabold text-emerald-500">
                        ${lead.actualRevenue.toLocaleString()} {t('(Ganado)', '(Won)')}
                      </span>
                    ) : lead.quoteAmount ? (
                      <span className="font-bold text-purple-400">
                        ${lead.quoteAmount.toLocaleString()} {t('(Cotizado)', '(Quote)')}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setActiveDetailLead(lead); setLeadNoteInput(lead.notes || ''); }}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition text-[10px] font-bold cursor-pointer"
                        title={t('Ver Ficha Completa', 'View Lead Detail')}
                      >
                        <FileText size={13} />
                      </button>

                      {isActionable ? (
                        <button
                          onClick={() => handleContactAction(lead)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-2.5 py-1.5 rounded-xl text-[10px] transition duration-150 shadow-md shadow-indigo-600/20 inline-flex items-center gap-1 cursor-pointer"
                          title={t('Responder / Contactar', 'Reply / Contact')}
                        >
                          <Send size={11} />
                          <span>{t('CONTACTAR', 'CONTACT')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => { setActiveDetailLead(lead); setLeadNoteInput(lead.notes || ''); }}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-extrabold px-2.5 py-1.5 rounded-xl text-[10px] transition duration-150 inline-flex items-center gap-1 cursor-pointer"
                          title={t('Completar datos de contacto', 'Complete contact details')}
                        >
                          <Edit3 size={11} />
                          <span>{t('Completar datos', 'Add details')}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      {/* LEAD DETAIL MODAL */}
      {activeDetailLead && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 max-w-lg w-full space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveDetailLead(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 font-bold"
            >
              ✕
            </button>

            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusBadgeClass(activeDetailLead.status)}`}>
                  {activeDetailLead.status || 'NEW'}
                </span>
                {activeDetailLead.score && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    ⭐ Score: {activeDetailLead.score} pts
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {getLeadDisplayName(activeDetailLead, lang).name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeDetailLead.category || 'Servicio Local'} • {activeDetailLead.location || 'Ubicación registrada'}
              </p>
            </div>

            {/* Core Info Grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-850/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('Teléfono', 'Phone')}</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {activeDetailLead.phone || t('NO DISPONIBLE', 'NOT AVAILABLE')}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('Sitio Web', 'Website')}</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate block">
                  {activeDetailLead.website || t('NO REGISTRADO', 'NOT REGISTERED')}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('Último Contacto', 'Last Contact')}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {activeDetailLead.lastContact || t('Nunca', 'Never')}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('Próxima Acción', 'Next Action')}</span>
                <span className="font-extrabold text-indigo-500">
                  {activeDetailLead.nextAction || t('Contactar hoy', 'Contact today')}
                </span>
                {activeDetailLead.nextActionDate && (
                  <span className="block text-[10px] text-slate-400 font-mono">📅 {activeDetailLead.nextActionDate}</span>
                )}
              </div>
            </div>

            {/* Bvelt Lead Quality & Deterministic Provenance Evaluation */}
            {(() => {
              const modalQual = LeadQualityEngine.evaluateLead(activeDetailLead, { category: activeDetailLead.category, location: activeDetailLead.location }, lang);
              return (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-extrabold text-amber-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                      <Sparkles size={12} />
                      {t('Calidad Bvelt & Procedencia', 'Bvelt Quality & Provenance')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                      modalQual.qualityLevel === 'HIGH' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                      modalQual.qualityLevel === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                      'bg-slate-500/10 border-slate-500/30 text-slate-400'
                    }`}>
                      {modalQual.qualityLevel} • {modalQual.score}/100 pts
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-500 font-bold block uppercase">{t('Clasificación Datos', 'Data Provenance')}</span>
                      <span className="font-extrabold text-indigo-400">{modalQual.provenance.overallClassification}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-500 font-bold block uppercase">{t('Completitud Contacto', 'Contact Completeness')}</span>
                      <span className="font-extrabold text-cyan-400">{modalQual.provenance.contactCompleteness}</span>
                    </div>
                  </div>

                  {modalQual.reasons.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('Explicabilidad Determinista', 'Deterministic Reasoning')}:</span>
                      <div className="space-y-1">
                        {modalQual.reasons.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-300 bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/80">
                            <span className={reason.impact > 0 ? 'text-emerald-400 font-bold' : reason.impact < 0 ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>
                              {reason.impact > 0 ? `+${reason.impact}` : reason.impact}
                            </span>
                            <span>{lang === 'es' ? reason.labelEs : reason.labelEn}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tags section */}
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-850/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                {t('Etiquetas CRM', 'CRM Tags')}
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {['Follow-up Needed', 'Quote Sent', 'High Priority'].map((tag) => {
                  const hasTag = (activeDetailLead.tags || []).includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        const currentTags = activeDetailLead.tags || [];
                        const newTags = currentTags.includes(tag)
                          ? currentTags.filter(t => t !== tag)
                          : [...currentTags, tag];
                        
                        onUpdateStatus(activeDetailLead.id, activeDetailLead.status || 'NEW', activeDetailLead.lastContact || undefined, {
                          tags: newTags
                        });
                        
                        setActiveDetailLead(prev => prev ? { ...prev, tags: newTags } : null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all duration-150 cursor-pointer ${
                        hasTag
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {tag === 'Follow-up Needed' ? t('Seguimiento Necesario 🕒', 'Follow-up Needed 🕒') :
                       tag === 'Quote Sent' ? t('Cotización Enviada 📄', 'Quote Sent 📄') :
                       t('Alta Prioridad ⚡', 'High Priority ⚡')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Financial Status & Profit Visibility Summary */}
            {(() => {
              const profitEval = CommercialMetricsEngine.computeProfitForLead(activeDetailLead, activeDetailLead.category);
              const prov = profitEval.provenance;
              const badgeClass = 
                prov === 'REAL' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                prov === 'USER_PROVIDED' ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400' :
                prov === 'MODELED' ? 'bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400' :
                'bg-slate-500/15 border-slate-500/30 text-slate-500 dark:text-slate-400';
              
              const provLabel = 
                prov === 'REAL' ? t('GANANCIA REAL', 'REAL PROFIT') :
                prov === 'USER_PROVIDED' ? t('ESTIMACIÓN USUARIO', 'USER ESTIMATE') :
                prov === 'MODELED' ? t('MARGEN MODELADO SECTOR', 'SECTOR MODELED MARGIN') :
                t('SIN DATOS SUFICIENTES', 'INSUFFICIENT DATA');

              const explanation = lang === 'en' ? profitEval.explanationEn : profitEval.explanationEs;

              return (
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1">
                      <DollarSign size={12} />
                      {t('Visibilidad de Rentabilidad Real', 'Profit Visibility Foundation')}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${badgeClass}`}>
                      {provLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">{t('Ingresos', 'Revenue')}</span>
                      <span className="font-extrabold text-white text-sm">
                        {profitEval.revenue > 0 ? `$${profitEval.revenue.toLocaleString()}` : 'N/D'}
                      </span>
                      <span className="text-[8px] text-slate-500 block capitalize">{profitEval.revenueProvenance.toLowerCase()}</span>
                    </div>

                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">{t('Costos Directos', 'Direct Costs')}</span>
                      <span className="font-extrabold text-slate-300 text-sm">
                        {profitEval.directCosts > 0 ? `$${profitEval.directCosts.toLocaleString()}` : '$0'}
                      </span>
                      <span className="text-[8px] text-slate-500 block capitalize">{profitEval.costProvenance.toLowerCase()}</span>
                    </div>

                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">{t('Ganancia Neta', 'Net Profit')}</span>
                      <span className={`font-extrabold text-sm ${profitEval.profit !== null && profitEval.profit >= 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {profitEval.profit !== null ? `$${profitEval.profit.toLocaleString()}` : 'N/D'}
                      </span>
                      <span className="text-[8px] text-slate-500 block capitalize">{prov.toLowerCase()}</span>
                    </div>

                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">{t('Margen %', 'Margin %')}</span>
                      <span className={`font-extrabold text-sm ${profitEval.marginPercent !== null && profitEval.marginPercent > 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
                        {profitEval.marginPercent !== null ? `${profitEval.marginPercent}%` : 'N/D'}
                      </span>
                      <span className="text-[8px] text-slate-500 block capitalize">{prov.toLowerCase()}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium italic border-t border-slate-800/80 pt-2">
                    💡 {explanation}
                  </p>

                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => {
                        setInputQuoteAmount(activeDetailLead.quoteAmount ? String(activeDetailLead.quoteAmount) : '');
                        setActiveQuoteLead(activeDetailLead);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/30 font-bold text-[10px] transition cursor-pointer"
                    >
                      {t('Cotizar', 'Quote')}
                    </button>
                    <button
                      onClick={() => {
                        setInputRevenueAmount(activeDetailLead.actualRevenue ? String(activeDetailLead.actualRevenue) : (activeDetailLead.quoteAmount ? String(activeDetailLead.quoteAmount) : '350'));
                        setInputLaborCost(activeDetailLead.laborCost ? String(activeDetailLead.laborCost) : '');
                        setInputMaterialsCost(activeDetailLead.materialsCost ? String(activeDetailLead.materialsCost) : '');
                        setActiveWonLead(activeDetailLead);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition cursor-pointer"
                    >
                      {t('Registrar Cierre & Costos', 'Record Closure & Costs')}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Editable Notes */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Edit3 size={13} />
                <span>{t('Notas Comerciales', 'Commercial Notes')}</span>
              </span>
              <textarea
                value={leadNoteInput}
                onChange={(e) => setLeadNoteInput(e.target.value)}
                placeholder={t('Agrega observaciones del cliente, preferencias o requerimientos especiales...', 'Add client observations, preferences or specific requirements...')}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 resize-none h-20"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => handleSaveNotes(activeDetailLead)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] rounded-lg transition cursor-pointer"
                >
                  {t('Guardar Nota', 'Save Note')}
                </button>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => {
                  const leadToContact = activeDetailLead;
                  setActiveDetailLead(null);
                  handleContactAction(leadToContact);
                }}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Send size={13} />
                <span>{t('Contactar', 'Contact')}</span>
              </button>

              <button
                onClick={() => setActiveFollowUpLead(activeDetailLead)}
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Calendar size={13} />
                <span>{t('Seguimiento', 'Follow-up')}</span>
              </button>

              <button
                onClick={() => {
                  setInputQuoteAmount(activeDetailLead.quoteAmount ? String(activeDetailLead.quoteAmount) : '');
                  setActiveQuoteLead(activeDetailLead);
                }}
                className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <DollarSign size={13} />
                <span>{t('Cotización', 'Quote')}</span>
              </button>

              <button
                onClick={() => {
                  onUpdateStatus(activeDetailLead.id, 'LOST', new Date().toLocaleDateString());
                  setActiveDetailLead(null);
                }}
                className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <XCircle size={13} />
                <span>{t('Perdido', 'Lost')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLLOW-UP DATE PICKER MODAL */}
      {activeFollowUpLead && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveFollowUpLead(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 font-bold"
            >
              ✕
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider block">
                {t('PROGRAMAR SEGUIMIENTO', 'SCHEDULE FOLLOW-UP')}
              </span>
              <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                {getLeadDisplayName(activeFollowUpLead, lang).name}
              </h4>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-bold block">{t('Opciones Rápidas:', 'Quick Options:')}</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setFollowUpPreset(0, activeFollowUpLead)}
                  className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 font-bold text-xs text-center cursor-pointer transition"
                >
                  {t('Hoy', 'Today')}
                </button>
                <button
                  onClick={() => setFollowUpPreset(1, activeFollowUpLead)}
                  className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold text-xs text-center cursor-pointer transition"
                >
                  {t('Mañana', 'Tomorrow')}
                </button>
                <button
                  onClick={() => setFollowUpPreset(3, activeFollowUpLead)}
                  className="p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs text-center cursor-pointer transition"
                >
                  {t('+3 Días', '+3 Days')}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs text-slate-400 font-bold block">{t('O fecha personalizada:', 'Or custom date:')}</label>
              <input
                type="date"
                value={customFollowUpDate}
                onChange={(e) => setCustomFollowUpDate(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => handleCustomFollowUpSubmit(activeFollowUpLead)}
                disabled={!customFollowUpDate}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold p-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {t('Guardar Fecha de Seguimiento', 'Save Follow-up Date')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUOTE AMOUNT MODAL */}
      {activeQuoteLead && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveQuoteLead(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 font-bold"
            >
              ✕
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider block">
                {t('REGISTRAR COTIZACIÓN', 'RECORD QUOTE')}
              </span>
              <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                {getLeadDisplayName(activeQuoteLead, lang).name}
              </h4>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-slate-400 font-bold block">
                {t('Monto de Cotización Enviada ($USD):', 'Sent Quote Amount ($USD):')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  placeholder="350"
                  value={inputQuoteAmount}
                  onChange={(e) => setInputQuoteAmount(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-7 pr-3 text-sm font-extrabold text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500"
                />
              </div>

              {onNavigateToEstimator && (
                <button
                  onClick={() => {
                    const l = activeQuoteLead;
                    setActiveQuoteLead(null);
                    onNavigateToEstimator(l);
                  }}
                  className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileText size={13} />
                  <span>{t('Calcular con Estimador Espacial', 'Calculate with Spatial Estimator')}</span>
                </button>
              )}

              <button
                onClick={() => handleSaveQuoteSubmit(activeQuoteLead)}
                disabled={!inputQuoteAmount}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold p-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {t('Guardar Cotización Enviada', 'Save Sent Quote')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVENUE / WON DEAL MODAL */}
      {activeWonLead && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveWonLead(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 font-bold"
            >
              ✕
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                🏆 {t('REGISTRAR VENTA GANADA', 'RECORD WON SALE')}
              </span>
              <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                {getLeadDisplayName(activeWonLead, lang).name}
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">
                  {t('Ingreso Real Confirmado ($USD):', 'Real Confirmed Revenue ($USD):')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    placeholder="350"
                    value={inputRevenueAmount}
                    onChange={(e) => setInputRevenueAmount(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-7 pr-3 text-sm font-extrabold text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Direct Costs Inputs (Labor + Materials) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                  {t('Costos Directos del Trabajo (Opcional):', 'Direct Job Costs (Optional):')}
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                      {t('Mano de Obra ($)', 'Labor ($)')}
                    </label>
                    <input
                      type="number"
                      placeholder="100"
                      value={inputLaborCost}
                      onChange={(e) => setInputLaborCost(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                      {t('Materiales ($)', 'Materials ($)')}
                    </label>
                    <input
                      type="number"
                      placeholder="50"
                      value={inputMaterialsCost}
                      onChange={(e) => setInputMaterialsCost(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Live Profit Preview */}
              {(() => {
                const rev = parseFloat(inputRevenueAmount) || 0;
                const labor = parseFloat(inputLaborCost) || 0;
                const materials = parseFloat(inputMaterialsCost) || 0;
                const totalCost = labor + materials;
                const hasCost = labor > 0 || materials > 0;
                
                // If no user cost entered, compute modeled sector estimate for preview
                const tempLead = { actualRevenue: rev, laborCost: labor, materialsCost: materials, directCost: totalCost };
                const tempEval = CommercialMetricsEngine.computeProfitForLead(tempLead, activeWonLead.category);

                return (
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-bold uppercase">{t('Rentabilidad Calculada', 'Calculated Profit')}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                        hasCost 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                          : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      }`}>
                        {hasCost ? t('REAL • USUARIO', 'REAL • USER') : t('MODELADO • SECTOR', 'MODELED • SECTOR')}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-xs text-slate-300 font-medium">
                        {t('Ganancia Neta:', 'Net Profit:')} <strong className="text-emerald-400 font-mono text-sm">${(tempEval.profit || 0).toLocaleString()}</strong>
                      </span>
                      <span className="text-xs text-cyan-400 font-mono font-bold">
                        {tempEval.marginPercent !== null ? `${tempEval.marginPercent}%` : '0%'} {t('Margen', 'Margin')}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => handleSaveWonSubmit(activeWonLead)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-2.5 rounded-xl text-xs transition cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {t('Confirmar Venta Ganada & Ingreso Real', 'Confirm Won Sale & Real Revenue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUTREACH CONTACT MODAL */}
      {activeContactLead && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 max-w-md w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setActiveContactLead(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 font-bold"
            >
              ✕
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                {t('CONTACTAR PROSPECTO', 'CONTACT PROSPECT')}
              </span>
              <h4 className="text-lg font-black text-slate-900 dark:text-white truncate">
                {getLeadDisplayName(activeContactLead, lang).name}
              </h4>
            </div>

            {/* Next Best Action Recommendation Banner */}
            {(() => {
              const nba = ActionEngine.getNextBestActionForLead(activeContactLead, 'es');
              return (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-400 flex items-center gap-1 text-[11px]">
                      <Sparkles size={12} />
                      <span>{t('Recomendación de Acción Inteligente', 'Smart Action Recommendation')}</span>
                    </span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                      {nba.priority}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {nba.label}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {nba.reason}
                  </p>
                  {onNavigateToEstimator && (
                    <button
                      onClick={() => {
                        setActiveContactLead(null);
                        onNavigateToEstimator(activeContactLead);
                      }}
                      className="mt-1 w-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold py-1.5 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer border border-indigo-500/30"
                    >
                      <FileText size={13} />
                      <span>{t('Abrir Estimador de Cotizaciones', 'Open Quote Estimator')}</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Real available contact channels */}
            {(() => {
              const rawPhone = (activeContactLead.phone || '').trim();
              const rawEmail = (activeContactLead.email || '').trim();
              const rawWa = (activeContactLead.whatsapp || activeContactLead.whatsappChannelId || rawPhone).trim();

              const hasPhone = rawPhone.replace(/[^0-9]/g, '').length >= 7;
              const hasEmail = rawEmail.includes('@') && rawEmail.includes('.') && rawEmail.length >= 6;
              const hasWhatsapp = rawWa.replace(/[^0-9]/g, '').length >= 7;
              const hasAnyChannel = hasPhone || hasEmail || hasWhatsapp;

              if (!hasAnyChannel) {
                return (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-3">
                    <p className="text-xs font-bold text-amber-500">
                      {t('Sin canales directos de contacto registrados (teléfono o correo).', 'No direct contact channels recorded (phone or email).')}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {t('Para enviar una propuesta directa o realizar llamadas, por favor completa los datos en la ficha del lead.', 'To send a direct proposal or make calls, please add contact details to the lead record.')}
                    </p>
                    <button
                      onClick={() => {
                        setActiveDetailLead(activeContactLead);
                        setLeadNoteInput(activeContactLead.notes || '');
                        setActiveContactLead(null);
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <Edit3 size={14} />
                      <span>{t('Completar Datos de Contacto', 'Add Contact Details')}</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('Selecciona un canal de contacto basado en datos reales disponibles:', 'Select a direct contact channel using real data:')}
                  </p>

                  {/* WhatsApp / SMS */}
                  {(hasWhatsapp || hasPhone) && (
                    <button
                      onClick={() => executeContact('wa', activeContactLead)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-3 rounded-xl text-xs flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare size={16} />
                        <span>{t('Enviar por WhatsApp / SMS', 'Send via WhatsApp / SMS')}</span>
                      </div>
                      <span className="text-[10px] opacity-80">{rawPhone || rawWa || 'WhatsApp'}</span>
                    </button>
                  )}

                  {/* Phone Call */}
                  {hasPhone && (
                    <button
                      onClick={() => executeContact('call', activeContactLead)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3 rounded-xl text-xs flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Phone size={16} />
                        <span>{t('Llamada Telefónica', 'Phone Call')}</span>
                      </div>
                      <span className="text-[10px] opacity-80">{rawPhone}</span>
                    </button>
                  )}

                  {/* Email */}
                  {hasEmail && (
                    <button
                      onClick={() => executeContact('email', activeContactLead)}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold p-3 rounded-xl text-xs flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Mail size={16} />
                        <span>{t('Enviar Correo', 'Send Email')}</span>
                      </div>
                      <span className="text-[10px] opacity-80">{rawEmail}</span>
                    </button>
                  )}

                  {/* Copy Pitch */}
                  <button
                    onClick={() => executeContact('copy', activeContactLead)}
                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold p-3 rounded-xl text-xs flex items-center justify-between transition cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      {copiedType === 'msg' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      <span>{copiedType === 'msg' ? t('¡Mensaje Copiado!', 'Message Copied!') : t('Copiar Pitch Mensaje', 'Copy Pitch Message')}</span>
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Quick Status Updater */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">{t('Estado:', 'Status:')}</span>
              <div className="flex gap-1">
                {(['CONTACTED', 'RESPONDED', 'WON', 'LOST'] as LeadStatusType[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      const today = new Date().toLocaleDateString();
                      onUpdateStatus(activeContactLead.id, st, today);
                      setActiveContactLead(prev => prev ? { ...prev, status: st, lastContact: today } : null);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                      activeContactLead.status === st
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientAcquisitionLeadList;
