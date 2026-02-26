/**
 * @fileoverview GameStore — centralized reactive state store with namespaced slices.
 *
 * Design principles:
 *   1. Single source of truth — all game state lives in typed slices
 *   2. Immutable reads — getters return frozen objects in dev mode
 *   3. Reactive subscriptions — granular per-slice and per-key change notifications
 *   4. Transactional batching — multiple set() calls fire subscribers once at commit
 *   5. Serializable — serialize()/restore() for full save/load
 *
 * Performance:
 *   - Shallow diff on set() — only fires subscribers for actually-changed keys
 *   - Subscribers stored in Maps/Sets for O(1) add/remove
 *   - Transaction batching avoids cascading re-renders during bulk updates
 */

/** @type {boolean} Dev mode flag — enables Object.freeze and extra validation */
const __DEV__ = typeof window !== 'undefined'
	&& new URLSearchParams(window.location.search).get('debug') === 'true';

export class GameStore {
	/**
	 * @param {Object<string, Object>} sliceDefinitions - Map of slice name → initial state object
	 */
	constructor(sliceDefinitions = {}) {
		/** @type {Map<string, Object>} Internal state storage */
		this._slices = new Map();

		/** @type {Map<string, Object>} Frozen initial states for reset */
		this._initialStates = new Map();

		/** @type {Map<string, Map<string, Set<Function>>>} Per-slice, per-key subscribers */
		this._keySubscribers = new Map();

		/** @type {Map<string, Set<Function>>} Per-slice bulk subscribers */
		this._sliceSubscribers = new Map();

		/** @type {Set<Function>} Global subscribers (called on any change) */
		this._globalSubscribers = new Set();

		/** @type {boolean} Whether we're inside a transaction */
		this._inTransaction = false;

		/** @type {Map<string, Set<string>>} Pending changes during a transaction: slice → changed keys */
		this._pendingChanges = new Map();

		/** @type {number} Monotonically increasing version counter */
		this._version = 0;

		/** @type {Array<{type: string, slice: string, changes: Object, version: number, timestamp: number}>} Action log for devtools */
		this._actionLog = [];

		/** @type {number} Max action log size */
		this._maxLogSize = 200;

		// Register all slices
		for (const [name, initialState] of Object.entries(sliceDefinitions)) {
			this.registerSlice(name, initialState);
		}
	}

	/**
	 * Register a new state slice.
	 * @param {string} name - Slice name (e.g. 'player', 'run', 'skills')
	 * @param {Object} initialState - Default state shape
	 */
	registerSlice(name, initialState) {
		const frozen = JSON.parse(JSON.stringify(initialState));
		this._initialStates.set(name, frozen);
		this._slices.set(name, { ...initialState });
		this._keySubscribers.set(name, new Map());
		this._sliceSubscribers.set(name, new Set());
	}

	/**
	 * Get a value from a slice.
	 * @param {string} slice - Slice name
	 * @param {string} [key] - Optional key within slice. If omitted, returns entire slice snapshot.
	 * @returns {*} The value, or undefined if not found
	 */
	get(slice, key) {
		const state = this._slices.get(slice);
		if (!state) {
			if (__DEV__) console.warn(`[GameStore] Unknown slice: ${slice}`);
			return undefined;
		}

		if (key === undefined) {
			// Return a shallow copy (frozen in dev mode)
			const snapshot = { ...state };
			return __DEV__ ? Object.freeze(snapshot) : snapshot;
		}

		return state[key];
	}

	/**
	 * Set one or more keys in a slice. Fires subscribers for changed keys.
	 * @param {string} slice - Slice name
	 * @param {Object} updates - Key-value pairs to update
	 * @returns {string[]} Array of keys that actually changed
	 */
	set(slice, updates) {
		const state = this._slices.get(slice);
		if (!state) {
			if (__DEV__) console.warn(`[GameStore] Unknown slice: ${slice}`);
			return [];
		}

		const changed = [];
		for (const [key, value] of Object.entries(updates)) {
			if (state[key] !== value) {
				state[key] = value;
				changed.push(key);
			}
		}

		if (changed.length === 0) return changed;

		this._version++;

		if (this._inTransaction) {
			// Accumulate changes for batch notification
			if (!this._pendingChanges.has(slice)) {
				this._pendingChanges.set(slice, new Set());
			}
			const pending = this._pendingChanges.get(slice);
			for (const key of changed) {
				pending.add(key);
			}
		} else {
			// Immediate notification
			this._notifySubscribers(slice, changed);
		}

		return changed;
	}

	/**
	 * Execute a function inside a transaction. All subscriber notifications
	 * are batched and fired once at the end.
	 * @param {Function} fn - Function that performs multiple set() calls
	 */
	transaction(fn) {
		if (this._inTransaction) {
			// Nested transaction — just execute
			fn();
			return;
		}

		this._inTransaction = true;
		this._pendingChanges.clear();

		try {
			fn();
		} finally {
			this._inTransaction = false;
			// Fire all pending notifications
			for (const [slice, changedKeys] of this._pendingChanges) {
				this._notifySubscribers(slice, [...changedKeys]);
			}
			this._pendingChanges.clear();
		}
	}

	/**
	 * Subscribe to changes on a specific key within a slice.
	 * @param {string} slice - Slice name
	 * @param {string} key - Key to watch
	 * @param {Function} callback - Called with (newValue, key, slice)
	 * @returns {Function} Unsubscribe function
	 */
	on(slice, key, callback) {
		const sliceMap = this._keySubscribers.get(slice);
		if (!sliceMap) {
			if (__DEV__) console.warn(`[GameStore] Unknown slice for subscription: ${slice}`);
			return () => {};
		}

		if (!sliceMap.has(key)) {
			sliceMap.set(key, new Set());
		}
		sliceMap.get(key).add(callback);

		return () => {
			const set = sliceMap.get(key);
			if (set) {
				set.delete(callback);
				if (set.size === 0) sliceMap.delete(key);
			}
		};
	}

