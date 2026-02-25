/**
 * @fileoverview GlassCannonPlugin — Ascension modifier: +60% damage, -30% max HP.
 *
 * Pure stat modifier — declarative multipliers on damage and maxHp.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class GlassCannonPlugin extends BaseSkillPlugin {
	getModifiers(_rank, _context) {
		const e = this.getEffect();
		return [
			{ stat: 'damage', op: 'multiply', value: e.damageMultiplier || 1.6 },
			{ stat: 'maxHp', op: 'multiply', value: e.maxHpMultiplier || 0.7 },
		];
	}
}
