/**
 * @fileoverview GameFSM — Hierarchical Finite State Machine for game phase management.
 *
 * Supports:
 *   - Hierarchical states: parent.child notation (e.g., 'playing.active')
 *   - Transition guards: conditional checks before allowing a transition
 *   - enter/exit/update hooks per state
 *   - Wildcard parent hooks: 'playing' hooks fire for all 'playing.*' substates
 *   - Transition event emission for devtools and middleware
 *   - Explicit transition table — only declared transitions are allowed
 *
 * State hierarchy for Neon TD:
 *   menu
 *   playing
 *     playing.countdown
 *     playing.active
 *     playing.midwave_levelup
 *   paused
 *   between_waves
 *     between_waves.ascension
 *     between_waves.powerup
 *   gameover
 */

export class GameFSM {
	/**
	 * @param {Object} owner - The object that owns this FSM (usually Game instance)
	 */
	constructor(owner) {
		/** @type {Object} Owner context passed to hooks */
		this.owner = owner;

		/** @type {string|null} Current state path (e.g., 'playing.active') */
		this.current = null;

		/** @type {string|null} Previous state path */
		this.previous = null;

		/** @type {Map<string, {enter?: Function, exit?: Function, update?: Function}>} */
		this._states = new Map();

		/** @type {Map<string, Set<string>>} Allowed transitions: from → Set<to> */
		this._transitions = new Map();

		/** @type {Map<string, Function>} Transition guards: 'from→to' → guardFn */
		this._guards = new Map();

		/** @type {Array<Function>} Transition listeners */
		this._listeners = [];

		/** @type {Array<{from: string, to: string, payload: Object, timestamp: number}>} Transition history */
		this._history = [];

		/** @type {number} Max history size */
		this._maxHistory = 50;

		/** @type {boolean} Whether a transition is currently in progress (prevents re-entrant transitions) */
		this._transitioning = false;

		/** @type {Array<{to: string, payload: Object}>} Queued transitions during re-entrant calls */
		this._queue = [];
	}

	// ─── CONFIGURATION ──────────────────────────────────────────────────────────

	/**
	 * Register a state with optional lifecycle hooks.
	 * @param {string} name - State path (e.g., 'playing.active')
	 * @param {{enter?: Function, exit?: Function, update?: Function}} hooks
	 * @returns {GameFSM} this (for chaining)
	 */
	addState(name, hooks = {}) {
		this._states.set(name, {
			enter: hooks.enter || null,
			exit: hooks.exit || null,
			update: hooks.update || null,
		});
		return this;
	}

	/**
	 * Declare an allowed transition.
	 * @param {string} from - Source state
	 * @param {string} to - Target state
	 * @returns {GameFSM} this (for chaining)
	 */
	addTransition(from, to) {
		if (!this._transitions.has(from)) {
			this._transitions.set(from, new Set());
		}
		this._transitions.get(from).add(to);
		return this;
	}

	/**
	 * Declare multiple transitions at once.
	 * @param {Array<[string, string]>} pairs - Array of [from, to] pairs
	 * @returns {GameFSM} this (for chaining)
	 */
	addTransitions(pairs) {
		for (const [from, to] of pairs) {
			this.addTransition(from, to);
		}
		return this;
	}

	/**
	 * Add a guard function for a specific transition.
	 * Guard receives (owner, payload) and must return true to allow the transition.
	 * @param {string} from
	 * @param {string} to
	 * @param {Function} guardFn
	 * @returns {GameFSM} this (for chaining)
	 */
	addGuard(from, to, guardFn) {
		this._guards.set(`${from}→${to}`, guardFn);
		return this;
	}

	// ─── QUERIES ────────────────────────────────────────────────────────────────

	/**
	 * Check if the FSM is in a specific state (exact match).
	 * @param {string} state
	 * @returns {boolean}
	 */
	is(state) {
		return this.current === state;
	}

	/**
	 * Check if the FSM is in a state or any of its children.
	 * e.g., isIn('playing') returns true for 'playing', 'playing.active', 'playing.countdown'
	 * @param {string} statePrefix
	 * @returns {boolean}
	 */
	isIn(statePrefix) {
		if (!this.current) return false;
		return this.current === statePrefix || this.current.startsWith(statePrefix + '.');
	}

