/**
 * @fileoverview Credit & continue-token model — D1/SQLite port.
 *
 * Replaces pg transactions (BEGIN/COMMIT + FOR UPDATE) with D1 batch()
 * and optimistic update patterns. D1 is single-writer per database, so
 * row-level locks are unnecessary.
 */

import { query, queryOne, run, batch, nowISO, newId } from '../db';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  free_credits_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'free_use' | 'paid_use' | 'purchase';
  amount: number;
  stripe_session_id: string | null;
  metadata: string; // JSON text
  created_at: string;
}

export interface ContinueToken {
  id: string;
  user_id: string;
  token: string;
  save_version: number;
  consumed: number; // SQLite boolean
  created_at: string;
  expires_at: string;
}

// ─── User Credits ────────────────────────────────────────────────────────────

export async function getOrCreateCredits(db: D1Database, userId: string): Promise<UserCredits> {
  const existing = await queryOne<UserCredits>(
    db,
    'SELECT * FROM user_credits WHERE user_id = ?',
    [userId],
  );
  if (existing) return existing;

  const id = newId();
  const now = nowISO();
  await run(
    db,
    `INSERT INTO user_credits (id, user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO NOTHING`,
    [id, userId, now, now],
  );
  return (await queryOne<UserCredits>(
    db,
    'SELECT * FROM user_credits WHERE user_id = ?',
    [userId],
  ))!;
}

// ─── Deduct credit (atomic via D1 batch) ─────────────────────────────────────

export interface DeductResult {
  type: 'free_use' | 'paid_use';
  newFree: number;
  newBalance: number;
}

/**
 * Deduct one credit. Prefers free credits, then purchased.
 * Uses optimistic update with conditional WHERE to ensure atomicity.
 */
export async function deductCredit(db: D1Database, userId: string): Promise<DeductResult> {
  // Ensure row exists
  await getOrCreateCredits(db, userId);

  const credits = (await queryOne<UserCredits>(
    db,
    'SELECT * FROM user_credits WHERE user_id = ?',
    [userId],
  ))!;

  if (credits.free_credits_remaining > 0) {
    const result = await run(
      db,
      `UPDATE user_credits SET free_credits_remaining = free_credits_remaining - 1, updated_at = ?
       WHERE user_id = ? AND free_credits_remaining > 0`,
      [nowISO(), userId],
    );
    if (result.meta.changes === 0) {
      throw new CreditError('Credit deduction race — retry', 409);
    }
    return {
      type: 'free_use',
      newFree: credits.free_credits_remaining - 1,
      newBalance: credits.balance,
    };
  }

  if (credits.balance > 0) {
    const result = await run(
      db,
      `UPDATE user_credits SET balance = balance - 1, updated_at = ?
       WHERE user_id = ? AND balance > 0`,
      [nowISO(), userId],
    );
    if (result.meta.changes === 0) {
      throw new CreditError('Credit deduction race — retry', 409);
    }
    return {
      type: 'paid_use',
      newFree: 0,
      newBalance: credits.balance - 1,
    };
  }

  throw new CreditError('No credits remaining', 402);
}

/** Record a transaction row. */
export async function recordTransaction(
  db: D1Database,
  userId: string,
  type: 'free_use' | 'paid_use' | 'purchase',
  amount: number,
  stripeSessionId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const id = newId();
  await run(
    db,
    `INSERT INTO credit_transactions (id, user_id, type, amount, stripe_session_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, type, amount, stripeSessionId, JSON.stringify(metadata), nowISO()],
  );
}

/** Grant purchased credits (idempotent by stripe_session_id). */
export async function grantPurchasedCredits(
  db: D1Database,
  userId: string,
  amount: number,
  stripeSessionId: string,
): Promise<UserCredits> {
  // Idempotency check
  const existing = await queryOne<{ id: string }>(
    db,
    'SELECT id FROM credit_transactions WHERE stripe_session_id = ?',
    [stripeSessionId],
  );
  if (existing) {
    return (await queryOne<UserCredits>(
      db,
      'SELECT * FROM user_credits WHERE user_id = ?',
      [userId],
    ))!;
  }

  // Ensure credits row exists
  await getOrCreateCredits(db, userId);

  // Grant + record in batch for atomicity
  const now = nowISO();
  const txId = newId();
  await batch(db, [
    {
      sql: `UPDATE user_credits SET balance = balance + ?, updated_at = ? WHERE user_id = ?`,
      params: [amount, now, userId],
    },
    {
      sql: `INSERT INTO credit_transactions (id, user_id, type, amount, stripe_session_id, metadata, created_at)
            VALUES (?, ?, 'purchase', ?, ?, '{}', ?)`,
      params: [txId, userId, amount, stripeSessionId, now],
    },
  ]);

  return (await queryOne<UserCredits>(
    db,
    'SELECT * FROM user_credits WHERE user_id = ?',
    [userId],
  ))!;
}

// ─── Continue Tokens ─────────────────────────────────────────────────────────

export async function createContinueToken(
  db: D1Database,
  userId: string,
  token: string,
  saveVersion: number,
  expiresAt: string,
): Promise<void> {
  const id = newId();
  await run(
    db,
    `INSERT INTO continue_tokens (id, user_id, token, save_version, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, token, saveVersion, expiresAt, nowISO()],
  );
}

/** Consume a continue token. Returns save_version if valid, null otherwise. */
export async function consumeContinueToken(
  db: D1Database,
  userId: string,
  token: string,
): Promise<{ saveVersion: number } | null> {
  // Atomic conditional update
  const now = nowISO();
  const result = await run(
    db,
    `UPDATE continue_tokens SET consumed = 1
     WHERE user_id = ? AND token = ? AND consumed = 0 AND expires_at > datetime('now')`,
    [userId, token],
  );

  if (result.meta.changes === 0) return null;

  const row = await queryOne<ContinueToken>(
    db,
    'SELECT * FROM continue_tokens WHERE user_id = ? AND token = ?',
    [userId, token],
  );
  return row ? { saveVersion: row.save_version } : null;
}

/** Clean up expired / consumed tokens (opportunistic). */
export async function cleanExpiredTokens(db: D1Database): Promise<void> {
  await run(
    db,
    `DELETE FROM continue_tokens WHERE consumed = 1 OR expires_at < datetime('now')`,
    [],
  );
}

// ─── Error ──────────────────────────────────────────────────────────────────

export class CreditError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'CreditError';
  }
}
