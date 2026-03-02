-- ─── Remove difficulty from leaderboard ───────────────────────────────────
-- Wipe all leaderboard entries (clean break — announced leaderboard reset).
DELETE FROM leaderboard_entries;

-- Drop old indexes that reference the difficulty column.
DROP INDEX IF EXISTS idx_leaderboard_difficulty_score;
DROP INDEX IF EXISTS idx_leaderboard_difficulty_score_updated_id;

-- SQLite does not support ALTER TABLE DROP COLUMN on older versions used by
-- D1. Instead, recreate the table without the difficulty column and the
-- old UNIQUE constraint, then restore data (table is empty after DELETE).
-- This also updates UNIQUE(user_id, difficulty) → UNIQUE(user_id).

CREATE TABLE IF NOT EXISTS leaderboard_entries_new (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  UNIQUE (user_id)
);

DROP TABLE leaderboard_entries;
ALTER TABLE leaderboard_entries_new RENAME TO leaderboard_entries;

-- Recreate indexes for the new schema (no difficulty column).
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_updated_id
  ON leaderboard_entries(score DESC, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user
  ON leaderboard_entries(user_id);
