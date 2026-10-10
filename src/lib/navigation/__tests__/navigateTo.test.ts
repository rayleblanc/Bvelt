import assert from 'node:assert';
import { resolveNavigation, navigateTo, NavigateSetters } from '../../navigateTo';

console.log('--- Testing navigateTo Helper & 12 Button Destinations ---');

// 1. Tool-based Routing Tests
const t1 = resolveNavigation({ tab: 'leads', tool: 'crm_inbox', leadId: 'lead-123' });
assert.strictEqual(t1.targetTab, 'leads');
assert.strictEqual(t1.targetSubRow, 4);
assert.strictEqual(t1.targetLeadId, 'lead-123');
assert.strictEqual(t1.targetTool, 'crm_inbox');

const t2 = resolveNavigation({ tab: 'leads', tool: 'analyze_msg' });
assert.strictEqual(t2.targetTab, 'leads');
assert.strictEqual(t2.targetSubRow, 0);
assert.strictEqual(t2.targetTool, 'analyze_msg');

const t3 = resolveNavigation({ tab: 'leads', tool: 'scan_area', radiusKm: 15 });
assert.strictEqual(t3.targetTab, 'leads');
assert.strictEqual(t3.targetSubRow, 1);
assert.strictEqual(t3.targetScanRadius, 15);

// 2. Setters Signature Verification: navigateTo(setters, target)
let capturedTab = '';
let capturedSubRow: number | undefined;
let capturedMobileView = '';
let capturedLeadId: string | null = null;
let capturedRadius: number | undefined;
let capturedScanRan = false;

const mockSetters: NavigateSetters = {
  setActiveTab: (tab: any) => { capturedTab = tab; },
  setActiveSubRow: (sub: any) => { capturedSubRow = sub; },
  setSelectedMobileView: (view: any) => { capturedMobileView = view; },
  setSelectedLeadId: (id: string | null) => { capturedLeadId = id; },
  setScanRadiusKm: (r: number) => { capturedRadius = r; },
  runScan: (r?: number) => { capturedScanRan = true; }
};

navigateTo(mockSetters, { tab: 'answer_leads', leadId: 'lead-vip-1' });
assert.strictEqual(capturedTab, 'leads');
assert.strictEqual(capturedSubRow, 4, 'Answer leads must select subRow 4 (CRM Inbox)');
assert.strictEqual(capturedMobileView, 'tab', 'Must set mobile view to tab');
assert.strictEqual(capturedLeadId, 'lead-vip-1');

// 3. Retry Scan with Setters
navigateTo(mockSetters, { tab: 'retry_radius', radiusKm: 10 });
assert.strictEqual(capturedRadius, 10);
assert.strictEqual(capturedScanRan, true);

// 4. MAPA OBLIGATORIO: 12 Core Buttons Specification:
const core12Buttons = [
  {
    name: '1. Answer Leads / Reply to Local Client now',
    input: { tab: 'answer_leads', leadId: 'lead-actionable-1' },
    expectedTab: 'leads',
    expectedSubRow: 4,
    expectedTool: 'crm_inbox',
    expectedLeadId: 'lead-actionable-1'
  },
  {
    name: '2. Contact Leads Now / Reply to 2 Pending Leads',
    input: { tab: 'leads', tool: 'crm_inbox' as const },
    expectedTab: 'leads',
    expectedSubRow: 4,
    expectedTool: 'crm_inbox'
  },
  {
    name: '3. Analyze Message (Explicit tool only)',
    input: { tab: 'leads', tool: 'analyze_msg' as const },
    expectedTab: 'leads',
    expectedSubRow: 0,
    expectedTool: 'analyze_msg'
  },
  {
    name: '4. Open Prospecting Radar / Scan Prospecting Radar',
    input: { tab: 'radar' },
    expectedTab: 'leads',
    expectedSubRow: 1,
    expectedTool: 'scan_area'
  },
  {
    name: '5. See Who\'s Winning Google Maps / Scan Competitors',
    input: { tab: 'business_scan', tool: 'business_scan' as const },
    expectedTab: 'business_scan',
    expectedSubRow: 0,
    expectedTool: 'business_scan'
  },
  {
    name: '6. Retry at 10 km',
    input: { tab: 'retry_radius', radiusKm: 10 },
    expectedTab: 'dashboard',
    expectedScanRadius: 10,
    expectedTriggerScan: true
  },
  {
    name: '7. Retry at 25 km',
    input: { tab: 'retry_radius', radiusKm: 25 },
    expectedTab: 'dashboard',
    expectedScanRadius: 25,
    expectedTriggerScan: true
  },
  {
    name: '8. Refresh scan in Naples / Run 10-Second Competitor Scan',
    input: { tab: 'business_scan' },
    expectedTab: 'business_scan'
  },
  {
    name: '9. Review Business Profile / Complete Profile Now / Verify Trade Category',
    input: { tab: 'profile', tool: 'profile' as const },
    expectedTab: 'profile',
    expectedSubRow: 0,
    expectedTool: 'profile'
  },
  {
    name: '10. Generate Review QR / Generate QR & Review Link / Request Review',
    input: { tab: 'reviews', tool: 'reviews' as const, subRow: 1 },
    expectedTab: 'reviews',
    expectedSubRow: 1,
    expectedTool: 'reviews'
  },
  {
    name: '11. Quote / Visual Estimator / Spatial Inspector',
    input: { tab: 'estimator', tool: 'estimator' as const },
    expectedTab: 'estimator',
    expectedSubRow: 0,
    expectedTool: 'estimator'
  },
  {
    name: '12. Upgrade / View Pro Plans',
    input: { tab: 'plans' },
    expectedTab: 'plans',
    expectedSubRow: 0
  }
];

core12Buttons.forEach(btn => {
  const res = resolveNavigation(btn.input);
  assert.strictEqual(res.targetTab, btn.expectedTab, `${btn.name} targetTab mismatch`);
  if (btn.expectedSubRow !== undefined) {
    assert.strictEqual(res.targetSubRow, btn.expectedSubRow, `${btn.name} subRow mismatch`);
  }
  if (btn.expectedTool !== undefined) {
    assert.strictEqual(res.targetTool, btn.expectedTool, `${btn.name} tool mismatch`);
  }
  if (btn.expectedLeadId !== undefined) {
    assert.strictEqual(res.targetLeadId, btn.expectedLeadId, `${btn.name} leadId mismatch`);
  }
  if (btn.expectedScanRadius !== undefined) {
    assert.strictEqual(res.targetScanRadius, btn.expectedScanRadius, `${btn.name} scanRadius mismatch`);
  }
  if (btn.expectedTriggerScan !== undefined) {
    assert.strictEqual(res.triggerScan, btn.expectedTriggerScan, `${btn.name} triggerScan mismatch`);
  }
});

// Strict assertion: "Answer Leads" must NEVER resolve to subRow 0
const answerLeadCheck = resolveNavigation({ tab: 'answer_leads' });
assert.notStrictEqual(answerLeadCheck.targetSubRow, 0, 'CRITICAL: Answer leads must NEVER resolve to subRow 0 (Analyze MSG)!');
assert.strictEqual(answerLeadCheck.targetSubRow, 4, 'Answer leads must resolve to subRow 4 (CRM Inbox)!');

console.log('All 12 core button navigation assertions passed successfully! ✅');
