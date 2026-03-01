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
    adaptive_pricing: {
      enabled: true,
    },
  });

  if (!session.url) {
    throw new StripeServiceError('Stripe did not return a checkout URL', 500);
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Verify Stripe webhook signature and dispatch all relevant checkout events.
 *
 * Handled events:
 *   checkout.session.completed            — synchronous payment succeeded → grant credits
 *   checkout.session.async_payment_succeeded — async payment succeeded → grant credits
 *   checkout.session.async_payment_failed  — async payment failed → record failed transaction
 *   checkout.session.expired              — session expired before payment → record expired transaction
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

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const creditsAmount = parseInt(session.metadata?.creditsAmount || '10', 10);

  switch (event.type) {
    // ── Payment success (sync and async) ────────────────────────────────────
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (!userId) {
        console.error(`[StripeService] ${event.type} without userId metadata — session: ${session.id}`);
        return false;
      }
      await CreditModel.grantPurchasedCredits(db, userId, creditsAmount, session.id);
      console.log(`[StripeService] ${event.type} — granted ${creditsAmount} credits to user ${userId} (session: ${session.id})`);
      return true;
    }

    // ── Async payment failed ─────────────────────────────────────────────────
    case 'checkout.session.async_payment_failed': {
      if (userId) {
        await CreditModel.recordTransaction(db, userId, 'purchase', 0, session.id, {
          event: event.type,
          status: 'payment_failed',
          sessionId: session.id,
        });
      }
      console.warn(`[StripeService] async_payment_failed — session: ${session.id}, userId: ${userId ?? 'unknown'}`);
      return true;
    }

    // ── Session expired before payment ───────────────────────────────────────
    case 'checkout.session.expired': {
      if (userId) {
        await CreditModel.recordTransaction(db, userId, 'purchase', 0, session.id, {
          event: event.type,
          status: 'expired',
          sessionId: session.id,
        });
      }
      console.warn(`[StripeService] checkout.session.expired — session: ${session.id}, userId: ${userId ?? 'unknown'}`);
      return true;
    }

    default:
      // Acknowledge without processing
      return true;
  }
}

// ─── Error ──────────────────────────────────────────────────────────────────

export class StripeServiceError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'StripeServiceError';
  }
}
