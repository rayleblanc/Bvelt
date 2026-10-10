/**
 * BVELT MEMORY v1 (BEM) — Core Type Definitions
 * 
 * Defines formal types for Entity Identity, Memory Evidence Records, 
 * Field-level Freshness, Memory Context, and Data Classification.
 */

import { EvidenceStatus } from '../../lib/bveltEvidence';

export type { EvidenceStatus };

export type EntityType = 'BUSINESS' | 'LOCATION' | 'WEBSITE' | 'GBP_PLACE' | 'MARKET' | 'NICHE';

export interface EntitySourceIds {
  googlePlaceId?: string | null;
  osmId?: string | null;
  geoapifyId?: string | null;
  crmId?: string | null;
  domain?: string | null;
}

export type IdentityStatus = 'RESOLVED' | 'PROVISIONAL' | 'CONFLICTED' | 'MERGED' | 'SPLIT';

export interface EntityIdentity {
  entityType: EntityType;
  entityId: string; // Canonical key: `ent_biz_<hash>`
  identityVersion: number;
  canonicalName: string;
  normalizedName: string; // Lowercase, stripped of punctuation and legal suffixes
  aliases: string[];
  sourceIds: EntitySourceIds;
  
  // Location Signals
  addressNormalized?: string | null;
  cityNormalized?: string | null;
  stateCode?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  
  // Contact & Digital Signals
  phoneE164?: string | null;
  domainCanonical?: string | null;
  
  // Industry Classification
  naicsCode?: string | null;
  primaryCategory?: string | null;
  
  // Resolution Metrics & Governance
  identityConfidence: number; // 0.0 to 1.0
  identityStatus: IdentityStatus;
  mergedIntoEntityId?: string | null;
  
  createdAt: string;
  lastResolvedAt: string;
}

export type ObservationType = 
  | 'FACT'               // Verified external API record (e.g., Google Places)
  | 'OBSERVATION'        // Direct scrape / web observation
  | 'DERIVED'            // Calculated via mathematical formula
  | 'ESTIMATE'           // Projected market model
  | 'AI_INTERPRETATION'  // LLM summary / sentiment / draft
  | 'USER_PROVIDED'      // Direct tenant input
  | 'SYSTEM_COMPUTED';   // Internal deterministic calculation

export type DataClassification = 'PUBLIC_SHARED' | 'TENANT_PRIVATE' | 'SYSTEM_ONLY';

export type TemporalAssociationType =
  | 'OBSERVED_AFTER'
  | 'CORRELATED_WITH'
  | 'TEMPORALLY_ASSOCIATED'
  | 'INSUFFICIENT_DATA';

export type EventRelationshipType =
  | 'RECOMMENDATION'
  | 'ACTION_EXECUTION'
  | 'OUTCOME_OBSERVATION'
  | 'MARKET_OBSERVATION'
  | 'BASELINE_SNAPSHOT'
  | 'CONVERSION';

export interface ActionReference {
  actionId: string;
  actionType: string;
  destinationCode?: string;
  status: 'RECOMMENDED' | 'EXECUTED' | 'COMPLETED' | 'DISMISSED';
  executedAt?: string;
  priority?: string;
  reasoning?: string;
  opportunityId?: string;
}

export interface OutcomeReference {
  outcomeType: string; // e.g. 'RATING_CHANGE', 'REVIEW_COUNT_CHANGE', 'RANK_POSITION_CHANGE', 'LEAD_WON', 'REVENUE_RECORDED', 'PROFIT_MARGIN_CHANGE'
  metricName?: string;
  oldValue?: any;
  newValue?: any;
  deltaValue?: number;
  observationWindow?: '30d' | '90d' | '180d' | 'custom';
  associationType: TemporalAssociationType;
}

export interface BaselineReference {
  baselineId?: string;
  capturedAt: string;
  metrics: Record<string, any>;
}

export interface EvidenceEvent {
  eventId: string;
  entityId: string;
  fieldKey: string;
  oldValue: any | null;
  newValue: any;
  sourceType: string;
  observationType: ObservationType;
  evidenceStatus: EvidenceStatus;
  confidence: number;
  observedAt: string;
  detectedAt: string;
  producerVersion?: string;
  schemaVersion: number;

  // Block 9: Historical Arbitrage optional metadata
  relationship?: EventRelationshipType;
  actionReference?: ActionReference;
  outcomeReference?: OutcomeReference;
  baselineReference?: BaselineReference;
  windowStart?: string;
  windowEnd?: string;

  // Block 10.1 & 1.7: Evidence Integrity Hash & Hash Chain
  eventHash?: string;
  previousHash?: string;
  currentHash?: string;
}

