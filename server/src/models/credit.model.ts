/**
 * @fileoverview Database operations for the credits & continue-token system.
 *
 * Tables:
 *   user_credits          — per-user balance (free + purchased)
 *   credit_transactions   — immutable audit log
 *   continue_tokens       — one-time server-issued continue authorisations
 */

import { query, queryOne, pool } from '../config/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  free_credits_remaining: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'free_use' | 'paid_use' | 'purchase';
  amount: number;
  stripe_session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface ContinueToken {
  id: string;
  user_id: string;
  token: string;
  save_version: number;
  consumed: boolean;
  created_at: Date;
  expires_at: Date;
}

// ─── User Credits ────────────────────────────────────────────────────────────

/** Get or lazily create a user's credit row. */
export async function getOrCreateCredits(userId: string): Promise<UserCredits> {
  const existing = await queryOne<UserCredits>(
    'SELECT * FROM user_credits WHERE user_id = $1',
    [userId]
  );
  if (existing) return existing;

  return (await queryOne<UserCredits>(
    `INSERT INTO user_credits (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId]
  )) ?? (await queryOne<UserCredits>(
    'SELECT * FROM user_credits WHERE user_id = $1',
    [userId]
  ))!;
}

// ─── Transactional Helpers (called inside a pg client) ───────────────────────

/**
 * Deduct one credit within an existing DB transaction.
 * Prefers free credits, then purchased balance.
 * Returns the type of credit used ('free_use' | 'paid_use').
 * Throws if no credits available.
 */
export async function deductCreditTx(
  client: any,
  userId: string
): Promise<{ type: 'free_use' | 'paid_use'; newFree: number; newBalance: number }> {
  // Lock the row for update to prevent race conditions
  const row = await client.query(
    'SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE',
    [userId]
  );

  let credits: UserCredits | null = row.rows[0] ?? null;

  // Auto-create if missing
  if (!credits) {
    await client.query(
      `INSERT INTO user_credits (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const r = await client.query(
      'SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    credits = r.rows[0];
  }

  if (!credits) throw new CreditError('Failed to initialise credits', 500);

  if (credits.free_credits_remaining > 0) {
    // Use a free credit
    await client.query(
      `UPDATE user_credits
       SET free_credits_remaining = free_credits_remaining - 1, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    return {
      type: 'free_use',
      newFree: credits.free_credits_remaining - 1,
      newBalance: credits.balance,
    };
  }

  if (credits.balance > 0) {
    // Use a purchased credit
    await client.query(
      `UPDATE user_credits
       SET balance = balance - 1, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    return {
      type: 'paid_use',
      newFree: 0,
      newBalance: credits.balance - 1,
    };
  }

  throw new CreditError('No credits remaining', 402);
}

/** Record a transaction row inside an existing DB transaction. */
export async function recordTransactionTx(
  client: any,
  userId: string,
  type: 'free_use' | 'paid_use' | 'purchase',
  amount: number,
  stripeSessionId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await client.query(
    `INSERT INTO credit_transactions (user_id, type, amount, stripe_session_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, type, amount, stripeSessionId, JSON.stringify(metadata)]
  );
}

/** Grant purchased credits (used from Stripe webhook — idempotent). */
export async function grantPurchasedCredits(
  userId: string,
  amount: number,
  stripeSessionId: string
): Promise<UserCredits> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check idempotency — if this session was already processed, skip
    const existing = await client.query(
      'SELECT id FROM credit_transactions WHERE stripe_session_id = $1',
      [stripeSessionId]
    );
    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      const credits = await queryOne<UserCredits>(
        'SELECT * FROM user_credits WHERE user_id = $1',
        [userId]
      );
      return credits!;
    }

    // Ensure user_credits row exists
    await client.query(
      `INSERT INTO user_credits (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    // Add credits
    await client.query(
      `UPDATE user_credits
       SET balance = balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, amount]
    );

    // Record transaction
    await recordTransactionTx(client, userId, 'purchase', amount, stripeSessionId);

    await client.query('COMMIT');

    return (await queryOne<UserCredits>(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [userId]
    ))!;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Continue Tokens ─────────────────────────────────────────────────────────

export async function createContinueToken(
  client: any,
  userId: string,
  token: string,
  saveVersion: number,
  expiresAt: Date
): Promise<void> {
  await client.query(
    `INSERT INTO continue_tokens (user_id, token, save_version, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, token, saveVersion, expiresAt]
  );
}

/** Validate and consume a continue token. Returns save_version if valid. */
export async function consumeContinueToken(
  userId: string,
  token: string
): Promise<{ saveVersion: number } | null> {
  const row = await queryOne<ContinueToken>(
    `UPDATE continue_tokens
     SET consumed = TRUE
     WHERE user_id = $1
       AND token = $2
       AND consumed = FALSE
       AND expires_at > NOW()
     RETURNING *`,
    [userId, token]
  );

  return row ? { saveVersion: row.save_version } : null;
}

/** Clean up expired / consumed tokens (opportunistic). */
export async function cleanExpiredTokens(): Promise<void> {
  await query(
    `DELETE FROM continue_tokens
     WHERE consumed = TRUE OR expires_at < NOW()`,
    []
  );
}

// ─── Save version helpers ────────────────────────────────────────────────────

/** Get the current save_version for a user (or null if no save). */
export async function getSaveVersion(
  client: any,
  userId: string
): Promise<number | null> {
  const row = await client.query(
    'SELECT save_version FROM save_states WHERE user_id = $1',
    [userId]
  );
  return row.rows[0]?.save_version ?? null;
}

// ─── Error ──────────────────────────────────────────────────────────────────

export class CreditError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'CreditError';
  }
}