	/**
	 * Check if a transition from current state to target is allowed.
	 * @param {string} to - Target state
	 * @param {Object} [payload]
	 * @returns {boolean}
	 */
	can(to, payload = {}) {
		if (!this.current) return false;

		// Check explicit transition
		if (!this._isTransitionAllowed(this.current, to)) return false;

		// Check guard
		const guardKey = `${this.current}→${to}`;
		const guard = this._guards.get(guardKey);
		if (guard && !guard(this.owner, payload)) return false;

		return true;
	}

	/**
	 * Get the parent state of a hierarchical state.
	 * @param {string} state - e.g., 'playing.active' → 'playing'
	 * @returns {string|null}
	 */
	getParent(state) {
		const dotIndex = state.lastIndexOf('.');
		return dotIndex >= 0 ? state.substring(0, dotIndex) : null;
	}

	/**
	 * Get the ancestry chain of a state (including itself).
	 * e.g., 'playing.active' → ['playing.active', 'playing']
	 * @param {string} state
	 * @returns {string[]}
	 */
	getAncestry(state) {
		const chain = [state];
		let parent = this.getParent(state);
		while (parent) {
			chain.push(parent);
			parent = this.getParent(parent);
		}
		return chain;
	}

	// ─── TRANSITIONS ────────────────────────────────────────────────────────────

	/**
	 * Transition to a new state.
	 * @param {string} to - Target state
	 * @param {Object} [payload] - Data passed to enter/exit hooks
	 * @returns {boolean} True if transition was successful
	 */
	transition(to, payload = {}) {
		// Handle re-entrant transitions by queuing
		if (this._transitioning) {
			this._queue.push({ to, payload });
			return true;
		}

		// Initial transition (no current state)
		if (this.current === null) {
			return this._executeTransition(null, to, payload);
		}

		// No-op if already in target state
		if (this.current === to) return false;

		// Validate transition
		if (!this._isTransitionAllowed(this.current, to)) {
			console.warn(`[FSM] Transition not allowed: ${this.current} → ${to}`);
			return false;
		}

		// Check guard
		const guardKey = `${this.current}→${to}`;
		const guard = this._guards.get(guardKey);
		if (guard && !guard(this.owner, payload)) {
			return false;
		}

		return this._executeTransition(this.current, to, payload);
	}

	/**
	 * Force a transition without checking the transition table or guards.
	 * Use sparingly — intended for error recovery and save restoration.
	 * @param {string} to
	 * @param {Object} [payload]
	 */
	forceTransition(to, payload = {}) {
		this._executeTransition(this.current, to, payload);
	}

	/**
	 * Run the update hook for the current state and its parent chain.
	 * @param {number} delta - Frame delta in ms
	 */
	update(delta) {
		if (!this.current) return;

		// Update parent states first, then the current state (top-down)
		const ancestry = this.getAncestry(this.current).reverse();
		for (const stateName of ancestry) {
			const state = this._states.get(stateName);
			if (state?.update) {
				state.update.call(this.owner, delta);
			}
		}
	}

	// ─── EVENTS ─────────────────────────────────────────────────────────────────

	/**
	 * Listen to all state transitions.
	 * @param {Function} callback - Called with ({from, to, payload, timestamp})
	 * @returns {Function} Unsubscribe function
	 */
	onChange(callback) {
		this._listeners.push(callback);
		return () => {
			this._listeners = this._listeners.filter(fn => fn !== callback);
		};
	}

	/**
	 * Get the transition history (for devtools).
	 * @returns {Array}
	 */
	getHistory() {
		return [...this._history];
	}

	// ─── INTERNALS ──────────────────────────────────────────────────────────────

	/**
	 * Check if a transition is declared (including parent wildcards).
	 * @private
	 */
	_isTransitionAllowed(from, to) {
		// Exact match
		const allowed = this._transitions.get(from);
		if (allowed?.has(to)) return true;

		// Check parent transitions (e.g., 'playing' can transition if 'playing.active' can)
		const fromParent = this.getParent(from);
		if (fromParent) {
			const parentAllowed = this._transitions.get(fromParent);
			if (parentAllowed?.has(to)) return true;
		}

		return false;
	}

