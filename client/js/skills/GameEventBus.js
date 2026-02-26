/**
 * @fileoverview GameEventBus — lightweight pub/sub event system for decoupled communication
 * between game systems and skill plugins.
 *
 * Skill plugins subscribe to game events (enemy:hit, enemy:killed, etc.) via the bus,
 * keeping their logic self-contained instead of hardcoded across Game/CollisionSystem/Player.
 *
 * Supported events:
 *   tick              – every frame update (payload: { delta })
 *   enemy:hit         – projectile damages an enemy (payload: { enemy, projectile, damage })
 *   enemy:killed      – enemy dies (payload: { enemy, position, type })
 *   player:damaged    – player takes damage (payload: { damage, source })
 *   projectile:fired  – player fires a projectile (payload: { projectile })
 *   projectile:created – projectile object created (payload: { projectile })
 *   wave:started      – a wave begins (payload: { wave })
 *   wave:completed    – a wave ends (payload: { wave })
 *   stats:sync        – player stats recalculated (payload: { player, attrs, passives, ascension })
 */

export class GameEventBus {
	constructor() {
		/** @type {Map<string, Set<Function>>} */
		this._listeners = new Map();
	}

	/**
	 * Subscribe to an event.
	 * @param {string} event - Event name
	 * @param {Function} handler - Callback function
	 * @returns {Function} Unsubscribe function
	 */
	on(event, handler) {
		if (!this._listeners.has(event)) {
			this._listeners.set(event, new Set());
		}
		this._listeners.get(event).add(handler);

		// Return unsubscribe function for convenience
		return () => this.off(event, handler);
	}

	/**
	 * Unsubscribe from an event.
	 * @param {string} event - Event name
	 * @param {Function} handler - The handler to remove
	 */
	off(event, handler) {
		const handlers = this._listeners.get(event);
		if (handlers) {
			handlers.delete(handler);
			if (handlers.size === 0) {
				this._listeners.delete(event);
			}
		}
	}

	/**
	 * Emit an event — calls all subscribed handlers synchronously.
	 * @param {string} event - Event name
	 * @param {Object} payload - Data to pass to handlers
	 */
	emit(event, payload = {}) {
		const handlers = this._listeners.get(event);
		if (!handlers || handlers.size === 0) return;

		for (const handler of handlers) {
			try {
				handler(payload);
			} catch (err) {
				console.error(`[GameEventBus] Error in handler for "${event}":`, err);
			}
		}
	}

	/**
	 * Remove all listeners. Called on game reset.
	 */
	clear() {
		this._listeners.clear();
	}

	/**
	 * Get the count of listeners for an event (useful for debugging).
	 * @param {string} event
	 * @returns {number}
	 */
	listenerCount(event) {
		const handlers = this._listeners.get(event);
		return handlers ? handlers.size : 0;
	}
}