export interface SourceReliabilityMetrics {
  sourceType: string;
  totalObservations: number;
  totalConflicts: number;
  unresolvedConflicts: number;
  resolutionsWon: number;
  resolutionsLost: number;
  staleObservations: number;
  firstObservedAt: string;
  lastCalculatedAt: string;
}

export type ConflictStatus = 'OPEN' | 'RESOLVED';

export interface ConflictRecord {
  conflictId: string;
  entityId: string;
  fieldKey: string;
  sourceA: string;
  valueA: any;
  sourceB: string;
  valueB: any;
  firstDetectedAt: string;
  lastDetectedAt: string;
  status: ConflictStatus;
  resolutionSource?: string | null;
  resolutionAt?: string | null;
  resolutionReason?: string | null;
}

export interface MemoryEvidenceRecord<T = any> {
  recordId: string;       // Unique ID: `ev_<entityId>_<fieldKey>_<hash>`
  entityId: string;       // Key referencing EntityIdentity
  fieldKey: string;       // Target field key
  
  value: T;
  valueType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  
  observationType: ObservationType;
  evidenceStatus: EvidenceStatus;
  classification: DataClassification;
  confidence: number;      // 0.0 to 1.0
  confidenceLevel: 'High' | 'Medium' | 'Low';
  
  sourceType: string;      // e.g. 'LIVE_SEARCH', 'GEOAPIFY', 'CRM', etc.
  sourceLabel: string;
  sourceId?: string | null;
  
  formula?: string;
  assumptions?: string[];
  producerVersion?: string;
  
  observedAt: string;     // ISO timestamp when generated/retrieved at source
  retrievedAt: string;    // ISO timestamp when ingested by BEM
  lastVerifiedAt: string; // ISO timestamp when last re-confirmed
  expiresAt: string;      // ISO timestamp when FRESH transitions to STALE
  
  // Block 9: Historical Arbitrage optional metadata
  relationship?: EventRelationshipType;
  actionReference?: ActionReference;
  outcomeReference?: OutcomeReference;
  baselineReference?: BaselineReference;
  windowStart?: string;
  windowEnd?: string;

  schemaVersion: number;
}

export type FieldAvailabilityState = 'FRESH' | 'STALE' | 'MISSING' | 'CONFLICTED';

export interface FieldMemoryContext<T = any> {
  fieldKey: string;
  state: FieldAvailabilityState;
  currentValue?: T | null;
  confidence?: number;
  lastVerifiedAt?: string;
  expiresAt?: string;
  sourceLabel?: string;
  evidenceRef?: string;
  conflictCount?: number;
  missingReason?: 'NEVER_ACQUIRED' | 'EXPIRED' | 'INVALIDATED' | 'INSUFFICIENT_DATA';
}

export interface EntityMemoryContext {
  entityId: string;
  identityStatus: IdentityStatus;
  canonicalName: string;
  domainCanonical?: string | null;
  phoneE164?: string | null;
  
  // Field-level memory context map
  fields: Record<string, FieldMemoryContext>;
  
  totalFieldsTracked: number;
  freshFieldCount: number;
  staleFieldCount: number;
  missingFieldCount: number;
  conflictedFieldCount: number;
  
  evaluatedAt: string;
}

export interface PublicSafeFieldEvidence<T = any> {
  fieldKey: string;
  fieldLabel: string;
  value: T | null;
  observationType: ObservationType;
  evidenceStatus: EvidenceStatus;
  classification: 'PUBLIC_SHARED';
  confidence: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  sourceLabel: string;
  sourceType: string;
  observedAt: string;
  lastVerifiedAt: string;
  expiresAt?: string;
  freshnessState: 'FRESH' | 'STALE' | 'CONFLICTED' | 'MISSING';
  humanFreshness: string;
  agreementCount?: number;
  isConflicted?: boolean;
}

export interface PublicSafeEntityEvidence {
  entityId: string;
  canonicalName: string;
  primaryCategory: string | null;
  addressNormalized: string | null;
  cityNormalized: string | null;
  stateCode: string | null;
  countryCode: string | null;
  postalCode: string | null;
  coordinates: { lat: number; lng: number } | null;
  phoneE164: string | null;
  domainCanonical: string | null;
  identityStatus: IdentityStatus;
  identityConfidence: number;
  lastVerifiedAt: string;
  evaluatedAt: string;
  
  fields: Record<string, PublicSafeFieldEvidence>;
  
  provenanceSummary: {
    totalPublicFields: number;
    verifiedFieldsCount: number;
    distinctSourceLabels: string[];
    hasConflicts: boolean;
    activeConflictCount: number;
  };
  
  recentHistory?: EvidenceEvent[];
  activeConflicts?: ConflictRecord[];
  outcomeLedger?: PublicSafeOutcomeRecord[];
}

export type OutcomeState = 'MEASURED' | 'DECLARED' | 'ESTIMATED' | 'UNKNOWN';

