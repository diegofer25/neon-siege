/**
 * @fileoverview Client-side credit service for the arcade-continue system.
 *
 * All credit operations are server-authoritative — the client never stores
 * or trusts local credit balances.  The service communicates with the
 * /api/credits/* endpoints and manages the Stripe Checkout popup flow.
 *
 * Public API:
 *   getBalance()            → { freeRemaining, purchased, total }
 *   requestContinue()       → { continueToken, save, creditBalance }
 *   redeemContinue(token)   → { ok: true }
 *   openCheckout()          → polls until credits arrive or timeout
 */

import { apiFetch } from './ApiClient.js';
import { isAuthenticated, getCurrentUser } from './AuthService.js';
import { GameConfig } from '../config/GameConfig.js';

/** @typedef {{ freeRemaining: number, purchased: number, total: number }} CreditBalance */

// ─── Cached balance (display-only — always verified server-side) ─────────────

let _cachedBalance = { freeRemaining: 0, purchased: 0, total: 0 };

/** Read the last-fetched balance (display-only, not authoritative). */
export function getCachedBalance() {
  return { ..._cachedBalance };
}

// ─── API methods ─────────────────────────────────────────────────────────────

/**
 * Fetch the current credit balance from the server.
 * @returns {Promise<{ freeRemaining: number, purchased: number, total: number }>}
 */
export async function getBalance() {
  if (!isAuthenticated()) {
    return { freeRemaining: GameConfig.CONTINUE.FREE_CREDITS, purchased: 0, total: GameConfig.CONTINUE.FREE_CREDITS };
  }
  try {
    const data = await apiFetch('/api/credits');
    _cachedBalance = data.credits;
    return { ..._cachedBalance };
  } catch (err) {
    console.warn('[CreditService] Failed to fetch balance:', err.message);
    return { ..._cachedBalance };
  }
}

/**
 * Request a continue from the server.
 * Deducts 1 credit, returns a one-time continue token and the server-held save.
 *
 * @returns {Promise<{ continueToken: string, save: object, creditBalance: object }>}
 * @throws {ApiError} 402 if no credits, 404 if no save
 */
export async function requestContinue() {
  const data = await apiFetch('/api/credits/continue', { method: 'POST' });
  _cachedBalance = data.creditBalance;
  return data;
}

/**
 * Redeem (consume) a continue token after the game has restored.
 * This deletes the old save server-side.
 *
 * @param {string} continueToken
 * @returns {Promise<{ ok: boolean }>}
 */
export async function redeemContinue(continueToken) {
  return apiFetch('/api/credits/redeem', {
    method: 'POST',
    body: JSON.stringify({ continueToken }),
  });
}

/**
 * Open a Stripe Checkout popup for purchasing credits.
 * Polls the balance endpoint until credits arrive or 5 minutes elapse.
 *
 * @returns {Promise<{ success: boolean, balance: object }>}
 * @throws {ApiError} 403 if anonymous user
 */
export async function openCheckout() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  // Get the checkout URL from the server
  const origin = window.location.origin;
  const data = await apiFetch('/api/credits/checkout', {
    method: 'POST',
    body: JSON.stringify({
      successUrl: `${origin}/?checkout=success`,
      cancelUrl: `${origin}/?checkout=cancel`,
    }),
  });

  // Open Stripe Checkout in a popup (works in itch.io iframes)
  const popup = window.open(data.url, 'stripe-checkout', 'width=500,height=700,scrollbars=yes');

  // Poll for balance changes
  const startBalance = _cachedBalance.total;
  const startTime = Date.now();
  const POLL_INTERVAL = 3000;
  const TIMEOUT = 5 * 60 * 1000;

  return new Promise((resolve) => {
    const poll = async () => {
      // Check if popup was closed
      if (popup?.closed) {
        // Do one final check
        const balance = await getBalance();
        resolve({
          success: balance.total > startBalance,
          balance,
        });
        return;
      }

      // Timeout
      if (Date.now() - startTime > TIMEOUT) {
        popup?.close();
        const balance = await getBalance();
        resolve({
          success: balance.total > startBalance,
          balance,
        });
        return;
      }

      // Poll
      try {
        const balance = await getBalance();
        if (balance.total > startBalance) {
          popup?.close();
          resolve({ success: true, balance });
          return;
        }
      } catch { /* ignore polling errors */ }

      setTimeout(poll, POLL_INTERVAL);
    };

    setTimeout(poll, POLL_INTERVAL);
  });
}
