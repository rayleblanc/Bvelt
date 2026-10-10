/**
 * BVELT Operational Score Service
 * 
 * Score comercial para el negocio (0–100) derivado de eventos BEM reales:
 * - Lead response (0–20 pts)
 * - Quote follow-up (0–20 pts)
 * - Reputation (0–20 pts)
 * - Customer recovery (0–20 pts)
 * - Reliability (0–20 pts)
 * 
 * Reglas de integridad:
 * - NO APIs a lenders ni insurers.
 * - NO es un "credit score"; es el Score de Eficiencia Operativa y Salud Comercial de Bvelt.
 * - NO venta de datos a terceros.
 * - Identifica explícitamente: "Tu mayor fuga actual: …" con CTA accionable.
 * - Comparativa: Solo contra sí mismo al inicio (histórico propio).
 * - Benchmark de nicho: Solo si hay N suficiente (N >= 10) y agregados anonimizados. Si no hay N, no inventar.
 */

import { getBemEvents, BemEventRecord } from '../knowledge/memory/bemStore';
import { OutcomeLedgerService } from '../knowledge/memory/outcomeLedgerService';

export interface PillarScore {
  key: 'lead_response' | 'quote_followup' | 'reputation' | 'customer_recovery' | 'reliability';
  name: string;
  score: number; // 0–20
  maxScore: 20;
  weight: number; // 0.20
  status: 'optimal' | 'attention' | 'critical';
  detail: string;
}

export interface OperationalScoreReport {
  totalScore: number; // 0–100
  pillars: {
    leadResponse: PillarScore;
    quoteFollowup: PillarScore;
    reputation: PillarScore;
    customerRecovery: PillarScore;
    reliability: PillarScore;
  };
  biggestLeak: {
    pillarKey: string;
    pillarName: string;
    leakText: string;
    lostPoints: number;
    recommendedAction: string;
    destinationTab: string;
    ctaLabel: string;
  };
  historicalComparison: {
    previousScore: number | null;
    scoreDelta: number;
    comparisonText: string;
  };
  nicheBenchmark: {
    hasSufficientN: boolean;
    sampleSize: number;
    minRequiredN: 10;
    benchmarkScore?: number;
    benchmarkText: string;
  };
  computedAt: string;
}

const STORAGE_SCORE_HISTORY_KEY = 'bvelt_score_history_v1';

