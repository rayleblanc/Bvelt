import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

// Load credentials
let serviceAccount: any = null;
const envCreds = process.env.FIREBASE_SERVICE_ACCOUNT || 
                 process.env.FIREBASE_ACCOUNT || 
                 process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
                 process.env.FIREBASE_ADMIN_CREDENTIALS;
if (envCreds) {
  try {
    serviceAccount = JSON.parse(envCreds);
  } catch (e) {
    console.error("Error parsing service account:", e);
  }
}

if (!serviceAccount) {
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
  try {
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
  } catch (e) {
    console.log("Failed to read service-account.json:", e);
  }
}

// Initialize App
if (!getApps().length) {
  if (serviceAccount && serviceAccount.project_id) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else {
    initializeApp();
  }
}

const db = getFirestore();

// EXACT mirror of claimStripeEventServer in server.ts
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

async function updateStripeEventStatusServer(eventId: string, status: string, customUpdatedAt?: string): Promise<boolean> {
  try {
    const dataToUpdate: any = {
      status,
      updatedAt: customUpdatedAt || new Date().toISOString()
    };
    await db.collection('stripe_events').doc(eventId).update(dataToUpdate);
    return true;
  } catch (err) {
    console.error("[updateStripeEventStatusServer] Error updating status:", err);
    return false;
  }
}

