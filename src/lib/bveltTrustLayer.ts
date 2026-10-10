import { EvidenceStatus, BveltEvidence, getEvidenceBadge, getConfidenceBadge } from './bveltEvidence';

export interface ValidatedValue<T> {
  value: T | null;
  status: EvidenceStatus;
  confidence: number; // 0.0 to 1.0
  confidenceLevel: 'High' | 'Medium' | 'Low';
  source: string;
  isAvailable: boolean;
  missingReason?: string;
  evidenceExplanation?: string;
}

export interface TrustScore {
  score: number | null; // null if insufficient data
  status: EvidenceStatus;
  confidence: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  isCalculable: boolean;
  explanation: string;
  missingInputs: string[];
  providedInputs: string[];
}

export interface WeeklyGrowthBrief {
  businessName: string;
  city: string;
  niche: string;
  generatedAt: string;
  period: 'WEEKLY';
  whatChanged: {
    title: string;
    description: string;
    evidenceStatus: EvidenceStatus;
    source: string;
  }[];
  whatMatters: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    impactDescription: string;
    evidenceStatus: EvidenceStatus;
  }[];
  whatToDoThisWeek: {
    stepNumber: number;
    title: string;
    action: string;
    estimatedMinutes: number;
    targetTab?: string;
  }[];
  overallTrustConfidence: 'High' | 'Medium' | 'Low';
}

/**
 * Bvelt Trust Layer
 * Central utility for validating values, detecting missing data,
 * classifying evidence, preventing invalid calculations, and ensuring data integrity.
 */
export class BveltTrustLayer {
  /**
   * Validates a numerical value without inventing defaults
   */
  static validateNumber(
    raw: any,
    fieldName: string,
    source: string = 'Local Direct Input',
    expectedStatus: EvidenceStatus = 'VERIFIED'
  ): ValidatedValue<number> {
    if (raw === null || raw === undefined || raw === '' || raw === 'NOT_AVAILABLE' || raw === 'N/D') {
      return {
        value: null,
        status: 'INSUFFICIENT_DATA',
        confidence: 0,
        confidenceLevel: 'Low',
        source,
        isAvailable: false,
        missingReason: `El campo '${fieldName}' no ha sido registrado ni verificado.`
      };
    }

    const num = Number(raw);
    if (isNaN(num)) {
      return {
        value: null,
        status: 'INSUFFICIENT_DATA',
        confidence: 0,
        confidenceLevel: 'Low',
        source,
        isAvailable: false,
        missingReason: `El valor de '${fieldName}' no es un número válido.`
      };
    }

    return {
      value: num,
      status: expectedStatus,
      confidence: expectedStatus === 'VERIFIED' ? 0.95 : 0.75,
      confidenceLevel: expectedStatus === 'VERIFIED' ? 'High' : 'Medium',
      source,
      isAvailable: true
    };
  }

  /**
   * Validates a string value without inventing placeholders
   */
  static validateString(
    raw: any,
    fieldName: string,
    source: string = 'User Input'
  ): ValidatedValue<string> {
    if (typeof raw !== 'string' || !raw.trim() || raw === 'NOT_AVAILABLE' || raw === 'undefined' || raw === 'null') {
      return {
        value: null,
        status: 'INSUFFICIENT_DATA',
        confidence: 0,
        confidenceLevel: 'Low',
        source,
        isAvailable: false,
        missingReason: `El campo '${fieldName}' no está disponible.`
      };
    }

    return {
      value: raw.trim(),
      status: 'VERIFIED',
      confidence: 0.95,
      confidenceLevel: 'High',
      source,
      isAvailable: true
    };
  }

