/**
 * @fileoverview BulletTimePlugin — Ascension modifier: enemies move 20% slower.
 *
 * Player-config plugin — installs a global enemy slow factor on the player.
 * The Enemy.update() method reads `game.player.globalEnemySlow` to reduce
 * enemy movement speed.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class BulletTimePlugin extends BaseSkillPlugin {
	/**
	 * Install global enemy slow on the player.
	 * @param {number} _rank
	 * @param {Object} _context
	 * @returns {Object}
	 */
	getPlayerConfig(_rank, _context) {
		const e = this.getEffect();
		return {
			globalEnemySlow: e.globalEnemySlow || 0.20,
		};
	}
}
