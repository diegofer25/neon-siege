import { query, queryOne } from '../config/database';

export interface User {
  id: string;
  email: string | null;
  password_hash: string | null;
  display_name: string;
  auth_provider: 'email' | 'google' | 'anonymous';
  google_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export type PublicUser = Pick<User, 'id' | 'display_name' | 'auth_provider'>;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    display_name: user.display_name,
    auth_provider: user.auth_provider,
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

export async function createAnonymousUser(displayName: string): Promise<User> {
  const result = await queryOne<User>(
    `INSERT INTO users (display_name, auth_provider)
     VALUES ($1, 'anonymous')
     RETURNING *`,
    [displayName]
  );
  return result!;
}

export async function upgradeAnonymousToEmail(
  userId: string,
  email: string,
  passwordHash: string
): Promise<User | null> {
  return queryOne<User>(
    `UPDATE users SET email = $2, password_hash = $3, auth_provider = 'email', updated_at = NOW()
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
    `UPDATE users SET google_id = $2, email = $3, auth_provider = 'google', updated_at = NOW()
     WHERE id = $1 AND auth_provider = 'anonymous'
     RETURNING *`,
    [userId, googleId, email]
  );
}
