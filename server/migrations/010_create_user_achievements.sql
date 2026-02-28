CREATE TABLE IF NOT EXISTS user_achievements (
    id             SERIAL PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(64) NOT NULL,
    unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
    ON user_achievements (user_id);
