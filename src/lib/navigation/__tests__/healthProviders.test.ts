import assert from 'assert';
import { checkHealthProviders } from '../../../../api/healthProviders.ts';

async function testHealthProviders() {
  console.log('--- Testing Third-Party Provider Health Check Service ---');

  // Test with empty env (mocking missing keys)
  const emptyEnvResult = await checkHealthProviders({
    GEMINI_API_KEY: '',
    VITE_GEMINI_API_KEY: '',
    GROQ_API_KEY: '',
    GEOAPIFY_API_KEY: '',
    LOCATIONIQ_API_KEY: '',
    LOCATIONIQ_KEY: '',
    OPENCAGE_API_KEY: '',
    OPENCAGE_KEY: '',
    OPENROUTESERVICE_API_KEY: '',
    OPENROUTE_KEY: '',
    TAVILY_API_KEY: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_PROD_SECRET_KEY: '',
    RESEND_API_KEY: ''
  });
  
  if (!emptyEnvResult.ok) {
    console.log('Providers in emptyEnvResult:', emptyEnvResult.providers);
  }
  
  assert.strictEqual(typeof emptyEnvResult.ok, 'boolean', 'ok field must be a boolean');
  assert.strictEqual(emptyEnvResult.ok, true, 'ok should be true when no failures occur (missing keys are non-failing)');
  assert.ok(emptyEnvResult.checkedAt, 'checkedAt timestamp must be present');
  assert.ok(Array.isArray(emptyEnvResult.providers), 'providers must be an array');
  assert.strictEqual(emptyEnvResult.providers.length, 10, 'must check 10 providers');

  const gemini = emptyEnvResult.providers.find(p => p.name === 'gemini');
  assert.ok(gemini, 'gemini provider result must exist');
  assert.strictEqual(gemini.status, 'missing_key', 'gemini status should be missing_key when no key provided');
  assert.strictEqual(gemini.ms, 0, 'ms should be 0 when key missing');

  const groq = emptyEnvResult.providers.find(p => p.name === 'groq');
  assert.ok(groq, 'groq provider result must exist');
  assert.strictEqual(groq.status, 'missing_key');

  const stripe = emptyEnvResult.providers.find(p => p.name === 'stripe');
  assert.ok(stripe, 'stripe provider result must exist');
  assert.strictEqual(stripe.status, 'missing_key');

  // Test with process.env
  const realEnvResult = await checkHealthProviders(process.env);
  assert.strictEqual(typeof realEnvResult.ok, 'boolean', 'realEnvResult.ok must be boolean');
  assert.ok(Array.isArray(realEnvResult.providers), 'realEnvResult.providers must be an array');
  console.log(`Live process.env check returned ok=${realEnvResult.ok} with ${realEnvResult.providers.length} providers.`);

  console.log('✅ Provider Health Check unit test passed successfully!');
}

testHealthProviders().catch((err) => {
  console.error('❌ Provider Health Check test failed:', err);
  process.exit(1);
});
