/**
 * @fileoverview RicochetPlugin — Ascension modifier: projectiles bounce off walls once.
 *
 * Player-config plugin — installs ricochet config on the player.
 * The Projectile.update() method reads `ricochetEnabled` to bounce off screen edges
 * instead of being destroyed.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class RicochetPlugin extends BaseSkillPlugin {
	/**
	 * Install ricochet config on the player.
	 * @param {number} _rank
	 * @param {Object} _context
	 * @returns {Object}
	 */
	getPlayerConfig(_rank, _context) {
		return {
			ricochetEnabled: true,
		};
	}
}