async function runTests() {
  console.log("=====================================================");
  console.log("  BVELT FASE 0.5 — STRIPE RETRY & RECOVERY TESTS    ");
  console.log("=====================================================\n");

  const cleanups: Array<() => Promise<void>> = [];

  try {
    // -------------------------------------------------------------
    // TEST A — FAILED RECOVERY
    // -------------------------------------------------------------
    console.log("\n--- TEST A: FAILED RECOVERY ---");
    const eventIdA = `test_evt_failed_rec_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdA).delete().catch(() => {});
    });

    // 1. Initial claim gets CLAIMED
    const claimA1 = await claimStripeEventServer(eventIdA, "checkout.session.completed");
    console.log(`1st Claim: ${claimA1} (Expected: CLAIMED)`);
    if (claimA1 !== 'CLAIMED') throw new Error("TEST A FAILED: Expected CLAIMED for first delivery");

    // 2. Mark as FAILED (simulating a transient failure or crash)
    await updateStripeEventStatusServer(eventIdA, "FAILED");
    console.log("Marked event as FAILED.");

    // 3. Next delivery attempts retry
    const claimA2 = await claimStripeEventServer(eventIdA, "checkout.session.completed");
    console.log(`2nd Claim (Recovery): ${claimA2} (Expected: CLAIMED)`);
    if (claimA2 !== 'CLAIMED') throw new Error("TEST A FAILED: Expected FAILED event to be claimable on retry");

    // 4. Update to COMPLETED
    await updateStripeEventStatusServer(eventIdA, "COMPLETED");
    console.log("Marked event as COMPLETED.");

    // -------------------------------------------------------------
    // TEST B — RECENT PROCESSING
    // -------------------------------------------------------------
    console.log("\n--- TEST B: RECENT PROCESSING PROTECTED ---");
    const eventIdB = `test_evt_recent_proc_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdB).delete().catch(() => {});
    });

    const claimB1 = await claimStripeEventServer(eventIdB, "checkout.session.completed");
    console.log(`1st Claim: ${claimB1} (Expected: CLAIMED)`);
    if (claimB1 !== 'CLAIMED') throw new Error("TEST B FAILED: Expected CLAIMED for fresh event");

    // Attempt second delivery within seconds (lease is active)
    const claimB2 = await claimStripeEventServer(eventIdB, "checkout.session.completed");
    console.log(`2nd Claim (within seconds): ${claimB2} (Expected: PROCESSING_ACTIVE)`);
    if (claimB2 !== 'PROCESSING_ACTIVE') throw new Error("TEST B FAILED: Expected PROCESSING_ACTIVE for recent lease");

    // -------------------------------------------------------------
    // TEST C — STALE PROCESSING RECOVERY
    // -------------------------------------------------------------
    console.log("\n--- TEST C: STALE PROCESSING RECOVERY ---");
    const eventIdC = `test_evt_stale_proc_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdC).delete().catch(() => {});
    });

    const claimC1 = await claimStripeEventServer(eventIdC, "checkout.session.completed");
    console.log(`1st Claim: ${claimC1} (Expected: CLAIMED)`);
    if (claimC1 !== 'CLAIMED') throw new Error("TEST C FAILED: Expected CLAIMED");

    // Backdate the updatedAt to simulate 11 minutes having passed (expired lease > 10m)
    const elevenMinsAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    await updateStripeEventStatusServer(eventIdC, "PROCESSING", elevenMinsAgo);
    console.log(`Backdated event updatedAt to ${elevenMinsAgo} (11 minutes ago)`);

    // Attempt second delivery after lease expired
    const claimC2 = await claimStripeEventServer(eventIdC, "checkout.session.completed");
    console.log(`2nd Claim (Stale lease recovery): ${claimC2} (Expected: CLAIMED)`);
    if (claimC2 !== 'CLAIMED') throw new Error("TEST C FAILED: Expected CLAIMED for stale event recovery");

    // -------------------------------------------------------------
    // TEST D — CONCURRENT STALE RECOVERY
    // -------------------------------------------------------------
    console.log("\n--- TEST D: CONCURRENT STALE RECOVERY ---");
    const eventIdD = `test_evt_concurrent_stale_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdD).delete().catch(() => {});
    });

    await claimStripeEventServer(eventIdD, "checkout.session.completed");
    // Expire the lease
    await updateStripeEventStatusServer(eventIdD, "PROCESSING", elevenMinsAgo);
    console.log("Set up stale event. Firing 5 concurrent recovery requests...");

    const promisesD = Array.from({ length: 5 }).map(() => claimStripeEventServer(eventIdD, "checkout.session.completed"));
    const resultsD = await Promise.all(promisesD);
    console.log(`Concurrent stale recovery results:`, resultsD);

    const claimedCountD = resultsD.filter(r => r === 'CLAIMED').length;
    const activeCountD = resultsD.filter(r => r === 'PROCESSING_ACTIVE').length;
    console.log(`CLAIMED count: ${claimedCountD} (Expected: 1)`);
    console.log(`PROCESSING_ACTIVE count: ${activeCountD} (Expected: 4)`);

    if (claimedCountD !== 1) throw new Error(`TEST D FAILED: Exactly 1 process must claim ownership of stale lease. Got ${claimedCountD}`);
    if (activeCountD !== 4) throw new Error(`TEST D FAILED: Expected remaining 4 requests to be rejected with PROCESSING_ACTIVE. Got ${activeCountD}`);

    // -------------------------------------------------------------
    // TEST E — CONCURRENT FAILED RECOVERY
    // -------------------------------------------------------------
    console.log("\n--- TEST E: CONCURRENT FAILED RECOVERY ---");
    const eventIdE = `test_evt_concurrent_failed_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdE).delete().catch(() => {});
    });

    await claimStripeEventServer(eventIdE, "checkout.session.completed");
    await updateStripeEventStatusServer(eventIdE, "FAILED");
    console.log("Set up FAILED event. Firing 5 concurrent deliveries...");

    const promisesE = Array.from({ length: 5 }).map(() => claimStripeEventServer(eventIdE, "checkout.session.completed"));
    const resultsE = await Promise.all(promisesE);
    console.log(`Concurrent failed recovery results:`, resultsE);

    const claimedCountE = resultsE.filter(r => r === 'CLAIMED').length;
    const activeCountE = resultsE.filter(r => r === 'PROCESSING_ACTIVE').length;
    console.log(`CLAIMED count: ${claimedCountE} (Expected: 1)`);
    console.log(`PROCESSING_ACTIVE count: ${activeCountE} (Expected: 4)`);

    if (claimedCountE !== 1) throw new Error(`TEST E FAILED: Exactly 1 process must claim ownership of failed event. Got ${claimedCountE}`);
    if (activeCountE !== 4) throw new Error(`TEST E FAILED: Expected 4 processes to see PROCESSING_ACTIVE. Got ${activeCountE}`);

    // -------------------------------------------------------------
    // TEST F — COMPLETED RECOVERY ATTEMPT
    // -------------------------------------------------------------
    console.log("\n--- TEST F: COMPLETED IS IMMUTABLE ---");
    const eventIdF = `test_evt_immutable_comp_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdF).delete().catch(() => {});
    });

    await claimStripeEventServer(eventIdF, "checkout.session.completed");
    await updateStripeEventStatusServer(eventIdF, "COMPLETED");
    console.log("Set up COMPLETED event. Attempting multiple deliveries...");

    const claimF1 = await claimStripeEventServer(eventIdF, "checkout.session.completed");
    const claimF2 = await claimStripeEventServer(eventIdF, "checkout.session.completed");
    console.log(`Claim F1: ${claimF1}, Claim F2: ${claimF2} (Expected: COMPLETED_DUPLICATE, COMPLETED_DUPLICATE)`);
    if (claimF1 !== 'COMPLETED_DUPLICATE' || claimF2 !== 'COMPLETED_DUPLICATE') {
      throw new Error("TEST F FAILED: COMPLETED event must always return COMPLETED_DUPLICATE");
    }

    // -------------------------------------------------------------
    // TEST G — CRASH SIMULATION
    // -------------------------------------------------------------
    console.log("\n--- TEST G: CRASH SIMULATION ---");
    const eventIdG = `test_evt_crash_sim_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdG).delete().catch(() => {});
    });

    const claimG1 = await claimStripeEventServer(eventIdG, "checkout.session.completed");
    console.log(`Event claimed: ${claimG1} (status: PROCESSING). Simulating worker crash before COMPLETED/FAILED written...`);

    // Fast forward lease expiry manually
    await updateStripeEventStatusServer(eventIdG, "PROCESSING", elevenMinsAgo);
    console.log("Lease expired (stale). Attempting retry delivery...");

    const claimG2 = await claimStripeEventServer(eventIdG, "checkout.session.completed");
    console.log(`Retry Claim: ${claimG2} (Expected: CLAIMED)`);
    if (claimG2 !== 'CLAIMED') throw new Error("TEST G FAILED: Stale processing after crash must be recoverable");

    // -------------------------------------------------------------
    // TEST H — CRITICAL CRASH WINDOW / EXACTLY-ONCE SIDE EFFECT
    // -------------------------------------------------------------
    console.log("\n--- TEST H: CRITICAL CRASH WINDOW & IDEMPOTENT SIDE EFFECT ---");
    const testUserIdH = `test_user_crash_window_${Date.now()}`;
    const eventIdH = `test_evt_crash_window_${Date.now()}`;
    
    console.log(`Creating temporary test user profile: ${testUserIdH}`);
    const profileRef = db.collection('profiles').doc(testUserIdH);
    await profileRef.set({
      isPro: false,
      plan: "free",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    cleanups.push(async () => {
      await profileRef.delete().catch(() => {});
      await db.collection('stripe_events').doc(eventIdH).delete().catch(() => {});
    });

    let businessSideEffectExecutions = 0;

    async function runWebhookProcessor(eventId: string) {
      const claim = await claimStripeEventServer(eventId, "checkout.session.completed");
      if (claim === 'CLAIMED') {
        try {
          // Idempotent Business Side-Effect Execution
          // We check first if the user is already updated to prevent duplicate updates.
          const userDoc = await profileRef.get();
          const userData = userDoc.data();
          if (userData?.plan !== "pro_monthly") {
            businessSideEffectExecutions++;
            await profileRef.set({
              isPro: true,
              plan: "pro_monthly",
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } else {
            console.log("[Webhook Processor] Business effect skipped - already updated (idempotent).");
          }
          
          // CRASH SIMULATION WINDOW: Imagine process dies here, BEFORE updating stripe_event status to 'COMPLETED'!
          // We will throw an error or exit processing early without writing 'COMPLETED'.
          throw new Error("CRASH_SIMULATION_INTERRUPT");
        } catch (e: any) {
          if (e.message === "CRASH_SIMULATION_INTERRUPT") {
            console.log("[Crash Simulator] Webhook processor crashed exactly after executing side effect, before COMPLETED was written.");
            // Do NOT mark as completed/failed to simulate hard-crash (state remains 'PROCESSING' with older timestamp)
            return { status: 500, error: "crashed" };
          }
          await updateStripeEventStatusServer(eventId, "FAILED");
          throw e;
        }
      } else if (claim === 'COMPLETED_DUPLICATE') {
        return { status: 200, executed: false, reason: "duplicate" };
      } else {
        return { status: 409, executed: false, reason: "processing_active" };
      }
    }

    // 1. First execution
    console.log("Executing 1st webhook delivery...");
    await runWebhookProcessor(eventIdH).catch(() => {});

    // Verify side-effect ran once
    let profileH = (await profileRef.get()).data();
    console.log(`Profile status after crash: plan = ${profileH?.plan}, executed = ${businessSideEffectExecutions}`);
    if (businessSideEffectExecutions !== 1) throw new Error("TEST H FAILED: Side-effect should have run 1st time");

    // 2. Advance lease expiry (> 10m) to simulate time passed and Stripe retry
    console.log("Simulating time elapsed (>10m) for Stripe retry...");
    await updateStripeEventStatusServer(eventIdH, "PROCESSING", elevenMinsAgo);

    // 3. Second execution (Stripe retry)
    console.log("Executing 2nd webhook delivery (Stripe retry)...");
    
    // This time the processor succeeds and completes
    const claimH2 = await claimStripeEventServer(eventIdH, "checkout.session.completed");
    console.log(`Retry claim result: ${claimH2} (Expected: CLAIMED)`);
    if (claimH2 !== 'CLAIMED') throw new Error("TEST H FAILED: Stale crash event must be claimable");

    // Execute side-effect on retry
    const userDocH2 = await profileRef.get();
    const userDataH2 = userDocH2.data();
    if (userDataH2?.plan !== "pro_monthly") {
      businessSideEffectExecutions++;
      await profileRef.set({
        isPro: true,
        plan: "pro_monthly",
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      console.log("[Webhook Processor] Business effect skipped on retry - already updated (idempotent).");
    }
    await updateStripeEventStatusServer(eventIdH, "COMPLETED");

    profileH = (await profileRef.get()).data();
    console.log(`Final Profile Status: plan = ${profileH?.plan}, total side-effect executions = ${businessSideEffectExecutions}`);
    if (businessSideEffectExecutions !== 1) {
      throw new Error(`TEST H FAILED: Business side effects were executed ${businessSideEffectExecutions} times (Expected exactly once!)`);
    }

    // -------------------------------------------------------------
    // TEST I — UPDATE RACE / SERIALIZED TRANSACTION INTEGRITY
    // -------------------------------------------------------------
    console.log("\n--- TEST I: SERIALIZED TRANSACTION INTEGRITY (CAS/RACE PROTECTION) ---");
    const eventIdI = `test_evt_cas_integrity_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdI).delete().catch(() => {});
    });

    console.log("Creating document as FAILED to setup recovery race...");
    // Pre-create document as FAILED
    await db.collection('stripe_events').doc(eventIdI).set({
      eventId: eventIdI,
      eventType: "checkout.session.completed",
      status: "FAILED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log("Firing 5 recovery requests simultaneously against FAILED document...");
    const promisesI = Array.from({ length: 5 }).map(() => claimStripeEventServer(eventIdI, "checkout.session.completed"));
    const resultsI = await Promise.all(promisesI);
    console.log("Concurrent claim results for FAILED recovery:", resultsI);

    const claimedI = resultsI.filter(r => r === 'CLAIMED').length;
    const activeI = resultsI.filter(r => r === 'PROCESSING_ACTIVE').length;
    console.log(`CLAIMED count: ${claimedI} (Expected: 1)`);
    console.log(`PROCESSING_ACTIVE count: ${activeI} (Expected: 4)`);
    if (claimedI !== 1 || activeI !== 4) {
      throw new Error(`TEST I FAILED: Transaction isolation failed under load! Claimed: ${claimedI}, Active: ${activeI}`);
    }

    // -------------------------------------------------------------
    // TEST J — DIFFERENT EVENTS ARE INDEPENDENT
    // -------------------------------------------------------------
    console.log("\n--- TEST J: INDEPENDENT EVENTS ---");
    const eventIdJ1 = `test_evt_ind_1_${Date.now()}`;
    const eventIdJ2 = `test_evt_ind_2_${Date.now()}`;
    cleanups.push(async () => {
      await db.collection('stripe_events').doc(eventIdJ1).delete().catch(() => {});
      await db.collection('stripe_events').doc(eventIdJ2).delete().catch(() => {});
    });

    const claimJ1 = await claimStripeEventServer(eventIdJ1, "checkout.session.completed");
    const claimJ2 = await claimStripeEventServer(eventIdJ2, "checkout.session.completed");
    console.log(`Event J1: ${claimJ1}, Event J2: ${claimJ2} (Expected: CLAIMED, CLAIMED)`);
    if (claimJ1 !== 'CLAIMED' || claimJ2 !== 'CLAIMED') {
      throw new Error("TEST J FAILED: Independent events must be processed independently without interference");
    }

    console.log("\n✅ ALL FASE 0.5 RECOVERY TESTS PASSED SUCCESSFULLY! ZERO ANOMALIES DETECTED.\n");

  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  } finally {
    console.log("Running cleanups to guarantee Zero Mock Data in production...");
    for (const cleanup of cleanups) {
      await cleanup().catch(e => console.error("Error in cleanup:", e));
    }
    console.log("Cleanups completed.\n");
    process.exit(0);
  }
}

runTests();
