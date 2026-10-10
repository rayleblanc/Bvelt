export type VerticalId = 'hvac' | 'plumbing' | 'roofing' | 'general';

export interface VerticalChecklistItem {
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

export interface VerticalDiagnosisStrings {
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

export interface VerticalQuickQuote {
  id: string;
  labelEs: string;
  labelEn: string;
  defaultPrice: number;
  unit: string;
}

export interface VerticalWhatsAppTemplate {
  id: string;
  titleEs: string;
  titleEn: string;
  textEs: string;
  textEn: string;
}

export interface VerticalConfig {
  id: VerticalId;
  name: { es: string; en: string };
  keywords: string[];
  emergencyServices: string[];
  highTicketServices: string[];
  averageTicket: number;
  checklist: VerticalChecklistItem[];
  diagnosisStrings: VerticalDiagnosisStrings;
  quickQuotes: VerticalQuickQuote[];
  whatsappTemplates: VerticalWhatsAppTemplate[];
}
