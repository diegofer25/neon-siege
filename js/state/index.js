/**
 * @fileoverview State module barrel — single import point for the full state system.
 *
 * Usage:
 *   import { createStateSystem } from './state/index.js';
 *   const { store, fsm, dispatcher, snapshot, devTools } = createStateSystem();
 */

import { GameStore } from './GameStore.js';
import { GameFSM } from './GameFSM.js';
import { ActionDispatcher } from './ActionDispatcher.js';
import { ALL_SLICE_DEFINITIONS, registerAllReducers } from './slices/index.js';
import { createValidationMiddleware } from './middleware/ValidationMiddleware.js';
import { createLoggingMiddleware, createTransitionLogger } from './middleware/LoggingMiddleware.js';
import { StateDevTools } from './StateDevTools.js';
import { SnapshotManager } from './SnapshotManager.js';

export { GameStore } from './GameStore.js';
export { GameFSM } from './GameFSM.js';
export { ActionDispatcher, ActionTypes } from './ActionDispatcher.js';
export { ALL_SLICE_DEFINITIONS, registerAllReducers } from './slices/index.js';
export { createValidationMiddleware } from './middleware/ValidationMiddleware.js';
export { createLoggingMiddleware, createTransitionLogger } from './middleware/LoggingMiddleware.js';
export { StateDevTools } from './StateDevTools.js';
export { SnapshotManager } from './SnapshotManager.js';
export { derivePlayerStats, syncPlayerStats, computeAttributeBonuses } from './ComputedStats.js';

/**
 * Create and wire the complete state system.
 *
 * @param {Object} [options]
 * @param {boolean} [options.debug=false] - Enable dev tools and validation middleware
 * @param {boolean} [options.logging=false] - Enable action logging middleware
 * @returns {{ store: GameStore, fsm: GameFSM, dispatcher: ActionDispatcher, snapshot: SnapshotManager, devTools: StateDevTools|null }}
 */
export function createStateSystem(options = {}) {
	const debug = options.debug ?? new URLSearchParams(globalThis.location?.search).has('debug');
	const logging = options.logging ?? debug;

	// 1. Create store with all slice definitions
	const store = new GameStore(ALL_SLICE_DEFINITIONS);

	// 2. Create FSM with all Neon TD states and transitions
	const fsm = new GameFSM();
	GameFSM.applyNeonTDTransitions(fsm);

	// 3. Create dispatcher and register all reducers
	const dispatcher = new ActionDispatcher(store);
	registerAllReducers(dispatcher);

	// 4. Middleware pipeline (order matters: validation → logging → reducers)
	if (debug) {
		dispatcher.use(createValidationMiddleware(fsm));
	}
	if (logging) {
		dispatcher.use(createLoggingMiddleware());
		// FSM transition logger
		createTransitionLogger(fsm, store);
	}

	// 5. Snapshot manager
	const snapshot = new SnapshotManager(store);

	// 6. DevTools (debug only)
	let devTools = null;
	if (debug) {
		devTools = new StateDevTools(store, fsm, dispatcher);
		// DevTools creates its DOM and starts updates in the constructor
	}

	// Sync FSM phase changes → store phase slice
	fsm.onChange(({ from, to }) => {
		store.set('phase', { current: to, previous: from });
	});

	return { store, fsm, dispatcher, snapshot, devTools };
}
