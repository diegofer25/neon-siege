CREATE TABLE leaderboard_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty       VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  score            INTEGER NOT NULL,
  wave             INTEGER NOT NULL,
  kills            INTEGER NOT NULL DEFAULT 0,
  max_combo        INTEGER NOT NULL DEFAULT 0,
  level            INTEGER NOT NULL DEFAULT 1,
  is_victory       BOOLEAN NOT NULL DEFAULT FALSE,
  run_details      JSONB NOT NULL DEFAULT '{}',
  game_duration_ms INTEGER,
  client_version   VARCHAR(20),
  checksum         VARCHAR(64),
  flagged          BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_difficulty_score ON leaderboard_entries(difficulty, score DESC);
CREATE INDEX idx_leaderboard_user ON leaderboard_entries(user_id, created_at DESC);
