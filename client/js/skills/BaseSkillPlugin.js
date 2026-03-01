/**
 * @fileoverview BaseSkillPlugin — base class for all skill plugins.
 *
 * A skill plugin is a self-contained module that declares:
 *  1. Declarative stat modifiers  — via getModifiers(rank, context)
 *  2. Event listeners             — via getEventListeners()
 *  3. Lifecycle hooks             — onEquip(), onUnequip(), onCast() (optional overrides)
 *
 * Hybrid model: simple stat changes use declarative modifiers; complex behaviors
 * (AoE on kill, chain lightning, etc.) use event subscriptions.
 *
 * Modifier format:
 *   { stat: string, op: 'add' | 'multiply' | 'set', value: number }
 *
 * Resolution order (applied by SkillEffectEngine):
 *   base value → attribute multipliers → 'add' modifiers → 'multiply' modifiers → 'set' overrides
 *
 * Supported stats (matching Player properties set by _syncPlayerFromSkills):
 *   damage, fireRate, rotationSpeed, pierceCount, explosionRadius, explosionDamageRatio,
 *   homingStrength, critChance, critDamageMultiplier, turnSpeedBonus
 *
 * Event subscription format (returned by getEventListeners):
 *   { 'enemy:hit': this.onEnemyHit.bind(this), 'enemy:killed': this.onEnemyKill.bind(this) }
 */

/* eslint-disable no-unused-vars */

export class BaseSkillPlugin {
	/**
	 * @param {string} id - Skill ID from SkillConfig
	 * @param {Object} skillConfig - The skill definition object from SkillConfig.js
	 */
	constructor(id, skillConfig) {
		/** @type {string} */
		this.id = id;

		/** @type {Object} Skill definition from SkillConfig.js */
		this.skillConfig = skillConfig;

		/** @type {number} Current rank (1-based, set by SkillEffectEngine on equip/rank-up) */
		this.rank = 0;

		/** @type {import('../Game.js').Game|null} Game ref, set by SkillEffectEngine on equip */
		this.game = null;

		/** @type {boolean} Whether this plugin is currently active/equipped */
		this.active = false;
	}

	// ─── DECLARATIVE MODIFIERS ───────────────────────────────────────────────────

	/**
	 * Return stat modifiers for the current rank.
	 * Override in subclass for passive stat bonuses.
	 *
	 * @param {number} rank - Current skill rank
	 * @param {Object} context - { attrs, ascension } computed values for reference
	 * @returns {Array<{stat: string, op: string, value: number}>}
	 */
	getModifiers(rank, context) {
		return [];
	}

	// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────

	/**
	 * Return a map of event names → handler functions.
	 * Override in subclass for reactive behavior.
	 *
	 * @returns {Object<string, Function>}
	 */
	getEventListeners() {
		return {};
	}

	// ─── LIFECYCLE HOOKS ─────────────────────────────────────────────────────────

	/**
	 * Called when the skill is equipped (first ranked / re-equipped).
	 * Use for one-time setup (e.g., adding player state).
	 *
	 * @param {import('../Game.js').Game} game
	 */
	onEquip(game) {
		// Override in subclass if needed
	}

	/**
	 * Called when the skill is unequipped or the run resets.
	 * Use for cleanup (e.g., removing player state).
	 *
	 * @param {import('../Game.js').Game} game
	 */
	onUnequip(game) {
		// Override in subclass if needed
	}

	/**
	 * Called when an active/ultimate skill is cast (after cooldown check passes).
	 * Override in subclass for active/ultimate skills only.
	 *
	 * @param {import('../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean} true if cast was handled
	 */
	onCast(game, skillInfo) {
		return false;
	}

	// ─── PLAYER STATE HELPERS ────────────────────────────────────────────────────

	/**
	 * Return a configuration object to be set on the player during stats:sync.
	 * Used for complex stateful effects (e.g., immolationAura, overchargeBurst).
	 * Override in subclass if the skill needs to install a config object on Player.
	 *
	 * @param {number} rank - Current skill rank
	 * @param {Object} context - { attrs, ascension }
	 * @returns {Object|null} Config object, or null if not applicable
	 */
	getPlayerConfig(rank, context) {
		return null;
	}

	// ─── VISUAL OVERRIDES ─────────────────────────────────────────────────────────────────

	/**
	 * Return visual overrides that modify player rendering when this skill is active.
	 * These are aggregated by SkillEffectEngine and stored in player.visualState.skillVisuals.
	 * Override in subclass to customize player appearance per-skill.
	 *
	 * Supported override keys:
	 *   bodyColor    {string}  - Override body fill color
	 *   glowColor    {string}  - Override glow/aura color
	 *   outlineColor {string}  - Override stroke/outline color
	 *   gunSkin      {Object}  - Gun appearance mods:
	 *     barrelColor  {string}  - Barrel stroke color
	 *     barrelGlow   {string}  - Barrel glow color
	 *     muzzleEffect {string}  - 'flame'|'spark'|'plasma'|null
	 *   overlays     {Array}   - Post-body overlay layers:
	 *     type   {string}  - 'ring'|'particles'|'radialGlow'
	 *     color  {string}  - Effect color
	 *     radius {number}  - Effect radius offset from player
	 *     alpha  {number}  - Effect opacity (0-1)
	 *     pulse  {boolean} - Whether to pulse the effect
	 *
	 * @param {number} rank - Current skill rank
	 * @param {Object} context - { attrs, ascension }
	 * @returns {Object|null} Visual overrides, or null for no customization
	 */
	getVisualOverrides(rank, context) {
		return null;
	}

	// ─── UTILITIES ───────────────────────────────────────────────────────────────

	/**
	 * Get the effect definition from skill config.
	 * Convenience method for subclasses.
	 * @returns {Object}
	 */
	getEffect() {
		return this.skillConfig?.effect || {};
	}
}
