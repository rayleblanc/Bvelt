/**
 * Cloudflare-native Stripe Service.
 * Uses Fetch HTTP Client compatible with Cloudflare Workers / Edge Runtime.
 */
import Stripe from "stripe";
import { updateFirestoreUserProfile, updateFirestoreRecoveryFee, claimStripeEvent, updateStripeEventStatus, verifyFirebaseIdToken } from "./cloudflareFirestore.js";

export function getStripeClient(env: any, scope: 'webhook' | 'checkout' | 'read' = 'read'): Stripe {
  let secretKey = env.STRIPE_CHECKOUT_RESTRICTED_KEY ||
                  env.STRIPE_SECRET_KEY || 
                  env.STRIPE_PROD_SECRET_KEY || 
                  env.STRIPE_SECRET || 
                  "";
  
  if (scope === 'webhook') {
    secretKey = env.STRIPE_WEBHOOK_RESTRICTED_KEY || env.STRIPE_SECRET_KEY || secretKey;
  } else if (scope === 'checkout') {
    secretKey = env.STRIPE_CHECKOUT_RESTRICTED_KEY || env.STRIPE_SECRET_KEY || secretKey;
  } else if (scope === 'read') {
    secretKey = env.STRIPE_READ_RESTRICTED_KEY || env.STRIPE_SECRET_KEY || secretKey;
  }

  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: "2024-06-20" as any
  });
}

