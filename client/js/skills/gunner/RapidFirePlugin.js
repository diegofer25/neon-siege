/**
 * @fileoverview RapidFirePlugin — Gunner passive: +15% fire rate per rank.
 *
 * Pure declarative plugin — no event listeners, no complex behavior.
 * Demonstrates the simplest possible plugin: a single stat modifier.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class RapidFirePlugin extends BaseSkillPlugin {
	/**
	 * @param {number} rank
	 * @returns {Array<{stat: string, op: string, value: number}>}
	 */
	getModifiers(rank) {
		const bonus = this.skillConfig.effect.fireRateBonus * rank;
		return [
			{ stat: 'fireRate', op: 'add', value: bonus },
		];
	}
}
