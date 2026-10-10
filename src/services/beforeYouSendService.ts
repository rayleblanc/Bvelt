/**
 * BVELT COMMERCIAL COMPLETENESS ENGINE — "Before You Send"
 * 
 * Evaluates trade estimates before the contractor sends them to a client.
 * Identifies missing must-have and should-have commercial elements.
 * 
 * Rules:
 * - Any 'must' item missing -> 'blocked'
 * - Only 'should' items missing -> 'weak'
 * - All items present -> 'ready'
 * 
 * Pure functions, no network, unit-testable.
 */
import { recordBveltEvent } from '../knowledge/memory/bemStore.ts';
import { OutcomeLedgerService } from '../knowledge/memory/outcomeLedgerService.ts';
import { auth } from '../lib/firebase.ts';

export type CompletenessSeverity = 'must' | 'should';
export type CompletenessStatus = 'ready' | 'weak' | 'blocked';

export interface CompletenessMissingItem {
  id: string;
  label: string;
  severity: CompletenessSeverity;
  fixHint: string;
}

export interface QuoteCompletenessInput {
  trade: string;
  draftText?: string;
  amount?: number;
  hasPhotos?: boolean;
  hasTimeline?: boolean;
  hasExclusions?: boolean;
  hasPaymentTerms?: boolean;
  hasWarranty?: boolean;
  hasNextStepCta?: boolean;
  hasScope?: boolean;
  hasFrequency?: boolean;
  hasDiagnosticVsRepair?: boolean;
  hasSystemType?: boolean;
  language?: 'en' | 'es';
}

export interface QuoteCompletenessOutput {
  status: CompletenessStatus;
  score: number; // 0-100
  missing: CompletenessMissingItem[];
  suggestedCloseLine: string;
  tradeResolved: 'lawn_care' | 'hvac' | 'plumbing' | 'cleaning' | 'generic';
}

interface ChecklistRule {
  id: string;
  labelEn: string;
  labelEs: string;
  severity: CompletenessSeverity;
  weight: number;
  fixHintEn: string;
  fixHintEs: string;
  check: (input: QuoteCompletenessInput, text: string) => boolean;
}

/**
 * Normalizes input trade name to supported vertical key.
 */
export function normalizeTradeKey(rawTrade?: string): 'lawn_care' | 'hvac' | 'plumbing' | 'cleaning' | 'generic' {
  if (!rawTrade || typeof rawTrade !== 'string') return 'generic';
  const t = rawTrade.toLowerCase().trim();

  if (
    t.includes('lawn') || 
    t.includes('landscap') || 
    t.includes('jardin') || 
    t.includes('cesped') || 
    t.includes('grama') || 
    t.includes('poda') ||
    t.includes('mow')
  ) {
    return 'lawn_care';
  }

  if (
    t.includes('hvac') || 
    t.includes('ac') || 
    t.includes('air') || 
    t.includes('clima') || 
    t.includes('aire') || 
    t.includes('cool') || 
    t.includes('heat')
  ) {
    return 'hvac';
  }

  if (
    t.includes('plumb') || 
    t.includes('plomer') || 
    t.includes('fontan') || 
    t.includes('drain') || 
    t.includes('pipe') ||
    t.includes('fuga')
  ) {
    return 'plumbing';
  }

  if (
    t.includes('clean') || 
    t.includes('limp') || 
    t.includes('maid') || 
    t.includes('janitor') ||
    t.includes('lavado')
  ) {
    return 'cleaning';
  }

  return 'generic';
}

/**
 * Text heuristics to detect presence of elements in draft text
 */
function hasPriceSignal(input: QuoteCompletenessInput, text: string): boolean {
  if (input.amount != null && !isNaN(input.amount) && input.amount > 0) return true;
  return /\$\s*\d+|\b\d+\s*(?:usd|dolares|dólares|bucks)\b/i.test(text);
}

function hasScopeSignal(input: QuoteCompletenessInput, text: string, keywords: RegExp): boolean {
  if (input.hasScope != null) return input.hasScope;
  return keywords.test(text);
}

function hasTimelineSignal(input: QuoteCompletenessInput, text: string): boolean {
  if (input.hasTimeline != null) return input.hasTimeline;
  return /\b(start|begin|schedule|arrival|timeline|monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow|iniciar|comenzar|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|hoy|mañana|semana|fecha|horario)\b/i.test(text);
}

