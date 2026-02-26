/**
 * @fileoverview VolatileKillsPlugin — Technomancer passive: enemies explode on death.
 *
 * Event-driven plugin — subscribes to 'enemy:killed' to deal AoE damage.
 * Moves the hardcoded logic from CollisionSystem._handleProjectileHit() into a
 * self-contained plugin.
 *
 * Effect: Enemies explode on death, dealing X% of their max HP to nearby enemies.
 *   - Base: 20% + 10% per rank
 *   - Radius: 80px
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { dealAreaDamage } from '../../utils/AOEUtils.js';

export class VolatileKillsPlugin extends BaseSkillPlugin {
	getEventListeners() {
		return {
			'enemy:killed': this._onEnemyKilled.bind(this),
		};
	}

	/**
	 * On enemy death: deal %maxHP AoE damage to nearby enemies.
	 * @param {{ enemy: Object, position: {x: number, y: number} }} payload
	 */
	_onEnemyKilled({ enemy, position }) {
		if (!this.game || !this.active) return;

		const effect = this.skillConfig.effect;
		const percent = effect.deathExplosionPercent + effect.percentPerRank * (this.rank - 1);
		const radius = effect.deathExplosionRadius;
		const deathDmg = enemy.maxHealth * percent;

		// AoE damage to nearby enemies
		dealAreaDamage(this.game.enemies, position.x, position.y, radius, {
			damage: deathDmg,
			excludeEnemy: enemy,
		});

		// Visual: explosion + ring
		this.game.createExplosion(position.x, position.y, 10);
		this.game.createExplosionRing(position.x, position.y, radius);
	}
}
