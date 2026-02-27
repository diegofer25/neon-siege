-- Meta-progression store: one row per user, replaces localStorage neon_td_meta
CREATE TABLE IF NOT EXISTS user_progression (
    id           SERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data         JSONB NOT NULL DEFAULT '{}',
    schema_version INT NOT NULL DEFAULT 1,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progression_user_id ON user_progression (user_id);
