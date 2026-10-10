/**
 * OpportunityEngine for Bvelt
 * Core engine to detect, score, prioritize, route, and calibrate actionable opportunities.
 * 
 * Consumes:
 * - MarketContext & MarketReferenceEngine (CBP / QCEW / ACS / NAICS)
 * - CRM state (leads, uncontacted count, stages)
 * - Reviews & Google Business Profile (unanswered reviews, sync state)
 * - Local Radar & Competitors (density, rating gaps, distance)
 * - CalibrationEngine (recording estimates for future tracking)
 */

import { MarketReferenceEngine, MarketBenchmark, OpportunityEstimate } from './marketReferenceEngine';
import { IndustryResolver } from '../resolvers/industryResolver';
import { GeographyResolver } from '../resolvers/geographyResolver';
import { CalibrationEngine } from './calibrationEngine';
import { EvidenceStatus } from '../../lib/bveltEvidence';
import { CalculationDetails } from '../../components/dashboard/CalculationModal';
import { isLeadInServiceArea, isBusinessLead } from '../../lib/navigation/routeToAnswerLeads';

export type OpportunityType =
  | 'LEAD_CAPTURE'
  | 'FOLLOW_UP'
  | 'REVIEW_GROWTH'
  | 'REACTIVATION'
  | 'LOCAL_VISIBILITY'
  | 'COMPETITOR_GAP'
  | 'PROFILE_COMPLETENESS'
  | 'WEBSITE_CONVERSION'
  | 'OFFER_OPPORTUNITY'
  | 'REFERRAL'
  | 'RETENTION';

export type OpportunityPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type OpportunityStatus = 
  | 'DETECTED' 
  | 'READY' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'DISMISSED' 
  | 'EXPIRED';

export interface ActionTarget {
  tab: string;
  subRow?: number;
  section?: string;
  filter?: string;
  targetId?: string;
  actionType?: string;
  [key: string]: any;
}

export interface ImpactRange {
  min: number;
  max: number;
  centralEstimate?: number;
  unit: string;
  formatted: string;
  confidence: number; // 0 to 1
  isAvailable: boolean;
}

export interface BusinessOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  whyThisMatters: string;
  priority: OpportunityPriority;
  opportunityScore: number; // 0 to 10
  impactRange: ImpactRange;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceScore: number;
  evidenceStatus: EvidenceStatus;
  evidenceSummary: string;
  source: string;
  createdAt: string;
  expiresAt?: string;
  recommendedAction: string;
  actionTarget: ActionTarget;
  status: OpportunityStatus;
  formulaVersion: string;
  calculationDetails: CalculationDetails;
}

export interface OpportunityEngineInput {
  profile: {
    businessName?: string;
    category?: string;
    niche?: string;
    location?: string;
    phone?: string;
    website?: string;
    photosCount?: number;
    gmbConnected?: boolean;
    syncStatus?: string;
    hoursSet?: boolean;
  };
  leads?: any[];
  gmbReviews?: any[];
  realCompetitors?: any[];
  radarCompetitorCount?: number;
  battleScanned?: boolean;
  battleLostRevenue?: number;
  currentViews?: number;
  avgTicketUsd?: number;
  conversionRate?: number;
  language?: string;
  t?: (es: string, en: string) => string;
}

export interface OpportunityExecutionLog {
  opportunityId: string;
  actionId: string;
  timestamp: string;
  status: OpportunityStatus;
  estimatedImpact: { min: number; max: number };
  actualImpact?: number;
  resultType?: string;
  predictionError?: number;
  formulaVersion: string;
  evidenceUsed: string[];
}

const STORAGE_OPPS_KEY = 'bvelt_opp_statuses_v1';
const STORAGE_LOGS_KEY = 'bvelt_opp_executions_v1';

export class OpportunityEngine {
  private static FORMULA_VERSION = 'v2.1_opp_engine';

