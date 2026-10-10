/**
 * BVELT USDT BEP-20 Payment Client Service
 * 
 * Flujo: pending -> paid -> provisioned
 * - Red única: BEP-20 (BNB Smart Chain)
 * - Verificación server-side on-chain (sin activación por screenshots)
 * - Protección anti-replay (hash no reutilizable)
 * - Recibo con orderId + txHash
 */

import { auth } from '../lib/firebase';

export interface CreateUsdtOrderResponse {
  success: boolean;
  order: {
    orderId: string;
    amount: number;
    currency: string;
    network: string;
    chain: string;
    receivingAddress: string;
    tokenContract: string;
    status: 'pending' | 'paid' | 'provisioned';
    expiresAt: string;
  };
}

export interface VerifyUsdtPaymentResponse {
  success: boolean;
  message?: string;
  receipt: {
    orderId: string;
    txHash: string;
    status: 'provisioned';
    amount: number;
    currency: string;
    network: string;
    chain: string;
    plan: string;
    provisionedAt: string;
    expiresAt: string;
    verificationMethod?: string;
  };
  error?: string;
  code?: string;
}

export class UsdtPaymentService {
  /**
   * 1. Crea una orden única de USDT BEP-20 en el servidor
   */
  public static async createOrder(
    plan: 'monthly' | 'recovery_fee' = 'monthly',
    amount?: number
  ): Promise<CreateUsdtOrderResponse['order']> {
    const user = auth?.currentUser;
    let token = '';
    if (user) {
      try {
        token = await user.getIdToken();
      } catch {}
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/usdt/create-order', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plan,
        amount: amount || (plan === 'recovery_fee' ? 19 : 49),
        userId: user?.uid || 'anonymous_user'
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'No se pudo generar la orden de pago en USDT.');
    }

    const data: CreateUsdtOrderResponse = await res.json();
    return data.order;
  }

  /**
   * 2. Verifica el pago en el backend mediante consulta on-chain a BNB Smart Chain
   */
  public static async verifyPayment(orderId: string, txHash: string): Promise<VerifyUsdtPaymentResponse> {
    const user = auth?.currentUser;
    let token = '';
    if (user) {
      try {
        token = await user.getIdToken();
      } catch {}
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/usdt/verify-payment', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId,
        txHash: txHash.trim()
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.error || 'Error al verificar la transacción en blockchain.';
      const err: any = new Error(errorMsg);
      err.code = data.code;
      throw err;
    }

    return data;
  }

  /**
   * 3. Consulta el estado de una orden USDT en same-origin /api/usdt/order-status
   */
  public static async getOrderStatus(orderId: string): Promise<{ success: boolean; order: any }> {
    const res = await fetch(`/api/usdt/order-status?orderId=${encodeURIComponent(orderId)}`);
    if (!res.ok) {
      throw new Error('Orden no encontrada');
    }
    return res.json();
  }
}
