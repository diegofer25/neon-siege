-- Allow guest-to-email upgrades: track which anonymous user started
-- the registration so verifyEmailRegistration can upgrade in-place.
ALTER TABLE pending_email_registrations
  ADD COLUMN anonymous_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
