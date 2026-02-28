export const env = {
  PORT: parseInt(Bun.env.PORT || '3000'),
  NODE_ENV: Bun.env.NODE_ENV || 'development',
  DATABASE_URL: Bun.env.DATABASE_URL || 'postgresql://neon_siege:neon_siege@localhost:5432/neon_siege',
  JWT_SECRET: Bun.env.JWT_SECRET || 'dev-jwt-secret',
  JWT_REFRESH_SECRET: Bun.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret',
  GOOGLE_CLIENT_ID: Bun.env.GOOGLE_CLIENT_ID || '',
  SCORE_HMAC_SECRET: Bun.env.SCORE_HMAC_SECRET || 'dev-hmac-secret',
  /** Secret used to HMAC-sign save-session tokens.  Set in production env. */
  SAVE_HMAC_SECRET: Bun.env.SAVE_HMAC_SECRET || 'dev-save-hmac-secret',
  GEOIP_ENABLED: Bun.env.GEOIP_ENABLED !== 'false', // default true; set to 'false' to disable

  // ─── CORS ────────────────────────────────────────────
  /** Comma-separated list of allowed origins in production (optional, falls back to anchored regex) */
  ALLOWED_ORIGINS: Bun.env.ALLOWED_ORIGINS || '',

  // ─── Stripe / Credits ────────────────────────────────
  STRIPE_SECRET_KEY: Bun.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: Bun.env.STRIPE_WEBHOOK_SECRET || '',
  /** The Stripe Price ID for the $1 / 10-credits product */
  STRIPE_PRICE_ID: Bun.env.STRIPE_PRICE_ID || '',
  /** Secret used to HMAC-sign one-time continue tokens */
  CONTINUE_TOKEN_SECRET: Bun.env.CONTINUE_TOKEN_SECRET || 'dev-continue-token-secret',

  // ─── Email / Resend ───────────────────────────────────
  /** Resend API key for transactional email (password resets). Leave empty in dev to use console fallback. */
  RESEND_API_KEY: Bun.env.RESEND_API_KEY || '',
  /** Public base URL of the client app, used to build reset links in emails. */
  APP_BASE_URL: Bun.env.APP_BASE_URL || 'http://localhost:8080',
  /** From address for outgoing emails (Resend verified domain required in production). */
  EMAIL_FROM: Bun.env.EMAIL_FROM || 'Neon Siege <noreply@diegolamarao.com>',
} as const;

// ─── Production startup validation ─────────────────────
if (env.NODE_ENV === 'production') {
  const required: (keyof typeof env)[] = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SCORE_HMAC_SECRET',
    'SAVE_HMAC_SECRET',
    'CONTINUE_TOKEN_SECRET',
    'RESEND_API_KEY',
  ];
  for (const key of required) {
    const val = env[key];
    if (typeof val === 'string' && (val === '' || val.startsWith('dev-'))) {
      throw new Error(`[env] FATAL: ${key} must be set to a real secret in production.`);
    }
  }
}
