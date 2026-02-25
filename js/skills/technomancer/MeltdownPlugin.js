/**
 * @fileoverview MeltdownPlugin — Technomancer passive: hitting burning enemies triggers bonus explosions.
 *
 * Event-driven plugin: subscribes to 'enemy:hit'. When a projectile damages a
 * burning enemy, there's a chance to trigger an AoE explosion that deals
 * damage scaled by the hit damage and the meltdown ratio.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { dealAreaDamage } from '../../utils/AOEUtils.js';

export class MeltdownPlugin extends BaseSkillPlugin {
	getEventListeners() {
		return {
			'enemy:hit': this._onEnemyHit.bind(this),
		};
	}

	/**
	 * @param {{ enemy: Object, projectile: Object, damage: number }} payload
	 */
	_onEnemyHit({ enemy, damage }) {
		if (!this.game || !this.active) return;
		if (!enemy.isBurning) return;

		const effect = this.skillConfig.effect;
		const chance = effect.meltdownChance + effect.chancePerRank * (this.rank - 1);
		if (Math.random() >= chance) return;

		const meltdownDmg = damage * effect.meltdownDamageRatio;
		const radius = effect.meltdownRadius;

		dealAreaDamage(this.game.enemies, enemy.x, enemy.y, radius, {
			damage: meltdownDmg,
			falloff: true,
			excludeEnemy: enemy,
		});

		this.game.createExplosion(enemy.x, enemy.y, 6);
		this.game.createExplosionRing(enemy.x, enemy.y, radius);
	}
}
