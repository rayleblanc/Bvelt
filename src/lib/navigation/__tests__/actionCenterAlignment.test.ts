import assert from 'node:assert';
import { OpportunityEngine } from '../../../knowledge/engine/opportunityEngine';
import { CommercialMetricsEngine } from '../../../knowledge/engine/commercialMetrics';

console.log('--- Testing Action Center & Commercial Metrics Area Alignment ---');

const naplesProfile = {
  businessName: 'Naples Lawn Care',
  category: 'Lawn Care',
  location: 'Naples, FL',
  city: 'Naples'
};

const amsterdamLead = {
  id: 'dl-1',
  client: 'Local client',
  city: 'Amsterdam',
  location: 'Amsterdam, North Holland',
  status: 'NEW',
  isDemo: true
};

const torontoLead = {
  id: 'dl-2',
  client: 'Local client',
  city: 'Toronto',
  location: 'Toronto, ON',
  status: 'NEW',
  isDemo: true
};

const naplesLead = {
  id: 'n1',
  client: 'Marco Rossi',
  phone: '(239) 555-0199',
  city: 'Naples',
  location: 'Naples, FL',
  status: 'NEW',
  isDemo: false
};

// Test Case 1: Out-of-zone leads only (Amsterdam + Toronto) with Naples Profile
const outOnlyOpps = OpportunityEngine.evaluateOpportunities({
  profile: naplesProfile,
  leads: [amsterdamLead, torontoLead]
});

const uncontactedCardOutOnly = outOnlyOpps.find(o => o.id === 'opp_followup_pending_leads');
assert.strictEqual(uncontactedCardOutOnly, undefined, 'Action Center MUST NOT emit "uncontacted leads" card when all leads are out-of-zone');

const commSummaryOutOnly = CommercialMetricsEngine.computeSummary([amsterdamLead, torontoLead], [], [], naplesProfile);
assert.strictEqual(commSummaryOutOnly.leadsToContact, 0, 'CommercialMetricsEngine.leadsToContact MUST be 0 when all leads are out-of-zone');
assert.strictEqual(commSummaryOutOnly.uncontactedLeads, 0, 'CommercialMetricsEngine.uncontactedLeads MUST be 0 when all leads are out-of-zone');

// Test Case 2: Real Naples Lead present
const mixedOpps = OpportunityEngine.evaluateOpportunities({
  profile: naplesProfile,
  leads: [amsterdamLead, torontoLead, naplesLead]
});

const uncontactedCardMixed = mixedOpps.find(o => o.id === 'opp_followup_pending_leads');
assert.ok(uncontactedCardMixed, 'Action Center MUST emit uncontacted card when a real in-area Naples lead exists');
assert.strictEqual(uncontactedCardMixed?.actionTarget?.leadId, 'n1', 'Action Center card MUST link directly to the real in-area leadId "n1"');

const commSummaryMixed = CommercialMetricsEngine.computeSummary([amsterdamLead, torontoLead, naplesLead], [], [], naplesProfile);
assert.strictEqual(commSummaryMixed.leadsToContact, 1, 'CommercialMetricsEngine.leadsToContact MUST count exactly 1 real in-area Naples lead');

console.log('All Action Center & Commercial Metrics alignment tests passed successfully! ✅');