function hasExclusionsSignal(input: QuoteCompletenessInput, text: string): boolean {
  if (input.hasExclusions != null) return input.hasExclusions;
  return /\b(exclu|not included|does not include|no incluye|no cubre|excluye|adicional|separate fee)\b/i.test(text);
}

function hasPaymentTermsSignal(input: QuoteCompletenessInput, text: string): boolean {
  if (input.hasPaymentTerms != null) return input.hasPaymentTerms;
  return /\b(deposit|zelle|card|cash|check|venmo|payment|due upon|anticipo|depósito|tarjeta|efectivo|transferencia|pago al|50%|net 30)\b/i.test(text);
}

function hasWarrantySignal(input: QuoteCompletenessInput, text: string): boolean {
  if (input.hasWarranty != null) return input.hasWarranty;
  return /\b(warrant|guarante|garant|30 days|90 days|1 year|meses|días|ano|año)\b/i.test(text);
}

function hasCtaSignal(input: QuoteCompletenessInput, text: string): boolean {
  if (input.hasNextStepCta != null) return input.hasNextStepCta;
  return /\b(reply|respond|confirm|approve|let me know|call me|text me|responde|confirma|aprueba|aprob|avísame|avisame|llámame|llamame|escríbeme)\b/i.test(text);
}

/**
 * Trade specific rules definition
 */
