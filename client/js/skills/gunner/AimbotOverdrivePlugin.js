/**
 * @fileoverview AimbotOverdrivePlugin — Gunner ultimate: rapid-fire homing at all enemies.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { playSFX } from '../../main.js';
import { vfxHelper } from '../../managers/VFXHelper.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
const screenFlash = vfxHelper.screenFlash.bind(vfxHelper);

export class AimbotOverdrivePlugin extends BaseSkillPlugin {
	/** Passive: homing projectiles (merged from Homing Rounds) */
	getModifiers() {
		const homing = this.skillConfig.effect.homingStrength;
		if (!homing) return [];
		return [
			{ stat: 'homingStrength', op: 'set', value: homing },
		];
	}

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
