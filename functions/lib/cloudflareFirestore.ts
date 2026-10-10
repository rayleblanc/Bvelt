/**
 * Lightweight, zero-dependency Firestore REST Client for Cloudflare Workers & Pages Functions.
 * Uses Web Crypto (crypto.subtle) to sign Google Service Account JWTs and update documents.
 * 100% compatible with Cloudflare edge runtime, zero Node.js gRPC or native dependencies.
 */

interface ServiceAccountKey {
  project_id: string;
  private_key: string;
  client_email: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function pemToBinary(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(cleanPem);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buffer[i] = raw.charCodeAt(i);
  }
  return buffer.buffer;
}

export async function getGoogleOAuthToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encClaim = btoa(JSON.stringify(claimSet)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedJwt = `${encHeader}.${encClaim}`;

  const binaryKey = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const encSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signedJwt = `${unsignedJwt}.${encSignature}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt
    })
  });

  if (!tokenResp.ok) {
    const errorText = await tokenResp.text();
    throw new Error(`Failed to obtain Google OAuth token: ${errorText}`);
  }

  const tokenData = (await tokenResp.json()) as any;
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600)
  };

  return tokenData.access_token;
}

/**
 * Updates a user profile in Firestore directly using the Google Cloud Firestore REST API.
 */
export async function updateFirestoreUserProfile(
  env: any,
  userId: string,
  data: {
    isPro: boolean;
    plan: string;
    stripeCustomerId: string;
    subscriptionStatus: string;
    hasUsedTrial?: boolean;
  }
): Promise<boolean> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (!credsStr) {
    console.warn("[Cloudflare Firestore] No FIREBASE_SERVICE_ACCOUNT binding provided.");
    return false;
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
  } catch (err) {
    console.error("[Cloudflare Firestore] Failed to parse service account JSON:", err);
    return false;
  }

  const projectId = serviceAccount.project_id;
  if (!projectId) return false;

  try {
    const token = await getGoogleOAuthToken(serviceAccount);
    let updateMask = "updateMask.fieldPaths=isPro&updateMask.fieldPaths=plan&updateMask.fieldPaths=stripeCustomerId&updateMask.fieldPaths=subscriptionStatus&updateMask.fieldPaths=updatedAt";
    if (data.hasUsedTrial !== undefined) {
      updateMask += "&updateMask.fieldPaths=hasUsedTrial";
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/profiles/${userId}?${updateMask}`;

    const fields: any = {
      isPro: { booleanValue: data.isPro },
      plan: { stringValue: data.plan },
      stripeCustomerId: { stringValue: data.stripeCustomerId || "" },
      subscriptionStatus: { stringValue: data.subscriptionStatus || "active" },
      updatedAt: { stringValue: new Date().toISOString() }
    };
    if (data.hasUsedTrial !== undefined) {
      fields.hasUsedTrial = { booleanValue: data.hasUsedTrial };
    }

    const body = {
      fields
    };

    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[Cloudflare Firestore] REST update failed:", errText);
      return false;
    }

    console.log(`[Cloudflare Firestore] Successfully updated subscription for user: ${userId}`);
    return true;
  } catch (err: any) {
    console.error("[Cloudflare Firestore] Error updating document:", err.message || err);
    return false;
  }
}

/**
 * Updates or creates a recovery fee record in Firestore REST API.
 */
export async function updateFirestoreRecoveryFee(
  env: any,
  userId: string,
  opportunityId: string,
  data: {
    status: string;
    paidAt: string;
    fixedFee: number;
    stripeSessionId?: string;
    paymentMethod?: string;
    notes?: string;
  }
): Promise<boolean> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (!credsStr) {
    console.warn("[Cloudflare Firestore] No FIREBASE_SERVICE_ACCOUNT provided for recovery fee update.");
    return false;
  }

  try {
    const serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
    const projectId = serviceAccount.project_id || getFirestoreProjectId(env);
    const token = await getGoogleOAuthToken(serviceAccount);
    const docId = `rec_${opportunityId || Date.now()}`;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recovery_fees/${docId}`;

    const fields: any = {
      id: { stringValue: docId },
      opportunityId: { stringValue: opportunityId || "" },
      businessId: { stringValue: userId || "default_business" },
      status: { stringValue: data.status || "paid" },
      paidAt: { stringValue: data.paidAt },
      fixedFee: { integerValue: String(data.fixedFee || 19) },
      stripeSessionId: { stringValue: data.stripeSessionId || "" },
      paymentMethod: { stringValue: data.paymentMethod || "stripe_card" },
      updatedAt: { stringValue: new Date().toISOString() }
    };

    if (data.notes) {
      fields.notes = { stringValue: data.notes };
    }

    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn("[Cloudflare Firestore] Recovery fee REST update error:", errText);
      return false;
    }

    console.log(`[Cloudflare Firestore] Successfully recorded recovery fee for opportunity: ${opportunityId} (User: ${userId})`);
    return true;
  } catch (err: any) {
    console.error("[Cloudflare Firestore] Error updating recovery fee in Firestore:", err?.message || err);
    return false;
  }
}

/**
 * Checks if a crypto transaction hash (txHash) has already been redeemed in Firestore.
 */
export async function isCryptoTxHashRedeemed(env: any, txHash: string): Promise<boolean> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (!credsStr) return false;

  try {
    const serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
    const projectId = serviceAccount.project_id || getFirestoreProjectId(env);
    const token = await getGoogleOAuthToken(serviceAccount);
    const cleanHash = txHash.toLowerCase().trim();
    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/crypto_tx_hashes/${encodeURIComponent(cleanHash)}`;

    const resp = await fetch(docUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });

    return resp.status === 200;
  } catch (err) {
    console.warn("[Cloudflare Firestore] Error checking crypto tx hash in Firestore:", err);
    return false;
  }
}

