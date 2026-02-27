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
} as const;
