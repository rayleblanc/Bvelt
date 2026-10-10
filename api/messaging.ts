/**
 * Node.js / Express API Handlers for Canonical Messaging & Evidence Ingestion
 * 
 * Mirrors the Cloudflare Workers messaging foundation in the Node / Container runtime.
 */

import { Request, Response } from "express";
import { CanonicalMessagingEngine } from "../src/knowledge/engine/canonicalMessaging.ts";

/**
 * GET /api/webhooks/whatsapp: Meta Challenge Verification
 */
export async function whatsAppWebhookGetHandler(req: Request, res: Response) {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    console.warn("[Node Express] WhatsApp webhook GET rejected: WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured.");
    return res.status(403).json({ error: "WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured on server." });
  }

  if (mode === "subscribe" && token && token === expectedToken) {
    console.log("[Node Express] WhatsApp webhook verified successfully.");
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ error: "Verification token mismatch or invalid mode." });
}

/**
 * POST /api/webhooks/whatsapp: Inbound WhatsApp Messages & Media Evidence
 */
export async function whatsAppWebhookPostHandler(req: Request, res: Response) {
  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const signatureHeader = (req.headers["x-hub-signature-256"] || req.headers["X-Hub-Signature-256"]) as string;
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret) {
      console.warn("[Node Express] Rejected WhatsApp webhook: WHATSAPP_APP_SECRET not configured on server.");
      return res.status(403).json({ error: "WHATSAPP_APP_SECRET not configured on server" });
    }

    if (!signatureHeader) {
      console.warn("[Node Express] Rejected WhatsApp webhook: Missing X-Hub-Signature-256 header.");
      return res.status(401).json({ error: "Missing X-Hub-Signature-256 header" });
    }

    const signatureVerified = await CanonicalMessagingEngine.verifyWhatsAppWebhookSignature(
      rawBody,
      signatureHeader,
      appSecret
    );
    if (!signatureVerified) {
      console.warn("[Node Express] Rejected WhatsApp webhook with invalid HMAC signature.");
      return res.status(401).json({ error: "Invalid X-Hub-Signature-256" });
    }

    const payload = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
    const messages = CanonicalMessagingEngine.normalizeWhatsAppWebhookPayload(payload, signatureVerified);
    
    // Ingest media as Evidence events
    const allEvidenceEvents: any[] = [];
    for (const msg of messages) {
      if (msg.media && msg.media.length > 0) {
        const events = await CanonicalMessagingEngine.ingestMessageEvidence(msg, "default");
        allEvidenceEvents.push(...events);
      }
    }

    return res.status(200).json({
      success: true,
      received: messages.length,
      evidenceRecorded: allEvidenceEvents.length,
      evidenceEvents: allEvidenceEvents
    });
  } catch (err: any) {
    console.error("[Node Express] WhatsApp Webhook error:", err?.message || "Internal error");
    return res.status(500).json({ success: false, error: err.message || "Failed to process webhook" });
  }
}

/**
 * POST /api/webhooks/telegram: Inbound Telegram Messages & Media Evidence
 */
export async function telegramWebhookPostHandler(req: Request, res: Response) {
  try {
    const secretHeader = req.headers["x-telegram-bot-api-secret-token"] as string;
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.warn("[Node Express] Rejected Telegram webhook: TELEGRAM_WEBHOOK_SECRET not configured on server.");
      return res.status(403).json({ error: "TELEGRAM_WEBHOOK_SECRET not configured on server" });
    }

    if (!secretHeader) {
      console.warn("[Node Express] Rejected Telegram webhook: Missing X-Telegram-Bot-Api-Secret-Token header.");
      return res.status(401).json({ error: "Missing X-Telegram-Bot-Api-Secret-Token header" });
    }

    const signatureVerified = CanonicalMessagingEngine.verifyTelegramWebhookSecret(secretHeader, expectedSecret);
    if (!signatureVerified) {
      console.warn("[Node Express] Rejected Telegram webhook with invalid secret token.");
      return res.status(401).json({ error: "Invalid Telegram secret token" });
    }

    const payload = req.body;
    const messages = CanonicalMessagingEngine.normalizeTelegramWebhookPayload(payload, signatureVerified);

    const allEvidenceEvents: any[] = [];
    for (const msg of messages) {
      if (msg.media && msg.media.length > 0) {
        const events = await CanonicalMessagingEngine.ingestMessageEvidence(msg, "default");
        allEvidenceEvents.push(...events);
      }
    }

    return res.status(200).json({
      success: true,
      received: messages.length,
      evidenceRecorded: allEvidenceEvents.length,
      evidenceEvents: allEvidenceEvents
    });
  } catch (err: any) {
    console.error("[Node Express] Telegram Webhook error:", err?.message || "Internal error");
    return res.status(500).json({ success: false, error: err.message || "Failed to process webhook" });
  }
}

