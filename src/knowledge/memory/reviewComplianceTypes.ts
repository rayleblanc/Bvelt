/**
 * BVELT REVIEW COMPLIANCE FIREWALL — Types & Interfaces
 * 
 * Defines deterministic rules, action payloads, evaluation decisions,
 * and evidence structures to prevent review gating and non-compliant practices.
 */

export type ComplianceDecision = 'ALLOW' | 'MODIFY' | 'BLOCK';

export type ReviewComplianceRuleId =
  | 'RULE_NO_REVIEW_GATING'
  | 'RULE_NO_SENTIMENT_FILTERING'
  | 'RULE_NO_UNSATISFIED_EXCLUSION'
  | 'RULE_NO_RATING_INCENTIVE'
  | 'RULE_NO_STAR_MANDATE'
  | 'RULE_NO_CONDITIONAL_SATISFACTION'
  | 'RULE_LEGITIMATE_NEUTRAL_REQUEST'
  | 'RULE_LEGITIMATE_REVIEW_REPLY'
  | 'RULE_LEGITIMATE_PENDING_ALERT';

export interface ReviewActionPayload {
  actionId?: string;
  actionType: 'REQUEST_REVIEW' | 'REVIEW_REPLY' | 'PENDING_REVIEW_ALERT' | 'OUTREACH' | 'REPUTATION_SHIELD' | 'FEEDBACK_CAMPAIGN';
  businessName?: string;
  recipientName?: string;
  recipientPhone?: string;
  channel?: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'QR' | 'WEB' | 'INTERNAL';
  
  /** Raw text message to evaluate */
  messageText?: string;
  subjectText?: string;
  
  /** Targeting / Segmentation parameters */
  targetingCriteria?: {
    /** Filter based on customer sentiment (e.g. 'POSITIVE_ONLY' violates policy) */
    sentimentFilter?: 'ALL' | 'POSITIVE_ONLY' | 'EXCLUDE_NEGATIVE' | 'HIGH_SATISFACTION_ONLY';
    /** Filter based on previous rating (e.g. minRating >= 4 violates policy if used to gate) */
    minRatingThreshold?: number;
    /** If true, indicates dissatisfied customers are excluded from solicitation */
    excludeDissatisfied?: boolean;
    /** Service status triggering the outreach (e.g. 'JOB_COMPLETED' is compliant if universal) */
    triggerEvent?: 'JOB_COMPLETED' | 'PERIODIC_AUDIT' | 'MANUAL' | 'HIGH_RATING_FILTER';
  };

  /** Specific parameters for review replies */
  replyContext?: {
    reviewId?: string;
    originalRating?: number;
    originalComment?: string;
  };

  /** Flag indicating whether public review link is accessible to all recipients */
  publicReviewLinkAccessible?: boolean;
  publicReviewUrl?: string;

  /** Client-provided metadata (strictly untrusted in security layer) */
  clientMetadata?: Record<string, any>;
}

export interface RuleViolation {
  ruleId: ReviewComplianceRuleId;
  severity: 'CRITICAL_BLOCK' | 'MODIFIABLE_WARNING';
  reasonEs: string;
  reasonEn: string;
  detectedPattern?: string;
}

export interface ComplianceEvaluationResult {
  decision: ComplianceDecision;
  isCompliant: boolean;
  primaryRuleId: ReviewComplianceRuleId;
  reasonEs: string;
  reasonEn: string;
  violations: RuleViolation[];
  neutralizedPayload?: ReviewActionPayload;
  neutralizedMessageEs?: string;
  neutralizedMessageEn?: string;
  evaluatedAt: string;
  isDeterministic: boolean;
}

export interface ComplianceAuditLogRecord {
  id: string;
  tenantId: string;
  actionType: string;
  decision: ComplianceDecision;
  primaryRuleId: ReviewComplianceRuleId;
  reason: string;
  timestamp: string;
  sourceContext: string;
}