	/**
	 * Execute a transition: exit old state hierarchy, enter new state hierarchy.
	 * @private
	 */
	_executeTransition(from, to, payload) {
		this._transitioning = true;

		try {
			// Exit current state ancestry (bottom-up: child first, then parent)
			if (from) {
				const exitAncestry = this.getAncestry(from);
				const toAncestry = new Set(this.getAncestry(to));

				for (const stateName of exitAncestry) {
					// Don't exit shared ancestors
					if (toAncestry.has(stateName)) continue;

					const state = this._states.get(stateName);
					if (state?.exit) {
						state.exit.call(this.owner, payload);
					}
				}
			}

			// Update state
			this.previous = from;
			this.current = to;

			// Enter new state ancestry (top-down: parent first, then child)
			const enterAncestry = this.getAncestry(to).reverse();
			const fromAncestry = from ? new Set(this.getAncestry(from)) : new Set();

			for (const stateName of enterAncestry) {
				// Don't enter shared ancestors
				if (fromAncestry.has(stateName)) continue;

				const state = this._states.get(stateName);
				if (state?.enter) {
					state.enter.call(this.owner, payload);
				}
			}

			// Record history
			const record = { from, to, payload, timestamp: performance.now() };
			this._history.push(record);
			if (this._history.length > this._maxHistory) {
				this._history.shift();
			}

			// Notify listeners
			for (const fn of this._listeners) {
				try {
					fn(record);
				} catch (err) {
					console.error('[FSM] Error in transition listener:', err);
				}
			}
		} finally {
			this._transitioning = false;
		}

		// Process queued transitions
		if (this._queue.length > 0) {
			const next = this._queue.shift();
			this.transition(next.to, next.payload);
		}

		return true;
	}
}

/**
 * Pre-defined state constants for Neon TD.
 */
GameFSM.STATES = Object.freeze({
	MENU: 'menu',
	PLAYING: 'playing',
	PLAYING_COUNTDOWN: 'playing.countdown',
	PLAYING_ACTIVE: 'playing.active',
	PLAYING_MIDWAVE_LEVELUP: 'playing.midwave_levelup',
	PAUSED: 'paused',
	BETWEEN_WAVES: 'between_waves',
	BETWEEN_WAVES_ASCENSION: 'between_waves.ascension',
	BETWEEN_WAVES_POWERUP: 'between_waves.powerup',
	GAMEOVER: 'gameover',
	VICTORY: 'victory',
});

/**
 * Pre-defined transition table for Neon TD.
 * Call GameFSM.applyNeonTDTransitions(fsm) to wire them all up.
 */
GameFSM.applyNeonTDTransitions = function (fsm) {
	const S = GameFSM.STATES;

	fsm.addTransitions([
		// Menu → Playing
		[S.MENU, S.PLAYING_COUNTDOWN],

		// Playing substates
		[S.PLAYING_COUNTDOWN, S.PLAYING_ACTIVE],
		[S.PLAYING_ACTIVE, S.PLAYING_MIDWAVE_LEVELUP],
		[S.PLAYING_MIDWAVE_LEVELUP, S.PLAYING_ACTIVE],
		[S.PLAYING_MIDWAVE_LEVELUP, S.PLAYING_MIDWAVE_LEVELUP], // re-enter for pending levelups

		// Playing → Pause / Game Over / Between Waves
		[S.PLAYING, S.PAUSED],
		[S.PLAYING_ACTIVE, S.PAUSED],
		[S.PLAYING_COUNTDOWN, S.PAUSED],
		[S.PAUSED, S.PLAYING_ACTIVE],
		[S.PAUSED, S.PLAYING_COUNTDOWN],
		[S.PLAYING_ACTIVE, S.GAMEOVER],
		[S.PLAYING_ACTIVE, S.BETWEEN_WAVES_ASCENSION],
		[S.PLAYING_ACTIVE, S.BETWEEN_WAVES_POWERUP],

		// Between-waves flow
		[S.BETWEEN_WAVES_ASCENSION, S.BETWEEN_WAVES_POWERUP],
		[S.BETWEEN_WAVES_POWERUP, S.PLAYING_COUNTDOWN],

		// Game over → Menu / Restart
		[S.GAMEOVER, S.MENU],
		[S.GAMEOVER, S.PLAYING_COUNTDOWN],

		// Victory → Menu / Endless (continue playing)
		[S.VICTORY, S.MENU],
		[S.VICTORY, S.PLAYING_COUNTDOWN],

		// Ascension/Powerup → Victory (wave 30 completion)
		[S.BETWEEN_WAVES_ASCENSION, S.VICTORY],
		[S.BETWEEN_WAVES_POWERUP, S.VICTORY],
		[S.PLAYING_ACTIVE, S.VICTORY],

		// Save/Load can jump to playing
		[S.MENU, S.PLAYING_ACTIVE],
	]);

	return fsm;
};
