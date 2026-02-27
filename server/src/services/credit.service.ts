/**
 * @fileoverview Credit service — orchestrates the arcade-continue credit system.
 *
 * Flow:
 *   1. requestContinue(userId) → deduct 1 credit, issue a one-time continue token
 *      bound to the current save version, return the server-held save + token.
 *   2. redeemContinue(userId, token) → consume the token, delete the old save so
 *      it can't be replayed, return success.
 *   3. getBalance(userId) → read-only balance check.
 *   4. grantPurchasedCredits(userId, amount, stripeSessionId) → idempotent credit grant.
 */

import { pool } from '../config/database';
import { env } from '../config/env';
import * as CreditModel from '../models/credit.model';

/** Continue token TTL — 5 minutes. */
const TOKEN_TTL_MS = 5 * 60 * 1000;

// ─── Token helpers ───────────────────────────────────────────────────────────

async function _getTokenHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.CONTINUE_TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function _buildContinueToken(userId: string, saveVersion: number): Promise<string> {
  const nonce = crypto.randomUUID();
  const payload = `${userId}:${saveVersion}:${nonce}:${Date.now()}`;

  const key = await _getTokenHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const b64Payload = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${b64Payload}.${sigHex}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface CreditBalance {
  freeRemaining: number;
  purchased: number;
  total: number;
}

/**
 * Get the current credit balance for a user.
 */
export async function getBalance(userId: string): Promise<CreditBalance> {
  const credits = await CreditModel.getOrCreateCredits(userId);
  return {
    freeRemaining: credits.free_credits_remaining,
    purchased: credits.balance,
    total: credits.free_credits_remaining + credits.balance,
  };
}

/**
 * Request a continue: deduct 1 credit, issue a one-time continue token,
 * and return the server-held save data.
 *
 * This is the critical atomic operation — everything happens in a single
 * DB transaction so partial failures can't leave an inconsistent state.
 */
export async function requestContinue(
  userId: string
): Promise<{
  continueToken: string;
  save: Record<string, unknown>;
  creditBalance: CreditBalance;
}> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Deduct one credit (throws 402 if none available)
    const deduction = await CreditModel.deductCreditTx(client, userId);

    // 2. Load & validate the server-side save
    const saveRow = await client.query(
      'SELECT * FROM save_states WHERE user_id = $1',
      [userId]
    );
    const save = saveRow.rows[0];
    if (!save) {
      throw new CreditModel.CreditError('No save found — nothing to continue from', 404);
    }

    const saveVersion = save.save_version;

    // 3. Generate a continue token bound to this save version
    const token = await _buildContinueToken(userId, saveVersion);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await CreditModel.createContinueToken(client, userId, token, saveVersion, expiresAt);

    // 4. Record the credit usage transaction
    await CreditModel.recordTransactionTx(client, userId, deduction.type, -1, null, {
      wave: save.wave,
      saveVersion,
    });

    await client.query('COMMIT');

    // Opportunistic cleanup (non-blocking)
    CreditModel.cleanExpiredTokens().catch(() => {});

    // Build the save payload to return to the client
    const savePayload = {
      ...(save.save_data as Record<string, unknown>),
      schemaVersion: save.schema_version,
      savedAt: save.updated_at?.getTime?.() ?? Date.now(),
      wave: save.wave,
      gameState: save.game_state,
    };

    return {
      continueToken: token,
      save: savePayload,
      creditBalance: {
        freeRemaining: deduction.newFree,
        purchased: deduction.newBalance,
        total: deduction.newFree + deduction.newBalance,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Redeem a continue token: validate + consume it.
 * The save is intentionally NOT deleted here — if the player dies during the
 * same wave they resumed (before the next wave's auto-save fires), the server
 * save must still be present so they can spend another credit to continue again.
 * Each continuation already costs a credit, so replay protection is credit-gated.
 * The save is naturally overwritten by the wave auto-save in continueToNextWave().
 */
export async function redeemContinue(userId: string, continueToken: string): Promise<boolean> {
  // Consume the token (atomic — UPDATE … WHERE consumed = FALSE)
  const result = await CreditModel.consumeContinueToken(userId, continueToken);
  if (!result) {
    throw new CreditModel.CreditError('Invalid, expired, or already-used continue token', 403);
  }

  return true;
}

/**
 * Grant purchased credits (called from Stripe webhook). Idempotent.
 */
export async function grantPurchasedCredits(
  userId: string,
  amount: number,
  stripeSessionId: string
): Promise<CreditBalance> {
  const credits = await CreditModel.grantPurchasedCredits(userId, amount, stripeSessionId);
  return {
    freeRemaining: credits.free_credits_remaining,
    purchased: credits.balance,
    total: credits.free_credits_remaining + credits.balance,
  };
}
