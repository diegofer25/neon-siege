/**
 * @fileoverview ActionDispatcher — action-based mutation pipeline with middleware support.
 *
 * Design:
 *   1. Actions are plain objects: { type: 'ENEMY_KILLED', payload: { ... } }
 *   2. Middleware pipeline: each middleware receives (action, store, next)
 *   3. Reducers are pure functions: (currentSlice, action) → newSlice
 *   4. After reduction, subscribers are notified via GameStore
 *
 * Middleware order:
 *   validation → logging → custom middleware → reduce → persist → telemetry
 */

export class ActionDispatcher {
	/**
	 * @param {import('./GameStore.js').GameStore} store
	 */
	constructor(store) {
		/** @type {import('./GameStore.js').GameStore} */
		this.store = store;

		/** @type {Array<Function>} Middleware functions in execution order */
		this._middleware = [];

		/** @type {Map<string, Array<{slice: string, reducer: Function}>>} Action type → reducers */
		this._reducers = new Map();

		/** @type {Map<string, Set<Function>>} Action type → side-effect handlers */
		this._effects = new Map();

		/** @type {boolean} If true, dispatches during reduction are queued */
		this._dispatching = false;

		/** @type {Array<Object>} Queue for actions dispatched during reduction */
		this._queue = [];

		/** @type {Function|null} Compiled middleware chain (cached) */
		this._chain = null;
	}

	// ─── CONFIGURATION ──────────────────────────────────────────────────────────

	/**
	 * Add a middleware function.
	 * Middleware signature: (action, store, next) => void
	 * Call next(action) to pass to the next middleware.
	 * @param {Function} middlewareFn
	 * @returns {ActionDispatcher} this
	 */
	use(middlewareFn) {
		this._middleware.push(middlewareFn);
		this._chain = null; // Invalidate cache
		return this;
	}

	/**
	 * Register a reducer for an action type targeting a specific slice.
	 * Reducer signature: (currentSliceState, action, store) => updatesObject
	 * The returned object is merged into the slice via store.set().
	 *
	 * @param {string} actionType - Action type to handle (e.g., 'ENEMY_KILLED')
	 * @param {string} slice - Target slice name
	 * @param {Function} reducerFn
	 * @returns {ActionDispatcher} this
	 */
	addReducer(actionType, slice, reducerFn) {
		if (!this._reducers.has(actionType)) {
			this._reducers.set(actionType, []);
		}
		this._reducers.get(actionType).push({ slice, reducer: reducerFn });
		return this;
	}

	/**
	 * Register a side-effect handler that runs AFTER reduction.
	 * Effect signature: (action, store, dispatch) => void
	 * Use for VFX, audio, telemetry, or dispatching follow-up actions.
	 *
	 * @param {string} actionType
	 * @param {Function} effectFn
	 * @returns {ActionDispatcher} this
	 */
	addEffect(actionType, effectFn) {
		if (!this._effects.has(actionType)) {
			this._effects.set(actionType, new Set());
		}
		this._effects.get(actionType).add(effectFn);
		return this;
	}

	/**
	 * Remove a side-effect handler.
	 * @param {string} actionType
	 * @param {Function} effectFn
	 */
	removeEffect(actionType, effectFn) {
		const effects = this._effects.get(actionType);
		if (effects) {
			effects.delete(effectFn);
		}
	}

	// ─── DISPATCH ───────────────────────────────────────────────────────────────

	/**
	 * Dispatch an action through the middleware pipeline.
	 * @param {Object} action - { type: string, payload?: Object }
	 * @returns {boolean} True if the action was processed
	 */
	dispatch(action) {
		if (!action?.type) {
			console.warn('[ActionDispatcher] Action must have a type:', action);
			return false;
		}

		// Queue if currently dispatching (prevents re-entrant reduction)
		if (this._dispatching) {
			this._queue.push(action);
			return true;
		}

		this._executeDispatch(action);

		// Process queued actions
		while (this._queue.length > 0) {
			const queued = this._queue.shift();
			this._executeDispatch(queued);
		}

		return true;
	}

	/**
	 * Dispatch multiple actions in a single store transaction.
	 * @param {Object[]} actions
	 */
	dispatchBatch(actions) {
		this.store.transaction(() => {
			for (const action of actions) {
				this.dispatch(action);
			}
		});
	}

	// ─── INTERNALS ──────────────────────────────────────────────────────────────

	/**
	 * Execute a single action through the full pipeline.
	 * @private
	 */
	_executeDispatch(action) {
		const chain = this._getChain();
		chain(action);
	}

