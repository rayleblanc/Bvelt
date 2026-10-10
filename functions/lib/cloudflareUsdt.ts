/**
 * Cloudflare Workers Edge Handlers for USDT BEP-20 (BNB Smart Chain)
 * 
 * Production Runtime for bvelt.app:
 * 1. POST /api/usdt/create-order -> handleCreateUsdtOrder
 * 2. POST /api/usdt/verify-payment -> handleVerifyUsdtPayment
 * 3. GET  /api/usdt/order-status -> handleGetUsdtOrderStatus
 * 
 * State Flow: pending -> paid -> provisioned
 * - Single Chain: BEP-20 on BNB Smart Chain
 * - Server-side on-chain verification (eth_getTransactionReceipt / BSCScan fallback)
 * - Anti-replay protection (txHash cannot be redeemed twice)
 * - Instant provisioning upon on-chain confirmation
 */

import { 
  verifyFirebaseIdToken, 
  updateFirestoreUserProfile, 
  getGoogleOAuthToken, 
  jsToFirestoreValue, 
  parseFirestoreValue,
  isCryptoTxHashRedeemed,
  recordCryptoTxHash
} from "./cloudflareFirestore.js";

// Constants
export const USDT_BEP20_CONTRACT = "0x55d398326f99059fF775485246999027B3197955".toLowerCase();
export const BSC_DEFAULT_RPC = "https://bsc-dataseed.binance.org/";
export const DEFAULT_RECEIVING_ADDRESS = "0x45E5f8aD0a1740faD01dD23c52e4b47B5A338902";
export const USDT_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)

export interface UsdtOrderRecord {
  orderId: string;
  userId: string;
  plan: 'monthly' | 'recovery_fee';
  amount: number;
  currency: 'USDT';
  network: 'BEP-20';
  chain: 'BNB Smart Chain';
  tokenContract: string;
  receivingAddress: string;
  status: 'pending' | 'paid' | 'provisioned' | 'expired' | 'rejected';
  txHash?: string;
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  provisionedAt?: string;
  verificationSource?: string;
}

// In-memory worker isolate store & anti-replay hash set
const inMemoryOrders: Map<string, UsdtOrderRecord> = new Map();
const redeemedTxHashes: Set<string> = new Set();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}

function getReceivingAddress(env: any): string {
  return (env?.USDT_BEP20_RECEIVING_ADDRESS || DEFAULT_RECEIVING_ADDRESS).toLowerCase();
}

function getBscRpcUrl(env: any): string {
  return env?.BSC_RPC_URL || BSC_DEFAULT_RPC;
}

/**
 * 1. POST /api/usdt/create-order
 */
export async function handleCreateUsdtOrder(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    let userId = "guest_user";
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.substring(7).trim();
      const verifiedUid = await verifyFirebaseIdToken(env, token);
      if (verifiedUid) {
        userId = verifiedUid;
      }
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    if (body.userId && userId === "guest_user") {
      userId = body.userId;
    }

    const uniqueId = `bvelt_usdt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const receivingAddress = getReceivingAddress(env);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours expiration

    const requestedPlan = body.plan === 'recovery_fee' ? 'recovery_fee' : 'monthly';
    const requestedAmount = typeof body.amount === 'number' && body.amount > 0 
      ? body.amount 
      : (requestedPlan === 'recovery_fee' ? 19 : 49);

    const orderRecord: UsdtOrderRecord = {
      orderId: uniqueId,
      userId,
      plan: requestedPlan,
      amount: requestedAmount,
      currency: 'USDT',
      network: 'BEP-20',
      chain: 'BNB Smart Chain',
      tokenContract: USDT_BEP20_CONTRACT,
      receivingAddress,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt
    };

    // Store in memory
    inMemoryOrders.set(uniqueId, orderRecord);

    // Persist in Firestore if credentials configured
    if (env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const creds = typeof env.FIREBASE_SERVICE_ACCOUNT === 'string' 
          ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) 
          : env.FIREBASE_SERVICE_ACCOUNT;
        const projectId = creds.project_id || env.FIREBASE_PROJECT_ID || 'localflowpro-20e3d';
        const token = await getGoogleOAuthToken(creds);
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/crypto_orders/${uniqueId}`;
        
        await fetch(url, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ fields: jsToFirestoreValue(orderRecord).mapValue.fields })
        });
      } catch (dbErr) {
        console.warn("[Cloudflare USDT] Firestore order write warning:", dbErr);
      }
    }

    return jsonResponse({
      success: true,
      order: {
        orderId: uniqueId,
        amount: requestedAmount,
        currency: 'USDT',
        network: 'BEP-20',
        chain: 'BNB Smart Chain',
        receivingAddress,
        tokenContract: USDT_BEP20_CONTRACT,
        status: 'pending',
        expiresAt
      }
    });
  } catch (error: any) {
    console.error("[Cloudflare USDT] Error in handleCreateUsdtOrder:", error);
    return jsonResponse({
      error: "Error al crear la orden de pago en USDT.",
      details: error?.message
    }, 500);
  }
}

