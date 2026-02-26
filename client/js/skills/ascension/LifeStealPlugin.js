/**
 * @fileoverview LifeStealPlugin — Ascension modifier: heal % of damage dealt on kill.
 *
 * Event-driven plugin — subscribes to 'enemy:killed' to heal the player.
 * Proves that ascension modifiers fit the same plugin model as skills.
 *
 * Effect: Heal 2% of enemy maxHealth on kill.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class LifeStealPlugin extends BaseSkillPlugin {
	getEventListeners() {
		return {
			'enemy:killed': this._onEnemyKilled.bind(this),
		};
	}

	/**
	 * On enemy death: heal player by lifeStealPercent * enemy maxHealth.
	 * @param {{ enemy: Object }} payload
	 */
	_onEnemyKilled({ enemy }) {
		if (!this.game || !this.active) return;

		const player = this.game.player;
		if (!player || player.hp <= 0) return;

		const healAmount = enemy.maxHealth * this.skillConfig.effect.lifeStealPercent;
		if (healAmount > 0) {
			player.hp = Math.min(player.maxHp, player.hp + healAmount);
		}
	}
}
