/**
 * @fileoverview SnapshotManager — full game state serialization and restoration.
 *
 * Replaces the ad-hoc save/load scattered across Game.js, SaveStateManager,
 * SkillManager, AscensionSystem, and ProgressionManager with a single
 * serialization module that captures the full store + entity arrays.
 *
 * Features:
 *   - Full snapshot: all 10 slices serialized + entity arrays + plugin state
 *   - Schema versioning with migration hooks
 *   - Re-entrancy guard (prevents save-during-save or load-during-load)
 *   - Persistence to localStorage via SaveStateManager
 *
 * Bug fixes:
 *   - Loot buffs are included in the snapshot (previously lost on save)
 *   - Save/load re-entrancy is blocked (previously allowed, causing corruption)
 */

import { saveStateManager } from '../managers/SaveStateManager.js';

const SNAPSHOT_VERSION = 3;

export class SnapshotManager {
	/**
	 * @param {import('./GameStore.js').GameStore} store
	 */
	constructor(store) {
		/** @type {import('./GameStore.js').GameStore} */
		this.store = store;

		/** @type {boolean} Re-entrancy guard */
		this._busy = false;

		/** @type {Object|null} Last snapshot for deviation diffing */
		this._lastSnapshot = null;
	}

	/**
	 * Capture a full snapshot of current game state.
	 *
	 * @param {Object} params Additional runtime data not in the store
	 * @param {import('../Player.js').Player} params.player - Live player instance
	 * @param {Array} params.enemies - Live enemy instances
	 * @param {Array} params.projectiles - Live projectile instances
	 * @param {import('../systems/AscensionSystem.js').AscensionSystem} params.ascensionSystem
	 * @param {import('../skills/SkillEffectEngine.js').SkillEffectEngine} params.skillEffectEngine
	 * @returns {Object} Serializable snapshot
	 */
	capture({ player, enemies, projectiles, ascensionSystem, skillEffectEngine }) {
		if (this._busy) {
			console.warn('[SnapshotManager] Capture blocked — operation in progress');
			return null;
		}
		this._busy = true;

		try {
			// Serialize all store slices
			const storeState = this.store.serialize();

			// Entity arrays are NOT in the store (too hot for reactive state)
			// Serialize only what's needed to reconstruct
			const entitySnapshot = {
				player: player ? this._serializePlayer(player) : null,
				enemies: enemies ? enemies.map(e => this._serializeEnemy(e)) : [],
				projectileCount: projectiles ? projectiles.length : 0,
			};

			// Plugin state from SkillEffectEngine
			const pluginState = skillEffectEngine ? this._serializePlugins(skillEffectEngine) : {};

			// Ascension state (modifiers by ID for restoration from pool)
			const ascensionState = ascensionSystem ? ascensionSystem.getSaveState() : null;

			const snapshot = {
				version: SNAPSHOT_VERSION,
				savedAt: Date.now(),
				store: storeState,
				entities: entitySnapshot,
				plugins: pluginState,
				ascension: ascensionState,
			};

			this._lastSnapshot = snapshot;
			return snapshot;
		} finally {
			this._busy = false;
		}
	}

	/**
	 * Persist a snapshot to localStorage.
	 * @param {Object} [snapshotOverride] - Provide a snapshot, or capture a new one
	 * @param {Object} [captureParams] - Params for capture() if no override
	 * @returns {boolean}
	 */
	save(snapshotOverride, captureParams) {
		if (this._busy) {
			console.warn('[SnapshotManager] Save blocked — operation in progress');
			return false;
		}

		const snapshot = snapshotOverride || this.capture(captureParams || {});
		if (!snapshot) return false;

		return saveStateManager.saveSnapshot(snapshot);
	}

	/**
	 * Load and validate a snapshot from localStorage.
	 * @returns {Object|null} Validated snapshot, or null if invalid/absent
	 */
	load() {
		if (this._busy) {
			console.warn('[SnapshotManager] Load blocked — operation in progress');
			return null;
		}
		this._busy = true;

		try {
			const raw = saveStateManager.getRawSave();
			if (!raw) return null;

			// Version check and migration
			const migrated = this._migrate(raw);
			if (!migrated) return null;

			return migrated;
		} finally {
			this._busy = false;
		}
	}

	/**
	 * Restore a validated snapshot into the store and return entity data for Game to reconstruct.
	 *
	 * @param {Object} snapshot - Validated snapshot from load()
	 * @param {import('../systems/AscensionSystem.js').AscensionSystem} ascensionSystem
	 * @returns {{ entities: Object, plugins: Object, ascension: Object } | null}
	 */
	restore(snapshot, ascensionSystem) {
		if (this._busy) {
			console.warn('[SnapshotManager] Restore blocked — operation in progress');
			return null;
		}
		this._busy = true;

		try {
			if (!snapshot || !snapshot.store) {
				console.error('[SnapshotManager] Invalid snapshot — missing store data');
				return null;
			}

			// Restore store slices
			this.store.restore(snapshot.store);

			// Restore ascension system from saved modifier IDs
			if (ascensionSystem && snapshot.ascension) {
				ascensionSystem.restoreFromSave(snapshot.ascension);
			}

			return {
				entities: snapshot.entities || {},
				plugins: snapshot.plugins || {},
				ascension: snapshot.ascension || null,
			};
		} finally {
			this._busy = false;
		}
	}

