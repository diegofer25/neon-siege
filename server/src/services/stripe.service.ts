/**
 * @fileoverview Stripe integration — Cloudflare Workers port.
 *
 * No lazy singleton: in Workers every request gets a fresh isolate,
 * so we instantiate Stripe per-request using env bindings.
 */

import Stripe from 'stripe';
import * as CreditModel from '../models/credit.model';

interface StripeEnv {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
}

function getStripe(env: StripeEnv): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new StripeServiceError('Stripe is not configured (missing STRIPE_SECRET_KEY)', 503);
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2022-11-15' as any,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  env: StripeEnv,
  userId: string,
  email: string | undefined,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; sessionId: string }> {
  if (!env.STRIPE_PRICE_ID) {
    throw new StripeServiceError('Stripe price not configured (missing STRIPE_PRICE_ID)', 503);
  }

  const stripe = getStripe(env);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(email ? { customer_email: email } : {}),
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    metadata: { userId, creditsAmount: '10' },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new StripeServiceError('Stripe did not return a checkout URL', 500);
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Verify Stripe webhook signature, process checkout.session.completed.
 */
export async function handleWebhook(
  env: StripeEnv,
  db: D1Database,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new StripeServiceError('Webhook secret not configured', 503);
  }

  const stripe = getStripe(env);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    throw new StripeServiceError(`Webhook signature verification failed: ${err.message}`, 400);
  }

  if (event.type !== 'checkout.session.completed') {
    return true; // Acknowledge non-relevant events
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const creditsAmount = parseInt(session.metadata?.creditsAmount || '10', 10);

  if (!userId) {
    console.error('[StripeService] checkout.session.completed without userId metadata:', session.id);
    return false;
  }

  await CreditModel.grantPurchasedCredits(db, userId, creditsAmount, session.id);
  console.log(`[StripeService] Granted ${creditsAmount} credits to user ${userId} (session: ${session.id})`);
  return true;
}

// ─── Error ──────────────────────────────────────────────────────────────────

export class StripeServiceError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'StripeServiceError';
  }
}
