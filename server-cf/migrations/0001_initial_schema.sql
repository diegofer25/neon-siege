-- ═══════════════════════════════════════════════════════════════════════════
-- Neon Siege — D1 initial schema
-- Consolidated from server/migrations/001–012 (Postgres) → SQLite/D1.
--
-- Key differences from Postgres:
--   • UUIDs are TEXT (generated in application code via crypto.randomUUID())
--   • TIMESTAMPTZ → TEXT storing ISO-8601 strings
--   • JSONB → TEXT storing JSON strings
--   • SERIAL → INTEGER PRIMARY KEY AUTOINCREMENT
--   • gen_random_uuid() / pgcrypto removed — IDs passed as params
--   • NOW() → datetime('now')
--   • DO $$ blocks removed — SQLite doesn't support PL/pgSQL
--   • Partial unique indexes use SQLite WHERE syntax (identical)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE,
  password_hash       TEXT,
  display_name        TEXT NOT NULL,
  auth_provider       TEXT NOT NULL DEFAULT 'email',
  google_id           TEXT UNIQUE,
  anonymous_device_id TEXT,
  country             TEXT,
  country_code        TEXT,
  region              TEXT,
  city                TEXT,
  avatar_emoji        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_id
  ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location
  ON users(country_code, region, city);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_anonymous_device_id
  ON users(anonymous_device_id)
  WHERE auth_provider = 'anonymous' AND anonymous_device_id IS NOT NULL;

-- ─── Leaderboard ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty       TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  score            INTEGER NOT NULL,
  wave             INTEGER NOT NULL,
  kills            INTEGER NOT NULL DEFAULT 0,
  max_combo        INTEGER NOT NULL DEFAULT 0,
  level            INTEGER NOT NULL DEFAULT 1,
  is_victory       INTEGER NOT NULL DEFAULT 0,
  run_details      TEXT NOT NULL DEFAULT '{}',
  game_duration_ms INTEGER,
  client_version   TEXT,
  checksum         TEXT,
  flagged          INTEGER NOT NULL DEFAULT 0,
  continues_used   INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, difficulty)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_difficulty_score
  ON leaderboard_entries(difficulty, score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user
  ON leaderboard_entries(user_id);

-- ─── Save States ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS save_states (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schema_version  INTEGER NOT NULL DEFAULT 2,
  save_data       TEXT NOT NULL,
  wave            INTEGER NOT NULL DEFAULT 1,
  game_state      TEXT NOT NULL DEFAULT 'paused',
  session_token   TEXT NOT NULL,
  save_version    INTEGER NOT NULL DEFAULT 1,
  checksum        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_save_states_user ON save_states(user_id);

-- ─── Save Sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS save_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_save_sessions_token   ON save_sessions(token);
CREATE INDEX IF NOT EXISTS idx_save_sessions_user    ON save_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_save_sessions_expires ON save_sessions(expires_at);

-- ─── User Credits ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_credits (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance                INTEGER NOT NULL DEFAULT 0,
  free_credits_remaining INTEGER NOT NULL DEFAULT 3,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);

-- ─── Credit Transactions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('free_use', 'paid_use', 'purchase')),
  amount            INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  metadata          TEXT DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user
  ON credit_transactions(user_id, created_at);

-- ─── Continue Tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS continue_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  save_version INTEGER NOT NULL,
  consumed     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_continue_tokens_token ON continue_tokens(token);
CREATE INDEX IF NOT EXISTS idx_continue_tokens_user  ON continue_tokens(user_id);

-- ─── User Progression ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_progression (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data           TEXT NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progression_user_id
  ON user_progression(user_id);

-- ─── Password Reset Tokens ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens(user_id);

-- ─── User Achievements ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON user_achievements(user_id);

-- ─── Pending Email Registrations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_email_registrations (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  consumed_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pending_email_registrations_expires_at
  ON pending_email_registrations(expires_at);
