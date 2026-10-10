/**
 * LOCAL DEV RUNTIME ONLY (Express + Vite Middleware)
 * 
 * CRÍTICO: Producción en https://bvelt.app se ejecuta exclusivamente sobre Cloudflare Workers
 * a través de `worker.ts` y sus módulos en `functions/lib/*` (ej. cloudflareUsdt.ts, cloudflareStripe.ts).
 * Este archivo `server.ts` NO se ejecuta en Cloudflare Workers ni en producción.
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { getFirebaseAdminApp, getFirebaseAdminDB, getFirebaseAdminAuth, resetFirebaseAdminDB, hasFirebaseAdminCredentials, FieldValue } from "./api/firebaseAdmin.ts";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { scanMapsHandler, sendWhatsAppMessage } from "./api/scan-maps.ts";
import { ACTIVE_MODELS, getGeminiClient, isProviderAvailable, setGroqCooldown, setGeminiCooldown, handleGroqHeaders, logAiTelemetry, callNodeAiText, TaskType } from "./api/ai-config.ts";
import { sendEmailHandler } from "./api/send-email.ts";
import { createCheckoutSessionHandler } from "./api/create-checkout-session.ts";
import { verifySessionHandler } from "./api/verify-session.ts";
import { createUsdtOrderHandler, verifyUsdtPaymentHandler, getUsdtOrderStatusHandler } from "./api/usdt-payment.ts";
import { notifyOwner } from "./api/ownerNotify.ts";
import { auditHandler } from "./api/audit.ts";
import { nicheBenchmarkHandler } from "./api/niche-benchmark.ts";
import { monthlySeoCronHandler, runMonthlySeoCronJob } from "./api/monthly-seo-cron.ts";
import { backfillAccountsHandler, runProAccountsBackfill } from "./api/backfill-pro-accounts.ts";
import { batchOutreachHandler } from "./api/batch-outreach.ts";
import { businessScanHandler } from "./api/business-scan.ts";
import { 
  getBusinessEvidenceHandler, 
  getBusinessHistoryHandler, 
  getBusinessConflictsHandler,
  postBusinessEvidenceHandler,
  postResolveConflictHandler
} from "./api/business-evidence.ts";
import { 
  aiVisibilityAuditHandler, 
  getAiVisibilityHandler 
} from "./api/ai-visibility.ts";
import {
  whatsAppWebhookGetHandler,
  whatsAppWebhookPostHandler,
  telegramWebhookPostHandler,
  messagingSendHandler
} from "./api/messaging.ts";
import { resolveGeocode, findLocalCompetitors, computeServiceAreaIsochrone } from "./api/geo-providers.ts";
import { createPlanUsageGuard, getPlanUsageStatusHandler } from "./api/planUsageGuard.ts";
import { jobFinderEngine } from "./src/services/jobFinderEngine.ts";
import Stripe from "stripe";
import * as Sentry from "@sentry/node";

dotenv.config();

const sentryDsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || "https://548ff0f8215c0f5f0e37f11febafe338@o4511861895331840.ingest.us.sentry.io/4511861918662656";

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 1.0,
  });
  console.log("[Sentry Node] Server Sentry initialized.");
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  if (sentryDsn) Sentry.captureException(reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  if (sentryDsn) Sentry.captureException(error);
});

// Firebase Admin Initialization via unified module with terminated-client protection
const getAdminDb = () => getFirebaseAdminDB();
const getAuth = () => getFirebaseAdminAuth();

const db: any = new Proxy({}, {
  get(_target, prop) {
    try {
      const instance = getFirebaseAdminDB();
      if (!instance) {
        // Safe degraded fallback when Firebase Admin is unauthenticated
        return (..._args: any[]) => ({
          get: async () => ({ exists: false, data: () => ({}), empty: true, docs: [] }),
          set: async () => {},
          doc: () => ({
            get: async () => ({ exists: false, data: () => ({}) }),
            set: async () => {}
          }),
          collection: () => ({
            get: async () => ({ exists: false, empty: true, docs: [] }),
            doc: () => ({
              get: async () => ({ exists: false, data: () => ({}) }),
              set: async () => {}
            })
          }),
          where: () => ({
            get: async () => ({ empty: true, docs: [] }),
            limit: () => ({
              get: async () => ({ empty: true, docs: [] })
            })
          })
        });
      }
      const value = (instance as any)[prop];
      if (typeof value === 'function') {
        return (...args: any[]) => {
          try {
            return value.apply(instance, args);
          } catch (callErr: any) {
            const errMsg = callErr?.message || String(callErr);
            if (errMsg.includes('terminated') || callErr?.code === 1) {
              console.warn('[Firebase Admin] Detected terminated Firestore client during call. Resetting and retrying once...');
              resetFirebaseAdminDB();
              const freshInstance = getFirebaseAdminDB();
              const freshValue = (freshInstance as any)[prop];
              if (typeof freshValue === 'function') {
                return freshValue.apply(freshInstance, args);
              }
            }
            throw callErr;
          }
        };
      }
      return value;
    } catch (proxyErr: any) {
      const errMsg = proxyErr?.message || String(proxyErr);
      if (errMsg.includes('terminated')) {
        console.warn('[Firebase Admin] Terminated client in get proxy. Resetting...');
        resetFirebaseAdminDB();
        const freshInstance = getFirebaseAdminDB();
        return (freshInstance as any)[prop];
      }
      throw proxyErr;
    }
  }
});

const adminFieldValue = FieldValue;

import cors from "cors";

// Log identity for debugging IAM
import { GoogleAuth } from 'google-auth-library';
async function logIdentity() {
  try {
    const auth = new GoogleAuth();
    const projectId = await auth.getProjectId();
    const client = await auth.getClient();
    console.log("--- Runtime Identity ---");
    console.log("Environment Project ID:", projectId);
    console.log("Forced Admin Project ID:", getFirebaseAdminApp()?.options?.projectId);
    if ((client as any).email) {
      console.log("Service Account Email:", (client as any).email);
    }
    console.log("------------------------");
  } catch (e) {
    console.log("Failed to log runtime identity:", e);
  }
}
logIdentity();

// Firestore Admin Write Test (available for debugging, not executed automatically on startup)
async function runFirestoreTest() {
  console.log("--- Firestore Admin Test ---");
  try {
    const testRef = await db.collection('test').add({
      timestamp: adminFieldValue.serverTimestamp(),
      message: "Prueba de conexión desde el backend",
      env: process.env.NODE_ENV || 'development'
    });
    console.log("✅ TEST EXITOSO: Documento escrito con ID:", testRef.id);
  } catch (error) {
    console.log("❌ TEST FALLIDO: Error escribiendo en Firestore:", error);
    if ((error as any).code === 7) {
      console.log("DETALLE: El error 7 (PERMISSION_DENIED) suele significar que la Service Account no tiene el rol 'Cloud Datastore User' en el proyecto destino.");
    }
  }
  console.log("----------------------------");
}
// runFirestoreTest() intentionally NOT called automatically on startup to avoid cluttering DB in production

import { checkHealthProviders } from "./api/healthProviders.ts";

const app = express();

// Health check endpoints
app.get(["/api/health", "/health"], (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health/providers", async (_req, res) => {
  try {
    const result = await checkHealthProviders(process.env);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "Health check failed" });
  }
});

app.use(cors({
  origin: [
    "https://bvelt.app",
    "https://www.bvelt.app",
    "http://localhost:3000",
    "http://localhost:5173",
    /\.us-east1\.run\.app$/ // Permitir subdominios de Cloud Run (desarrollo)
  ],
  credentials: true
}));
app.set('trust proxy', 1); // Secures rate limiting and host/protocol detection behind Cloud Run proxy
const PORT = process.env.NODE_ENV === "production" && process.env.PORT ? Number(process.env.PORT) : 3000;

// Extract key for rate limiting (Firebase Auth UID -> x-user-id -> IP normalized with ipKeyGenerator)
const getExpressRateLimitKey = (req: express.Request) => {
  const auth = req.headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    try {
      const parts = auth.substring(7).split('.');
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadBase64.padEnd(payloadBase64.length + (4 - (payloadBase64.length % 4)) % 4, '=');
        const payload = JSON.parse(atob(padded));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (uid) return `user:${uid}`;
      }
    } catch {}
  }
  const headerUid = req.headers['x-user-id'] as string;
  if (headerUid && headerUid.trim()) return `user:${headerUid.trim()}`;
  return ipKeyGenerator(req.ip || '127.0.0.1');
};

// BVELT P0-2 PLAN USAGE GUARDS & ANTI-ABUSE SHIELDS (Firestore Daily Counters & Tier Caps)
const scanUsageGuard = createPlanUsageGuard('scan');
const aiUsageGuard = createPlanUsageGuard('ai');
const outreachUsageGuard = createPlanUsageGuard('outreach');
const auditUsageGuard = createPlanUsageGuard('heavy_audit');

// 1) Scan Rate Limiter (Scan Maps, Business Scan, Audit): Trial 5/24h | Pro 60/24h
const scanRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: (req) => {
    const plan = (req.headers['x-user-plan'] as string) || (req.headers['x-subscription-status'] as string);
    const isPro = plan === 'pro' || plan === 'active';
    return isPro ? 60 : 5;
  },
  keyGenerator: getExpressRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    code: "LIMIT_REACHED",
    error: "quota",
    message: "Límite diario del plan de prueba. Mejora a Pro o vuelve mañana. / Daily limit reached for trial plan. Upgrade to Pro or come back tomorrow.",
    upgrade: true
  }
});

// 2) AI Generation Rate Limiter (/api/ai/*, analyze_message, lead-pitch): Trial 5/24h | Pro 250/24h
const aiRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: (req) => {
    const plan = (req.headers['x-user-plan'] as string) || (req.headers['x-subscription-status'] as string);
    const isPro = plan === 'pro' || plan === 'active';
    return isPro ? 250 : 5;
  },
  keyGenerator: getExpressRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    code: "LIMIT_REACHED",
    error: "quota",
    message: "Límite diario del plan de prueba. Mejora a Pro o vuelve mañana. / Daily limit reached for trial plan. Upgrade to Pro or come back tomorrow.",
    upgrade: true
  }
});

// 3) Heavy Tool Rate Limiter (Niche Benchmark, Spatial, Batch Outreach, AI Visibility Audit): Trial 3/24h | Pro 50/24h
const heavyToolRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: (req) => {
    const plan = (req.headers['x-user-plan'] as string) || (req.headers['x-subscription-status'] as string);
    const isPro = plan === 'pro' || plan === 'active';
    return isPro ? 50 : 3;
  },
  keyGenerator: getExpressRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    code: "LIMIT_REACHED",
    error: "quota",
    message: "Límite diario del plan de prueba. Mejora a Pro o vuelve mañana. / Daily limit reached for trial plan. Upgrade to Pro or come back tomorrow.",
    upgrade: true
  }
});

// Configuración de Google OAuth2
function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || 
         process.env.GOOGLE_C_ID || 
         process.env.GOOGLE_CLIENT_ID_PROD || 
         "";
}

function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || 
         process.env.GOOGLE_C_SECRET || 
         process.env.GOOGLE_C__SECRET || 
         process.env.GOOGLE_SECRET || 
         "";
}

const getRedirectUri = (req?: express.Request) => {
  const envRedirect = process.env.GOOGLE_REDIRECT_URI || 
                      process.env.GOOGLE_R_ECT_URI || 
                      process.env.GOOGLE_R__ECT_URI || 
                      process.env.GOOGLE_REDIRECT_URL;
  if (envRedirect) return envRedirect;

  // Base URL por defecto (prioridad producción)
  const defaultBaseUrl = process.env.APP_URL || "https://bvelt.app";
  
  if (req) {
    const forwardedHost = req.headers['x-forwarded-host'] as string;
    const host = forwardedHost || req.get('host') || "";
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    
    // Si estamos en localhost, usar el host dinámico (usualmente http)
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `${protocol}://${host}/api/auth/callback/google`;
    }
    
    // Si el host es bvelt.app, forzar HTTPS y el dominio limpio
    if (host.includes('bvelt.app')) {
      return `https://bvelt.app/api/auth/callback/google`;
    }

    // Si estamos en AI Studio (.run.app)
    if (host.includes('.run.app')) {
      return `https://${host}/api/auth/callback/google`;
    }
    
    // Por defecto para cualquier otro entorno de producción detectado
    const finalProtocol = host.includes('.run.app') || host.includes('bvelt.app') ? 'https' : protocol;
    return `${finalProtocol}://${host}/api/auth/callback/google`;
  }

  const baseUrl = defaultBaseUrl.endsWith('/') ? defaultBaseUrl.slice(0, -1) : defaultBaseUrl;
  return `${baseUrl}/api/auth/callback/google`;
};

const oauth2Client = new OAuth2Client(
  getGoogleClientId(),
  getGoogleClientSecret(),
  getRedirectUri()
);

let stripeClients: Record<string, Stripe> = {};
function getStripe(scope: 'webhook' | 'checkout' | 'read' = 'read'): Stripe {
  if (!stripeClients[scope]) {
    let key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_S_RET_KEY || process.env.STRIPE_PROD_SECRET_KEY || process.env.STRIPE_SECRET || 'sk_test_mock';
    
    // Scoped Restricted Keys (Principle of Least Privilege)
    if (scope === 'webhook' && process.env.STRIPE_WEBHOOK_RESTRICTED_KEY) {
      key = process.env.STRIPE_WEBHOOK_RESTRICTED_KEY;
    } else if (scope === 'checkout' && process.env.STRIPE_CHECKOUT_RESTRICTED_KEY) {
      key = process.env.STRIPE_CHECKOUT_RESTRICTED_KEY;
    } else if (scope === 'read' && process.env.STRIPE_READ_RESTRICTED_KEY) {
      key = process.env.STRIPE_READ_RESTRICTED_KEY;
    }
    
    stripeClients[scope] = new Stripe(key);
  }
  return stripeClients[scope];
}

async function claimStripeEventServer(eventId: string, eventType: string): Promise<'CLAIMED' | 'COMPLETED_DUPLICATE' | 'PROCESSING_ACTIVE' | 'FAILED_RECORD' | 'ERROR'> {
  const docRef = db.collection('stripe_events').doc(eventId);
  const nowIso = new Date().toISOString();
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        transaction.set(docRef, {
          eventId,
          eventType,
          status: 'PROCESSING',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        return 'CLAIMED';
      }
      
      const data = doc.data();
      const status = data?.status || 'PROCESSING';
      const updatedAt = data?.updatedAt || data?.createdAt || new Date(0).toISOString();
      
      if (status === 'COMPLETED') {
        return 'COMPLETED_DUPLICATE';
      }
      
      if (status === 'FAILED') {
        transaction.update(docRef, {
          status: 'PROCESSING',
          updatedAt: nowIso
        });
        return 'CLAIMED';
      }
      
      if (status === 'PROCESSING') {
        const ageMs = Date.now() - new Date(updatedAt).getTime();
        const STALE_LEASE_MS = 10 * 60 * 1000; // 10 minutes lease timeout
        if (ageMs > STALE_LEASE_MS) {
          transaction.update(docRef, {
            status: 'PROCESSING',
            updatedAt: nowIso
          });
          return 'CLAIMED';
        } else {
          return 'PROCESSING_ACTIVE';
        }
      }
      
      return 'ERROR';
    });
    
    return result;
  } catch (err: any) {
    console.error("[claimStripeEventServer] Transaction error:", err);
    return 'ERROR';
  }
}

async function updateStripeEventStatusServer(eventId: string, status: string): Promise<boolean> {
  try {
    await db.collection('stripe_events').doc(eventId).update({
      status,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error("[updateStripeEventStatusServer] Error updating status:", err);
    return false;
  }
}

// Stripe webhook endpoint (requires raw body, MUST be placed before express.json middleware)
app.post(["/api/stripe-webhook", "/stripe-webhook"], express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Security Check: If STRIPE_WEBHOOK_SECRET or signature header is missing, reject unauthenticated calls
  if (!endpointSecret) {
    console.warn("⚠️ Stripe Webhook rechazado: STRIPE_WEBHOOK_SECRET no configurado.");
    return res.status(403).json({
      error: "Stripe Webhook deshabilitado o sin STRIPE_WEBHOOK_SECRET configurado.",
      message: "El procesamiento automático via webhook está desactivado por seguridad."
    });
  }

  if (!sig) {
    console.warn("⚠️ Stripe Webhook rechazado: cabecera 'stripe-signature' ausente.");
    return res.status(400).json({
      error: "Firma stripe-signature ausente."
    });
  }

  const stripe = getStripe('webhook');
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error("⚠️ Firma de Stripe Webhook inválida:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency check AFTER signature is verified
  const eventId = event.id;
  const claimResult = await claimStripeEventServer(eventId, event.type);

  if (claimResult === 'COMPLETED_DUPLICATE') {
    console.log(`[Stripe Webhook] Duplicate webhook event ignored (idempotent): ${eventId} (${event.type})`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  if (claimResult === 'PROCESSING_ACTIVE') {
    console.log(`[Stripe Webhook] Webhook event ${eventId} is currently PROCESSING by another thread.`);
    return res.status(409).json({ error: "Conflict", message: "Event is already being processed" });
  }

  if (claimResult === 'FAILED_RECORD') {
    console.log(`[Stripe Webhook] Webhook event ${eventId} failed in a previous attempt.`);
    return res.status(500).json({ error: "Failed", message: "Event processing failed previously" });
  }

  if (claimResult === 'ERROR') {
    console.error(`[Stripe Webhook] Idempotency store error for event ${eventId}. Returning 500 for retry.`);
    return res.status(500).json({ error: "Idempotency store error" });
  }

  try {
    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const stripeCustomerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      let planType = 'pro_monthly';
      let subscriptionStatus = 'active';

      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          subscriptionStatus = sub.status;
          
          const item = sub.items.data[0];
          const priceId = item?.price?.id;
          const productId = typeof item?.price?.product === 'string'
            ? item?.price?.product
            : item?.price?.product?.id;
          const interval = item?.price?.recurring?.interval;

          const stripeYearlyPrice = process.env.STRIPE_PROD_PRICE_ANNUAL || 
                                   process.env.STRIPE_PRICE_PROD_ANNUAL || 
                                   process.env.STRIPE_PROD_ANNUAL || 
                                   process.env.STRIPE_PROD_PRICE_YEARLY || 
                                   process.env.STRIPE_PRICE_PROD_YEARLY || 
                                   process.env.STRIPE_PROD_YEARLY || 
                                   process.env.STRIPE_P_ANNUAL || 
                                   process.env.STRIPE_P__ANNUAL || 
                                   process.env.STRIPE_PRICE_ANNUAL || 
                                   process.env.STRIPE_PRICE_PRO_YEARLY || 
                                   process.env.VITE_STRIPE_PROD_PRICE_YEARLY || 
                                   process.env.VITE_STRIPE_PRICE_PROD_YEARLY || 
                                   process.env.VITE_STRIPE_PROD_YEARLY || 
                                   process.env.VITE_STRIPE_PROD_PRICE_ANNUAL || 
                                   process.env.VITE_STR__YEARLY || 
                                   process.env.VITE_STRIPE_PRICE_PRO_YEARLY;

          const matchesYearlyConfig = stripeYearlyPrice && (
            priceId === stripeYearlyPrice || 
            productId === stripeYearlyPrice
          );

          if (interval === 'year' || matchesYearlyConfig) {
            planType = 'pro_annual';
          } else {
            planType = 'pro_monthly';
          }
        } catch (e: any) {
          console.error("Error retrieving subscription from Stripe:", e.message);
        }
      }

      if (userId) {
        const profileRef = db.collection('profiles').doc(userId);
        const profileSnap = await profileRef.get();
        const profileData = profileSnap.data();

        const updateData: any = {
          isPro: true,
          plan: planType,
          stripeCustomerId: stripeCustomerId || "",
          subscriptionStatus: subscriptionStatus,
          updatedAt: new Date().toISOString()
        };

        if (profileData?.notifiedPaidSessionId !== session.id) {
          updateData.notifiedPaidSessionId = session.id;
          const paidMsg = `✅ Bvelt PAGO\nEmail: ${customerEmail || profileData?.email || userId}\nPlan: ${planType}\nStripe Session: ${session.id}\nTime (UTC): ${new Date().toISOString()}`;
          notifyOwner(paidMsg).catch(() => {});
        }

        await profileRef.set(updateData, { merge: true });
        console.log(`[Stripe Webhook] Successfully updated profile ${userId} to Pro plan via checkout.session.completed`);

        // Regla Anti-Fraude: Recompensa de 1 mes / $20 fee credit en 1er pago por cliente referido
        if (profileData?.referred_by && !profileData?.hasAwardedReferralReward) {
          try {
            const customerKey = stripeCustomerId || userId;
            const rewardRef = db.collection('referral_rewards').doc(`reward_${customerKey}`);
            const rewardSnap = await rewardRef.get();
            if (!rewardSnap.exists) {
              await rewardRef.set({
                referredUserId: userId,
                referredCustomerId: customerKey,
                referrerCode: String(profileData.referred_by).toUpperCase(),
                rewardType: 'one_month_free',
                rewardValue: 1,
                paymentType: 'stripe_subscription',
                awardedAt: new Date().toISOString()
              });
              await profileRef.update({
                hasAwardedReferralReward: true,
                referralRewardDate: new Date().toISOString()
              });
              console.log(`[Referral Reward] Awarded 1 month free to referrer ${profileData.referred_by} for referred customer ${customerKey}`);
            }
          } catch (refErr) {
            console.warn('[Referral Reward] Error granting referral credit:', refErr);
          }
        }
      } else {
        console.warn(`[Stripe Webhook] No userId found for session ${session.id}`);
      }
    } 
    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      const subscriptionStatus = subscription.status;

      const profilesRef = db.collection('profiles');
      const snapshot = await profilesRef.where('stripeCustomerId', '==', stripeCustomerId).get();

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          await doc.ref.update({
            isPro: false,
            subscriptionStatus: subscriptionStatus,
            updatedAt: new Date().toISOString()
          });
          console.log(`[Stripe Webhook] Cancelled Pro status for customer: ${stripeCustomerId}`);
        }
      } else {
        console.log(`[Stripe Webhook] No profile found with stripeCustomerId: ${stripeCustomerId} for deletion`);
      }
    } 
    else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      const subscriptionStatus = subscription.status;
      const isPro = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

      const profilesRef = db.collection('profiles');
      const snapshot = await profilesRef.where('stripeCustomerId', '==', stripeCustomerId).get();

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          await doc.ref.update({
            isPro: isPro,
            subscriptionStatus: subscriptionStatus,
            updatedAt: new Date().toISOString()
          });
          console.log(`[Stripe Webhook] Updated subscription for customer ${stripeCustomerId} to ${subscriptionStatus} (isPro: ${isPro})`);
        }
      }
    }
    else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeCustomerId = invoice.customer as string;
      if (stripeCustomerId) {
        const snapshot = await db.collection('profiles').where('stripeCustomerId', '==', stripeCustomerId).get();
        if (!snapshot.empty) {
          for (const doc of snapshot.docs) {
            await doc.ref.update({
              isPro: true,
              subscriptionStatus: 'active',
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    }
    else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeCustomerId = invoice.customer as string;
      const customerEmail = invoice.customer_email || invoice.customer_name || "Desconocido";
      if (stripeCustomerId) {
        const snapshot = await db.collection('profiles').where('stripeCustomerId', '==', stripeCustomerId).get();
        if (!snapshot.empty) {
          for (const doc of snapshot.docs) {
            await doc.ref.update({
              subscriptionStatus: 'past_due',
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      const failMsg = `❌ Bvelt PAGO FALLIDO\nCliente: ${customerEmail} (ID: ${stripeCustomerId})\nTime (UTC): ${new Date().toISOString()}`;
      notifyOwner(failMsg).catch(() => {});
    }

    // Mark event processing as completed
    await updateStripeEventStatusServer(eventId, 'COMPLETED');

    return res.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook] Handler Error:", error?.message || error);
    await updateStripeEventStatusServer(eventId, 'FAILED').catch(() => {});
    return res.status(500).json({ error: error?.message || "Webhook processing error" });
  }
});

app.use(express.json({ limit: "50mb" }));

// Lazy Gemini proxy
const ai: any = new Proxy({}, {
  get(_target, prop) {
    const client = getGeminiClient() || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key_for_proxy" });
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  }
});

// API Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/server-time", (req, res) => {
  res.json({ time: Date.now() });
});

// Machine-Readable BEM Evidence API (Block 2)
app.get(["/api/business/:id/evidence", "/api/verify/:id"], (req, res) => getBusinessEvidenceHandler(req, res, db));
app.get("/api/business/:id/history", (req, res) => getBusinessHistoryHandler(req, res, db));
app.get("/api/business/:id/conflicts", (req, res) => getBusinessConflictsHandler(req, res, db));
app.post("/api/business/evidence", (req, res) => postBusinessEvidenceHandler(req, res, db));
app.post("/api/business/resolve-conflict", (req, res) => postResolveConflictHandler(req, res, db));

// AI Visibility / Local AI Presence Audit API (Block 5)
app.post(["/api/ai-visibility/audit", "/ai-visibility/audit"], auditUsageGuard, heavyToolRateLimiter, (req, res) => aiVisibilityAuditHandler(req, res, db));
app.get(["/api/ai-visibility/:entityId", "/ai-visibility/:entityId"], (req, res) => getAiVisibilityHandler(req, res, db));

// Automated Batch Outreach Route (Protected via x-cron-secret)
app.post(["/api/batch-outreach", "/batch-outreach"], outreachUsageGuard, heavyToolRateLimiter, batchOutreachHandler);

// Monthly SEO Report Cron Route
app.get(["/api/monthly-seo-cron", "/monthly-seo-cron"], monthlySeoCronHandler);
app.post(["/api/monthly-seo-cron", "/monthly-seo-cron"], monthlySeoCronHandler);

// Admin Account Backfill & Test Isolation Route
app.get(["/api/admin/backfill-accounts", "/admin/backfill-accounts"], backfillAccountsHandler);
app.post(["/api/admin/backfill-accounts", "/admin/backfill-accounts"], backfillAccountsHandler);

// Optional WhatsApp Cloud API Integration
app.post(["/api/send-whatsapp", "/send-whatsapp"], outreachUsageGuard, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body || {};
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: "Faltan parámetros obligatorios: 'phoneNumber' y 'message'." });
    }
    const result = await sendWhatsAppMessage(phoneNumber, message);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Error al procesar el envío por WhatsApp." });
  }
});

// Overpass API Proxy with Multi-Mirror Fallback (Local Dev Runtime)
app.post(["/api/overpass-proxy", "/overpass-proxy"], async (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ ok: false, error: "Query inválida", elements: [], diagnostics: [] });
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];

  interface MirrorDiagnostic {
    mirror: string;
    status: number | string;
    ms: number;
    remark?: string | null;
  }
  const diagnostics: MirrorDiagnostic[] = [];

  const globalController = new AbortController();
  const globalTimeout = setTimeout(() => globalController.abort(), 25000);

  for (const endpoint of endpoints) {
    if (globalController.signal.aborted) {
      break;
    }
    const startMs = Date.now();
    let status: number | string = "error";
    let remark: string | null = null;

    try {
      const mirrorSignal = AbortSignal.timeout(6000);
      const combinedSignal = AbortSignal.any([globalController.signal, mirrorSignal]);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "BveltRadarBot/2.0 (https://bvelt.com; info@bvelt.com)"
        },
        body: `data=${encodeURIComponent(query.trim())}`,
        signal: combinedSignal
      });

      const elapsed = Date.now() - startMs;
      status = response.status;

      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        const data = await response.json() as any;
        const respRemark = typeof data?.remark === "string" ? data.remark : null;

        if (respRemark || !Array.isArray(data?.elements)) {
          remark = respRemark || "Sin array elements";
          diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark });
          console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
          continue;
        }

        diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark: null });
        console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
        clearTimeout(globalTimeout);
        return res.status(200).json({ ok: true, elements: data.elements, diagnostics });
      } else {
        remark = !response.ok ? `HTTP ${response.status}` : `Content-Type: ${contentType}`;
        diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark });
        console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
      }
    } catch (err: any) {
      const elapsed = Date.now() - startMs;
      status = err?.name === "TimeoutError" ? "timeout" : (err?.name === "AbortError" ? "timeout" : "error");
      remark = err?.message || String(err);
      diagnostics.push({ mirror: endpoint, status, ms: elapsed, remark });
      console.log(`[Overpass Proxy] mirror: ${endpoint}, status: ${status}, ms: ${elapsed}`);
    }
  }

  clearTimeout(globalTimeout);

  const hasQuota = diagnostics.some(d => d.status === 429 || String(d.remark).includes('quota') || String(d.remark).includes('rate limit'));
  const allTimeout = diagnostics.length > 0 && diagnostics.every(d => d.status === 'timeout' || d.status === 504 || d.status === 408 || String(d.remark).includes('timed out'));
  const degradedReason = hasQuota ? 'quota' : ((allTimeout || globalController.signal.aborted) ? 'timeout' : 'provider');

  return res.status(200).json({
    ok: false,
    elements: [],
    reason: degradedReason,
    error: "Overpass API unavailable",
    diagnostics
  });
});

// Canonical Messaging & Webhooks
app.get(["/api/webhooks/whatsapp", "/webhooks/whatsapp"], whatsAppWebhookGetHandler);
app.post(["/api/webhooks/whatsapp", "/webhooks/whatsapp"], whatsAppWebhookPostHandler);
app.post(["/api/webhooks/telegram", "/webhooks/telegram"], telegramWebhookPostHandler);
app.post("/api/messaging/send", outreachUsageGuard, messagingSendHandler);

// Opportunities Search Endpoint for Public Landing Page Hero
app.get(["/api/opportunities", "/opportunities"], async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const trade = (req.query.trade as string || "").trim();
  const zip = (req.query.zip as string || "").trim();

  try {
    if (!trade || !zip) {
      return res.json({ success: true, trade, zip, opportunities: [] });
    }

    const geo = await resolveGeocode(`${zip}, USA`);
    if (!geo || !geo.lat || !geo.lng) {
      return res.json({
        success: true,
        trade,
        zip,
        opportunities: [],
        errors: ["Could not resolve coordinates for zip code"]
      });
    }

    const city = geo.city || "Miami";
    const result = await jobFinderEngine.getOpportunities({
      trade,
      city,
      lat: geo.lat,
      lng: geo.lng,
      radiusMi: 15,
      sinceDays: 30
    });

    return res.json({
      success: true,
      trade,
      zip,
      opportunities: result.opportunities,
      sourcesUsed: result.sourcesUsed,
      errors: result.errors
    });
  } catch (err: any) {
    console.error("[Opportunities] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch opportunities" });
  }
});

// Endpoint seguro en el servidor para la activación de la prueba de 7 días (Pro Trial)
app.post("/api/activate-trial", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado. Token de autenticación ausente." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const auth = getAuth();
    if (!auth) {
      return res.status(503).json({
        error: "Servicio de autenticación no disponible temporalmente en el servidor.",
        code: "ADMIN_AUTH_UNAVAILABLE"
      });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (authErr) {
      console.error("[activate-trial] Error verificando ID Token de Firebase:", authErr);
      return res.status(401).json({ error: "Token de autenticación inválido o expirado." });
    }

    const uid = decodedToken.uid;
    const profileRef = getAdminDb().collection("profiles").doc(uid);

    const result = await getAdminDb().runTransaction(async (transaction) => {
      const profileSnap = await transaction.get(profileRef);
      let alreadyNotified = false;
      if (profileSnap.exists) {
        const data = profileSnap.data();
        if (data && data.hasUsedTrial) {
          return { success: false, error: "Ya has utilizado tu período de prueba de 7 días.", code: 400 };
        }
        if (data && data.notifiedTrialAt) {
          alreadyNotified = true;
        }
      }

      const updatePayload: any = {
        isPro: true,
        plan: "trial",
        subscriptionStatus: "trialing",
        hasUsedTrial: true,
        trialStartDate: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp()
      };

      if (!alreadyNotified) {
        updatePayload.notifiedTrialAt = new Date().toISOString();
      }

      transaction.set(profileRef, updatePayload, { merge: true });

      return { success: true, shouldNotify: !alreadyNotified };
    });

    if (!result.success) {
      return res.status(result.code || 400).json({ error: result.error });
    }

    if (result.shouldNotify) {
      const userEmail = decodedToken.email || uid;
      const trialMsg = `🟡 Bvelt TRIAL 7 días\nEmail/UID: ${userEmail}\nPlan: trial (7 días)\nTime (UTC): ${new Date().toISOString()}`;
      notifyOwner(trialMsg).catch(() => {});
    }

    return res.json({ success: true, message: "Prueba Pro activada con éxito." });
  } catch (err: any) {
    console.error("[activate-trial] Error interno en servidor:", err);
    return res.status(500).json({ error: "Error interno del servidor al activar la prueba Pro." });
  }
});

// Endpoint seguro para guardar y completar el Onboarding del negocio con validación estricta de email
app.post(["/api/profile/save-onboarding", "/api/profile/onboarding"], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado. Token de autenticación ausente." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const auth = getAuth();
    if (!auth) {
      return res.status(503).json({
        error: "Servicio de autenticación no disponible temporalmente en el servidor.",
        code: "ADMIN_AUTH_UNAVAILABLE"
      });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (authErr) {
      console.error("[save-onboarding] Error verificando ID Token de Firebase:", authErr);
      return res.status(401).json({ error: "Token de autenticación inválido o expirado." });
    }

    const uid = decodedToken.uid;
    const {
      businessName,
      name,
      category,
      niche,
      subNiche,
      address,
      city,
      state,
      country,
      phone,
      email,
      gmbLink,
      lat,
      lng,
      marketRadius
    } = req.body || {};

    const cleanEmail = (typeof email === 'string' ? email : (decodedToken.email || '')).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        error: "El correo electrónico es obligatorio para completar el onboarding de Bvelt.",
        field: "email"
      });
    }

    const finalName = (businessName || name || "").trim();
    if (!finalName) {
      return res.status(400).json({
        error: "El nombre del negocio es obligatorio.",
        field: "name"
      });
    }

    const finalCategory = (category || niche || "servicios_locales").trim();
    const finalCity = (city || "").trim();
    const finalLocation = address ? `${address}, ${finalCity}`.trim() : finalCity;

    const profileData: Record<string, any> = {
      name: finalName,
      category: finalCategory,
      niche: finalCategory,
      location: finalLocation || finalCity || "Local",
      email: cleanEmail,
      isOnboarded: true,
      onboardingCompletedAt: new Date().toISOString(),
      onboardingStep: 3,
      updatedAt: adminFieldValue.serverTimestamp()
    };

    if (subNiche) profileData.subNiche = String(subNiche).trim();
    if (address) profileData.address = String(address).trim();
    if (city) profileData.city = String(city).trim();
    if (state) profileData.state = String(state).trim();
    if (country) profileData.country = String(country).trim().toUpperCase();
    if (phone) profileData.phone = String(phone).trim();
    if (gmbLink) profileData.gmbLink = String(gmbLink).trim();
    if (typeof lat === 'number' && !isNaN(lat)) profileData.lat = lat;
    if (typeof lng === 'number' && !isNaN(lng)) profileData.lng = lng;
    if (typeof marketRadius === 'number' && !isNaN(marketRadius)) profileData.marketRadius = marketRadius;

    const profileRef = getAdminDb().collection("profiles").doc(uid);
    await profileRef.set(profileData, { merge: true });

    // Preparación punto de integración Business DNA (Fase 2.11)
    try {
      const dnaRef = getAdminDb().collection("user_behavior_profile").doc(uid);
      await dnaRef.set({
        uid,
        onboardingCompleted: true,
        completedAt: adminFieldValue.serverTimestamp(),
        initialCategory: finalCategory,
        initialCity: finalCity || null,
        lastInteractionAt: adminFieldValue.serverTimestamp()
      }, { merge: true });
    } catch (dnaErr) {
      console.warn("[save-onboarding] Non-blocking Business DNA init log:", dnaErr);
    }

    return res.json({
      success: true,
      message: "Perfil del negocio configurado con éxito.",
      profile: {
        ...profileData,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error("[save-onboarding] Error guardando onboarding:", err);
    return res.status(500).json({ error: err.message || "Error interno al guardar onboarding." });
  }
});

// Serve Service Worker with no-cache headers and correct mime type
app.get("/sw.js", (req, res) => {
  const filePath = process.env.NODE_ENV === "production" 
    ? path.join(process.cwd(), "dist", "sw.js")
    : path.join(process.cwd(), "public", "sw.js");

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(filePath, (err) => {
    if (err) {
      console.log("Error sending sw.js:", err);
      if (!res.headersSent) {
        res.status(404).send("Not found");
      }
    }
  });
});

// Serve Web Manifest with no-cache headers and correct mime type
app.get("/manifest.json", (req, res) => {
  const filePath = process.env.NODE_ENV === "production" 
    ? path.join(process.cwd(), "dist", "manifest.json")
    : path.join(process.cwd(), "public", "manifest.json");

  res.setHeader("Content-Type", "application/manifest+json");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(filePath, (err) => {
    if (err) {
      console.log("Error sending manifest.json:", err);
      if (!res.headersSent) {
        res.status(404).send("Not found");
      }
    }
  });
});

// Serve Icons with no-cache/CORS
const iconFiles = [
  "bvelt-icon-192.png",
  "bvelt-icon-512.png",
  "bvelt-icon-maskable-192.png",
  "bvelt-icon-maskable-512.png",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "apple-touch-icon-precomposed.png",
  "favicon.png",
  "favicon.ico"
];

iconFiles.forEach((file) => {
  app.get(`/${file}`, (req, res) => {
    const filePath = process.env.NODE_ENV === "production" 
      ? path.join(process.cwd(), "dist", file)
      : path.join(process.cwd(), "public", file);

    const isIco = file.endsWith(".ico");
    res.setHeader("Content-Type", isIco ? "image/x-icon" : "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(filePath, (err) => {
      if (err) {
        console.log(`Error sending ${file}:`, err);
        if (!res.headersSent) {
          res.status(404).send("Not found");
        }
      }
    });
  });
});

// Proxy geolocation endpoint to avoid client CORS blocks and handle client IP correctly with fail-safe fallbacks
app.get(["/api/geolocalizar", "/geolocalizar"], async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  let clientIp = "";
  try {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      clientIp = (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim();
    } else {
      clientIp = req.socket.remoteAddress || "";
    }

    if (clientIp === "::1" || clientIp === "127.0.0.1" || clientIp.startsWith("fe80") || clientIp.startsWith("10.") || clientIp.startsWith("192.168.")) {
      clientIp = "";
    }

    // 1. Try freeipapi.com as primary (generous limit, SSL support, reliable)
    try {
      const primaryUrl = clientIp ? `https://freeipapi.com/api/json/${clientIp}` : "https://freeipapi.com/api/json/";
      const primaryResponse = await fetch(primaryUrl);
      if (primaryResponse.ok) {
        const data = await primaryResponse.json() as { cityName?: string, regionName?: string, latitude?: number, longitude?: number, countryName?: string, zipCode?: string, ipAddress?: string };
        if (data && data.cityName) {
          const mappedData = {
            city: data.cityName,
            region: data.regionName || data.cityName,
            latitude: data.latitude,
            longitude: data.longitude,
            country_name: data.countryName,
            postal: data.zipCode || "",
            ip: data.ipAddress || clientIp || "127.0.0.1"
          };
          console.log("[Geolocalizar] freeipapi.com succeeded:", mappedData.city);
          return res.status(200).json(mappedData);
        }
      }
    } catch (err: any) {
      console.log("[Geolocalizar] Primary freeipapi.com failed, trying ipwho.is. Error:", err.message);
    }

    // 2. Try ipwho.is as second option (fast, secure, free tier up to 7.5k/day)
    try {
      const fallbackUrl = clientIp ? `https://ipwho.is/${clientIp}` : "https://ipwho.is/";
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json() as { success?: boolean, city?: string, region?: string, latitude?: number, longitude?: number, country?: string, postal?: string, ip?: string };
        if (data && data.success) {
          const mappedData = {
            city: data.city || "Madrid",
            region: data.region || "Madrid",
            latitude: data.latitude || 40.4168,
            longitude: data.longitude || -3.7038,
            country_name: data.country || "Spain",
            postal: data.postal || "",
            ip: data.ip || clientIp || "127.0.0.1"
          };
          console.log("[Geolocalizar] Fallback ipwho.is succeeded:", mappedData.city);
          return res.status(200).json(mappedData);
        }
      }
    } catch (err: any) {
      console.log("[Geolocalizar] Fallback ipwho.is failed, trying ipapi.co. Error:", err.message);
    }

    // 3. Try ipapi.co as third option
    try {
      const thirdUrl = clientIp ? `https://ipapi.co/${clientIp}/json/` : "https://ipapi.co/json/";
      const userAgent = req.headers["user-agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      const thirdResponse = await fetch(thirdUrl, {
        headers: {
          "User-Agent": userAgent
        }
      });
      if (thirdResponse.ok) {
        const data = await thirdResponse.json() as { error?: any, city?: string, region?: string, latitude?: number, longitude?: number, country_name?: string, postal?: string, ip?: string };
        if (data && !data.error) {
          const mappedData = {
            city: data.city || "Madrid",
            region: data.region || "Madrid",
            latitude: data.latitude || 40.4168,
            longitude: data.longitude || -3.7038,
            country_name: data.country_name || "Spain",
            postal: data.postal || "",
            ip: data.ip || clientIp || "127.0.0.1"
          };
          console.log("[Geolocalizar] Fallback ipapi.co succeeded:", mappedData.city);
          return res.status(200).json(mappedData);
        }
      }
    } catch (err: any) {
      console.log("[Geolocalizar] Fallback ipapi.co failed. Error:", err.message);
    }

    // Default safe fallback if everything fails
    console.log("[Geolocalizar] All geolocation providers failed. Serving generic safe fallback.");
    return res.status(200).json({
      city: "Naples",
      region: "Florida",
      latitude: 26.1420,
      longitude: -81.7948,
      country_name: "USA",
      postal: "34101",
      ip: clientIp || "127.0.0.1"
    });
  } catch (globalError: any) {
    console.log("[Geolocalizar] Global error in handler:", globalError.message);
    return res.status(200).json({
      city: "Naples",
      region: "Florida",
      latitude: 26.1420,
      longitude: -81.7948,
      country_name: "USA",
      postal: "34101",
      ip: clientIp || "127.0.0.1"
    });
  }
});

app.get("/api/niche-benchmark", auditUsageGuard, heavyToolRateLimiter, nicheBenchmarkHandler);

// Proxy Nominatim endpoint to avoid CORS issues and User-Agent blocking on browser clients
// Features upstream 1 req/sec throttle and in-memory TTL caching (24h) to strictly comply with OSM policies.
const nominatimCache = new Map<string, { data: any; expiresAt: number }>();
let lastNominatimRequestTime = 0;

app.get(["/api/nominatim", "/nominatim"], scanUsageGuard, async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const { endpoint = "search", ...queryParams } = req.query;
    const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
    const cacheKey = `${endpoint}?${queryString}`;
    const now = Date.now();

    // Check in-memory cache first
    const cached = nominatimCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.json(cached.data);
    }

    // Upstream throttle: ensure at least 1000ms between external upstream calls
    const timeSinceLast = now - lastNominatimRequestTime;
    if (timeSinceLast < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
    }
    lastNominatimRequestTime = Date.now();

    const targetUrl = `https://nominatim.openstreetmap.org/${endpoint}?${queryString}`;

    let nomData: any = null;
    let nomSuccess = false;

    try {
      const nomRes = await fetch(targetUrl, {
        signal: AbortSignal.timeout(5000),
        headers: {
          "User-Agent": "BveltAppLocalRadar/1.0 (contact: rainerblanco405@gmail.com)",
          "Accept-Language": "es,en;q=0.9",
          "Accept": "application/json"
        }
      });

      if (nomRes.ok) {
        const contentType = nomRes.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          nomData = await nomRes.json();
          nomSuccess = true;
        }
      }
    } catch (nomErr: any) {
      console.warn("[Nominatim Proxy] Upstream query error:", nomErr.message || nomErr);
    }

    // Optional cascade: if Nominatim fails and GEOAPIFY_API_KEY is present, try Geoapify once
    if (!nomSuccess && process.env.GEOAPIFY_API_KEY) {
      try {
        const geoapifyKey = process.env.GEOAPIFY_API_KEY;
        if (endpoint === "reverse" && queryParams.lat && queryParams.lon) {
          const geoUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${queryParams.lat}&lon=${queryParams.lon}&apiKey=${geoapifyKey}`;
          const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
          if (geoRes.ok) {
            const geoJson = await geoRes.json() as any;
            const feature = geoJson?.features?.[0]?.properties;
            if (feature) {
              nomData = {
                display_name: feature.formatted || feature.name || "Ubicación detectada",
                address: {
                  city: feature.city || feature.municipality || feature.county || "",
                  state: feature.state || feature.state_code || "",
                  country: feature.country || "",
                  postcode: feature.postcode || ""
                }
              };
              nomSuccess = true;
            }
          }
        } else if (endpoint === "search" && queryParams.q) {
          const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(String(queryParams.q))}&apiKey=${geoapifyKey}&limit=5`;
          const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
          if (geoRes.ok) {
            const geoJson = await geoRes.json() as any;
            if (Array.isArray(geoJson?.features) && geoJson.features.length > 0) {
              nomData = geoJson.features.map((f: any, idx: number) => ({
                place_id: f.properties.place_id || idx,
                lat: String(f.properties.lat),
                lon: String(f.properties.lon),
                display_name: f.properties.formatted || f.properties.name,
                name: f.properties.name || f.properties.city || ""
              }));
              nomSuccess = true;
            }
          }
        }
      } catch (geoErr: any) {
        console.warn("[Nominatim Proxy] Geoapify cascade error:", geoErr.message || geoErr);
      }
    }

    const finalData = nomSuccess ? nomData : (endpoint === "reverse" ? { address: { city: "Naples", state: "FL" } } : []);
    
    // Cache successful response for 24 hours (86,400,000 ms)
    // Limit cache size to prevent memory leaks (max 500 entries)
    if (nominatimCache.size > 500) {
      const oldestKey = nominatimCache.keys().next().value;
      if (oldestKey) nominatimCache.delete(oldestKey);
    }
    nominatimCache.set(cacheKey, { data: finalData, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });

    return res.json(finalData);
  } catch (error: any) {
    console.warn("[Nominatim Proxy] Error querying Nominatim:", error.message || error);
    return res.status(200).json([]);
  }
});

// Multi-provider Geocoding endpoint (LocationIQ -> OpenCage -> Geoapify -> ORS -> Nominatim)
app.get("/api/geocode", scanUsageGuard, scanRateLimiter, async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: "Missing query parameter 'q'" });
    }
    const point = await resolveGeocode(q);
    if (!point) {
      return res.status(404).json({ error: "Location not found" });
    }
    return res.json(point);
  } catch (err: any) {
    console.error("[Geocode API] Error:", err.message || err);
    return res.status(500).json({ error: "Geocoding resolution failed" });
  }
});

// Multi-provider Local Competitors & Places endpoint (Overpass -> Geoapify Places -> LocationIQ Nearby -> Radius Expansion)
app.get("/api/places", scanUsageGuard, scanRateLimiter, async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const niche = (req.query.niche as string) || "commercial";
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 5000;
    const exclude = (req.query.exclude as string) || "";

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Valid 'lat' and 'lng' parameters are required" });
    }

    const competitors = await findLocalCompetitors({
      niche,
      lat,
      lng,
      radiusMeters: radius,
      excludeName: exclude
    });

    return res.json({
      niche,
      center: { lat, lng },
      radiusMeters: radius,
      count: competitors.length,
      competitors
    });
  } catch (err: any) {
    console.error("[Places API] Error:", err.message || err);
    return res.status(500).json({ error: "Failed to fetch local places" });
  }
});

// OpenRouteService Isochrone & Service Area endpoint
app.get("/api/service-area", scanUsageGuard, scanRateLimiter, async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const rawIntervals = (req.query.intervals as string) || "15,30";
    const intervals = rawIntervals.split(",").map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x) && x > 0);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Valid 'lat' and 'lng' parameters are required" });
    }

    const result = await computeServiceAreaIsochrone({
      lat,
      lng,
      intervalsMinutes: intervals.length > 0 ? intervals : [15, 30]
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[ServiceArea API] Error:", err.message || err);
    return res.status(500).json({ error: "Failed to compute service area" });
  }
});

function getHumanizedSystemInstruction(baseInstruction: string, lang: "es" | "en" = "es"): string {
  const languageLabel = lang === "en" ? "English" : "Spanish";
  
  return `${baseInstruction || ""}

=========================================
CAPA DE ESTILO Y HUMANIZACIÓN OBLIGATORIA (HUMAN COMMUNICATION FILTER - LAYER 2):
=========================================
You are a highly skilled professional human business copywriter and local service specialist. Your absolute goal is to generate or rewrite this content so that it sounds 100% written by a real person (a friendly, highly professional local contractor/business owner) and NOT by an AI or bot.

[CAPA DE ESTILO - PROHIBICIÓN ABSOLUTA DE PALABRAS Y CLICHÉS DE IA / BANNED WORDS & PATTERNS]:
1. PROHIBICIÓN ESTRICTA Y ABSOLUTA DE PALABRAS: Queda estrictamente prohibido utilizar o mencionar palabras como "IA", "AI", "Agente", "Agent", "Bot", "Robot", "Asistente Virtual", "Virtual Assistant", "Neural", "Algoritmo", "Algorithm", "Modelo de Lenguaje", "Language Model", "Inteligencia Artificial" o "Artificial Intelligence" en cualquier respuesta, texto o propuesta para el usuario.
2. NEVER use typical AI boilerplate or transition words:
   - In Spanish, NEVER say: "En el dinámico mundo de hoy", "En resumen", "Es fundamental", "Explora estas opciones", "Como modelo de lenguaje", "Espero que esto te sirva", "estimado cliente", "espero que este mensaje te encuentre bien".
   - In English, NEVER say: "In today's fast-paced world", "In conclusion", "It is crucial to", "Dive into", "Furthermore", "Delve", "Hope this helps", "Dear client", "I hope this finds you well", "As an AI".
3. NEVER use rigid bulleted lists or dry summaries unless explicitly asked for. Continuous natural text sounds much more human.
4. NEVER repeat the same sentence structure or verbs in consecutive paragraphs.
5. NEVER reference algorithms, AI, robots, automated systems, GPT, or Gemini.

[STRICT LANGUAGE & TONE RULE]
1. Adaptive Language: Always respond entirely in ${languageLabel}. Even if the system instruction or user prompt contains another language, translate it dynamically to ${languageLabel} with a native, local flow.
2. Conversational & Empathetic: Adopt a conversational, helpful, professional, and close tone (as if a proud local business owner/contractor is talking directly to a homeowner, client, or a respected colleague).
3. Sentence Variance: Mix short, punchy statements with medium-length sentences. Avoid robotic, symmetric, or predictable sentence structures.
4. Natural Transitions & Pauses: Introduce natural conversational transitions (e.g. in Spanish: "mira,", "por cierto,", "la verdad es que..."; in English: "look,", "by the way,", "honestly,").
5. Simplicity: Use clear, direct, and straightforward vocabulary. Avoid theoretical, rigid, academic, or overly formal explanations.
6. Mobile Friendly: Keep paragraphs extremely short (maximum 2 to 3 lines per paragraph) for optimal readability on mobile screens.

[OUTPUT CRITERIO]
Before finalizing the response, ensure that it reads like a real, authentic, fast message typed from a mobile phone by an expert in the field who cares deeply about their work and clients. If the output format requires a specific JSON schema, output a valid JSON where the keys are exactly as requested, but all the generated human-facing strings (such as actions, strategies, comments) are written in ${languageLabel} with these rules applied.
`;
}

app.post("/api/ai/groq", aiUsageGuard, aiRateLimiter, async (req, res) => {
  try {
    const { prompt, systemInstruction, language = "es", response_format } = req.body;
    const humanizedInstruction = getHumanizedSystemInstruction(systemInstruction, language as "es" | "en");

    const aiResult = await callNodeAiText({
      taskType: "copy_short",
      prompt,
      systemInstruction: humanizedInstruction,
      jsonMode: response_format?.type === "json_object"
    });

    res.json({ text: aiResult.text, providerUsed: aiResult.providerUsed, modelUsed: aiResult.modelUsed });
  } catch (error: any) {
    console.log("AI Generation Error in Groq endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

// Agente Director de Ruta - Routing and Intent Director
app.post("/api/ai/router", aiUsageGuard, aiRateLimiter, async (req, res) => {
  try {
    const { prompt, language = "es" } = req.body;

    const routerSystemInstruction = `
You are the Bvelt Intent & Navigation Director.
Your task is to classify natural voice commands or user queries into one of the 7 core action intents, with optional radius in kilometers if scanning.

Canonical intents:
- 'leads': If the user talks about CRM, leads, prospective clients, inbox, messages, uncontacted leads, contacting customers (e.g. "ver clientes", "abrir crm", "contestar leads", "mensajes pendientes").
- 'scan': If the user mentions scanning, radar, competitor search, local audit, market research, or radius search (e.g. "haz un escaneo", "quién está ganando en maps", "analizar competencia", "radar a 10 km", "escanea a 25 km"). If a distance or radius in kilometers is mentioned, extract it into 'radiusKm' (e.g. 5, 10, 25).
- 'profile': If the user mentions business profile, company info, address, phone number, category, hours (e.g. "mi perfil", "cambiar teléfono", "datos de negocio", "horario").
- 'reviews': If the user mentions Google reviews, customer opinions, review QR code, reputation, star ratings (e.g. "ver reseñas", "pedir opiniones", "código qr de reseñas", "reputación").
- 'quote': If the user mentions pricing, estimates, quotes, reference pricing, calculating costs, how much to charge (e.g. "estimar precio", "cuánto cobrar", "cotización", "tarifas de referencia").
- 'plans': If the user mentions subscription plans, upgrading to Pro, pricing tiers, daily scan limits, quota (e.g. "ver planes", "subir a pro", "precios", "límites de cuenta").
- 'website': If the user mentions business website, landing page, public page, web builder (e.g. "mi sitio web", "página del negocio", "diseño web").

You must return strictly valid JSON:
{
  "intent": "leads" | "scan" | "profile" | "reviews" | "quote" | "plans" | "website",
  "radiusKm": number | null,
  "reply": "Frase natural, empática y directa de 1-2 oraciones confirmando la acción o respondiendo con naturalidad (100% tono humano, sin palabras como 'IA', 'bot' o 'asistente')."
}

Respond strictly in the requested language: ${language === 'en' ? 'English' : 'Spanish'}.`;

    const aiResult = await callNodeAiText({
      taskType: "generic",
      prompt,
      systemInstruction: routerSystemInstruction,
      jsonMode: true
    });

    let parsedResult;
    try {
      const cleanedText = aiResult.text.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleanedText);
    } catch {
      console.warn("Failed to parse JSON router result:", aiResult.text);
      parsedResult = {
        intent: "consultation",
        reasoning: "No se pudo clasificar con precisión.",
        response: aiResult.text || "Hola, ¿en qué te puedo ayudar hoy?"
      };
    }

    const rawIntent = String(parsedResult.intent || '').toLowerCase().trim();
    let canonicalIntent = rawIntent;
    if (rawIntent === 'business_scan' || rawIntent === 'tools' || rawIntent === 'market' || rawIntent === 'radar') {
      canonicalIntent = 'scan';
    } else if (rawIntent === 'crm' || rawIntent === 'action_center') {
      canonicalIntent = 'leads';
    } else if (rawIntent === 'pricing' || rawIntent === 'estimator') {
      canonicalIntent = 'quote';
    } else if (rawIntent === 'settings') {
      canonicalIntent = 'profile';
    }

    const reply = parsedResult.reply || parsedResult.response || (
      language === "en" ? "Processing your voice request..." : "Procesando tu solicitud..."
    );

    res.json({
      intent: canonicalIntent,
      radiusKm: typeof parsedResult.radiusKm === 'number' ? parsedResult.radiusKm : null,
      reply,
      response: reply,
      reasoning: parsedResult.reasoning || ""
    });
  } catch (error: any) {
    console.error("AI Router Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-lead-pitch", aiUsageGuard, aiRateLimiter, async (req, res) => {
  try {
    const { name, rating, reviews, website, address, language = "es" } = req.body;
    
    const systemInstruction = language === "es"
      ? "Eres un experto en Marketing B2B y prospección en frío. Redactas mensajes de venta ultra-persuasivos (aptos para WhatsApp o correo) dirigidos a dueños de negocios locales. Tu objetivo es convencerlos de que optimicen su perfil de Google Maps o reclamen su sitio web usando nuestra plataforma LocalFlow Pro. Sé directo, empático, profesional, y enfócate en sus puntos débiles de manera constructiva y sin sonar agresivo."
      : "You are an expert in B2B Marketing and cold outreach. You write highly persuasive sales pitches (suitable for WhatsApp or email) tailored for local business owners. Your goal is to convince them to optimize their Google Maps profile or claim their website using our LocalFlow Pro platform. Be direct, empathetic, professional, and focus on their weak spots in a constructive, non-aggressive way.";

    const prompt = language === "es"
      ? `Redacta un mensaje de prospección en frío altamente persuasivo y personalizado para el siguiente negocio:
         Nombre del negocio: ${name || 'Negocio Local'}
         Calificación: ${rating !== undefined ? rating : 'N/A'} estrellas
         Número de reseñas: ${reviews !== undefined ? reviews : 'N/A'}
         Sitio Web: ${website ? website : 'No tiene sitio web / No registrado'}
         Dirección: ${address || 'Local'}
         
         Puntos débiles a analizar y atacar con elegancia:
         ${!website ? '- No tiene un sitio web profesional para captar clientes en línea, lo que le hace perder visibilidad y ventas frente a competidores.' : ''}
         ${rating && rating < 4.2 ? `- Tiene una calificación baja (${rating}), lo que daña su reputación digital y ahuyenta a clientes que buscan la mejor opción en Maps.` : ''}
         ${reviews && reviews < 10 ? `- Tiene muy pocas reseñas (${reviews}), por lo que pasa desapercibido y carece de prueba social.` : ''}
         ${website && rating && rating >= 4.2 && reviews && reviews >= 10 ? '- Aunque tiene sitio web y buenas reseñas, siempre puede automatizar las respuestas y captar más clientes físicos con embudos de reseñas automatizados.' : ''}
         
         Genera una plantilla optimizada lista para usar, con un asunto si fuera correo (o primer gancho para WhatsApp) y un cuerpo amigable que invite a una llamada breve o demostración gratuita. No incluyas explicaciones extras ni metadatos del sistema, solo la plantilla lista.`
      : `Write a highly persuasive and personalized cold outreach pitch for the following business:
         Business Name: ${name || 'Local Business'}
         Rating: ${rating !== undefined ? rating : 'N/A'} stars
         Number of reviews: ${reviews !== undefined ? reviews : 'N/A'}
         Website: ${website ? website : 'No website / Not registered'}
         Address: ${address || 'Local'}
         
         Weak spots to analyze and address elegantly:
         ${!website ? '- They do not have a professional website to capture leads online, losing visibility and sales to competitors.' : ''}
         ${rating && rating < 4.2 ? `- They have a lower rating (${rating} stars), which damages online reputation and turns away potential customers on Maps.` : ''}
         ${reviews && reviews < 10 ? `- They have very few reviews (${reviews}), making them invisible and lacking social proof.` : ''}
         ${website && rating && rating >= 4.2 && reviews && reviews >= 10 ? '- While they have a website and good reviews, they can still benefit from automating replies and driving more walk-in traffic with automated review funnels.' : ''}
         
         Generate an optimized template ready to use, with a subject line if it's for an email (or an opening hook for WhatsApp) and a friendly body inviting them to a brief call or free demo. Do not include extra explanations or system metadata, just the ready-to-use template.`;

    const humanizedInstruction = getHumanizedSystemInstruction(systemInstruction, language as "es" | "en");

    const aiResult = await callNodeAiText({
      taskType: "pitch",
      prompt,
      systemInstruction: humanizedInstruction
    });

    res.json({ text: aiResult.text, providerUsed: aiResult.providerUsed, modelUsed: aiResult.modelUsed });
  } catch (error: any) {
    console.log("AI Generation Error in Lead Pitch endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post(["/api/ai/generate", "/ai/generate"], aiUsageGuard, aiRateLimiter, async (req, res) => {
  try {
    const { prompt, systemInstruction, image, taskType = "copy_short" } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Falta el prompt obligatorio para la generación de contenido." });
    }

    // Vision Support: If image data is provided (base64 data URL), use Gemini Multimodal
    if (image && typeof image === "string" && image.startsWith("data:image")) {
      const geminiClient = getGeminiClient(req.headers["x-gemini-api-key"] as string | undefined);
      if (geminiClient) {
        const matches = image.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];

          const targetModel = ACTIVE_MODELS.GEMINI_PRIMARY;
          const response = await geminiClient.models.generateContent({
            model: targetModel,
            contents: [
              {
                role: "user",
                parts: [
                  { text: (systemInstruction ? `${systemInstruction}\n\n` : "") + prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data
                    }
                  }
                ]
              }
            ]
          });

          return res.json({
            text: response.text || "",
            providerUsed: "gemini",
            modelUsed: targetModel
          });
        }
      }
    }

    // Central Complexity-Based Cascade Execution for text prompts
    const aiResult = await callNodeAiText({
      taskType: taskType as TaskType,
      prompt,
      systemInstruction,
      jsonMode: false
    });

    res.json({
      text: aiResult.text,
      providerUsed: aiResult.providerUsed,
      modelUsed: aiResult.modelUsed
    });
  } catch (error: any) {
    console.log("AI Generation Error in Central generate endpoint:", error);
    res.status(500).json({ error: error.message || "Error interno del motor de IA." });
  }
});

// Stripe Checkout Session Endpoint
app.post(["/api/create-checkout-session", "/create-checkout-session"], createCheckoutSessionHandler);
app.get(["/api/verify-session", "/verify-session"], verifySessionHandler);

// USDT BEP-20 Payment Endpoints
app.post(["/api/usdt/create-order", "/usdt/create-order"], createUsdtOrderHandler);
app.post(["/api/usdt/verify-payment", "/usdt/verify-payment"], verifyUsdtPaymentHandler);
app.get(["/api/usdt/order-status", "/usdt/order-status"], getUsdtOrderStatusHandler);

// Audit extraction endpoint
app.post(["/api/audit", "/audit"], scanUsageGuard, scanRateLimiter, auditHandler);

// Arquitectura de 3 Micro-Agentes de Growth Hacking y SEO Local (/api/reparar-perfil & /api/scan-maps)
app.post(["/api/scan-maps", "/scan-maps", "/api/reparar-perfil", "/reparar-perfil", "/api/scan-maps/route.js", "/scan-maps/route.js"], scanUsageGuard, scanRateLimiter, scanMapsHandler);

// Servicio de Envíos de Correos Transaccionales con Resend
app.post(["/api/send-email", "/send-email"], outreachUsageGuard, sendEmailHandler);

app.post(["/api/business-scan", "/business-scan"], scanUsageGuard, scanRateLimiter, businessScanHandler);

// Plan Usage Quotas & Consumption Status Endpoint (TASK P0-B)
app.get("/api/plan/usage", getPlanUsageStatusHandler);

// Background Worker / Cron Endpoint for Monthly SEO Performance Reports
app.all(["/api/cron/monthly-seo-reports", "/cron/monthly-seo-reports"], monthlySeoCronHandler);

// Generador de Audio Profesional con Inteligencia Artificial (Gemini Neural TTS)
app.post(["/api/generar-audio", "/generar-audio"], aiUsageGuard, aiRateLimiter, async (req, res) => {
  try {
    const { text, language = "es" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Falta el texto para sintetizar." });
    }

    const clientKey = req.headers["x-gemini-api-key"];
    const apiKeyToUse = (clientKey && typeof clientKey === 'string' && clientKey.trim()) 
      ? clientKey.trim() 
      : (process.env.GEMINI_API_KEY || "");

    if (!apiKeyToUse) {
      return res.status(500).json({ error: "GEMINI_API_KEY no configurada. Por favor, añádela en Settings > Secrets." });
    }

    const aiClient = new GoogleGenAI({
      apiKey: apiKeyToUse,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await aiClient.models.generateContent({
      model: ACTIVE_MODELS.GEMINI_TTS,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No se pudo sintetizar el audio desde el motor de IA.");
    }

    return res.status(200).json({
      success: true,
      audio: base64Audio,
    });
  } catch (error: any) {
    console.log("Error en /api/generar-audio:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error al sintetizar el audio profesional.",
    });
  }
});

// --- Rutas de Autenticación de Google ---

app.get("/api/auth/google/config-status", (req, res) => {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const configured = !!(clientId && clientId !== "YOUR_CLIENT_ID" && clientId.trim() !== "" && clientSecret && clientSecret.trim() !== "");
  return res.json({
    success: true,
    configured
  });
});

app.get("/api/auth/google", (req, res) => {
  const { userId } = req.query;
  const clientId = getGoogleClientId();
  
  // Si no hay credenciales de Google configuradas, rechazamos la petición con error claro
  if (!clientId || clientId === "YOUR_CLIENT_ID" || clientId.trim() === "") {
    console.warn("⚠️ No GOOGLE_CLIENT_ID configured on backend.");
    return res.status(400).json({
      error: "Google OAuth no configurado",
      message: "Se requiere un GOOGLE_CLIENT_ID válido en las variables de entorno para autenticar con Google."
    });
  }

  // Create a context-specific OAuth client to handle dynamic redirect URIs
  const dynamicRedirectUri = getRedirectUri(req);
  const client = new OAuth2Client(
    getGoogleClientId(),
    getGoogleClientSecret(),
    dynamicRedirectUri
  );
  
  // Debug OAuth (sin secretos)
  console.log("OAuth Request - Client ID OK:", !!clientId);
  console.log("OAuth Request - Redirect URI:", dynamicRedirectUri);

  const scopes = [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: userId as string, // Usamos state para pasar el userId de vuelta
  });

  res.redirect(url);
});

app.get("/api/auth/callback/google", async (req, res) => {
  const { code, state: userId } = req.query;

  // Create a context-specific OAuth client for the token exchange
  const dynamicRedirectUri = getRedirectUri(req);
  const client = new OAuth2Client(
    getGoogleClientId(),
    getGoogleClientSecret(),
    dynamicRedirectUri
  );

  if (!code) {
    return res.status(400).send("No se proporcionó el código de autorización.");
  }

  try {
    const { tokens } = await client.getToken(code as string);
    
    if (userId && userId !== 'anonymous' && tokens.refresh_token) {
      // Guardar tokens en Firestore asociados al usuario
      await db.collection('user_tokens').doc(userId as string).set({
        google_tokens: tokens,
        updated_at: adminFieldValue.serverTimestamp(),
        has_gmb_connected: true
      }, { merge: true });
      
      console.log(`Tokens de Google guardados para el usuario: ${userId}`);
    } else {
      console.log("Tokens recibidos pero no se guardaron (usuario anónimo o falta refresh_token).");
    }

    client.setCredentials(tokens);
    
    // Redirigir de vuelta a la aplicación con éxito
    res.redirect("/?auth_success=true");
  } catch (error: any) {
    console.log("Error en el callback de OAuth:", error);
    res.status(500).send(`Error de autenticación: ${error.message}`);
  }
});

// --- Rutas de Google Business Profile (GBP) ---

/**
 * Obtiene los tokens del usuario desde Firestore
 */
