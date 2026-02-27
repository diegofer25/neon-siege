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
 * The server marks the token as used but keeps the save intact so the player
 * can continue again if they die before the next wave auto-save fires.
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
      successUrl: `${origin}/checkout-complete.html?status=success`,
      cancelUrl:  `${origin}/checkout-complete.html?status=cancel`,
    }),
  });

  console.log('[CreditService] Opening Stripe popup:', data.url);

  // Open Stripe Checkout in a popup
  const popup = window.open(data.url, 'stripe-checkout', 'width=500,height=700,scrollbars=yes');

  const TIMEOUT = 5 * 60 * 1000;
  // After a successful payment the Stripe webhook arrives async — poll until
  // the balance actually increases (up to 20 s) before giving up.
  const WEBHOOK_POLL_INTERVAL = 2000;
  const WEBHOOK_POLL_MAX = 10;

  return new Promise((resolve) => {
    let settled = false;

    const finish = async (stripeSuccess) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      clearInterval(pollClosed);
      popup?.close();

      if (!stripeSuccess) {
        const balance = await getBalance();
        resolve({ success: false, balance });
        return;
      }

      // Stripe webhook is async — retry getBalance until credits arrive
      const balanceBefore = _cachedBalance.total;
      let attempts = 0;
      while (attempts < WEBHOOK_POLL_MAX) {
        await new Promise(r => setTimeout(r, WEBHOOK_POLL_INTERVAL));
        const balance = await getBalance();
        if (balance.total > balanceBefore) {
          resolve({ success: true, balance });
          return;
        }
        attempts++;
      }

      // Webhook never arrived within the window — resolve anyway
      const balance = await getBalance();
      resolve({ success: balance.total > balanceBefore, balance });
    };

    // Primary: postMessage from checkout-complete.html
    const onMessage = (event) => {
      // Only accept messages from our own origin
      if (event.origin !== origin) return;
      if (event.data?.type !== 'checkout-complete') return;
      finish(event.data.success === true);
    };
    window.addEventListener('message', onMessage);

    // Fallback: if popup is closed without postMessage (e.g. user manually closes it)
    const pollClosed = setInterval(() => {
      if (popup?.closed) {
        console.log('[CreditService] Popup closed without postMessage — treating as cancel.');
        clearInterval(pollClosed);
        finish(false);
      }
    }, 500);

    // Hard timeout — 5 minutes
    const timer = setTimeout(() => {
      console.warn('[CreditService] Checkout timed out after 5 minutes.');
      finish(false);
    }, TIMEOUT);
  });
}
