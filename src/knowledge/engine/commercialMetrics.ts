import { EvidenceStatus } from '../../lib/bveltEvidence';
import { MarketReferenceEngine, LocalBenchmarkSet, GeographicScope } from './marketReferenceEngine';
import { isLeadInServiceArea, isBusinessLead } from '../../lib/navigation/routeToAnswerLeads';

export interface CommercialSummary {
  openOpps: number;
  leadsToContact: number;
  followUpsDue: number;
  quotesSent: number;
  wonDeals: number;
  realRevenue: number;
  uncontactedLeads: number;
  totalLeadsCount: number;
}

export type FinancialProvenance = 
  | 'REAL' 
  | 'USER_PROVIDED' 
  | 'VERIFIED' 
  | 'MODELED' 
  | 'BENCHMARK' 
  | 'INSUFFICIENT_DATA';

export interface ProfitEvaluation {
  revenue: number;
  revenueProvenance: FinancialProvenance;
  directCosts: number;
  costProvenance: FinancialProvenance;
  profit: number | null;
  marginPercent: number | null;
  overallProvenance: FinancialProvenance;
  provenance: FinancialProvenance;
  isActual: boolean;
  isModeled: boolean;
  explanationEs: string;
  explanationEn: string;
}

export interface ProfitSummary {
  totalRealRevenue: number;
  totalUserQuotedRevenue: number;
  totalActualDirectCosts: number;
  totalModeledDirectCosts: number;
  actualNetProfit: number | null;
  actualMarginPercent: number | null;
  modeledNetProfit: number | null;
  modeledMarginPercent: number | null;
  overallProvenance: FinancialProvenance;
  provenance: FinancialProvenance;
  dealsEvaluated: number;
  wonDealsWithCostCount: number;
  wonDealsCount: number;
  sectorCategory: string;
}

export interface MetricDefinition {
  code: string;
  nameEs: string;
  nameEn: string;
  definitionEs: string;
  definitionEn: string;
  evidenceStatus: EvidenceStatus;
}

export const COMMERCIAL_METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  openOpps: {
    code: 'OPEN_OPPORTUNITIES',
    nameEs: 'Oportunidades en Pipeline',
    nameEn: 'Open Opportunities',
    definitionEs: 'Contactos y clientes potenciales activos en proceso de venta que no han sido cerrados ni descartados.',
    definitionEn: 'Active contacts and leads in the sales pipeline not yet closed or dismissed.',
    evidenceStatus: 'VERIFIED'
  },
  leadsToContact: {
    code: 'UNCONTACTED_LEADS',
    nameEs: 'Sin Contactar',
    nameEn: 'Leads to Contact',
    definitionEs: 'Solicitudes y prospectos recibidos que aún no han recibido su primer contacto o intento de interacción.',
    definitionEn: 'Received requests and prospects that have not yet received their first touchpoint.',
    evidenceStatus: 'VERIFIED'
  },
  followUpsDue: {
    code: 'FOLLOW_UPS_DUE',
    nameEs: 'Seguimientos Pendientes',
    nameEn: 'Follow-ups Due',
    definitionEs: 'Prospectos con fecha de seguimiento agendada para hoy o previa, o en estado explícito de seguimiento.',
    definitionEn: 'Prospects with a scheduled follow-up date for today or past due, or in explicit follow-up status.',
    evidenceStatus: 'VERIFIED'
  },
  quotesSent: {
    code: 'QUOTES_SENT',
    nameEs: 'Cotizaciones Enviadas',
    nameEn: 'Quotes Sent',
    definitionEs: 'Presupuestos o propuestas económicas formalmente emitidas pendientes de confirmación.',
    definitionEn: 'Formally issued price estimates or proposals pending customer confirmation.',
    evidenceStatus: 'VERIFIED'
  },
  wonDeals: {
    code: 'WON_DEALS',
    nameEs: 'Clientes Ganados',
    nameEn: 'Won Deals',
    definitionEs: 'Clientes que han aceptado propuestas y completado operaciones comerciales.',
    definitionEn: 'Clients who accepted proposals and completed commercial transactions.',
    evidenceStatus: 'VERIFIED'
  },
  realRevenue: {
    code: 'REAL_REVENUE',
    nameEs: 'Ingreso Real',
    nameEn: 'Real Revenue',
    definitionEs: 'Suma de cobros efectivos registrados en transacciones pagadas y valor confirmado de clientes ganados.',
    definitionEn: 'Sum of actual collected payments from paid transactions and confirmed value from won deals.',
    evidenceStatus: 'DERIVED'
  },
  actualProfit: {
    code: 'ACTUAL_PROFIT',
    nameEs: 'Ganancia Neta Real',
    nameEn: 'Actual Net Profit',
    definitionEs: 'Diferencia entre ingresos reales confirmados y costos directos reales/proporcionados.',
    definitionEn: 'Difference between confirmed real revenue and real/user-provided direct costs.',
    evidenceStatus: 'VERIFIED'
  },
  estimatedProfit: {
    code: 'ESTIMATED_PROFIT',
    nameEs: 'Ganancia Estimada',
    nameEn: 'Estimated Profit',
    definitionEs: 'Ganancia calculada combinando ingresos cotizados o modelados con costos de benchmark sectorial.',
    definitionEn: 'Calculated profit combining quoted or modeled revenue with sector benchmark costs.',
    evidenceStatus: 'DERIVED'
  }
};

