/**
 * ActionEngine for Bvelt
 * Centralized commercial execution layer that transforms detected opportunities
 * into direct, contextual, and trackable commercial actions with conversion outcomes.
 * 
 * Pipeline:
 * SIGNAL / DATA -> OPPORTUNITY -> PRIORITY -> ACTION -> DIRECT EXECUTION -> OUTCOME -> BUSINESS MEMORY
 */

import { BusinessOpportunity, ActionTarget, OpportunityType } from './opportunityEngine';
import { isBusinessLead, isLeadInServiceArea } from '../../lib/navigation/routeToAnswerLeads';
import { CalculationDetails } from '../../components/dashboard/CalculationModal';
import { EvidenceStatus } from '../../lib/bveltEvidence';
import { LeadQualityEngine } from './leadQualityEngine';
import { recordHistoricalArbitrageEvent } from '../memory/bemStore';
import { createEntityIdentity } from '../memory/entityIdentity';
import { BusinessDnaService } from '../memory/businessDnaService';
import { ReviewComplianceFirewall } from '../memory/reviewComplianceFirewall';
import { auth } from '../../lib/firebase';
import {
  AutonomyPolicyEngine,
  AUTONOMY_LEVEL_NAMES
} from './autonomyPolicy';
import type {
  AutonomyLevel,
  AutonomyPolicy,
  ActionEngineToolId,
  PolicyDecision
} from './autonomyPolicy';
import {
  ActionToolCatalog
} from './actionToolCatalog';
import type {
  ToolExecutionReport,
  ExecutionOptions,
  DraftLeadFollowUpInput,
  DraftLeadFollowUpOutput,
  RequestReviewAfterCompletedJobInput,
  RequestReviewAfterCompletedJobOutput,
  DraftReviewResponseInput,
  DraftReviewResponseOutput,
  CreateEstimateFollowUpInput,
  CreateEstimateFollowUpOutput
} from './actionToolCatalog';
import {
  OutcomeLedgerService
} from '../memory/outcomeLedgerService';
import type {
  OutcomeLedgerEntry,
  ActionExecutionState
} from '../memory/outcomeLedgerService';
import { ResilientExecutionEngine } from './resilientExecution';

export {
  AutonomyPolicyEngine,
  AUTONOMY_LEVEL_NAMES,
  ActionToolCatalog,
  OutcomeLedgerService,
  ResilientExecutionEngine
};

export type {
  AutonomyLevel,
  AutonomyPolicy,
  ActionEngineToolId,
  PolicyDecision,
  ToolExecutionReport,
  ExecutionOptions,
  DraftLeadFollowUpInput,
  DraftLeadFollowUpOutput,
  RequestReviewAfterCompletedJobInput,
  RequestReviewAfterCompletedJobOutput,
  DraftReviewResponseInput,
  DraftReviewResponseOutput,
  CreateEstimateFollowUpInput,
  CreateEstimateFollowUpOutput,
  OutcomeLedgerEntry,
  ActionExecutionState
};

export type ActionType =
  | 'OUTREACH'
  | 'FOLLOW_UP'
  | 'REVIEW_REQUEST'
  | 'REPLY_REVIEWS'
  | 'PROFILE_OPTIMIZATION'
  | 'PITCH_GENERATION'
  | 'REACTIVATION'
  | 'LOCAL_AUDIT'
  | 'POST_CREATOR'
  | 'ESTIMATOR';

export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';

export type ActionOutcomeType = 
  | 'CONTACTED' 
  | 'REPLIED' 
  | 'SCHEDULED' 
  | 'ESTIMATE_SENT' 
  | 'WON' 
  | 'LOST' 
  | 'DISMISSED';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'WON' | 'LOST';

export interface QuoteLineItem {
  id?: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface CommercialQuoteRecord {
  id: string;
  leadId?: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  opportunityId?: string;
  actionId?: string;
  title: string;
  category?: string;
  location?: string;
  items: QuoteLineItem[];
  subtotal: number;
  tax?: number;
  totalAmount: number;
  isPriceRange?: boolean;
  priceRange?: { min: number; max: number };
  status: QuoteStatus;
  notes?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  confirmedRevenue?: number;
}

export type NextBestActionDestinationCode =
  | 'CONTACT_LEAD'
  | 'FOLLOW_UP'
  | 'SEND_QUOTE'
  | 'REQUEST_REVIEW'
  | 'FIND_LOCAL_LEADS'
  | 'VIEW_COMPETITOR'
  | 'COMPLETE_PROFILE'
  | 'REACTIVATE_CLIENT'
  | 'OPEN_MAP'
  | 'OPTIMIZE_AI_PRESENCE'
  | 'MAINTAIN_AI_LEAD';

export interface BveltMoment {
  whatIsHappening: string;
  whyItMatters: string;
  opportunitySummary: string;
  recommendedActionNow: string;
  evidenceStatus: EvidenceStatus;
  evidenceSource: string;
}

export interface NextBestAction {
  id: string;
  action: string;
  title?: string;
  priority: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
  reason: string;
  reasoning?: string;
  expectedBenefit: string;
  whyNow: string;
  evidence: string;
  evidenceLevel: EvidenceStatus;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedTime: string;
  estimatedMinutes?: number;
  destinationCode: NextBestActionDestinationCode;
  destination: ActionTarget;
  ctaLabel: string;
  contextData?: {
    leadId?: string;
    leadName?: string;
    phone?: string;
    email?: string;
    amount?: number;
    quoteId?: string;
    mapUrl?: string;
    city?: string;
    niche?: string;
    competitorName?: string;
    [key: string]: any;
  };
  bveltMoment?: BveltMoment;
}

export interface NextBestActionRecommendation {
  actionCode: 
    | 'CONTACT_TODAY' 
    | 'FOLLOW_UP' 
    | 'SEND_QUOTE' 
    | 'REQUEST_REVIEW' 
    | 'REACTIVATE_CLIENT' 
    | 'COMPLETE_PROFILE' 
    | 'CHECK_COMPETITOR' 
    | 'WAIT_FOR_RESPONSE';
  label: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  estimatedTime: string;
  evidence: string;
  destination: ActionTarget;
}

export interface ActionOutreachPackage {
  whatsappMessage: string;
  whatsappUrl?: string;
  smsMessage: string;
  emailSubject: string;
  emailBody: string;
  emailUrl?: string;
  callScript: string;
  followUpNote: string;
}

export interface ActionOutcomeRecord {
  outcomeType: ActionOutcomeType;
  revenueRecorded: number;
  contactMethod?: 'whatsapp' | 'call' | 'email' | 'in_person' | 'sms' | 'other';
  notes?: string;
  recordedAt: string;
}

export interface ActionContext {
  businessName?: string;
  category?: string;
  location?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  rating?: number | string;
  leadId?: string;
  leadStatus?: string;
  specificIssue?: string;
  avgTicketUsd?: number;
}

export interface ActionDefinition {
  id: string;
  opportunityId: string;
  title: string;
  description: string;
  whyThisMatters: string;
  whyNow: string;
  actionType: ActionType;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  impactFormatted: string;
  destination: ActionTarget;
  status: ActionStatus;
  context: ActionContext;
  outreach: ActionOutreachPackage;
  outcome?: ActionOutcomeRecord;
  createdAt: string;
  updatedAt: string;
  calculationDetails?: CalculationDetails;
  category?: string;
  estimatedMinutes?: number;
  source?: string;
  measurementStatus?: string;
  resultType?: string;
  resultValue?: string;
}

export interface CommercialConversionRecord {
  id: string;
  actionId: string;
  opportunityId: string;
  actionType: ActionType;
  title: string;
  outcomeType: ActionOutcomeType;
  revenue: number;
  contactMethod?: string;
  notes?: string;
  timestamp: string;
}

export interface ConversionFunnelMetrics {
  opportunitiesDetected: number;
  actionsExecuted: number;
  contactsMade: number;
  repliesReceived: number;
  quotesSent: number;
  dealsWon: number;
  revenueRecorded: number;
  conversionRate: number | null; // percentage (0-100) or null if no contacts made
  avgTicket: number | null; // average ticket value or null if no deals won
}

const STORAGE_ACTIONS_KEY = 'bvelt_commercial_actions_v1';
const STORAGE_CONVERSIONS_KEY = 'bvelt_conversion_records_v1';
const STORAGE_QUOTES_KEY = 'bvelt_quotes_v1';

export class ActionEngine {
  /**
   * Translates an OpportunityType into a concrete ActionType
   */
  static getActionTypeFromOpportunity(oppType: OpportunityType): ActionType {
    switch (oppType) {
      case 'FOLLOW_UP':
      case 'LEAD_CAPTURE':
        return 'OUTREACH';
      case 'REVIEW_GROWTH':
        return 'REVIEW_REQUEST';
      case 'REACTIVATION':
        return 'REACTIVATION';
      case 'COMPETITOR_GAP':
      case 'LOCAL_VISIBILITY':
        return 'LOCAL_AUDIT';
      case 'PROFILE_COMPLETENESS':
        return 'PROFILE_OPTIMIZATION';
      case 'OFFER_OPPORTUNITY':
        return 'POST_CREATOR';
      default:
        return 'OUTREACH';
    }
  }