/**
 * Helper: Direct Provider External Send (Meta Graph API / Telegram Bot API)
 */
async function executeDirectProviderSend(req: Request, res: Response, params: any) {
  const { channel, recipientId, text } = params;
  if (!recipientId || !text) {
    return res.status(400).json({ error: "Missing required fields: 'recipientId' and 'text'." });
  }

  if (channel === "whatsapp") {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumId) {
      return res.status(503).json({
        success: false,
        error: "WhatsApp Cloud API credentials missing in environment variables."
      });
    }

    const cleanPhone = String(recipientId).replace(/[^0-9]/g, "");
    const fbRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { preview_url: false, body: text }
      })
    });

    const data: any = await fbRes.json().catch(() => ({}));
    if (!fbRes.ok) {
      return res.status(400).json({
        success: false,
        error: data.error?.message || `WhatsApp API error ${fbRes.status}`
      });
    }

    return res.status(200).json({
      success: true,
      channel: "whatsapp",
      recipientId: cleanPhone,
      externalMessageId: data.messages?.[0]?.id || `wa_${Date.now()}`,
      status: "SENT",
      sentAt: new Date().toISOString()
    });
  }

  if (channel === "telegram") {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(503).json({
        success: false,
        error: "Telegram Bot credentials missing in environment variables."
      });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: recipientId,
        text
      })
    });

    const data: any = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !data.ok) {
      return res.status(400).json({
        success: false,
        error: data.description || `Telegram API error ${tgRes.status}`
      });
    }

    return res.status(200).json({
      success: true,
      channel: "telegram",
      recipientId,
      externalMessageId: String(data.result?.message_id || Date.now()),
      status: "SENT",
      sentAt: new Date().toISOString()
    });
  }

  return res.status(400).json({
    error: `Unsupported channel: '${channel}'. Must be 'whatsapp' or 'telegram'.`
  });
}

/**
 * POST /api/messaging/send: Outbound message dispatching through Canonical Messaging Engine,
 * Autonomy Policy, Outcome Ledger, and Resilient Queue.
 */
export async function messagingSendHandler(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const { channel, recipientId, text, businessId, toolId, actionId, operatorApproved, currentHour, directProviderSend } = body;

    // Direct provider delivery execution step (called internally by dispatchCanonicalOutboundMessage)
    if (directProviderSend) {
      return executeDirectProviderSend(req, res, { channel, recipientId, text });
    }

    // Canonical dispatch flow: Autonomy Policy -> Resilient Dispatch -> Outcome Ledger
    if (!recipientId || !text) {
      return res.status(400).json({ error: "Missing required fields: 'recipientId' and 'text'." });
    }

    const targetBusinessId = businessId || "canonical_default";
    const targetToolId = toolId || "draft_lead_follow_up";

    const outboundMsg = CanonicalMessagingEngine.createCanonicalOutboundMessage({
      channel: channel || "whatsapp",
      recipientId,
      text,
      businessId: targetBusinessId,
      toolId: targetToolId,
      actionId
    });

    const dispatchResult = await CanonicalMessagingEngine.dispatchCanonicalOutboundMessage(outboundMsg, {
      operatorApproved: operatorApproved === true,
      currentHour: typeof currentHour === "number" ? currentHour : undefined
    });

    if (dispatchResult.status === "BLOCKED_BY_POLICY") {
      return res.status(403).json({
        success: false,
        status: "BLOCKED_BY_POLICY",
        error: dispatchResult.error,
        ledgerEventId: dispatchResult.ledgerEventId,
        policyDecision: dispatchResult.policyDecision
      });
    }

    if (dispatchResult.status === "DRAFT") {
      return res.status(200).json({
        success: true,
        status: "DRAFT",
        message: dispatchResult.message,
        ledgerEventId: dispatchResult.ledgerEventId,
        policyDecision: dispatchResult.policyDecision
      });
    }

    if (dispatchResult.status === "SENT") {
      return res.status(200).json({
        success: true,
        status: "SENT",
        channel: dispatchResult.message.channel,
        recipientId: dispatchResult.message.recipientId,
        externalMessageId: dispatchResult.message.externalMessageId || dispatchResult.message.id,
        sentAt: dispatchResult.message.sentAt,
        ledgerEventId: dispatchResult.ledgerEventId
      });
    }

    // Queued offline or Unavailable (e.g. timeout / network failure)
    return res.status(202).json({
      success: false,
      status: dispatchResult.status,
      queueId: dispatchResult.queueId,
      error: dispatchResult.error,
      ledgerEventId: dispatchResult.ledgerEventId
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to dispatch message" });
  }
}