async function getUserTokens(userId: string) {
  try {
    const doc = await db.collection('user_tokens').doc(userId).get();
    if (!doc.exists) {
      console.log(`No user tokens found in 'user_tokens' collection for user: ${userId}`);
      return null;
    }
    return doc.data()?.google_tokens;
  } catch (error) {
    console.log("CRITICAL Firestore Error in getUserTokens:", error);
    throw error;
  }
}

/**
 * Configura el cliente OAuth con los tokens del usuario
 */
async function getAuthenticatedClient(userId: string) {
  const tokens = await getUserTokens(userId);
  if (!tokens) throw new Error("Google Business Profile no conectado.");
  
  const client = new OAuth2Client(
    getGoogleClientId(),
    getGoogleClientSecret(),
    getRedirectUri()
  );
  client.setCredentials(tokens);
  return client;
}

// 1. Listar Cuentas y Ubicaciones
app.get("/api/gmb/locations", async (req, res) => {
  const { userId } = req.query;
  if (!userId || userId === 'undefined') {
    console.log("GMB Fetch Error: userId is missing or undefined");
    return res.status(400).json({ error: "userId requerido para sincronizar con Google" });
  }

  try {
    console.log(`Intentando recuperar ubicaciones GMB para el usuario: ${userId}`);
    const client = await getAuthenticatedClient(userId as string);
    
    // Primero obtenemos las cuentas
    const accountsRes = await client.request({
      url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
    });
    
    const accounts = (accountsRes.data as any).accounts || [];
    if (accounts.length === 0) {
      console.log("No se encontraron cuentas de Google Business asociadas a este perfil.");
      return res.json({ locations: [] });
    }

    // Luego las ubicaciones de la primera cuenta
    const accountName = accounts[0].name;
    const locationsRes = await client.request({
      url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,categories,serviceArea`
    });

    console.log(`✅ Éxito: Se encontraron ${(locationsRes.data as any).locations?.length || 0} ubicaciones para ${accountName}`);

    res.json({ 
      accounts,
      locations: (locationsRes.data as any).locations || [] 
    });
  } catch (error: any) {
    const status = error.response?.status;
    const data = error.response?.data;
    
    if (!error.response || status === 401 || status === 403 || error.message.includes("no conectado")) {
      console.log("GMB not connected or session expired for user:", userId);
      return res.json({
        accounts: [],
        locations: [],
        connected: false,
        requiresAuth: true
      });
    }

    console.log("CRITICAL GMB fetch error:", error.message);
    
    if (status === 403) {
      console.log("403 Forbidden - Asegúrate de tener habilitadas 'Google My Business API' y 'Business Information API' en Google Cloud Console.");
    }

    if (status === 401) {
      console.log("401 Unauthorized - Los tokens de Google han expirado o son inválidos. El usuario debe reconectar.");
    }
    
    res.status(status || 500).json({ 
      error: error.message,
      details: data?.error?.message || "Error al conectar con las APIs de Google Business Profile",
      locations: [],
      connected: false
    });
  }
});

// 2. Obtener Reseñas
app.get("/api/gmb/reviews", async (req, res) => {
  const { userId, locationName } = req.query; // locationName viene como 'accounts/{acc}/locations/{loc}'
  if (!userId || !locationName) return res.status(400).json({ error: "userId y locationName requeridos", reviews: [] });

  try {
    const client = await getAuthenticatedClient(userId as string);
    const reviewsRes = await client.request({
      url: `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}/reviews`
    });

    res.json({ reviews: (reviewsRes.data as any).reviews || [] });
  } catch (error: any) {
    const status = error.response?.status;
    if (!error.response || status === 401 || status === 403 || error.message.includes("no conectado")) {
      return res.json({
        reviews: [],
        connected: false
      });
    }
    console.log("Error fetching GMB reviews:", error);
    const data = error.response?.data;
    res.status(status || 500).json({ 
      error: error.message,
      details: data?.error?.message || "Error al obtener reseñas de GMB",
      reviews: []
    });
  }
});

// 3. Generar y Publicar Respuesta (AI-Powered)
app.post("/api/gmb/reviews/reply", async (req, res) => {
  const { userId, reviewName, comment, language = "es" } = req.body;
  if (!userId || !reviewName || !comment) return res.status(400).json({ error: "Datos incompletos" });

  try {
    let client;
    let isConnected = true;
    try {
      client = await getAuthenticatedClient(userId);
    } catch (authError: any) {
      if (authError.message.includes("no conectado")) {
        isConnected = false;
      } else {
        throw authError;
      }
    }

    // Usamos Gemini 3.5 Flash para redactar la respuesta
    const prompt = `Analiza el idioma de la siguiente reseña de usuario. Tu tarea es generar una respuesta profesional, amable y concisa dirigida al cliente. Debes responder OBLIGATORIAMENTE en el mismo idioma en el que está escrita la reseña (si la reseña está en inglés, responde en inglés; si está en español, responde en español, etc.). No traduzcas la reseña ni uses el idioma de la configuración del sistema.

Reseña de usuario: "${comment}"

Escribe una respuesta profesional, amigable, optimizada para SEO local, dirigida al cliente y con un máximo de 3 oraciones. Solo devuelve el texto de la respuesta, sin saludos del sistema ni introducciones adicionales.`;
    
    let aiReply = "";
    const modelsToTry = [ACTIVE_MODELS.GEMINI_FAST];
    let lastError: any = null;

    const baseReplyingInstruction = "Eres un experto en relaciones públicas y SEO local para contratistas y servicios locales. Tu objetivo es responder reseñas de clientes de manera educada, empática, corta y sumamente natural.";
    const humanizedInstruction = getHumanizedSystemInstruction(baseReplyingInstruction, language as "es" | "en");

    if (!isProviderAvailable("gemini")) {
      console.warn("[Reviews Reply Server] Gemini is on cooldown. Using premium deterministic reply.");
      aiReply = language === "en" || language === "en-US"
        ? "Thank you very much for your feedback and support. We are committed to providing the highest quality local service."
        : "Muchas gracias por tu valoración y comentario. Nos comprometemos a seguir ofreciendo la mejor calidad en nuestro servicio local.";
    } else {
      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: humanizedInstruction,
            }
          });
          aiReply = response.text || "";
          if (aiReply) {
            break;
          }
        } catch (e: any) {
          console.log(`Error generating reply with ${modelName}, trying fallback...`, e);
          const errMsg = e?.message || e?.toString() || "";
          const lowerMsg = errMsg.toLowerCase();
          const is429 = e?.status === 429 || 
                        lowerMsg.includes("429") || 
                        lowerMsg.includes("resource_exhausted") ||
                        lowerMsg.includes("quota");
          if (is429) {
            setGeminiCooldown(errMsg, e);
          }
          lastError = e;
        }
      }
    }

    if (!aiReply) {
      console.log("All Gemini models failed. Last error:", lastError, ". Using high-quality deterministic fallback.");
      aiReply = language === "en" || language === "en-US"
        ? "Thank you very much for your feedback and support. We are committed to providing the highest quality local service."
        : "Muchas gracias por tu valoración y comentario. Nos comprometemos a seguir ofreciendo la mejor calidad en nuestro servicio local.";
    }

    const isMockReview = reviewName.startsWith("rev") || reviewName.startsWith("mock");

    // Publicamos en Google solo si está conectado de verdad y no es un demo/mock review
    if (isConnected && client && !isMockReview) {
      await client.request({
        url: `https://mybusinessaccountmanagement.googleapis.com/v1/${reviewName}/reply`,
        method: 'PUT',
        data: { comment: aiReply }
      });
    } else {
      console.log(`[DEMO/LOCAL AI] Simulated reply for review ${reviewName}: "${aiReply}"`);
    }

    res.json({ success: true, reply: aiReply });
  } catch (error: any) {
    console.log("Error replying to GMB review:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Métricas de Rendimiento (Performance)
app.get("/api/gmb/performance", async (req, res) => {
  const { userId, locationName } = req.query;
  if (!userId || !locationName) return res.status(400).json({ error: "userId y locationName requeridos", multiDailyMetricTimeSeries: [] });

  try {
    const client = await getAuthenticatedClient(userId as string);
    
    // Obtenemos métricas de los últimos 30 días
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const performanceRes = await client.request({
      url: `https://businessprofileperformance.googleapis.com/v1/${locationName}/fetchMultiDailyMetricsTimeSeries`,
      method: 'GET',
      params: {
        'dailyMetrics': ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'CALL_CLICKS', 'WEBSITE_CLICKS'],
        'dailyRange.startDate.year': thirtyDaysAgo.getFullYear(),
        'dailyRange.startDate.month': thirtyDaysAgo.getMonth() + 1,
        'dailyRange.startDate.day': thirtyDaysAgo.getDate(),
        'dailyRange.endDate.year': now.getFullYear(),
        'dailyRange.endDate.month': now.getMonth() + 1,
        'dailyRange.endDate.day': now.getDate(),
      }
    });

    res.json(performanceRes.data || { multiDailyMetricTimeSeries: [] });
  } catch (error: any) {
    const status = error.response?.status;
    if (!error.response || status === 401 || status === 403 || error.message.includes("no conectado")) {
      return res.json({
        multiDailyMetricTimeSeries: []
      });
    }
    console.log("Error fetching GMB performance:", error);
    const data = error.response?.data;
    res.status(status || 500).json({ 
      error: error.message,
      details: data?.error?.message || "Error al obtener métricas de GMB",
      multiDailyMetricTimeSeries: []
    });
  }
});

// Global API fallback - prevent any unmatched /api/* from falling through to the SPA index.html
app.all("/api/{*splat}", (req, res) => {
  res.status(404).json({
    error: `API route ${req.method} ${req.url} not found`,
    message: "The requested API endpoint does not exist on this server."
  });
});

// Public Legal Pages for Google Brand Verification
app.get(["/privacy", "/privacy.html"], (req, res) => {
  const file = process.env.NODE_ENV !== "production"
    ? path.join(process.cwd(), "public", "privacy.html")
    : path.join(process.cwd(), "dist", "privacy.html");
  res.sendFile(file);
});

app.get(["/terms", "/terms.html"], (req, res) => {
  const file = process.env.NODE_ENV !== "production"
    ? path.join(process.cwd(), "public", "terms.html")
    : path.join(process.cwd(), "dist", "terms.html");
  res.sendFile(file);
});

// Setup Sentry Express Error Handler
if (sentryDsn) {
  Sentry.setupExpressErrorHandler(app);
}

// Vite Middleware
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("{*splat}", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Start background worker / cron job for monthly SEO performance reports (skip if unauthenticated)
    setTimeout(() => {
      if (!hasFirebaseAdminCredentials()) {
        console.info("[Monthly SEO Cron] ℹ️ SEO cron skipped cleanly: Firebase Admin credentials not configured.");
        return;
      }
      runMonthlySeoCronJob().catch(err => console.error("[Monthly SEO Cron Startup Error]:", err));
    }, 15000);

    setInterval(() => {
      if (!hasFirebaseAdminCredentials()) {
        return;
      }
      runMonthlySeoCronJob().catch(err => console.error("[Monthly SEO Cron Interval Error]:", err));
    }, 24 * 60 * 60 * 1000);
  });
}

setupVite();
