/**
 * @fileoverview Auth service — Workers-compatible port.
 *
 * Password hashing: PBKDF2-SHA256 via Web Crypto (no external dependencies).
 *
 * Legacy argon2 hashes from the Bun backend:
 *   Argon2id cannot be verified in Workers without WASM. Users with legacy
 *   hashes must use the password-reset flow. On reset, their hash is replaced
 *   with a PBKDF2 hash. The `verifyPassword` function detects the hash format
 *   and returns false for unsupported formats.
 *
 * Google login: uses fetch-based token verification (no google-auth-library
 *   dependency — that package uses Node net/tls and won't run in Workers).
 */

import * as UserModel from '../models/user.model';
import { sendPasswordResetEmail, sendRegistrationCodeEmail } from './email.service';

const EMAIL_REGISTRATION_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_REGISTRATION_MAX_ATTEMPTS = 5;
const EMAIL_SEND_COOLDOWN_MS = 60 * 1000;

const PBKDF2_ITERATIONS = 100_000;

// ─── Password hashing (Web Crypto PBKDF2) ──────────────────────────────────

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt.buffer as ArrayBuffer)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Legacy argon2 hashes cannot be verified in Workers
  if (stored.startsWith('$argon2')) {
    return false;
  }

  if (!stored.startsWith('pbkdf2:')) {
    return false;
  }

  const parts = stored.split(':');
  if (parts.length !== 4) return false;

  const iterations = parseInt(parts[1], 10);
  const salt = fromHex(parts[2]);
  const expectedHash = parts[3];

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(hash) === expectedHash;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim();
}

function _hashVerificationCode(code: string): string {
  // Use sync SubtleCrypto-compatible approach: SHA-256
  // We need async here, but _hashVerificationCode is called in async context
  // For simplicity, use a non-crypto hash for the 6-digit code
  // Actually let's make this async
  throw new Error('Use _hashVerificationCodeAsync instead');
}

async function _hashVerificationCodeAsync(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(hash);
}

function _generateVerificationCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, '0');
}

// ─── Token hashing ─────────────────────────────────────────────────────────

async function _hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(hash);
}

// ─── Google token verification (fetch-based) ───────────────────────────────

interface GoogleTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  aud: string;
}

async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleTokenPayload> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) {
    throw new AuthError('Invalid Google token', 401);
  }
  const payload = (await res.json()) as GoogleTokenPayload;
  if (payload.aud !== clientId) {
    throw new AuthError('Google token audience mismatch', 401);
  }
  return payload;
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function startEmailRegistration(
  db: D1Database,
  env: { APP_BASE_URL: string; EMAIL_FROM: string; RESEND_API_KEY: string; NODE_ENV: string },
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDisplayName = normalizeDisplayName(displayName);

  const existing = await UserModel.findByEmail(db, normalizedEmail);
  if (existing) throw new AuthError('Email already registered', 409);

  const nameTaken = await UserModel.findByDisplayName(db, normalizedDisplayName);
  if (nameTaken) throw new AuthError('Player name already taken', 409);

  const existingPending = await UserModel.findPendingEmailRegistrationByEmail(db, normalizedEmail);
  if (existingPending) {
    const msSinceLastSend = Date.now() - new Date(existingPending.updated_at).getTime();
    if (msSinceLastSend < EMAIL_SEND_COOLDOWN_MS) {
      throw new AuthError('Please wait before requesting another verification code', 429);
    }
  }

  const passwordHash = await hashPassword(password);
  const code = _generateVerificationCode();
  const codeHash = await _hashVerificationCodeAsync(code);
  const expiresAt = new Date(Date.now() + EMAIL_REGISTRATION_CODE_TTL_MS);

  await UserModel.deleteExpiredPendingEmailRegistrations(db);
  await sendRegistrationCodeEmail(env, normalizedEmail, code);
  await UserModel.upsertPendingEmailRegistration(
    db,
    normalizedEmail,
    normalizedDisplayName,
    passwordHash,
    codeHash,
    expiresAt,
  );
}

export async function verifyEmailRegistration(
  db: D1Database,
  email: string,
  code: string,
): Promise<UserModel.PublicUser> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = code.trim();

  const existing = await UserModel.findByEmail(db, normalizedEmail);
  if (existing) throw new AuthError('Email already registered', 409);

  const pending = await UserModel.findPendingEmailRegistrationByEmail(db, normalizedEmail);
  if (!pending) throw new AuthError('No pending registration found for this email', 404);

  if (new Date(pending.expires_at) < new Date()) {
    await UserModel.deletePendingEmailRegistrationByEmail(db, normalizedEmail);
    throw new AuthError('Verification code has expired', 400);
  }

  if (pending.attempts_used >= EMAIL_REGISTRATION_MAX_ATTEMPTS) {
    throw new AuthError('Too many verification attempts. Please register again.', 429);
  }

  const codeHash = await _hashVerificationCodeAsync(normalizedCode);
  if (codeHash !== pending.code_hash) {
    await UserModel.incrementPendingRegistrationAttempts(db, pending.id);
    const nextAttempts = pending.attempts_used + 1;
    if (nextAttempts >= EMAIL_REGISTRATION_MAX_ATTEMPTS) {
      throw new AuthError('Too many verification attempts. Please register again.', 429);
    }
    throw new AuthError('Invalid verification code', 400);
  }

  const nameTaken = await UserModel.findByDisplayName(db, pending.display_name);
  if (nameTaken) throw new AuthError('Player name already taken', 409);

  const user = await UserModel.createEmailUser(db, pending.email, pending.password_hash, pending.display_name);
  await UserModel.deletePendingEmailRegistrationByEmail(db, normalizedEmail);
  return UserModel.toPublicUser(user);
}

