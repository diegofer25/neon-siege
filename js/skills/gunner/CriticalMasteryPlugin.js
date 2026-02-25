/**
 * @fileoverview CriticalMasteryPlugin — Gunner passive: +8% crit chance and +50% crit damage per rank.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class CriticalMasteryPlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getModifiers(rank) {
		const effect = this.skillConfig.effect;
		return [
			{ stat: 'critChance', op: 'add', value: effect.critChance * rank },
			{ stat: 'critDamageMultiplier', op: 'add', value: effect.critDamageMultiplier * rank },
		];
	}
}
