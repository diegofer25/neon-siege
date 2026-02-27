-- save_states: one active save slot per authenticated user
CREATE TABLE save_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schema_version  INTEGER NOT NULL DEFAULT 2,
  save_data       JSONB NOT NULL,
  wave            INTEGER NOT NULL DEFAULT 1,
  game_state      TEXT NOT NULL DEFAULT 'paused',
  session_token   TEXT NOT NULL,         -- must match an active save_sessions row
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)                       -- one save per user
);

CREATE INDEX idx_save_states_user ON save_states(user_id);

-- save_sessions: short-lived tokens issued when a real game session starts.
-- A save is only accepted if the session_token exists here and hasn't expired.
CREATE TABLE save_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_save_sessions_token   ON save_sessions(token);
CREATE INDEX idx_save_sessions_user    ON save_sessions(user_id);
CREATE INDEX idx_save_sessions_expires ON save_sessions(expires_at);
