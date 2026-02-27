/**
 * @fileoverview Credit & continue routes — arcade monetisation endpoints.
 *
 * Routes:
 *   GET    /api/credits           — get balance
 *   POST   /api/credits/continue  — deduct 1 credit, get continue token + save
 *   POST   /api/credits/redeem    — consume continue token, delete old save
 *   POST   /api/credits/checkout  — create Stripe checkout session (non-anonymous only)
 *   POST   /api/credits/webhook   — Stripe webhook (unauthenticated, raw body)
 */

import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import { createRateLimiter } from '../middleware/rateLimit';
import * as creditService from '../services/credit.service';
import * as stripeService from '../services/stripe.service';
import { CreditError } from '../models/credit.model';
import { StripeServiceError } from '../services/stripe.service';
import * as UserModel from '../models/user.model';

// ─── Rate limiters ───────────────────────────────────────────────────────────

const continueLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyFn: (ctx: any) => ctx.userId ?? null,
});

const checkoutLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 3,
  keyFn: (ctx: any) => ctx.userId ?? null,
});

// ─── Auth resolver (shared by authenticated routes) ──────────────────────────

const resolveAuth = async ({ accessJwt, headers, set }: any) => {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    set.status = 401;
    throw new Error('Missing or invalid authorization header');
  }
  const token = authHeader.slice(7);
  const payload = await accessJwt.verify(token);
  if (!payload) {
    set.status = 401;
    throw new Error('Invalid or expired access token');
  }
  return {
    userId: payload.sub as string,
    displayName: payload.displayName as string,
  };
};

// ─── Authenticated credit routes ─────────────────────────────────────────────

const authedRoutes = new Elysia({ prefix: '/api/credits' })
  .use(authPlugin)
  .resolve(resolveAuth)

  /** GET /api/credits — return current credit balance */
  .get('/', async ({ userId }) => {
    const balance = await creditService.getBalance(userId);
    return { credits: balance };
  })

  /**
   * POST /api/credits/continue
   * Deduct 1 credit, issue a continue token, return server-held save.
   */
  .post(
    '/continue',
    async ({ userId, set }) => {
      // Rate limit
      const limited = continueLimiter({ userId, set } as any);
      if (limited) return limited;

      try {
        const result = await creditService.requestContinue(userId);
        return result;
      } catch (err) {
        if (err instanceof CreditError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    }
  )

  /**
   * POST /api/credits/redeem
   * Consume a continue token (marks it used; save is kept on server for re-continuation).
   */
  .post(
    '/redeem',
    async ({ body, userId, set }) => {
      try {
        await creditService.redeemContinue(userId, body.continueToken);
        return { ok: true };
      } catch (err) {
        if (err instanceof CreditError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        continueToken: t.String({ minLength: 10 }),
      }),
    }
  )

  /**
   * POST /api/credits/checkout
   * Create a Stripe Checkout session. Requires non-anonymous auth (Stripe needs email).
   */
  .post(
    '/checkout',
    async ({ body, userId, set }) => {
      // Rate limit
      const limited = checkoutLimiter({ userId, set } as any);
      if (limited) return limited;

      const user = await UserModel.findById(userId);
      if (!user) {
        set.status = 404;
        return { error: 'User not found' };
      }

      try {
        const result = await stripeService.createCheckoutSession(
          userId,
          user.email ?? undefined,
          body.successUrl,
          body.cancelUrl
        );
        return result;
      } catch (err) {
        if (err instanceof StripeServiceError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        successUrl: t.String({ format: 'uri' }),
        cancelUrl: t.String({ format: 'uri' }),
      }),
    }
  );

// ─── Stripe webhook (unauthenticated) ───────────────────────────────────────

const webhookRoutes = new Elysia({ prefix: '/api/credits' })
  .post(
    '/webhook',
    async ({ body, request, set }) => {
      console.log('[webhook] POST /api/credits/webhook received');
      const signature = request.headers.get('stripe-signature');
      if (!signature) {
        set.status = 400;
        return { error: 'Missing stripe-signature header' };
      }

      // `body` is the raw text string from our custom parse hook below
      const rawBody = body as string;

      try {
        await stripeService.handleWebhook(rawBody, signature);
        return { received: true };
      } catch (err) {
        if (err instanceof StripeServiceError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      // Return the raw text string so Stripe can verify the signature
      parse: ({ request }) => request.text(),
    }
  );

// ─── Combined export ─────────────────────────────────────────────────────────

export const creditRoutes = new Elysia()
  .use(authedRoutes)
  .use(webhookRoutes);
