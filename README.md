# Bvelt - Local Presence & Lead Generation Engine

## Plan Usage Guard & Anti-Abuse Protection

Bvelt enforces a daily quota governance system across all compute-intensive endpoints (Maps/Places/Overpass/Nominatim geo queries, Gemini/Groq LLM generations, Outreach drafts, and In-depth SEO audits) to protect external budgets, prevent scraping abuse, and hard-stop trial users before exceeding infrastructure limits.

---

### Endpoint Guard Inventory

| Endpoint | HTTP Method | PlanActionType | Guard Middleware / Edge Limiter | Guarded? | Authority / Source |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `/api/scan-maps` | POST | `scan` | `scanUsageGuard`, `scanRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/reparar-perfil` | POST | `scan` | `scanUsageGuard`, `scanRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/business-scan` | POST | `scan` | `scanUsageGuard`, `scanRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/audit` | POST | `scan` | `scanUsageGuard`, `scanRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/geocode` | GET | `scan` | `scanUsageGuard`, `scanRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/places` | GET | `scan` | `scanUsageGuard`, `scanRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/service-area` | GET | `scan` | `scanUsageGuard`, `scanRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/geolocalizar` | GET | `scan` | `scanUsageGuard` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/nominatim` | GET | `scan` | `scanUsageGuard` (reverse exempt, search guarded) | **YES** | Memory Cache + Firestore counter |
| `/api/ai/generate` | POST | `ai` | `aiUsageGuard`, `aiRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/ai/router` | POST | `ai` | `aiUsageGuard`, `aiRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/ai/groq` | POST | `ai` | `aiUsageGuard`, `aiRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/generate-lead-pitch` | POST | `ai` | `aiUsageGuard`, `aiRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/generar-audio` | POST | `ai` | `aiUsageGuard`, `aiRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/send-email` | POST | `outreach` | `outreachUsageGuard` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/batch-outreach` | POST | `outreach` | `outreachUsageGuard`, `heavyToolRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/send-whatsapp` | POST | `outreach` | `outreachUsageGuard` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/messaging/send` | POST | `outreach` | `outreachUsageGuard` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/ai-visibility/audit` | POST | `heavy_audit` | `auditUsageGuard`, `heavyToolRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/niche-benchmark` | POST | `heavy_audit` | `auditUsageGuard`, `heavyToolRateLimiter` | **YES** | Firestore `usage_counters` / IP fallback |
| `/api/plan/usage` | GET | *all* | `getPlanUsageStatusHandler` | **YES** | Live consumption metrics & limits |

---

### Verification Checklist: How to Verify `LIMIT_REACHED`

Follow these verification steps to test the hard-stop limit and upgrade modal flow:

#### Step 1: Temporarily set `maxScansPerDay = 1` for Trial tier
In `src/lib/planLimits.ts`:
```ts
// src/lib/planLimits.ts
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  trial: {
    tier: 'trial',
    // ...
    maxScansPerDay: 1, // <--- Temporarily change from 5 to 1
    // ...
  }
};
```

#### Step 2: Trigger the first scan (Accepted Request)
1. Open the application on mobile or desktop: `http://localhost:3000`.
2. Ensure you are on a Trial account (or signed out as anonymous).
3. Run a Market Scan (e.g. from the Radar section or the Top Hero CTA).
4. Verify the scan succeeds. The response header returns `X-RateLimit-Remaining: 0`.

#### Step 3: Trigger the second scan (Hard Stop)
1. Click the Scan button again.
2. Verify:
   - The network request to `/api/places`, `/api/scan-maps`, or `/api/nominatim` returns **HTTP 429 Too Many Requests**.
   - The response payload matches the standard structure:
     ```json
     {
       "code": "LIMIT_REACHED",
       "error": "LIMIT_REACHED",
       "message": "You have reached your daily trial limit for market scans (1/1 used today). Upgrade to Bvelt Pro to lift your quotas.",
       "upgrade": true,
       "action": "scan",
       "limit": 1,
       "current": 1,
       "remaining": 0,
       "plan": "trial",
       "resetAt": "..."
     }
     ```
   - The **PlanLimitModal** automatically opens on the user's screen.
   - The modal shows:
     - Clear explanation: "Has alcanzado el límite diario de tu plan / You've reached your daily trial limit".
     - Action category: "Escaneos de Mercado Local / Local Market Scans".
     - Comparison of Trial (1/day) vs Bvelt Pro (60/day).
     - Direct CTA: "Mejorar a Bvelt Pro / Upgrade to Bvelt Pro" connecting straight to Stripe Checkout.
     - Secondary CTA: "Ver todos los planes / View All Plans".

#### Step 4: Verify Settings Quotas Display
1. Navigate to Settings -> "Cuotas de Uso y Límites de Plan / Usage Quotas & Plan Limits".
2. Confirm the 4 meters display live consumption:
   - **Market Scans**: `1 / 1` used (`0 left today`)
   - **AI Generations**: `0 / 15` used
   - **Outreach Drafts**: `0 / 10` used
   - **In-Depth Audits**: `0 / 3` used

#### Step 5: Restore production defaults
Revert `maxScansPerDay: 5` in `src/lib/planLimits.ts`.

---

## AI Cascade & Complexity-Based Routing

Bvelt uses a central AI Router (`callNodeAiText` on server / `callCloudflareAiText` on Cloudflare Edge) that routes requests based on task complexity rather than hardcoding Groq or Gemini everywhere.

### Task Cascade Order & Weights Table

| TaskType | Preferred Primary | Secondary Fallback | Tertiary Fallback | Credit Weight |
| :--- | :--- | :--- | :--- | :---: |
| `copy_short`, `pitch`, `generic` | Groq `llama-3.1-8b-instant` | Gemini `gemini-3.5-flash-lite` | Gemini `gemini-3.7-flash` | **1** |
| `rank_actions`, `diagnosis_rewrite`, `scan_summary` | Gemini `gemini-3.7-flash` | Gemini `gemini-3.5-flash-lite` | Groq `llama-3.1-8b-instant` | **1-2** |
| `business_scan`, `audit`, `ai_visibility`, `niche_benchmark` | Gemini `gemini-3.7-flash` | Gemini `gemini-3.8-flash` | Gemini `gemini-3.5-flash-lite` | **2-3** |

*Note: Studio must NOT set Groq primary for deep audit/scan paths. Groq is reserved as primary only for short copy, pitch, and generic fast tasks when GROQ_API_KEY is configured.*

