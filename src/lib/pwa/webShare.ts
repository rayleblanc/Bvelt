/**
 * BVELT Web Share Integration
 * Provides native Web Share API capabilities for customer-facing results,
 * Verified Records, Opportunity Reports, and Action Plans with graceful clipboard fallback.
 */

export interface ShareDataOptions {
  title: string;
  text?: string;
  url?: string;
  files?: File[];
}

export interface ShareResult {
  success: boolean;
  method: 'native' | 'clipboard' | 'unsupported';
  error?: string;
}

/**
 * Shares content via navigator.share if available, otherwise copies URL/text to clipboard.
 */
export async function shareContent(options: ShareDataOptions): Promise<ShareResult> {
  const shareUrl = options.url || (typeof window !== 'undefined' ? window.location.href : '');
  const sharePayload: ShareData = {
    title: options.title,
    text: options.text,
    url: shareUrl,
  };

  // 1. Try Native Web Share API if supported
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (options.files && options.files.length > 0 && typeof navigator.canShare === 'function') {
        if (navigator.canShare({ files: options.files })) {
          sharePayload.files = options.files;
        }
      }
      await navigator.share(sharePayload);
      return { success: true, method: 'native' };
    } catch (err: any) {
      // If user aborted/cancelled share dialog, treat as handled
      if (err.name === 'AbortError') {
        return { success: false, method: 'native', error: 'Share cancelled by user' };
      }
      console.warn('[WebShare] Native share failed, falling back to clipboard copy:', err);
    }
  }

  // 2. Fallback: Copy to Clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      const copyContent = options.url 
        ? (options.text ? `${options.text}\n${options.url}` : options.url)
        : (options.text || options.title);
      await navigator.clipboard.writeText(copyContent);
      return { success: true, method: 'clipboard' };
    } catch (clipErr: any) {
      console.error('[WebShare] Clipboard copy failed:', clipErr);
      return { success: false, method: 'clipboard', error: clipErr.message };
    }
  }

  return { success: false, method: 'unsupported', error: 'Web Share and Clipboard APIs not supported' };
}

/**
 * Share a Bvelt Public Verified Business Record
 */
export async function shareVerifiedRecord(
  businessName: string, 
  entityId: string, 
  lang: 'es' | 'en' = 'es'
): Promise<ShareResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bvelt.app';
  const url = `${origin}/verify/${encodeURIComponent(entityId)}`;
  
  const title = lang === 'es'
    ? `BVELT — Registro Verificado de ${businessName}`
    : `BVELT — Verified Record for ${businessName}`;
  
  const text = lang === 'es'
    ? `Ficha pública de evidencia y trazabilidad criptográfica de ${businessName}. Consulta datos verificados y solvencia comercial.`
    : `Public cryptographic evidence and provenance record for ${businessName}. View verified data and business solvency.`;

  return shareContent({ title, text, url });
}

/**
 * Share a Local Market Opportunity or Free Market Check Report
 */
export async function shareMarketOpportunity(
  businessName: string,
  city: string,
  gapsCount: number,
  score: number,
  lang: 'es' | 'en' = 'es'
): Promise<ShareResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bvelt.app';
  const url = `${origin}/?tab=market&business=${encodeURIComponent(businessName)}&city=${encodeURIComponent(city)}`;
  
  const title = lang === 'es'
    ? `Diagnóstico de Mercado BVELT: ${businessName} (${city})`
    : `BVELT Market Audit: ${businessName} (${city})`;

  const text = lang === 'es'
    ? `📊 Diagnóstico Local: ${gapsCount} brechas de mercado detectadas en ${city} con un índice de oportunidad de ${score}/100. Ver análisis completo:`
    : `📊 Local Audit: ${gapsCount} market gaps detected in ${city} with opportunity score ${score}/100. View full analysis:`;

  return shareContent({ title, text, url });
}

/**
 * Share an Action Plan / Next Best Action item
 */
export async function shareActionPlan(
  actionTitle: string,
  businessName: string,
  impact: string,
  lang: 'es' | 'en' = 'es'
): Promise<ShareResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bvelt.app';
  const url = `${origin}/?tab=actions`;

  const title = lang === 'es'
    ? `Acción Prioritaria BVELT: ${actionTitle}`
    : `BVELT Priority Action: ${actionTitle}`;

  const text = lang === 'es'
    ? `⚡ Acción para ${businessName}: "${actionTitle}". Impacto esperado: ${impact}.`
    : `⚡ Action for ${businessName}: "${actionTitle}". Expected impact: ${impact}.`;

  return shareContent({ title, text, url });
}
