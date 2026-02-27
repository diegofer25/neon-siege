-- Migration 008: Password reset tokens
-- Stores hashed one-time tokens for email-based password resets.
-- Raw tokens are never persisted; only SHA-256 hashes are stored.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens (user_id);
