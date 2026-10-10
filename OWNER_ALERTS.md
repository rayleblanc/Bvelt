# Bvelt Owner Alerts (Telegram & Discord)

Bvelt includes built-in real-time owner notifications for new Pro trials and paid subscription activations.

---

## 1. Setting up Telegram Bot (Primary)

1. Open Telegram and search for **@BotFather**.
2. Send the command `/newbot` and follow the prompts to name your bot and choose a username (e.g., `BveltAlertsBot`).
3. BotFather will provide an **HTTP API Token** (e.g., `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
4. Start a chat with your new bot and send any message (e.g., `Hello`).
5. Retrieve your Chat ID by visiting your browser or running curl:
   ```bash
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
6. Look for `"chat":{"id":123456789,...}` in the JSON response to find your `chat_id`.

---

## 2. Setting up Discord Webhook (Optional)

1. In your Discord server, go to **Server Settings** > **Integrations** > **Webhooks**.
2. Click **New Webhook**, select the target channel, and copy the **Webhook URL**.

---

## 3. Configuring Environment Variables

Add the following environment variables to your Cloudflare Worker / Vercel / Server environment (`.env` or Cloudflare dashboard):

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_telegram_chat_id
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... # Optional
```

*Note: If these variables are not configured, notifications are silently skipped (fail-open).*

---

## 4. Events Monitored

- **🟡 Bvelt TRIAL 3 días**: Triggered once per user when they activate their 3-day Pro trial.
- **✅ Bvelt PAGO**: Triggered when a customer completes a checkout session (`checkout.session.completed` or verify session) for Pro Monthly ($49) or Pro Annual ($390).
- **❌ Bvelt PAGO FALLIDO**: Triggered when a subscription invoice payment fails (`invoice.payment_failed`).

---

## 5. Testing Without Real Money

1. Set test mode Stripe keys (`sk_test_...`) or use Stripe CLI test webhooks:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger invoice.payment_failed
   ```
2. Activate a test trial in the Bvelt UI to verify the Telegram trial alert arrives instantly.

---

## 6. Firebase Admin Credentials (Production Persistence)

To enable persistent Firestore usage counters and avoid in-memory degraded mode, the backend requires a service account for Firebase project `localflowpro-20e3d` (matching the client app configuration).

Configure either:
- `FIREBASE_SERVICE_ACCOUNT` (or `FIREBASE_ADMIN_CREDENTIALS`): The stringified JSON of the service account key.
- `GOOGLE_APPLICATION_CREDENTIALS`: File path to `service-account.json` on disk.
- Ambient GCP Workload Identity / Cloud Run metadata service (automatic if deployed on GCP in project `localflowpro-20e3d`).

If omitted or invalid (UNAUTHENTICATED code 16), the server logs one single warning on startup and safely runs in in-memory degraded mode without throwing unhandled exceptions.
