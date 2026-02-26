/**
 * @fileoverview Authentication service for Neon Siege.
 * Manages user login state (email, Google, anonymous).
 */

import { apiFetch, setAccessToken, tryRestoreSession } from './ApiClient.js';

/** @type {{ id: string, display_name: string, auth_provider: string }|null} */
let _currentUser = null;

/** @type {Set<function>} */
const _listeners = new Set();

/** @returns {boolean} */
export function isAuthenticated() {
  return _currentUser !== null;
}

/** @returns {{ id: string, display_name: string, auth_provider: string }|null} */
export function getCurrentUser() {
  return _currentUser;
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

/**
 * Try restoring session from refresh cookie (call on app init).
 * @returns {Promise<boolean>}
 */
export async function restoreSession() {
  const data = await tryRestoreSession();
  if (data) {
    _currentUser = data.user;
    _notifyListeners();
    return true;
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
  setAccessToken(data.accessToken);
  _currentUser = data.user;
  _notifyListeners();
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
  setAccessToken(data.accessToken);
  _currentUser = data.user;
  _notifyListeners();
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
  setAccessToken(data.accessToken);
  _currentUser = data.user;
  _notifyListeners();
  return _currentUser;
}

/**
 * Create an anonymous account with a display name.
 * @param {string} displayName
 */
export async function loginAnonymous(displayName) {
  const data = await apiFetch('/api/auth/anonymous', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
  setAccessToken(data.accessToken);
  _currentUser = data.user;
  _notifyListeners();
  return _currentUser;
}

/**
 * Logout and clear session.
 */
export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch { /* ignore */ }
  setAccessToken(null);
  _currentUser = null;
  _notifyListeners();
}
