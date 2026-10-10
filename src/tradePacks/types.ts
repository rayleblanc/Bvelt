export type TradePackId = 'hvac' | 'plumbing' | 'roofing' | 'lawn' | 'general';

export interface TradeBenchmarkInfo {
  status: 'INSUFFICIENT_SAMPLE' | 'ACTIVE';
  sampleCount: number;
  minimumThreshold: number;
  messageEs: string;
  messageEn: string;
  localGrowthPct: number | null; // null when sample is insufficient; never invent +18%
}

export interface TradeChecklistItem {
  id: string;
  day: string;
  titleEs: string;
  titleEn: string;
  descEs: string;
  descEn: string;
  actionType: 'audit' | 'actions' | 'review' | 'competitor' | 'upgrade';
  actionPayload?: {
    actionEs: string;
    actionEn: string;
    whyNowEs: string;
    whyNowEn: string;
    expectedBenefitEs: string;
    expectedBenefitEn: string;
    destinationCode: string;
    contextData?: Record<string, any>;
  };
  completed?: boolean;
}

export interface TradeDiagnosisStrings {
  unverifiedGbp: {
    problemEs: string;
    problemEn: string;
    whyThisMattersEs: string;
    whyThisMattersEn: string;
    evidenceDeepDiveEs: string;
    evidenceDeepDiveEn: string;
  };
  unansweredReviews: {
    problemEs: (count: number) => string;
    problemEn: (count: number) => string;
    whyThisMattersEs: string;
    whyThisMattersEn: string;
    actionTitleEs: string;
    actionTitleEn: string;
  };
  seasonalDemand: {
    problemEs: string;
    problemEn: string;
    whyThisMattersEs: string;
    whyThisMattersEn: string;
    evidenceSummaryEs: string;
    evidenceSummaryEn: string;
    actionTitleEs: string;
    actionTitleEn: string;
    expectedBenefitEs: string;
    expectedBenefitEn: string;
  };
  emergencyCoverage: {
    problemEs: string;
    problemEn: string;
    whyThisMattersEs: string;
    whyThisMattersEn: string;
    evidenceSummaryEs: string;
    evidenceSummaryEn: string;
    actionTitleEs: string;
    actionTitleEn: string;
    expectedBenefitEs: string;
    expectedBenefitEn: string;
  };
}

export interface TradeOutreachTemplate {
  id: string;
  nameEs: string;
  nameEn: string;
  category: 'quote' | 'review' | 'seasonal' | 'b2b' | 'emergency';
  whatsappTextEs: string;
  whatsappTextEn: string;
  smsTextEs: string;
  smsTextEn: string;
}

export interface TradeGbpPostTemplate {
  id: string;
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
  ctaType: 'CALL' | 'BOOK' | 'LEARN_MORE';
  suggestedTags: string[];
}

export interface TradeQuickQuote {
  id: string;
  labelEs: string;
  labelEn: string;
  defaultPrice: number;
  unit: string;
}

export interface TradeLeadExample {
  id: string;
  name: string;
  phone: string;
  service: string;
  serviceEn: string;
  status: 'new' | 'contacted' | 'won';
  estimatedValue: number;
  timeAgo: string;
  timeAgoEn: string;
  notes: string;
  notesEn: string;
}

export interface TradeEmptyStateExamples {
  sampleBusinessName: string;
  sampleCity: string;
  sampleCompetitor: string;
  sampleLeads: TradeLeadExample[];
  sampleRecentScans: Array<{ name: string; city: string; score: number; date: string }>;
  sampleQuickQuotes: TradeQuickQuote[];
}

export interface TradePack {
  id: TradePackId;
  name: { es: string; en: string };
  keywords: string[];
  emergencyServices: string[];
  highTicketServices: string[];
  averageTicket: number;
  diagnosisStrings: TradeDiagnosisStrings;
  checklist: TradeChecklistItem[];
  outreachTemplates: TradeOutreachTemplate[];
  gbpPostTemplates: TradeGbpPostTemplate[];
  quickQuotes: TradeQuickQuote[];
  emptyStateExamples: TradeEmptyStateExamples;
  benchmark?: TradeBenchmarkInfo;
}
