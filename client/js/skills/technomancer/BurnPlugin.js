/**
 * @fileoverview BurnPlugin — Technomancer passive: immolation aura burns nearby enemies.
 * Provides the immolationAura config consumed by Player.js update loop.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class BurnPlugin extends BaseSkillPlugin {
	/**
	 * @param {number} rank
	 * @param {Object} context - { attrs, ascension }
	 */
	getPlayerConfig(rank, context) {
		const effect = this.skillConfig.effect;
		const damagePercent = effect.burnDamagePercent * rank;
		const range = effect.baseRange + effect.rangePerRank * rank;
		const aoeMultiplier = context.attrs?.aoeRadiusMultiplier || 1;

		return {
			immolationAura: {
				damagePercent,
				range: range * aoeMultiplier,
				active: true,
			},
		};
	}
}
