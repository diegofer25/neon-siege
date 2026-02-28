-- Bind anonymous users to a single browser/device identity.
-- Device identity is provided by the client and persisted in browser storage.
-- If browser data is cleared, the device identity is lost and the guest account
-- can no longer be resumed.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS anonymous_device_id VARCHAR(128);

-- Ensure one anonymous account per device while allowing non-anonymous rows to
-- have NULL device IDs.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_anonymous_device_id
  ON users (anonymous_device_id)
  WHERE auth_provider = 'anonymous' AND anonymous_device_id IS NOT NULL;
