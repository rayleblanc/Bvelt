import { OutcomeLedgerService } from '../knowledge/memory/outcomeLedgerService';
import { getBemEvents } from '../knowledge/memory/bemStore';

export interface IntegrationHealthSummary {
  google: { status: 'healthy' | 'warning' | 'error'; label: string };
  email: { status: 'healthy' | 'warning' | 'error'; label: string };
  maps: { status: 'healthy' | 'warning' | 'error'; label: string };
  ai: { status: 'healthy' | 'warning' | 'error'; label: string };
  plan: { status: 'healthy' | 'warning' | 'error'; label: string };
}

export interface WeeklyMetricsReport {
  periodLabel: string;
  startDateIso: string;
  endDateIso: string;
  opportunitiesCount: number;
  opportunitiesValue: number;
  preparedActionsCount: number;
  repliesCount: number;
  recoveredValue: number; // Rule 1 verified!
  inPlayValue: number;    // Modeled active pipeline!
  integrationsHealth: IntegrationHealthSummary;
  isEmptyWeek: boolean;
  honestEmptyMessage?: string;
  summaryText: string;
  eventBreakdown: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    timestamp: string;
    amount?: number;
  }>;
}

/**
 * Generador de Métricas Semanales Bvelt:
 * Computa de forma estrictamente determinista y sin inventar cifras las métricas de los últimos 7 días.
 * Criterio de "Semana Vacía Honesta": Si no hay oportunidades, acciones ni respuestas en los últimos 7 días,
 * declara la semana vacía sin alucinar ni generar métricas falsas.
 */