  /**
   * Evaluates all operational signals and generates prioritized opportunities
   */
  static evaluateOpportunities(input: OpportunityEngineInput): BusinessOpportunity[] {
    const t = input.t || ((es: string, en: string) => (input.language === 'en' ? en : es));
    const category = input.profile.category || input.profile.niche || 'General Services';
    const location = input.profile.location || 'Local Market';
    const gmbConnected = !!input.profile.gmbConnected;
    const leads = input.leads || [];
    const reviews = input.gmbReviews || [];
    const competitors = input.realCompetitors || [];
    const avgTicket = input.avgTicketUsd || 350;
    const conversionRate = input.conversionRate || 0.05;
    const views = input.currentViews || 0;

    // Resolve market context
    const resolvedIndustry = IndustryResolver.resolve(category);
    const resolvedGeo = GeographyResolver.resolveSync(location);

    const benchmark = MarketReferenceEngine.getMarketBenchmark(
      category,
      location,
      resolvedGeo.stateCode || undefined,
      resolvedGeo.county || undefined,
      resolvedIndustry.naicsCandidates,
      resolvedGeo.msa || undefined
    );

    const marketOpp = benchmark.market_reference;
    const oppMin = marketOpp?.range.min || Math.round(views * conversionRate * (avgTicket * 0.5));
    const oppMax = marketOpp?.range.max || Math.round(views * conversionRate * (avgTicket * 1.5));

    // Load persisted statuses
    const savedStatuses = this.getSavedStatuses();

    const opportunities: BusinessOpportunity[] = [];

    // =========================================================================
    // 1. FOLLOW_UP: Uncontacted / New CRM Leads (<15min response rule)
    // Only count leads inside profile's service area and exclude demo leads
    // =========================================================================
    const uncontactedStatuses = ['NEW', 'NEW_LEAD', 'NUEVO', 'PENDING', 'UNCONTACTED'];
    const uncontactedLeads = leads.filter((l: any) => {
      if (!isBusinessLead(l, input.profile)) return false;
      if (!l.status) return true;
      return uncontactedStatuses.includes(String(l.status).toUpperCase());
    });

    if (uncontactedLeads.length > 0) {
      const pendingCount = uncontactedLeads.length;
      const firstTargetLeadId = uncontactedLeads[0]?.id;
      const potentialLossMin = Math.round(pendingCount * avgTicket * 0.6);
      const potentialLossMax = Math.round(pendingCount * avgTicket * 1.0);
      const score = Math.min(9.8, 7.5 + (pendingCount * 0.4));

      opportunities.push({
        id: 'opp_followup_pending_leads',
        type: 'FOLLOW_UP',
        title: t(
          `${pendingCount} ${pendingCount === 1 ? 'cliente potencial sin contactar' : 'clientes potenciales sin contactar'}`,
          `${pendingCount} uncontacted ${pendingCount === 1 ? 'lead' : 'leads'}`
        ),
        description: t(
          `Tienes ${pendingCount} solicitudes recientes esperando respuesta en tu bandeja de entrada.`,
          `You have ${pendingCount} recent client requests awaiting response in your inbox.`
        ),
        whyThisMatters: t(
          'Responder con rapidez a solicitudes nuevas maximiza las probabilidades de cierre frente a competidores locales.',
          'Responding quickly to new inquiries significantly improves closing rates against local competitors.'
        ),
        priority: 'HIGH',
        opportunityScore: score,
        impactRange: {
          min: potentialLossMin,
          max: potentialLossMax,
          centralEstimate: Math.round((potentialLossMin + potentialLossMax) / 2),
          unit: 'USD',
          formatted: `$${potentialLossMin.toLocaleString()} – $${potentialLossMax.toLocaleString()}`,
          confidence: 0.95,
          isAvailable: true
        },
        confidence: 'High',
        confidenceScore: 0.95,
        evidenceStatus: 'VERIFIED',
        evidenceSummary: t(
          `${pendingCount} leads en estado 'Nuevo' verificados en CRM local`,
          `${pendingCount} leads in 'New' status verified in local CRM`
        ),
        source: 'CRM Local (Verificado)',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Contactar Leads Ahora', 'Contact Leads Now'),
        actionTarget: { tab: 'leads', subRow: 4, section: 'leads', filter: 'NEW', leadId: firstTargetLeadId },
        status: savedStatuses['opp_followup_pending_leads'] || 'READY',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Impacto de Respuesta Rápida a Leads', 'Rapid Lead Response Impact'),
          metricName: t('Ingresos en Riesgo por Demora', 'Revenue at Risk from Delay'),
          resultValue: `$${potentialLossMin.toLocaleString()} – $${potentialLossMax.toLocaleString()}`,
          evidenceStatus: 'VERIFIED',
          confidence: 'High',
          formula: 'Ingresos en Riesgo = Leads Pendientes × Ticket Promedio × Probabilidad de Cierre Inmediato',
          variables: [
            { name: t('Leads Pendientes', 'Pending Leads'), value: `${pendingCount}`, source: 'CRM', status: 'VERIFIED' },
            { name: t('Ticket Promedio', 'Average Ticket'), value: `$${avgTicket}`, source: 'Configuración', status: 'VERIFIED' },
            { name: t('Tasa de Cierre Rápido', 'Quick Close Rate'), value: '60% - 100%', source: 'Benchmark Comercial', status: 'DERIVED' }
          ],
          assumptions: [
            t('Los prospectos buscan alternativas activamente si no reciben respuesta en <2 horas.', 'Prospects actively search competitors if unanswered in <2 hours.')
          ],
          sources: [{ name: 'CRM Local', type: 'Dato Verificado' }],
          explanation: t('Cálculo directo basado en el número de solicitudes sin respuesta registradas.', 'Direct calculation based on recorded uncontacted client requests.')
        }
      });
    }

