-- Add updated_at column to leaderboard_entries if it doesn't exist yet
-- (needed for upsert tracking when a score is beaten)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE leaderboard_entries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add UNIQUE (user_id, difficulty) constraint if it doesn't exist yet
-- (one leaderboard record per user per difficulty)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'leaderboard_entries'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'leaderboard_entries_user_id_difficulty_key'
  ) THEN
    ALTER TABLE leaderboard_entries ADD CONSTRAINT leaderboard_entries_user_id_difficulty_key UNIQUE (user_id, difficulty);
  END IF;
END $$;
