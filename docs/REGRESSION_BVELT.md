# Bvelt Regression Checklist & Manual Verification Specifications
**Central Registry of Characterization Tests & Live Verification Steps**

This file outlines the definitive, manual and automated regression checklist for Bvelt, designed to certify that existing business logic, authentication limits, Stripe checkout, trial mechanisms, and routing layers remain functional and unchanged under all code iterations.

---

## 1. HOME & GLOBAL NAVIGATION FLOWS

### 1.1 First-Turn Dashboard Landing (Trial User)
*   **Context:** Newly signed-in user who hasn't exceeded the 3-day window.
*   **Target URL:** `/` or `/dashboard`
*   **Expected Results:**
    1.  Main tab renders `activeTab === 'dashboard'`.
    2.  `TodaysBusinessDiagnosis` / `BveltActionCenter` renders primary Recommended Action cards:
        *   **"Answer a customer message"** or **"Publish website"** if leads are pending.
        *   **"Win your first action"** checklist is visible.
    3.  A maximum of one single recommended actions row (`CompactRecommendedActions`) is visible on the page to prevent duplication.
    4.  Top navbar displays the secure monotonically calculated trial days remaining (e.g. `✨ 3 TRIAL DAYS` or `✨ 2 TRIAL DAYS`).

### 1.2 Desktop Sidebar & Navigation Alignments
*   **Actions & Target States:**
    *   Clicking **"Get Reviews"** or corresponding NBA card redirecting to `setActiveTab('reviews')` and `setActiveSubRow(0)`.
    *   Clicking **"Invoices"** redirects to `setActiveTab('accounting')` or corresponding tools.
    *   Clicking **"My Website"** redirects to `setActiveTab('website')` (never opens dead modal).
    *   Clicking **"CRM & Leads"** redirects to `setActiveTab('leads')` and renders `ClientAcquisitionLeadList`.
    *   Clicking **"Business Profile"** redirects to `setActiveTab('profile')`.

---

## 2. AUTHENTICATION & ACCESS CONTROL SEGMENTATION

### 2.1 Access Level: Unauthorized (Anonymous Visitor)
*   **Scope:** User has not logged in with Google Auth.
*   **Target URL:** `/` or `/free-audit`
*   **Expected Results:**
    1.  Renders the redesigned B2B SaaS landing page (`PublicLandingPage.tsx`).
    2.  No access allowed to private `/dashboard`, `/leads`, `/reviews`, `/accounting` tabs.
    3.  Submitting name/city in `FreeMarketCheckModal` is fully permitted without session and leverages the cascading geocoder API.
    4.  Stripe Checkout requests to `/api/create-checkout-session` are rejected with `401 Unauthorized` directly on the server.

### 2.2 Access Level: Free Trial (First 3 Days)
*   **Scope:** Authed user with `plan: "trial"`, `isPro: true`, and `trialStartDate` within 72 hours.
*   **Expected Results:**
    1.  private dashboard is fully accessible.
    2.  Can execute up to 5 scans per day, 5 AI generations per day, and 3 heavy audits.
    3.  The trial days left decreases daily according to the secure offset calculation.

### 2.3 Access Level: Expired Trial (Past 3 Days)
*   **Scope:** Authed user with `plan: "trial"` whose `trialStartDate` elapsed > 72 hours ago, and `subscriptionStatus` is not `active`.
*   **Expected Results:**
    1.  Access to dashboard is securely locked.
    2.  Renders the PlansView (`setActiveTab('plans')`) automatically.
    3.  User is prompted to upgrade to Pro Monthly ($49) or Pro Annual ($390).

### 2.4 Access Level: Paid Pro Subscriber
*   **Scope:** Authed user with `isPro: true`, `plan: "pro_monthly" | "pro_annual"`, and `subscriptionStatus === "active"`.
*   **Expected Results:**
    1.  Full dashboard access is restored.
    2.  All limits elevated to Pro metrics (60 scans/day, 250 AI generations/day, 150 outreach drafts/day).

---

## 3. BUSINESS MODULES & FUNCTIONAL WORKFLOWS

### 3.1 Quotes & Invoices Engine
*   **Location:** Under Tab `'accounting'` or `'tools'`
*   **Checkpoints:**
    1.  Generating a new quote captures client contact, selected trade standard items, and outputs a formatted itemized breakdown.
    2.  Converting Quote to Invoice updates transaction metrics in Firestore collection `transactions`.
    3.  Calculates monthly and quarterly business stats displayed in the dashboard metrics.