  /**
   * Generates highly tailored, context-preserving commercial outreach templates
   * across multiple communication channels (WhatsApp, SMS, Email, Call Script).
   */
  static generateOutreach(
    actionType: ActionType,
    context: ActionContext,
    lang: 'es' | 'en' = 'es'
  ): ActionOutreachPackage {
    const isEn = lang === 'en';
    const biz = context.businessName || (isEn ? 'your local business' : 'tu negocio');
    const cat = context.category || (isEn ? 'local services' : 'servicios locales');
    const loc = context.location || (isEn ? 'your local area' : 'tu zona local');
    const contact = context.contactName || (isEn ? 'there' : 'amigo/a');
    const phoneClean = context.phone ? context.phone.replace(/[^0-9+]/g, '') : '';

    let whatsapp = '';
    let sms = '';
    let emailSubject = '';
    let emailBody = '';
    let callScript = '';
    let followUpNote = '';

    switch (actionType) {
      case 'OUTREACH':
      case 'FOLLOW_UP':
        if (isEn) {
          whatsapp = `Hi ${contact}, this is regarding your inquiry with ${biz} for ${cat} in ${loc}. We have availability this week. Would you like a quick quote or have a quick call?`;
          sms = `Hi ${contact}, following up on your ${cat} inquiry with ${biz}. Reply YES to confirm appointment availability.`;
          emailSubject = `Quick follow-up regarding your ${cat} service inquiry - ${biz}`;
          emailBody = `Hi ${contact},\n\nThank you for reaching out to ${biz}. We specialize in ${cat} throughout ${loc}.\n\nWe wanted to follow up on your project to understand your exact timing and provide a detailed estimate.\n\nCould you let us know what day works best for a brief 5-minute call or inspection?\n\nBest regards,\n${biz} Team`;
          callScript = `“Hi ${contact}, this is [Name] calling from ${biz}. I'm following up on your inquiry for ${cat}. I wanted to make sure you got your questions answered and see if you need an on-site estimate this week.”`;
          followUpNote = 'If no response within 24 hours, send automated SMS follow-up #2.';
        } else {
          whatsapp = `Hola ${contact}, te contacto de ${biz} respecto a tu consulta de ${cat} en ${loc}. Tenemos disponibilidad esta semana. ¿Te gustaría que te preparemos un presupuesto rápido o coordinemos una llamada?`;
          sms = `Hola ${contact}, seguimiento de ${biz} para tu consulta de ${cat}. Responde SÍ para coordinar disponibilidad.`;
          emailSubject = `Seguimiento rápido sobre tu consulta de ${cat} - ${biz}`;
          emailBody = `Hola ${contact},\n\nGracias por comunicarte con ${biz}. Somos especialistas en ${cat} en ${loc}.\n\nTe escribimos para darle seguimiento a tu solicitud, conocer tus necesidades exactas y enviarte un presupuesto personalizado sin compromiso.\n\n¿Qué día y hora te vendría mejor para una breve llamada o visita técnica?\n\nUn cordial saludo,\nEl equipo de ${biz}`;
          callScript = `“Hola ${contact}, te llama [Nombre] de ${biz}. Te llamo para dar seguimiento a tu solicitud de ${cat}. Quería asegurarme de resolver tus dudas y ver si necesitas una cotización o visita esta semana.”`;
          followUpNote = 'Si no responde en 24h, enviar segundo recordatorio por WhatsApp.';
        }
        break;

      case 'REVIEW_REQUEST': {
        const neutralPack = ReviewComplianceFirewall.neutralizeMessage(contact, biz, cat, loc, isEn ? 'en' : 'es');
        whatsapp = neutralPack.whatsapp;
        sms = neutralPack.sms;
        emailSubject = neutralPack.emailSubject;
        emailBody = neutralPack.emailBody;
        callScript = neutralPack.callScript;
        followUpNote = neutralPack.followUpNote;
        break;
      }

      case 'REACTIVATION':
        if (isEn) {
          whatsapp = `Hi ${contact}! It's been a while since we worked on your ${cat} project at ${biz}. We are doing a seasonal maintenance special for preferred clients in ${loc}. Would you like us to schedule a checkup?`;
          sms = `Hi ${contact}, ${biz} is offering a seasonal maintenance check for past clients in ${loc}. Reply YES for details.`;
          emailSubject = `Special seasonal update for your ${cat} - ${biz}`;
          emailBody = `Hi ${contact},\n\nHope you are having a wonderful season! As a valued past client of ${biz}, we wanted to reach out regarding your ${cat} maintenance in ${loc}.\n\nPreventative upkeep saves significant repair costs down the line. We are offering priority scheduling for our returning clients this month.\n\nLet us know if you would like us to book a convenient date.\n\nWarm regards,\n${biz}`;
          callScript = `“Hi ${contact}, this is [Name] from ${biz}. We haven't spoken in a few months, and I wanted to check in on how everything is holding up with your ${cat}, and offer our preferred client maintenance check.”`;
          followUpNote = 'Convert past clients with 15-35% typical response rate.';
        } else {
          whatsapp = `¡Hola ${contact}! Hace un tiempo que realizamos tu trabajo de ${cat} en ${biz}. Estamos lanzando una campaña de revisión y mantenimiento de temporada para clientes preferentes en ${loc}. ¿Te gustaría que reservemos una fecha?`;
          sms = `Hola ${contact}, ${biz} tiene revisión de temporada para clientes en ${loc}. Responde SÍ para coordinar.`;
          emailSubject = `Revisión y mantenimiento de temporada para tu ${cat} - ${biz}`;
          emailBody = `Hola ${contact},\n\n¡Esperamos que estés muy bien! Como cliente de ${biz}, te contactamos para ofrecerte una revisión y mantenimiento preventivo de ${cat} en ${loc}.\n\nEl mantenimiento preventivo evita costes mayores a futuro y asegura que todo funcione perfecto. Este mes tenemos tarifas preferenciales para clientes recurrentes.\n\n¿Te gustaría que te reservemos un espacio esta semana?\n\nUn saludo cordial,\n${biz}`;
          callScript = `“Hola ${contact}, te saluda [Nombre] de ${biz}. Hace unos meses realizamos un servicio de ${cat} contigo y quería saber cómo está funcionando todo, además de ofrecerte nuestra revisión de temporada.”`;
          followUpNote = 'Tasa de conversión típica en clientes anteriores: 15% a 35%.';
        }
        break;

      case 'LOCAL_AUDIT':
      case 'PROFILE_OPTIMIZATION':
      case 'POST_CREATOR':
      case 'ESTIMATOR':
      default:
        if (isEn) {
          whatsapp = `Update for ${biz}: Optimization action ready for ${cat} in ${loc}. Review competitive opportunities and launch now.`;
          sms = `${biz}: New market opportunity detected in ${loc}. Open Bvelt to execute.`;
          emailSubject = `Commercial Growth Action for ${biz}`;
          emailBody = `Hi Team,\n\nA new commercial opportunity has been detected for ${biz} in ${loc}. Executing this action will improve our local conversion rate and capture unserved demand.\n\nRegards,\nBvelt Action Engine`;
          callScript = `“Action briefing: Target high-intent local clients in ${loc} looking for verified ${cat} providers.”`;
          followUpNote = 'Execute and log customer outcome to update conversion revenue.';
        } else {
          whatsapp = `Actualización para ${biz}: Acción comercial lista para ${cat} en ${loc}. Revisa la brecha de mercado y ejecútala ahora.`;
          sms = `${biz}: Nueva oportunidad de mercado en ${loc}. Abre Bvelt para ejecutar.`;
          emailSubject = `Acción de Crecimiento Comercial para ${biz}`;
          emailBody = `Hola equipo,\n\nSe ha identificado una acción comercial clave para ${biz} en ${loc}. Ejecutar esta acción permite mejorar la conversión local y capturar demanda no atendida.\n\nSaludos,\nBvelt Action Engine`;
          callScript = `“Guion de acción: Contactar a clientes de alta intención en ${loc} que buscan proveedores verificados de ${cat}.”`;
          followUpNote = 'Ejecuta y registra el resultado comercial para contabilizar ingresos ganados.';
        }
        break;
    }

    const waEncoded = encodeURIComponent(whatsapp);
    const whatsappUrl = phoneClean 
      ? `https://wa.me/${phoneClean}?text=${waEncoded}` 
      : `https://wa.me/?text=${waEncoded}`;

    const emailUrl = `mailto:${context.email || ''}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    return {
      whatsappMessage: whatsapp,
      whatsappUrl,
      smsMessage: sms,
      emailSubject,
      emailBody,
      emailUrl,
      callScript,
      followUpNote
    };
  }

  /**
   * Converts a BusinessOpportunity into a complete ActionDefinition
   */
  static convertOpportunityToAction(
    opp: BusinessOpportunity,
    contextOverride?: ActionContext,
    lang: 'es' | 'en' = 'es'
  ): ActionDefinition {
    const actionType = this.getActionTypeFromOpportunity(opp.type);
    const now = new Date().toISOString();

    const mergedContext: ActionContext = {
      category: 'General Services',
      location: 'Local Market',
      ...contextOverride
    };

    const outreach = this.generateOutreach(actionType, mergedContext, lang);

    // Why now contextualization
    let whyNow = opp.whyThisMatters;
    if (opp.priority === 'HIGH') {
      whyNow = lang === 'en' 
        ? 'High urgency: Unanswered requests degrade conversion probability by 80% after 2 hours.'
        : 'Alta urgencia: Las solicitudes sin responder pierden un 80% de probabilidad de cierre tras 2 horas.';
    } else if (opp.type === 'REVIEW_GROWTH') {
      whyNow = lang === 'en'
        ? 'Competitors in your 5km radius are actively accumulating highly-rated reviews this week.'
        : 'Los competidores en tu radio de 5km están acumulando opiniones activamente esta semana.';
    }

    return {
      id: `act_${opp.id}`,
      opportunityId: opp.id,
      title: opp.title,
      description: opp.description,
      whyThisMatters: opp.whyThisMatters,
      whyNow: whyNow,
      actionType: actionType,
      priority: opp.priority,
      impactFormatted: opp.impactRange.formatted,
      destination: opp.actionTarget,
      status: 'PENDING',
      context: mergedContext,
      outreach: outreach,
      createdAt: now,
      updatedAt: now,
      calculationDetails: opp.calculationDetails
    };
  }

  /**
   * Retrieves all saved actions from LocalStorage (Business Memory)
   */
  static getStoredActions(): ActionDefinition[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_ACTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves actions to LocalStorage
   */
  static saveActions(actions: ActionDefinition[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_ACTIONS_KEY, JSON.stringify(actions.slice(-100)));
    } catch (e) {
      console.warn('[ActionEngine] Failed to save actions:', e);
    }
  }

  /**
   * Starts an action (marks as IN_PROGRESS)
   */
  static startAction(actionId: string, tenantUid?: string | null): ActionDefinition | undefined {
    const actions = this.getStoredActions();
    const act = actions.find(a => a.id === actionId);
    if (act) {
      act.status = 'IN_PROGRESS';
      act.updatedAt = new Date().toISOString();
      this.saveActions(actions);

      // Record Action Execution Event in BEM Memory (Block 9)
      try {
        const identity = createEntityIdentity({
          canonicalName: act.context.businessName || 'Local Business',
          phone: act.context.phone,
          city: act.context.location,
          primaryCategory: act.context.category
        });
        recordHistoricalArbitrageEvent({
          identity,
          fieldKey: `action_exec_${act.id}`,
          relationship: 'ACTION_EXECUTION',
          value: {
            actionId: act.id,
            actionType: act.actionType,
            title: act.title,
            status: 'EXECUTED',
            context: act.context,
            executedAt: act.updatedAt
          },
          sourceType: 'BVELT_ACTION_ENGINE',
          sourceLabel: 'Bvelt ActionEngine Execution',
          classification: 'TENANT_PRIVATE',
          actionReference: {
            actionId: act.id,
            actionType: act.actionType,
            destinationCode: act.destination as any,
            status: 'EXECUTED',
            executedAt: act.updatedAt,
            priority: act.priority,
            opportunityId: act.opportunityId
          },
          baselineReference: {
            capturedAt: act.updatedAt,
            metrics: {
              priority: act.priority,
              impactFormatted: act.impactFormatted
            }
          },
          tenantUid
        }).catch(err => console.warn('[ActionEngine] BEM action execution log warning:', err));
      } catch (e) {
        console.warn('[ActionEngine] Non-blocking BEM action execution warning:', e);
      }

      return act;
    }
    return undefined;
  }

  /**
   * Completes an action and logs the commercial conversion outcome
   */
  static completeAction(
    actionId: string,
    outcome: {
      outcomeType: ActionOutcomeType;
      revenueRecorded?: number;
      contactMethod?: 'whatsapp' | 'call' | 'email' | 'in_person' | 'sms' | 'other';
      notes?: string;
    },
    tenantUid?: string | null
  ): ActionDefinition | undefined {
    const actions = this.getStoredActions();
    const act = actions.find(a => a.id === actionId);
    const now = new Date().toISOString();

    if (act) {
      act.status = 'COMPLETED';
      act.outcome = {
        outcomeType: outcome.outcomeType,
        revenueRecorded: outcome.revenueRecorded || 0,
        contactMethod: outcome.contactMethod || 'whatsapp',
        notes: outcome.notes,
        recordedAt: now
      };
      act.updatedAt = now;
      this.saveActions(actions);

      // Register Conversion Event in Business Memory
      this.recordConversion({
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actionId: act.id,
        opportunityId: act.opportunityId,
        actionType: act.actionType,
        title: act.title,
        outcomeType: outcome.outcomeType,
        revenue: outcome.revenueRecorded || 0,
        contactMethod: outcome.contactMethod,
        notes: outcome.notes,
        timestamp: now
      });

      // Record Conversion / Outcome Observation in BEM Memory (Block 9)
      try {
        const identity = createEntityIdentity({
          canonicalName: act.context.businessName || 'Local Business',
          phone: act.context.phone,
          city: act.context.location,
          primaryCategory: act.context.category
        });
        recordHistoricalArbitrageEvent({
          identity,
          fieldKey: `outcome_obs_${act.id}`,
          relationship: 'OUTCOME_OBSERVATION',
          value: {
            actionId: act.id,
            outcomeType: outcome.outcomeType,
            revenueRecorded: outcome.revenueRecorded || 0,
            recordedAt: now
          },
          sourceType: 'BVELT_ACTION_ENGINE',
          sourceLabel: 'Bvelt ActionEngine Outcome',
          classification: 'TENANT_PRIVATE',
          actionReference: {
            actionId: act.id,
            actionType: act.actionType,
            status: 'COMPLETED',
            executedAt: now
          },
          outcomeReference: {
            outcomeType: outcome.outcomeType,
            metricName: outcome.revenueRecorded ? 'revenue' : 'outcome',
            newValue: outcome.revenueRecorded || outcome.outcomeType,
            associationType: 'OBSERVED_AFTER',
            observationWindow: '30d'
          },
          tenantUid
        }).catch(err => console.warn('[ActionEngine] BEM outcome log warning:', err));
      } catch (e) {
        console.warn('[ActionEngine] Non-blocking BEM outcome warning:', e);
      }

      return act;
    }
    return undefined;
  }

  /**
   * Records a commercial conversion event
   */
  static recordConversion(record: CommercialConversionRecord): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_CONVERSIONS_KEY);
      const records: CommercialConversionRecord[] = raw ? JSON.parse(raw) : [];
      records.push(record);
      localStorage.setItem(STORAGE_CONVERSIONS_KEY, JSON.stringify(records.slice(-200)));

      // Passively update Business DNA preferred action patterns
      const uid = auth?.currentUser?.uid || 'current_user';
      BusinessDnaService.recordActionExecution(uid, {
        actionId: record.actionId,
        actionType: record.actionType,
        destination: record.contactMethod,
        executedAt: record.timestamp
      });
    } catch (e) {
      console.warn('[ActionEngine] Failed to record conversion:', e);
    }
  }

  /**
   * Retrieves all conversion records from Business Memory
   */
  static getConversionHistory(): CommercialConversionRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_CONVERSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves all saved commercial quotes from LocalStorage (Business Memory)
   */
  static getStoredQuotes(): CommercialQuoteRecord[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_QUOTES_KEY) || localStorage.getItem('bvelt_commercial_quotes');
        return raw ? JSON.parse(raw) : [];
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Saves or updates a commercial quote in Business Memory
   */
  static saveQuote(quote: CommercialQuoteRecord): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const quotes = this.getStoredQuotes();
      const existingIdx = quotes.findIndex(q => q.id === quote.id);
      const now = new Date().toISOString();
      const updatedQuote = { ...quote, updatedAt: now };

      if (existingIdx >= 0) {
        quotes[existingIdx] = updatedQuote;
      } else {
        quotes.unshift(updatedQuote);
      }
      localStorage.setItem(STORAGE_QUOTES_KEY, JSON.stringify(quotes.slice(-100)));

      // If status is SENT, log a conversion event
      if (quote.status === 'SENT') {
        this.recordConversion({
          id: `conv_quote_${quote.id}`,
          actionId: quote.actionId || `act_quote_${quote.id}`,
          opportunityId: quote.opportunityId || `opp_quote_${quote.id}`,
          actionType: 'ESTIMATOR',
          title: `Cotización Enviada: ${quote.title} ($${quote.totalAmount})`,
          outcomeType: 'ESTIMATE_SENT',
          revenue: quote.totalAmount,
          notes: `Presupuesto formal emitido para ${quote.leadName || 'cliente'}`,
          timestamp: now
        });
      } else if (quote.status === 'WON') {
        const rev = quote.confirmedRevenue ?? quote.totalAmount;
        this.recordConversion({
          id: `conv_won_${quote.id}`,
          actionId: quote.actionId || `act_won_${quote.id}`,
          opportunityId: quote.opportunityId || `opp_won_${quote.id}`,
          actionType: 'ESTIMATOR',
          title: `Venta Ganada: ${quote.title} ($${rev})`,
          outcomeType: 'WON',
          revenue: rev,
          notes: `Presupuesto aceptado y confirmado por el cliente`,
          timestamp: now
        });
      }
    } catch (e) {
      console.warn('[ActionEngine] Failed to save quote:', e);
    }
  }

  /**
   * Updates quote status (SENT, WON, LOST, DRAFT) with optional confirmed revenue
   */
  static updateQuoteStatus(quoteId: string, status: QuoteStatus, confirmedRevenue?: number): CommercialQuoteRecord | undefined {
    const quotes = this.getStoredQuotes();
    const q = quotes.find(item => item.id === quoteId);
    if (!q) return undefined;

    q.status = status;
    q.updatedAt = new Date().toISOString();
    if (confirmedRevenue !== undefined) {
      q.confirmedRevenue = confirmedRevenue;
    }
    this.saveQuote(q);
    return q;
  }

  /**
   * Centralized Next Best Action Engine
   * Evaluates real leads, opportunities, quotes, and market signals to compute
   * a single prioritized list of actionable steps with deterministic rules.
   */
  static computeNextBestActions(
    paramsOrLeads: any,
    optOpportunities?: BusinessOpportunity[],
    optMarketContext?: any,
    optCompetitorMovements?: any[],
    optOperationalSummary?: any,
    optProfile?: any,
    optLang?: 'es' | 'en'
  ): NextBestAction[] {
    let leads: any[] = [];
    let opportunities: BusinessOpportunity[] = [];
    let marketContext: any = {};
    let competitorMovements: any[] = [];
    let operationalSummary: any = null;
    let profile: any = {};
    let lang: 'es' | 'en' = (typeof window !== 'undefined' && localStorage.getItem('lf_lang') === 'en') ? 'en' : 'es';

    if (Array.isArray(paramsOrLeads)) {
      leads = paramsOrLeads;
      opportunities = optOpportunities || [];
      marketContext = optMarketContext || {};
      competitorMovements = optCompetitorMovements || [];
      operationalSummary = optOperationalSummary || null;
      profile = optProfile || {};
      if (optLang) lang = optLang;
    } else if (paramsOrLeads && typeof paramsOrLeads === 'object') {
      leads = paramsOrLeads.leads || [];
      opportunities = paramsOrLeads.opportunities || [];
      marketContext = paramsOrLeads.marketContext || {};
      competitorMovements = paramsOrLeads.competitorMovements || [];
      operationalSummary = paramsOrLeads.operationalSummary || null;
      profile = paramsOrLeads.profile || {};
      if (paramsOrLeads.lang) lang = paramsOrLeads.lang;
    }

    const isEn = lang === 'en';
    const todayStr = new Date().toISOString().split('T')[0];
    const storedQuotes = this.getStoredQuotes();
    const actionsList: NextBestAction[] = [];
    const city = marketContext.city || profile.city || profile.location || (isEn ? 'your area' : 'tu zona');
    const niche = marketContext.niche || marketContext.industry || profile.category || (isEn ? 'your sector' : 'tu sector');

    // Rule 1: QUOTE_SENT + follow-up due / pending response (Highest commercial intent - pending cash)
    const sentQuotes = storedQuotes.filter(q => q.status === 'SENT');
    for (const q of sentQuotes) {
      const matchLead = leads.find(l => l.id === q.leadId || (l.client && l.client === q.leadName) || (l.name && l.name === q.leadName));
      const leadName = q.leadName || matchLead?.client || matchLead?.name || matchLead?.businessName || (isEn ? 'Client' : 'Cliente');
      const totalFormatted = Number(q.totalAmount || (q as any).total || 0).toLocaleString();
      const actionText = isEn ? `Follow Up on Sent Quote ($${totalFormatted})` : `Seguir Cotización Enviada ($${totalFormatted})`;
      const reasonText = isEn
        ? `Quote of $${totalFormatted} sent for ${leadName}. Active follow-up strongly increases closing probability.`
        : `Cotización de $${totalFormatted} enviada a ${leadName}. El seguimiento activo aumenta fuertemente la probabilidad de cierre.`;
      
      actionsList.push({
        id: `nba_quote_${q.id}`,
        action: actionText,
        title: actionText,
        priority: 'VERY_HIGH',
        priorityScore: 98,
        reason: reasonText,
        reasoning: reasonText,
        expectedBenefit: isEn ? `Advance pending deal worth $${totalFormatted}` : `Avanzar negociación pendiente de $${totalFormatted}`,
        whyNow: isEn
          ? 'Quote has been sent and no formal response recorded. Proactive contact prevents lead drop-off.'
          : 'Presupuesto enviado sin respuesta registrada. El contacto oportuno evita que busque competidores.',
        evidence: isEn ? `Sent Quote #${q.id.slice(-4)} ($${totalFormatted})` : `Cotización enviada #${q.id.slice(-4)} ($${totalFormatted})`,
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '3 min',
        estimatedMinutes: 3,
        destinationCode: 'SEND_QUOTE',
        destination: { tab: 'estimator', subRow: 0, section: 'tools' },
        ctaLabel: isEn ? 'Review Quote & Follow Up' : 'Ver Cotización y Seguir',
        contextData: {
          leadId: matchLead?.id || q.leadId,
          leadName,
          amount: q.totalAmount || (q as any).total,
          quoteId: q.id,
          city: matchLead?.city || marketContext.city,
        },
        bveltMoment: {
          whatIsHappening: isEn ? `Sent quote for $${totalFormatted} to ${leadName} pending client response.` : `Cotización por $${totalFormatted} enviada a ${leadName} pendiente de respuesta.`,
          whyItMatters: isEn ? `Proactive follow-up on active quotes increases close rates significantly.` : `El seguimiento activo en presupuestos enviados aumenta fuertemente la probabilidad de cierre.`,
          opportunitySummary: isEn ? `Confirm $${totalFormatted} in pending deal revenue.` : `Asegurar $${totalFormatted} de ingresos por negociación pendiente.`,
          recommendedActionNow: isEn ? `Contact ${leadName} to resolve questions and close agreement.` : `Contactar a ${leadName} para resolver dudas y confirmar decisión.`,
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'Stored Commercial Quotes' : 'Registro de Cotizaciones'
        }
      });
    }

    // Filter only genuine, in-service-area business leads (exclude demo leads and out-of-zone leads)
    const businessLeads = leads.filter(l => {
      if (!l) return false;
      if (l.isDemo === true || l.id?.startsWith('dl-') || l.id?.startsWith('demo-')) return false;
      if (profile && Object.keys(profile).length > 0 && !isLeadInServiceArea(l, profile)) return false;
      return isBusinessLead(l, profile);
    });

    // Rule 2: Scheduled Follow-up due today or past due
    const dueFollowUps = businessLeads.filter(l => 
      (l.status === 'FOLLOW_UP' || (l.nextActionDate && l.nextActionDate <= todayStr)) &&
      l.status !== 'WON' && l.status !== 'LOST' && l.status !== 'CLIENT'
    );

    for (const lead of dueFollowUps) {
      const name = lead.client || lead.name || lead.businessName || (isEn ? 'Prospect' : 'Prospecto');
      const actionText = isEn ? `Execute Scheduled Follow-up with ${name}` : `Ejecutar Seguimiento Agendado con ${name}`;
      const reasonText = isEn
        ? `Follow-up was scheduled for ${lead.nextActionDate || 'today'}. Timely follow-ups preserve warm lead intent.`
        : `Seguimiento agendado para ${lead.nextActionDate || 'hoy'}. Contactar a tiempo conserva el interés del prospecto.`;

      actionsList.push({
        id: `nba_followup_${lead.id}`,
        action: actionText,
        title: actionText,
        priority: 'VERY_HIGH',
        priorityScore: 95,
        reason: reasonText,
        reasoning: reasonText,
        expectedBenefit: isEn ? 'Prevent deal stall and advance pipeline' : 'Evitar que el prospecto se enfríe y avanzar negociación',
        whyNow: isEn ? 'Follow-up is due today or past due.' : 'La fecha de seguimiento agendada se cumple hoy.',
        evidence: isEn ? `Scheduled Action Date: ${lead.nextActionDate || todayStr}` : `Fecha de Acción: ${lead.nextActionDate || todayStr}`,
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '2 min',
        estimatedMinutes: 2,
        destinationCode: 'FOLLOW_UP',
        destination: { tab: 'client_acquisition', subRow: 4, section: 'clients' },
        ctaLabel: isEn ? 'Contact Lead Now' : 'Contactar Lead Ahora',
        contextData: {
          leadId: lead.id,
          leadName: name,
          phone: lead.phone,
          email: lead.email,
          city: lead.city || marketContext.city,
        },
        bveltMoment: {
          whatIsHappening: isEn ? `Scheduled follow-up due for ${name}.` : `Fecha de seguimiento agendada para hoy con ${name}.`,
          whyItMatters: isEn ? `Timely follow-ups preserve warm prospect intent.` : `Contactar en la fecha pactada conserva el interés del prospecto.`,
          opportunitySummary: isEn ? `Advance warm lead into quotation or booking stage.` : `Avanzar prospecto calificado hacia propuesta o cierre.`,
          recommendedActionNow: isEn ? `Execute planned touchpoint with ${name}.` : `Realizar el seguimiento agendado con ${name}.`,
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'CRM Scheduled Follow-Ups' : 'CRM de Prospectos'
        }
      });
    }

    // Rule 3: RESPONDED Lead (Inquiry waiting for estimate or reply)
    const respondedLeads = businessLeads.filter(l => l.status === 'RESPONDED' || l.status === 'nuevo_mensaje');
    for (const lead of respondedLeads) {
      const name = lead.client || lead.name || lead.businessName || (isEn ? 'Prospect' : 'Prospecto');
      const actionText = isEn ? `Send Estimate / Reply to ${name}` : `Enviar Presupuesto / Responder a ${name}`;
      const reasonText = isEn
        ? `${name} replied showing direct commercial intent. Fast response significantly improves closing probability.`
        : `${name} respondió mostrando intención comercial. Responder rápido aumenta notablemente la probabilidad de cierre.`;

      actionsList.push({
        id: `nba_responded_${lead.id}`,
        action: actionText,
        title: actionText,
        priority: 'HIGH',
        priorityScore: 92,
        reason: reasonText,
        reasoning: reasonText,
        expectedBenefit: isEn ? 'Turn engaged prospect into booked job within 24h' : 'Convertir prospecto activo en trabajo confirmado en 24h',
        whyNow: isEn ? 'Prospect responded and is waiting for a response or price proposal.' : 'El cliente respondió y espera tu cotización o respuesta.',
        evidence: isEn ? 'Direct customer reply recorded' : 'Respuesta directa del cliente registrada',
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '4 min',
        estimatedMinutes: 4,
        destinationCode: 'SEND_QUOTE',
        destination: { tab: 'estimator', subRow: 0, section: 'tools' },
        ctaLabel: isEn ? 'Create Estimate Now' : 'Crear Presupuesto Ahora',
        contextData: {
          leadId: lead.id,
          leadName: name,
          phone: lead.phone,
          city: lead.city || marketContext.city,
        },
        bveltMoment: {
          whatIsHappening: isEn ? `${name} replied directly and is waiting for your response.` : `${name} respondió recientemente y espera tu propuesta o cotización.`,
          whyItMatters: isEn ? `Engaged prospects are at peak buying intent; fast response maximizes close rate.` : `Prospectos con respuesta activa están en su punto máximo de intención de compra.`,
          opportunitySummary: isEn ? `Close active inquiry into a confirmed booking within 24 hours.` : `Convertir la consulta en un trabajo confirmado en 24 horas.`,
          recommendedActionNow: isEn ? `Send estimate or reply to ${name}.` : `Enviar cotización o responder la consulta de ${name}.`,
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'Direct Client Interaction' : 'Interacción Directa en CRM'
        }
      });
    }

    // Rule 4: NEW Lead + Lead Quality Engine Evaluation
    const newLeads = businessLeads.filter(l => !l.status || l.status === 'NEW' || l.status === 'nuevo');
    for (const lead of newLeads) {
      const evalRes = LeadQualityEngine.evaluateLead(lead, { niche: marketContext.niche, category: marketContext.industry, location: marketContext.city }, lang);
      
      const rawName = lead.client || lead.businessName || lead.name;
      const genericFallback = isEn ? 'New Lead' : 'Nuevo Lead';
      
      let name = rawName;
      if (!name || name.trim().toLowerCase() === 'new lead' || name.trim().toLowerCase() === 'nuevo lead' || name.trim().toLowerCase() === 'unnamed lead' || name.trim().toLowerCase() === 'lead sin nombre') {
        if (lead.phone) {
          name = `${genericFallback} (${lead.phone})`;
        } else if (lead.email) {
          name = `${genericFallback} (${lead.email})`;
        } else if (lead.service) {
          name = `${lead.service}`;
        } else {
          name = `${genericFallback} #${lead.id}`;
        }
      }

      const qualityBadgeStr = evalRes.qualityLevel === 'HIGH' ? (isEn ? ' [High Quality]' : ' [Calidad Alta]') : (evalRes.qualityLevel === 'MEDIUM' ? (isEn ? ' [Medium Quality]' : ' [Calidad Media]') : '');
      const actionText = isEn ? `Contact New Lead: ${name}${qualityBadgeStr}` : `Contactar Nuevo Lead: ${name}${qualityBadgeStr}`;
      
      const primaryReason = evalRes.reasons[0];
      const reasonText = isEn
        ? `Lead Quality: ${evalRes.qualityLevel} (${evalRes.score}/100). ${primaryReason?.labelEn || 'High conversion window.'}`
        : `Calidad de Lead: ${evalRes.qualityLevel} (${evalRes.score}/100). ${primaryReason?.labelEs || 'Ventaja de primer contacto.'}`;

      let elapsedMinutes = 0;
      if ((lead as any).createdAt || (lead as any).date || (lead as any).timestamp) {
        const leadTime = new Date((lead as any).createdAt || (lead as any).date || (lead as any).timestamp).getTime();
        if (!isNaN(leadTime) && leadTime > 0) {
          elapsedMinutes = Math.max(0, Math.floor((Date.now() - leadTime) / (60 * 1000)));
        }
      }
      const isSlaBreached = elapsedMinutes >= 15;

      const basePriority = evalRes.qualityLevel === 'HIGH' ? 88 : (evalRes.qualityLevel === 'MEDIUM' ? 80 : 65);
      const calculatedPriority = isSlaBreached ? Math.min(98, basePriority + 7) : basePriority;

      let whatsappUrl: string | undefined;
      let suggestedDraft: string | undefined;
      if (lead.phone) {
        const cleanPhone = String(lead.phone).replace(/[^0-9+]/g, '');
        if (cleanPhone.length >= 7) {
          suggestedDraft = isEn
            ? `Hello ${name}, thank you for reaching out! We received your request regarding ${lead.service || marketContext.niche || 'our services'} and would love to help you today. When is a convenient time to discuss?`
            : `¡Hola ${name}! Gracias por contactarnos. Recibimos tu solicitud sobre ${lead.service || marketContext.niche || 'nuestros servicios'} y con gusto te podemos atender hoy mismo. ¿En qué horario te queda cómodo conversar?`;
          whatsappUrl = `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(suggestedDraft)}`;
        }
      }

      actionsList.push({
        id: `nba_new_${lead.id}`,
        action: actionText,
        title: actionText,
        priority: isSlaBreached || evalRes.qualityLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        priorityScore: calculatedPriority,
        reason: isSlaBreached 
          ? (isEn ? `⚠️ SLA Warning: Lead waiting for >${elapsedMinutes}m. Rapid response increases conversion by 8x.` : `⚠️ Alerta SLA: Lead en espera hace >${elapsedMinutes}m. Respuesta rápida multiplica x8 la conversión.`)
          : reasonText,
        reasoning: reasonText,
        expectedBenefit: isEn ? 'First-responder advantage: fast initial touchpoint maximizes close rate' : 'Ventaja de primer contacto: la respuesta inmediata maximiza el cierre',
        whyNow: isSlaBreached
          ? (isEn ? `Lead waiting over ${elapsedMinutes} minutes without reply.` : `Lead esperando hace más de ${elapsedMinutes} minutos sin respuesta.`)
          : (isEn ? 'This lead has not been contacted yet.' : 'Este lead no ha sido contactado aún.'),
        evidence: isEn ? `Lead Quality: ${evalRes.qualityLevel} (${evalRes.score}/100) | Provenance: ${evalRes.provenance.overallClassification}` : `Calidad: ${evalRes.qualityLevel} (${evalRes.score}/100) | Procedencia: ${evalRes.provenance.overallClassification}`,
        evidenceLevel: evalRes.provenance.overallClassification === 'REAL' ? 'VERIFIED' : 'DERIVED',
        confidence: evalRes.qualityLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        estimatedTime: '2 min',
        estimatedMinutes: 2,
        destinationCode: 'CONTACT_LEAD',
        destination: { tab: 'client_acquisition', subRow: 4, section: 'clients', filter: 'NEW' },
        ctaLabel: isEn ? 'Contact via WhatsApp / Call' : 'Contactar por WhatsApp / Llamada',
        contextData: {
          leadId: lead.id,
          leadName: name,
          phone: lead.phone,
          email: lead.email,
          city: lead.city || marketContext.city,
          leadQualityScore: evalRes.score,
          leadQualityLevel: evalRes.qualityLevel,
          elapsedMinutes,
          isSlaBreached,
          whatsappUrl,
          suggestedDraft
        },
        bveltMoment: {
          whatIsHappening: isEn ? `New uncontacted lead captured in CRM (${name}) evaluated with quality level ${evalRes.qualityLevel}.` : `Nuevo cliente potencial sin contactar en tu CRM (${name}) evaluado con nivel de calidad ${evalRes.qualityLevel}.`,
          whyItMatters: evalRes.reasons.map(r => isEn ? r.labelEn : r.labelEs).join(' • '),
          opportunitySummary: isEn ? `Secure first-responder advantage for new client request.` : `Aprovechar la ventaja de primer contacto para asegurar el trabajo.`,
          recommendedActionNow: isEn ? `Contact ${name} via WhatsApp or call immediately.` : `Contactar a ${name} por WhatsApp o llamada inmediatamente.`,
          evidenceStatus: evalRes.provenance.overallClassification === 'REAL' ? 'VERIFIED' : 'DERIVED',
          evidenceSource: isEn ? 'Bvelt Lead Quality Engine' : 'Motor de Calidad Bvelt'
        }
      });
    }

    // Rule 0A: Ghost Competitor Verified Movements (Longitudinal BEM intelligence)
    if (competitorMovements && competitorMovements.length > 0) {
      for (const move of competitorMovements) {
        const compName = move.competitorName || move.name || 'Competitor';
        const deltaFormatted = move.deltaFormatted || (move.delta ? `+${move.delta}` : '+5');
        const periodDays = move.periodDays || 14;
        actionsList.push({
          id: `nba_ghost_${move.id || compName}`,
          action: isEn ? `Close Velocity Gap Against ${compName}` : `Cerrar Brecha de Velocidad frente a ${compName}`,
          title: isEn ? `Competitor Movement: ${compName} gained ${deltaFormatted} reviews` : `Movimiento de Competidor: ${compName} sumó ${deltaFormatted} reseñas`,
          priority: 'HIGH',
          priorityScore: 86,
          reason: isEn ? (move.whyItMattersEn || `${compName} gained reviews recently in ${city}.`) : (move.whyItMattersEs || `${compName} sumó reseñas recientemente en ${city}.`),
          reasoning: isEn ? (move.whyItMattersEn || `${compName} gained reviews recently in ${city}.`) : (move.whyItMattersEs || `${compName} sumó reseñas recientemente en ${city}.`),
          expectedBenefit: isEn ? 'Protect top local rank and maintain review velocity leadership' : 'Proteger posición top local y mantener liderazgo de ritmo de reseñas',
          whyNow: isEn ? `${compName} is actively capturing reviews in ${city}.` : `${compName} está captando reseñas activamente en ${city}.`,
          evidence: isEn ? `BEM POI Longitudinal Shift: ${move.oldValue || 0} → ${move.newValue || move.reviewCount || 10} reviews (${deltaFormatted})` : `BEM POI Cambio Longitudinal: ${move.oldValue || 0} → ${move.newValue || move.reviewCount || 10} reseñas (${deltaFormatted})`,
          evidenceLevel: 'VERIFIED',
          confidence: 'HIGH',
          estimatedTime: '3 min',
          estimatedMinutes: 3,
          destinationCode: 'REQUEST_REVIEW',
          destination: { tab: 'reputation', subRow: 0, section: 'reputation' },
          ctaLabel: isEn ? 'Request Review Now' : 'Pedir Reseña Ahora',
          contextData: { city, niche, competitorName: compName },
          bveltMoment: {
            whatIsHappening: isEn ? `${compName} gained ${deltaFormatted} reviews in ${periodDays} days.` : `${compName} sumó ${deltaFormatted} reseñas en ${periodDays} días.`,
            whyItMatters: isEn ? (move.whyItMattersEn || 'Review velocity directly impacts Google Maps rankings.') : (move.whyItMattersEs || 'El ritmo de reseñas impacta directamente el posicionamiento local.'),
            opportunitySummary: isEn ? 'Keep ahead of competitor review velocity in local radius.' : 'Mantener ventaja en ritmo de reseñas en tu radio local.',
            recommendedActionNow: isEn ? (move.nextActionEn || 'Request reviews from recent completed jobs.') : (move.nextActionEs || 'Solicitar reseñas a clientes de trabajos recientes.'),
            evidenceStatus: 'VERIFIED',
            evidenceSource: 'BEM POI Longitudinal History'
          }
        });
      }
    }

    // Rule 0B: Operational Fingerprint Friction & Weaknesses
    if (operationalSummary) {
      if (Array.isArray(operationalSummary.weaknesses) && operationalSummary.weaknesses.length > 0) {
        const primaryWeakness = operationalSummary.weaknesses[0];
        const isObservedOnly = primaryWeakness.epistemicLevel === 'OBSERVED_THEME';
        actionsList.push({
          id: `nba_op_risk_${primaryWeakness.theme.toLowerCase()}`,
          action: isEn ? `Resolve Service Friction: ${primaryWeakness.theme}` : `Corregir Fricción Operativa: ${primaryWeakness.theme}`,
          title: isEn
            ? `Operational Warning: ${primaryWeakness.observationCount || 1} friction mentions in ${primaryWeakness.theme}`
            : `Alerta Operativa: ${primaryWeakness.observationCount || 1} fricciones en ${primaryWeakness.theme}`,
          priority: 'HIGH',
          priorityScore: isObservedOnly ? 82 : 84,
          reason: isEn ? (primaryWeakness.summaryEn || 'Recurring friction noted in client reviews.') : (primaryWeakness.summaryEs || 'Fricción recurrente observada en opiniones de clientes.'),
          reasoning: isEn ? (primaryWeakness.summaryEn || 'Recurring friction noted in client reviews.') : (primaryWeakness.summaryEs || 'Fricción recurrente observada en opiniones de clientes.'),
          expectedBenefit: isEn ? 'Eliminate conversion leaks caused by reported operational friction' : 'Eliminar fugas de conversión provocadas por fricciones operativas reales',
          whyNow: isEn ? 'Negative customer feedback directly impacts inquiry-to-client conversion.' : 'Los reportes negativos de clientes reducen directamente el ratio de cierre.',
          evidence: isEn ? `Operational Pattern (${primaryWeakness.observationCount || 1} mentions)` : `Patrón Operativo (${primaryWeakness.observationCount || 1} menciones)`,
          evidenceLevel: primaryWeakness.evidenceStatus || 'DERIVED',
          confidence: primaryWeakness.confidenceLevel || 'HIGH',
          estimatedTime: '5 min',
          estimatedMinutes: 5,
          destinationCode: (primaryWeakness.actionCode as any) || 'FOLLOW_UP',
          destination: { tab: primaryWeakness.actionTab || 'leads', subRow: 0, section: 'leads' },
          ctaLabel: isEn ? 'Resolve Friction' : 'Resolver Fricción',
          contextData: { city, niche, theme: primaryWeakness.theme },
          bveltMoment: {
            whatIsHappening: isEn ? `Recurring friction detected in ${primaryWeakness.theme}.` : `Fricción recurrente detectada en ${primaryWeakness.theme}.`,
            whyItMatters: isEn ? 'Operational execution issues degrade customer retention and referral rates.' : 'Los problemas de ejecución operativa degradan la retención de clientes.',
            opportunitySummary: isEn ? 'Implement correction protocol to protect revenue velocity.' : 'Implementar protocolo de corrección para proteger la velocidad comercial.',
            recommendedActionNow: isEn ? (primaryWeakness.suggestedActionEn || 'Apply resolution template.') : (primaryWeakness.suggestedActionEs || 'Aplicar plantilla de resolución.'),
            evidenceStatus: primaryWeakness.evidenceStatus || 'DERIVED',
            evidenceSource: 'BEM Operational Fingerprint Engine'
          }
        });
      } else if (Array.isArray(operationalSummary.frictionMentions) && operationalSummary.frictionMentions.length > 0) {
        const mention = operationalSummary.frictionMentions[0];
        const mentionStr = typeof mention === 'string' ? mention : mention.theme || 'Servicio';
        actionsList.push({
          id: `nba_op_friction_0`,
          action: isEn ? `Mitigate Customer Friction: ${mentionStr}` : `Mitigar Fricción de Clientes: ${mentionStr}`,
          title: isEn ? `Service Alert: ${mentionStr}` : `Alerta de Servicio: ${mentionStr}`,
          priority: 'HIGH',
          priorityScore: 84,
          reason: isEn ? `Feedback indicates customer friction regarding: ${mentionStr}.` : `Las observaciones indican fricción de clientes respecto a: ${mentionStr}.`,
          reasoning: isEn ? `Feedback indicates customer friction regarding: ${mentionStr}.` : `Las observaciones indican fricción de clientes respecto a: ${mentionStr}.`,
          expectedBenefit: isEn ? 'Prevent churn and improve client satisfaction' : 'Prevenir deserciones y mejorar satisfacción del cliente',
          whyNow: isEn ? 'Proactive resolution preserves customer trust and referral rates.' : 'La resolución proactiva protege la reputación y referidos.',
          evidence: isEn ? 'BEM Operational Friction Analysis' : 'Análisis Operativo de Huella BEM',
          evidenceLevel: 'DERIVED',
          confidence: 'HIGH',
          estimatedTime: '5 min',
          estimatedMinutes: 5,
          destinationCode: 'FOLLOW_UP',
          destination: { tab: 'leads', subRow: 0, section: 'leads' },
          ctaLabel: isEn ? 'Review Friction Details' : 'Ver Detalle de Fricción',
          contextData: { city, niche, theme: mentionStr },
          bveltMoment: {
            whatIsHappening: isEn ? `Customer friction noted regarding ${mentionStr}.` : `Fricción observada respecto a ${mentionStr}.`,
            whyItMatters: isEn ? 'Operational quality directly drives repeat business and word of mouth.' : 'La calidad operativa impulsa directamente las ventas recurrentes y el boca a boca.',
            opportunitySummary: isEn ? 'Resolve friction to increase referral revenue.' : 'Resolver fricciones para maximizar ingresos por recomendación.',
            recommendedActionNow: isEn ? 'Follow up with impacted clients or update service standard.' : 'Dar seguimiento a clientes o actualizar estándar de servicio.',
            evidenceStatus: 'DERIVED',
            evidenceSource: 'BEM Operational Fingerprint Engine'
          }
        });
      }
    }

    // Rule 8: Market Gap Actions (Brechas de Mercado detectadas)
    if (marketContext.marketGaps && marketContext.marketGaps.length > 0) {
      for (const gap of marketContext.marketGaps) {
        const gType = gap.type || gap.gapType;
        if (gType === 'REVIEW_VOLUME_GAP' || gType === 'RATING_GAP') {
          const actionText = isEn ? `Close Reputation Gap in ${city} (${niche})` : `Cerrar Brecha de Reputación en ${city} (${niche})`;
          actionsList.push({
            id: `nba_gap_${gap.id}`,
            action: actionText,
            title: actionText,
            priority: 'HIGH',
            priorityScore: 78,
            reason: gap.description,
            reasoning: gap.description,
            expectedBenefit: isEn ? 'Match or exceed top 3 competitor review counts to claim #1 Google Maps spot' : 'Alcanzar el volumen de reseñas de los top 3 competidores para ganar posición #1',
            whyNow: isEn ? `Competitors in ${city} hold significantly higher review authority.` : `Los competidores en ${city} acumulan mayor autoridad en Google Maps.`,
            evidence: gap.evidence || (isEn ? 'Market Reference Gap Analysis' : 'Análisis de Brechas de Mercado'),
            evidenceLevel: gap.evidenceLevel || 'DERIVED',
            confidence: 'HIGH',
            estimatedTime: '3 min',
            estimatedMinutes: 3,
            destinationCode: 'REQUEST_REVIEW',
            destination: { tab: 'reputation', subRow: 0, section: 'reputation' },
            ctaLabel: isEn ? 'Launch Review Campaign' : 'Lanzar Campaña de Reseñas',
            contextData: { city, niche },
            bveltMoment: {
              whatIsHappening: isEn ? `Reputation gap detected in ${city} for ${niche}.` : `Brecha de reputación/reseñas identificada en ${city} (${niche}).`,
              whyItMatters: isEn ? 'Outperforming average local competitor ratings elevates Google Maps rank.' : 'Superar el promedio de reseñas de la competencia mejora el posicionamiento.',
              opportunitySummary: isEn ? 'Capture market share by closing competitor reputation gap.' : 'Aprovechar la brecha reputacional para captar más clientes.',
              recommendedActionNow: isEn ? 'Send compliant post-service review links to recent satisfied clients.' : 'Enviar enlaces de reseña post-servicio a clientes satisfechos recientes.',
              evidenceStatus: gap.evidenceLevel || 'DERIVED',
              evidenceSource: isEn ? 'Market Gap Engine' : 'Motor de Brechas de Mercado'
            }
          });
        } else if (gType === 'GEOGRAPHIC_OPPORTUNITY') {
          const actionText = isEn ? `Capture Low-Saturation Territory in ${city}` : `Capturar Territorio de Baja Saturación en ${city}`;
          actionsList.push({
            id: `nba_gap_${gap.id}`,
            action: actionText,
            title: actionText,
            priority: 'HIGH',
            priorityScore: 76,
            reason: gap.description,
            reasoning: gap.description,
            expectedBenefit: isEn ? 'Establish #1 local authority in uncrowded radius' : 'Establecer autoridad #1 en un radio con baja competencia',
            whyNow: isEn ? `Low competitor count detected in your primary radius in ${city}.` : `Baja cantidad de competidores detectada en tu radio principal de ${city}.`,
            evidence: gap.evidence || (isEn ? 'Territory Gap Analysis' : 'Análisis Territorial BEM'),
            evidenceLevel: gap.evidenceLevel || 'DERIVED',
            confidence: 'HIGH',
            estimatedTime: '3 min',
            estimatedMinutes: 3,
            destinationCode: 'FIND_LOCAL_LEADS',
            destination: { tab: 'radar', subRow: 1, section: 'growth' },
            ctaLabel: isEn ? 'Explore Radius' : 'Explorar Radio',
            contextData: { city, niche },
            bveltMoment: {
              whatIsHappening: isEn ? `Low competitor density detected in primary radius around ${city}.` : `Baja densidad competitiva detectada en tu radio de ${city}.`,
              whyItMatters: isEn ? 'Early presence in low-density zones secures dominant market share.' : 'Capturar tempranamente zonas de baja densidad asegura dominio de mercado.',
              opportunitySummary: isEn ? 'Establish #1 local authority in uncrowded territory.' : 'Establecerte como opción #1 en una zona con pocos competidores.',
              recommendedActionNow: isEn ? 'Explore territory radar and target unserved areas.' : 'Explorar radar territorial y priorizar áreas desatendidas.',
              evidenceStatus: gap.evidenceLevel || 'DERIVED',
              evidenceSource: isEn ? 'Market Gap Engine' : 'Motor de Brechas de Mercado'
            }
          });
        } else if (gType === 'MISSING_WEBSITE' || gType === 'CONVERSION_OPPORTUNITY') {
          const actionText = isEn ? `Capture Digital Demand in ${city}` : `Capturar Demanda Digital en ${city}`;
          actionsList.push({
            id: `nba_gap_${gap.id}`,
            action: actionText,
            title: actionText,
            priority: 'MEDIUM',
            priorityScore: 68,
            reason: gap.description,
            reasoning: gap.description,
            expectedBenefit: isEn ? 'Gain 2-4 additional quote requests per week with instant booking' : 'Captar de 2 a 4 solicitudes adicionales de presupuesto por semana',
            whyNow: isEn ? `Local clients in ${city} search online for direct estimate forms.` : `Clientes locales en ${city} buscan cotización rápida por internet.`,
            evidence: gap.evidence || (isEn ? 'Search Intent Analysis' : 'Análisis de Intención Digital'),
            evidenceLevel: gap.evidenceLevel || 'DERIVED',
            confidence: 'HIGH',
            estimatedTime: '4 min',
            estimatedMinutes: 4,
            destinationCode: 'FIND_LOCAL_LEADS',
            destination: { tab: 'radar', subRow: 1, section: 'growth' },
            ctaLabel: isEn ? 'Audit Territory' : 'Auditar Territorio',
            contextData: { city, niche },
            bveltMoment: {
              whatIsHappening: isEn ? `Unserved digital search intent in ${city}.` : `Demanda digital desatendida identificada en ${city}.`,
              whyItMatters: isEn ? 'Direct online estimate forms capture high-intent local buyers.' : 'Los formularios de cotización rápida convierten búsquedas en ventas.',
              opportunitySummary: isEn ? 'Gain 2-4 additional quote requests per week.' : 'Captar de 2 a 4 presupuestos adicionales por semana.',
              recommendedActionNow: isEn ? 'Audit territory and deploy instant quote links.' : 'Auditar territorio y compartir enlaces de cotización.',
              evidenceStatus: gap.evidenceLevel || 'DERIVED',
              evidenceSource: isEn ? 'Market Gap Engine' : 'Motor de Brechas de Mercado'
            }
          });
        } else if (gType === 'WEBSITE_ADVANTAGE') {
          const actionText = isEn ? `Leverage Digital Advantage in ${city}` : `Explotar Ventaja Digital en ${city}`;
          actionsList.push({
            id: `nba_gap_${gap.id}`,
            action: actionText,
            title: actionText,
            priority: 'MEDIUM',
            priorityScore: 66,
            reason: gap.description,
            reasoning: gap.description,
            expectedBenefit: isEn ? 'Convert searches directly into estimates while competitors lack websites' : 'Convertir búsquedas directamente en cotizaciones mientras competidores carecen de web',
            whyNow: isEn ? `Most competitors in ${city} lack web presence.` : `La mayoría de competidores en ${city} no tienen presencia web.`,
            evidence: gap.evidence || (isEn ? 'Competitive Web Footprint' : 'Huella Web Competitiva'),
            evidenceLevel: gap.evidenceLevel || 'DERIVED',
            confidence: 'HIGH',
            estimatedTime: '3 min',
            estimatedMinutes: 3,
            destinationCode: 'SEND_QUOTE',
            destination: { tab: 'estimator', subRow: 0, section: 'tools' },
            ctaLabel: isEn ? 'Share Instant Quotes' : 'Compartir Cotizaciones Rápidas',
            contextData: { city, niche },
            bveltMoment: {
              whatIsHappening: isEn ? `Most competitors in ${city} lack functional websites.` : `La mayoría de competidores en ${city} no tienen sitio web funcional.`,
              whyItMatters: isEn ? 'Having direct online instant quotes captures clients before competitors reply.' : 'Tener cotizador instantáneo captura clientes antes que la competencia.',
              opportunitySummary: isEn ? 'Monopolize online quote searches in your radius.' : 'Monopolizar las cotizaciones digitales en tu radio.',
              recommendedActionNow: isEn ? 'Share instant estimator link with prospective clients.' : 'Compartir enlace de cotizaciones instantáneas con prospectos.',
              evidenceStatus: gap.evidenceLevel || 'DERIVED',
              evidenceSource: isEn ? 'Market Gap Engine' : 'Motor de Brechas de Mercado'
            }
          });
        } else if (gType === 'COMPETITOR_STRENGTH') {
          const actionText = isEn ? `Differentiate Against Strong Competitor in ${city}` : `Diferenciarte de Competidor Fuerte en ${city}`;
          actionsList.push({
            id: `nba_gap_${gap.id}`,
            action: actionText,
            title: actionText,
            priority: 'MEDIUM',
            priorityScore: 64,
            reason: gap.description,
            reasoning: gap.description,
            expectedBenefit: isEn ? 'Win price-sensitive and urgent clients with same-day responses' : 'Ganar clientes urgentes con presupuestos y respuestas en el mismo día',
            whyNow: isEn ? 'A direct competitor with full profile is located within 1.5 km.' : `Un competidor directo con ficha completa opera a menos de 1.5 km.`,
            evidence: gap.evidence || (isEn ? 'Competitor Cluster Audit' : 'Auditoría de Clúster'),
            evidenceLevel: gap.evidenceLevel || 'DERIVED',
            confidence: 'HIGH',
            estimatedTime: '4 min',
            estimatedMinutes: 4,
            destinationCode: 'VIEW_COMPETITOR',
            destination: { tab: 'radar', subRow: 1, section: 'growth' },
            ctaLabel: isEn ? 'View Competitor' : 'Ver Competidor',
            contextData: { city, niche },
            bveltMoment: {
              whatIsHappening: isEn ? `Established competitor operating within 1.5 km in ${city}.` : `Competidor fuerte operando a menos de 1.5 km en ${city}.`,
              whyItMatters: isEn ? 'Response speed and transparent pricing win clients away from incumbent providers.' : 'Respuesta veloz y precios claros ganan clientes frente a competidores tradicionales.',
              opportunitySummary: isEn ? 'Capture urgent and price-sensitive local demand.' : 'Capturar la demanda urgente y sensible a precio.',
              recommendedActionNow: isEn ? 'Audit competitor profile and differentiate response speed.' : 'Auditar competidor y ofrecer menor tiempo de respuesta.',
              evidenceStatus: gap.evidenceLevel || 'DERIVED',
              evidenceSource: isEn ? 'Market Gap Engine' : 'Motor de Brechas de Mercado'
            }
          });
        } else if (gType === 'COMPETITOR_DENSITY') {
          const actionText = isEn ? `Stand Out in High-Density Sector in ${city}` : `Destacar en Sector de Alta Densidad en ${city}`;
          actionsList.push({
            id: `nba_gap_${gap.id}`,
            action: actionText,
            title: actionText,
            priority: 'MEDIUM',
            priorityScore: 62,
            reason: gap.description,
            reasoning: gap.description,
            expectedBenefit: isEn ? 'Capture high-ticket jobs through specialized offers and fast response' : 'Captar trabajos de mayor valor con ofertas especializadas y respuesta ágil',
            whyNow: isEn ? 'High competitor density requires clear differentiation.' : `Alta densidad de competidores requiere diferenciación clara.`,
            evidence: gap.evidence || (isEn ? 'Density Mapping' : 'Mapeo de Densidad'),
            evidenceLevel: gap.evidenceLevel || 'DERIVED',
            confidence: 'HIGH',
            estimatedTime: '3 min',
            estimatedMinutes: 3,
            destinationCode: 'FIND_LOCAL_LEADS',
            destination: { tab: 'radar', subRow: 1, section: 'growth' },
            ctaLabel: isEn ? 'Check Market Radar' : 'Ver Radar de Mercado',
            contextData: { city, niche },
            bveltMoment: {
              whatIsHappening: isEn ? `High competitor density in ${city} for ${niche}.` : `Alta densidad de competidores en ${city} para ${niche}.`,
              whyItMatters: isEn ? 'Clear differentiation and instant quotes cut through competitive noise.' : 'Diferenciación clara y cotizaciones inmediatas destacan ante la abundancia de opciones.',
              opportunitySummary: isEn ? 'Capture high-ticket specialized jobs in competitive zone.' : 'Captar trabajos de mayor valor diferenciándote en velocidad y garantía.',
              recommendedActionNow: isEn ? 'Check market radar and optimize value proposition.' : 'Ver radar de mercado y afinar propuesta de valor.',
              evidenceStatus: gap.evidenceLevel || 'DERIVED',
              evidenceSource: isEn ? 'Market Gap Engine' : 'Motor de Brechas de Mercado'
            }
          });
        }
      }
    }

    // Rule 5: WON Lead / Completed Job -> Request Compliant Review (Google April 2026 Compliant)
    const wonLeads = businessLeads.filter(l => l.status === 'WON' || l.status === 'CLIENT');
    for (const lead of wonLeads) {
      const name = lead.client || lead.name || lead.businessName || (isEn ? 'Client' : 'Cliente');
      const actionText = isEn ? `Request Review from ${name}` : `Solicitar Reseña a ${name}`;
      const reasonText = isEn
        ? 'Client successfully serviced. Send a post-service digital link for honest feedback.'
        : 'Servicio completado. Envía un enlace digital post-servicio para obtener una opinión sincera.';

      actionsList.push({
        id: `nba_won_${lead.id}`,
        action: actionText,
        title: actionText,
        priority: 'HIGH',
        priorityScore: 75,
        reason: reasonText,
        reasoning: reasonText,
        expectedBenefit: isEn ? 'Build local review authority to outrank competitors on Google Maps' : 'Aumentar autoridad en Google Maps para superar a competidores',
        whyNow: isEn ? 'The deal is won and completed. Send post-service review request.' : 'El trabajo fue completado con éxito. Envía la solicitud post-servicio.',
        evidence: isEn ? 'Verified completed transaction' : 'Transacción completada verificada',
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '2 min',
        estimatedMinutes: 2,
        destinationCode: 'REQUEST_REVIEW',
        destination: { tab: 'reputation', subRow: 0, section: 'reputation' },
        ctaLabel: isEn ? 'Send Review Link' : 'Enviar Enlace de Reseña',
        contextData: {
          leadId: lead.id,
          leadName: name,
          phone: lead.phone,
        },
        bveltMoment: {
          whatIsHappening: isEn ? `Completed job for ${name} verified in CRM.` : `Trabajo completado para ${name} registrado en el CRM.`,
          whyItMatters: isEn ? `Sending a post-service digital request after completion yields highest authentic response rates.` : `Enviar solicitud digital post-servicio tras concluir genera la mayor tasa de respuestas auténticas.`,
          opportunitySummary: isEn ? `Build local review volume on Google Maps to outrank local competitors.` : `Fortalecer la reputación en Google Maps para superar a la competencia.`,
          recommendedActionNow: isEn ? `Send review link to ${name} via WhatsApp or SMS.` : `Enviar enlace de reseña a ${name} por WhatsApp o SMS.`,
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'CRM Closed Deals' : 'CRM / Ventas Ganadas'
        }
      });
    }

    // Rule 6: Outcome Measurement & Confirmed Revenue Logging (Measurement Rule)
    for (const lead of wonLeads) {
      const name = lead.client || lead.name || lead.businessName || (isEn ? 'Client' : 'Cliente');
      const val = lead.estimatedValue || lead.value || lead.amount;
      if (val && !lead.outcomeVerified) {
        const valFormatted = Number(val).toLocaleString();
        const actionText = isEn ? `Confirm Recorded Revenue for ${name} ($${valFormatted})` : `Confirmar Ingreso Registrado para ${name} ($${valFormatted})`;
        actionsList.push({
          id: `nba_measurement_${lead.id}`,
          action: actionText,
          title: actionText,
          priority: 'HIGH',
          priorityScore: 72,
          reason: isEn ? `Verify actual closed revenue and outcome metrics for ${name}.` : `Verificar monto real cobrado y métricas de cierre para ${name}.`,
          reasoning: isEn ? `Verify actual closed revenue and outcome metrics for ${name}.` : `Verificar monto real cobrado y métricas de cierre para ${name}.`,
          expectedBenefit: isEn ? 'Accurate ROI tracking and business ledger calibration' : 'Cálculo exacto de ROI y calibración del balance comercial',
          whyNow: isEn ? 'Completed job requires finalized revenue verification.' : 'El trabajo finalizado requiere confirmación formal de ingresos.',
          evidence: isEn ? `Closed Lead Transaction: $${valFormatted}` : `Transacción de Lead Cerrado: $${valFormatted}`,
          evidenceLevel: 'VERIFIED',
          confidence: 'HIGH',
          estimatedTime: '1 min',
          estimatedMinutes: 1,
          destinationCode: 'SEND_QUOTE',
          destination: { tab: 'client_acquisition', subRow: 4, section: 'clients' },
          ctaLabel: isEn ? 'Verify Ledger' : 'Verificar Registro',
          contextData: { leadId: lead.id, leadName: name, amount: val },
          bveltMoment: {
            whatIsHappening: isEn ? `Won deal for ${name} pending finalized revenue reconciliation.` : `Venta ganada de ${name} pendiente de confirmación en el balance.`,
            whyItMatters: isEn ? 'Precise financial outcome data powers accurate profit analytics and ROI proof.' : 'El registro preciso de ingresos permite medir el ROI real y rentabilidad.',
            opportunitySummary: isEn ? `Calibrate business metrics with verified $${valFormatted} revenue.` : `Calibrar métricas comerciales con los $${valFormatted} confirmados.`,
            recommendedActionNow: isEn ? `Confirm final revenue and close transaction entry.` : `Confirmar monto definitivo y registrar en balance.`,
            evidenceStatus: 'VERIFIED',
            evidenceSource: isEn ? 'Closed Transaction Ledger' : 'Registro de Ventas Cerradas'
          }
        });
      }
    }

    // Rule 7: Competitor / Local Business Opportunities
    if (opportunities.length > 0) {
      for (const topOpp of opportunities.slice(0, 3)) {
        actionsList.push({
          id: `nba_opp_${topOpp.id}`,
          action: topOpp.title,
          title: topOpp.title,
          priority: topOpp.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
          priorityScore: topOpp.priority === 'HIGH' ? 70 : 55,
          reason: topOpp.whyThisMatters,
          reasoning: topOpp.whyThisMatters,
          expectedBenefit: isEn ? 'Capture high-intent local territory demand' : 'Capturar demanda desatendida en el territorio local',
          whyNow: isEn ? 'High-intent commercial signal detected in your local market.' : 'Señal comercial de alta intención detectada en tu mercado local.',
          evidence: topOpp.evidenceSummary || (isEn ? 'Market Analysis Engine' : 'Motor de Análisis de Mercado'),
          evidenceLevel: topOpp.evidenceStatus || 'DERIVED',
          confidence: topOpp.confidence === 'High' ? 'HIGH' : topOpp.confidence === 'Medium' ? 'MEDIUM' : 'LOW',
          estimatedTime: '3 min',
          estimatedMinutes: 3,
          destinationCode: 'FIND_LOCAL_LEADS',
          destination: topOpp.actionTarget || { tab: 'radar', subRow: 1, section: 'growth' },
          ctaLabel: topOpp.recommendedAction || (isEn ? 'Execute Opportunity' : 'Ejecutar Oportunidad'),
          bveltMoment: {
            whatIsHappening: topOpp.description || (isEn ? 'Commercial signal detected in local territory.' : 'Señal comercial detectada en el territorio local.'),
            whyItMatters: topOpp.whyThisMatters,
            opportunitySummary: topOpp.evidenceSummary || (isEn ? 'Capture unserved demand in local radius.' : 'Capturar demanda desatendida en el radio local.'),
            recommendedActionNow: topOpp.recommendedAction || (isEn ? 'Execute opportunity action now.' : 'Ejecutar acción de oportunidad ahora.'),
            evidenceStatus: topOpp.evidenceStatus || 'DERIVED',
            evidenceSource: topOpp.source || (isEn ? 'Market Intelligence Engine' : 'Motor de Inteligencia de Mercado')
          }
        });
      }
    }

    // Identify if zero competitors and zero uncontacted business leads
    const rawCompetitors = marketContext.competitors || (paramsOrLeads && paramsOrLeads.competitors) || [];
    const hasZeroCompetitors = !Array.isArray(rawCompetitors) || rawCompetitors.length === 0;
    const uncontactedBusinessLeads = businessLeads.filter(l => !l.status || l.status === 'NEW' || l.status === 'nuevo');
    const hasZeroUncontactedLeads = uncontactedBusinessLeads.length === 0;

    // Direct High-Leverage Growth CTAs when competitors=0 and uncontacted leads=0
    if (hasZeroCompetitors && hasZeroUncontactedLeads) {
      // 1. Complete profile (priority HIGH if phone missing)
      const isMissingPhone = !profile.phone || String(profile.phone).trim().length < 7;
      actionsList.push({
        id: 'nba_complete_profile',
        action: isEn ? (isMissingPhone ? 'Complete Phone & Business Profile' : 'Complete Business Profile') : (isMissingPhone ? 'Completar Teléfono y Perfil Comercial' : 'Completar Perfil Comercial'),
        title: isEn ? (isMissingPhone ? 'Complete Phone & Business Profile' : 'Complete Business Profile') : (isMissingPhone ? 'Completar Teléfono y Perfil Comercial' : 'Completar Perfil Comercial'),
        priority: isMissingPhone ? 'HIGH' : 'MEDIUM',
        priorityScore: isMissingPhone ? 85 : 70,
        reason: isEn
          ? 'Adding your direct business phone and verified details unlocks incoming client calls and local trust.'
          : 'Agregar tu teléfono de contacto directo y datos de negocio desbloquea llamadas y confianza local.',
        reasoning: isEn
          ? 'Complete business profile establishes immediate credibility.'
          : 'Un perfil de negocio completo genera credibilidad inmediata para clientes locales.',
        expectedBenefit: isEn ? 'Unlock inbound customer phone calls & verified badge' : 'Desbloquear llamadas directas de clientes e insignia de perfil verificado',
        whyNow: isEn ? 'Missing contact phone reduces direct customer conversion.' : 'Falta teléfono directo, lo que frena consultas de clientes.',
        evidence: isEn ? 'Business Profile Settings' : 'Configuración de Perfil Comercial',
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '3 min',
        estimatedMinutes: 3,
        destinationCode: 'COMPLETE_PROFILE',
        destination: { tab: 'profile', subRow: 0, section: 'settings' },
        ctaLabel: isEn ? 'Complete Profile' : 'Completar Perfil',
        bveltMoment: {
          whatIsHappening: isEn ? 'Business profile configuration pending calibration.' : 'Configuración del perfil comercial pendiente de completar.',
          whyItMatters: isEn ? 'Direct phone and service information are the primary conversion drivers for local trade businesses.' : 'El teléfono directo y los datos de servicio son el factor principal de contacto para negocios locales.',
          opportunitySummary: isEn ? 'Maximize local profile trust and direct customer calls.' : 'Maximizar la confianza local y capturar llamadas directas.',
          recommendedActionNow: isEn ? 'Complete contact info, hours, and photos in profile settings.' : 'Completar teléfono, horarios y fotos en el perfil.',
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'Business Profile Settings' : 'Perfil de Negocio Bvelt'
        }
      });

      // 2. Publish website
      actionsList.push({
        id: 'nba_publish_website',
        action: isEn ? 'Publish Local Website for Direct Inquiries' : 'Publicar Sitio Web Local para Captar Clientes',
        title: isEn ? 'Publish Local Website for Direct Inquiries' : 'Publicar Sitio Web Local para Captar Clientes',
        priority: 'HIGH',
        priorityScore: 80,
        reason: isEn
          ? 'Your local landing page is ready to capture direct searchers into quote requests.'
          : 'Tu landing local está lista para convertir visitas en solicitudes directas de cotización.',
        reasoning: isEn
          ? 'Direct website presence operates 24/7 independently of map density.'
          : 'Tener presencia web propia opera 24/7 independientemente de la densidad del mapa.',
        expectedBenefit: isEn ? 'Capture direct client estimate inquiries online' : 'Captar solicitudes directas de cotización online',
        whyNow: isEn ? 'Deploying your website creates an instant professional landing for clients.' : 'Publicar tu web crea una página profesional instantánea para prospectos.',
        evidence: isEn ? 'Bvelt Web Builder Engine' : 'Constructor Web Bvelt',
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '2 min',
        estimatedMinutes: 2,
        destinationCode: 'SEND_QUOTE',
        destination: { tab: 'website' },
        ctaLabel: isEn ? 'Publish Website' : 'Publicar Mi Web',
        bveltMoment: {
          whatIsHappening: isEn ? 'Local website ready to publish and capture inbound demand.' : 'Sitio web local listo para publicar y captar demanda directa.',
          whyItMatters: isEn ? 'Direct web booking captures customers searching online without relying only on maps.' : 'Tener una web lista permite captar clientes online directamente sin depender del mapa.',
          opportunitySummary: isEn ? 'Deploy your local digital presence.' : 'Desplegar tu presencia digital local.',
          recommendedActionNow: isEn ? 'Open website section and publish.' : 'Abrir sección web y publicar.',
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'Bvelt Website Builder' : 'Constructor Web Bvelt'
        }
      });

      // 3. Generate review link / Review QR
      actionsList.push({
        id: 'nba_generate_review_link',
        action: isEn ? 'Generate Google Review Link & Smart QR' : 'Generar Enlace de Reseñas y QR Inteligente',
        title: isEn ? 'Generate Google Review Link & Smart QR' : 'Generar Enlace de Reseñas y QR Inteligente',
        priority: 'HIGH',
        priorityScore: 78,
        reason: isEn
          ? 'Capture honest customer reviews with smart QR and direct links to build local reputation.'
          : 'Consigue opiniones sinceras de clientes con QR inteligente y enlaces directos para consolidar reputación.',
        reasoning: isEn
          ? 'Positive reviews immediately elevate client conversion and word of mouth.'
          : 'Las reseñas positivas elevan de inmediato la conversión y las recomendaciones.',
        expectedBenefit: isEn ? 'Build authentic Google reviews and social proof' : 'Construir reseñas auténticas en Google y prueba social',
        whyNow: isEn ? 'Collecting reviews after every job establishes top market authority.' : 'Pedir reseñas tras cada servicio establece autoridad inmediata.',
        evidence: isEn ? 'Review Booster Engine' : 'Generador de Reseñas Bvelt',
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '2 min',
        estimatedMinutes: 2,
        destinationCode: 'REQUEST_REVIEW',
        destination: { tab: 'reviews' },
        ctaLabel: isEn ? 'Generate Review Link' : 'Generar Enlace QR',
        bveltMoment: {
          whatIsHappening: isEn ? 'Smart QR and direct Google review link generator ready.' : 'Generador de QR inteligente y enlace directo a Google listo.',
          whyItMatters: isEn ? 'Fast review requests build immediate credibility for local buyers.' : 'Pedir reseñas tras cada trabajo genera credibilidad inmediata.',
          opportunitySummary: isEn ? 'Collect verified 5-star customer feedback.' : 'Conseguir valoraciones verificadas de 5 estrellas.',
          recommendedActionNow: isEn ? 'Share your direct review link or QR code with clients.' : 'Compartir tu enlace o código QR de reseñas con clientes.',
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'Bvelt Review Booster' : 'Potenciador de Reseñas Bvelt'
        }
      });

      // 4. Analyze message (tool analyze_msg)
      actionsList.push({
        id: 'nba_analyze_message',
        action: isEn ? 'Analyze Inbound Client Message (WhatsApp/Email)' : 'Analizar Mensaje de Cliente (WhatsApp/Email)',
        title: isEn ? 'Analyze Inbound Client Message (WhatsApp/Email)' : 'Analizar Mensaje de Cliente (WhatsApp/Email)',
        priority: 'HIGH',
        priorityScore: 76,
        reason: isEn
          ? 'Paste any client message to extract intent, estimate pricing, and generate an instant reply.'
          : 'Pega cualquier mensaje o WhatsApp de cliente para extraer intención, estimar precio y redactar respuesta.',
        reasoning: isEn
          ? 'Instant message analysis provides quick pricing and closing recommendations.'
          : 'Analizar mensajes rápidamente permite cotizar con precisión y cerrar en minutos.',
        expectedBenefit: isEn ? 'Convert incoming inquiries into scheduled jobs in <5 min' : 'Convertir consultas entrantes en trabajos confirmados en <5 min',
        whyNow: isEn ? 'Fast analysis on incoming messages gives you a decisive closing edge.' : 'Analizar mensajes con rapidez da ventaja decisiva de cierre.',
        evidence: isEn ? 'Message Intelligence Tool' : 'Herramienta de Análisis de Mensajes',
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '2 min',
        estimatedMinutes: 2,
        destinationCode: 'FOLLOW_UP',
        destination: { tab: 'leads', subRow: 0, tool: 'analyze_msg' },
        ctaLabel: isEn ? 'Analyze Message' : 'Analizar Mensaje',
        bveltMoment: {
          whatIsHappening: isEn ? 'Smart commercial message analyzer ready for WhatsApp and email.' : 'Analizador inteligente de mensajes listo para WhatsApp y correos.',
          whyItMatters: isEn ? 'Instant message analysis provides quick pricing and closing recommendations.' : 'Analizar mensajes rápidamente permite cotizar y cerrar en minutos.',
          opportunitySummary: isEn ? 'Convert incoming inquiries into scheduled jobs.' : 'Convertir consultas entrantes en trabajos confirmados.',
          recommendedActionNow: isEn ? 'Paste customer message to analyze.' : 'Pegar mensaje de cliente para analizar.',
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'Bvelt Message Analyzer' : 'Analizador de Mensajes Bvelt'
        }
      });
    }

    // Rule 9: Profile Completeness check (if not already pushed)
    if (!actionsList.some(a => a.id === 'nba_complete_profile') && (!profile.phone || !profile.hoursSet || (profile.photosCount || 0) < 3)) {
      const actionText = isEn ? 'Complete Business Profile & Local Info' : 'Completar Perfil Comercial e Información Local';
      const reasonText = isEn
        ? 'Complete local business profiles capture significantly more organic search traffic and direct customer calls.'
        : 'Los perfiles comerciales completos capturan significativamente más tráfico de búsqueda y llamadas directas.';

      actionsList.push({
        id: 'nba_complete_profile',
        action: actionText,
        title: actionText,
        priority: 'MEDIUM',
        priorityScore: 60,
        reason: reasonText,
        reasoning: reasonText,
        expectedBenefit: isEn ? 'Increased inbound customer inquiries & verified profile badge' : 'Mayor volumen de consultas de clientes e insignia de perfil verificado',
        whyNow: isEn ? 'Missing contact phone, hours, or photos reduces customer trust.' : 'Falta teléfono, horario o fotos, lo que reduce la confianza del cliente.',
        evidence: isEn ? 'Incomplete Business Profile fields' : 'Campos incompletos en el perfil comercial',
        evidenceLevel: 'VERIFIED',
        confidence: 'HIGH',
        estimatedTime: '5 min',
        estimatedMinutes: 5,
        destinationCode: 'COMPLETE_PROFILE',
        destination: { tab: 'profile', subRow: 0, section: 'settings' },
        ctaLabel: isEn ? 'Complete Profile Now' : 'Completar Perfil Ahora',
        bveltMoment: {
          whatIsHappening: isEn ? 'Business profile missing phone, hours, or photos.' : 'Perfil comercial incompleto en teléfono, horario o fotografías.',
          whyItMatters: isEn ? 'Complete business profiles receive more calls and direct search appearances.' : 'Los perfiles completos capturan significativamente más búsquedas y llamadas.',
          opportunitySummary: isEn ? 'Maximize local profile trust and direct customer calls.' : 'Aumentar la confianza local y captura de llamadas directas.',
          recommendedActionNow: isEn ? 'Complete contact info, hours, and photos in profile settings.' : 'Completar teléfono, horarios y fotos en la configuración del perfil.',
          evidenceStatus: 'VERIFIED',
          evidenceSource: isEn ? 'Business Profile Settings' : 'Perfil de Negocio Bvelt'
        }
      });
    }

    // Rule 10: Territory Radar Scan if territory data available
    if (marketContext.city || profile.city || profile.location) {
      const cityName = marketContext.city || profile.city || profile.location;
      const isZeroDensity = hasZeroCompetitors && businessLeads.length === 0;
      const actionText = isZeroDensity
        ? (isEn ? 'Map with no listings; prioritize messaging and website' : 'Mapas sin fichas; prioriza mensaje y web')
        : (isEn ? `Scan Prospecting Radar in ${cityName}` : `Escanear Radar de Prospectos en ${cityName}`);
      const reasonText = isZeroDensity
        ? (isEn ? 'Map with no listings; prioritize messaging and website' : 'Mapas sin fichas; prioriza mensaje y web')
        : (isEn ? 'Scan local territory to capture nearby unserved demand and uncontacted leads.' : 'Escanea el territorio local para capturar demanda desatendida y nuevos clientes.');

      actionsList.push({
        id: 'nba_scan_radar',
        action: actionText,
        title: actionText,
        priority: isZeroDensity ? 'LOW' : 'MEDIUM',
        priorityScore: isZeroDensity ? 30 : 50,
        reason: reasonText,
        reasoning: reasonText,
        expectedBenefit: isEn ? 'Discover local sales opportunities in radius' : 'Descubrir oportunidades comerciales en tu radio',
        whyNow: isZeroDensity
          ? (isEn ? 'Map layer has zero indexed listings; direct capture channels are recommended.' : 'La capa del mapa no tiene fichas registradas; se recomienda captación directa.')
          : (isEn ? 'Proactive local prospecting maintains a steady deal pipeline.' : 'El prospección local constante mantiene el flujo continuo de clientes.'),
        evidence: isEn ? 'Territory Scan Engine' : 'Motor de Escaneo Territorial',
        evidenceLevel: 'DERIVED',
        confidence: 'MEDIUM',
        estimatedTime: '2 min',
        estimatedMinutes: 2,
        destinationCode: 'FIND_LOCAL_LEADS',
        destination: { tab: 'radar', subRow: 1, section: 'growth' },
        ctaLabel: isEn ? 'Scan Territory' : 'Escanear Territorio',
        bveltMoment: {
          whatIsHappening: isEn ? `Territory scan in ${cityName} for ${niche}.` : `Radar territorial en ${cityName} para la categoría ${niche}.`,
          whyItMatters: isEn ? 'Direct commercial tools capture demand when map listings are sparse.' : 'Las herramientas directas capturan clientes cuando no hay fichas en el mapa.',
          opportunitySummary: isEn ? 'Explore local search radius.' : 'Explorar radio de búsqueda local.',
          recommendedActionNow: isEn ? 'Scan territory radar or use direct web and messaging tools.' : 'Escanear territorio o usar herramientas de web y mensajes.',
          evidenceStatus: 'DERIVED',
          evidenceSource: isEn ? 'Territory Scan Radar' : 'Radar Territorial Bvelt'
        }
      });
    }

    // Rule 11: Ensure at least 3 useful actions on fallback / few-data state
    if (actionsList.length < 3) {
      const isZeroDensity = hasZeroCompetitors && businessLeads.length === 0;
      if (!actionsList.some(a => a.id === 'nba_expand_radius' || a.id.includes('radar'))) {
        actionsList.push({
          id: 'nba_expand_radius',
          action: isZeroDensity 
            ? (isEn ? 'Map with no listings; prioritize messaging and website' : 'Mapas sin fichas; prioriza mensaje y web')
            : (isEn ? 'Expand Search Radius (10-20 km)' : 'Ampliar Radio de Búsqueda (10–20 km)'),
          title: isZeroDensity 
            ? (isEn ? 'Map with no listings; prioritize messaging and website' : 'Mapas sin fichas; prioriza mensaje y web')
            : (isEn ? 'Expand Search Radius (10-20 km)' : 'Ampliar Radio de Búsqueda (10–20 km)'),
          priority: isZeroDensity ? 'LOW' : 'HIGH',
          priorityScore: isZeroDensity ? 25 : 55,
          reason: isZeroDensity 
            ? (isEn ? 'Map with no listings; prioritize messaging and website' : 'Mapas sin fichas; prioriza mensaje y web')
            : (isEn ? 'Cover a wider geographic zone to capture additional local demand and competitors.' : 'Abarca un radio geográfico más amplio para captar competidores y demanda adicional en tu zona.'),
          reasoning: isZeroDensity 
            ? (isEn ? 'Map with no listings; prioritize messaging and website' : 'Mapas sin fichas; prioriza mensaje y web')
            : (isEn ? 'Expanding radius increases node coverage and commercial discovery.' : 'Ampliar el radio permite capturar más nodos comerciales y oportunidades en el mapa.'),
          expectedBenefit: isEn ? 'Discover 5-20 local service nodes' : 'Descubrir de 5 a 20 nodos comerciales locales',
          whyNow: isEn ? 'Current search zone has limited active nodes.' : 'El radio actual tiene pocos nodos comerciales registrados.',
          evidence: isEn ? 'Territory Radius Setting' : 'Ajuste de Radio Territorial',
          evidenceLevel: 'DERIVED',
          confidence: 'MEDIUM',
          estimatedTime: '1 min',
          estimatedMinutes: 1,
          destinationCode: 'FIND_LOCAL_LEADS',
          destination: { tab: 'radar', subRow: 1, section: 'growth' },
          ctaLabel: isEn ? 'Expand Search Radius' : 'Ampliar Radio de Búsqueda',
          bveltMoment: {
            whatIsHappening: isEn ? 'Search radius can be expanded to discover more territory opportunities.' : 'El radio de búsqueda puede ampliarse para descubrir más oportunidades territoriales.',
            whyItMatters: isEn ? 'Wider coverage detects more service clusters in surrounding neighborhoods.' : 'Una mayor cobertura detecta clústeres de servicios en zonas aledañas.',
            opportunitySummary: isEn ? 'Uncover 5-20 market nodes in surrounding radius.' : 'Detectar de 5 a 20 nodos comerciales en el radio ampliado.',
            recommendedActionNow: isEn ? 'Expand radius to 10 km or 20 km to scan more area.' : 'Ampliar el radio a 10 km o 20 km para abarcar más área.',
            evidenceStatus: 'DERIVED',
            evidenceSource: isEn ? 'Territory Scan Radar' : 'Radar Territorial Bvelt'
          }
        });
      }

      if (!actionsList.some(a => a.id === 'nba_complete_profile')) {
        actionsList.push({
          id: 'nba_complete_profile',
          action: isEn ? 'Complete Business Profile & Niche' : 'Completar Perfil de Negocio y Nicho',
          title: isEn ? 'Complete Business Profile & Niche' : 'Completar Perfil de Negocio y Nicho',
          priority: 'HIGH',
          priorityScore: 50,
          reason: isEn 
            ? 'Configuring your exact category, city, and phone calibrates personalized audits.' 
            : 'Configura tu categoría exacta, ciudad y teléfono para calibrar auditorías personalizadas.',
          reasoning: isEn 
            ? 'A complete business profile enables verified trust scores and accurate benchmarks.' 
            : 'Un perfil completo permite calcular scores de confianza y benchmarks precisos.',
          expectedBenefit: isEn ? 'Unlock calibrated local diagnostics' : 'Desbloquear diagnósticos locales calibrados',
          whyNow: isEn ? 'Accurate category mapping improves scan precision.' : 'El mapeo exacto de categoría mejora la precisión del escaneo.',
          evidence: isEn ? 'Business Profile Settings' : 'Configuración de Perfil Comercial',
          evidenceLevel: 'VERIFIED',
          confidence: 'HIGH',
          estimatedTime: '2 min',
          estimatedMinutes: 2,
          destinationCode: 'COMPLETE_PROFILE',
          destination: { tab: 'profile', subRow: 0, section: 'settings' },
          ctaLabel: isEn ? 'Complete Business Profile' : 'Completar Perfil de Negocio',
          bveltMoment: {
            whatIsHappening: isEn ? 'Business profile configuration pending calibration.' : 'Configuración del perfil comercial pendiente de calibrar.',
            whyItMatters: isEn ? 'Precise niche and location tags ensure relevant competitor benchmarking.' : 'Las etiquetas precisas aseguran una comparación relevante con competidores.',
            opportunitySummary: isEn ? 'Calibrate commercial audit for your specific trade.' : 'Calibrar la auditoría comercial para tu oficio específico.',
            recommendedActionNow: isEn ? 'Review niche, service area, and contact details.' : 'Revisar nicho, zona de servicio y datos de contacto.',
            evidenceStatus: 'VERIFIED',
            evidenceSource: isEn ? 'Bvelt Profile Engine' : 'Perfil de Negocio Bvelt'
          }
        });
      }

      if (!actionsList.some(a => a.id === 'nba_rescan_market')) {
        actionsList.push({
          id: 'nba_rescan_market',
          action: isEn ? 'Retry Local Market Scan' : 'Reintentar Escaneo de Mercado',
          title: isEn ? 'Retry Local Market Scan' : 'Reintentar Escaneo de Mercado',
          priority: 'MEDIUM',
          priorityScore: 45,
          reason: isEn 
            ? 'Run a fresh multi-source scan to capture updated business nodes and signals.' 
            : 'Ejecuta un escaneo multi-proveedor fresco para capturar nodos comerciales y señales actualizadas.',
          reasoning: isEn 
            ? 'A fresh scan queries live OpenStreetMap and geographic databases.' 
            : 'Un escaneo fresco consulta las bases geográficas de OpenStreetMap en tiempo real.',
          expectedBenefit: isEn ? 'Update live competitor signals' : 'Actualizar señales de competidores en vivo',
          whyNow: isEn ? 'Re-scanning synchronizes fresh map coordinates and local businesses.' : 'Re-escanear sincroniza coordenadas frescas y negocios locales.',
          evidence: isEn ? 'Market Scanner' : 'Escáner de Mercado',
          evidenceLevel: 'DERIVED',
          confidence: 'MEDIUM',
          estimatedTime: '1 min',
          estimatedMinutes: 1,
          destinationCode: 'FIND_LOCAL_LEADS',
          destination: { tab: 'business_scan' },
          ctaLabel: isEn ? 'Retry Market Scan' : 'Reintentar Escaneo',
          bveltMoment: {
            whatIsHappening: isEn ? 'Market scanner ready for a fresh territorial pass.' : 'Escáner de mercado listo para una nueva pasada territorial.',
            whyItMatters: isEn ? 'Refreshed queries capture newly indexed service providers.' : 'Las consultas actualizadas capturan proveedores recién indexados.',
            opportunitySummary: isEn ? 'Sync live territorial map.' : 'Sincronizar mapa territorial en vivo.',
            recommendedActionNow: isEn ? 'Trigger live scan to update map nodes.' : 'Lanzar escaneo para actualizar los nodos del mapa.',
            evidenceStatus: 'DERIVED',
            evidenceSource: isEn ? 'Bvelt Scan Engine' : 'Motor de Escaneo Bvelt'
          }
        });
      }
    }

    // Canonical Deduplication: Ensure each action has one canonical identity and no duplicate titles/actions appear
    const uniqueActionsMap = new Map<string, NextBestAction>();

    for (const act of actionsList) {
      const leadId = act.contextData?.leadId || '';
      const dedupeKey = act.id 
        ? act.id 
        : (leadId ? `${act.destinationCode}_${leadId}` : `${act.action}_${act.destination?.tab || ''}`);
      
      if (!uniqueActionsMap.has(dedupeKey)) {
        uniqueActionsMap.set(dedupeKey, act);
      } else {
        const existing = uniqueActionsMap.get(dedupeKey)!;
        if ((act.priorityScore || 0) > (existing.priorityScore || 0)) {
          uniqueActionsMap.set(dedupeKey, act);
        }
      }
    }

    // Secondary pass: Deduplicate by exact Action Title string + lead/destination context
    const finalUniqueActionsMap = new Map<string, NextBestAction>();
    for (const act of uniqueActionsMap.values()) {
      const leadId = act.contextData?.leadId || '';
      const actionTitleKey = `${act.action || act.title}_${leadId || act.destinationCode || ''}`;
      if (!finalUniqueActionsMap.has(actionTitleKey)) {
        finalUniqueActionsMap.set(actionTitleKey, act);
      } else {
        const existing = finalUniqueActionsMap.get(actionTitleKey)!;
        if ((act.priorityScore || 0) > (existing.priorityScore || 0)) {
          finalUniqueActionsMap.set(actionTitleKey, act);
        }
      }
    }

    const dedupedActions = Array.from(finalUniqueActionsMap.values());

    // Task P3-1 (BEM Quiet Learning): Rank suggestions using historical BEM outcome data if available, else rules fallback
    try {
      const storedConversions = this.getConversionHistory();
      if (storedConversions && storedConversions.length > 0) {
        for (const act of dedupedActions) {
          const matchingConversions = storedConversions.filter(c => 
            (c.actionType && (c.actionType === (act.destinationCode as any))) ||
            (c.actionId && c.actionId === act.id)
          );
          if (matchingConversions.length > 0) {
            const hasWon = matchingConversions.some(c => 
              c.outcomeType === 'WON' || (c.revenue && c.revenue > 0)
            );
            const boost = hasWon ? 20 : 10;
            act.priorityScore = (act.priorityScore || 50) + boost;
            act.evidence = (act.evidence ? `${act.evidence} • ` : '') + (isEn ? `BEM Historical Conversion Boost (+${boost} pts)` : `Impulso de Conversión Histórica BEM (+${boost} pts)`);
          }
        }
      }

      // Quiet Learning: Read preferred action types from BusinessDNA memory
      const uid = auth?.currentUser?.uid || 'current_user';
      const dnaProfile = BusinessDnaService.getProfileSync(uid);
      const topPreferred = dnaProfile?.preferredActionTypes?.topPreferredActions || [];
      if (topPreferred.length > 0) {
        for (const act of dedupedActions) {
          const actType = act.destinationCode || act.id || '';
          if (topPreferred.some(p => p && (actType.toLowerCase().includes(p.toLowerCase()) || (p as string).toLowerCase().includes((act.destinationCode || '').toLowerCase())))) {
            act.priorityScore = (act.priorityScore || 50) + 8;
          }
        }
      }
    } catch (bemRankErr) {
      // Non-blocking fallback to default deterministic rules
    }

    dedupedActions.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0) || (a.id || '').localeCompare(b.id || ''));

    // Pass through Review Compliance Firewall
    const compliantActions: NextBestAction[] = [];
    for (const act of dedupedActions) {
      const compliance = ReviewComplianceFirewall.evaluateAction(act, isEn ? 'en' : 'es');
      if (compliance.decision === 'BLOCK') {
        // Suppress non-compliant action
        continue;
      } else if (compliance.decision === 'MODIFY' && compliance.action) {
        compliantActions.push(compliance.action);
      } else {
        compliantActions.push(act);
      }
    }

    return compliantActions;
  }

  /**
   * Determines the Next Best Action for a given Lead / Contact
   * Guarantees 1 single, high-priority recommended action with clear reason, time, evidence, and destination.
   */
  static getNextBestActionForLead(lead: any, lang: 'es' | 'en' = 'es'): NextBestActionRecommendation {
    const isEn = lang === 'en';
    const status = (lead.status || 'NEW').toUpperCase();
    const lastContact = lead.lastContact;
    const quotes = this.getStoredQuotes().filter(q => q.leadId === lead.id || (lead.client && q.leadName === lead.client) || (lead.businessName && q.leadName === lead.businessName));
    const pendingQuote = quotes.find(q => q.status === 'SENT');
    const wonQuote = quotes.find(q => q.status === 'WON');

    if (wonQuote || status === 'CLIENT' || status === 'WON') {
      return {
        actionCode: 'REQUEST_REVIEW',
        label: isEn ? 'Request Customer Review' : 'Solicitar Reseña al Cliente',
        priority: 'HIGH',
        reason: isEn 
          ? 'Client successfully serviced. Asking for honest feedback right after completion yields high response.'
          : 'Trabajo completado. Pedir una reseña sincera al completar el servicio genera la mayor tasa de respuesta.',
        estimatedTime: '2 min',
        evidence: isEn ? 'Verified conversion' : 'Conversión verificada',
        destination: { tab: 'reviews', subRow: 0, section: 'social' }
      };
    }

    if (pendingQuote) {
      return {
        actionCode: 'FOLLOW_UP',
        label: isEn ? 'Follow Up on Quote' : 'Hacer Seguimiento de Cotización',
        priority: 'HIGH',
        reason: isEn 
          ? `Quote of $${pendingQuote.totalAmount} sent on ${pendingQuote.date}. Follow up to close before customer contacts competitors.`
          : `Cotización de $${pendingQuote.totalAmount} enviada el ${pendingQuote.date}. Seguimiento recomendado para cerrar el trato.`,
        estimatedTime: '3 min',
        evidence: isEn ? `Quote #${pendingQuote.id.slice(-4)} active` : `Cotización #${pendingQuote.id.slice(-4)} activa`,
        destination: { tab: 'estimator', subRow: 0, section: 'tools' }
      };
    }

    if (status === 'RESPONDED') {
      return {
        actionCode: 'SEND_QUOTE',
        label: isEn ? 'Send Formal Estimate' : 'Emitir Presupuesto Formal',
        priority: 'HIGH',
        reason: isEn 
          ? 'Prospect responded showing interest. Delivering an immediate itemized quote significantly improves close rate.'
          : 'El prospecto mostró interés. Enviar un presupuesto desglosado rápido aumenta notablemente la tasa de cierre.',
        estimatedTime: '4 min',
        evidence: isEn ? 'Direct customer reply' : 'Respuesta directa del cliente',
        destination: { tab: 'estimator', subRow: 0, section: 'tools' }
      };
    }

    if (status === 'CONTACTED') {
      return {
        actionCode: 'FOLLOW_UP',
        label: isEn ? 'Follow Up in 48h' : 'Hacer Segundo Contacto',
        priority: 'MEDIUM',
        reason: isEn 
          ? `First contact made on ${lastContact || 'recently'}. Consistent follow-up maintains warm customer interest.`
          : `Primer contacto el ${lastContact || 'recientemente'}. El seguimiento oportuno mantiene el interés del cliente.`,
        estimatedTime: '2 min',
        evidence: isEn ? 'Contact logged' : 'Contacto registrado',
        destination: { tab: 'client_acquisition', subRow: 4, section: 'clients' }
      };
    }

    if (status === 'LOST') {
      return {
        actionCode: 'REACTIVATE_CLIENT',
        label: isEn ? 'Reactivate in 30 Days' : 'Reactivar en 30 Días',
        priority: 'LOW',
        reason: isEn 
          ? 'Prospect not ready currently. Seasonal re-engagement can recover valuable pipeline.'
          : 'Prospecto no interesado por ahora. Ofertas de temporada permiten recuperar oportunidades inactivas.',
        estimatedTime: '3 min',
        evidence: isEn ? 'Archived record' : 'Registro archivado',
        destination: { tab: 'client_acquisition', subRow: 4, section: 'clients' }
      };
    }

    // Default: NEW / UNCONTACTED
    return {
      actionCode: 'CONTACT_TODAY',
      label: isEn ? 'Contact Today (WhatsApp / Call)' : 'Contactar Hoy (WhatsApp / Llamada)',
      priority: 'HIGH',
      reason: isEn 
        ? 'High conversion window. Reaching out within the first 24h yields maximum conversion probability.'
        : 'Ventana de alta conversión. Contactar en las primeras 24h maximiza la probabilidad de contratación.',
      estimatedTime: '2 min',
      evidence: isEn ? 'New uncontacted lead' : 'Lead nuevo sin contactar',
      destination: { tab: 'client_acquisition', subRow: 4, section: 'clients', filter: 'NEW' }
    };
  }

  /**
   * Computes live Conversion Funnel Metrics
   * Opportunities -> Actions Executed -> Contacts Made -> Quotes -> Won -> Revenue
   */
  static getConversionMetrics(totalOpportunitiesDetected: number = 0): ConversionFunnelMetrics {
    const actions = this.getStoredActions();
    const conversions = this.getConversionHistory();
    const quotes = this.getStoredQuotes();

    const actionsExecuted = actions.filter(a => a.status === 'IN_PROGRESS' || a.status === 'COMPLETED').length;
    
    let contactsMade = 0;
    let repliesReceived = 0;
    let quotesSent = quotes.length;
    let dealsWon = 0;
    let revenueRecorded = 0;

    conversions.forEach(c => {
      if (c.outcomeType === 'CONTACTED') contactsMade++;
      else if (c.outcomeType === 'REPLIED' || c.outcomeType === 'SCHEDULED') {
        contactsMade++;
        repliesReceived++;
      } else if (c.outcomeType === 'ESTIMATE_SENT') {
        contactsMade++;
        if (quotes.length === 0) quotesSent++;
      } else if (c.outcomeType === 'WON') {
        contactsMade++;
        dealsWon++;
        revenueRecorded += (c.revenue || 0);
      }
    });

    // Also include Won quotes if not already in conversions
    quotes.forEach(q => {
      if (q.status === 'WON') {
        const rev = q.confirmedRevenue ?? q.totalAmount;
        // If not already summed in conversions
        if (!conversions.some(c => c.outcomeType === 'WON' && c.id === `conv_won_${q.id}`)) {
          dealsWon++;
          revenueRecorded += rev;
        }
      }
    });

    const conversionRate = contactsMade > 0 
      ? Math.min(100, Math.round((dealsWon / contactsMade) * 100)) 
      : null;

    const avgTicket = dealsWon > 0 ? Math.round(revenueRecorded / dealsWon) : null;

    return {
      opportunitiesDetected: Math.max(totalOpportunitiesDetected, actions.length),
      actionsExecuted,
      contactsMade,
      repliesReceived,
      quotesSent,
      dealsWon,
      revenueRecorded,
      conversionRate,
      avgTicket
    };
  }

  /**
   * Action Tool Catalog & Autonomy Execution Integration
   */
  static getToolCatalog() {
    return ActionToolCatalog.getToolCatalog();
  }

  static getAutonomyPolicy(businessId: string): AutonomyPolicy {
    return AutonomyPolicyEngine.getPolicy(businessId);
  }

  static setAutonomyLevel(businessId: string, level: AutonomyLevel): AutonomyPolicy {
    return AutonomyPolicyEngine.setAutonomyLevel(businessId, level);
  }

  static evaluateAutonomyPolicy(
    businessId: string,
    toolId: ActionEngineToolId,
    context?: any
  ): PolicyDecision {
    return AutonomyPolicyEngine.evaluate(businessId, toolId, context);
  }

  static async executeCanonicalTool(
    toolId: ActionEngineToolId,
    input: any,
    options?: ExecutionOptions
  ): Promise<ToolExecutionReport> {
    return ActionToolCatalog.executeTool(toolId, input, options);
  }

  static getOutcomeLedger(businessId?: string): OutcomeLedgerEntry[] {
    return OutcomeLedgerService.getEntries(businessId);
  }
}
