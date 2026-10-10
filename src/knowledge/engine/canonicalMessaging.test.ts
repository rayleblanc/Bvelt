/**
 * BVELT CANONICAL MESSAGING & EVIDENCE INGESTION TEST SUITE
 */

import { CanonicalMessagingEngine } from './canonicalMessaging.ts';
import { OutcomeLedgerService } from '../memory/outcomeLedgerService.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED ASSERTION: ${message}`);
    throw new Error(message);
  }
}

export async function runMessagingTests() {
  console.log('🧪 Starting BVELT Messaging & Evidence Ingestion Test Suite...\n');

  // --- TEST 1: Webhook HMAC-SHA256 Signature Verification ---
  console.log('--- TEST 1: Webhook Signature Verification ---');
  const appSecret = 'secret_test_key_123';
  const rawBody = JSON.stringify({ entry: [{ id: '123' }] });
  
  // Compute valid signature
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const validHex = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const isValidSig = await CanonicalMessagingEngine.verifyWhatsAppWebhookSignature(
    rawBody,
    `sha256=${validHex}`,
    appSecret
  );
  assert(isValidSig === true, 'WhatsApp HMAC signature verification succeeded');

  const isInvalidSig = await CanonicalMessagingEngine.verifyWhatsAppWebhookSignature(
    rawBody,
    'sha256=invalid_hash_12345',
    appSecret
  );
  assert(isInvalidSig === false, 'WhatsApp HMAC signature verification rejected invalid hash');

  const isTelegramSecretValid = CanonicalMessagingEngine.verifyTelegramWebhookSecret('secret_tg_999', 'secret_tg_999');
  assert(isTelegramSecretValid === true, 'Telegram secret token verified');
  console.log('✅ PASS: Webhook cryptographic verification works');

  // --- TEST 2: Inbound Message Normalization ---
  console.log('\n--- TEST 2: Message Normalization (WhatsApp & Telegram) ---');
  const rawWhatsAppPayload = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'ph_987654' },
              contacts: [{ wa_id: '5215551234567', profile: { name: 'Juan Perez' } }],
              messages: [
                {
                  from: '5215551234567',
                  id: 'wamid.HBgLMTIzNDU2Nzg5',
                  timestamp: '1788460000',
                  type: 'image',
                  image: {
                    id: 'media_img_101',
                    mime_type: 'image/jpeg',
                    caption: 'Foto de instalacion terminada',
                    sha256: 'abcd1234sha256'
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const normalizedWa = CanonicalMessagingEngine.normalizeWhatsAppWebhookPayload(rawWhatsAppPayload, true);
  assert(normalizedWa.length === 1, 'Normalized 1 WhatsApp message');
  assert(normalizedWa[0].channel === 'whatsapp', 'Channel is WhatsApp');
  assert(normalizedWa[0].senderName === 'Juan Perez', 'Preserves sender name');
  assert(normalizedWa[0].media?.[0]?.type === 'image', 'Extracted image media');
  assert(normalizedWa[0].provenance.signatureVerified === true, 'Preserved signature verification status');
  console.log('✅ PASS: WhatsApp message normalization works');

  const rawTelegramPayload = {
    message: {
      message_id: 8821,
      from: { id: 998877, first_name: 'Maria', last_name: 'Gomez' },
      chat: { id: 998877 },
      date: 1788460000,
      photo: [
        { file_id: 'thumb_id', file_unique_id: 'u1', file_size: 100 },
        { file_id: 'full_id_88', file_unique_id: 'u2', file_size: 5000 }
      ],
      caption: 'Evidencia de trabajo concluido'
    }
  };

  const normalizedTg = CanonicalMessagingEngine.normalizeTelegramWebhookPayload(rawTelegramPayload, true);
  assert(normalizedTg.length === 1, 'Normalized 1 Telegram message');
  assert(normalizedTg[0].channel === 'telegram', 'Channel is Telegram');
  assert(normalizedTg[0].media?.[0]?.fileId === 'full_id_88', 'Selected highest resolution photo');
  console.log('✅ PASS: Telegram message normalization works');

  // --- TEST 3: Evidence Ingestion & Record V1 Cryptographic Hashes ---
  console.log('\n--- TEST 3: Evidence Ingestion through Messaging ---');
  const evidenceEvents = await CanonicalMessagingEngine.ingestMessageEvidence(
    normalizedWa[0],
    'biz_test_plumbing_101'
  );

  assert(evidenceEvents.length === 1, 'Ingested 1 evidence event from WhatsApp media');
  const ev = evidenceEvents[0];
  assert(ev.fieldKey === 'job_evidence_photo', 'Correctly identified job_evidence_photo');
  assert(ev.observationType === 'OBSERVATION', 'Honest OBSERVATION classification');
  assert(ev.evidenceStatus === 'USER_PROVIDED', 'Honest USER_PROVIDED state');
  assert(ev.newValue.status === 'ACCEPTED', 'Status ACCEPTED for valid image/jpeg');
  assert(typeof ev.eventHash === 'string' && ev.eventHash.length === 64, 'Computed valid SHA256 eventHash');
  console.log('✅ PASS: Valid media evidence recorded with Record V1 integrity');

  // Unsupported media rejection
  const invalidMediaMessage = {
    ...normalizedWa[0],
    id: 'msg_in_invalid_99',
    media: [
      {
        type: 'unknown' as const,
        mimeType: 'video/x-matroska',
        caption: 'Unsupported mkv video'
      }
    ]
  };

  const rejectedEvents = await CanonicalMessagingEngine.ingestMessageEvidence(
    invalidMediaMessage,
    'biz_test_plumbing_101'
  );
  assert(rejectedEvents.length === 1, 'Ingested rejected event for unsupported media');
  assert(rejectedEvents[0].evidenceStatus === 'UNVERIFIED', 'Honest UNVERIFIED state for rejected media');
  assert(rejectedEvents[0].newValue.status === 'REJECTED', 'Status REJECTED in newValue');
  console.log('✅ PASS: Unsupported media yields honest REJECTED / UNKNOWN state');

  // --- TEST 4: Action Engine ↔ Outbound Dispatch Governance ---
  console.log('\n--- TEST 4: Outbound Dispatch Governance & Outcome Ledger ---');

  // Level 1: Draft Only
  const draftMsg = CanonicalMessagingEngine.createCanonicalOutboundMessage({
    channel: 'whatsapp',
    recipientId: '5215559998877',
    text: 'Hola, confirmamos tu cita de mañana a las 10am',
    businessId: 'biz_test_plumbing_101',
    toolId: 'draft_lead_follow_up'
  });

  const draftDispatchRes = await CanonicalMessagingEngine.dispatchCanonicalOutboundMessage(draftMsg, {
    operatorApproved: false,
    currentHour: 14 // Daytime
  });

  assert(draftDispatchRes.status === 'DRAFT', 'Level 1 policy results in DRAFT status without sending');
  assert(draftDispatchRes.message.status === 'DRAFT', 'Message status is strictly DRAFT');
  assert(typeof draftDispatchRes.ledgerEventId === 'string', 'Recorded draft in Outcome Ledger');
  console.log('✅ PASS: Level 1 policy prevents autonomous external dispatch and creates DRAFT');

  // Level 0: Observe Only
  // Force a policy level 0 evaluation by calling dispatch when autonomy policy blocks
  const blockedMsg = CanonicalMessagingEngine.createCanonicalOutboundMessage({
    channel: 'whatsapp',
    recipientId: '5215559998877',
    text: 'Outreach that should be blocked',
    businessId: 'biz_level0_test',
    toolId: 'request_review_after_completed_job'
  });

  // Temporarily set autonomy policy level to 0 for this business
  const { AutonomyPolicyEngine } = await import('./autonomyPolicy.ts');
  const policy = AutonomyPolicyEngine.getPolicy('biz_level0_test');
  policy.level = 0;
  AutonomyPolicyEngine.savePolicy(policy);

  const blockedRes = await CanonicalMessagingEngine.dispatchCanonicalOutboundMessage(blockedMsg, {
    currentHour: 14
  });

  assert(blockedRes.status === 'BLOCKED_BY_POLICY', 'Level 0 correctly blocked outbound message');
  assert(blockedRes.message.status === 'BLOCKED_BY_POLICY', 'Message status set to BLOCKED_BY_POLICY');
  console.log('✅ PASS: Level 0 policy blocks outbound dispatch');

  console.log('\n🎉 ALL MESSAGING & EVIDENCE INGESTION TESTS PASSED SUCCESSFULLY!');
}

runMessagingTests().catch(err => {
  console.error('❌ MESSAGING TEST SUITE ERROR:', err);
  process.exit(1);
});
