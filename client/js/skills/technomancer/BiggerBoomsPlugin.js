/**
 * @fileoverview BiggerBoomsPlugin — Technomancer passive: +25% explosion radius and +15% damage per rank.
 * Multiplies the base radius from ExplosiveRoundsPlugin and adds to damage ratio.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class BiggerBoomsPlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getModifiers(rank) {
		const effect = this.skillConfig.effect;
		return [
			{ stat: 'explosionRadius', op: 'multiply', value: 1 + effect.radiusBonus * rank },
			{ stat: 'explosionDamageRatio', op: 'add', value: effect.damageBonus * rank },
		];
	}
}
