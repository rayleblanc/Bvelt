/**
 * Utility for sharing public visibility snapshots without private lead PII.
 * Complies with TASK P2-B requirements.
 */

export interface ShareSnapshotOptions {
  businessName: string;
  city: string;
  category: string;
  score?: number;
  oppAmount?: number;
  refCode?: string;
  t: (es: string, en: string) => string;
}

export function generateVisibilitySnapshotText(options: ShareSnapshotOptions): { url: string; text: string } {
  const { businessName, city, category, score, oppAmount, refCode, t } = options;

  const cleanBiz = businessName || t("Negocio Local", "Local Business");
  const cleanCity = city || t("Zona Local", "Local Area");
  const cleanCat = category || t("Servicios Locales", "Local Services");
  const refQuery = refCode ? `&ref=${encodeURIComponent(refCode)}` : '';

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const url = `${baseUrl}?snapshot=true&biz=${encodeURIComponent(cleanBiz)}&city=${encodeURIComponent(cleanCity)}&niche=${encodeURIComponent(cleanCat)}${oppAmount ? `&opp=${oppAmount}` : ''}${refQuery}`;

  const textEs = `📊 Diagnóstico de Visibilidad Local para ${cleanBiz}
📍 Ciudad: ${cleanCity}
💼 Sector: ${cleanCat}
${score ? `🛡️ Confianza Local: ${score}%\n` : ''}${oppAmount && oppAmount > 0 ? `💰 Oportunidad Estimada: +$${oppAmount.toLocaleString()}/mo\n` : ''}
Consulta el diagnóstico de mercado (sin datos privados de clientes):
${url}`;

  const textEn = `📊 Local Visibility Snapshot for ${cleanBiz}
📍 City: ${cleanCity}
💼 Industry: ${cleanCat}
${score ? `🛡️ Local Confidence: ${score}%\n` : ''}${oppAmount && oppAmount > 0 ? `💰 Estimated Opportunity: +$${oppAmount.toLocaleString()}/mo\n` : ''}
View public market diagnostic (free of private customer PII):
${url}`;

  return {
    url,
    text: t(textEs, textEn)
  };
}

/**
 * Executes a native share or copies to clipboard with a toast callback
 */
export async function executeShareSnapshot(
  options: ShareSnapshotOptions,
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
) {
  const { text, url } = generateVisibilitySnapshotText(options);
  const t = options.t;

  try {
    if (navigator.share) {
      await navigator.share({
        title: `Visibility Snapshot - ${options.businessName}`,
        text: text,
        url: url
      });
      showToast(t("¡Diagnóstico compartido con éxito!", "Snapshot shared successfully!"), "success");
      return;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return;
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(text);
    showToast(t("¡Resumen de visibilidad copiado al portapapeles! (Sin PII de clientes)", "Visibility snapshot copied to clipboard! (No client PII)"), "success");
  } catch {
    showToast(t("No se pudo copiar el texto.", "Failed to copy text."), "error");
  }
}
