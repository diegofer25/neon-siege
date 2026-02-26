/**
 * @fileoverview TripleShotPlugin — Gunner passive: fire 3 bullets in a spread.
 * Side bullets deal 30% damage (+10%/rank).
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class TripleShotPlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getPlayerConfig(rank) {
		const effect = this.skillConfig.effect;
		return {
			hasTripleShot: true,
			tripleShotSideDamage: effect.sideDamageBase + effect.sideDamagePerRank * (rank - 1),
		};
	}
}