export interface PublicSafeOutcomeRecord {
  outcomeId: string;
  actionType?: string;
  outcomeType: string;
  metricName: string;
  observedAt: string;
  associationType: 'OBSERVED_AFTER' | 'CORRELATED_WITH' | 'INSUFFICIENT_DATA' | string;
  outcomeState?: OutcomeState;
  summaryText: string;
  evidenceStatus: EvidenceStatus;
  sourceLabel: string;
  valueRecorded?: any;
}

export interface CompetitorSnapshot {
  entityId?: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  osmId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  reviewVelocity?: number | null;
  services?: string[] | null;
  photosCount?: number | null;
  priceLevel?: number | null;
  isClaimed?: boolean | null;
  observedAt?: string;
  sourceType?: string;
}

export type MovementType = 
  | 'REVIEW_COUNT_INCREASE'
  | 'REVIEW_COUNT_DECREASE'
  | 'RATING_INCREASE'
  | 'RATING_DECREASE'
  | 'WEBSITE_ADDED'
  | 'PHONE_ADDED'
  | 'SERVICE_EXPANSION'
  | 'CATEGORY_CHANGE'
  | 'NEW_ENTRANT'
  | 'NO_CHANGE_OBSERVED';

export interface CompetitorMovementSignal {
  id: string;
  entityId: string;
  competitorName: string;
  movementType: MovementType;
  fieldKey: string;
  oldValue: any;
  newValue: any;
  deltaNumber?: number;
  deltaFormatted?: string;
  periodDays: number;
  firstObservedAt: string;
  lastObservedAt: string;
  confidence: number;
  whyItMattersEs: string;
  whyItMattersEn: string;
  nextActionEs: string;
  nextActionEn: string;
  actionCode?: string;
  actionDestinationTab?: string;
}

export interface CompetitorMovementSummary {
  totalCompetitorsTracked: number;
  competitorsWithMovement: number;
  latestMovementSignals: CompetitorMovementSignal[];
  fastestGrowingCompetitor?: {
    name: string;
    reviewsGained: number;
    periodDays: number;
  } | null;
  highestRatedCompetitor?: {
    name: string;
    rating: number;
    reviewCount: number;
  } | null;
  lastCalculatedAt: string;
}

// ============================================================================
// BVELT MEMORY v1 (BEM) — BLOCK 5: AI VISIBILITY / LOCAL AI PRESENCE
// ============================================================================

export type AIProvider = 'GOOGLE_GEMINI' | 'OPENAI' | 'PERPLEXITY' | 'ANTHROPIC' | 'LOCAL_SIMULATOR';

export type AIObservationMethod = 'DIRECT_PROVIDER_QUERY' | 'SIMULATED_PROVIDER_PROXIMAL' | 'DETERMINISTIC_MODEL_FALLBACK';

export interface AIMentionedBusiness {
  name: string;
  normalizedName: string;
  rankPosition: number; // 1 = First recommended
  sentiment: 'RECOMMENDED' | 'POSITIVE' | 'NEUTRAL' | 'CRITICAL';
  attributesMentioned: string[];
  hasCitation: boolean;
  sourceUrl?: string | null;
  isUserBusiness: boolean;
  matchedEntityId?: string | null;
  identityStatus?: 'RESOLVED' | 'PROVISIONAL' | 'UNRESOLVED';
}

export interface AIVisibilitySnapshot {
  snapshotId: string;
  entityId: string;
  provider: AIProvider; // Actual provider queried (e.g. 'GOOGLE_GEMINI')
  simulationTarget?: AIProvider | null; // e.g. 'OPENAI' if Gemini was asked to simulate ChatGPT
  observationMethod: AIObservationMethod;
  model: string;
  producerVersion: string;
  promptTemplateVersion: string;
  query: string;
  queryHash: string;
  category: string;
  location: string;
  observedAt: string;
  expiresAt: string;
  classification: DataClassification;
  observationType: ObservationType; // 'AI_INTERPRETATION'
  evidenceStatus: EvidenceStatus;   // 'INFERRED' or 'DERIVED'
  confidence: number;              // e.g. 0.85
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  sampleSize: number;              // Number of queries in sample
  isUserMentioned: boolean;
  userRankPosition: number | null;
  userShareOfVoicePercent: number; // 0 to 100
  topMentionedBusinesses: AIMentionedBusiness[];
  totalBusinessesMentioned: number;
  keyMissingAttributes: string[];
  visibilityScore: number;         // 0 to 100
  scoreProvenance: 'MODELED' | 'DERIVED' | 'INSUFFICIENT_DATA';
  rawSummarySnippet: string;
}

export type AIVisibilitySignalType = 
  | 'AI_GAP_OMISSION'
  | 'AI_POSITION_LEADER'
  | 'AI_COMPETITOR_DOMINANCE'
  | 'AI_CITATION_MISSING'
  | 'AI_OPPORTUNITY_STABLE';

