/**
 * @fileoverview SkillEffectEngine — central orchestrator for skill plugins.
 *
 * Replaces the scattered hardcoded skill logic with a unified plugin system:
 *  - Plugin registry: maps skill/ascension IDs → plugin classes
 *  - Active plugin management: equip/unequip with lifecycle hooks + event subscriptions
 *  - Modifier aggregation: collects declarative modifiers from all active plugins
 *  - Cast dispatch: routes active/ultimate casts to the correct plugin
 *  - Player config dispatch: collects player config objects from plugins
 *  - Fallback: skills without registered plugins fall through to legacy code paths
 *
 * Integration points:
 *  - Game.js creates the engine and passes the GameEventBus
 *  - _syncPlayerFromSkills() calls getAggregatedModifiers() + getPlayerConfigs()
 *  - castActiveSkill() calls castSkill() before falling through to legacy switch
 *  - SkillManager.learnSkill() / reset() notifies the engine
 */

export class SkillEffectEngine {
	/**
	 * @param {import('./GameEventBus.js').GameEventBus} eventBus
	 * @param {import('../Game.js').Game} game
	 */
	constructor(eventBus, game) {
		/** @type {import('./GameEventBus.js').GameEventBus} */
		this.eventBus = eventBus;

		/** @type {import('../Game.js').Game} */
		this.game = game;

		/** @type {Map<string, typeof import('./BaseSkillPlugin.js').BaseSkillPlugin>} skill ID → plugin class */
		this._registry = new Map();

		/** @type {Map<string, import('./BaseSkillPlugin.js').BaseSkillPlugin>} skill ID → active plugin instance */
		this._activePlugins = new Map();

		/** @type {Map<string, Function[]>} skill ID → array of unsubscribe functions for event listeners */
		this._subscriptions = new Map();
	}

	// ─── REGISTRY ────────────────────────────────────────────────────────────────

	/**
	 * Register a plugin class for a skill ID.
	 * @param {string} skillId
	 * @param {typeof import('./BaseSkillPlugin.js').BaseSkillPlugin} PluginClass
	 */
	registerPlugin(skillId, PluginClass) {
		this._registry.set(skillId, PluginClass);
	}

	/**
	 * Bulk-register from a Map or object of { skillId: PluginClass }.
	 * @param {Map<string, typeof import('./BaseSkillPlugin.js').BaseSkillPlugin>|Object<string, typeof import('./BaseSkillPlugin.js').BaseSkillPlugin>} registry
	 */
	registerAll(registry) {
		const entries = registry instanceof Map ? registry.entries() : Object.entries(registry);
		for (const [id, PluginClass] of entries) {
			this.registerPlugin(id, PluginClass);
		}
	}

	/**
	 * Check if a skill has a registered plugin.
	 * @param {string} skillId
	 * @returns {boolean}
	 */
	hasPlugin(skillId) {
		return this._registry.has(skillId);
	}

	// ─── PLUGIN LIFECYCLE ────────────────────────────────────────────────────────

	/**
	 * Equip a skill — instantiate plugin, call onEquip, subscribe to events.
	 * If already equipped, updates rank.
	 * @param {string} skillId
	 * @param {number} rank
	 * @param {Object} skillConfig - Skill definition from SkillConfig.js
	 */
	equipSkill(skillId, rank, skillConfig) {
		const PluginClass = this._registry.get(skillId);
		if (!PluginClass) return; // No plugin registered — legacy path handles it

		// If already active, just update rank
		if (this._activePlugins.has(skillId)) {
			const plugin = this._activePlugins.get(skillId);
			plugin.rank = rank;
			return;
		}

		// Instantiate
		const plugin = new PluginClass(skillId, skillConfig);
		plugin.rank = rank;
		plugin.game = this.game;
		plugin.active = true;

		// Store
		this._activePlugins.set(skillId, plugin);

		// Lifecycle hook
		plugin.onEquip(this.game);

		// Subscribe event listeners
		const listeners = plugin.getEventListeners();
		const unsubs = [];
		for (const [event, handler] of Object.entries(listeners)) {
			const unsub = this.eventBus.on(event, handler);
			unsubs.push(unsub);
		}
		this._subscriptions.set(skillId, unsubs);
	}

