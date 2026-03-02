-- Migration: Per-run free continues
--
-- Changes the continue economy from 3 lifetime free credits to 3 free
-- continues per run. The server tracks the active run_id and how many
-- free continues have been used in that run.
--
-- The old `free_credits_remaining` column is preserved for backwards
-- compatibility but is no longer read or decremented.

ALTER TABLE user_credits ADD COLUMN current_run_id TEXT;
ALTER TABLE user_credits ADD COLUMN run_free_used INTEGER NOT NULL DEFAULT 0;
