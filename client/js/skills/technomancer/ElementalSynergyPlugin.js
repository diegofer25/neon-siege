/**
 * @fileoverview ElementalSynergyPlugin — Technomancer passive: burn + explosions deal more damage.
 * Provides the elementalSynergy config consumed by Projectile.js explosion logic.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class ElementalSynergyPlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getPlayerConfig(rank) {
		const effect = this.skillConfig.effect;
		return {
			elementalSynergy: {
				bonus: effect.synergyDamageBonus + effect.bonusPerRank * (rank - 1),
			},
		};
	}
}
