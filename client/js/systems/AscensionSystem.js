/**
 * @fileoverview AscensionSystem — manages the Ascension pick event every 5 waves.
 *
 * Every 5 waves, the player picks 1 of 3 random run-warping modifiers from the pool.
 * Modifiers stack and persist for the entire run.
 */

import { ASCENSION_POOL, ASCENSION_PICKS, ASCENSION_INTERVAL } from '../config/SkillConfig.js';
import { playSFX } from '../main.js';
import { vfxHelper } from '../managers/VFXHelper.js';
import { ActionTypes } from '../state/index.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
const screenFlash = vfxHelper.screenFlash.bind(vfxHelper);

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
		return Number.isInteger(wave) && wave > 0 && wave % ASCENSION_INTERVAL === 0;
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

		// Dispatch to state store
		this.game.dispatcher?.dispatch({
			type: ActionTypes.ASCENSION_OFFER,
			payload: { options: options.map(o => ({ id: o.id, name: o.name })) },
		});

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

		if (!this.grantModifier(selected)) return false;
		this.pendingPick = false;
		this.currentOptions = null;

		// VFX celebration
		const { width, height } = this.game.getLogicalCanvasSize();
		screenFlash();
		this.game.effectsManager.addScreenShake(8, 400);
		createFloatingText(`ASCENSION: ${selected.name}`, width / 2, height / 2 - 40, 'milestone-major');
		playSFX('boss_defeat');

		return true;
	}

	/**
	 * Grant a modifier directly by id or object (e.g., admin tools), bypassing option UI.
	 * @param {string|Object} modifierOrId
	 * @returns {boolean}
	 */
	grantModifier(modifierOrId) {
		const mod = typeof modifierOrId === 'string'
			? ASCENSION_POOL.find(m => m.id === modifierOrId)
			: modifierOrId;

		if (!mod?.id) return false;
		if (this.activeModifiers.some((m) => m.id === mod.id)) return false;

		this.activeModifiers.push(mod);
		this.offeredIds.add(mod.id);

		if (mod.consumeOnPick && mod.effect) {
			this._applyConsumeEffect(mod.effect);
		}

		return true;
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