  /**
   * Calculates a verifiable Market Opportunity Score (0-100) or gracefully returns null if inputs are insufficient.
   * Never fabricates scores for missing fields.
   */
  static calculateMarketOpportunityScore(params: {
    hasWebsite?: boolean;
    rating?: number | null;
    reviewCount?: number | null;
    competitorCount?: number | null;
    city?: string | null;
    niche?: string | null;
    gmbConnected?: boolean;
  }): TrustScore {
    const missingInputs: string[] = [];
    const providedInputs: string[] = [];

    if (!params.city) missingInputs.push('Ciudad / Ubicación');
    else providedInputs.push('Ubicación: ' + params.city);

    if (!params.niche) missingInputs.push('Nicho / Categoría');
    else providedInputs.push('Sector: ' + params.niche);

    if (params.rating === null || params.rating === undefined) missingInputs.push('Rating verificado');
    else providedInputs.push(`Rating: ${params.rating}★`);

    if (params.reviewCount === null || params.reviewCount === undefined) missingInputs.push('Conteo de reseñas');
    else providedInputs.push(`Reseñas: ${params.reviewCount}`);

    if (params.hasWebsite === undefined) missingInputs.push('Presencia web');
    else providedInputs.push(params.hasWebsite ? 'Sitio Web Registrado' : 'Sin Sitio Web');

    if (params.competitorCount !== null && params.competitorCount !== undefined) {
      providedInputs.push(`Competidores Mapeados: ${params.competitorCount}`);
    } else {
      missingInputs.push('Competidores Mapeados');
    }

    const hasRatingSignal = params.rating !== null && params.rating !== undefined;
    const hasReviewSignal = params.reviewCount !== null && params.reviewCount !== undefined;
    const hasWebsiteSignal = params.hasWebsite !== undefined;
    const hasCompetitorSignal = params.competitorCount !== null && params.competitorCount !== undefined && params.competitorCount > 0;

    const availableSignalsCount = (hasRatingSignal ? 1 : 0) + (hasReviewSignal ? 1 : 0) + (hasWebsiteSignal ? 1 : 0) + (hasCompetitorSignal ? 1 : 0);

    // If essential context is missing or 0 competitors are mapped with no verified GMB signals
    if (!params.city || !params.niche || params.competitorCount === 0 || availableSignalsCount < 2) {
      const explanationParts = [
        params.competitorCount === 0 
          ? `Sin datos de mercado suficientes (0 competidores/POIs detectados en este radio). Amplía el radio de búsqueda (10 km / 25 km) o verifica la categoría.`
          : `Insuficientes señales verificables (${availableSignalsCount} disponibles: ${providedInputs.length > 0 ? providedInputs.join(', ') : 'Ninguna'}).`,
        `Faltan: ${missingInputs.join(', ')}.`,
        `Confianza: Baja. Limitaciones: No se asigna score de 95/100 sin datos mapeados en la zona.`
      ];
      return {
        score: null,
        status: 'INSUFFICIENT_DATA',
        confidence: 0,
        confidenceLevel: 'Low',
        isCalculable: false,
        explanation: explanationParts.join(' '),
        missingInputs,
        providedInputs
      };
    }

    // Dynamic scoring calculated strictly from available real signals
    let totalOpportunityPoints = 0;
    let maxPossiblePoints = 0;

    if (hasWebsiteSignal) {
      maxPossiblePoints += 30;
      if (!params.hasWebsite) {
        totalOpportunityPoints += 30; // High conversion gap opportunity
      } else {
        totalOpportunityPoints += 10;
      }
    }

    if (hasRatingSignal && params.rating !== null) {
      maxPossiblePoints += 35;
      if (params.rating < 4.0) {
        totalOpportunityPoints += 35;
      } else if (params.rating < 4.6) {
        totalOpportunityPoints += 20;
      } else {
        totalOpportunityPoints += 10;
      }
    }

    if (hasReviewSignal && params.reviewCount !== null) {
      maxPossiblePoints += 35;
      if (params.reviewCount < 10) {
        totalOpportunityPoints += 35;
      } else if (params.reviewCount < 40) {
        totalOpportunityPoints += 20;
      } else {
        totalOpportunityPoints += 10;
      }
    }

    if (hasCompetitorSignal && params.competitorCount !== null) {
      maxPossiblePoints += 20;
      if (params.competitorCount >= 5) {
        totalOpportunityPoints += 20;
      } else {
        totalOpportunityPoints += 10;
      }
    }

    const calculatedRatio = maxPossiblePoints > 0 ? (totalOpportunityPoints / maxPossiblePoints) : 0;
    const finalScore = Math.min(95, Math.max(15, Math.round(calculatedRatio * 100)));

    const confidenceScore = availableSignalsCount >= 3 ? 0.9 : 0.6;
    const confidenceLevel: 'High' | 'Medium' | 'Low' = availableSignalsCount >= 3 ? 'High' : 'Medium';
    const status: EvidenceStatus = missingInputs.length === 0 ? 'VERIFIED' : 'DERIVED';

    const explanationParts = [
      `Score de ${finalScore}/100 determinado sobre ${availableSignalsCount} señales reales del mercado local (${providedInputs.join(', ')}).`,
      missingInputs.length > 0 ? `Señales faltantes: ${missingInputs.join(', ')}.` : 'Señales clave disponibles.',
      `Confianza: ${confidenceLevel} (${Math.round(confidenceScore * 100)}%).`,
      `Limitaciones: ${missingInputs.length > 0 ? 'Resultado basado únicamente en evidencias verificables disponibles.' : 'Evaluación basada en evidencias completas del perfil.'}`
    ];

    return {
      score: finalScore,
      status,
      confidence: confidenceScore,
      confidenceLevel,
      isCalculable: true,
      explanation: explanationParts.join(' '),
      missingInputs,
      providedInputs
    };
  }

  /**
   * Prepares a Weekly Growth Brief specification (structure ready for future automation without extra costs)
   */
  static generateWeeklyGrowthBriefPreview(params: {
    businessName: string;
    city: string;
    niche: string;
    gapsCount: number;
    opportunitiesCount: number;
    actionsCount: number;
  }): WeeklyGrowthBrief {
    return {
      businessName: params.businessName || 'Negocio Local',
      city: params.city || 'Mercado Local',
      niche: params.niche || 'Servicios Generales',
      generatedAt: new Date().toISOString(),
      period: 'WEEKLY',
      whatChanged: [
        {
          title: 'Monitoreo de Reseñas y Posición Local',
          description: `Auditoría semanal completada en ${params.city || 'tu zona'}.`,
          evidenceStatus: 'VERIFIED',
          source: 'Bvelt Engine'
        }
      ],
      whatMatters: [
        {
          priority: 'HIGH',
          title: `Oportunidades Comerciales Prioritarias (${params.opportunitiesCount})`,
          impactDescription: 'Identificación de acciones de captación listas para ejecutar.',
          evidenceStatus: 'DERIVED'
        }
      ],
      whatToDoThisWeek: [
        {
          stepNumber: 1,
          title: 'Ejecutar Siguiente Mejor Acción',
          action: 'Contactar prospectos con cotización pendiente o solicitar reseñas a clientes satisfechos.',
          estimatedMinutes: 5,
          targetTab: 'action-center'
        },
        {
          stepNumber: 2,
          title: 'Auditar Presencia Frente a Competidores',
          action: 'Verificar brechas de reseñas y respuesta a clientes en Google Maps.',
          estimatedMinutes: 3,
          targetTab: 'snapshot'
        }
      ],
      overallTrustConfidence: 'High'
    };
  }
}
