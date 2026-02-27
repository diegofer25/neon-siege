/**
 * @fileoverview Progression API service — wraps /api/progression endpoints.
 *
 * Used by ProgressionManager to replace the localStorage neon_td_meta store
 * with server-authoritative persistence.
 *
 * All calls require an authenticated user (access token handled by ApiClient).
 * Fire-and-forget writes should be debounced by the caller.
 */

import { apiFetch } from './ApiClient.js';

/**
 * Load the authenticated user's meta-progression from the server.
 * Returns `{ data: {}, schemaVersion: 1 }` for brand-new accounts.
 *
 * @returns {Promise<{ data: object, schemaVersion: number }>}
 */
export async function loadProgressionFromServer() {
  return apiFetch('/api/progression');
}

/**
 * Persist meta-progression to the server.
 * Callers should debounce frequent writes (e.g. every wave completion).
 *
 * @param {object} data - The full progression state object.
 * @param {number} schemaVersion
 * @returns {Promise<void>}
 */
export async function persistProgressionToServer(data, schemaVersion = 1) {
  await apiFetch('/api/progression', {
    method: 'PUT',
    body: JSON.stringify({ data, schemaVersion }),
  });
}
