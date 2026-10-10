import { recordBveltEvent } from '../knowledge/memory/bemStore';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

export interface ReferralRewardRecord {
  id: string;
  referredCustomerId: string;
  referredUid?: string;
  referrerCode: string;
  referrerUid?: string;
  paymentType: 'stripe_subscription' | 'recovery_fee' | 'usdt_fee';
  rewardType: 'one_month_free' | 'fee_credit_20';
  rewardValue: number; // e.g. 20 (USD) or 1 (month)
  awardedAt: string;
  status: 'awarded' | 'claimed';
}

const STORAGE_REWARDS_LEDGER = 'bvelt_referral_rewards_ledger_v1';

export class ReferralRewardService {
  /**
   * Genera o retorna el código único de referido para un tenant
   */
  static getReferralCode(tenantId?: string, customCode?: string): string {
    if (customCode && customCode.trim()) return customCode.trim().toUpperCase();
    const id = tenantId || auth?.currentUser?.uid || 'GUEST';
    const clean = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    return `BV-${clean || 'PRO'}`;
  }

  /**
   * Genera el enlace canónico de invitación
   */
  static getReferralLink(code: string): string {
    return `https://bvelt.app/?ref=${encodeURIComponent(code)}`;
  }

  /**
   * Texto en inglés listo para copiar y compartir con otro dueño de negocio
   */
  static getShareTextEn(code: string): string {
    const link = this.getReferralLink(code);
    return `I'm using Bvelt to capture missed customer inquiries and recover lost estimates with $0 upfront risk. You get a $20 credit or 1 free month when you join with my link: ${link}`;
  }

  /**
   * Texto en español listo para copiar
   */
  static getShareTextEs(code: string): string {
    const link = this.getReferralLink(code);
    return `Estoy usando Bvelt para capturar llamadas perdidas y recuperar cotizaciones con $0 de riesgo inicial. Recibes $20 de crédito o 1 mes gratis al entrar con mi link: ${link}`;
  }

  /**
   * Registra la atribución de referido al momento del signup o aterrizaje
   */
  static attributeReferral(referredUid: string, refCode: string): void {
    if (!refCode || !referredUid) return;

    // Prevenir auto-referencia básica
    const myCode = this.getReferralCode(referredUid);
    if (refCode.toUpperCase() === myCode.toUpperCase()) {
      console.warn('[ReferralService] Ignorando auto-referido para UID:', referredUid);
      return;
    }

    try {
      localStorage.setItem('bvelt_referred_by', refCode.toUpperCase());
    } catch {}

    // Registro en BEM Event Store
    recordBveltEvent({
      tenantId: referredUid,
      type: 'referral_attributed',
      sourceType: 'referral_engine',
      sourceName: 'Signup Referral Attribution',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_ACTION_INTENT',
      consentScope: 'private',
      meta: {
        referredUid,
        referrerCode: refCode.toUpperCase()
      }
    });
  }

  /**
   * Regla Anti-Fraude Estricta y Otorgamiento de Crédito:
   * 1. 1 solo reward por referredCustomerId / referredUid único.
   * 2. Se activa cuando el referido completa su 1er pago (Stripe Pro o Fee de Recuperación $19).
   * 3. Otorga 1 mes gratis o $20 de saldo fee credit al referrer.
   */
  static async awardReferralOnFirstPayment(params: {
    referredCustomerId: string;
    referredUid?: string;
    referrerCode: string;
    paymentType: 'stripe_subscription' | 'recovery_fee' | 'usdt_fee';
    amount: number;
  }): Promise<{ success: boolean; reason?: string; reward?: ReferralRewardRecord }> {
    const { referredCustomerId, referredUid, referrerCode, paymentType } = params;

    if (!referrerCode || referrerCode.trim() === '') {
      return { success: false, reason: 'no_referrer_code' };
    }

    // Regla Anti-Fraude 1: Prevenir auto-referencia
    if (referredUid) {
      const myCode = this.getReferralCode(referredUid);
      if (referrerCode.toUpperCase() === myCode.toUpperCase()) {
        return { success: false, reason: 'self_referral_prevented' };
      }
    }

    // Regla Anti-Fraude 2: Verificar si ya se otorgó recompensa para este cliente referido
    const existingLedger = this.getRewardsLedger();
    const alreadyRewarded = existingLedger.some(
      r => r.referredCustomerId === referredCustomerId || (referredUid && r.referredUid === referredUid)
    );

    if (alreadyRewarded) {
      console.warn(`[Referral Anti-Fraud] Recompensa ya otorgada previamente para customerId: ${referredCustomerId}`);
      return { success: false, reason: 'already_rewarded_for_customer' };
    }

    // Crear registro de recompensa
    const rewardRecord: ReferralRewardRecord = {
      id: `ref_rew_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      referredCustomerId,
      referredUid,
      referrerCode: referrerCode.toUpperCase(),
      paymentType,
      rewardType: paymentType === 'stripe_subscription' ? 'one_month_free' : 'fee_credit_20',
      rewardValue: paymentType === 'stripe_subscription' ? 1 : 20,
      awardedAt: new Date().toISOString(),
      status: 'awarded'
    };

    // Guardar en Ledger local
    existingLedger.push(rewardRecord);
    this.saveRewardsLedger(existingLedger);

    // Si Firebase Firestore está conectado, actualizar el balance del referrer
    if (db) {
      try {
        const rewardDocRef = doc(db, 'referral_rewards', `reward_${referredCustomerId}`);
        await setDoc(rewardDocRef, rewardRecord, { merge: true });
      } catch (err) {
        console.warn('[ReferralService] Non-fatal firestore sync write:', err);
      }
    }

    // Emisión de evento BEM
    recordBveltEvent({
      tenantId: referredUid || referredCustomerId,
      type: 'referral_reward_granted',
      sourceType: 'referral_engine',
      sourceName: 'First Payment Referral Reward',
      fetchedAt: new Date().toISOString(),
      provenance: 'SYSTEM_EVENT_DERIVED',
      consentScope: 'private',
      meta: {
        referredCustomerId,
        referrerCode: referrerCode.toUpperCase(),
        rewardType: rewardRecord.rewardType,
        rewardValue: rewardRecord.rewardValue,
        paymentType
      }
    });

    return { success: true, reward: rewardRecord };
  }

  /**
   * Obtiene el ledger de recompensas acumuladas
   */
  static getRewardsLedger(): ReferralRewardRecord[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_REWARDS_LEDGER);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Calcula el crédito total acumulado por el referrer
   */
  static getReferrerCreditBalance(referrerCode: string): { feeCreditUsd: number; freeMonths: number; totalReferredPaid: number } {
    const ledger = this.getRewardsLedger().filter(r => r.referrerCode.toUpperCase() === referrerCode.toUpperCase());
    const feeCreditUsd = ledger
      .filter(r => r.rewardType === 'fee_credit_20')
      .reduce((sum, r) => sum + r.rewardValue, 0);
    const freeMonths = ledger
      .filter(r => r.rewardType === 'one_month_free')
      .reduce((sum, r) => sum + r.rewardValue, 0);

    return {
      feeCreditUsd,
      freeMonths,
      totalReferredPaid: ledger.length
    };
  }

  private static saveRewardsLedger(ledger: ReferralRewardRecord[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_REWARDS_LEDGER, JSON.stringify(ledger));
      } catch (err) {
        console.error('Error saving referral rewards ledger:', err);
      }
    }
  }
}