export class OperationalScoreService {
  /**
   * Calcula el score determinista 0–100 a partir de eventos BEM y Outcome Ledger
   */
  static calculateScore(tenantId?: string): OperationalScoreReport {
    const events = getBemEvents(tenantId);
    const ledgerAttribution = OutcomeLedgerService.getFinancialAttribution(tenantId);

    // Filtrar eventos de los últimos 30 días para calcular la cadencia actual
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(e => {
      const ts = new Date(e.timestamp);
      return !isNaN(ts.getTime()) && ts >= thirtyDaysAgo;
    });

    // 1. Lead Response (0–20 pts)
    // Eventos: analyze_message_success, share_opened con respuesta
    const leadResponseEvents = recentEvents.filter(e => 
      ['analyze_message_success', 'share_opened'].includes(e.type)
    );
    const leadReplies = ledgerAttribution.leadsContactedCount;
    let leadResponseScore = 6; // Baseline mínimo
    if (leadResponseEvents.length > 0 || leadReplies > 0) {
      leadResponseScore += Math.min(14, (leadResponseEvents.length * 3) + (leadReplies * 2));
    }
    leadResponseScore = Math.min(20, Math.max(0, leadResponseScore));

    // 2. Quote Follow-up (0–20 pts)
    // Eventos: estimate_followup_prepared, estimate_followup
    const quoteEvents = recentEvents.filter(e => 
      ['estimate_followup_prepared', 'estimate_followup'].includes(e.type)
    );
    const estimatesSent = ledgerAttribution.estimatesSentCount;
    let quoteScore = 4; // Baseline
    if (quoteEvents.length > 0 || estimatesSent > 0) {
      quoteScore += Math.min(16, (quoteEvents.length * 4) + (estimatesSent * 3));
    }
    quoteScore = Math.min(20, Math.max(0, quoteScore));

    // 3. Reputation (0–20 pts)
    // Eventos: review_draft_created, review_request
    const reviewEvents = recentEvents.filter(e => 
      ['review_draft_created', 'review_request'].includes(e.type)
    );
    const reviewsRequested = ledgerAttribution.reviewsRequestedCount;
    let reputationScore = 5; // Baseline
    if (reviewEvents.length > 0 || reviewsRequested > 0) {
      reputationScore += Math.min(15, (reviewEvents.length * 4) + (reviewsRequested * 3));
    }
    reputationScore = Math.min(20, Math.max(0, reputationScore));

    // 4. Customer Recovery (0–20 pts)
    // Eventos: dormant_rescue_started, reactivate_generate, owner_marked_recovered
    const rescueEvents = recentEvents.filter(e => 
      ['dormant_rescue_started', 'reactivate_generate', 'owner_marked_recovered'].includes(e.type)
    );
    const wonCount = ledgerAttribution.wonRevenue > 0 ? 2 : 0;
    let recoveryScore = 4; // Baseline
    if (rescueEvents.length > 0 || wonCount > 0) {
      recoveryScore += Math.min(16, (rescueEvents.length * 5) + (wonCount * 3));
    }
    recoveryScore = Math.min(20, Math.max(0, recoveryScore));

    // 5. Reliability (0–20 pts)
    // Outcome Ledger auditado: MEASURED count, consistencia y trazabilidad
    let reliabilityScore = 6;
    if (ledgerAttribution.measuredCount >= 1) reliabilityScore += 6;
    if (ledgerAttribution.measuredCount >= 3) reliabilityScore += 4;
    if (recentEvents.length >= 5) reliabilityScore += 4;
    reliabilityScore = Math.min(20, Math.max(0, reliabilityScore));

    // Suma Total (0 a 100)
    const totalScore = leadResponseScore + quoteScore + reputationScore + recoveryScore + reliabilityScore;

    // Pilares estructurados
    const pillars: OperationalScoreReport['pillars'] = {
      leadResponse: {
        key: 'lead_response',
        name: 'Respuesta a Prospectos',
        score: leadResponseScore,
        maxScore: 20,
        weight: 0.20,
        status: leadResponseScore >= 16 ? 'optimal' : leadResponseScore >= 10 ? 'attention' : 'critical',
        detail: `${leadResponseEvents.length} análisis de contacto en los últimos 30 días.`
      },
      quoteFollowup: {
        key: 'quote_followup',
        name: 'Seguimiento de Presupuestos',
        score: quoteScore,
        maxScore: 20,
        weight: 0.20,
        status: quoteScore >= 16 ? 'optimal' : quoteScore >= 10 ? 'attention' : 'critical',
        detail: `${quoteEvents.length} seguimientos preparados en CRM.`
      },
      reputation: {
        key: 'reputation',
        name: 'Reputación & Reseñas',
        score: reputationScore,
        maxScore: 20,
        weight: 0.20,
        status: reputationScore >= 16 ? 'optimal' : reputationScore >= 10 ? 'attention' : 'critical',
        detail: `${reviewEvents.length} borradores de reseña redactados.`
      },
      customerRecovery: {
        key: 'customer_recovery',
        name: 'Rescate de Clientes Inactivos',
        score: recoveryScore,
        maxScore: 20,
        weight: 0.20,
        status: recoveryScore >= 16 ? 'optimal' : recoveryScore >= 10 ? 'attention' : 'critical',
        detail: `${rescueEvents.length} campañas de rescate iniciadas.`
      },
      reliability: {
        key: 'reliability',
        name: 'Consistencia Operativa',
        score: reliabilityScore,
        maxScore: 20,
        weight: 0.20,
        status: reliabilityScore >= 16 ? 'optimal' : reliabilityScore >= 10 ? 'attention' : 'critical',
        detail: `${ledgerAttribution.measuredCount} resultados medidos con evidencia auditable.`
      }
    };

    // Identificar "Tu mayor fuga actual" (pilar con mayor deficit de puntos)
    const pillarList = [
      pillars.quoteFollowup,
      pillars.customerRecovery,
      pillars.reputation,
      pillars.leadResponse,
      pillars.reliability
    ];

    pillarList.sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score));
    const worstPillar = pillarList[0];
    const lostPoints = worstPillar.maxScore - worstPillar.score;

    let leakText = '';
    let recommendedAction = '';
    let destinationTab = 'execute';
    let ctaLabel = 'Resolver Fuga';

    switch (worstPillar.key) {
      case 'quote_followup':
        leakText = 'Presupuestos entregados sin recordatorio sistematizado a las 48h';
        recommendedAction = 'Redactar y despachar mensaje de seguimiento para presupuestos pendientes';
        destinationTab = 'estimator';
        ctaLabel = 'Preparar Seguimiento';
        break;
      case 'customer_recovery':
        leakText = 'Clientes inactivos de hace más de 6 meses sin propuesta de reactivación';
        recommendedAction = 'Iniciar rescate por WhatsApp con propuesta de mantenimiento preventivo';
        destinationTab = 'tools';
        ctaLabel = 'Lanzar Rescate';
        break;
      case 'reputation':
        leakText = 'Trabajos completados sin solicitud formal de reseña 5★ en Google';
        recommendedAction = 'Generar borrador de solicitud de reseña para tus últimos 3 clientes';
        destinationTab = 'reviews';
        ctaLabel = 'Solicitar Reseñas';
        break;
      case 'lead_response':
        leakText = 'Fricción en la velocidad de primera respuesta a consultas entrantes';
        recommendedAction = 'Atender y responder prospectos nuevos acumulados en la bandeja';
        destinationTab = 'leads';
        ctaLabel = 'Atender Prospectos';
        break;
      case 'reliability':
      default:
        leakText = 'Resultados de trabajos sin confirmar ni registrar en el Ledger';
        recommendedAction = 'Confirmar trabajos ganados para auditar tu retorno de inversión real';
        destinationTab = 'execute';
        ctaLabel = 'Auditar Ledger';
        break;
    }

    // Histórico propio (Comparar solo contra sí mismo al inicio)
    const history = this.getScoreHistory();
    const previousScore = history.length > 0 ? history[history.length - 1].score : null;
    const scoreDelta = previousScore !== null ? totalScore - previousScore : 0;

    const comparisonText = previousScore !== null
      ? (scoreDelta >= 0
          ? `+${scoreDelta} pts vs tu registro anterior (${previousScore}/100)`
          : `${scoreDelta} pts vs tu registro anterior (${previousScore}/100)`)
      : 'Línea base inicial registrada hoy (comparando contra tu propio histórico)';

    // Benchmark de nicho: Solo si hay N suficiente (>= 10) y agregados anonimizados. Si no hay N, NO inventar cifras.
    const currentLocalN = 0; // Sin datos agregados suficientes de terceros aún
    const nicheBenchmark: OperationalScoreReport['nicheBenchmark'] = {
      hasSufficientN: false,
      sampleSize: currentLocalN,
      minRequiredN: 10,
      benchmarkText: 'Benchmark de nicho: Recopilando muestra agregada anonimizada (se requiere N ≥ 10 negocios verificados en tu zona). Comparando únicamente contra tu histórico propio.'
    };

    const report: OperationalScoreReport = {
      totalScore,
      pillars,
      biggestLeak: {
        pillarKey: worstPillar.key,
        pillarName: worstPillar.name,
        leakText,
        lostPoints,
        recommendedAction,
        destinationTab,
        ctaLabel
      },
      historicalComparison: {
        previousScore,
        scoreDelta,
        comparisonText
      },
      nicheBenchmark,
      computedAt: new Date().toISOString()
    };

    // Guardar snapshot histórico si es nuevo día
    this.recordScoreSnapshot(totalScore);

    return report;
  }

  private static getScoreHistory(): Array<{ date: string; score: number }> {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_SCORE_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static recordScoreSnapshot(score: number): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const history = this.getScoreHistory();
      const todayStr = new Date().toISOString().split('T')[0];
      const lastEntry = history[history.length - 1];

      if (!lastEntry || lastEntry.date !== todayStr) {
        history.push({ date: todayStr, score });
        if (history.length > 30) history.shift();
        localStorage.setItem(STORAGE_SCORE_HISTORY_KEY, JSON.stringify(history));
      }
    } catch (e) {
      console.warn('Error recording score snapshot:', e);
    }
  }
}
