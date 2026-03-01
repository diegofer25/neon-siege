/**
 * @fileoverview Submits completed run scores to the leaderboard API.
 * Builds the payload from GameStore state and submits silently.
 *
 * Anti-cheat flow:
 *   1. At game start, `requestGameSession()` fetches a server-issued session
 *      token + per-session HMAC key.
 *   2. At score submit, the payload is HMAC-signed with that key and both the
 *      token and checksum are sent to the server.
 */

import { apiFetch } from './ApiClient.js';
import { isRegisteredUser } from './AuthService.js';

// ─── Per-session HMAC signing (Web Crypto) ────────────────────────────────

/**
 * HMAC-SHA256 sign a string using a hex-encoded key.
 * @param {string} payload
 * @param {string} hexKey
 * @returns {Promise<string>} hex-encoded signature
 */
async function hmacSign(payload, hexKey) {
  const keyBytes = new Uint8Array(hexKey.length / 2);
  for (let i = 0; i < hexKey.length; i += 2) {
    keyBytes[i / 2] = parseInt(hexKey.substring(i, i + 2), 16);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(payload),
  );

  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Game session management ──────────────────────────────────────────────

/** @type {{ gameSessionToken: string; hmacKey: string } | null} */
let _currentSession = null;

/**
 * Request a game session from the server.
 * Call this at the start of a new run. The session token and HMAC key are
 * stored in memory and consumed on score submission.
 * @returns {Promise<boolean>} true if session was obtained
 */
export async function requestGameSession() {
  _currentSession = null;
  if (!isRegisteredUser()) return false;

  try {
    const result = await apiFetch('/api/leaderboard/session', { method: 'POST' });
    if (result?.gameSessionToken && result?.hmacKey) {
      _currentSession = {
        gameSessionToken: result.gameSessionToken,
        hmacKey: result.hmacKey,
      };
      return true;
    }
  } catch (err) {
    console.warn('Failed to obtain game session:', err.message);
  }
  return false;
}

/**
 * Submit a completed run to the leaderboard.
 * Fails silently if not authenticated or if the API is unreachable.
 *
 * @param {object} params
 * @param {string} params.difficulty
 * @param {number} params.score
 * @param {number} params.wave
 * @param {number} params.kills
 * @param {number} params.maxCombo
 * @param {number} params.level
 * @param {boolean} params.isVictory
 * @param {object} params.runDetails
 * @param {number} [params.gameDurationMs]
 * @param {number} [params.startWave] - Wave the run started from (>1 when loaded from save)
 * @param {number} [params.continuesUsed] - Number of continues used during the run
 * @returns {Promise<{entry: any, rank: number|null}|null>}
 */
export async function submitScore(params) {
  if (!isRegisteredUser()) return null;

  // Build the submission payload
  const payload = {
    difficulty: params.difficulty,
    score: params.score,
    wave: params.wave,
    kills: params.kills,
    maxCombo: params.maxCombo,
    level: params.level,
    isVictory: params.isVictory,
    runDetails: params.runDetails || {},
    gameDurationMs: params.gameDurationMs,
    startWave: params.startWave ?? 1,
    continuesUsed: params.continuesUsed ?? 0,
  };

  // Attach game session token + HMAC checksum if available
  if (_currentSession) {
    // Build canonical payload string (sorted keys, must match server)
    const checksumPayload = JSON.stringify({
      difficulty: payload.difficulty,
      gameDurationMs: payload.gameDurationMs ?? 0,
      isVictory: payload.isVictory,
      kills: payload.kills,
      level: payload.level,
      maxCombo: payload.maxCombo,
      score: payload.score,
      startWave: payload.startWave ?? 1,
      wave: payload.wave,
    });

    try {
      payload.checksum = await hmacSign(checksumPayload, _currentSession.hmacKey);
      payload.gameSessionToken = _currentSession.gameSessionToken;
    } catch (err) {
      console.warn('Failed to sign score payload:', err.message);
    }

    // Consume the session (single-use)
    _currentSession = null;
  }

  try {
    const result = await apiFetch('/api/leaderboard/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result;
  } catch (err) {
    console.warn('Score submission failed:', err.message);
    return null;
  }
}

/**
 * Build runDetails from the game's store for score submission.
 * @param {object} store - The GameStore instance
 * @returns {object}
 */
export function buildRunDetails(store) {
  return {
    skills: {
      ranks: store.get('skills', 'skillRanks'),
      equippedPassives: store.get('skills', 'equippedPassives'),
      equippedActives: store.get('skills', 'equippedActives'),
      equippedUltimate: store.get('skills', 'equippedUltimate'),
    },
    ascensions: (store.get('ascension', 'activeModifiers') || []).map(m => m.id),
    attributes: store.get('skills', 'attributes'),
    stats: {
      damageMod: store.get('player', 'damageMod'),
      fireRateMod: store.get('player', 'fireRateMod'),
      maxHp: store.get('player', 'maxHp'),
      maxShieldHp: store.get('player', 'maxShieldHp'),
      piercingLevel: store.get('player', 'piercingLevel'),
      hasTripleShot: store.get('player', 'hasTripleShot'),
      hasHomingShots: store.get('player', 'hasHomingShots'),
      explosiveShots: store.get('player', 'explosiveShots'),
    },
  };
}
