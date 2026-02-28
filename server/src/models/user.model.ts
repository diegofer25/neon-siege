import { query, queryOne } from '../config/database';

export interface User {
  id: string;
  email: string | null;
  password_hash: string | null;
  display_name: string;
  auth_provider: 'email' | 'google' | 'anonymous';
  google_id: string | null;
  anonymous_device_id: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  created_at: Date;
  updated_at: Date;
}

export function isRegisteredAuthProvider(provider: User['auth_provider'] | null | undefined): boolean {
  return provider != null && provider !== 'anonymous';
}

export function isRegisteredUser(user: Pick<User, 'auth_provider'> | null | undefined): boolean {
  return !!user && isRegisteredAuthProvider(user.auth_provider);
}

export type PublicUser = Pick<User, 'id' | 'display_name' | 'auth_provider' | 'country' | 'country_code' | 'region' | 'city'>;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    display_name: user.display_name,
    auth_provider: user.auth_provider,
    country: user.country,
    country_code: user.country_code,
    region: user.region,
    city: user.city,
  };
}

export async function findById(id: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function findByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE email = $1', [email]);
}

export async function findByGoogleId(googleId: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE google_id = $1', [googleId]);
}

export async function findAnonymousByDeviceId(deviceId: string): Promise<User | null> {
  return queryOne<User>(
    `SELECT *
     FROM users
     WHERE auth_provider = 'anonymous' AND anonymous_device_id = $1`,
    [deviceId]
  );
}

export async function createEmailUser(email: string, passwordHash: string, displayName: string): Promise<User> {
  const result = await queryOne<User>(
    `INSERT INTO users (email, password_hash, display_name, auth_provider)
     VALUES ($1, $2, $3, 'email')
     RETURNING *`,
    [email, passwordHash, displayName]
  );
  return result!;
}

export async function createGoogleUser(googleId: string, email: string, displayName: string): Promise<User> {
  const result = await queryOne<User>(
    `INSERT INTO users (google_id, email, display_name, auth_provider)
     VALUES ($1, $2, $3, 'google')
     RETURNING *`,
    [googleId, email, displayName]
  );
  return result!;
}

export async function findByDisplayName(displayName: string): Promise<User | null> {
  return queryOne<User>(
    'SELECT * FROM users WHERE LOWER(display_name) = LOWER($1)',
    [displayName]
  );
}

export async function createAnonymousUser(displayName: string, deviceId: string): Promise<User> {
  const result = await queryOne<User>(
    `INSERT INTO users (display_name, auth_provider, anonymous_device_id)
     VALUES ($1, 'anonymous', $2)
     RETURNING *`,
    [displayName, deviceId]
  );
  return result!;
}

export async function updateDisplayName(userId: string, displayName: string): Promise<User | null> {
  return queryOne<User>(
    `UPDATE users
     SET display_name = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, displayName]
  );
}

export async function upgradeAnonymousToEmail(
  userId: string,
  email: string,
  passwordHash: string
): Promise<User | null> {
  return queryOne<User>(
    `UPDATE users SET email = $2, password_hash = $3, auth_provider = 'email', anonymous_device_id = NULL, updated_at = NOW()
     WHERE id = $1 AND auth_provider = 'anonymous'
     RETURNING *`,
    [userId, email, passwordHash]
  );
}

export async function upgradeAnonymousToGoogle(
  userId: string,
  googleId: string,
  email: string
): Promise<User | null> {
  return queryOne<User>(
    `UPDATE users SET google_id = $2, email = $3, auth_provider = 'google', anonymous_device_id = NULL, updated_at = NOW()
     WHERE id = $1 AND auth_provider = 'anonymous'
     RETURNING *`,
    [userId, googleId, email]
  );
}

export async function updatePasswordHash(userId: string, newHash: string): Promise<void> {
  await query(
    'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
    [userId, newHash]
  );
}

// ─── Password reset tokens ────────────────────────────────────────────────────────

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<PasswordResetToken> {
  const result = await queryOne<PasswordResetToken>(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, tokenHash, expiresAt]
  );
  return result!;
}

export async function findPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
  return queryOne<PasswordResetToken>(
    'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
    [tokenHash]
  );
}

export async function findLatestPasswordResetTokenForUser(
  userId: string
): Promise<PasswordResetToken | null> {
  return queryOne<PasswordResetToken>(
    `SELECT *
     FROM password_reset_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
}

export async function consumePasswordResetToken(id: string): Promise<void> {
  await query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
    [id]
  );
}

export async function deleteUnusedPasswordResetTokens(userId: string): Promise<void> {
  await query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  );
}

// ─── Pending email registrations ───────────────────────────────────────────────

export interface PendingEmailRegistration {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  code_hash: string;
  expires_at: Date;
  attempts_used: number;
  consumed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function upsertPendingEmailRegistration(
  email: string,
  displayName: string,
  passwordHash: string,
  codeHash: string,
  expiresAt: Date
): Promise<PendingEmailRegistration> {
  const result = await queryOne<PendingEmailRegistration>(
    `INSERT INTO pending_email_registrations (
      email,
      display_name,
      password_hash,
      code_hash,
      expires_at,
      attempts_used,
      consumed_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, 0, NULL, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      password_hash = EXCLUDED.password_hash,
      code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at,
      attempts_used = 0,
      consumed_at = NULL,
      updated_at = NOW()
    RETURNING *`,
    [email, displayName, passwordHash, codeHash, expiresAt]
  );
  return result!;
}

export async function findPendingEmailRegistrationByEmail(
  email: string
): Promise<PendingEmailRegistration | null> {
  return queryOne<PendingEmailRegistration>(
    `SELECT *
     FROM pending_email_registrations
     WHERE email = $1 AND consumed_at IS NULL`,
    [email]
  );
}

export async function incrementPendingRegistrationAttempts(id: string): Promise<void> {
  await query(
    `UPDATE pending_email_registrations
     SET attempts_used = attempts_used + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

export async function deletePendingEmailRegistrationByEmail(email: string): Promise<void> {
  await query(
    'DELETE FROM pending_email_registrations WHERE email = $1',
    [email]
  );
}

export async function deleteExpiredPendingEmailRegistrations(): Promise<void> {
  await query(
    'DELETE FROM pending_email_registrations WHERE expires_at < NOW()',
    []
  );
}

export async function updateLocation(
  userId: string,
  location: { country: string; countryCode: string; region: string; city: string }
): Promise<void> {
  await queryOne(
    `UPDATE users SET country = $2, country_code = $3, region = $4, city = $5, updated_at = NOW()
     WHERE id = $1`,
    [userId, location.country, location.countryCode, location.region, location.city]
  );
}
