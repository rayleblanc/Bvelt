/**
 * BVELT Recovery Fee Service
 * 
 * Modelo Comercial:
 * - $0 para empezar la recuperación de UNA oportunidad marcada.
 * - Fee fijo configurable $15–$29 (Default: $19) cuando:
 *   owner_marked_recovered O respuesta verificada (Regla de Prompt 11).
 * - Stripe suscripción $49 sigue disponible como plan normal.
 * - Sin money transmitter: Bvelt NO es custodio ni retiene dinero del cliente final del contratista.
 * 
 * Flujo de Estados:
 * pending -> confirmed -> fee_due -> paid
 */

import { recordBveltEvent } from '../knowledge/memory/bemStore';

export const DEFAULT_RECOVERY_FEE = 19; // Configurable en código ($15–$29)

export type RecoveryStatus = 'pending' | 'confirmed' | 'fee_due' | 'paid' | 'cancelled';

export interface RecoveryFeeRecord {
  id: string;
  opportunityId: string;
  businessId: string;
  clientName: string;
  serviceCategory?: string;
  estimatedValue: number;
  fixedFee: number; // Por defecto $19
  status: RecoveryStatus;
  createdAt: string;
  confirmedAt?: string;
  feeDueAt?: string;
  paidAt?: string;
  confirmationTrigger?: 'owner_marked' | 'customer_reply' | 'appointment_scheduled';
  verificationSource?: string;
  paymentMethod?: string;
  stripeSessionId?: string;
  notes?: string;
}

const STORAGE_RECOVERY_FEES_KEY = 'bvelt_recovery_fees_v1';

export class RecoveryFeeService {
  /**
   * Inicia el rescate de una oportunidad con $0 upfront.
   * Estado: 'pending'
   */
  static startRecovery(params: {
    opportunityId: string;
    businessId: string;
    clientName: string;
    estimatedValue?: number;
    serviceCategory?: string;
    fixedFee?: number;
  }): RecoveryFeeRecord {
    const fee = params.fixedFee ?? DEFAULT_RECOVERY_FEE;
    const nowIso = new Date().toISOString();

    const record: RecoveryFeeRecord = {
      id: `rec_${params.opportunityId}_${Date.now()}`,
      opportunityId: params.opportunityId,
      businessId: params.businessId || 'default_business',
      clientName: params.clientName || 'Cliente Potencial',
      serviceCategory: params.serviceCategory || 'Servicios Locales',
      estimatedValue: params.estimatedValue || 350,
      fixedFee: fee,
      status: 'pending',
      createdAt: nowIso,
      notes: `Rescate iniciado a $0. Fee de $${fee} aplicable únicamente si se confirma recuperación.`
    };

    const records = this.getAllRecords();
    const existingIdx = records.findIndex(r => r.opportunityId === params.opportunityId && r.status === 'pending');
    if (existingIdx >= 0) {
      records[existingIdx] = record;
    } else {
      records.push(record);
    }
    this.saveRecords(records);

    // Registro BEM de inicio de rescate
    recordBveltEvent({
      tenantId: params.businessId,
      type: 'dormant_rescue_started',
      sourceType: 'recovery_engine',
      sourceName: 'Zero-Dollar Opportunity Rescue',
      fetchedAt: nowIso,
      provenance: 'USER_ACTION_INTENT',
      consentScope: 'private',
      meta: {
        opportunityId: params.opportunityId,
        fixedFee: fee,
        status: 'pending'
      }
    });

    return record;
  }

