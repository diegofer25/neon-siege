-- Add geolocation columns to users table
-- Location is resolved from IP via ip-api.com on score submission.
-- Used for geographic leaderboard filtering (country / region / city scope).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS region       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city         VARCHAR(100);

-- Composite index for leaderboard JOIN + WHERE filtering by location
CREATE INDEX IF NOT EXISTS idx_users_location
  ON users (country_code, region, city);
