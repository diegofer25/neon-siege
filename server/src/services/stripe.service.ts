/**
 * @fileoverview Stripe integration for the arcade-credits purchase flow.
 *
 * Uses Stripe Checkout in `payment` mode — the client opens a popup to the
 * Stripe-hosted page.  After payment, Stripe fires a `checkout.session.completed`
 * webhook which we verify and use to grant credits.
 */

import Stripe from 'stripe';
import { env } from '../config/env';
import * as creditService from './credit.service';

// Lazy Stripe client — only created when keys are configured
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new StripeServiceError('Stripe is not configured (missing STRIPE_SECRET_KEY)', 503);
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15' as any,
    });
  }
  return _stripe;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for purchasing credits.
 * Returns the checkout URL that the client should open in a popup.
 */
export async function createCheckoutSession(
  userId: string,
  email: string | undefined,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  if (!env.STRIPE_PRICE_ID) {
    throw new StripeServiceError('Stripe price not configured (missing STRIPE_PRICE_ID)', 503);
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(email ? { customer_email: email } : {}),
    line_items: [
      {
        price: env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      creditsAmount: '10',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new StripeServiceError('Stripe did not return a checkout URL', 500);
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Handle an incoming Stripe webhook event.
 * Verifies the signature and processes `checkout.session.completed`.
 * Returns true if the event was processed (or skipped non-relevant event types).
 */
export async function handleWebhook(rawBody: string, signature: string): Promise<boolean> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new StripeServiceError('Webhook secret not configured', 503);
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    throw new StripeServiceError(`Webhook signature verification failed: ${err.message}`, 400);
  }

  if (event.type !== 'checkout.session.completed') {
    // We only care about completed checkouts — acknowledge other events silently
    return true;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const creditsAmount = parseInt(session.metadata?.creditsAmount || '10', 10);

  if (!userId) {
    console.error('[StripeService] checkout.session.completed without userId metadata:', session.id);
    return false;
  }

  // Grant credits (idempotent — duplicate webhook deliveries are safe)
  await creditService.grantPurchasedCredits(userId, creditsAmount, session.id);

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