const TRADE_CHECKLISTS: Record<'lawn_care' | 'hvac' | 'plumbing' | 'cleaning' | 'generic', ChecklistRule[]> = {
  lawn_care: [
    {
      id: 'price',
      labelEn: 'Total price or per-cut rate',
      labelEs: 'Precio total o tarifa por corte',
      severity: 'must',
      weight: 25,
      fixHintEn: 'Include a clear dollar amount (e.g., $65/cut or $220/month).',
      fixHintEs: 'Incluye un monto claro en dólares (ej. $65 por corte o $220/mes).',
      check: (input, text) => hasPriceSignal(input, text)
    },
    {
      id: 'scope',
      labelEn: 'Yard scope (front, back, or perimeter)',
      labelEs: 'Alcance del terreno (frente, patio trasero o perímetro)',
      severity: 'must',
      weight: 25,
      fixHintEn: 'Specify areas included (e.g., front yard, backyard, edging, blowing).',
      fixHintEs: 'Especifica las áreas incluidas (ej. patio trasero, frente, orillado, soplado).',
      check: (input, text) => hasScopeSignal(input, text, /\b(front|back|yard|patio|frente|detras|detrás|mow|cut|edge|edging|orill|cesped|césped|grama|blowing|soplad)\b/i)
    },
    {
      id: 'frequency_or_type',
      labelEn: 'Frequency (weekly/bi-weekly) or one-time project',
      labelEs: 'Frecuencia (semanal/quincenal) o trabajo puntual',
      severity: 'must',
      weight: 20,
      fixHintEn: 'State if this is weekly, bi-weekly, or a one-time cleanup.',
      fixHintEs: 'Indica si es semanal, quincenal o una limpieza de una sola vez.',
      check: (input, text) => input.hasFrequency ?? /\b(weekly|bi-weekly|biweekly|monthly|one-time|one time|recurring|semanal|quincenal|mensual|puntual|unica vez|única vez|cada dos semanas)\b/i.test(text)
    },
    {
      id: 'start_window',
      labelEn: 'Start window or scheduled day',
      labelEs: 'Ventana de inicio o día programado',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Mention which day or window service will begin (e.g., this Thursday).',
      fixHintEs: 'Menciona qué día o ventana iniciará el servicio (ej. este jueves).',
      check: (input, text) => hasTimelineSignal(input, text)
    },
    {
      id: 'exclusions',
      labelEn: 'Clear exclusions (debris haul, tree pruning, fertilization)',
      labelEs: 'Exclusiones claras (retiro de escombros, poda mayor, abono)',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Note what is not included to avoid scope creep (e.g., debris haul offsite is extra).',
      fixHintEs: 'Aclara qué no incluye para evitar malentendidos (ej. retiro de ramas fuera del sitio es extra).',
      check: (input, text) => hasExclusionsSignal(input, text)
    },
    {
      id: 'cta',
      labelEn: 'Clear approval call-to-action',
      labelEs: 'Llamado a la acción claro para aprobar',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Add an action prompt: "Reply APPROVE to reserve this Thursday\'s route."',
      fixHintEs: 'Agrega un llamado: "Responde APRUEBO para reservar tu turno de este jueves."',
      check: (input, text) => hasCtaSignal(input, text)
    }
  ],

  hvac: [
    {
      id: 'system_or_symptom',
      labelEn: 'Symptom or system type (tonnage, split, package)',
      labelEs: 'Síntoma o tipo de sistema (tonelaje, split, paquete)',
      severity: 'must',
      weight: 25,
      fixHintEn: 'Identify the unit or reported issue (e.g., 3-ton condenser, not cooling).',
      fixHintEs: 'Identifica la unidad o el problema (ej. condensador de 3 tons, no enfría).',
      check: (input, text) => input.hasSystemType ?? /\b(ton|split|package|condenser|air handler|ac|heat pump|thermostat|refrigerant|freon|blower|no enfría|no enfria|termotasto|compresor)\b/i.test(text)
    },
    {
      id: 'price',
      labelEn: 'Total price or estimate range',
      labelEs: 'Precio total o rango estimado',
      severity: 'must',
      weight: 25,
      fixHintEn: 'Provide a clear price or diagnostic fee.',
      fixHintEs: 'Indica un precio claro o tarifa de diagnóstico.',
      check: (input, text) => hasPriceSignal(input, text)
    },
    {
      id: 'diagnostic_vs_repair',
      labelEn: 'Diagnostic vs repair differentiation',
      labelEs: 'Diferenciación entre diagnóstico y reparación',
      severity: 'should',
      weight: 15,
      fixHintEn: 'Clarify if fee covers inspection only or applies toward repair.',
      fixHintEs: 'Aclara si la tarifa cubre solo inspección o se acredita a la reparación.',
      check: (input, text) => input.hasDiagnosticVsRepair ?? /\b(diagnostic|inspection|repair|parts|labor|diagnostico|diagnóstico|inspeccion|inspección|reparacion|reparación|repuestos|mano de obra)\b/i.test(text)
    },
    {
      id: 'warranty',
      labelEn: 'Warranty on parts and labor',
      labelEs: 'Garantía en mano de obra y repuestos',
      severity: 'should',
      weight: 15,
      fixHintEn: 'Specify warranty coverage (e.g., 1-year parts, 30-day labor).',
      fixHintEs: 'Especifica la garantía (ej. 1 año en piezas, 30 días mano de obra).',
      check: (input, text) => hasWarrantySignal(input, text)
    },
    {
      id: 'timeline',
      labelEn: 'Arrival window or timeline',
      labelEs: 'Ventana de llegada o tiempo estimado',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Include when technician can arrive (e.g., today between 1-3 PM).',
      fixHintEs: 'Incluye cuándo puede llegar el técnico (ej. hoy entre 1 y 3 PM).',
      check: (input, text) => hasTimelineSignal(input, text)
    },
    {
      id: 'cta',
      labelEn: 'Clear next-step CTA',
      labelEs: 'Llamado a la acción para confirmar',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Prompt the homeowner: "Reply CONFIRM to reserve technician arrival."',
      fixHintEs: 'Indica al cliente: "Responde CONFIRMAR para apartar la visita del técnico."',
      check: (input, text) => hasCtaSignal(input, text)
    }
  ],

  plumbing: [
    {
      id: 'scope',
      labelEn: 'Specific fixture or leak location scope',
      labelEs: 'Alcance específico (accesorio o ubicación de fuga)',
      severity: 'must',
      weight: 30,
      fixHintEn: 'Name the specific fixture or line (e.g., master bath shutoff valve, kitchen drain).',
      fixHintEs: 'Nombra el accesorio o línea (ej. válvula de paso baño principal, desagüe cocina).',
      check: (input, text) => hasScopeSignal(input, text, /\b(leak|valve|pipe|drain|toilet|faucet|water heater|sink|fuga|valvula|válvula|tubo|tuberia|tubería|inodoro|grifo|calentador|lavabo)\b/i)
    },
    {
      id: 'price',
      labelEn: 'Fixed price or estimated labor + materials',
      labelEs: 'Precio fijo o estimado mano de obra + materiales',
      severity: 'must',
      weight: 30,
      fixHintEn: 'State total quote amount and whether materials are included.',
      fixHintEs: 'Indica el monto total del presupuesto y si incluye materiales.',
      check: (input, text) => hasPriceSignal(input, text)
    },
    {
      id: 'timeline',
      labelEn: 'Estimated arrival or repair duration',
      labelEs: 'Llegada estimada o duración de la reparación',
      severity: 'should',
      weight: 15,
      fixHintEn: 'Give expected arrival or completion time (e.g., tomorrow morning, 2 hours).',
      fixHintEs: 'Indica la llegada o tiempo estimado (ej. mañana por la mañana, 2 horas).',
      check: (input, text) => hasTimelineSignal(input, text)
    },
    {
      id: 'exclusions',
      labelEn: 'Concealed pipe or drywall repair exclusions',
      labelEs: 'Exclusiones de tubería empotrada o reparación de drywall',
      severity: 'should',
      weight: 15,
      fixHintEn: 'State if drywall patching or underground excavation is excluded.',
      fixHintEs: 'Aclara si la reparación de yeso/drywall o excavación está excluida.',
      check: (input, text) => hasExclusionsSignal(input, text)
    },
    {
      id: 'cta',
      labelEn: 'Clear next-step approval CTA',
      labelEs: 'Llamado a la acción para autorizar trabajo',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Add: "Reply YES to approve this repair and schedule arrival."',
      fixHintEs: 'Agrega: "Responde SÍ para autorizar la reparación y agendar la visita."',
      check: (input, text) => hasCtaSignal(input, text)
    }
  ],

  cleaning: [
    {
      id: 'scope',
      labelEn: 'Rooms and deep vs standard clean scope',
      labelEs: 'Habitaciones y tipo de limpieza (profunda vs estándar)',
      severity: 'must',
      weight: 30,
      fixHintEn: 'Specify bedroom/bath count or areas included (e.g., 3 bed / 2 bath standard clean).',
      fixHintEs: 'Especifica número de habitaciones/baños o áreas (ej. 3 hab / 2 baños estándar).',
      check: (input, text) => hasScopeSignal(input, text, /\b(bed|bath|deep|standard|move-in|move-out|kitchen|living|habitacion|habitación|bano|baño|profunda|estandar|estándar|cocina|sala)\b/i)
    },
    {
      id: 'price',
      labelEn: 'Fixed price per visit or flat rate',
      labelEs: 'Precio fijo por visita o tarifa plana',
      severity: 'must',
      weight: 30,
      fixHintEn: 'Quote clear visit price.',
      fixHintEs: 'Indica el precio fijo de la visita.',
      check: (input, text) => hasPriceSignal(input, text)
    },
    {
      id: 'frequency',
      labelEn: 'Frequency or one-time booking',
      labelEs: 'Frecuencia o reserva única',
      severity: 'must',
      weight: 20,
      fixHintEn: 'Note if this is one-time, bi-weekly, or recurring.',
      fixHintEs: 'Aclara si es una limpieza puntual, quincenal o recurrente.',
      check: (input, text) => input.hasFrequency ?? /\b(weekly|bi-weekly|biweekly|monthly|one-time|one time|semanal|quincenal|mensual|puntual|unica|única)\b/i.test(text)
    },
    {
      id: 'supplies_exclusions',
      labelEn: 'Supplies provided and specialty exclusions',
      labelEs: 'Insumos incluidos y exclusiones especiales',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Mention if products/supplies are provided and exclusions like inside oven/fridge.',
      fixHintEs: 'Menciona si llevas los insumos y exclusiones (ej. interior de horno o nevera es extra).',
      check: (input, text) => hasExclusionsSignal(input, text) || /\b(supplies|products|vacuum|insumos|productos|aspiradora)\b/i.test(text)
    },
    {
      id: 'cta',
      labelEn: 'Booking confirmation CTA',
      labelEs: 'Llamado a confirmar fecha y hora',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Add: "Reply with your preferred arrival time to secure your slot."',
      fixHintEs: 'Agrega: "Responde con tu hora preferida para reservar tu espacio."',
      check: (input, text) => hasCtaSignal(input, text)
    }
  ],

  generic: [
    {
      id: 'scope',
      labelEn: 'Clear description of work scope',
      labelEs: 'Descripción clara del alcance del trabajo',
      severity: 'must',
      weight: 35,
      fixHintEn: 'Describe what work will be performed.',
      fixHintEs: 'Describe con claridad el trabajo que se va a realizar.',
      check: (input, text) => hasScopeSignal(input, text, /\b(work|service|job|install|repair|replace|trabajo|servicio|instal|repar|cambio)\b/i)
    },
    {
      id: 'price',
      labelEn: 'Clear total price or rate',
      labelEs: 'Precio total o tarifa clara',
      severity: 'must',
      weight: 35,
      fixHintEn: 'State the total estimate or agreed rate.',
      fixHintEs: 'Indica el monto total o tarifa acordada.',
      check: (input, text) => hasPriceSignal(input, text)
    },
    {
      id: 'timeline',
      labelEn: 'Timeline or start date',
      labelEs: 'Plazo o fecha estimada de inicio',
      severity: 'should',
      weight: 10,
      fixHintEn: 'Mention start date or estimated duration.',
      fixHintEs: 'Menciona fecha de inicio o duración aproximada.',
      check: (input, text) => hasTimelineSignal(input, text)
    },
    {
      id: 'exclusions',
      labelEn: 'Work boundaries or exclusions',
      labelEs: 'Límites o exclusiones del trabajo',
      severity: 'should',
      weight: 10,
      fixHintEn: 'State any boundaries or items not covered.',
      fixHintEs: 'Menciona lo que no está cubierto para evitar confusiones.',
      check: (input, text) => hasExclusionsSignal(input, text)
    },
    {
      id: 'cta',
      labelEn: 'Clear next-step call-to-action',
      labelEs: 'Llamado a la acción claro para aprobar',
      severity: 'should',
      weight: 10,
      fixHintEn: 'End with: "Reply APPROVE to lock this in and schedule."',
      fixHintEs: 'Termina con: "Responde APRUEBO para asegurar este turno y agendar."',
      check: (input, text) => hasCtaSignal(input, text)
    }
  ]
};