  /**
   * Confirma la recuperación aplicando ESTRICTAMENTE la Regla de Prompt 11:
   * Solo si: respuesta de cliente verificada O dueño marca cita/trabajo (con timestamp).
   * share_opened NO cuenta NUNCA.
   * 
   * Transición de estado: pending -> confirmed -> fee_due
   */
  static confirmRecovery(params: {
    opportunityId?: string;
    businessId: string;
    trigger: 'owner_marked' | 'customer_reply' | 'appointment_scheduled';
    isShareOpened?: boolean;
    hasCustomerReply?: boolean;
    hasOwnerMarked?: boolean;
    clientValue?: number;
    ownerTimestamp?: string;
    notes?: string;
  }): RecoveryFeeRecord | null {
    // REGLA 1 (Prompt 11): share_opened NO cuenta
    if (params.isShareOpened) {
      console.warn('[RecoveryFeeService] share_opened no califica como recuperación confirmada.');
      return null;
    }

    const isRule1Satisfied = Boolean(
      params.hasCustomerReply ||
      params.hasOwnerMarked ||
      params.trigger === 'owner_marked' ||
      params.trigger === 'customer_reply' ||
      params.trigger === 'appointment_scheduled'
    );

    if (!isRule1Satisfied) {
      console.warn('[RecoveryFeeService] Criterio de recuperación no satisfecho.');
      return null;
    }

    const records = this.getAllRecords();
    const nowIso = new Date().toISOString();

    // Buscar registro existente o crear uno bajo el modelo de rescate
    let record = records.find(r => 
      (params.opportunityId && r.opportunityId === params.opportunityId) ||
      (r.businessId === params.businessId && r.status === 'pending')
    );

    if (!record) {
      record = {
        id: `rec_${params.opportunityId || Date.now()}`,
        opportunityId: params.opportunityId || `opp_${Date.now()}`,
        businessId: params.businessId,
        clientName: 'Cliente Recuperado',
        estimatedValue: params.clientValue || 450,
        fixedFee: DEFAULT_RECOVERY_FEE,
        status: 'pending',
        createdAt: nowIso
      };
      records.push(record);
    }

    // 1. Transición a CONFIRMED
    record.status = 'confirmed';
    record.confirmedAt = params.ownerTimestamp || nowIso;
    record.confirmationTrigger = params.trigger;
    record.verificationSource = params.trigger === 'owner_marked' ? 'OWNER_MANUAL_VERIFICATION' : 'INCOMING_CUSTOMER_REPLY';

    // 2. Transición inmediata a FEE_DUE (modelo de contraprestación de rescate)
    record.status = 'fee_due';
    record.feeDueAt = nowIso;
    if (params.clientValue) {
      record.estimatedValue = params.clientValue;
    }
    if (params.notes) {
      record.notes = params.notes;
    }

    this.saveRecords(records);

    // Registro BEM de confirmación y fee debido
    recordBveltEvent({
      tenantId: params.businessId,
      type: 'owner_marked_recovered',
      sourceType: 'recovery_fee_engine',
      sourceName: 'Recovery Confirmed (Fee Due)',
      fetchedAt: nowIso,
      provenance: 'USER_OWNER_CONFIRMATION',
      consentScope: 'private',
      meta: {
        opportunityId: record.opportunityId,
        fixedFee: record.fixedFee,
        status: 'fee_due',
        recoveredAmount: record.estimatedValue,
        trigger: params.trigger
      }
    });

    return record;
  }

  /**
   * Marca el fee como pagado tras checkout directo en Stripe o USDT BEP-20
   * Dispara evento BEM: recovery_fee_paid
   */
  static markFeePaid(opportunityId: string, paymentRef?: string): RecoveryFeeRecord | null {
    const records = this.getAllRecords();
    const record = records.find(r => r.opportunityId === opportunityId || r.id === opportunityId);
    if (!record) return null;

    const nowIso = new Date().toISOString();
    record.status = 'paid';
    record.paidAt = nowIso;
    if (paymentRef) {
      record.stripeSessionId = paymentRef;
      if (paymentRef.startsWith('usdt_')) {
        record.paymentMethod = 'usdt_bep20';
      } else {
        record.paymentMethod = 'stripe_card';
      }
    }

    this.saveRecords(records);

    // Registro BEM de fee pagado (Requisito Pay-After-Win)
    recordBveltEvent({
      tenantId: record.businessId || 'default_business',
      type: 'recovery_fee_paid',
      sourceType: 'recovery_fee_engine',
      sourceName: 'Pay-After-Win Fee Settlement',
      fetchedAt: nowIso,
      provenance: 'USER_PAYMENT_CONFIRMATION',
      consentScope: 'private',
      meta: {
        opportunityId: record.opportunityId,
        fixedFee: record.fixedFee,
        status: 'paid',
        paymentRef: paymentRef || 'completed',
        recoveredAmount: record.estimatedValue
      }
    });

    return record;
  }

  /**
   * Obtiene todos los registros de fee
   */
  static getAllRecords(businessId?: string): RecoveryFeeRecord[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_RECOVERY_FEES_KEY);
      if (!raw) return [];
      const list: RecoveryFeeRecord[] = JSON.parse(raw);
      if (!businessId) return list;
      return list.filter(r => !r.businessId || r.businessId === businessId);
    } catch {
      return [];
    }
  }

  /**
   * Resumen de fees pendientes para la UI
   */
  static getSummary(businessId?: string) {
    const records = this.getAllRecords(businessId);
    const pendingCount = records.filter(r => r.status === 'pending').length;
    const feeDueRecords = records.filter(r => r.status === 'fee_due');
    const totalFeeDue = feeDueRecords.reduce((acc, r) => acc + r.fixedFee, 0);
    const totalRecoveredValue = records.filter(r => r.status === 'fee_due' || r.status === 'paid')
      .reduce((acc, r) => acc + r.estimatedValue, 0);

    return {
      pendingCount,
      feeDueCount: feeDueRecords.length,
      totalFeeDue,
      totalRecoveredValue,
      defaultFee: DEFAULT_RECOVERY_FEE
    };
  }

  private static saveRecords(records: RecoveryFeeRecord[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_RECOVERY_FEES_KEY, JSON.stringify(records));
      } catch (e) {
        console.error('Error saving recovery fee records:', e);
      }
    }
  }
}
