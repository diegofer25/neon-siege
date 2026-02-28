import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import * as UserModel from '../models/user.model';
import { sendPasswordResetEmail } from './email.service';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  const existing = await UserModel.findByEmail(email);
  if (existing) {
    throw new AuthError('Email already registered', 409);
  }

  const nameTaken = await UserModel.findByDisplayName(displayName);
  if (nameTaken) {
    throw new AuthError('Player name already taken', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await UserModel.createEmailUser(email, passwordHash, displayName);
  return UserModel.toPublicUser(user);
}

export async function loginWithEmail(email: string, password: string) {
  const user = await UserModel.findByEmail(email);
  if (!user || !user.password_hash) {
    throw new AuthError('Invalid email or password', 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new AuthError('Invalid email or password', 401);
  }

  return UserModel.toPublicUser(user);
}

export async function loginWithGoogle(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new AuthError('Invalid Google token', 401);
  }

  // Check if user already exists with this Google ID
  let user = await UserModel.findByGoogleId(payload.sub);
  if (!user) {
    // Check if email is already used by another account
    if (payload.email) {
      const emailUser = await UserModel.findByEmail(payload.email);
      if (emailUser) {
        throw new AuthError('Email already registered with a different provider', 409);
      }
    }

    user = await UserModel.createGoogleUser(
      payload.sub,
      payload.email || '',
      payload.name || payload.email || 'Player'
    );
  }

  return UserModel.toPublicUser(user);
}

export async function resumeAnonymous(deviceId: string) {
  const user = await UserModel.findAnonymousByDeviceId(deviceId);
  if (!user) {
    throw new AuthError('Guest session not found', 404);
  }
  return UserModel.toPublicUser(user);
}

export async function createAnonymous(displayName: string, deviceId: string) {
  const existingForDevice = await UserModel.findAnonymousByDeviceId(deviceId);
  if (existingForDevice) {
    if (existingForDevice.display_name === displayName) {
      return UserModel.toPublicUser(existingForDevice);
    }

    const nameTaken = await UserModel.findByDisplayName(displayName);
    if (nameTaken && nameTaken.id !== existingForDevice.id) {
      throw new AuthError('Player name already taken', 409);
    }

    const updated = await UserModel.updateDisplayName(existingForDevice.id, displayName);
    return UserModel.toPublicUser(updated ?? existingForDevice);
  }

  const existing = await UserModel.findByDisplayName(displayName);
  if (existing) {
    throw new AuthError('Player name already taken', 409);
  }

  const user = await UserModel.createAnonymousUser(displayName, deviceId);
  return UserModel.toPublicUser(user);
}

// ─── Password reset ─────────────────────────────────────────────────────────────────

function _hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Send a password-reset email.
 * Always resolves (never reveals whether the email exists) to prevent enumeration.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await UserModel.findByEmail(email);
  // Silently no-op for unknown / non-email accounts
  if (!user || user.auth_provider !== 'email') return;

  // Invalidate any pending tokens for this user (one active token at a time)
  await UserModel.deleteUnusedPasswordResetTokens(user.id);

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = _hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await UserModel.createPasswordResetToken(user.id, tokenHash, expiresAt);

  const resetUrl = `${env.APP_BASE_URL}/?reset_token=${rawToken}`;
  await sendPasswordResetEmail(email, resetUrl);
}

/**
 * Validate a raw reset token and set a new password.
 * Returns the user so the caller can issue a new session (auto-login).
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string
): Promise<UserModel.PublicUser> {
  const tokenHash = _hashToken(rawToken);
  const record = await UserModel.findPasswordResetToken(tokenHash);

  if (!record)           throw new AuthError('Invalid or expired reset token', 400);
  if (record.used_at)    throw new AuthError('Reset token already used', 400);
  if (new Date(record.expires_at) < new Date()) throw new AuthError('Reset token has expired', 400);

  // Mark used first to prevent replay on concurrent requests
  await UserModel.consumePasswordResetToken(record.id);

  const newHash = await hashPassword(newPassword);
  await UserModel.updatePasswordHash(record.user_id, newHash);

  const user = await UserModel.findById(record.user_id);
  if (!user) throw new AuthError('User not found', 404);
  return UserModel.toPublicUser(user);
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
