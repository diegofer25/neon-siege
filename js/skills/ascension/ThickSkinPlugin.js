/**
 * @fileoverview ThickSkinPlugin — Ascension modifier: +40% max HP and +2 HP regen/sec.
 *
 * Pure stat modifier — declarative multiplier on maxHp and additive hpRegen.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class ThickSkinPlugin extends BaseSkillPlugin {
	getModifiers(_rank, _context) {
		const e = this.getEffect();
		return [
			{ stat: 'maxHp', op: 'multiply', value: e.maxHpMultiplier || 1.4 },
			{ stat: 'hpRegen', op: 'add', value: e.hpRegenBonus || 2 },
		];
	}
}