/**
 * Generates an honest, contractor-ready close line in English and Spanish.
 */
export function getSuggestedCloseLine(tradeKey: 'lawn_care' | 'hvac' | 'plumbing' | 'cleaning' | 'generic', lang?: 'en' | 'es'): string {
  const lines: Record<'lawn_care' | 'hvac' | 'plumbing' | 'cleaning' | 'generic', { en: string; es: string }> = {
    lawn_care: {
      en: "To secure your spot on this week's route, please reply 'APPROVE' and we'll confirm your service day.",
      es: "Para apartar tu lugar en la ruta de esta semana, responde 'APRUEBO' y te confirmamos el día de servicio."
    },
    hvac: {
      en: "To reserve the technician's arrival window and authorize service, please reply 'CONFIRM'.",
      es: "Para apartar la ventana de llegada del técnico y autorizar el servicio, responde 'CONFIRMAR'."
    },
    plumbing: {
      en: "To lock this in and schedule our technician, please reply 'APPROVE' with your preferred time.",
      es: "Para confirmar y agendar la visita del plomero, responde 'APRUEBO' con tu hora preferida."
    },
    cleaning: {
      en: "To reserve this cleaning date and arrival window, please reply 'CONFIRM'.",
      es: "Para reservar esta fecha de limpieza y asegurar el horario, responde 'CONFIRMAR'."
    },
    generic: {
      en: "To approve this estimate and lock in your start date, please reply 'APPROVE'.",
      es: "Para aprobar este presupuesto y fijar la fecha de inicio, responde 'APRUEBO'."
    }
  };

  const tradeEntry = lines[tradeKey] || lines.generic;

  if (lang === 'en') return tradeEntry.en;
  if (lang === 'es') return tradeEntry.es;

  // Bilingual default
  return `${tradeEntry.en} / ${tradeEntry.es}`;
}

