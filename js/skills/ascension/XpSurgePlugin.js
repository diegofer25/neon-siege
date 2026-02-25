/**
 * @fileoverview XpSurgePlugin — Ascension modifier: +40% XP from all sources.
 *
 * Pure stat modifier — declarative multiplier on xpMultiplier.
 * Consumed by Game.addXP() and wave clear XP calculation.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class XpSurgePlugin extends BaseSkillPlugin {
	getModifiers(_rank, _context) {
		const e = this.getEffect();
		return [
			{ stat: 'xpMultiplier', op: 'multiply', value: e.xpMultiplier || 1.4 },
		];
	}
}
