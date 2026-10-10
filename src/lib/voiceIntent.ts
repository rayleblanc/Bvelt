/**
 * Voice Intent Resolution Engine for Bvelt
 * Natural Language Voice Understanding: maps free-form spoken input to 7 core application intents:
 *   - 'leads': CRM inbox, actionable leads, customer replies
 *   - 'scan': market radar, competitor search, local scan (with optional radiusKm)
 *   - 'profile': business profile settings, address, telephone, category
 *   - 'reviews': Google reviews, QR codes, reputation management
 *   - 'quote': price estimator, quote calculations, reference rates
 *   - 'plans': subscription upgrade, quotas, Pro tier
 *   - 'website': business landing page builder, website domain
 * 
 * Works with AI JSON responses and includes a local semantic fallback with zero required exact phrases.
 */

import { evaluateQuoteCompleteness, getSuggestedCloseLine } from '../services/beforeYouSendService';

export type VoiceIntentType = 
  | 'leads' 
  | 'scan' 
  | 'profile' 
  | 'reviews' 
  | 'quote' 
  | 'plans' 
  | 'website' 
  | 'followup'
  | 'check_quote'
  | 'add_closing_line';

export interface VoiceIntentResult {
  intent: VoiceIntentType;
  radiusKm?: number;
  reply: string;
  closeLine?: string;
  completenessStatus?: 'ready' | 'weak' | 'blocked';
  completenessScore?: number;
  missingItems?: string[];
}

export interface VoiceIntentOptions {
  language?: 'es' | 'en';
  profile?: any;
  draftText?: string;
  trade?: string;
  amount?: number;
}

/**
 * Extracts radius in kilometers from free-form text if present (e.g., "10 km", "a 25 kilómetros", "15km", "radio 10")
 */
export function extractRadiusKm(text: string): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(?:radio|distancia|a|at|de|in)?\s*(\d{1,3})\s*(?:km|kms|kil[oó]metros|kilometers|kilometros)/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (val >= 1 && val <= 100) return val;
  }
  const matchRadio = text.match(/radio\s*(?:de)?\s*(\d{1,3})/i);
  if (matchRadio && matchRadio[1]) {
    const val = parseInt(matchRadio[1], 10);
    if (val >= 1 && val <= 100) return val;
  }
  return undefined;
}

/**
 * Robust local fallback intent parser that detects semantic intention without requiring exact phrase matches.
 */
