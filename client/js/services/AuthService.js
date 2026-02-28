/**
 * @fileoverview Authentication service for Neon Siege.
 * Manages user login state (email, Google, anonymous).
 * Anonymous users are persisted in localStorage so the device stays linked.
 */

import { apiFetch, setAccessToken, tryRestoreSession } from './ApiClient.js';

const STORAGE_KEY = 'neon_siege_auth';
const DEVICE_STORAGE_KEY = 'neon_siege_device_id';

/** @type {{ id: string, display_name: string, auth_provider: string, country?: string, country_code?: string, region?: string, city?: string }|null} */
let _currentUser = null;

/** @type {Set<function>} */
const _listeners = new Set();

/** @returns {boolean} */
export function isAuthenticated() {
  return _currentUser !== null;
}

/** @param {{ auth_provider?: string }|null} [user] */
export function isRegisteredUser(user = _currentUser) {
  return !!user && user.auth_provider !== 'anonymous';
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

function _generateDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function _getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) return existing;
    const created = _generateDeviceId();
    localStorage.setItem(DEVICE_STORAGE_KEY, created);
    return created;
  } catch {
    return _generateDeviceId();
  }
}

function _getStoredDeviceId() {
  try {
    return localStorage.getItem(DEVICE_STORAGE_KEY);
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
  // guest session using the device-bound ID stored in localStorage.
  const stored = _loadFromStorage();
  const deviceId = _getStoredDeviceId();
  if (stored?.auth_provider === 'anonymous' && deviceId) {
    try {
      const resumed = await apiFetch('/api/auth/anonymous/resume', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
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
 * Start registration with email + password.
 * Sends a verification code to the user's email.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 */
export async function registerEmail(email, password, displayName) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

/**
 * Verify pending email registration using a 6-digit code.
 * On success the server issues a session and the user is auto-logged-in.
 * @param {string} email
 * @param {string} code
 */
export async function verifyEmailRegistration(email, code) {
  const data = await apiFetch('/api/auth/register/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
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
  const deviceId = _getOrCreateDeviceId();
  const data = await apiFetch('/api/auth/anonymous', {
    method: 'POST',
    body: JSON.stringify({ displayName, deviceId }),
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

/**
 * Request a password-reset email for the given address.
 * Always resolves (server never reveals whether the address exists).
 * @param {string} email
 */
export async function requestPasswordReset(email) {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Consume a raw reset token and set a new password.
 * On success the server issues a fresh session, so the user is auto-logged-in.
 * @param {string} token   Raw token from the URL parameter
 * @param {string} newPassword
 */
export async function resetPassword(token, newPassword) {
  const data = await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
  _setAuthData(data);
  return _currentUser;
}
