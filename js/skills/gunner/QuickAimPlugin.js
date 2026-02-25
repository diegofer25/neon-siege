/**
 * @fileoverview QuickAimPlugin — Gunner passive: +20% turn speed per rank.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class QuickAimPlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getModifiers(rank) {
		return [
			{ stat: 'rotationSpeed', op: 'add', value: this.skillConfig.effect.turnSpeedBonus * rank },
		];
	}
}
