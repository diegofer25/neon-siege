/**
 * @fileoverview Cloudflare Workers environment bindings type definitions.
 *
 * Secrets are set via `wrangler secret put <KEY>`.
 * Vars are set in wrangler.toml [vars].
 * D1 database is bound in wrangler.toml [[d1_databases]].
 */

export interface Env {
  // ─── D1 Database ─────────────────────────────────────
  DB: D1Database;

  // ─── Vars (wrangler.toml) ────────────────────────────
  NODE_ENV: string;
  APP_BASE_URL: string;
  EMAIL_FROM: string;
  GEOIP_ENABLED: string;
  ALLOWED_ORIGINS: string;
  ALLOWED_CHECKOUT_HOSTS: string;
  FEEDBACK_EMAIL: string;

  // ─── KV Namespace (rate limiting) ────────────────────
  RATE_LIMIT: KVNamespace;

  // ─── Secrets (wrangler secret put) ───────────────────
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  SCORE_HMAC_SECRET: string;
  SAVE_HMAC_SECRET: string;
  CONTINUE_TOKEN_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
  RESEND_API_KEY: string;
}

/**
 * Variables available on every Hono context via `c.var`.
 * Populated by middleware.
 */
export interface AppVariables {
  userId: string;
  displayName: string;
}