export interface AIVisibilitySignal {
  id: string;
  entityId: string;
  type: AIVisibilitySignalType;
  severity: 'CRITICAL' | 'ATTENTION' | 'POSITIVE';
  title: string;
  reason: string;
  evidence: string;
  whyItMattersEs: string;
  whyItMattersEn: string;
  nextActionEs: string;
  nextActionEn: string;
  actionCode: string;
  actionTab: string;
  suggestedActionPayload?: any;
}

export interface AIVisibilitySummary {
  entityId: string;
  overallAiPresenceScore: number; // 0 to 100
  scoreProvenance: 'MODELED' | 'DERIVED' | 'INSUFFICIENT_DATA';
  totalQueriesAudited: number;
  sampleSize: number;
  presenceRatePercent: number;    // 0 to 100
  shareOfVoiceProvenance: 'MODELED' | 'DERIVED' | 'INSUFFICIENT_DATA';
  averageRank: number | null;
  dominantCompetitorName?: string | null;
  dominantCompetitorMentions?: number;
  dominantCompetitorObservationCount?: number;
  latestSnapshots: AIVisibilitySnapshot[];
  signals: AIVisibilitySignal[];
  lastAuditedAt: string;
  nextScheduledAuditAt: string;
}

// ============================================================================
// BVELT MEMORY v1 (BEM) — BLOCK 6: OPERATIONAL FINGERPRINT & BEHAVIORAL PATTERNS
// ============================================================================

export type OperationalTheme =
  | 'RESPONSE_SPEED'
  | 'PROFESSIONALISM'
  | 'COMMUNICATION'
  | 'CLEANLINESS'
  | 'QUALITY'
  | 'PUNCTUALITY'
  | 'RELIABILITY'
  | 'PRICING_TRANSPARENCY'
  | 'FOLLOW_THROUGH'
  | 'CUSTOMER_SERVICE';

export type OperationalThemeCategory = 'STRENGTH' | 'WEAKNESS' | 'NEUTRAL' | 'OPPORTUNITY';

export type OperationalSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export type OperationalTrend = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';

export type OperationalEpistemicLevel = 
  | 'OBSERVED_THEME'         // 1-2 mentions, isolated observation
  | 'DERIVED_PATTERN'        // 3+ mentions or statistically significant ratio
  | 'MODELED_INTERPRETATION' // Multi-factor synthesis from external benchmarks/reputation models
  | 'INSUFFICIENT_DATA';     // 0 verified observations

export interface OperationalEvidenceRef {
  evidenceId: string;
  sourceType: string;
  observedAt: string;
  snippet?: string;
  sentiment: OperationalSentiment;
}

export interface OperationalFingerprintSignal {
  fingerprintId: string;
  entityId: string;
  theme: OperationalTheme;
  themeCategory: OperationalThemeCategory;
  sentiment: OperationalSentiment;
  observationCount: number;
  supportingEvidenceCount: number;
  supportingEvidenceIds: string[];
  evidenceReferences?: OperationalEvidenceRef[];
  firstObservedAt: string;
  lastObservedAt: string;
  confidence: number; // 0.0 to 1.0
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceStatus: EvidenceStatus;
  epistemicLevel: OperationalEpistemicLevel;
  sourceTypes: string[]; // e.g. ['GOOGLE_REVIEWS', 'CRM_FEEDBACK', 'REPUTATION_SHIELD', 'BUSINESS_SCAN']
  trend: OperationalTrend;
  sampleSize: number;
  producerVersion: string;
  schemaVersion: string;
  summaryEs: string;
  summaryEn: string;
  impactOnConversion: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedActionEs?: string;
  suggestedActionEn?: string;
  actionCode?: string;
  actionTab?: string;
  metadata?: {
    avgSentimentScore?: number;
    positiveRatio?: number;
    negativeRatio?: number;
    keywordsMatched?: string[];
    [key: string]: any;
  };
}

export interface OperationalFingerprintSummary {
  entityId: string;
  overallHealthScore: number; // 0 to 100
  scoreProvenance: 'MODELED' | 'DERIVED' | 'INSUFFICIENT_DATA';
  totalObservations: number;
  sampleSize: number;
  strengths: OperationalFingerprintSignal[];
  weaknesses: OperationalFingerprintSignal[];
  neutralOrOpportunities: OperationalFingerprintSignal[];
  signals: OperationalFingerprintSignal[];
  primaryDifferentiator?: OperationalFingerprintSignal | null;
  primaryRisk?: OperationalFingerprintSignal | null;
  lastAuditedAt: string;
  producerVersion: string;
  historicalTrendSummary: {
    improvingThemesCount: number;
    decliningThemesCount: number;
    stableThemesCount: number;
    insufficientDataCount: number;
  };
}

