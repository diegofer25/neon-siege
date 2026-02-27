-- ─── Credits & Continue System ──────────────────────────────────────────────
-- Arcade-style credits: 3 free lifetime continues, then pay via Stripe.

-- user_credits: one row per user — server-authoritative balance
CREATE TABLE user_credits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance               INTEGER NOT NULL DEFAULT 0,
  free_credits_remaining INTEGER NOT NULL DEFAULT 3,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX idx_user_credits_user ON user_credits(user_id);

-- credit_transactions: immutable audit log of every credit movement
CREATE TABLE credit_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('free_use', 'paid_use', 'purchase')),
  amount            INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at);

-- continue_tokens: server-issued one-time-use tokens that authorise a continue
CREATE TABLE continue_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  save_version  INTEGER NOT NULL,
  consumed      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_continue_tokens_token ON continue_tokens(token);
CREATE INDEX idx_continue_tokens_user  ON continue_tokens(user_id);

-- Add save_version column to save_states for optimistic concurrency & continue binding
ALTER TABLE save_states ADD COLUMN IF NOT EXISTS save_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE save_states ADD COLUMN IF NOT EXISTS checksum TEXT;

-- Add continues_used column to leaderboard_entries for audit tracking
ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS continues_used INTEGER NOT NULL DEFAULT 0;