	/**
	 * Unequip a skill — call onUnequip, unsubscribe events, destroy instance.
	 * @param {string} skillId
	 */
	unequipSkill(skillId) {
		const plugin = this._activePlugins.get(skillId);
		if (!plugin) return;

		// Lifecycle hook
		plugin.onUnequip(this.game);
		plugin.active = false;
		plugin.game = null;

		// Unsubscribe all event listeners
		const unsubs = this._subscriptions.get(skillId) || [];
		for (const unsub of unsubs) {
			unsub();
		}
		this._subscriptions.delete(skillId);
		this._activePlugins.delete(skillId);
	}

	/**
	 * Reset all active plugins — called on run start.
	 */
	reset() {
		for (const skillId of [...this._activePlugins.keys()]) {
			this.unequipSkill(skillId);
		}
		this._activePlugins.clear();
		this._subscriptions.clear();
	}

	// ─── MODIFIER AGGREGATION ────────────────────────────────────────────────────

	/**
	 * Aggregate declarative modifiers from all active plugins.
	 * Returns a flat map of stat → { adds: number, multiplies: number, sets: number|null }.
	 *
	 * @param {Object} context - { attrs, ascension } for plugins that need context
	 * @returns {Record<string, { add: number, multiply: number, set: number|null }>}
	 */
	getAggregatedModifiers(context = {}) {
		/** @type {Record<string, { add: number, multiply: number, set: number|null }>} */
		const stats = {};

		for (const plugin of this._activePlugins.values()) {
			if (!plugin.active) continue;

			const modifiers = plugin.getModifiers(plugin.rank, context);
			for (const mod of modifiers) {
				if (!stats[mod.stat]) {
					stats[mod.stat] = { add: 0, multiply: 1, set: null };
				}
				switch (mod.op) {
					case 'add':
						stats[mod.stat].add += mod.value;
						break;
					case 'multiply':
						stats[mod.stat].multiply *= mod.value;
						break;
					case 'set':
						stats[mod.stat].set = mod.value;
						break;
				}
			}
		}

		return stats;
	}

	/**
	 * Resolve a single stat value through the modifier pipeline.
	 * @param {string} stat - Stat name
	 * @param {number} baseValue - Base value before modifiers
	 * @param {Object} aggregated - Result from getAggregatedModifiers()
	 * @returns {number}
	 */
	resolveStatValue(stat, baseValue, aggregated) {
		const entry = aggregated[stat];
		if (!entry) return baseValue;

		if (entry.set !== null) return entry.set;
		return (baseValue + entry.add) * entry.multiply;
	}

	// ─── PLAYER CONFIG DISPATCH ──────────────────────────────────────────────────

	/**
	 * Collect player config objects from all active plugins.
	 * Returns an array of { pluginId, config } for Game._syncPlayerFromSkills() to apply.
	 *
	 * @param {Object} context - { attrs, ascension }
	 * @returns {Array<{pluginId: string, config: Object}>}
	 */
	getPlayerConfigs(context = {}) {
		const configs = [];
		for (const plugin of this._activePlugins.values()) {
			if (!plugin.active) continue;
			const config = plugin.getPlayerConfig(plugin.rank, context);
			if (config) {
				configs.push({ pluginId: plugin.id, config });
			}
		}
		return configs;
	}

	// ─── CAST DISPATCH ───────────────────────────────────────────────────────────

	/**
	 * Attempt to cast an active/ultimate skill via its plugin.
	 * @param {string} skillId
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean} true if a plugin handled the cast, false to fall through to legacy
	 */
	castSkill(skillId, skillInfo) {
		const plugin = this._activePlugins.get(skillId);
		if (!plugin) return false;

		return plugin.onCast(this.game, skillInfo);
	}

	// ─── QUERY ───────────────────────────────────────────────────────────────────

	/**
	 * Get an active plugin instance by ID (for debugging / advanced use).
	 * @param {string} skillId
	 * @returns {import('./BaseSkillPlugin.js').BaseSkillPlugin|undefined}
	 */
	getPlugin(skillId) {
		return this._activePlugins.get(skillId);
	}

	/**
	 * Get IDs of all skills that have registered plugins.
	 * @returns {string[]}
	 */
	getRegisteredSkillIds() {
		return [...this._registry.keys()];
	}

	/**
	 * Get IDs of all currently active plugins.
	 * @returns {string[]}
	 */
	getActivePluginIds() {
		return [...this._activePlugins.keys()];
	}
}