/**
 * Main evaluation function:
 * Checks must and should items, calculates score, and sets commercial readiness status.
 */
export function evaluateQuoteCompleteness(input: QuoteCompletenessInput): QuoteCompletenessOutput {
  const tradeKey = normalizeTradeKey(input.trade);
  const rules = TRADE_CHECKLISTS[tradeKey] || TRADE_CHECKLISTS.generic;
  const draftText = input.draftText || '';
  const isEs = input.language === 'es';

  const missing: CompletenessMissingItem[] = [];
  let earnedScore = 0;
  let totalWeight = 0;

  let hasMissingMust = false;
  let hasMissingShould = false;

  for (const rule of rules) {
    totalWeight += rule.weight;
    const isPresent = rule.check(input, draftText);

    if (isPresent) {
      earnedScore += rule.weight;
    } else {
      if (rule.severity === 'must') {
        hasMissingMust = true;
      } else {
        hasMissingShould = true;
      }

      missing.push({
        id: rule.id,
        label: isEs ? rule.labelEs : rule.labelEn,
        severity: rule.severity,
        fixHint: isEs ? rule.fixHintEs : rule.fixHintEn
      });
    }
  }

  // Calculate normalized score 0 - 100
  const score = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;

  // Status rules:
  // any 'must' missing -> blocked
  // only 'should' missing -> weak
  // none missing -> ready
  let status: CompletenessStatus = 'ready';
  if (hasMissingMust) {
    status = 'blocked';
  } else if (hasMissingShould) {
    status = 'weak';
  }

  const suggestedCloseLine = getSuggestedCloseLine(tradeKey, input.language);

  return {
    status,
    score,
    missing,
    suggestedCloseLine,
    tradeResolved: tradeKey
  };
}

