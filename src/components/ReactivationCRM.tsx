import React, { useState, useRef } from 'react';
import { 
  MessageCircle, Copy, Sparkles, Check, Users, Phone, User, 
  Trash2, ArrowRight, RefreshCw, Send, ShieldCheck, HeartHandshake, 
  Zap, AlertCircle, FileText, Clock, Upload, Mail, CheckCircle2, Lock, AlertTriangle
} from 'lucide-react';
import { recordBveltEvent } from '../knowledge/memory/bemStore';
import { auth } from '../lib/firebase';
import { EstimateFollowUpSection } from './EstimateFollowUpSection';
import { MarkRecoveredModal } from './MarkRecoveredModal';
import { RecoveryFeeService, RecoveryFeeRecord, DEFAULT_RECOVERY_FEE } from '../services/recoveryFeeService';

export interface ReactivationCRMProps {
  t: (es: string, en: string) => string;
  language: 'es' | 'en';
  customGeminiKey?: string;
  businessName: string;
  businessCategory: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  reactivateTemplate?: string;
  setReactivateTemplate?: (val: string) => void;
  reactivateTone?: 'directo' | 'amigable' | 'urgente';
  setReactivateTone?: (tone: 'directo' | 'amigable' | 'urgente') => void;
  handleRewriteReactivateTemplate?: (tone?: 'directo' | 'amigable' | 'urgente') => Promise<void>;
  isRewritingReactivate?: boolean;
  leads?: Array<{ id: string; name?: string; phone?: string; clientName?: string; excerpt?: string }>;
  initialView?: 'estimates' | 'past_clients';
}

export interface DormantContact {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string;
  email: string;
  lastDate?: string;
  source: 'csv' | 'manual' | 'crm';
  status: 'pendiente' | 'preparado' | 'enviado';
  preparedMessage?: string;
}

interface PreparedMessage {
  id: string;
  rawInput: string;
  name: string;
  phone: string;
  cleanPhone: string;
  email?: string;
  lastDate?: string;
  text: string;
  sent: boolean;
}

const MAX_DORMANT_TRIAL_LIMIT = 25;

