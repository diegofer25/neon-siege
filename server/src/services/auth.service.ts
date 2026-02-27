import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import * as UserModel from '../models/user.model';

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

export async function resumeAnonymous(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user || user.auth_provider !== 'anonymous') {
    throw new AuthError('Guest session not found', 404);
  }
  return UserModel.toPublicUser(user);
}

export async function createAnonymous(displayName: string) {
  const existing = await UserModel.findByDisplayName(displayName);

  if (existing) {
    // Allow re-login for anonymous accounts: the same guest name can be reclaimed
    // from any browser. Only block if the name belongs to a registered account.
    if (existing.auth_provider !== 'anonymous') {
      throw new AuthError('Player name already taken', 409);
    }
    return UserModel.toPublicUser(existing);
  }

  const user = await UserModel.createAnonymousUser(displayName);
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
