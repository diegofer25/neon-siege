/**
 * @fileoverview BarragePlugin — Gunner active: rapid burst of homing shots.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { createFloatingText, playSFX } from '../../main.js';

export class BarragePlugin extends BaseSkillPlugin {
	/**
	 * @param {import('../../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean}
	 */
	onCast(game, { skill, rank }) {
		const effect = skill.effect;
		const shotCount = effect.shotCount + effect.shotsPerRank * (rank - 1);
		game.player.activateSkillBuff('bulletStorm', {
			shotsRemaining: shotCount,
			duration: effect.duration,
			interval: effect.duration / shotCount,
			timer: 0,
		});
		game.effectsManager.addScreenShake(5, 200);
		const { width, height } = game.getLogicalCanvasSize();
		createFloatingText('BULLET STORM!', width / 2, height / 2 - 30, 'level-up');
		playSFX('powerup');
		return true;
	}
}
