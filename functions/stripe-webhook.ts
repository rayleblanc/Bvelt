/**
 * Cloudflare Pages Functions Handler for root /stripe-webhook
 */
import { handleStripeWebhook } from "./lib/cloudflareStripe.ts";

export async function onRequestPost(context: { request: Request; env: any }): Promise<Response> {
  return handleStripeWebhook(context.request, context.env);
}
