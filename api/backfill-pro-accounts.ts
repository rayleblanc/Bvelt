import { Request, Response } from "express";
import { getFirebaseAdminDB } from "./firebaseAdmin.ts";

function getAdminDb() {
  return getFirebaseAdminDB();
}

export async function runProAccountsBackfill(): Promise<{
  success: boolean;
  testAccountsMarked: string[];
  proAccountsFlaggedForEmail: string[];
  totalChecked: number;
}> {
  const db = getAdminDb();
  const testAccountsMarked: string[] = [];
  const proAccountsFlaggedForEmail: string[] = [];

  try {
    console.log("[Backfill Accounts] Starting verification and cleanup of Pro and Test accounts...");

    // 1. Explicitly flag and isolate known test accounts
    const knownTestIds = ['user_test_123', 'test_user_456'];
    for (const testId of knownTestIds) {
      const testDocRef = db.collection('profiles').doc(testId);
      const testSnap = await testDocRef.get();
      if (testSnap.exists) {
        await testDocRef.set({
          isTestAccount: true,
          isPro: false,
          subscriptionStatus: 'test',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        testAccountsMarked.push(testId);
        console.log(`[Backfill Accounts] Marked ${testId} as isTestAccount: true`);
      }
    }

    // 2. Scan all Pro profiles and identify any missing emails
    const proSnapshot = await db.collection('profiles').where('isPro', '==', true).get();
    let totalChecked = proSnapshot.size;

    for (const docSnap of proSnapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data() || {};
      const email = data.email || data.userEmail || data.contactEmail;

      if (uid.startsWith('user_test_') || data.isTestAccount === true) {
        if (!testAccountsMarked.includes(uid)) {
          await docSnap.ref.set({ isTestAccount: true, updatedAt: new Date().toISOString() }, { merge: true });
          testAccountsMarked.push(uid);
        }
        continue;
      }

      if (!email || email.trim() === '') {
        await docSnap.ref.set({
          needsEmailNotification: true,
          emailMissingWarning: true,
          auditStatus: 'EMAIL_REQUIRED',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        proAccountsFlaggedForEmail.push(uid);
        console.log(`[Backfill Accounts] Flagged Pro profile ${uid} (${data.name || 'Sin Nombre'}) for missing email.`);
      }
    }

    // 3. Specifically verify Km9lvypo64VLDyCAbFRPvqRHJzf1 and g6ZrFYqXoKcvW7KDctLjV3mfLSS2
    const targetAccounts = ['Km9lvypo64VLDyCAbFRPvqRHJzf1', 'g6ZrFYqXoKcvW7KDctLjV3mfLSS2'];
    for (const accId of targetAccounts) {
      const docRef = db.collection('profiles').doc(accId);
      const snap = await docRef.get();
      if (snap.exists) {
        const d = snap.data() || {};
        if (!d.email && !proAccountsFlaggedForEmail.includes(accId)) {
          await docRef.set({
            needsEmailNotification: true,
            emailMissingWarning: true,
            auditStatus: 'EMAIL_REQUIRED',
            updatedAt: new Date().toISOString()
          }, { merge: true });
          proAccountsFlaggedForEmail.push(accId);
        }
      }
    }

    console.log(`[Backfill Accounts] Completed. Test accounts marked: ${testAccountsMarked.length}, Pro without email: ${proAccountsFlaggedForEmail.length}`);
    return {
      success: true,
      testAccountsMarked,
      proAccountsFlaggedForEmail,
      totalChecked
    };
  } catch (error: any) {
    console.error("[Backfill Accounts Error]:", error);
    return {
      success: false,
      testAccountsMarked,
      proAccountsFlaggedForEmail,
      totalChecked: 0
    };
  }
}

export async function backfillAccountsHandler(req: Request, res: Response) {
  const result = await runProAccountsBackfill();
  return res.status(200).json(result);
}

export default backfillAccountsHandler;
