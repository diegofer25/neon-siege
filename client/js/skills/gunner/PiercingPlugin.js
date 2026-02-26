/**
 * @fileoverview PiercingPlugin — Gunner passive: +1 pierce per rank.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class PiercingPlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getModifiers(rank) {
		return [
			{ stat: 'pierceCount', op: 'add', value: this.skillConfig.effect.pierceCount * rank },
		];
	}
}