/**
 * Benchmark cost ratios (Direct Costs / Revenue) by industry sector.
 * Used exclusively when explicit user costs are not provided.
 */
const SECTOR_BENCHMARK_COST_RATIOS: Record<string, number> = {
  'roofing': 0.55,
  'techos': 0.55,
  'hvac': 0.50,
  'plumbing': 0.45,
  'plomeria': 0.45,
  'electrical': 0.45,
  'electricista': 0.45,
  'construction': 0.60,
  'construccion': 0.60,
  'remodeling': 0.55,
  'landscaping': 0.50,
  'dentist': 0.35,
  'lawyer': 0.25,
  'abogado': 0.25,
  'auto repair': 0.55,
  'taller mecanico': 0.55,
  'restaurant': 0.65,
  'restaurante': 0.65,
  'cleaning': 0.40,
  'limpieza': 0.40
};

const DEFAULT_COST_RATIO = 0.50;

/**
 * Single Source of Truth for Commercial Data and Profit Visibility in Bvelt.
 * Consolidates leads, quotes, transactions, and CRM status calculations.
 */
export class CommercialMetricsEngine {
  static computeSummary(
    leads: any[] = [],
    storedQuotes: any[] = [],
    clientTransactions: any[] = [],
    profile?: any
  ): CommercialSummary {
    const todayStr = new Date().toISOString().split('T')[0];
    const safeLeads = Array.isArray(leads) ? leads : [];
    const safeQuotes = Array.isArray(storedQuotes) ? storedQuotes : [];
    const safeTx = Array.isArray(clientTransactions)
      ? clientTransactions.filter(t => !t.isDemo && !t.id?.startsWith('dt-'))
      : [];

    const activeProfile = profile || (() => {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('lf_profile') : null;
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    // Strictly filter leads by in-area location and non-demo status
    const inAreaLeads = safeLeads.filter(l => isBusinessLead(l, activeProfile));

    const closedStatuses = ['WON', 'CLIENT', 'PAID', 'LOST', 'DISMISSED'];
    const uncontactedStatuses = ['NEW', 'NEW_LEAD', 'NUEVO', 'PENDING', 'UNCONTACTED'];

    // 1. Open Opportunities (in pipeline)
    const openOpps = inAreaLeads.filter(l => 
      !l.status || !closedStatuses.includes(String(l.status).toUpperCase())
    ).length;

    // 2. Leads to contact (Uncontacted)
    const leadsToContact = inAreaLeads.filter(l => {
      if (!l.status) return true;
      return uncontactedStatuses.includes(String(l.status).toUpperCase());
    }).length;

    // 3. Follow-ups Due
    const followUpsDue = inAreaLeads.filter(l => {
      if (closedStatuses.includes(l.status)) return false;
      if (l.status === 'FOLLOW_UP') return true;
      if (l.nextActionDate && l.nextActionDate <= todayStr) return true;
      return false;
    }).length;

    // 4. Quotes Sent
    const leadsWithQuotes = new Set<string>();
    inAreaLeads.forEach(l => {
      if (l.status === 'QUOTE_SENT' || l.quoteAmount) {
        leadsWithQuotes.add(l.id || l.client);
      }
    });
    safeQuotes.forEach(q => {
      if (q.status === 'SENT') {
        leadsWithQuotes.add(q.leadId || q.id || q.leadName);
      }
    });
    const quotesSent = leadsWithQuotes.size;

    // 5. Won Deals
    const wonLeads = inAreaLeads.filter(l => 
      l.status === 'WON' || l.status === 'CLIENT' || l.status === 'PAID'
    );
    const wonDeals = wonLeads.length;

    // 6. Real Revenue (Verified paid transactions + won lead values)
    const paidTransactionsSum = safeTx
      .filter(t => t.status === 'pagado')
      .reduce((acc, curr) => acc + (typeof curr.amount === 'number' && !isNaN(curr.amount) ? curr.amount : 0), 0);

    const wonLeadsSum = wonLeads.reduce((acc, l) => {
      const val = l.actualRevenue || l.value || 0;
      return acc + (typeof val === 'number' && !isNaN(val) ? val : 0);
    }, 0);

    const realRevenue = paidTransactionsSum + wonLeadsSum;

    return {
      openOpps,
      leadsToContact,
      followUpsDue,
      quotesSent,
      wonDeals,
      realRevenue,
      uncontactedLeads: leadsToContact,
      totalLeadsCount: inAreaLeads.length
    };
  }

  /**
   * Deterministic Profit Evaluation for an individual lead or opportunity.
   * Enforces strict epistemological separation of REAL, USER_PROVIDED, MODELED, and INSUFFICIENT_DATA.
   */
  static computeProfitForLead(lead: any, category?: string): ProfitEvaluation {
    if (!lead) {
      return {
        revenue: 0,
        revenueProvenance: 'INSUFFICIENT_DATA',
        directCosts: 0,
        costProvenance: 'INSUFFICIENT_DATA',
        profit: null,
        marginPercent: null,
        overallProvenance: 'INSUFFICIENT_DATA',
        provenance: 'INSUFFICIENT_DATA',
        isActual: false,
        isModeled: false,
        explanationEs: 'Sin datos suficientes para calcular rentabilidad.',
        explanationEn: 'Insufficient data to compute profitability.'
      };
    }

    // 1. Determine Revenue & Provenance
    let revenue = 0;
    let revenueProvenance: FinancialProvenance = 'INSUFFICIENT_DATA';

    if (typeof lead.actualRevenue === 'number' && lead.actualRevenue > 0) {
      revenue = lead.actualRevenue;
      revenueProvenance = 'REAL';
    } else if (typeof lead.value === 'number' && lead.value > 0 && (lead.status === 'WON' || lead.status === 'PAID')) {
      revenue = lead.value;
      revenueProvenance = 'REAL';
    } else if (typeof lead.quoteAmount === 'number' && lead.quoteAmount > 0) {
      revenue = lead.quoteAmount;
      revenueProvenance = 'USER_PROVIDED';
    } else if (typeof lead.estimatedValue === 'number' && lead.estimatedValue > 0) {
      revenue = lead.estimatedValue;
      revenueProvenance = 'MODELED';
    } else if (typeof lead.value === 'number' && lead.value > 0) {
      revenue = lead.value;
      revenueProvenance = 'USER_PROVIDED';
    }

    // 2. Determine Direct Costs & Provenance
    const userDirectCosts = (typeof lead.laborCost === 'number' ? lead.laborCost : 0) +
                            (typeof lead.materialsCost === 'number' ? lead.materialsCost : 0) +
                            (typeof lead.directCost === 'number' ? lead.directCost : 0);

    let directCosts = 0;
    let costProvenance: FinancialProvenance = 'INSUFFICIENT_DATA';

    if (userDirectCosts > 0) {
      directCosts = userDirectCosts;
      costProvenance = 'USER_PROVIDED';
    } else if (revenue > 0) {
      const catKey = String(category || lead.category || '').toLowerCase().trim();
      const ratio = SECTOR_BENCHMARK_COST_RATIOS[catKey] || DEFAULT_COST_RATIO;
      directCosts = Math.round(revenue * ratio);
      costProvenance = 'MODELED';
    }

    // 3. Compute Profit & Margin
    if (revenue <= 0 || revenueProvenance === 'INSUFFICIENT_DATA') {
      return {
        revenue: 0,
        revenueProvenance: 'INSUFFICIENT_DATA',
        directCosts: userDirectCosts,
        costProvenance: userDirectCosts > 0 ? 'USER_PROVIDED' : 'INSUFFICIENT_DATA',
        profit: null,
        marginPercent: null,
        overallProvenance: 'INSUFFICIENT_DATA',
        provenance: 'INSUFFICIENT_DATA',
        isActual: false,
        isModeled: false,
        explanationEs: 'Métrica incompleta: Se requiere el ingreso confirmado o cotizado para estimar la ganancia.',
        explanationEn: 'Incomplete metric: Confirmed or quoted revenue is required to estimate profit.'
      };
    }

    const profit = revenue - directCosts;
    const marginPercent = Math.round((profit / revenue) * 100);

    const isActual = (revenueProvenance === 'REAL' || revenueProvenance === 'USER_PROVIDED') && costProvenance === 'USER_PROVIDED';
    const isModeled = !isActual;

    let overallProvenance: FinancialProvenance = 'MODELED';
    if (isActual) {
      overallProvenance = revenueProvenance === 'REAL' ? 'REAL' : 'USER_PROVIDED';
    }

    let explanationEs = '';
    let explanationEn = '';

    if (isActual) {
      explanationEs = `Ganancia real de $${profit.toLocaleString()} (${marginPercent}% margen) basada en ingreso de $${revenue.toLocaleString()} y costos directos de $${directCosts.toLocaleString()}.`;
      explanationEn = `Actual profit of $${profit.toLocaleString()} (${marginPercent}% margin) based on $${revenue.toLocaleString()} revenue and $${directCosts.toLocaleString()} direct costs.`;
    } else if (costProvenance === 'MODELED') {
      explanationEs = `Ganancia estimada de $${profit.toLocaleString()} (${marginPercent}% margen) aplicando el benchmark de costo sectorial (${Math.round((directCosts / revenue) * 100)}%) sobre el ingreso de $${revenue.toLocaleString()}.`;
      explanationEn = `Estimated profit of $${profit.toLocaleString()} (${marginPercent}% margin) applying sector benchmark cost ratio (${Math.round((directCosts / revenue) * 100)}%) on $${revenue.toLocaleString()} revenue.`;
    } else {
      explanationEs = `Ganancia modelada de $${profit.toLocaleString()} (${marginPercent}% margen).`;
      explanationEn = `Modeled profit of $${profit.toLocaleString()} (${marginPercent}% margin).`;
    }

    return {
      revenue,
      revenueProvenance,
      directCosts,
      costProvenance,
      profit,
      marginPercent,
      overallProvenance,
      provenance: overallProvenance,
      isActual,
      isModeled,
      explanationEs,
      explanationEn
    };
  }

  /**
   * Aggregates Profit & Margin metrics across all leads, quotes, and transactions.
   */
  static computeProfitSummary(
    leads: any[] = [],
    storedQuotes: any[] = [],
    clientTransactions: any[] = [],
    category?: string
  ): ProfitSummary {
    const safeLeads = Array.isArray(leads) ? leads.filter(l => isBusinessLead(l)) : [];
    const safeTx = Array.isArray(clientTransactions)
      ? clientTransactions.filter(t => !t.isDemo && !t.id?.startsWith('dt-'))
      : [];

    let totalRealRevenue = 0;
    let totalUserQuotedRevenue = 0;
    let totalActualDirectCosts = 0;
    let totalModeledDirectCosts = 0;
    let dealsEvaluated = 0;
    let wonDealsWithCostCount = 0;
    let wonDealsCount = 0;

    // Paid transactions contribute to Real Revenue
    const paidTxSum = safeTx
      .filter(t => t.status === 'pagado')
      .reduce((acc, t) => acc + (typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0), 0);

    totalRealRevenue += paidTxSum;

    safeLeads.forEach(lead => {
      const st = (lead.status || '').toUpperCase();
      if (st === 'WON' || st === 'CLIENT') {
        wonDealsCount++;
      }

      const evalRes = this.computeProfitForLead(lead, category);
      if (evalRes.revenue > 0) {
        dealsEvaluated++;

        if (evalRes.revenueProvenance === 'REAL') {
          totalRealRevenue += evalRes.revenue;
        } else if (evalRes.revenueProvenance === 'USER_PROVIDED') {
          totalUserQuotedRevenue += evalRes.revenue;
        }

        if (evalRes.costProvenance === 'USER_PROVIDED') {
          totalActualDirectCosts += evalRes.directCosts;
          wonDealsWithCostCount++;
        } else if (evalRes.costProvenance === 'MODELED') {
          totalModeledDirectCosts += evalRes.directCosts;
        }
      }
    });

    const totalRevenue = totalRealRevenue + totalUserQuotedRevenue;
    const totalCosts = totalActualDirectCosts + totalModeledDirectCosts;

    let actualNetProfit: number | null = null;
    let actualMarginPercent: number | null = null;

    if (wonDealsWithCostCount > 0 && totalRealRevenue > 0) {
      actualNetProfit = totalRealRevenue - totalActualDirectCosts;
      actualMarginPercent = Math.round((actualNetProfit / totalRealRevenue) * 100);
    }

    let modeledNetProfit: number | null = null;
    let modeledMarginPercent: number | null = null;

    if (totalRevenue > 0) {
      modeledNetProfit = totalRevenue - totalCosts;
      modeledMarginPercent = Math.round((modeledNetProfit / totalRevenue) * 100);
    }

    let provenance: FinancialProvenance = 'MODELED';
    if (wonDealsWithCostCount > 0 && totalRealRevenue > 0) {
      provenance = 'REAL';
    } else if (totalUserQuotedRevenue > 0) {
      provenance = 'USER_PROVIDED';
    } else if (totalRevenue === 0) {
      provenance = 'INSUFFICIENT_DATA';
    }

    return {
      totalRealRevenue,
      totalUserQuotedRevenue,
      totalActualDirectCosts,
      totalModeledDirectCosts,
      actualNetProfit,
      actualMarginPercent,
      modeledNetProfit,
      modeledMarginPercent,
      overallProvenance: provenance,
      provenance,
      dealsEvaluated,
      wonDealsWithCostCount,
      wonDealsCount,
      sectorCategory: category || 'General Commercial'
    };
  }

  /**
   * Access point to compute verified/derived local market benchmarks from observed competitor radar data.
   * Does not alter or mix into private CRM revenue or conversion pipelines.
   */
  static computeLocalBenchmarks(
    competitors: any[] = [],
    geographicScope: GeographicScope = 'SAME_CITY_SAME_RADIUS',
    lang: 'es' | 'en' = 'es'
  ): LocalBenchmarkSet {
    return MarketReferenceEngine.computeLocalBenchmarks(competitors, geographicScope, lang);
  }
}

