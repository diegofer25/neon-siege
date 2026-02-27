/**
 * @fileoverview Save API service — wraps all /api/save endpoints.
 *
 * Security model
 * ──────────────
 * Before any save can be written to the server the client must call
 * `startSaveSession()`.  The server issues a signed session token that is
 * stored in memory only (never in localStorage / sessionStorage).  This means:
 *
 *  • Saves crafted outside a real game tab (e.g. via curl / Postman) are
 *    rejected — they have no valid token.
 *  • Page refresh / tab reopen invalidates the in-memory token.  The player
 *    must start a new run to generate fresh saves.
 *  • Tokens are HMAC-signed server-side; a token for user A cannot be used to
 *    forge a save for user B even if intercepted.
 */

import { apiFetch } from './ApiClient.js';

/** In-memory session token — intentionally not persisted to storage. */
let _sessionToken = null;

// ─── Session ───────────────────────────────────────────────────────────────────

/**
 * Request a new save-session token from the server.
 * Call this at the start of every new game run (before the first save).
 * @returns {Promise<string>} The session token.
 */
export async function startSaveSession() {
  const data = await apiFetch('/api/save/session', { method: 'POST' });
  _sessionToken = data.token;
  return _sessionToken;
}

/**
 * Return the current in-memory session token, or null if no session is active.
 * @returns {string|null}
 */
export function getSaveSessionToken() {
  return _sessionToken;
}

/**
 * Revoke the in-memory session token (e.g. on "Clear Save" or game reset).
 */
export function clearSaveSession() {
  _sessionToken = null;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Load the authenticated user's save state from the server.
 * @returns {Promise<object|null>} The parsed save object, or null if none exists.
 */
export async function loadSaveFromServer() {
  try {
    const data = await apiFetch('/api/save');
    return data.save ?? null;
  } catch (err) {
    // 404 means no save — expected, not an error.
    if (err?.status === 404) return null;
    throw err;
  }
}

/**
 * Persist a snapshot to the server.  Requires an active session token, which
 * is attached automatically from the in-memory store.
 *
 * @param {object} snapshot - The save snapshot produced by `Game.getSaveSnapshot()`.
 * @returns {Promise<boolean>} true on success, false if no session token is active.
 */
export async function persistSaveToServer(snapshot) {
  if (!_sessionToken) return false;

  await apiFetch('/api/save', {
    method: 'PUT',
    body: JSON.stringify({
      sessionToken: _sessionToken,
      saveData: snapshot,
      wave: snapshot.wave ?? snapshot.legacyCompat?.wave ?? 1,
      gameState: snapshot.gameState ?? snapshot.legacyCompat?.gameState ?? 'paused',
      schemaVersion: snapshot.schemaVersion ?? 2,
    }),
  });

  return true;
}

/**
 * Delete the authenticated user's save state from the server.
 * @returns {Promise<void>}
 */
export async function deleteSaveFromServer() {
  await apiFetch('/api/save', { method: 'DELETE' });
}
