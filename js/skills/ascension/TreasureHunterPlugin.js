/**
 * @fileoverview TreasureHunterPlugin — Ascension modifier: +100% score, 2× loot drops.
 *
 * Stat modifier — declarative multipliers on scoreMultiplier and lootChanceMultiplier.
 * scoreMultiplier is consumed by EntityManager score calculation.
 * lootChanceMultiplier is consumed by LootSystem.rollForDrop().
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class TreasureHunterPlugin extends BaseSkillPlugin {
	getModifiers(_rank, _context) {
		const e = this.getEffect();
		return [
			{ stat: 'scoreMultiplier', op: 'multiply', value: e.scoreMultiplier || 2.0 },
			{ stat: 'lootChanceMultiplier', op: 'multiply', value: e.lootChanceMultiplier || 2.0 },
		];
	}
}
