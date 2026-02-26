/**
 * @fileoverview OverclockPlugin — Ascension modifier: cooldowns halved, +20% damage taken.
 *
 * Stat modifier — declarative multipliers on cooldownMultiplier and damageTaken.
 * cooldownMultiplier is consumed by the active-skill cooldown system.
 * damageTaken is consumed by Player.takeDamage() via the plugin pipeline.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class OverclockPlugin extends BaseSkillPlugin {
	getModifiers(_rank, _context) {
		const e = this.getEffect();
		return [
			{ stat: 'cooldownMultiplier', op: 'multiply', value: e.cooldownMultiplier || 0.5 },
			{ stat: 'damageTaken', op: 'multiply', value: e.damageTakenMultiplier || 1.2 },
		];
	}
}
