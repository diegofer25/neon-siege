/**
 * @fileoverview Achievements API service — wraps /api/achievements endpoints.
 */

import { apiFetch } from './ApiClient.js';

/**
 * Load all unlocked achievements for the authenticated user.
 * @returns {Promise<{ achievements: Array<{ achievementId: string, unlockedAt: string|null }> }>}
 */
export async function loadAchievementsFromServer() {
  return apiFetch('/api/achievements');
}

/**
 * Persist a newly unlocked achievement for the authenticated user.
 * @param {string} achievementId
 * @returns {Promise<{ ok: boolean }>}
 */
export async function unlockAchievementOnServer(achievementId) {
  const encodedId = encodeURIComponent(String(achievementId));
  return apiFetch(`/api/achievements/${encodedId}`, {
    method: 'POST',
  });
}
