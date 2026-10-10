/**
 * BVELT MEMORY v1 (BEM) — Google Dependency Risk Score Types
 * 
 * Defines deterministic data models, component weights, fallback classifications,
 * and risk levels for assessing local business resilience against Google ecosystem disruptions.
 */

import { EvidenceStatus, DataClassification } from './bemTypes';

export type GoogleDependencyLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type GoogleFallbackType =
  | 'COMPLETE_INDEPENDENT' // Completely decoupled or 100% covered by independent provider (e.g., OSM, own CRM)
  | 'FUNCTIONAL_FALLBACK'   // Functional alternative available (e.g. manual profile, Nominatim, local engine)
  | 'CACHED_FALLBACK'       // Fresh L1/L2 cache available with SWR degradation
  | 'PARTIAL_FALLBACK'      // Partial coverage (e.g. historical data only or manual 1-click fallback)
  | 'DEGRADED_FALLBACK'     // Significant degradation (e.g., industry benchmark averages only)
  | 'NO_FALLBACK';          // Total operational halt if Google service is unavailable

export type GoogleServiceCategory =
  | 'GBP_IDENTITY'     // Profile information, title, address, category
  | 'GBP_REVIEWS'      // Customer reviews, rating distribution, feedback
  | 'GBP_PUBLISHING'   // Direct review replies, posts, updates
  | 'GBP_PERFORMANCE'  // Search & Maps impressions, calls, website clicks
  | 'GOOGLE_AUTH'      // OAuth2 token management & Google authorization
  | 'MAPS_DISCOVERY'   // Local search & competitor scanning (OSM-first in Bvelt)
  | 'AI_INFERENCE';    // Gemini LLM services (Groq/deterministic template fallback in Bvelt)

export interface GoogleRiskComponent {
  componentId: GoogleServiceCategory;
  nameEs: string;
  nameEn: string;
  weight: number; // 0.0 to 1.0 (Sum of all active weights = 1.0)
  
  // Real Service Audit
  googleService: string;
  googleEndpoint: string;
  affectedFeature: string;
  
  // Dependency & Fallback Status
  dependencyLevel: GoogleDependencyLevel;
  rawDependencyScore: number; // 0 to 100
  
  fallbackType: GoogleFallbackType;
  fallbackQualityFactor: number; // 0.0 (No fallback) to 1.0 (Complete independent)
  fallbackProvider: string;
  fallbackDescriptionEs: string;
  fallbackDescriptionEn: string;
  
  isCached: boolean;
  cacheAgeMs?: number;
  
  // Calculated Risk
  adjustedRiskScore: number; // rawDependencyScore * (1 - 0.75 * fallbackQualityFactor)
  effectiveContribution: number; // adjustedRiskScore * weight
  
  // Provenance & Evidence
  evidenceStatus: EvidenceStatus;
  observedAt: string;
  ruleUsed: string;
}

export interface GoogleDependencyRiskSummary {
  entityId: string;
  overallScore: number; // 0 to 100 (0 = complete autonomy/resilience, 100 = total single-point-of-failure)
  riskLevel: GoogleDependencyLevel;
  status: 'ESTABLISHED' | 'INSUFFICIENT_DATA';
  
  // Component Breakdown
  components: Record<GoogleServiceCategory, GoogleRiskComponent>;
  componentList: GoogleRiskComponent[];
  
  // Fallback Coverage Analysis
  fallbackCoveragePercent: number; // 0 to 100% of services with functional/cached fallbacks
  highestRiskComponent: GoogleRiskComponent | null;
  lowestRiskComponent: GoogleRiskComponent | null;
  
  // Key Vulnerability Summary
  primaryVulnerabilityEs: string;
  primaryVulnerabilityEn: string;
  mitigationStrategyEs: string;
  mitigationStrategyEn: string;
  
  // Governance & Epistemology
  totalServicesAudited: number;
  calculatedAt: string;
  scoreProvenance: 'DERIVED' | 'INSUFFICIENT_DATA';
  producerVersion: string;
  evidenceStatus: EvidenceStatus;
  dataClassification: DataClassification;
}