export function parseLocalVoiceIntent(
  text: string, 
  language: 'es' | 'en' = 'es',
  options?: VoiceIntentOptions
): VoiceIntentResult {
  const low = text.toLowerCase().trim();
  const radiusKm = extractRadiusKm(low);
  const isEn = language === 'en';

  // 0A. INTENT: ADD CLOSING LINE ("add closing line", "agregar cierre", etc.)
  if (
    low.includes('add closing line') || low.includes('add close line') || 
    low.includes('append closing line') || low.includes('agregar cierre') || 
    low.includes('anadir cierre') || low.includes('añadir cierre') || 
    low.includes('poner cierre') || low.includes('insertar cierre') ||
    low.includes('cierre comercial') || low.includes('pon el cierre') ||
    low.includes('cierre sugerido')
  ) {
    const trade = options?.trade || options?.profile?.category || options?.profile?.trade || 'lawn_care';
    const closeLine = getSuggestedCloseLine(trade as any, language);
    return {
      intent: 'add_closing_line',
      closeLine,
      reply: isEn
        ? `Added closing line to quote: "${closeLine}"`
        : `Línea de cierre agregada al presupuesto: "${closeLine}"`
    };
  }

  // 0B. INTENT: CHECK QUOTE / BEFORE YOU SEND ("check quote", "before I send", "is this quote ready", etc.)
  if (
    low.includes('check quote') || low.includes('before i send') || low.includes('before you send') ||
    low.includes('is this quote ready') || low.includes('is quote ready') || low.includes('quote ready') ||
    low.includes('revisar cotizacion') || low.includes('revisar cotización') || 
    low.includes('revisar presupuesto') || low.includes('chequear presupuesto') ||
    low.includes('verificar presupuesto') || low.includes('antes de enviar') || 
    low.includes('antes de mandar') || low.includes('esta listo el presupuesto') || 
    low.includes('está listo el presupuesto') || low.includes('esta lista la cotizacion') ||
    low.includes('está lista la cotización') || low.includes('evaluar presupuesto') ||
    low.includes('check estimate') || low.includes('is estimate ready')
  ) {
    const trade = options?.trade || options?.profile?.category || options?.profile?.trade || 'lawn_care';
    let draftText = options?.draftText || '';
    let amount = options?.amount;

    if (!draftText && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('bvelt_estimates_v1');
        if (raw) {
          const list = JSON.parse(raw);
          const firstWaiting = list.find((e: any) => e.status === 'waiting') || list[0];
          if (firstWaiting) {
            draftText = firstWaiting.followUpDraft || firstWaiting.notes || firstWaiting.jobType || '';
            if (firstWaiting.amount && !amount) {
              amount = typeof firstWaiting.amount === 'number' ? firstWaiting.amount : parseFloat(String(firstWaiting.amount).replace(/[^0-9.]/g, ''));
            }
          }
        }
      } catch {}
    }

    const evaluation = evaluateQuoteCompleteness({
      trade,
      draftText,
      amount,
      language
    });

    const topMissing = evaluation.missing.slice(0, 3).map(m => m.label);

    let reply = '';
    if (evaluation.status === 'ready') {
      reply = isEn
        ? `Quote is ready to send. Completeness score is 100%. All required and recommended items are present.`
        : `El presupuesto está listo para enviar con completitud al 100%. Cumple con todos los requisitos comerciales.`;
    } else if (evaluation.status === 'weak') {
      const missingListStr = topMissing.join(', ');
      reply = isEn
        ? `Quote is weak at ${evaluation.score}%. Top items to fix: ${missingListStr}. You can say "add closing line" to insert the recommended CTA.`
        : `El presupuesto está débil al ${evaluation.score}%. Elementos a mejorar: ${missingListStr}. Puedes decir "agregar cierre" para insertar el llamado a la acción.`;
    } else {
      // blocked
      const missingListStr = topMissing.join(', ');
      reply = isEn
        ? `Don't send yet. Quote is blocked at ${evaluation.score}%. Missing required items: ${missingListStr}. Fix scope or price first.`
        : `No enviar todavía. El presupuesto está bloqueado al ${evaluation.score}%. Faltan elementos obligatorios: ${missingListStr}. Corrige precio o alcance antes de enviar.`;
    }

    return {
      intent: 'check_quote',
      completenessStatus: evaluation.status,
      completenessScore: evaluation.score,
      missingItems: topMissing,
      reply
    };
  }

  // 1. SCAN / RADAR / COMPETITOR AUDIT
  if (
    low.includes('scan') || low.includes('escan') || low.includes('radar') || 
    low.includes('competid') || low.includes('competit') || low.includes('auditor') || 
    low.includes('audit') || low.includes('mercado') || low.includes('market') ||
    low.includes('quien esta ganando') || low.includes("who's winning") || low.includes('cobertura')
  ) {
    return {
      intent: 'scan',
      radiusKm,
      reply: isEn
        ? (radiusKm ? `Scanning local market and competitors within ${radiusKm} km...` : `Launching local market and competitor radar scan...`)
        : (radiusKm ? `Iniciando escaneo de competidores en un radio de ${radiusKm} km...` : `Iniciando escaneo de mercado y radar de competidores locales...`)
    };
  }

  // 2. FOLLOW UP / REACTIVATION / STALE ESTIMATES
  if (
    low.includes('follow') || low.includes('seguimiento') || low.includes('reactiv') || 
    low.includes('antiguos') || low.includes('re-engagement') || low.includes('recuperar')
  ) {
    return {
      intent: 'followup',
      reply: isEn
        ? `Generating follow-up message to reactivate leads and unclosed estimates.`
        : `Generando mensaje de seguimiento para reactivar cotizaciones y clientes pendientes.`
    };
  }

  // 3. LEADS / CRM / CLIENTS / INBOX
  if (
    low.includes('lead') || low.includes('client') || low.includes('prospect') || 
    low.includes('crm') || low.includes('inbox') || low.includes('bandeja') || 
    low.includes('mensaje') || low.includes('message') || low.includes('responder') ||
    low.includes('contestar') || low.includes('contactar') || low.includes('whatsapp')
  ) {
    return {
      intent: 'leads',
      reply: isEn
        ? `Opening your CRM Leads inbox to follow up with local clients.`
        : `Abriendo tu bandeja de clientes y prospectos para responder solicitudes.`
    };
  }

  // 3. REVIEWS / REPUTATION / QR
  if (
    low.includes('reseñ') || low.includes('review') || low.includes('opinion') || 
    low.includes('reputac') || low.includes('estrellas') || low.includes('rating') ||
    low.includes('qr')
  ) {
    return {
      intent: 'reviews',
      reply: isEn
        ? `Opening your Google Reviews and reputation management.`
        : `Abriendo el módulo de reseñas y gestión de reputación de Google.`
    };
  }

  // 4. QUOTE / ESTIMATOR / PRICING
  if (
    low.includes('cotiz') || low.includes('presupuest') || low.includes('estimad') || 
    low.includes('cobrar') || low.includes('precio') || low.includes('tarifa') || 
    low.includes('cuesta') || low.includes('costo') || low.includes('quote') || 
    low.includes('estimator') || low.includes('pricing') || low.includes('calculator') || 
    low.includes('calculadora')
  ) {
    return {
      intent: 'quote',
      reply: isEn
        ? `Opening the job estimator and reference pricing calculator.`
        : `Abriendo el estimador de presupuestos y tarifas de referencia del mercado.`
    };
  }

  // 5. PLANS / PRO / UPGRADE
  if (
    low.includes('plan') || low.includes('pro') || low.includes('suscrip') || 
    low.includes('subir de nivel') || low.includes('upgrade') || low.includes('limite') || 
    low.includes('límite') || low.includes('cuota') || low.includes('precios bvelt')
  ) {
    return {
      intent: 'plans',
      reply: isEn
        ? `Opening subscription plans and usage quota settings.`
        : `Abriendo los planes de suscripción y límites de cuenta.`
    };
  }

  // 6. WEBSITE / LANDING PAGE
  if (
    low.includes('web') || low.includes('sitio') || low.includes('pagina') || 
    low.includes('página') || low.includes('landing') || low.includes('publicar web')
  ) {
    return {
      intent: 'website',
      reply: isEn
        ? `Opening your business landing page builder.`
        : `Abriendo el creador y publicador de tu sitio web de negocio.`
    };
  }

  // 7. PROFILE / BUSINESS DATA
  if (
    low.includes('perfil') || low.includes('profile') || low.includes('negocio') || 
    low.includes('empresa') || low.includes('telefono') || low.includes('teléfono') || 
    low.includes('direccion') || low.includes('dirección') || low.includes('categoria') || 
    low.includes('horario')
  ) {
    return {
      intent: 'profile',
      reply: isEn
        ? `Navigating to your business profile settings.`
        : `Navegando a la configuración de perfil de tu negocio.`
    };
  }

  // Default fallback -> leads / actions
  return {
    intent: 'leads',
    reply: isEn
      ? `Understood. Checking your active business leads and priority actions.`
      : `Entendido. Consultando tus prospectos activos y acciones prioritarias.`
  };
}

