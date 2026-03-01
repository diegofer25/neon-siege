/**
 * @fileoverview ChainHitPlugin — Technomancer passive: explosions chain to nearby enemies.
 * Reads chainDamageEscalation from plugin modifiers (contributed by ChainMasterPlugin).
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class ChainHitPlugin extends BaseSkillPlugin {
	/**
	 * @param {number} rank
	 * @param {Object} context - { attrs, ascension, pluginMods }
	 */
	getPlayerConfig(rank, context) {
		const effect = this.skillConfig.effect;
		const chance = effect.chainChance + effect.chainChancePerRank * (rank - 1);
		const range = effect.chainRange;

		// chainDamageEscalation comes from ChainMasterPlugin via the modifier pipeline
		const escalation = (context.pluginMods && this.game)
			? this.game.skillEffectEngine.resolveStatValue('chainDamageEscalation', 0, context.pluginMods)
			: 0;

		return {
			chainHit: { chance, range, escalation },
		};
	}

	/** @param {number} _rank */
	getVisualOverrides(_rank) {
		return {
			glowColor: '#6666ff',
			overlays: [
				{ type: 'particles', color: '#6666ff', radius: 18, alpha: 0.5, pulse: false },
			],
		};
	}
}
