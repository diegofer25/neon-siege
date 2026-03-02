-- Leaderboard keyset pagination index
CREATE INDEX IF NOT EXISTS idx_leaderboard_difficulty_score_updated_id
  ON leaderboard_entries(difficulty, score DESC, updated_at DESC, id DESC);