	/**
	 * Subscribe to any change within a slice.
	 * @param {string} slice - Slice name
	 * @param {Function} callback - Called with (sliceSnapshot, changedKeys, slice)
	 * @returns {Function} Unsubscribe function
	 */
	onSlice(slice, callback) {
		const subscribers = this._sliceSubscribers.get(slice);
		if (!subscribers) {
			if (__DEV__) console.warn(`[GameStore] Unknown slice for subscription: ${slice}`);
			return () => {};
		}

		subscribers.add(callback);
		return () => subscribers.delete(callback);
	}

	/**
	 * Subscribe to any state change (global).
	 * @param {Function} callback - Called with (slice, changedKeys, version)
	 * @returns {Function} Unsubscribe function
	 */
	onAny(callback) {
		this._globalSubscribers.add(callback);
		return () => this._globalSubscribers.delete(callback);
	}

	/**
	 * Reset a slice to its initial state.
	 * @param {string} slice - Slice name
	 */
	resetSlice(slice) {
		const initial = this._initialStates.get(slice);
		if (!initial) return;

		const state = this._slices.get(slice);
		const changed = [];

		// Restore all keys to initial values
		for (const [key, value] of Object.entries(initial)) {
			if (state[key] !== value) {
				state[key] = typeof value === 'object' && value !== null
					? JSON.parse(JSON.stringify(value))
					: value;
				changed.push(key);
			}
		}

		// Remove keys not in initial state
		for (const key of Object.keys(state)) {
			if (!(key in initial)) {
				delete state[key];
				changed.push(key);
			}
		}

		if (changed.length > 0) {
			this._version++;
			if (this._inTransaction) {
				if (!this._pendingChanges.has(slice)) {
					this._pendingChanges.set(slice, new Set());
				}
				const pending = this._pendingChanges.get(slice);
				for (const key of changed) pending.add(key);
			} else {
				this._notifySubscribers(slice, changed);
			}
		}
	}

	/**
	 * Reset all slices to their initial states.
	 */
	resetAll() {
		this.transaction(() => {
			for (const slice of this._slices.keys()) {
				this.resetSlice(slice);
			}
		});
	}

	/**
	 * Serialize the entire store to a JSON-compatible object.
	 * @returns {Object}
	 */
	serialize() {
		const snapshot = {};
		for (const [name, state] of this._slices) {
			snapshot[name] = JSON.parse(JSON.stringify(state));
		}
		return {
			version: this._version,
			timestamp: Date.now(),
			slices: snapshot,
		};
	}

	/**
	 * Restore the store from a serialized snapshot.
	 * @param {Object} snapshot - Previously serialized state
	 */
	restore(snapshot) {
		if (!snapshot?.slices) {
			if (__DEV__) console.warn('[GameStore] Invalid snapshot');
			return;
		}

		this.transaction(() => {
			for (const [name, sliceState] of Object.entries(snapshot.slices)) {
				if (this._slices.has(name)) {
					this.set(name, sliceState);
				}
			}
		});

		this._version = snapshot.version || this._version;
	}

	/**
	 * Get all registered slice names.
	 * @returns {string[]}
	 */
	getSliceNames() {
		return [...this._slices.keys()];
	}

	/**
	 * Get the current version counter.
	 * @returns {number}
	 */
	getVersion() {
		return this._version;
	}

	/**
	 * Log an action to the action log (used by ActionDispatcher).
	 * @param {Object} entry
	 */
	logAction(entry) {
		this._actionLog.push({
			...entry,
			version: this._version,
			timestamp: Date.now(),
		});
		if (this._actionLog.length > this._maxLogSize) {
			this._actionLog.shift();
		}
	}

	/**
	 * Get the action log (for devtools).
	 * @returns {Array}
	 */
	getActionLog() {
		return this._actionLog;
	}

	/**
	 * Clear all subscribers. Used on game shutdown.
	 */
	clearSubscribers() {
		for (const map of this._keySubscribers.values()) {
			map.clear();
		}
		for (const set of this._sliceSubscribers.values()) {
			set.clear();
		}
		this._globalSubscribers.clear();
	}

	/**
	 * Fire notifications for changed keys in a slice.
	 * @private
	 * @param {string} slice
	 * @param {string[]} changedKeys
	 */
	_notifySubscribers(slice, changedKeys) {
		const state = this._slices.get(slice);

		// Per-key subscribers
		const keyMap = this._keySubscribers.get(slice);
		if (keyMap) {
			for (const key of changedKeys) {
				const handlers = keyMap.get(key);
				if (handlers) {
					const value = state[key];
					for (const fn of handlers) {
						try {
							fn(value, key, slice);
						} catch (err) {
							console.error(`[GameStore] Error in key subscriber ${slice}.${key}:`, err);
						}
					}
				}
			}
		}

		// Slice subscribers
		const sliceSubs = this._sliceSubscribers.get(slice);
		if (sliceSubs && sliceSubs.size > 0) {
			const snapshot = { ...state };
			for (const fn of sliceSubs) {
				try {
					fn(snapshot, changedKeys, slice);
				} catch (err) {
					console.error(`[GameStore] Error in slice subscriber ${slice}:`, err);
				}
			}
		}

		// Global subscribers
		for (const fn of this._globalSubscribers) {
			try {
				fn(slice, changedKeys, this._version);
			} catch (err) {
				console.error('[GameStore] Error in global subscriber:', err);
			}
		}
	}
}