export async function resolveToPriceId(
  stripe: Stripe,
  idOrSecret: string | undefined | null,
  targetInterval: 'month' | 'year'
): Promise<string | null> {
  if (!idOrSecret || typeof idOrSecret !== 'string') return null;
  const trimmed = idOrSecret.trim();
  if (!trimmed || trimmed.includes('mock') || trimmed.startsWith('pro_')) return null;

  // 1. If directly a Price ID (starts with "price_")
  if (trimmed.startsWith('price_')) {
    return trimmed;
  }

  // 2. If a Product ID (starts with "prod_")
  if (trimmed.startsWith('prod_')) {
    try {
      const prices = await stripe.prices.list({
        product: trimmed,
        active: true,
        type: 'recurring',
        limit: 50
      });

      if (prices.data.length > 0) {
        // Filter for matching interval
        const intervalMatches = prices.data.filter(p => p.recurring?.interval === targetInterval);
        
        if (intervalMatches.length > 0) {
          // Prefer exact price amount match ($49 = 4900 cents for monthly, $390 = 39000 cents for yearly)
          const targetAmount = targetInterval === 'month' ? 4900 : 39000;
          const exactAmountMatch = intervalMatches.find(p => p.unit_amount === targetAmount);
          if (exactAmountMatch) {
            return exactAmountMatch.id;
          }
          return intervalMatches[0].id;
        }

        // Fallback: Return any active recurring price on the product
        return prices.data[0].id;
      } else {
        // If no recurring price listed, check default_price on product
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
}

export async function handleCreateCheckoutSession(request: Request, env: any): Promise<Response> {
  const stripe = getStripeClient(env, 'checkout');
  const secretKey = env.STRIPE_CHECKOUT_RESTRICTED_KEY || 
                    env.STRIPE_SECRET_KEY || 
                    env.STRIPE_PROD_SECRET_KEY || 
                    env.STRIPE_SECRET || 
                    "";

  if (!secretKey || secretKey.trim() === '' || secretKey.includes('mock')) {
    return new Response(JSON.stringify({
      error: "Clave de Stripe no configurada",
      details: "No se encontró la variable STRIPE_SECRET_KEY en los secretos de Cloudflare.",
      missingVar: "STRIPE_SECRET_KEY"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    // 1. Authenticate user using Firebase ID Token
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!idToken) {
      return new Response(JSON.stringify({ error: "No autorizado. Token de autenticación ausente." }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const verifiedUid = await verifyFirebaseIdToken(env, idToken);
    if (!verifiedUid) {
      return new Response(JSON.stringify({ error: "Token de autenticación inválido o expirado." }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const { priceId, planType } = body;

    // 2. Fetch profile details from Firestore REST API to derive Stripe Customer ID and verified Email
    let projectId = "localflowpro-20e3d";
    const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
    if (credsStr) {
      try {
        const parsed = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
        if (parsed.project_id) projectId = parsed.project_id;
      } catch {}
    }

    let verifiedStripeCustomerId = "";
    let verifiedEmail = "";
    const profileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/profiles/${verifiedUid}`;
    const profileResp = await fetch(profileUrl);
    if (profileResp.ok) {
      const profileDoc = await profileResp.json() as any;
      const fields = profileDoc.fields || {};
      verifiedStripeCustomerId = fields.stripeCustomerId?.stringValue || "";
      verifiedEmail = fields.email?.stringValue || "";
    }

    const urlObj = new URL(request.url);
    const origin = urlObj.origin.includes("localhost") || urlObj.origin.includes("127.0.0.1")
      ? urlObj.origin
      : "https://bvelt.app";

    // 0) Handle Recovery Fee ($19 One-Time Payment Mode)
    if (planType === 'recovery_fee' || planType === 'recovery') {
      const recoveryPriceEnv = env.RECOVERY_FEE_PRICE_ID || 
                               env.STRIPE_RECOVERY_PRICE_ID || 
                               env.STRIPE_PRICE_ID_RECOVERY || 
                               env.STRIPE_PROD_PRICE_RECOVERY_FEE || 
                               env.STRIPE_PROD_RECOVERY_FEE || 
                               "";

      let recoveryLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

      if (recoveryPriceEnv && recoveryPriceEnv.trim().startsWith('price_')) {
        recoveryLineItems = [{ price: recoveryPriceEnv.trim(), quantity: 1 }];
      } else {
        // Dynamic one-time $19 line item (1900 cents USD)
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

      return new Response(JSON.stringify({
        sessionId: session.id,
        id: session.id,
        url: session.url,
        planType: 'recovery_fee',
        mode: 'payment'
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Env Variables Cascade for Monthly and Annual plans without relying on VITE_ in Worker
    const rawMonthly = env.STRIPE_PROD_PRICE_MONTHLY || 
                       env.STRIPE_PROD_MONTHLY || 
                       env.STRIPE_PRICE_ID_MONTHLY || 
                       env.STRIPE_PRICE_MONTHLY || 
                       env.STRIPE_PRICE_PROD_MONTHLY || 
                       env.STRIPE_PRICE_PRO_MONTHLY || 
                       env.VITE_STRIPE_PROD_MONTHLY || 
                       env.VITE_STRIPE_PRICE_PRO_MONTHLY ||
                       "prod_UzMT6pSMhvocc8";

    const rawYearly = env.STRIPE_PROD_PRICE_ANNUAL || 
                      env.STRIPE_PROD_ANNUAL || 
                      env.STRIPE_PRICE_ID_ANNUAL || 
                      env.STRIPE_PRICE_ANNUAL || 
                      env.STRIPE_PROD_PRICE_YEARLY || 
                      env.STRIPE_PROD_YEARLY || 
                      env.STRIPE_PRICE_PROD_ANNUAL || 
                      env.STRIPE_PRICE_PROD_YEARLY || 
                      env.STRIPE_PRICE_PRO_YEARLY || 
                      env.VITE_STRIPE_PROD_YEARLY || 
                      env.VITE_STRIPE_PROD_ANNUAL || 
                      env.VITE_STRIPE_PRICE_PRO_YEARLY ||
                      "prod_UzMTca4UZ2zlXr";

    // 1) Priority: body.planType determines targetInterval
    const isYearly = planType === 'yearly' || planType === 'annual' || priceId === 'price_mock_pro_yearly' || priceId === 'pro_yearly' || priceId === 'pro_annual';
    const normalizedPlanType = isYearly ? 'yearly' : 'monthly';
    const targetInterval: 'month' | 'year' = isYearly ? 'year' : 'month';

    const secretForPlan = isYearly ? rawYearly : rawMonthly;

    // 2) Resolve to price ID from plan config
    let selectedPriceId: string | null = await resolveToPriceId(stripe, secretForPlan, targetInterval);

    // If secret didn't resolve and body.priceId is a real Stripe ID (ignoring mock/empty), try body.priceId
    if (!selectedPriceId && priceId && typeof priceId === 'string' && !priceId.includes('mock') && !priceId.startsWith('pro_')) {
      selectedPriceId = await resolveToPriceId(stripe, priceId, targetInterval);
    }

    // 3) Dynamic product fallback search on Stripe account if still unresolved
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
          selectedPriceId = await resolveToPriceId(stripe, product.id, targetInterval);
        }
      } catch (searchErr) {
        console.warn("[Cloudflare Stripe] Dynamic product search failed:", searchErr);
      }
    }

    if (!selectedPriceId) {
      return new Response(JSON.stringify({
        error: "ID de Precio de Stripe no configurado",
        details: `No se pudo determinar una tarifa activa de Stripe para el plan ${normalizedPlanType}. Verifica la configuración en Cloudflare.`,
        missingVar: isYearly ? "STRIPE_PROD_PRICE_ANNUAL" : "STRIPE_PROD_PRICE_MONTHLY"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
      client_reference_id: verifiedUid,
      metadata: {
        userId: verifiedUid,
        planType: normalizedPlanType
      },
      subscription_data: {
        metadata: {
          userId: verifiedUid,
          planType: normalizedPlanType
        }
      }
    };

    if (verifiedStripeCustomerId) {
      sessionConfig.customer = verifiedStripeCustomerId;
    } else if (verifiedEmail) {
      sessionConfig.customer_email = verifiedEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(JSON.stringify({
      sessionId: session.id,
      id: session.id,
      url: session.url
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err: any) {
    console.error("[Cloudflare Stripe] Checkout Session error:", err);
    return new Response(JSON.stringify({
      error: "Error al crear la sesión de pago",
      details: err.message || String(err)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function handleVerifySession(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") || url.searchParams.get("sessionId");

  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
    console.warn("[Cloudflare Verify Session 400] Missing or empty session_id query parameter");
    return new Response(JSON.stringify({
      ok: false,
      error: "Missing session_id",
      details: "A valid session_id query parameter is required (e.g. /api/verify-session?session_id=cs_live_...)"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const secretKey = env.STRIPE_SECRET_KEY || 
                    env.STRIPE_READ_RESTRICTED_KEY ||
                    env.STRIPE_CHECKOUT_RESTRICTED_KEY || 
                    env.STRIPE_PROD_SECRET_KEY || 
                    env.STRIPE_SECRET || 
                    "";

  if (!secretKey || secretKey.trim() === '' || secretKey.includes('mock')) {
    console.error("[Cloudflare Verify Session 500] STRIPE_SECRET_KEY is not configured in worker environment");
    return new Response(JSON.stringify({ 
      ok: false,
      error: "Stripe configuration error",
      details: "STRIPE_SECRET_KEY is missing or invalid in Cloudflare Worker environment variables."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const stripe = getStripeClient(env, 'read');
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid = session.payment_status === 'paid' || 
                   session.payment_status === 'no_payment_required' || 
                   session.status === 'complete';

    if (isPaid && session.subscription) {
      const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id;
      let subscription: any = null;
      let interval = 'month';
      let currentPeriodEnd = Date.now() + 30 * 24 * 60 * 60 * 1000;

      if (subId) {
        try {
          subscription = await stripe.subscriptions.retrieve(subId) as any;
          const plan = subscription?.items?.data?.[0]?.plan;
          interval = plan?.interval || (subscription?.items?.data?.[0]?.price?.recurring?.interval) || 'month';
          if (subscription?.current_period_end) {
            currentPeriodEnd = subscription.current_period_end * 1000;
          }
        } catch (subErr: any) {
          console.warn(`[Cloudflare Verify Session] Subscription retrieve warning for ${subId}:`, subErr?.message);
        }
      }

      const billingCycle = interval === 'year' ? 'yearly' : 'monthly';
      const planName = billingCycle === 'yearly' ? 'pro_annual' : 'pro_monthly';
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id || "";
      const userId = session.client_reference_id || 
                     session.metadata?.userId || 
                     session.metadata?.uid || 
                     subscription?.metadata?.userId || 
                     subscription?.metadata?.uid || 
                     null;

      if (userId) {
        try {
          await updateFirestoreUserProfile(env, userId, {
            isPro: true,
            plan: planName,
            stripeCustomerId: stripeCustomerId || "",
            subscriptionStatus: subscription?.status || "active",
            hasUsedTrial: true
          });
          console.log(`[Cloudflare Verify Session] User ${userId} marked Pro (${planName}) in Firestore`);
        } catch (dbErr: any) {
          console.warn("[Cloudflare Verify Session] Non-fatal error updating Firestore profile:", dbErr?.message || dbErr);
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        status: subscription?.status || "active",
        isPro: true,
        trialDaysLeft: 0,
        currentPeriodEnd: currentPeriodEnd,
        billingCycle: billingCycle,
        plan: planName,
        customer_email: session.customer_details?.email || session.customer_email || "",
        stripeCustomerId: stripeCustomerId || "",
        subscriptionId: subId || "",
        userId: userId
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } else if (isPaid) {
      // One-time payment mode or completed session
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id || "";
      const userId = session.client_reference_id || 
                     session.metadata?.userId || 
                     session.metadata?.uid || 
                     null;

      const isRecoveryFee = session.metadata?.planType === 'recovery_fee' || Boolean(session.metadata?.opportunityId) || Boolean(url.searchParams.get("opportunityId"));
      const opportunityId = session.metadata?.opportunityId || url.searchParams.get("opportunityId") || "";

      if (isRecoveryFee) {
        const nowIso = new Date().toISOString();
        if (userId) {
          try {
            await updateFirestoreRecoveryFee(env, userId, opportunityId, {
              status: 'paid',
              paidAt: nowIso,
              fixedFee: 19,
              stripeSessionId: session.id,
              paymentMethod: 'stripe_card'
            });
            console.log(`[Cloudflare Verify Session] Recovery fee for opp "${opportunityId}" recorded paid in Firestore for user ${userId}`);
          } catch (recErr: any) {
            console.warn("[Cloudflare Verify Session] Non-fatal error recording recovery fee in Firestore:", recErr?.message);
          }
        }

        return new Response(JSON.stringify({
          ok: true,
          status: "paid",
          plan: "recovery_fee",
          opportunityId: opportunityId,
          feeAmount: 19,
          paidAt: nowIso,
          sessionId: session.id,
          customer_email: session.customer_details?.email || session.customer_email || "",
          stripeCustomerId: stripeCustomerId || "",
          userId: userId
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const isYearly = session.metadata?.planType === 'yearly';
      const planName = isYearly ? 'pro_annual' : 'pro_monthly';

      if (userId) {
        try {
          await updateFirestoreUserProfile(env, userId, {
            isPro: true,
            plan: planName,
            stripeCustomerId: stripeCustomerId || "",
            subscriptionStatus: "active",
            hasUsedTrial: true
          });
          console.log(`[Cloudflare Verify Session] User ${userId} marked Pro (${planName}) via one-time checkout in Firestore`);
        } catch (dbErr: any) {
          console.warn("[Cloudflare Verify Session] Non-fatal error updating Firestore profile:", dbErr?.message || dbErr);
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        status: "active",
        isPro: true,
        trialDaysLeft: 0,
        currentPeriodEnd: Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000,
        billingCycle: isYearly ? 'yearly' : 'monthly',
        plan: planName,
        customer_email: session.customer_details?.email || session.customer_email || "",
        stripeCustomerId: stripeCustomerId || "",
        userId: userId
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } else {
      // If the session is still open/processing in Stripe (e.g., immediate redirect before webhook)
      if (session.status === 'open' || session.payment_status === 'unpaid') {
        console.log(`[Cloudflare Verify Session] Session ${sessionId} is processing (status: ${session.status}, payment: ${session.payment_status})`);
        return new Response(JSON.stringify({
          ok: false,
          status: "processing",
          payment_status: session.payment_status,
          session_status: session.status,
          message: "Payment is still processing in Stripe"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      console.warn(`[Cloudflare Verify Session 400] Session ${sessionId} payment not completed: status=${session.status}, payment_status=${session.payment_status}`);
      return new Response(JSON.stringify({
        ok: false,
        error: "Payment not completed yet",
        status: "unpaid",
        details: `Session status is "${session.status}" and payment_status is "${session.payment_status}"`,
        payment_status: session.payment_status,
        session_status: session.status
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  } catch (err: any) {
    console.warn(`[Cloudflare Verify Session 400] Stripe session retrieve failed for "${sessionId}":`, err?.message || err);
    return new Response(JSON.stringify({
      ok: false,
      error: "Invalid session_id",
      details: err?.message || "Failed to retrieve session from Stripe"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function handleStripeWebhook(request: Request, env: any): Promise<Response> {
  const sig = request.headers.get("stripe-signature");
  const endpointSecret = env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await request.text();

  if (!endpointSecret) {
    console.error("[Cloudflare Stripe] STRIPE_WEBHOOK_SECRET is not configured (fail-closed).");
    return new Response(JSON.stringify({ error: "Webhook Error: STRIPE_WEBHOOK_SECRET not configured on server" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!sig) {
    console.error("[Cloudflare Stripe] Missing stripe-signature header (fail-closed).");
    return new Response(JSON.stringify({ error: "Webhook Error: Missing stripe-signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const stripe = getStripeClient(env, 'webhook');
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error("[Cloudflare Stripe] Signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: `Webhook Signature Verification Error: ${err.message}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Persistent Idempotency Check using Firestore atomic create-if-absent (documentId collision returns 409)
  const eventId = event.id;
  const claimResult = await claimStripeEvent(env, eventId, event.type);

  if (claimResult === 'COMPLETED_DUPLICATE' || claimResult === 'DUPLICATE') {
    console.log(`[Cloudflare Stripe] Duplicate webhook event ignored (idempotent): ${eventId} (${event.type})`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (claimResult === 'PROCESSING_ACTIVE') {
    console.log(`[Cloudflare Stripe] Webhook event ${eventId} is currently PROCESSING by another thread.`);
    return new Response(JSON.stringify({ error: "Conflict", message: "Event is already being processed" }), {
      status: 409,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (claimResult === 'FAILED_RECORD') {
    console.log(`[Cloudflare Stripe] Webhook event ${eventId} failed in a previous attempt.`);
    return new Response(JSON.stringify({ error: "Failed", message: "Event processing failed previously" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (claimResult === 'ERROR') {
    console.error(`[Cloudflare Stripe] Idempotency store error for event ${eventId}. Returning 500 for retry.`);
    return new Response(JSON.stringify({ error: "Idempotency store error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;
      const stripeCustomerId = session.customer as string;

      if (session.metadata?.planType === 'recovery_fee' || session.metadata?.opportunityId) {
        const opportunityId = session.metadata?.opportunityId || '';
        if (userId) {
          await updateFirestoreRecoveryFee(env, userId, opportunityId, {
            status: 'paid',
            paidAt: new Date().toISOString(),
            fixedFee: 19,
            stripeSessionId: session.id,
            paymentMethod: 'stripe_card'
          });
        }
      } else {
        const planType = session.metadata?.planType === 'yearly' || session.metadata?.planType === 'annual' ? 'pro_annual' : 'pro_monthly';

        if (userId) {
          await updateFirestoreUserProfile(env, userId, {
            isPro: true,
            plan: planType,
            stripeCustomerId: stripeCustomerId || "",
            subscriptionStatus: "active",
            hasUsedTrial: true
          });
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await updateFirestoreUserProfile(env, userId, {
          isPro: false,
          plan: 'free',
          stripeCustomerId: subscription.customer as string,
          subscriptionStatus: subscription.status
        });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const isPro = subscription.status === 'active' || subscription.status === 'trialing';
      if (userId) {
        await updateFirestoreUserProfile(env, userId, {
          isPro,
          plan: subscription.items?.data?.[0]?.plan?.interval === 'year' ? 'pro_annual' : 'pro_monthly',
          stripeCustomerId: subscription.customer as string,
          subscriptionStatus: subscription.status,
          hasUsedTrial: isPro ? true : undefined
        });
      }
    }

    // Mark event processing as completed
    await updateStripeEventStatus(env, eventId, 'COMPLETED');

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[Cloudflare Stripe] Webhook processing error:", err);
    await updateStripeEventStatus(env, eventId, 'FAILED').catch(() => {});
    return new Response(`Processing error: ${err.message}`, { status: 500 });
  }
}
