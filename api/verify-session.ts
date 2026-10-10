import { Request, Response } from "express";
import Stripe from "stripe";
import { getFirebaseAdminDB } from "./firebaseAdmin.ts";
import { notifyOwner } from "./ownerNotify.ts";

function getStripeSecretKey(): string {
  return process.env.STRIPE_READ_RESTRICTED_KEY ||
         process.env.STRIPE_SECRET_KEY || 
         process.env.STRIPE_S_RET_KEY || 
         process.env.STRIPE_PROD_SECRET_KEY || 
         process.env.STRIPE_SECRET || 
         '';
}

export async function verifySessionHandler(req: Request | any, res: Response | any) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  try {
    const sessionId = (req.query.session_id || req.query.sessionId) as string;
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      console.warn("[Stripe Verify 400] Missing or empty session_id query parameter");
      return res.status(400).json({ ok: false, error: "Missing session_id", details: "A valid session_id query parameter is required." });
    }

    const secretKey = getStripeSecretKey();
    if (!secretKey || secretKey.trim() === '' || secretKey.includes('mock')) {
      console.error("[Stripe Verify 500] STRIPE_SECRET_KEY is not configured on server.");
      return res.status(500).json({ ok: false, error: "Stripe configuration error", details: "STRIPE_SECRET_KEY is missing in server environment." });
    }

    const stripe = new Stripe(secretKey);
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (retrieveErr: any) {
      console.warn(`[Stripe Verify 400] Stripe session retrieve failed for "${sessionId}":`, retrieveErr?.message || retrieveErr);
      return res.status(400).json({ ok: false, error: "Invalid session_id", details: retrieveErr?.message || "Failed to retrieve session from Stripe" });
    }

    const isPaid = session.payment_status === 'paid' || 
                   session.payment_status === 'no_payment_required' || 
                   session.status === 'complete';

    if (isPaid && session.subscription) {
      const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id;
      if (!subId) {
        return res.status(400).json({ error: "Invalid subscription reference in session" });
      }
      const subscription = await stripe.subscriptions.retrieve(subId) as any;
      const plan = subscription.items?.data?.[0]?.plan;
      const interval = plan?.interval || (subscription.items?.data?.[0]?.price?.recurring?.interval);
      const billingCycle = interval === 'year' ? 'yearly' : 'monthly';
      const planName = billingCycle === 'yearly' ? 'pro_annual' : 'pro_monthly';
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id;
      const userId = session.client_reference_id || session.metadata?.userId || null;
      const isPro = subscription.status === 'active' || subscription.status === 'trialing';

      let trialDaysLeft = 0;
      if (subscription.status === 'trialing' && subscription.trial_end) {
        trialDaysLeft = Math.max(0, Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
      }

      if (userId && isPro) {
        try {
          const adminDb = getFirebaseAdminDB();
          if (adminDb) {
            const profileRef = adminDb.collection("profiles").doc(userId);
            const profileSnap = await profileRef.get();
            const profileData = profileSnap.data();

            const updateData: any = {
              isPro: true,
              plan: planName,
              stripeCustomerId: stripeCustomerId || "",
              subscriptionStatus: subscription.status,
              hasUsedTrial: subscription.status === 'trialing' ? true : undefined,
              currentPeriodEnd: subscription.current_period_end * 1000,
              updatedAt: new Date().toISOString()
            };

            if (profileData?.notifiedPaidSessionId !== session.id) {
              updateData.notifiedPaidSessionId = session.id;
              const customerEmail = session.customer_details?.email || session.customer_email || profileData?.email || userId;
              const amountDesc = session.amount_total ? (session.amount_total / 100).toFixed(2) + ' ' + (session.currency?.toUpperCase() || 'USD') : '$49.00 USD';
              const paidMsg = `✅ Bvelt PAGO\nEmail: ${customerEmail}\nPlan: ${planName}\nMonto: ${amountDesc}\nStripe Session: ${session.id}\nTime (UTC): ${new Date().toISOString()}`;
              notifyOwner(paidMsg).catch(() => {});
            }

            await profileRef.set(updateData, { merge: true });
            console.log(`[Stripe Verify] Server updated Firestore profile for user: ${userId}`);
          }
        } catch (dbErr) {
          console.warn("[Stripe Verify] Non-fatal error updating Firestore profile:", dbErr);
        }
      }
      
      return res.json({
        status: subscription.status,
        isPro: isPro,
        trialDaysLeft: trialDaysLeft,
        currentPeriodEnd: subscription.current_period_end * 1000,
        billingCycle: billingCycle,
        plan: planName,
        customer_email: session.customer_details?.email || session.customer_email,
        stripeCustomerId: stripeCustomerId || "",
        subscriptionId: subId,
        userId: userId
      });
    } else if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
      // One-time payment mode support
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id;
      const userId = session.client_reference_id || session.metadata?.userId || null;
      const isRecoveryFee = session.metadata?.planType === 'recovery_fee' || Boolean(session.metadata?.opportunityId) || Boolean(req.query.opportunityId);
      const opportunityId = (session.metadata?.opportunityId || req.query.opportunityId || "") as string;

      if (isRecoveryFee) {
        const nowIso = new Date().toISOString();
        if (userId) {
          try {
            const adminDb = getFirebaseAdminDB();
            if (adminDb) {
              const docId = `rec_${opportunityId || Date.now()}`;
              const recRef = adminDb.collection("recovery_fees").doc(docId);
              await recRef.set({
                id: docId,
                opportunityId: opportunityId || "",
                businessId: userId || "default_business",
                status: "paid",
                paidAt: nowIso,
                fixedFee: 19,
                stripeSessionId: session.id,
                paymentMethod: "stripe_card",
                updatedAt: nowIso
              }, { merge: true });
              console.log(`[Stripe Verify] Recovery fee for opp "${opportunityId}" recorded in Firestore for user ${userId}`);
            }
          } catch (recErr) {
            console.warn("[Stripe Verify] Error recording recovery fee in Firestore:", recErr);
          }
        }

        return res.json({
          ok: true,
          status: "paid",
          plan: "recovery_fee",
          opportunityId: opportunityId,
          feeAmount: 19,
          paidAt: nowIso,
          sessionId: session.id,
          customer_email: session.customer_details?.email || session.customer_email,
          stripeCustomerId: stripeCustomerId || "",
          userId: userId
        });
      }

      const planName = session.metadata?.planType === 'yearly' ? 'pro_annual' : 'pro_monthly';

      if (userId) {
        try {
          const adminDb = getFirebaseAdminDB();
          if (adminDb) {
            const profileRef = adminDb.collection("profiles").doc(userId);
            await profileRef.set({
              isPro: true,
              plan: planName,
              stripeCustomerId: stripeCustomerId || "",
              subscriptionStatus: "active",
              currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (dbErr) {
          console.warn("[Stripe Verify] Non-fatal error updating Firestore profile:", dbErr);
        }
      }

      return res.json({
        status: "active",
        isPro: true,
        trialDaysLeft: 0,
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        billingCycle: session.metadata?.planType === 'yearly' ? 'yearly' : 'monthly',
        plan: planName,
        customer_email: session.customer_details?.email || session.customer_email,
        stripeCustomerId: stripeCustomerId || "",
        userId: userId
      });
    } else {
      if (session.status === 'open' || session.payment_status === 'unpaid') {
        return res.json({
          status: "processing",
          payment_status: session.payment_status,
          session_status: session.status,
          message: "Payment is still processing in Stripe"
        });
      }

      return res.status(400).json({
        error: "Payment not completed yet",
        status: "unpaid",
        payment_status: session.payment_status,
        session_status: session.status
      });
    }
  } catch (err: any) {
    console.error("[Stripe Verify Error]:", err);
    return res.status(500).json({ error: "Internal Error", details: err.message });
  }
}

export default verifySessionHandler;