	/**
	 * Check if a save exists.
	 * @returns {boolean}
	 */
	hasSave() {
		return saveStateManager.hasSave();
	}

	/**
	 * Clear the persisted save.
	 * @returns {boolean}
	 */
	clearSave() {
		return saveStateManager.clearSave();
	}

	/**
	 * Get the last captured snapshot (for DevTools export).
	 * @returns {Object|null}
	 */
	getLastSnapshot() {
		return this._lastSnapshot;
	}

	// ─── SERIALIZATION HELPERS ───────────────────────────────────────────────────

	/**
	 * @param {import('../Player.js').Player} player
	 * @returns {Object}
	 * @private
	 */
	_serializePlayer(player) {
		return {
			x: player.x,
			y: player.y,
			hp: player.hp,
			maxHp: player.maxHp,
			shieldHp: player.shieldHp,
			maxShieldHp: player.maxShieldHp,
			angle: player.angle,
			damageMod: player.damageMod,
			fireRateMod: player.fireRateMod,
			rotationSpeedMod: player.rotationSpeedMod,
		};
	}

	/**
	 * @param {*} enemy
	 * @returns {Object}
	 * @private
	 */
	_serializeEnemy(enemy) {
		return {
			x: enemy.x,
			y: enemy.y,
			hp: enemy.hp,
			maxHp: enemy.maxHp,
			type: enemy.type,
			speed: enemy.speed,
			damage: enemy.damage,
			radius: enemy.radius,
		};
	}

	/**
	 * Serialize plugin state from SkillEffectEngine.
	 * @param {import('../skills/SkillEffectEngine.js').SkillEffectEngine} engine
	 * @returns {Object}
	 * @private
	 */
	_serializePlugins(engine) {
		const activeIds = engine.getActivePluginIds();
		const pluginState = {};
		for (const id of activeIds) {
			const plugin = /** @type {*} */ (engine.getPlugin(id));
			if (plugin && typeof plugin.serialize === 'function') {
				pluginState[id] = plugin.serialize();
			}
		}
		return { activeIds, pluginState };
	}

	// ─── MIGRATION ───────────────────────────────────────────────────────────────

	/**
	 * Migrate older save formats to the current version.
	 * @param {Object} raw
	 * @returns {Object|null} Migrated snapshot, or null if unrecoverable
	 * @private
	 */
	_migrate(raw) {
		const version = raw.version || raw.schemaVersion || 1;

		if (version === SNAPSHOT_VERSION) {
			return raw;
		}

		// v1/v2 (old SaveStateManager format) → v3 (SnapshotManager format)
		if (version <= 2) {
			return this._migrateV2ToV3(raw);
		}

		// Future versions — unknown, cannot forward-migrate
		if (version > SNAPSHOT_VERSION) {
			console.warn(`[SnapshotManager] Save version ${version} is newer than supported ${SNAPSHOT_VERSION}`);
			return null;
		}

		return raw;
	}

	/**
	 * Convert old v1/v2 saves (flat snapshot from Game._buildSavePayload) to v3 store format.
	 * @param {Object} oldSave
	 * @returns {Object}
	 * @private
	 */
	_migrateV2ToV3(oldSave) {
		try {
			const store = {
				phase: { current: 'playing.active', previous: null, countdown: 0 },
				run: {
					wave: oldSave.wave || 1,
					score: oldSave.score || 0,
					kills: 0,
					difficulty: oldSave.difficulty || 'normal',
					waveModifierKey: null,
					modifierState: {
						enemySpeedMultiplier: 1,
						enemyDamageTakenMultiplier: 1,
						playerRegenMultiplier: 1,
						playerTurnSpeedMultiplier: 1,
						visibilityReduction: false,
					},
					waveStartTime: 0,
					gameOverTracked: false,
					lastRunResult: null,
				},
				player: {
					hp: oldSave.playerHp || 100,
					maxHp: oldSave.playerMaxHp || 100,
					shieldHp: oldSave.playerShieldHp || 0,
					maxShieldHp: oldSave.playerMaxShieldHp || 0,
					activeBuffs: [],
					godModeActive: false,
				},
				skills: oldSave.skills || {},
				wave: {
					current: oldSave.wave || 1,
					enemiesSpawned: 0,
					enemiesKilled: 0,
					enemiesToSpawn: 0,
					spawnTimer: 0,
					waveActive: false,
					waveComplete: false,
				},
				ascension: {
					activeModifiers: [],
					activeModifierIds: [],
					offeredIds: [],
					pendingPick: false,
					currentOptions: null,
				},
			};

			return {
				version: SNAPSHOT_VERSION,
				savedAt: oldSave.savedAt || Date.now(),
				store,
				entities: {},
				plugins: {},
				ascension: oldSave.ascension || null,
			};
		} catch (err) {
			console.error('[SnapshotManager] v2→v3 migration failed:', err);
			return null;
		}
	}
}