export function ReactivationCRM({
  t,
  language,
  businessName,
  businessCategory,
  showToast,
  reactivateTemplate,
  setReactivateTemplate,
  reactivateTone = 'amigable',
  setReactivateTone,
  handleRewriteReactivateTemplate,
  isRewritingReactivate = false,
  leads = [],
  initialView = 'estimates'
}: ReactivationCRMProps) {
  const [activeSubTab, setActiveSubTab] = useState<'estimates' | 'past_clients'>(initialView);
  const [inputMode, setInputMode] = useState<'csv' | 'text'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default template if none provided
  const defaultTemplate = language === 'es'
    ? `Hola {name}! Quería avisarte que esta semana estaré trabajando por tu zona con ${businessName || 'mi equipo'}. Si aún necesitas ayuda con algún proyecto o servicio pendiente, te puedo ofrecer un precio especial si lo hacemos estos días. Avísame si te sirve y pasamos. Saludos!`
    : `Hi {name}! I wanted to let you know that I will be working in your area this week with ${businessName || 'our team'}. If you still need help with any pending project or service, I can offer you a special price if we do it these days. Let me know if it works for you. Regards!`;

  // Local state for editable template
  const currentTemplate = reactivateTemplate || defaultTemplate;
  const [localTemplate, setLocalTemplate] = useState(currentTemplate);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual list textarea (names or phones, one per line)
  const [clientListText, setClientListText] = useState('');
  
  // CSV Raw Text or parsed contacts
  const [dormantQueue, setDormantQueue] = useState<DormantContact[]>([]);
  const [importCountNote, setImportCountNote] = useState<string | null>(null);

  // Recovery Modal & Fee records state
  const [selectedDormantForRecovery, setSelectedDormantForRecovery] = useState<DormantContact | null>(null);
  const [recoveryFees, setRecoveryFees] = useState<RecoveryFeeRecord[]>([]);

  // Generated messages
  const [generatedMessages, setGeneratedMessages] = useState<PreparedMessage[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [wonAmounts, setWonAmounts] = useState<Record<string, string>>({});
  const [repliedMap, setRepliedMap] = useState<Record<string, boolean>>({});

  // Sync recovery fee records
  React.useEffect(() => {
    setRecoveryFees(RecoveryFeeService.getAllRecords());
  }, []);

  const refreshRecoveryFees = () => {
    setRecoveryFees(RecoveryFeeService.getAllRecords());
  };

  // Keep local template in sync when external template changes
  React.useEffect(() => {
    if (reactivateTemplate) {
      setLocalTemplate(reactivateTemplate);
    }
  }, [reactivateTemplate]);

  // Handle template change
  const handleTemplateChange = (val: string) => {
    setLocalTemplate(val);
    if (setReactivateTemplate) {
      setReactivateTemplate(val);
    }
  };

  // Tone switch
  const handleToneChange = async (tone: 'directo' | 'amigable' | 'urgente') => {
    if (setReactivateTone) {
      setReactivateTone(tone);
    }
    if (handleRewriteReactivateTemplate) {
      await handleRewriteReactivateTemplate(tone);
    }
  };

  // Robust line / CSV parser
  const parseCsvText = (csvContent: string): DormantContact[] => {
    const lines = csvContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const contacts: DormantContact[] = [];
    let isFirstLineHeader = false;

    // Check if first line is a header
    const firstLineLower = lines[0].toLowerCase();
    if (
      firstLineLower.includes('nombre') || 
      firstLineLower.includes('name') || 
      firstLineLower.includes('telefono') || 
      firstLineLower.includes('phone') || 
      firstLineLower.includes('email') ||
      firstLineLower.includes('correo') ||
      firstLineLower.includes('fecha') ||
      firstLineLower.includes('date')
    ) {
      isFirstLineHeader = true;
    }

    const rowsToProcess = isFirstLineHeader ? lines.slice(1) : lines;

    for (let i = 0; i < rowsToProcess.length; i++) {
      if (contacts.length >= MAX_DORMANT_TRIAL_LIMIT) break;

      const row = rowsToProcess[i];
      // Split by comma, semicolon or tab (supporting quotes)
      const delimiter = row.includes(';') ? ';' : row.includes('\t') ? '\t' : ',';
      const parts = row.split(delimiter).map(p => p.replace(/^["']|["']$/g, '').trim());

      let name = '';
      let phone = '';
      let email = '';
      let lastDate = '';

      if (parts.length >= 2) {
        name = parts[0] || '';
        const second = parts[1] || '';
        if (second.includes('@')) {
          email = second;
        } else {
          phone = second;
        }

        if (parts.length >= 3) {
          const third = parts[2] || '';
          if (third.includes('@')) {
            email = third;
          } else if (!phone && /\d/.test(third)) {
            phone = third;
          } else {
            lastDate = third;
          }
        }
      } else {
        // Single field: try extracting phone/name heuristically
        const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{7,15}/;
        const match = row.match(phoneRegex);
        if (match) {
          phone = match[0].trim();
          name = row.replace(phone, '').replace(/^[-—:,]+|[-—:,]+$/g, '').trim();
        } else if (row.includes('@')) {
          const emailMatch = row.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            email = emailMatch[0];
            name = row.replace(email, '').replace(/^[-—:,]+|[-—:,]+$/g, '').trim();
          }
        } else {
          name = row;
        }
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const formattedCleanPhone = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;

      contacts.push({
        id: `dormant_${i}_${Date.now()}`,
        name: name || phone || email || `Cliente ${i + 1}`,
        phone,
        cleanPhone: formattedCleanPhone,
        email,
        lastDate: lastDate || undefined,
        source: 'csv',
        status: 'pendiente'
      });
    }

    return contacts;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const parsed = parseCsvText(text);
        if (parsed.length === 0) {
          showToast(t('No se encontraron contactos válidos en el archivo.', 'No valid contacts found in file.'), 'error');
          return;
        }

        const totalRows = text.split(/\r?\n/).filter(Boolean).length;
        if (totalRows > MAX_DORMANT_TRIAL_LIMIT) {
          setImportCountNote(
            t(
              `Se importaron ${parsed.length} de ${totalRows} contactos (tope máximo de ${MAX_DORMANT_TRIAL_LIMIT} en versión actual).`,
              `Imported ${parsed.length} of ${totalRows} contacts (max limit of ${MAX_DORMANT_TRIAL_LIMIT} in current tier).`
            )
          );
        } else {
          setImportCountNote(null);
        }

        setDormantQueue(parsed);
        showToast(t(`✓ ${parsed.length} contactos cargados a la cola de reactivación`, `✓ ${parsed.length} contacts loaded into reactivation queue`), 'success');
      }
    };
    reader.readAsText(file);
  };

  // Personalize template for a contact
  const buildPersonalizedText = (template: string, name: string, date?: string): string => {
    let result = template;
    const effectiveName = name.trim();

    if (effectiveName) {
      if (result.includes('{name}')) {
        result = result.replace(/\{name\}/gi, effectiveName);
      } else if (result.includes('{cliente}')) {
        result = result.replace(/\{cliente\}/gi, effectiveName);
      } else {
        const greetingPrefix = language === 'es' ? `Hola ${effectiveName}! ` : `Hi ${effectiveName}! `;
        result = `${greetingPrefix}${result.replace(/^(?:Hola|Hi|Hello)[^.!?]*[.!?]\s*/i, '')}`;
      }
    } else {
      result = result
        .replace(/\{name\}/gi, '')
        .replace(/\{cliente\}/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    return result;
  };

  // Preparar mensaje para un cliente dormido individual
  const handlePrepareIndividualMessage = (contact: DormantContact) => {
    const templateToUse = localTemplate.trim() || defaultTemplate;
    const msgText = buildPersonalizedText(templateToUse, contact.name, contact.lastDate);

    // Update queue item
    const updatedQueue = dormantQueue.map(c => 
      c.id === contact.id ? { ...c, status: 'preparado' as const, preparedMessage: msgText } : c
    );
    setDormantQueue(updatedQueue);

    // Also add/update in generatedMessages
    const preparedItem: PreparedMessage = {
      id: contact.id,
      rawInput: contact.name,
      name: contact.name,
      phone: contact.phone,
      cleanPhone: contact.cleanPhone,
      email: contact.email,
      lastDate: contact.lastDate,
      text: msgText,
      sent: false
    };

    setGeneratedMessages(prev => {
      const filtered = prev.filter(m => m.id !== contact.id);
      return [preparedItem, ...filtered];
    });
    setHasGenerated(true);

    // Resolve real profile for trade and city
    let realCity: string | null = null;
    let realTrade: string | null = businessCategory || null;
    try {
      const rawProf = typeof localStorage !== 'undefined' ? (localStorage.getItem('user_profile') || localStorage.getItem('lf_profile')) : null;
      if (rawProf) {
        const p = JSON.parse(rawProf);
        if (!realTrade) realTrade = p.category || p.trade || p.niche || null;
        realCity = p.city || p.location || null;
      }
    } catch {}

    // Emit BEM Event: dormant_rescue_started
    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'dormant_rescue_started',
      sourceType: 'reactivation_crm',
      sourceName: 'Dormant Client Rescue',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_RESCUE_TRIGGER',
      consentScope: 'private',
      trade: realTrade,
      city: realCity,
      meta: { 
        contactId: contact.id,
        contactName: contact.name,
        hasPhone: Boolean(contact.cleanPhone),
        hasEmail: Boolean(contact.email),
        tone: reactivateTone, 
        businessName 
      }
    });

    showToast(t(`✓ Mensaje preparado para ${contact.name}`, `✓ Message prepared for ${contact.name}`), 'success');
  };

  // Generate batch messages
  const handleGenerateAllBatch = () => {
    const contactsToProcess = dormantQueue.length > 0 
      ? dormantQueue 
      : parseCsvText(clientListText);

    const templateToUse = localTemplate.trim() || defaultTemplate;

    if (contactsToProcess.length === 0) {
      // General fallback message
      const generalText = buildPersonalizedText(templateToUse, '');
      const generalItem: PreparedMessage = {
        id: 'msg-general',
        rawInput: t('Mensaje general', 'General message'),
        name: t('Cualquier cliente anterior', 'Any past client'),
        phone: '',
        cleanPhone: '',
        text: generalText,
        sent: false
      };
      setGeneratedMessages([generalItem]);
      setHasGenerated(true);
      showToast(t('¡Mensaje base preparado y listo para enviar!', 'Base message prepared and ready to send!'), 'success');
      return;
    }

    const items: PreparedMessage[] = contactsToProcess.slice(0, MAX_DORMANT_TRIAL_LIMIT).map((c, idx) => {
      const text = buildPersonalizedText(templateToUse, c.name, c.lastDate);
      return {
        id: c.id || `msg-${idx}-${Date.now()}`,
        rawInput: c.name,
        name: c.name,
        phone: c.phone,
        cleanPhone: c.cleanPhone,
        email: c.email,
        lastDate: c.lastDate,
        text,
        sent: false
      };
    });

    setGeneratedMessages(items);
    setHasGenerated(true);

    // Update queue states
    setDormantQueue(prev => prev.map(c => ({ ...c, status: 'preparado' })));

    // Resolve real profile for trade and city
    let batchCity: string | null = null;
    let batchTrade: string | null = businessCategory || null;
    try {
      const rawProf = typeof localStorage !== 'undefined' ? (localStorage.getItem('user_profile') || localStorage.getItem('lf_profile')) : null;
      if (rawProf) {
        const p = JSON.parse(rawProf);
        if (!batchTrade) batchTrade = p.category || p.trade || p.niche || null;
        batchCity = p.city || p.location || null;
      }
    } catch {}

    // Emit BEM Event
    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'dormant_rescue_started',
      sourceType: 'reactivation_crm',
      sourceName: 'Dormant Client Rescue',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_RESCUE_TRIGGER',
      consentScope: 'private',
      trade: batchTrade,
      city: batchCity,
      meta: { count: items.length, tone: reactivateTone, businessName }
    });

    showToast(
      t(
        `¡${items.length} oportunidades preparadas listas para enviar manualmente!`,
        `¡${items.length} opportunities prepared ready to dispatch manually!`
      ),
      'success'
    );
  };

  // Copy single message
  const handleCopyMessage = (item: PreparedMessage) => {
    navigator.clipboard.writeText(item.text);
    setCopiedId(item.id);
    showToast(t('¡Mensaje copiado al portapapeles!', 'Message copied to clipboard!'), 'success');
    setTimeout(() => {
      setCopiedId(prev => (prev === item.id ? null : prev));
    }, 2000);
  };

  const checkQuietHours = () => {
    const currentHour = new Date().getHours();
    const isQuiet = currentHour >= 20 || currentHour < 8;
    if (isQuiet) {
      showToast(t('⚠️ Horas de Silencio (20:00 - 08:00). Respeta el descanso del cliente.', '⚠️ Quiet Hours (20:00 - 08:00). Respect customer quiet hours.'), 'info');
    }
  };

  // Send via WhatsApp
  const handleSendWhatsApp = (item: PreparedMessage) => {
    checkQuietHours();
    let url = '';
    if (item.cleanPhone && item.cleanPhone.length >= 7) {
      url = `https://wa.me/${item.cleanPhone}?text=${encodeURIComponent(item.text)}`;
    } else {
      url = `https://wa.me/?text=${encodeURIComponent(item.text)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // Mark as sent
    setGeneratedMessages(prev =>
      prev.map(m => (m.id === item.id ? { ...m, sent: true } : m))
    );
    setDormantQueue(prev =>
      prev.map(c => (c.id === item.id ? { ...c, status: 'enviado' } : c))
    );
  };

  // Send via SMS
  const handleSendSms = (item: PreparedMessage) => {
    checkQuietHours();
    const cleanPhone = (item.phone || item.cleanPhone || '').replace(/[^0-9+]/g, '');
    const url = `sms:${cleanPhone}?body=${encodeURIComponent(item.text)}`;
    window.location.href = url;

    setGeneratedMessages(prev =>
      prev.map(m => (m.id === item.id ? { ...m, sent: true } : m))
    );
    setDormantQueue(prev =>
      prev.map(c => (c.id === item.id ? { ...c, status: 'enviado' } : c))
    );
  };

  // Send via Email
  const handleSendEmail = (item: PreparedMessage) => {
    checkQuietHours();
    const email = item.email || '';
    const subject = encodeURIComponent(`Mensaje de ${businessName || 'nuestro equipo'}`);
    const url = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(item.text)}`;
    window.location.href = url;

    setGeneratedMessages(prev =>
      prev.map(m => (m.id === item.id ? { ...m, sent: true } : m))
    );
    setDormantQueue(prev =>
      prev.map(c => (c.id === item.id ? { ...c, status: 'enviado' } : c))
    );
  };

  const handleConfirmWonOneTouch = (item: { id: string; name: string; phone?: string; cleanPhone?: string; email?: string }, amountStr?: string) => {
    const rawVal = amountStr !== undefined && amountStr !== '' ? parseFloat(amountStr.replace(/[^0-9.]/g, '')) : 0;
    const finalAmount = !isNaN(rawVal) && rawVal > 0 ? rawVal : 0;
    const nowIso = new Date().toISOString();

    setDormantQueue(prev =>
      prev.map(c => (c.id === item.id ? { ...c, status: 'recuperado' as any } : c))
    );

    recordBveltEvent({
      tenantId: auth?.currentUser?.uid,
      type: 'owner_marked_recovered',
      sourceType: 'manual_owner',
      sourceName: 'Owner Dormant Confirmation',
      fetchedAt: nowIso,
      provenance: 'USER_PROVIDED',
      consentScope: 'private',
      trade: businessCategory,
      meta: {
        contactId: item.id,
        customerName: item.name,
        recoveredAmount: finalAmount,
        ownerMarkedAt: nowIso,
        status: 'won'
      }
    });

    RecoveryFeeService.recordRecovery({
      opportunityId: `crm_${item.id}`,
      opportunityTitle: `${item.name} (Cliente Dormido)`,
      recoveredRevenue: finalAmount,
      opportunityType: 'dormant_crm'
    });

    refreshRecoveryFees();
    showToast(t(`🏆 ¡Recuperado confirmado por $${finalAmount}! Guardado como dato confirmado.`, `🏆 Recovered confirmed for $${finalAmount}! Saved as confirmed data.`), 'success');
  };

  // Helper: paste sample CSV
  const handlePasteSampleCsv = () => {
    const sample = `nombre,telefono,ultima_fecha\nCarlos Rodriguez,+1 239 555 0143,2024-04-10\nMaria Gonzalez,maria@example.com,2024-05-18\nRoberto Silva,(239) 555-0199,2024-06-02`;
    setClientListText(sample);
    const parsed = parseCsvText(sample);
    setDormantQueue(parsed);
    showToast(t('3 contactos de prueba cargados desde CSV.', '3 sample contacts loaded from CSV.'), 'info');
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation inside Retention */}
      <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 max-w-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('estimates')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'estimates'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock size={14} className="text-amber-500" />
          <span>{t('Seguimiento a Presupuestos', 'Quotes Follow-up')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('past_clients')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'past_clients'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <RefreshCw size={14} className="text-emerald-500" />
          <span>{t('Avisar Clientes Anteriores', 'Past Clients')}</span>
        </button>
      </div>

      {activeSubTab === 'estimates' ? (
        <EstimateFollowUpSection
          t={t}
          language={language}
          businessName={businessName}
          businessCategory={businessCategory}
          showToast={showToast}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-sm space-y-6">
          {/* 1. Header & Title */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {t('Cola de Reactivación de Clientes Dormidos', 'Dormant Client Reactivation Queue')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'Importa clientes previos y genera oportunidades de rescate con plantillas manuales en 1 toque.',
                        'Import past clients and generate rescue opportunities with 1-tap manual templates.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                  <Zap size={13} />
                  {t(`Tope: ${MAX_DORMANT_TRIAL_LIMIT} contactos`, `Limit: ${MAX_DORMANT_TRIAL_LIMIT} contacts`)}
                </span>
              </div>
            </div>
          </div>

          {/* Legal Consent Banner */}
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={14} />
            </div>
            <div className="text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {t('Consentimiento y Política Anti-Spam', 'Consent & Anti-Spam Policy')}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                {t(
                  'Solo debes importar contactos directos y legítimos de clientes previos de tu negocio. Queda terminantemente prohibido el uso de bases de datos compradas o listas de terceros. Bvelt no realiza envíos masivos automatizados: cada mensaje se revisa y envía manualmente por ti.',
                  'Only import direct and legitimate contacts from your past customers. Purchased databases or third-party lists are strictly prohibited. Bvelt does not perform automated mass blasts: every message is reviewed and dispatched manually by you.'
                )}
              </p>
            </div>
          </div>

          {/* 2. Tone Selector & AI Rewrite */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  {t('Tono del mensaje:', 'Message Tone:')}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('Elige el estilo que mejor encaje con tu relación con el cliente.', 'Pick the style that best fits your client relationship.')}
                </p>
              </div>

              {/* Tone Buttons */}
              <div className="flex items-center gap-2">
                {(['amigable', 'directo', 'urgente'] as const).map(tone => {
                  const isActive = reactivateTone === tone;
                  const toneLabels = {
                    amigable: t('Amigable', 'Friendly'),
                    directo: t('Directo', 'Direct'),
                    urgente: t('Urgente', 'Urgent')
                  };
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => handleToneChange(tone)}
                      disabled={isRewritingReactivate}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? tone === 'urgente'
                            ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/25 scale-102'
                            : tone === 'directo'
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 scale-102'
                            : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 scale-102'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isActive && <Check size={12} className="stroke-[3]" />}
                      {toneLabels[tone]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Rewrite Action */}
            {handleRewriteReactivateTemplate && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRewriteReactivateTemplate(reactivateTone)}
                  disabled={isRewritingReactivate}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={13} className={isRewritingReactivate ? 'animate-spin text-amber-500' : 'text-amber-500'} />
                  {isRewritingReactivate
                    ? t('Reescribiendo plantilla con IA...', 'Rewriting template with AI...')
                    : t('✨ Reescribir plantilla con IA', '✨ Rewrite template with AI')}
                </button>
              </div>
            )}
          </div>

          {/* 3. Editable Message Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t('Plantilla de Mensaje (Editable)', 'Message Template (Editable)')}
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('Usa {name} para insertar el nombre', 'Use {name} to insert name')}
              </span>
            </div>

            <div className="relative">
              <textarea
                rows={3}
                value={localTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition resize-y"
                placeholder={defaultTemplate}
              />
            </div>
          </div>

          {/* 4. CSV Import & Input Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('csv')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    inputMode === 'csv'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Upload size={13} />
                  {t('Cargar Archivo CSV', 'Upload CSV File')}
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    inputMode === 'text'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <FileText size={13} />
                  {t('Pegar Texto CSV / Líneas', 'Paste CSV / Text')}
                </button>
              </div>

              <button
                type="button"
                onClick={handlePasteSampleCsv}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                + {t('Pegar CSV de ejemplo', 'Paste sample CSV')}
              </button>
            </div>

            {inputMode === 'csv' ? (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                  <Upload size={22} />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition shadow-sm cursor-pointer"
                  >
                    {t('Seleccionar Archivo CSV (.csv)', 'Select CSV File (.csv)')}
                  </button>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    {t(
                      'Columnas soportadas: nombre, teléfono/email, última fecha (opcional).',
                      'Supported columns: name, phone/email, last date (optional).'
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={clientListText}
                  onChange={(e) => {
                    setClientListText(e.target.value);
                    const parsed = parseCsvText(e.target.value);
                    setDormantQueue(parsed);
                  }}
                  placeholder="nombre,telefono,ultima_fecha&#10;Carlos Rodriguez,+1 239 555 0143,2024-04-10&#10;Maria Gonzalez,maria@example.com,2024-05-18"
                  className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed outline-none focus:border-indigo-500 resize-y"
                />
              </div>
            )}

            {importCountNote && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{importCountNote}</span>
              </div>
            )}
          </div>

          {/* 5. Dormant Opportunities Queue */}
          {dormantQueue.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Users size={16} className="text-emerald-500" />
                    {t('Cola de Oportunidades de Clientes Dormidos', 'Dormant Client Opportunities')}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                    {dormantQueue.length} / {MAX_DORMANT_TRIAL_LIMIT}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAllBatch}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles size={13} />
                  <span>{t('Preparar Todos en Lote', 'Prepare All Batch')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dormantQueue.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {contact.name}
                        </span>
                        {contact.lastDate && (
                          <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                            {contact.lastDate}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        {contact.phone && <span>📞 {contact.phone}</span>}
                        {contact.email && <span>✉️ {contact.email}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {contact.status === 'preparado' ? (
                        <>
                          <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 mr-1">
                            <CheckCircle2 size={13} /> {t('Listo', 'Ready')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedDormantForRecovery(contact)}
                            className="px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/20 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <span>🏆 {t('Recuperado', 'Recovered')}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePrepareIndividualMessage(contact)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Send size={12} />
                          <span>{t('Preparar mensaje', 'Prepare message')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Results List (Prepared Messages) */}
          {hasGenerated && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Users size={16} className="text-emerald-500" />
                  {t('Mensajes Preparados Listos para Envío', 'Prepared Messages Ready for Dispatch')}
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {generatedMessages.length}
                  </span>
                </h3>

                {generatedMessages.length > 1 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {generatedMessages.filter(m => m.sent).length} / {generatedMessages.length} {t('enviados', 'sent')}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {generatedMessages.map((msgItem) => (
                  <div
                    key={msgItem.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      msgItem.sent
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          {msgItem.phone ? <Phone size={13} /> : <User size={13} />}
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {msgItem.name}
                        </span>
                        {msgItem.phone && (
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {msgItem.phone}
                          </span>
                        )}
                        {msgItem.email && (
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {msgItem.email}
                          </span>
                        )}
                      </div>

                      {msgItem.sent && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          <Check size={12} />
                          {t('Enviado', 'Sent')}
                        </span>
                      )}
                    </div>

                    {/* Message Body */}
                    <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed mb-3.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      {msgItem.text}
                    </p>

                    {/* Fee Due / Recovery Badge if applicable */}
                    {(() => {
                      const feeRec = recoveryFees.find(r => r.opportunityId === msgItem.id || r.opportunityId === `crm_${msgItem.id}`);
                      if (feeRec && feeRec.status === 'fee_due') {
                        return (
                          <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>{t(`Fee de rescate $${feeRec.fixedFee} pendiente`, `Rescue fee $${feeRec.fixedFee} pending`)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const contactObj = dormantQueue.find(c => c.id === msgItem.id) || {
                                  id: msgItem.id,
                                  name: msgItem.name,
                                  phone: msgItem.phone,
                                  cleanPhone: msgItem.cleanPhone,
                                  email: msgItem.email || '',
                                  source: 'crm',
                                  status: 'recuperado'
                                };
                                setSelectedDormantForRecovery(contactObj as DormantContact);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs"
                            >
                              {t(`Pagar fee $${feeRec.fixedFee}`, `Pay fee $${feeRec.fixedFee}`)}
                            </button>
                          </div>
                        );
                      }
                      if (feeRec && feeRec.status === 'paid') {
                        return (
                          <div className="mb-3 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check size={13} />
                            <span>{t(`Fee de éxito pagado ($${feeRec.fixedFee})`, `Success fee paid ($${feeRec.fixedFee})`)}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Action Buttons: Texto (sms:), WhatsApp (wa.me), Correo (mailto:) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Texto (SMS) */}
                      <button
                        type="button"
                        onClick={() => handleSendSms(msgItem)}
                        className="px-3 py-2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <span>📱 {t('Texto', 'Text')}</span>
                      </button>

                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(msgItem)}
                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <MessageCircle size={14} />
                        <span>WhatsApp</span>
                      </button>

                      {/* Correo (Email) */}
                      <button
                        type="button"
                        onClick={() => handleSendEmail(msgItem)}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <span>✉️ {t('Correo', 'Email')}</span>
                      </button>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msgItem)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedId === msgItem.id ? (
                          <>
                            <Check size={14} className="text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">{t('¡Copiado!', 'Copied!')}</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>{t('Copiar', 'Copy')}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Interactive Response Bar: ¿Respondió? y ¿Ganado? $___ */}
                    <div className="mt-3 p-3 bg-slate-100/80 dark:bg-slate-950/90 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-700 dark:text-slate-300">
                          {t('¿Respondió?', 'Did they reply?')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRepliedMap({ ...repliedMap, [msgItem.id]: true })}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                            repliedMap[msgItem.id]
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t('Sí', 'Yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepliedMap({ ...repliedMap, [msgItem.id]: false })}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                            repliedMap[msgItem.id] === false
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t('Aún no', 'Not yet')}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          {t('¿Ganado? $', 'Won? $')}
                        </span>
                        <input
                          type="number"
                          placeholder="0"
                          value={wonAmounts[msgItem.id] || ''}
                          onChange={(e) => setWonAmounts({ ...wonAmounts, [msgItem.id]: e.target.value })}
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmWonOneTouch(msgItem, wonAmounts[msgItem.id])}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg transition cursor-pointer shadow-xs active:scale-95"
                        >
                          <span>🏆 {t('Guardar Ganado', 'Save Won')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. Note: Manual human-in-the-loop */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <HeartHandshake size={16} />
            </div>
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                {t('You send the messages. Bvelt prepares them.', 'You send the messages. Bvelt prepares them.')}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                {t(
                  'Mantienes el 100% de control: los mensajes se envían directamente desde tu WhatsApp o cliente de correo sin pasarelas automáticas de terceros.',
                  'You keep 100% control: messages are sent directly from your WhatsApp or email client without third-party automated gateways.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mark Recovered Modal for Reactivation CRM */}
      {selectedDormantForRecovery && (
        <MarkRecoveredModal
          isOpen={Boolean(selectedDormantForRecovery)}
          onClose={() => setSelectedDormantForRecovery(null)}
          opportunityId={selectedDormantForRecovery.id}
          clientName={selectedDormantForRecovery.name}
          initialEstimatedValue={350}
          serviceCategory={businessCategory || 'Reactivación de Cliente'}
          t={t}
          language={language}
          showToast={showToast}
          onSuccess={(record) => {
            refreshRecoveryFees();
            showToast(t('🎉 Oportunidad registrada con éxito.', '🎉 Opportunity logged successfully.'), 'success');
          }}
        />
      )}
    </div>
  );
}
