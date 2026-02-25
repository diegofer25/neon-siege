/**
 * @fileoverview NeonNovaPlugin — Technomancer active: massive AoE blast.
 * Deals 40% max HP to all enemies in range (+50px radius per rank).
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { createFloatingText, playSFX, screenFlash } from '../../main.js';

export class NeonNovaPlugin extends BaseSkillPlugin {
	/**
	 * @param {import('../../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean}
	 */
	onCast(game, { skill, rank }) {
		const effect = skill.effect;
		const radius = effect.radius + effect.radiusPerRank * (rank - 1);
		const px = game.player.x;
		const py = game.player.y;
		let hitCount = 0;

		for (const enemy of game.enemies) {
			const dx = enemy.x - px;
			const dy = enemy.y - py;
			if (dx * dx + dy * dy <= radius * radius) {
				enemy.takeDamage(enemy.maxHealth * effect.damagePercent);
				hitCount++;
			}
		}

		game.createExplosion(px, py, 60);
		game.createExplosionRing(px, py, radius);
		game.effectsManager.addScreenShake(10, 400);
		const { width, height } = game.getLogicalCanvasSize();
		createFloatingText(`NEON NOVA! (${hitCount} hit)`, width / 2, height / 2 - 30, 'level-up');
		screenFlash();
		playSFX('boss_defeat');
		return true;
	}
}
