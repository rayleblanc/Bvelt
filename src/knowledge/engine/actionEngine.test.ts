import { ActionEngine, NextBestAction } from './actionEngine';
import { MarketContext, MarketGap } from './marketReferenceEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting ActionEngine Contextual Next Best Action Test Suite...\n');

  // TEST A: Scheduled Follow-up (Priority over general cold leads)
  console.log('--- TEST A: Scheduled Follow-Up Due Today ---');
  const todayStr = new Date().toISOString().split('T')[0];
  const leadsTestA: any[] = [
    { id: 'lead-1', name: 'Cold Lead', status: 'NEW', createdAt: todayStr },
    { id: 'lead-2', name: 'Hot Follow-up', status: 'FOLLOW_UP', nextActionDate: todayStr, estimatedValue: 1200 }
  ];
  const actionsA = ActionEngine.computeNextBestActions(leadsTestA);
  assert(actionsA.length > 0, 'Generates actions for leads');
  assert(actionsA[0].id.includes('lead-2'), 'Top NBA is the scheduled follow-up for lead-2');
  assert(actionsA[0].priorityScore >= 95, 'Follow-up has priority score >= 95');
  assert(actionsA[0].bveltMoment !== undefined, 'Top NBA has bveltMoment populated');
  assert(actionsA[0].bveltMoment?.whatIsHappening.length > 0, 'bveltMoment has whatIsHappening');
  assert(actionsA[0].bveltMoment?.whyItMatters.length > 0, 'bveltMoment has whyItMatters');
  assert(actionsA[0].bveltMoment?.opportunitySummary.length > 0, 'bveltMoment has opportunitySummary');

  // TEST B: Pending Sent Quote Follow-Up
  console.log('\n--- TEST B: Stored Commercial Quote Follow-Up ---');
  // Mock localStorage for node environment
  (global as any).localStorage = {
    getItem: (key: string) => {
      if (key === 'bvelt_commercial_quotes') {
        return JSON.stringify([
          {
            id: 'quote-101',
            clientName: 'Acme Logistics',
            total: 3500,
            status: 'SENT',
            expiresAt: '2026-10-01',
            updatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString() // 36 hours ago
          }
        ]);
      }
      return null;
    }
  };
  const actionsB = ActionEngine.computeNextBestActions([]);
  assert(actionsB.length > 0, 'Generates quote follow-up action');
  const quoteAct = actionsB.find(a => a.id.includes('quote-101') || a.id.includes('quote_quote-101'));
  assert(quoteAct !== undefined, 'Found quote follow-up action in NBA list');
  assert(quoteAct!.priorityScore === 98, 'Quote follow-up has very high priority score (98)');
  assert(quoteAct!.action.includes('3,500') || quoteAct!.action.includes('Acme Logistics'), 'Action text includes quote details');

  // TEST C: Responded Lead (Inquiry Waiting for Proposal)
  console.log('\n--- TEST C: Responded Lead ---');
  const leadsTestC: any[] = [
    { id: 'lead-c1', name: 'Maria Santos', status: 'RESPONDED', notes: 'Needs roofing estimate' }
  ];
  const actionsC = ActionEngine.computeNextBestActions(leadsTestC);
  const respAct = actionsC.find(a => a.id.includes('lead-c1') || a.id.includes('responded'));
  assert(respAct !== undefined, 'Found responded lead action');
  assert(respAct!.priorityScore >= 90, 'Responded lead has priority score >= 90');
  assert(respAct!.destinationCode === 'SEND_QUOTE' || respAct!.destinationCode === 'CONTACT_LEAD', 'Valid destination code');

  // TEST D: High-Quality New Lead vs Low-Quality New Lead
  console.log('\n--- TEST D: Lead Quality Differentiation ---');
  const leadsTestD: any[] = [
    { id: 'lead-hq', name: 'High Quality Lead', status: 'NEW', phone: '555-1234', address: '123 Main St, Miami', notes: 'Emergency pipe burst immediate service needed', estimatedValue: 2500 },
    { id: 'lead-lq', name: 'Low Quality Lead', status: 'NEW' }
  ];
  const actionsD = ActionEngine.computeNextBestActions(leadsTestD);
  const hqAct = actionsD.find(a => a.id.includes('lead-hq'));
  const lqAct = actionsD.find(a => a.id.includes('lead-lq'));
  assert(hqAct !== undefined && lqAct !== undefined, 'Both leads have actions');
  assert((hqAct!.priorityScore || 0) > (lqAct!.priorityScore || 0), 'High quality lead scored higher than low quality lead');

  // TEST E: Won Lead -> Compliant Review Request (Google April 2026 Compliance)
  console.log('\n--- TEST E: Won Lead Review Request Compliance ---');
  const leadsTestE: any[] = [
    { id: 'lead-won', name: 'Carlos Gomez', status: 'WON', phone: '555-9876' }
  ];
  const actionsE = ActionEngine.computeNextBestActions(leadsTestE);
  const reviewAct = actionsE.find(a => a.id.includes('lead-won') || a.id.includes('won'));
  assert(reviewAct !== undefined, 'Generates review request action for won lead');
  assert(!reviewAct!.action.includes('5 estrellas') && !reviewAct!.action.includes('5-star'), 'Does not force 5-star wording');
  assert(!reviewAct!.reason.includes('en persona') && !reviewAct!.reason.includes('in-person'), 'Compliant with post-service timing');

  // TEST F: Won Lead Outcome / Measurement Verification
  console.log('\n--- TEST F: Outcome & Revenue Measurement ---');
  const actionsF = ActionEngine.computeNextBestActions(leadsTestE);
  // Both review and outcome tracking should be supported cleanly
  assert(actionsF.some(a => a.id.includes('lead-won') || a.id.includes('won')), 'Includes post-deal review action');

  // TEST G: Ghost Competitor Movement
  console.log('\n--- TEST G: Ghost Competitor Movement ---');
  const competitorMovements = [
    {
      competitorName: 'Apex Roofing Experts',
      changeType: 'REVIEWS_INCREASED',
      delta: 6,
      currentRating: 4.9,
      reviewCount: 48
    }
  ];
  const actionsG = ActionEngine.computeNextBestActions([], [], undefined, competitorMovements);
  const compAct = actionsG.find(a => a.id.includes('Apex Roofing Experts') || a.id.includes('ghost'));
  assert(compAct !== undefined, 'Generates Ghost Competitor defensive action');
  assert(compAct!.evidence.includes('BEM POI'), 'Traceable to BEM POI History');
  assert(compAct!.evidenceLevel === 'VERIFIED', 'Evidence level is VERIFIED');

  // TEST H: Operational Fingerprint Friction Mentions
  console.log('\n--- TEST H: Operational Fingerprint Friction ---');
  const operationalSummary = {
    frictionMentions: ['Demoras en respuesta telefónica', 'Falta de confirmación de presupuesto']
  };
  const actionsH = ActionEngine.computeNextBestActions([], [], undefined, undefined, operationalSummary);
  const opAct = actionsH.find(a => a.id.includes('op_friction_0') || a.id.includes('op_risk') || a.id.includes('friction'));
  assert(opAct !== undefined, 'Generates Operational Friction mitigation action');
  assert(opAct!.evidenceLevel === 'DERIVED', 'Evidence level is DERIVED');

  // TEST I: Market Gaps & Opportunity Detection
  console.log('\n--- TEST I: Market Gaps ---');
  const marketContext: any = {
    city: 'Orlando',
    niche: 'Plomería',
    geographicCoverage: 'Orlando, FL',
    industryPresence: { marketSizeProxy: 100, establishmentDensity: 12, employmentDensity: 50 },
    economicContext: { wagePressure: 25, populationContext: 300000, incomeContext: 65000 },
    totalComparableBusinesses: 12,
    avgReviewCount: 45,
    marketGaps: [
      {
        id: 'gap-rev-1',
        type: 'REVIEW_VOLUME_GAP',
        title: 'Brecha de volumen de opiniones',
        description: 'Tu perfil tiene menos de la mitad del promedio de opiniones del mercado.',
        evidence: 'BEM Market Gap Detector: 18 vs 45 average reviews',
        source: 'BEM Market Reference Engine',
        geographicScope: 'SAME_CITY',
        confidence: 0.88,
        status: 'DERIVED'
      },
      {
        id: 'gap-geo-1',
        type: 'GEOGRAPHIC_OPPORTUNITY',
        title: 'Territorio con baja densidad de competidores',
        description: 'La zona este de Orlando tiene alta demanda y poca presencia verificada.',
        evidence: 'BEM Geographic Radius Analysis: 2 competitors in 5km radius',
        source: 'BEM Market Reference Engine',
        geographicScope: 'SAME_CITY_SAME_RADIUS',
        confidence: 0.85,
        status: 'DERIVED'
      }
    ]
  };
  const actionsI = ActionEngine.computeNextBestActions([], [], marketContext);
  const revGapAct = actionsI.find(a => a.id.includes('gap-rev-1'));
  const geoGapAct = actionsI.find(a => a.id.includes('gap-geo-1'));
  assert(revGapAct !== undefined, 'Generates action for Review Volume Gap');
  assert(geoGapAct !== undefined, 'Generates action for Geographic Opportunity');
  assert(revGapAct!.bveltMoment?.whatIsHappening.includes('Orlando') || revGapAct!.whyNow.includes('Orlando'), 'Contains geographic market context');

  // TEST J: Fallback State (Zero Data / Calibration)
  console.log('\n--- TEST J: Zero Data / Calibration Fallback ---');
  // Clear quotes from localStorage mock
  (global as any).localStorage = {
    getItem: () => null
  };
  const actionsJ = ActionEngine.computeNextBestActions({
    leads: [],
    profile: { phone: '555-1234', hoursSet: true, photosCount: 5 }
  });
  assert(actionsJ.length > 0, 'Generates fallback calibration action when no leads or context');
  assert(actionsJ[0].evidenceLevel === 'INSUFFICIENT_DATA', 'Fallback calibration properly labeled with INSUFFICIENT_DATA');
  assert(actionsJ[0].id === 'nba_calibration', 'Fallback action has id nba_calibration');

  // TEST K: Single Top Hero Action Contract
  console.log('\n--- TEST K: Single Top Hero Action Contract ---');
  const topAction = actionsA[0];
  assert(topAction.id.length > 0, 'Top action has id');
  assert(topAction.action.length > 0, 'Top action has action title');
  assert(topAction.reason.length > 0, 'Top action has reason (why it matters)');
  assert(topAction.whyNow.length > 0, 'Top action has whyNow (what is happening)');
  assert(topAction.expectedBenefit.length > 0, 'Top action has expectedBenefit (outcome)');
  assert(topAction.evidence.length > 0, 'Top action has evidence (provenance)');
  assert(['VERIFIED', 'DERIVED', 'BENCHMARK', 'MODELED', 'INSUFFICIENT_DATA', 'USER_PROVIDED'].includes(topAction.evidenceLevel), 'Top action has valid evidenceLevel');
  assert(topAction.destination !== undefined, 'Top action has destination routing');
  assert(topAction.ctaLabel.length > 0, 'Top action has ctaLabel');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
