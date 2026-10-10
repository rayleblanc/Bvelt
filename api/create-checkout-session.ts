import { Request, Response } from "express";
import Stripe from "stripe";
import * as Sentry from "@sentry/node";
import { getFirebaseAdminAuth, getFirebaseAdminDB } from "./firebaseAdmin.ts";

function getStripeSecretKey(): string {
  return process.env.STRIPE_CHECKOUT_RESTRICTED_KEY ||
         process.env.STRIPE_SECRET_KEY || 
         process.env.STRIPE_S_RET_KEY || 
         process.env.STRIPE_PROD_SECRET_KEY || 
         process.env.STRIPE_SECRET || 
         '';
}

/**
 * Controller handler for /api/create-checkout-session
 * Compatible with Express, Vite local server, and Vercel Serverless Functions.
 */
export async function createCheckoutSessionHandler(req: Request | any, res: Response | any) {
  // Handle preflight CORS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 1. Authenticate user using Firebase ID Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado. Token de autenticación ausente." });
    }

    const auth = getFirebaseAdminAuth();
    if (!auth) {
      return res.status(503).json({
        error: "Billing temporarily unavailable (server auth not configured).",
        code: "ADMIN_AUTH_UNAVAILABLE"
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (authErr) {
      console.error("[create-checkout-session] Error verifying Firebase ID Token:", authErr);
      return res.status(401).json({ error: "Token de autenticación inválido o expirado." });
    }

    const verifiedUid = decodedToken.uid;

    // Parse body safely if string or undefined
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const { priceId, planType } = body;

    // 2. Fetch profile details from Firestore to derive Stripe Customer ID and verified Email
    const db = getFirebaseAdminDB();
    let verifiedStripeCustomerId = "";
    let verifiedEmail = decodedToken.email || body.email || "";
    let hasUsedTrial = false;

    if (db) {
      try {
        const profileRef = db.collection("profiles").doc(verifiedUid);
        const profileSnap = await profileRef.get();

        if (profileSnap.exists) {
          const data = profileSnap.data();
          if (data) {
            if (data.stripeCustomerId) {
              verifiedStripeCustomerId = data.stripeCustomerId;
            }
            if (data.email) {
              verifiedEmail = data.email;
            }
            if (data.hasUsedTrial) {
              hasUsedTrial = true;
            }
          }
        }
      } catch (err) {
        console.warn("[CreateCheckoutSession] Non-fatal Firestore read error:", err);
      }
    }

    // MANDATORY EMAIL VALIDATION (Master Plan 3.5): A valid email is required for Pro subscriptions
    if (!verifiedEmail || verifiedEmail.trim() === '' || !verifiedEmail.includes('@')) {
      return res.status(400).json({
        error: "Correo electrónico requerido",
        details: "Es obligatorio registrar un correo electrónico válido antes de activar la suscripción Pro para el envío de informes y facturas."
      });
    }

    // Ensure email is persisted in profile if newly provided
    if (db) {
      try {
        const profileRef = db.collection("profiles").doc(verifiedUid);
        await profileRef.set({ email: verifiedEmail, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.warn("[CreateCheckoutSession] Non-fatal Firestore write error:", err);
      }
    }

    // Explicit origin resolution: Never redirect to *.firebaseapp.com
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || "";
    const protocol = req.headers['x-forwarded-proto'] || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
    let origin = "https://bvelt.app";
    
    if (process.env.NODE_ENV !== "production") {
      if (req.headers['origin'] && (req.headers['origin'].includes('localhost') || req.headers['origin'].includes('127.0.0.1'))) {
        origin = req.headers['origin'];
      } else if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
        origin = `${protocol}://${host}`;
      } else if (process.env.APP_URL && !process.env.APP_URL.includes('firebaseapp.com')) {
        origin = process.env.APP_URL;
      }
    } else {
      origin = "https://bvelt.app";
    }

    const secretKey = getStripeSecretKey();

    // 3. Validate presence of STRIPE_SECRET_KEY before calling Stripe
    if (!secretKey || secretKey.trim() === '' || secretKey.includes('mock')) {
      console.warn("[Stripe API] STRIPE_SECRET_KEY missing or configured with mock value.");
      return res.status(400).json({
        error: "Clave de Stripe no configurada",
        details: "No se encontró la clave secreta STRIPE_SECRET_KEY en las variables de entorno de Vercel.",
        missingVar: "STRIPE_SECRET_KEY"
      });
    }

    if (!secretKey.startsWith('sk_live_') && !secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_') &&
        !secretKey.startsWith('rk_live_') && !secretKey.startsWith('rk_test_') && !secretKey.startsWith('rk_')) {
      console.warn("[Stripe API] STRIPE_SECRET_KEY format unrecognized.");
      return res.status(400).json({
        error: "Clave de Stripe no válida",
        details: "La variable STRIPE_SECRET_KEY debe ser una clave secreta o restringida válida de Stripe (comenzando con sk_ o rk_)."
      });
    }

    const stripe = new Stripe(secretKey);

    // 4. Recovery Fee ($19 One-Time Payment Mode)
    if (planType === 'recovery_fee' || planType === 'recovery') {
      const recoveryPriceEnv = process.env.RECOVERY_FEE_PRICE_ID || 
                               process.env.STRIPE_RECOVERY_PRICE_ID || 
                               process.env.STRIPE_PRICE_ID_RECOVERY || 
                               process.env.STRIPE_PROD_PRICE_RECOVERY_FEE || 
                               process.env.STRIPE_PROD_RECOVERY_FEE || 
                               "";

      let recoveryLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

      if (recoveryPriceEnv && recoveryPriceEnv.trim().startsWith('price_')) {
        recoveryLineItems = [{ price: recoveryPriceEnv.trim(), quantity: 1 }];
      } else {
        const oppLabel = body.opportunityId ? ` (Ref: ${body.opportunityId})` : '';
        recoveryLineItems = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Bvelt - Recovery Fee ($19)',
                description: `Honorario por reactivación exitosa de cliente${oppLabel}. Modelo Pay-After-Win.`
              },
              unit_amount: 1900
            },
            quantity: 1
          }
        ];
      }

      const oppId = body.opportunityId || '';
      const recoverySessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: recoveryLineItems,
        mode: 'payment',
        success_url: `${origin}/?checkout=recovery_success&session_id={CHECKOUT_SESSION_ID}&opportunityId=${encodeURIComponent(oppId)}`,
        cancel_url: `${origin}/?checkout=cancel`,
        client_reference_id: verifiedUid,
        metadata: {
          userId: verifiedUid,
          planType: 'recovery_fee',
          opportunityId: oppId,
          feeAmount: '19'
        }
      };

      if (verifiedStripeCustomerId) {
        recoverySessionConfig.customer = verifiedStripeCustomerId;
      } else if (verifiedEmail) {
        recoverySessionConfig.customer_email = verifiedEmail;
      }

      const session = await stripe.checkout.sessions.create(recoverySessionConfig);

      return res.status(200).json({
        sessionId: session.id,
        id: session.id,
        url: session.url,
        planType: 'recovery_fee',
        mode: 'payment'
      });
    }

    // 5. Resolve production plan price IDs strictly using configured Vercel env variables:
    const stripeMonthlyPrice = process.env.STRIPE_PROD_PRICE_MONTHLY || 
                              process.env.STRIPE_PROD_MONTHLY || 
                              process.env.STRIPE_PRICE_ID_MONTHLY || 
                              process.env.STRIPE_PRICE_MONTHLY || 
                              process.env.STRIPE_PRICE_PROD_MONTHLY || 
                              process.env.STRIPE_PRICE_PRO_MONTHLY || 
                              process.env.VITE_STRIPE_PROD_MONTHLY || 
                              process.env.VITE_STRIPE_PRICE_PRO_MONTHLY ||
                              "prod_UzMT6pSMhvocc8";

    const stripeYearlyPrice = process.env.STRIPE_PROD_PRICE_ANNUAL || 
                              process.env.STRIPE_PROD_ANNUAL || 
                              process.env.STRIPE_PRICE_ID_ANNUAL || 
                              process.env.STRIPE_PRICE_ANNUAL || 
                              process.env.STRIPE_PROD_PRICE_YEARLY || 
                              process.env.STRIPE_PROD_YEARLY || 
                              process.env.STRIPE_PRICE_PROD_ANNUAL || 
                              process.env.STRIPE_PRICE_PROD_YEARLY || 
                              process.env.STRIPE_PRICE_PRO_YEARLY || 
                              process.env.VITE_STRIPE_PROD_YEARLY || 
                              process.env.VITE_STRIPE_PROD_ANNUAL || 
                              process.env.VITE_STRIPE_PRICE_PRO_YEARLY ||
                              "prod_UzMTca4UZ2zlXr";

    const isYearly = planType === 'yearly' || planType === 'annual' || priceId === 'price_mock_pro_yearly' || priceId === 'pro_yearly' || priceId === 'pro_annual';
    const normalizedPlanType = isYearly ? 'yearly' : 'monthly';
    const targetInterval: 'month' | 'year' = isYearly ? 'year' : 'month';

    const secretForPlan = isYearly ? stripeYearlyPrice : stripeMonthlyPrice;

    // Resolve price ID helper
    const resolveToPriceId = async (idOrSecret: string | undefined | null, interval: 'month' | 'year'): Promise<string | null> => {
      if (!idOrSecret || typeof idOrSecret !== 'string') return null;
      const trimmed = idOrSecret.trim();
      if (!trimmed || trimmed.includes('mock') || trimmed.startsWith('pro_')) return null;

      if (trimmed.startsWith('price_')) {
        return trimmed;
      }

      if (trimmed.startsWith('prod_')) {
        try {
          const prices = await stripe.prices.list({
            product: trimmed,
            active: true,
            type: 'recurring',
            limit: 50
          });

          if (prices.data.length > 0) {
            const intervalMatches = prices.data.filter(p => p.recurring?.interval === interval);
            if (intervalMatches.length > 0) {
              const targetAmount = interval === 'month' ? 4900 : 39000;
              const exactAmountMatch = intervalMatches.find(p => p.unit_amount === targetAmount);
              if (exactAmountMatch) return exactAmountMatch.id;
              return intervalMatches[0].id;
            }
            return prices.data[0].id;
          } else {
            try {
              const product = await stripe.products.retrieve(trimmed);
              if (product.default_price) {
                return typeof product.default_price === 'string'
                  ? product.default_price
                  : (product.default_price as any).id;
              }
            } catch {}
          }
        } catch (err: any) {
          console.warn(`[Stripe resolveToPriceId] Failed listing prices for product ${trimmed}:`, err?.message || err);
        }
      }
      return null;
    };

    let selectedPriceId: string | null = await resolveToPriceId(secretForPlan, targetInterval);

    // If secret didn't resolve and body.priceId is a real Stripe ID, try body.priceId
    if (!selectedPriceId && priceId && typeof priceId === 'string' && !priceId.includes('mock') && !priceId.startsWith('pro_')) {
      selectedPriceId = await resolveToPriceId(priceId, targetInterval);
    }

    // Dynamic product fallback search on Stripe account if still unresolved
    if (!selectedPriceId) {
      try {
        const products = await stripe.products.list({ limit: 50, active: true });
        const searchKeyword = isYearly ? 'annual' : 'month';
        let product = products.data.find(p => 
          p.name.toLowerCase().includes(searchKeyword) || 
          (isYearly ? p.name.toLowerCase().includes('vip') : (p.name.toLowerCase().includes('scale') || p.name.toLowerCase().includes('pro')))
        );
        if (!product && products.data.length > 0) {
          product = products.data[0];
        }
        if (product) {
          selectedPriceId = await resolveToPriceId(product.id, targetInterval);
        }
      } catch (searchErr) {
        console.warn("[Stripe] Dynamic product search failed:", searchErr);
      }
    }

    if (!selectedPriceId) {
      const requiredVarName = isYearly ? 'STRIPE_PROD_PRICE_ANNUAL' : 'STRIPE_PROD_PRICE_MONTHLY';
      return res.status(400).json({
        error: "ID de precio de Stripe no configurado",
        details: `No se pudo determinar una tarifa activa de Stripe para el plan ${normalizedPlanType}. Verifica la configuración.`,
        missingVar: requiredVarName
      });
    }

    // 5. Configure subscription checkout session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
    };

    if (verifiedStripeCustomerId) {
      sessionConfig.customer = verifiedStripeCustomerId;
    } else if (verifiedEmail) {
      sessionConfig.customer_email = verifiedEmail;
    }

    sessionConfig.client_reference_id = verifiedUid;
    sessionConfig.metadata = { userId: verifiedUid, planType: normalizedPlanType };
    sessionConfig.subscription_data = {
      metadata: { userId: verifiedUid, planType: normalizedPlanType }
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return res.json({ url: session.url, id: session.id, sessionId: session.id });
  } catch (error: any) {
    console.error("[Stripe API Error]:", error?.message || error);
    try {
      const currentUid = (req as any)?.body?.userId || (req as any)?.headers?.['x-user-id'] || 'unknown_checkout_user';
      Sentry.setUser({ id: currentUid });
      Sentry.setTag('uid', currentUid);
      Sentry.captureException(error, {
        tags: {
          feature: 'stripe_checkout_backend',
          uid: currentUid
        }
      });
    } catch (sentryErr) {
      // Safe fallback
    }

    return res.status(500).json({
      error: "Error en el servidor de pago con Stripe",
      details: error?.message || "Ocurrió un error inesperado al generar la sesión de pago."
    });
  }
}