export type QuoteLifecycleEvent = 
  | 'quote_checked' 
  | 'quote_sent_ready' 
  | 'quote_sent_weak' 
  | 'quote_sent_blocked_override' 
  | 'quote_won' 
  | 'quote_lost';

export interface RecordQuoteOutcomeParams {
  event: QuoteLifecycleEvent;
  trade: string;
  status: 'ready' | 'weak' | 'blocked' | 'won' | 'lost';
  missingIds?: string[];
  businessId?: string;
  ts?: string;
  amount?: number | null;
  estimateId?: string;
  customerName?: string;
}

/**
 * Writes quote lifecycle outcomes to BEM and the canonical Outcome Ledger.
 * Non-blocking: wrapped in resilient try/catch so it will NEVER crash the UI.
 * Never invents revenue numbers.
 */
export function recordQuoteOutcomeToBem(params: RecordQuoteOutcomeParams): void {
  try {
    const ts = params.ts || new Date().toISOString();
    const tradeKey = normalizeTradeKey(params.trade);
    const businessId = params.businessId || auth?.currentUser?.uid || 'default_business';
    const missingIds = params.missingIds || [];

    // 1. Write to canonical Outcome Ledger (OutcomeLedgerService)
    try {
      OutcomeLedgerService.recordExecution({
        businessId,
        toolId: 'before_you_send_engine',
        actionId: params.estimateId,
        executionState: params.event === 'quote_sent_blocked_override' ? 'APPROVAL_REQUIRED' : 'SUCCESS',
        outcomeState: (params.event === 'quote_won' || params.event === 'quote_lost') ? 'MEASURED' : 'DECLARED',
        metricName: 'ESTIMATES',
        outcomeType: params.event.toUpperCase(),
        description: `BEM Quote Outcome: ${params.event} [${params.status}]`,
        value: typeof params.amount === 'number' && !isNaN(params.amount) ? params.amount : null,
        providerCostUsd: 0,
        metadata: {
          trade: tradeKey,
          status: params.status,
          missingIds,
          businessId,
          ts,
          estimateId: params.estimateId,
          customerName: params.customerName
        }
      });
    } catch (ledgerErr) {
      console.warn('[BEM Outcome Ledger] Non-blocking write warning:', ledgerErr);
    }

    // 2. Write to BEM Event Store (recordBveltEvent)
    try {
      recordBveltEvent({
        tenantId: businessId,
        type: params.event,
        sourceType: 'before_you_send_engine',
        sourceName: 'Before You Send Guard',
        fetchedAt: ts,
        provenance: params.event === 'quote_sent_blocked_override' ? 'USER_OVERRIDE' : 'USER_ACTION_INTENT',
        consentScope: 'private',
        trade: tradeKey,
        meta: {
          trade: tradeKey,
          status: params.status,
          missingIds,
          businessId,
          ts,
          amount: params.amount ?? null,
          estimateId: params.estimateId,
          customerName: params.customerName
        }
      });
    } catch (eventErr) {
      console.warn('[BEM Event Store] Non-blocking write warning:', eventErr);
    }
  } catch (err) {
    console.warn('[recordQuoteOutcomeToBem] Safeguarded non-blocking error:', err);
  }
}