/**
 * Persists a redeemed crypto transaction hash in Firestore (crypto_tx_hashes/{txHash}).
 */
export async function recordCryptoTxHash(
  env: any,
  txHash: string,
  data: {
    orderId: string;
    userId: string;
    plan: string;
    timestamp?: number;
  }
): Promise<boolean> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (!credsStr) return false;

  try {
    const serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
    const projectId = serviceAccount.project_id || getFirestoreProjectId(env);
    const token = await getGoogleOAuthToken(serviceAccount);
    const cleanHash = txHash.toLowerCase().trim();
    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/crypto_tx_hashes/${encodeURIComponent(cleanHash)}`;
    const nowIso = new Date().toISOString();

    const body = {
      fields: {
        txHash: { stringValue: cleanHash },
        orderId: { stringValue: data.orderId },
        userId: { stringValue: data.userId || "guest_user" },
        plan: { stringValue: data.plan || "monthly" },
        redeemedAt: { stringValue: nowIso },
        timestamp: { integerValue: String(data.timestamp || Date.now()) }
      }
    };

    const resp = await fetch(docUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn("[Cloudflare Firestore] Failed to record crypto tx hash:", errText);
      return false;
    }

    console.log(`[Cloudflare Firestore] Successfully recorded crypto tx hash ${cleanHash} for order ${data.orderId}`);
    return true;
  } catch (err) {
    console.error("[Cloudflare Firestore] Error recording crypto tx hash in Firestore:", err);
    return false;
  }
}

/**
 * Converts a JavaScript value to Firestore REST API field format.
 */
export function jsToFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = jsToFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Converts a Firestore REST API field value to a plain JavaScript value.
 */
export function parseFirestoreValue(fieldObj: any): any {
  if (!fieldObj || typeof fieldObj !== 'object') return null;
  if ('stringValue' in fieldObj) return fieldObj.stringValue;
  if ('integerValue' in fieldObj) return parseInt(fieldObj.integerValue, 10);
  if ('doubleValue' in fieldObj) return parseFloat(fieldObj.doubleValue);
  if ('booleanValue' in fieldObj) return fieldObj.booleanValue;
  if ('timestampValue' in fieldObj) return fieldObj.timestampValue;
  if ('nullValue' in fieldObj) return null;
  if ('geoPointValue' in fieldObj) {
    return { lat: fieldObj.geoPointValue.latitude, lng: fieldObj.geoPointValue.longitude };
  }
  if ('arrayValue' in fieldObj) {
    const values = fieldObj.arrayValue.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in fieldObj) {
    const res: Record<string, any> = {};
    const fields = fieldObj.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = parseFirestoreValue(v);
    }
    return res;
  }
  return null;
}

export function parseFirestoreDocument(docData: any): Record<string, any> {
  const result: Record<string, any> = {};
  const fields = docData.fields || {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = parseFirestoreValue(v);
  }
  return result;
}

export function getFirestoreProjectId(env: any): string {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (credsStr) {
    try {
      const parsed = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
      if (parsed.project_id) return parsed.project_id;
    } catch {}
  }
  return 'localflowpro-20e3d';
}

/**
 * Reads a single document from Firestore REST API.
 */
export async function getFirestoreDoc(env: any, collection: string, docId: string): Promise<Record<string, any> | null> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = getFirestoreProjectId(env);
  
  let token = "";
  if (credsStr) {
    try {
      const sa = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
      token = await getGoogleOAuthToken(sa);
    } catch (e) {
      console.warn("[Cloudflare Firestore] Failed to generate auth token:", e);
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error(`Firestore get error: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  return parseFirestoreDocument(data);
}

/**
 * Writes/patches a single document in Firestore via REST API.
 */
