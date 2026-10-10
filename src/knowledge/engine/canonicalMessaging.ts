/**
 * BVELT CANONICAL MESSAGING & EVIDENCE INGESTION ENGINE
 * 
 * Provides:
 * 1. Normalized inbound/outbound messaging interfaces across WhatsApp Cloud API & Telegram.
 * 2. Cryptographic webhook signature verification (Meta HMAC-SHA256 & Telegram secret token).
 * 3. Evidence Ledger ingestion for job/evidence media reusing Record V1 integrity and provenance.
 * 4. Action Engine outbound dispatch governed by Autonomy Policy, Resilient Deep Reset, and Outcome Ledger.
 * 5. Honest offline/failure queuing via existing offlineStore (Zero false success).
 */

import { EvidenceEvent, ObservationType, EvidenceStatus } from '../memory/bemTypes';
import { 
  canonicalizeEvidenceEvent, 
  sha256Hex, 
  computeChainedEventHash, 
  GENESIS_HASH 
} from '../memory/integrity/evidenceIntegrity';
import { writeEvidenceRecord, createMemoryRecord } from '../memory/bemStore';
import { AutonomyPolicyEngine, ActionEngineToolId, PolicyDecision } from './autonomyPolicy';
import { ResilientExecutionEngine, ResilientExecutionResult } from './resilientExecution';
import { OutcomeLedgerService, ActionExecutionState, OutcomeState } from '../memory/outcomeLedgerService';
import { offlineStore } from '../../lib/pwa/offlineStore';

export type MessagingChannel = 'whatsapp' | 'telegram' | 'sms' | 'email';
export type MessageDirection = 'inbound' | 'outbound';
export type OutboundMessageStatus = 'DRAFT' | 'SENT' | 'QUEUED' | 'UNAVAILABLE' | 'FAILED' | 'BLOCKED_BY_POLICY';

export interface NormalizedMediaItem {
  id?: string;
  type: 'image' | 'document' | 'audio' | 'video' | 'unknown';
  mimeType: string;
  url?: string;
  fileId?: string; // Provider-specific ID (Telegram file_id or Meta media_id)
  fileName?: string;
  fileSizeBytes?: number;
  caption?: string;
  sha256Hash?: string;
}

export interface NormalizedInboundMessage {
  id: string; // Unique internal message ID: msg_in_<channel>_<id>
  externalMessageId: string;
  channel: MessagingChannel;
  senderId: string; // E.164 phone number or Telegram chat/user ID
  senderName?: string;
  recipientId?: string;
  text?: string;
  media?: NormalizedMediaItem[];
  timestamp: string; // ISO 8601
  rawPayload?: any;
  provenance: {
    source: 'WHATSAPP_CLOUD_API' | 'TELEGRAM_BOT_API' | 'MANUAL_OPERATOR';
    signatureVerified: boolean;
    receivedAt: string;
  };
}

export interface NormalizedOutboundMessage {
  id: string; // msg_out_<uuid>
  channel: MessagingChannel;
  recipientId: string; // E.164 phone or Telegram chat_id
  recipientName?: string;
  text: string;
  businessId: string;
  toolId?: ActionEngineToolId;
  actionId?: string;
  status: OutboundMessageStatus;
  policyLevel?: number;
  queueId?: string;
  ledgerEventId?: string;
  error?: string;
  createdAt: string;
  sentAt?: string;
  externalMessageId?: string;
}

export interface MessagingDispatchResult {
  success: boolean;
  status: OutboundMessageStatus;
  message: NormalizedOutboundMessage;
  policyDecision?: PolicyDecision;
  ledgerEventId?: string;
  queueId?: string;
  error?: string;
}

export interface DispatchOutboundOptions {
  operatorApproved?: boolean;
  timeoutMs?: number;
  tenantUid?: string | null;
  businessName?: string;
  currentHour?: number;
  apiUrl?: string; // Custom endpoint or Cloudflare /api/messaging/send
}

