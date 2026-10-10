import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  evaluateQuoteCompleteness, 
  normalizeTradeKey, 
  getSuggestedCloseLine,
  recordQuoteOutcomeToBem 
} from './beforeYouSendService.ts';

describe('beforeYouSendService - Commercial Completeness Engine', () => {
  it('identifies trade keys accurately', () => {
    assert.strictEqual(normalizeTradeKey('lawn'), 'lawn_care');
    assert.strictEqual(normalizeTradeKey('Landscaping & Yard Work'), 'lawn_care');
    assert.strictEqual(normalizeTradeKey('hvac'), 'hvac');
    assert.strictEqual(normalizeTradeKey('Air Conditioning repair'), 'hvac');
    assert.strictEqual(normalizeTradeKey('Plumbing Services'), 'plumbing');
    assert.strictEqual(normalizeTradeKey('House Cleaning'), 'cleaning');
    assert.strictEqual(normalizeTradeKey('roofing'), 'generic');
    assert.strictEqual(normalizeTradeKey(''), 'generic');
  });

  it('evaluates weak lawn quote missing exclusions and CTA', () => {
    const result = evaluateQuoteCompleteness({
      trade: 'lawn_care',
      draftText: 'Bi-weekly front and back yard mowing, trimming and blowing. Starting Thursday.',
      amount: 65,
      hasTimeline: true,
      hasExclusions: false,
      hasNextStepCta: false,
      language: 'en'
    });

    assert.strictEqual(result.tradeResolved, 'lawn_care');
    assert.strictEqual(result.status, 'weak');
    assert.strictEqual(result.score, 80);
    assert.strictEqual(result.missing.length, 2);

    const missingIds = result.missing.map(m => m.id);
    assert.ok(missingIds.includes('exclusions'));
    assert.ok(missingIds.includes('cta'));
    assert.ok(result.missing.every(m => m.severity === 'should'));
    assert.ok(result.suggestedCloseLine.includes("APPROVE"));
  });

  it('marks quote as blocked when a must-have item is missing', () => {
    // Missing price
    const result = evaluateQuoteCompleteness({
      trade: 'lawn_care',
      draftText: 'Weekly front and back yard service.',
      hasExclusions: true,
      hasNextStepCta: true
    });

    assert.strictEqual(result.status, 'blocked');
    const priceMissing = result.missing.find(m => m.id === 'price');
    assert.ok(priceMissing);
    assert.strictEqual(priceMissing.severity, 'must');
  });

  it('marks quote as ready when all checklist items are met', () => {
    const result = evaluateQuoteCompleteness({
      trade: 'lawn_care',
      draftText: 'Bi-weekly mowing for front and back yard at $75/cut. Starting Thursday. Excludes branch removal. Reply APPROVE to lock in.',
      amount: 75,
      hasScope: true,
      hasFrequency: true,
      hasTimeline: true,
      hasExclusions: true,
      hasNextStepCta: true
    });

    assert.strictEqual(result.status, 'ready');
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.missing.length, 0);
  });

  it('evaluates HVAC trade checklist and warranty recommendations', () => {
    const result = evaluateQuoteCompleteness({
      trade: 'hvac',
      draftText: '3-ton split system replacement for $3,800. Diagnostic fee included.',
      amount: 3800,
      hasSystemType: true,
      hasDiagnosticVsRepair: true,
      hasWarranty: false,
      hasTimeline: false,
      hasNextStepCta: false,
      language: 'es'
    });

    // Must items (system and price) are present; should items missing
    assert.strictEqual(result.status, 'weak');
    const missingIds = result.missing.map(m => m.id);
    assert.ok(missingIds.includes('warranty'));
    assert.ok(missingIds.includes('timeline'));
    assert.ok(missingIds.includes('cta'));
  });

  it('provides generic fallback for unrecognized trades', () => {
    const result = evaluateQuoteCompleteness({
      trade: 'custom_masonry',
      amount: 1500,
      hasScope: true,
      hasTimeline: true,
      hasExclusions: false,
      hasNextStepCta: false
    });

    assert.strictEqual(result.tradeResolved, 'generic');
    assert.strictEqual(result.status, 'weak');
  });

  it('records quote lifecycle events to BEM without throwing (non-blocking)', () => {
    const events = [
      'quote_checked',
      'quote_sent_ready',
      'quote_sent_weak',
      'quote_sent_blocked_override',
      'quote_won',
      'quote_lost'
    ] as const;

    for (const ev of events) {
      assert.doesNotThrow(() => {
        recordQuoteOutcomeToBem({
          event: ev,
          trade: 'lawn_care',
          status: ev === 'quote_won' ? 'won' : ev === 'quote_lost' ? 'lost' : 'weak',
          missingIds: ['exclusions', 'cta'],
          businessId: 'test_biz_123',
          amount: 120,
          estimateId: 'est_test_456',
          customerName: 'Maria G.'
        });
      });
    }
  });
});