export async function setFirestoreDoc(
  env: any,
  collection: string,
  docId: string,
  data: Record<string, any>,
  merge = true
): Promise<boolean> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (!credsStr) {
    console.warn("[Cloudflare Firestore] No FIREBASE_SERVICE_ACCOUNT binding provided for setFirestoreDoc.");
    return false;
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
  } catch (err) {
    console.error("[Cloudflare Firestore] Failed to parse service account JSON:", err);
    return false;
  }

  const projectId = serviceAccount.project_id || getFirestoreProjectId(env);
  const token = await getGoogleOAuthToken(serviceAccount);

  const fields: Record<string, any> = {};
  const fieldPaths: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = jsToFirestoreValue(v);
      fieldPaths.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
    }
  }

  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  if (merge && fieldPaths.length > 0) {
    url += `?${fieldPaths.join('&')}`;
  }

  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[Cloudflare Firestore] REST set/patch failed:", errText);
    return false;
  }

  return true;
}

/**
 * Atomically attempts to claim a Stripe event ID in Firestore to ensure persistent idempotency.
 * Uses POST with documentId query parameter for create-if-absent.
 * Handles COMPLETED (duplicate), fresh PROCESSING (duplicate/active), and FAILED / stale PROCESSING (CAS reclaim).
 */
export async function claimStripeEvent(
  env: any,
  eventId: string,
  eventType: string
): Promise<'CLAIMED' | 'COMPLETED_DUPLICATE' | 'PROCESSING_ACTIVE' | 'FAILED_RECORD' | 'DUPLICATE' | 'ERROR'> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (!credsStr) {
    console.warn("[Cloudflare Firestore] No FIREBASE_SERVICE_ACCOUNT binding provided for claimStripeEvent.");
    return 'ERROR';
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
  } catch (err) {
    console.error("[Cloudflare Firestore] Failed to parse service account JSON:", err);
    return 'ERROR';
  }

  const projectId = serviceAccount.project_id || getFirestoreProjectId(env);
  let token = "";
  try {
    token = await getGoogleOAuthToken(serviceAccount);
  } catch (err) {
    console.error("[Cloudflare Firestore] Failed to get OAuth token for claimStripeEvent:", err);
    return 'ERROR';
  }

  const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stripe_events/${encodeURIComponent(eventId)}`;
  const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stripe_events?documentId=${encodeURIComponent(eventId)}`;

  const nowIso = new Date().toISOString();
  const createBody = {
    fields: {
      eventId: { stringValue: eventId },
      eventType: { stringValue: eventType },
      status: { stringValue: "PROCESSING" },
      createdAt: { stringValue: nowIso },
      updatedAt: { stringValue: nowIso }
    }
  };

  try {
    // 1. Try atomic create-if-absent (POST)
    const resp = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createBody)
    });

    if (resp.ok || resp.status === 201) {
      return 'CLAIMED';
    }

    if (resp.status === 409) {
      return await inspectAndReclaimEvent(token, docUrl, eventId, nowIso);
    }

    const errText = await resp.text();
    if (resp.status === 409 || errText.includes('AlreadyExists') || errText.includes('already exists')) {
      return await inspectAndReclaimEvent(token, docUrl, eventId, nowIso);
    }

    console.error("[Cloudflare Firestore] Failed to claim stripe event:", errText);
    return 'ERROR';
  } catch (err: any) {
    console.error("[Cloudflare Firestore] Error claiming stripe event:", err);
    return 'ERROR';
  }
}

async function inspectAndReclaimEvent(
  token: string,
  docUrl: string,
  eventId: string,
  nowIso: string
): Promise<'CLAIMED' | 'COMPLETED_DUPLICATE' | 'PROCESSING_ACTIVE' | 'FAILED_RECORD' | 'DUPLICATE' | 'ERROR'> {
  try {
    const getResp = await fetch(docUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!getResp.ok) {
      console.error("[Cloudflare Firestore] Failed to fetch existing stripe event doc:", await getResp.text());
      return 'ERROR';
    }

    const docData = (await getResp.json()) as any;
    const fields = docData.fields || {};
    const status = fields.status?.stringValue || "PROCESSING";
    const updatedAt = fields.updatedAt?.stringValue || fields.createdAt?.stringValue || new Date(0).toISOString();
    const updateTime = docData.updateTime;

    if (status === "COMPLETED") {
      return 'COMPLETED_DUPLICATE';
    }

    const isFailed = status === "FAILED";
    const ageMs = Date.now() - new Date(updatedAt).getTime();
    const STALE_LEASE_MS = 10 * 60 * 1000; // 10 minutes lease timeout
    const isStaleProcessing = status === "PROCESSING" && ageMs > STALE_LEASE_MS;

    if (!isFailed && !isStaleProcessing) {
      return 'PROCESSING_ACTIVE';
    }

    // Attempt atomic CAS update to claim via PATCH with currentDocument.updateTime
    const patchUrl = `${docUrl}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`;
    const patchBody = {
      fields: {
        status: { stringValue: "PROCESSING" },
        updatedAt: { stringValue: nowIso }
      },
      currentDocument: {
        updateTime: updateTime
      }
    };

    const patchResp = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patchBody)
    });

    if (patchResp.ok) {
      console.log(`[Cloudflare Firestore] Successfully reclaimed stale/failed stripe event via CAS: ${eventId}`);
      return 'CLAIMED';
    }

    if (patchResp.status === 400 || patchResp.status === 409 || patchResp.status === 412) {
      console.log(`[Cloudflare Firestore] CAS reclaim conflict (already claimed): ${eventId}`);
      return 'PROCESSING_ACTIVE';
    }

    console.error("[Cloudflare Firestore] Failed to CAS reclaim stripe event:", await patchResp.text());
    return 'ERROR';
  } catch (err) {
    console.error("[Cloudflare Firestore] Error inspecting/reclaiming stripe event:", err);
    return 'ERROR';
  }
}

