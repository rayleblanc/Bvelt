import fetch from "node-fetch";

/**
 * Shared Owner Notification & Incident Throttle Utility for Bvelt.
 * 
 * Reglas:
 * - Alerta solo tras N fallos relevantes (cuota, webhook, pago, jobs).
 * - Anti-spam throttle (cooldown) por categoría de error.
 * - Fail-open para el llamador: no bloquea ni lanza excepciones no capturadas.
 * - Soporte para Telegram (primario) y Discord (opcional).
 */

interface FailureTracker {
  count: number;
  firstFailedAt: number;
  lastFailedAt: number;
  lastAlertSentAt: number;
}

const failureMap: Map<string, FailureTracker> = new Map();

export type AlertCategory = 
  | 'quota_exhausted'
  | 'stripe_webhook_failure'
  | 'crypto_payment_failure'
  | 'approval_expired'
  | 'critical_job_exhausted'
  | 'system_error';

const DEFAULT_THRESHOLDS: Record<AlertCategory, number> = {
  quota_exhausted: 3,         // Alerta tras 3 fallos de cuota consecutivos
  stripe_webhook_failure: 2,  // Alerta tras 2 fallos de webhook
  crypto_payment_failure: 2,  // Alerta tras 2 discrepancias/fallos
  approval_expired: 1,        // Alerta inmediata por cada aprobación vencida (fail-closed)
  critical_job_exhausted: 3,  // Alerta tras agotar 3 reintentos de un job
  system_error: 3
};

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos entre alertas idénticas

/**
 * Envío directo a Telegram/Discord
 */
export async function notifyOwner(message: string): Promise<void> {
  try {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    // 1. Telegram notification
    if (telegramToken && telegramChatId && telegramToken !== "YOUR_TELEGRAM_BOT_TOKEN") {
      try {
        const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message,
            disable_web_page_preview: true
          }),
          signal: AbortSignal.timeout(6000)
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.error(`[OwnerNotify] Telegram API error (${resp.status}): ${errText}`);
        }
      } catch (tgErr: any) {
        console.error("[OwnerNotify] Telegram request failed:", tgErr?.message || tgErr);
      }
    }

    // 2. Discord notification (opcional)
    if (discordWebhookUrl && discordWebhookUrl !== "YOUR_DISCORD_WEBHOOK_URL") {
      try {
        let content = message;
        if (content.length > 2000) {
          content = content.substring(0, 1997) + "...";
        }
        const resp = await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: AbortSignal.timeout(6000)
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.error(`[OwnerNotify] Discord Webhook error (${resp.status}): ${errText}`);
        }
      } catch (discErr: any) {
        console.error("[OwnerNotify] Discord request failed:", discErr?.message || discErr);
      }
    }
  } catch (err: any) {
    console.error("[OwnerNotify] General error:", err?.message || err);
  }
}

/**
 * Registra un fallo y solo envía alerta si alcanza el umbral de N fallos
 */
export async function recordFailureAndNotify(
  category: AlertCategory,
  key: string,
  details: {
    message: string;
    metadata?: Record<string, any>;
    customThreshold?: number;
  }
): Promise<{ alerted: boolean; currentCount: number }> {
  const now = Date.now();
  const trackerKey = `${category}:${key}`;
  const threshold = details.customThreshold || DEFAULT_THRESHOLDS[category] || 3;

  let tracker = failureMap.get(trackerKey);
  if (!tracker) {
    tracker = {
      count: 0,
      firstFailedAt: now,
      lastFailedAt: now,
      lastAlertSentAt: 0
    };
    failureMap.set(trackerKey, tracker);
  }

  tracker.count += 1;
  tracker.lastFailedAt = now;

  // Verificar si alcanzó el umbral N y respetó el cooldown
  const reachedThreshold = tracker.count >= threshold;
  const isCooldownPassed = (now - tracker.lastAlertSentAt) > COOLDOWN_MS;

  if (reachedThreshold && isCooldownPassed) {
    tracker.lastAlertSentAt = now;

    const formattedMessage = [
      `🚨 [BVELT ALERTA] ${category.toUpperCase()}`,
      `Frecuencia: ${tracker.count} fallos consecutivos (Umbral: N=${threshold})`,
      `Detalle: ${details.message}`,
      details.metadata ? `Contexto: ${JSON.stringify(details.metadata)}` : '',
      `Hora (UTC): ${new Date().toISOString()}`
    ].filter(Boolean).join('\n');

    await notifyOwner(formattedMessage);
    return { alerted: true, currentCount: tracker.count };
  }

  return { alerted: false, currentCount: tracker.count };
}

/**
 * Resetea el contador de fallos cuando una operación es exitosa
 */
export function resetFailureCount(category: AlertCategory, key: string): void {
  const trackerKey = `${category}:${key}`;
  failureMap.delete(trackerKey);
}