/**
 * Resolves natural spoken voice transcript to structured JSON:
 * { intent, radiusKm?, reply }
 * Primary: AI router endpoint with Gemini JSON completion
 * Secondary: Robust local semantic parser (zero crashes, zero mandatory exact phrases)
 */
export async function resolveVoiceIntent(
  transcript: string,
  options: VoiceIntentOptions = {}
): Promise<VoiceIntentResult> {
  const text = (transcript || '').trim();
  const language = options.language || 'es';
  const radiusFromText = extractRadiusKm(text);

  if (!text) {
    return {
      intent: 'leads',
      reply: language === 'en' ? 'How can I assist you with your business today?' : '¿En qué puedo ayudarte con tu negocio hoy?'
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch('/api/ai/router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: text,
        language,
        location: options.profile?.location || options.profile?.city || 'Naples, FL'
      })
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data: any = await res.json().catch(() => null);
      if (data && data.intent) {
        let rawIntent = String(data.intent).toLowerCase().trim();
        let canonicalIntent: VoiceIntentType = 'leads';

        if (rawIntent === 'check_quote' || rawIntent === 'before_you_send' || rawIntent === 'check_estimate') {
          return parseLocalVoiceIntent(text, language, options);
        } else if (rawIntent === 'add_closing_line' || rawIntent === 'add_close_line') {
          return parseLocalVoiceIntent(text, language, options);
        } else if (rawIntent === 'scan' || rawIntent === 'business_scan' || rawIntent === 'tools') {
          canonicalIntent = 'scan';
        } else if (rawIntent === 'leads' || rawIntent === 'crm') {
          canonicalIntent = 'leads';
        } else if (rawIntent === 'profile' || rawIntent === 'settings') {
          canonicalIntent = 'profile';
        } else if (rawIntent === 'reviews') {
          canonicalIntent = 'reviews';
        } else if (rawIntent === 'quote' || rawIntent === 'pricing' || rawIntent === 'estimator') {
          canonicalIntent = 'quote';
        } else if (rawIntent === 'plans') {
          canonicalIntent = 'plans';
        } else if (rawIntent === 'website') {
          canonicalIntent = 'website';
        } else {
          // If unrecognized, map via local parser
          const localParsed = parseLocalVoiceIntent(text, language, options);
          return localParsed;
        }

        const effectiveRadius = (typeof data.radiusKm === 'number' && data.radiusKm > 0)
          ? data.radiusKm
          : radiusFromText;

        const effectiveReply = data.reply || data.response || (
          language === 'en' ? `Executing ${canonicalIntent}...` : `Accediendo a ${canonicalIntent}...`
        );

        return {
          intent: canonicalIntent,
          radiusKm: effectiveRadius,
          reply: effectiveReply
        };
      }
    }
  } catch (err) {
    // Graceful fallback to local semantic parser
  }

  return parseLocalVoiceIntent(text, language, options);
}