/**
 * Updates the status of a claimed stripe event.
 */
export async function updateStripeEventStatus(
  env: any,
  eventId: string,
  status: string
): Promise<boolean> {
  return setFirestoreDoc(env, 'stripe_events', eventId, {
    status,
    updatedAt: new Date().toISOString()
  }, true);
}

let cachedJwks: { keys: any[]; expiresAt: number } | null = null;

async function getGooglePublicKeys(): Promise<any[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const resp = await fetch("https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com");
  if (!resp.ok) {
    throw new Error("Failed to fetch Google public JWKs");
  }

  const jwks = (await resp.json()) as any;
  const keys = jwks.keys || [];
  
  cachedJwks = {
    keys,
    expiresAt: now + 6 * 60 * 60 * 1000 // Cache for 6 hours
  };

  return keys;
}

/**
 * Decodes and cryptographically verifies a Firebase ID Token using standard Web Crypto APIs on the edge.
 * Returns the decoded sub (user UID) if valid, or null if invalid.
 */
export async function verifyFirebaseIdToken(env: any, idToken: string): Promise<string | null> {
  if (!idToken) return null;

  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const decodeB64 = (str: string) => {
      let clean = str.replace(/-/g, "+").replace(/_/g, "/");
      while (clean.length % 4) clean += "=";
      return atob(clean);
    };

    const header = JSON.parse(decodeB64(headerB64));
    const payload = JSON.parse(decodeB64(payloadB64));

    const projectId = getFirestoreProjectId(env);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      console.warn("[JWT Verification] Issuer mismatch:", payload.iss);
      return null;
    }
    if (payload.aud !== projectId) {
      console.warn("[JWT Verification] Audience mismatch:", payload.aud);
      return null;
    }
    if (payload.exp < nowSeconds - 60) {
      console.warn("[JWT Verification] Token expired:", payload.exp);
      return null;
    }

    const kid = header.kid;
    if (!kid) return null;

    const jwks = await getGooglePublicKeys();
    const jwk = jwks.find((k: any) => k.kid === kid);
    if (!jwk) {
      console.warn("[JWT Verification] Matching JWK not found for kid:", kid);
      return null;
    }

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(`${headerB64}.${payloadB64}`);

    const signatureRaw = atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/"));
    const signatureBuffer = new Uint8Array(signatureRaw.length);
    for (let i = 0; i < signatureRaw.length; i++) {
      signatureBuffer[i] = signatureRaw.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signatureBuffer,
      dataBuffer
    );

    if (!isValid) {
      console.warn("[JWT Verification] Crypto signature is invalid.");
      return null;
    }

    return payload.sub;
  } catch (err: any) {
    console.error("[JWT Verification] Token verification failed with error:", err.message || err);
    return null;
  }
}

/**
 * Commits multiple document writes in a single atomic transaction via Firestore REST API.
 */
export async function commitFirestoreBatch(
  env: any,
  writes: any[]
): Promise<boolean> {
  const credsStr = env.FIREBASE_SERVICE_ACCOUNT;
  if (!credsStr) {
    console.warn("[Cloudflare Firestore] No FIREBASE_SERVICE_ACCOUNT binding provided for commitFirestoreBatch.");
    return false;
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = typeof credsStr === 'string' ? JSON.parse(credsStr) : credsStr;
  } catch (err) {
    console.error("[Cloudflare Firestore] Failed to parse service account JSON:", err);
    return false;
  }

  const projectId = serviceAccount.project_id || getFirestoreProjectId(env);
  const token = await getGoogleOAuthToken(serviceAccount);

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ writes })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[Cloudflare Firestore] REST batch commit failed:", errText);
    return false;
  }

  return true;
}