	/**
	 * Build the middleware chain with reduction at the end.
	 * @private
	 * @returns {Function}
	 */
	_getChain() {
		if (this._chain) return this._chain;

		// The final handler in the chain performs reduction
		const reducer = (action) => this._reduce(action);

		// Build chain from right to left: last middleware wraps reducer, first wraps last
		let chain = reducer;
		for (let i = this._middleware.length - 1; i >= 0; i--) {
			const middleware = this._middleware[i];
			const next = chain;
			chain = (action) => middleware(action, this.store, next);
		}

		this._chain = chain;
		return chain;
	}

	/**
	 * Apply reducers and side effects for an action.
	 * @private
	 */
	_reduce(action) {
		this._dispatching = true;

		try {
			const reducers = this._reducers.get(action.type);

			if (reducers && reducers.length > 0) {
				// Batch all reducer updates in a transaction
				this.store.transaction(() => {
					for (const { slice, reducer } of reducers) {
						const currentState = this.store.get(slice);
						const updates = reducer(currentState, action, this.store);
						if (updates && typeof updates === 'object') {
							this.store.set(slice, updates);
						}
					}
				});
			}

			// Log the action
			this.store.logAction({
				type: action.type,
				payload: action.payload,
			});
		} finally {
			this._dispatching = false;
		}

		// Run side effects AFTER reduction (outside the dispatching lock)
		const effects = this._effects.get(action.type);
		if (effects) {
			const boundDispatch = this.dispatch.bind(this);
			for (const effectFn of effects) {
				try {
					effectFn(action, this.store, boundDispatch);
				} catch (err) {
					console.error(`[ActionDispatcher] Error in effect for ${action.type}:`, err);
				}
			}
		}
	}
}

/**
 * Action type constants for Neon Siege.
 */
export const ActionTypes = Object.freeze({
	// ─── Run State ─────────────────────────────────────
	GAME_START: 'GAME_START',
	GAME_RESTART: 'GAME_RESTART',
	SCORE_ADD: 'SCORE_ADD',
	SET_DIFFICULTY: 'SET_DIFFICULTY',
	RUN_USE_CONTINUE: 'RUN_USE_CONTINUE',

	// ─── Player ────────────────────────────────────────
	PLAYER_DAMAGE: 'PLAYER_DAMAGE',
	PLAYER_HEAL: 'PLAYER_HEAL',
	PLAYER_SYNC_STATS: 'PLAYER_SYNC_STATS',
	PLAYER_MOVE: 'PLAYER_MOVE',
	BUFF_APPLY: 'BUFF_APPLY',
	BUFF_REFRESH: 'BUFF_REFRESH',
	BUFF_REMOVE: 'BUFF_REMOVE',
	BUFF_TICK: 'BUFF_TICK',

	// ─── Skills / Attributes ───────────────────────────
	XP_ADD: 'XP_ADD',
	LEVEL_UP: 'LEVEL_UP',
	SKILL_LEARN: 'SKILL_LEARN',
	ATTR_ALLOCATE: 'ATTR_ALLOCATE',
	COOLDOWN_TICK: 'COOLDOWN_TICK',
	SKILL_CAST: 'SKILL_CAST',

	// ─── Combat / Entities ─────────────────────────────
	ENEMY_KILLED: 'ENEMY_KILLED',
	ENEMY_SPAWNED: 'ENEMY_SPAWNED',
	ENTITY_REMOVED: 'ENTITY_REMOVED',
	COMBO_HIT: 'COMBO_HIT',
	COMBO_RESET: 'COMBO_RESET',
	COMBO_TICK: 'COMBO_TICK',
	LOOT_DROP: 'LOOT_DROP',

	// ─── Wave ──────────────────────────────────────────
	WAVE_START: 'WAVE_START',
	WAVE_ENEMY_SPAWNED: 'WAVE_ENEMY_SPAWNED',
	WAVE_ENEMY_KILLED: 'WAVE_ENEMY_KILLED',
	WAVE_COMPLETE: 'WAVE_COMPLETE',
	COUNTDOWN_COMPLETE: 'COUNTDOWN_COMPLETE',
	APPLY_MODIFIER: 'APPLY_MODIFIER',

	// ─── Ascension ─────────────────────────────────────
	ASCENSION_OFFER: 'ASCENSION_OFFER',
	ASCENSION_SELECT: 'ASCENSION_SELECT',
	ASCENSION_RESET: 'ASCENSION_RESET',

	// ─── Progression ───────────────────────────────────
	PROGRESSION_WAVE: 'PROGRESSION_WAVE',
	PROGRESSION_RUN_END: 'PROGRESSION_RUN_END',
	CURRENCY_ADD: 'CURRENCY_ADD',
	ACHIEVEMENT_UNLOCK: 'ACHIEVEMENT_UNLOCK',

	// ─── Settings ──────────────────────────────────────
	SETTINGS_UPDATE: 'SETTINGS_UPDATE',

	// ─── System ────────────────────────────────────────
	TICK: 'TICK',
	TOGGLE_PAUSE: 'TOGGLE_PAUSE',
});
