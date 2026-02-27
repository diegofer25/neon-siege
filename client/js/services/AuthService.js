/**
 * @fileoverview Authentication service for Neon Siege.
 * Manages user login state (email, Google, anonymous).
 * Anonymous users are persisted in localStorage so the device stays linked.
 */

import { apiFetch, setAccessToken, tryRestoreSession } from './ApiClient.js';

const STORAGE_KEY = 'neon_siege_auth';

/** @type {{ id: string, display_name: string, auth_provider: string, country?: string, country_code?: string, region?: string, city?: string }|null} */
let _currentUser = null;

/** @type {Set<function>} */
const _listeners = new Set();

/** @returns {boolean} */
export function isAuthenticated() {
  return _currentUser !== null;
}

/** @returns {{ id: string, display_name: string, auth_provider: string, country?: string, country_code?: string, region?: string, city?: string }|null} */
export function getCurrentUser() {
  return _currentUser;
}

/**
 * Get the current user's geographic location (resolved from IP on score submit).
 * @returns {{ country: string, countryCode: string, region: string, city: string }|null}
 */
export function getUserLocation() {
  if (!_currentUser) return null;
  const { country, country_code, region, city } = _currentUser;
  if (!country_code) return null;
  return { country, countryCode: country_code, region, city };
}

/**
 * Subscribe to auth state changes.
 * @param {function} listener
 * @returns {function} unsubscribe
 */
export function onAuthChange(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function _notifyListeners() {
  for (const fn of _listeners) {
    try { fn(_currentUser); } catch (e) { console.error('Auth listener error:', e); }
  }
}

/** Persist user info to localStorage so we can restore on next visit. */
function _saveToStorage(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Read persisted user info from localStorage. */
function _loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set user after a successful auth call and persist.
 * @param {any} data - Response with { accessToken, user }
 */
function _setAuthData(data) {
  setAccessToken(data.accessToken);
  _currentUser = data.user;
  _saveToStorage(_currentUser);
  _notifyListeners();
}

/**
 * Try restoring session:
 * 1. First try the refresh token cookie (works for all account types)
 * 2. For anonymous users: fall back to resume by stored userId (device token)
 * @returns {Promise<boolean>}
 */
export async function restoreSession() {
  // Try refresh token first (httpOnly cookie, works while cookie is alive)
  const data = await tryRestoreSession();
  if (data) {
    _currentUser = data.user;
    _saveToStorage(_currentUser);
    _notifyListeners();
    return true;
  }

  // For anonymous users: if the refresh cookie expired/cleared, resume the
  // guest session using the stored userId as a device-bound token.
  const stored = _loadFromStorage();
  if (stored?.auth_provider === 'anonymous' && stored?.id) {
    try {
      const resumed = await apiFetch('/api/auth/anonymous/resume', {
        method: 'POST',
        body: JSON.stringify({ userId: stored.id }),
      });
      _setAuthData(resumed);
      return true;
    } catch {
      // Guest session no longer exists on server — clear stale storage
      _saveToStorage(null);
    }
  }

  return false;
}

/**
 * Register with email + password.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 */
export async function registerEmail(email, password, displayName) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
  _setAuthData(data);
  return _currentUser;
}

/**
 * Login with email + password.
 * @param {string} email
 * @param {string} password
 */
export async function loginEmail(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  _setAuthData(data);
  return _currentUser;
}

/**
 * Login with Google ID token.
 * @param {string} idToken
 */
export async function loginGoogle(idToken) {
  const data = await apiFetch('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  _setAuthData(data);
  return _currentUser;
}

/**
 * Create an anonymous account with a display name.
 * The user is persisted in localStorage so this device stays linked.
 * @param {string} displayName
 */
export async function loginAnonymous(displayName) {
  const data = await apiFetch('/api/auth/anonymous', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
  _setAuthData(data);
  return _currentUser;
}

/**
 * Logout and clear session + stored data.
 */
export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch { /* ignore */ }
  setAccessToken(null);
  _currentUser = null;
  _saveToStorage(null);
  _notifyListeners();
}
