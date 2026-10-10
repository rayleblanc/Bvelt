/**
 * TrustStack Integration Service (Non-Blocking)
 * 
 * In accordance with Bvelt Trust Stack requirements:
 * If env TRUSTSTACK_URL is set, POST intent before high-risk execute;
 * if absent or unreachable, execute normally without blocking the user.
 * 
 * Money is recorded in minor units (cents).
 */

export interface TrustStackIntentPayload {
  actionId: string;
  actionType: string;
  businessId: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  amountCents?: number;
  channel?: string;
  metadata?: Record<string, any>;
}

export async function postTrustStackIntent(payload: TrustStackIntentPayload): Promise<boolean> {
  let trustStackUrl = '';
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      trustStackUrl = (import.meta as any).env.VITE_TRUSTSTACK_URL || (import.meta as any).env.TRUSTSTACK_URL || '';
    }
  } catch {}

  if (!trustStackUrl && typeof process !== 'undefined' && process.env) {
    trustStackUrl = process.env.VITE_TRUSTSTACK_URL || process.env.TRUSTSTACK_URL || '';
  }

  // If environment variable is absent, proceed normally
  if (!trustStackUrl) {
    return true;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2-second non-blocking guard

    const normalizedPayload = {
      actionId: payload.actionId,
      actionType: payload.actionType,
      businessId: payload.businessId,
      riskLevel: payload.riskLevel || 'MEDIUM',
      amountCents: typeof payload.amountCents === 'number' ? Math.round(payload.amountCents) : undefined,
      channel: payload.channel,
      timestamp: new Date().toISOString(),
      metadata: payload.metadata || {}
    };

    const targetEndpoint = trustStackUrl.endsWith('/') 
      ? `${trustStackUrl}api/intent` 
      : `${trustStackUrl}/api/intent`;

    await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizedPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return true;
  } catch (err) {
    // Non-blocking fallback: failure to connect to TrustStack URL must NEVER block user execution
    console.warn('[TrustStack] Non-blocking intent notification skipped:', err);
    return true;
  }
}
