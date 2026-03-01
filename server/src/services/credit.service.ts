/**
 * @fileoverview Credit service — Cloudflare Workers port.
 *
 * Replaces pg pool transactions (BEGIN/COMMIT) with D1 batch() and
 * optimistic update patterns. D1 is single-writer, so row-level locks
 * are unnecessary.
 */

import { queryOne, nowISO } from '../db';
import * as CreditModel from '../models/credit.model';
import * as SaveModel from '../models/save.model';

/** Continue token TTL — 5 minutes. */
const TOKEN_TTL_MS = 5 * 60 * 1000;

// ─── Token helpers ───────────────────────────────────────────────────────────

async function _getTokenHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function _buildContinueToken(
  userId: string,
  saveVersion: number,
  secret: string,
): Promise<string> {
  const nonce = crypto.randomUUID();
  const payload = `${userId}:${saveVersion}:${nonce}:${Date.now()}`;

  const key = await _getTokenHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
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

export async function getBalance(db: D1Database, userId: string): Promise<CreditBalance> {
  const credits = await CreditModel.getOrCreateCredits(db, userId);
  return {
    freeRemaining: credits.free_credits_remaining,
    purchased: credits.balance,
    total: credits.free_credits_remaining + credits.balance,
  };
}

/**
 * Request a continue: deduct 1 credit, issue a one-time continue token,
 * return server-held save + updated balance.
 *
 * Flow using D1 (no traditional transactions):
 *   1. Deduct credit (optimistic WHERE clause)
 *   2. Load save state
 *   3. Generate continue token
 *   4. Persist token + transaction in batch
 */
export async function requestContinue(
  db: D1Database,
  env: { CONTINUE_TOKEN_SECRET: string },
  userId: string,
): Promise<{
  continueToken: string;
  save: Record<string, unknown>;
  creditBalance: CreditBalance;
}> {
  // 1. Deduct one credit (throws 402 if none available)
  const deduction = await CreditModel.deductCredit(db, userId);

  // 2. Load & validate server-side save
  const save = await SaveModel.getSaveByUserId(db, userId);
  if (!save) {
    throw new CreditModel.CreditError('No save found — nothing to continue from', 404);
  }

  const saveVersion = save.save_version;

  // 3. Generate continue token bound to this save version
  const token = await _buildContinueToken(userId, saveVersion, env.CONTINUE_TOKEN_SECRET);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  // 4. Persist token + transaction atomically via batch
  await CreditModel.createContinueToken(db, userId, token, saveVersion, expiresAt);

  await CreditModel.recordTransaction(db, userId, deduction.type, -1, null, {
    wave: save.wave,
    saveVersion,
  });

  // Opportunistic cleanup (fire and forget)
  CreditModel.cleanExpiredTokens(db).catch(() => {});

  // Parse save data
  let saveData: Record<string, unknown>;
  try {
    saveData = typeof save.save_data === 'string' ? JSON.parse(save.save_data) : (save.save_data as Record<string, unknown>);
  } catch {
    saveData = {};
  }

  const savePayload = {
    ...saveData,
    schemaVersion: save.schema_version,
    savedAt: new Date(save.updated_at).getTime(),
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
}

/**
 * Redeem a continue token: validate + consume it.
 */
export async function redeemContinue(
  db: D1Database,
  userId: string,
  continueToken: string,
): Promise<boolean> {
  const result = await CreditModel.consumeContinueToken(db, userId, continueToken);
  if (!result) {
    throw new CreditModel.CreditError('Invalid, expired, or already-used continue token', 403);
  }
  return true;
}

/**
 * Grant purchased credits (called from Stripe webhook). Idempotent.
 */
export async function grantPurchasedCredits(
  db: D1Database,
  userId: string,
  amount: number,
  stripeSessionId: string,
): Promise<CreditBalance> {
  const credits = await CreditModel.grantPurchasedCredits(db, userId, amount, stripeSessionId);
  return {
    freeRemaining: credits.free_credits_remaining,
    purchased: credits.balance,
    total: credits.free_credits_remaining + credits.balance,
  };
}
