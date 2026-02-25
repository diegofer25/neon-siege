/**
 * @fileoverview EchoStrikePlugin — Ascension modifier: chance to fire duplicate projectile.
 *
 * Event-driven plugin — subscribes to 'projectile:fired'.
 * On each projectile fired, rolls a chance to create an identical duplicate
 * with a slight angle offset.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

/** Angle offset for the echo projectile (radians, ~5°) */
const ECHO_ANGLE_OFFSET = Math.PI / 36;

export class EchoStrikePlugin extends BaseSkillPlugin {
	getEventListeners() {
		return {
			'projectile:fired': this._onProjectileFired.bind(this),
		};
	}

	/**
	 * On projectile fired: chance to create a duplicate.
	 * @param {{ projectile: Object, angle: number, damage: number }} payload
	 */
	_onProjectileFired({ projectile, angle, damage }) {
		if (!this.game || !this.active) return;

		// Don't echo an echo (prevent infinite loops)
		if (projectile._isEcho) return;

		const e = this.getEffect();
		const chance = e.echoChance || 0.15;

		if (Math.random() >= chance) return;

		// Create a duplicate projectile with slight angle offset
		const player = this.game.player;
		if (!player || !this.game.projectilePool) return;

		const echoAngle = angle + (Math.random() > 0.5 ? ECHO_ANGLE_OFFSET : -ECHO_ANGLE_OFFSET);

		const echo = this.game.projectilePool.get(
			player.x,
			player.y,
			echoAngle,
			damage,
			player.projectileSpeedMod,
			{}
		);

		// Mark as echo to prevent recursive echoing
		echo._isEcho = true;

		// Copy piercing properties from original
		if (projectile.piercing) {
			echo.piercing = true;
			echo.piercingCount = projectile.piercingCount;
			echo.originalDamage = echo.damage;
			echo.enemiesHit = 0;
		}

		this.game.projectiles.push(echo);
	}
}
