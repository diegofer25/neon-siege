/**
 * @fileoverview AimbotOverdrivePlugin — Gunner ultimate: rapid-fire homing at all enemies.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { createFloatingText, playSFX, screenFlash } from '../../main.js';

export class AimbotOverdrivePlugin extends BaseSkillPlugin {
	/**
	 * @param {import('../../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean}
	 */
	onCast(game, { skill }) {
		const effect = skill.effect;
		game.player.activateSkillBuff('aimbotOverdrive', {
			duration: effect.duration,
			damageMultiplier: effect.damagePerShot,
			fireInterval: 80,
			fireTimer: 0,
		});
		game.effectsManager.addScreenShake(8, 400);
		const { width, height } = game.getLogicalCanvasSize();
		createFloatingText('AIMBOT OVERDRIVE!', width / 2, height / 2 - 30, 'milestone-major');
		screenFlash();
		playSFX('boss_defeat');
		return true;
	}
}
