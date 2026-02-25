/**
 * @fileoverview LoggingMiddleware — structured action and transition logging.
 *
 * Gated by ?debug=true URL param. Zero overhead in normal play.
 *
 * Features:
 *   - Structured console logs with action type, payload preview, and timing
 *   - Ring buffer of last N actions for post-mortem debugging
 *   - Integrates with GameStore's action log for devtools consumption
 */

const __DEV__ = typeof window !== 'undefined'
	&& new URLSearchParams(window.location.search).get('debug') === 'true';

/**
 * Actions that fire every frame — suppress from console to reduce noise.
 * Still recorded in the ring buffer.
 * @type {Set<string>}
 */
const NOISY_ACTIONS = new Set([
	'TICK',
	'COOLDOWN_TICK',
	'COMBO_TICK',
	'BUFF_TICK',
	'PLAYER_MOVE',
]);

/**
 * Create the logging middleware function.
 * @param {Object} [options]
 * @param {boolean} [options.logToConsole=true] - Whether to log to console
 * @param {boolean} [options.suppressNoisy=true] - Whether to suppress per-frame actions from console
 * @returns {Function} Middleware function
 */
export function createLoggingMiddleware(options = {}) {
	const {
		logToConsole = true,
		suppressNoisy = true,
	} = options;

	if (!__DEV__) {
		// In production, pass through directly
		return (action, store, next) => next(action);
	}

	return function loggingMiddleware(action, store, next) {
		const startTime = performance.now();

		// Log before reduction
		if (logToConsole && !(suppressNoisy && NOISY_ACTIONS.has(action.type))) {
			const payloadPreview = action.payload
				? JSON.stringify(action.payload).substring(0, 120)
				: '{}';
			console.log(
				`%c[ACTION] ${action.type}%c ${payloadPreview}`,
				'color: #0ff; font-weight: bold',
				'color: #888'
			);
		}

		// Pass to next middleware (which will eventually reduce)
		next(action);

		// Log timing
		const elapsed = performance.now() - startTime;
		if (elapsed > 2 && logToConsole && !NOISY_ACTIONS.has(action.type)) {
			console.warn(`[ACTION] ${action.type} took ${elapsed.toFixed(1)}ms`);
		}
	};
}

/**
 * Create a transition logger for the FSM.
 * Subscribes to FSM.onChange and logs transitions.
 *
 * @param {import('../GameFSM.js').GameFSM} fsm
 * @param {import('../GameStore.js').GameStore} store
 * @returns {Function} Unsubscribe function
 */
export function createTransitionLogger(fsm, store) {
	if (!__DEV__) return () => {};

	return fsm.onChange(({ from, to, payload }) => {
		console.log(
			`%c[FSM] ${from || '(init)'} → ${to}%c`,
			'color: #f0f; font-weight: bold',
			'color: #888',
			payload && Object.keys(payload).length > 0 ? payload : ''
		);

		// Also record in store's action log
		store.logAction({
			type: `FSM:${from || 'init'}→${to}`,
			payload,
		});
	});
}
