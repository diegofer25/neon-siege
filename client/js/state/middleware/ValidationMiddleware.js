/**
 * @fileoverview ValidationMiddleware — schema validation and impossible-state prevention.
 *
 * Gated by __DEV__ flag (enabled via ?debug=true URL param).
 * In production, this middleware passes through with zero overhead.
 *
 * Validates:
 *   - Action shape (must have `type` string)
 *   - Phase-based action blocking (e.g., no SCORE_ADD during 'menu')
 *   - Value range constraints on post-reduction state
 */

import { ActionTypes } from '../ActionDispatcher.js';

const __DEV__ = typeof window !== 'undefined'
	&& new URLSearchParams(window.location.search).get('debug') === 'true';

/**
 * Actions that should only be dispatched during active gameplay.
 * @type {Set<string>}
 */
const GAMEPLAY_ONLY_ACTIONS = new Set([
	ActionTypes.SCORE_ADD,
	ActionTypes.ENEMY_KILLED,
	ActionTypes.COMBO_HIT,
	ActionTypes.LOOT_DROP,
	ActionTypes.PLAYER_DAMAGE,
	ActionTypes.PLAYER_HEAL,
	ActionTypes.XP_ADD,
	ActionTypes.WAVE_ENEMY_SPAWNED,
	ActionTypes.WAVE_ENEMY_KILLED,
	ActionTypes.BUFF_APPLY,
	ActionTypes.BUFF_REFRESH,
	ActionTypes.BUFF_REMOVE,
	ActionTypes.BUFF_TICK,
	ActionTypes.COOLDOWN_TICK,
	ActionTypes.SKILL_CAST,
]);

/**
 * Create the validation middleware function.
 * @param {import('../GameFSM.js').GameFSM} fsm - Reference to the FSM for phase checking
 * @returns {Function} Middleware function
 */
export function createValidationMiddleware(fsm) {
	if (!__DEV__) {
		// In production, pass through directly
		return (action, store, next) => next(action);
	}

	return function validationMiddleware(action, store, next) {
		// ── Action shape validation ──
		if (!action || typeof action.type !== 'string') {
			console.error('[Validation] Invalid action — must have a string `type`:', action);
			return;
		}

		// ── Phase-based blocking ──
		if (GAMEPLAY_ONLY_ACTIONS.has(action.type)) {
			if (fsm.current && !fsm.isIn('playing')) {
				console.warn(
					`[Validation] Action ${action.type} blocked — not in a playing state (current: ${fsm.current})`
				);
				return;
			}
		}

		// Pass to next middleware
		next(action);

		// ── Post-reduction validation ──
		_validatePostState(action, store);
	};
}

/**
 * Validate state constraints after reduction.
 * @private
 */
function _validatePostState(action, store) {
	// Player HP constraints
	const player = store.get('player');
	if (player) {
		if (typeof player.hp === 'number') {
			if (player.hp < 0) {
				console.warn(`[Validation] player.hp is negative (${player.hp}) after ${action.type}`);
			}
			if (typeof player.maxHp === 'number' && player.hp > player.maxHp) {
				console.warn(`[Validation] player.hp (${player.hp}) exceeds maxHp (${player.maxHp}) after ${action.type}`);
			}
		}
		if (typeof player.shieldHp === 'number' && player.shieldHp < 0) {
			console.warn(`[Validation] player.shieldHp is negative (${player.shieldHp}) after ${action.type}`);
		}
	}

	// Run score constraints
	const run = store.get('run');
	if (run && typeof run.score === 'number' && run.score < 0) {
		console.warn(`[Validation] run.score is negative (${run.score}) after ${action.type}`);
	}

	// Wave constraints
	const wave = store.get('wave');
	if (wave) {
		if (typeof wave.enemiesKilled === 'number' && wave.enemiesKilled < 0) {
			console.warn(`[Validation] wave.enemiesKilled is negative after ${action.type}`);
		}
	}
}
