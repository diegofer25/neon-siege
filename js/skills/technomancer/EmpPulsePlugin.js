/**
 * @fileoverview EmpPulsePlugin — Technomancer active: slow all enemies in radius.
 *
 * Active skill plugin — implements onCast() to handle the gameplay effect.
 * Moves the hardcoded logic from Game.castActiveSkill() case 'techno_emp_pulse'
 * into a self-contained plugin.
 *
 * Effect: Slow all enemies by 60% for 4s (+1.5s/rank) in a 200px radius.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { createFloatingText, playSFX } from '../../main.js';

export class EmpPulsePlugin extends BaseSkillPlugin {
	/**
	 * Cast EMP Pulse — slow enemies in radius.
	 * @param {import('../../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean}
	 */
	onCast(game, { skill, rank }) {
		const effect = skill.effect;
		const duration = effect.duration + effect.durationPerRank * (rank - 1);
		const radius = effect.radius;
		const slowFactor = Math.max(0.1, 1 - effect.slowAmount);

		const px = game.player.x;
		const py = game.player.y;

		// Apply slow to all enemies in radius
		for (const enemy of game.enemies) {
			const dx = enemy.x - px;
			const dy = enemy.y - py;
			if (dx * dx + dy * dy <= radius * radius) {
				enemy.slowFactor = slowFactor;
				enemy._empSlowTimer = duration;
			}
		}

		// Visual: expanding ring
		game.createExplosionRing(px, py, radius);
		game.effectsManager.addScreenShake(4, 200);

		const { width, height } = game.getLogicalCanvasSize();
		createFloatingText('EMP PULSE!', width / 2, height / 2 - 30, 'level-up');
		playSFX('powerup');

		return true;
	}
}
