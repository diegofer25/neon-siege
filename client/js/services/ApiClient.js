/**
 * @fileoverview HTTP client for the Neon Siege API.
 * Handles JWT token management, auto-refresh on 401, and request helpers.
 */

let _accessToken = null;

/** @param {string|null} token */
export function setAccessToken(token) {
  _accessToken = token;
}

/** @returns {string|null} */
export function getAccessToken() {
  return _accessToken;
}

/**
 * Make an authenticated API request.
 * Automatically retries once with a refreshed token on 401.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  let res = await fetch(path, { ...options, headers, credentials: 'include' });

  // Auto-refresh on 401
  if (res.status === 401 && _accessToken) {
    const refreshed = await refreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${_accessToken}`;
      res = await fetch(path, { ...options, headers, credentials: 'include' });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  return res.json();
}

/**
 * Attempt to refresh the access token using the httpOnly refresh cookie.
 * @returns {Promise<boolean>}
 */
async function refreshToken() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      _accessToken = null;
      return false;
    }
    const data = await res.json();
    _accessToken = data.accessToken;
    return true;
  } catch {
    _accessToken = null;
    return false;
  }
}

/**
 * Try to restore a session from a refresh token cookie on page load.
 * @returns {Promise<{accessToken: string, user: any}|null>}
 */
export async function tryRestoreSession() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    _accessToken = data.accessToken;
    return data;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
