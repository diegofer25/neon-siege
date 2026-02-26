/**
 * @fileoverview ShieldNovaPlugin — Ascension modifier: AoE blast when shield breaks.
 *
 * Event-driven plugin — subscribes to 'shield:broken'.
 * When the player's shield is fully depleted, deals damage equal to
 * shieldNovaMultiplier × maxShieldHp to all enemies within shieldNovaRadius.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { MathUtils } from '../../utils/MathUtils.js';

export class ShieldNovaPlugin extends BaseSkillPlugin {
	getEventListeners() {
		return {
			'shield:broken': this._onShieldBroken.bind(this),
		};
	}

	/**
	 * On shield break: AoE burst around the player.
	 * @param {{ player: Object, maxShieldHp: number }} payload
	 */
	_onShieldBroken({ player, maxShieldHp }) {
		if (!this.game || !this.active) return;

		const e = this.getEffect();
		const multiplier = e.shieldNovaMultiplier || 2.0;
		const radius = e.shieldNovaRadius || 150;
		const damage = maxShieldHp * multiplier;

		// Visual nova effect
		this.game.effectsManager?.createExplosion(player.x, player.y, 16);
		this.game.createExplosionRing?.(player.x, player.y, radius);
		this.game.effectsManager?.addScreenShake(6, 300);

		// Deal AoE damage
		for (const enemy of this.game.enemies) {
			if (enemy.dying || enemy.health <= 0) continue;
			const dist = MathUtils.distance(player.x, player.y, enemy.x, enemy.y);
			if (dist <= radius + enemy.radius) {
				enemy.takeDamage(damage);
				this.game.effectsManager?.createHitEffect(enemy.x, enemy.y);
			}
		}
	}
}
