import assert from 'node:assert';
import { resolveVoiceIntent, parseLocalVoiceIntent, extractRadiusKm } from '../../voiceIntent';
import { is404GroqModel } from '../../../../api/ai-config';

console.log('--- Testing Voice Intent Resolution & Radius Extraction ---');

// 1. extractRadiusKm tests
assert.strictEqual(extractRadiusKm('radar a 10 km'), 10, 'Extracts 10 km from string');
assert.strictEqual(extractRadiusKm('haz un escaneo a 25 kilometros'), 25, 'Extracts 25 km');
assert.strictEqual(extractRadiusKm('scan 5km radius'), 5, 'Extracts 5km');
assert.strictEqual(extractRadiusKm('ver mis leads'), undefined, 'No radius in lead text');

// 2. parseLocalVoiceIntent without mandatory exact phrases
const scanTest = parseLocalVoiceIntent('quiero ver competidores locales en la zona a 15 km');
assert.strictEqual(scanTest.intent, 'scan', 'Intent should be scan');
assert.strictEqual(scanTest.radiusKm, 15, 'Radius should be 15');

const leadTest = parseLocalVoiceIntent('necesito responder a mis clientes de hoy');
assert.strictEqual(leadTest.intent, 'leads', 'Intent should be leads');

const reviewTest = parseLocalVoiceIntent('muéstrame las reseñas y el qr de google');
assert.strictEqual(reviewTest.intent, 'reviews', 'Intent should be reviews');

const quoteTest = parseLocalVoiceIntent('cuánto debería cobrar por un trabajo de plomería');
assert.strictEqual(quoteTest.intent, 'quote', 'Intent should be quote');

const plansTest = parseLocalVoiceIntent('quiero ver los planes y límites de la cuenta');
assert.strictEqual(plansTest.intent, 'plans', 'Intent should be plans');

const webTest = parseLocalVoiceIntent('cómo está quedando mi sitio web');
assert.strictEqual(webTest.intent, 'website', 'Intent should be website');

const profileTest = parseLocalVoiceIntent('quiero actualizar el teléfono de mi negocio');
assert.strictEqual(profileTest.intent, 'profile', 'Intent should be profile');

// 3. Before You Send voice intents: check_quote & add_closing_line
const checkQuoteTest1 = parseLocalVoiceIntent('check quote', 'en', {
  trade: 'lawn_care',
  draftText: 'Weekly mowing for front yard only $60.',
  amount: 60
});
assert.strictEqual(checkQuoteTest1.intent, 'check_quote', 'Intent should be check_quote');
assert.ok(checkQuoteTest1.reply.includes('%'), 'Reply should include completeness score percentage');
assert.ok(checkQuoteTest1.missingItems && checkQuoteTest1.missingItems.length > 0, 'Reply should identify missing items');

const checkQuoteTest2 = parseLocalVoiceIntent('¿está listo el presupuesto antes de enviar?', 'es', {
  trade: 'lawn_care',
  draftText: 'Corte de césped frente y fondo semanal por $65. Excluye ramas. Responde APRUEBO.',
  amount: 65
});
assert.strictEqual(checkQuoteTest2.intent, 'check_quote', 'Intent should be check_quote in Spanish');

const addCloseTestEn = parseLocalVoiceIntent('add closing line to my quote', 'en', { trade: 'lawn_care' });
assert.strictEqual(addCloseTestEn.intent, 'add_closing_line', 'Intent should be add_closing_line');
assert.ok(addCloseTestEn.closeLine && addCloseTestEn.closeLine.includes('APPROVE'), 'Close line should have APPROVE CTA');

const addCloseTestEs = parseLocalVoiceIntent('agregar línea de cierre comercial', 'es', { trade: 'hvac' });
assert.strictEqual(addCloseTestEs.intent, 'add_closing_line', 'Intent should be add_closing_line in Spanish');
assert.ok(addCloseTestEs.closeLine && addCloseTestEs.closeLine.includes('CONFIRMAR'), 'Close line should have CONFIRMAR CTA');

// 4. 404 Groq model filter check
assert.strictEqual(is404GroqModel('llama3-70b-8192'), true, 'llama3-70b-8192 identified as decommissioned model');
assert.strictEqual(is404GroqModel('llama-3.3-70b-specdec'), true, 'specdec identified as decommissioned model');
assert.strictEqual(is404GroqModel('llama-3.3-70b-versatile'), false, 'llama-3.3-70b-versatile is valid production model');

console.log('All voice intent and 404 Groq model test assertions passed successfully! ✅');