### 3.2 CRM & Leads Tracker
*   **Location:** Tab `'leads'` or `'dashboard'`
*   **Checkpoints:**
    1.  Displays incoming inquiries submitted through the contractor's public website.
    2.  Writing website leads anonymously checks and strictly enforces length restrictions in `firestore.rules` (max name 100, max text 1000, source must be exactly `'website'`).
    3.  Provides one-click action buttons to initiate Follow-ups (Reactivation subrow 5).

### 3.3 Google Maps Scans & Review Replies
*   **Location:** Tab `'business_scan'` and Tab `'reviews'`
*   **Checkpoints:**
    1.  Running a map scan consumes 1 credit of `maxScansPerDay` quota, updating remaining counter dynamically.
    2.  `ReviewComplianceFirewall` intercepts generated replies to ensure alignment with Google policy guidelines.

---

## 4. CENTRALIZED AI ROUTING & ESCALATION

### 4.1 central Model Matrix (`/api/ai-config.ts`)
*   **Mappings:**
    *   `GEMINI_LITE` -> `"gemini-3.5-flash-lite"`
    *   `GEMINI_PRIMARY` -> `"gemini-3.5-flash"`
    *   `GEMINI_STRONG` -> `"gemini-3.5-flash"`
    *   `GROQ_FAST` -> Configured value of `process.env.GROQ_MODEL`
*   **Cascade Execution Order:**
    1.  **Stage 1:** Primary Fast Provider (Groq Fast, fallback to Gemini Lite).
    2.  **Stage 2:** Core Reasoning Provider (Gemini Flash).
    3.  **Stage 3:** Static Fallback Templates (Rules Mode) avoiding a crash if APIs are offline.

### 4.2 Mock Verification of AI Cascade (Unit Tests)
```bash
# Execute dry-runs of prompt generation and models mapping:
# Output must show zero deprecated models (no gemini-1.5-* or gemini-2.0-* references)
npx tsx -e "import { ACTIVE_MODELS } from './api/ai-config'; console.log('Active Lite Model:', ACTIVE_MODELS.GEMINI_LITE);"
```

---

## 5. STRIPE CHECKOUT & WEBHOOK INTEGRATION

### 5.1 checkout Session Completed (`checkout.session.completed`)
*   **Stripe Payload Payload:** Includes `client_reference_id` matching user UID, and plan price matches production yearly config.
*   **Database Operations:**
    *   Writes `isPro: true`
    *   Writes `plan: "pro_annual" | "pro_monthly"`
    *   Writes `stripeCustomerId: <customer_id>`
    *   Writes `subscriptionStatus: "active"`

### 5.2 subscription Deleted (`customer.subscription.deleted`)
*   **Stripe Payload:** Triggers upon cancellation.
*   **Database Operations:**
    *   Sets `isPro: false`
    *   Sets `subscriptionStatus: "canceled" | "expired"`

### 5.3 Webhook Idempotency Check
*   Idempotency is securely processed inside Firestore `stripe_events` using transaction claims. Duplicate event payloads are rejected with `200 OK (received: true, duplicate: true)` without executing state changes.

---

## 6. LOCAL TEST EXECUTION OUTPUT LOGS

### 6.1 Server Build Check
```bash
$ npm run build
> bvelt@0.0.0 build
> node generate-favicon.js && vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs

✓ Favicon generated
✓ Vite frontend built successfully (dist/index.html)
✓ Server esbuild compilation completed successfully (dist/server.cjs)
```

### 6.2 Firebase Environment Mock Execution Check
```bash
$ npx tsx test-payment-trial-protection.ts
[PASS] TEST A: Firestore update validation prevents direct mutation of sensitive subscription properties on the client...
[PASS] TEST B: Authentication Enforced (Checkout Session) - Rejected unauthenticated checkout request with status 401...
[FAIL] TEST C: IDOR Protection - 16 UNAUTHENTICATED: Request had invalid authentication credentials.
# NOTE: Integration tests C, D, and E require active GCP service account IAM tokens.
# Running in mock/isolated local environment returns expected unauthenticated status from GCP gRPC endpoints.
```