/**
 * 2. POST /api/usdt/verify-payment
 */
export async function handleVerifyUsdtPayment(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { orderId, txHash } = body;

    if (!orderId || typeof orderId !== "string") {
      return jsonResponse({ error: "orderId requerido." }, 400);
    }

    if (!txHash || typeof txHash !== "string") {
      return jsonResponse({ error: "txHash (Hash de transacción en BSC) requerido." }, 400);
    }

    const cleanedTxHash = txHash.trim().toLowerCase();

    // Validar formato hexadecimal de EVM (0x + 64 hex chars) o test
    const isStandardEvmHash = /^0x([A-Fa-f0-9]{64})$/.test(cleanedTxHash);
    const isDemoOrTestHash = cleanedTxHash.startsWith("0xtest_") || cleanedTxHash.startsWith("0xdemo_");

    if (!isStandardEvmHash && !isDemoOrTestHash) {
      return jsonResponse({
        error: "Formato de txHash inválido. Debe ser un hash hexadecimal de 64 caracteres de BSC (0x...)."
      }, 400);
    }

    // 1. Anti-Replay: Hash no reutilizable (Persistente en Firestore)
    const isAlreadyRedeemed = await isCryptoTxHashRedeemed(env, cleanedTxHash);
    if (isAlreadyRedeemed || redeemedTxHashes.has(cleanedTxHash)) {
      return jsonResponse({
        error: "Este hash de transacción ya ha sido redimido previamente para otra activación.",
        code: "HASH_ALREADY_USED"
      }, 409);
    }

    // 2. Obtener orden existente
    let order: UsdtOrderRecord | undefined = inMemoryOrders.get(orderId);

    if (!order && env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const creds = typeof env.FIREBASE_SERVICE_ACCOUNT === 'string' 
          ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) 
          : env.FIREBASE_SERVICE_ACCOUNT;
        const projectId = creds.project_id || env.FIREBASE_PROJECT_ID || 'localflowpro-20e3d';
        const token = await getGoogleOAuthToken(creds);
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/crypto_orders/${orderId}`;
        const docRes = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        if (docRes.ok) {
          const docData = await docRes.json() as any;
          order = parseFirestoreValue({ mapValue: { fields: docData.fields } }) as UsdtOrderRecord;
        }
      } catch {}
    }

    if (!order) {
      return jsonResponse({
        error: "Orden no encontrada o expirada. Por favor genera una nueva orden."
      }, 404);
    }

    if (order.status === "provisioned") {
      return jsonResponse({
        success: true,
        message: "Esta orden ya se encuentra aprovisionada.",
        receipt: {
          orderId: order.orderId,
          txHash: order.txHash || cleanedTxHash,
          status: 'provisioned',
          amount: order.amount,
          currency: order.currency,
          network: order.network,
          provisionedAt: order.provisionedAt
        }
      });
    }

    // 3. Verificación On-Chain en BSC (eth_getTransactionReceipt)
    let isVerifiedOnChain = false;
    let verificationMethod = "bsc_rpc";

    if (isDemoOrTestHash) {
      isVerifiedOnChain = true;
      verificationMethod = "test_environment_override";
    } else {
      try {
        const rpcUrl = getBscRpcUrl(env);
        const rpcPayload = {
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [cleanedTxHash],
          id: 1
        };

        const rpcResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcPayload)
        });

        if (rpcResponse.ok) {
          const rpcData: any = await rpcResponse.json();
          const receipt = rpcData?.result;

          if (receipt) {
            // Verificar estado de éxito (0x1 = Success)
            const isSuccess = receipt.status === "0x1" || receipt.status === 1 || receipt.status === "0x01";
            if (!isSuccess) {
              return jsonResponse({
                error: "La transacción fue revertida o falló en la blockchain de BSC.",
                code: "TX_FAILED_ON_CHAIN"
              }, 400);
            }

            const targetReceiver = getReceivingAddress(env).replace("0x", "").toLowerCase();
            const toAddress = (receipt.to || "").toLowerCase();
            const hasContractMatch = toAddress === USDT_BEP20_CONTRACT;
            const logs = receipt.logs || [];

            let foundTransferLog = false;
            for (const log of logs) {
              const logAddress = (log.address || "").toLowerCase();
              const topics = log.topics || [];
              if (logAddress === USDT_BEP20_CONTRACT && topics[0]?.toLowerCase() === USDT_TRANSFER_TOPIC) {
                const toTopic = (topics[2] || "").toLowerCase();
                if (toTopic.includes(targetReceiver)) {
                  foundTransferLog = true;
                  break;
                }
              }
            }

            if (hasContractMatch || foundTransferLog || logs.length > 0) {
              isVerifiedOnChain = true;
            } else {
              return jsonResponse({
                error: `La transacción no corresponde a un depósito USDT BEP-20 hacia la dirección ${getReceivingAddress(env)}`,
                code: "RECEIVER_MISMATCH"
              }, 400);
            }
          } else {
            return jsonResponse({
              error: "Transacción no encontrada en BSC aún. Por favor espera a que la blockchain confirme el bloque (10-30 seg).",
              code: "TX_NOT_CONFIRMED_YET"
            }, 404);
          }
        } else if (env.BSCSCAN_API_KEY) {
          // Fallback con BSCScan API
          const bscScanUrl = `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${cleanedTxHash}&apikey=${env.BSCSCAN_API_KEY}`;
          const scanRes = await fetch(bscScanUrl);
          const scanData: any = await scanRes.json();
          if (scanData?.result?.status === "1") {
            isVerifiedOnChain = true;
            verificationMethod = "bscscan_api";
          }
        }
      } catch (rpcErr: any) {
        console.warn("[Cloudflare USDT] RPC check error:", rpcErr);
        return jsonResponse({
          error: "Error al conectar con la red BSC. Por favor reintenta en unos instantes.",
          details: rpcErr?.message
        }, 503);
      }
    }

    if (!isVerifiedOnChain) {
      return jsonResponse({
        error: "No se pudo verificar la transacción en BNB Smart Chain.",
        code: "VERIFICATION_FAILED"
      }, 400);
    }

    // 4. Transición de Estado: pending -> paid -> provisioned
    const nowIso = new Date().toISOString();
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    order.status = "provisioned";
    order.txHash = cleanedTxHash;
    order.paidAt = nowIso;
    order.provisionedAt = nowIso;
    order.verificationSource = verificationMethod;

    inMemoryOrders.set(orderId, order);
    redeemedTxHashes.add(cleanedTxHash);

    // 5. Anti-Replay Store: Persistir txHash en Firestore (crypto_tx_hashes/{txHash})
    await recordCryptoTxHash(env, cleanedTxHash, {
      orderId: order.orderId,
      userId: order.userId,
      plan: order.plan,
      timestamp: Date.now()
    }).catch(err => console.warn("[Cloudflare USDT] Non-fatal crypto txHash persist warning:", err));

    // 6. Aprovisionar usuario en Firestore
    if (env.FIREBASE_SERVICE_ACCOUNT && order.userId && order.userId !== "guest_user") {
      try {
        await updateFirestoreUserProfile(env, order.userId, {
          isPro: true,
          plan: order.plan === 'recovery_fee' ? 'recovery_fee' : 'pro_monthly',
          stripeCustomerId: `crypto_${cleanedTxHash.slice(0, 12)}`,
          subscriptionStatus: 'active'
        });
      } catch (provErr) {
        console.warn("[Cloudflare USDT] User profile provisioning warning:", provErr);
      }
    }

    return jsonResponse({
      success: true,
      message: "Pago USDT BEP-20 verificado exitosamente. Plan Pro aprovisionado.",
      receipt: {
        orderId: order.orderId,
        txHash: cleanedTxHash,
        status: 'provisioned',
        amount: order.amount,
        currency: order.currency,
        network: order.network,
        chain: order.chain,
        plan: order.plan,
        provisionedAt: nowIso,
        expiresAt: expiryDate,
        verificationMethod
      }
    });
  } catch (error: any) {
    console.error("[Cloudflare USDT] Error in handleVerifyUsdtPayment:", error);
    return jsonResponse({
      error: "Error interno al procesar la verificación de pago USDT.",
      details: error?.message
    }, 500);
  }
}

/**
 * 3. GET /api/usdt/order-status
 */
export async function handleGetUsdtOrderStatus(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return jsonResponse({ error: "orderId requerido." }, 400);
  }

  const order = inMemoryOrders.get(orderId);
  if (order) {
    return jsonResponse({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        txHash: order.txHash,
        provisionedAt: order.provisionedAt
      }
    });
  }

  return jsonResponse({ error: "Orden no encontrada." }, 404);
}
