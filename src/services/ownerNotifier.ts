/**
 * Owner Notification Service for Bvelt
 * Sends owner alerts for critical events:
 * 1) First signup / trial start (signup_or_trial)
 * 2) Successful message analysis (analyze_message_success)
 * 3) Checkout initiation or payment confirmation (checkout_started, checkout_or_payment)
 *
 * Setup:
 * Set OWNER_WEBHOOK_URL in Cloudflare Worker env to a Telegram webhook or https://webhook.site for alerts.
 * Client-side builds can also specify VITE_OWNER_WEBHOOK_URL.
 * If no webhook URL is configured, notifications fail-softly and log via console.info without throwing.
 */

export type OwnerNotificationEventType =
  | 'signup_or_trial'
  | 'analyze_message_success'
  | 'checkout_started'
  | 'checkout_or_payment';

export interface OwnerNotificationPayload {
  event: OwnerNotificationEventType;
  emailOrUid?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

export async function notifyOwner(payload: OwnerNotificationPayload): Promise<void> {
  const timestamp = payload.timestamp || new Date().toISOString();
  const fullBody = {
    event: payload.event,
    emailOrUid: payload.emailOrUid || 'anonymous_user',
    details: payload.details || {},
    timestamp
  };

  // Safely retrieve webhook URL from client Vite env or process env if available
  const webhookUrl = 
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OWNER_WEBHOOK_URL) ||
    (typeof process !== 'undefined' && process.env && (process.env.OWNER_WEBHOOK_URL || process.env.VITE_OWNER_WEBHOOK_URL)) ||
    '';

  console.log(`[Bvelt OwnerNotifier] Event triggered: ${payload.event}`, fullBody);

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullBody)
      });
      console.log(`[Bvelt OwnerNotifier] Successfully posted alert to OWNER_WEBHOOK_URL`);
    } catch (err) {
      console.warn(`[Bvelt OwnerNotifier] Failed to post to OWNER_WEBHOOK_URL (failing soft):`, err);
    }
  } else {
    console.info(`[Bvelt OwnerNotifier] OWNER_WEBHOOK_URL is not set. Event logged locally. (Set OWNER_WEBHOOK_URL in Cloudflare Worker env to a Telegram webhook or https://webhook.site for alerts.)`);
  }
}

