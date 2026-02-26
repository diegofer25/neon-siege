/**
 * @fileoverview ResiliencePlugin — Ascension modifier: reduce all damage taken by 15%.
 *
 * Stat modifier — declarative damageReduction value.
 * Uses multiplicative stacking: 1 - (1 - existing) * (1 - this).
 * Consumed by Player.takeDamage() via the plugin pipeline.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class ResiliencePlugin extends BaseSkillPlugin {
	getModifiers(_rank, _context) {
		const e = this.getEffect();
		return [
			{ stat: 'damageReduction', op: 'add', value: e.damageReduction || 0.15 },
		];
	}
}