export class CanonicalMessagingEngine {
  // Supported media MIME types for real job evidence
  private static readonly SUPPORTED_IMAGE_MIMES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic'
  ]);

  private static readonly SUPPORTED_DOCUMENT_MIMES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]);

  /**
   * Evaluates if media is valid, supported job/evidence media.
   */
  public static isSupportedEvidenceMedia(media: NormalizedMediaItem): boolean {
    if (!media || !media.mimeType) return false;
    const lower = media.mimeType.toLowerCase();
    if (media.type === 'image' && this.SUPPORTED_IMAGE_MIMES.has(lower)) {
      return true;
    }
    if (media.type === 'document' && this.SUPPORTED_DOCUMENT_MIMES.has(lower)) {
      return true;
    }
    return false;
  }

  // =========================================================================
  // 1. CRYPTOGRAPHIC WEBHOOK VERIFICATION
  // =========================================================================

  /**
   * Verifies Meta WhatsApp Cloud API X-Hub-Signature-256 header using Web Crypto HMAC-SHA256.
   */
  public static async verifyWhatsAppWebhookSignature(
    rawBody: string,
    signatureHeader: string | null | undefined,
    appSecret: string
  ): Promise<boolean> {
    if (!signatureHeader || !appSecret) return false;
    
    // Header format: "sha256=<hex>"
    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }
    const expectedHex = parts[1].trim().toLowerCase();

    try {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
      const sigArray = Array.from(new Uint8Array(sigBuffer));
      const actualHex = sigArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
      
      return actualHex === expectedHex;
    } catch (err) {
      console.error('[CanonicalMessaging] WhatsApp signature verification error:', err);
      return false;
    }
  }

  /**
   * Verifies Telegram Webhook secret token header.
   */
  public static verifyTelegramWebhookSecret(
    secretHeader: string | null | undefined,
    expectedSecret: string
  ): boolean {
    if (!secretHeader || !expectedSecret) return false;
    return secretHeader.trim() === expectedSecret.trim();
  }

  // =========================================================================
  // 2. INBOUND WEBHOOK NORMALIZATION
  // =========================================================================

  /**
   * Normalizes Meta WhatsApp Cloud API webhook JSON payload into NormalizedInboundMessage[].
   */
  public static normalizeWhatsAppWebhookPayload(
    payload: any,
    signatureVerified: boolean = false
  ): NormalizedInboundMessage[] {
    const messages: NormalizedInboundMessage[] = [];
    if (!payload || !Array.isArray(payload.entry)) return messages;

    const receivedAt = new Date().toISOString();

    for (const entry of payload.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const val = change.value;
        if (!val || !Array.isArray(val.messages)) continue;

        const contactMap = new Map<string, string>();
        if (Array.isArray(val.contacts)) {
          for (const c of val.contacts) {
            if (c.wa_id && c.profile?.name) {
              contactMap.set(c.wa_id, c.profile.name);
            }
          }
        }

        const phoneNumId = val.metadata?.phone_number_id;

        for (const msg of val.messages) {
          const senderId = msg.from || '';
          const senderName = contactMap.get(senderId);
          const externalMessageId = msg.id || `wa_${Date.now()}`;
          const timestampIso = msg.timestamp 
            ? new Date(parseInt(msg.timestamp, 10) * 1000).toISOString()
            : receivedAt;

          let text: string | undefined = undefined;
          const media: NormalizedMediaItem[] = [];

          if (msg.type === 'text') {
            text = msg.text?.body;
          } else if (msg.type === 'image') {
            media.push({
              id: msg.image?.id,
              type: 'image',
              mimeType: msg.image?.mime_type || 'image/jpeg',
              fileId: msg.image?.id,
              caption: msg.image?.caption,
              sha256Hash: msg.image?.sha256
            });
            text = msg.image?.caption;
          } else if (msg.type === 'document') {
            media.push({
              id: msg.document?.id,
              type: 'document',
              mimeType: msg.document?.mime_type || 'application/pdf',
              fileName: msg.document?.filename,
              fileId: msg.document?.id,
              caption: msg.document?.caption,
              sha256Hash: msg.document?.sha256
            });
            text = msg.document?.caption;
          } else if (msg.type === 'audio' || msg.type === 'voice') {
            media.push({
              id: msg.audio?.id || msg.voice?.id,
              type: 'audio',
              mimeType: msg.audio?.mime_type || msg.voice?.mime_type || 'audio/ogg',
              fileId: msg.audio?.id || msg.voice?.id
            });
          } else {
            // Unrecognized or other media format
            media.push({
              type: 'unknown',
              mimeType: msg.type || 'unknown/unknown',
              caption: `Unsupported message type: ${msg.type}`
            });
          }

          messages.push({
            id: `msg_in_wa_${externalMessageId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            externalMessageId,
            channel: 'whatsapp',
            senderId,
            senderName,
            recipientId: phoneNumId,
            text,
            media: media.length > 0 ? media : undefined,
            timestamp: timestampIso,
            rawPayload: msg,
            provenance: {
              source: 'WHATSAPP_CLOUD_API',
              signatureVerified,
              receivedAt
            }
          });
        }
      }
    }

    return messages;
  }

  /**
   * Normalizes Telegram Bot API webhook JSON payload into NormalizedInboundMessage[].
   */
  public static normalizeTelegramWebhookPayload(
    payload: any,
    signatureVerified: boolean = false
  ): NormalizedInboundMessage[] {
    const messages: NormalizedInboundMessage[] = [];
    if (!payload) return messages;

    const receivedAt = new Date().toISOString();
    const msg = payload.message || payload.edited_message || payload.channel_post;
    if (!msg) return messages;

    const externalMessageId = String(msg.message_id || Date.now());
    const senderId = String(msg.from?.id || msg.chat?.id || '');
    const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username;
    const timestampIso = msg.date 
      ? new Date(msg.date * 1000).toISOString() 
      : receivedAt;

    let text: string | undefined = msg.text || msg.caption;
    const media: NormalizedMediaItem[] = [];

    // Telegram Photos (highest resolution is the last item in photo array)
    if (Array.isArray(msg.photo) && msg.photo.length > 0) {
      const bestPhoto = msg.photo[msg.photo.length - 1];
      media.push({
        id: bestPhoto.file_unique_id || bestPhoto.file_id,
        type: 'image',
        mimeType: 'image/jpeg',
        fileId: bestPhoto.file_id,
        fileSizeBytes: bestPhoto.file_size,
        caption: msg.caption
      });
    } else if (msg.document) {
      media.push({
        id: msg.document.file_unique_id || msg.document.file_id,
        type: 'document',
        mimeType: msg.document.mime_type || 'application/pdf',
        fileName: msg.document.file_name,
        fileId: msg.document.file_id,
        fileSizeBytes: msg.document.file_size,
        caption: msg.caption
      });
    } else if (msg.voice || msg.audio) {
      const audioItem = msg.voice || msg.audio;
      media.push({
        id: audioItem.file_unique_id || audioItem.file_id,
        type: 'audio',
        mimeType: audioItem.mime_type || 'audio/ogg',
        fileId: audioItem.file_id,
        fileSizeBytes: audioItem.file_size,
        caption: msg.caption
      });
    }

    messages.push({
      id: `msg_in_tg_${externalMessageId}`,
      externalMessageId,
      channel: 'telegram',
      senderId,
      senderName,
      recipientId: String(msg.chat?.id || ''),
      text,
      media: media.length > 0 ? media : undefined,
      timestamp: timestampIso,
      rawPayload: payload,
      provenance: {
        source: 'TELEGRAM_BOT_API',
        signatureVerified,
        receivedAt
      }
    });

    return messages;
  }

  // =========================================================================
  // 3. EVIDENCE INGESTION THROUGH MESSAGING
  // =========================================================================

  /**
   * Converts incoming job/evidence media into a cryptographic EvidenceEvent adhering strictly
   * to Record V1 integrity, provenance, and anti-hallucination standards.
   * 
   * Unsupported or invalid media yields an honest UNKNOWN/REJECTED state.
   */
  public static async ingestMessageEvidence(
    message: NormalizedInboundMessage,
    businessId: string,
    options: { tenantUid?: string | null; previousHash?: string } = {}
  ): Promise<EvidenceEvent[]> {
    const events: EvidenceEvent[] = [];
    if (!message.media || message.media.length === 0) return events;

    const entityId = businessId.startsWith('ent_biz_') ? businessId : `ent_biz_${businessId}`;
    const detectedAt = new Date().toISOString();
    const prevHash = options.previousHash || GENESIS_HASH;

    for (const [idx, item] of message.media.entries()) {
      const isSupported = this.isSupportedEvidenceMedia(item);
      const eventId = `ev_msg_${message.id}_${idx}_${Date.now().toString(36)}`;

      let fieldKey: string;
      let observationType: ObservationType;
      let evidenceStatus: EvidenceStatus;
      let confidence: number;
      let newValue: any;

      if (isSupported) {
        fieldKey = item.type === 'image' ? 'job_evidence_photo' : 'job_evidence_document';
        // Honest classification: It is an external observation from customer or tenant upload, NOT a verified external fact
        observationType = 'OBSERVATION';
        evidenceStatus = 'USER_PROVIDED';
        confidence = 0.90;

        newValue = {
          status: 'ACCEPTED',
          mediaType: item.type,
          mimeType: item.mimeType,
          fileName: item.fileName || (item.type === 'image' ? 'job_proof.jpg' : 'document.pdf'),
          fileId: item.fileId || null,
          url: item.url || null,
          caption: item.caption || message.text || 'Job evidence submitted via messaging',
          senderId: message.senderId,
          senderName: message.senderName || null,
          channel: message.channel,
          externalMessageId: message.externalMessageId,
          fileSizeBytes: item.fileSizeBytes || null,
          sha256Hash: item.sha256Hash || null,
          receivedAt: message.timestamp
        };
      } else {
        // Honest rejection: Never fabricate evidence or claim unverified media is valid
        fieldKey = 'unsupported_incoming_media';
        observationType = 'OBSERVATION';
        evidenceStatus = 'UNVERIFIED';
        confidence = 0.0;

        newValue = {
          status: 'REJECTED',
          reason: `Unsupported media type: ${item.mimeType || item.type}`,
          mimeType: item.mimeType || null,
          fileName: item.fileName || null,
          channel: message.channel,
          externalMessageId: message.externalMessageId,
          receivedAt: message.timestamp
        };
      }

      const rawEvent: EvidenceEvent = {
        eventId,
        entityId,
        fieldKey,
        oldValue: null,
        newValue,
        sourceType: message.channel === 'whatsapp' ? 'WHATSAPP_MESSAGING' : 'TELEGRAM_MESSAGING',
        observationType,
        evidenceStatus,
        confidence,
        observedAt: message.timestamp,
        detectedAt,
        producerVersion: 'BVELT_MESSAGING_V1',
        schemaVersion: 1,
        previousHash: prevHash
      };

      // Compute cryptographic hash chain conforming to Record V1
      const eventHash = await computeChainedEventHash(rawEvent, prevHash);
      rawEvent.currentHash = eventHash;
      rawEvent.eventHash = eventHash;

      // Save to L1/L2 BEM Store
      try {
        const memRecord = createMemoryRecord({
          entityId,
          fieldKey,
          value: newValue,
          valueType: 'object',
          observationType,
          evidenceStatus,
          confidence,
          sourceType: rawEvent.sourceType,
          sourceLabel: message.channel === 'whatsapp' ? 'WhatsApp Business' : 'Telegram Bot',
          sourceId: message.externalMessageId,
          producerVersion: rawEvent.producerVersion
        });

        await writeEvidenceRecord(
          {
            entityType: 'BUSINESS',
            entityId,
            identityVersion: 1,
            canonicalName: businessId,
            normalizedName: businessId.toLowerCase(),
            aliases: [],
            sourceIds: {},
            identityConfidence: 1.0,
            identityStatus: 'RESOLVED',
            createdAt: detectedAt,
            lastResolvedAt: detectedAt
          },
          memRecord,
          options.tenantUid || undefined
        );
      } catch (err) {
        console.warn('[CanonicalMessaging] BEM Store local update warning:', err);
      }

      events.push(rawEvent);
    }

    return events;
  }

  // =========================================================================
  // 4. ACTION ENGINE ↔ MESSAGING OUTBOUND DISPATCH
  // =========================================================================

  /**
   * Creates a normalized canonical outbound message structure from Action Engine tool output.
   */
  public static createCanonicalOutboundMessage(params: {
    channel: MessagingChannel;
    recipientId: string;
    recipientName?: string;
    text: string;
    businessId: string;
    toolId: ActionEngineToolId;
    actionId?: string;
  }): NormalizedOutboundMessage {
    return {
      id: `msg_out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      channel: params.channel,
      recipientId: params.recipientId,
      recipientName: params.recipientName,
      text: params.text,
      businessId: params.businessId,
      toolId: params.toolId,
      actionId: params.actionId,
      status: 'DRAFT',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Dispatches an outbound message under strict Autonomy Policy evaluation,
   * bounded timeouts, Deep Reset resilient queueing, and Outcome Ledger tracking.
   */
  public static async dispatchCanonicalOutboundMessage(
    message: NormalizedOutboundMessage,
    options: DispatchOutboundOptions = {}
  ): Promise<MessagingDispatchResult> {
    const toolId = message.toolId || 'draft_lead_follow_up';
    const businessId = message.businessId;
    const now = new Date().toISOString();

    // 1. Mandatory Autonomy Policy Evaluation
    const policyDecision = AutonomyPolicyEngine.evaluate(businessId, toolId, {
      isExternal: true,
      operatorApproved: options.operatorApproved,
      currentHour: options.currentHour
    });

    message.policyLevel = policyDecision.policyLevel;

    // Autonomy Policy Gate: Level 0 (OBSERVE) is strictly blocked
    if (!policyDecision.permitted) {
      message.status = 'BLOCKED_BY_POLICY';
      message.error = policyDecision.reason;

      const ledgerEntry = OutcomeLedgerService.recordExecution({
        businessId,
        toolId,
        actionId: message.actionId || message.id,
        executionState: 'BLOCKED_BY_POLICY',
        outcomeState: 'UNKNOWN',
        metricName: 'LEADS',
        outcomeType: 'OUTBOUND_MESSAGE_BLOCKED',
        description: `Outbound message to ${message.recipientId} blocked by Autonomy Policy: ${policyDecision.reason}`,
        providerCostUsd: 0,
        businessName: options.businessName,
        tenantUid: options.tenantUid,
        metadata: { channel: message.channel, recipientId: message.recipientId }
      });

      return {
        success: false,
        status: 'BLOCKED_BY_POLICY',
        message,
        policyDecision,
        ledgerEventId: ledgerEntry.id,
        error: policyDecision.reason
      };
    }

    // Autonomy Policy Gate: Level 1 (DRAFT) must not autonomously send external messages
    if (policyDecision.executionMode === 'DRAFT_ONLY') {
      message.status = 'DRAFT';

      const ledgerEntry = OutcomeLedgerService.recordExecution({
        businessId,
        toolId,
        actionId: message.actionId || message.id,
        executionState: 'DRAFT_CREATED',
        outcomeState: 'DECLARED',
        metricName: 'LEADS',
        outcomeType: 'OUTBOUND_MESSAGE_DRAFT_CREATED',
        description: `Message draft prepared for ${message.recipientId} (${message.channel})`,
        providerCostUsd: 0,
        businessName: options.businessName,
        tenantUid: options.tenantUid,
        metadata: { channel: message.channel, recipientId: message.recipientId }
      });

      return {
        success: true,
        status: 'DRAFT',
        message,
        policyDecision,
        ledgerEventId: ledgerEntry.id
      };
    }

    // Level 2 / Level 3 External Dispatch:
    // Execute through bounded timeout & offline fallback engine
    const resilientResult = await ResilientExecutionEngine.executeWithTimeout(
      async (signal) => {
        // If offline in browser or node test simulation
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('Network offline');
        }

        const endpoint = options.apiUrl || '/api/messaging/send';
        const payload = {
          channel: message.channel,
          recipientId: message.recipientId,
          text: message.text,
          businessId: message.businessId,
          toolId: message.toolId,
          actionId: message.actionId
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({})) as any;
          throw new Error(errData?.error || `HTTP ${response.status}: Failed to send message`);
        }

        return await response.json();
      },
      {
        timeoutMs: options.timeoutMs ?? 2500,
        actionType: 'MESSAGING_OUTBOUND',
        businessId,
        payload: {
          messageId: message.id,
          channel: message.channel,
          recipientId: message.recipientId,
          text: message.text,
          businessId
        }
      }
    );

    const isExecuted = resilientResult.status === 'EXECUTED';
    const finalStatus: OutboundMessageStatus = isExecuted 
      ? 'SENT' 
      : resilientResult.status === 'QUEUED' 
        ? 'QUEUED' 
        : 'UNAVAILABLE';

    const finalExecutionState: ActionExecutionState = isExecuted 
      ? 'SUCCESS' 
      : resilientResult.status === 'QUEUED' 
        ? 'QUEUED' 
        : 'UNAVAILABLE';

    const finalOutcomeState: OutcomeState = isExecuted ? 'MEASURED' : 'UNKNOWN';

    message.status = finalStatus;
    message.queueId = resilientResult.queueId;
    message.error = resilientResult.error;
    if (isExecuted) {
      message.sentAt = now;
      message.externalMessageId = (resilientResult.data as any)?.externalMessageId || message.id;
    }

    // Record usage against Autonomy Policy daily limits
    if (isExecuted) {
      AutonomyPolicyEngine.recordUsage(businessId, toolId, 0.00);
    }

    // Write execution event to Outcome Ledger
    const ledgerEntry = OutcomeLedgerService.recordExecution({
      businessId,
      toolId,
      actionId: message.actionId || message.id,
      executionState: finalExecutionState,
      outcomeState: finalOutcomeState,
      metricName: 'LEADS',
      outcomeType: isExecuted ? 'OUTBOUND_MESSAGE_SENT' : 'OUTBOUND_MESSAGE_DISPATCH_FAILED',
      description: isExecuted 
        ? `Outbound ${message.channel} message sent to ${message.recipientId}` 
        : `Outbound ${message.channel} message to ${message.recipientId} (${finalStatus})`,
      providerCostUsd: isExecuted ? 0.005 : 0.00,
      businessName: options.businessName,
      tenantUid: options.tenantUid,
      metadata: {
        channel: message.channel,
        recipientId: message.recipientId,
        queueId: resilientResult.queueId,
        error: resilientResult.error
      }
    });

    message.ledgerEventId = ledgerEntry.id;

    return {
      success: isExecuted || resilientResult.status === 'QUEUED',
      status: finalStatus,
      message,
      policyDecision,
      ledgerEventId: ledgerEntry.id,
      queueId: resilientResult.queueId,
      error: resilientResult.error
    };
  }
}
