/**
 * @fileoverview User model — D1/SQLite port.
 *
 * Key changes from Postgres version:
 *   • Positional `?` params instead of `$1`
 *   • UUIDs generated via crypto.randomUUID()
 *   • NOW() → datetime('now') or app-side ISO string
 *   • LOWER() works in SQLite for case-insensitive match
 */

import { query, queryOne, run, nowISO, newId } from '../db';

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  avatar_emoji: string | null;
  created_at: string;
  updated_at: string;
}

export function isRegisteredAuthProvider(
  provider: User['auth_provider'] | null | undefined,
): boolean {
  return provider != null && provider !== 'anonymous';
}

export function isRegisteredUser(
  user: Pick<User, 'auth_provider'> | null | undefined,
): boolean {
  return !!user && isRegisteredAuthProvider(user.auth_provider);
}

export type PublicUser = Pick<
  User,
  'id' | 'display_name' | 'auth_provider' | 'country' | 'country_code' | 'region' | 'city'
>;

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

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function findById(db: D1Database, id: string): Promise<User | null> {
  return queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [id]);
}

export async function findByEmail(db: D1Database, email: string): Promise<User | null> {
  return queryOne<User>(db, 'SELECT * FROM users WHERE email = ?', [email]);
}

export async function findByGoogleId(db: D1Database, googleId: string): Promise<User | null> {
  return queryOne<User>(db, 'SELECT * FROM users WHERE google_id = ?', [googleId]);
}

export async function findByDisplayName(db: D1Database, displayName: string): Promise<User | null> {
  return queryOne<User>(
    db,
    'SELECT * FROM users WHERE LOWER(display_name) = LOWER(?)',
    [displayName],
  );
}

export async function findAnonymousByDeviceId(db: D1Database, deviceId: string): Promise<User | null> {
  return queryOne<User>(
    db,
    `SELECT * FROM users WHERE auth_provider = 'anonymous' AND anonymous_device_id = ?`,
    [deviceId],
  );
}

export async function createEmailUser(
  db: D1Database,
  email: string,
  passwordHash: string,
  displayName: string,
): Promise<User> {
  const id = newId();
  const now = nowISO();
  await run(
    db,
    `INSERT INTO users (id, email, password_hash, display_name, auth_provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'email', ?, ?)`,
    [id, email, passwordHash, displayName, now, now],
  );
  return (await findById(db, id))!;
}

export async function createGoogleUser(
  db: D1Database,
  googleId: string,
  email: string,
  displayName: string,
): Promise<User> {
  const id = newId();
  const now = nowISO();
  await run(
    db,
    `INSERT INTO users (id, google_id, email, display_name, auth_provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'google', ?, ?)`,
    [id, googleId, email, displayName, now, now],
  );
  return (await findById(db, id))!;
}

export async function createAnonymousUser(
  db: D1Database,
  displayName: string,
  deviceId: string,
): Promise<User> {
  const id = newId();
  const now = nowISO();
  await run(
    db,
    `INSERT INTO users (id, display_name, auth_provider, anonymous_device_id, created_at, updated_at)
     VALUES (?, ?, 'anonymous', ?, ?, ?)`,
    [id, displayName, deviceId, now, now],
  );
  return (await findById(db, id))!;
}

export async function updateDisplayName(
  db: D1Database,
  userId: string,
  displayName: string,
): Promise<User | null> {
  await run(
    db,
    `UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?`,
    [displayName, nowISO(), userId],
  );
  return findById(db, userId);
}

export async function updatePasswordHash(
  db: D1Database,
  userId: string,
  newHash: string,
): Promise<void> {
  await run(
    db,
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [newHash, nowISO(), userId],
  );
}

export async function updateLocation(
  db: D1Database,
  userId: string,
  location: { country: string; countryCode: string; region: string; city: string },
): Promise<void> {
  await run(
    db,
    `UPDATE users SET country = ?, country_code = ?, region = ?, city = ?, updated_at = ? WHERE id = ?`,
    [location.country, location.countryCode, location.region, location.city, nowISO(), userId],
  );
}

// ─── Password reset tokens ────────────────────────────────────────────────────

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export async function createPasswordResetToken(
  db: D1Database,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<PasswordResetToken> {
  const id = newId();
  const now = nowISO();
  await run(
    db,
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, tokenHash, expiresAt.toISOString(), now],
  );
  return (await queryOne<PasswordResetToken>(
    db,
    'SELECT * FROM password_reset_tokens WHERE id = ?',
    [id],
  ))!;
}

export async function findPasswordResetToken(
  db: D1Database,
  tokenHash: string,
): Promise<PasswordResetToken | null> {
  return queryOne<PasswordResetToken>(
    db,
    'SELECT * FROM password_reset_tokens WHERE token_hash = ?',
    [tokenHash],
  );
}

export async function findLatestPasswordResetTokenForUser(
  db: D1Database,
  userId: string,
): Promise<PasswordResetToken | null> {
  return queryOne<PasswordResetToken>(
    db,
    `SELECT * FROM password_reset_tokens
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
}

export async function consumePasswordResetToken(db: D1Database, id: string): Promise<void> {
  await run(db, 'UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [nowISO(), id]);
}

export async function deleteUnusedPasswordResetTokens(db: D1Database, userId: string): Promise<void> {
  await run(
    db,
    'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL',
    [userId],
  );
}

// ─── Pending email registrations ───────────────────────────────────────────────

export interface PendingEmailRegistration {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  code_hash: string;
  expires_at: string;
  attempts_used: number;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function upsertPendingEmailRegistration(
  db: D1Database,
  email: string,
  displayName: string,
  passwordHash: string,
  codeHash: string,
  expiresAt: Date,
): Promise<PendingEmailRegistration> {
  const id = newId();
  const now = nowISO();
  await run(
    db,
    `INSERT INTO pending_email_registrations
       (id, email, display_name, password_hash, code_hash, expires_at, attempts_used, consumed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
     ON CONFLICT (email) DO UPDATE SET
       display_name  = excluded.display_name,
       password_hash = excluded.password_hash,
       code_hash     = excluded.code_hash,
       expires_at    = excluded.expires_at,
       attempts_used = 0,
       consumed_at   = NULL,
       updated_at    = ?`,
    [id, email, displayName, passwordHash, codeHash, expiresAt.toISOString(), now, now, now],
  );
  return (await findPendingEmailRegistrationByEmail(db, email))!;
}

export async function findPendingEmailRegistrationByEmail(
  db: D1Database,
  email: string,
): Promise<PendingEmailRegistration | null> {
  return queryOne<PendingEmailRegistration>(
    db,
    `SELECT * FROM pending_email_registrations WHERE email = ? AND consumed_at IS NULL`,
    [email],
  );
}

export async function incrementPendingRegistrationAttempts(
  db: D1Database,
  id: string,
): Promise<void> {
  await run(
    db,
    `UPDATE pending_email_registrations SET attempts_used = attempts_used + 1, updated_at = ? WHERE id = ?`,
    [nowISO(), id],
  );
}

export async function deletePendingEmailRegistrationByEmail(
  db: D1Database,
  email: string,
): Promise<void> {
  await run(db, 'DELETE FROM pending_email_registrations WHERE email = ?', [email]);
}

export async function deleteExpiredPendingEmailRegistrations(db: D1Database): Promise<void> {
  await run(db, `DELETE FROM pending_email_registrations WHERE expires_at < datetime('now')`, []);
}
