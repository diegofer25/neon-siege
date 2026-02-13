/**
 * @fileoverview AscensionSystem — manages the Ascension pick event every 10 waves.
 *
 * Every 10 waves, the player picks 1 of 3 random run-warping modifiers from the pool.
 * Modifiers stack and persist for the entire run.
 */

import { ASCENSION_POOL, ASCENSION_PICKS, ASCENSION_WAVES } from '../config/SkillConfig.js';
import { playSFX, createFloatingText, screenFlash } from '../main.js';

export class AscensionSystem {
	/**
	 * @param {import('../Game.js').Game} game
	 */
	constructor(game) {
		this.game = game;
		this.reset();
	}

	reset() {
		/** @type {Object[]} Ascension modifiers chosen this run */
		this.activeModifiers = [];
		/** @type {Set<string>} Ids already offered (no repeats within a run) */
		this.offeredIds = new Set();
		/** @type {boolean} Whether an Ascension pick UI is pending */
		this.pendingPick = false;
		/** @type {Object[]|null} Current options being presented */
		this.currentOptions = null;
	}

	/**
	 * Check if a wave triggers an Ascension event.
	 * @param {number} wave
	 * @returns {boolean}
	 */
	isAscensionWave(wave) {
		return ASCENSION_WAVES.includes(wave);
	}

	/**
	 * Generate 3 random options for the player.
	 * @returns {Object[]} Array of ASCENSION_PICKS options.
	 */
	generateOptions() {
		const available = ASCENSION_POOL.filter(m => !this.offeredIds.has(m.id));

		// If fewer options than needed, allow re-offerings
		const pool = available.length >= ASCENSION_PICKS ? available : [...ASCENSION_POOL];

		// Shuffle and pick
		const shuffled = pool.sort(() => Math.random() - 0.5);
		const options = shuffled.slice(0, ASCENSION_PICKS);

		for (const opt of options) {
			this.offeredIds.add(opt.id);
		}

		this.currentOptions = options;
		this.pendingPick = true;
		return options;
	}

	/**
	 * Player selects one of the presented options.
	 * @param {string} modifierId
	 * @returns {boolean}
	 */
	selectModifier(modifierId) {
		if (!this.currentOptions) return false;

		const selected = this.currentOptions.find(m => m.id === modifierId);
		if (!selected) return false;

		this.activeModifiers.push(selected);
		this.pendingPick = false;
		this.currentOptions = null;

		// Handle consume-on-pick modifiers (e.g., instant point grants)
		if (selected.consumeOnPick && selected.effect) {
			this._applyConsumeEffect(selected.effect);
		}

		// VFX celebration
		const { width, height } = this.game.getLogicalCanvasSize();
		screenFlash();
		this.game.effectsManager.addScreenShake(8, 400);
		createFloatingText(`ASCENSION: ${selected.name}`, width / 2, height / 2 - 40, 'milestone-major');
		playSFX('boss_defeat');

		return true;
	}

	/**
	 * Get aggregated effects from all active modifiers for runtime consumption.
	 * @returns {Object}
	 */
	getAggregatedEffects() {
		const agg = {
			ricochet: false,
			deathExplosion: 0,
			cooldownMultiplier: 1,
			damageTakenMultiplier: 1,
			damageMultiplier: 1,
			maxHpMultiplier: 1,
			lifeStealPercent: 0,
			globalEnemySlow: 0,
			xpMultiplier: 1,
			hpRegenBonus: 0,
			critBounce: false,
			critBounceDamage: 0,
			scoreMultiplier: 1,
			lootChanceMultiplier: 1,
			berserkerDamagePerMissingHpPercent: 0,
			shieldNovaMultiplier: 0,
			shieldNovaRadius: 0,
			echoChance: 0,
			damageReduction: 0,
		};

		for (const mod of this.activeModifiers) {
			if (mod.consumeOnPick) continue; // already applied
			const e = mod.effect;
			if (e.ricochet) agg.ricochet = true;
			if (e.deathExplosion) agg.deathExplosion += e.deathExplosion;
			if (e.cooldownMultiplier) agg.cooldownMultiplier *= e.cooldownMultiplier;
			if (e.damageTakenMultiplier) agg.damageTakenMultiplier *= e.damageTakenMultiplier;
			if (e.damageMultiplier) agg.damageMultiplier *= e.damageMultiplier;
			if (e.maxHpMultiplier) agg.maxHpMultiplier *= e.maxHpMultiplier;
			if (e.lifeStealPercent) agg.lifeStealPercent += e.lifeStealPercent;
			if (e.globalEnemySlow) agg.globalEnemySlow = Math.min(0.80, agg.globalEnemySlow + e.globalEnemySlow);
			if (e.xpMultiplier) agg.xpMultiplier *= e.xpMultiplier;
			if (e.hpRegenBonus) agg.hpRegenBonus += e.hpRegenBonus;
			if (e.critBounce) { agg.critBounce = true; agg.critBounceDamage = e.critBounceDamage; }
			if (e.scoreMultiplier) agg.scoreMultiplier *= e.scoreMultiplier;
			if (e.lootChanceMultiplier) agg.lootChanceMultiplier *= e.lootChanceMultiplier;
			if (e.berserkerDamagePerMissingHpPercent) agg.berserkerDamagePerMissingHpPercent += e.berserkerDamagePerMissingHpPercent;
			if (e.shieldNovaMultiplier) { agg.shieldNovaMultiplier = e.shieldNovaMultiplier; agg.shieldNovaRadius = e.shieldNovaRadius; }
			if (e.echoChance) agg.echoChance += e.echoChance;
			if (e.damageReduction) agg.damageReduction = 1 - (1 - agg.damageReduction) * (1 - e.damageReduction);
		}

		return agg;
	}

	/**
	 * Handle instant-effect modifiers (e.g., bonus points).
	 * @private
	 */
	_applyConsumeEffect(effect) {
		const sm = this.game.skillManager;
		if (!sm) return;

		if (effect.bonusSkillPoints) {
			sm.unspentSkillPoints += effect.bonusSkillPoints;
		}
		if (effect.bonusAttributePoints) {
			sm.unspentAttributePoints += effect.bonusAttributePoints;
		}
	}

	// ─── SAVE / RESTORE ──────────────────────────────────────────────────────────

	getSaveState() {
		return {
			activeModifiers: this.activeModifiers.map(m => m.id),
			offeredIds: [...this.offeredIds],
		};
	}

	restoreFromSave(state) {
		if (!state) return;
		this.offeredIds = new Set(state.offeredIds || []);
		this.activeModifiers = [];
		for (const id of (state.activeModifiers || [])) {
			const mod = ASCENSION_POOL.find(m => m.id === id);
			if (mod) this.activeModifiers.push(mod);
		}
	}
}