export async function loginWithEmail(
  db: D1Database,
  email: string,
  password: string,
): Promise<UserModel.PublicUser> {
  const user = await UserModel.findByEmail(db, email);
  if (!user || !user.password_hash) {
    throw new AuthError('Invalid email or password', 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    // If they have a legacy argon2 hash, give a useful message
    if (user.password_hash.startsWith('$argon2')) {
      throw new AuthError(
        'Password format requires migration. Please use "Forgot Password" to set a new password.',
        401,
      );
    }
    throw new AuthError('Invalid email or password', 401);
  }

  return UserModel.toPublicUser(user);
}

export async function loginWithGoogle(
  db: D1Database,
  idToken: string,
  googleClientId: string,
): Promise<UserModel.PublicUser> {
  const payload = await verifyGoogleIdToken(idToken, googleClientId);

  let user = await UserModel.findByGoogleId(db, payload.sub);
  if (!user) {
    if (payload.email) {
      const emailUser = await UserModel.findByEmail(db, payload.email);
      if (emailUser) {
        throw new AuthError('Email already registered with a different provider', 409);
      }
    }
    user = await UserModel.createGoogleUser(
      db,
      payload.sub,
      payload.email || '',
      payload.name || payload.email || 'Player',
    );
  }

  return UserModel.toPublicUser(user);
}

export async function resumeAnonymous(
  db: D1Database,
  deviceId: string,
): Promise<UserModel.PublicUser> {
  const user = await UserModel.findAnonymousByDeviceId(db, deviceId);
  if (!user) throw new AuthError('Guest session not found', 404);
  return UserModel.toPublicUser(user);
}

export async function createAnonymous(
  db: D1Database,
  displayName: string,
  deviceId: string,
): Promise<UserModel.PublicUser> {
  const existingForDevice = await UserModel.findAnonymousByDeviceId(db, deviceId);
  if (existingForDevice) {
    if (existingForDevice.display_name === displayName) {
      return UserModel.toPublicUser(existingForDevice);
    }
    const nameTaken = await UserModel.findByDisplayName(db, displayName);
    if (nameTaken && nameTaken.id !== existingForDevice.id) {
      throw new AuthError('Player name already taken', 409);
    }
    const updated = await UserModel.updateDisplayName(db, existingForDevice.id, displayName);
    return UserModel.toPublicUser(updated ?? existingForDevice);
  }

  const existing = await UserModel.findByDisplayName(db, displayName);
  if (existing) throw new AuthError('Player name already taken', 409);

  const user = await UserModel.createAnonymousUser(db, displayName, deviceId);
  return UserModel.toPublicUser(user);
}

// ─── Password reset ─────────────────────────────────────────────────────────

export async function requestPasswordReset(
  db: D1Database,
  env: { APP_BASE_URL: string; EMAIL_FROM: string; RESEND_API_KEY: string; NODE_ENV: string },
  email: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const user = await UserModel.findByEmail(db, normalizedEmail);
  if (!user || user.auth_provider !== 'email') return;

  const latestToken = await UserModel.findLatestPasswordResetTokenForUser(db, user.id);
  if (latestToken) {
    const msSinceLastSend = Date.now() - new Date(latestToken.created_at).getTime();
    if (msSinceLastSend < EMAIL_SEND_COOLDOWN_MS) return;
  }

  await UserModel.deleteUnusedPasswordResetTokens(db, user.id);

  // Generate raw token using Web Crypto
  const rawBytes = new Uint8Array(32);
  crypto.getRandomValues(rawBytes);
  const rawToken = toHex(rawBytes.buffer as ArrayBuffer);
  const tokenHash = await _hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await UserModel.createPasswordResetToken(db, user.id, tokenHash, expiresAt);

  const resetUrl = `${env.APP_BASE_URL}/?reset_token=${rawToken}`;
  await sendPasswordResetEmail(env, normalizedEmail, resetUrl);
}

export async function resetPassword(
  db: D1Database,
  rawToken: string,
  newPassword: string,
): Promise<UserModel.PublicUser> {
  const tokenHash = await _hashToken(rawToken);
  const record = await UserModel.findPasswordResetToken(db, tokenHash);

  if (!record) throw new AuthError('Invalid or expired reset token', 400);
  if (record.used_at) throw new AuthError('Reset token already used', 400);
  if (new Date(record.expires_at) < new Date()) throw new AuthError('Reset token has expired', 400);

  // Mark used first to prevent replay
  await UserModel.consumePasswordResetToken(db, record.id);

  const newHash = await hashPassword(newPassword);
  await UserModel.updatePasswordHash(db, record.user_id, newHash);

  const user = await UserModel.findById(db, record.user_id);
  if (!user) throw new AuthError('User not found', 404);
  return UserModel.toPublicUser(user);
}

// ─── Error ──────────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
