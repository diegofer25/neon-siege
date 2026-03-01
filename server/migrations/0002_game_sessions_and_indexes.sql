-- ═══════════════════════════════════════════════════════════════════════════
-- Neon Siege — Game sessions for anti-cheat score submission
--
-- Each game run gets a server-issued session that must be presented at
-- score submission. Sessions are single-use and time-bounded.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS game_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nonce      TEXT NOT NULL UNIQUE,
  hmac_key   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at    TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user    ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_nonce   ON game_sessions(nonce);
CREATE INDEX IF NOT EXISTS idx_game_sessions_expires ON game_sessions(expires_at);

-- ─── Leaderboard performance index ────────────────────────────────────────
-- Speeds up rank queries that filter out flagged entries.
CREATE INDEX IF NOT EXISTS idx_leaderboard_difficulty_flagged_score
  ON leaderboard_entries(difficulty, flagged, score DESC);
