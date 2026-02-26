/**
 * @fileoverview BerserkerPlugin — Ascension modifier: +3% damage per 10% HP missing.
 *
 * Dynamic stat plugin — installs a berserker config on the player that the
 * damage calculation reads at hit-time. The bonus is evaluated per-hit based
 * on current HP ratio, not at stat-sync time (since HP is always changing).
 *
 * Also provides getPlayerConfig to install the berserker config object.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class BerserkerPlugin extends BaseSkillPlugin {
	/**
	 * Install berserker config on the player for per-hit damage scaling.
	 * @param {number} _rank
	 * @param {Object} _context
	 * @returns {Object}
	 */
	getPlayerConfig(_rank, _context) {
		const e = this.getEffect();
		return {
			berserker: {
				damagePerMissingHpPercent: e.berserkerDamagePerMissingHpPercent || 0.03,
			},
		};
	}
}
