/**
 * @fileoverview FocusedFirePlugin — Gunner active: +100% fire rate for 4s (+1s/rank).
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { playSFX } from '../../main.js';
import { vfxHelper } from '../../managers/VFXHelper.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);

export class FocusedFirePlugin extends BaseSkillPlugin {
	/**
	 * @param {import('../../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean}
	 */
	onCast(game, { skill, rank }) {
		const effect = skill.effect;
		const duration = effect.duration + effect.durationPerRank * (rank - 1);
		game.player.activateSkillBuff('focusedFire', {
			fireRateMultiplier: effect.fireRateMultiplier,
			duration,
		});
		game.effectsManager.addScreenShake(3, 150);
		const { width, height } = game.getLogicalCanvasSize();
		createFloatingText('FOCUSED FIRE!', width / 2, height / 2 - 30, 'level-up');
		playSFX('powerup');
		return true;
	}
}
