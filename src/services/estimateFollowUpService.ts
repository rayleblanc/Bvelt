/**
 * Estimate Follow-up Service for Bvelt
 * Simple lightweight flow to help contractors track quotes and follow up on lost jobs.
 * Not a bloated CRM - text generation only for the contractor to send.
 */

export type EstimateStatus = 'waiting' | 'replied' | 'won' | 'lost';

export interface EstimateRecord {
  id: string;
  customerName: string;
  phone?: string;
  jobType: string;
  amount?: number | string;
  dateSent: string; // YYYY-MM-DD
  status: EstimateStatus;
  notes?: string;
  followUpDraft?: string;
  createdAt: number;
}

const STORAGE_KEY = 'bvelt_estimates_v1';

export function getInitialSampleEstimates(language: 'es' | 'en' = 'es'): EstimateRecord[] {
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  const fiveDaysAgo = new Date(today);
  fiveDaysAgo.setDate(today.getDate() - 5);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  if (language === 'es') {
    return [
      {
        id: 'est-sample-1',
        customerName: 'Carlos M.',
        phone: '239-555-0142',
        jobType: 'Mantenimiento de Sistema AC',
        amount: 350,
        dateSent: formatDate(threeDaysAgo),
        status: 'waiting',
        createdAt: threeDaysAgo.getTime()
      },
      {
        id: 'est-sample-2',
        customerName: 'Dra. Patricia Silva',
        phone: '239-555-0198',
        jobType: 'Instalación y Reemplazo de Filtros',
        amount: 820,
        dateSent: formatDate(fiveDaysAgo),
        status: 'waiting',
        createdAt: fiveDaysAgo.getTime()
      }
    ];
  }

  return [
    {
      id: 'est-sample-1',
      customerName: 'Michael Brown',
      phone: '239-555-0142',
      jobType: 'AC System Maintenance',
      amount: 350,
      dateSent: formatDate(threeDaysAgo),
      status: 'waiting',
      createdAt: threeDaysAgo.getTime()
    },
    {
      id: 'est-sample-2',
      customerName: 'Sarah Miller',
      phone: '239-555-0198',
      jobType: 'Filter Replacement & Duct Check',
      amount: 820,
      dateSent: formatDate(fiveDaysAgo),
      status: 'waiting',
      createdAt: fiveDaysAgo.getTime()
    }
  ];
}

export function getSavedEstimates(language: 'es' | 'en' = 'es'): EstimateRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialSampleEstimates(language);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('[EstimateFollowUp] Error loading estimates:', err);
  }
  return [];
}

export function saveAllEstimates(list: EstimateRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[EstimateFollowUp] Error saving estimates:', err);
  }
}

export function addEstimate(estimate: Omit<EstimateRecord, 'id' | 'createdAt'>): EstimateRecord {
  const list = getSavedEstimates();
  const newRecord: EstimateRecord = {
    ...estimate,
    id: `est-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: Date.now()
  };
  const updated = [newRecord, ...list];
  saveAllEstimates(updated);
  return newRecord;
}

export function updateEstimateStatus(id: string, newStatus: EstimateStatus): EstimateRecord[] {
  const list = getSavedEstimates();
  const updated = list.map(item => item.id === id ? { ...item, status: newStatus } : item);
  saveAllEstimates(updated);
  return updated;
}

export function deleteEstimate(id: string): EstimateRecord[] {
  const list = getSavedEstimates();
  const updated = list.filter(item => item.id !== id);
  saveAllEstimates(updated);
  return updated;
}

export interface GenerateFollowUpParams {
  customerName: string;
  jobType: string;
  amount?: number | string;
  dateSent?: string;
  businessName?: string;
  tone?: 'amigable' | 'directo' | 'urgente';
  language?: 'es' | 'en';
}

/**
 * Generates a short, polite, high-converting follow-up message.
 * Follows contractor best practices: polite, respectful, clear, without being pushy.
 */
export function generateFollowUpMessage({
  customerName,
  jobType,
  amount,
  businessName,
  tone = 'amigable',
  language = 'es'
}: GenerateFollowUpParams): string {
  const cleanName = customerName?.trim() || (language === 'es' ? 'estimado cliente' : 'there');
  const cleanJob = jobType?.trim() || (language === 'es' ? 'el trabajo solicitado' : 'the requested job');
  const bName = businessName?.trim() || (language === 'es' ? 'nuestro equipo' : 'our team');
  const priceSnippetEs = amount ? ` por un monto de $${amount}` : '';
  const priceSnippetEn = amount ? ` for $${amount}` : '';

  if (language === 'es') {
    if (tone === 'directo') {
      return `Hola ${cleanName} 👋, te saluda ${bName}. Te escribo brevemente para consultar si pudiste revisar la cotización enviada para ${cleanJob}${priceSnippetEs}. ¿Tienes alguna duda o te gustaría que agendemos una fecha para realizarlo? Quedo a tu disposición.`;
    }
    if (tone === 'urgente') {
      return `Hola ${cleanName} 👋, espero te encuentres muy bien. Te contacto de ${bName} respecto al presupuesto para ${cleanJob}${priceSnippetEs}. Esta semana tenemos un par de espacios disponibles en la zona. Avísame si deseas reservar tu lugar antes de que cerremos la agenda semanal. ¡Saludos!`;
    }
    // amigable (default)
    return `Hola ${cleanName} 👋! Espero que estés teniendo una excelente semana. Te escribo de ${bName} solo para dar seguimiento al presupuesto que te compartimos para ${cleanJob}${priceSnippetEs}. ¿Pudiste verlo con calma o necesitas algún ajuste? Avísame con confianza y con gusto te ayudo.`;
  }

  // English
  if (tone === 'directo') {
    return `Hi ${cleanName} 👋, this is ${bName}. Following up on the estimate sent for ${cleanJob}${priceSnippetEn}. Did you have a chance to review it, or do you have any questions? Let me know if you'd like to get this scheduled. Thanks!`;
  }
  if (tone === 'urgente') {
    return `Hi ${cleanName} 👋, checking in from ${bName} regarding your quote for ${cleanJob}${priceSnippetEn}. We have a couple of schedule openings in your area this week. Let me know if you'd like us to hold a spot for you before the week books out. Regards!`;
  }
  // friendly
  return `Hi ${cleanName} 👋! Hope you're having a great week. Reaching out from ${bName} to follow up on the estimate we sent for ${cleanJob}${priceSnippetEn}. Did you have any questions or need any adjustments? Happy to help whenever you're ready!`;
}