export default createCheckoutSessionHandler;

/**
 * ============================================================================
 * CHECKLIST DE CONFIGURACIÓN DE CONSOLA (FIREBASE & GOOGLE CLOUD OAUTH)
 * ============================================================================
 * Para evitar páginas de "The requested action is invalid" o bloqueos de OAuth:
 * 
 * 1. Firebase Console → Authentication → Settings → Authorized domains:
 *    - bvelt.app
 *    - www.bvelt.app
 *    - localhost (y 127.0.0.1 para desarrollo local)
 *    - localflowpro-20e3d.firebaseapp.com
 * 
 * 2. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs (Bvelt Web Client):
 *    - Authorized JavaScript origins:
 *      * https://bvelt.app
 *      * https://www.bvelt.app
 *      * http://localhost:3000 (y http://localhost:5173)
 *    - Authorized redirect URIs:
 *      * https://bvelt.app
 *      * https://bvelt.app/__/auth/handler
 *      * https://localflowpro-20e3d.firebaseapp.com/__/auth/handler
 * 
 * 3. Stripe Dashboard → Developers → Webhooks / Settings:
 *    - Return URLs / Success URLs permitidas: https://bvelt.app
 *    - Webhook endpoint activo: https://bvelt.app/api/stripe-webhook (o Cloudflare Worker route)
 * ============================================================================
 */