export function generateWeeklyMetrics(params: {
  leads?: any[];
  userUid?: string;
  profile?: any;
  gmbConnected?: boolean;
  gmbReviews?: any[];
  mapCoords?: { lat: number; lng: number } | null;
  language?: string;
}): WeeklyMetricsReport {
  const lang = params.language || 'es';
  const isEn = lang === 'en';

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const dayFormat: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const endFormat: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const locale = lang === 'es' ? 'es-ES' : 'en-US';

  const periodLabel = `${sevenDaysAgo.toLocaleDateString(locale, dayFormat)} - ${now.toLocaleDateString(locale, endFormat)}`;

  const leads = params.leads || [];
  const bemEvents = getBemEvents(params.userUid);

  // 1. Oportunidades recientes
  const recentLeads = leads.filter(l => {
    const created = l.timestamp || l.createdAt ? new Date(l.timestamp || l.createdAt) : null;
    return created ? created >= sevenDaysAgo : true;
  });
  const opportunitiesCount = recentLeads.length;
  const opportunitiesValue = recentLeads.reduce((acc, l) => acc + (Number(l.estimatedValue) || Number(l.budget) || 0), 0);

  // 2. Acciones Preparadas
  const recentBemEvents = bemEvents.filter(e => {
    const ts = new Date(e.timestamp);
    return !isNaN(ts.getTime()) && ts >= sevenDaysAgo;
  });
  const preparedActionsCount = recentBemEvents.filter(e =>
    ['estimate_followup_prepared', 'dormant_rescue_started', 'review_draft_created', 'share_opened'].includes(e.type)
  ).length;

  // 3. Respuestas Registradas
  const recentReplies = leads.filter(l => {
    const replyDate = l.customerRepliedAt || l.lastCustomerReplyTimestamp || l.replyTimestamp;
    if (!replyDate) return false;
    const dt = new Date(replyDate);
    return !isNaN(dt.getTime()) && dt >= sevenDaysAgo;
  });
  const repliesCount = recentReplies.length;

  // 4. Recuperado vs En Juego (Estrictamente Separados)
  // REGLA 1: Recuperado SOLO si respuesta del cliente registrada O dueño marca cita/trabajo (timestamp). share_opened NO cuenta.
  const verifiedWonLeads = recentLeads.filter(l => {
    const st = (l.status || '').toUpperCase();
    if (!['WON', 'ACCEPTED', 'COMPLETED', 'GANADO', 'CERRADO'].includes(st)) return false;
    if (l.lastAction === 'share_opened' || l.sourceType === 'share_opened' || l.isShareOpened) return false;

    const hasReply = Boolean(l.customerRepliedAt || l.hasCustomerReply || l.lastCustomerReplyTimestamp);
    const hasOwnerTimestamp = Boolean(l.ownerMarkedAt || l.appointmentScheduledAt || l.jobScheduledAt || l.scheduledAt || l.wonAt || l.closedAt);
    return hasReply || hasOwnerTimestamp;
  });
  const recoveredValue = verifiedWonLeads.reduce((acc, l) => acc + (Number(l.estimatedValue) || Number(l.finalAmount) || 0), 0);

  const inPlayLeads = recentLeads.filter(l => !verifiedWonLeads.includes(l));
  const inPlayValue = inPlayLeads.reduce((acc, l) => acc + (Number(l.estimatedValue) || Number(l.budget) || 0), 0);

  // 5. Salud de Integraciones
  const googleStatus = params.gmbConnected ? 'healthy' : 'warning';
  const emailStatus = (params.profile?.email || params.userUid) ? 'healthy' : 'error';
  const mapsStatus = (params.mapCoords?.lat && params.mapCoords?.lng) ? 'healthy' : params.profile?.location ? 'warning' : 'error';
  const aiStatus = 'healthy';
  const planStatus = params.profile?.isPro ? 'healthy' : 'warning';

  const integrationsHealth: IntegrationHealthSummary = {
    google: { status: googleStatus, label: googleStatus === 'healthy' ? (isEn ? 'Connected' : 'Conectado') : (isEn ? 'Disconnected' : 'Desconectado') },
    email: { status: emailStatus, label: emailStatus === 'healthy' ? (params.profile?.email || 'OK') : (isEn ? 'Missing' : 'Sin correo') },
    maps: { status: mapsStatus, label: mapsStatus === 'healthy' ? 'GPS OK' : (isEn ? 'Zone set' : 'Zona local') },
    ai: { status: aiStatus, label: isEn ? 'Active' : 'Motor Activo' },
    plan: { status: planStatus, label: params.profile?.isPro ? 'Pro' : 'Trial / Free' }
  };

  // 6. Criterio de Semana Vacía Honesta
  const isEmptyWeek = opportunitiesCount === 0 && preparedActionsCount === 0 && repliesCount === 0 && recoveredValue === 0 && inPlayValue === 0;

  const honestEmptyMessage = isEmptyWeek
    ? (isEn
      ? `No commercial activity recorded between ${periodLabel}. No scans, follow-ups, or confirmed collections took place in this window. Connect your sources or log activity to generate next week's report.`
      : `Semana sin actividad registrada. No se realizaron búsquedas, envíos ni confirmaciones de cobro entre ${periodLabel}. Conecta tus fuentes o registra actividad para generar el informe de la próxima semana.`)
    : undefined;

  // Resumen determinista sin alucinaciones de LLM
  const summaryText = isEmptyWeek
    ? (isEn ? "Empty week with 0 active records." : "Semana vacía sin actividad registrada.")
    : (isEn
      ? `Weekly Summary (${periodLabel}): ${opportunitiesCount} opportunities ($${opportunitiesValue.toLocaleString()}), ${preparedActionsCount} actions prepared, ${repliesCount} customer replies. Recovered: $${recoveredValue.toLocaleString()} | In Play: $${inPlayValue.toLocaleString()}.`
      : `Resumen Semanal (${periodLabel}): ${opportunitiesCount} oportunidades ($${opportunitiesValue.toLocaleString()}), ${preparedActionsCount} acciones preparadas, ${repliesCount} respuestas de clientes. Recuperado: $${recoveredValue.toLocaleString()} | En juego: $${inPlayValue.toLocaleString()}.`);

  // Desglose de eventos reales de la semana
  const eventBreakdown: WeeklyMetricsReport['eventBreakdown'] = [];
  for (const ev of recentBemEvents.slice(0, 10)) {
    eventBreakdown.push({
      id: ev.id,
      type: ev.type,
      title: ev.type === 'estimate_followup_prepared' ? (isEn ? 'Follow-up Draft' : 'Borrador de Seguimiento') :
             ev.type === 'dormant_rescue_started' ? (isEn ? 'Dormant Client Rescue' : 'Rescate de Clientes Inactivos') :
             ev.type === 'review_draft_created' ? (isEn ? 'Review Request Drafted' : 'Solicitud de Reseña Redactada') :
             ev.type === 'owner_marked_recovered' ? (isEn ? 'Owner Confirmed Revenue' : 'Ingreso Confirmado por Dueño') :
             ev.type === 'share_opened' ? (isEn ? 'Share Link Opened' : 'Enlace de Mensaje Abierto') : ev.type,
      detail: `${ev.sourceName} (${ev.provenance})`,
      timestamp: new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: ev.meta?.value
    });
  }

  return {
    periodLabel,
    startDateIso: sevenDaysAgo.toISOString(),
    endDateIso: now.toISOString(),
    opportunitiesCount,
    opportunitiesValue,
    preparedActionsCount,
    repliesCount,
    recoveredValue,
    inPlayValue,
    integrationsHealth,
    isEmptyWeek,
    honestEmptyMessage,
    summaryText,
    eventBreakdown
  };
}
