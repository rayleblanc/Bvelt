import assert from "node:assert";
import crypto from "node:crypto";
import { whatsAppWebhookGetHandler, whatsAppWebhookPostHandler, telegramWebhookPostHandler } from "./api/messaging.ts";
import { handleWhatsAppWebhook, handleTelegramWebhook, verifyWhatsAppSignature, verifyTelegramSecret } from "./functions/lib/cloudflareMessaging.ts";

console.log("=================================================");
console.log("🔒 BVELT WEBHOOK SECURITY & INTEGRITY TEST SUITE");
console.log("=================================================");

function createMockReqRes(options: {
  method?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: any;
}) {
  let statusCode = 200;
  let responseData: any = null;
  let headersSent: Record<string, string> = {};

  const req: any = {
    method: options.method || "POST",
    query: options.query || {},
    headers: options.headers || {},
    body: options.body || {}
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    send(data: any) {
      responseData = data;
      return res;
    },
    setHeader(name: string, value: string) {
      headersSent[name] = value;
      return res;
    }
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getResponseData: () => responseData
  };
}

async function runTests() {
  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: WHATSAPP GET HANDSHAKE VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] WhatsApp GET Handshake Verification");
    
    // 1.1 Without token configured on server -> 403
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    {
      const { req, res, getStatusCode } = createMockReqRes({
        method: "GET",
        query: { "hub.mode": "subscribe", "hub.verify_token": "random_token", "hub.challenge": "12345" }
      });
      await whatsAppWebhookGetHandler(req, res);
      assert.strictEqual(getStatusCode(), 403, "Must reject with 403 when verify token not configured");
    }

    // 1.2 With token mismatch -> 403
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "correct_secret_token_123";
    {
      const { req, res, getStatusCode } = createMockReqRes({
        method: "GET",
        query: { "hub.mode": "subscribe", "hub.verify_token": "wrong_token", "hub.challenge": "12345" }
      });
      await whatsAppWebhookGetHandler(req, res);
      assert.strictEqual(getStatusCode(), 403, "Must reject with 403 when token does not match");
    }

    // 1.3 With valid token -> 200 with challenge
    {
      const { req, res, getStatusCode, getResponseData } = createMockReqRes({
        method: "GET",
        query: { "hub.mode": "subscribe", "hub.verify_token": "correct_secret_token_123", "hub.challenge": "12345_meta_ok" }
      });
      await whatsAppWebhookGetHandler(req, res);
      assert.strictEqual(getStatusCode(), 200, "Must return 200 on valid handshake");
      assert.strictEqual(getResponseData(), "12345_meta_ok", "Must return matching challenge");
    }
    console.log("  ✅ WhatsApp GET handshake security passed");

    // -------------------------------------------------------------------------
    // TEST 2: WHATSAPP POST INBOUND WEBHOOK
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] WhatsApp POST Inbound Security");
    const testBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{
        id: "entry_1",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "123", phone_number_id: "phone_1" },
            messages: [{ id: "wam_1", from: "34600000000", timestamp: "1700000000", type: "text", text: { body: "Hola" } }]
          },
          field: "messages"
        }]
      }]
    });

    // 2.1 Without WHATSAPP_APP_SECRET -> 403 Fail-Closed
    delete process.env.WHATSAPP_APP_SECRET;
    {
      const { req, res, getStatusCode } = createMockReqRes({
        headers: { "x-hub-signature-256": "sha256=fake" },
        body: JSON.parse(testBody)
      });
      await whatsAppWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 403, "Must reject with 403 when WHATSAPP_APP_SECRET not configured");
    }

    // 2.2 Without signature header -> 401
    process.env.WHATSAPP_APP_SECRET = "whatsapp_secret_xyz789";
    {
      const { req, res, getStatusCode } = createMockReqRes({
        headers: {},
        body: JSON.parse(testBody)
      });
      await whatsAppWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 401, "Must reject with 401 when signature header missing");
    }

    // 2.3 With invalid signature header -> 401
    {
      const { req, res, getStatusCode } = createMockReqRes({
        headers: { "x-hub-signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000" },
        body: JSON.parse(testBody)
      });
      await whatsAppWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 401, "Must reject with 401 when HMAC signature invalid");
    }

    // 2.4 With valid HMAC-SHA256 signature -> 200
    const hmac = crypto.createHmac("sha256", "whatsapp_secret_xyz789");
    hmac.update(testBody);
    const validSig = `sha256=${hmac.digest("hex")}`;
    {
      const { req, res, getStatusCode, getResponseData } = createMockReqRes({
        headers: { "x-hub-signature-256": validSig },
        body: testBody
      });
      await whatsAppWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 200, "Must accept with 200 when HMAC signature is strictly valid");
      assert.strictEqual(getResponseData().received, 1, "Must normalize received messages");
    }
    console.log("  ✅ WhatsApp POST security passed");

    // -------------------------------------------------------------------------
    // TEST 3: TELEGRAM POST WEBHOOK
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Telegram POST Webhook Security");
    const testTelegramBody = {
      update_id: 1001,
      message: {
        message_id: 55,
        from: { id: 8888, is_bot: false, first_name: "Test" },
        chat: { id: 8888, type: "private" },
        date: 1700000000,
        text: "Mensaje de prueba"
      }
    };

    // 3.1 Without TELEGRAM_WEBHOOK_SECRET -> 403 Fail-Closed
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    {
      const { req, res, getStatusCode } = createMockReqRes({
        headers: { "x-telegram-bot-api-secret-token": "any_secret" },
        body: testTelegramBody
      });
      await telegramWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 403, "Must reject with 403 when TELEGRAM_WEBHOOK_SECRET not configured");
    }

    // 3.2 Without secret token header -> 401
    process.env.TELEGRAM_WEBHOOK_SECRET = "telegram_secret_token_abc";
    {
      const { req, res, getStatusCode } = createMockReqRes({
        headers: {},
        body: testTelegramBody
      });
      await telegramWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 401, "Must reject with 401 when secret token header is missing");
    }

    // 3.3 With invalid secret token header -> 401
    {
      const { req, res, getStatusCode } = createMockReqRes({
        headers: { "x-telegram-bot-api-secret-token": "wrong_secret_123" },
        body: testTelegramBody
      });
      await telegramWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 401, "Must reject with 401 when secret token does not match");
    }

    // 3.4 With valid secret token -> 200
    {
      const { req, res, getStatusCode, getResponseData } = createMockReqRes({
        headers: { "x-telegram-bot-api-secret-token": "telegram_secret_token_abc" },
        body: testTelegramBody
      });
      await telegramWebhookPostHandler(req, res);
      assert.strictEqual(getStatusCode(), 200, "Must accept with 200 when secret token matches");
      assert.strictEqual(getResponseData().received, 1, "Must normalize Telegram message");
    }
    console.log("  ✅ Telegram POST security passed");

    // -------------------------------------------------------------------------
    // TEST 4: CLOUDFLARE WORKER WEBHOOKS SECURITY (EDGE RUNTIME)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Cloudflare Worker Webhook Handlers");

    // 4.1 WhatsApp Cloudflare Worker: No secret -> 403
    {
      const req = new Request("https://bvelt.app/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "X-Hub-Signature-256": "sha256=fake" },
        body: testBody
      });
      const res = await handleWhatsAppWebhook(req, {});
      assert.strictEqual(res.status, 403, "Cloudflare WhatsApp must reject with 403 without secret");
    }

    // 4.2 WhatsApp Cloudflare Worker: No signature header -> 401
    {
      const req = new Request("https://bvelt.app/api/webhooks/whatsapp", {
        method: "POST",
        headers: {},
        body: testBody
      });
      const res = await handleWhatsAppWebhook(req, { WHATSAPP_APP_SECRET: "my_secret" });
      assert.strictEqual(res.status, 401, "Cloudflare WhatsApp must reject with 401 without signature");
    }

    // 4.3 WhatsApp Cloudflare Worker: Valid signature -> 200
    {
      const cfHmac = crypto.createHmac("sha256", "edge_secret_123").update(testBody).digest("hex");
      const req = new Request("https://bvelt.app/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "X-Hub-Signature-256": `sha256=${cfHmac}` },
        body: testBody
      });
      const res = await handleWhatsAppWebhook(req, { WHATSAPP_APP_SECRET: "edge_secret_123" });
      assert.strictEqual(res.status, 200, "Cloudflare WhatsApp must accept valid HMAC signature");
    }

    // 4.4 Telegram Cloudflare Worker: No secret -> 403
    {
      const req = new Request("https://bvelt.app/api/webhooks/telegram", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "test_token" },
        body: JSON.stringify(testTelegramBody)
      });
      const res = await handleTelegramWebhook(req, {});
      assert.strictEqual(res.status, 403, "Cloudflare Telegram must reject with 403 without secret");
    }

    // 4.5 Telegram Cloudflare Worker: Valid secret -> 200
    {
      const req = new Request("https://bvelt.app/api/webhooks/telegram", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "tg_edge_secret" },
        body: JSON.stringify(testTelegramBody)
      });
      const res = await handleTelegramWebhook(req, { TELEGRAM_WEBHOOK_SECRET: "tg_edge_secret" });
      assert.strictEqual(res.status, 200, "Cloudflare Telegram must accept valid secret token");
    }
    console.log("  ✅ Cloudflare Worker webhook security passed");

    console.log("\n=================================================");
    console.log("🎉 ALL WEBHOOK SECURITY TESTS PASSED SUCCESSFULLY");
    console.log("=================================================");
  } finally {
    process.env = originalEnv;
  }
}

runTests().catch(err => {
  console.error("❌ Webhook security test failed:", err);
  process.exit(1);
});
