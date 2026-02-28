/**
 * @fileoverview Submits completed run scores to the leaderboard API.
 * Builds the payload from GameStore state and submits silently.
 */

import { apiFetch } from './ApiClient.js';
import { isAuthenticated } from './AuthService.js';

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
  if (!isAuthenticated()) return null;

  try {
    const result = await apiFetch('/api/leaderboard/submit', {
      method: 'POST',
      body: JSON.stringify({
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
      }),
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
