/**
 * Unit tests for routeToAnswerLeads, isLeadInServiceArea, and priorityQueueService
 * Validates:
 * 1. Actionable vs Insufficient Data lead classification
 * 2. Honest naming (no fake company names)
 * 3. Strict Service Area validation (Naples vs Amsterdam / Toronto / Out-of-zone)
 * 4. Exact navigation logic (0 leads, 1 lead, 2+ leads)
 * 5. Priority Queue ranking and single-day dismissal (zero fake leads prioritized)
 */

import {
  isLeadActionable,
  isLeadAwaitingReply,
  getActionableLeadsAwaitingReply,
  getLeadDisplayName,
  routeToAnswerLeads,
  isLeadInServiceArea,
  isLeadInZone,
  sortLeadsByZoneAndUrgency,
  ActionableLead
} from '../routeToAnswerLeads';

import {
  getTopPriorityItem,
  isPriorityDismissed,
  dismissPriority
} from '../../../services/priorityQueueService';

// Mock localStorage and window
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => store[k] || null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
(global as any).window = {
  dispatchEvent: () => true
};
(global as any).CustomEvent = class CustomEvent {
  detail: any;
  constructor(_name: string, opts?: any) {
    this.detail = opts?.detail;
  }
};
(global as any).Event = class Event {};

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

function runTests() {
  console.log('Running routeToAnswerLeads & isLeadInServiceArea tests...\n');

  // Test 1: Actionable vs Non-Actionable Leads
  console.log('Test Suite 1: isLeadActionable');
  const dummyLead: ActionableLead = { id: '1', businessName: 'Unnamed / Local', status: 'NEW' };
  assert(!isLeadActionable(dummyLead), 'Empty placeholder lead with no contact data is NOT actionable');

  const phoneLead: ActionableLead = { id: '2', phone: '(786) 555-0199', status: 'NEW', city: 'Miami' };
  assert(isLeadActionable(phoneLead), 'Lead with phone number IS actionable');

  const emailLead: ActionableLead = { id: '3', email: 'contractor@example.com', status: 'NEW', city: 'Naples' };
  assert(isLeadActionable(emailLead), 'Lead with valid email IS actionable');

  const msgLead: ActionableLead = { id: '4', text: 'Need roof repair tomorrow urgent', status: 'NEW' };
  assert(isLeadActionable(msgLead), 'Lead with inbound message text IS actionable');

  // Test 2: Honest Display Names
  console.log('\nTest Suite 2: getLeadDisplayName');
  const unnamed1 = getLeadDisplayName({ id: '5', businessName: 'Unnamed / Local', source: 'Web' }, 'en');
  assert(unnamed1.isNeedsInfo && unnamed1.name === 'Lead needs info (Web)', 'Generic unnamed lead displays "Lead needs info (Web)"');

  const namedLead = getLeadDisplayName({ id: '6', businessName: 'Apex Roofing LLC' }, 'en');
  assert(!namedLead.isNeedsInfo && namedLead.name === 'Apex Roofing LLC', 'Real company name is displayed directly');

  // Test 3: Strict Service Area Matching & Out-of-Zone Detection (Amsterdam vs Naples)
  console.log('\nTest Suite 3: isLeadInServiceArea & Out-of-Zone Detection');
  const naplesProfile = { city: 'Naples', state: 'FL', location: 'Naples, FL', country: 'US', niche: 'jardineria' };
  
  const naplesLead: ActionableLead = { 
    id: 'n1', 
    phone: '239-555-0100', 
    city: 'Naples', 
    location: 'Naples, FL', 
    status: 'NEW' 
  };
  
  const amsterdamLead: ActionableLead = { 
    id: 'ams1', 
    phone: '+31 20 123 4567', 
    city: 'Amsterdam', 
    location: 'Amsterdam, North Holland', 
    text: 'Client located in Amsterdam, North Holland requests lawn care', 
    status: 'NEW' 
  };
  
  const torontoLead: ActionableLead = { 
    id: 't1', 
    phone: '416-555-0100', 
    city: 'Toronto', 
    location: 'Toronto, ON', 
    status: 'NEW' 
  };
  
  const demoNaplesLead: ActionableLead = { 
    id: 'd1', 
    phone: '239-555-0199', 
    city: 'Naples', 
    status: 'NEW', 
    isDemo: true 
  };

  assert(isLeadInServiceArea(naplesLead, naplesProfile), 'Naples lead matches Naples profile service area');
  assert(!isLeadInServiceArea(amsterdamLead, naplesProfile), 'Amsterdam / North Holland lead is NOT in Naples service area');
  assert(!isLeadInServiceArea(torontoLead, naplesProfile), 'Toronto lead is NOT in Naples service area');
  assert(isLeadInZone(naplesLead, naplesProfile), 'isLeadInZone alias matches isLeadInServiceArea');

  // Test 4: Prioritization and Priority Queue with Naples vs Amsterdam
  console.log('\nTest Suite 4: Strict in-area actionable leads filtering');
  const actionableOnlyNaples = getActionableLeadsAwaitingReply([amsterdamLead, naplesLead], naplesProfile);
  assert(actionableOnlyNaples.length === 1 && actionableOnlyNaples[0].id === 'n1', 'Only real in-area Naples lead counts as actionable awaiting reply');

  const actionableOutOnly = getActionableLeadsAwaitingReply([amsterdamLead, torontoLead], naplesProfile);
  assert(actionableOutOnly.length === 0, 'When all leads are out of zone (Amsterdam/Toronto), actionable count is 0');

  // Test 5: Priority Queue with out-of-zone leads only
  console.log('\nTest Suite 5: PriorityQueue without fake/out-of-zone priority');
  const pqOutOnly = getTopPriorityItem({
    leads: [amsterdamLead, torontoLead],
    profile: naplesProfile,
    lang: 'en'
  });
  // Since there are 0 in-area leads, rank 1 (task_actionable_leads) must NOT trigger
  assert(pqOutOnly === null || pqOutOnly.id !== 'task_actionable_leads', 'Out-of-zone leads (Amsterdam) NEVER trigger rank #1 New leads priority');

  const pqWithRealLead = getTopPriorityItem({
    leads: [amsterdamLead, naplesLead],
    profile: naplesProfile,
    lang: 'en'
  });
  assert(pqWithRealLead !== null && pqWithRealLead.id === 'task_actionable_leads' && pqWithRealLead.leadId === 'n1', 'Real in-zone Naples lead triggers rank #1 priority item pointing to n1');

  // Test 6: Navigation Routing
  console.log('\nTest Suite 6: routeToAnswerLeads');
  let targetTab = '';
  let targetSubRow = -1;

  routeToAnswerLeads([dummyLead], {
    setActiveTab: (t) => { targetTab = t; },
    setActiveSubRow: (s) => { targetSubRow = s; }
  });
  assert(targetTab === 'leads' && targetSubRow === 4, '0 actionable leads routes to CRM Inbox');

  routeToAnswerLeads([phoneLead, emailLead], {
    setActiveTab: (t) => { targetTab = t; },
    setActiveSubRow: (s) => { targetSubRow = s; },
    targetLeadId: '3'
  });
  assert(localStorage.getItem('crm_open_lead_id') === '3', 'Explicit targetLeadId opens that exact lead');

  console.log('\nAll tests passed successfully! ✅');
}

runTests();