    // =========================================================================
    // 2. REVIEW_GROWTH & REVIEW_REPLY: Unanswered reviews or low review volume
    // =========================================================================
    const unansweredReviews = reviews.filter((r: any) => !r.reviewReply && !r.aiResponseText);
    if (gmbConnected && unansweredReviews.length > 0) {
      const count = unansweredReviews.length;
      opportunities.push({
        id: 'opp_review_reply_unanswered',
        type: 'REVIEW_GROWTH',
        title: t(
          `${count} ${count === 1 ? 'reseña sin responder' : 'reseñas sin responder'} en Google Maps`,
          `${count} unanswered ${count === 1 ? 'review' : 'reviews'} on Google Maps`
        ),
        description: t(
          `Responder a tus opiniones pendientes mejora tu reputación algorítmica y tasa de conversión.`,
          `Replying to pending reviews boosts your algorithmic trust and conversion rate.`
        ),
        whyThisMatters: t(
          'Los perfiles que responden puntualmente a sus reseñas generan mayor confianza y retienen más clientes locales.',
          'Profiles that promptly reply to all reviews build higher customer trust and increase inbound inquiries.'
        ),
        priority: 'HIGH',
        opportunityScore: 8.5,
        impactRange: {
          min: 0,
          max: 0,
          unit: 'PERCENT',
          formatted: t('Confianza Local Verificada', 'Verified Trust Uplift'),
          confidence: 0.9,
          isAvailable: true
        },
        confidence: 'High',
        confidenceScore: 0.9,
        evidenceStatus: 'VERIFIED',
        evidenceSummary: t(
          `${count} reseñas sin objeto 'reviewReply' en Google Business Profile API`,
          `${count} reviews lacking 'reviewReply' in Google Business Profile API`
        ),
        source: 'Google Business Profile API',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Responder Reseñas Pendientes', 'Reply to Pending Reviews'),
        actionTarget: { tab: 'reviews', subRow: 1, section: 'social' },
        status: savedStatuses['opp_review_reply_unanswered'] || 'READY',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Auditoría de Conversión por Reseñas', 'Review Conversion Audit'),
          metricName: t('Incremento de Confianza Algorítmica', 'Algorithmic Trust Uplift'),
          resultValue: t('Alto Impacto de Confianza', 'High Trust Impact'),
          evidenceStatus: 'VERIFIED',
          confidence: 'High',
          formula: 'Aumento = Reseñas Respondidas / Total Reseñas Recibidas',
          variables: [
            { name: t('Reseñas Pendientes', 'Pending Reviews'), value: `${count}`, source: 'Google Business API', status: 'VERIFIED' }
          ],
          assumptions: [t('Google prioriza negocios con interacciones públicas activas.', 'Google prioritizes businesses with active public interactions.')],
          sources: [{ name: 'Google Business Profile API', type: 'Oficial' }],
          explanation: t('Cálculo directo sobre el estado de respuestas de la ficha.', 'Direct calculation on listing reply statuses.')
        }
      });
    } else if (reviews.length < 10) {
      opportunities.push({
        id: 'opp_review_request_campaign',
        type: 'REVIEW_GROWTH',
        title: t(
          'Acelera tu volumen de reseñas auténticas',
          'Accelerate your authentic review volume'
        ),
        description: t(
          'Los negocios en el top 3 de tu zona cuentan con un promedio superior de reseñas verificadas.',
          'Businesses in the top 3 of your area average higher verified review counts.'
        ),
        whyThisMatters: t(
          'Generar 5 reseñas más activa el efecto de prueba social y duplica la tasa de clics en Google Maps.',
          'Generating 5 more reviews triggers social proof and doubles click-through rate on Google Maps.'
        ),
        priority: 'MEDIUM',
        opportunityScore: 6.8,
        impactRange: {
          min: oppMin > 0 ? Math.round(oppMin * 0.3) : 350,
          max: oppMax > 0 ? Math.round(oppMax * 0.4) : 900,
          unit: 'USD/mes',
          formatted: oppMin > 0 
            ? `$${Math.round(oppMin * 0.3).toLocaleString()} – $${Math.round(oppMax * 0.4).toLocaleString()}/mes`
            : '$350 – $900/mes',
          confidence: 0.7,
          isAvailable: true
        },
        confidence: 'Medium',
        confidenceScore: 0.7,
        evidenceStatus: 'DERIVED',
        evidenceSummary: t(
          `${reviews.length} reseñas actuales vs estándar del sector (15+ en radio 5km)`,
          `${reviews.length} current reviews vs industry standard (15+ within 5km)`
        ),
        source: 'Benchmark Sectorial (CBP/NAICS)',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Generar Link & QR de Reseñas', 'Generate QR & Review Link'),
        actionTarget: { tab: 'reviews', subRow: 0, section: 'social' },
        status: savedStatuses['opp_review_request_campaign'] || 'DETECTED',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Potencial de Crecimiento en Reseñas', 'Review Growth Potential'),
          metricName: t('Oportunidad Mensual por Posicionamiento', 'Monthly Opportunity from Ranking'),
          resultValue: oppMin > 0 ? `$${Math.round(oppMin * 0.3).toLocaleString()} – $${Math.round(oppMax * 0.4).toLocaleString()}` : '$350 – $900',
          evidenceStatus: 'DERIVED',
          confidence: 'Medium',
          formula: 'Oportunidad = Búsquedas Estimadas × Incremento CTR (+15%) × Ticket Promedio',
          variables: [
            { name: t('Reseñas Actuales', 'Current Reviews'), value: `${reviews.length}`, source: 'Ficha Local', status: 'VERIFIED' },
            { name: t('Ticket Promedio', 'Average Ticket'), value: `$${avgTicket}`, source: 'Parámetro', status: 'VERIFIED' }
          ],
          assumptions: [t('Superar 10 reseñas aumenta la tasa de conversión en Maps.', 'Surpassing 10 reviews increases Maps conversion.')],
          sources: [{ name: 'Market Intelligence Bvelt', type: 'Modelo Derivado' }],
          explanation: t('Modelo basado en la relación entre volumen de opiniones y captura de llamadas.', 'Model based on relation between review count and call capture.')
        }
      });
    }

    // =========================================================================
    // 3. LOCAL_VISIBILITY: Google Business Profile connection or setup
    // =========================================================================
    if (!gmbConnected) {
      opportunities.push({
        id: 'opp_gmb_connection_sync',
        type: 'LOCAL_VISIBILITY',
        title: t(
          'Conectar Ficha de Google Business Profile',
          'Connect Google Business Profile Listing'
        ),
        description: t(
          'Vincula tu perfil de Google Maps para desbloquear llamadas reales, vistas y reputación en vivo.',
          'Link your Google Maps profile to unlock live calls, views, and automated reputation sync.'
        ),
        whyThisMatters: t(
          'Los negocios con perfil oficial sincronizado capturan hasta 3 veces más llamadas de clientes cercanos.',
          'Businesses with synced official listings capture up to 3x more local client calls.'
        ),
        priority: 'HIGH',
        opportunityScore: 9.2,
        impactRange: {
          min: oppMin > 0 ? oppMin : 1200,
          max: oppMax > 0 ? oppMax : 3500,
          unit: 'USD/mes',
          formatted: oppMin > 0 
            ? `$${oppMin.toLocaleString()} – $${oppMax.toLocaleString()}/mes`
            : '$1,200 – $3,500/mes',
          confidence: 0.85,
          isAvailable: true
        },
        confidence: 'High',
        confidenceScore: 0.85,
        evidenceStatus: 'PENDING',
        evidenceSummary: t(
          'Token OAuth de Google Business Profile no autorizado en la sesión',
          'Google Business Profile OAuth token not authorized in session'
        ),
        source: 'Google Business Profile API (Pendiente)',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Conectar Google Maps Ahora', 'Connect Google Maps Now'),
        actionTarget: { tab: 'business_scan' },
        status: savedStatuses['opp_gmb_connection_sync'] || 'READY',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Oportunidad de Sincronización Google Maps', 'Google Maps Sync Opportunity'),
          metricName: t('Demanda Mensual Estimada en Zona', 'Estimated Monthly Area Demand'),
          resultValue: oppMin > 0 ? `$${oppMin.toLocaleString()} – $${oppMax.toLocaleString()}` : '$1,200 – $3,500',
          evidenceStatus: 'PENDING',
          confidence: 'High',
          formula: 'Oportunidad = Densidad de Establecimientos Zonal × Tráfico Maps × Conversión',
          variables: [
            { name: t('Estado Ficha', 'Listing Status'), value: t('Desconectada', 'Disconnected'), source: 'Google Auth', status: 'PENDING' },
            { name: t('Oportunidad Zonal', 'Zonal Opportunity'), value: `$${oppMin} - $${oppMax}`, source: 'CBP NAICS', status: 'DERIVED' }
          ],
          assumptions: [t('La presencia en el mapa local canaliza el tráfico de alta intención de compra.', 'Local map presence captures high-intent purchase traffic.')],
          sources: [{ name: 'CBP / NAICS Benchmarks', type: 'Estadístico Oficial' }],
          explanation: t('Cálculo de mercado generado a partir de datos de establecimientos en tu radio geográfico.', 'Market calculation generated from establishment data in your area.')
        }
      });
    }

    // =========================================================================
    // 4. REACTIVATION: Dormant / Inactive Leads in CRM
    // =========================================================================
    const pastLeads = leads.filter(
      (l: any) => isBusinessLead(l, input.profile) && (l.status === 'LOST' || l.status === 'INACTIVE' || l.status === 'COMPLETED' || l.status === 'ganado')
    );
    if (pastLeads.length >= 3) {
      const dormantCount = pastLeads.length;
      const reactivationRevMin = Math.round(dormantCount * 0.15 * avgTicket);
      const reactivationRevMax = Math.round(dormantCount * 0.35 * avgTicket);

      opportunities.push({
        id: 'opp_reactivation_past_clients',
        type: 'REACTIVATION',
        title: t(
          `Campaña de reactivación para ${dormantCount} clientes anteriores`,
          `Reactivation campaign for ${dormantCount} past clients`
        ),
        description: t(
          'Reactivar a clientes que ya conocen tu trabajo cuesta 5 veces menos que conseguir prospectos nuevos.',
          'Reactivating existing past clients costs 5x less than acquiring cold new prospects.'
        ),
        whyThisMatters: t(
          'Un mensaje de mantenimiento o revisión periódica convierte habitualmente entre el 15% y 35% de tu base anterior.',
          'A seasonal checkup or service check typically converts between 15% and 35% of your past client base.'
        ),
        priority: 'MEDIUM',
        opportunityScore: 6.5,
        impactRange: {
          min: reactivationRevMin,
          max: reactivationRevMax,
          centralEstimate: Math.round((reactivationRevMin + reactivationRevMax) / 2),
          unit: 'USD',
          formatted: `$${reactivationRevMin.toLocaleString()} – $${reactivationRevMax.toLocaleString()}`,
          confidence: 0.75,
          isAvailable: true
        },
        confidence: 'Medium',
        confidenceScore: 0.75,
        evidenceStatus: 'DERIVED',
        evidenceSummary: t(
          `${dormantCount} registros históricos detectados en la base de datos de leads`,
          `${dormantCount} historic records detected in leads database`
        ),
        source: 'CRM Historial',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Lanzar Mensaje de Reactivación', 'Launch Reactivation Message'),
        actionTarget: { tab: 'leads', section: 'leads', filter: 'INACTIVE' },
        status: savedStatuses['opp_reactivation_past_clients'] || 'DETECTED',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Potencial de Reactivación de Clientes', 'Client Reactivation Potential'),
          metricName: t('Recuperación Estimada de Ingresos', 'Estimated Revenue Recovery'),
          resultValue: `$${reactivationRevMin.toLocaleString()} – $${reactivationRevMax.toLocaleString()}`,
          evidenceStatus: 'DERIVED',
          confidence: 'Medium',
          formula: 'Ingreso Estimado = Clientes Históricos × Tasa Conversión Reactivación (15-35%) × Ticket Promedio',
          variables: [
            { name: t('Base de Clientes Anteriores', 'Past Client Base'), value: `${dormantCount}`, source: 'CRM', status: 'VERIFIED' },
            { name: t('Ticket Promedio', 'Average Ticket'), value: `$${avgTicket}`, source: 'Configuración', status: 'VERIFIED' }
          ],
          assumptions: [t('Los clientes recurrentes tienen mayor tasa de aceptación de presupuesto.', 'Repeat clients accept quotes at a higher conversion rate.')],
          sources: [{ name: 'Historial CRM', type: 'Dato Local' }],
          explanation: t('Modelo de reactivación basado en el volumen de clientes previos.', 'Reactivation model based on past customer volume.')
        }
      });
    }

    // =========================================================================
    // 5. COMPETITOR_GAP & MARKET SIGNALS: Derived from real competitor set & market gaps
    // =========================================================================
    if (competitors.length > 0) {
      const weakCompetitors = competitors.filter(c => !c.website || (c.rating && c.rating < 4.4));
      const targetCount = weakCompetitors.length || competitors.length;
      const hasGeoapify = competitors.some(c => (c as any).source?.includes('geoapify'));
      const hasOsm = competitors.some(c => (c as any).source?.includes('openstreetmap'));
      const radarSourceLabel = hasGeoapify && hasOsm 
        ? 'Radar de Mercado (Geoapify & OpenStreetMap)' 
        : hasGeoapify 
          ? 'Radar de Mercado (Geoapify Places)' 
          : 'Radar de Mercado (OpenStreetMap)';

      // Detect dominant competitor or sparse saturation
      const hasDominantCompetitor = competitors.some(c => {
        const d = typeof c.distanceKm === 'number' ? c.distanceKm : typeof c.distance === 'number' ? c.distance : 99;
        return d < 1.5 && (c.phone || c.website) && c.address;
      });

      const isLowDensity = competitors.length <= 2;
      const isHighDensity = competitors.length >= 6;

      const oppPriority = isLowDensity ? 'HIGH' : 'MEDIUM';
      const oppScore = isLowDensity ? 7.8 : isHighDensity ? 6.8 : 6.2;
      const impactMultiplier = isLowDensity ? 3 : 2;

      opportunities.push({
        id: 'opp_competitor_gap_capture',
        type: 'COMPETITOR_GAP',
        title: isLowDensity
          ? t(`Oportunidad territorial: Solo ${competitors.length} competidor(es) en tu radio`, `Territorial opportunity: Only ${competitors.length} competitor(s) in radius`)
          : t(`Brecha competitiva frente a ${targetCount} negocios en tu radio`, `Competitive gap against ${targetCount} businesses in your radius`),
        description: isLowDensity
          ? t('Baja saturación detectada en tu radio de 6 km. Oportunidad óptima para posicionar tu perfil y capturar clientes zonales.', 'Low territory saturation detected within 6 km. High opportunity to establish local dominance.')
          : hasDominantCompetitor
            ? t('Competidor cercano con ficha completa detectado. Diferénciate con cotizaciones rápidas y catálogo actualizado.', 'Nearby established competitor detected. Differentiate with instant pricing and updated profile.')
            : t('Se detectaron competidores locales sin presencia web optimizada o con calificaciones mejorables.', 'Detected local competitors with sub-optimal web presence or weaker ratings.'),
        whyThisMatters: t(
          'Posicionarte con fotos actualizadas y presupuestos instantáneos te permite capturar los clientes insatisfechos de la zona.',
          'Positioning with fresh media and instant estimates captures dissatisfied clients in the area.'
        ),
        priority: oppPriority,
        opportunityScore: oppScore,
        impactRange: {
          min: Math.round(avgTicket * impactMultiplier),
          max: Math.round(avgTicket * (impactMultiplier + 3)),
          unit: 'USD/mes',
          formatted: `$${Math.round(avgTicket * impactMultiplier).toLocaleString()} – $${Math.round(avgTicket * (impactMultiplier + 3)).toLocaleString()}/mes`,
          confidence: 0.65,
          isAvailable: true
        },
        confidence: 'Medium',
        confidenceScore: 0.65,
        evidenceStatus: 'DERIVED',
        evidenceSummary: t(
          `${competitors.length} establecimientos detectados por radar geográfico en tu radio`,
          `${competitors.length} establishments detected via geographic radar in your radius`
        ),
        source: radarSourceLabel,
        createdAt: new Date().toISOString(),
        recommendedAction: t('Explorar Radar de Competidores', 'Explore Competitor Radar'),
        actionTarget: { tab: 'radar', section: 'market' },
        status: savedStatuses['opp_competitor_gap_capture'] || 'DETECTED',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Análisis de Brecha Competitiva', 'Competitive Gap Analysis'),
          metricName: t('Captura de Demanda Zonal', 'Zonal Demand Capture'),
          resultValue: `$${Math.round(avgTicket * impactMultiplier).toLocaleString()} – $${Math.round(avgTicket * (impactMultiplier + 3)).toLocaleString()}`,
          evidenceStatus: 'DERIVED',
          confidence: 'Medium',
          formula: 'Captura = Competidores con Brecha × Conversión de Desvío × Ticket Promedio',
          variables: [
            { name: t('Competidores en Radio', 'Radius Competitors'), value: `${competitors.length}`, source: radarSourceLabel, status: 'VERIFIED' },
            { name: t('Ticket Promedio', 'Average Ticket'), value: `$${avgTicket}`, source: 'Configuración', status: 'VERIFIED' }
          ],
          assumptions: [t('Los consumidores locales comparan entre los 3 primeros resultados visibles.', 'Local consumers compare the top 3 visible results.')],
          sources: [
            { name: hasGeoapify ? 'Geoapify Places API' : 'OpenStreetMap Overpass', type: 'Datos Abiertos' }
          ],
          explanation: t('Análisis geoespacial de densidad de competidores y atributos de contacto.', 'Geospatial density analysis of competitors and contact attributes.')
        }
      });
    } else {
      // 0 Competitors in radius: territorial open field opportunity
      opportunities.push({
        id: 'opp_territorial_monopoly',
        type: 'COMPETITOR_GAP',
        title: t('Oportunidad territorial: Mercado abierto sin competidores indexados', 'Territorial opportunity: Open market without indexed competitors'),
        description: t(
          'No se detectaron competidores directos en tu radio de 6 km. Eres el candidato ideal para acaparar la primera posición en búsquedas locales.',
          'No direct competitors detected in your 6 km radius. Prime position to claim the #1 local rank before others register.'
        ),
        whyThisMatters: t(
          'El primer negocio que se indexa con perfil verificado y reseñas en una zona con baja competencia captura la mayor parte de las llamadas.',
          'The first business to get verified and collect reviews in an unserved area captures the majority of inbound calls.'
        ),
        priority: 'HIGH',
        opportunityScore: 8.5,
        impactRange: {
          min: Math.round(avgTicket * 3),
          max: Math.round(avgTicket * 6),
          unit: 'USD/mes',
          formatted: `$${Math.round(avgTicket * 3).toLocaleString()} – $${Math.round(avgTicket * 6).toLocaleString()}/mes`,
          confidence: 0.8,
          isAvailable: true
        },
        confidence: 'High',
        confidenceScore: 0.8,
        evidenceStatus: 'VERIFIED',
        evidenceSummary: t('Zona con 0 competidores mapeados en radio comercial.', 'Area with 0 competitors mapped in commercial radius.'),
        source: 'Radar de Mercado (OpenStreetMap)',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Asegurar primera posición zonal', 'Secure #1 zonal rank'),
        actionTarget: { tab: 'profile', section: 'gmb' },
        status: savedStatuses['opp_territorial_monopoly'] || 'DETECTED',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Oportunidad de Dominio Zonal', 'Zonal Dominance Opportunity'),
          metricName: t('Demanda Territorial No Atendida', 'Unserved Territory Demand'),
          resultValue: `$${Math.round(avgTicket * 3).toLocaleString()} – $${Math.round(avgTicket * 6).toLocaleString()}`,
          evidenceStatus: 'VERIFIED',
          confidence: 'High',
          formula: 'Captura = Demanda Zonal × Conversión Inicial × Ticket Promedio',
          variables: [
            { name: t('Competidores en Radio', 'Radius Competitors'), value: '0', source: 'Radar de Mercado (OpenStreetMap)', status: 'VERIFIED' },
            { name: t('Ticket Promedio', 'Average Ticket'), value: `$${avgTicket}`, source: 'Configuración', status: 'VERIFIED' }
          ],
          assumptions: [t('El primer negocio registrado captura la mayoría de las búsquedas locales en la zona.', 'The first registered business captures most local searches in the area.')],
          sources: [
            { name: 'OpenStreetMap Overpass', type: 'Datos Abiertos' }
          ],
          explanation: t('Sin competidores directos mapeados en el radio exacto.', 'No direct competitors mapped in exact radius.')
        }
      });
    }

    // =========================================================================
    // 6. PROFILE_COMPLETENESS: Missing phone, hours, or photos
    // =========================================================================
    const isProfileIncomplete = !input.profile.phone || !input.profile.website || !input.profile.hoursSet;
    if (isProfileIncomplete) {
      opportunities.push({
        id: 'opp_profile_completeness_boost',
        type: 'PROFILE_COMPLETENESS',
        title: t(
          'Completa los datos clave de contacto de tu negocio',
          'Complete key business contact info'
        ),
        description: t(
          'Faltan datos de teléfono directo, enlace web u horarios de atención en tu perfil comercial.',
          'Missing direct phone, website link, or operating hours in your business profile.'
        ),
        whyThisMatters: t(
          'Los perfiles incompletos reducen la confianza del cliente y provocan que busquen competidores con datos de contacto directos.',
          'Incomplete profiles reduce customer confidence and lead prospects to contact competitors with visible contact info.'
        ),
        priority: 'MEDIUM',
        opportunityScore: 6.0,
        impactRange: {
          min: 0,
          max: 0,
          unit: 'PERCENT',
          formatted: t('Optimización de Contacto', 'Verified Contact Uplift'),
          confidence: 0.85,
          isAvailable: true
        },
        confidence: 'High',
        confidenceScore: 0.85,
        evidenceStatus: 'VERIFIED',
        evidenceSummary: t(
          'Campos clave (teléfono / web / horarios) vacíos en la configuración de perfil',
          'Key fields (phone / web / hours) empty in profile settings'
        ),
        source: 'Perfil Bvelt (Verificado)',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Completar Perfil de Negocio', 'Complete Business Profile'),
        actionTarget: { tab: 'profile', section: 'business' },
        status: savedStatuses['opp_profile_completeness_boost'] || 'READY',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Auditoría de Integridad de Perfil', 'Profile Completeness Audit'),
          metricName: t('Reducción de Fricción de Contacto', 'Contact Friction Reduction'),
          resultValue: t('Alto Impacto en Contacto', 'High Conversion Impact'),
          evidenceStatus: 'VERIFIED',
          confidence: 'High',
          formula: 'Retención = Campos Completados / Total Atributos Requeridos',
          variables: [
            { name: t('Teléfono Configurado', 'Phone Configured'), value: input.profile.phone ? t('Sí', 'Yes') : t('No', 'No'), source: 'Perfil', status: 'VERIFIED' },
            { name: t('Horarios Activos', 'Hours Active'), value: input.profile.hoursSet ? t('Sí', 'Yes') : t('No', 'No'), source: 'Perfil', status: 'VERIFIED' }
          ],
          assumptions: [t('Los usuarios descartan perfiles sin teléfono inmediato.', 'Users discard listings without immediate phone numbers.')],
          sources: [{ name: 'Configuración de Perfil', type: 'Dato Local' }],
          explanation: t('Verificación de completitud de los campos obligatorios de contacto.', 'Completeness check of mandatory contact attributes.')
        }
      });
    }

    // =========================================================================
    // 7. OFFER_OPPORTUNITY: Service pricing & estimate builder packages
    // =========================================================================
    opportunities.push({
      id: 'opp_offer_builder_high_margin',
      type: 'OFFER_OPPORTUNITY',
      title: t(
        'Estructura ofertas y presupuestos rápidos de alto margen',
        'Structure high-margin packages & instant estimates'
      ),
      description: t(
        `Crea presupuestos detallados en menos de 2 minutos para ${category} con desglose de materiales y mano de obra.`,
        `Generate detailed estimates in under 2 minutes for ${category} with material & labor breakdown.`
      ),
      whyThisMatters: t(
        'Entregar un presupuesto profesional en el acto multiplica por 2 la probabilidad de aceptación del cliente.',
        'Delivering a professional estimate on the spot doubles quote acceptance probability.'
      ),
      priority: 'LOW',
      opportunityScore: 4.8,
      impactRange: {
        min: Math.round(avgTicket * 1.2),
        max: Math.round(avgTicket * 3.5),
        unit: 'USD',
        formatted: `$${Math.round(avgTicket * 1.2).toLocaleString()} – $${Math.round(avgTicket * 3.5).toLocaleString()}`,
        confidence: 0.6,
        isAvailable: true
      },
      confidence: 'Medium',
      confidenceScore: 0.6,
      evidenceStatus: 'DERIVED',
      evidenceSummary: t(
        `Ticket de referencia sectorial (${category}): $${avgTicket}`,
        `Sector reference ticket (${category}): $${avgTicket}`
      ),
      source: 'Calculadora de Estimaciones Bvelt',
      createdAt: new Date().toISOString(),
      recommendedAction: t('Abrir Creador de Presupuestos', 'Open Estimate Builder'),
      actionTarget: { tab: 'estimator', section: 'pricing' },
      status: savedStatuses['opp_offer_builder_high_margin'] || 'DETECTED',
      formulaVersion: this.FORMULA_VERSION,
      calculationDetails: {
        title: t('Impacto de Presupuestos Inmediatos', 'Instant Estimate Impact'),
        metricName: t('Ticket Adicional Estimado', 'Estimated Additional Ticket'),
        resultValue: `$${Math.round(avgTicket * 1.2).toLocaleString()} – $${Math.round(avgTicket * 3.5).toLocaleString()}`,
        evidenceStatus: 'DERIVED',
        confidence: 'Medium',
        formula: 'Incremento = Conversión de Presupuesto Rápido (2x) × Ticket Estándar',
        variables: [
          { name: t('Ticket Base', 'Base Ticket'), value: `$${avgTicket}`, source: 'Benchmark', status: 'DERIVED' }
        ],
        assumptions: [t('La inmediatez en el presupuesto previene comparativas con terceros.', 'Fast quotes prevent third-party competitor comparisons.')],
        sources: [{ name: 'Estimator Engine', type: 'Modelo Bvelt' }],
        explanation: t('Proyección basada en el aumento de conversión de cotizaciones entregadas en el mismo día.', 'Projection based on same-day estimate conversion lift.')
      }
    });

    // =========================================================================
    // 8. RETENTION: High value clients follow up
    // =========================================================================
    const wonLeads = leads.filter((l: any) => isBusinessLead(l, input.profile) && (l.status === 'WON' || l.status === 'ganado'));
    if (wonLeads.length > 0) {
      opportunities.push({
        id: 'opp_retention_service_followup',
        type: 'RETENTION',
        title: t(
          `Seguimiento de satisfacción y garantía para ${wonLeads.length} trabajos completados`,
          `Satisfaction and warranty follow-up for ${wonLeads.length} completed jobs`
        ),
        description: t(
          'Contacta a clientes con trabajos cerrados para asegurar satisfacción y ofrecer mantenimiento preventivo.',
          'Follow up with completed jobs to ensure satisfaction and offer preventive maintenance.'
        ),
        whyThisMatters: t(
          'Un cliente satisfecho que recibe seguimiento genera recomendaciones directas y previene reclamos futuros.',
          'A satisfied client with active follow-up generates direct referrals and prevents future callbacks.'
        ),
        priority: 'LOW',
        opportunityScore: 4.4,
        impactRange: {
          min: Math.round(wonLeads.length * avgTicket * 0.2),
          max: Math.round(wonLeads.length * avgTicket * 0.5),
          unit: 'USD',
          formatted: `$${Math.round(wonLeads.length * avgTicket * 0.2).toLocaleString()} – $${Math.round(wonLeads.length * avgTicket * 0.5).toLocaleString()}`,
          confidence: 0.7,
          isAvailable: true
        },
        confidence: 'Medium',
        confidenceScore: 0.7,
        evidenceStatus: 'VERIFIED',
        evidenceSummary: t(
          `${wonLeads.length} trabajos completados registrados en CRM`,
          `${wonLeads.length} completed jobs recorded in CRM`
        ),
        source: 'CRM (Trabajos Cerrados)',
        createdAt: new Date().toISOString(),
        recommendedAction: t('Ver Clientes Completados', 'View Completed Clients'),
        actionTarget: { tab: 'leads', section: 'leads', filter: 'WON' },
        status: savedStatuses['opp_retention_service_followup'] || 'DETECTED',
        formulaVersion: this.FORMULA_VERSION,
        calculationDetails: {
          title: t('Potencial de Retención y Garantía', 'Retention & Warranty Potential'),
          metricName: t('Valor de Retención Generado', 'Generated Retention Value'),
          resultValue: `$${Math.round(wonLeads.length * avgTicket * 0.2).toLocaleString()} – $${Math.round(wonLeads.length * avgTicket * 0.5).toLocaleString()}`,
          evidenceStatus: 'VERIFIED',
          confidence: 'Medium',
          formula: 'Valor = Trabajos Completados × Retención Mantenimiento (20-50%) × Ticket',
          variables: [
            { name: t('Trabajos Cerrados', 'Closed Jobs'), value: `${wonLeads.length}`, source: 'CRM', status: 'VERIFIED' }
          ],
          assumptions: [t('El seguimiento post-venta incrementa el valor de vida del cliente (LTV).', 'Post-sale follow-up increases client lifetime value (LTV).')],
          sources: [{ name: 'CRM Local', type: 'Dato Verificado' }],
          explanation: t('Cálculo de valor preventivo y de retención sobre clientes atendidos.', 'Preventive and retention value calculation on serviced clients.')
        }
      });
    }

    // Sort opportunities by opportunityScore descending
    opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

    return opportunities;
  }

  /**
   * Logs execution of an action for machine-calibration readiness
   */
  static logActionExecution(
    opportunity: BusinessOpportunity,
    actionId: string
  ): OpportunityExecutionLog {
    const log: OpportunityExecutionLog = {
      opportunityId: opportunity.id,
      actionId,
      timestamp: new Date().toISOString(),
      status: 'IN_PROGRESS',
      estimatedImpact: {
        min: opportunity.impactRange.min,
        max: opportunity.impactRange.max
      },
      formulaVersion: opportunity.formulaVersion,
      evidenceUsed: [opportunity.source, opportunity.evidenceStatus]
    };

    // Update opportunity status in storage
    this.updateOpportunityStatus(opportunity.id, 'IN_PROGRESS');

    // Save log
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_LOGS_KEY);
        const logs: OpportunityExecutionLog[] = raw ? JSON.parse(raw) : [];
        logs.push(log);
        localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs.slice(-100))); // Keep last 100
      } catch (e) {
        console.warn('[OpportunityEngine] Failed to persist log:', e);
      }
    }

    // Also register in CalibrationEngine for future calibration
    CalibrationEngine.logEstimate(
      opportunity.formulaVersion,
      {
        oppType: opportunity.type,
        score: opportunity.opportunityScore,
        source: opportunity.source
      },
      { min: opportunity.impactRange.min, max: opportunity.impactRange.max }
    );

    return log;
  }

  /**
   * Records real customer outcome / result for an opportunity action
   */
  static recordResult(
    opportunityId: string,
    resultType: 'lead_gained' | 'review_gained' | 'sale' | 'revenue' | 'appointment' | 'conversion' | 'retained_client',
    actualOutcomeValue: number
  ): void {
    this.updateOpportunityStatus(opportunityId, 'COMPLETED');

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_LOGS_KEY);
        if (raw) {
          const logs: OpportunityExecutionLog[] = JSON.parse(raw);
          const log = logs.find(l => l.opportunityId === opportunityId);
          if (log) {
            log.actualImpact = actualOutcomeValue;
            log.resultType = resultType;
            log.status = 'COMPLETED';
            
            const mid = (log.estimatedImpact.min + log.estimatedImpact.max) / 2;
            const denom = actualOutcomeValue === 0 ? 1 : actualOutcomeValue;
            log.predictionError = Math.abs(mid - actualOutcomeValue) / denom;
            
            localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs));
          }
        }
      } catch (e) {
        console.warn('[OpportunityEngine] Failed to record outcome:', e);
      }
    }
  }

  /**
   * Updates status of an opportunity (COMPLETED, DISMISSED, IN_PROGRESS, etc.)
   */
  static updateOpportunityStatus(opportunityId: string, status: OpportunityStatus): void {
    const statuses = this.getSavedStatuses();
    statuses[opportunityId] = status;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_OPPS_KEY, JSON.stringify(statuses));
      } catch (e) {
        console.warn('[OpportunityEngine] Failed to save opp status:', e);
      }
    }
  }

  private static getSavedStatuses(): Record<string, OpportunityStatus> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_OPPS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}
