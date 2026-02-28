/**
 * @fileoverview Credit & continue routes — Cloudflare Workers / Hono port.
 *
 * Routes:
 *   GET    /              — get balance
 *   POST   /continue      — deduct 1 credit, get continue token + save
 *   POST   /redeem        — consume continue token
 *   POST   /checkout      — create Stripe checkout session
 *   POST   /webhook       — Stripe webhook (unauthenticated, raw body)
 */

import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import * as creditService from '../services/credit.service';
import * as stripeService from '../services/stripe.service';
import { CreditError } from '../models/credit.model';
import { StripeServiceError } from '../services/stripe.service';
import * as UserModel from '../models/user.model';

type CreditEnv = { Bindings: Env; Variables: AppVariables };

export const creditRoutes = new Hono<CreditEnv>();

// ─── Rate limiters ───────────────────────────────────────────────────────────

const continueLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyFn: (c) => c.get('userId') || null,
});

const checkoutLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 3,
  keyFn: (c) => c.get('userId') || null,
});

// ─── Authenticated routes ────────────────────────────────────────────────────

/** GET / — return current credit balance */
creditRoutes.get('/', requireAuth, async (c) => {
  const userId = c.get('userId');
  const balance = await creditService.getBalance(c.env.DB, userId);
  return c.json({ credits: balance });
});

/** POST /continue — deduct 1 credit, issue continue token, return save */
creditRoutes.post('/continue', requireAuth, continueLimiter, async (c) => {
  const userId = c.get('userId');

  try {
    const result = await creditService.requestContinue(c.env.DB, c.env, userId);
    return c.json(result);
  } catch (err) {
    if (err instanceof CreditError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

/** POST /redeem — consume a continue token */
creditRoutes.post('/redeem', requireAuth, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ continueToken?: string }>();

  if (!body.continueToken) {
    return c.json({ error: 'continueToken is required' }, 400);
  }

  try {
    await creditService.redeemContinue(c.env.DB, userId, body.continueToken);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof CreditError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

/** POST /checkout — create a Stripe Checkout session */
creditRoutes.post('/checkout', requireAuth, checkoutLimiter, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ successUrl?: string; cancelUrl?: string }>();

  if (!body.successUrl || !body.cancelUrl) {
    return c.json({ error: 'successUrl and cancelUrl are required' }, 400);
  }

  const user = await UserModel.findById(c.env.DB, userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const result = await stripeService.createCheckoutSession(
      c.env,
      userId,
      user.email ?? undefined,
      body.successUrl,
      body.cancelUrl,
    );
    return c.json(result);
  } catch (err) {
    if (err instanceof StripeServiceError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

// ─── Stripe webhook (unauthenticated, raw body) ─────────────────────────────

creditRoutes.post('/webhook', async (c) => {
  console.log('[webhook] POST /api/credits/webhook received');
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  // Read raw body text for Stripe signature verification
  const rawBody = await c.req.text();

  try {
    await stripeService.handleWebhook(c.env, c.env.DB, rawBody, signature);
    return c.json({ received: true });
  } catch (err) {
    if (err instanceof StripeServiceError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});
